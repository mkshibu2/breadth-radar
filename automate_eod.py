#!/usr/bin/env python3
import os
import sys
import json
import argparse
import pandas as pd
import numpy as np
import yfinance as yf
from datetime import datetime, timedelta
import urllib.request
import urllib.error
import io
import time
from contextlib import contextmanager

def execute_request_with_retry(req, max_retries=5, initial_backoff=2):
    """
    Execute an urllib request with exponential backoff for transient issues.
    """
    for attempt in range(1, max_retries + 1):
        try:
            # Set a timeout for the connection to avoid hanging indefinitely
            with urllib.request.urlopen(req, timeout=15) as response:
                return response.read()
        except Exception as e:
            is_transient = True
            # If it's an HTTPError, check the status code
            if isinstance(e, urllib.error.HTTPError):
                # Client errors (except 429) are usually not transient, so do not retry
                if 400 <= e.code < 500 and e.code != 429:
                    is_transient = False
            
            if not is_transient or attempt == max_retries:
                raise e
            
            backoff = initial_backoff * (2 ** (attempt - 1))
            print(f"⚠️ JSONBin request failed: {e}. Retrying attempt {attempt}/{max_retries} in {backoff}s...", file=sys.stderr)
            time.sleep(backoff)


# Suppress stdout/stderr to prevent yfinance/pandas output from corrupting stdout JSON
@contextmanager
def suppress_output():
    with open(os.devnull, 'w') as devnull:
        old_out = sys.stdout
        old_err = sys.stderr
        sys.stdout = devnull
        sys.stderr = devnull
        try:
            yield
        finally:
            sys.stdout = old_out
            sys.stderr = old_err


# ==============================================================================
# FTD (Follow-Through Day) Automation Engine
# Based on William J. O'Neil / CAN SLIM methodology adapted for Nifty 50
# ==============================================================================
FTD_MIN_DAY = 3
FTD_MIN_MOVE = 1.5
FTD_POWER_MAX = 7

def count_distribution_days(mpm_days, attempt_date=None):
    """
    Count active distribution days in the last 25 sessions since attempt_date,
    applying O'Neil's 5% cancellation rule.
    """
    if not mpm_days:
        return 0
    all_mpm = mpm_days
    last25 = mpm_days[:25]
    active_count = 0
    for d in last25:
        if d.get("dtype") != "dist":
            continue
        close = float(d.get("close") or 0)
        pclose = float(d.get("pclose") or 0)
        move_pct = ((close - pclose) / pclose * 100) if pclose > 0 else 0
        if move_pct > -0.2:
            continue
        if attempt_date and d.get("date", "") < attempt_date:
            continue
        # Cancellation rule: any subsequent day closes >= close * 1.05
        is_cancelled = False
        for x in all_mpm:
            if x.get("date", "") > d.get("date", ""):
                x_close = float(x.get("close") or 0)
                if x_close >= close * 1.05:
                    is_cancelled = True
                    break
        if not is_cancelled:
            active_count += 1
    return active_count

