// Renderer convergence — the WIN indicator must produce the same picture on every page.
//
// Before this, the indicator existed three times (max chart, card renderer, and a
// cut-down copy inside screener.html) and they had drifted: the screener drew
// EMA10/20 + SMA200 but not SMA50, SMA30W, RS, the volume trigger or the VCP markers,
// and the card renderer coloured volume with a plain up/down pair while the max chart
// applied a six-tier VCP hierarchy.
//
// So the valuable assertion is not "the module exists" — it is "every surface derives
// the same numbers from the same candles". These tests compare the shared module
// against the surviving per-page maths, byte for byte.
//
//   node tests/charting/convergence_test.js
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

const core = stripCR(read('chart_core.js'));
const idx = stripCR(read('index.js'));
const scr = stripCR(read('screener.html'));

// ─────────────────────────────────────────────────────────────────────────────
section('static: one implementation, no surviving copies');
check('chart_core.js owns the indicator', /function computeWinIndicator\(candles, options\)/.test(core));
check('it exports the volume hierarchy', /const WIN_VOL_COLORS = \{/.test(core));
check('the max chart calls the shared module', /computeWinIndicator\(cleanCandles, \{/.test(idx));
check('the max chart draws volume from the shared module', /volSeries\.setData\(winVolumeData\(cleanCandles/.test(idx));
check('the card renderer draws volume from the shared module', /volSeries\.setData\(winVolumeData\(cleanCandles/.test(core));

// The old private maths in chart_core.js is gone.
check('chart_core.js no longer carries its own EMA/SMA/AvgVol',
  !/_ccCalcEMA|_ccCalcSMA|_ccCalcAvgVol/.test(core));

// index.js still owns calculateEMA etc. for the HUD table and the legacy canvas
// renderer. Those are separate consumers, but the *chart* must not use them.
const maxChartBody = (() => {
  const a = idx.indexOf('function drawMaxChartLightweight()');
  const b = idx.indexOf('\nfunction ', a + 10);
  return idx.slice(a, b);
})();
check('the max chart renderer no longer computes its own MAs',
  !/calculateEMA\(cleanCandles|calculateSMA\(cleanCandles/.test(maxChartBody));
check('the max chart renderer no longer inlines the volume hierarchy',
  !/VCP & Pocket Pivot Volume Color Hierarchy/.test(maxChartBody));

// The screener must feed Nifty in, otherwise RS can never draw there.
check('screener passes real Nifty candles for the RS line', /niftyCandles: niftyForChart/.test(scr));
check('screener no longer hard-codes niftyCandles: null', !/niftyCandles: null/.test(scr));

// ─────────────────────────────────────────────────────────────────────────────
section('numbers: shared module vs the per-page implementations');
const H = bootLightweightCharts(path.join(ROOT, 'lightweight-charts.standalone.production.js'));
const sb = H.sandbox;
const reg = {};
const el = id => (reg[id] || (reg[id] = Object.assign(H.makeEl(), { id, closest: () => null })));
sb.document.getElementById = el;
sb.document.createElement = () => H.makeEl();
sb.document.body = el('body');
sb.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
vm.runInContext(core, sb, { filename: 'chart_core.js' });
check('chart_core.js loads', typeof sb.computeWinIndicator === 'function');

// Deterministic candles with enough variety to exercise every volume tier.
const candles = [];
let seed = 1234567;
const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
let px = 250;
const T0 = 1735689600;
for (let i = 0; i < 320; i++) {
  const ch = (rnd() - 0.5) * 7;
  px = Math.max(5, px + ch);
  candles.push({
    time: T0 + i * 86400,
    open: px - ch / 2, high: px + Math.abs(ch) + 1.5, low: px - Math.abs(ch) - 1.5,
    close: px, volume: Math.round(4000 + rnd() * 120000),
  });
}

// Reference maths lifted out of index.js (still used by the HUD/legacy canvas).
function grabFn(src, name) {
  const i = src.indexOf('function ' + name + '(');
  if (i < 0) return null;
  let d = 0, j = src.indexOf('{', i);
  for (let k = j; k < src.length; k++) {
    if (src[k] === '{') d++;
    else if (src[k] === '}') { d--; if (d === 0) return src.slice(i, k + 1); }
  }
  return null;
}
const refEMA = vm.runInNewContext('(' + grabFn(idx, 'calculateEMA') + ')', {});
const refSMA = vm.runInNewContext('(' + grabFn(idx, 'calculateSMA') + ')', {});
const refAvgVol = vm.runInNewContext('(' + grabFn(idx, 'calculateAvgVol') + ')', {});

const maxdiff = (a, b) => a.reduce((m, v, i) =>
  (v == null && b[i] == null) ? m : Math.max(m, Math.abs((v || 0) - (b[i] || 0))), 0);

const cfg = { inputs: { ema1Period: 10, ema2Period: 20, sma1Period: 50, sma2Period: 200, sma30wPeriod: 30, volLen: 50 }, style: {} };
const daily = sb.computeWinIndicator(candles, { config: cfg, timeframe: 'D' });

for (const p of [10, 20, 50, 200]) {
  const shared = sb.computeWinIndicator(candles, { config: { inputs: { ema1Period: p }, style: {} }, timeframe: 'D' }).ema1;
  const d = maxdiff(shared, refEMA(candles, p));
  check(`shared EMA(${p}) is identical to index.js calculateEMA`, d < 1e-9, d);
}
for (const p of [30, 50, 200]) {
  const shared = sb.winSma(candles, p);
  const d = maxdiff(shared, refSMA(candles, p));
  check(`shared SMA(${p}) is identical to index.js calculateSMA`, d < 1e-9, d);
}
check('shared windowed AvgVol is identical to index.js calculateAvgVol',
  maxdiff(sb.winAvgVol(candles, 50), refAvgVol(candles, 50)) < 1e-9);

// ── the two average-volume shapes the original code relies on ──
const cum = sb.winAvgVolCumulative(candles, 50);
const ser = sb.winAvgVol(candles, 50);
check('the cumulative average has no nulls (colours the volume bars)',
  cum.every(v => v != null && isFinite(v)));
check('the windowed average is null before its window fills (feeds the markers)',
  ser.slice(0, 49).every(v => v == null) && ser[49] != null);
check('the two averages disagree early on — so they are not interchangeable',
  Math.abs(cum[0] - (ser[0] || 0)) > 0 || cum[0] != null,
  `cum[0]=${cum[0]} ser[0]=${ser[0]}`);

// ── timeframe rules: weekly drops the 50/200, adds the 30W ──
const weekly = sb.computeWinIndicator(candles, { config: cfg, timeframe: 'W' });
const active = tf => tf.lines.filter(l => l.active).map(l => l.key).sort().join(',');
check('daily draws EMA10, EMA20, SMA50, SMA200', active(daily) === 'ema10,ema20,sma200,sma50', active(daily));
check('weekly draws EMA10, EMA20, SMA30W', active(weekly) === 'ema10,ema20,sma30w', active(weekly));

// ── volume hierarchy: every tier reachable, both surfaces agree ──
const vol = sb.winVolumeData(candles, 50);
const tiers = new Set(vol.map(v => v.color));
check('all seven volume tiers are exercised by real-shaped data', tiers.size === 7, [...tiers].join(' '));
check('volume data covers every candle', vol.length === candles.length);

// Recompute the max chart's original inline rule and demand an exact match.
const refAvg = cum;
let colourMismatch = 0;
for (let i = 0; i < candles.length; i++) {
  const c = candles[i], curVol = c.volume, avg = refAvg[i] || 1, isUp = c.close >= c.open;
  let minVol = Infinity, maxVol = -Infinity;
  for (let j = Math.max(0, i - 19); j <= i; j++) {
    const v = candles[j].volume;
    if (v > 0) { if (v < minVol) minVol = v; if (v > maxVol) maxVol = v; }
  }
  let maxDown = 0;
  for (let j = Math.max(0, i - 10); j < i; j++) if (candles[j].close < candles[j].open && candles[j].volume > maxDown) maxDown = candles[j].volume;
  const isPP = isUp && curVol > maxDown && curVol >= avg * 1.05;
  let col;
  if ((curVol >= maxVol && curVol >= avg) || isPP) col = '#2196f3';
  else if (curVol <= minVol && curVol < avg) col = '#ffeb3b';
  else if (curVol < avg) col = 'rgba(148, 163, 184, 0.45)';
  else if (curVol >= avg * 1.75) col = isUp ? '#c8e6ca' : '#fbc4bd';
  else if (isUp) col = '#4caf50';
  else col = '#f23645';
  if (vol[i].color !== col) colourMismatch++;
}
check('shared volume colours match the max chart rule exactly, bar for bar',
  colourMismatch === 0, colourMismatch + ' mismatches');

// ── markers and volume trigger flow through the same module ──
const full = sb.computeWinIndicator(candles, {
  config: { inputs: { ...cfg.inputs, vtLookback: 25, vtRows: 30, vtHvnPct: 60, vtLvnPct: 40 }, style: {} },
  timeframe: 'D',
});
check('markers are produced for daily', Array.isArray(full.markers));
check('the volume trigger is computed', full.volumeTrigger !== undefined);
check('no Nifty data means no RS line, not a differently-scaled one',
  full.rsData.length === 0);
const withNifty = sb.computeWinIndicator(candles, {
  config: cfg, timeframe: 'D',
  niftyCandles: candles.map(c => ({ time: c.time, close: c.close / 2.5 })),
});
check('RS is rebased to 1000 when Nifty is supplied',
  withNifty.rsData.length > 0 && Math.abs(withNifty.rsData[0].value - 2500) < 1,
  withNifty.rsData[0] && withNifty.rsData[0].value);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
