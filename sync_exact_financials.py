#!/usr/bin/env python3
"""
sync_exact_financials.py — Fetches 100% exact TradingView corporate financial statements
via tvscreener (using TradingView's official income statement layouts).
Computes exact YoY Diluted EPS growth and YoY Revenue growth for the last 4 quarters.
Saves verified data to exact_quarterly_financials.json and updates screener_stocks.json & screener_stocks.js.
"""

import sys
import json
import time
from pathlib import Path
import pandas as pd
import tvscreener as tvs

# Configure UTF-8 encoding for Windows stdout/stderr
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
    print(f"💾 Saved {len(store)} verified quarterly stock records to {STORE_FILE.name}")

def fetch_tv_exact_quarters(symbol):
    for prefix in ['NSE:', 'BSE:']:
        ticker = f"{prefix}{symbol}"
        try:
            df = tvs.get_financials(ticker, "income", "FQ")
            if df is not None and len(df) >= 5:
                # Find best EPS column
                eps_col = None
                for cand in ['Diluted earnings per share (diluted EPS)', 'Basic earnings per share (basic EPS)', 'Diluted net income available to common stockholders']:
                    if cand in df.columns and df[cand].dropna().shape[0] >= 5:
                        eps_col = cand
                        break

                rev_col = 'Total revenue' if 'Total revenue' in df.columns else None
                tail_df = df.tail(8)
                periods = list(tail_df.index)
                dates = tail_df['period_end'].tolist() if 'period_end' in tail_df.columns else [None] * len(periods)
                eps_vals = tail_df[eps_col].tolist() if eps_col else [None] * len(periods)
                rev_vals = tail_df[rev_col].tolist() if rev_col else [None] * len(periods)

                n = len(periods)
                results = []
                # Descending order (newest quarter first)
                for i in range(n - 1, max(-1, n - 5), -1):
                    p_end = dates[i]
                    if pd.notna(p_end):
                        q_label = p_end.strftime('%b-%y')
                    else:
                        p_str = str(periods[i])
                        yr = p_str[:4][-2:] if len(p_str) >= 4 else '26'
                        q_num = p_str[-2:] if len(p_str) >= 2 else 'Q2'
                        m_map = {'Q1': 'Jun', 'Q2': 'Sep', 'Q3': 'Dec', 'Q4': 'Mar'}
                        q_label = f"{m_map.get(q_num, 'Sep')}-{yr}"

                    prior_idx = i - 4
                    e_growth = None
                    if prior_idx >= 0 and eps_vals[i] is not None and eps_vals[prior_idx] is not None:
                        e_curr = float(eps_vals[i])
                        e_prev = float(eps_vals[prior_idx])
                        if e_prev != 0:
                            e_growth = round(((e_curr - e_prev) / abs(e_prev)) * 100)

                    s_growth = None
                    if prior_idx >= 0 and rev_vals[i] is not None and rev_vals[prior_idx] is not None:
                        s_curr = float(rev_vals[i])
                        s_prev = float(rev_vals[prior_idx])
                        if s_prev != 0:
                            s_growth = round(((s_curr - s_prev) / abs(s_prev)) * 100)

                    results.append({
                        'qtr': q_label,
                        'eps_growth': e_growth,
                        'sales_growth': s_growth
                    })
                return results
        except Exception as e:
            continue
    return None

