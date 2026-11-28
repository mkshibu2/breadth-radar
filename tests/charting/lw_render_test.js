// End-to-end: run index.js's real chart-building pipeline against the real bundled
// LightweightCharts. This is the test that would have caught the v5 migration: the
// removed factory methods do not throw until a chart is actually built, so everything
// else (node --check, the DOM-stub boot test) passes while the chart stays blank.
//
//   node tests/charting/lw_render_test.js
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const { bootLightweightCharts } = require('./lw_harness');

const ROOT = path.resolve(__dirname, '..', '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const stripCR = s => s.replace(/\r\n/g, '\n');

let pass = 0, fail = 0;
const check = (name, cond, err) => {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (err ? ' -> ' + err : '')); }
};
const section = t => console.log('\n' + t);

section('boot: real LightweightCharts bundle + index.js');
const H = bootLightweightCharts(path.join(ROOT, 'lightweight-charts.standalone.production.js'));
const sb = H.sandbox;

// Stable, registry-backed DOM so repeated getElementById() calls hit the same node.
const registry = {};
const el = id => (registry[id] || (registry[id] = Object.assign(H.makeEl(), {
  id,
  closest: () => null,
  querySelector: () => null,
  querySelectorAll: () => [],
})));
sb.document.getElementById = el;
sb.document.createElement = () => H.makeEl();
sb.document.body = el('body');
sb.document.addEventListener = () => {};
sb.document.removeEventListener = () => {};
sb.addEventListener = () => {};
sb.removeEventListener = () => {};
sb.dispatchEvent = () => true;
sb.localStorage = {
  _s: {},
  getItem(k) { return k in this._s ? this._s[k] : null; },
  setItem(k, v) { this._s[k] = String(v); },
  removeItem(k) { delete this._s[k]; },
};
sb.sessionStorage = sb.localStorage;
sb.fetch = () => Promise.reject(new Error('offline'));
sb.CHART_DRAW_HOST = undefined;

const version = sb.LightweightCharts.version();
check('bundle loads and reports a version', typeof version === 'string' && version.length > 0, version);
check('bundle is v5+', /^5\./.test(version), version);

// Load chart_core.js's v5 adapter into the same context index.js will run in.
const core = stripCR(read('chart_core.js'));
const aStart = core.indexOf('function lwGlobal()');
const aEnd = core.indexOf('\n}', core.indexOf('function lwVersion()')) + 2;
vm.runInContext(core.slice(aStart, aEnd), sb, { filename: 'chart_core-adapter' });
for (const n of ['lwAddSeries', 'lwSetMarkers', 'lwVersion']) sb[n] = vm.runInContext(n, sb);

// The earnings pane lives in the same file; index.js calls it from inside
// drawMaxChartLightweight(), so it has to be in scope for this harness too.
const eStart = core.indexOf('function earningsPaneStore()');
const eEnd = core.indexOf('\n}', core.indexOf('function clearEarningsPane(')) + 2;
vm.runInContext(core.slice(eStart, eEnd), sb, { filename: 'chart_core-earnings' });
for (const n of ['applyEarningsPane', 'clearEarningsPane', 'buildEarningsBuckets', 'earningsQuarterTime']) {
  sb[n] = vm.runInContext(n, sb);
}
sb.lwGlobal = vm.runInContext('lwGlobal', sb);
sb.lwChartSupportsPanes = vm.runInContext('lwChartSupportsPanes', sb);
check('earnings engine installed', typeof sb.applyEarningsPane === 'function');

// The WIN indicator module: index.js's renderer now calls straight into it.
const wStart = core.indexOf('const WIN_VOL_COLORS = {');
const wEnd = core.indexOf('\n}', core.indexOf('function computeWinIndicator(')) + 2;
vm.runInContext(core.slice(wStart, wEnd), sb, { filename: 'chart_core-win' });
for (const n of ['winVolumeData', 'winVolumeColor', 'computeWinIndicator', '_winEMA', '_winSMA',
  '_winAvgVolSeries', '_winAvgVolCumulative']) {
  sb[n] = vm.runInContext(n, sb);
}
check('WIN indicator module installed', typeof sb.winVolumeData === 'function' && typeof sb.computeWinIndicator === 'function');

// The real financials file, exactly as index.js fetches it at runtime. Without
// this the earnings pane has no data and correctly draws nothing.
sb.EXACT_QUARTERLY_DATA = JSON.parse(fs.readFileSync(path.join(ROOT, 'exact_quarterly_financials.json'), 'utf8'));
check('adapter installed', typeof sb.lwAddSeries === 'function' && sb.lwVersion() === version);


let bootErr = null;
try { vm.runInContext(stripCR(read('index.js')), sb, { filename: 'index.js' }); }
catch (e) { bootErr = e; }
check('index.js loads against the real bundle', !bootErr, bootErr && bootErr.message);

