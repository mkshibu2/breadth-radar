#!/usr/bin/env python3
"""
╔══════════════════════════════════════════════════════════════════════╗
║  NSE VCP SCREENER — Minervini / O'Neil / Stage-2 Method              ║
║  Version 3.2 (Clean) |  Data: Yahoo Finance + NSE CSV  |  by Shibu   ║
║                                                                      ║
║  Scores every stock on:                                              ║
║    • Minervini Trend Template (Stage 2 confirmation)                 ║
║    • Prior Advance (momentum qualification)                          ║
║    • VCP: Drawdown, Volume dry-up, ATR contraction, Tightness        ║
║    • True VCP pullback sequence detection                            ║
║    • Smart Thematic Breadth (Railways, Defense, Pharma splits)       ║
║    • Potential BO & Pull Back Setup Detection                        ║
║    • Final Composite Score + Grade + Setup Type                      ║
║                                                                      ║
║  Install: pip install yfinance pandas openpyxl                       ║
║  Run:     python vcp_scanner.py                                      ║
║  Output:  scanner_results.html  - to M.Radar (Market Radar)         ║
╚══════════════════════════════════════════════════════════════════════╝
"""

import yfinance as yf
import pandas as pd
import numpy as np
import time, logging, warnings, sys, signal, pickle
from datetime import datetime, timedelta
from pathlib import Path

warnings.filterwarnings('ignore')
logging.basicConfig(level=logging.WARNING, format='%(message)s')

# Configure UTF-8 encoding for Windows stdout/stderr to prevent charmap errors
if sys.platform.startswith('win'):
    try:
        sys.stdout.reconfigure(encoding='utf-8')
        sys.stderr.reconfigure(encoding='utf-8')
    except AttributeError:
        pass

# ═══════════════════════════════════════════════════════════════════════
#  CTRL+C OVERRIDE & CFFI POPUP SUPPRESSION
# ═══════════════════════════════════════════════════════════════════════
def silent_unraisable_hook(unraisable):
    if issubclass(unraisable.exc_type, KeyboardInterrupt):
        return
    sys.__unraisablehook__(unraisable)
sys.unraisablehook = silent_unraisable_hook

class GracefulInterruptHandler:
    def __init__(self):
        self.interrupted = False
        signal.signal(signal.SIGINT, self.handler)

    def handler(self, signum, frame):
        if self.interrupted:
            print("\n\n🛑 Force quitting...")
            sys.exit(1)
        self.interrupted = True
        print("\n\n🛑 [Ctrl+C Detected] Please wait... finishing the current stock download to avoid breaking the network connection. The report will generate right after!")

# ═══════════════════════════════════════════════════════════════════════
#  CONFIGURATION — edit these to tune the screener
# ═══════════════════════════════════════════════════════════════════════
CFG = {
    # Custom Links
    'tv_chart_url': 'https://in.tradingview.com/chart/fZ5fwxUh/',

    # Liquidity filters
    'min_avg_volume_30d':    200_000,
    'min_avg_turnover_crore': 5,
    'min_market_cap_crore':   500,

    # Prior advance thresholds
    'min_30d_return':  15.0,   # %
    'min_60d_return':  25.0,   # %
    'pref_90d_return': 30.0,   # %

    # 52-week proximity & conventional Stage-2
    'max_dist_52w_high': -25.0,  # % — reject below this
    'min_dist_52w_low':   25.0,  # % — conventional Minervini Stage 2 minimum above 52W low

    # Consolidation
    'max_drawdown_30d': -25.0,   # % — reject below this
    'max_base_depth':   -35.0,   # % — reject bases deeper than 35%

    # ATR contraction
    'atr_contraction_threshold': 0.85,

    # Breakout relative volume threshold
    'breakout_rel_vol': 120.0,   # % of 20-day average volume

    # Scoring weights (60:40 preserved)
    'vcp_weight':        0.60,
    'leadership_weight': 0.40,

    # Output
    'top_n': 20,
    'delay_between_stocks': 0.25,
}

# ═══════════════════════════════════════════════════════════════════════
#  HELPERS
# ═══════════════════════════════════════════════════════════════════════
def safe(v, default=0.0):
    try:
        f = float(v)
        return default if (np.isnan(f) or np.isinf(f)) else f
    except: return default

def atr(df, period):
    h, l, c = df['High'], df['Low'], df['Close']
    tr = pd.concat([h - l,
                    (h - c.shift()).abs(),
                    (l - c.shift()).abs()], axis=1).max(axis=1)
    return tr.rolling(period).mean().iloc[-1]

def ema(series, period):
    return series.ewm(span=period, adjust=False).mean()

def sma(series, period):
    return series.rolling(period).mean()

BULK_STOCK_DATA = {}
BENCHMARK_HISTORY = None

# ═══════════════════════════════════════════════════════════════════════
#  DATA FETCH (Yahoo Finance)
# ═══════════════════════════════════════════════════════════════════════
def fetch_data(symbol, days=400):
    if symbol in BULK_STOCK_DATA:
        return BULK_STOCK_DATA[symbol], {}
    try:
        tk    = yf.Ticker(symbol + '.NS')
        end   = datetime.now()
        start = end - timedelta(days=days)
        df    = tk.history(start=start, end=end, interval='1d')
        if df is None or len(df) < 252:
            return None, {}
        df = df[['Open','High','Low','Close','Volume']].dropna()
        info = {}
        try:
            raw        = tk.fast_info
            info['market_cap'] = safe(getattr(raw, 'market_cap', 0)) / 1e7  # → crore
        except: pass
        return df, info
    except: return None, {}

# ═══════════════════════════════════════════════════════════════════════
#  PART 2 — LIQUIDITY FILTER
# ═══════════════════════════════════════════════════════════════════════
def check_liquidity(df, info):
    avg_vol      = df['Volume'].iloc[-30:].mean()
    avg_turnover = (df['Close'].iloc[-30:] * df['Volume'].iloc[-30:]).mean() / 1e7
    market_cap   = safe(info.get('market_cap', 0))
    ok = (avg_vol      >= CFG['min_avg_volume_30d'] and
          avg_turnover >= CFG['min_avg_turnover_crore'] and
          (market_cap  >= CFG['min_market_cap_crore'] or market_cap == 0))
    return ok, round(avg_vol), round(avg_turnover, 2), round(market_cap)

# ═══════════════════════════════════════════════════════════════════════
#  PART 3 — MINERVINI TREND TEMPLATE (Mandatory Qualification Gate)
# ═══════════════════════════════════════════════════════════════════════
def trend_template(df):
    """
    Mandatory Moving-Average Hierarchy:
      1. 10 EMA > 20 EMA > 150 SMA > 200 SMA
      2. Close > 10 EMA
      3. Close > 150 SMA and Close > 200 SMA
      4. 200 SMA is rising (evaluated over prior month / 21 sessions)

    Supplementary Trend-Quality & Conventional Minervini Metrics:
      - Close > 50 EMA
      - 20 EMA > 50 EMA
      - 50 EMA > 150 SMA
      - Close >= 25% above 52-week low
    """
    c = df['Close']
    if len(c) < 222:
        return 0.0, 0, 4, False, {}, 0.0

    close = c.iloc[-1]
    e10   = ema(c, 10).iloc[-1]
    e20   = ema(c, 20).iloc[-1]
    e50   = ema(c, 50).iloc[-1]
    s150  = sma(c, 150).iloc[-1]
    
    s200_series = sma(c, 200)
    s200        = s200_series.iloc[-1]
    s200_prev   = s200_series.iloc[-22] if len(s200_series) >= 222 else s200_series.iloc[0]
    s200_rising = bool(s200 > s200_prev)

    # 4 Mandatory Conditions
    c_hierarchy   = bool(e10 > e20 and e20 > s150 and s150 > s200)
    c_close_e10   = bool(close > e10)
    c_close_long  = bool(close > s150 and close > s200)
    c_s200_rising = s200_rising

    mandatory_conds = {
        '10EMA > 20EMA > 150SMA > 200SMA': c_hierarchy,
        'Close > 10EMA': c_close_e10,
        'Close > 150SMA & 200SMA': c_close_long,
        '200SMA Rising (1-Mo)': c_s200_rising,
    }
    mandatory_passed = sum(mandatory_conds.values())
    mandatory_total  = len(mandatory_conds)
    mandatory_ok     = (mandatory_passed == mandatory_total)

    # Supplementary Trend Quality Metrics
    l252 = df['Low'].iloc[-252:].min() if len(df) >= 252 else df['Low'].min()
    dist_52w_low = round((close - l252) / l252 * 100, 1) if l252 > 0 else 0.0
    c_52w_low    = bool(dist_52w_low >= CFG.get('min_dist_52w_low', 25.0))

    supp_conds = {
        'Close > 50EMA': bool(close > e50),
        '20EMA > 50EMA': bool(e20 > e50),
        '50EMA > 150SMA': bool(e50 > s150),
        'Close >= 25% Above 52W Low': c_52w_low,
    }
    supp_passed = sum(supp_conds.values())

    # Points for Leadership Score (max 35 pts):
    # Mandatory contributes 25 pts; supplementary quality contributes 10 pts.
    score = (mandatory_passed / mandatory_total * 25.0) + (supp_passed / len(supp_conds) * 10.0)

    all_details = {**mandatory_conds, **supp_conds}
    return round(score, 1), mandatory_passed, mandatory_total, mandatory_ok, all_details, dist_52w_low

# ═══════════════════════════════════════════════════════════════════════
#  PART 4 — PRIOR ADVANCE
# ═══════════════════════════════════════════════════════════════════════
def prior_advance(df):
    c   = df['Close']
    cur = c.iloc[-1]
    def ret(n):
        idx = max(0, len(c) - n - 1)
        p   = c.iloc[idx]
        return round((cur / p - 1) * 100, 1) if p > 0 else 0.0

    r30 = ret(21)
    r60 = ret(42)
    r90 = ret(63)

    if   r90 >= 100: pts = 20
    elif r90 >= 70:  pts = 18
    elif r90 >= 50:  pts = 15
    elif r90 >= 30:  pts = 12
    elif r60 >= 30:  pts = 10
    elif r30 >= 15:  pts = 6
    else:            pts = 0

    qualifies = r30 >= CFG['min_30d_return'] or r60 >= CFG['min_60d_return']
    return r30, r60, r90, pts, qualifies

# ═══════════════════════════════════════════════════════════════════════
#  PART 5 — 52-WEEK HIGH PROXIMITY
# ═══════════════════════════════════════════════════════════════════════
def high_proximity(df):
    c       = df['Close']
    h252    = df['High'].iloc[-252:].max()
    l252    = df['Low'].iloc[-252:].min()
    cur     = c.iloc[-1]
    dist    = round((cur - h252) / h252 * 100, 1)

    if   dist >= -5:  pts = 20
    elif dist >= -10: pts = 15
    elif dist >= -15: pts = 10
    elif dist >= -20: pts = 5
    else:             pts = 0

    qualifies = dist >= CFG['max_dist_52w_high']
    return dist, pts, round(h252, 2), round(l252, 2), qualifies

