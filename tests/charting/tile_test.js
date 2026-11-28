const fs = require('fs');
const vm = require('vm');

// ---- minimal DOM stub ----
function makeEl(rect, id) {
  return {
    id,
    style: {},
    clientWidth: rect.width, clientHeight: rect.height,
    getBoundingClientRect: () => rect,
    addEventListener() {}, appendChild() {}, classList: { remove(){}, add(){}, toggle(){} },
    querySelectorAll: () => [],
  };
}
const STAGE = { left: 0, top: 0, width: 1000, height: 600 };
const TILE3 = { left: 0, top: 300, width: 500, height: 300 }; // bottom-left of a 2x2

const calls = [];
const ctx = new Proxy({}, {
  get(_, prop) {
    if (prop === 'canvas') return { width: 0, height: 0 };
    if (['measureText'].includes(prop)) return () => ({ width: 10 });
    if (['createLinearGradient'].includes(prop)) return () => ({ addColorStop(){} });
    return (...args) => { calls.push([prop, args]); };
  },
  set() { return true; }
});

const canvasEl = makeEl(STAGE, 'max-chart-draw-canvas');
canvasEl.getContext = () => ctx;
canvasEl.width = 1000; canvasEl.height = 600;

const els = {
  'max-chart-stage': makeEl(STAGE, 'max-chart-stage'),
  'max-chart-lw-container': makeEl(STAGE, 'max-chart-lw-container'),
  'max-chart-lw-container-3': makeEl(TILE3, 'max-chart-lw-container-3'),
  'max-chart-draw-canvas': canvasEl,
};

const sandbox = {
  console,
  document: {
    getElementById: id => els[id] || null,
    querySelectorAll: () => [],
    addEventListener() {},
    createElement: () => ({ style: {}, appendChild(){}, remove(){}, classList:{add(){},remove(){},toggle(){}} }),
  },
  window: { devicePixelRatio: 2, addEventListener() {}, CHART_DRAW_HOST: null },
  localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
  setTimeout, clearTimeout, requestAnimationFrame: fn => fn(), isFinite, Math, Date, JSON, Map, Set, Number, String, Array, Object, isNaN, parseInt, parseFloat,
  // chart_draw.js top-level depends on these app globals
  _maxChartLayout: '4',
  _activeLayoutTile: 3,
  _layoutSymbols: ['A','B','C','D'],
  _sdMaximizedChartSymbol: 'AAA',
  _maxLwChart: { timeScale: () => ({
      logicalToCoordinate: l => 10 + l * 5,
      coordinateToLogical: x => (x - 10) / 5,
      width: () => 435,
  }) },
  _maxLwPriceSeries: { priceToCoordinate: p => 300 - p, coordinateToPrice: y => 300 - y },
  _subLwCharts: [null,null,null,{ timeScale: () => ({
      logicalToCoordinate: l => 10 + l * 5,
      coordinateToLogical: x => (x - 10) / 5,
      width: () => 435,
  }) }],
  _subLwSeries: [null,null,null,{ priceToCoordinate: p => 300 - p, coordinateToPrice: y => 300 - y }],
  _subLwCandles: [null,null,null,[{time:1,open:10,high:12,low:9,close:11},{time:2,open:11,high:13,low:10,close:12}]],
  _maxCandles: [],
  _chartDrawings: { 'C': [{ type: 'ray_h', p1: { logical: 5, price: 100 }, p2: null, color:'#22c55e', width:1, style:'solid' }] },
  _activeDrawing: null, _selectedDrawingIndex: null, _drawMagnetMode: false,
  _currentDrawTool: 'select', _drawStep: 0, _drawStart: null, _dragMode: null, _dragHandle: null,
  _dragOrigin: null, _dragStartDrawing: null, _isDrawMouseDown: false,
};
sandbox.window.document = sandbox.document;
sandbox.global = sandbox;
sandbox.globalThis = sandbox;
vm.createContext(sandbox);

const code = fs.readFileSync('chart_draw.js', 'utf8');
vm.runInContext(code, sandbox, { filename: 'chart_draw.js' });
// _chartDrawings is declared with `let` inside chart_draw.js, so it shadows any
// sandbox global — inject the fixture through the interpreter instead.
vm.runInContext("_chartDrawings['C'] = [{ type:'ray_h', p1:{logical:5,price:100}, color:'#22c55e', width:1, style:'solid' }]", sandbox);

// ---- assertions ----
let pass = 0, fail = 0;
const check = (name, cond, extra) => {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : '')); }
};

const off = sandbox.getActiveTileOffset();
check('getActiveTileOffset finds tile 3 origin (0,300) size 500x300',
  off && off.dx === 0 && off.dy === 300 && off.w === 500 && off.h === 300, JSON.stringify(off));

console.log('  [debug] active drawing symbol =', sandbox.getActiveDrawingSymbol());
calls.length = 0;
sandbox.redrawChartDrawings();
console.log('  [debug] ctx calls =', calls.map(c=>c[0]).slice(0,12).join(','));
const translate = calls.find(c => c[0] === 'translate');
check('redraw translates drawings into tile space', translate && translate[1][0] === 0 && translate[1][1] === 300,
  JSON.stringify(translate));

const clip = calls.find(c => c[0] === 'rect');
check('clip rect is the tile pane, not the whole stage',
  clip && clip[1][0] === 0 && clip[1][1] === 300 && clip[1][3] === 300, JSON.stringify(clip));

// single-layout must not translate
sandbox._maxChartLayout = '1';
sandbox._activeLayoutTile = 1;
check('single layout => no tile offset', sandbox.getActiveTileOffset() === null);
console.log('  [debug] active drawing symbol =', sandbox.getActiveDrawingSymbol());
calls.length = 0;
sandbox.redrawChartDrawings();
console.log('  [debug] ctx calls =', calls.map(c=>c[0]).slice(0,12).join(','));
check('single layout => no translate() call', !calls.find(c => c[0] === 'translate'));

// magnet candles resolve without ReferenceError
sandbox._maxChartLayout = '4'; sandbox._activeLayoutTile = 3;
let magnetOk = true;
try { sandbox.getActiveDrawCandles(); } catch (e) { magnetOk = false; }
check('getActiveDrawCandles resolves sub-tile candles (no ReferenceError)', magnetOk);

// Geometry check: emulate the transform stack and confirm the horizontal ray from a
// tile-3 drawing lands inside tile 3's rect (y in [300,600]), not tile 1's (y in [0,300]).
{
  const dpr = 2, off2 = sandbox.getActiveTileOffset();
  const m = [dpr,0,0,dpr,0,0];                      // setTransform
  m[4] += off2.dx * dpr; m[5] += off2.dy * dpr;     // translate
  const localY = 300 - 100;                          // series.priceToCoordinate(100)
  const canvasY = m[5] + localY * m[3];
  const cssY = canvasY / dpr;
  check('ray lands inside tile 3 (css y ' + cssY + ' in 300..600)', cssY >= 300 && cssY <= 600, 'cssY=' + cssY);
}

// Clip must reject a point in tile 1 and accept one inside tile 3.
function insideClip(x, y, t) { return x >= t.dx && x <= t.dx + 500 && y >= t.dy && y <= t.dy + t.h; }
{
  const t = sandbox.getActiveTileOffset();
  check('clip excludes tile-1 region', !insideClip(100, 100, t));
  check('clip includes tile-3 region', insideClip(100, 450, t));
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
