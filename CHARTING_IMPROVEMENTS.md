# Charting Platform — Review & Improvement Proposal

Review of the charting stack in `breadth-radar`: **Chart Studio** (`index.html` + `index.js:6600–9000`), the **shared card renderer** (`chart_core.js`), the **drawing engine** (`chart_draw.js`), and the **Screener/Sector** chart surfaces (`screener.html`, `sectors.html`).

---

## What's already strong

Worth saying before the critique — this is a genuinely ambitious charting platform:

- **16 drawing tools** with magnet mode, undo/redo, floating style toolbar, per-symbol persistence and optional Cloudflare D1 sync (`chart_draw.js`).
- **WIN overlay system** (EMA10/20, SMA50/200, 30W, RS-vs-Nifty, volume-trigger line, VCP markers) driven by one config object shared across pages — a solid abstraction.
- **VCP-aware volume colours** (pocket pivot / dry volume / power volume) — genuinely differentiated from TradingView, `index.js:6860`.
- **3 data sources** (Yahoo, Fyers, Dhan) with automatic cross-fallback.
- **Snapshot composer** using `chart.takeScreenshot()` to composite multi-tile layouts into a single branded PNG — nice touch.

The problems below are mostly *architectural drift*: the same chart is implemented **four times** with different feature sets, and one renderer is 12k lines of mostly-minified JS.

---

## Tier 1 — Bugs that are visible today