def compute_ftd_state(ftd_days, records, mpm_days):
    """
    Evaluate FTD market state:
    Returns dict:
      status: 'none' | 'watching' | 'confirmed' | 'void' | 'correction'
      rally_day: int
      ftd_confirmed: bool
      ftd_power_window: bool
      latest_ftd: dict or None
      dist_count: int
      is_correction: bool
    """
    if not ftd_days:
        return {
            "status": "none",
            "rally_day": 0,
            "ftd_confirmed": False,
            "ftd_power_window": False,
            "void_active": False,
            "latest_ftd": None,
            "is_correction": False,
            "dist_count": 0
        }

    recent_sig = None
    for d in ftd_days:
        if d.get("type") != "distribution":
            recent_sig = d
            break

    if recent_sig and recent_sig.get("type") == "void":
        return {
            "status": "void",
            "rally_day": 0,
            "ftd_confirmed": False,
            "ftd_power_window": False,
            "void_active": True,
            "latest_ftd": None,
            "is_correction": False,
            "void_reason": recent_sig.get("voidReason", "Attempt voided"),
            "dist_count": 0
        }

    void_idx = next((i for i, d in enumerate(ftd_days) if d.get("type") == "void"), -1)
    active_days = ftd_days[:void_idx] if void_idx >= 0 else ftd_days

    attempts = [d for d in active_days if d.get("type") == "attempt"]
    ftds = [d for d in active_days if d.get("type") == "followthrough"]

    if not attempts and not ftds:
        return {
            "status": "none",
            "rally_day": 0,
            "ftd_confirmed": False,
            "ftd_power_window": False,
            "void_active": False,
            "latest_ftd": None,
            "is_correction": False,
            "dist_count": 0
        }

    attempt_date = attempts[0].get("date") if attempts else (ftds[0].get("date") if ftds else None)
    sessions_since_d1 = len([r for r in records if r.get("date", "") >= attempt_date]) if attempt_date else 0
    non_dist_count = len([d for d in active_days if attempt_date and d.get("date", "") >= attempt_date and d.get("type") != "distribution"])
    rally_day = max(sessions_since_d1, non_dist_count)

    dist_count = count_distribution_days(mpm_days, attempt_date)

    current_rally_ftds = [d for d in ftds if d.get("date", "") >= attempt_date] if attempt_date else (ftds if not attempts else [])
    latest_ftd = current_rally_ftds[0] if current_rally_ftds else None

    ftd_day_of_rally = len([r for r in records if attempt_date and r.get("date", "") >= attempt_date and r.get("date", "") <= latest_ftd.get("date", "")]) if latest_ftd else 0
    ftd_day_check = ftd_day_of_rally if ftd_day_of_rally > 0 else rally_day

    ftd_meets_min = False
    if latest_ftd:
        m_pct = float(latest_ftd.get("movePct") or 0)
        v_up = latest_ftd.get("volUp") is True
        if latest_ftd.get("auto"):
            ftd_meets_min = (ftd_day_check >= FTD_MIN_DAY and m_pct >= FTD_MIN_MOVE and v_up)
        else:
            ftd_meets_min = (ftd_day_check >= FTD_MIN_DAY and m_pct >= FTD_MIN_MOVE)

    if ftd_meets_min:
        post_ftd_records = [r for r in records if r.get("date", "") >= latest_ftd.get("date", "")]
        post_ftd_closes = [float(r.get("nifty") or 0) for r in post_ftd_records if float(r.get("nifty") or 0) > 0]
        max_post_ftd = max(post_ftd_closes) if post_ftd_closes else 0.0
        curr_nifty = float(records[0].get("nifty") or 0) if records else 0.0
        decline_from_high = round((max_post_ftd - curr_nifty) / max_post_ftd * 100, 1) if (max_post_ftd > 0 and curr_nifty > 0) else 0.0

        is_corr = (dist_count >= 5) or (decline_from_high >= 6.0)
        if is_corr:
            return {
                "status": "correction",
                "rally_day": rally_day,
                "ftd_confirmed": False,
                "ftd_power_window": False,
                "void_active": False,
                "latest_ftd": None,
                "is_correction": True,
                "dist_count": dist_count,
                "decline_from_high": decline_from_high
            }

        return {
            "status": "confirmed",
            "rally_day": rally_day,
            "ftd_confirmed": True,
            "ftd_power_window": (ftd_day_check <= FTD_POWER_MAX),
            "void_active": False,
            "latest_ftd": latest_ftd,
            "is_correction": False,
            "dist_count": dist_count,
            "decline_from_high": decline_from_high
        }

    if dist_count >= 5:
        return {
            "status": "correction",
            "rally_day": rally_day,
            "ftd_confirmed": False,
            "ftd_power_window": False,
            "void_active": False,
            "latest_ftd": None,
            "is_correction": True,
            "dist_count": dist_count
        }

    if attempts or ftds:
        return {
            "status": "watching",
            "rally_day": rally_day,
            "ftd_confirmed": False,
            "ftd_power_window": False,
            "void_active": False,
            "latest_ftd": None,
            "is_correction": False,
            "dist_count": dist_count
        }

    return {
        "status": "none",
        "rally_day": 0,
        "ftd_confirmed": False,
        "ftd_power_window": False,
        "void_active": False,
        "latest_ftd": None,
        "is_correction": False,
        "dist_count": 0
    }

