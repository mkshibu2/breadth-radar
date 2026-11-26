// Shared TradingView Drawing Tools & Editing Engine
// ── TRADINGVIEW DRAWING TOOLS & EDITING ENGINE ────────────────────────────
let _currentDrawTool = 'select'; // 'select' | 'trendline' | 'ray_h' | 'ray' | 'rect' | 'scale' | 'pricenote' | 'text'
let _drawStep = 0; // 0 = idle, 1 = first point placed, waiting for second point
let _drawStart = null; // { x, y, logical, price, time }
let _activeDrawing = null; // preview object while drawing
let _selectedDrawingIndex = null; // index of selected drawing in active symbol's list
let _dragMode = null; // null | 'handle' | 'move' | 'float_toolbar'
let _dragHandle = null; // 'p1' | 'p2' | 'nw' | 'ne' | 'se' | 'sw'
let _dragOrigin = null; // { x, y, logical, price }
let _dragStartDrawing = null; // clone of drawing at drag start
let _floatBarOffset = { x: 0, y: 0 };
let _isDrawMouseDown = false;

function getDefaultFibLevels() {
  return [
    { r: 0, c: '#787b86', enabled: true },
    { r: 0.236, c: '#f23645', enabled: true },
    { r: 0.382, c: '#ff9800', enabled: true },
    { r: 0.5, c: '#4caf50', enabled: true },
    { r: 0.618, c: '#089981', enabled: true },
    { r: 0.786, c: '#00bcd4', enabled: true },
    { r: 1.0, c: '#787b86', enabled: true },
    { r: 1.272, c: '#ab47bc', enabled: false },
    { r: 1.618, c: '#2962ff', enabled: true },
    { r: 2.618, c: '#ec4899', enabled: false },
    { r: 3.618, c: '#9c27b0', enabled: false },
    { r: 4.236, c: '#e91e63', enabled: false }
  ];
}
window.getDefaultFibLevels = getDefaultFibLevels;

function getDefaultFibExtLevels() {
  return [
    { r: 0, c: '#787b86', enabled: true },
    { r: 0.382, c: '#ff9800', enabled: true },
    { r: 0.5, c: '#4caf50', enabled: true },
    { r: 0.618, c: '#089981', enabled: true },
    { r: 0.786, c: '#00bcd4', enabled: false },
    { r: 1.0, c: '#787b86', enabled: true },
    { r: 1.272, c: '#ab47bc', enabled: true },
    { r: 1.618, c: '#2962ff', enabled: true },
    { r: 2.0, c: '#38bdf8', enabled: true },
    { r: 2.618, c: '#ec4899', enabled: true },
    { r: 3.618, c: '#9c27b0', enabled: false },
    { r: 4.236, c: '#e91e63', enabled: false }
  ];
}
window.getDefaultFibExtLevels = getDefaultFibExtLevels;

let _chartDrawings = {};
try {
  _chartDrawings = JSON.parse(localStorage.getItem('nse_chart_drawings_v2') || '{}');
} catch (e) {
  _chartDrawings = {};
}

function syncCanvasSize() {
  const canvas = document.getElementById('max-chart-draw-canvas');
  if (!canvas) return;
  const stage = document.getElementById('max-chart-stage') || canvas.parentElement;
  if (!stage) return;
  const rect = stage.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const W = Math.round(rect.width || stage.clientWidth || 800);
  const H = Math.round(rect.height || stage.clientHeight || 500);
  const tw = Math.round(W * dpr);
  const th = Math.round(H * dpr);
  if (canvas.width !== tw || canvas.height !== th) {
    canvas.width = tw;
    canvas.height = th;
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
  }
}
window.syncCanvasSize = syncCanvasSize;

let _cloudPushDrawingsDebounce = null;
function saveChartDrawings(syncCloud = true) {
  try {
    localStorage.setItem('nse_chart_drawings_v2', JSON.stringify(_chartDrawings));
    const now = Date.now();
    localStorage.setItem('_chartDrawingsUpdatedAt', now.toString());
    if (syncCloud) {
      const activeSym = (typeof getActiveDrawingSymbol === 'function') ? getActiveDrawingSymbol() : null;
      if (activeSym) {
        if (typeof cfPushSymbolDrawings === 'function') {
          cfPushSymbolDrawings(activeSym, _chartDrawings[activeSym] || [], now);
        } else {
          try {
            const cfUrl = (localStorage.getItem('nse_cf_worker_url') || '').trim().replace(/\/+$/, '');
            const cfToken = (localStorage.getItem('nse_cf_sync_token') || '').trim();
            if (cfUrl) {
              const headers = { 'Content-Type': 'application/json' };
              if (cfToken && cfToken !== 'cf-d1') headers['Authorization'] = `Bearer ${cfToken}`;
              fetch(`${cfUrl}/api/drawings/${encodeURIComponent(activeSym.toUpperCase())}`, {
                method: 'PUT',
                headers,
                keepalive: true,
                body: JSON.stringify({ drawings: _chartDrawings[activeSym] || [], updatedAt: now })
              }).catch(() => { });
            }
          } catch (e) { }
        }
      }
      if (_cloudPushDrawingsDebounce) clearTimeout(_cloudPushDrawingsDebounce);
      _cloudPushDrawingsDebounce = setTimeout(() => {
        _cloudPushDrawingsDebounce = null;
        if (typeof pushToCloud === 'function') {
          pushToCloud().catch(e => console.warn('[Cloud Sync Drawings] push failed:', e.message));
        }
      }, 600);
    }
  } catch (e) { }
}
window.addEventListener('pagehide', () => {
  if (_cloudPushDrawingsDebounce) {
    clearTimeout(_cloudPushDrawingsDebounce);
    _cloudPushDrawingsDebounce = null;
    if (typeof pushToCloud === 'function') {
      try { pushToCloud().catch(() => {}); } catch (e) { }
    }
  }
});

function getActiveDrawingSymbol() {
  if (window.CHART_DRAW_HOST && typeof window.CHART_DRAW_HOST.getSymbol === 'function') {
    return (window.CHART_DRAW_HOST.getSymbol() || 'DEFAULT').toUpperCase().replace(/\.(NS|BO)$/i, '');
  }
  return ((_maxChartLayout !== '1' && _layoutSymbols[_activeLayoutTile - 1]) || _sdMaximizedChartSymbol || 'DEFAULT').toUpperCase().replace('.NS', '');
}

let _drawMagnetMode = false;
const _drawUndoStack = {};
const _drawRedoStack = {};

function toggleDrawMagnetMode() {
  _drawMagnetMode = !_drawMagnetMode;
  const btn = document.getElementById('draw-tool-magnet');
  if (btn) btn.classList.toggle('active', _drawMagnetMode);
  if (typeof showChartToast === 'function') {
    showChartToast(_drawMagnetMode ? '🧲 Magnet Mode ON (Snaps to OHLC)' : 'Magnet Mode OFF', _drawMagnetMode ? '#38bdf8' : '#94a3b8');
  }
}
window.toggleDrawMagnetMode = toggleDrawMagnetMode;

function pushDrawHistory(sym) {
  if (!sym) return;
  if (!_drawUndoStack[sym]) _drawUndoStack[sym] = [];
  const snap = JSON.parse(JSON.stringify(_chartDrawings[sym] || []));
  _drawUndoStack[sym].push(snap);
  if (_drawUndoStack[sym].length > 50) _drawUndoStack[sym].shift();
  _drawRedoStack[sym] = [];
}

function undoChartDrawing() {
  const sym = getActiveDrawingSymbol();
  if (!sym || !_drawUndoStack[sym] || _drawUndoStack[sym].length === 0) {
    if (typeof showChartToast === 'function') showChartToast('Nothing to undo', '#94a3b8');
    return;
  }
  if (!_drawRedoStack[sym]) _drawRedoStack[sym] = [];
  _drawRedoStack[sym].push(JSON.parse(JSON.stringify(_chartDrawings[sym] || [])));
  _chartDrawings[sym] = _drawUndoStack[sym].pop();
  _selectedDrawingIndex = null;
  hideFloatingToolbar();
  saveChartDrawings();
  redrawChartDrawings();
  if (typeof showChartToast === 'function') showChartToast('↶ Undid drawing change', '#38bdf8');
}
window.undoChartDrawing = undoChartDrawing;

function redoChartDrawing() {
  const sym = getActiveDrawingSymbol();
  if (!sym || !_drawRedoStack[sym] || _drawRedoStack[sym].length === 0) {
    if (typeof showChartToast === 'function') showChartToast('Nothing to redo', '#94a3b8');
    return;
  }
  if (!_drawUndoStack[sym]) _drawUndoStack[sym] = [];
  _drawUndoStack[sym].push(JSON.parse(JSON.stringify(_chartDrawings[sym] || [])));
  _chartDrawings[sym] = _drawRedoStack[sym].pop();
  _selectedDrawingIndex = null;
  hideFloatingToolbar();
  saveChartDrawings();
  redrawChartDrawings();
  if (typeof showChartToast === 'function') showChartToast('↷ Redid drawing change', '#38bdf8');
}
window.redoChartDrawing = redoChartDrawing;

function clearChartDrawings() {
  const sym = getActiveDrawingSymbol();
  if (!sym) return;
  pushDrawHistory(sym);
  _chartDrawings[sym] = [];
  _selectedDrawingIndex = null;
  hideFloatingToolbar();
  saveChartDrawings();
  redrawChartDrawings();
  showChartToast('🗑 Drawings cleared for ' + sym, '#ef4444');
}
window.clearChartDrawings = clearChartDrawings;

function setDrawingTool(tool) {
  _currentDrawTool = tool;
  _drawStep = 0;
  _drawStart = null;
  _activeDrawing = null;
  _isDrawMouseDown = false;
  _dragMode = null;

  if (tool !== 'select') {
    _selectedDrawingIndex = null;
    hideFloatingToolbar();
  }

  initChartDrawingCanvas();

  document.querySelectorAll('.tv-draw-btn').forEach(b => b.classList.remove('active'));
  const btn = document.getElementById('draw-tool-' + tool);
  if (btn) btn.classList.add('active');

  const canvas = document.getElementById('max-chart-draw-canvas');
  if (canvas) {
    canvas.style.display = 'block';
    if (tool === 'select') {
      canvas.style.pointerEvents = _selectedDrawingIndex != null ? 'all' : 'none';
      canvas.style.cursor = 'default';
      canvas.style.zIndex = '12';
    } else {
      canvas.style.pointerEvents = 'all';
      canvas.style.cursor = 'crosshair';
      canvas.style.zIndex = '35'; // elevated above legend & headers
      syncCanvasSize();
    }
  }
  redrawChartDrawings();

  if (tool === 'trendline') {
    showChartToast('✏ Trend Line active: Click 2 points or drag to draw', '#38bdf8');
  } else if (tool === 'scale') {
    showChartToast('📏 Price Range active: Click 2 points or drag across price levels', '#22c55e');
  } else if (tool === 'ray_h') {
    showChartToast('📍 Horizontal Ray: Click any price level to place', '#38bdf8');
  } else if (tool === 'ray') {
    showChartToast('↗ Arrow Ray: Click origin then target direction', '#eab308');
  } else if (tool === 'fib') {
    showChartToast('🔢 Fib Retracement: Click 2 swing points or drag', '#38bdf8');
  } else if (tool === 'fib_ext') {
    showChartToast('🔢 Fib Extension: Click 3 points (Origin, Peak, Pullback)', '#38bdf8');
  } else if (tool === 'curve') {
    showChartToast('〰 Curve: Click 2 endpoints then adjust bend', '#38bdf8');
  } else if (tool === 'rect') {
    showChartToast('▢ Rectangle: Click 2 corners or drag', '#38bdf8');
  } else if (tool === 'path') {
    showChartToast('〽 Path: Click points, double-click or Enter to finish', '#38bdf8');
  } else if (tool === 'comment') {
    showChartToast('💬 Comment: Click to place callout balloon', '#38bdf8');
  }
}
window.setDrawingTool = setDrawingTool;

// Helper: distance from point (x,y) to line segment (x1,y1)-(x2,y2)
function distToSegment(x, y, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const l2 = dx * dx + dy * dy;
  if (l2 === 0) return Math.hypot(x - x1, y - y1);
  let t = ((x - x1) * dx + (y - y1) * dy) / l2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(x - (x1 + t * dx), y - (y1 + t * dy));
}

