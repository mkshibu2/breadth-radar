import os
import sys
import json
import pandas as pd
import numpy as np
import yfinance as yf
from datetime import datetime, timedelta
import urllib.request
import io
import time

print("Starting batch breadth re-scan for October 2026...")

# 1. Load universe symbols
symbols_file = "ind_nifty500list.csv"
if not os.path.exists(symbols_file):
    symbols_file = os.path.join(os.path.dirname(__file__), "ind_nifty500list.csv")

df_symbols = pd.read_csv(symbols_file)
symbols = [s.strip() for s in df_symbols['Symbol'].dropna().tolist()]
yf_tickers = [s + '.NS' for s in symbols]

# 2. Download Nifty 50 history
start_date = datetime(2025, 8, 1)
end_date = datetime(2026, 11, 2)

print("Fetching ^NSEI data...")
nifty_df = yf.download('^NSEI', start=start_date, end=end_date, progress=False)
if isinstance(nifty_df.columns, pd.MultiIndex):
    nifty_df.columns = nifty_df.columns.get_level_values(0)
nifty_df.index = pd.to_datetime(nifty_df.index).date

# 3. Nifty 50 constituents for volume calculation
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

# 4. Download Nifty 500 stocks history in one shot
print(f"Downloading data for {len(yf_tickers)} stocks...")
stocks_data = yf.download(yf_tickers, start=start_date, end=end_date, group_by='ticker', threads=True, progress=False)
print("Stock data downloaded successfully.")

# Precompute per-stock rolling indicators
print("Pre-calculating indicators for constituents...")
constituent_cache = {}
for sym in symbols:
    ticker = sym + '.NS'
    if ticker not in stocks_data.columns.levels[0]:
        continue
    df = stocks_data[ticker].dropna(subset=['Close'])
    if df.empty or len(df) < 50:
        continue
    df.index = pd.to_datetime(df.index).date
    close = df['Close']
    sma20 = close.rolling(window=20).mean()
    sma50 = close.rolling(window=50).mean()
    sma200 = close.rolling(window=200).mean()
    high252 = df['High'].rolling(window=252).max()
    low252 = df['Low'].rolling(window=252).min()
    
    constituent_cache[ticker] = {
        'df': df,
        'close': close,
        'sma20': sma20,
        'sma50': sma50,
        'sma200': sma200,
        'high252': high252,
        'low252': low252,
        'dates': set(df.index)
    }

# 5. Get all trading dates in October 2026
oct_trading_days = [d for d in nifty_df.index if d.month == 10 and d.year == 2026]
oct_trading_days.sort()
print(f"Found {len(oct_trading_days)} trading days in October 2026: {oct_trading_days}")

results = []
for target_date in oct_trading_days:
    nifty_row = nifty_df.loc[target_date]
    nifty_close = round(float(nifty_row['Close']), 2)
    nifty_low = round(float(nifty_row['Low']), 2)
    
    # Nifty 50 volume
    nifty_vol_raw = 0.0
    for s in nifty50_symbols:
        tk = s + '.NS'
        if tk in constituent_cache:
            cdata = constituent_cache[tk]
            if target_date in cdata['dates']:
                v = cdata['df'].loc[target_date, 'Volume']
                if isinstance(v, pd.Series): v = v.iloc[0]
                nifty_vol_raw += float(v)
    nifty_vol = round(nifty_vol_raw / 1e7, 2) if nifty_vol_raw > 0 else 0.0

    advances = 0
    declines = 0
    unchanged = 0
    highs_52w = 0
    lows_52w = 0
    above_sma20 = 0
    above_sma50 = 0
    above_sma200 = 0
    valid_stocks = 0

    for tk, cdata in constituent_cache.items():
        if target_date not in cdata['dates']:
            continue
        df = cdata['df']
        idx = df.index.get_loc(target_date)
        if idx < 1:
            continue
        
        valid_stocks += 1
        curr_close = float(cdata['close'].iloc[idx])
        prev_close = float(cdata['close'].iloc[idx - 1])
        curr_high = float(df['High'].iloc[idx])
        curr_low = float(df['Low'].iloc[idx])

        if curr_close > prev_close:
            advances += 1
        elif curr_close < prev_close:
            declines += 1
        else:
            unchanged += 1

        if curr_high >= float(cdata['high252'].iloc[idx]):
            highs_52w += 1
        if curr_low <= float(cdata['low252'].iloc[idx]):
            lows_52w += 1

        s20 = cdata['sma20'].iloc[idx]
        s50 = cdata['sma50'].iloc[idx]
        s200 = cdata['sma200'].iloc[idx]

        if pd.notna(s20) and curr_close > s20:
            above_sma20 += 1
        if pd.notna(s50) and curr_close > s50:
            above_sma50 += 1
        if pd.notna(s200) and curr_close > s200:
            above_sma200 += 1

    if valid_stocks == 0:
        continue

    e20 = round((above_sma20 / valid_stocks) * 100, 1)
    s50 = round((above_sma50 / valid_stocks) * 100, 1)
    s200 = round((above_sma200 / valid_stocks) * 100, 1)

    adv_pct = (advances / (advances + declines) * 100) if (advances + declines) > 0 else 0.0
    hl_pct = (highs_52w / (highs_52w + lows_52w) * 100) if (highs_52w + lows_52w) > 0 else 50.0
    sma_pct = (e20 + s50 + s200) / 3.0
    score = min(100, max(0, int(round(adv_pct * 0.35 + hl_pct * 0.15 + sma_pct * 0.50))))

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

    target_date_str = target_date.strftime("%Y-%m-%d")
    rec = {
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
        "_updatedAt": int(time.time() * 1000),
        "score": score,
        "zone": zone,
        "r": r_val
    }
    results.append(rec)
    print(f"  {target_date_str}: Score={score} (Zone={zone}, Adv={advances}, Dec={declines}, e20={e20}%, s50={s50}%, s200={s200}%)")

with open("scanned_october_records.json", "w") as f:
    json.dump(results, f, indent=2)

print("\nFinished! Saved scanned_october_records.json")
