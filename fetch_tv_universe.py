#!/usr/bin/env python3
"""
fetch_tv_universe.py — Fetches the complete 2,300+ NSE stock universe (including newly listed IPOs)
directly from TradingView's Scanner API and generates screener_stocks.json & screener_stocks.js.
"""

import sys
import json
import urllib.request
import urllib.error
from pathlib import Path
from datetime import datetime

# Configure UTF-8 encoding for Windows stdout/stderr
if sys.platform.startswith('win'):
    try:
        sys.stdout.reconfigure(encoding='utf-8')
        sys.stderr.reconfigure(encoding='utf-8')
    except AttributeError:
        pass

TV_SCANNER_URL = "https://scanner.tradingview.com/india/scan"

# Payload requesting all liquid & listed common stocks on NSE
QUERY_PAYLOAD = {
    "filter": [
        {"left": "exchange", "operation": "equal", "right": "NSE"},
        {"left": "typespecs", "operation": "has", "right": ["common"]}
    ],
    "options": {
        "lang": "en"
    },
    "symbols": {
        "query": {"types": []},
        "tickers": []
    },
    "columns": [
        "name",
        "description",
        "close",
        "change",
        "volume",
        "Value.Traded",
        "relative_volume_10d_calc",
        "average_volume_30d_calc",
        "market_cap_basic",
        "EMA20",
        "EMA50",
        "SMA50",
        "SMA200",
        "Perf.W",
        "Perf.1M",
        "Perf.3M",
        "Perf.6M",
        "Perf.Y",
        "Perf.YTD",
        "High.1M",
        "High.3M",
        "price_52_week_high",
        "price_52_week_low",
        "price_earnings_ttm",
        "earnings_per_share_diluted_ttm",
        "earnings_per_share_diluted_yoy_growth_ttm",
        "earnings_per_share_diluted_yoy_growth_fq",
        "total_revenue_yoy_growth_fq",
        "dividends_yield_current",
        "sector",
        "industry",
        "Recommend.All"
    ],
    "sort": {
        "sortBy": "market_cap_basic",
        "sortOrder": "desc"
    },
    "range": [0, 3000]
}

def map_recommendation(val):
    if val is None:
        return "No rating"
    if val > 0.5:
        return "Strong buy"
    if val > 0.1:
        return "Buy"
    if val >= -0.1:
        return "Neutral"
    if val >= -0.5:
        return "Sell"
    return "Strong sell"

def get_recent_quarter_labels(ref_date=None):
    if ref_date is None:
        ref_date = datetime.now()
    year = ref_date.year
    month = ref_date.month
    yy = str(year)[-2:]
    prev_yy = str(year - 1)[-2:]

    # Dynamic Indian quarter labels based on corporate reporting calendar
    if month in (10, 11, 12):
        return [f"Sep-{yy}", f"Jun-{yy}", f"Mar-{yy}", f"Dec-{prev_yy}"]
    elif month in (1, 2, 3):
        return [f"Dec-{prev_yy}", f"Sep-{prev_yy}", f"Jun-{prev_yy}", f"Mar-{prev_yy}"]
    elif month in (4, 5, 6):
        return [f"Mar-{yy}", f"Dec-{prev_yy}", f"Sep-{prev_yy}", f"Jun-{prev_yy}"]
    else:
        return [f"Jun-{yy}", f"Mar-{yy}", f"Dec-{prev_yy}", f"Sep-{prev_yy}"]

def fetch_data():
    print(f"📡 Querying TradingView Scanner API ({TV_SCANNER_URL})...")
    req_data = json.dumps(QUERY_PAYLOAD).encode('utf-8')
    req = urllib.request.Request(
        TV_SCANNER_URL,
        data=req_data,
        headers={
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Content-Type": "application/json"
        },
        method="POST"
    )

    try:
        with urllib.request.urlopen(req, timeout=25) as response:
            raw = response.read().decode('utf-8')
            res = json.loads(raw)
    except Exception as e:
        print(f"❌ Error fetching from TradingView: {e}")
        return None

    rows = res.get('data', [])
    print(f"✅ Received {len(rows)} stocks from TradingView (including fresh IPOs)!")
    return rows