# ═══════════════════════════════════════════════════════════════════════
#  PART 6 — BASE IDENTIFICATION & CONSOLIDATION
# ═══════════════════════════════════════════════════════════════════════
def detect_base(df):
    """
    Identifies the active consolidation base:
    - Finds the primary base peak (swing high) in the last 15-90 days.
    - Finds the base low since that peak.
    - Evaluates base depth, length, and position within the base.
    """
    c = df['Close']
    h = df['High']
    l = df['Low']
    n = min(len(df), 90)

    recent_h = h.iloc[-n:]
    recent_l = l.iloc[-n:]
    cur = c.iloc[-1]

    lookback_h = recent_h.iloc[:-3] if len(recent_h) > 5 else recent_h
    base_peak_val = float(lookback_h.max())
    peak_idx = int(lookback_h.values.argmax())

    base_h_slice = recent_h.iloc[peak_idx:]
    base_l_slice = recent_l.iloc[peak_idx:]

    base_high = float(base_h_slice.max())
    base_low = float(base_l_slice.min())
    base_length = len(base_h_slice)

    base_depth = round((base_low - base_high) / base_high * 100, 1) if base_high > 0 else 0.0
    base_drawdown = round((cur - base_high) / base_high * 100, 1) if base_high > 0 else 0.0

    base_range = base_high - base_low
    base_position = round((cur - base_low) / base_range * 100, 1) if base_range > 0 else 50.0
    upper_half = base_position >= 50.0
    upper_third = base_position >= 66.7

    h30 = h.iloc[-30:].max() if len(h) >= 30 else h.max()
    dd_30 = round((cur - h30) / h30 * 100, 1) if h30 > 0 else 0.0

    if base_drawdown >= -5:
        base_type = 'Shelf'
    elif base_drawdown >= -12:
        base_type = 'Flat Base'
    elif base_drawdown >= -22:
        base_type = 'Cup'
    elif base_drawdown >= -30:
        base_type = 'Deep Cup'
    else:
        base_type = 'Too Deep'

    return {
        'base_high': round(base_high, 2),
        'base_low': round(base_low, 2),
        'base_length': base_length,
        'base_depth': base_depth,
        'base_drawdown': base_drawdown,
        'base_position': base_position,
        'upper_half': upper_half,
        'upper_third': upper_third,
        'dd_30': dd_30,
        'base_type': base_type,
        'peak_idx': peak_idx
    }

def consolidation(df):
    base_info = detect_base(df)
    dd = base_info['base_drawdown']
    dd_30 = base_info['dd_30']
    
    eff_dd = dd_30 if dd_30 < dd else dd

    if   eff_dd >= -5:   pts = 20
    elif eff_dd >= -10:  pts = 16
    elif eff_dd >= -15:  pts = 12
    elif eff_dd >= -20:  pts = 8
    elif eff_dd >= -25:  pts = 4
    else:                pts = 0

    qualifies = eff_dd >= CFG['max_drawdown_30d']
    return eff_dd, pts, qualifies, base_info['base_type'], base_info

# ═══════════════════════════════════════════════════════════════════════
#  PART 7 — VOLUME DRY-UP & BREAKOUT METRICS
# ═══════════════════════════════════════════════════════════════════════
def volume_dryup(df):
    v         = df['Volume']
    vol_r     = v.iloc[-10:].mean()
    vol_l     = v.iloc[-30:-10].mean()
    if vol_l <= 0: return 0.0, 0, False, 100.0, False
    contraction = (vol_r / vol_l - 1) * 100
    dryup       = bool(contraction < 0)

    if   contraction <= -60: pts = 20
    elif contraction <= -40: pts = 16
    elif contraction <= -20: pts = 12
    elif contraction < 0:    pts = 6
    else:                    pts = 0

    # Breakout relative volume: today's volume vs 20-day average
    v20_avg = v.iloc[-20:].mean() if len(v) >= 20 else v.mean()
    today_vol = v.iloc[-1]
    rel_vol_pct = round((today_vol / v20_avg) * 100, 1) if v20_avg > 0 else 100.0
    breakout_vol_active = bool(rel_vol_pct >= CFG.get('breakout_rel_vol', 120.0))

    return round(contraction, 1), pts, dryup, rel_vol_pct, breakout_vol_active

# ═══════════════════════════════════════════════════════════════════════
#  PART 8 — ATR CONTRACTION
# ═══════════════════════════════════════════════════════════════════════
def atr_contraction(df):
    if len(df) < 35: return 1.0, 0, False
    a10 = atr(df, 10)
    a30 = atr(df, 30)
    if a30 <= 0: return 1.0, 0, False
    ratio = round(a10 / a30, 3)

    if   ratio < 0.60: pts = 20
    elif ratio < 0.70: pts = 16
    elif ratio < 0.80: pts = 12
    elif ratio < 0.85: pts = 8
    else:              pts = 0

    contracting = ratio < CFG['atr_contraction_threshold']
    return ratio, pts, contracting

# ═══════════════════════════════════════════════════════════════════════
#  PART 9 — TIGHTNESS DETECTION (High-Low & Closing Spread)
# ═══════════════════════════════════════════════════════════════════════
def tightness(df):
    h10 = df['High'].iloc[-10:].max()
    l10 = df['Low'].iloc[-10:].min()
    c = df['Close']
    if l10 <= 0 or len(c) < 10: return 99.0, 0, 99.0, 99.0
    hl_tight_10 = round((h10 - l10) / l10 * 100, 1)

    c5_max = c.iloc[-5:].max()
    c5_min = c.iloc[-5:].min()
    close_tight_5 = round((c5_max - c5_min) / c5_min * 100, 1) if c5_min > 0 else hl_tight_10

    c10_max = c.iloc[-10:].max()
    c10_min = c.iloc[-10:].min()
    close_tight_10 = round((c10_max - c10_min) / c10_min * 100, 1) if c10_min > 0 else hl_tight_10

    if hl_tight_10 <= 5 or close_tight_5 <= 3.0:
        pts = 20
    elif hl_tight_10 <= 8 or close_tight_5 <= 4.5:
        pts = 16
    elif hl_tight_10 <= 10 or close_tight_10 <= 6.0:
        pts = 12
    elif hl_tight_10 <= 15:
        pts = 6
    else:
        pts = 0

    return hl_tight_10, pts, close_tight_5, close_tight_10

# ═══════════════════════════════════════════════════════════════════════
#  PART 10 — TRUE VCP PULLBACK SEQUENCE WITHIN BASE
# ═══════════════════════════════════════════════════════════════════════
def vcp_pullbacks(df, base_info=None):
    if base_info is None:
        base_info = detect_base(df)
        
    base_len = max(10, base_info.get('base_length', 30))
    c = df['Close'].iloc[-base_len:].reset_index(drop=True)
    h = df['High'].iloc[-base_len:].reset_index(drop=True)
    l = df['Low'].iloc[-base_len:].reset_index(drop=True)
    n = len(c)

    if n < 8:
        return 0, [], 'Insufficient base data'

    window = 3 if n < 40 else 4
    peaks = []
    troughs = []

    for i in range(window, n - window):
        if h.iloc[i] == h.iloc[i - window : i + window + 1].max():
            peaks.append((i, h.iloc[i]))
        if l.iloc[i] == l.iloc[i - window : i + window + 1].min():
            troughs.append((i, l.iloc[i]))

    pullbacks = []
    for t_idx, t_val in troughs:
        prior_peaks = [(p_i, p_v) for p_i, p_v in peaks if p_i < t_idx]
        if not prior_peaks: continue
        p_i, p_v = prior_peaks[-1]
        if p_v > 0 and t_val < p_v:
            depth = round((p_v - t_val) / p_v * 100, 1)
            if depth >= 2.0:
                pullbacks.append(depth)

    pullbacks = pullbacks[-4:]

    bonus = 0
    vcp_quality = 'No Sequence'

    if len(pullbacks) >= 2:
        contractions = sum(1 for i in range(1, len(pullbacks)) if pullbacks[i] < pullbacks[i-1])
        ratio = contractions / (len(pullbacks) - 1)
        if ratio == 1.0 and len(pullbacks) >= 3:
            bonus = 10
            vcp_quality = 'Textbook VCP (3+ contracting)'
        elif ratio == 1.0 and len(pullbacks) == 2:
            bonus = 7
            vcp_quality = 'Clean VCP (2 contracting)'
        elif ratio >= 0.5:
            bonus = 4
            vcp_quality = 'Developing Contraction'
        else:
            bonus = 0
            vcp_quality = 'Irregular Waves'
    elif len(pullbacks) == 1:
        if pullbacks[0] <= 8.0 and base_info.get('upper_half', False):
            bonus = 5
            vcp_quality = 'Tight Shallow Base'
        elif pullbacks[0] <= 15.0:
            bonus = 3
            vcp_quality = 'Single Base Contraction'

    return bonus, pullbacks, vcp_quality

# ═══════════════════════════════════════════════════════════════════════
#  PART 11 — RELATIVE STRENGTH (RS_Proxy_Percentile vs Benchmark)
# ═══════════════════════════════════════════════════════════════════════
def rs_proxy_raw(df, bench_df=None):
    """
    Evaluates relative performance using IBD/MarketSmith 12-month weighted formula:
    40% 3M (63d) + 20% 6M (126d) + 20% 9M (189d) + 20% 12M (252d)
    relative to the benchmark (Nifty 500 / Nifty 50).
    """
    c   = df['Close']
    def ret(series, n):
        idx = max(0, len(series) - n - 1)
        p   = series.iloc[idx]
        return (series.iloc[-1] / p - 1) * 100 if p > 0 else 0.0

    r63  = ret(c, 63)
    r126 = ret(c, 126)
    r189 = ret(c, 189)
    r252 = ret(c, 252)

    if bench_df is not None and len(bench_df) >= 200:
        bc   = bench_df['Close']
        b63  = ret(bc, 63)
        b126 = ret(bc, 126)
        b189 = ret(bc, 189)
        b252 = ret(bc, 252)
        rel63  = r63 - b63
        rel126 = r126 - b126
        rel189 = r189 - b189
        rel252 = r252 - b252
    else:
        rel63, rel126, rel189, rel252 = r63, r126, r189, r252

    composite = round(rel63 * 0.4 + rel126 * 0.2 + rel189 * 0.2 + rel252 * 0.2, 2)
    return composite, r63, r126, r252

