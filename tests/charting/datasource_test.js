// Chart-data resilience — the failure that made every chart empty.
//
// On a real machine all three data routes were dead at once: the Cloudflare worker
// 404'd (its /chart route was never deployed), the public proxies rate-limited with
// 429, and because the page was opened via file:// every request was also blocked as
// opaque. The page fired dozens of doomed requests and the console looked like a code
// fault. Nothing here needs a network: the fetch paths are exercised with stubs.
//
//   node tests/charting/datasource_test.js
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const stripCR = s => s.replace(/\r\n/g, '\n');

let pass = 0, fail = 0;
const check = (name, cond, err) => {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (err !== undefined ? ' -> ' + err : '')); }
};
const section = t => console.log('\n' + t);

const idx = stripCR(read('index.js'));
const worker = stripCR(read('cloudflare-worker/src/index.js'));

// ─────────────────────────────────────────────────────────────────────────────
section('static: no dead routes, no racy fan-out');
check('the Cloudflare proxy is a named constant', /const CF_CHART_PROXY = 'https:\/\/nse-chart-proxy\.shibu-mk\.workers\.dev';/.test(idx));
check('it is called through the /chart passthrough',
  /CF_CHART_PROXY\}\/chart\?url=/.test(idx));
check('public proxies are no longer raced on every mirror', !/_promiseAny\(\s*proxyUrls\.map/.test(idx));
check('a 404 from our own worker stops further attempts', /_yfCfWorkerDead = true/.test(idx));
check('the local proxy is skipped on non-loopback hosts', /isLoopback/.test(idx));
check('file:// mode explains itself instead of failing silently', /_yfFileModeWarned/.test(idx));

section('worker: the /chart route exists and is not an open proxy');
check('route implemented', /if \(path === '\/chart' && request\.method === 'GET'\)/.test(worker));
check('hosts are allow-listed', /allowed = \['query1\.finance\.yahoo\.com', 'query2\.finance\.yahoo\.com'\]/.test(worker));
check('path is restricted to the chart API', /pathname\.startsWith\('\/v8\/finance\/chart\/'\)/.test(worker));
check('https is required', /target\.protocol !== 'https:'/.test(worker));
check('sends a browser User-Agent (Yahoo rejects unknown agents)', /User-Agent/.test(worker));
check('CORS headers are returned', /CORS_HEADERS/.test(worker));

// ─────────────────────────────────────────────────────────────────────────────
// Exercise the real worker handler.
section('worker behaviour (real handler, stubbed globals)');

const mkEnv = () => ({ DB: { prepare: () => ({ bind: () => ({ all: async () => ({ results: [] }), run: async () => ({}), first: async () => null }) }) } });

async function loadWorker() {
  const mod = await import(path.join(ROOT, 'cloudflare-worker/src/index.js'));
  return mod.default;
}

(async () => {
  const app = await loadWorker();
  const call = async (p) => {
    const r = await app.fetch(new Request('https://w.example' + p), mkEnv());
    return { status: r.status, acao: r.headers.get('access-control-allow-origin'), body: await r.text() };
  };

  check('rejects a non-allowlisted host with 403',
    (await call('/chart?url=' + encodeURIComponent('https://evil.example.com/v8/finance/chart/X'))).status === 403);
  check('rejects a non-chart path on an allowed host with 403',
    (await call('/chart?url=' + encodeURIComponent('https://query1.finance.yahoo.com/v7/quote'))).status === 403);
  check('rejects plain http with 403',
    (await call('/chart?url=' + encodeURIComponent('http://query1.finance.yahoo.com/v8/finance/chart/X'))).status === 403);
  check('rejects a missing url with 400', (await call('/chart')).status === 400);
  check('rejects a malformed url with 400', (await call('/chart?url=not%20a%20url')).status === 400);
  {
    const r = await call('/chart?url=' + encodeURIComponent('https://evil.example.com/x'));
    check('rejections still carry CORS headers', r.acao === '*', r.acao);
  }
  check('/api/health is unaffected', (await call('/api/health')).status === 200);

  // ── client-side chain, with a scripted fetch ──────────────────────────────
  section('client chain: ordering, loopback gating, and the 404 circuit breaker');

  function loadClient(locationHost, protocol) {
    // Defined on the sandbox object, NOT as ES2015 shorthand: shorthand properties
    // are not created as own-enumerable properties, so vm's global lookup misses them.
    const sandbox = {
      console: { warn: () => {}, log: () => {}, error: () => {} },
      setTimeout: (fn, ms) => setTimeout(fn, ms),
      clearTimeout: (id) => clearTimeout(id),
      AbortController: AbortController,
      Promise: Promise,
      URL: URL,
      JSON, Math, Date, Number, String, Array, Object, Error, isNaN, isFinite,
      window: { location: { hostname: locationHost, protocol, origin: (protocol === 'file:' ? 'null' : `http://${locationHost}`) } },
      document: { getElementById: () => null },
      localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
      _fetchCalls: [],
    };
    sandbox.window.location.href = 'x';
    sandbox.globalThis = sandbox;
    vm.createContext(sandbox);

    // Pull just the pieces _fetchYfDataWithSymbol needs.
    const grab = (name) => {
      let i = idx.indexOf('function ' + name + '(');
      // Keep a leading `async` — slicing from `function` would silently turn an
      // async function into a sync one containing `await`, which fails to parse.
      if (i >= 6 && idx.slice(i - 6, i) === 'async ') i -= 6;
      let d = 0, j = idx.indexOf('{', i);
      for (let k = j; k < idx.length; k++) {
        if (idx[k] === '{') d++;
        else if (idx[k] === '}') { d--; if (d === 0) return idx.slice(i, k + 1); }
      }
      return '';
    };
    const prelude = `
      const CF_CHART_PROXY = 'https://nse-chart-proxy.shibu-mk.workers.dev';
      let _yfFileModeWarned = false;
      let _yfCfWorkerDead = false;
      const _yfDataCache = new Map();
      function _yfCacheGet() { return null; }
      function _yfCacheSet() {}
      function parseYfData() { return null; }
      ${grab('getYfSymbolCandidates')}
      ${grab('_fetchYfDataWithSymbol')}
    `;
    vm.runInContext(prelude, sandbox, { filename: 'client' });

    // Stub the transport: record calls, answer per-route.
    vm.runInContext(`
      async function _fetchProxyCandles(u) {
        _fetchCalls.push(u);
        return _respond(u);
      }
    `, sandbox);
    sandbox._respond = () => { throw new Error('HTTP 404'); };
    return sandbox;
  }

  {
    // file:// must not attempt any network route.
    const sb = loadClient('', 'file:');
    await vm.runInContext("_fetchYfDataWithSymbol('RELIANCE.NS','1y','1d',true)", sb);
    check('file:// makes no same-origin or localhost request',
      !sb._fetchCalls.some(u => u.includes('/api/proxy') || u.includes('localhost:9090')),
      JSON.stringify(sb._fetchCalls));
    check('file:// still tries the Cloudflare worker (ACAO:* works from null origin)',
      sb._fetchCalls.length > 0 && sb._fetchCalls.every(u => u.includes('nse-chart-proxy')));
    check('file:// warns once about the origin', vm.runInContext('_yfFileModeWarned', sb) === true);
  }

  {
    // On a remote host the localhost proxy must never be consulted.
    const sb = loadClient('mkshibu2.github.io', 'https:');
    await vm.runInContext("_fetchYfDataWithSymbol('X.NS','1y','1d',true)", sb);
    check('a remote host never calls localhost:9090',
      !sb._fetchCalls.some(u => u.includes('localhost:9090')), JSON.stringify(sb._fetchCalls.slice(0, 2)));
  }

  {
    // A 404 from our worker must trip the breaker: one attempt, then never again.
    const sb = loadClient('localhost', 'http:');
    const before = await vm.runInContext("_fetchYfDataWithSymbol('A.NS','1y','1d',true)", sb);
    const workerHitsAfterFirst = sb._fetchCalls.filter(u => u.includes(CF_WORKER_HINT())).length;
    sb._fetchCalls.length = 0;
    await vm.runInContext("_fetchYfDataWithSymbol('B.NS','1y','1d',true)", sb);
    const workerHitsAfterSecond = sb._fetchCalls.filter(u => u.includes(CF_WORKER_HINT())).length;
    // Once the worker 404s there is no point asking it again — not for the second
    // mirror, and not for the next chart. Anything else wastes a timeout per chart.
    check('worker is tried once, then skipped for the rest of the session',
      workerHitsAfterFirst === 1 && workerHitsAfterSecond === 0,
      `first=${workerHitsAfterFirst} second=${workerHitsAfterSecond}`);
    check('a failed chain returns null rather than throwing', before === null, before);
  }

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();

function CF_WORKER_HINT() { return 'nse-chart-proxy'; }