// Coordinate mapping helper
function getDrawingContext() {
  if (window.CHART_DRAW_HOST && typeof window.CHART_DRAW_HOST.getContext === 'function') {
    return window.CHART_DRAW_HOST.getContext();
  }
  const chart = (_activeLayoutTile > 1 && _subLwCharts[_activeLayoutTile]) ? _subLwCharts[_activeLayoutTile] : _maxLwChart;
  const series = (_activeLayoutTile > 1 && _subLwSeries[_activeLayoutTile]) ? _subLwSeries[_activeLayoutTile] : _maxLwPriceSeries;
  const timeScale = chart ? chart.timeScale() : null;
  return { chart, series, timeScale };
}

function pointToPixels(p, timeScale, series) {
  let px = p.x;
  let py = p.y;
  if (timeScale && typeof timeScale.logicalToCoordinate === 'function' && p.logical != null) {
    try {
      const cx = timeScale.logicalToCoordinate(p.logical);
      if (cx != null && isFinite(cx)) px = cx;
    } catch (e) { }
  }
  if (series && typeof series.priceToCoordinate === 'function' && p.price != null) {
    try {
      const cy = series.priceToCoordinate(p.price);
      if (cy != null && isFinite(cy)) py = cy;
    } catch (e) { }
  }
  return { x: px, y: py };
}

// Hit-testing drawings for selection & manipulation
function hitTestChartDrawings(x, y) {
  const sym = getActiveDrawingSymbol();
  const drawings = _chartDrawings[sym] || [];
  if (!drawings.length) return null;

  const { timeScale, series } = getDrawingContext();

  for (let i = drawings.length - 1; i >= 0; i--) {
    const d = drawings[i];
    if (!d || (!d.p1 && (!d.points || !d.points.length))) continue;

    // Multi-point tool: Path
    if (d.type === 'path' && d.points && d.points.length >= 2) {
      const pts = d.points.map(p => pointToPixels(p, timeScale, series));
      for (let k = 0; k < pts.length; k++) {
        if (Math.hypot(x - pts[k].x, y - pts[k].y) <= 10) {
          return { index: i, drawing: d, handle: 'pt_' + k, pt: pts[k] };
        }
      }
      for (let k = 0; k < pts.length - 1; k++) {
        if (distToSegment(x, y, pts[k].x, pts[k].y, pts[k + 1].x, pts[k + 1].y) <= 8) {
          return { index: i, drawing: d, handle: 'body' };
        }
      }
      continue;
    }

    const pt1 = pointToPixels(d.p1, timeScale, series);
    const pt2 = d.p2 ? pointToPixels(d.p2, timeScale, series) : pt1;

    // 1. Check anchor handles first (tolerance 9px)
    if (d.type === 'trendline' || d.type === 'ray') {
      if (Math.hypot(x - pt1.x, y - pt1.y) <= 9) return { index: i, drawing: d, handle: 'p1', pt: pt1 };
      if (Math.hypot(x - pt2.x, y - pt2.y) <= 9) return { index: i, drawing: d, handle: 'p2', pt: pt2 };
      if (distToSegment(x, y, pt1.x, pt1.y, pt2.x, pt2.y) <= 7) return { index: i, drawing: d, handle: 'body' };
    } else if (d.type === 'curve') {
      const pt3 = d.p3 ? pointToPixels(d.p3, timeScale, series) : { x: (pt1.x + pt2.x) / 2, y: (pt1.y + pt2.y) / 2 };
      if (Math.hypot(x - pt1.x, y - pt1.y) <= 10) return { index: i, drawing: d, handle: 'p1', pt: pt1 };
      if (Math.hypot(x - pt2.x, y - pt2.y) <= 10) return { index: i, drawing: d, handle: 'p2', pt: pt2 };
      if (Math.hypot(x - pt3.x, y - pt3.y) <= 10) return { index: i, drawing: d, handle: 'p3', pt: pt3 };
      const cpX = 2 * pt3.x - 0.5 * pt1.x - 0.5 * pt2.x;
      const cpY = 2 * pt3.y - 0.5 * pt1.y - 0.5 * pt2.y;
      for (let t = 0; t <= 1; t += 0.05) {
        const px = (1 - t) * (1 - t) * pt1.x + 2 * (1 - t) * t * cpX + t * t * pt2.x;
        const py = (1 - t) * (1 - t) * pt1.y + 2 * (1 - t) * t * cpY + t * t * pt2.y;
        if (Math.hypot(x - px, y - py) <= 8) return { index: i, drawing: d, handle: 'body' };
      }
    } else if (d.type === 'ray_h') {
      if (Math.hypot(x - pt1.x, y - pt1.y) <= 9) return { index: i, drawing: d, handle: 'p1', pt: pt1 };
      if (Math.abs(y - pt1.y) <= 7 && x >= pt1.x - 6) return { index: i, drawing: d, handle: 'body' };
    } else if (d.type === 'scale' || d.type === 'measure') {
      const minX = Math.min(pt1.x, pt2.x);
      const maxX = Math.max(pt1.x, pt2.x);
      const minY = Math.min(pt1.y, pt2.y);
      const maxY = Math.max(pt1.y, pt2.y);

      // 1. Check anchor handles p1 and p2 (TV Style)
      if (Math.hypot(x - pt1.x, y - pt1.y) <= 12) return { index: i, drawing: d, handle: 'p1', pt: pt1 };
      if (Math.hypot(x - pt2.x, y - pt2.y) <= 12) return { index: i, drawing: d, handle: 'p2', pt: pt2 };

      // 2. Check top line, bottom line, or middle vertical line
      const midX = (minX + maxX) / 2;
      if (distToSegment(x, y, minX, minY, maxX, minY) <= 8) return { index: i, drawing: d, handle: 'body' };
      if (distToSegment(x, y, minX, maxY, maxX, maxY) <= 8) return { index: i, drawing: d, handle: 'body' };
      if (distToSegment(x, y, midX, minY, midX, maxY) <= 8) return { index: i, drawing: d, handle: 'body' };

      // 3. Shaded interior area
      if (x >= minX - 4 && x <= maxX + 4 && y >= minY - 4 && y <= maxY + 4) {
        return { index: i, drawing: d, handle: 'body' };
      }
    } else if (d.type === 'rect') {
      const minX = Math.min(pt1.x, pt2.x);
      const maxX = Math.max(pt1.x, pt2.x);
      const minY = Math.min(pt1.y, pt2.y);
      const maxY = Math.max(pt1.y, pt2.y);

      if (Math.hypot(x - minX, y - minY) <= 9) return { index: i, drawing: d, handle: 'nw' };
      if (Math.hypot(x - maxX, y - minY) <= 9) return { index: i, drawing: d, handle: 'ne' };
      if (Math.hypot(x - maxX, y - maxY) <= 9) return { index: i, drawing: d, handle: 'se' };
      if (Math.hypot(x - minX, y - maxY) <= 9) return { index: i, drawing: d, handle: 'sw' };

      if (x >= minX - 5 && x <= maxX + 5 && y >= minY - 5 && y <= maxY + 5) {
        return { index: i, drawing: d, handle: 'body' };
      }
    } else if (d.type === 'fib') {
      if (Math.hypot(x - pt1.x, y - pt1.y) <= 10) return { index: i, drawing: d, handle: 'p1', pt: pt1 };
      if (Math.hypot(x - pt2.x, y - pt2.y) <= 10) return { index: i, drawing: d, handle: 'p2', pt: pt2 };
      if (distToSegment(x, y, pt1.x, pt1.y, pt2.x, pt2.y) <= 8) return { index: i, drawing: d, handle: 'body' };
      const p1Price = (d.p1 && d.p1.price != null) ? d.p1.price : 0;
      const p2Price = (d.p2 && d.p2.price != null) ? d.p2.price : 0;
      const fibLvls = (d.levels && d.levels.length) ? d.levels.filter(l => l.enabled !== false) : getDefaultFibLevels().filter(l => l.enabled !== false);
      const minX = Math.min(pt1.x, pt2.x) - 40;
      const isReverse = Boolean(d.reverse);
      for (const lvl of fibLvls) {
        const r = lvl.r;
        const lvlP = isReverse ? (p1Price + r * (p2Price - p1Price)) : (p2Price + r * (p1Price - p2Price));
        let lvlY = isReverse ? (pt1.y + r * (pt2.y - pt1.y)) : (pt2.y + r * (pt1.y - pt2.y));
        if (series && typeof series.priceToCoordinate === 'function') {
          const cy = series.priceToCoordinate(lvlP);
          if (cy != null && isFinite(cy)) lvlY = cy;
        }
        if (Math.abs(y - lvlY) <= 7 && x >= minX) return { index: i, drawing: d, handle: 'body' };
      }
    } else if (d.type === 'fib_ext') {
      const pt3 = d.p3 ? pointToPixels(d.p3, timeScale, series) : pt2;
      if (Math.hypot(x - pt1.x, y - pt1.y) <= 10) return { index: i, drawing: d, handle: 'p1', pt: pt1 };
      if (Math.hypot(x - pt2.x, y - pt2.y) <= 10) return { index: i, drawing: d, handle: 'p2', pt: pt2 };
      if (Math.hypot(x - pt3.x, y - pt3.y) <= 10) return { index: i, drawing: d, handle: 'p3', pt: pt3 };
      if (distToSegment(x, y, pt1.x, pt1.y, pt2.x, pt2.y) <= 8) return { index: i, drawing: d, handle: 'body' };
      if (distToSegment(x, y, pt2.x, pt2.y, pt3.x, pt3.y) <= 8) return { index: i, drawing: d, handle: 'body' };
      const p1Price = (d.p1 && d.p1.price != null) ? d.p1.price : 0;
      const p2Price = (d.p2 && d.p2.price != null) ? d.p2.price : 0;
      const p3Price = (d.p3 && d.p3.price != null) ? d.p3.price : p2Price;
      const deltaP = p2Price - p1Price;
      const extLvls = (d.levels && d.levels.length) ? d.levels.filter(l => l.enabled !== false) : getDefaultFibExtLevels().filter(l => l.enabled !== false);
      const minX = pt3.x - 10;
      for (const lvl of extLvls) {
        const r = lvl.r;
        const lvlP = p3Price + r * deltaP;
        let lvlY = pt3.y;
        if (series && typeof series.priceToCoordinate === 'function') {
          const cy = series.priceToCoordinate(lvlP);
          if (cy != null && isFinite(cy)) lvlY = cy;
        }
        if (Math.abs(y - lvlY) <= 7 && x >= minX) return { index: i, drawing: d, handle: 'body' };
      }
    } else if (d.type === 'comment') {
      const pt2 = d.p2 ? pointToPixels(d.p2, timeScale, series) : { x: pt1.x + 45, y: pt1.y - 40 };
      if (Math.hypot(x - pt1.x, y - pt1.y) <= 10) return { index: i, drawing: d, handle: 'p1', pt: pt1 };
      if (Math.hypot(x - pt2.x, y - pt2.y) <= 10) return { index: i, drawing: d, handle: 'p2', pt: pt2 };
      const txt = d.text || 'Comment';
      const bw = Math.max(65, (txt.length * 7.5) + 24);
      const bh = 28;
      const bx = pt2.x - bw / 2;
      const by = pt2.y - bh / 2;
      if (x >= bx - 4 && x <= bx + bw + 4 && y >= by - 4 && y <= by + bh + 4) {
        return { index: i, drawing: d, handle: 'p2', pt: pt2 };
      }
      if (distToSegment(x, y, pt1.x, pt1.y, pt2.x, pt2.y) <= 8) {
        return { index: i, drawing: d, handle: 'body' };
      }
    } else if (d.type === 'pricenote') {
      const pt2 = d.p2 ? pointToPixels(d.p2, timeScale, series) : { x: pt1.x + 40, y: pt1.y - 45 };
      // 1. Check anchor handle p1 (candle pin)
      if (Math.hypot(x - pt1.x, y - pt1.y) <= 10) return { index: i, drawing: d, handle: 'p1', pt: pt1 };
      // 2. Check anchor handle p2 (callout badge)
      if (Math.hypot(x - pt2.x, y - pt2.y) <= 10) return { index: i, drawing: d, handle: 'p2', pt: pt2 };

      // 3. Check callout badge box around p2
      const txt = d.text || ('₹ ' + (d.p1.price != null ? d.p1.price.toFixed(2) : ''));
      const bw = Math.max(50, (txt.length * 7.5) + 20);
      const bh = 24;
      const bx = pt2.x - bw / 2;
      const by = pt2.y - bh / 2;
      if (x >= bx - 4 && x <= bx + bw + 4 && y >= by - 4 && y <= by + bh + 4) {
        return { index: i, drawing: d, handle: 'p2', pt: pt2 };
      }
      // 4. Check leader line segment connecting p1 to p2 (moves whole drawing)
      if (distToSegment(x, y, pt1.x, pt1.y, pt2.x, pt2.y) <= 8) {
        return { index: i, drawing: d, handle: 'body' };
      }
    } else if (d.type === 'text') {
      if (Math.hypot(x - pt1.x, y - pt1.y) <= 9) return { index: i, drawing: d, handle: 'p1' };
      const tw = (d.text ? d.text.length * 8 : 40) + 16;
      if (x >= pt1.x - 8 && x <= pt1.x + tw && y >= pt1.y - 22 && y <= pt1.y + 6) return { index: i, drawing: d, handle: 'body' };
    }
  }
  return null;
}

