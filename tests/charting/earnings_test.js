// Earnings pane — quarterly EPS / Sales growth under the price.
//
// Everything here is checked against the REAL ship data (`exact_quarterly_financials.json`),
// not against hand-written fixtures. That file is what actually reaches the browser, and it
// contains values that break naive plotting: a third of the quarters exceed +200% growth and
// individual prints range past +109,000% and below -1,000,000%. A fixture with tidy
// 15%-to-40% numbers would pass while the real chart rendered flat.
//
//   node tests/charting/earnings_test.js
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
  else { fail++; console.log('  FAIL  ' + name + (err !== undefined ? ' -> ' + err : '')); }
};
const section = t => console.log('\n' + t);

const REAL = JSON.parse(read('exact_quarterly_financials.json'));
const signedSymbols = Object.keys(REAL);

// ─────────────────────────────────────────────────────────────────────────────
section('static: wired into the page, not just defined');
const core = stripCR(read('chart_core.js'));
const idx = stripCR(read('index.js'));
for (const fn of ['applyEarningsPane', 'clearEarningsPane', 'buildEarningsBuckets', 'earningsQuarterTime']) {
  check('chart_core.js defines ' + fn, new RegExp(`function ${fn}\\(`).test(core));
}
check('index.js exposes the toggle', /function winToggleEpsPane\(\)/.test(idx));
check('max chart draws the pane', /applyEarningsPane\(_maxLwChart, 'max-chart'/.test(idx));
check('max chart clears it before the chart is destroyed',
  /clearEarningsPane\(_maxLwChart, 'max-chart'\); } catch \(e\) \{ \}\n    try \{ _maxLwChart\.remove\(\)/.test(idx));
check('the pane is off unless switched on', /epsPane: false/.test(idx));
check('the toggle rebuilds the chart instead of patching panes', /winToggleEpsPane[\s\S]{0,400}drawMaxChartLightweight\(\)/.test(idx));
for (const host of ['index.html', 'sectors.html', 'screener.html']) {
  check(`${host}: toggle button present`, stripCR(read(host)).includes('id="win-btn-eps"'));
}
check('the pane teardown uses removePane, not clear-data',
  /chart\.removePane\(idx\)/.test(core) && /setPreserveEmptyPane\(false\)/.test(core));

// ─────────────────────────────────────────────────────────────────────────────
section('quarter labels: parsed from the real file, refused when ambiguous');
const H = bootLightweightCharts(path.join(ROOT, 'lightweight-charts.standalone.production.js'));
const sb = H.sandbox;
const reg = {};
const el = id => (reg[id] || (reg[id] = Object.assign(H.makeEl(), { id, closest: () => null })));
sb.document.getElementById = el;
sb.document.createElement = () => H.makeEl();
sb.document.body = el('body');
sb.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
let coreErr = null;
try { vm.runInContext(core, sb, { filename: 'chart_core.js' }); } catch (e) { coreErr = e; }
check('chart_core.js loads against the real bundle', !coreErr, coreErr && coreErr.message);

// Every distinct label that appears in the shipped data must either parse to a
// real mid-month timestamp or be explicitly rejected. No third outcome.
const allLabels = new Set();
signedSymbols.forEach(sym => (REAL[sym] || []).forEach(r => r && r.qtr && allLabels.add(r.qtr)));
let parsedOk = 0, rejected = [];
for (const label of allLabels) {
  const ts = sb.earningsQuarterTime(label);
  if (ts == null) { rejected.push(label); continue; }
  const d = new Date(ts * 1000);
  const okMonth = /^[A-Z][a-z]{2}-\d{2}/.test(label)
    && d.getUTCMonth() === ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].indexOf(label.slice(0, 3));
  const okYear = d.getUTCFullYear() === 2000 + parseInt(label.slice(4, 6), 10);
  if (okMonth && okYear) parsedOk++;
  else fail++, console.log('  FAIL  ' + label + ' parsed to the wrong month/year -> ' + d.toISOString());
}
check(`all ${allLabels.size} real labels resolve to the right month and year`, parsedOk + rejected.length === allLabels.size && parsedOk > 0,
  `parsed ${parsedOk}, rejected [${rejected.join(', ')}]`);
check('a half-year tag still resolves to its quarter month', sb.earningsQuarterTime('Mar-25 (H)') === sb.earningsQuarterTime('Mar-25'));
check('unparseable labels return null rather than guessing',
  ['garbage', '', null, undefined, 'Q4-26', 'Sep-2026'].every(l => sb.earningsQuarterTime(l) == null));

// ─────────────────────────────────────────────────────────────────────────────
section('buckets: real data, deduped and clamped to the candle range');
const T0 = Math.floor(Date.UTC(2025, 5, 1) / 1000);
const candles = [];
for (let i = 0; i < 400; i++) candles.push({ time: T0 + i * 86400, open: 100, high: 102, low: 99, close: 101 });
const firstTs = candles[0].time, lastTs = candles[candles.length - 1].time;

const buckets = sb.buildEarningsBuckets(candles, REAL['COFORGE']);
check('real quarters produce buckets', buckets.length > 0, buckets.length);
check('buckets are sorted oldest to newest', buckets.every((b, i) => i === 0 || buckets[i - 1].time < b.time));
check('no bucket falls outside the candle range',
  buckets.every(b => b.time >= firstTs && b.time <= lastTs),
  buckets.map(b => b.time).join(','));
