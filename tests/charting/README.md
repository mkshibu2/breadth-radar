# Charting regression tests

Standalone Node scripts (no `npm install` required) that exercise the charting
code directly. They exist to catch the specific defects fixed in the Sprint 1
patch, and they double as a smoke test before any LightweightCharts upgrade.

```bash
node tests/charting/boot_test.js      # chart_core/chart_draw/index boot without errors
node tests/charting/tile_test.js      # multi-tile drawing coordinate maths
node tests/charting/cache_test.js     # candle cache TTL + size cap + force refresh
node tests/charting/race_test.js      # out-of-order symbol request guard
node tests/charting/lint_test.js      # inline-comment swallows, undeclared identifiers
node tests/charting/sprint2_test.js   # public-API scale reset, new tools, object list
node tests/charting/lw_version_test.js  # the series/marker/scale contract against the real bundle
node tests/charting/lw_render_test.js   # builds a real chart (and the drawing overlay) headlessly
node tests/charting/earnings_test.js     # EPS/Sales growth pane, against the real financials file
node tests/charting/convergence_test.js  # the indicator is identical on every page
node tests/charting/datasource_test.js  # chart-data routes, allow-list, circuit breaker
```

Each script exits non-zero on failure. Run them all:

```bash
for t in tests/charting/*_test.js; do node "$t" || exit 1; done
```

## What each covers

| File | Guards against |
| --- | --- |
| `boot_test.js` | A `ReferenceError`/`TypeError` at load time taking the whole page down. Loads the three scripts against a DOM stub. |
| `tile_test.js` | Regression of the multi-chart drawing bug — drawings for tiles 2–4 must be translated and clipped into that tile's pane, and must not translate in single-chart layout. |
| `cache_test.js` | The "Refresh" button silently returning cached candles (TTL expiry, `force` bypass, size cap). |
| `race_test.js` | A slow, superseded symbol request painting over the newer one after fast watchlist paging. |
| `lint_test.js` | The class of bug where an inline `//` comment on a packed one-line block swallows the statements after it — plus a check that draw-engine globals are actually declared. |
| `lw_version_test.js` | A LightweightCharts upgrade silently removing `addCandlestickSeries()` / `series.setMarkers()` — the failure mode is a blank chart area, not an exception. Boots the **real** bundled library in a `vm` sandbox and replays all seven series configurations plus the marker, overlay-scale and time-scale APIs the repo uses. Set `LW4_BUNDLE=…` to run the same suite against a v4 build and prove the adapter is not a one-way door. |
| `datasource_test.js` | The route from Yahoo to the chart. Asserts the worker's `/chart` passthrough cannot be used as an open proxy, that the client tries routes in a sane order, and that a 404 from our own worker is not retried per chart. No network needed. |
| `convergence_test.js` | The WIN indicator is computed once and drawn everywhere. Compares the shared module against the per-page maths still in `index.js` and demands a bit-exact match, so a future edit to one surface cannot silently re-diverge the others. |
| `earnings_test.js` | The quarterly EPS/Sales pane. Runs against the **shipped** `exact_quarterly_financials.json` rather than fixtures, because that file contains the values that break naive plotting (10% of prints over +200%, one at +109,634%). Covers label parsing, range clamping, the clamp-to-cap behaviour, and pane teardown. |
| `lw_render_test.js` | The same class of bug, one level up: it loads `index.js` and calls the real `drawMaxChartLightweight()` against the real bundle, then binds `chart_draw.js` to that live chart and exercises `pointToPixels`/`redrawChartDrawings`. This is the test that would have caught the v5 migration. |
| `sprint2_test.js` | (a) no minified-private LightweightCharts members survive in `resetChartPriceScale`; (b) Horizontal Line, Vertical Line and Parallel Channel are wired into render + hit-test + creation + drag handles; (c) the object list selects/hides/deletes and every mutation is undoable. Half of it is behavioural: it boots `chart_draw.js` against a DOM + 2D-context shim and drives real mouse events. |

## Notes

- `tile_test.js` and `boot_test.js` use `vm` with a hand-rolled DOM stub; there is
  no jsdom dependency on purpose so these can run in CI with a bare Node install.
- `lint_test.js` is a heuristic, not a real parser. It is deliberately narrow
  (string- and URL-aware) so it produces no false positives on this codebase.
- `index.js` is CRLF; every harness normalises line endings before parsing.
- `lw_harness.js` is the shared fixture for the two LightweightCharts tests: it boots a
  bundle into a `vm` sandbox with a DOM + 2D-context shim and a deferred
  `requestAnimationFrame` queue (`flush()` drains it — LightweightCharts recurses
  forever if rAF is made synchronous).
- `sprint2_test.js` installs a `CHART_DRAW_HOST` (`getSymbol`/`getCandles`/`getContext`)
  so the drawing engine can be exercised exactly as a page would use it, with a
  1:1 logical↔pixel and price↔pixel stub (clicking `(x, y)` yields `logical = x`,
  `price = 500 - y`).
