const fs = require('fs');
const vm = require('vm');

// Pull the cache helpers + the read path straight out of index.js so the test exercises
// the real shipped code, not a re-implementation.
const src = fs.readFileSync('index.js', 'utf8').replace(/\r\n/g, '\n');
const grab = (startMarker, endMarker) => {
  const i = src.indexOf(startMarker);
  const j = src.indexOf(endMarker, i);
  if (i < 0 || j < 0) throw new Error('marker not found: ' + startMarker);
  return src.slice(i, j + endMarker.length);
};

// brace-aware extraction of one top-level function body
const sliceFn = (marker) => {
  const i = src.indexOf(marker);
  if (i < 0) throw new Error('marker not found: ' + marker);
  let depth = 0, started = false;
  for (let k = i; k < src.length; k++) {
    if (src[k] === '{') { depth++; started = true; }
    else if (src[k] === '}') { depth--; if (started && depth === 0) return src.slice(i, k + 1); }
  }
  throw new Error('unbalanced braces for ' + marker);
};
const helpers = grab('const _yfDataCache = new Map();', '// Helper to fetch candles from a single proxy');
const readPath = sliceFn('async function _fetchYfDataWithSymbol');

const sandbox = {
  console, Date, Map, JSON, Number, String, Object, Array, Math,
  window: { location: { origin: 'https://x.test', hostname: 'x.test', protocol: 'https:' } },
  setTimeout, clearTimeout, AbortController,
  _fetchProxyCandles: async () => null,
  _promiseAny: async () => { throw new Error('no proxy'); },
  encodeURIComponent,
};
vm.createContext(sandbox);
vm.runInContext(helpers + '\n' + readPath + '\n;globalThis.__cache = _yfDataCache;', sandbox);

let pass = 0, fail = 0;
const check = (n, c, e) => { c ? (pass++, console.log('  PASS  ' + n)) : (fail++, console.log('  FAIL  ' + n + (e ? ' -> ' + e : ''))); };
const get = k => vm.runInContext(`_yfCacheGet(${JSON.stringify(k)})`, sandbox);
const set = (k, v) => vm.runInContext(`_yfCacheSet(${JSON.stringify(k)}, __v)`, Object.assign(sandbox, { __v: v }));

console.log('cache TTL / eviction:');
set('INFY_1y_1d', [{ close: 1 }]);
check('fresh entry is returned', JSON.stringify(get('INFY_1y_1d')) === '[{"close":1}]');
check('unknown key returns null', get('TCS_1y_1d') === null);

// age the entry past the TTL
const aged = vm.runInContext(`(() => { const e = _yfDataCache.get('INFY_1y_1d'); e.at = Date.now() - (YF_CACHE_TTL_MS + 1); return true; })()`, sandbox);
check('expired entry is evicted', get('INFY_1y_1d') === null, 'aged=' + aged);

// force bypass: deletes the key so the network path runs
set('SBIN_1y_1d', [{ close: 2 }]);
vm.runInContext(`_yfDataCache.delete('SBIN_1y_1d')`, sandbox);
check('force path clears the entry', get('SBIN_1y_1d') === null);

// eviction cap
sandbox._yfDataCacheRef = vm.runInContext('_yfDataCache', sandbox);
for (let i = 0; i < 500; i++) set('SYM' + i + '_1y_1d', [{ close: i }]);
const size = vm.runInContext('_yfDataCache.size', sandbox);
check('cache is size-capped at 400 (got ' + size + ')', size <= 400);

console.log('\nrequest guard:');
const guard = src.slice(src.indexOf('function maxChartRefresh()'), src.indexOf('function maxChartRefresh()') + 320);
check('maxChartRefresh passes force=true', /_maxFetchAndDraw\(_sdMaximizedChartSymbol,\s*true\)/.test(guard));
const fetchSig = src.slice(src.indexOf('async function fetchYfData'), src.indexOf('async function fetchYfData') + 120);
check('fetchYfData accepts a force param', /function fetchYfData\(symbol, range, interval, force\)/.test(fetchSig));
const guards = (src.match(/reqId !== _maxChartReqId/g) || []).length;
check('4 request-id guards installed (got ' + guards + ')', guards === 4);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
