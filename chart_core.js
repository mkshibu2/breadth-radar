// Shared LightweightCharts renderer for Chart Studio (index.html), Sector Command (sectors.html), and Screener Split Chart (screener.html).

(function (global) {
  'use strict';

  const WIN_CORE_DEFAULTS = {
    inputs: {
      ema1Period: 10,
      ema2Period: 20,
      sma1Period: 50,
      sma2Period: 200,
      sma30wPeriod: 30,
      volLen: 50,
      vtLookback: 25,
      vtRows: 30,
      vtHvnPct: 60,
      vtLvnPct: 40,
      purpleRoc: 5.0,
      purpleVol: 1000000,
      vcpRangePct: 2.0,
      powerPocketVolMult: 1.5,
    },
    style: {
      ema10: { visible: true, color: '#3b82f6', opacity: 85, width: 1, lineStyle: 0 },
      ema20: { visible: true, color: '#ef4444', opacity: 85, width: 1, lineStyle: 0 },
      sma50: { visible: true, color: '#06b6d4', opacity: 85, width: 1, lineStyle: 0 },
      sma200: { visible: true, color: '#22c55e', opacity: 85, width: 1.5, lineStyle: 0 },
      sma30w: { visible: true, color: '#f97316', opacity: 85, width: 1, lineStyle: 0 },
      rs: { visible: true, color: '#38bdf8', opacity: 100, width: 1.4, lineStyle: 0 },
      dots: { visible: true },
      vt: { visible: true, color: '#4863fc', opacity: 100, width: 1.2, lineStyle: 2 },
      purpleDot: { visible: true, color: '#d203f7' },
      vcp: { visible: true, color: '#ffffff' },
      powerPocket: { visible: true, color: '#94a3b8' },
    },
  };

  function _ccHexToRgba(hex, opacity) {
    if (typeof global.hexToRgba === 'function') return global.hexToRgba(hex, opacity);
    if (!hex) return hex;
    if (hex.startsWith('rgba') || hex.startsWith('rgb')) return hex;
    const clean = hex.replace('#', '');
    let r = 0, g = 0, b = 0;
    if (clean.length === 3) {
      r = parseInt(clean[0] + clean[0], 16);
      g = parseInt(clean[1] + clean[1], 16);
      b = parseInt(clean[2] + clean[2], 16);
    } else if (clean.length >= 6) {
      r = parseInt(clean.substring(0, 2), 16);
      g = parseInt(clean.substring(2, 4), 16);
      b = parseInt(clean.substring(4, 6), 16);
    }
    const a = opacity != null ? opacity : 1;
    return `rgba(${r}, ${g}, ${b}, ${a})`;
  }

  function _ccCalcEMA(candles, period) {
    if (typeof global.calculateEMA === 'function') return global.calculateEMA(candles, period);
    const k = 2 / (period + 1);
    const ema = [];
    let prev = null;
    for (let i = 0; i < candles.length; i++) {
      const c = candles[i].close;
      if (prev === null) {
        if (i >= period - 1) {
          let sum = 0;
          for (let j = i - period + 1; j <= i; j++) sum += candles[j].close;
          prev = sum / period;
          ema.push(prev);
        } else {
          ema.push(null);
        }
      } else {
        prev = c * k + prev * (1 - k);
        ema.push(prev);
      }
    }
    return ema;
  }

  function _ccCalcSMA(candles, period) {
    if (typeof global.calculateSMA === 'function') return global.calculateSMA(candles, period);
    const sma = [];
    let sum = 0;
    for (let i = 0; i < candles.length; i++) {
      sum += candles[i].close;
      if (i >= period) sum -= candles[i - period].close;
      sma.push(i >= period - 1 ? sum / period : null);
    }
    return sma;
  }

  function _ccCalcAvgVol(candles, period) {
    if (typeof global.calculateAvgVol === 'function') return global.calculateAvgVol(candles, period);
    const p = period || 50;
    const avgVol = [];
    let sum = 0;
    for (let i = 0; i < candles.length; i++) {
      sum += (candles[i].volume || 0);
      if (i >= p) sum -= (candles[i - p].volume || 0);
      avgVol.push(i >= p - 1 ? sum / p : null);
    }
    return avgVol;
  }

  function renderLwCardChart({
    container,
    candles,
    niftyCandles = null,
    timeframe = 'D',
    chartType = 'candles',
    scalePrefix = 'card_',
    statsEl = null,
    tableEl = null,
    symbol = '',
    chartsMap = null,
    observersMap = null,
    candlesMap = null,
    mapKey = null,
    updateGlobalMaxPriceSeries = false,
    maVisibility = null,
    onCrosshairMove = null,
  }) {
    if (!container || !candles || candles.length === 0 || typeof LightweightCharts === 'undefined') return null;

    if (chartsMap && mapKey != null && chartsMap[mapKey]) {
      try { chartsMap[mapKey].remove(); } catch (e) { }
      delete chartsMap[mapKey];
    }
    container.innerHTML = '';

    const rect = container.getBoundingClientRect();
    const width = rect.width || container.clientWidth || 300;
    const height = rect.height || container.clientHeight || 200;

    const sorted = [...candles].sort((a, b) => a.time - b.time);
    const seenTimes = new Set();
    const cleanCandles = [];
    for (const c of sorted) {
      const tSec = c.time > 1e11 ? Math.floor(c.time / 1000) : Math.floor(c.time);
      if (!seenTimes.has(tSec) && c.open != null && c.high != null && c.low != null && c.close != null) {
        seenTimes.add(tSec);
        cleanCandles.push({
          time: tSec,
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close,
          volume: c.volume || 0,
        });
      }
    }
    if (cleanCandles.length === 0) return null;
    if (updateGlobalMaxPriceSeries) global._maxCleanCandles = cleanCandles;

    const chart = LightweightCharts.createChart(container, {
      width: width,
      height: height,
      layout: {
        background: { color: '#090b10' },
        textColor: '#94a3b8',
        fontFamily: "'Inter', sans-serif",
        fontSize: 10,
      },
      grid: {
        vertLines: { color: 'rgba(255, 255, 255, 0.025)' },
        horzLines: { color: 'rgba(255, 255, 255, 0.025)' },
      },
      crosshair: {
        mode: LightweightCharts.CrosshairMode.Normal,
        vertLine: { color: 'rgba(91, 163, 245, 0.3)', width: 1, style: 2 },
        horzLine: { color: 'rgba(91, 163, 245, 0.3)', width: 1, style: 2 },
      },
      rightPriceScale: {
        visible: true,
        borderColor: 'rgba(255, 255, 255, 0.08)',
        scaleMargins: { top: 0.08, bottom: 0.22 },
        autoScale: true,
        alignLabels: true,
      },
      timeScale: {
        borderColor: 'rgba(255, 255, 255, 0.06)',
        timeVisible: timeframe === '1H' || timeframe === '15m',
        secondsVisible: false,
      },
    });

    if (chartsMap && mapKey != null) chartsMap[mapKey] = chart;

    let priceSeries;
    if (chartType === 'ohlc') {
      priceSeries = chart.addBarSeries({
        upColor: '#26a69a',
        downColor: '#ef5350',
        wickVisible: true,
      });
    } else {
      priceSeries = chart.addCandlestickSeries({
        upColor: '#26a69a',
        downColor: '#ef5350',
        borderVisible: false,
        wickUpColor: '#26a69a',
        wickDownColor: '#ef5350',
      });
    }
    priceSeries.setData(cleanCandles);
    if (updateGlobalMaxPriceSeries) global._maxLwPriceSeries = priceSeries;

    const volScaleId = `${scalePrefix}vol_scale`;
    const volSeries = chart.addHistogramSeries({
      priceFormat: { type: 'volume' },
      priceScaleId: volScaleId,
    });
    chart.priceScale(volScaleId).applyOptions({
      scaleMargins: { top: 0.82, bottom: 0 },
      visible: false,
    });
    volSeries.setData(cleanCandles.map(c => ({
      time: c.time,
      value: c.volume,
      color: c.close >= c.open ? 'rgba(38, 166, 154, 0.35)' : 'rgba(239, 83, 80, 0.35)',
    })));

    const tf = timeframe || 'D';
    const isWeekly = (tf === 'W');
    const isDaily = (tf === 'D');

    const cfg = global._winConfig || WIN_CORE_DEFAULTS;
    const inp = cfg.inputs || WIN_CORE_DEFAULTS.inputs;
    const st = cfg.style || WIN_CORE_DEFAULTS.style;

    const ema10Vals = _ccCalcEMA(cleanCandles, inp.ema1Period || 10);
    const ema20Vals = _ccCalcEMA(cleanCandles, inp.ema2Period || 20);
    const sma50Vals = _ccCalcSMA(cleanCandles, inp.sma1Period || 50);
    const sma200Vals = _ccCalcSMA(cleanCandles, inp.sma2Period || 200);
    const sma30wVals = _ccCalcSMA(cleanCandles, inp.sma30wPeriod || 30);
    const avgVolVals = _ccCalcAvgVol(cleanCandles, inp.volLen || 50);

    const maMaps = {
      ema10: new Map(),
      ema20: new Map(),
      sma50: new Map(),
      sma200: new Map(),
    };
    for (let i = 0; i < cleanCandles.length; i++) {
      const t = cleanCandles[i].time;
      if (ema10Vals[i] != null) maMaps.ema10.set(t, ema10Vals[i]);
      if (ema20Vals[i] != null) maMaps.ema20.set(t, ema20Vals[i]);
      if (sma50Vals[i] != null) maMaps.sma50.set(t, sma50Vals[i]);
      if (sma200Vals[i] != null) maMaps.sma200.set(t, sma200Vals[i]);
    }

    const addMaSeries = (key, lineCfg, vals, defaultColor, defaultWidth, cond = true) => {
      if (!cond || !lineCfg || !lineCfg.visible) return null;
      const isVisible = !(maVisibility && maVisibility[key] === false);
      const data = [];
      if (isVisible) {
        for (let i = 0; i < cleanCandles.length; i++) {
          if (vals[i] != null) data.push({ time: cleanCandles[i].time, value: vals[i] });
        }
      }
      const s = chart.addLineSeries({
        color: _ccHexToRgba(lineCfg.color || defaultColor, (lineCfg.opacity != null ? lineCfg.opacity : 85) / 100),
        lineWidth: lineCfg.width != null ? Number(lineCfg.width) : defaultWidth,
        lineStyle: lineCfg.lineStyle || 0,
        priceLineVisible: false,
        lastValueVisible: false,
        title: ''
      });
      s.setData(data);
      return s;
    };

    const maSeries = {
      ema10: addMaSeries('ema10', st.ema10, ema10Vals, '#3b82f6', 1, true),
      ema20: addMaSeries('ema20', st.ema20, ema20Vals, '#ef4444', 1, true),
      sma50: addMaSeries('sma50', st.sma50, sma50Vals, '#06b6d4', 1, !isWeekly),
      sma200: addMaSeries('sma200', st.sma200, sma200Vals, '#22c55e', 1.5, !isWeekly),
      sma30w: addMaSeries('sma30w', st.sma30w, sma30wVals, '#f97316', 1, isWeekly),
    };

    if (st.rs && st.rs.visible && niftyCandles && niftyCandles.length > 0) {
      const nMap = new Map();
      for (const nc of niftyCandles) {
        const ncMs = nc.time > 1e11 ? nc.time : nc.time * 1000;
        nMap.set(new Date(ncMs).toISOString().split('T')[0], nc.close);
      }
      const rsData = [];
      for (const c of cleanCandles) {
        const dStr = new Date(c.time * 1000).toISOString().split('T')[0];
        const nClose = nMap.get(dStr);
        if (nClose != null && nClose > 0) {
          rsData.push({ time: c.time, value: (c.close / nClose) * 1000 });
        }
      }
      if (rsData.length > 0) {
        const rsScaleId = `${scalePrefix}rs_scale`;
        const rsSeries = chart.addLineSeries({
          color: _ccHexToRgba(st.rs.color || '#38bdf8', (st.rs.opacity != null ? st.rs.opacity : 100) / 100),
          lineWidth: st.rs.width || 1.4,
          lineStyle: st.rs.lineStyle || 0,
          priceScaleId: rsScaleId,
          priceLineVisible: false,
          lastValueVisible: false,
          title: '',
        });
        chart.priceScale(rsScaleId).applyOptions({
          scaleMargins: { top: 0.05, bottom: 0.70 },
          visible: false,
        });
        rsSeries.setData(rsData);
      }
    }

    if (st.dots && st.dots.visible && typeof global.calculateWinMarkers === 'function') {
      const markers = global.calculateWinMarkers(cleanCandles, ema10Vals, avgVolVals, isDaily);
      priceSeries.setMarkers(markers);
    } else {
      priceSeries.setMarkers([]);
    }

    let vt = null;
    if (typeof global.calcVolumeTrigger === 'function') {
      vt = global.calcVolumeTrigger(cleanCandles, inp.vtLookback, inp.vtRows, inp.vtHvnPct, inp.vtLvnPct);
      if (st.vt && st.vt.visible && isDaily && vt && vt.isAboveClose) {
        priceSeries.createPriceLine({
          price: vt.price,
          color: _ccHexToRgba(st.vt.color || '#4863fc', (st.vt.opacity != null ? st.vt.opacity : 100) / 100),
          lineWidth: st.vt.width || 1.2,
          lineStyle: st.vt.lineStyle != null ? st.vt.lineStyle : LightweightCharts.LineStyle.Dashed,
          axisLabelVisible: false,
          title: '',
        });
      }
    }

    if (tableEl && symbol && typeof global.renderWinHudTableHtml === 'function') {
      const details = typeof global.getStockDetails === 'function' ? global.getStockDetails(symbol) : { symbol };
      tableEl.innerHTML = global.renderWinHudTableHtml(cleanCandles, details, vt);
    }

    const ctx = { chart, priceSeries, volSeries, maSeries, maMaps, cleanCandles, vt };

    if (typeof onCrosshairMove === 'function') {
      chart.subscribeCrosshairMove(param => onCrosshairMove(param, ctx));
    } else if (statsEl) {
      const updateStats = (bar) => {
        if (!statsEl || !bar) return;
        const isUp = bar.close >= bar.open;
        const color = isUp ? 'var(--lime)' : 'var(--red)';
        const pct = (((bar.close - bar.open) / bar.open) * 100).toFixed(1);
        const sign = isUp ? '+' : '';
        statsEl.innerHTML = `<span style="font-family:var(--mono);font-weight:600;margin-right:2px">${bar.close.toFixed(1)}</span>
                             <span style="color:${color};font-family:var(--mono);font-weight:600;margin-right:2px">${sign}${pct}%</span>`;
      };
      chart.subscribeCrosshairMove(param => {
        if (!param || !param.time || !param.seriesData.get(priceSeries)) {
          updateStats(cleanCandles[cleanCandles.length - 1]);
          return;
        }
        updateStats(param.seriesData.get(priceSeries));
      });
    }

    if (candlesMap && mapKey != null) candlesMap[mapKey] = cleanCandles;

    if (typeof global.resetChartPriceScale === 'function') global.resetChartPriceScale(chart, 'right');
    if (typeof global.applyPreservedChartZoom === 'function') {
      if (global.applyPreservedChartZoom.length === 2) {
        global.applyPreservedChartZoom(cleanCandles.length, isWeekly);
      } else {
        global.applyPreservedChartZoom(chart, cleanCandles.length, tf);
      }
    }

    chart.timeScale().subscribeVisibleLogicalRangeChange(range => {
      if (typeof global.saveUserChartZoomPreference === 'function') {
        global.saveUserChartZoomPreference(range, cleanCandles.length, tf);
      }
    });

    chart.subscribeDblClick(() => {
      if (typeof global.resetChartPriceScale === 'function') global.resetChartPriceScale(chart, 'right');
      if (typeof global.applyPreservedChartZoom === 'function') {
        if (global.applyPreservedChartZoom.length === 2) {
          global.applyPreservedChartZoom(cleanCandles.length, isWeekly);
        } else {
          global.applyPreservedChartZoom(chart, cleanCandles.length, tf);
        }
      }
    });

    if (observersMap && mapKey != null && typeof ResizeObserver !== 'undefined') {
      if (observersMap[mapKey]) {
        try { observersMap[mapKey].disconnect(); } catch (e) { }
      }
      observersMap[mapKey] = new ResizeObserver(entries => {
        const activeChart = chartsMap ? chartsMap[mapKey] : chart;
        if (!entries || !entries.length || !activeChart) return;
        const cr = entries[0].contentRect;
        if (cr.width > 0 && cr.height > 0) {
          activeChart.applyOptions({ width: cr.width, height: cr.height });
          if (typeof global.resetChartPriceScale === 'function') global.resetChartPriceScale(activeChart, 'right');
          const cached = candlesMap ? candlesMap[mapKey] : cleanCandles;
          if (cached && cached.length > 0 && typeof global.applyPreservedChartZoom === 'function') {
            if (global.applyPreservedChartZoom.length === 2) {
              global.applyPreservedChartZoom(cached.length, isWeekly);
            } else {
              global.applyPreservedChartZoom(activeChart, cached.length, tf);
            }
          }
        }
      });
      observersMap[mapKey].observe(container);
    }

    return ctx;
  }

  function renderHighlightedStatPill(label, valueText, tone) {
    const t = tone || {};
    const col = t.col || '#f8fafc';
    const bg = t.bg || 'rgba(56,189,248,0.14)';
    const bdr = t.bdr || 'rgba(56,189,248,0.42)';
    return `<span style="background:${bg};border:1px solid ${bdr};padding:1px 7px;border-radius:4px;white-space:nowrap;box-shadow:0 0 8px ${bg};"><span style="color:#e2e8f0;font-weight:700;">${label}:</span> <b style="color:${col};margin-left:3px;font-weight:800;">${valueText}</b></span>`;
  }

  function getRsHighlightTone(rsVal) {
    if (rsVal == null || isNaN(rsVal)) return { col: '#94a3b8', bg: 'rgba(148,163,184,0.10)', bdr: 'rgba(148,163,184,0.30)' };
    if (rsVal >= 90) return { col: '#4ade80', bg: 'rgba(74,222,128,0.18)', bdr: 'rgba(74,222,128,0.50)' };
    if (rsVal >= 80) return { col: '#2dd4bf', bg: 'rgba(45,212,191,0.18)', bdr: 'rgba(45,212,191,0.48)' };
    if (rsVal >= 60) return { col: '#fbbf24', bg: 'rgba(251,191,36,0.16)', bdr: 'rgba(251,191,36,0.45)' };
    return { col: '#f87171', bg: 'rgba(248,113,113,0.16)', bdr: 'rgba(248,113,113,0.45)' };
  }

  function getRvolHighlightTone(rVol) {
    if (rVol == null || isNaN(rVol)) return { col: '#94a3b8', bg: 'rgba(148,163,184,0.10)', bdr: 'rgba(148,163,184,0.30)' };
    if (rVol >= 110) return { col: '#4ade80', bg: 'rgba(34,197,94,0.18)', bdr: 'rgba(34,197,94,0.50)' };
    if (rVol >= 80) return { col: '#fb923c', bg: 'rgba(251,146,60,0.16)', bdr: 'rgba(251,146,60,0.45)' };
    return { col: '#f87171', bg: 'rgba(239,68,68,0.16)', bdr: 'rgba(239,68,68,0.45)' };
  }

  /**
   * Computes MarketSmith / IBD-style 1-99 RS percentile across a stock universe
   * using weighted multi-quarter performance (40% 3M + 20% 6M + 20% 9M + 20% 12M).
   */
  function computeMarketSmithRsMap(stocks) {
    const entries = [];
    for (let i = 0; i < (stocks || []).length; i++) {
      const s = stocks[i];
      if (!s || !s.symbol) continue;
      const p3 = s.perf_3m != null ? Number(s.perf_3m) : null;
      const p6 = s.perf_6m != null ? Number(s.perf_6m) : null;
      const p1y = s.perf_1y != null ? Number(s.perf_1y) : null;
      if (p3 == null && p6 == null && p1y == null) continue;
      const r3 = p3 != null ? p3 : (p6 != null ? p6 * 0.5 : (p1y || 0) * 0.25);
      const r6 = p6 != null ? p6 : (p3 != null ? p3 : (p1y || 0) * 0.5);
      const r12 = p1y != null ? p1y : r6;
      const r9 = (r6 + r12) / 2;
      const comp = r3 * 0.4 + r6 * 0.2 + r9 * 0.2 + r12 * 0.2;
      if (isFinite(comp)) {
        entries.push({ sym: String(s.symbol).toUpperCase().replace(/\.(NS|BO)$/i, '').trim(), comp });
      }
    }
    const sorted = entries.map(e => e.comp).sort((a, b) => a - b);
    const n = sorted.length;
    const map = {};
    if (!n) return map;
    for (let i = 0; i < entries.length; i++) {
      const val = entries[i].comp;
      let lo = 0, hi = n;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (sorted[mid] <= val) lo = mid + 1;
        else hi = mid;
      }
      const pct = n > 1 ? Math.min(99, Math.max(1, Math.round((lo / n) * 98) + 1)) : 99;
      map[entries[i].sym] = pct;
    }
    return map;
  }

  global.renderLwCardChart = renderLwCardChart;
  global.renderHighlightedStatPill = renderHighlightedStatPill;
  global.getRsHighlightTone = getRsHighlightTone;
  global.getRvolHighlightTone = getRvolHighlightTone;
  global.computeMarketSmithRsMap = computeMarketSmithRsMap;
})(window);
