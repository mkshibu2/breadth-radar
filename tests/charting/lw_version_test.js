// LightweightCharts version-migration test.
//
// v5 dropped `chart.addCandlestickSeries()`/`addBarSeries()`/`addHistogramSeries()`/
// `addLineSeries()` and `series.setMarkers()`. Those removals are silent: nothing
// throws until a chart is actually created, so `node --check` cannot see them and
// the failure mode is "the chart area is blank".
//
// This test boots the *real* bundled LightweightCharts into a vm sandbox
// (tests/charting/lw_harness.js) and replays every adapter path the pages use.
//
//   node tests/charting/lw_version_test.js
//   LW4_BUNDLE=/path/to/v4.js node tests/charting/lw_version_test.js   # dual-version
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { bootLightweightCharts } = require('./lw_harness');

const ROOT = path.resolve(__dirname, '..', '..');
const BUNDLE = path.join(ROOT, 'lightweight-charts.standalone.production.js');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const stripCR = s => s.replace(/\r\n/g, '\n');

let pass = 0, fail = 0;
const check = (name, cond, err) => {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (err ? ' -> ' + err : '')); }
};
const section = t => console.log('\n' + t);

// ─────────────────────────────────────────────────────────────────────────────
section('static: no page calls a removed v5 factory directly');
const sources = { 'index.js': read('index.js'), 'chart_core.js': read('chart_core.js'), 'screener.html': read('screener.html') };
const legacyFactories = ['addCandlestickSeries', 'addBarSeries', 'addLineSeries', 'addAreaSeries', 'addHistogramSeries'];
for (const [file, src] of Object.entries(sources)) {
  const s = stripCR(src);
  for (const f of legacyFactories) {
    // the only allowed mention is chart_core.js's compatibility fallback table
    const hits = s.split('\n').filter(l => l.includes(f) && !l.trim().startsWith('//'));
    const allowed = file === 'chart_core.js' ? hits.every(l => /^[A-Za-z]+Series: 'add\w+Series',$/.test(l.trim())) : hits.length === 0;
    check(`${file}: no direct ${f}() call`, allowed, hits.length + ' line(s)');
  }
  check(`${file}: goes through lwAddSeries`, s.includes('lwAddSeries'));
}
for (const [file, src] of [['index.js', stripCR(read('index.js'))], ['chart_core.js', stripCR(read('chart_core.js'))]]) {
  const bad = src.split('\n').filter(l => {
    if (/\.setMarkers\(/.test(l) === false) return false;
    if (l.trim().startsWith('//')) return false;
    return !l.includes('__lwMarkers') && !l.includes('typeof series.setMarkers');
  });
  check(`${file}: no unadapted series.setMarkers() call`, bad.length === 0, bad.join(' | '));
}

// ─────────────────────────────────────────────────────────────────────────────
// Adapter extraction: pull the three helpers out of chart_core.js verbatim.
function extractAdapter(src) {
  const start = src.indexOf('function lwGlobal()');
  const end = src.indexOf('function lwVersion()');
  const tail = src.indexOf('\n}', src.indexOf('function lwVersion()')) + 2;
  return src.slice(start, tail);
}

const adapterSrc = extractAdapter(stripCR(read('chart_core.js')));
check('adapter helpers extracted from chart_core.js', /function lwAddSeries/.test(adapterSrc) && /function lwSetMarkers/.test(adapterSrc));

// ─────────────────────────────────────────────────────────────────────────────
const CHART_OPTS = () => ({
  layout: { background: { type: 'solid', color: '#050508' }, textColor: '#d1d4dc', fontSize: 11, fontFamily: 'sans-serif' },
  grid: { vertLines: { color: '#1a1e29' }, horzLines: { color: '#1a1e29' } },
  crosshair: { mode: 0 },
  rightPriceScale: { borderColor: '#2a2e39', scaleMargins: { top: 0.1, bottom: 0.22 }, autoScale: true, alignLabels: true },
  timeScale: { borderColor: 'rgba(255, 255, 255, 0.08)', timeVisible: true, secondsVisible: false },
  handleScale: { axisPressedMouseMove: { time: true, price: true } },
});

// Every series/scale configuration the repo actually builds, taken from the call sites.
const REPO_SERIES = [
  ['max-chart candlestick', 'CandlestickSeries', { upColor: '#26a69a', downColor: '#ef5350', borderVisible: false, wickUpColor: '#26a69a', wickDownColor: '#ef5350' }],
  ['max-chart OHLC bar', 'BarSeries', { upColor: '#26a69a', downColor: '#ef5350', wickVisible: true }],
  ['max-chart volume', 'HistogramSeries', { priceFormat: { type: 'volume' }, priceScaleId: 'vol_scale' }],
  ['chart_core MA line', 'LineSeries', { color: 'rgba(59, 130, 246, 0.85)', lineWidth: 1, lineStyle: 0, priceLineVisible: false, lastValueVisible: false, title: '' }],
  ['chart_core RS overlay', 'LineSeries', { color: '#38bdf8', lineWidth: 1.4, priceScaleId: 'rs_scale' }],
  ['screener EMA', 'LineSeries', { color: '#f59e0b', lineWidth: 1.5, priceLineVisible: false, lastValueVisible: false, title: '' }],
  ['screener SMA200', 'LineSeries', { color: '#a855f7', lineWidth: 1.5, priceLineVisible: false, lastValueVisible: false, title: '' }],
];

function exerciseVersion(label, bundlePath) {
  section(`runtime: ${label} bundle`);
  let H;
  try { H = bootLightweightCharts(bundlePath); }
  catch (e) { check(`${label}: bundle boots`, false, e.message); return; }

  const LW = H.LightweightCharts;
  const version = LW.version();
  check(`${label}: bundle is LightweightCharts ${label}`, /^5\./.test(version) ? label.startsWith('v5') : label.startsWith('v4'), version);

  // The adapter must work with whatever global the page exposes.
  H.sandbox.window.LightweightCharts = LW;
  vm.runInContext(adapterSrc, H.sandbox, { filename: 'chart_core-adapter' });
  check(`${label}: lwAddSeries/lwSetMarkers defined`, vm.runInContext('typeof lwAddSeries + typeof lwSetMarkers', H.sandbox) === 'functionfunction');
  check(`${label}: lwVersion() reports ${version}`, vm.runInContext('lwVersion()', H.sandbox) === version);

  let chart;
  try { chart = H.createChart(CHART_OPTS()); }
  catch (e) { check(`${label}: createChart with the repo's options`, false, e.message); return; }
  check(`${label}: createChart with the repo's options`, !!chart);
  check(`${label}: v5 factories absent as expected`, /^5\./.test(version) ? typeof chart.addCandlestickSeries === 'undefined' : typeof chart.addCandlestickSeries === 'function');

  for (const [name, kind, opts] of REPO_SERIES) {
    let ok = false, err = '';
    try {
      const s = vm.runInContext('lwAddSeries', H.sandbox)(chart, kind, opts);
      H.flush();
      ok = !!s && typeof s.setData === 'function';
      if (ok) {
        s.setData([]);
        H.flush();
      }
    } catch (e) { err = e.message; }
    check(`${label}: ${name}`, ok, err);
  }

  // Overlay scale used for volume/RS, then the public price-scale reset.
  let scaleOk = false;
  try {
    chart.priceScale('vol_scale').applyOptions({ scaleMargins: { top: 0.82, bottom: 0 }, visible: false });
    chart.priceScale('right').applyOptions({ autoScale: true });
    H.flush();
    scaleOk = true;
  } catch (e) { scaleOk = e.message; }
  check(`${label}: overlay price scale + resetChartPriceScale path`, scaleOk === true, scaleOk);

  // Markers: the API the repo uses for WIN dots.
  let markerOk = false, markerErr = '';
  try {
    const cand = vm.runInContext('lwAddSeries', H.sandbox)(chart, 'CandlestickSeries', {});
    cand.setData(REPO_CANDLES.map(c => Object.assign({}, c)));
    H.flush();
    const lwSetMarkers = vm.runInContext('lwSetMarkers', H.sandbox);
    lwSetMarkers(cand, [{ time: REPO_CANDLES[2].time, position: 'aboveBar', color: '#22c55e', shape: 'arrowUp', text: 'WIN' }]);
    lwSetMarkers(cand, []);
    H.flush();
    markerOk = true;
  } catch (e) { markerErr = e.message; }
  check(`${label}: WIN markers via lwSetMarkers (set + clear)`, markerOk, markerErr);

  // Time-scale and interaction APIs the repo depends on.
  const tsCalls = [];
  try {
    const ts = chart.timeScale();
    ts.getVisibleLogicalRange();
    ts.setVisibleLogicalRange({ from: 0, to: 10 });
    ts.logicalToCoordinate(5);
    ts.coordinateToLogical(100);
    ts.timeToCoordinate(REPO_CANDLES[0].time);
    ts.applyOptions({ rightOffset: 8, timeVisible: true });
    ts.fitContent();
    ts.subscribeVisibleLogicalRangeChange(() => {});
    chart.subscribeCrosshairMove(() => {});
    chart.subscribeClick(() => {});
    H.flush();
    tsCalls.push('ok');
  } catch (e) { tsCalls.push(e.message); }
  check(`${label}: time scale + subscribe APIs`, tsCalls[0] === 'ok', tsCalls[0]);

  const size = chart.paneSize();
  check(`${label}: paneSize() returns numbers`, size && typeof size.width === 'number' && typeof size.height === 'number', JSON.stringify(size));

  try { chart.remove(); } catch (e) { /* removal is best-effort in the shim */ }
  const noisy = H.errors.filter(e => !/ResizeObserver|not implemented/i.test(e));
  check(`${label}: no console errors while exercising the chart`, noisy.length === 0, noisy.slice(0, 2).join(' | '));
}

// One shared daily-candle fixture in the format both v4 and v5 accept.
const REPO_CANDLES = [];
for (let i = 0; i < 60; i++) {
  const d = new Date(Date.UTC(2026, 0, 1) + i * 86400000);
  const ymd = d.toISOString().slice(0, 10);
  REPO_CANDLES.push({ time: ymd, open: 100 + i, high: 102 + i, low: 99 + i, close: 101 + i, volume: 1000 + i });
}

exerciseVersion('v5', BUNDLE);

// Optional: run the same suite against a v4 bundle to prove the adapter is not
// a one-way door (set LW4_BUNDLE to a v4.1.x standalone build).
if (process.env.LW4_BUNDLE && fs.existsSync(process.env.LW4_BUNDLE)) {
  exerciseVersion('v4', process.env.LW4_BUNDLE);
} else {
  section('runtime: v4 compatibility');
  console.log('  SKIP  set LW4_BUNDLE=/path/to/v4.1.3.js to also exercise the legacy fallback');
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