def compute_rs_scores(results, all_composites=None):
    """
    Ranks relative-performance composite against the scanned universe as a 1-99 integer percentile
    (matching IBD / MarketSmith RS Rating scale).
    """
    if not results: return results
    composites = all_composites if (all_composites and len(all_composites) > 10) else [r['_rs_composite'] for r in results]
    sorted_comps = sorted(composites)
    n = len(sorted_comps)

    for r in results:
        val = r['_rs_composite']
        import bisect
        rank = bisect.bisect_right(sorted_comps, val)
        pctile = int(round((rank / n) * 98.0)) + 1 if n > 1 else 99
        pctile = min(99, max(1, pctile))
        r['rs_proxy_percentile'] = pctile
        r['rs_score'] = pctile  # alias for backward-compatibility
    return results

# ═══════════════════════════════════════════════════════════════════════
#  PART 12 — SETUP DETECTION (Pocket Pivot, Potential BO, Pull Back)
# ═══════════════════════════════════════════════════════════════════════
def pocket_pivot(df):
    if len(df) < 12: return False
    c = df['Close']
    v = df['Volume']
    e10_s = ema(c, 10)
    today_vol = v.iloc[-1]
    today_cls = c.iloc[-1]
    today_e10 = e10_s.iloc[-1]

    prior = df.iloc[-11:-1]
    down_days = prior[prior['Close'] < prior['Close'].shift(1).fillna(prior['Close'])]
    if down_days.empty: return False

    max_down_vol = down_days['Volume'].max()
    return bool(today_cls > today_e10 and today_vol > max_down_vol)

def potential_bo(df, r60, r90, dist52, base_info):
    if len(df) < 150: return False, 0.0, 0.0
    c = df['Close']
    v = df['Volume']
    c0 = c.iloc[-1]
    
    s50 = sma(c, 50).iloc[-1]
    s200 = sma(c, 200).iloc[-1]
    
    pivot = base_info.get('base_high', df['High'].iloc[-20:].max())
    dist_to_pivot = round((c0 - pivot) / pivot * 100, 1) if pivot > 0 else -99.0

    if not (c0 > s50 and s50 > s200): return False, pivot, dist_to_pivot
    if not (r60 >= 25 or r90 >= 25): return False, pivot, dist_to_pivot
    if dist52 < -25: return False, pivot, dist_to_pivot

    # Within -1.5% to -10.0% of pivot candidate in upper half of base
    if not (-10.0 <= dist_to_pivot <= -1.5): return False, pivot, dist_to_pivot
    if not base_info.get('upper_half', True): return False, pivot, dist_to_pivot

    # Quiet volume approaching breakout
    v3 = v.iloc[-3:].mean()
    v20 = v.iloc[-20:].mean()
    quiet_vol = bool(v3 < v20) if v20 > 0 else True

    return quiet_vol, pivot, dist_to_pivot

def pull_back_setup(df):
    if len(df) < 252: return False
    c = df['Close']
    h = df['High']
    c0 = c.iloc[-1]

    h252 = h.iloc[-252:].max()
    h_recent = h.iloc[-20:].max()

    hit_ath_recently = (h_recent >= h252 * 0.98)
    drawdown = (c0 - h_recent) / h_recent * 100
    e50 = ema(c, 50).iloc[-1]
    e20 = ema(c, 20).iloc[-1]

    # Holding above 50 EMA or 20 EMA
    if hit_ath_recently and (-12 <= drawdown <= -3) and (c0 > e50 or c0 > e20):
        return True
    return False

# ═══════════════════════════════════════════════════════════════════════
#  PARTS 13-16 — SCORING & GRADING
# ═══════════════════════════════════════════════════════════════════════
def leadership_score(prox_pts, trend_pts, rs_score, avg_turnover):
    liq = min(15, avg_turnover / 10 * 15) if avg_turnover < 10 else 15
    rs_pts = rs_score * 0.30
    total = min(100, prox_pts + trend_pts + rs_pts + liq)
    return round(total, 1)

def vcp_score(adv_pts, dd_pts, vol_pts, atr_pts, tight_pts):
    return min(100, adv_pts + dd_pts + vol_pts + atr_pts + tight_pts)

def composite_score(vcp, leadership):
    return round(vcp * CFG['vcp_weight'] + leadership * CFG['leadership_weight'], 1)

def grade(score):
    if   score >= 90: return 'A+'
    elif score >= 80: return 'A'
    elif score >= 70: return 'B'
    elif score >= 60: return 'C'
    else:             return 'REJECT'
    if   score >= 90: return 'A+'
    elif score >= 80: return 'A'
    elif score >= 70: return 'B'
    elif score >= 60: return 'C'
    else:             return 'REJECT'

# ═══════════════════════════════════════════════════════════════════════
#  INDUSTRY GROUP MAPPINGS & CLASSIFICATION
# ═══════════════════════════════════════════════════════════════════════
PSU_BANKS_TICKERS = {'SBIN', 'PNB', 'BOB', 'CANBK', 'UNIONBANK', 'INDIANB', 'UCOBANK', 'BANKBARODA', 'BANKINDIA', 'MAHABANK', 'CENTRALBK', 'IOB', 'PSB'}
PRIVATE_BANKS_TICKERS = {'HDFCBANK', 'ICICIBANK', 'KOTAKBANK', 'AXISBANK', 'INDUSINDBK', 'FEDERALBNK', 'IDFCFIRSTB', 'BANDHANBNK', 'YESBANK', 'CUB', 'KTKBANK', 'RBLBANK', 'SOUTHBANK', 'CSBBANK', 'AUBANK', 'INDUSIND'}
INSURANCE_TICKERS = {'HDFCLIFE', 'SBILIFE', 'ICICIPRULI', 'LIC', 'GICRE', 'NIACL', 'MAXFSL', 'ICICIGI', 'STARHEALTH'}
AMC_TICKERS = {'HDFCAMC', 'NAM-INDIA', 'UTIAMC', 'ABSLAMC'}
CAPITAL_MARKETS_TICKERS = {'CDSL', 'BSE', 'MCX', 'CAMS', 'KFINTECH', 'ANGELONE', 'ISEC', 'MUTHOOTOT', '5PAISA', 'ANANDRATHI', 'GEODJITFSL', 'MOTILALOFS'}

CABLES_TICKERS = {'POLYCAB', 'KEI', 'RRKABEL', 'FINCABLES'}
TRANSFORMERS_TICKERS = {'VOLTAMP', 'CGPOWER', 'TRIL', 'TRANSFORM', 'SCHNEIDER'}
BEARINGS_TICKERS = {'SKFINDIA', 'TIMKEN', 'SHAFFLER', 'SCHAEFFLER', 'HARSHA'}
COMPRESSORS_TICKERS = {'ELGIEQUIP', 'KPIL', 'KIRLPNU'}
HVAC_TICKERS = {'VOLTAS', 'BLUESTARCO', 'HITACHIHAM'}

COPPER_TICKERS = {'HINDCOPPER'}
STEEL_TICKERS = {'TATASTEEL', 'JSWSTEEL', 'SAIL', 'JSL', 'JINDALSTEL', 'KALYANISTEEL', 'APLAPOLLO', 'WELCORP', 'MAHSEAMLES'}
ALUMINIUM_TICKERS = {'HINDALCO', 'NATIONALUM'}
MINING_TICKERS = {'COALINDIA', 'NMDC', 'GMDC'}
EXPLOSIVES_TICKERS = {'SOLARINDS', 'PREMEXPLN'}
DYES_PIGMENTS_TICKERS = {'BODALCHEM', 'KIRIINDUS', 'SUDARSCHEM', 'MEGH'}

GAS_TRADING_TICKERS = {'GAIL', 'GSPL'}
CGD_TICKERS = {'IGL', 'MGL', 'ATGL', 'GUJGASLTD'}
SOLAR_TICKERS = {'TATAPOWER', 'ADANIGREEN', 'SWSOLAR', 'WAAREEENER', 'WEBSOL'}
POWER_EQUIP_TICKERS = {'BHEL', 'SUZLON', 'INOXWIND', 'GET&D'}

CDMO_TICKERS = {'DIVISLAB', 'SYNGENE', 'SUVENPHAR', 'LAURUSLABS'}
DIAGNOSTICS_TICKERS = {'LALPATHLAB', 'METROPOLIS', 'THYROCARE', 'VIJAYA'}
MEDICAL_DEVICES_TICKERS = {'POLYMED'}

COMMERCIAL_VEH_TICKERS = {'ASHOKLEY', 'SMLISUZU'}
PASSENGER_VEH_TICKERS = {'MARUTI', 'M&M', 'TATAMOTORS', 'HYUNDAI'}
TYRES_TICKERS = {'MRF', 'APOLLOTYRE', 'CEATLTD', 'JKTYRE', 'BALKRISIND'}
EV_COMPONENTS_TICKERS = {'SONACOMS', 'MINDACORP', 'UNOMINDA'}
BATTERIES_TICKERS = {'EXIDEIND', 'AMARAJABAT', 'ARE&M'}
TRACTORS_TICKERS = {'ESCORTS', 'VSTTILLERS'}

RETAIL_TICKERS = {'TRENT', 'DMART', 'ABFRL', 'SHOPERSTOP', 'VMART', 'ETHOSLTD'}
JEWELLERY_TICKERS = {'TITAN', 'KALYANKJIL', 'SENCO', 'RAJESHEXPO'}
FOOTWEAR_TICKERS = {'BATAINDIA', 'METROBRAND', 'RELAXO', 'CAMPUS'}
RESTAURANTS_QSR_TICKERS = {'JUBLFOOD', 'DEVYANI', 'WESTLIFE', 'RBA', 'SAPPHIRE'}
TEXTILES_TICKERS = {'PAGEIND', 'ARVIND', 'VTL', 'RAYMOND', 'WELSPUNLIV', 'ALOKIND', 'GARFIBRES', 'GOKEX', 'KPRMILL'}

AEROSPACE_DEFENCE_TICKERS = {'HAL', 'BEL', 'BDL', 'ASTRAMICRO', 'PARAS', 'DATAPATTNS', 'ZENTEC', 'MTARTECH', 'DYNAMATECH', 'IDEAFORGE'}
SHIPBUILDING_TICKERS = {'MAZDOCK', 'COCHINSHIP', 'GRSE'}
EMS_TICKERS = {'DIXON', 'KAYNES', 'SYRMA', 'AVALON'}
DATA_CENTERS_TICKERS = {'NETWEB', 'ANANTRAJ'}
RAILWAY_TICKERS = {'IRFC', 'IRCTC', 'RVNL', 'IRCON', 'RITES', 'TITAGARH', 'TEXMACO', 'RAILTEL', 'JWL'}
AGRO_TICKERS = {'CHAMBLFERT', 'FACT', 'COROMANDEL', 'GNFC', 'GSFC', 'RCF', 'UPL'}

FILTER_STOCK_MAP = None

