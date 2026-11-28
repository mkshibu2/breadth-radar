// Static checks for the class of bug just hit: an inline // comment swallowing
// later statements on a packed one-line block.
const fs = require('fs');
let pass = 0, fail = 0;
const check = (n, c, e) => { c ? (pass++, console.log('  PASS  ' + n)) : (fail++, console.log('  FAIL  ' + n + (e ? ' -> ' + e : ''))); };

// Find a real line-comment: not inside a string/template, not part of "://" (URLs).
function findLineComment(ln) {
  let q = null, esc = false;
  for (let i = 0; i < ln.length; i++) {
    const ch = ln[i];
    if (esc) { esc = false; continue; }
    if (ch === '\\') { esc = true; continue; }
    if (q) { if (ch === q) q = null; continue; }
    if (ch === '"' || ch === "'" || ch === '`') { q = ch; continue; }
    if (ch === '/' && ln[i + 1] === '/') {
      // part of a scheme like https:// or file:// ?
      if (ln[i - 1] === ':') { i++; continue; }
      return i;
    }
  }
  return -1;
}

console.log('(a) inline-comment swallow check:');
for (const f of ['index.js', 'chart_draw.js', 'chart_core.js']) {
  const lines = fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n').split('\n');
  const bad = [];
  lines.forEach((ln, i) => {
    const ci = findLineComment(ln);
    if (ci < 0) return;
    const after = ln.slice(ci);
    if (/\b(let|const|var|function)\s+[A-Za-z_$][\w$]*\s*=/.test(after)) {
      bad.push((i + 1) + ': ' + after.trim().slice(0, 70));
    }
  });
  check(f + ' has no declarations trapped inside an inline comment', bad.length === 0, bad.join(' | '));
}

console.log('\n(b) undeclared-identifier check (draw engine globals):');
const draw = fs.readFileSync('chart_draw.js', 'utf8');
const idx = fs.readFileSync('index.js', 'utf8');
const declared = (name) => {
  const re = new RegExp('(?:^|[^.\\w$])(?:let|var|const|function)\\s+' + name + '\\b');
  return re.test(idx) || re.test(draw)
      || new RegExp('window\\.' + name + '\\s*=').test(idx)
      || new RegExp('window\\.' + name + '\\s*=').test(draw);
};
for (const name of ['_subLwCandles', '_subLwCharts', '_subLwSeries', '_maxCleanCandles', '_maxChartLayout', '_activeLayoutTile', '_layoutSymbols']) {
  check(name + ' is declared', declared(name));
}

console.log('\n(c) guarded identifier probes:');
check('_subLwCandles is read behind a typeof guard', /typeof _subLwCandles !== 'undefined'/.test(draw));
check('_maxCandles is read behind a typeof guard', /typeof _maxCandles !== 'undefined'/.test(draw));
check('_maxChartLayout is probed with typeof', /typeof _maxChartLayout === 'undefined'/.test(draw));

console.log('\n(d) sanity: checker catches a synthetic swallow');
{
  const ln = "let a = 1; // note let b = 2;";
  const ci = findLineComment(ln);
  check('checker flags a real swallow', ci >= 0 && /\blet\b/.test(ln.slice(ci)));
  const urlLn = "const u = 'https://x.test/a'; let c = 3;";
  check('checker ignores // inside a URL string', findLineComment(urlLn) === -1);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
