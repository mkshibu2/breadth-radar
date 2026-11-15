#!/usr/bin/env python3
"""
generate_radar_994.py — Curates exactly 994 liquid NSE stocks matching Manas Arora's universe:
- 788 high-momentum stocks from the 48 active industry groups
- Core Nifty 100 large caps (RELIANCE, TCS, HDFCBANK, INFY, etc.)
- Top ~60 liquid recent IPO base breakout candidates (SWIGGY, BAJAJHFL, HYUNDAI, etc.)
- Nifty MidSmallcap 400 liquid leaders by turnover & market cap

Outputs:
1. radar_universe_994.json (Full metadata of the 994 stocks)
2. radar_fundamentals.json (Compact 4-quarter EPS & Sales YoY% for the 994 stocks, ~140 KB)
3. radar_fundamentals.js (Direct browser-loadable script setting window.RADAR_FUNDAMENTALS)
"""

import json
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent

def build_994_universe():
    screener_js = BASE_DIR / 'screener_stocks.js'
    with open(screener_js, 'r', encoding='utf-8') as f:
        text = f.read()

    idx = text.find('window.SCREENER_DATA = window.SCREENER_UNIVERSE = ')
    data = json.loads(text[idx + len('window.SCREENER_DATA = window.SCREENER_UNIVERSE = '):].rstrip(';\n '))
    stocks = data.get('stocks', [])

    manas_json = BASE_DIR / 'data.json'
    manas_syms = set()
    if manas_json.exists():
        with open(manas_json, 'r', encoding='utf-8') as f:
            manas_d = json.load(f)
        for c in manas_d.get('clusters', []):
            for item in c.get('all', []):
                manas_syms.add(item[0])
        for g in manas_d.get('momo', {}).get('groups', []):
            for item in g.get('stocks', []):
                manas_syms.add(item[0])

    selected_map = {}

    # 1. Add all 788 Manas momentum/cluster stocks present in our screener dataset
    for s in stocks:
        if s['symbol'] in manas_syms:
            selected_map[s['symbol']] = s

    # 2. Add top liquid IPO base candidates
    ipos = [s for s in stocks if s.get('is_ipo') and s['symbol'] not in selected_map]
    ipos.sort(key=lambda s: (s.get('turnover_cr') or 0, s.get('mkt_cap_cr') or 0), reverse=True)
    for s in ipos[:60]:
        selected_map[s['symbol']] = s

    # 3. Add top institutional large/mid cap liquid stocks (Nifty 100/MidSmallcap leaders)
    others = [s for s in stocks if s['symbol'] not in selected_map]
    others.sort(key=lambda s: (s.get('turnover_cr') or 0, s.get('mkt_cap_cr') or 0), reverse=True)

    target_count = 994
    needed = target_count - len(selected_map)
    for s in others[:needed]:
        selected_map[s['symbol']] = s

    curated_stocks = list(selected_map.values())
    curated_stocks.sort(key=lambda s: (s.get('mkt_cap_cr') or 0), reverse=True)

    print(f"Total curated stocks: {len(curated_stocks)}")

    # 1. Save radar_universe_994.json
    universe_out = BASE_DIR / 'radar_universe_994.json'
    with open(universe_out, 'w', encoding='utf-8') as f:
        json.dump({'universe': len(curated_stocks), 'stocks': curated_stocks}, f, indent=2)
    print(f"Saved {universe_out.name} ({universe_out.stat().st_size / 1024:.1f} KB)")

    # 2. Save compact radar_fundamentals.json
    fundamentals = {}
    for s in curated_stocks:
        sym = s['symbol']
        q = s.get('quarterly')
        q_clean = []
        if q and any(x.get('eps_growth') is not None or x.get('sales_growth') is not None for x in q):
            for item in q[:4]:
                q_clean.append({
                    'qtr': item.get('qtr'),
                    'eps_growth': item.get('eps_growth'),
                    'sales_growth': item.get('sales_growth')
                })
        elif s.get('eps_growth_fq') is not None or s.get('sales_growth_fq') is not None:
            q_clean.append({
                'qtr': 'FQ',
                'eps_growth': round(s['eps_growth_fq']) if s.get('eps_growth_fq') is not None else None,
                'sales_growth': round(s['sales_growth_fq']) if s.get('sales_growth_fq') is not None else None
            })

        fundamentals[sym] = {
            'company': s.get('company'),
            'sector': s.get('sector'),
            'industry': s.get('industry'),
            'price': s.get('price'),
            'change_pct': s.get('change_pct'),
            'mkt_cap_cr': s.get('mkt_cap_cr'),
            'turnover_cr': s.get('turnover_cr'),
            'eps_growth_fq': s.get('eps_growth_fq'),
            'sales_growth_fq': s.get('sales_growth_fq'),
            'quarterly': q_clean,
            'is_ipo': bool(s.get('is_ipo')),
            'high_52w': s.get('high_52w'),
            'dist_52w_high': s.get('dist_52w_high')
        }

    fund_out = BASE_DIR / 'radar_fundamentals.json'
    with open(fund_out, 'w', encoding='utf-8') as f:
        json.dump(fundamentals, f, separators=(',', ':'))
    print(f"Saved {fund_out.name} ({fund_out.stat().st_size / 1024:.1f} KB)")

    # 3. Save browser-loadable radar_fundamentals.js
    fund_js_out = BASE_DIR / 'radar_fundamentals.js'
    with open(fund_js_out, 'w', encoding='utf-8') as f:
        f.write('/* Auto-generated Market Radar 994 Universe Fundamentals */\n')
        f.write('window.RADAR_FUNDAMENTALS = ')
        f.write(json.dumps(fundamentals, separators=(',', ':')))
        f.write(';\n')
    print(f"Saved {fund_js_out.name} ({fund_js_out.stat().st_size / 1024:.1f} KB)")

if __name__ == '__main__':
    build_994_universe()