MS_GROUP_TO_SECTOR = {
    'Aerospace/Defense': 'Defense',
    'Apparel-Clothing Mfg': 'Textiles',
    'Apparel-Shoes & Rel Mfg': 'Consumer Durables',
    'Auto Manufacturers': 'Automobile and Auto Components',
    'Auto/Truck-Original Eqp': 'Automobile and Auto Components',
    'Auto/Truck-Replace Parts': 'Automobile and Auto Components',
    'Auto/Truck-Tires & Misc': 'Automobile and Auto Components',
    'Banks-Money Center': 'Banks',
    'Beverages-Alcoholic': 'Fast Moving Consumer Goods',
    'Beverages-Non-Alcoholic': 'Fast Moving Consumer Goods',
    'Bldg-A/C & Heating Prds': 'Consumer Durables',
    'Bldg-Cement/Concrt/Ag': 'Construction Materials',
    'Bldg-Constr Prds/Misc': 'Capital Goods',
    'Bldg-Heavy Construction': 'Construction',
    'Bldg-Resident/Comml': 'Realty',
    'Chemicals-Agricultural': 'Agrochemicals & Fertilizers',
    'Chemicals-Basic': 'Specialty Chemicals',
    'Chemicals-Paints': 'Consumer Durables',
    'Chemicals-Plastics': 'Specialty Chemicals',
    'Chemicals-Specialty': 'Specialty Chemicals',
    'Comml Svcs-Advertising': 'Media Entertainment & Publication',
    'Comml Svcs-Consulting': 'Services',
    'Comml Svcs-Healthcare': 'Hospitals & Healthcare',
    'Comml Svcs-Market Rsrch': 'Services',
    'Comml Svcs-Outsourcing': 'Services',
    'Comp Sftwr-Spec Enterprs': 'Information Technology',
    'Computer Sftwr-Database': 'Information Technology',
    'Computer Sftwr-Desktop': 'Information Technology',
    'Computer-Hardware/Perip': 'Information Technology',
    'Computer-Networking': 'Information Technology',
    'Computer-Tech Services': 'Information Technology',
    'Consumer Prod-Electronic': 'Consumer Durables',
    'Consumer Prod-Specialty': 'Consumer Durables',
    'Consumer Svcs-Education': 'Consumer Services',
    'Cosmetics/Personal Care': 'Fast Moving Consumer Goods',
    'Diversified Operations': 'Diversified',
    'Elec-Misc Products': 'Capital Goods',
    'Electrical-Power/Equipmt': 'Capital Goods',
    'Energy-Alternative/Other': 'Power',
    'Energy-Coal': 'Oil Gas & Consumable Fuels',
    'Energy-Solar': 'Power',
    'Finance-Commercial Loans': 'NBFCs & Finance',
    'Finance-Consumer Loans': 'NBFCs & Finance',
    'Finance-Crdtcard/Pmtpr': 'NBFCs & Finance',
    'Finance-Invest Bnk/Bkrs': 'NBFCs & Finance',
    'Finance-Investment Mgmt': 'NBFCs & Finance',
    'Finance-Mrtg&Rel Svc': 'NBFCs & Finance',
    'Finance-Property Reit': 'Realty',
    'Financial Svcs-Specialty': 'NBFCs & Finance',
    'Food-Grain & Related': 'Fast Moving Consumer Goods',
    'Food-Misc Preparation': 'Fast Moving Consumer Goods',
    'Food-Packaged': 'Fast Moving Consumer Goods',
    'Hsehold-Appliances/Wares': 'Consumer Durables',
    'Insurance-Acc & Health': 'NBFCs & Finance',
    'Insurance-Brokers': 'NBFCs & Finance',
    'Insurance-Diversified': 'NBFCs & Finance',
    'Insurance-Life': 'NBFCs & Finance',
    'Insurance-Prop/Cas/Titl': 'NBFCs & Finance',
    'Internet-Content': 'Consumer Services',
    'Leisure-Lodging': 'Consumer Services',
    'Leisure-Movies & Related': 'Media Entertainment & Publication',
    'Leisure-Services': 'Consumer Services',
    'Leisure-Travel Booking': 'Consumer Services',
    'Machinery-Constr/Mining': 'Capital Goods',
    'Machinery-Farm': 'Automobile and Auto Components',
    'Machinery-Gen Industrial': 'Capital Goods',
    'Machinery-Mtl Hdlg/Autmn': 'Capital Goods',
    'Machinery-Tools & Rel': 'Capital Goods',
    'Media-Radio/Tv': 'Media Entertainment & Publication',
    'Medical-Biomed/Biotech': 'Pharma',
    'Medical-Diversified': 'Pharma',
    'Medical-Generic Drugs': 'Pharma',
    'Medical-Hospitals': 'Hospitals & Healthcare',
    'Medical-Products': 'Pharma',
    'Medical-Research Eqp/Svc': 'Pharma',
    'Medical-Services': 'Hospitals & Healthcare',
    'Medical-Supplies': 'Pharma',
    'Medical-Systems/Equip': 'Pharma',
    'Medical-Whlsle Drg/Suppl': 'Pharma',
    'Metal Proc & Fabrication': 'Metals & Mining',
    'Mining-Metal Ores': 'Metals & Mining',
    'Oil&Gas-Integrated': 'Oil Gas & Consumable Fuels',
    'Oil&Gas-Intl Expl&Prod': 'Oil Gas & Consumable Fuels',
    'Oil&Gas-Refining/Mktg': 'Oil Gas & Consumable Fuels',
    'Oil&Gas-Transprt/Pipelne': 'Oil Gas & Consumable Fuels',
    'Real Estate Dvlpmt/Ops': 'Realty',
    'Retail-Department Stores': 'Consumer Services',
    'Retail-Internet': 'Consumer Services',
    'Retail-Mail Order&Direct': 'Consumer Services',
    'Retail-Restaurants': 'Consumer Services',
    'Retail-Specialty': 'Consumer Services',
    'Retail-Super/Mini Mkts': 'Consumer Services',
    'Retail/Whlsle-Jewelry': 'Consumer Durables',
    'Steel-Producers': 'Metals & Mining',
    'Steel-Specialty Alloys': 'Metals & Mining',
    'Telecom Svcs-Cable/Satl': 'Telecommunication',
    'Telecom Svcs-Integrated': 'Telecommunication',
    'Telecom Svcs-Wireless': 'Telecommunication',
    'Telecom-Consumer Prods': 'Telecommunication',
    'Telecom-Infrastructure': 'Telecommunication',
    'Tobacco': 'Fast Moving Consumer Goods',
    'Transportation-Airline': 'Services',
    'Transportation-Equip Mfg': 'Capital Goods',
    'Transportation-Logistics': 'Services',
    'Transportation-Ship': 'Services',
    'Trucks & Parts-Hvy Duty': 'Automobile and Auto Components',
    'Utility-Electric Power': 'Power',
    'Utility-Gas Distribution': 'Oil Gas & Consumable Fuels',
}