function initChartDrawingCanvas() {
  const canvas = document.getElementById('max-chart-draw-canvas');
  if (!canvas || canvas._wired) return;
  canvas._wired = true;
  canvas.style.display = 'block';
  syncCanvasSize();

  const getEventCoords = e => {
    syncCanvasSize();
    const rect = canvas.getBoundingClientRect();
    const clientX = e.clientX != null ? e.clientX : (e.touches && e.touches[0] ? e.touches[0].clientX : (window._lastTouchX || 0));
    const clientY = e.clientY != null ? e.clientY : (e.touches && e.touches[0] ? e.touches[0].clientY : (window._lastTouchY || 0));
    const x = Math.max(0, Math.min(rect.width, clientX - rect.left));
    const y = Math.max(0, Math.min(rect.height, clientY - rect.top));

    const { chart, series, timeScale } = getDrawingContext();

    let logical = null;
    let price = null;
    if (chart && timeScale && typeof timeScale.coordinateToLogical === 'function') {
      try { logical = timeScale.coordinateToLogical(x); } catch (err) { }
    }
    if (series && typeof series.coordinateToPrice === 'function') {
      try { price = series.coordinateToPrice(y); } catch (err) { }
    }
    let finalX = x, finalY = y;
    if (_drawMagnetMode && logical != null && price != null) {
      const candlesArr = (window.CHART_DRAW_HOST && typeof window.CHART_DRAW_HOST.getCandles === 'function')
        ? window.CHART_DRAW_HOST.getCandles()
        : ((_activeLayoutTile > 1 && _subLwCandles[_activeLayoutTile]) ? _subLwCandles[_activeLayoutTile] : (window._maxCleanCandles || _maxCandles));
      const barIdx = Math.round(logical);
      if (candlesArr && barIdx >= 0 && barIdx < candlesArr.length) {
        const bar = candlesArr[barIdx];
        if (bar && bar.open != null && bar.high != null && bar.low != null && bar.close != null) {
          const ohlc = [bar.open, bar.high, bar.low, bar.close];
          let closestP = ohlc[0];
          let minDiff = Math.abs(price - ohlc[0]);
          for (let k = 1; k < ohlc.length; k++) {
            const diff = Math.abs(price - ohlc[k]);
            if (diff < minDiff) { minDiff = diff; closestP = ohlc[k]; }
          }
          price = closestP;
          logical = barIdx;
          if (timeScale && typeof timeScale.logicalToCoordinate === 'function') {
            const sx = timeScale.logicalToCoordinate(barIdx);
            if (sx != null && isFinite(sx)) finalX = sx;
          }
          if (series && typeof series.priceToCoordinate === 'function') {
            const sy = series.priceToCoordinate(closestP);
            if (sy != null && isFinite(sy)) finalY = sy;
          }
        }
      }
    }
    return { x: finalX, y: finalY, logical, price };
  };

  const commitNewDrawing = (drawing) => {
    const sym = getActiveDrawingSymbol();
    if (!sym) return;
    pushDrawHistory(sym);
    if (!_chartDrawings[sym]) _chartDrawings[sym] = [];
    _chartDrawings[sym].push(drawing);
    saveChartDrawings();
    _activeDrawing = null;
    _drawStep = 0;
    _drawStart = null;
    _isDrawMouseDown = false;
    _selectedDrawingIndex = _chartDrawings[sym].length - 1;
    setDrawingTool('select');
    updateFloatingToolbar();
    redrawChartDrawings();
  };

  // Stage Mousemove: Dynamically grant pointer-events when hovering existing drawings in select mode
  const stage = document.getElementById('max-chart-stage') || canvas.parentElement;
  if (stage && !stage._dragScaleWired) {
    stage._dragScaleWired = true;
    stage.addEventListener('wheel', () => {
      requestAnimationFrame(redrawChartDrawings);
    }, { passive: true });

    let isPriceScaleDragging = false;
    stage.addEventListener('mousedown', e => {
      const rect = stage.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const chartPlotW = rect.width - 65;
      if (x >= chartPlotW || e.shiftKey || e.button === 0) {
        isPriceScaleDragging = true;
      }
    });
    window.addEventListener('mousemove', () => {
      if (isPriceScaleDragging) {
        requestAnimationFrame(redrawChartDrawings);
      }
    });
    window.addEventListener('mouseup', () => {
      if (isPriceScaleDragging) {
        isPriceScaleDragging = false;
        requestAnimationFrame(redrawChartDrawings);
      }
    });
  }

  if (stage && !stage._hoverWired) {
    stage._hoverWired = true;
    stage.addEventListener('mousemove', e => {
      if (_currentDrawTool !== 'select' || _dragMode) return;
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const hit = hitTestChartDrawings(x, y);
      if (hit) {
        canvas.style.pointerEvents = 'all';
        canvas.style.zIndex = '25'; // Elevated above legend when hovering
        if (hit.handle === 'body') canvas.style.cursor = 'move';
        else if (hit.handle === 'nw' || hit.handle === 'se') canvas.style.cursor = 'nwse-resize';
        else if (hit.handle === 'ne' || hit.handle === 'sw') canvas.style.cursor = 'nesw-resize';
        else if (hit.handle === 'p2' && hit.drawing.type === 'pricenote') canvas.style.cursor = 'move';
        else canvas.style.cursor = 'pointer';
      } else {
        if (_selectedDrawingIndex != null) {
          canvas.style.pointerEvents = 'all';
          canvas.style.cursor = 'default';
          canvas.style.zIndex = '12';
        } else {
          canvas.style.pointerEvents = 'none';
          canvas.style.cursor = 'default';
          canvas.style.zIndex = '12';
        }
      }
    });
  }

  // Touch Support for mobile / tablet / stylus
  const handleTouch = (e, syntheticType) => {
    if (!e.touches || !e.touches.length) {
      if (syntheticType === 'mouseup' && _isDrawMouseDown) {
        const mouseEvt = new MouseEvent('mouseup', {
          clientX: window._lastTouchX || 0,
          clientY: window._lastTouchY || 0,
          bubbles: true
        });
        window.dispatchEvent(mouseEvt);
      }
      return;
    }
    const touch = e.touches[0];
    window._lastTouchX = touch.clientX;
    window._lastTouchY = touch.clientY;
    const mouseEvt = new MouseEvent(syntheticType, {
      clientX: touch.clientX,
      clientY: touch.clientY,
      bubbles: true,
      cancelable: true
    });
    if (syntheticType === 'mousedown') canvas.dispatchEvent(mouseEvt);
    else window.dispatchEvent(mouseEvt);
    if (_currentDrawTool !== 'select' || _dragMode) {
      if (e.cancelable) e.preventDefault();
    }
  };

  canvas.addEventListener('touchstart', e => handleTouch(e, 'mousedown'), { passive: false });
  canvas.addEventListener('touchmove', e => handleTouch(e, 'mousemove'), { passive: false });
  canvas.addEventListener('touchend', e => handleTouch(e, 'mouseup'), { passive: false });

  // MOUSE DOWN on canvas
  canvas.addEventListener('mousedown', e => {
    if (e.button != null && e.button !== 0) return;
    const coords = getEventCoords(e);
    const sym = getActiveDrawingSymbol();
    if (!sym) return;

    // ── SELECT / EDIT MODE ──
    if (_currentDrawTool === 'select') {
      const hit = hitTestChartDrawings(coords.x, coords.y);
      if (hit) {
        e.preventDefault();
        e.stopPropagation();
        _selectedDrawingIndex = hit.index;
        const d = hit.drawing;
        _dragStartDrawing = JSON.parse(JSON.stringify(d));
        _dragOrigin = { x: coords.x, y: coords.y, logical: coords.logical, price: coords.price };

        if (hit.handle === 'body') {
          _dragMode = 'move';
        } else {
          _dragMode = 'handle';
          _dragHandle = hit.handle;
        }
        updateFloatingToolbar();
        redrawChartDrawings();
      } else {
        // Clicked in empty chart space -> deselect
        if (_selectedDrawingIndex != null) {
          _selectedDrawingIndex = null;
          hideFloatingToolbar();
          canvas.style.pointerEvents = 'none';
          redrawChartDrawings();
        }
      }
      return;
    }

    // ── DRAWING CREATION MODE ──
    e.preventDefault();
    e.stopPropagation();

    // 1. Single-click tool: Horizontal Ray
    if (_currentDrawTool === 'ray_h') {
      commitNewDrawing({
        type: 'ray_h',
        p1: { x: coords.x, y: coords.y, logical: coords.logical, price: coords.price },
        color: '#38bdf8',
        width: 1.5,
        style: 'dashed'
      });
      showChartToast('✔ Placed Horizontal Ray at ₹ ' + (coords.price != null ? coords.price.toFixed(1) : ''), '#38bdf8');
      return;
    }

    // 2. Single-click tool: Price Note Callout
    if (_currentDrawTool === 'pricenote') {
      const pVal = coords.price != null ? coords.price.toFixed(2) : '0.00';
      const offsetLogical = coords.logical != null ? coords.logical + 4 : null;
      const offsetPrice = coords.price != null ? coords.price * 1.025 : null;
      commitNewDrawing({
        type: 'pricenote',
        p1: { x: coords.x, y: coords.y, logical: coords.logical, price: coords.price },
        p2: { x: coords.x + 40, y: coords.y - 45, logical: offsetLogical, price: offsetPrice },
        text: '₹ ' + pVal,
        color: '#2962ff',
        width: 1.5,
        style: 'solid'
      });
      showChartToast('✔ Placed Price Note at ₹ ' + pVal, '#2962ff');
      return;
    }

    // 3. Single-click tool: Comment Tool
    if (_currentDrawTool === 'comment') {
      const text = prompt('Enter comment:', 'Note');
      if (text && text.trim()) {
        const offsetLogical = coords.logical != null ? coords.logical + 4 : null;
        const offsetPrice = coords.price != null ? coords.price * 1.025 : null;
        commitNewDrawing({
          type: 'comment',
          p1: { x: coords.x, y: coords.y, logical: coords.logical, price: coords.price },
          p2: { x: coords.x + 45, y: coords.y - 40, logical: offsetLogical, price: offsetPrice },
          text: text.trim(),
          color: '#38bdf8',
          width: 1,
          style: 'solid'
        });
        showChartToast('✔ Placed Comment', '#38bdf8');
      } else {
        setDrawingTool('select');
      }
      return;
    }

    // 4. Single-click tool: Text Annotation
    if (_currentDrawTool === 'text') {
      const text = prompt('Enter annotation text:', 'Key Level / Breakout');
      if (text && text.trim()) {
        commitNewDrawing({
          type: 'text',
          p1: { x: coords.x, y: coords.y, logical: coords.logical, price: coords.price },
          text: text.trim(),
          color: '#f0f3fa',
          width: 1,
          style: 'solid'
        });
      } else {
        setDrawingTool('select');
      }
      return;
    }

    // 5. Multi-point tool: Path Tool
    if (_currentDrawTool === 'path') {
      if (_drawStep === 0) {
        _drawStep = 1;
        _activeDrawing = {
          type: 'path',
          points: [
            { x: coords.x, y: coords.y, logical: coords.logical, price: coords.price },
            { x: coords.x, y: coords.y, logical: coords.logical, price: coords.price }
          ],
          color: '#38bdf8',
          width: 1,
          style: 'solid'
        };
        redrawChartDrawings();
        showChartToast('Path: Click to add vertices, double-click or Enter to finish', '#38bdf8');
      } else if (_activeDrawing && _activeDrawing.points && _activeDrawing.points.length >= 2) {
        const lastPt = _activeDrawing.points[_activeDrawing.points.length - 2];
        const dist = lastPt ? Math.hypot(coords.x - lastPt.x, coords.y - lastPt.y) : 99;
        if (dist >= 5) {
          _activeDrawing.points[_activeDrawing.points.length - 1] = {
            x: coords.x, y: coords.y, logical: coords.logical, price: coords.price
          };
          _activeDrawing.points.push({
            x: coords.x, y: coords.y, logical: coords.logical, price: coords.price
          });
          redrawChartDrawings();
        } else if (_activeDrawing.points.length >= 3) {
          _activeDrawing.points.pop();
          commitNewDrawing(_activeDrawing);
          showChartToast('✔ Placed Path', '#38bdf8');
        }
      }
      return;
    }

    // 6. 3-point tools: Curve and Fibonacci Extension
    if (_currentDrawTool === 'curve' || _currentDrawTool === 'fib_ext') {
      if (_drawStep === 0) {
        _drawStep = 1;
        _drawStart = { x: coords.x, y: coords.y, logical: coords.logical, price: coords.price };
        _activeDrawing = {
          type: _currentDrawTool,
          p1: _drawStart,
          p2: _drawStart,
          p3: _drawStart,
          color: '#38bdf8',
          width: 1,
          style: 'solid',
          levels: _currentDrawTool === 'fib_ext' ? getDefaultFibExtLevels() : undefined,
          showTrendline: true,
          showBackground: true,
          fillOpacity: 0.08,
          extend: 'right',
          showLabels: true,
          labelPos: 'left',
          levelsFormat: 'values'
        };
        redrawChartDrawings();
        const nextPrompt = _currentDrawTool === 'curve' ? '〰 Click 2nd endpoint' : '🔢 Click 2nd point (Peak)';
        showChartToast(nextPrompt, '#38bdf8');
      } else if (_drawStep === 1) {
        _drawStep = 2;
        _activeDrawing.p2 = { x: coords.x, y: coords.y, logical: coords.logical, price: coords.price != null ? coords.price : _drawStart.price };
        _activeDrawing.p3 = { x: coords.x, y: coords.y, logical: coords.logical, price: coords.price != null ? coords.price : _drawStart.price };
        redrawChartDrawings();
        const nextPrompt = _currentDrawTool === 'curve' ? '〰 Move and click to set curve bend' : '🔢 Click 3rd point (Pullback)';
        showChartToast(nextPrompt, '#38bdf8');
      } else if (_drawStep === 2) {
        _activeDrawing.p3 = { x: coords.x, y: coords.y, logical: coords.logical, price: coords.price };
        commitNewDrawing({ ..._activeDrawing });
        showChartToast('✔ Placed ' + (_activeDrawing.type === 'curve' ? 'Curve' : 'Fib Extension'), '#38bdf8');
      }
      return;
    }

    // 7. Two-point tools: trendline, ray, rect, scale, fib
    if (_drawStep === 0) {
      _drawStep = 1;
      _isDrawMouseDown = true;
      _drawStart = {
        x: coords.x,
        y: coords.y,
        logical: coords.logical,
        price: coords.price,
        time: Date.now()
      };
      _activeDrawing = {
        type: _currentDrawTool,
        p1: _drawStart,
        p2: _drawStart,
        color: _currentDrawTool === 'scale' ? '#089981' : _currentDrawTool === 'ray' ? '#eab308' : '#38bdf8',
        width: 1,
        style: 'solid',
        fillOpacity: _currentDrawTool === 'scale' ? 0.05 : (_currentDrawTool === 'fib' ? 0.08 : 0),
        showBackground: true,
        extend: _currentDrawTool === 'fib' ? 'right' : 'none',
        levels: _currentDrawTool === 'fib' ? getDefaultFibLevels() : undefined,
        showTrendline: true,
        showLabels: true,
        labelPos: 'left',
        levelsFormat: 'values',
        statsType: 'percent',
        fontSize: 11,
        labelColor: '#868993',
        showLabelBg: false,
        showPrice: false,
        showPercent: true,
        showBars: false,
        showDate: false,
        showBorders: true,
        badgePos: 'auto'
      };
      redrawChartDrawings();
    } else if (_drawStep === 1) {
      // Second click in Click-Move-Click mode!
      const p2 = {
        x: coords.x,
        y: coords.y,
        logical: coords.logical,
        price: coords.price != null ? coords.price : _drawStart.price
      };
      const dist = Math.hypot(p2.x - _drawStart.x, p2.y - _drawStart.y);
      if (dist >= 4) {
        const isScale = (_activeDrawing.type === 'scale' || _activeDrawing.type === 'measure');
        commitNewDrawing({
          type: _activeDrawing.type,
          p1: _activeDrawing.p1,
          p2: p2,
          color: _activeDrawing.color,
          width: isScale ? 1 : (_activeDrawing.width || 1),
          style: _activeDrawing.style || 'solid',
          fillOpacity: isScale ? 0.05 : (_activeDrawing.fillOpacity != null ? _activeDrawing.fillOpacity : 0),
          showBackground: isScale ? true : false,
          extend: _activeDrawing.extend || 'none',
          statsType: _activeDrawing.statsType || 'percent',
          fontSize: _activeDrawing.fontSize || 11,
          labelColor: _activeDrawing.labelColor || '#868993',
          showLabelBg: Boolean(_activeDrawing.showLabelBg),
          showPrice: _activeDrawing.showPrice !== false,
          showPercent: _activeDrawing.showPercent !== false,
          showBars: _activeDrawing.showBars !== false,
          showDate: _activeDrawing.showDate !== false,
          showBorders: _activeDrawing.showBorders !== false,
          badgePos: _activeDrawing.badgePos || 'auto'
        });
        showChartToast('✔ Placed ' + _activeDrawing.type, _activeDrawing.color);
      } else {
        _activeDrawing = null;
        _drawStep = 0;
        _drawStart = null;
        _isDrawMouseDown = false;
        setDrawingTool('select');
        redrawChartDrawings();
      }
    }
  });

  // MOUSE MOVE on window (for smooth preview and modifying drag)
  window.addEventListener('mousemove', e => {
    // A. Preview while drawing
    if (_drawStep === 1 && _activeDrawing && _activeDrawing.type === 'path' && _activeDrawing.points && _activeDrawing.points.length >= 2) {
      const coords = getEventCoords(e);
      _activeDrawing.points[_activeDrawing.points.length - 1] = {
        x: coords.x,
        y: coords.y,
        logical: coords.logical,
        price: coords.price
      };
      redrawChartDrawings();
      return;
    }
    if (_drawStep === 1 && _activeDrawing && _drawStart) {
      const coords = getEventCoords(e);
      _activeDrawing.p2 = {
        x: coords.x,
        y: coords.y,
        logical: coords.logical,
        price: coords.price != null ? coords.price : _drawStart.price
      };
      if (_activeDrawing.type === 'curve' || _activeDrawing.type === 'fib_ext') {
        _activeDrawing.p3 = { ..._activeDrawing.p2 };
      }
      redrawChartDrawings();
      return;
    }
    if (_drawStep === 2 && _activeDrawing && (_activeDrawing.type === 'curve' || _activeDrawing.type === 'fib_ext')) {
      const coords = getEventCoords(e);
      _activeDrawing.p3 = {
        x: coords.x,
        y: coords.y,
        logical: coords.logical,
        price: coords.price
      };
      redrawChartDrawings();
      return;
    }

    // B. Live drag modifying existing selected drawing
    if (_dragMode && _selectedDrawingIndex != null) {
      const coords = getEventCoords(e);
      const sym = getActiveDrawingSymbol();
      const drawings = _chartDrawings[sym] || [];
      const d = drawings[_selectedDrawingIndex];
      if (!d) return;

      if (_dragMode === 'handle') {
        const h = _dragHandle;
        if (h === 'p1') {
          d.p1 = { x: coords.x, y: coords.y, logical: coords.logical, price: coords.price };
        } else if (h === 'p2') {
          d.p2 = { x: coords.x, y: coords.y, logical: coords.logical, price: coords.price };
        } else if (h === 'p3') {
          d.p3 = { x: coords.x, y: coords.y, logical: coords.logical, price: coords.price };
        } else if (h.startsWith('pt_')) {
          const pIdx = parseInt(h.split('_')[1], 10);
          if (d.points && d.points[pIdx]) {
            d.points[pIdx] = { x: coords.x, y: coords.y, logical: coords.logical, price: coords.price };
          }
        } else if (h === 'nw') {
          d.p1 = { x: coords.x, y: coords.y, logical: coords.logical, price: coords.price };
        } else if (h === 'se') {
          d.p2 = { x: coords.x, y: coords.y, logical: coords.logical, price: coords.price };
        } else if (h === 'ne') {
          if (!d.p2) d.p2 = { ...d.p1 };
          d.p2.x = coords.x; d.p2.logical = coords.logical;
          d.p1.y = coords.y; d.p1.price = coords.price;
        } else if (h === 'sw') {
          if (!d.p2) d.p2 = { ...d.p1 };
          d.p1.x = coords.x; d.p1.logical = coords.logical;
          d.p2.y = coords.y; d.p2.price = coords.price;
        }
      } else if (_dragMode === 'move' && _dragStartDrawing && _dragOrigin) {
        const dx = coords.x - _dragOrigin.x;
        const dy = coords.y - _dragOrigin.y;
        const dLogical = (coords.logical != null && _dragOrigin.logical != null) ? (coords.logical - _dragOrigin.logical) : 0;
        const dPrice = (coords.price != null && _dragOrigin.price != null) ? (coords.price - _dragOrigin.price) : 0;

        if (d.p1 && _dragStartDrawing.p1) {
          d.p1.x = _dragStartDrawing.p1.x + dx;
          d.p1.y = _dragStartDrawing.p1.y + dy;
          if (_dragStartDrawing.p1.logical != null) d.p1.logical = _dragStartDrawing.p1.logical + dLogical;
          if (_dragStartDrawing.p1.price != null) d.p1.price = _dragStartDrawing.p1.price + dPrice;
        }

        if (d.p2 && _dragStartDrawing.p2) {
          d.p2.x = _dragStartDrawing.p2.x + dx;
          d.p2.y = _dragStartDrawing.p2.y + dy;
          if (_dragStartDrawing.p2.logical != null) d.p2.logical = _dragStartDrawing.p2.logical + dLogical;
          if (_dragStartDrawing.p2.price != null) d.p2.price = _dragStartDrawing.p2.price + dPrice;
        }

        if (d.p3 && _dragStartDrawing.p3) {
          d.p3.x = _dragStartDrawing.p3.x + dx;
          d.p3.y = _dragStartDrawing.p3.y + dy;
          if (_dragStartDrawing.p3.logical != null) d.p3.logical = _dragStartDrawing.p3.logical + dLogical;
          if (_dragStartDrawing.p3.price != null) d.p3.price = _dragStartDrawing.p3.price + dPrice;
        }

        if (d.points && _dragStartDrawing.points) {
          for (let k = 0; k < d.points.length; k++) {
            const origPt = _dragStartDrawing.points[k];
            if (origPt) {
              d.points[k].x = origPt.x + dx;
              d.points[k].y = origPt.y + dy;
              if (origPt.logical != null) d.points[k].logical = origPt.logical + dLogical;
              if (origPt.price != null) d.points[k].price = origPt.price + dPrice;
            }
          }
        }
      }

      redrawChartDrawings();
      updateFloatingToolbar();
    }
  });

  // MOUSE UP on window (commit drag or finish drag-to-draw gesture)
  window.addEventListener('mouseup', e => {
    // 1. Commit drag modification of existing drawing
    if (_dragMode) {
      _dragMode = null;
      _dragHandle = null;
      _dragStartDrawing = null;
      _dragOrigin = null;
      saveChartDrawings();
      redrawChartDrawings();
      updateFloatingToolbar();
      return;
    }

    // 2. Drag-to-draw gesture for new drawing (Press-Drag-Release)
    if (_activeDrawing && (_activeDrawing.type === 'curve' || _activeDrawing.type === 'fib_ext' || _activeDrawing.type === 'path')) {
      return; // multi-step tools use click-based steps
    }

    if (_drawStep === 1 && _isDrawMouseDown && _drawStart && _activeDrawing) {
      _isDrawMouseDown = false;
      const coords = getEventCoords(e);
      const dist = Math.hypot(coords.x - _drawStart.x, coords.y - _drawStart.y);
      if (dist >= 6) {
        const p2 = {
          x: coords.x,
          y: coords.y,
          logical: coords.logical,
          price: coords.price != null ? coords.price : _drawStart.price
        };
        commitNewDrawing({
          ..._activeDrawing,
          p1: _activeDrawing.p1,
          p2: p2,
          color: _activeDrawing.color,
          width: _activeDrawing.width || 1,
          style: _activeDrawing.style || 'solid',
          fillOpacity: _activeDrawing.fillOpacity != null ? _activeDrawing.fillOpacity : (_activeDrawing.type === 'scale' ? 0.15 : 0),
          showPrice: _activeDrawing.showPrice !== false,
          showPercent: _activeDrawing.showPercent !== false,
          showBars: _activeDrawing.showBars !== false,
          showDate: _activeDrawing.showDate !== false,
          showBorders: _activeDrawing.showBorders !== false,
          badgePos: _activeDrawing.badgePos || 'auto'
        });
        showChartToast('✔ Placed ' + _activeDrawing.type, _activeDrawing.color);
      }
      // If dist < 6, leave _drawStep = 1 waiting for 2nd click
    }
  });

  // KEYBOARD: ESC deselects, Delete/Backspace removes selected drawing, Enter finishes Path
  window.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      if (_currentDrawTool === 'path' && _activeDrawing && _activeDrawing.points && _activeDrawing.points.length >= 2) {
        e.preventDefault();
        _activeDrawing.points.pop();
        if (_activeDrawing.points.length >= 2) {
          commitNewDrawing(_activeDrawing);
          showChartToast('✔ Placed Path', '#38bdf8');
        } else {
          _activeDrawing = null;
          _drawStep = 0;
          setDrawingTool('select');
          redrawChartDrawings();
        }
        return;
      }
    }
    if (e.key === 'Escape') {
      if (_drawStep >= 1 || _currentDrawTool !== 'select') {
        _activeDrawing = null;
        _drawStep = 0;
        _drawStart = null;
        _isDrawMouseDown = false;
        setDrawingTool('select');
        redrawChartDrawings();
      } else if (_selectedDrawingIndex != null) {
        _selectedDrawingIndex = null;
        hideFloatingToolbar();
        redrawChartDrawings();
      }
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      const tag = (e.target && e.target.tagName) || '';
      if (tag === 'INPUT' || tag === 'TEXTAREA' || e.target?.isContentEditable) return;
      if (_selectedDrawingIndex != null) {
        e.preventDefault();
        deleteSelectedDrawing();
      }
    } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
      const tag = (e.target && e.target.tagName) || '';
      if (tag === 'INPUT' || tag === 'TEXTAREA' || e.target?.isContentEditable) return;
      const overlay = document.getElementById('chart-max-overlay');
      if (overlay && overlay.style.display !== 'none') {
        e.preventDefault();
        undoChartDrawing();
      }
    } else if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))) {
      const tag = (e.target && e.target.tagName) || '';
      if (tag === 'INPUT' || tag === 'TEXTAREA' || e.target?.isContentEditable) return;
      const overlay = document.getElementById('chart-max-overlay');
      if (overlay && overlay.style.display !== 'none') {
        e.preventDefault();
        redoChartDrawing();
      }
    }
  });

  // Double-click to edit text, price notes, comment, finish path, or open coordinates/properties
  canvas.addEventListener('dblclick', e => {
    if (_currentDrawTool === 'path' && _activeDrawing && _activeDrawing.points && _activeDrawing.points.length >= 2) {
      e.preventDefault();
      e.stopPropagation();
      _activeDrawing.points.pop();
      if (_activeDrawing.points.length >= 2) {
        commitNewDrawing(_activeDrawing);
        showChartToast('✔ Placed Path', '#38bdf8');
      } else {
        _activeDrawing = null;
        _drawStep = 0;
        setDrawingTool('select');
        redrawChartDrawings();
      }
      return;
    }

    const coords = getEventCoords(e);
    const hit = hitTestChartDrawings(coords.x, coords.y);
    if (hit) {
      _selectedDrawingIndex = hit.index;
      updateFloatingToolbar();
      if (hit.drawing.type === 'text' || hit.drawing.type === 'pricenote' || hit.drawing.type === 'comment') {
        editDrawingText(e);
      } else {
        openCoordsDialog(hit.drawing);
      }
    }
  });
}
window.initChartDrawingCanvas = initChartDrawingCanvas;