def scan_undercut_all(ftd_days, records):
    if not ftd_days or not records:
        return ftd_days, None

    def get_rec_low(r):
        if not r: return 0.0
        l = float(r.get("niftyLow") or 0)
        c = float(r.get("nifty") or 0)
        return l if l > 0 else (c if c > 0 else 0.0)

    attempts = [d for d in ftd_days if d.get("type") == "attempt" or (d.get("type") == "void" and d.get("_origType") == "attempt" and d.get("voidReason") != "Manual void")]
    attempts.sort(key=lambda x: x.get("date", ""))

    target_attempt = None
    if attempts:
        for i, att in enumerate(attempts):
            low_ref = float(att.get("low") or 0)
            if low_ref <= 0:
                rec = next((r for r in records if r.get("date") == att.get("date")), None)
                if rec: low_ref = get_rec_low(rec)
            if low_ref <= 0:
                low_ref = float(att.get("close") or 0)

            next_att_date = attempts[i + 1].get("date") if i < len(attempts) - 1 else None
            interim_recs = [r for r in records if r.get("date", "") > att.get("date", "") and (not next_att_date or r.get("date", "") < next_att_date)]
            interim_undercut = any(0 < get_rec_low(ir) < low_ref for ir in interim_recs)
            if not interim_undercut:
                target_attempt = att
                break
        if not target_attempt:
            target_attempt = attempts[-1]
    else:
        ftds = [d for d in ftd_days if d.get("type") == "followthrough" or (d.get("type") == "void" and d.get("_origType") == "followthrough" and d.get("voidReason") != "Manual void")]
        ftds.sort(key=lambda x: x.get("date", ""), reverse=True)
        if ftds: target_attempt = ftds[0]

    if not target_attempt:
        return ftd_days, None

    day1_ref = float(target_attempt.get("low") or 0)
    if day1_ref <= 0:
        rec = next((r for r in records if r.get("date") == target_attempt.get("date")), None)
        if rec: day1_ref = get_rec_low(rec)
    if day1_ref <= 0:
        day1_ref = float(target_attempt.get("close") or 0)
    if day1_ref <= 0:
        return ftd_days, None

    post_records = [r for r in records if r.get("date", "") > target_attempt.get("date", "")]
    post_records.sort(key=lambda x: x.get("date", ""))

    undercut_date, undercut_val = None, None
    for r in post_records:
        test_val = get_rec_low(r)
        # An FTD confirmation session closing up strongly is not an undercut
        is_ftd_day = any(d.get("date") == r.get("date") and d.get("type") == "followthrough" for d in ftd_days)
        if 0 < test_val < day1_ref and not is_ftd_day:
            undercut_date = r.get("date")
            undercut_val = test_val
            break

    now_ms = int(time.time() * 1000)
    if not undercut_date:
        cleaned = []
        for d in ftd_days:
            item = dict(d)
            if item.get("date", "") >= target_attempt.get("date", ""):
                if item.get("type") == "void" and item.get("voidedBy") and item.get("voidReason") != "Manual void":
                    orig = item.get("_origType") or ("attempt" if item.get("date") == target_attempt.get("date") else "followthrough")
                    item.pop("voidedBy", None)
                    item.pop("voidReason", None)
                    item.pop("_origType", None)
                    item["type"] = orig
                    item["_updatedAt"] = now_ms
            if item.get("date", "") > target_attempt.get("date", "") and (item.get("type") == "attempt" or item.get("_origType") == "attempt"):
                continue
            cleaned.append(item)
        return cleaned, None

    voided = []
    for d in ftd_days:
        item = dict(d)
        if target_attempt.get("date", "") <= item.get("date", "") <= undercut_date:
            if item.get("type") in ("attempt", "followthrough"):
                item["_origType"] = item.get("type")
                item["type"] = "void"
                item["_updatedAt"] = now_ms
                item["voidedBy"] = undercut_date
                item["voidReason"] = f"Low undercut ({undercut_val} < rally low {day1_ref} on {undercut_date})"
        voided.append(item)
    return voided, f"Rally low {day1_ref} undercut by {undercut_val} on {undercut_date}"