def get_industry_group(symbol, company, industry):
    global FILTER_STOCK_MAP
    sym = symbol.upper().replace('.NS', '')
    
    # Lazy load the Filter_India_Stocks.csv
    if FILTER_STOCK_MAP is None:
        FILTER_STOCK_MAP = {}
        try:
            csv_path = Path(__file__).resolve().parent / 'Filter_India_Stocks.csv'
            if csv_path.exists():
                df = pd.read_csv(csv_path, index_col=False)
                for _, row in df.iterrows():
                    s_code = str(row['Symbol']).strip().upper()
                    gp = str(row['Industry_Group']).strip() if pd.notna(row['Industry_Group']) else ''
                    if s_code and gp:
                        FILTER_STOCK_MAP[s_code] = gp
        except Exception as e:
            logging.warning(f"Error loading Filter_India_Stocks.csv: {e}")

    # Check if stock exists in CSV
    if FILTER_STOCK_MAP and sym in FILTER_STOCK_MAP:
        raw_group = FILTER_STOCK_MAP[sym]
        parent = MS_GROUP_TO_SECTOR.get(raw_group, 'Diversified')
        group = raw_group
        if not group.endswith(' IN'):
            group = group + ' IN'
        return group, parent

    # Fallback to default keyword heuristic logic if not found in CSV
    comp = company.upper()
    ind = industry.upper()
    
    # 0. Railways
    railway_tickers = {'IRFC', 'IRCTC', 'RVNL', 'IRCON', 'RITES', 'TITAGARH', 'TEXMACO', 'RAILTEL', 'JWL'}
    if sym in railway_tickers or 'RAILWAY' in comp:
        return "Transportation-Rail IN", "Railways"

    # 0.5. Defense / Aerospace
    if sym in AEROSPACE_DEFENCE_TICKERS or any(x in comp for x in ["AEROSPACE", "DEFENCE", "DEFENSE", "DYNAMICS"]):
        return "Aerospace/Defense IN", "Defense"
        
    # 1. Financials
    if "FINANCIAL" in ind or "BANKS" in ind:
        if sym in PSU_BANKS_TICKERS or any(x in comp for x in ["STATE BANK", "PUNJAB NATIONAL", "BANK OF BARODA", "CANARA", "UNION BANK", "INDIAN BANK", "UCO BANK", "BANK OF INDIA", "MAHARASHTRA", "CENTRAL BANK", "OVERSEAS", "SHUBH", "PSU"]):
            return "Banks-Money Center IN", "Banks"
        if sym in PRIVATE_BANKS_TICKERS or any(x in comp for x in ["HDFC BANK", "ICICI BANK", "KOTAK", "AXIS", "INDUSIND", "FEDERAL", "IDFC FIRST", "BANDHAN", "YES BANK", "CITY UNION", "KARUR VYSYA", "RBL", "SOUTH INDIAN", "CSB BANK", "AU SMALL"]):
            return "Banks-Money Center IN", "Banks"
        if sym in INSURANCE_TICKERS or any(x in comp for x in ["INSURANCE", "LIFE", "GENERAL INS", "ASSURANCE", "MAX FINANCIAL"]):
            return "Insurance-Life IN", "NBFCs & Finance"
        if sym in AMC_TICKERS or "AMC" in comp or "MUTUAL FUND" in comp or "ASSET MANAGEMENT" in comp or "NIPPON LIFE" in comp:
            return "Finance-Investment Mgmt IN", "NBFCs & Finance"
        if sym in CAPITAL_MARKETS_TICKERS or "CAPITAL MARKETS" in ind or any(x in comp for x in ["CDSL", "BSE", "MCX", "CAMS", "KFIN", "ANGEL ONE", "SECURITIES", "WEALTH", "BROKING", "INVESTMENT"]):
            return "Finance-Invest Bnk/Bkrs IN", "NBFCs & Finance"
        return "Finance-Consumer Loans IN", "NBFCs & Finance"

    # 2. Industrials
    if "CAPITAL GOODS" in ind or "INDUSTRIAL" in ind or "MACHINERY" in ind:
        if sym in AEROSPACE_DEFENCE_TICKERS or any(x in comp for x in ["AEROSPACE", "DEFENCE", "DEFENSE", "DYNAMICS"]):
            return "Aerospace/Defense IN", "Defense"
        if sym in SHIPBUILDING_TICKERS or "SHIPYARD" in comp or "SHIPBUILD" in comp or "MAZAGON" in comp:
            return "Transportation-Ship IN", "Defense"
        
        if sym in CABLES_TICKERS or "CABLE" in comp or "RR KABEL" in comp:
            return "Electrical-Power/Equipmt IN", "Capital Goods"
        if sym in TRANSFORMERS_TICKERS or "TRANSFORMER" in comp or "SCHNEIDER" in comp:
            return "Electrical-Power/Equipmt IN", "Capital Goods"
        if sym in BEARINGS_TICKERS or "BEARING" in comp:
            return "Machinery-Gen Industrial IN", "Capital Goods"
        if sym in COMPRESSORS_TICKERS or "COMPRESSOR" in comp or "PNEUMATIC" in comp:
            return "Machinery-Gen Industrial IN", "Capital Goods"
        if sym in HVAC_TICKERS or "VOLTAS" in comp or "BLUE STAR" in comp:
            return "Bldg-A/C &amp; Heating Prds IN", "Capital Goods"
        if "AUTOMATION" in comp or "HONEYWELL" in comp:
            return "Machinery-Gen Industrial IN", "Capital Goods"
        return "Machinery-Gen Industrial IN", "Capital Goods"

    # 3. Materials
    if "METALS & MINING" in ind or "METALS" in ind or "MINING" in ind or "MATERIALS" in ind:
        if sym in COPPER_TICKERS or "COPPER" in comp:
            return "Mining-Metal Ores IN", "Metals & Mining"
        if sym in ALUMINIUM_TICKERS or "ALUMINIUM" in comp or "NALCO" in comp:
            return "Mining-Metal Ores IN", "Metals & Mining"
        if sym in MINING_TICKERS or "MINING" in ind or "COAL INDIA" in comp or "NMDC" in comp or "GMDC" in comp:
            return "Mining-Metal Ores IN", "Metals & Mining"
        if sym in STEEL_TICKERS or "STEEL" in comp or "PIPE" in comp or "APOLLO TUBES" in comp or "WELSPUN CORP" in comp:
            return "Steel-Producers IN", "Metals & Mining"
        return "Metal Proc &amp; Fabrication IN", "Metals & Mining"

    if "CHEMICALS" in ind:
        agro_keywords = ["AGRICULTURAL", "FERTILIZER", "AGRI"]
        agro_tickers = {"CHAMBLFERT", "FACT", "COROMANDEL", "GNFC", "GSFC", "RCF", "UPL"}
        if any(kw in comp for kw in agro_keywords) or sym in agro_tickers:
            return "Chemicals-Agricultural IN", "Agrochemicals & Fertilizers"
        if sym in EXPLOSIVES_TICKERS or "EXPLOSIVE" in comp or "SOLAR IND" in comp:
            return "Chemicals-Specialty IN", "Specialty Chemicals"
        if sym in DYES_PIGMENTS_TICKERS or "DYE" in comp or "PIGMENT" in comp or "SUDARSHAN" in comp:
            return "Chemicals-Specialty IN", "Specialty Chemicals"
        return "Chemicals-Specialty IN", "Specialty Chemicals"

    # 4. Energy
    if "POWER" in ind or "OIL GAS" in ind or "ENERGY" in ind:
        if sym in GAS_TRADING_TICKERS or "GAIL" in comp or "GSPL" in comp:
            return "Utility-Gas Distribution IN", "Oil Gas & Consumable Fuels"
        if sym in CGD_TICKERS or "GUJARAT GAS" in comp or "INDRAPRASTHA GAS" in comp or "MAHANAGAR GAS" in comp or "ADANI TOTAL" in comp:
            return "Utility-Gas Distribution IN", "Oil Gas & Consumable Fuels"
        if sym in SOLAR_TICKERS or "SOLAR" in comp or "ADANI GREEN" in comp or "WAAREE" in comp:
            return "Energy-Solar IN", "Power"
        if sym in POWER_EQUIP_TICKERS or "SUZLON" in comp or "WIND" in comp or "BHEL" in comp or "GET&D" in comp:
            return "Electrical-Power/Equipmt IN", "Power"
        return "Energy-Alternative/Other IN", "Power"

    # 5. Healthcare
    if "HEALTHCARE" in ind or "PHARMACEUTICALS" in ind:
        if "CHEMICAL" in comp and "PHARM" not in comp:
            return "Chemicals-Specialty IN", "Specialty Chemicals"
        if sym in CDMO_TICKERS or "CDMO" in comp or "DIVI'S" in comp or "SYNGENE" in comp or "LAURUS" in comp:
            return "Medical-Biomed/Biotech IN", "Pharma"
        if sym in DIAGNOSTICS_TICKERS or "DIAGNOSTIC" in comp or "LAL PATH" in comp or "METROPOLIS" in comp:
            return "Medical-Services IN", "Hospitals & Healthcare"
        if sym in MEDICAL_DEVICES_TICKERS or "MEDICURE" in comp or "DEVICE" in comp:
            return "Medical-Products IN", "Hospitals & Healthcare"
        if "PHARMA" in comp or "LAB" in comp or "BIOTECH" in comp or "DRUG" in comp or "MEDICINE" in comp:
            return "Medical-Generic Drugs IN", "Pharma"
        return "Medical-Hospitals IN", "Hospitals & Healthcare"

    # 6. Auto
    if "AUTO" in ind or "VEHICLE" in ind:
        if sym in TYRES_TICKERS or "TYRE" in comp or "CEAT" in comp or "MRF" in comp:
            return "Auto/Truck-Tires &amp; Misc  IN", "Automobile and Auto Components"
        if sym in EV_COMPONENTS_TICKERS or "EV" in comp or "SONA BLW" in comp or "MINDA" in comp:
            return "Auto/Truck-Original Eqp IN", "Automobile and Auto Components"
        if sym in BATTERIES_TICKERS or "BATTERY" in comp or "EXIDE" in comp or "AMARA RAJA" in comp:
            return "Auto/Truck-Replace Parts IN", "Automobile and Auto Components"
        if sym in TRACTORS_TICKERS or "TRACTOR" in comp or "ESCORT" in comp:
            return "Machinery-Farm IN", "Automobile and Auto Components"
        if sym in COMMERCIAL_VEH_TICKERS or "ASHOK LEYLAND" in comp or "COMMERCIAL VEHICLE" in comp:
            return "Trucks &amp; Parts-Hvy Duty IN", "Automobile and Auto Components"
        return "Auto Manufacturers IN", "Automobile and Auto Components"

    # 7. Consumer
    if "CONSUMER" in ind or "RETAIL" in ind or "TEXTILES" in ind or "SERVICES" in ind:
        if sym in TEXTILES_TICKERS or "TEXTILE" in ind or "SPINNING" in comp or "WEAVING" in comp or "PAGE INDUSTRIES" in comp or "WELSPUN LIVING" in comp or "RAYMOND" in comp:
            return "Apparel-Clothing Mfg IN", "Textiles"
        if sym in RETAIL_TICKERS or "RETAIL" in ind or "TRENT" in comp or "AVENUE SUPERMARTS" in comp or "SHOPPERS STOP" in comp:
            if sym == 'TRENT':
                return "Retail-Department Stores IN", "Consumer Services"
            if sym == 'DMART':
                return "Retail-Super/Mini Mkts IN", "Consumer Services"
            return "Retail-Specialty IN", "Consumer Services"
        if sym in JEWELLERY_TICKERS or "JEWELLER" in comp or "TITAN" in comp or "GOLD" in comp:
            return "Retail/Whlsle-Jewelry IN", "Consumer Durables"
        if sym in FOOTWEAR_TICKERS or "FOOTWEAR" in comp or "BATA" in comp or "METRO BRAND" in comp or "RELAXO" in comp:
            return "Apparel-Shoes &amp; Rel Mfg IN", "Consumer Durables"
        if sym in RESTAURANTS_QSR_TICKERS or "RESTAURANT" in comp or "FOODWORKS" in comp or "DEVYANI" in comp or "WESTLIFE" in comp or "SAPPHIRE" in comp:
            return "Retail-Restaurants IN", "Consumer Services"

    # Emerging defaults
    if sym in AEROSPACE_DEFENCE_TICKERS or any(x in comp for x in ["AEROSPACE", "DEFENCE", "DEFENSE", "DYNAMICS"]):
        return "Aerospace/Defense IN", "Defense"
    if sym in EMS_TICKERS or any(x in comp for x in ["EMS", "DIXON", "KAYNES", "SYRMA", "AVALON"]):
        return "Electronic-Parts IN", "Capital Goods"
    if sym in DATA_CENTERS_TICKERS or "DATA CENTER" in comp or "NETWEB" in comp:
        return "Computer-Hardware/Perip IN", "Information Technology"
    
    # Defaults
    if "TELECOMMUNICATION" in ind:
        return "Telecom Svcs-Wireless IN", "Telecommunication"
    if "INFORMATION TECHNOLOGY" in ind:
        return "Computer-Tech Services IN", "Information Technology"
    if "CONSTRUCTION MATERIALS" in ind:
        return "Bldg-Cement/Concrt/Ag IN", "Construction Materials"
    if "CONSTRUCTION" in ind:
        return "Bldg-Heavy Construction IN", "Construction"
    if "REALTY" in ind:
        return "Real Estate Dvlpmt/Ops IN", "Realty"
    if "MEDIA" in ind or "PUBLICATION" in ind:
        return "Media-Radio/Tv IN", "Media Entertainment & Publication"
    
    # Direct raw industry defaults to valid MS industry group names
    raw_ind_map = {
        'FAST MOVING CONSUMER GOODS': ("Food-Packaged IN", "Fast Moving Consumer Goods"),
        'CONSUMER SERVICES': ("Retail-Specialty IN", "Consumer Services"),
        'CONSUMER DURABLES': ("Consumer Prod-Electronic IN", "Consumer Durables"),
        'SERVICES': ("Comml Svcs-Consulting IN", "Services"),
        'DIVERSIFIED': ("Diversified Operations IN", "Diversified"),
        'OIL GAS & CONSUMABLE FUELS': ("Oil&amp;Gas-Refining/Mktg IN", "Oil Gas & Consumable Fuels"),
        'POWER': ("Utility-Electric Power IN", "Power"),
        'TELECOMMUNICATION': ("Telecom Svcs-Wireless IN", "Telecommunication"),
        'INFORMATION TECHNOLOGY': ("Computer-Tech Services IN", "Information Technology"),
        'METALS & MINING': ("Mining-Metal Ores IN", "Metals & Mining"),
        'CHEMICALS': ("Chemicals-Basic IN", "Specialty Chemicals"),
        'HEALTHCARE': ("Medical-Generic Drugs IN", "Pharma"),
        'AUTOMOBILE AND AUTO COMPONENTS': ("Auto/Truck-Original Eqp IN", "Automobile and Auto Components"),
        'TEXTILES': ("Apparel-Clothing Mfg IN", "Textiles"),
        'REALTY': ("Real Estate Dvlpmt/Ops IN", "Realty"),
        'MEDIA ENTERTAINMENT & PUBLICATION': ("Media-Radio/Tv IN", "Media Entertainment & Publication"),
        'CONSTRUCTION MATERIALS': ("Bldg-Cement/Concrt/Ag IN", "Construction Materials"),
        'CONSTRUCTION': ("Bldg-Heavy Construction IN", "Construction")
    }
    
    if ind in raw_ind_map:
        return raw_ind_map[ind]
        
    return "Diversified Operations IN", "Diversified"