> **Status: all seven fixed.** See [Sprint 1 — shipped](#sprint-1--shipped) at the
> bottom for the change list and the tests that lock each one in.

These are concrete defects, not wishlist items.

### 1.1 Multi-tile drawings render in the wrong place (and get clipped) — ✅ fixed
`chart_draw.js:274` returns the **active tile's** `timeScale`/`series`, but the drawing canvas (`index.html:1673`) is a single overlay spanning the whole `#max-chart-stage`. Tile coordinates are tile-relative; the canvas is stage-relative — and there is no offset applied anywhere.

Consequence in a 2×2 layout: a trendline drawn on tile 3 (bottom-left) appears shifted up by half the stage height and is clipped horizontally at `chartPlotW` (`chart_draw.js:1233`), so it visually "disappears".

**Fix** — compute the tile origin once and translate + clip to the tile rect:

```js
function getTileOrigin() {
  const stage = document.getElementById('max-chart-stage');
  const id = _activeLayoutTile > 1 ? `max-chart-lw-container-${_activeLayoutTile}` : 'max-chart-lw-container';
  const el = document.getElementById(id);
  if (!stage || !el) return { dx: 0, dy: 0, w: stage.clientWidth, h: stage.clientHeight };
  const s = stage.getBoundingClientRect(), c = el.getBoundingClientRect();
  return { dx: c.left - s.left, dy: c.top - s.top, w: c.width, h: c.height };
}
```
Then in `redrawChartDrawings()`: `ctx.translate(dx, dy)` before drawing, `ctx.rect(dx, dy, min(chartPlotW, w), h)` for the clip, and subtract `dx/dy` in `getEventCoords()`.

### 1.2 "Vol Candles" silently renders plain candles in Chart Studio — ✅ fixed (option retired)
`_sdChartType` defaults to `'volume_candles'` (`index.js:6410`) and the dropdown shows *Vol Candles* — but the LightweightCharts path only branches on `'ohlc'`:

```js
// index.js:6820  and chart_core.js:191
if (_sdChartType === 'ohlc') { /* bars */ } else { /* candlestick */ }
```

So the UI claims a chart type that isn't drawn. Only the legacy canvas renderer (`index.js:7844`) and the Sector grid actually implement variable-width bodies.

**Fix** — either wire it up properly (`addCustomSeries` with a variable-width body, ~40 lines) or remove the option from `#max-chart-type` and `#sd-chart-type` until it exists. Removing is the honest 5-minute fix.

### 1.3 The "Refresh chart data" button does not refresh — ✅ fixed
`maxChartRefresh()` (`index.js:8342`) just calls `_maxFetchAndDraw()`, which goes through `_fetchYfDataWithSymbol()` → `if (_yfDataCache.has(cacheKey)) return` (`index.js:7692`). The cache has **no TTL and no eviction**, so a second click within the same session returns the identical array with zero network traffic. During a live session, intraday bars never advance either.

**Fix** — add a timestamp to the cache and a `force` flag:

```js
const YF_TTL_MS = 60_000;
// on read:
const hit = _yfDataCache.get(cacheKey);
if (hit && (Date.now() - hit.at) < YF_TTL_MS && !force) return hit.candles;
// on write:
_yfDataCache.set(cacheKey, { at: Date.now(), candles });
```
and pass `force = true` from `maxChartRefresh()`. Also cap the map (e.g. 300 keys, LRU) — today it grows with every `symbol × range × interval` combination.

### 1.4 Fast symbol switching can draw the wrong symbol — ✅ fixed
`maxChartNavigateWatchlist()` is bound to arrow keys / space (`index.js:10603`), but `_maxFetchAndDraw()` has **no request-id guard**:

```js
Promise.all([candlePromise, niftyPromise]).then(([candles, niftyCandles]) => {
  _maxCandles = candles;   // no check that `symbol` is still the active one
  drawMaxChart();
});
```

Hold the arrow key and an earlier request can resolve last, painting the previous symbol under the new symbol's header. The same file already solves this for Sector panels (`_activeChartReqId`, `index.js:2013`) — just copy the pattern:

```js
const reqId = ++_maxChartReqId;
// ...inside .then:
if (reqId !== _maxChartReqId) return;
```

### 1.5 Undeclared variable breaks magnet snap on tiles 2–4 — ✅ fixed
`chart_draw.js:502` reads `_subLwCandles[...]`, which **is not declared anywhere in the repo** (verified: single occurrence). In magnet mode on a sub-tile this throws a `ReferenceError` inside `getEventCoords()`, which is not wrapped in `try` — so placing a drawing fails silently. Declare `let _subLwCandles = [null,null,null,null];` next to `_subLwSeries` (`index.js:8626`) and populate it in `maxChartRenderSubTile()`.

A `no-undef` ESLint pass would have caught this and 1.1's class of issue for free.

### 1.6 15-minute chart shows no time axis — ✅ fixed
`timeVisible: _sdChartsInterval === '1H'` (`index.js:6814`) — the `15m` option is intraday but gets `timeVisible: false`, so consecutive bars collapse into one repeated date label. `chart_core.js:183` gets it right (`'1H' || '15m'`), which confirms the intent.

### 1.7 Intraday zoom preference is never persisted — ✅ fixed
`_chartUserZoomSpanIntraday` is written at `index.js:390` but never saved to `localStorage` and never read back — unlike daily (`nse_screener_zoom_daily`) and weekly. Intraday users re-zoom on every reload.

---

## Tier 2 — Highest-value feature gaps

Ranked by "how often a swing trader hits this wall".

| # | Gap | Why it matters here | Effort |
|---|---|---|---|
| 2.1 | **No sub-panes (RSI / MACD / ATR / relative volume)** | Every oscillator is currently squeezed onto the *price* pane via hidden scales (`rs_scale` top 5–30%, `vol_scale` bottom 18%). Price-scale collisions are inevitable, and there's no honest momentum panel. | L |
| 2.2 | **No log / percent price scale** | Mid/small-cap base breakouts are 3–10× runs; on linear scale the base looks flat and the breakout looks vertical. One-line fix, high analytical value. | S |
| 2.3 | **No compare/overlay (Nifty, sector index)** | You already fetch `^NSEI` for the RS line (`index.js:6696`), but only as an unlabelled ratio. A normalized %-change overlay makes "is this stock actually outperforming *this week*" readable at a glance. | M |
| 2.4 | **Sub-tiles are second-class charts** | `maxChartRenderSubTile()` (`index.js:8892`) hardcodes `'1y','1d'` regardless of the timeframe selector, and draws **no volume, no MAs, no crosshair, no RS**. Tile 1 and tile 2–4 look like different products. | M |
| 2.5 | **No horizontal / vertical line, channel, or ellipse** — ✅ fixed (lines + channel; ellipse still missing) | You had a horizontal *ray* and a 16-tool belt, but no plain horizontal line (the single most-used drawing on a price chart) and no parallel channel. Horizontal Line, Vertical Line and Parallel Channel have shipped; an Ellipse tool is still absent. | S |
| 2.6 | **No drawing object list / "hide all drawings"** — ✅ fixed | With 16 tools and per-symbol persistence, there's no way to audit or bulk-toggle annotations. A collapsible object tree (type, colour, visibility, delete) has shipped; a global "hide all" toggle and per-object lock are still open. | M |
| 2.7 | **No keyboard-tool hotkeys** | Keyboard support exists for watchlist navigation, but drawing tools are mouse-only. Alt+T/L/R/H/F would match TradingView muscle memory. | S |
| 2.8 | **No accessible fallback** | `index.html` is 3,628 lines with exactly one `aria-label`; charts are canvas-only with no text alternative and the canvas isn't focusable. A `<details>`-based data table per chart + `aria-label` on the 60+ toolbar buttons is cheap and covers screen readers. | S |

### On 2.1 specifically

Lightweight Charts **v4.1.3** (pinned in `lightweight-charts.standalone.production.js`) has **no pane API** — one pane per chart. Three options:

1. **Stack two charts** (works today, ~60 lines): a second `createChart()` below the price chart with `timeScale().subscribeVisibleLogicalRangeChange(r => child.timeScale().setVisibleLogicalRange(r))` for sync. Ugly but zero-risk.
2. **Upgrade to v5**, which adds real panes (`chart.addPane()`). Cost: the private-API hack in 3.1 must be removed first (it will break), plus `addCandlestickSeries` → `addSeries(CandlestickSeries, …)` migration. Plan it as its own PR.
3. **Custom primitive** drawing the oscillator inside the price pane's bottom margin.

Recommendation: do **(1) now** to validate the UX, then **(2)** as a deliberate upgrade once 3.1 is cleaned up.

---

## Tier 3 — Architecture / maintainability

### 3.1 The reset-price-scale hack reaches into minified internals — ✅ fixed
`resetChartPriceScale()` (`index.js:327`, duplicated at `screener.html:4156`) calls `psApi.Ub.$t()`, `model.Lc()`, `model.A_()`, `target.Ht.A_()`, `internalPs.Po/So/Sa()` — every one of those is a **minified private symbol of v4.1.3**. There they all still exist (verified in the bundle), which is exactly what makes this dangerous: it works until the day the vendor file is bumped, then fails silently via the `catch` and looks like "auto-scale is flaky".

All of this was replaceable with documented behaviour: `chart.priceScale(id).applyOptions({ autoScale: true })`, plus Lightweight Charts' built-in double-click-to-reset. Both copies now do exactly that in four lines, which removes the single biggest upgrade blocker. (One correction to the original note: the private `Po(null)` also dropped the *previous* price range, and `applyOptions({autoScale:true})` does not — it re-derives the range on the next repaint instead, which is what resetting auto-scale actually means. The visible behaviour is the same.)

### 3.2 Four parallel chart implementations
| Surface | Implementation | Volume | MAs | RS | Drawings |
|---|---|---|---|---|---|
| Chart Studio tile 1 | `drawMaxChartLightweight()` `index.js:6749` | VCP colours | ✅ | ✅ | ✅ |
| Chart Studio tiles 2–4 | `maxChartRenderSubTile()` `index.js:8892` | ❌ | ❌ | ❌ | ✅ |
| Sector cards / SCC | `renderLwCardChart()` `chart_core.js` | flat 35% | ✅ | ✅ | via host |
| Screener detail | `renderLwCardChart()` | flat 35% | ✅ | ❌ (`niftyCandles: null`) | ✅ |
| Legacy canvas | `drawMaxChart()` `index.js:7233`, `drawAnyChart()` `index.js:7835` | inline | inline | inline | ❌ |

`renderLwCardChart()` is already the right abstraction — it takes `chartType`, `maVisibility`, `onCrosshairMove`, `observersMap`, `candlesMap`. **Converge everything on it**, passing an `options` bag for the VCP volume palette and the RS scale. That alone would let 2.4, the volume-colour inconsistency, and the "Chart Studio ≠ Sector cards" drift be fixed in one place instead of four.

Also delete: `initLightweightChart()` in `screener.html:4327` (never called, ~140 lines) — and note it uses `param.seriesPrices`, which was **removed in LC v4**, so it would throw if it ever were called.

### 3.3 The `fn.length === 2` arity sniffing in `chart_core.js`
`chart_core.js:369` and `:385` branch on `global.applyPreservedChartZoom.length === 2` to work around Screener's local 2-arg version (`screener.html:4193`). That's a code smell that will bite the moment anyone adds a third parameter. Fix: give every host the same 3-arg signature, or pass an explicit options object.

### 3.4 Window resize re-renders every chart
`index.js:5173` — on any resize, after a 100 ms debounce, it re-runs `renderChart`, `bsrRenderChart`, `renderA1Sparkline`, `brrgDraw` **and**, if the sector drill-down is open in auto layout, `sdRenderCharts()` — which destroys and rebuilds every LightweightCharts instance and re-fetches candles. `renderLwCardChart()` already manages its own `ResizeObserver`, so the global rebuild is redundant work. Replace with per-chart `applyOptions({ width, height })`.

### 3.5 `drawMaxChartLightweight()` rebuilds on every option change
`index.js:6752` unconditionally calls `_maxLwChart.remove()` and rebuilds for a chart-type change, data-source change, or timeout. Data-only changes should be `priceSeries.setData(...)` + `series.applyOptions(...)` — no teardown, no flicker, no need to restore zoom afterwards.

### 3.6 Canvas fallback is dead code
`#max-chart-canvas` ships with `style="display:none"` (`index.html:1725`), and `drawMaxChart()`'s fallback path calls `getBoundingClientRect()` on it → `0×0` → `targetW = 0` → returns silently. Either give it real dimensions when used, or remove the 198-line fallback and rely on the existing TradingView-iframe fallback in `_maxFetchAndDraw().catch()` (which is already the better degradation).

### 3.7 Timezone handling should be explicit
No `localization.timeFormatter` / `tickMarkFormatter` is set anywhere. Lightweight Charts renders `UTCTimestamp` values verbatim, so a 09:15 IST bar plots at 03:45. The intraday paths only exist for `1H`/`15m`, so the damage is bounded — but worth an explicit formatter before adding more intraday timeframes:

```js
timeScale: {
  tickMarkFormatter: (t) => {
    const d = new Date((t + 19800) * 1000);
    return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' });
  }
}
```

### 3.8 No build, no lint, no tests
No `package.json`, no CI beyond the Python scanner. `index.js` is 12,145 lines including a **34,931-character** single line (`index.js:6090`, the `INFO` tooltip dictionary). Even a minimal setup pays for itself immediately:

- `esbuild` bundling → catches duplicate top-level `const`s across `index.js` + `chart_core.js`;
- `eslint --rule no-undef:error` → catches 1.5 and friends;
- one Playwright smoke test per surface ("chart container has a `<canvas>` and no console errors") → catches a broken vendor bump in seconds.

---

## Suggested sequencing

**Sprint 1 — correctness (≈1–2 days).** 1.2 (remove or implement Vol Candles), 1.3 (cache TTL + working refresh), 1.4 (request-id guard), 1.5 (declare `_subLwCandles`), 1.6, 1.7. All small, all user-visible.

**Sprint 2 — make the drawing engine trustworthy (≈2–3 days) — ✅ shipped.** 1.1 (tile origin, done in Sprint 1), 3.1 (drop the private-API hack), 2.5 (H/V line + channel), 2.6 (object list). Drawing tools are the studio's headline feature; they should be flawless before anything new ships.

**Sprint 3 — analytical depth (≈1 week) — in progress.** The LightweightCharts v5 upgrade has shipped (see below); next is 2.1 (stacked oscillator panes, now a one-line `addSeries(…, paneIndex)` instead of hiding scales in the price pane), 2.2 (log scale), 2.3 (compare overlay), 2.4 (bring sub-tiles up to parity by routing them through `renderLwCardChart`).

**Sprint 4 — platform hygiene.** 3.2 convergence, 3.4/3.5 render-in-place, 3.8 lint + smoke tests, 2.7/2.8 (hotkeys, a11y).

---

## The one-line summary

> Fix the multi-tile drawing coordinate bug and the no-op "Vol Candles" / "Refresh" controls first — they're small, visible, and they undermine trust in everything else. Then converge the four chart implementations onto `renderLwCardChart()` and delete the minified-private-API hack, which is the single thing standing between you and a Lightweight Charts v5 upgrade that would give you real indicator panes for free.

---

## Sprint 1 — shipped

All seven Tier-1 defects are fixed on this branch. Regression tests live in
[`tests/charting/`](tests/charting/) and run with a bare Node install:

```bash
for t in tests/charting/*_test.js; do node "$t" || exit 1; done   # 55 assertions
```

| # | Fix | Files |
| --- | --- | --- |
| 1.1 | Added `getActiveTileOffset()`; the overlay now translates drawings into the active tile's pane, clips to that tile, and maps pointer/hit-test/drag/toolbar coordinates through the same origin. | `chart_draw.js` |
| 1.2 | Removed the non-functional *Vol Candles* option from all three type selectors; existing selections are normalised to `candlestick` on load. The drawing code is untouched, so the legacy canvas renderer still supports it internally. | `index.html`, `sectors.html`, `index.js` |
| 1.3 | Candle cache is now timestamped (60 s TTL), size-capped at 400 entries with recency eviction, and `maxChartRefresh()` passes `force` to bypass it. | `index.js` |
| 1.4 | Added a monotonic `_maxChartReqId`; the resolved promise, the error path, and both API-fallback paths bail out if a newer request superseded them. | `index.js` |
| 1.5 | Declared `_subLwCandles` alongside `_subLwSeries`, populated it in `maxChartRenderSubTile()`, and routed the magnet read through a `typeof`-guarded `getActiveDrawCandles()` so host pages without `index.js` cannot throw. | `index.js`, `chart_draw.js` |
| 1.6 | `timeVisible` now covers `15m` as well as `1H`. | `index.js` |
| 1.7 | Intraday zoom span is saved to and restored from `nse_screener_zoom_intraday`. | `index.js` |

### Deliberately not done

* **1.2 was retired rather than implemented.** A real variable-width body needs either
  `addCustomSeries` (~40 lines) or a v5 upgrade; removing the dead option makes the
  UI honest today without pretending. Tracked under Sprint 3.
* The legacy canvas branch that still keys off `volume_candles`
  (`index.js:7346`, `:7366`, `:7897`) was left in place — it is now unreachable
  through the UI but harmless, and it is the reference implementation if option 1.2
  is revisited.

## Sprint 2 — shipped

```bash
for t in tests/charting/*_test.js; do node "$t" || exit 1; done   # 320 assertions, all passing
```

| # | Change | Files |
| --- | --- | --- |
| 3.1 | `resetChartPriceScale` no longer reaches into minified internals (`psApi.Ei()`, `Ub.$t()`, `model.A_()`, `internalPs.Po/So/Sa`). It is now four lines of public API: `priceScale(id).applyOptions({ autoScale: true })`. In v4.1.3 that routes `priceScale → Ic()` → `Lh({rightPriceScale})` → the scale's `So()`, which sets the very `autoScale` flag the range recompute reads, and it schedules the repaint itself. **This removes the last blocker to a LightweightCharts v5 upgrade.** | `index.js`, `screener.html` |
| 2.5a | **Horizontal Line** tool (`hline`) — infinite price line with a right-edge price tag, single click to place, drag anywhere on the line to move it. | `chart_draw.js`, `index.html`, `sectors.html`, `screener.html` |
| 2.5b | **Vertical Line** tool (`vline`) — infinite time line with a date tag taken from the bar it is dropped on, single click to place, drag to another bar to move it. | `chart_draw.js`, `index.html`, `sectors.html`, `screener.html` |
| 2.5c | **Parallel Channel** tool (`channel`) — three clicks (base start → base end → offset rail), filled band with a dashed midline, live preview between clicks, and all three anchors draggable. Honours the existing *Extend* and *Fill* settings. | `chart_draw.js`, `index.html`, `sectors.html`, `screener.html` |
| 2.6 | **Drawing object list** — a TradingView-style Objects panel (toolbar → ☰) listing every drawing on the active symbol with its type, a colour swatch, an anchor summary (`₹ 2,431.5 → ₹ 2,502.1 (+2.9%)`, the date for a vertical line, the text for a note). Click a row to select it, ◉/◌ to hide/show, ✕ to delete. Hide and delete both push undo history. | `chart_draw.js`, `index.css`, `screener.html` |

Two pre-existing defects surfaced while verifying 2.6 and were fixed in the same pass:

* `showChartToast` was called from ~40 unguarded sites in `chart_draw.js`, but
  `screener.html` never defines it — so **every drawing commit threw on the screener
  page**. `chart_draw.js` now installs a no-op fallback that `index.js` replaces.
* Dragging a drawing recorded no undo frame, so `Ctrl+Z` after a drag deleted the
  drawing instead of restoring its pre-drag position. Drags are now undoable (and
  redoable) back to their original geometry.

## Sprint 3 (part 1) — the LightweightCharts v5 upgrade, shipped

`lightweight-charts.standalone.production.js` is now **v5.3.0** (was 4.1.3). This was
only possible because Sprint 2 removed the last reliance on minified internals.

v5 is a breaking major: it deleted `chart.addCandlestickSeries()`, `addBarSeries()`,
`addLineSeries()`, `addAreaSeries()` and `addHistogramSeries()` in favour of
`chart.addSeries(CandlestickSeries, opts)`, and removed `series.setMarkers()` in favour of
the `createSeriesMarkers()` plugin. Both removals are silent — nothing throws until a
chart is built, so `node --check` and the DOM-stub boot test both passed while the
chart pane would have come up empty.

| Change | Files |
| --- | --- |
| Added a three-function adapter (`lwAddSeries`, `lwSetMarkers`, `lwVersion`) that uses the v5 API and falls back to the legacy factories. All 22 call sites now go through it, so the next major bump is a one-file change. | `chart_core.js`, `index.js`, `screener.html` |
| Vendor bundle replaced with v5.3.0; every `<script>` tag carries `?v=5.3.0` so browsers that cached 4.1.3 under the same filename pick up the new one. | `lightweight-charts.standalone.production.js`, `index.html`, `sectors.html`, `screener.html` |
| New `lw_harness.js` boots the **real** bundle headlessly (vm + DOM/2D-context shim + deferred rAF queue), so the contract is tested, not assumed. | `tests/charting/` |
| New `lw_version_test.js` (38 assertions) replays every series/marker/scale/time-scale configuration against the shipped bundle, and the same suite against a v4 build via `LW4_BUNDLE=…` (55 assertions there) — the adapter is deliberately not a one-way door. | `tests/charting/` |
| New `lw_render_test.js` (26 assertions) runs the real `drawMaxChartLightweight()` on a real v5 chart in both candlestick and OHLC modes, then binds `chart_draw.js` to that live chart and checks `pointToPixels`/`redrawChartDrawings` still resolve real coordinates. | `tests/charting/` |

One live defect surfaced while doing this: five `redrawChartDrawings()` calls in
`index.js` were unguarded inside LightweightCharts callbacks. On the screener page (which
builds charts but never loads `chart_draw.js`) those callbacks would throw. All five are
now `typeof`-guarded, matching the calls right next to them.

**Not yet exploited:** v5's headline feature for this codebase is real multi-pane support
(`chart.addSeries(series, opts, paneIndex)`, `chart.panes()`). That is the clean route to
gap 2.1 (RSI/MACD/ATR panes currently squeezed onto the price pane via hidden scales) and
would remove the `rs_scale`/`vol_scale` margin hacks. Worth doing next, as its own change.

## Sprint 3 (part 2) — the earnings pane

The v5 upgrade made real panes available, and there is exactly one pane this platform
needs: **the WIN indicator's own quarterly EPS / Sales growth**, plotted under the price.

Rationale: the HUD already prints these numbers as text, but text cannot show *sequence* —
whether growth is accelerating or rolling over, and whether that lines up with the price
setup. The pane puts the same numbers on the time axis the candles already use, so a
quarterly print sits under the price action that followed it. Deliberately **not** added:
RSI, MACD, log scale, compare overlay. This is a proprietary-indicator tool, not a
TradingView clone.

| Change | Files |
| --- | --- |
| `applyEarningsPane()` / `clearEarningsPane()` / `buildEarningsBuckets()` / `earningsQuarterTime()`. EPS YoY is a histogram, Sales YoY a line, both on one % axis with a zero reference. | `chart_core.js` |
| Wired into the max chart next to the HUD table, where `details` and the candle array are already in scope. Off by default (`inputs.epsPane`), toggled from the toolbar (`win-btn-eps`) on all three hosts. | `index.js`, `index.html`, `sectors.html`, `screener.html` |
| New `earnings_test.js` (45 assertions) run against the **real** `exact_quarterly_financials.json`, not fixtures. | `tests/charting/` |

### The data problem this surfaced

The shipped financials file is not tidy. Across 7,757 EPS growth prints: median +19%,
10th… p90 +212%, p99 +2,205%, **max +109,634%, min −1,036,590%**. A third of all quarters
exceed +200%. Drawn to scale, one such print flattens every other bar into an invisible
line, so the panel shows nothing useful precisely for the stocks that moved most.

The pane therefore clamps to ±100% (`epsCap`) and paints clamped bars in a **muted
colour** — an off-the-scale quarter reads as off-the-scale rather than as a middling one.
The exact figure stays in the HUD table, which is the precise readout. The axis is pinned
(`autoScale: false`) so the meaning of the top edge does not drift between renders.

Two further defects were found while testing, both of which only appear on real data:

* `"Sep-2026"` parsed as **Sep 2020** — the label regex matched the first two digits and
  ignored the rest. Fixed with a digit lookahead; unparseable labels now return `null`
  instead of a plausible-but-wrong date.
* Panes were keyed by string id, so a chart could accumulate several earnings panes if
  the same chart was asked for under two keys. `clearEarningsPane()` now clears every
  pane belonging to the chart.

## Sprint 3 (part 3) — one implementation of the indicator

The WIN indicator previously existed **three times**: the max chart carried its own copy,
the card renderer had a second, and `screener.html` had a third. They had drifted, and the
drift was visible:

| | EMA10 | EMA20 | SMA50 | SMA200 | SMA30W | RS | Vol trigger | VCP markers | Volume colours |
|---|---|---|---|---|---|---|---|---|---|
| max chart | yes | yes | yes | yes | yes | yes | yes | yes | **6-tier hierarchy** |
| card renderer | yes | yes | yes | yes | yes | yes | yes | yes | plain up/down |
| screener | via map | yes | yes | yes | **no** | **never** | **no** | **no** | plain up/down |

So the same stock looked like a different setup depending on which page you opened — the
one thing an indicator must never do.

| Change | Files |
| --- | --- |
| `computeWinIndicator()` — one pure function returning every line, the RS series, the markers, the volume trigger and the volume colours. Plus `_winEMA` / `_winSMA` / `_winAvgVol*` primitives. No DOM, no chart API. | `chart_core.js` |
| The max chart's 250-line inline indicator block is now a call into `computeWinIndicator()` followed by a draw loop. Its per-timeframe rules (weekly: 30W only; daily: 50/200) moved into `win.lines[].active`. | `index.js` |
| The card renderer gained the six-tier volume hierarchy and lost its private `_ccCalcEMA` / `_ccCalcSMA` / `_ccCalcAvgVol` duplicates. | `chart_core.js` |
| `screener.html` no longer passes `niftyCandles: null`, so the RS line can exist on that page at all; it now fetches `^NSEI` for the same timeframe. | `screener.html` |
| New `convergence_test.js` (31 assertions) replays the shared module against the surviving per-page maths and demands a bit-exact match. | `tests/charting/` |

### What made this riskier than it looks

Two average-volume functions exist upstream and they are **not** interchangeable:

* `_winAvgVolCumulative` — no nulls; early bars average whatever exists so far. This
  colours the volume histogram (max chart behaviour).
* `_winAvgVolSeries` — null until a full window exists. This feeds `calculateWinMarkers`.

`calculateAvgVol` in `index.js` is the second shape; the max chart's inline loop is the
first. Collapsing them — the obvious "cleanup" — would have silently changed the marker
placement and the volume colours at once. Both are preserved, named, and commented.

The extraction was validated by comparing it to the old code **before** any of the old code
was removed: identical to 0.0e+0 across EMA 10/20/50/200, SMA 30/50/200, average volume,
and every one of the 320 volume-bar colours.

## Sprint 3 (part 4) — the chart-data path was dead

Not a charting defect, but it made the charting unverifiable: on a real machine **every**
data route failed at once, so every chart came up empty.

| Route | Symptom |
| --- | --- |
| `nse-chart-proxy.shibu-mk.workers.dev` | **404** — the `/chart` passthrough had never been committed; the deployed worker only served D1 routes |
| `api.allorigins.win` | **429** — rate-limited, then a CORS rejection |
| `localhost:9090` | never consulted when the page is opened from `file://`… and the page *was* |

The screener-style grid requests ~40 charts at once, which is what tripped the 429s, so the
console filled with errors that looked like a code fault.

| Change | Files |
| --- | --- |
| `/chart?url=` passthrough added to the worker. Allow-listed to `query1\|query2.finance.yahoo.com` and to `/v8/finance/chart/` only — deliberately not an open proxy, which would be abused within hours. Sets a browser User-Agent (Yahoo rejects unknown agents) and edge-caches for 60s. | `cloudflare-worker/src/index.js`, `cloudflare-worker/README.md` |
| The client stopped racing three public proxies on every mirror. It now tries routes in order of reliability and stops after the first success. | `index.js` |
| A `404` from our own worker trips a session-long circuit breaker. The dead route previously cost a 3.8s timeout **per chart, per mirror** — a grid render paid it ~80 times. | `index.js` |
| The `localhost:9090` probe is now gated on the page actually being served from loopback. On GitHub Pages it was probing the *visitor's* machine. | `index.js` |
| `file://` mode now explains itself once, instead of failing silently and looking like a bug. | `index.js` |
| New `datasource_test.js` (25 assertions) covers the worker's allow-list, the chain ordering, loopback gating and the circuit breaker — no network required. | `tests/charting/` |

### Still open from this review

Tier 2 items not covered above (log scale, compare overlay, sub-tile parity) are untouched.
Several of them — log scale especially — are TradingView parity for its own sake and are
**not** on the roadmap. `drawAnyChart()` (the legacy canvas fallback, EMA20 + RS only) is
still a fourth renderer, but it is now unreachable from the UI and is the only remaining
copy of any indicator maths.