def parse_and_save(rows):
    if not rows:
        return False

    # Load verified exact TradingView quarterly financials cache
    exact_store = {}
    exact_file = Path(__file__).resolve().parent / 'exact_quarterly_financials.json'
    if exact_file.exists():
        try:
            with open(exact_file, 'r', encoding='utf-8') as ef:
                exact_store = json.load(ef)
        except Exception:
            pass

    records = []
    for item in rows:
        d = item.get('d', [])
        if len(d) < 30:
            continue

        sym = str(d[0]).strip().upper()
        comp = str(d[1]).strip()
        price = float(d[2]) if d[2] is not None else 0.0
        chg_pct = float(d[3]) if d[3] is not None else 0.0
        vol = int(d[4]) if d[4] is not None else 0
        turnover_inr = float(d[5]) if d[5] is not None else (price * vol)
        rel_vol = round(float(d[6]), 2) if d[6] is not None else 0.0
        avg_vol_30d = int(d[7]) if d[7] is not None else vol
        mkt_cap_inr = float(d[8]) if d[8] is not None else 0.0
        
        ema_20 = round(float(d[9]), 2) if d[9] is not None else None
        ema_50 = round(float(d[10]), 2) if d[10] is not None else None
        sma_50 = round(float(d[11]), 2) if d[11] is not None else None
        sma_200 = round(float(d[12]), 2) if d[12] is not None else None

        perf_1w = round(float(d[13]), 2) if d[13] is not None else None
        perf_1m = round(float(d[14]), 2) if d[14] is not None else None
        perf_3m = round(float(d[15]), 2) if d[15] is not None else None
        perf_6m = round(float(d[16]), 2) if d[16] is not None else None
        perf_1y = round(float(d[17]), 2) if d[17] is not None else None
        perf_ytd = round(float(d[18]), 2) if d[18] is not None else None

        high_1m = round(float(d[19]), 2) if d[19] is not None else price
        high_3m = round(float(d[20]), 2) if d[20] is not None else price
        high_52w = round(float(d[21]), 2) if d[21] is not None else high_3m
        low_52w = round(float(d[22]), 2) if d[22] is not None else (price * 0.5)

        pe_ratio = round(float(d[23]), 2) if d[23] is not None else None
        eps_dil_ttm = round(float(d[24]), 2) if d[24] is not None else None
        eps_growth_yoy = round(float(d[25]), 2) if d[25] is not None else None
        eps_growth_fq = round(float(d[26]), 2) if d[26] is not None else None
        sales_growth_fq = round(float(d[27]), 2) if d[27] is not None else None
        div_yield = round(float(d[28]), 2) if d[28] is not None else 0.0

        sector = str(d[29]).strip() if d[29] else "Diversified"
        industry = str(d[30]).strip() if d[30] else "General"
        rating_str = map_recommendation(d[31])

        # Distance from 1M High (PowerPlay metric: Price below High, 1M by 0% to 20%)
        if high_1m > 0:
            dist_high_1m_pct = round(((high_1m - price) / high_1m) * 100.0, 2)
        else:
            dist_high_1m_pct = 0.0

        # Proximity to 52W High & 52W Low
        if high_52w > 0:
            dist_52w_high = round(((high_52w - price) / high_52w) * 100.0, 2)
        else:
            dist_52w_high = 0.0

        if low_52w > 0:
            dist_52w_low = round(((price - low_52w) / low_52w) * 100.0, 2)
        else:
            dist_52w_low = 0.0

        # Technical Boolean comparisons
        price_gte_ema20 = (ema_20 is not None and price >= ema_20)
        ema20_gte_ema50 = (ema_20 is not None and ema_50 is not None and ema_20 >= ema_50)
        ema50_gte_sma200 = (ema_50 is not None and sma_200 is not None and ema_50 >= sma_200)
        price_gte_sma50 = (sma_50 is not None and price >= sma_50)
        sma50_gte_sma200 = (sma_50 is not None and sma_200 is not None and sma_50 >= sma_200)
        
        # Stage 2 trend template alignment
        stage2_trend = (price_gte_ema20 and ema20_gte_ema50 and (ema50_gte_sma200 if sma_200 else True))
        
        # IPO Detection: stocks listed recently often have None for SMA200 or 1Y performance
        is_ipo = (sma_200 is None or perf_1y is None or perf_6m is None)
        
        # Turnover in Crores (for Indian market readability)
        turnover_cr = round(turnover_inr / 1.0e7, 2)
        mkt_cap_cr = round(mkt_cap_inr / 1.0e7, 2)

        # Distances to EMAs
        dist_ema20_pct = round(((price - ema_20) / ema_20) * 100.0, 2) if ema_20 else 0.0
        dist_sma50_pct = round(((price - sma_50) / sma_50) * 100.0, 2) if sma_50 else 0.0
        dist_sma200_pct = round(((price - sma_200) / sma_200) * 100.0, 2) if sma_200 else 0.0

        # Exact verified TradingView quarterly fundamentals (STRICTLY NO APPROXIMATIONS)
        q_labels = get_recent_quarter_labels()
        if sym in exact_store:
            quarterly = exact_store[sym]
        else:
            # Verified live Q0 from scanner quote, and None for unverified older quarters
            q0_eps = round(eps_growth_fq) if eps_growth_fq is not None else None
            q0_sales = round(sales_growth_fq) if sales_growth_fq is not None else None
            quarterly = [
                {'qtr': q_labels[0], 'eps_growth': q0_eps, 'sales_growth': q0_sales},
                {'qtr': q_labels[1], 'eps_growth': None, 'sales_growth': None},
                {'qtr': q_labels[2], 'eps_growth': None, 'sales_growth': None},
                {'qtr': q_labels[3], 'eps_growth': None, 'sales_growth': None}
            ]

        record = {
            'symbol': sym,
            'company': comp,
            'price': price,
            'change': round(price * (chg_pct / 100.0), 2),
            'change_pct': chg_pct,
            'volume': vol,
            'turnover_inr': turnover_inr,
            'turnover_cr': turnover_cr,
            'rel_vol': rel_vol,
            'avg_vol_30d': avg_vol_30d,
            'mkt_cap_inr': mkt_cap_inr,
            'mkt_cap_cr': mkt_cap_cr,
            'ema_20': ema_20,
            'ema_50': ema_50,
            'sma_50': sma_50,
            'sma_200': sma_200,
            'price_gte_ema20': price_gte_ema20,
            'ema20_gte_ema50': ema20_gte_ema50,
            'ema50_gte_sma200': ema50_gte_sma200,
            'price_gte_sma50': price_gte_sma50,
            'sma50_gte_sma200': sma50_gte_sma200,
            'stage2_trend': stage2_trend,
            'is_ipo': is_ipo,
            'perf_1w': perf_1w,
            'perf_1m': perf_1m,
            'perf_3m': perf_3m,
            'perf_6m': perf_6m,
            'perf_1y': perf_1y,
            'perf_ytd': perf_ytd,
            'high_1m': high_1m,
            'dist_high_1m_pct': dist_high_1m_pct,
            'high_52w': high_52w,
            'low_52w': low_52w,
            'dist_52w_high': dist_52w_high,
            'dist_52w_low': dist_52w_low,
            'dist_ema20_pct': dist_ema20_pct,
            'dist_sma50_pct': dist_sma50_pct,
            'dist_sma200_pct': dist_sma200_pct,
            'pe_ratio': pe_ratio,
            'eps_dil_ttm': eps_dil_ttm,
            'eps_growth_yoy': eps_growth_yoy,
            'eps_growth_fq': eps_growth_fq,
            'sales_growth_fq': sales_growth_fq,
            'quarterly': quarterly,
            'div_yield': div_yield,
            'sector': sector,
            'industry': industry,
            'rating': rating_str,
            'tv_chart_url': f"https://in.tradingview.com/chart/fZ5fwxUh/?symbol=NSE:{sym}"
        }
        records.append(record)

    out_dir = Path(__file__).resolve().parent
    out_json = out_dir / 'screener_stocks.json'
    out_js = out_dir / 'screener_stocks.js'

    payload = {
        'generated_at': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
        'total_stocks': len(records),
        'market': 'NSE India',
        'stocks': records
    }

    with open(out_json, 'w', encoding='utf-8') as jf:
        json.dump(payload, jf, indent=2)
    print(f"✅ Saved full universe ({len(records)} stocks) to: {out_json}")

    with open(out_js, 'w', encoding='utf-8') as jsf:
        jsf.write("/* Auto-generated TradingView Full Universe Screener Data */\n")
        jsf.write("window.EXACT_QUARTERLY_DATA = ")
        json.dump(exact_store, jsf)
        jsf.write(";\n")
        jsf.write("window.SCREENER_DATA = window.SCREENER_UNIVERSE = ")
        json.dump(payload, jsf)
        jsf.write(";\n")
    print(f"✅ Saved JS sidecar to: {out_js}")

    # Check matches for PrimaryScan-PowerPlay
    def match_powerplay(s):
        p3m = s.get('perf_3m')
        d1m = s.get('dist_high_1m_pct')
        return (
            s['price'] >= 30.0 and
            s['price_gte_ema20'] and
            s['ema20_gte_ema50'] and
            s['ema50_gte_sma200'] and
            s['mkt_cap_inr'] >= 1.0e9 and
            p3m is not None and p3m >= 30.0 and
            d1m is not None and 0.0 <= d1m <= 20.0 and
            s['turnover_inr'] >= 10.0e6 and
            s['avg_vol_30d'] > 200000
        )

    pp_matches = [s['symbol'] for s in records if match_powerplay(s)]
    print(f"🎯 Total PrimaryScan-PowerPlay matches found: {len(pp_matches)}")
    if pp_matches:
        print(f"Sample matches: {', '.join(pp_matches[:15])}")
    return True

def main():
    rows = fetch_data()
    if rows:
        parse_and_save(rows)
    else:
        print("❌ Failed to fetch TradingView data.")

if __name__ == '__main__':
    main()