# ═══════════════════════════════════════════════════════════════════════
#  MAIN ANALYSIS FUNCTION
# ═══════════════════════════════════════════════════════════════════════

# ═══════════════════════════════════════════════════════════════════════
#  SWING TRADING ACTIONABILITY & RS NEW HIGH HELPERS
# ═══════════════════════════════════════════════════════════════════════
def calc_adr(df, period=20):
    """Average Daily Range % over the last `period` trading days."""
    if len(df) < period:
        return 0.0
    daily_range_pct = (df['High'] - df['Low']) / df['Close'] * 100
    return round(float(daily_range_pct.iloc[-period:].mean()), 2)

def calc_ud_volume_ratio(df, period=50):
    """O'Neil Up/Down Volume Ratio (50-day accumulation/distribution ratio)."""
    if len(df) < period + 1:
        return 1.0
    sub = df.iloc[-(period+1):]
    diff = sub['Close'].diff().iloc[1:]
    vol = sub['Volume'].iloc[1:]
    up_v = vol[diff > 0].sum()
    down_v = vol[diff < 0].sum()
    return round(float(up_v / down_v), 2) if down_v > 0 else (2.5 if up_v > 0 else 1.0)

def check_rs_new_high(df, bench_df):
    """
    O'Neil Leading Stock Indicator: Checks if Relative Strength (Stock / Benchmark)
    line is making a new 52-week high (or within 0.5% of 52W high).
    """
    if bench_df is None or len(bench_df) < 150 or len(df) < 150:
        return False
    try:
        s_c = df['Close'].copy()
        b_c = bench_df['Close'].copy()
        if hasattr(s_c.index, 'tz') and s_c.index.tz is not None:
            s_c.index = s_c.index.tz_localize(None)
        if hasattr(b_c.index, 'tz') and b_c.index.tz is not None:
            b_c.index = b_c.index.tz_localize(None)
        s_c.index = s_c.index.normalize()
        b_c.index = b_c.index.normalize()
        merged = pd.merge(s_c.rename('stock'), b_c.rename('bench'), left_index=True, right_index=True, how='inner')
        if len(merged) < 150:
            return False
        rs_line = merged['stock'] / merged['bench']
        rs_252_max = rs_line.iloc[-252:].max() if len(rs_line) >= 252 else rs_line.max()
        cur_rs = rs_line.iloc[-1]
        return bool(cur_rs >= rs_252_max * 0.995)
    except Exception:
        return False

def compute_market_regime(sector_stats, bench_df):
    """Calculates Top-Down Market Regime from universe breadth and benchmark moving averages."""
    total_stocks = sum(st['total'] for st in sector_stats.values())
    total_a50 = sum(st['a50'] for st in sector_stats.values())
    total_a200 = sum(st['a200'] for st in sector_stats.values())
    pct_a50 = round(total_a50 / total_stocks * 100, 1) if total_stocks > 0 else 0.0
    pct_a200 = round(total_a200 / total_stocks * 100, 1) if total_stocks > 0 else 0.0
    
    bench_close = bench_df['Close'].iloc[-1] if bench_df is not None and not bench_df.empty else 0
    bench_50sma = sma(bench_df['Close'], 50).iloc[-1] if bench_df is not None and len(bench_df) >= 50 else 0
    bench_200sma = sma(bench_df['Close'], 200).iloc[-1] if bench_df is not None and len(bench_df) >= 200 else 0
    bench_above_50 = bench_close > bench_50sma if bench_50sma > 0 else False
    
    if pct_a50 < 35 or (bench_close > 0 and not bench_above_50 and pct_a50 < 45):
        regime = "CORRECTION / HIGH RISK"
        color = "#f87171"
        bg = "rgba(248,113,113,0.12)"
        border = "rgba(248,113,113,0.35)"
        icon = "⚠️"
        headline = "Market in Correction / Distribution — Extreme Caution Advised"
        rules = "Breakout failure rate is high (~70-80%). Use setups for <b>WATCHLIST ONLY</b>. Do <u>NOT</u> initiate aggressive breakout purchases until Follow-Through Day (FTD) or Breadth recovers >45%."
    elif pct_a50 >= 55 and bench_above_50:
        regime = "CONFIRMED UPTREND / GREEN LIGHT"
        color = "#4ade80"
        bg = "rgba(74,222,128,0.12)"
        border = "rgba(74,222,128,0.35)"
        icon = "🟢"
        headline = "Market in Confirmed Uptrend — Full Aggressive Trading Mode"
        rules = "Healthy institutional breadth. Focus on Grade A+/A Potential Breakouts resting near pivot and VCP tight patterns with dry-up volume."
    else:
        regime = "UPTREND UNDER PRESSURE / CHOPPY"
        color = "#fbbf24"
        bg = "rgba(251,191,36,0.12)"
        border = "rgba(251,191,36,0.35)"
        icon = "🟡"
        headline = "Uptrend Under Pressure / Rotation — Selective Participation"
        rules = "Take only top-tier A+ setups; tighten initial stop-losses to 4-5%; take quick partial profits at +2R/+3R."

    return {
        'regime': regime,
        'pct_a50': pct_a50,
        'pct_a200': pct_a200,
        'color': color,
        'bg': bg,
        'border': border,
        'icon': icon,
        'headline': headline,
        'rules': rules
    }

def analyse(symbol, df, info, nse_comp, nse_ind):
    c = df['Close']
    
    # 1. Mandatory Liquidity Filter Gate
    liq_ok, avg_vol, avg_turn, mktcap = check_liquidity(df, info)
    if not liq_ok:
        return None, 'insufficient liquidity'

    # 2. Mandatory Minervini Trend Template Gate
    trend_pts, trend_passed, trend_total, trend_ok, trend_details, dist_52w_low = trend_template(df)
    if not trend_ok:
        return None, 'fails mandatory trend template'

    # 3. Prior Advance Gate
    r30, r60, r90, adv_pts, adv_ok = prior_advance(df)
    if not adv_ok:
        return None, '< min advance'

    # 4. 52-Week High Proximity Gate
    dist52, prox_pts, h52, l52, prox_ok = high_proximity(df)
    if not prox_ok:
        return None, 'too far from 52W high'

    # 5. Base Identification & Consolidation Gate
    drawdown, dd_pts, dd_ok, btype, base_info = consolidation(df)
    if not dd_ok:
        return None, 'drawdown too deep'
    if base_info['base_depth'] < CFG.get('max_base_depth', -35.0):
        return None, 'base too deep (>35%)'

    # 6. Volume Dry-Up & Breakout Activity
    vol_contr, vol_pts, dryup, rel_vol_pct, breakout_vol = volume_dryup(df)

    # 7. ATR Volatility Contraction
    atr_ratio, atr_pts, atr_ok = atr_contraction(df)

    # 8. Price Tightness (High-Low & Closing Spreads)
    tight_pct, tight_pts, tight_5d_c, tight_10d_c = tightness(df)

    # 9. Successive VCP Contractions within Active Base
    vcp_bonus, pullbacks, vcp_quality = vcp_pullbacks(df, base_info)
    
    # 10. Setup Conditions & Actionable Trade Levels
    pp = pocket_pivot(df)
    pot_bo, pivot_cand, _orig_dist_pivot = potential_bo(df, r60, r90, dist52, base_info)
    pb = pull_back_setup(df)

    cur_price = round(float(c.iloc[-1]), 2)

    # Base High / Pivot Buy Point calculation
    base_high = float(base_info.get('base_high', df['High'].iloc[-20:].max()))
    pivot = round(base_high, 2)
    # Check if a tighter handle / cheat pivot exists in upper third of base
    if len(df) >= 15 and base_high > 0:
        recent_10 = df['High'].iloc[-10:-1] if len(df) >= 12 else df['High'].iloc[-10:]
        handle_high = float(recent_10.max())
        if 0.88 * base_high <= handle_high < 0.995 * base_high:
            pivot = round(handle_high, 2)

    dist_pivot = round((cur_price - pivot) / pivot * 100, 1) if pivot > 0 else 0.0
    max_buy = round(pivot * 1.05, 2) if pivot > 0 else 0.0

    # Stop Loss calculation (Handle Low / 10d Low or 20EMA with 4% to 7.5% Minervini guardrails)
    low_10 = float(df['Low'].iloc[-10:].min()) if len(df) >= 10 else cur_price * 0.95
    e20_val = float(ema(c, 20).iloc[-1])
    stop_cand = max(low_10, e20_val)
    if stop_cand >= cur_price:
        stop_loss = round(cur_price * 0.95, 2)
    elif stop_cand < cur_price * 0.925:
        stop_loss = round(cur_price * 0.93, 2)
    elif stop_cand > cur_price * 0.96:
        stop_loss = round(cur_price * 0.95, 2)
    else:
        stop_loss = round(stop_cand, 2)
    stop_risk = round((cur_price - stop_loss) / cur_price * 100, 1) if cur_price > 0 else 0.0

    # ADR% and Up/Down Volume Ratio
    adr_pct = calc_adr(df, 20)
    ud_vol = calc_ud_volume_ratio(df, 50)

    # RS Line 52-Week New High Check
    rs_new_high = check_rs_new_high(df, BENCHMARK_HISTORY)
    
    # 11. Relative Strength vs Benchmark
    rs_comp, rs63, rs126, rs252 = rs_proxy_raw(df, BENCHMARK_HISTORY)

    # 12. VCP Score (Capped 0 - 100)
    vcp_s = vcp_score(adv_pts, dd_pts, vol_pts, atr_pts, tight_pts) + vcp_bonus
    vcp_s = min(100, max(0, vcp_s))

    # 13. Primary Setup Classification Hierarchy:
    # 1. Breakout-ready (Potential BO)
    # 2. Mature VCP
    # 3. Developing VCP
    # 4. Early VCP
    # 5. Pull Back
    # 6. Pocket Pivot
    # 7. Contraction
    # 8. Watch
    if pot_bo:
        stype = '🔮 Potential BO'
    elif (len(pullbacks) >= 3 and 'Textbook' in vcp_quality) or (base_info['base_drawdown'] >= -12 and tight_5d_c <= 4.0 and dryup and base_info['upper_half']):
        stype = '🎯 Mature VCP'
    elif len(pullbacks) >= 2 or (base_info['base_drawdown'] >= -16 and (dryup or atr_ok)):
        stype = '🌱 Developing VCP'
    elif base_info['base_drawdown'] >= -6.0:
        stype = '🌾 Early VCP'
    elif pb:
        stype = '🧲 Pull Back'
    elif pp:
        stype = '⚡ Pocket Pivot'
    elif atr_ratio < 0.80:
        stype = '📐 Contraction'
    else:
        stype = '👀 Watch'

    return {
        'symbol':               symbol,
        'company':              nse_comp,
        'sector':               nse_ind,
        'market_cap':           mktcap,
        'current':              round(c.iloc[-1], 2),
        'h52':                  h52,
        'l52':                  l52,
        'avg_vol':              avg_vol,
        'avg_turn':             avg_turn,
        'r30':                  r30,
        'r60':                  r60,
        'r90':                  r90,
        'dist52':               dist52,
        'dist_52w_low':         dist_52w_low,
        'drawdown':             drawdown,
        'base_type':            btype,
        'base_depth':           base_info['base_depth'],
        'base_pos':             base_info['base_position'],
        'pivot':                pivot,
        'dist_pivot':           dist_pivot,
        'max_buy':              max_buy,
        'stop_loss':            stop_loss,
        'stop_risk':            stop_risk,
        'adr_pct':              adr_pct,
        'ud_vol':               ud_vol,
        'rs_new_high':          rs_new_high,
        'vol_contr':            vol_contr,
        'rel_vol':              rel_vol_pct,
        'atr_ratio':            atr_ratio,
        'tight_pct':            tight_pct,
        'tight_5d_c':           tight_5d_c,
        'tight_10d_c':          tight_10d_c,
        'trend_passed':         f'{trend_passed}/{trend_total}',
        'trend_details':        trend_details,
        'pullbacks':            ' → '.join(str(p)+'%' for p in pullbacks) or '—',
        'vcp_quality':          vcp_quality,
        'pocket_pivot':         '✅ YES' if pp else '—',
        'pot_bo':               '✅ YES' if pot_bo else '—',
        'pull_back':            '✅ YES' if pb else '—',
        'vcp_score':            vcp_s,
        'lead_score':           0,
        'rs_proxy_percentile':  0,
        'rs_score':             0,
        'final_score':          0,
        'grade':                '—',
        'setup':                stype,
        'adv_pts':              adv_pts,
        'prox_pts':             prox_pts,
        'trend_pts':            trend_pts,
        'avg_turn_liq':         avg_turn,
        '_rs_composite':        rs_comp,
    }, None

