// Shared LightweightCharts renderer for Chart Studio (index.html), Sector Command (sectors.html), and Screener Split Chart (screener.html).

(function (global) {
  'use strict';

  const WIN_CORE_DEFAULTS = {
    inputs: {
      ema1Period: 10,
      ema2Period: 20,
      sma1Period: 50,
      sma2Period: 200,
      sma30wPeriod: 30,
      volLen: 50,
      vtLookback: 25,
      vtRows: 30,
      vtHvnPct: 60,
      vtLvnPct: 40,
      purpleRoc: 5.0,
      purpleVol: 1000000,
      vcpRangePct: 2.0,
      powerPocketVolMult: 1.5,
    },
    style: {
      ema10: { visible: true, color: '#3b82f6', opacity: 85, width: 1, lineStyle: 0 },
      ema20: { visible: true, color: '#ef4444', opacity: 85, width: 1, lineStyle: 0 },
      sma50: { visible: true, color: '#06b6d4', opacity: 85, width: 1, lineStyle: 0 },
      sma200: { visible: true, color: '#22c55e', opacity: 85, width: 1.5, lineStyle: 0 },
      sma30w: { visible: true, color: '#f97316', opacity: 85, width: 1, lineStyle: 0 },
      rs: { visible: true, color: '#38bdf8', opacity: 100, width: 1.4, lineStyle: 0 },
      dots: { visible: true },
      vt: { visible: true, color: '#4863fc', opacity: 100, width: 1.2, lineStyle: 2 },
      purpleDot: { visible: true, color: '#d203f7' },
      vcp: { visible: true, color: '#ffffff' },
      powerPocket: { visible: true, color: '#94a3b8' },
    },
  };

  function _ccHexToRgba(hex, opacity) {
    if (typeof global.hexToRgba === 'function') return global.hexToRgba(hex, opacity);
    if (!hex) return hex;
    if (hex.startsWith('rgba') || hex.startsWith('rgb')) return hex;
    const clean = hex.replace('#', '');
    let r = 0, g = 0, b = 0;
    if (clean.length === 3) {
      r = parseInt(clean[0] + clean[0], 16);
      g = parseInt(clean[1] + clean[1], 16);
      b = parseInt(clean[2] + clean[2], 16);
    } else if (clean.length >= 6) {
      r = parseInt(clean.substring(0, 2), 16);
      g = parseInt(clean.substring(2, 4), 16);
      b = parseInt(clean.substring(4, 6), 16);
    }
    const a = opacity != null ? opacity : 1;
    return `rgba(${r}, ${g}, ${b}, ${a})`;
  }

  // ── LightweightCharts v5 adapter ──────────────────────────────────────────────
// v5 dropped the `chart.addCandlestickSeries()`-style factories and `series.setMarkers()`
// in favour of `chart.addSeries(CandlestickSeries, opts)` and the `createSeriesMarkers`
// plugin. Everything in this repo now goes through these helpers so a future major
// bump is a single-file change.
function lwGlobal() {
  if (typeof window !== 'undefined' && window.LightweightCharts) return window.LightweightCharts;
  if (typeof LightweightCharts !== 'undefined') return LightweightCharts;
  return null;
}

function lwAddSeries(chart, kind, options) {
  const LW = lwGlobal();
  if (LW && LW[kind] && typeof chart.addSeries === 'function') return chart.addSeries(LW[kind], options);
  const legacy = {
    CandlestickSeries: 'addCandlestickSeries',
    BarSeries: 'addBarSeries',
    LineSeries: 'addLineSeries',
    AreaSeries: 'addAreaSeries',
    HistogramSeries: 'addHistogramSeries',
  }[kind];
  if (legacy && typeof chart[legacy] === 'function') return chart[legacy](options);
  throw new Error('LightweightCharts: cannot create a ' + kind + ' series with this version');
}

function lwSetMarkers(series, markers) {
  if (!series) return;
  if (typeof series.setMarkers === 'function') { series.setMarkers(markers); return; }
  const LW = lwGlobal();
  if (!LW || typeof LW.createSeriesMarkers !== 'function') return;
  // Created once per series and then reused; recreating the plugin stacks handlers.
  if (!series.__lwMarkers) series.__lwMarkers = LW.createSeriesMarkers(series, markers || []);
  else series.__lwMarkers.setMarkers(markers || []);
}

function lwVersion() {
  const LW = lwGlobal();
  return LW && typeof LW.version === 'function' ? String(LW.version()) : 'unknown';
}

// ══════════════════════════════════════════════════════════════════════════════
// Earnings pane — quarterly EPS / Sales growth plotted under the price.
//
// The HUD already lists these numbers as text, but text cannot show *sequence*:
// whether growth is accelerating or rolling over, and whether that lines up with
// the price setup. This puts the same numbers on a time axis shared with the
// candles, so a quarterly print sits under the price action that followed it.
//
// Only the WIN indicator uses this; it is deliberately not a general indicator
// library. Quarterly figures are sparse, so the pane is a few grouped bars, not
// a continuous line.
// ══════════════════════════════════════════════════════════════════════════════

const EARNINGS_PANE_KEY = 'earnings';

function earningsPaneStore() {
  const g = (typeof window !== 'undefined' ? window : globalThis);
  if (!g.__lwEarningsPanes) g.__lwEarningsPanes = Object.create(null);
  return g.__lwEarningsPanes;
}

function lwChartSupportsPanes(chart) {
  return !!chart && typeof chart.addPane === 'function' && typeof chart.removePane === 'function';
}

const EARNINGS_MONTHS = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };

/**
 * Parse a report label like "Sep-26" / "Mar-25 (H)" into a UTC timestamp at the
 * midpoint of that month. Returns null for anything unrecognisable rather than
 * guessing — a wrong quarter placed on the chart is worse than a missing one.
 */
function earningsQuarterTime(label) {
  if (!label || typeof label !== 'string') return null;
  // The negative lookahead matters: without it "Sep-2026" matches as "Sep-20"
  // and silently lands six years early.
  const m = label.match(/([A-Z][a-z]{2})-(\d{2})(?!\d)/);
  if (!m || !(m[1] in EARNINGS_MONTHS)) return null;
  const month = EARNINGS_MONTHS[m[1]];
  const year = 2000 + parseInt(m[2], 10);
  // Mid-month keeps the print clear of the month boundary in either direction.
  return Math.floor(Date.UTC(year, month, 15) / 1000);
}

/**
 * Turn quarterly rows into chart values, one bucket per recognised quarter.
 * `qData` is the shape getStockQuarterlyData() already returns (newest first).
 * Buckets are clamped into the candle range: a quarter newer than the last
 * candle would otherwise stretch the shared time axis and leave the price pane
 * floating with empty space to its right.
 */
function buildEarningsBuckets(candles, qData) {
  if (!candles || !candles.length || !Array.isArray(qData) || !qData.length) return [];
  const firstTs = candles[0].time;
  const lastTs = candles[candles.length - 1].time;
  const out = [];
  const seen = Object.create(null);
  for (const q of qData) {
    if (!q) continue;
    const ts = earningsQuarterTime(q.qtr || q.date);
    if (ts == null) continue;
    const clamped = Math.min(Math.max(ts, firstTs), lastTs);
    if (seen[clamped]) continue;
    seen[clamped] = true;
    const rawEps = q.eps_growth != null ? q.eps_growth : (q.epsPct != null ? q.epsPct : q.eps_pct);
    const rawSales = q.sales_growth != null ? q.sales_growth : (q.salesPct != null ? q.salesPct : q.sales_pct);
    const eps = (rawEps != null && isFinite(rawEps)) ? Number(rawEps) : null;
    const sales = (rawSales != null && isFinite(rawSales)) ? Number(rawSales) : null;
    if (eps == null && sales == null) continue;
    out.push({ time: clamped, label: q.qtr || q.date || '', eps: eps, sales: sales });
  }
  out.sort((a, b) => a.time - b.time);
  return out;
}

/**
 * Draw the earnings pane for a chart that already has its price series.
 * Returns the pane descriptor, or null when there is nothing to draw.
 *
 * Bars are EPS YoY growth; Sales YoY growth rides on the same % axis as a line.
 * Both are percentages, so they share one scale and stay directly comparable.
 */
function applyEarningsPane(chart, storeId, candles, qData, opts) {
  if (!chart || !lwChartSupportsPanes(chart)) return null;
  const LW = lwGlobal();
  if (!LW) return null;

  storeId = storeId || 'default';
  // A chart must never accumulate earnings panes. Clearing only the requested
  // key would let a second caller (or a changed key) stack another pane on the
  // same chart, which no caller wants and which shifts every later pane index.
  clearEarningsPane(chart);
  clearEarningsPane(chart, storeId);

  const buckets = buildEarningsBuckets(candles, qData);
  if (!buckets.length) return null;

  const settings = opts || {};
  const upColor = settings.upColor || '#26a69a';
  const downColor = settings.downColor || '#ef5350';
  const salesColor = settings.salesColor || '#f59e0b';

  // Growth from a small base is routine here — 10% of the stored EPS prints are
  // over +200% (max +109,634%) and one is -1,036,590%. Drawn to scale, a single
  // print like that flattens every other bar to nothing. So the pane clamps to
  // +/-cap and paints clamped bars in a muted shade: an off-the-scale quarter is
  // then visible *as* off-the-scale rather than looking like a middling one.
  // The exact figure stays in the HUD table, which is the precise readout.
  const cap = Math.max(10, Math.round(settings.cap || 100));
  const clamp = v => v == null ? null : Math.max(-cap, Math.min(cap, v));
  const isClipped = v => v != null && Math.abs(v) > cap;
  const mutedUp = settings.mutedUpColor || 'rgba(38,166,154,0.38)';
  const mutedDown = settings.mutedDownColor || 'rgba(239,83,80,0.38)';

  const pane = chart.addPane();
  const created = { pane: pane, chart: chart, series: [], buckets: buckets };

  const barSeries = pane.addSeries(LW.HistogramSeries, {
    priceLineVisible: false,
    lastValueVisible: true,
    priceFormat: { type: 'custom', formatter: v => (v >= 0 ? '+' : '') + v.toFixed(0) + '%' },
    // A quarter is one narrow bar; the price bars either side stay untouched.
    base: 0,
  });
  const epsPlot = buckets.filter(b => b.eps != null).map(b => ({
    time: b.time,
    value: clamp(b.eps),
    color: isClipped(b.eps)
      ? (b.eps >= 0 ? mutedUp : mutedDown)
      : (b.eps >= 0 ? upColor : downColor),
  }));
  barSeries.setData(epsPlot);

  const lineSeries = pane.addSeries(LW.LineSeries, {
    color: salesColor,
    lineWidth: 1.4,
    priceLineVisible: false,
    lastValueVisible: true,
    crosshairMarkerVisible: true,
    priceFormat: { type: 'custom', formatter: v => (v >= 0 ? '+' : '') + v.toFixed(0) + '%' },
  });
  const salesPlot = buckets.filter(b => b.sales != null).map(b => ({ time: b.time, value: clamp(b.sales) }));
  lineSeries.setData(salesPlot);

  // Zero is the meaningful reference here: growth above vs below.
  try {
    barSeries.createPriceLine({
      price: 0,
      color: 'rgba(148,163,184,0.55)',
      lineWidth: 1,
      lineStyle: 2,
      axisLabelVisible: false,
      title: '',
    });
  } catch (e) { }

  try {
    const ps = pane.priceScale('right');
    ps.applyOptions({
      autoScale: false,
      scaleMargins: { top: 0.12, bottom: 0.12 },
      entireTextOnly: true,
    });
    // Pin the axis so the cap is stable frame to frame; a bar that hits the top
    // edge means "beyond cap", which is exactly what the muted colour signals.
    if (typeof ps.setVisibleRange === 'function') {
      const padded = cap * 1.15;
      ps.setVisibleRange({ from: -padded, to: padded });
    }
  } catch (e) { }

  try { pane.setStretchFactor(700); } catch (e) { }
  // Same trap as any v5 pane: an orphaned empty pane survives its series.
  try { pane.setPreserveEmptyPane(false); } catch (e) { }

  created.series = [barSeries, lineSeries];
  created.barSeries = barSeries;
  created.lineSeries = lineSeries;
  created.cap = cap;
  created.clipped = buckets.filter(b => isClipped(b.eps) || isClipped(b.sales)).length;
  // The values handed to the chart, after clamping — the test asserts on these,
  // because asserting on the raw data would pass while the chart drew out of range.
  created.plot = { eps: epsPlot, sales: salesPlot };

  const store = earningsPaneStore();
  store[storeId] = created;
  return created;
}

/**
 * Remove earnings panes. Indices shift as panes are removed, so teardown always
 * goes through the stored handle rather than assuming a position. Call with no
 * storeId to clear every pane belonging to a chart.
 */
function clearEarningsPane(chart, storeId) {
  const store = earningsPaneStore();
  const keys = storeId == null ? Object.keys(store) : [storeId || 'default'];
  for (const key of keys) {
    const entry = store[key];
    if (!entry) continue;
    if (chart && entry.chart && entry.chart !== chart) continue;
    for (const s of entry.series || []) {
      try { chart.removeSeries(s); } catch (e) { }
    }
    if (chart && lwChartSupportsPanes(chart)) {
      let idx = -1;
      try { idx = typeof entry.pane.paneIndex === 'function' ? entry.pane.paneIndex() : -1; } catch (e) { idx = -1; }
      if (idx > 0) { try { chart.removePane(idx); } catch (e) { } }
    }
    delete store[key];
  }
}

const EARNINGS_API = {
  applyEarningsPane,
  clearEarningsPane,
  buildEarningsBuckets,
  earningsQuarterTime,
  EARNINGS_PANE_KEY,
};
if (typeof window !== 'undefined') {
  window.ChartEarnings = EARNINGS_API;
  window.applyEarningsPane = applyEarningsPane;
  window.clearEarningsPane = clearEarningsPane;
  window.buildEarningsBuckets = buildEarningsBuckets;
  window.earningsQuarterTime = earningsQuarterTime;
  window.lwChartSupportsPanes = lwChartSupportsPanes;
}
if (typeof global !== 'undefined' && global !== (typeof window !== 'undefined' ? window : undefined)) {
  Object.assign(global, EARNINGS_API);
}

// ══════════════════════════════════════════════════════════════════════════════
// WIN indicator — the single implementation every chart surface uses.
//
// Before this, the indicator existed three times: the max chart, the card
// renderer (`renderLwCardChart`) and a cut-down copy inside `screener.html`.
// They drifted. The screener drew EMA10/20 and SMA200 but not SMA50, SMA30W, the
// RS line, the volume trigger or the VCP markers; the card renderer drew the MAs
// but coloured volume with a plain up/down pair, while the max chart applied the
// full six-tier volume hierarchy below. Same indicator, different picture on
// different pages — which is the one thing an indicator must never do.
//
// Everything here is pure: it takes candles and the config, and returns values.
// No DOM, no chart API, no globals. Each renderer consumes these, so a change to
// the indicator changes every page at once.
// ══════════════════════════════════════════════════════════════════════════════

// The six-tier volume colours from the max chart, in precedence order. Kept in
// one place so the legend and every renderer agree on what a colour means.
const WIN_VOL_COLORS = {
  pocket: '#2196f3',      // highest volume in the lookback, or a pocket pivot
  dry: '#ffeb3b',         // lowest volume in the lookback (VDU)
  quiet: 'rgba(148, 163, 184, 0.45)', // below average
  powerUp: '#c8e6ca',     // extreme surge on an up bar
  powerDown: '#fbc4bd',   // extreme surge on a down bar
  up: '#4caf50',
  down: '#f23645',
};

function _winEMA(candles, period) {
  const out = [];
  const k = 2 / (period + 1);
  let prev = null;
  for (let i = 0; i < candles.length; i++) {
    if (i < period - 1) { out.push(null); }
    else if (i === period - 1) {
      let sum = 0;
      for (let j = 0; j < period; j++) sum += candles[i - j].close;
      prev = sum / period;
      out.push(prev);
    } else {
      const v = candles[i].close * k + prev * (1 - k);
      out.push(v);
      prev = v;
    }
  }
  return out;
}

function _winSMA(candles, period) {
  const out = [];
  for (let i = 0; i < candles.length; i++) {
    if (i < period - 1) { out.push(null); continue; }
    let sum = 0;
    for (let j = 0; j < period; j++) sum += candles[i - j].close;
    out.push(sum / period);
  }
  return out;
}

// There are two average-volume shapes in the original code, and they are NOT
// interchangeable — collapsing them here would silently change the indicator:
//
//   _winAvgVolCumulative  no nulls; early bars average what exists so far.
//                         This is what colours the volume histogram.
//   _winAvgVolSeries      null until a full window exists.
//                         This is what feeds calculateWinMarkers.
//
// The split is real upstream behaviour, so it is preserved rather than tidied.
function _winAvgVolCumulative(candles, period) {
  const p = period || 50;
  const out = [];
  let sum = 0;
  for (let i = 0; i < candles.length; i++) {
    sum += candles[i].volume || 0;
    if (i >= p) sum -= (candles[i - p].volume || 0);
    out.push(i >= p ? sum / p : sum / (i + 1));
  }
  return out;
}

function _winAvgVolSeries(candles, period) {
  const p = period || 50;
  const out = [];
  let sum = 0;
  for (let i = 0; i < candles.length; i++) {
    sum += candles[i].volume || 0;
    if (i >= p) sum -= (candles[i - p].volume || 0);
    out.push(i >= p - 1 ? sum / p : null);
  }
  return out;
}

/**
 * Colour one volume bar using the WIN hierarchy. Order matters: a bar that is
 * both the highest in the lookback and a pocket pivot is still 'pocket'.
 */
function winVolumeColor(candles, i, avgVol) {
  const c = candles[i];
  const curVol = c.volume || 0;
  const avg = avgVol || 1;
  const isUp = c.close >= c.open;

  const windowStart = Math.max(0, i - 19);
  let minVol = Infinity, maxVol = -Infinity;
  for (let j = windowStart; j <= i; j++) {
    const v = candles[j].volume || 0;
    if (v > 0) { if (v < minVol) minVol = v; if (v > maxVol) maxVol = v; }
  }

  let maxDownVol10 = 0;
  for (let j = Math.max(0, i - 10); j < i; j++) {
    if (candles[j].close < candles[j].open) {
      const v = candles[j].volume || 0;
      if (v > maxDownVol10) maxDownVol10 = v;
    }
  }
  const isPocketPivot = isUp && curVol > maxDownVol10 && curVol >= avg * 1.05;

  if ((curVol >= maxVol && curVol >= avg) || isPocketPivot) return WIN_VOL_COLORS.pocket;
  if (curVol <= minVol && curVol < avg) return WIN_VOL_COLORS.dry;
  if (curVol < avg) return WIN_VOL_COLORS.quiet;
  if (curVol >= avg * 1.75) return isUp ? WIN_VOL_COLORS.powerUp : WIN_VOL_COLORS.powerDown;
  return isUp ? WIN_VOL_COLORS.up : WIN_VOL_COLORS.down;
}

/** Full volume histogram payload for a chart, using the WIN hierarchy. */
function winVolumeData(candles, volLen) {
  const avgVols = _winAvgVolCumulative(candles, volLen || 50);
  return candles.map((c, i) => ({
    time: c.time,
    value: c.volume || 0,
    color: winVolumeColor(candles, i, avgVols[i]),
  }));
}

/**
 * Everything the indicator computes for one chart, in one call.
 *
 * `niftyCandles` feeds the relative-strength line; when it is absent the RS line
 * is simply null rather than silently degrading to a differently-scaled value.
 * `timeframe` follows the app's vocabulary ('D', 'W', '15m', '1H').
 */
function computeWinIndicator(candles, options) {
  const o = options || {};
  const cfg = o.config || (typeof window !== 'undefined' && window._winConfig) || null;
  const inputs = (cfg && cfg.inputs) || {};
  const style = (cfg && cfg.style) || {};
  const tf = o.timeframe || 'D';
  const isWeekly = (tf === 'W');
  const isDaily = (tf === 'D');
  const nifty = o.niftyCandles || null;

  const ema1 = _winEMA(candles, inputs.ema1Period || 10);
  const ema2 = _winEMA(candles, inputs.ema2Period || 20);
  const sma1 = _winSMA(candles, inputs.sma1Period || 50);
  const sma2 = _winSMA(candles, inputs.sma2Period || 200);
  const sma30w = _winSMA(candles, inputs.sma30wPeriod || 30);
  // Colouring uses the cumulative form; the marker rules use the windowed one.
  const avgVol = _winAvgVolSeries(candles, inputs.volLen || 50);

  // Weekly uses the 30-week average on its own; daily uses the 50/200 pair.
  const lines = [
    { key: 'ema10', label: 'EMA ' + (inputs.ema1Period || 10), vals: ema1, style: style.ema10, defaultColor: '#3b82f6', width: 1, active: true },
    { key: 'ema20', label: 'EMA ' + (inputs.ema2Period || 20), vals: ema2, style: style.ema20, defaultColor: '#ef4444', width: 1, active: true },
    { key: 'sma50', label: 'SMA ' + (inputs.sma1Period || 50), vals: sma1, style: style.sma50, defaultColor: '#06b6d4', width: 1, active: !isWeekly },
    { key: 'sma200', label: 'SMA ' + (inputs.sma2Period || 200), vals: sma2, style: style.sma200, defaultColor: '#22c55e', width: 1.5, active: !isWeekly },
    { key: 'sma30w', label: 'SMA ' + (inputs.sma30wPeriod || 30) + 'W', vals: sma30w, style: style.sma30w, defaultColor: '#f97316', width: 1, active: isWeekly },
  ];

  // Relative strength vs Nifty, rebased to 1000 so it shares a readable range.
  let rsData = [];
  if (nifty && nifty.length) {
    const nMap = new Map();
    for (const nc of nifty) {
      const ms = nc.time > 1e11 ? nc.time : nc.time * 1000;
      nMap.set(new Date(ms).toISOString().split('T')[0], nc.close);
    }
    for (const c of candles) {
      const nClose = nMap.get(new Date(c.time * 1000).toISOString().split('T')[0]);
      if (nClose != null && nClose > 0) rsData.push({ time: c.time, value: (c.close / nClose) * 1000 });
    }
  }

  const markers = (typeof calculateWinMarkers === 'function')
    ? calculateWinMarkers(candles, ema1, avgVol, isDaily) : [];

  const vt = (typeof calcVolumeTrigger === 'function')
    ? calcVolumeTrigger(candles, inputs.vtLookback, inputs.vtRows, inputs.vtHvnPct, inputs.vtLvnPct) : null;

  return {
    timeframe: tf,
    isWeekly: isWeekly,
    isDaily: isDaily,
    lines: lines,
    ema1: ema1,
    ema2: ema2,
    avgVol: avgVol,
    rsData: rsData,
    markers: markers,
    volumeTrigger: vt,
    volumeData: winVolumeData(candles, inputs.volLen || 50),
    volumeColors: WIN_VOL_COLORS,
  };
}

const WIN_INDICATOR_API = {
  computeWinIndicator,
  winVolumeData,
  winVolumeColor,
  WIN_VOL_COLORS,
  // primitives, so the other renderers can share the maths instead of their own
  ema: _winEMA,
  sma: _winSMA,
  avgVol: _winAvgVolSeries,
  avgVolCumulative: _winAvgVolCumulative,
};
if (typeof window !== 'undefined') {
  window.WinIndicator = WIN_INDICATOR_API;
  window.computeWinIndicator = computeWinIndicator;
  window.winVolumeData = winVolumeData;
  window.winEma = _winEMA;
  window.winSma = _winSMA;
  window.winAvgVol = _winAvgVolSeries;
  window.winAvgVolCumulative = _winAvgVolCumulative;
}
if (typeof global !== 'undefined' && global !== (typeof window !== 'undefined' ? window : undefined)) {
  Object.assign(global, WIN_INDICATOR_API);
}

function renderLwCardChart({
    container,
    candles,
    niftyCandles = null,
    timeframe = 'D',
    chartType = 'candles',
    scalePrefix = 'card_',
    statsEl = null,
    tableEl = null,
    symbol = '',
    chartsMap = null,
    observersMap = null,
    candlesMap = null,
    mapKey = null,
    updateGlobalMaxPriceSeries = false,
    maVisibility = null,
    onCrosshairMove = null,
  }) {
    if (!container || !candles || candles.length === 0 || typeof LightweightCharts === 'undefined') return null;

    if (chartsMap && mapKey != null && chartsMap[mapKey]) {
      try { chartsMap[mapKey].remove(); } catch (e) { }
      delete chartsMap[mapKey];
    }
    container.innerHTML = '';

    const rect = container.getBoundingClientRect();
    const width = rect.width || container.clientWidth || 300;
    const height = rect.height || container.clientHeight || 200;

    const sorted = [...candles].sort((a, b) => a.time - b.time);
    const seenTimes = new Set();
    const cleanCandles = [];
    for (const c of sorted) {
      const tSec = c.time > 1e11 ? Math.floor(c.time / 1000) : Math.floor(c.time);
      if (!seenTimes.has(tSec) && c.open != null && c.high != null && c.low != null && c.close != null) {
        seenTimes.add(tSec);
        cleanCandles.push({
          time: tSec,
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close,
          volume: c.volume || 0,
        });
      }
    }
    if (cleanCandles.length === 0) return null;
    if (updateGlobalMaxPriceSeries) global._maxCleanCandles = cleanCandles;

    const chart = LightweightCharts.createChart(container, {
      width: width,
      height: height,
      layout: {
        background: { color: '#090b10' },
        textColor: '#94a3b8',
        fontFamily: "'Inter', sans-serif",
        fontSize: 10,
      },
      grid: {
        vertLines: { color: 'rgba(255, 255, 255, 0.025)' },
        horzLines: { color: 'rgba(255, 255, 255, 0.025)' },
      },
      crosshair: {
        mode: LightweightCharts.CrosshairMode.Normal,
        vertLine: { color: 'rgba(91, 163, 245, 0.3)', width: 1, style: 2 },
        horzLine: { color: 'rgba(91, 163, 245, 0.3)', width: 1, style: 2 },
      },
      rightPriceScale: {
        visible: true,
        borderColor: 'rgba(255, 255, 255, 0.08)',
        scaleMargins: { top: 0.08, bottom: 0.22 },
        autoScale: true,
        alignLabels: true,
      },
      timeScale: {
        borderColor: 'rgba(255, 255, 255, 0.06)',
        timeVisible: timeframe === '1H' || timeframe === '15m',
        secondsVisible: false,
      },
    });

    if (chartsMap && mapKey != null) chartsMap[mapKey] = chart;

    let priceSeries;
    if (chartType === 'ohlc') {
      priceSeries = lwAddSeries(chart, 'BarSeries', {
        upColor: '#26a69a',
        downColor: '#ef5350',
        wickVisible: true,
      });
    } else {
      priceSeries = lwAddSeries(chart, 'CandlestickSeries', {
        upColor: '#26a69a',
        downColor: '#ef5350',
        borderVisible: false,
        wickUpColor: '#26a69a',
        wickDownColor: '#ef5350',
      });
    }
    priceSeries.setData(cleanCandles);
    if (updateGlobalMaxPriceSeries) global._maxLwPriceSeries = priceSeries;

    const cfg = global._winConfig || WIN_CORE_DEFAULTS;
    const inp = cfg.inputs || WIN_CORE_DEFAULTS.inputs;
    const st = cfg.style || WIN_CORE_DEFAULTS.style;

    const volScaleId = `${scalePrefix}vol_scale`;
    const volSeries = lwAddSeries(chart, 'HistogramSeries', {
      priceFormat: { type: 'volume' },
      priceScaleId: volScaleId,
    });
    chart.priceScale(volScaleId).applyOptions({
      scaleMargins: { top: 0.82, bottom: 0 },
      visible: false,
    });
    // The card charts used to colour volume with a plain up/down pair while the
    // max chart applied the six-tier VCP hierarchy. Same indicator, different
    // picture. Both now come from winVolumeData().
    volSeries.setData(winVolumeData(cleanCandles, (cfg.inputs && cfg.inputs.volLen) || 50));

    const tf = timeframe || 'D';
    const isWeekly = (tf === 'W');
    const isDaily = (tf === 'D');

    // Maths comes from the one shared implementation, so a change to the
    // indicator lands on every surface at once.
    const ema10Vals = _winEMA(cleanCandles, inp.ema1Period || 10);
    const ema20Vals = _winEMA(cleanCandles, inp.ema2Period || 20);
    const sma50Vals = _winSMA(cleanCandles, inp.sma1Period || 50);
    const sma200Vals = _winSMA(cleanCandles, inp.sma2Period || 200);
    const sma30wVals = _winSMA(cleanCandles, inp.sma30wPeriod || 30);
    const avgVolVals = _winAvgVolSeries(cleanCandles, inp.volLen || 50);

    const maMaps = {
      ema10: new Map(),
      ema20: new Map(),
      sma50: new Map(),
      sma200: new Map(),
    };
    for (let i = 0; i < cleanCandles.length; i++) {
      const t = cleanCandles[i].time;
      if (ema10Vals[i] != null) maMaps.ema10.set(t, ema10Vals[i]);
      if (ema20Vals[i] != null) maMaps.ema20.set(t, ema20Vals[i]);
      if (sma50Vals[i] != null) maMaps.sma50.set(t, sma50Vals[i]);
      if (sma200Vals[i] != null) maMaps.sma200.set(t, sma200Vals[i]);
    }

    const addMaSeries = (key, lineCfg, vals, defaultColor, defaultWidth, cond = true) => {
      if (!cond || !lineCfg || !lineCfg.visible) return null;
      const isVisible = !(maVisibility && maVisibility[key] === false);
      const data = [];
      if (isVisible) {
        for (let i = 0; i < cleanCandles.length; i++) {
          if (vals[i] != null) data.push({ time: cleanCandles[i].time, value: vals[i] });
        }
      }
      const s = lwAddSeries(chart, 'LineSeries', {
        color: _ccHexToRgba(lineCfg.color || defaultColor, (lineCfg.opacity != null ? lineCfg.opacity : 85) / 100),
        lineWidth: lineCfg.width != null ? Number(lineCfg.width) : defaultWidth,
        lineStyle: lineCfg.lineStyle || 0,
        priceLineVisible: false,
        lastValueVisible: false,
        title: ''
      });
      s.setData(data);
      return s;
    };

    const maSeries = {
      ema10: addMaSeries('ema10', st.ema10, ema10Vals, '#3b82f6', 1, true),
      ema20: addMaSeries('ema20', st.ema20, ema20Vals, '#ef4444', 1, true),
      sma50: addMaSeries('sma50', st.sma50, sma50Vals, '#06b6d4', 1, !isWeekly),
      sma200: addMaSeries('sma200', st.sma200, sma200Vals, '#22c55e', 1.5, !isWeekly),
      sma30w: addMaSeries('sma30w', st.sma30w, sma30wVals, '#f97316', 1, isWeekly),
    };

    if (st.rs && st.rs.visible && niftyCandles && niftyCandles.length > 0) {
      const nMap = new Map();
      for (const nc of niftyCandles) {
        const ncMs = nc.time > 1e11 ? nc.time : nc.time * 1000;
        nMap.set(new Date(ncMs).toISOString().split('T')[0], nc.close);
      }
      const rsData = [];
      for (const c of cleanCandles) {
        const dStr = new Date(c.time * 1000).toISOString().split('T')[0];
        const nClose = nMap.get(dStr);
        if (nClose != null && nClose > 0) {
          rsData.push({ time: c.time, value: (c.close / nClose) * 1000 });
        }
      }
      if (rsData.length > 0) {
        const rsScaleId = `${scalePrefix}rs_scale`;
        const rsSeries = lwAddSeries(chart, 'LineSeries', {
          color: _ccHexToRgba(st.rs.color || '#38bdf8', (st.rs.opacity != null ? st.rs.opacity : 100) / 100),
          lineWidth: st.rs.width || 1.4,
          lineStyle: st.rs.lineStyle || 0,
          priceScaleId: rsScaleId,
          priceLineVisible: false,
          lastValueVisible: false,
          title: '',
        });
        chart.priceScale(rsScaleId).applyOptions({
          scaleMargins: { top: 0.05, bottom: 0.70 },
          visible: false,
        });
        rsSeries.setData(rsData);
      }
    }

    if (st.dots && st.dots.visible && typeof global.calculateWinMarkers === 'function') {
      const markers = global.calculateWinMarkers(cleanCandles, ema10Vals, avgVolVals, isDaily);
      lwSetMarkers(priceSeries, markers);
    } else {
      lwSetMarkers(priceSeries, []);
    }

    let vt = null;
    if (typeof global.calcVolumeTrigger === 'function') {
      vt = global.calcVolumeTrigger(cleanCandles, inp.vtLookback, inp.vtRows, inp.vtHvnPct, inp.vtLvnPct);
      if (st.vt && st.vt.visible && isDaily && vt && vt.isAboveClose) {
        priceSeries.createPriceLine({
          price: vt.price,
          color: _ccHexToRgba(st.vt.color || '#4863fc', (st.vt.opacity != null ? st.vt.opacity : 100) / 100),
          lineWidth: st.vt.width || 1.2,
          lineStyle: st.vt.lineStyle != null ? st.vt.lineStyle : LightweightCharts.LineStyle.Dashed,
          axisLabelVisible: false,
          title: '',
        });
      }
    }

    if (tableEl && symbol && typeof global.renderWinHudTableHtml === 'function') {
      const details = typeof global.getStockDetails === 'function' ? global.getStockDetails(symbol) : { symbol };
      tableEl.innerHTML = global.renderWinHudTableHtml(cleanCandles, details, vt);
    }

    const ctx = { chart, priceSeries, volSeries, maSeries, maMaps, cleanCandles, vt };

    if (typeof onCrosshairMove === 'function') {
      chart.subscribeCrosshairMove(param => onCrosshairMove(param, ctx));
    } else if (statsEl) {
      const updateStats = (bar) => {
        if (!statsEl || !bar) return;
        const isUp = bar.close >= bar.open;
        const color = isUp ? 'var(--lime)' : 'var(--red)';
        const pct = (((bar.close - bar.open) / bar.open) * 100).toFixed(1);
        const sign = isUp ? '+' : '';
        statsEl.innerHTML = `<span style="font-family:var(--mono);font-weight:600;margin-right:2px">${bar.close.toFixed(1)}</span>
                             <span style="color:${color};font-family:var(--mono);font-weight:600;margin-right:2px">${sign}${pct}%</span>`;
      };
      chart.subscribeCrosshairMove(param => {
        if (!param || !param.time || !param.seriesData.get(priceSeries)) {
          updateStats(cleanCandles[cleanCandles.length - 1]);
          return;
        }
        updateStats(param.seriesData.get(priceSeries));
      });
    }

    if (candlesMap && mapKey != null) candlesMap[mapKey] = cleanCandles;

    if (typeof global.resetChartPriceScale === 'function') global.resetChartPriceScale(chart, 'right');
    if (typeof global.applyPreservedChartZoom === 'function') {
      if (global.applyPreservedChartZoom.length === 2) {
        global.applyPreservedChartZoom(cleanCandles.length, isWeekly);
      } else {
        global.applyPreservedChartZoom(chart, cleanCandles.length, tf);
      }
    }

    chart.timeScale().subscribeVisibleLogicalRangeChange(range => {
      if (typeof global.saveUserChartZoomPreference === 'function') {
        global.saveUserChartZoomPreference(range, cleanCandles.length, tf);
      }
    });

    chart.subscribeDblClick(() => {
      if (typeof global.resetChartPriceScale === 'function') global.resetChartPriceScale(chart, 'right');
      if (typeof global.applyPreservedChartZoom === 'function') {
        if (global.applyPreservedChartZoom.length === 2) {
          global.applyPreservedChartZoom(cleanCandles.length, isWeekly);
        } else {
          global.applyPreservedChartZoom(chart, cleanCandles.length, tf);
        }
      }
    });

    if (observersMap && mapKey != null && typeof ResizeObserver !== 'undefined') {
      if (observersMap[mapKey]) {
        try { observersMap[mapKey].disconnect(); } catch (e) { }
      }
      observersMap[mapKey] = new ResizeObserver(entries => {
        const activeChart = chartsMap ? chartsMap[mapKey] : chart;
        if (!entries || !entries.length || !activeChart) return;
        const cr = entries[0].contentRect;
        if (cr.width > 0 && cr.height > 0) {
          activeChart.applyOptions({ width: cr.width, height: cr.height });
          if (typeof global.resetChartPriceScale === 'function') global.resetChartPriceScale(activeChart, 'right');
          const cached = candlesMap ? candlesMap[mapKey] : cleanCandles;
          if (cached && cached.length > 0 && typeof global.applyPreservedChartZoom === 'function') {
            if (global.applyPreservedChartZoom.length === 2) {
              global.applyPreservedChartZoom(cached.length, isWeekly);
            } else {
              global.applyPreservedChartZoom(activeChart, cached.length, tf);
            }
          }
        }
      });
      observersMap[mapKey].observe(container);
    }

    return ctx;
  }

  function renderHighlightedStatPill(label, valueText, tone) {
    const t = tone || {};
    const col = t.col || '#f8fafc';
    const bg = t.bg || 'rgba(56,189,248,0.14)';
    const bdr = t.bdr || 'rgba(56,189,248,0.42)';
    return `<span style="background:${bg};border:1px solid ${bdr};padding:1px 7px;border-radius:4px;white-space:nowrap;box-shadow:0 0 8px ${bg};"><span style="color:#e2e8f0;font-weight:700;">${label}:</span> <b style="color:${col};margin-left:3px;font-weight:800;">${valueText}</b></span>`;
  }

  function getRsHighlightTone(rsVal) {
    if (rsVal == null || isNaN(rsVal)) return { col: '#94a3b8', bg: 'rgba(148,163,184,0.10)', bdr: 'rgba(148,163,184,0.30)' };
    if (rsVal >= 90) return { col: '#4ade80', bg: 'rgba(74,222,128,0.18)', bdr: 'rgba(74,222,128,0.50)' };
    if (rsVal >= 80) return { col: '#2dd4bf', bg: 'rgba(45,212,191,0.18)', bdr: 'rgba(45,212,191,0.48)' };
    if (rsVal >= 60) return { col: '#fbbf24', bg: 'rgba(251,191,36,0.16)', bdr: 'rgba(251,191,36,0.45)' };
    return { col: '#f87171', bg: 'rgba(248,113,113,0.16)', bdr: 'rgba(248,113,113,0.45)' };
  }

  function getRvolHighlightTone(rVol) {
    if (rVol == null || isNaN(rVol)) return { col: '#94a3b8', bg: 'rgba(148,163,184,0.10)', bdr: 'rgba(148,163,184,0.30)' };
    if (rVol >= 110) return { col: '#4ade80', bg: 'rgba(34,197,94,0.18)', bdr: 'rgba(34,197,94,0.50)' };
    if (rVol >= 80) return { col: '#fb923c', bg: 'rgba(251,146,60,0.16)', bdr: 'rgba(251,146,60,0.45)' };
    return { col: '#f87171', bg: 'rgba(239,68,68,0.16)', bdr: 'rgba(239,68,68,0.45)' };
  }

  /**
   * Computes MarketSmith / IBD-style 1-99 RS percentile across a stock universe
   * using weighted multi-quarter performance (40% 3M + 20% 6M + 20% 9M + 20% 12M).
   */
  function computeMarketSmithRsMap(stocks) {
    const entries = [];
    for (let i = 0; i < (stocks || []).length; i++) {
      const s = stocks[i];
      if (!s || !s.symbol) continue;
      const p3 = s.perf_3m != null ? Number(s.perf_3m) : null;
      const p6 = s.perf_6m != null ? Number(s.perf_6m) : null;
      const p1y = s.perf_1y != null ? Number(s.perf_1y) : null;
      if (p3 == null && p6 == null && p1y == null) continue;
      const r3 = p3 != null ? p3 : (p6 != null ? p6 * 0.5 : (p1y || 0) * 0.25);
      const r6 = p6 != null ? p6 : (p3 != null ? p3 : (p1y || 0) * 0.5);
      const r12 = p1y != null ? p1y : r6;
      const r9 = (r6 + r12) / 2;
      const comp = r3 * 0.4 + r6 * 0.2 + r9 * 0.2 + r12 * 0.2;
      if (isFinite(comp)) {
        entries.push({ sym: String(s.symbol).toUpperCase().replace(/\.(NS|BO)$/i, '').trim(), comp });
      }
    }
    const sorted = entries.map(e => e.comp).sort((a, b) => a - b);
    const n = sorted.length;
    const map = {};
    if (!n) return map;
    for (let i = 0; i < entries.length; i++) {
      const val = entries[i].comp;
      let lo = 0, hi = n;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (sorted[mid] <= val) lo = mid + 1;
        else hi = mid;
      }
      const pct = n > 1 ? Math.min(99, Math.max(1, Math.round((lo / n) * 98) + 1)) : 99;
      map[entries[i].sym] = pct;
    }
    return map;
  }

  global.renderLwCardChart = renderLwCardChart;
  global.renderHighlightedStatPill = renderHighlightedStatPill;
  global.getRsHighlightTone = getRsHighlightTone;
  global.getRvolHighlightTone = getRvolHighlightTone;
  global.computeMarketSmithRsMap = computeMarketSmithRsMap;
})(window);
