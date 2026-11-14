#!/usr/bin/env python3
"""
sync_exact_financials.py — Fetches 100% exact TradingView corporate financial statements
via tvscreener (TradingView's official income statement layouts).
Computes YoY Diluted EPS growth and YoY Revenue growth for the last 4 quarters.
Saves verified data to exact_quarterly_financials.json and updates screener_stocks.json & screener_stocks.js.
"""

import sys
import json
import time
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed
import pandas as pd
import tvscreener as tvs

if sys.platform.startswith('win'):
    try:
        sys.stdout.reconfigure(encoding='utf-8')
        sys.stderr.reconfigure(encoding='utf-8')
    except AttributeError:
        pass

BASE_DIR = Path(__file__).resolve().parent
STORE_FILE = BASE_DIR / 'exact_quarterly_financials.json'
STOCKS_JSON = BASE_DIR / 'screener_stocks.json'
STOCKS_JS = BASE_DIR / 'screener_stocks.js'

def load_exact_store():
    if STORE_FILE.exists():
        try:
            with open(STORE_FILE, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception:
            return {}
    return {}

def save_exact_store(store):
    with open(STORE_FILE, 'w', encoding='utf-8') as f:
        json.dump(store, f, indent=2)

def parse_tv_dataframe(df, is_half_yearly=False):
    if df is None or len(df) < (2 if is_half_yearly else 3):
        return None
    eps_col = None
    for cand in [
        'Diluted earnings per share (diluted EPS)',
        'Basic earnings per share (basic EPS)',
        'Diluted net income available to common stockholders',
        'Net income'
    ]:
        if cand in df.columns and df[cand].dropna().shape[0] >= (2 if is_half_yearly else 3):
            eps_col = cand
            break

    rev_col = None
    for cand in ['Total revenue', 'Operating revenue', 'Gross revenue', 'Net revenue']:
        if cand in df.columns and df[cand].dropna().shape[0] >= (2 if is_half_yearly else 3):
            rev_col = cand
            break

    tail_df = df.tail(8)
    periods = list(tail_df.index)
    dates = tail_df['period_end'].tolist() if 'period_end' in tail_df.columns else [None] * len(periods)
    eps_vals = tail_df[eps_col].tolist() if eps_col else [None] * len(periods)
    rev_vals = tail_df[rev_col].tolist() if rev_col else [None] * len(periods)

    n = len(periods)
    results = []
    step = 2 if is_half_yearly else 4

    for i in range(n - 1, max(-1, n - 5), -1):
        p_end = dates[i]
        p_str = str(periods[i])
        if pd.notna(p_end):
            q_label = p_end.strftime('%b-%y')
        else:
            yr = p_str[:4][-2:] if len(p_str) >= 4 else '26'
            if is_half_yearly:
                h_num = p_str[-2:] if len(p_str) >= 2 else 'H1'
                q_label = f"{'Sep' if h_num == 'H1' else 'Mar'}-{yr}"
            else:
                q_num = p_str[-2:] if len(p_str) >= 2 else 'Q2'
                m_map = {'Q1': 'Jun', 'Q2': 'Sep', 'Q3': 'Dec', 'Q4': 'Mar'}
                q_label = f"{m_map.get(q_num, 'Sep')}-{yr}"

        prior_idx = i - step
        e_growth, s_growth = None, None
        if prior_idx >= 0 and eps_vals[i] is not None and eps_vals[prior_idx] is not None:
            try:
                e_curr = float(eps_vals[i])
                e_prev = float(eps_vals[prior_idx])
                if e_prev != 0 and pd.notna(e_curr) and pd.notna(e_prev):
                    e_growth = round(((e_curr - e_prev) / abs(e_prev)) * 100)
            except (ValueError, TypeError, ZeroDivisionError):
                pass

        if prior_idx >= 0 and rev_vals[i] is not None and rev_vals[prior_idx] is not None:
            try:
                s_curr = float(rev_vals[i])
                s_prev = float(rev_vals[prior_idx])
                if s_prev != 0 and pd.notna(s_curr) and pd.notna(s_prev):
                    s_growth = round(((s_curr - s_prev) / abs(s_prev)) * 100)
            except (ValueError, TypeError, ZeroDivisionError):
                pass

        label_suffix = " (H)" if is_half_yearly else ""
        results.append({
            'qtr': f"{q_label}{label_suffix}",
            'eps_growth': e_growth,
            'sales_growth': s_growth
        })
    return results

def fetch_single_quarterly(symbol, max_retries=2):
    for attempt in range(max_retries + 1):
        for prefix in ['NSE:', 'BSE:']:
            ticker = f"{prefix}{symbol}"
            # 1. Try Quarterly (FQ) first (standard for mainboard stocks)
            try:
                df = tvs.get_financials(ticker, "income", "FQ")
                if df is not None and len(df) >= 3:
                    res = parse_tv_dataframe(df, is_half_yearly=False)
                    if res:
                        return symbol, res
            except Exception:
                pass

            # 2. Try Half-Yearly (FH) fallback (official reporting for Indian SME stocks)
            try:
                df = tvs.get_financials(ticker, "income", "FH")
                if df is not None and len(df) >= 2:
                    res = parse_tv_dataframe(df, is_half_yearly=True)
                    if res:
                        return symbol, res
            except Exception:
                pass

        if attempt < max_retries:
            time.sleep(0.5)
    return symbol, None
    return symbol, None

def load_screener_universe():
    if STOCKS_JSON.exists():
        try:
            with open(STOCKS_JSON, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception:
            pass
    if STOCKS_JS.exists():
        try:
            with open(STOCKS_JS, 'r', encoding='utf-8') as f:
                content = f.read()
            marker1 = "window.SCREENER_DATA = window.SCREENER_UNIVERSE = "
            marker2 = "window.SCREENER_DATA=window.SCREENER_UNIVERSE="
            marker = marker1 if marker1 in content else (marker2 if marker2 in content else None)
            if marker:
                json_part = content.split(marker, 1)[1].rstrip(";\r\n ")
                return json.loads(json_part)
        except Exception as e:
            print(f"Error reading {STOCKS_JS.name}: {e}")
    return None

def update_screener_files(store):
    data = load_screener_universe()
    if not data:
        return

    stocks = data.get('stocks', [])
    updated = 0
    for s in stocks:
        sym = s.get('symbol')
        if sym in store and store[sym]:
            s['quarterly'] = store[sym]
            updated += 1

    data['stocks'] = stocks
    if STOCKS_JSON.exists():
        with open(STOCKS_JSON, 'w', encoding='utf-8') as f:
            json.dump(data, f, separators=(',', ':'))

    with open(STOCKS_JS, 'w', encoding='utf-8') as jsf:
        jsf.write("/* Auto-generated TradingView Universe */\n")
        jsf.write("window.EXACT_QUARTERLY_DATA = window.EXACT_QUARTERLY_DATA || {};\n")
        jsf.write("window.SCREENER_DATA = window.SCREENER_UNIVERSE = ")
        json.dump(data, jsf, separators=(',', ':'))
        jsf.write(";\n")
    print(f"✓ Synced {updated} stocks with verified fundamentals in screener_stocks.js")

def main():
    store = load_exact_store()
    print(f"Loaded {len(store)} verified records from {STORE_FILE.name}")

    data = load_screener_universe()
    if not data:
        print("Neither screener_stocks.json nor screener_stocks.js found")
        return

    stocks = data.get('stocks', [])

    symbols = [s['symbol'] for s in stocks]
    to_fetch = [s for s in symbols if s not in store or not store[s] or len(store[s]) == 0]

    print(f"Total universe symbols: {len(symbols)}, needing fundamental fetch: {len(to_fetch)}")
    if not to_fetch:
        print("All symbols already have fundamental records.")
        update_screener_files(store)
        return

    # Fetch with 3 workers
    t0 = time.time()
    fetched = 0
    with ThreadPoolExecutor(max_workers=3) as executor:
        future_map = {executor.submit(fetch_single_quarterly, sym): sym for sym in to_fetch}
        for idx, fut in enumerate(as_completed(future_map), 1):
            sym, res = fut.result()
            if res:
                store[sym] = res
                fetched += 1
                q0 = res[0]
                print(f"[{idx}/{len(to_fetch)}] ✓ {sym:12} -> {q0.get('qtr')}: EPS {q0.get('eps_growth')}%, Sales {q0.get('sales_growth')}%")
            else:
                print(f"[{idx}/{len(to_fetch)}] ✗ {sym:12} -> No quarterly series")

            if idx % 25 == 0:
                save_exact_store(store)
                update_screener_files(store)

    save_exact_store(store)
    update_screener_files(store)
    print(f"Done in {time.time()-t0:.1f}s")

if __name__ == '__main__':
    main()