check('one bucket per timestamp (no duplicate bars)',
  new Set(buckets.map(b => b.time)).size === buckets.length);
check('bucket keeps the source label for reference',
  buckets.every(b => typeof b.label === 'string' && b.label.length > 0));
check('eps and sales are both carried',
  buckets.some(b => b.eps != null) && buckets.some(b => b.sales != null));

// clamping: a quarter newer than the last candle must not stretch the time axis
const newer = sb.buildEarningsBuckets(candles, [{ qtr: 'Dec-26', eps_growth: 5, sales_growth: 10 }]);
check('a quarter newer than the last candle is clamped into range',
  newer.length === 1 && newer[0].time === lastTs, newer.length && newer[0].time);
const older = sb.buildEarningsBuckets(candles, [{ qtr: 'Jan-20', eps_growth: 5, sales_growth: 10 }]);
check('a quarter older than the first candle is clamped into range',
  older.length === 1 && older[0].time === firstTs, older.length && older[0].time);

check('empty qData yields no buckets', sb.buildEarningsBuckets(candles, []).length === 0);
check('null qData yields no buckets', sb.buildEarningsBuckets(candles, null).length === 0);
check('rows with no usable values are dropped',
  sb.buildEarningsBuckets(candles, [{ qtr: 'Sep-26', eps_growth: null, sales_growth: null }]).length === 0);

// ─────────────────────────────────────────────────────────────────────────────
section('pane on a real chart: drawn, clamped, and removable');
const LW = sb.LightweightCharts;
const chart = H.createChart({ width: 900, height: 700 });
const price = chart.addSeries(LW.CandlestickSeries, {});
price.setData(candles);
H.flush();
check('chart starts with one pane', chart.panes().length === 1, chart.panes().length);

const created = sb.applyEarningsPane(chart, 't', candles, REAL['COFORGE'], {});
H.flush();
check('earnings pane added', !!created && chart.panes().length === 2, chart.panes().length);
check('pane draws two series (EPS bars + Sales line)', created.series.length === 2);
check('pane is shorter than the price pane',
  chart.panes()[0].getStretchFactor() < chart.panes()[1].getStretchFactor(),
  JSON.stringify(chart.panes().map(p => p.getStretchFactor())));
check('pane reports the cap it applied', created.cap === 100, created.cap);

// The important one: real outlier data must not draw outside the pinned range.
const worst = signedSymbols
  .map(s => (REAL[s] || []).map(r => Math.max(Math.abs(r.eps_growth || 0), Math.abs(r.sales_growth || 0))))
  .reduce((m, arr) => Math.max(m, ...arr, 0), 0);
const worstSym = signedSymbols.find(s => (REAL[s] || []).some(r => Math.abs(r.eps_growth || 0) === worst));
check('the shipped data really does contain extreme prints', worst > 1000, worst);

const extreme = sb.applyEarningsPane(chart, 'ext', candles, REAL[worstSym], {});
H.flush();
check('extreme-data pane still renders', !!extreme);
check('every plotted value is inside the cap (asserted on what reached the chart)',
  extreme.plot.eps.every(d => Math.abs(d.value) <= extreme.cap)
  && extreme.plot.sales.every(d => Math.abs(d.value) <= extreme.cap),
  JSON.stringify({ eps: extreme.plot.eps.map(d => d.value), sales: extreme.plot.sales.map(d => d.value) }));
check('a clipped bar is visibly muted, not drawn like a normal one',
  extreme.plot.eps.some(d => /rgba/.test(d.color)),
  JSON.stringify(extreme.plot.eps.map(d => d.color)));
check('extreme pane records how many bars were clipped', extreme.clipped >= 1, extreme.clipped);

// A custom cap must be honoured.
const tight = sb.applyEarningsPane(chart, 'tight', candles, REAL[worstSym], { cap: 25 });
H.flush();
check('a custom cap is honoured', tight.cap === 25, tight.cap);

sb.clearEarningsPane(chart, 'tight');
H.flush();
check('clearEarningsPane collapses the pane (no empty band left)', chart.panes().length === 1, chart.panes().length);
check('the price series survives teardown', typeof price.setData === 'function');
let usable = true;
try { price.setData(candles.slice(0, 100)); H.flush(); } catch (e) { usable = e.message; }
check('chart still usable after the earnings pane is removed', usable === true, usable);

check('no earnings data means no pane', sb.applyEarningsPane(chart, 'none', candles, []) === null
  && chart.panes().length === 1);

// Two charts must not share pane state.
const chart2 = H.createChart({ width: 400, height: 300 });
chart2.addSeries(LW.CandlestickSeries, {}).setData(candles);
H.flush();
sb.applyEarningsPane(chart, 'A', candles, REAL['COFORGE']);
sb.applyEarningsPane(chart2, 'B', candles, REAL['COFORGE']);
H.flush();
check('per-chart pane stores are independent', chart.panes().length === 2 && chart2.panes().length === 2,
  chart.panes().length + ' / ' + chart2.panes().length);
sb.clearEarningsPane(chart, 'A');
H.flush();
check('clearing one chart leaves the other intact', chart.panes().length === 1 && chart2.panes().length === 2,
  chart.panes().length + ' / ' + chart2.panes().length);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