# ═══════════════════════════════════════════════════════════════════════
#  MAIN
# ═══════════════════════════════════════════════════════════════════════
def main():
    interrupter = GracefulInterruptHandler()

    print('\n╔══════════════════════════════════════════════════════════════╗')
    print('║  VCP SCANNER  v3.2  —  Minervini · O\'Neil · Stage-2        ║')
    print('╚══════════════════════════════════════════════════════════════╝\n')
    
    # 1. Load the NSE CSV dynamically
    try:
        dir_path = Path(__file__).resolve().parent
        csv_path1 = dir_path / 'ind_nifty500list.csv'
        csv_path2 = dir_path / 'ind_niftymidsmallcap400list.csv'
        
        nse_df1 = pd.read_csv(csv_path1)
        nse_df2 = pd.read_csv(csv_path2)
        
        # Clean symbols and combine
        nse_df1['Symbol'] = nse_df1['Symbol'].astype(str).str.strip()
        nse_df2['Symbol'] = nse_df2['Symbol'].astype(str).str.strip()
        
        nse_df = pd.concat([nse_df1, nse_df2], ignore_index=True)
        nse_df = nse_df.drop_duplicates(subset=['Symbol'])
        
        nse_map = nse_df.set_index('Symbol').to_dict('index')
        symbols_to_scan = list(nse_map.keys())
        print(f"✅ Successfully loaded {len(nse_df1)} symbols from ind_nifty500list.csv")
        print(f"✅ Successfully loaded {len(nse_df2)} symbols from ind_niftymidsmallcap400list.csv")
        print(f"✅ Merged unique universe: {len(symbols_to_scan)} symbols to scan")
    except Exception as e:
        print(f"❌ Error loading stock list CSVs. Ensure ind_nifty500list.csv and ind_niftymidsmallcap400list.csv are placed in the exact same folder as this script.")
        print(f"Details: {e}")
        sys.exit(1)

    print('\n💡 TIP: Press Ctrl+C at any time to instantly stop scanning and generate')
    print('the output HTML files for the stocks processed up to that point.\n')

    total     = len(symbols_to_scan)
    results   = []
    errors    = 0
    rejects   = 0
    scan_time = datetime.now().strftime('%d %b %Y  %I:%M %p')
    
    sector_stats = {}
    industry_stats = {}

    # Local Caching Setup for 10x Scan Speed
    cache_file = dir_path / 'vcp_stock_cache.pkl'
    today_str = datetime.now().strftime('%Y-%m-%d')
    force_refresh = ('--refresh' in sys.argv or '--force-refresh' in sys.argv)
    
    global BULK_STOCK_DATA, BENCHMARK_HISTORY
    BULK_STOCK_DATA = {}
    BENCHMARK_HISTORY = None
    
    cache_loaded = False
    if not force_refresh and cache_file.exists():
        try:
            with open(cache_file, 'rb') as cf:
                cache_obj = pickle.load(cf)
            if isinstance(cache_obj, dict):
                c_date = cache_obj.get('date', '')
                c_stocks = cache_obj.get('stocks', {})
                c_bench = cache_obj.get('benchmark', None)
                if c_date == today_str and len(c_stocks) >= 100:
                    BULK_STOCK_DATA = c_stocks
                    BENCHMARK_HISTORY = c_bench
                    cache_loaded = True
                    print(f"⚡ [Fast Cache] Loaded {len(BULK_STOCK_DATA)} stocks from today's cache ({today_str}). Zero network download needed!\n")
        except Exception as ce:
            print(f"⚠️ Cache read note: {ce}. Will proceed with fresh download.")

    if not cache_loaded:
        print(f'⚡ Bulk downloading price data for {total} NSE stocks in parallel via Yahoo Finance...')
        clean_symbols = [s for s in symbols_to_scan if isinstance(s, str) and s.strip() and not s.startswith('DUMMY')]
        yf_tickers = [s + '.NS' for s in clean_symbols]
        end_dt = datetime.now()
        start_dt = end_dt - timedelta(days=400)
        
        try:
            chunk_size = 150
            for c_idx in range(0, len(yf_tickers), chunk_size):
                chunk_tickers = yf_tickers[c_idx:c_idx + chunk_size]
                b_df = yf.download(chunk_tickers, start=start_dt, end=end_dt, group_by='ticker', threads=True, progress=False)
                if b_df is not None and not b_df.empty:
                    if isinstance(b_df.columns, pd.MultiIndex):
                        for t_str in chunk_tickers:
                            if t_str in b_df.columns.levels[0]:
                                s_df = b_df[t_str].dropna(subset=['Close'])
                                if len(s_df) >= 252:
                                    sym_clean = t_str.replace('.NS', '')
                                    BULK_STOCK_DATA[sym_clean] = s_df[['Open','High','Low','Close','Volume']].dropna()
                    else:
                        if len(b_df) >= 252:
                            sym_clean = chunk_tickers[0].replace('.NS', '')
                            BULK_STOCK_DATA[sym_clean] = b_df[['Open','High','Low','Close','Volume']].dropna()
            print(f"✅ Bulk download complete! Cached {len(BULK_STOCK_DATA)} stocks in memory.\n")
        except Exception as b_err:
            print(f"⚠️ Bulk download warning: {b_err}. Falling back to individual fetching.\n")

        print(f'⚡ Fetching benchmark data (Nifty 500 / Nifty 50) for relative strength calculation...')
        try:
            b_df = yf.download('^CRSLDX', start=start_dt, end=end_dt, progress=False)
            if b_df is None or b_df.empty or len(b_df) < 150:
                b_df = yf.download('^NSEI', start=start_dt, end=end_dt, progress=False)
            if isinstance(b_df.columns, pd.MultiIndex):
                b_df.columns = b_df.columns.get_level_values(0)
            BENCHMARK_HISTORY = b_df[['Close']].dropna()
            if BENCHMARK_HISTORY is not None and not BENCHMARK_HISTORY.empty:
                print(f"✅ Benchmark data loaded: {len(BENCHMARK_HISTORY)} sessions.\n")
        except Exception as b_err:
            print(f"⚠️ Benchmark fetch warning: {b_err}. Falling back to unadjusted returns.\n")
            
        # Save cache for today
        if len(BULK_STOCK_DATA) >= 50:
            try:
                with open(cache_file, 'wb') as cf:
                    pickle.dump({'date': today_str, 'stocks': BULK_STOCK_DATA, 'benchmark': BENCHMARK_HISTORY}, cf)
                print(f"💾 Saved local price cache to {cache_file.name} for instant repeat scans.\n")
            except Exception as se:
                print(f"⚠️ Cache save warning: {se}")

    all_universe_composites = []
    all_universe_rs_map = {}
    print(f'Scanning {total} NSE stocks via Yahoo Finance...\n')

    for i, sym in enumerate(symbols_to_scan, 1):
        if interrupter.interrupted:
            print(f'\nProceeding to generate report with the {len(results)} valid stocks found so far...\n')
            break

        try:
            # Look up specific NSE data from the CSV map
            nse_info = nse_map.get(sym, {})
            nse_ind  = nse_info.get('Industry', 'Unknown')
            nse_ind_raw = nse_ind  # preserved BEFORE the theme overrides below —
                                    # get_industry_group()'s substring matching is
                                    # built against NSE's raw taxonomy, not our
                                    # display-friendly Sector-tab labels.
            nse_comp = nse_info.get('Company Name', sym)

            df, info = fetch_data(sym)
            if df is None:
                print(f'  [{i:3d}/{total}] {sym:<15} — skip (no data)')
                continue

            # Record relative performance composite for universe percentile ranking
            try:
                u_comp, _, _, _ = rs_proxy_raw(df, BENCHMARK_HISTORY)
                all_universe_composites.append(u_comp)
                all_universe_rs_map[sym.upper()] = u_comp
            except Exception:
                pass

            # Get the exact Industry Group and Parent Sector from CSV/Heuristics
            industry_group, parent_sector = get_industry_group(sym, nse_comp, nse_ind_raw)

            # Apply custom theme overrides
            comp_lower = nse_comp.lower()
            railway_tickers = {'IRFC', 'IRCTC', 'RVNL', 'IRCON', 'RITES', 'TITAGARH', 'TEXMACO', 'RAILTEL', 'JWL'}
            if sym in railway_tickers or 'railway' in comp_lower:
                industry_group, parent_sector = 'Railways', 'Railways'
            elif sym in {'MAZDOCK', 'COCHINSHIP', 'GRSE'}:
                parent_sector = 'Defense'

            # Ensure sector and parent sector are exactly aligned
            nse_ind = parent_sector

            if nse_ind not in sector_stats:
                sector_stats[nse_ind] = {'total': 0, 'vcp': 0, 'a20': 0, 'a50': 0, 'a200': 0}
            if industry_group not in industry_stats:
                industry_stats[industry_group] = {'total': 0, 'vcp': 0, 'a20': 0, 'a50': 0, 'a200': 0, 'parent': parent_sector}

            # Safely capture Universe MAs before filtering
            c = df['Close']
            c0 = c.iloc[-1]
            e20 = ema(c, 20).iloc[-1]
            s50 = sma(c, 50).iloc[-1]
            s200 = sma(c, 200).iloc[-1]

            sector_stats[nse_ind]['total'] += 1
            if c0 > e20: sector_stats[nse_ind]['a20'] += 1
            if c0 > s50: sector_stats[nse_ind]['a50'] += 1
            if c0 > s200: sector_stats[nse_ind]['a200'] += 1

            industry_stats[industry_group]['total'] += 1
            if c0 > e20: industry_stats[industry_group]['a20'] += 1
            if c0 > s50: industry_stats[industry_group]['a50'] += 1
            if c0 > s200: industry_stats[industry_group]['a200'] += 1

            # Pass SMART NSE mappings directly to the analysis engine
            result, reason = analyse(sym, df, info, nse_comp, nse_ind)

            if result is None:
                rejects += 1
                print(f'  [{i:3d}/{total}] {sym:<15} — ✗ {reason}')
                continue

            result['industry_group'] = industry_group
            result['parent_sector'] = parent_sector
            results.append(result)
            sector_stats[nse_ind]['vcp'] += 1
            industry_stats[industry_group]['vcp'] += 1
            
            print(f'  [{i:3d}/{total}] {sym:<15} — vcp:{result["vcp_score"]:3.0f}'
                  f'  adv:{result["r90"]:+.0f}%'
                  f'  dd:{result["drawdown"]:+.0f}%'
                  f'  atr:{result["atr_ratio"]:.2f}'
                  f'  tight:{result["tight_pct"]:.1f}%'
                  f'  {result["setup"]}')

            if sym not in BULK_STOCK_DATA:
                time.sleep(CFG['delay_between_stocks'])

        except Exception as e:
            errors += 1
            print(f'  [{i:3d}/{total}] {sym:<15} — ERROR: {e}')
            continue

    if not results:
        print("\n❌ No stocks were fully processed to generate a report. Exiting.")
        sys.exit(0)

    print(f'\n═══ Computing RS Scores & Final Rankings ═══')

    results = compute_rs_scores(results, all_universe_composites)

    rs_map = {}
    if all_universe_composites:
        import bisect
        sorted_comps = sorted(all_universe_composites)
        n_univ = len(sorted_comps)
        for u_sym, u_val in all_universe_rs_map.items():
            rank = bisect.bisect_right(sorted_comps, u_val)
            pct = int(round((rank / n_univ) * 98.0)) + 1 if n_univ > 1 else 99
            rs_map[u_sym] = min(99, max(1, pct))

    for r in results:
        r['rs_score']   = r.get('rs_score', 0)
        r['lead_score'] = leadership_score(r['prox_pts'], r['trend_pts'],
                                            r['rs_score'], r['avg_turn_liq'])
        r['final_score'] = composite_score(r['vcp_score'], r['lead_score'])
        r['grade']       = grade(r['final_score'])

    results.sort(key=lambda x: -x['final_score'])

    elite = [r for r in results if r['grade'] in ('A+','A')]
    pot_bos = [r for r in results if '✅' in r.get('pot_bo', '')]

    print(f'\n╔══════════════════════════════════════════════════════════════╗')
    print(f'║  SCAN COMPLETE                                               ║')
    print(f'║  Qualified:{len(results):4d}  |  Elite:{len(elite):3d}  |  Rejected:{rejects:4d}  |  Errors:{errors:3d}  ║')
    print(f'╚══════════════════════════════════════════════════════════════╝\n')

    if elite:
        print('🏆 ELITE (A+/A):')
        for r in elite[:20]:
            print(f'   {r["symbol"]:<14} score:{r["final_score"]:5.1f}  '
                  f'grade:{r["grade"]}  vcp:{r["vcp_score"]:4.0f}  '
                  f'rs:{r["rs_score"]:4.0f}  {r["setup"]}')
                  
    if pot_bos:
        print(f'\n🔮 POTENTIAL BREAKOUTS ({len(pot_bos)}):')
        for r in pot_bos[:10]:
            print(f'   {r["symbol"]:<14} score:{r["final_score"]:5.1f}')

    out_dir  = Path(__file__).resolve().parent

    # Output sector_breadth.json and sector_stocks.json
    print(f'Generating JSON sidecars...')
    import json
    
    # 1. sector_breadth.json
    sectors_arr = []
    for sec, st in sector_stats.items():
        if st['total'] == 0: continue
        sectors_arr.append({
            'sector': sec,
            'universe': st['total'],
            'vcp_count': st['vcp'],
            'a20_pct': int((st['a20'] / st['total']) * 100),
            'a50_pct': int((st['a50'] / st['total']) * 100),
            'a200_pct': int((st['a200'] / st['total']) * 100)
        })
    
    industries_arr = []
    for ind, st in industry_stats.items():
        if st['total'] == 0: continue
        industries_arr.append({
            'sector': ind,   # Named 'sector' for table renderer mapping compatibility
            'universe': st['total'],
            'vcp_count': st['vcp'],
            'a20_pct': int((st['a20'] / st['total']) * 100),
            'a50_pct': int((st['a50'] / st['total']) * 100),
            'a200_pct': int((st['a200'] / st['total']) * 100),
            'parent_sector': st['parent']
        })
        
    # Load previous history if exists
    prev_history = []
    try:
        with open(out_dir / 'sector_breadth.json', 'r', encoding='utf-8') as jf:
            prev_data = json.load(jf)
            if 'history' in prev_data and isinstance(prev_data['history'], list):
                prev_history = prev_data['history']
    except Exception:
        pass

    # Today's snapshot entry
    today_str = datetime.now().strftime('%Y-%m-%d')
    new_history_entry = {
        'date': today_str,
        'sectors': {},
        'industries': {}
    }
    
    for sec, st in sector_stats.items():
        if st['total'] == 0: continue
        new_history_entry['sectors'][sec] = {
            'universe': st['total'],
            'vcp_count': st['vcp'],
            'a20_pct': int((st['a20'] / st['total']) * 100),
            'a50_pct': int((st['a50'] / st['total']) * 100),
            'a200_pct': int((st['a200'] / st['total']) * 100)
        }
        
    for ind, st in industry_stats.items():
        if st['total'] == 0: continue
        new_history_entry['industries'][ind] = {
            'universe': st['total'],
            'vcp_count': st['vcp'],
            'a20_pct': int((st['a20'] / st['total']) * 100),
            'a50_pct': int((st['a50'] / st['total']) * 100),
            'a200_pct': int((st['a200'] / st['total']) * 100),
            'parent_sector': st['parent']
        }

    # Filter out today's old record if running multiple times today
    prev_history = [h for h in prev_history if h.get('date') != today_str]
    prev_history.append(new_history_entry)
    prev_history.sort(key=lambda x: x.get('date', ''))
    prev_history = prev_history[-60:]

    breadth_data = {
        'scan_date': today_str,
        'scan_time': scan_time,
        'total_scanned': total,
        'sectors': sectors_arr,
        'industries': industries_arr,
        'history': prev_history
    }
    
    try:
        with open(out_dir / 'sector_breadth.json', 'w', encoding='utf-8') as jf:
            json.dump(breadth_data, jf, indent=2)
        print(f'✅ JSON saved: {out_dir / "sector_breadth.json"}')
    except Exception as je:
        print(f'❌ Error writing sector_breadth.json: {je}')

    # 2. sector_stocks.json
    def serialize_stock(r):
        return {
            'symbol': r['symbol'],
            'company': r['company'],
            'price': r['current'],
            'mktcap': r['market_cap'],
            'pivot': r.get('pivot', 0.0),
            'dist_pivot': r.get('dist_pivot', 0.0),
            'max_buy': r.get('max_buy', 0.0),
            'stop_loss': r.get('stop_loss', 0.0),
            'stop_risk': r.get('stop_risk', 0.0),
            'adr_pct': r.get('adr_pct', 0.0),
            'ud_vol': r.get('ud_vol', 1.0),
            'rs_new_high': r.get('rs_new_high', False),
            'r30': r['r30'],
            'r60': r['r60'],
            'r90': r['r90'],
            'dist52': r['dist52'],
            'drawdown': r['drawdown'],
            'setup': r['setup'],
            'final_score': r['final_score'],
            'vcp_score': r['vcp_score'],
            'grade': r['grade'],
            'rs_rating': r['rs_score']
        }

    sectors_stocks_map = {}
    for sec in sector_stats.keys():
        sec_stocks = [serialize_stock(r) for r in results if r['sector'] == sec]
        sectors_stocks_map[sec] = {
            'universe': sector_stats[sec]['total'],
            'vcp_count': sector_stats[sec]['vcp'],
            'scan_time': scan_time,
            'stocks': sec_stocks
        }

    industries_stocks_map = {}
    for ind in industry_stats.keys():
        ind_stocks = [serialize_stock(r) for r in results if r['industry_group'] == ind]
        industries_stocks_map[ind] = {
            'universe': industry_stats[ind]['total'],
            'vcp_count': industry_stats[ind]['vcp'],
            'scan_time': scan_time,
            'stocks': ind_stocks
        }

    stocks_data = {
        'scan_date': datetime.now().strftime('%Y-%m-%d'),
        'scan_time': scan_time,
        'sectors': sectors_stocks_map,
        'industries': industries_stocks_map,
        'rs_map': rs_map
    }

    try:
        with open(out_dir / 'sector_stocks.json', 'w', encoding='utf-8') as jf:
            json.dump(stocks_data, jf, indent=2)
        print(f'✅ JSON saved: {out_dir / "sector_stocks.json"}')
    except Exception as je:
        print(f'❌ Error writing sector_stocks.json: {je}')


if __name__ == '__main__':
    main()