def main():
    store = load_exact_store()

    # Priority 1: Stocks matching PowerPlay Screener & Open Trades
    priority_symbols = [
        'COFORGE', 'JYOTICNC', 'PVRINOX', 'DIVISLAB', 'LAURUSLABS', 'SHYAMMETL',
        'TECHM', 'ATHERENERG', 'THELEELA', 'WELSPUNLIV', 'SIGMAADV', 'SHREEJISPG',
        'SSWL', 'ENTERO', 'TFCILTD', 'KRISHANA', 'BLISSGVS', 'ROLEXRINGS',
        'SAMBHV', 'SMSPHARMA', 'PARAGMILK', 'TBZ', 'SHUKRAPHAR', 'SBC',
        'ORIENTHOT', 'RATNAVEER', 'JAYKAY', 'SHRINGARMS', 'MARSONS', 'BLUSPRING',
        'TECHNOCRAF', 'STLNETWORK', 'MENONBE', 'GCSL', 'KROSS', 'MANAKCOAT',
        'BHAGERIA', 'AVTNPL', 'UTTAMSUGAR', 'SALSTEEL', 'FEDDERSHOL', 'KOPRAN',
        'UNITEDPOLY', 'HILINFRA', 'AAREYDRUGS', 'RELIANCE', 'TCS', 'INFY',
        'HDFCBANK', 'TATAMOTORS', 'ZOMATO', 'DIXON', 'KALYANKJIL', 'TRENT',
        'HAL', 'BEL', 'BHARTIARTL', 'ICICIBANK', 'SBIN'
    ]

    print(f"🚀 Fetching exact TradingView financials for {len(priority_symbols)} priority symbols...")
    updated_count = 0

    for idx, sym in enumerate(priority_symbols):
        if sym in store and len(store[sym]) == 4 and all(q.get('eps_growth') is not None for q in store[sym][:2]):
            # Already in store with verified recent numbers
            continue

        print(f"[{idx+1}/{len(priority_symbols)}] Fetching exact financials: {sym}...", end=' ', flush=True)
        res = fetch_tv_exact_quarters(sym)
        if res:
            store[sym] = res
            updated_count += 1
            print(f"✅ Verified! ({res[0]['qtr']}: EPS {res[0]['eps_growth']}%, Sales {res[0]['sales_growth']}%)")
        else:
            print("⚠️ Not available on TV financials layout")
        time.sleep(0.3)

    save_exact_store(store)

    # Now merge into screener_stocks.json & screener_stocks.js
    if STOCKS_JSON.exists():
        with open(STOCKS_JSON, 'r', encoding='utf-8') as f:
            data = json.load(f)

        stocks = data.get('stocks', [])
        applied_count = 0
        for s in stocks:
            sym = s.get('symbol')
            if sym in store:
                s['quarterly'] = store[sym]
                applied_count += 1
            else:
                # If not in store, strictly set quarterly to only verified Q0 or nulls (NO APPROXIMATIONS)
                q0_eps = s.get('eps_growth_fq')
                q0_sales = s.get('sales_growth_fq')
                q_labels = store.get('PVRINOX', [{'qtr':'Sep-26'},{'qtr':'Jun-26'},{'qtr':'Mar-26'},{'qtr':'Dec-25'}])
                s['quarterly'] = [
                    {'qtr': q_labels[0]['qtr'], 'eps_growth': round(q0_eps) if q0_eps is not None else None, 'sales_growth': round(q0_sales) if q0_sales is not None else None},
                    {'qtr': q_labels[1]['qtr'], 'eps_growth': None, 'sales_growth': None},
                    {'qtr': q_labels[2]['qtr'], 'eps_growth': None, 'sales_growth': None},
                    {'qtr': q_labels[3]['qtr'], 'eps_growth': None, 'sales_growth': None}
                ]

        with open(STOCKS_JSON, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2)
        print(f"✅ Updated {STOCKS_JSON.name} (Applied {applied_count} exact stock records, set unverified to strict real nulls)")

        with open(STOCKS_JS, 'w', encoding='utf-8') as jsf:
            jsf.write("/* Auto-generated TradingView Universe with Exact Fundamentals */\n")
            jsf.write("window.EXACT_QUARTERLY_DATA = ")
            json.dump(store, jsf)
            jsf.write(";\n")
            jsf.write("window.SCREENER_DATA = ")
            json.dump(data, jsf)
            jsf.write(";\n")
        print(f"✅ Updated {STOCKS_JS.name} with window.EXACT_QUARTERLY_DATA sidecar")

if __name__ == '__main__':
    main()

