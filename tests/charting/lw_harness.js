// Boots a real LightweightCharts standalone bundle inside a `vm` sandbox with a
// minimal-but-faithful DOM shim, so the charting code can be exercised headlessly.
// No jsdom / no browser: everything here is hand-rolled so CI only needs bare Node.
//
// Why this exists: the repo talks to LightweightCharts through ~20 call sites. A
// version bump cannot be verified by `node --check` alone — v5 silently removed
// `addCandlestickSeries()` and `series.setMarkers()`, and both fail only at runtime,
// on a page whose charts would simply come up blank.

const fs = require('fs');
const vm = require('vm');

// Browsers resolve any CSS colour to rgb()/rgba(); LightweightCharts' colour parser
// relies on that, so emulate it rather than feeding raw hex back.
function normalizeColor(v) {
  if (!v) return 'rgb(0, 0, 0)';
  v = String(v).trim();
  if (/^rgba?\(/.test(v)) return v;
  const hex = v.match(/^#([0-9a-f]{3,8})$/i);
  if (hex) {
    let h = hex[1];
    if (h.length === 3 || h.length === 4) h = h.split('').map(c => c + c).join('');
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    const a = h.length >= 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1;
    return 'rgba(' + r + ', ' + g + ', ' + b + ', ' + a + ')';
  }
  const named = { white: 'rgb(255, 255, 255)', black: 'rgb(0, 0, 0)', transparent: 'rgba(0, 0, 0, 0)' };
  return named[v.toLowerCase()] || 'rgb(0, 0, 0)';
}

function makeCtx2d() {
  const base = {
    canvas: { width: 900, height: 500 },
    measureText: () => ({ width: 10, actualBoundingBoxAscent: 8, actualBoundingBoxDescent: 2 }),
  };
  const target = Object.assign({}, base);
  const canvasMethods = ['save', 'restore', 'scale', 'translate', 'rotate', 'transform', 'setTransform',
    'resetTransform', 'beginPath', 'closePath', 'moveTo', 'lineTo', 'bezierCurveTo', 'quadraticCurveTo',
    'arc', 'arcTo', 'ellipse', 'rect', 'fill', 'stroke', 'clip', 'fillRect', 'strokeRect', 'clearRect',
    'fillText', 'strokeText', 'setLineDash', 'getLineDash', 'drawImage', 'putImageData',
    'createLinearGradient', 'createRadialGradient', 'createPattern', 'setTransform'];
  for (const m of canvasMethods) target[m] = () => (m.startsWith('create') ? { addColorStop() {} } : undefined);
  target.getLineDash = () => [];
  target.getImageData = () => ({ data: new Uint8ClampedArray(4) });
  return new Proxy(target, {
    get: (t, p) => (p in t ? t[p] : () => undefined),
    set: (t, p, v) => { t[p] = v; return true; },
  });
}

/**
 * @param {string} bundlePath absolute path to lightweight-charts.standalone.production.js
 * @returns {{LightweightCharts:object, sandbox:object, flush:Function, createChart:Function,
 *            makeEl:Function, errors:string[]}}
 */
function bootLightweightCharts(bundlePath) {
  const src = fs.readFileSync(bundlePath, 'utf8');
  const errors = [];
  const rafQueue = [];

  let DOC = null;
  const makeEl = () => {
    const e = {
      style: { width: '900px', height: '500px' },
      children: [],
      clientWidth: 900, clientHeight: 500, width: 900, height: 500,
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 900, height: 500, right: 900, bottom: 500 }),
      getClientRects: () => [{ left: 0, top: 0, width: 900, height: 500, right: 900, bottom: 500 }],
      addEventListener() {}, removeEventListener() {},
      appendChild(c) { this.children.push(c); return c; },
      removeChild() {}, insertBefore() {},
      setAttribute() {}, getAttribute: () => null, toggleAttribute() {},
      getContext: () => makeCtx2d(),
      querySelector: () => null, querySelectorAll: () => [],
      classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
      parentElement: null,
    };
    e.ownerDocument = DOC;
    return e;
  };

  const doc = {
    getElementById: () => makeEl(),
    createElement: () => makeEl(),
    querySelector: () => null,
    querySelectorAll: () => [],
    addEventListener() {}, removeEventListener() {},
    body: null, head: null, documentElement: null,
    readyState: 'complete',
  };
  doc.body = makeEl(); doc.head = makeEl(); doc.documentElement = makeEl();
  DOC = doc;

  const sandbox = {
    console: { log() {}, warn(...a) { errors.push('warn: ' + a.join(' ')); }, error(...a) { errors.push('error: ' + a.join(' ')); }, info() {}, debug() {} },
    document: doc,
    navigator: { userAgent: 'node', language: 'en', platform: 'node' },
    setTimeout: () => 0, clearTimeout() {},
    setInterval: () => 0, clearInterval() {},
    requestAnimationFrame: fn => { rafQueue.push(fn); return rafQueue.length; },
    cancelAnimationFrame() {},
    devicePixelRatio: 1, innerWidth: 1440, innerHeight: 900,
    addEventListener() {}, removeEventListener() {},
    performance: { now: () => Date.now() },
    getComputedStyle: e => ({
      getPropertyValue: () => '',
      display: 'block',
      get color() { return normalizeColor(e && e.style ? e.style.color : '#000'); },
    }),
    // v4 uses the legacy addListener/removeListener pair, v5 uses addEventListener.
    matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }),
    ResizeObserver: class { observe() {} unobserve() {} disconnect() {} },
    MutationObserver: class { observe() {} disconnect() {} },
    CustomEvent: class { constructor(t, o) { this.type = t; Object.assign(this, o); } },
    Event: class { constructor(t) { this.type = t; } },
    MouseEvent: class { constructor(t, o) { this.type = t; Object.assign(this, o); } },
    location: { href: 'https://x.test/' },
    HTMLCanvasElement: global.HTMLCanvasElement,
    WebGLRenderingContext: global.WebGLRenderingContext,
    URL, URLSearchParams, TextDecoder, TextEncoder,
    Map, Set, WeakMap, WeakSet, Promise, Symbol, Proxy, Reflect, JSON, Math, Date,
    Number, String, Boolean, Array, Object, Error, TypeError, RangeError, RegExp,
    parseInt, parseFloat, isNaN, isFinite, Intl, Uint8ClampedArray, Float64Array,
  };
  doc.defaultView = sandbox;
  sandbox.window = sandbox;
  sandbox.self = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);

  vm.runInContext(src, sandbox, { filename: bundlePath });

  // Drive the deferred render pipeline to completion. LightweightCharts schedules
  // paint work through requestAnimationFrame; a synchronous stub recurses forever.
  const flush = (maxRounds = 8) => {
    let rounds = 0;
    while (rafQueue.length && rounds++ < maxRounds) {
      const batch = rafQueue.splice(0, rafQueue.length);
      for (const fn of batch) fn(0);
    }
  };

  return {
    LightweightCharts: sandbox.LightweightCharts,
    sandbox,
    flush,
    makeEl,
    errors,
    createChart: (options) => {
      const chart = sandbox.LightweightCharts.createChart(makeEl(), Object.assign({
        autoSize: false, width: 900, height: 500,
      }, options || {}));
      flush();
      return chart;
    },
  };
}

module.exports = { bootLightweightCharts, normalizeColor, makeCtx2d };