if (!bootErr) {
  section('runtime: drawMaxChartLightweight builds a real v5 chart');
  const candles = [];
  const base = Date.UTC(2026, 0, 1);
  for (let i = 0; i < 120; i++) {
    const t = base + i * 86400000;
    candles.push({ time: t, open: 100 + i, high: 103 + i, low: 98 + i, close: 101 + i, volume: 10000 + i * 10 });
  }
  vm.runInContext('_maxCandles = ' + JSON.stringify(candles) + ';', sb);
  vm.runInContext('_sdChartsInterval = "D"; _maxChartLayout = "1"; _activeLayoutTile = 1;', sb);
  // A real symbol: the earnings pane looks the symbol up in the financials file,
  // so a placeholder name would exercise the "no data" branch instead of the pane.
  vm.runInContext('_sdMaximizedChartSymbol = "COFORGE";', sb);

  const container = el('max-chart-lw-container');
  container.clientWidth = 900;
  container.clientHeight = 500;
  container.getBoundingClientRect = () => ({ left: 0, top: 0, width: 900, height: 500, right: 900, bottom: 500 });

  for (const type of ['candlestick', 'ohlc']) {
    vm.runInContext(`_sdChartType = ${JSON.stringify(type)};`, sb);
    let built = false, err = '';
    try {
      built = vm.runInContext('drawMaxChartLightweight()', sb);
      H.flush();
    } catch (e) { err = e.message; }
    check(`${type}: drawMaxChartLightweight() returns true`, built === true, err);
    check(`${type}: chart instance created`, !!vm.runInContext('_maxLwChart', sb));
    check(`${type}: price series created`, !!vm.runInContext('_maxLwPriceSeries', sb));
    // Earnings pane: exercise the real draw path without disturbing the chart
    // the later assertions hold on to (a redraw replaces _maxLwChart).
    const offCount = vm.runInContext('_maxLwChart.panes().length', sb);
    const qInfo = vm.runInContext('getStockQuarterlyData(_sdMaximizedChartSymbol)', sb);
    const qBuckets = qInfo && qInfo.qData
      ? vm.runInContext(`buildEarningsBuckets(_maxCleanCandles, ${JSON.stringify(qInfo.qData)})`, sb) : [];
    let earnErr = '';
    try {
      vm.runInContext("applyEarningsPane(_maxLwChart, 'max-chart', _maxCleanCandles, " +
        JSON.stringify(qInfo && qInfo.qData) + ")", sb);
      H.flush();
    } catch (e) { earnErr = e.message; }
    const onCount = vm.runInContext('_maxLwChart.panes().length', sb);
    check(`${type}: earnings pane absent when off, present when on`,
      offCount === 1 && onCount === 2 && qBuckets.length > 0,
      `off=${offCount} on=${onCount} buckets=${qBuckets.length} ${earnErr}`);
    vm.runInContext("clearEarningsPane(_maxLwChart, 'max-chart')", sb);
    H.flush();
    check(`${type}: earnings pane removed cleanly, price chart intact`,
      vm.runInContext('_maxLwChart.panes().length', sb) === 1);
    const seriesApi = vm.runInContext('typeof _maxLwPriceSeries.setData === "function" && typeof _maxLwPriceSeries.applyOptions === "function"', sb);
    check(`${type}: price series exposes the v5 series API`, seriesApi === true);
  }

  section('runtime: post-build interactions on the live chart');
  let resetOk = false, resetErr = '';
  try {
    vm.runInContext('resetChartPriceScale(_maxLwChart, "right")', sb);
    resetOk = true;
  } catch (e) { resetErr = e.message; }
  check('resetChartPriceScale works on the live chart', resetOk, resetErr);

  let zoomOk = false, zoomErr = '';
  try {
    vm.runInContext('applyPreservedChartZoom(_maxLwChart, 120, "D")', sb);
    H.flush();
    zoomOk = true;
  } catch (e) { zoomErr = e.message; }
  check('applyPreservedChartZoom works on the live chart', zoomOk, zoomErr);

  const subs = vm.runInContext('typeof _maxLwChart.timeScale().subscribeVisibleLogicalRangeChange === "function"', sb);
  check('logical-range subscription available (drives zoom persistence)', subs === true);

  section('runtime: redrawChartDrawings callbacks are guarded');
  // A LightweightCharts callback can fire on a page that never loaded chart_draw.js
  // (the screener page builds charts too). An unguarded call there aborts the callback.
  const guardedLines = stripCR(read('index.js')).split('\n')
    .filter(l => l.includes('redrawChartDrawings();'))
    .filter(l => !l.includes('typeof redrawChartDrawings') && !l.trim().startsWith('try'));
  check('every bare redrawChartDrawings() call is typeof-guarded', guardedLines.length === 0, guardedLines.slice(0, 2).join(' | '));

  const drawGuarded = stripCR(read('chart_draw.js')).split('\n')
    .filter(l => /\bshowChartToast\(/.test(l) && !l.trim().startsWith('//'));
  check('chart_draw.js resolves showChartToast locally', stripCR(read('chart_draw.js')).includes('var showChartToast = window.showChartToast;'),
    drawGuarded.length + ' call sites');

  // `inpWon.matches` is a stub gap in the DOM shim (a real element resolves it), not a
  // chart defect — it comes from the unrelated bsrRenderAll pass at load time.
  const noisy = H.errors.filter(e => !/ResizeObserver|not implemented|inpWon\.matches/i.test(e));
  check('no console errors during the whole run', noisy.length === 0, noisy.slice(0, 2).join(' | '));
}

// ─────────────────────────────────────────────────────────────────────────────
// The drawing engine binds to a live chart through timeScale()/series coordinate
// calls. If v5 changed their signatures the overlay would silently fall back to raw
// pixel positions, so exercise them against a real chart built by the real bundle.
section('runtime: chart_draw.js coordinate bridge on a live chart');
{
  const LWD = bootLightweightCharts(path.join(ROOT, 'lightweight-charts.standalone.production.js'));
  const d = LWD.sandbox;
  const reg = {};
  const del = id => (reg[id] || (reg[id] = Object.assign(LWD.makeEl(), { id, closest: () => null })));
  d.document.getElementById = del;
  d.document.createElement = () => LWD.makeEl();
  d.document.body = del('body');
  d.document.addEventListener = () => {};
  d.addEventListener = () => {};
  d.dispatchEvent = () => true;
  d.localStorage = { _s: {}, getItem(k) { return k in this._s ? this._s[k] : null; }, setItem(k, v) { this._s[k] = String(v); }, removeItem(k) { delete this._s[k]; } };
  d.CHART_DRAW_HOST = undefined;

  const chart = LWD.createChart({});
  const series = chart.addSeries(d.LightweightCharts.CandlestickSeries, {});
  LWD.flush();
  const bars = [];
  for (let i = 0; i < 120; i++) bars.push({ time: 1767225600 + i * 86400, open: 100 + i, high: 103 + i, low: 98 + i, close: 101 + i });
  series.setData(bars);
  LWD.flush();

  vm.runInContext('var _maxChartLayout = "1"; var _activeLayoutTile = 1; var _subLwCharts = {}; var _subLwSeries = {};', d);
  Object.assign(d, { __chart: chart, __series: series, __data: bars });
  vm.runInContext("var _sdMaximizedChartSymbol = 'TESTCO'; var _maxLwChart = __chart; var _maxLwPriceSeries = __series; var _maxCleanCandles = __data;", d);

  let drawErr = null;
  try { vm.runInContext(stripCR(read('chart_draw.js')), d, { filename: 'chart_draw.js' }); }
  catch (e) { drawErr = e; }
  check('chart_draw.js loads against a live v5 chart', !drawErr, drawErr && drawErr.message);

  if (!drawErr) {
    const canvas = del('max-chart-draw-canvas');
    canvas.clientWidth = 900;
    canvas.clientHeight = 500;
    let initErr = null;
    try { vm.runInContext('initChartDrawingCanvas();', d); } catch (e) { initErr = e; }
    check('initChartDrawingCanvas() wires the overlay', !initErr, initErr && initErr.message);

    const probes = [
      ['timeScale().logicalToCoordinate() returns a number', "typeof _maxLwChart.timeScale().logicalToCoordinate(60) === 'number'"],
      ['timeScale().coordinateToLogical() returns a number', "typeof _maxLwChart.timeScale().coordinateToLogical(400) === 'number'"],
      ['series.priceToCoordinate() returns a number', "typeof _maxLwPriceSeries.priceToCoordinate(150) === 'number'"],
      ['series.coordinateToPrice() returns a number', "typeof _maxLwPriceSeries.coordinateToPrice(300) === 'number'"],
      // A drawing point carries {x,y,logical,price}; pointToPixels must re-derive it from
      // the live scales rather than falling back to the stored (stale) pixels.
      ['pointToPixels re-derives from the live scales', "(() => { const p = pointToPixels({x:1,y:1,logical:60,price:150}, _maxLwChart.timeScale(), _maxLwPriceSeries); return p.x !== 1 && p.y !== 1; })()"],
      ['redrawChartDrawings() completes', '(() => { redrawChartDrawings(); return true; })()'],
    ];
    for (const [label, expr] of probes) {
      let ok = false, err = '';
      try { ok = vm.runInContext(expr, d) === true; } catch (e) { err = e.message; }
      check(label, ok, err);
    }
  }
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