def update_ftd_daily(ftd_days, records, mpm_days, target_date_str, nifty_close, nifty_low, nifty_vol, prev_close, prev_vol):
    if ftd_days is None:
        ftd_days = []

    ftd_days, void_msg = scan_undercut_all(ftd_days, records)
    if void_msg:
        print(f"⚠️ FTD Undercut Alert: {void_msg}", file=sys.stderr)

    move_pct = round((nifty_close - prev_close) / prev_close * 100, 2) if prev_close > 0 else 0.0
    vol_up = (nifty_vol > prev_vol) if (nifty_vol > 0 and prev_vol > 0) else False

    state = compute_ftd_state(ftd_days, records, mpm_days)
    curr_status = state["status"]
    curr_rally_day = state["rally_day"]
    has_active_attempt = (curr_status in ("watching", "confirmed"))

    auto_type = None

    if has_active_attempt and (curr_rally_day + 1 >= FTD_MIN_DAY) and (move_pct >= FTD_MIN_MOVE) and vol_up:
        auto_type = "followthrough"
    elif (not has_active_attempt) and (move_pct > 0):
        auto_type = "attempt"
        # Benchmark rally low should be the cycle bottom (min of today low and preceding breakdown low)
        prev_rec = next((r for r in records if r.get("date", "") < target_date_str and float(r.get("niftyLow") or 0) > 0), None)
        p_low = float(prev_rec.get("niftyLow") or 0) if prev_rec else 0
        if 0 < p_low < nifty_low:
            nifty_low = p_low
    elif move_pct < 0 and vol_up:
        auto_type = "distribution"

    now_ms = int(time.time() * 1000)
    existing_today = next((d for d in ftd_days if d.get("date") == target_date_str), None)

    if existing_today and not existing_today.get("auto", True):
        pass  # Respect manual entry
    elif auto_type:
        ftd_days = [d for d in ftd_days if d.get("date") != target_date_str]
        new_entry = {
            "id": now_ms,
            "date": target_date_str,
            "_updatedAt": now_ms,
            "close": nifty_close,
            "prev": prev_close,
            "low": nifty_low,
            "movePct": move_pct,
            "volUp": vol_up,
            "type": auto_type,
            "auto": True
        }
        ftd_days.insert(0, new_entry)

    ftd_days, void_msg2 = scan_undercut_all(ftd_days, records)
    ftd_days.sort(key=lambda x: x.get("date", ""), reverse=True)
    ftd_days = ftd_days[:100]

    final_state = compute_ftd_state(ftd_days, records, mpm_days)
    return ftd_days, final_state, auto_type

