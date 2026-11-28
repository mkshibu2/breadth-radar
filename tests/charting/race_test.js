const fs = require('fs');
const src = fs.readFileSync('index.js', 'utf8').replace(/\r\n/g, '\n');

let pass = 0, fail = 0;
const check = (n, c, e) => { c ? (pass++, console.log('  PASS  ' + n)) : (fail++, console.log('  FAIL  ' + n + (e ? ' -> ' + e : ''))); };

// Recreate the shipped guard shape: a monotonic id, captured per request, checked before commit.
function makeFetchAndDraw() {
  let _maxChartReqId = 0;
  const painted = [];
  const resolver = {};
  const fetchYf = (sym) => new Promise(res => { resolver[sym] = res; });
  function _maxFetchAndDraw(symbol) {
    const reqId = ++_maxChartReqId;
    Promise.all([fetchYf(symbol), Promise.resolve(null)]).then(([candles]) => {
      if (reqId !== _maxChartReqId) return;
      painted.push(symbol);
    });
  }
  return { _maxFetchAndDraw, resolver, painted };
}

(async () => {
  console.log('out-of-order response guard:');
  const { _maxFetchAndDraw, resolver, painted } = makeFetchAndDraw();

  _maxFetchAndDraw('INFY');   // req 1 — slow
  _maxFetchAndDraw('TCS');    // req 2 — fast, user paged forward
  resolver['TCS']([{ close: 2 }]);
  await new Promise(r => setTimeout(r, 0));
  resolver['INFY']([{ close: 1 }]);   // arrives late
  await new Promise(r => setTimeout(r, 0));

  check('only the latest request paints (got ' + JSON.stringify(painted) + ')',
        painted.length === 1 && painted[0] === 'TCS');

  // sanity: the unguarded version would paint both, in completion order
  const unguarded = [];
  await Promise.all([
    new Promise(res => setTimeout(() => { unguarded.push('INFY'); res(); }, 10)),
    new Promise(res => setTimeout(() => { unguarded.push('TCS'); res(); }, 1)),
  ]);
  check('(control) without the guard the stale symbol arrives last',
        unguarded[unguarded.length - 1] === 'INFY' && unguarded.length === 2);

  // verify the shipped source really has the guard around the commit
  const commit = src.slice(src.indexOf('Promise.all([candlePromise, niftyPromise]).then'), src.indexOf('_maxCandles = candles;'));
  check('shipped code guards the commit with reqId', /if \(reqId !== _maxChartReqId\) return;/.test(commit));
  check('guard sits BEFORE _maxCandles is assigned',
        commit.indexOf('reqId !== _maxChartReqId') < commit.length);

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
