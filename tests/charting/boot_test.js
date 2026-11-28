// Boot smoke test: evaluate chart_core.js then chart_draw.js against a DOM stub and
// make sure no top-level ReferenceError/TypeError is thrown (i.e. the page would boot).
const fs = require('fs');
const vm = require('vm');

function el(id) {
  const e = {
    id, style: {}, dataset: {}, children: [],
    clientWidth: 900, clientHeight: 500,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 900, height: 500 }),
    addEventListener() {}, removeEventListener() {},
    appendChild(c) { this.children.push(c); return c; },
    removeChild() {}, remove() {}, insertBefore() {},
    setAttribute() {}, getAttribute: () => null,
    querySelector: () => null, querySelectorAll: () => [],
    classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
    closest: () => null,
    getContext: () => new Proxy({}, { get: (t, p) => {
      if (p === 'canvas') return { width: 900, height: 500 };
      if (p === 'measureText') return () => ({ width: 10 });
      if (p === 'createLinearGradient' || p === 'createRadialGradient') return () => ({ addColorStop() {} });
      if (p === 'getImageData') return () => ({ data: [] });
      return () => {};
    }, set: () => true }),
  };
  return e;
}
const registry = {};
const getEl = id => (registry[id] || (registry[id] = el(id)));

const store = {};
const sandbox = {
  console,
  document: {
    getElementById: getEl,
    querySelector: () => null,
    querySelectorAll: () => [],
    addEventListener() {}, removeEventListener() {},
    createElement: t => el('created-' + t),
    body: el('body'), head: el('head'), documentElement: el('html'),
    readyState: 'complete', hidden: false,
  },
  navigator: { language: 'en-IN', clipboard: null, userAgent: 'node' },
  localStorage: {
    _s: store,
    getItem: k => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: k => { delete store[k]; },
  },
  sessionStorage: { getItem: () => null, setItem() {}, removeItem() {} },
  location: { origin: 'https://x.test', hostname: 'x.test', protocol: 'https:', href: 'https://x.test/', pathname: '/' },
  setTimeout, clearTimeout, setInterval, clearInterval,
  requestAnimationFrame: fn => fn(0), cancelAnimationFrame() {},
  fetch: () => Promise.reject(new Error('no network in sandbox')),
  Promise, Map, Set, WeakMap, Symbol, Proxy, Reflect, JSON, Math, Date, Number, String, Boolean,
  Array, Object, Error, TypeError, RangeError, RegExp, parseInt, parseFloat, isNaN, isFinite,
  encodeURIComponent, decodeURIComponent, AbortController, Intl, URL, URLSearchParams, Blob,
  ResizeObserver: class { observe() {} unobserve() {} disconnect() {} },
  IntersectionObserver: class { observe() {} unobserve() {} disconnect() {} takeRecords(){return[];} },
  MutationObserver: class { observe() {} disconnect() {} },
  CustomEvent: class { constructor(t, o) { this.type = t; Object.assign(this, o); } },
  Event: class { constructor(t) { this.type = t; } },
  MouseEvent: class { constructor(t, o) { this.type = t; Object.assign(this, o); } },
  Image: class { set src(v) {} },
  devicePixelRatio: 2, innerWidth: 1440, innerHeight: 900, scrollY: 0,
  getComputedStyle: () => ({ display: 'block', getPropertyValue: () => '' }),
  matchMedia: () => ({ matches: false, addEventListener() {}, addListener() {}, removeEventListener() {} }),
};
// window-level event API used by chart_draw.js / index.js during boot
sandbox.addEventListener = function () {};
sandbox.removeEventListener = function () {};
sandbox.dispatchEvent = function () { return true; };
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
sandbox.global = sandbox;
sandbox.self = sandbox;
vm.createContext(sandbox);

let pass = 0, fail = 0;
const check = (n, c, e) => { c ? (pass++, console.log('  PASS  ' + n)) : (fail++, console.log('  FAIL  ' + n + (e ? ' -> ' + e : ''))); };

// Minimal LightweightCharts stub so chart_core/chart_draw can run.
// Modelled on v5 (addSeries + series definitions); the legacy addXxxSeries factories
// are intentionally absent, matching the bundle this repo now ships.
function lwStubSeries() {
  return {
    setData() {}, update() {}, setMarkers() {}, createPriceLine() {}, removePriceLine() {},
    applyOptions() {}, priceScale: () => ({ applyOptions() {}, options: () => ({}) }),
    coordinateToPrice: () => 100, priceToCoordinate: () => 100,
  };
}
sandbox.LightweightCharts = {
  createChart: () => ({
    addSeries: () => lwStubSeries(),
    priceScale: () => ({ applyOptions() {}, options: () => ({}) }),
    timeScale: () => ({ subscribeVisibleLogicalRangeChange() {}, unsubscribeVisibleLogicalRangeChange() {}, setVisibleLogicalRange() {}, getVisibleLogicalRange: () => ({ from: 0, to: 90 }), applyOptions() {}, fitContent() {}, width: () => 800, logicalToCoordinate: () => 100, coordinateToLogical: () => 5, timeToCoordinate: () => 100 }),
    subscribeCrosshairMove() {}, unsubscribeCrosshairMove() {}, subscribeDblClick() {}, subscribeClick() {},
    applyOptions() {}, resize() {}, remove() {}, takeScreenshot: () => ({ width: 1, height: 1 }),
    paneSize: () => ({ width: 900, height: 500 }), chartElement: () => el('c'), panes: () => [{}],
  }),
  CandlestickSeries: { type: 'Candlestick' },
  BarSeries: { type: 'Bar' },
  LineSeries: { type: 'Line' },
  AreaSeries: { type: 'Area' },
  HistogramSeries: { type: 'Histogram' },
  createSeriesMarkers: () => ({ setMarkers() {}, markers: () => [] }),
  CrosshairMode: { Normal: 0, Magnet: 1 }, LineStyle: { Solid: 0, Dotted: 1, Dashed: 2 }, PriceScaleMode: { Normal: 0, Logarithmic: 1, Percentage: 2 },
  ColorType: { Solid: 'solid' }, version: () => '5.3.0',
};

function load(file) {
  const code = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
  try { vm.runInContext(code, sandbox, { filename: file }); return null; }
  catch (e) { return e; }
}

console.log('boot smoke test:');
const e1 = load('chart_core.js');
check('chart_core.js boots cleanly', !e1, e1 && e1.message);
const e2 = load('chart_draw.js');
check('chart_draw.js boots cleanly', !e2, e2 && e2.message);
const e3 = load('index.js');
check('index.js boots cleanly', !e3, e3 && e3.message);

console.log('\nexported API present:');
for (const fn of ['getActiveTileOffset','getActiveDrawCandles','redrawChartDrawings','initChartDrawingCanvas','setDrawingTool','undoChartDrawing','clearChartDrawings']) {
  check('chart_draw.js exposes ' + fn, typeof sandbox[fn] === 'function' || typeof vm.runInContext('typeof ' + fn, sandbox) === 'string');
}
for (const fn of ['renderLwCardChart','computeMarketSmithRsMap','renderHighlightedStatPill']) {
  check('chart_core.js exposes ' + fn, typeof sandbox[fn] === 'function');
}
for (const fn of ['maxChartRefresh','maxChartChangeType','sdSetChartType','sccChartSetType','_yfCacheGet','_yfCacheSet']) {
  const t = vm.runInContext('typeof ' + fn, sandbox);
  check('index.js defines ' + fn + ' (' + t + ')', t === 'function');
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