def main():
    parser = argparse.ArgumentParser(description="Automate EOD Breadth and Nifty calculation and sync to JSONBin.")
    parser.add_argument("--date", type=str, default="today", help="Date in YYYY-MM-DD format or 'today'")
    parser.add_argument("--push", action="store_true", help="Push data directly to JSONBin.io (requires env variables)")
    args = parser.parse_args()

    script_dir = os.path.dirname(os.path.abspath(__file__))
    csv_path = os.path.join(script_dir, 'ind_nifty500list.csv')
    
    if not os.path.exists(csv_path):
        print(json.dumps({"error": f"Ticker list CSV not found at {csv_path}"}), file=sys.stderr)
        sys.exit(1)

    # 1. Load tickers
    try:
        df_tickers = pd.read_csv(csv_path)
        raw_symbols = df_tickers['Symbol'].dropna().tolist()
        symbols = [s.strip() for s in raw_symbols if s.strip() and not s.startswith('DUMMY')]
        yf_tickers = [s + '.NS' for s in symbols]
    except Exception as e:
        print(json.dumps({"error": f"Failed to load ticker list: {str(e)}"}), file=sys.stderr)
        sys.exit(1)

    # 2. Determine target date
    # Download a small slice of ^NSEI to find the latest trading day
    today_dt = datetime.now()
    start_search = today_dt - timedelta(days=10)
    
    with suppress_output():
        nifty_meta = yf.download('^NSEI', start=start_search, end=today_dt + timedelta(days=2), progress=False)

    if nifty_meta.empty:
        print(json.dumps({"error": "Failed to download Nifty 50 metadata from Yahoo Finance"}), file=sys.stderr)
        sys.exit(1)

    if isinstance(nifty_meta.columns, pd.MultiIndex):
        nifty_meta.columns = nifty_meta.columns.get_level_values(0)
    # Convert Nifty index to date index
    nifty_meta.index = pd.to_datetime(nifty_meta.index).date

    if args.date == "today":
        target_date = nifty_meta.index[-1]
    else:
        try:
            target_date = datetime.strptime(args.date, "%Y-%m-%d").date()
        except ValueError:
            print(json.dumps({"error": f"Invalid date format: {args.date}. Must be YYYY-MM-DD"}), file=sys.stderr)
            sys.exit(1)

    # Check if target date exists in Nifty trading days
    if target_date not in nifty_meta.index:
        # Find the closest preceding trading day
        preceding_days = [d for d in nifty_meta.index if d <= target_date]
        if not preceding_days:
            print(json.dumps({"error": f"No trading days found on or before {target_date}"}), file=sys.stderr)
            sys.exit(1)
        target_date = preceding_days[-1]

    # 3. Calculate data windows
    # Needs 400 days to calculate 200 SMA and 252-day high/low safely
    start_date = target_date - timedelta(days=400)
    end_date = target_date + timedelta(days=2)

    # 4. Fetch Nifty 50 and Nifty 500 components in parallel
    with suppress_output():
        # Fetch Nifty 50
        nifty_history = yf.download('^NSEI', start=start_date, end=end_date, progress=False)
        nifty_history.index = pd.to_datetime(nifty_history.index).date
        if isinstance(nifty_history.columns, pd.MultiIndex):
            nifty_history.columns = nifty_history.columns.get_level_values(0)
        
        # Fetch Nifty 500
        stocks_data = yf.download(yf_tickers, start=start_date, end=end_date, group_by='ticker', threads=True, progress=False)

    # 5. Process Nifty 50 metrics
    if target_date not in nifty_history.index:
        print(json.dumps({"error": f"Target date {target_date} missing in Nifty 50 history"}), file=sys.stderr)
        sys.exit(1)
        
    nifty_row = nifty_history.loc[target_date]
    nifty_close = round(float(nifty_row['Close']), 2)
    nifty_low = round(float(nifty_row['Low']), 2)

    # Calculate Nifty 50 volume by summing constituent volumes
    nifty50_symbols = []
    try:
        nifty50_url = "https://archives.nseindia.com/content/indices/ind_nifty50list.csv"
        req = urllib.request.Request(
            nifty50_url, 
            headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'}
        )
        with urllib.request.urlopen(req) as response:
            content = response.read().decode('utf-8')
            df_nifty50 = pd.read_csv(io.StringIO(content))
            nifty50_symbols = [s.strip() for s in df_nifty50['Symbol'].dropna().tolist()]
    except Exception:
        # Fallback list if the download fails
        nifty50_symbols = [
            "ADANIENT", "ADANIPORTS", "APOLLOHOSP", "ASIANPAINT", "AXISBANK", 
            "BAJAJ-AUTO", "BAJFINANCE", "BAJAJFINSV", "BEL", "BPCL", 
            "BHARTIARTL", "BRITANNIA", "CIPLA", "COALINDIA", "DIVISLAB", 
            "DRREDDY", "EICHERMOT", "GRASIM", "HCLTECH", "HDFCBANK", 
            "HDFCLIFE", "HEROMOTOCO", "HINDALCO", "HINDUNILVR", "ICICIBANK", 
            "ITC", "INDUSINDBK", "INFY", "JSWSTEEL", "KOTAKBANK", 
            "LTIM", "LT", "M&M", "MARUTI", "NTPC", 
            "NESTLEIND", "ONGC", "POWERGRID", "RELIANCE", "SBILIFE", 
            "SHRIRAMFIN", "SBIN", "SUNPHARMA", "TCS", "TATACONSUM", 
            "TATAMOTORS", "TATASTEEL", "TECHM", "TITAN", "ULTRACEMCO", "WIPRO"
        ]

    nifty_vol_raw = 0.0
    for s in nifty50_symbols:
        ticker = s + '.NS'
        if ticker in stocks_data.columns.levels[0]:
            df_stock = stocks_data[ticker].dropna(subset=['Volume'])
            if not df_stock.empty:
                df_stock.index = pd.to_datetime(df_stock.index).date
                if target_date in df_stock.index:
                    vol_val = df_stock.loc[target_date, 'Volume']
                    if isinstance(vol_val, pd.Series):
                        vol_val = vol_val.iloc[0]
                    nifty_vol_raw += float(vol_val)
                    
    nifty_vol = round(nifty_vol_raw / 1e7, 2) if nifty_vol_raw > 0 else 0.0

    # 6. Process Nifty 500 stocks
    advances = 0
    declines = 0
    unchanged = 0
    highs_52w = 0
    lows_52w = 0
    above_sma20 = 0
    above_sma50 = 0
    above_sma200 = 0
    total_valid_stocks = 0

    for sym in symbols:
        ticker = sym + '.NS'
        if ticker not in stocks_data.columns.levels[0]:
            continue
        
        df = stocks_data[ticker].dropna(subset=['Close'])
        if df.empty:
            continue
            
        df.index = pd.to_datetime(df.index).date
        if target_date not in df.index:
            continue
            
        # Get location index of target date
        idx = df.index.get_loc(target_date)
        if idx < 1:  # Need at least one preceding row for previous close
            continue

        total_valid_stocks += 1
        close = float(df['Close'].iloc[idx])
        prev_close = float(df['Close'].iloc[idx - 1])
        high = float(df['High'].iloc[idx])
        low = float(df['Low'].iloc[idx])

        # Advances / Declines
        if close > prev_close:
            advances += 1
        elif close < prev_close:
            declines += 1
        else:
            unchanged += 1

        # 52W High / Low
        # Look back 252 trading days including target date
        window_start = max(0, idx - 251)
        window = df.iloc[window_start : idx + 1]
        
        hist_high = float(window['High'].max())
        hist_low = float(window['Low'].min())

        if high >= hist_high:
            highs_52w += 1
        if low <= hist_low:
            lows_52w += 1

        # Indicators
        # Calculated on the full history to keep SMA continuous and stable
        sma20_series = df['Close'].rolling(window=20).mean()
        sma50_series = df['Close'].rolling(window=50).mean()
        sma200_series = df['Close'].rolling(window=200).mean()

        if pd.notna(sma20_series.iloc[idx]) and close > sma20_series.iloc[idx]:
            above_sma20 += 1
        if pd.notna(sma50_series.iloc[idx]) and close > sma50_series.iloc[idx]:
            above_sma50 += 1
        if pd.notna(sma200_series.iloc[idx]) and close > sma200_series.iloc[idx]:
            above_sma200 += 1

    if total_valid_stocks == 0:
        print(json.dumps({"error": "No valid stocks processed"}), file=sys.stderr)
        sys.exit(1)

    # MA Breadth percentages (round to 1 decimal place)
    e20 = round((above_sma20 / total_valid_stocks) * 100, 1)
    s50 = round((above_sma50 / total_valid_stocks) * 100, 1)
    s200 = round((above_sma200 / total_valid_stocks) * 100, 1)

    # 7. Calculate Composite Score and Zone
    # Exact replica of calcScore(r) and getZone(s) from index.html
    adv_pct = (advances / (advances + declines) * 100) if (advances + declines) > 0 else 0.0
    hl_pct = (highs_52w / (highs_52w + lows_52w) * 100) if (highs_52w + lows_52w) > 0 else 50.0
    sma_pct = (e20 + s50 + s200) / 3.0
    score = min(100, max(0, int(round(adv_pct * 0.35 + hl_pct * 0.15 + sma_pct * 0.50))))

    # Get Zone
    if score >= 55:
        zone = "HEALTHY"
        r_val = "2–3R"
    elif score >= 45:
        zone = "EXPANDING"
        r_val = "1–2R"
    elif score >= 35:
        zone = "CAUTION"
        r_val = "0.5–1R"
    elif score >= 20:
        zone = "DEFENSIVE"
        r_val = "0.25R pilot"
    else:
        zone = "CORRECTION"
        r_val = "0R — stand aside"

    # Assemble today's record
    target_date_str = target_date.strftime("%Y-%m-%d")
    record = {
        "date": target_date_str,
        "adv": advances,
        "dec": declines,
        "unc": unchanged,
        "hi": highs_52w,
        "lo": lows_52w,
        "e20": e20,
        "s50": s50,
        "s200": s200,
        "nifty": nifty_close,
        "niftyLow": nifty_low,
        "vol": nifty_vol,
        "notes": "",
        "_updatedAt": int(datetime.now().timestamp() * 1000),
        "score": score,
        "zone": zone,
        "r": r_val
    }

    # Output JSON directly to stdout
    if not args.push:
        print(json.dumps(record, indent=2))
        return

    # 8. Push to JSONBin.io (Option A)
    bin_id = os.environ.get("JSONBIN_BIN") or os.environ.get("JSONBIN_ID")
    master_key = os.environ.get("JSONBIN_KEY") or os.environ.get("JSONBIN_MASTER_KEY")

    if bin_id:
        bin_id = bin_id.strip()
    if master_key:
        master_key = master_key.strip()

    if not bin_id or not master_key:
        print(json.dumps({"error": "JSONBIN_BIN (or JSONBIN_ID) and JSONBIN_KEY (or JSONBIN_MASTER_KEY) environment variables must be set for --push"}), file=sys.stderr)
        sys.exit(1)

    print(f"Fetching current bin data from JSONBin (Bin: {bin_id})...")
    url = f"https://api.jsonbin.io/v3/b/{bin_id}/latest"
    req = urllib.request.Request(
        url,
        headers={
            "X-Master-Key": master_key,
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        }
    )
    
    try:
        response_bytes = execute_request_with_retry(req)
        payload = json.loads(response_bytes.decode('utf-8'))['record']
    except Exception as e:
        print(json.dumps({"warning": f"Skipping JSONBin sync. Failed to fetch data: {str(e)}"}), file=sys.stderr)
        # Exit with 0 to allow the rest of the daily scanner workflow (VCP scanner and Git commit) to succeed
        sys.exit(0)

    # Ensure records exists
    if "records" not in payload:
        payload["records"] = []
    if "mpm" not in payload:
        payload["mpm"] = []

    # Update records array
    existing_records = payload["records"]
    # Filter out target date
    filtered_records = [r for r in existing_records if r.get("date") != target_date_str]
    filtered_records.append(record)
    # Sort newest first and limit to latest 30 rows as per saveToday()
    filtered_records.sort(key=lambda x: x.get("date", ""), reverse=True)
    payload["records"] = filtered_records[:30]

    # Auto-update MPM array
    nifty_close = float(record["nifty"])
    nifty_vol = float(record["vol"])
    
    # Get previous record (where nifty and vol are present)
    prev_record = None
    for r in filtered_records:
        if r.get("date") != target_date_str and r.get("nifty") and r.get("vol"):
            prev_record = r
            break
            
    if prev_record:
        prev_close = float(prev_record["nifty"])
        prev_vol = float(prev_record["vol"])
        
        dtype = "acc" if (nifty_close > prev_close and nifty_vol > prev_vol) \
                else "dist" if (nifty_close < prev_close and nifty_vol > prev_vol) \
                else "neutral"
                
        # Filter existing mpm entries for target date
        mpm_list = [m for m in payload["mpm"] if m.get("date") != target_date_str]
        
        # Add new auto MPM entry
        mpm_list.insert(0, {
            "id": f"eod_{target_date_str}",
            "date": target_date_str,
            "close": nifty_close,
            "pclose": prev_close,
            "vol": nifty_vol,
            "pvol": prev_vol,
            "dtype": dtype,
            "auto": True,
            "_updatedAt": int(datetime.now().timestamp() * 1000)
        })
        
        # Sort and limit to 150 items as per mpmSave()
        mpm_list.sort(key=lambda x: x.get("date", ""), reverse=True)
        payload["mpm"] = mpm_list[:150]

        # Auto-update FTD array
        if "ftd" not in payload or not isinstance(payload["ftd"], list):
            payload["ftd"] = []

        payload["ftd"], ftd_state, auto_type = update_ftd_daily(
            payload["ftd"],
            payload["records"],
            payload["mpm"],
            target_date_str,
            nifty_close,
            nifty_low,
            nifty_vol,
            prev_close,
            prev_vol
        )
        if auto_type == "followthrough":
            print(f"🚀 [FTD Engine] Follow-Through Day AUTO-CONFIRMED on {target_date_str}! (Day {ftd_state['rally_day']})")
        elif auto_type == "attempt":
            print(f"📍 [FTD Engine] Day 1 of Rally Attempt AUTO-DETECTED on {target_date_str}! Benchmark Low: {nifty_low}")
        elif auto_type == "distribution":
            print(f"⚠️ [FTD Engine] Distribution Day logged on {target_date_str}")

        print(f"📊 [FTD Engine] State: {ftd_state['status'].upper()} | Rally Day: {ftd_state['rally_day']} | FTD Confirmed: {ftd_state['ftd_confirmed']} | Dist Days: {ftd_state['dist_count']}")

    # Update timestamp
    payload["_pushedAt"] = int(datetime.now().timestamp() * 1000)

    # Push updated record back
    print("Pushing updated payload to JSONBin...")
    update_url = f"https://api.jsonbin.io/v3/b/{bin_id}"
    update_req = urllib.request.Request(
        update_url,
        data=json.dumps(payload).encode('utf-8'),
        headers={
            "Content-Type": "application/json",
            "X-Master-Key": master_key,
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        },
        method="PUT"
    )

    try:
        response_bytes = execute_request_with_retry(update_req)
        result = json.loads(response_bytes.decode('utf-8'))
        print(f"✅ Success! JSONBin updated. Record for {target_date_str} synced.")
    except Exception as e:
        print(json.dumps({"warning": f"Skipping JSONBin sync. Failed to push data: {str(e)}"}), file=sys.stderr)
        # Exit with 0 so the daily scanner workflow continues
        sys.exit(0)

if __name__ == "__main__":
    main()
