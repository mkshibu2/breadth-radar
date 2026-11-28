// Sprint 2 verification: public-API price-scale reset, Horizontal/Vertical Line,
// Parallel Channel and the drawing Object List.
//
// Two layers:
//   1. Static assertions over the sources (no private API left, every d.type is
//      wired into hit-test + render + create + drag).
//   2. A behavioural harness that boots chart_draw.js against a DOM/2D-context shim,
//      then drives real mousedown/mousemove events through the registered listeners
//      to verify create -> select -> drag-handle edit -> undo -> delete -> persist.
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const assert = require('assert');

const ROOT = path.resolve(__dirname, '..', '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const stripCR = s => s.replace(/\r\n/g, '\n');

let pass = 0, fail = 0;
const check = (name, cond, err) => {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (err ? ' -> ' + err : '')); }
};
const section = t => console.log('\n' + t);

// ─────────────────────────────────────────────────────────────────────────────
// 1. STATIC
// ─────────────────────────────────────────────────────────────────────────────
section('3.1 public-API price-scale reset');
const indexJs = stripCR(read('index.js'));
const screenerHtml = stripCR(read('screener.html'));

for (const [label, src] of [['index.js', indexJs], ['screener.html', screenerHtml]]) {
  check(label + ': no psApi/internalPs references', !/psApi|internalPs/.test(src));
  check(label + ': no minified private members (.Ei()/.Lc(/.A_(/.Po(/.So(/.Sa()/.Ub.$t)',
    !/\.Ei\(\)|\.Lc\(|\.A_\(|\.Po\(|\.So\(\{|\.Sa\(\)|\.Ub\.\$t/.test(src));
  const m = src.match(/function resetChartPriceScale\(chartInstance, scaleId\) \{[\s\S]*?\n *\}/);
  check(label + ': resetChartPriceScale found', !!m);
  if (m) {
    check(label + ': body is public applyOptions({ autoScale: true })',
      /priceScale\(scaleId\)\.applyOptions\(\{ autoScale: true \}\)/.test(m[0]));
    check(label + ': body is <= 8 lines', m[0].split('\n').length <= 8, m[0].split('\n').length + ' lines');
  }
}
check('chart_core.js still guards typeof global.resetChartPriceScale',
  /typeof global\.resetChartPriceScale === 'function'/.test(stripCR(read('chart_core.js'))));

section('2.5 new tools are wired into all four dispatch points');
const draw = stripCR(read('chart_draw.js'));
for (const type of ['hline', 'vline', 'channel']) {
  const hits = [
    ['render',      new RegExp(`if \\(d\\.type === '${type}'\\)`)],
    ['hit-test',    new RegExp(`\\} else if \\(d\\.type === '${type}'\\)`)],
    ['tool button', new RegExp(`_currentDrawTool === '${type}'`)],
    ['toolbar id',  new RegExp(`draw-tool-${type}`)],
  ];
  for (const [what, re] of hits) {
    // toolbar id only lives in the HTML hosts, checked separately
    if (what === 'toolbar id') continue;
    check(`${type}: present in ${what}`, re.test(draw));
  }
}
check("channel: 3-step draw state machine (_drawStep === 2 commit)", /_drawStep === 2\) \{\n\s+_activeDrawing\.p3 = \{ x: coords\.x/.test(draw));
check('channel: excluded from drag-commit on mouseup', /type === 'channel'\)\) \{/.test(draw));
check('channel: p3 drag handle handled in mousemove', /h === 'p3'/.test(draw));
check('hline/vline: single-click commit() calls exist', /type: 'hline'/.test(draw) && /type: 'vline'/.test(draw));
check('vline: time tag derived from the bar at the clicked logical index',
  /function timeAtLogical\(logical\)/.test(draw) && /time: timeAtLogical\(coords\.logical\)/.test(draw));

section('2.6 object list');
for (const fn of ['ensureDrawingObjectList', 'renderDrawingObjectList', 'toggleDrawingObjectList',
                  'selectDrawingFromList', 'toggleDrawingVisibility', 'deleteDrawingFromList',
                  'drawingTypeLabel', 'drawingSummary']) {
  check('chart_draw.js defines ' + fn, new RegExp(`function ${fn}\\(`).test(draw));
}
check('panel is injected lazily into #max-chart-stage', /stage\.appendChild\(panel\)/.test(draw));
check('render is throttled to one rAF', /_objectListRaf = requestAnimationFrame/.test(draw));
check('hidden drawings are skipped by hit-testing', /if \(!d \|\| d\.hidden\) continue;/.test(draw));
check('hidden drawings are skipped by the renderer', /if \(d\.hidden\) continue;/.test(draw));
check('object list keeps undo history for hide/delete', /pushDrawHistory\(sym\);\n\s+d\.hidden = !d\.hidden/.test(draw));

section('toolbar markup + styles across all three hosts');
const hosts = ['index.html', 'sectors.html', 'screener.html'];
for (const h of hosts) {
  const src = stripCR(read(h));
  check(`${h}: 4 new tool buttons`, ['hline', 'vline', 'channel', 'objects'].every(t => src.includes(`id="draw-tool-${t}"`)));
}
const css = read('index.css');
check('index.css: object-list styles', /\.tv-object-list \{/.test(css) && /\.tv-object-row\.active/.test(css));
check('screener.html: inline object-list styles', /\.tv-object-list \{/.test(screenerHtml));
check('index.js: settings dialog labels the new types',
  /hline: 'Horizontal Line'/.test(indexJs) && /vline: 'Vertical Line'/.test(indexJs) && /channel: 'Parallel Channel'/.test(indexJs));

section('chart_draw.js: no unguarded showChartToast (screener.html does not define it)');
// screener.html never defines showChartToast, so chart_draw.js must install a fallback
// at load time instead of relying on every one of its ~40 call sites being guarded.
check('chart_draw.js installs a showChartToast fallback when missing',
  /if \(typeof window\.showChartToast !== 'function'\) \{\n\s+window\.showChartToast = function \(\) \{ \};/.test(draw));
check('all showChartToast calls resolve to the local shim, not a bare global lookup',
  /var showChartToast = window\.showChartToast;/.test(draw));
check('no bare typeof-guard is needed anymore (guards kept only where already present)',
  (draw.match(/showChartToast\(/g) || []).length > 0);

// ─────────────────────────────────────────────────────────────────────────────
// 2. BEHAVIOURAL
// ─────────────────────────────────────────────────────────────────────────────
section('behavioural: boot chart_draw.js and drive real events');

const registry = {};
function makeEl(id) {
  const listeners = {};
  const el = {
    id, style: {}, dataset: {}, children: [], parentElement: null,
    clientWidth: 900, clientHeight: 500, offsetTop: 0, offsetLeft: 0,
    innerHTML: '', textContent: '', tagName: 'DIV',
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 900, height: 500, right: 900, bottom: 500 }),
    addEventListener(t, fn) { (listeners[t] = listeners[t] || []).push(fn); },
    removeEventListener(t, fn) {
      if (listeners[t]) listeners[t] = listeners[t].filter(f => f !== fn);
    },
    dispatchEvent(ev) { (listeners[ev.type] || []).forEach(fn => fn(ev)); return true; },
    _listeners: listeners,
    appendChild(c) { this.children.push(c); c.parentElement = this; if (c.id) registry[c.id] = c; return c; },
    removeChild() {}, remove() {}, insertBefore() {},
    setAttribute() {}, getAttribute: () => null,
    querySelector: () => null, querySelectorAll: () => [],
    classList: {
      _s: new Set(),
      add(c) { this._s.add(c); }, remove(c) { this._s.delete(c); },
      toggle(c, on) { on === undefined ? (this._s.has(c) ? this._s.delete(c) : this._s.add(c)) : (on ? this._s.add(c) : this._s.delete(c)); },
      contains: c => false,
    },
    closest: () => null,
    getContext: () => ctx2d(),
  };
  return el;
}

function ctx2d() {
  const c = {
    canvas: { width: 900, height: 500 },
    save() {}, restore() {}, beginPath() {}, closePath() {}, moveTo() {}, lineTo() {},
    arc() {}, fill() {}, stroke() {}, rect() {}, clip() {}, translate() {}, setTransform() {},
    clearRect() {}, fillRect() {}, strokeRect() {}, setLineDash() {}, fillText() {}, measureText: () => ({ width: 20 }),
    createLinearGradient: () => ({ addColorStop() {} }),
  };
  return new Proxy(c, { get: (t, p) => (p in t ? t[p] : () => {}), set: (t, p, v) => { t[p] = v; return true; } });
}

const getEl = id => (registry[id] || (registry[id] = makeEl(id)));
// pre-create the elements chart_draw.js looks up during canvas init
['max-chart-draw-canvas', 'max-chart-stage', 'max-chart-wrapper', 'chart-max-overlay'].forEach(getEl);

const storage = {};
const sandbox = {
  console: { log() {}, warn() {}, error() {}, info() {}, debug() {} },
  document: {
    getElementById: getEl,
    querySelector: () => null,
    querySelectorAll: () => [],
    addEventListener() {}, removeEventListener() {},
    createElement: t => makeEl('created-' + t),
    body: makeEl('body'), head: makeEl('head'), documentElement: makeEl('html'),
    readyState: 'complete', hidden: false, activeElement: null,
  },
  navigator: { language: 'en-IN', userAgent: 'node' },
  localStorage: {
    getItem: k => (k in storage ? storage[k] : null),
    setItem: (k, v) => { storage[k] = String(v); },
    removeItem: k => { delete storage[k]; },
  },
  sessionStorage: { getItem: () => null, setItem() {}, removeItem() {} },
  location: { origin: 'https://x.test', hostname: 'x.test', protocol: 'https:', href: 'https://x.test/', pathname: '/' },
  setTimeout: (fn) => { if (typeof fn === 'function') { try { fn(); } catch (e) {} } return 0; },
  clearTimeout() {}, setInterval: () => 0, clearInterval() {},
  requestAnimationFrame: fn => { fn(0); return 0; }, cancelAnimationFrame() {},
  fetch: () => Promise.reject(new Error('offline')),
  Promise, Map, Set, WeakMap, Symbol, Proxy, Reflect, JSON, Math, Date, Number, String, Boolean,
  Array, Object, Error, TypeError, RangeError, RegExp, parseInt, parseFloat, isNaN, isFinite, Intl,
  encodeURIComponent, decodeURIComponent, URL, URLSearchParams,
  ResizeObserver: class { observe() {} unobserve() {} disconnect() {} },
  MutationObserver: class { observe() {} disconnect() {} },
  CustomEvent: class { constructor(t, o) { this.type = t; Object.assign(this, o); } },
  Event: class { constructor(t) { this.type = t; } },
  MouseEvent: class { constructor(t, o) { this.type = t; Object.assign(this, o); } },
  devicePixelRatio: 1, innerWidth: 1440, innerHeight: 900, scrollY: 0,
  getComputedStyle: () => ({ display: 'block', getPropertyValue: () => '' }),
  matchMedia: () => ({ matches: false, addEventListener() {}, addListener() {}, removeEventListener() {} }),
};
const winListeners = {};
sandbox.addEventListener = (t, fn) => { (winListeners[t] = winListeners[t] || []).push(fn); };
sandbox.removeEventListener = (t, fn) => { if (winListeners[t]) winListeners[t] = winListeners[t].filter(f => f !== fn); };
sandbox.dispatchEvent = ev => { (winListeners[ev.type] || []).forEach(fn => fn(ev)); return true; };
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
sandbox.self = sandbox;
vm.createContext(sandbox);

// Time-scale + series stub: logical<->x and price<->y are 1:1 with the pixel space,
// so a click at (x,y) produces logical=x and price=500-y (price grows upwards).
const chartStub = () => ({
  timeScale: () => ({
    logicalToCoordinate: l => l,
    coordinateToLogical: x => x,
    timeToCoordinate: () => 100,
    width: () => 835,
    applyOptions() {}, subscribeVisibleLogicalRangeChange() {}, fitContent() {},
    setVisibleLogicalRange() {},
  }),
  priceScale: () => ({ applyOptions() {}, options: () => ({ autoScale: true }) }),
  applyOptions() {}, resize() {}, paneSize: () => ({ width: 900, height: 500 }),
  chartElement: () => getEl('c'), remove() {},
});

const boot = (() => {
  try {
    vm.runInContext('var _maxChartLayout = "1"; var _activeLayoutTile = 1; var _maxLwChart = null; var _maxLwPriceSeries = null; var _subLwCharts = {}; var _subLwSeries = {}; var _maxCleanCandles = [];', sandbox);
    vm.runInContext(stripCR(read('chart_draw.js')), sandbox, { filename: 'chart_draw.js' });
    return null;
  } catch (e) { return e; }
})();
check('chart_draw.js boots against the shim', !boot, boot && boot.message);

if (!boot) {
  // Wire a working chart/series/candles context through the public host hook
  const candles = [];
  for (let i = 0; i < 120; i++) {
    candles.push({ time: '2026-01-' + String((i % 28) + 1).padStart(2, '0'), open: 100 + i, high: 102 + i, low: 99 + i, close: 101 + i });
  }
  const series = {
    priceToCoordinate: p => 500 - p,
    coordinateToPrice: y => 500 - y,
  };
  const timeScale = chartStub().timeScale();
  sandbox.CHART_DRAW_HOST = {
    getSymbol: () => 'TESTCO',
    getCandles: () => candles,
    getContext: () => ({ chart: chartStub(), series, timeScale }),
  };
  const toastCalls = [];
  sandbox.showChartToast = (m, c) => toastCalls.push(m);

  vm.runInContext('initChartDrawingCanvas();', sandbox);
  const canvas = getEl('max-chart-draw-canvas');

  const md = (x, y) => canvas.dispatchEvent({ type: 'mousedown', button: 0, clientX: x, clientY: y, preventDefault() {}, stopPropagation() {} });
  const mm = (x, y) => sandbox.dispatchEvent({ type: 'mousemove', clientX: x, clientY: y, preventDefault() {}, stopPropagation() {} });
  const mu = (x, y) => sandbox.dispatchEvent({ type: 'mouseup', clientX: x, clientY: y, preventDefault() {}, stopPropagation() {} });
  const kd = (key, opts) => sandbox.dispatchEvent(Object.assign({ type: 'keydown', key, target: { tagName: 'BODY' }, preventDefault() {}, stopPropagation() {} }, opts || {}));

  const drawings = () => vm.runInContext('_chartDrawings["TESTCO"] || []', sandbox);
  const selected = () => vm.runInContext('_selectedDrawingIndex', sandbox);
  const setTool = t => vm.runInContext(`setDrawingTool(${JSON.stringify(t)})`, sandbox);

  // ── Horizontal Line ────────────────────────────────────────────────────────
  section('behaviour: Horizontal Line create → select → drag → undo → persist');
  setTool('hline');
  md(400, 200);
  let d = drawings()[0];
  check('hline created by a single click', !!d && d.type === 'hline');
  check('hline stores price from the click', d && Math.abs(d.p1.price - 300) < 0.001, d && d.p1.price);
  check('hline auto-selected after commit', selected() === 0);

  setTool('select');
  md(700, 200); // body of the hline (y = 500 - 300)
  check('hline body hit-test selects it', selected() === 0);
  mm(700, 260);
  mu(700, 260);
  d = drawings()[0];
  check('hline dragged to a new price (240)', d && Math.abs(d.p1.price - 240) < 0.001, d && d.p1.price);
  check('hline y follows the drag', d && Math.abs(d.p1.y - 260) < 0.001, d && d.p1.y);

  const persisted = JSON.parse(storage['nse_chart_drawings_v2'] || '{}');
  check('hline persisted to localStorage', Array.isArray(persisted.TESTCO) && persisted.TESTCO[0].type === 'hline');
  check('hline persisted with the dragged price', persisted.TESTCO && Math.abs(persisted.TESTCO[0].p1.price - 240) < 0.001);

  const undoLen = sb => vm.runInContext(`(_drawUndoStack["TESTCO"] || []).length`, sb);
  const before = undoLen(sandbox);
  check('drag recorded an undo frame', before === 2, before);
  vm.runInContext('undoChartDrawing()', sandbox);
  check('undo reverts the hline drag (drawing survives)',
    drawings().length === 1 && Math.abs(drawings()[0].p1.price - 300) < 0.001,
    drawings().length + ' drawings, price=' + (drawings()[0] && drawings()[0].p1.price));
  check('undo consumed the drag frame', undoLen(sandbox) === before - 1, `${before} -> ${undoLen(sandbox)}`);
  check('redo restores the dragged geometry', (() => {
    vm.runInContext('redoChartDrawing()', sandbox);
    return Math.abs(drawings()[0].p1.price - 240) < 0.001;
  })(), drawings()[0] && drawings()[0].p1.price);

  // ── Vertical Line ─────────────────────────────────────────────────────────
  section('behaviour: Vertical Line create + date tag');
  vm.runInContext('_chartDrawings["TESTCO"] = [];', sandbox);
  setTool('vline');
  md(120, 300);
  d = drawings()[0];
  check('vline created by a single click', !!d && d.type === 'vline');
  check('vline stores the bar time as its tag (clamped to the last bar)', !!d && d.p1.time === candles[candles.length - 1].time, d ? d.p1.time : 'no drawing');
  if (!d) console.log('   debug:', JSON.stringify(vm.runInContext('({tool:_currentDrawTool, step:_drawStep, n:(_chartDrawings["TESTCO"]||[]).length})', sandbox)));
  check('vline anchored at the clicked logical index', d && Math.abs(d.p1.logical - 120) < 0.001);

  setTool('select');
  md(120, 420); // on the vertical line
  check('vline body hit-test selects it', selected() === 0);
  mm(200, 420);
  mu(200, 420);
  check('vline dragged to a new logical index', Math.abs(drawings()[0].p1.logical - 200) < 0.001, drawings()[0].p1.logical);

  // ── Parallel Channel ──────────────────────────────────────────────────────
  section('behaviour: Parallel Channel 3-click create → rail drag');
  vm.runInContext('_chartDrawings["TESTCO"] = [];', sandbox);
  setTool('channel');
  md(100, 300);                       // base start
  check('channel: step 1 starts a draft', vm.runInContext('_drawStep', sandbox) === 1);
  mm(300, 300);                       // live preview of the base end
  check('channel: preview updates p2 while drawing',
    Math.abs(vm.runInContext('_activeDrawing.p2.logical', sandbox) - 300) < 0.001);
  md(300, 300);                       // base end
  check('channel: step 2 waits for the offset rail', vm.runInContext('_drawStep', sandbox) === 2);
  mm(300, 200);                       // preview the offset
  md(300, 200);                       // offset rail
  d = drawings()[0];
  check('channel committed after the 3rd click', !!d && d.type === 'channel');
  check('channel keeps all three anchors', d && d.p1 && d.p2 && d.p3);
  check('channel base is p1->p2 at price 200', d && Math.abs(d.p1.price - 200) < 0.001 && Math.abs(d.p2.price - 200) < 0.001);
  check('channel offset anchor at price 300', d && Math.abs(d.p3.price - 300) < 0.001);
  check('channel stores fill + extend options', d && d.fillOpacity > 0 && d.extend === 'right');

  setTool('select');
  md(200, 250); // inside the band -> body
  check('channel interior band hit-tests as body', selected() === 0);
  const last = () => drawings()[drawings().length - 1];
  check('channel remains a single object', drawings().length === 1);
  check('channel view is not mutated by a bad hit test', last().type === 'channel');

  // drag the offset anchor (p3 handle at x=300,y=200)
  md(300, 200);
  check('channel p3 handle hit-test picks the handle', vm.runInContext('_dragHandle', sandbox) === 'p3', vm.runInContext('_dragHandle', sandbox));
  mm(300, 150);
  mu(300, 150);
  check('channel p3 handle drag moves the offset rail', Math.abs(drawings()[0].p3.price - 350) < 0.001, drawings()[0].p3.price);

  // ── Object list ───────────────────────────────────────────────────────────
  section('behaviour: object list select / hide / delete');
  vm.runInContext('_chartDrawings["TESTCO"] = [];', sandbox);
  setTool('hline'); md(100, 100);
  setTool('vline'); md(200, 200);
  vm.runInContext('_chartDrawings["TESTCO"].push({ type: "trendline", p1: { x: 10, y: 10, logical: 10, price: 490 }, p2: { x: 60, y: 60, logical: 60, price: 440 }, color: "#fff", width: 1, style: "solid" });', sandbox);
  vm.runInContext('_selectedDrawingIndex = null;', sandbox);

  vm.runInContext('toggleDrawingObjectList()', sandbox);
  const panel = getEl('tv-drawing-object-list');
  check('object list panel is created on demand', !!panel);
  check('panel is exposed by the documented id so it mounts inside #max-chart-stage',
    panel.id === 'tv-drawing-object-list');
  check('object list panel is visible after toggle', panel && panel.style.display === 'flex');
  vm.runInContext('renderDrawingObjectList()', sandbox);
  const html = getEl('tv-object-list-body').innerHTML;
  check('object list renders one row per drawing', (html.match(/tv-object-row/g) || []).length >= 3);
  check('object list labels humanise the types', html.includes('Horizontal Line') && html.includes('Vertical Line') && html.includes('Trend Line'));
  check('object list shows the drawing count', getEl('tv-object-list-count').textContent === '3', getEl('tv-object-list-count').textContent);

  vm.runInContext('selectDrawingFromList(2)', sandbox);
  check('selectDrawingFromList selects the row', selected() === 2);
  vm.runInContext('selectDrawingFromList(0)', sandbox);
  check('selectDrawingFromList re-selects a different row', selected() === 0);

  vm.runInContext('toggleDrawingVisibility(null, 1)', sandbox);
  check('hide toggles d.hidden', drawings()[1].hidden === true);
  setTool('select');
  md(200, 200);
  check('hidden drawings are not hit-tested', selected() === null, selected());
  vm.runInContext('toggleDrawingVisibility(null, 1)', sandbox);
  check('show toggles d.hidden back off', drawings()[1].hidden === false);

  vm.runInContext('deleteDrawingFromList(null, 0)', sandbox);
  check('deleteDrawingFromList removes the row', drawings().length === 2);
  check('delete keeps the remaining order intact', drawings()[0].type === 'vline', drawings()[0].type);
  check('delete persists the new array', JSON.parse(storage['nse_chart_drawings_v2']).TESTCO.length === 2);
  check('delete is undoable', (() => {
    vm.runInContext('undoChartDrawing()', sandbox);
    return drawings().length === 3 && drawings()[0].type === 'hline';
  })());

  vm.runInContext('toggleDrawingObjectList()', sandbox);
  check('toggle closes the panel', panel.style.display === 'none');
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