// ── DRAWING ANCHOR CIRCLE RENDERING ──
function drawAnchorHandle(ctx, x, y, isHovered = false) {
  ctx.save();
  ctx.setLineDash([]);
  ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
  ctx.shadowBlur = 4;
  // White outer ring
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(x, y, isHovered ? 6 : 5, 0, Math.PI * 2);
  ctx.fill();
  // Inner blue core (TV style)
  ctx.fillStyle = '#2962ff';
  ctx.beginPath();
  ctx.arc(x, y, isHovered ? 3.5 : 2.8, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// TradingView Price Range Anchor Handle: Blue circular ring with dark/transparent center
function drawTvAnchor(ctx, x, y) {
  ctx.save();
  ctx.setLineDash([]);
  ctx.fillStyle = '#1e222d';
  ctx.strokeStyle = '#2962ff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, y, 4.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}
window.drawTvAnchor = drawTvAnchor;

function redrawChartDrawings() {
  const canvas = document.getElementById('max-chart-draw-canvas');
  if (!canvas) return;
  syncCanvasSize();

  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  const W = rect.width || canvas.clientWidth || 800;
  const H = rect.height || canvas.clientHeight || 500;

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, W, H);

  const { timeScale, series } = getDrawingContext();
  const sym = getActiveDrawingSymbol();
  const saved = _chartDrawings[sym] || [];
  const drawings = saved.concat(_activeDrawing ? [_activeDrawing] : []);
  if (!drawings.length) return;

  // Calculate actual plot area width excluding right price scale column
  let chartPlotW = W - 65;
  if (timeScale && typeof timeScale.width === 'function') {
    const tsw = timeScale.width();
    if (tsw > 50 && tsw < W) chartPlotW = tsw;
  }

  // Clip all drawings strictly to the plot area so lines and labels never overlap the price scale!
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, chartPlotW, H);
  ctx.clip();

  const toPx = p => pointToPixels(p, timeScale, series);

  for (let idx = 0; idx < drawings.length; idx++) {
    const d = drawings[idx];
    if (!d || (!d.p1 && (!d.points || !d.points.length))) continue;

    const isSelected = (idx === _selectedDrawingIndex);
    const color = d.color || '#38bdf8';
    const width = d.width || 1;
    const style = d.style || 'solid';

    ctx.save();

    // Path (Multi-point polyline with directional TV arrowhead)
    if (d.type === 'path' && d.points && d.points.length >= 2) {
      const pts = d.points.map(toPx).filter(p => p.x != null && p.y != null);
      if (pts.length >= 2) {
        ctx.strokeStyle = color;
        ctx.lineWidth = width || 2;
        if (style === 'dashed') ctx.setLineDash([6, 4]);
        else if (style === 'dotted') ctx.setLineDash([2, 3]);
        else ctx.setLineDash([]);

        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let k = 1; k < pts.length; k++) {
          ctx.lineTo(pts[k].x, pts[k].y);
        }
        ctx.stroke();
        ctx.setLineDash([]);

        // Directional arrowhead on final segment
        const last = pts[pts.length - 1];
        const prev = pts[pts.length - 2];
        const angle = Math.atan2(last.y - prev.y, last.x - prev.x);
        const arrowLen = 12;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(last.x, last.y);
        ctx.lineTo(last.x - arrowLen * Math.cos(angle - Math.PI / 6), last.y - arrowLen * Math.sin(angle - Math.PI / 6));
        ctx.lineTo(last.x - arrowLen * Math.cos(angle + Math.PI / 6), last.y - arrowLen * Math.sin(angle + Math.PI / 6));
        ctx.closePath();
        ctx.fill();

        if (isSelected) {
          for (let k = 0; k < pts.length; k++) {
            drawAnchorHandle(ctx, pts[k].x, pts[k].y);
          }
        }
      }
      ctx.restore();
      continue;
    }

    // Comment Callout Speech Bubble
    if (d.type === 'comment') {
      const pt1 = toPx(d.p1);
      const pt2 = d.p2 ? toPx(d.p2) : { x: pt1.x + 45, y: pt1.y - 40 };
      if (pt1.x != null && pt1.y != null && pt2.x != null && pt2.y != null) {
        const txt = d.text || 'Comment';
        ctx.font = 'bold 11px -apple-system,BlinkMacSystemFont,sans-serif';
        const tw = ctx.measureText(txt).width;
        const bw = Math.max(65, tw + 20);
        const bh = 26;
        const bx = pt2.x - bw / 2;
        const by = pt2.y - bh / 2;

        // Pointer line connecting pin to bubble
        ctx.strokeStyle = color;
        ctx.lineWidth = width;
        ctx.beginPath();
        ctx.moveTo(pt1.x, pt1.y);
        ctx.lineTo(pt2.x, pt2.y);
        ctx.stroke();

        // Pin dot on candle
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(pt1.x, pt1.y, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Speech bubble box
        ctx.fillStyle = '#1e222d';
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(bx, by, bw, bh, 5);
        else ctx.rect(bx, by, bw, bh);
        ctx.fill();

        ctx.strokeStyle = isSelected ? '#ffffff' : color;
        ctx.lineWidth = isSelected ? 1.8 : 1.2;
        ctx.stroke();

        ctx.fillStyle = '#f0f3fa';
        ctx.textAlign = 'center';
        ctx.fillText(txt, bx + bw / 2, by + 17);
        ctx.textAlign = 'left';

        if (isSelected) {
          drawAnchorHandle(ctx, pt1.x, pt1.y);
          drawAnchorHandle(ctx, pt2.x, pt2.y);
        }
      }
      ctx.restore();
      continue;
    }

    // 1. Horizontal Ray (ray_h)
    if (d.type === 'ray_h') {
      const pt = toPx(d.p1);
      const x = pt.x;
      const y = pt.y;
      if (y >= 0 && y <= H) {
        ctx.strokeStyle = color;
        ctx.lineWidth = width;
        if (style === 'dashed') ctx.setLineDash([6, 4]);
        else if (style === 'dotted') ctx.setLineDash([2, 3]);
        else ctx.setLineDash([]);

        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(chartPlotW, y);
        ctx.stroke();
        ctx.setLineDash([]);

        // Origin anchor dot
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fill();

        // Right edge price tag (clamped inside chart plot area)
        const pTxt = d.p1.price != null ? ('₹ ' + d.p1.price.toFixed(1)) : '';
        if (pTxt) {
          ctx.font = 'bold 10px -apple-system,BlinkMacSystemFont,sans-serif';
          const tw = ctx.measureText(pTxt).width;
          ctx.fillStyle = '#1e222d';
          ctx.fillRect(chartPlotW - tw - 16, y - 10, tw + 14, 20);
          ctx.strokeStyle = color;
          ctx.lineWidth = 1;
          ctx.strokeRect(chartPlotW - tw - 16, y - 10, tw + 14, 20);
          ctx.fillStyle = color;
          ctx.fillText(pTxt, chartPlotW - tw - 9, y + 3.5);
        }

        if (isSelected) {
          drawAnchorHandle(ctx, x, y);
        }
      }
      ctx.restore();
      continue;
    }

    // 2. Price Note (pricenote)
    if (d.type === 'pricenote') {
      const pt1 = toPx(d.p1);
      const pt2 = d.p2 ? toPx(d.p2) : { x: pt1.x + 40, y: pt1.y - 45 };
      if (pt1.x != null && pt1.y != null && pt2.x != null && pt2.y != null) {
        // Leader line connecting candle pin to callout badge
        ctx.strokeStyle = color;
        ctx.lineWidth = width;
        if (style === 'dashed') ctx.setLineDash([5, 3]);
        else if (style === 'dotted') ctx.setLineDash([2, 2]);
        else ctx.setLineDash([]);
        ctx.beginPath();
        ctx.moveTo(pt1.x, pt1.y);
        ctx.lineTo(pt2.x, pt2.y);
        ctx.stroke();
        ctx.setLineDash([]);

        // Candle pin anchor dot
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(pt1.x, pt1.y, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Callout Badge Box centered at pt2
        const txt = d.text || ('₹ ' + (d.p1.price != null ? d.p1.price.toFixed(2) : ''));
        ctx.font = 'bold 11px -apple-system,BlinkMacSystemFont,sans-serif';
        const tw = ctx.measureText(txt).width;
        const bw = tw + 18;
        const bh = 24;
        const bx = pt2.x - bw / 2;
        const by = pt2.y - bh / 2;

        ctx.fillStyle = 'rgba(19, 23, 34, 0.95)';
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(bx, by, bw, bh, 4);
        else ctx.rect(bx, by, bw, bh);
        ctx.fill();

        ctx.strokeStyle = isSelected ? '#ffffff' : color;
        ctx.lineWidth = isSelected ? 1.8 : 1;
        ctx.stroke();

        ctx.fillStyle = '#f0f3fa';
        ctx.textAlign = 'center';
        ctx.fillText(txt, bx + bw / 2, by + 16);
        ctx.textAlign = 'left';

        if (isSelected) {
          drawAnchorHandle(ctx, pt1.x, pt1.y);
          drawAnchorHandle(ctx, pt2.x, pt2.y);
        }
      }
      ctx.restore();
      continue;
    }

    // 3. Text annotation
    if (d.type === 'text') {
      const pt = toPx(d.p1);
      const x = pt.x;
      const y = pt.y;
      if (x != null && y != null && d.text) {
        ctx.font = 'bold 11px -apple-system,BlinkMacSystemFont,sans-serif';
        const tw = ctx.measureText(d.text).width;
        ctx.fillStyle = 'rgba(15, 23, 42, 0.90)';
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(x - 4, y - 18, tw + 12, 22, 4);
        else ctx.rect(x - 4, y - 18, tw + 12, 22);
        ctx.fill();
        ctx.strokeStyle = isSelected ? '#ffffff' : color;
        ctx.lineWidth = isSelected ? 2 : 1;
        ctx.stroke();
        ctx.fillStyle = color;
        ctx.fillText(d.text, x + 2, y - 3);

        if (isSelected) {
          drawAnchorHandle(ctx, x, y);
        }
      }
      ctx.restore();
      continue;
    }

    // 4. Two-point drawings: trendline, ray, rect, scale
    const pt1 = toPx(d.p1);
    const pt2 = d.p2 ? toPx(d.p2) : pt1;
    const x1 = pt1.x, y1 = pt1.y, x2 = pt2.x, y2 = pt2.y;
    if (x1 == null || y1 == null || x2 == null || y2 == null) {
      ctx.restore();
      continue;
    }

    if (style === 'dashed') ctx.setLineDash([6, 4]);
    else if (style === 'dotted') ctx.setLineDash([2, 3]);
    else ctx.setLineDash([]);

    if (d.type === 'trendline') {
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();

      ctx.fillStyle = color;
      ctx.beginPath(); ctx.arc(x1, y1, 3.5, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(x2, y2, 3.5, 0, Math.PI * 2); ctx.fill();

      if (isSelected) {
        drawAnchorHandle(ctx, x1, y1);
        drawAnchorHandle(ctx, x2, y2);
      }
    } else if (d.type === 'ray') {
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();

      const angle = Math.atan2(y2 - y1, x2 - x1);
      const headLen = 11;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(x2, y2);
      ctx.lineTo(x2 - headLen * Math.cos(angle - Math.PI / 6), y2 - headLen * Math.sin(angle - Math.PI / 6));
      ctx.lineTo(x2 - headLen * Math.cos(angle + Math.PI / 6), y2 - headLen * Math.sin(angle + Math.PI / 6));
      ctx.closePath();
      ctx.fill();

      ctx.beginPath(); ctx.arc(x1, y1, 3.5, 0, Math.PI * 2); ctx.fill();

      if (isSelected) {
        drawAnchorHandle(ctx, x1, y1);
        drawAnchorHandle(ctx, x2, y2);
      }
    } else if (d.type === 'rect') {
      const rx = Math.min(x1, x2);
      const ry = Math.min(y1, y2);
      const rw = Math.abs(x2 - x1);
      const rh = Math.abs(y2 - y1);
      const fillOp = d.fillOpacity != null ? d.fillOpacity : 0;

      if (fillOp > 0) {
        ctx.fillStyle = typeof hexToRgba === 'function' ? hexToRgba(color, fillOp) : 'rgba(56, 189, 248, 0.12)';
        ctx.fillRect(rx, ry, rw, rh);
      }
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.strokeRect(rx, ry, rw, rh);

      if (isSelected) {
        drawAnchorHandle(ctx, rx, ry);
        drawAnchorHandle(ctx, rx + rw, ry);
        drawAnchorHandle(ctx, rx + rw, ry + rh);
        drawAnchorHandle(ctx, rx, ry + rh);
      }
    } else if (d.type === 'scale' || d.type === 'measure') {
      const p1Price = (d.p1 && d.p1.price != null) ? d.p1.price : 0;
      const p2Price = (d.p2 && d.p2.price != null) ? d.p2.price : 0;
      const diffPrice = p2Price - p1Price;
      const pct = p1Price ? ((diffPrice / p1Price) * 100) : 0;
      const isUp = diffPrice >= 0;

      // Color selection: default TradingView green (#089981) for up, red (#f23645) for down
      const clr = (color && color !== '#22c55e' && color !== '#ef4444' && color !== '#089981' && color !== '#f23645')
        ? color
        : (isUp ? '#089981' : '#f23645');
      const width = d.width || 1; // Default 1px
      const style = d.style || 'solid';
      const fillOp = (d.fillOpacity != null) ? d.fillOpacity : 0.05; // Default 5%
      const showBg = (d.showBackground !== false && fillOp > 0);
      const extend = d.extend || 'none';
      const statsType = d.statsType || (d.showPrice && d.showPercent ? 'both' : (d.showPrice ? 'price' : (d.showPercent !== false ? 'percent' : 'none')));
      const fontSize = d.fontSize || 11;
      const labelColor = d.labelColor || '#868993';
      const showLabelBg = Boolean(d.showLabelBg);

      const yTop = Math.min(y1, y2);
      const yBtm = Math.max(y1, y2);
      const xLeft = Math.min(x1, x2);
      const xRight = Math.max(x1, x2);
      const rw = Math.max(2, xRight - xLeft);
      const rh = Math.max(2, yBtm - yTop);

      let lineLeft = xLeft;
      let lineRight = xRight;
      if (extend === 'left' || extend === 'both') lineLeft = 0;
      if (extend === 'right' || extend === 'both') lineRight = chartPlotW;
      else lineRight = Math.min(xRight, chartPlotW);

      // 1. Shaded Translucent Background Box (Default 5% transparency)
      if (showBg) {
        ctx.fillStyle = typeof hexToRgba === 'function' ? hexToRgba(clr, fillOp) : `rgba(8, 153, 129, ${fillOp})`;
        ctx.fillRect(xLeft, yTop, rw, rh);
      }

      // 2. Top and Bottom Horizontal Lines (TradingView Style)
      ctx.strokeStyle = clr;
      ctx.lineWidth = width;
      if (style === 'dashed') ctx.setLineDash([5, 4]);
      else if (style === 'dotted') ctx.setLineDash([2, 3]);
      else ctx.setLineDash([]);

      // Top Horizontal Line
      ctx.beginPath();
      ctx.moveTo(lineLeft, yTop);
      ctx.lineTo(lineRight, yTop);
      ctx.stroke();

      // Bottom Horizontal Line
      ctx.beginPath();
      ctx.moveTo(lineLeft, yBtm);
      ctx.lineTo(lineRight, yBtm);
      ctx.stroke();

      // NOTE: NO left or right vertical border lines (per TradingView and user requirement)

      // 3. Middle Vertical Line connecting top and bottom
      const midX = (x1 + x2) / 2;
      ctx.beginPath();
      ctx.moveTo(midX, y1);
      ctx.lineTo(midX, y2);
      ctx.stroke();

      // Directional arrowhead at end price level (midX, y2)
      // If y2 > y1 (downward move): points down onto bottom line
      // If y2 < y1 (upward move): points up onto top line
      const arrowLen = 9;
      const arrowW = 4.5;
      const dirY = (y2 >= y1) ? 1 : -1;

      ctx.fillStyle = clr;
      ctx.beginPath();
      ctx.moveTo(midX, y2);
      ctx.lineTo(midX - arrowW, y2 - (dirY * arrowLen));
      ctx.lineTo(midX + arrowW, y2 - (dirY * arrowLen));
      ctx.closePath();
      ctx.fill();

      // 4. Stats Text Label (TradingView Style, placed below bottom or above top line)
      if (statsType !== 'none') {
        const sign = isUp ? '+' : '';
        let statsStr = '';
        if (statsType === 'percent') {
          statsStr = `${pct > 0 ? '+' : ''}${pct.toFixed(2)}%`;
        } else if (statsType === 'price') {
          statsStr = `${sign}${diffPrice.toFixed(2)}`;
        } else if (statsType === 'both') {
          statsStr = `${sign}${diffPrice.toFixed(2)} (${pct > 0 ? '+' : ''}${pct.toFixed(2)}%)`;
        }

        if (statsStr) {
          ctx.font = `600 ${fontSize}px -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';

          // Placement: below bottom line if downward move; above top line if upward move
          const textY = (y2 >= y1) ? (yBtm + 14) : (yTop - 14);

          if (showLabelBg) {
            const tw = ctx.measureText(statsStr).width;
            const th = fontSize + 4;
            ctx.fillStyle = d.labelBgColor || 'rgba(30, 34, 45, 0.9)';
            const bx = midX - tw / 2 - 4;
            const by = textY - th / 2 - 2;
            if (ctx.roundRect) ctx.roundRect(bx, by, tw + 8, th + 4, 3);
            else ctx.rect(bx, by, tw + 8, th + 4);
            ctx.fill();
          }

          ctx.fillStyle = labelColor;
          ctx.fillText(statsStr, midX, textY);
          ctx.textAlign = 'left';
          ctx.textBaseline = 'alphabetic';
        }
      }

      // 5. Two Anchor Handles when selected (TradingView blue circular handles)
      if (isSelected) {
        drawTvAnchor(ctx, x1, y1);
        drawTvAnchor(ctx, x2, y2);
      }
    } else if (d.type === 'fib') {
      const p1Price = (d.p1 && d.p1.price != null) ? d.p1.price : 0;
      const p2Price = (d.p2 && d.p2.price != null) ? d.p2.price : 0;
      const userLevels = (d.levels && d.levels.length) ? d.levels : getDefaultFibLevels();
      const activeLevels = userLevels.filter(l => l.enabled !== false);

      const xLeft = Math.min(x1, x2);
      const xRight = Math.max(x1, x2);
      let lineLeft = xLeft;
      let lineRight = xRight;
      const ext = d.extend || 'right';
      if (ext === 'left' || ext === 'both') lineLeft = 0;
      if (ext === 'right' || ext === 'both') lineRight = chartPlotW;
      else lineRight = Math.min(xRight, chartPlotW);
      lineLeft = Math.max(0, lineLeft);

      // TradingView Retracement Placement:
      // Point 1 is start of swing (Level 1.0), Point 2 is end of swing (Level 0.0)
      // Retracement calculates pullback from Point 2 back toward Point 1
      const isReverse = Boolean(d.reverse);
      const lvlPoints = activeLevels.map(l => {
        const priceLvl = isReverse
          ? (p1Price + l.r * (p2Price - p1Price))
          : (p2Price + l.r * (p1Price - p2Price));
        let yLvl = isReverse
          ? (y1 + l.r * (y2 - y1))
          : (y2 + l.r * (y1 - y2));
        if (series && typeof series.priceToCoordinate === 'function') {
          const cy = series.priceToCoordinate(priceLvl);
          if (cy != null && isFinite(cy)) yLvl = cy;
        }
        return { ...l, price: priceLvl, y: yLvl };
      });

      // Translucent bands between levels
      if (d.showBackground !== false && (d.fillOpacity == null || d.fillOpacity > 0)) {
        const fillOp = d.fillOpacity != null ? d.fillOpacity : 0.08;
        const sortedByY = [...lvlPoints].sort((a, b) => a.y - b.y);
        for (let i = 0; i < sortedByY.length - 1; i++) {
          const topY = sortedByY[i].y;
          const btmY = sortedByY[i + 1].y;
          const bandCol = sortedByY[i + 1].c || color;
          ctx.fillStyle = typeof hexToRgba === 'function' ? hexToRgba(bandCol, fillOp) : `rgba(41, 98, 255, ${fillOp})`;
          ctx.fillRect(lineLeft, topY, lineRight - lineLeft, btmY - topY);
        }
      }

      // Connecting trendline p1 -> p2 (matches TradingView anchor 1 to anchor 2)
      if (d.showTrendline !== false) {
        ctx.strokeStyle = color;
        ctx.lineWidth = width || 1;
        if (style === 'dashed') ctx.setLineDash([4, 4]);
        else if (style === 'dotted') ctx.setLineDash([2, 3]);
        else ctx.setLineDash([]);
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Horizontal lines & labels
      ctx.font = '10px -apple-system,BlinkMacSystemFont,sans-serif';
      lvlPoints.forEach(l => {
        ctx.strokeStyle = l.c;
        ctx.lineWidth = width || 1;
        ctx.beginPath();
        ctx.moveTo(lineLeft, l.y);
        ctx.lineTo(lineRight, l.y);
        ctx.stroke();

        if (d.showLabels !== false) {
          const pTxt = l.price.toFixed(2);
          const showValues = d.showValues !== false;
          const showPercents = Boolean(d.showPercents);
          const showPrices = d.showPrices !== false;

          let parts = [];
          if (showValues && showPercents) {
            parts.push(`${l.r} (${(l.r * 100).toFixed(1)}%)`);
          } else if (showValues) {
            parts.push(`${l.r}`);
          } else if (showPercents) {
            parts.push(`${(l.r * 100).toFixed(1)}%`);
          }

          if (showPrices) {
            parts.push(`(${pTxt})`);
          }

          let lblStr = parts.join(' ');
          if (!lblStr) lblStr = `${l.r}`;

          ctx.fillStyle = l.c;
          const labelPos = d.labelPos || 'left';
          if (labelPos === 'center') {
            ctx.textAlign = 'center';
            ctx.fillText(lblStr, (lineLeft + lineRight) / 2, l.y - 4);
          } else if (labelPos === 'right') {
            ctx.textAlign = 'right';
            ctx.fillText(lblStr, lineRight - 6, l.y - 4);
          } else if (labelPos === 'left_inside') {
            ctx.textAlign = 'left';
            ctx.fillText(lblStr, lineLeft + 6, l.y - 4);
          } else {
            // Default: 'left' (placed on left side OUTSIDE of the drawing)
            if (lineLeft >= 55) {
              ctx.textAlign = 'right';
              ctx.fillText(lblStr, lineLeft - 6, l.y - 4);
            } else {
              ctx.textAlign = 'left';
              ctx.fillText(lblStr, Math.max(4, lineLeft + 6), l.y - 4);
            }
          }
        }
      });
      ctx.textAlign = 'left';

      if (isSelected) {
        drawAnchorHandle(ctx, x1, y1);
        drawAnchorHandle(ctx, x2, y2);
      }
    } else if (d.type === 'fib_ext') {
      const pt3 = d.p3 ? toPx(d.p3) : pt2;
      const x3 = pt3.x, y3 = pt3.y;
      const p1Price = (d.p1 && d.p1.price != null) ? d.p1.price : 0;
      const p2Price = (d.p2 && d.p2.price != null) ? d.p2.price : 0;
      const p3Price = (d.p3 && d.p3.price != null) ? d.p3.price : p2Price;
      const deltaP = p2Price - p1Price;

      const userLevels = (d.levels && d.levels.length) ? d.levels : getDefaultFibExtLevels();
      const activeLevels = userLevels.filter(l => l.enabled !== false);

      let lineLeft = x3;
      let lineRight = x3 + 120;
      const ext = d.extend || 'right';
      if (ext === 'left' || ext === 'both') lineLeft = 0;
      if (ext === 'right' || ext === 'both') lineRight = chartPlotW;
      else lineRight = Math.min(x3 + 120, chartPlotW);
      lineLeft = Math.max(0, lineLeft);

      const lvlPoints = activeLevels.map(l => {
        const priceLvl = p3Price + l.r * deltaP;
        let yLvl = y3;
        if (series && typeof series.priceToCoordinate === 'function') {
          const cy = series.priceToCoordinate(priceLvl);
          if (cy != null && isFinite(cy)) yLvl = cy;
        } else {
          yLvl = y3 - l.r * (y1 - y2);
        }
        return { ...l, price: priceLvl, y: yLvl };
      });

      // Translucent bands
      if (d.showBackground !== false && (d.fillOpacity == null || d.fillOpacity > 0)) {
        const fillOp = d.fillOpacity != null ? d.fillOpacity : 0.08;
        const sortedByY = [...lvlPoints].sort((a, b) => a.y - b.y);
        for (let i = 0; i < sortedByY.length - 1; i++) {
          const topY = sortedByY[i].y;
          const btmY = sortedByY[i + 1].y;
          const bandCol = sortedByY[i + 1].c || color;
          ctx.fillStyle = typeof hexToRgba === 'function' ? hexToRgba(bandCol, fillOp) : `rgba(41, 98, 255, ${fillOp})`;
          ctx.fillRect(lineLeft, topY, lineRight - lineLeft, btmY - topY);
        }
      }

      // Connecting dashed trendlines p1 -> p2 and p2 -> p3
      if (d.showTrendline !== false) {
        ctx.strokeStyle = color;
        ctx.lineWidth = width || 1;
        if (style === 'dashed') ctx.setLineDash([4, 4]);
        else if (style === 'dotted') ctx.setLineDash([2, 3]);
        else ctx.setLineDash([]);
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.lineTo(x3, y3);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Horizontal lines & labels
      ctx.font = '10px -apple-system,BlinkMacSystemFont,sans-serif';
      lvlPoints.forEach(l => {
        ctx.strokeStyle = l.c;
        ctx.lineWidth = width || 1;
        ctx.beginPath();
        ctx.moveTo(lineLeft, l.y);
        ctx.lineTo(lineRight, l.y);
        ctx.stroke();

        if (d.showLabels !== false) {
          const pTxt = l.price.toFixed(2);
          const showValues = d.showValues !== false;
          const showPercents = Boolean(d.showPercents);
          const showPrices = d.showPrices !== false;

          let parts = [];
          if (showValues && showPercents) {
            parts.push(`${l.r} (${(l.r * 100).toFixed(1)}%)`);
          } else if (showValues) {
            parts.push(`${l.r}`);
          } else if (showPercents) {
            parts.push(`${(l.r * 100).toFixed(1)}%`);
          }

          if (showPrices) {
            parts.push(`(${pTxt})`);
          }

          let lblStr = parts.join(' ');
          if (!lblStr) lblStr = `${l.r}`;

          ctx.fillStyle = l.c;
          const labelPos = d.labelPos || 'left';
          if (labelPos === 'center') {
            ctx.textAlign = 'center';
            ctx.fillText(lblStr, (lineLeft + lineRight) / 2, l.y - 4);
          } else if (labelPos === 'right') {
            ctx.textAlign = 'right';
            ctx.fillText(lblStr, lineRight - 6, l.y - 4);
          } else if (labelPos === 'left_inside') {
            ctx.textAlign = 'left';
            ctx.fillText(lblStr, lineLeft + 6, l.y - 4);
          } else {
            // Default: 'left' (placed on left side OUTSIDE of the drawing)
            if (lineLeft >= 55) {
              ctx.textAlign = 'right';
              ctx.fillText(lblStr, lineLeft - 6, l.y - 4);
            } else {
              ctx.textAlign = 'left';
              ctx.fillText(lblStr, Math.max(4, lineLeft + 6), l.y - 4);
            }
          }
        }
      });
      ctx.textAlign = 'left';

      if (isSelected) {
        drawAnchorHandle(ctx, x1, y1);
        drawAnchorHandle(ctx, x2, y2);
        drawAnchorHandle(ctx, x3, y3);
      }
    } else if (d.type === 'curve') {
      const pt3 = d.p3 ? toPx(d.p3) : { x: (x1 + x2) / 2, y: (y1 + y2) / 2 };
      const x3 = pt3.x, y3 = pt3.y;
      const cpX = 2 * x3 - 0.5 * x1 - 0.5 * x2;
      const cpY = 2 * y3 - 0.5 * y1 - 0.5 * y2;

      ctx.strokeStyle = color;
      ctx.lineWidth = width || 1;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.quadraticCurveTo(cpX, cpY, x2, y2);
      ctx.stroke();

      if (isSelected) {
        drawAnchorHandle(ctx, x1, y1);
        drawAnchorHandle(ctx, x2, y2);
        drawAnchorHandle(ctx, x3, y3);
      }
    }
    ctx.restore();
  }
  ctx.restore(); // Restore chartPlotW clipping

  // When Price Range tool is selected, render both end price values directly on the Price Scale
  if (_selectedDrawingIndex != null && drawings[_selectedDrawingIndex]) {
    const selD = drawings[_selectedDrawingIndex];
    if ((selD.type === 'scale' || selD.type === 'measure') && selD.p1 && selD.p2) {
      const pt1 = toPx(selD.p1);
      const pt2 = toPx(selD.p2);
      const p1Val = selD.p1.price;
      const p2Val = selD.p2.price;
      const isUp = (p2Val != null && p1Val != null) ? (p2Val >= p1Val) : true;
      const clr = (selD.color && selD.color !== '#22c55e' && selD.color !== '#ef4444' && selD.color !== '#089981' && selD.color !== '#f23645')
        ? selD.color
        : (isUp ? '#089981' : '#f23645');
      const scaleW = Math.max(50, W - chartPlotW);
      const drawScaleTag = (yCoord, priceVal) => {
        if (yCoord == null || !isFinite(yCoord) || priceVal == null || !isFinite(priceVal)) return;
        if (yCoord < 0 || yCoord > H) return;
        const txt = priceVal.toFixed(2);
        const bh = 18;
        const by = Math.max(0, Math.min(H - bh, yCoord - bh / 2));
        ctx.fillStyle = clr;
        ctx.fillRect(chartPlotW, by, scaleW, bh);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 10px -apple-system,BlinkMacSystemFont,sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(txt, chartPlotW + scaleW / 2, by + bh / 2 + 0.5);
      };
      ctx.save();
      drawScaleTag(pt1.y, p1Val);
      drawScaleTag(pt2.y, p2Val);
      ctx.restore();
    }
  }
}
window.redrawChartDrawings = redrawChartDrawings;

// ── FLOATING CUSTOMIZATION TOOLBAR LOGIC ──
const TV_DRAW_PALETTE = ['#22c55e', '#ef4444', '#38bdf8', '#2962ff', '#eab308', '#f97316', '#a855f7', '#ec4899', '#14b8a6', '#f0f3fa'];

function updateFloatingToolbar() {
  const bar = document.getElementById('tv-drawing-floating-toolbar');
  if (!bar) return;

  const sym = getActiveDrawingSymbol();
  const drawings = _chartDrawings[sym] || [];
  if (_selectedDrawingIndex == null || !drawings[_selectedDrawingIndex]) {
    bar.style.display = 'none';
    return;
  }

  const d = drawings[_selectedDrawingIndex];
  const { timeScale, series } = getDrawingContext();
  let pt1, pt2;
  if (d.type === 'path' && d.points && d.points.length) {
    pt1 = pointToPixels(d.points[0], timeScale, series);
    pt2 = pointToPixels(d.points[d.points.length - 1], timeScale, series);
  } else {
    pt1 = d.p1 ? pointToPixels(d.p1, timeScale, series) : { x: 100, y: 100 };
    pt2 = d.p2 ? pointToPixels(d.p2, timeScale, series) : pt1;
  }

  const midX = (pt1.x + pt2.x) / 2;
  const minY = Math.min(pt1.y, pt2.y);

  const stage = document.getElementById('max-chart-stage');
  const stageW = stage ? stage.clientWidth : 800;
  const stageH = stage ? stage.clientHeight : 500;

  const isScale = (d.type === 'scale' || d.type === 'measure');
  const hasFill = (d.type === 'rect' || isScale);
  const barW = hasFill ? 230 : 200;
  const targetLeft = Math.max(10, Math.min(stageW - barW - 10, midX - barW / 2));
  const targetTop = Math.max(48, Math.min(stageH - 60, minY - 44));

  bar.style.left = targetLeft + 'px';
  bar.style.top = targetTop + 'px';
  bar.style.display = 'flex';

  const clr = d.color || (isScale ? '#22c55e' : '#38bdf8');
  const width = d.width || 1;
  const style = d.style || 'solid';
  const styleIcon = style === 'dotted' ? '···' : style === 'dashed' ? '- -' : '──';
  const fillPct = Math.round((d.fillOpacity != null ? d.fillOpacity : (isScale ? 0.15 : 0)) * 100);

  let swatchesHtml = '';
  for (const c of TV_DRAW_PALETTE) {
    swatchesHtml += '<div class="tv-color-swatch ' + (c.toLowerCase() === clr.toLowerCase() ? 'active' : '') + '" style="background:' + c + ';" onclick="setDrawingColor(\'' + c + '\')"></div>';
  }

  bar.innerHTML =
    '<div class="tv-float-handle" title="Drag toolbar" onmousedown="startDragFloatingToolbar(event)">⠿</div>' +
    '<div style="position:relative;">' +
    '<button class="tv-float-btn" onclick="toggleDrawingColorPicker(event)" title="Color">' +
    '<span class="tv-float-color-dot" style="background:' + clr + ';"></span>' +
    '<svg width="7" height="5" viewBox="0 0 10 6"><path d="M0 0l5 6 5-6z" fill="currentColor"/></svg>' +
    '</button>' +
    '<div id="tv-float-color-menu" class="tv-float-color-picker" style="display:none;" onclick="event.stopPropagation()">' +
    swatchesHtml +
    '</div>' +
    '</div>' +
    '<div class="tv-float-sep"></div>' +
    '<button class="tv-float-btn" onclick="cycleDrawingWidth(event)" title="Line / Border Width">' +
    '<span>' + width + 'px</span>' +
    '</button>' +
    '<button class="tv-float-btn" onclick="cycleDrawingStyle(event)" title="Line / Border Style">' +
    '<span style="font-family:monospace;letter-spacing:1px;">' + styleIcon + '</span>' +
    '</button>' +
    (hasFill ? (
      '<div class="tv-float-sep"></div>' +
      '<button class="tv-float-btn" onclick="cycleDrawingOpacity(event)" title="Fill Transparency">' +
      '<span>💧 ' + fillPct + '%</span>' +
      '</button>'
    ) : '') +
    (d.type === 'text' || d.type === 'pricenote' || d.type === 'comment' ? (
      '<div class="tv-float-sep"></div>' +
      '<button class="tv-float-btn" onclick="editDrawingText(event)" title="Edit Text">' +
      '<span>✎ Edit</span>' +
      '</button>'
    ) : '') +
    '<div class="tv-float-sep"></div>' +
    '<button class="tv-float-btn" onclick="openCoordsDialog(_chartDrawings[getActiveDrawingSymbol()][_selectedDrawingIndex])" title="TradingView Settings">' +
    '<span style="font-size:12px;">⚙</span>' +
    '</button>' +
    '<button class="tv-float-btn" onclick="deleteSelectedDrawing(event)" title="Delete" style="color:#ef4444;">' +
    '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>' +
    '</button>' +
    '<button class="tv-float-btn" onclick="deselectDrawing(event)" title="Close" style="color:#94a3b8;font-size:12px;">✕</button>';
}
window.updateFloatingToolbar = updateFloatingToolbar;

function toggleScaleBorders(e) {
  if (e) e.stopPropagation();
  const sym = getActiveDrawingSymbol();
  const drawings = _chartDrawings[sym] || [];
  if (_selectedDrawingIndex != null && drawings[_selectedDrawingIndex]) {
    const d = drawings[_selectedDrawingIndex];
    d.showBorders = (d.showBorders === false) ? true : false;
    saveChartDrawings();
    redrawChartDrawings();
    updateFloatingToolbar();
  }
}
window.toggleScaleBorders = toggleScaleBorders;

function toggleScaleField(field, e) {
  if (e) e.stopPropagation();
  const sym = getActiveDrawingSymbol();
  const drawings = _chartDrawings[sym] || [];
  if (_selectedDrawingIndex != null && drawings[_selectedDrawingIndex]) {
    const d = drawings[_selectedDrawingIndex];
    if (field === 'showPrice') {
      d.showPrice = (d.showPrice === false) ? true : false;
    } else if (field === 'showPercent') {
      d.showPercent = (d.showPercent === false) ? true : false;
    } else if (field === 'showDateBars') {
      const sb = (d.showBars !== false);
      const sd = (d.showDate !== false);
      if (sb && sd) {
        d.showBars = true; d.showDate = false;
      } else if (sb && !sd) {
        d.showBars = false; d.showDate = true;
      } else if (!sb && sd) {
        d.showBars = false; d.showDate = false;
      } else {
        d.showBars = true; d.showDate = true;
      }
    }
    saveChartDrawings();
    redrawChartDrawings();
    updateFloatingToolbar();
  }
}
window.toggleScaleField = toggleScaleField;
window.updateFloatingToolbar = updateFloatingToolbar;

function hideFloatingToolbar() {
  const bar = document.getElementById('tv-drawing-floating-toolbar');
  if (bar) bar.style.display = 'none';
}
window.hideFloatingToolbar = hideFloatingToolbar;

function toggleDrawingColorPicker(e) {
  if (e) e.stopPropagation();
  const menu = document.getElementById('tv-float-color-menu');
  if (menu) {
    menu.style.display = (menu.style.display === 'none' || !menu.style.display) ? 'grid' : 'none';
  }
}
window.toggleDrawingColorPicker = toggleDrawingColorPicker;

function setDrawingColor(hex) {
  const sym = getActiveDrawingSymbol();
  const drawings = _chartDrawings[sym] || [];
  if (_selectedDrawingIndex != null && drawings[_selectedDrawingIndex]) {
    drawings[_selectedDrawingIndex].color = hex;
    saveChartDrawings();
    redrawChartDrawings();
    updateFloatingToolbar();
  }
}
window.setDrawingColor = setDrawingColor;

function cycleDrawingWidth(e) {
  if (e) e.stopPropagation();
  const sym = getActiveDrawingSymbol();
  const drawings = _chartDrawings[sym] || [];
  if (_selectedDrawingIndex != null && drawings[_selectedDrawingIndex]) {
    const cur = drawings[_selectedDrawingIndex].width || 1;
    const widths = [1, 2, 3, 4];
    const nxt = widths[(widths.indexOf(cur) + 1) % widths.length];
    drawings[_selectedDrawingIndex].width = nxt;
    saveChartDrawings();
    redrawChartDrawings();
    updateFloatingToolbar();
  }
}
window.cycleDrawingWidth = cycleDrawingWidth;

function cycleDrawingStyle(e) {
  if (e) e.stopPropagation();
  const sym = getActiveDrawingSymbol();
  const drawings = _chartDrawings[sym] || [];
  if (_selectedDrawingIndex != null && drawings[_selectedDrawingIndex]) {
    const cur = drawings[_selectedDrawingIndex].style || 'solid';
    const styles = ['solid', 'dashed', 'dotted'];
    const nxt = styles[(styles.indexOf(cur) + 1) % styles.length];
    drawings[_selectedDrawingIndex].style = nxt;
    saveChartDrawings();
    redrawChartDrawings();
    updateFloatingToolbar();
  }
}
window.cycleDrawingStyle = cycleDrawingStyle;

function cycleDrawingOpacity(e) {
  if (e) e.stopPropagation();
  const sym = getActiveDrawingSymbol();
  const drawings = _chartDrawings[sym] || [];
  if (_selectedDrawingIndex != null && drawings[_selectedDrawingIndex]) {
    const cur = drawings[_selectedDrawingIndex].fillOpacity != null ? drawings[_selectedDrawingIndex].fillOpacity : 0;
    const opacities = [0, 0.15, 0.30, 0.50];
    let nextIdx = 0;
    for (let i = 0; i < opacities.length; i++) {
      if (Math.abs(opacities[i] - cur) < 0.05) { nextIdx = (i + 1) % opacities.length; break; }
    }
    drawings[_selectedDrawingIndex].fillOpacity = opacities[nextIdx];
    saveChartDrawings();
    redrawChartDrawings();
    updateFloatingToolbar();
  }
}
window.cycleDrawingOpacity = cycleDrawingOpacity;

function toggleScaleBadgePos(e) {
  if (e) e.stopPropagation();
  const sym = getActiveDrawingSymbol();
  const drawings = _chartDrawings[sym] || [];
  if (_selectedDrawingIndex != null && drawings[_selectedDrawingIndex]) {
    const d = drawings[_selectedDrawingIndex];
    const positions = ['auto', 'above', 'inside', 'below'];
    let idx = positions.indexOf(d.badgePos || 'auto');
    d.badgePos = positions[(idx + 1) % positions.length];
    saveChartDrawings();
    redrawChartDrawings();
    updateFloatingToolbar();
  }
}
window.toggleScaleBadgePos = toggleScaleBadgePos;

function editDrawingText(e) {
  if (e) e.stopPropagation();
  const sym = getActiveDrawingSymbol();
  const drawings = _chartDrawings[sym] || [];
  if (_selectedDrawingIndex != null && drawings[_selectedDrawingIndex]) {
    const d = drawings[_selectedDrawingIndex];
    const promptMsg = d.type === 'pricenote' ? 'Edit Price Note text / price:' : (d.type === 'comment' ? 'Edit comment:' : 'Edit annotation text:');
    const val = prompt(promptMsg, d.text || '');
    if (val != null && val.trim()) {
      d.text = val.trim();
      saveChartDrawings();
      redrawChartDrawings();
      updateFloatingToolbar();
    }
  }
}
window.editDrawingText = editDrawingText;

function deleteSelectedDrawing(e) {
  if (e) e.stopPropagation();
  const sym = getActiveDrawingSymbol();
  const drawings = _chartDrawings[sym] || [];
  if (_selectedDrawingIndex != null && drawings[_selectedDrawingIndex]) {
    pushDrawHistory(sym);
    drawings.splice(_selectedDrawingIndex, 1);
    _selectedDrawingIndex = null;
    hideFloatingToolbar();
    saveChartDrawings();
    redrawChartDrawings();
    showChartToast('🗑 Drawing deleted', '#ef4444');
  }
}
window.deleteSelectedDrawing = deleteSelectedDrawing;

function deselectDrawing(e) {
  if (e) e.stopPropagation();
  _selectedDrawingIndex = null;
  hideFloatingToolbar();
  const canvas = document.getElementById('max-chart-draw-canvas');
  if (canvas && _currentDrawTool === 'select') canvas.style.pointerEvents = 'none';
  redrawChartDrawings();
}
window.deselectDrawing = deselectDrawing;

function startDragFloatingToolbar(e) {
  e.preventDefault();
  e.stopPropagation();
  const bar = document.getElementById('tv-drawing-floating-toolbar');
  if (!bar) return;
  const startX = e.clientX;
  const startY = e.clientY;
  const initialLeft = bar.offsetLeft;
  const initialTop = bar.offsetTop;

  const onMove = ev => {
    bar.style.left = Math.max(0, initialLeft + ev.clientX - startX) + 'px';
    bar.style.top = Math.max(0, initialTop + ev.clientY - startY) + 'px';
  };
  const onUp = () => {
    window.removeEventListener('mousemove', onMove);
    window.removeEventListener('mouseup', onUp);
  };
  window.addEventListener('mousemove', onMove);
  window.addEventListener('mouseup', onUp);
}
window.startDragFloatingToolbar = startDragFloatingToolbar;

// Close color picker popup when clicking outside
window.addEventListener('mousedown', e => {
  const menu = document.getElementById('tv-float-color-menu');
  if (menu && menu.style.display !== 'none') {
    if (!e.target.closest('#tv-float-color-menu') && !e.target.closest('.tv-float-btn')) {
      menu.style.display = 'none';
    }
  }
});

