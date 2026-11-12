// ── GLOBAL CHART STUDIO STATE VARIABLES ──
var _chartDataSource = 'yf'; // 'yf' | 'dhan'
var _maxLwChart = null;
var _maxLwPriceSeries = null;
var _maxLwResizeObserver = null;


function showChartToast(msg, color = '#2962ff') {
  let toast = document.getElementById('tv-chart-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'tv-chart-toast';
    toast.style.cssText = 'position:fixed;bottom:70px;left:50%;transform:translateX(-50%);background:rgba(19,23,34,0.92);border:1px solid #2a2e39;color:#f0f3fa;padding:6px 16px;border-radius:20px;font-family:-apple-system,BlinkMacSystemFont,sans-serif;font-size:12px;font-weight:600;z-index:99999;box-shadow:0 6px 20px rgba(0,0,0,0.6);backdrop-filter:blur(6px);transition:opacity 0.2s,transform 0.2s;pointer-events:none;';
    document.body.appendChild(toast);
  }
  toast.innerHTML = msg;
  toast.style.borderColor = color;
  toast.style.opacity = '1';
  toast.style.transform = 'translateX(-50%) translateY(0)';
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(-50%) translateY(6px)';
  }, 2200);
}
window.showChartToast = showChartToast;

function toggleCollapse(bodyId, iconId) { const body = document.getElementById(bodyId); const icon = document.getElementById(iconId); if (!body) return; const isHidden = body.style.display === 'none'; body.style.display = isHidden ? 'block' : 'none'; if (icon) { icon.style.transform = isHidden ? 'rotate(0deg)' : 'rotate(-90deg)'; } }
async function cfgMakePublic() {
  const cfg = getCfg(); if (!cfg.key || !cfg.bin) { cfgBanner('⚠ No credentials configured.', 'warn', 'cp-sync-msg'); return; }
  if (!confirm('Make your bin publicly readable?\n\nThis allows anyone with your Bin ID to read your data in Guest Mode — without your Master Key.\n\nYour Master Key remains private. You can make it private again at any time.')) return; const btn = document.getElementById('cfg-make-public-btn'); if (btn) { btn.disabled = true; btn.textContent = '🔄 Making public…'; }
  cfgBanner('🔄 Updating bin privacy…', 'inf', 'cp-sync-msg'); try {
    const r = await fetch(`${JB}/b/${cfg.bin}/meta/privacy`, { method: 'PUT', headers: { 'Content-Type': 'application/json', 'X-Master-Key': cfg.key, 'X-Bin-Private': 'false' } }); if (!r.ok) { const t = await r.text(); throw new Error(`Failed (${r.status}): ${t.slice(0, 80)}`); }
    const j = await r.json(); const isNowPublic = j.metadata && j.metadata.private === false; if (isNowPublic) { cfgBanner(`✅ Bin is now Public!\n\nShare your Bin ID with your friend:\n${cfg.bin}\n\nThey open the dashboard → click sync button → Guest Mode → paste Bin ID → Connect as Guest.`, 'ok', 'cp-sync-msg'); if (btn) { btn.textContent = '✅ Bin is Public'; btn.style.color = 'var(--lime)'; btn.style.borderColor = 'rgba(74,222,128,.3)'; } } else { cfgBanner('⚠ Request sent but privacy status unclear. Check jsonbin.io to confirm.', 'warn', 'cp-sync-msg'); }
  } catch (e) { cfgBanner('✗ ' + e.message, 'err', 'cp-sync-msg'); if (btn) { btn.disabled = false; btn.textContent = '🌐 Make Bin Public (for Guest sharing)'; } }
}
async function cfgMakePrivate() { const cfg = getCfg(); if (!cfg.key || !cfg.bin) return; try { const r = await fetch(`${JB}/b/${cfg.bin}/meta/privacy`, { method: 'PUT', headers: { 'Content-Type': 'application/json', 'X-Master-Key': cfg.key, 'X-Bin-Private': 'true' } }); if (!r.ok) throw new Error('Failed: ' + r.status); cfgBanner('✅ Bin is now Private again.', 'ok', 'cp-sync-msg'); const btn = document.getElementById('cfg-make-public-btn'); if (btn) { btn.disabled = false; btn.textContent = '🌐 Make Bin Public (for Guest sharing)'; btn.style.color = ''; btn.style.borderColor = ''; } } catch (e) { cfgBanner('✗ ' + e.message, 'err', 'cp-sync-msg'); } }
function exportSnapshot() {
  const records = loadLocal(); const mpm = mpmLoad(); const bsr = bsrLoad(); const ftd = ftdLoad(); if (!records.length) { alert('No data to export. Save some EOD entries first.'); return; }
  const today = records[0]; const score = today.score || 0; const zone = getZone(score); const prev = records[1] || {}; const momentum = prev.score ? score - prev.score : null; const mpm25 = mpm.slice(0, 25); const mpmAcc = mpm25.filter(d => d.dtype === 'acc').length; const mpmDist = mpm25.filter(d => d.dtype === 'dist').length; const mpmNet = mpmAcc - mpmDist; const bsrStats = bsrGetEffectiveStats(); const bsrSucc = bsrStats.succ; const bsrFail = bsrStats.fail; const bsrPct = bsrStats.pct; const hist = records.slice(0, 30); const sparkScores = records.slice(0, 25).map(r => r.score || 0).reverse(); const zc = s => s >= 55 ? '#4ade80' : s >= 45 ? '#34d399' : s >= 35 ? '#fbbf24' : s >= 20 ? '#fb923c' : '#f87171'; const znm = s => s >= 55 ? 'Healthy' : s >= 45 ? 'Expanding' : s >= 35 ? 'Caution' : s >= 20 ? 'Defensive' : 'Correction'; const exportDate = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' }); const dataDate = fmtLong(today.date); const histRows = hist.map(r => {
    const z2 = getZone(r.score || 0); const adv = +r.adv || 0, dec = +r.dec || 0; const adr = dec > 0 ? (adv / dec).toFixed(2) : '—'; return `<tr>
      <td>${r.date}</td>
      <td style="color:${adv >= dec ? '#4ade80' : '#f87171'}">${adv}</td>
      <td style="color:${dec > adv ? '#f87171' : '#8899b0'}">${dec}</td>
      <td>${adr}</td>
      <td style="color:#fbbf24">${r.e20 || '—'}%</td>
      <td style="color:#5ba3f5">${r.s50 || '—'}%</td>
      <td style="color:#34d399">${r.s200 || '—'}%</td>
      <td style="font-weight:700;color:${z2.color}">${r.score || '—'}</td>
      <td><span style="background:${z2.bg};color:${z2.color};padding:2px 7px;border-radius:3px;font-size:10px;font-weight:600">${r.zone || '—'}</span></td>
    </tr>`;
  }).join(''); const mpmRows = mpm.slice(0, 15).map(d => {
    const c = d.dtype === 'acc' ? '#4ade80' : d.dtype === 'dist' ? '#f87171' : '#8899b0'; const lbl = d.dtype === 'acc' ? '▲ Acc' : d.dtype === 'dist' ? '▼ Dist' : '→ Neut'; return `<tr>
      <td>${d.date}</td>
      <td style="color:${c};font-weight:600">${lbl}</td>
      <td>${d.close || '—'}</td>
      <td>${d.pclose || '—'}</td>
    </tr>`;
  }).join(''); const momLabel = momentum === null ? '—' : momentum > 0 ? `+${momentum} ↑` : momentum < 0 ? `${momentum} ↓` : '0 →'; const momColor = momentum > 0 ? '#4ade80' : momentum < 0 ? '#f87171' : '#8899b0'; const expInfo = (() => { if (score >= 55) return { pct: '75–100%', note: 'Full position sizing. Act on quality breakouts.' }; if (score >= 45) return { pct: '50–75%', note: 'Normal entries. 1–2R per position.' }; if (score >= 35) return { pct: '25–50%', note: 'Pilot entries only. 0.5–1R max.' }; if (score >= 20) return { pct: '0–25%', note: 'Minimal exposure. 0.25R pilot only.' }; return { pct: '0%', note: 'Stand aside. Capital preservation.' }; })(); const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>M.Radar — Snapshot ${today.date}</title>
<style>*{box-sizing:border-box;margin:0;padding:0}body{background:#0e1420;color:#dde6f0;font-family:'Segoe UI',system-ui,sans-serif;font-size:13px;line-height:1.5}.hdr{background:#161e2e;padding:12px 20px;border-bottom:1px solid #273447;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px}.logo{font-size:18px;font-weight:800;letter-spacing:3px;color:#5ba3f5;display:flex;align-items:center;gap:8px}.logo em{color:#4a5e76;font-style:normal}.badge{background:rgba(248,113,113,.12);border:1px solid rgba(248,113,113,.3);color:#f87171;font-size:10px;padding:3px 10px;border-radius:3px;font-weight:600;letter-spacing:.5px}.meta{font-size:11px;color:#8899b0;text-align:right}.page{padding:14px;display:flex;flex-direction:column;gap:10px;max-width:1400px;margin:0 auto}.card{background:#161e2e;border:1px solid #273447;border-radius:6px;overflow:hidden}.card-title{font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:#8899b0;padding:10px 14px;border-bottom:1px solid #273447;background:#1c2638}.grid2{display:grid;grid-template-columns:1fr 1fr;gap:10px}.grid3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px}.grid4{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}.metric{padding:14px;background:#1c2638;border:1px solid #273447;border-radius:6px}.metric-lbl{font-size:10px;text-transform:uppercase;letter-spacing:.5px;color:#4a5e76;margin-bottom:6px}.metric-val{font-size:32px;font-weight:800;line-height:1;font-family:'Segoe UI',sans-serif}.metric-sub{font-size:11px;color:#8899b0;margin-top:5px}table{width:100%;border-collapse:collapse;font-size:11px}th{background:#1c2638;color:#8899b0;text-transform:uppercase;font-size:10px;letter-spacing:.3px;padding:7px 10px;text-align:left;border-bottom:1px solid #273447}td{padding:6px 10px;border-bottom:1px solid rgba(39,52,71,.4);color:#dde6f0}tr:last-child td{border-bottom:none}tr:hover td{background:rgba(91,163,245,.04)}.pill{display:inline-block;padding:2px 8px;border-radius:3px;font-size:10px;font-weight:600}.warn{background:rgba(252,211,77,.1);color:#fbbf24;border:1px solid rgba(252,211,77,.2);padding:10px 14px;border-radius:5px;font-size:12px;margin:0 14px 14px}.sparkbar{display:inline-block;width:8px;border-radius:2px 2px 0 0;vertical-align:bottom;margin:0 1px}@media(max-width:600px){.grid2,.grid3,.grid4{grid-template-columns:1fr}}</style>
</head>
<body>

<div class="hdr">
  <div class="logo">
    <svg viewBox="0 0 24 24" width="22" height="22"><rect width="24" height="24" rx="4" fill="#1c2638"/>
    <rect x="2" y="17" width="3" height="5" rx=".5" fill="#f87171" opacity=".9"/>
    <rect x="6" y="14" width="3" height="8" rx=".5" fill="#fb923c" opacity=".9"/>
    <rect x="10" y="11" width="3" height="11" rx=".5" fill="#fbbf24" opacity=".9"/>
    <rect x="14" y="8" width="3" height="14" rx=".5" fill="#34d399" opacity=".9"/>
    <rect x="18" y="5" width="3" height="17" rx=".5" fill="#4ade80" opacity=".9"/>
    <path d="M 2 19 Q 12 3 22 19" fill="none" stroke="#5ba3f5" stroke-width="1.2" stroke-linecap="round" opacity=".7"/>
    <circle cx="12" cy="4" r="1.2" fill="#5ba3f5"/></svg>
    <span style="color:#f59e0b">M.</span><span style="color:#ffffff">RADAR</span> <span style="font-size:11px;color:#8899b0;margin-left:6px;letter-spacing:1px;font-weight:600">MARKET RADAR</span>
  </div>
  <div class="badge">📸 READ-ONLY SNAPSHOT</div>
  <div class="meta">Data as of ${dataDate}<br>Snapshot generated: ${exportDate}<br>© 2026 Shibu M K</div>
</div>

<div class="page">

  <div class="grid4">
    <div class="metric" style="border-top:3px solid ${zone.color}">
      <div class="metric-lbl">Breadth Score</div>
      <div class="metric-val" style="color:${zone.color}">${score}</div>
      <div class="metric-sub">out of 100</div>
    </div>
    <div class="metric" style="border-top:3px solid ${zone.color}">
      <div class="metric-lbl">Market Zone</div>
      <div class="metric-val" style="color:${zone.color};font-size:22px">${znm(score)}</div>
      <div class="metric-sub">Position: ${zone.r}</div>
    </div>
    <div class="metric" style="border-top:3px solid ${momColor}">
      <div class="metric-lbl">Breadth Momentum</div>
      <div class="metric-val" style="color:${momColor};font-size:28px">${momLabel}</div>
      <div class="metric-sub">vs previous session</div>
    </div>
    <div class="metric" style="border-top:3px solid #2dd4bf">
      <div class="metric-lbl">Market Pressure (MPM)</div>
      <div class="metric-val" style="color:${mpmNet >= 0 ? '#4ade80' : '#f87171'};font-size:28px">${mpmNet >= 0 ? '+' : ''}${mpmNet}</div>
      <div class="metric-sub">${mpmAcc} Acc · ${mpmDist} Dist (25d)</div>
    </div>
  </div>

  <div class="grid2">
    <div class="metric" style="border-top:3px solid #2dd4bf">
      <div class="metric-lbl">📈 Recommended Market Exposure</div>
      <div class="metric-val" style="color:#2dd4bf;font-size:26px">${expInfo.pct}</div>
      <div class="metric-sub">${expInfo.note}</div>
    </div>
    <div class="metric" style="border-top:3px solid #a78bfa">
      <div class="metric-lbl">🎯 BSR — Breakout Success Rate</div>
      <div class="metric-val" style="color:#a78bfa;font-size:26px">${bsrPct !== null ? bsrPct + '%' : '—'}</div>
      <div class="metric-sub">${bsrSucc} success · ${bsrFail} failed of ${bsrSucc + bsrFail} evaluated</div>
    </div>
  </div>

  <div class="card">
    <div class="card-title">📊 Breadth Score — Last ${sparkScores.length} Sessions</div>
    <div style="padding:14px;display:flex;align-items:flex-end;gap:3px;height:90px;overflow:hidden">
      ${sparkScores.map((s, i) => {
    const h = Math.max(4, Math.round(s / 100 * 64));
    const c = zc(s);
    const isLast = i === sparkScores.length - 1;
    return `<div class="sparkbar"style="height:${h}px;background:${c};opacity:${isLast ? 1 : 0.7};flex:1;${isLast ? 'outline:1px solid ' + c : ''}"title="Score: ${s}"></div>`;
  }).join('')}
    </div>
    <div style="padding:0 14px 10px;font-size:10px;color:#4a5e76;display:flex;justify-content:space-between">
      <span>${hist[Math.min(24, hist.length - 1)]?.date || ''}</span>
      <span>Latest: <b style="color:${zc(score)}">${score}</b></span>
      <span>${today.date}</span>
    </div>
  </div>

  <div class="card">
    <div class="card-title">📋 Today's Breadth Detail — ${today.date}</div>
    <div style="padding:12px;display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:8px">
      ${[
      ['Advances', today.adv, '#4ade80'],
      ['Declines', today.dec, '#f87171'],
      ['Unchanged', today.unc || '—', '#8899b0'],
      ['52W Highs', today.hi || '—', '#4ade80'],
      ['52W Lows', today.lo || '—', '#f87171'],
      ['% > EMA20', today.e20 ? today.e20 + '%' : '—', '#fbbf24'],
      ['% > SMA50', today.s50 ? today.s50 + '%' : '—', '#5ba3f5'],
      ['% > SMA200', today.s200 ? today.s200 + '%' : '—', '#34d399'],
      ['Nifty Close', today.nifty || '—', '#dde6f0'],
    ].map(([lbl, val, clr]) => `<div style="background:#1c2638;border:1px solid #273447;border-radius:5px;padding:10px"><div style="font-size:9px;text-transform:uppercase;letter-spacing:.4px;color:#4a5e76;margin-bottom:4px">${lbl}</div><div style="font-size:18px;font-weight:700;color:${clr}">${val}</div></div>`).join('')}
    </div>
  </div>

  <div class="card">
    <div class="card-title">📅 30-Day Breadth History</div>
    <div style="overflow-x:auto">
      <table>
        <thead><tr>
          <th>Date</th><th>Adv</th><th>Dec</th><th>A/D</th>
          <th>EMA20</th><th>SMA50</th><th>SMA200</th>
          <th>Score</th><th>Zone</th>
        </tr></thead>
        <tbody>${histRows}</tbody>
      </table>
    </div>
  </div>

  ${mpm.length ? `<div class="card"><div class="card-title">💹 Market Pressure Log — Last 15 Sessions</div><div style="overflow-x:auto"><table><thead><tr><th>Date</th><th>Type</th><th>Nifty Close</th><th>Prev Close</th></tr></thead><tbody>${mpmRows}</tbody></table></div></div>` : ''}

  <div style="font-size:11px;color:#4a5e76;text-align:center;padding:14px;border-top:1px solid #273447;line-height:1.8">
    <strong style="color:#8899b0">M.Radar (Market Radar)</strong> — Snapshot by <strong style="color:#8899b0">Shibu M K</strong><br>
    For educational purposes only · Not investment advice · Data as of ${today.date}<br>
    <em>See the Market. Find Your Edge. — Clarity in every market cycle</em>
  </div>

</div>
</body>
</html>`; try { const blob = new Blob([html], { type: 'text/html' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `M_Radar_Snapshot_${today.date}.html`; a.style.display = 'none'; document.body.appendChild(a); a.click(); setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 300); } catch (e) { try { const encoded = encodeURIComponent(html); const a = document.createElement('a'); a.href = 'data:text/html;charset=utf-8,' + encoded; a.download = `M_Radar_Snapshot_${today.date}.html`; a.style.display = 'none'; document.body.appendChild(a); a.click(); setTimeout(() => document.body.removeChild(a), 300); } catch (e2) { const w = window.open(); if (w) { w.document.write(html); w.document.close(); alert('File opened in new tab. Use Ctrl+S (or Share → Save) to save it.'); } else { alert('Could not download. Please allow popups for this site and try again.'); } } }
}
const _mem = {}; const _store = (() => {
  for (const s of [() => window.localStorage, () => window.sessionStorage]) { try { const store = s(); const k = '__nbr__'; store.setItem(k, k); if (store.getItem(k) === k) { store.removeItem(k); return store; } } catch (e) { } }
  return null;
})(); console.log('[Storage]', _store === localStorage ? 'localStorage' : _store === sessionStorage ? 'sessionStorage' : 'in-memory (no persistence across refreshes)'); const lsGet = k => {
  if (_store) try { return _store.getItem(k); } catch (e) { }
  return Object.prototype.hasOwnProperty.call(_mem, k) ? _mem[k] : null;
}; const lsSet = (k, v) => {
  if (_store) { try { _store.setItem(k, v); return; } catch (e) { console.warn('[Storage] setItem failed for key:', k, e.message); } }
  _mem[k] = v;
}; const lsDel = k => {
  if (_store) try { _store.removeItem(k); } catch (e) { }
  delete _mem[k];
}; const LS_DATA = 'nse_breadth_v3'; const LS_KEY = 'nse_jb_key'; const LS_BIN = 'nse_jb_bin'; const loadLocal = () => { try { return JSON.parse(lsGet(LS_DATA)) || []; } catch (e) { return []; } }; const saveLocal = d => lsSet(LS_DATA, JSON.stringify(d.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 150))); const LS_BSR = 'nse_bsr_v1'; const LS_BSR_MODE = 'nse_bsr_mode_v1'; const LS_BSR_QUICK = 'nse_bsr_quick_v1'; const bsrLoad = () => { try { return JSON.parse(lsGet(LS_BSR)) || []; } catch (e) { return []; } }; const bsrSave = d => lsSet(LS_BSR, JSON.stringify(d)); const bsrGetMode = () => { const m = lsGet(LS_BSR_MODE); if (m === 'quick' || m === 'log') return m; const q = bsrQuickLoad(); if (q && q.won !== null && q.won !== undefined && q.won !== '') return 'quick'; if (bsrLoad().length > 0) return 'log'; return 'quick'; }; const bsrSetMode = (m) => { lsSet(LS_BSR_MODE, m); lsSet('_bsrModeUpdatedAt', Date.now().toString()); bsrUpdateModeUI(); bsrRenderAll(); renderRPG(); renderMarketSummary(); renderMarketCycle(); pushToCloud(); }; const bsrQuickLoad = () => { try { return JSON.parse(lsGet(LS_BSR_QUICK)) || { won: null, lost: null, total: 10 }; } catch (e) { return { won: null, lost: null, total: 10 }; } }; const bsrQuickSave = d => lsSet(LS_BSR_QUICK, JSON.stringify(d)); const mergeBsrQuick = (cloudQ) => { if (!cloudQ) return; const localQ = bsrQuickLoad(); const localTime = localQ._updatedAt || 0; const cloudTime = cloudQ._updatedAt || 0; if (cloudTime >= localTime || !localTime) { bsrQuickSave(cloudQ); } }; const mergeBsrMode = (cloudMode, cloudUpdatedAt) => { if (!cloudMode) return; const localTime = parseInt(lsGet('_bsrModeUpdatedAt') || '0', 10); const cloudTime = cloudUpdatedAt || 0; if (cloudTime >= localTime || !localTime) { lsSet(LS_BSR_MODE, cloudMode); if (cloudTime) lsSet('_bsrModeUpdatedAt', cloudTime.toString()); } }; const LS_SRT = 'nse_srt_v1'; const LS_CAPITAL = 'nse_capital_v1'; const getCapital = () => { const v = parseInt(localStorage.getItem(LS_CAPITAL)); return (!isNaN(v) && v > 0) ? v : 500000; }; const setCapital = v => localStorage.setItem(LS_CAPITAL, v); function capitalSave() {
  const inp = document.getElementById('capital-input'); if (!inp) return; const val = parseInt(inp.value); if (isNaN(val) || val < 10000) { inp.style.borderColor = 'var(--red)'; setTimeout(() => { inp.style.borderColor = 'var(--border)'; }, 1500); return; }
  setCapital(val); inp.style.borderColor = 'var(--teal)'; setTimeout(() => { inp.style.borderColor = 'var(--border)'; }, 1500); renderMarketSummary();
}
function capitalInputInit() { const inp = document.getElementById('capital-input'); if (inp) inp.value = getCapital(); }
const srtLoad = () => { try { const data = JSON.parse(lsGet(LS_SRT)) || []; const NAME_MIGRATION = { 'IT': 'Information Technology', 'FMCG': 'Fast Moving Consumer Goods', 'Bank': 'Banks', 'Auto': 'Automobile and Auto Components', 'Metal': 'Metals & Mining', 'Infra': 'Construction', 'Chemicals': 'Specialty Chemicals', 'Energy': 'Oil Gas & Consumable Fuels', 'Fin Services': 'NBFCs & Finance', 'India Mfg': 'Capital Goods', 'Cap Market': 'Capital Goods', 'Defence': 'Defense', }; let migrated = false; data.forEach(s => { if (NAME_MIGRATION[s.name]) { s.name = NAME_MIGRATION[s.name]; migrated = true; } }); if (migrated) lsSet(LS_SRT, JSON.stringify(data)); return data; } catch (e) { return []; } }; const srtSave = d => lsSet(LS_SRT, JSON.stringify(d)); function srtMA(history, n) { const closes = history.slice(-n).map(h => h.close); if (!closes.length) return null; return closes.reduce((a, b) => a + b, 0) / closes.length; }
function srtCalcStage(close, ma20, ma50) { if (!ma20 && !ma50) return 'S1'; const a20 = ma20 ? close > ma20 : true; const a50 = ma50 ? close > ma50 : true; if (a20 && a50) return 'S2'; if (!a20 && a50) return 'S3'; if (a20 && !a50) return 'S1'; return 'S4'; }
function srtRecompute(sector) { const h = sector.history; if (!h || !h.length) return; const last = h[h.length - 1]; sector.close = last.close; sector.date = last.date; sector.weeks = h.length; const ma20 = srtMA(h, 20); const ma50 = srtMA(h, 50); sector.ma20 = ma20; sector.ma50 = ma50; sector.stage = srtCalcStage(last.close, ma20, ma50); sector.vs20 = ma20 ? +(((last.close - ma20) / ma20) * 100).toFixed(2) : 0; if (h.length >= 2) { const cur = h[h.length - 1], prv = h[h.length - 2]; if (prv.niftyClose && cur.niftyClose) { const sChg = ((cur.close - prv.close) / prv.close) * 100; const nChg = ((cur.niftyClose - prv.niftyClose) / prv.niftyClose) * 100; sector.rs = +(sChg - nChg).toFixed(2); } else { sector.rs = null; } } else { sector.rs = null; } }
function srtUpsertSector(fullName, shortName, close, niftyClose, date) {
  const sectors = srtLoad(); let sector = sectors.find(s => s.id === fullName); if (!sector) { sector = { id: fullName, name: shortName, history: [] }; sectors.push(sector); }
  if (!sector.history) sector.history = []; const ei = sector.history.findIndex(h => h.date === date); const entry = { date, close, niftyClose: niftyClose || null }; if (ei >= 0) sector.history[ei] = entry; else sector.history.push(entry); sector.history = sector.history.sort((a, b) => a.date.localeCompare(b.date)).slice(-60); srtRecompute(sector); sector._updatedAt = Date.now(); srtSave(sectors);
}
const SRT_NAME_MAP = { 'it': 'NIFTY IT', 'pharma': 'NIFTY PHARMA', 'fmcg': 'NIFTY FMCG', 'bank': 'NIFTY BANK', 'auto': 'NIFTY AUTO', 'metal': 'NIFTY METAL', 'realty': 'NIFTY REALTY', 'infra': 'NIFTY INFRA', 'chemicals': 'NIFTY COMMODITIES', 'chem': 'NIFTY COMMODITIES', 'psu bank': 'NIFTY PSU BANK', 'psub': 'NIFTY PSU BANK', 'energy': 'NIFTY ENERGY', 'financial services': 'NIFTY FINANCIAL SERVICES', 'fin services': 'NIFTY FINANCIAL SERVICES', 'finserv': 'NIFTY FINANCIAL SERVICES', 'india manufacturing': 'NIFTY INDIA MANUFACTURING', 'manufacturing': 'NIFTY INDIA MANUFACTURING', 'capital market': 'NIFTY CAPITAL MARKETS', 'cap market': 'NIFTY CAPITAL MARKETS', 'defence': 'NIFTY INDIA DEFENCE', 'defense': 'NIFTY INDIA DEFENCE', 'pse': 'NIFTY CPSE', 'cpse': 'NIFTY CPSE' }; const SRT_SHORT_MAP = { 'NIFTY IT': 'Information Technology', 'NIFTY PHARMA': 'Pharma', 'NIFTY FMCG': 'Fast Moving Consumer Goods', 'NIFTY BANK': 'Banks', 'NIFTY AUTO': 'Automobile and Auto Components', 'NIFTY METAL': 'Metals & Mining', 'NIFTY REALTY': 'Realty', 'NIFTY INFRA': 'Construction', 'NIFTY COMMODITIES': 'Specialty Chemicals', 'NIFTY PSU BANK': 'PSU Bank', 'NIFTY ENERGY': 'Oil Gas & Consumable Fuels', 'NIFTY FINANCIAL SERVICES': 'NBFCs & Finance', 'NIFTY INDIA MANUFACTURING': 'Capital Goods', 'NIFTY CAPITAL MARKETS': 'Capital Goods', 'NIFTY INDIA DEFENCE': 'Defense', 'NIFTY CPSE': 'PSE' }; const SRT_LINKS = { 'NIFTY IT': 'https://www.nseindia.com/index-tracker/NIFTY%20IT', 'NIFTY PHARMA': 'https://www.nseindia.com/index-tracker/NIFTY%20PHARMA', 'NIFTY FMCG': 'https://www.nseindia.com/index-tracker/NIFTY%20FMCG', 'NIFTY BANK': 'https://www.nseindia.com/index-tracker/NIFTY%20BANK', 'NIFTY AUTO': 'https://www.nseindia.com/index-tracker/NIFTY%20AUTO', 'NIFTY METAL': 'https://www.nseindia.com/index-tracker/NIFTY%20METAL', 'NIFTY REALTY': 'https://www.nseindia.com/index-tracker/NIFTY%20REALTY', 'NIFTY INFRA': 'https://www.nseindia.com/index-tracker/NIFTY%20INFRA', 'NIFTY COMMODITIES': 'https://www.nseindia.com/index-tracker/NIFTY%20CHEMICALS', 'NIFTY PSU BANK': 'https://www.nseindia.com/index-tracker/NIFTY%20PSU%20BANK', 'NIFTY ENERGY': 'https://www.nseindia.com/index-tracker/NIFTY%20ENERGY', 'NIFTY FINANCIAL SERVICES': 'https://www.nseindia.com/index-tracker/NIFTY%20FIN%20SERVICE', 'NIFTY INDIA MANUFACTURING': 'https://www.nseindia.com/index-tracker/NIFTY%20INDIA%20MFG', 'NIFTY CAPITAL MARKETS': 'https://www.nseindia.com/index-tracker/NIFTY%20CAPITAL%20MKT', 'NIFTY INDIA DEFENCE': 'https://www.nseindia.com/index-tracker/NIFTY%20IND%20DEFENCE', 'NIFTY CPSE': 'https://www.nseindia.com/index-tracker/NIFTY%20PSE' }; function srtGetSessionNifty() { try { return JSON.parse(localStorage.getItem('nse_srt_nifty')) || null; } catch (e) { return null; } }
function srtSetSessionNifty(close, date) { localStorage.setItem('nse_srt_nifty', JSON.stringify({ close, date })); }
function srtSetNifty() {
  const val = parseFloat(document.getElementById('srt-nifty').value); const statusEl = document.getElementById('srt-nifty-status'); if (isNaN(val) || val <= 0) { if (statusEl) { statusEl.style.color = 'var(--red)'; statusEl.textContent = 'Enter a valid Nifty 50 close price.'; } return; }
  const date = new Date().toISOString().slice(0, 10); srtSetSessionNifty(val, date); if (statusEl) { statusEl.style.color = 'var(--lime)'; statusEl.textContent = 'Set: ' + val + ' on ' + date + ' — applies to all sectors this session.'; }
}
function srtNiftyStatusRefresh() { const n = srtGetSessionNifty(); const statusEl = document.getElementById('srt-nifty-status'); const inp = document.getElementById('srt-nifty'); if (!statusEl) return; if (n) { statusEl.style.color = 'var(--lime)'; statusEl.textContent = 'Set: ' + n.close + ' on ' + n.date; if (inp && !inp.value) inp.value = n.close; } else { statusEl.style.color = 'var(--dim)'; statusEl.textContent = 'Not set for this week — enter above first.'; } }
function srtSaveEntry() {
  const selVal = document.getElementById('srt-sel').value; const close = parseFloat(document.getElementById('srt-close').value); const msg = document.getElementById('srt-msg'); if (!selVal || isNaN(close)) { msg.style.display = 'block'; msg.style.color = 'var(--red)'; msg.textContent = 'Select a sector and enter its closing price.'; return; }
  const nSession = srtGetSessionNifty(); const nifty = nSession ? nSession.close : 0; const [fullName, shortName] = selVal.split('|'); const date = new Date().toISOString().slice(0, 10); srtUpsertSector(fullName, shortName, close, nifty, date); pushToCloud(); srtRender(); document.getElementById('srt-close').value = ''; const weeks = (srtLoad().find(s => s.id === fullName) || {}).weeks || 1; const progress = weeks < 20 ? ' (' + weeks + '/20 wks)' : ' (full MA)'; msg.style.display = 'block'; msg.style.color = 'var(--lime)'; msg.textContent = shortName + ' saved' + progress + (nifty ? '' : ' — set Nifty 50 for RS calc'); setTimeout(() => { msg.style.display = 'none'; }, 3000);
}
const SRT_BULK_ORDER = ['NIFTY IT', 'NIFTY PHARMA', 'NIFTY FMCG', 'NIFTY BANK', 'NIFTY AUTO', 'NIFTY METAL', 'NIFTY REALTY', 'NIFTY INFRA', 'NIFTY COMMODITIES', 'NIFTY PSU BANK', 'NIFTY ENERGY', 'NIFTY FINANCIAL SERVICES', 'NIFTY INDIA MANUFACTURING', 'NIFTY CAPITAL MARKETS', 'NIFTY INDIA DEFENCE', 'NIFTY CPSE']; const SRT_BULK_NAMES = ['Information Technology', 'Pharma', 'Fast Moving Consumer Goods', 'Banks', 'Automobile and Auto Components', 'Metals & Mining', 'Realty', 'Construction', 'Specialty Chemicals', 'PSU Bank', 'Oil Gas & Consumable Fuels', 'NBFCs & Finance', 'Capital Goods', 'Capital Goods', 'Defense', 'PSE']; const SRT_SHORT = { 'Information Technology': 'IT', 'Pharma': 'Pharma', 'Fast Moving Consumer Goods': 'FMCG', 'Banks': 'Banks', 'Automobile and Auto Components': 'Auto', 'Metals & Mining': 'Metals', 'Realty': 'Realty', 'Construction': 'Infra', 'Construction Materials': 'Const Mat', 'Specialty Chemicals': 'Chemicals', 'PSU Bank': 'PSU Bank', 'Oil Gas & Consumable Fuels': 'Energy', 'NBFCs & Finance': 'NBFCs', 'Capital Goods': 'Cap Goods', 'Defense': 'Defense', 'PSE': 'PSE', 'Hospitals & Healthcare': 'Healthcare', 'Railways': 'Railways', 'Agrochemicals & Fertilizers': 'Agrochem', 'Consumer Services': 'Cons Svc', 'Consumer Durables': 'Cons Dur', 'Telecommunication': 'Telecom', 'Services': 'Services', 'Power': 'Power', 'Media Entertainment & Publication': 'Media', 'Diversified': 'Diversified', 'Textiles': 'Textiles', 'Market (Index)': 'Market', }; function srtBulkImport() {
  const txt = (document.getElementById('srt-bulk-txt').value || '').trim(); const msg = document.getElementById('srt-bulk-msg'); if (!txt) { msg.style.display = 'block'; msg.style.color = 'var(--red)'; msg.textContent = 'Nothing to import.'; return; }
  let rowsOk = 0, errors = []; txt.split('\n').forEach((line, i) => {
    line = line.trim(); if (!line || line.startsWith('#') || line.startsWith('DATE')) return; const p = line.split(',').map(s => s.trim()); if (p.length < 15) { errors.push('Row ' + (i + 1) + ': need 15 columns (date + Nifty50 + 13 sectors)'); return; }
    const date = p[0]; const nifty = parseFloat(p[1]); if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) { errors.push('Row ' + (i + 1) + ': date must be YYYY-MM-DD'); return; }
    if (isNaN(nifty)) { errors.push('Row ' + (i + 1) + ': invalid Nifty50 close'); return; }
    let rowOk = true; SRT_BULK_ORDER.forEach((fullId, j) => {
      const close = parseFloat(p[j + 2]); if (isNaN(close)) { errors.push('Row ' + (i + 1) + ' ' + SRT_BULK_NAMES[j] + ': invalid'); rowOk = false; return; }
      srtUpsertSector(fullId, SRT_BULK_NAMES[j], close, nifty, date);
    }); if (rowOk) rowsOk++;
  }); pushToCloud(); srtRender(); msg.style.display = 'block'; if (rowsOk) { msg.style.color = 'var(--lime)'; msg.textContent = rowsOk + ' week(s) imported across all sectors.' + (errors.length ? ' ' + errors.length + ' error(s): ' + errors.slice(0, 3).join('; ') : ''); } else { msg.style.color = 'var(--red)'; msg.textContent = 'Nothing saved. ' + errors.slice(0, 3).join('; '); }
}
function srtClearForm() { const el = document.getElementById('srt-close'); if (el) el.value = ''; }
function srtDelete(id) { if (!confirm('Remove ' + id + ' from tracker?')) return; srtSave(srtLoad().filter(s => s.id !== id)); pushToCloud(); srtRender(); }
function srtEditLoad(id) { const s = srtLoad().find(x => x.id === id); if (!s) return; document.getElementById('srt-sel').value = s.id + '|' + s.name; document.getElementById('srt-close').value = s.close || ''; const nEl = document.getElementById('srt-nifty'); if (nEl && s.history && s.history.length) nEl.value = s.history[s.history.length - 1].niftyClose || ''; }
function srtStageMeta(stage) { if (stage === 'S2') return { label: 'Stage 2', color: 'var(--lime)', bg: 'rgba(74,222,128,.15)', score: 4 }; if (stage === 'S1') return { label: 'Stage 1', color: 'var(--accent)', bg: 'rgba(91,163,245,.12)', score: 3 }; if (stage === 'S3') return { label: 'Stage 3', color: 'var(--yellow)', bg: 'rgba(251,191,36,.12)', score: 2 }; return { label: 'Stage 4', color: 'var(--red)', bg: 'rgba(239,68,68,.12)', score: 1 }; }
function srtMaDot(close, ma) { const pct = ((close - ma) / ma) * 100; if (pct > 1) return '<span style="color:var(--lime);font-size:10px">●</span>'; if (pct >= -1) return '<span style="color:var(--yellow);font-size:10px">◐</span>'; return '<span style="color:var(--red);font-size:10px">○</span>'; }
function srtBuildRow(s, i, opts) {
  const m = srtStageMeta(s.stage); const isMinervini = srtCheckMinerviniTrend(s); const isBlueSky = srtIsBlueSkyRS(s); const starHtml = isBlueSky ? '<span style="color:var(--yellow);font-size:11px;margin-left:4px" title="Blue Sky RS: Weekly relative strength vs Nifty 50 at 52-week high">🌟</span>' : ''; const stageLabel = isMinervini ? m.label + ' ⚡' : m.label; const stageTitle = isMinervini ? 'title="Minervini Stage 2 Trend Template Verified"' : ''; const vs20Str = s.vs20 > 0 ? '<span style="color:var(--lime)">+' + s.vs20.toFixed(1) + '%</span>' : '<span style="color:var(--red)">' + s.vs20.toFixed(1) + '%</span>'; const rsStr = s.rs != null ? (s.rs > 0 ? '<span style="color:var(--lime)">+' + s.rs.toFixed(1) + '</span>' : s.rs < 0 ? '<span style="color:var(--red)">' + s.rs.toFixed(1) + '</span>' : '<span style="color:var(--dim)">0.0</span>') : '<span style="color:var(--dim)">—</span>'; const maDots = s.ma20 ? srtMaDot(s.close, s.ma20) : '<span style="color:var(--dim)">·</span>'; const maDots50 = s.ma50 ? srtMaDot(s.close, s.ma50) : '<span style="color:var(--dim)">·</span>'; const weeksStr = s.weeks ? s.weeks : '—'; const trendlyneUrl = SRT_LINKS[s.id] || ''; const deleteBtn = opts.deletable ? `<div style="display:flex;flex-direction:column;gap:2px;align-items:center">
        <button onclick="event.stopPropagation();srtEditLoad('${s.id}')" style="background:transparent;border:none;color:var(--dim);cursor:pointer;font-size:10px;padding:1px 4px" title="Edit">✎</button>
        <button onclick="event.stopPropagation();srtDelete('${s.id}')" style="background:transparent;border:none;color:var(--dim);cursor:pointer;font-size:10px;padding:1px 4px" title="Remove">✕</button>
      </div>`: ''; const rowClick = opts.clickable ? `onclick="srtEditLoad('${s.id}')"` : (trendlyneUrl ? `onclick="window.open('${trendlyneUrl}','_blank')"` : ''); const nameArrow = (!opts.clickable && trendlyneUrl) ? `<span style="font-size:9px;color:var(--dim);opacity:.5;margin-left:3px">↗</span>` : ''; return `<tr style="border-bottom:1px solid var(--border);cursor:pointer" ${rowClick}>
    <td style="padding:6px 4px;color:var(--dim);font-size:10px;font-family:var(--mono)">${i + 1}</td>
    <td style="padding:6px 4px">
      <div style="display:flex;align-items:center">
        <div>
          <div style="font-weight:700;font-size:13px;font-family:var(--disp);letter-spacing:.3px">${s.name}${starHtml}${nameArrow}</div>
          <div style="font-size:9px;color:var(--dim);font-family:var(--mono)">${s.date || ''}</div>
        </div>
      </div>
    </td>
    <td style="padding:6px 4px;text-align:right;font-family:var(--mono);font-size:11px">${vs20Str}</td>
    <td style="padding:6px 4px;text-align:center;font-size:12px">${maDots}${maDots50}</td>
    <td style="padding:6px 4px;text-align:center">
      <span style="background:${m.bg};color:${m.color};padding:2px 6px;border-radius:3px;font-size:9px;font-weight:700;font-family:var(--mono);letter-spacing:.3px" ${stageTitle}>${stageLabel}</span>
    </td>
    <td style="padding:6px 4px;text-align:right;font-family:var(--mono);font-size:11px">${rsStr}</td>
    <td style="padding:6px 4px;text-align:right;color:var(--dim);font-size:10px;font-family:var(--mono)">${weeksStr}</td>
    ${opts.deletable ? `<td style="padding:6px 2px;text-align:right">${deleteBtn}</td>` : ''}
  </tr>`;
}
let _rrgTailWeeks = 8; let _rrgFilter = 'all'; let _rrgTopN = 8; const RRG_COLORS = ['#4ade80', '#5ba3f5', '#fbbf24', '#f87171', '#a78bfa', '#2dd4bf', '#fb923c', '#e879f9', '#34d399', '#60a5fa', '#f472b6', '#facc15', '#94a3b8']; let _slhWeeks = 8; function slhSetWeeks(n) { _slhWeeks = n;[8, 12, 20].forEach(w => { const b = document.getElementById('slh-w-' + w); if (!b) return; const active = w === n; b.style.background = active ? 'var(--teal)' : 'transparent'; b.style.color = active ? '#0e1420' : 'var(--dim)'; b.style.borderColor = active ? 'var(--teal)' : 'var(--border)'; b.style.fontWeight = active ? '600' : '400'; }); slhRender(); }
function slhGetHistorySeries(viewMode) { const cached = vcpbGetCached(); const fileHistory = cached?.history; if (fileHistory && Array.isArray(fileHistory) && fileHistory.length > 0) { const seriesMap = {}; fileHistory.forEach(run => { const date = run.date; const dataGroup = viewMode === 'industry' ? run.industries : run.sectors; if (!dataGroup) return; Object.keys(dataGroup).forEach(name => { if (!seriesMap[name]) seriesMap[name] = []; const entry = dataGroup[name]; const a20 = entry.a20_pct ?? entry.a20 ?? 0; const a50 = entry.a50_pct ?? entry.a50 ?? 0; const a200 = entry.a200_pct ?? entry.a200 ?? 0; const score = Math.round(a20 * 0.50 + a50 * 0.30 + a200 * 0.20); seriesMap[name].push({ date: date, score: score, vcp_count: entry.vcp_count ?? 0, universe: entry.universe ?? 0, a20: a20, a50: a50, a200: a200 }); }); }); return seriesMap; } else { const localHist = vcpbGetHist(); const seriesMap = {}; const activeNames = new Set(vcpbGetActiveNames()); Object.keys(localHist).forEach(name => { if (activeNames.has(name)) { seriesMap[name] = (localHist[name] || []).map(r => ({ date: r.date, score: r.score, vcp_count: 0, universe: 0, a20: r.a20, a50: r.a50, a200: r.a200 })); } }); return seriesMap; } }
function slhRender() {
  const grid = document.getElementById('slh-grid'); if (!grid) return; const viewMode = _vcpbViewMode || 'sector'; const metricSelect = document.getElementById('slh-metric-select'); const metric = metricSelect ? metricSelect.value : 'score'; const seriesMap = slhGetHistorySeries(viewMode); const activeNames = Object.keys(seriesMap); if (!activeNames.length) { grid.innerHTML = '<div style="color:var(--dim);padding:20px;text-align:center;font-size:11px">No breadth history yet — run the VCP scanner to generate history data.</div>'; return; }
  const allDates = [...new Set(activeNames.flatMap(name => seriesMap[name].map(r => r.date)))].sort(); const showDates = allDates.slice(-_slhWeeks); if (!showDates.length) { grid.innerHTML = '<div style="color:var(--dim);padding:20px;text-align:center;font-size:11px">No runs found in history.</div>'; return; }
  const fmtDate = iso => { const d = new Date(iso + 'T00:00:00'); return d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }); }; const getMetricValue = (entry, metric) => { if (!entry) return null; if (metric === 'score') return entry.score; if (metric === 'vcp') return entry.vcp_count; if (metric === 'a50') return entry.a50; if (metric === 'a20') return entry.a20; if (metric === 'a200') return entry.a200; return null; }; const getAverageMetric = (name) => { const list = seriesMap[name] || []; const vals = showDates.map(dt => { const entry = list.find(r => r.date === dt); return getMetricValue(entry, metric); }).filter(v => v !== null); return vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : -999; }; activeNames.sort((a, b) => getAverageMetric(b) - getAverageMetric(a)); const isMax = document.getElementById('srt-home-card')?.classList.contains('maximized'); const CELL_W = isMax ? 72 : 46; const CELL_H = isMax ? 36 : 26; const LABEL_W = isMax ? 180 : 94; const FONT_DATE = isMax ? '11px' : '8px'; const FONT_SNAME = isMax ? '13px' : '10px'; const FONT_CELL = isMax ? '11px' : '8.5px'; const FONT_AVG = isMax ? '12px' : '9px'; const totalW = LABEL_W + (showDates.length + 1) * CELL_W + 10; const descEl = document.getElementById('slh-description'); if (descEl) { if (metric === 'vcp') { descEl.innerHTML = `Each cell = VCP candidate count. <b style="color:var(--lime)">Green ≥3</b> · <b style="color:var(--yellow)">Yellow 1-2</b> · <b style="color:var(--red)">Red 0</b>. Click row to drill down.`; } else { const labelMap = { score: 'composite breadth score', a50: 'Stage 2 % (>50 SMA)', a20: 'Momentum % (>20 EMA)', a200: 'Structure % (>200 SMA)' }; descEl.innerHTML = `Each cell = ${labelMap[metric] || 'breadth'}. <b style="color:var(--lime)">Green ≥60%</b> · <b style="color:var(--yellow)">Yellow 40-59%</b> · <b style="color:var(--red)">Red &lt;40%</b>. Click row to drill down.`; } }
  let html = `<div style="display:inline-block;min-width:${totalW}px;font-family:var(--mono)">`; html += `<div style="display:flex;align-items:center;border-bottom:1px solid var(--border);padding-bottom:4px;margin-bottom:2px">`; html += `<div style="width:${LABEL_W}px;font-size:9px;color:var(--dim);font-weight:600;text-transform:uppercase;letter-spacing:.4px;padding-left:4px">${viewMode === 'industry' ? 'Industry Group' : 'Sector Theme'}</div>`; showDates.forEach(dt => { html += `<div style="width:${CELL_W}px;text-align:center;font-size:${FONT_DATE};color:var(--dim);white-space:nowrap;overflow:hidden">${fmtDate(dt)}</div>`; }); html += `<div style="width:${CELL_W}px;text-align:center;font-size:${FONT_DATE};color:var(--sub);font-weight:600">Avg</div>`; html += `</div>`; const getCellColor = (val, metric) => { if (val === null || val === undefined) return { bg: 'rgba(72,85,102,.2)', text: 'var(--dim)', label: '—' }; if (metric === 'vcp') { if (val >= 3) { return { bg: 'rgba(74,222,128,.55)', text: '#0e1420', label: Math.round(val) }; } else if (val >= 1) { return { bg: 'rgba(251,191,36,.35)', text: 'var(--yellow)', label: Math.round(val) }; } else { return { bg: 'rgba(248,113,113,.12)', text: 'var(--dim)', label: '0' }; } } else { if (val >= 60) { const opacity = (0.2 + (val - 60) / 40 * 0.65).toFixed(2); return { bg: `rgba(74,222,128,${opacity})`, text: val >= 75 ? '#0e1420' : 'var(--lime)', label: Math.round(val) + '%' }; } else if (val >= 40) { return { bg: 'rgba(251,191,36,.28)', text: 'var(--yellow)', label: Math.round(val) + '%' }; } else { const opacity = (0.15 + (40 - val) / 40 * 0.45).toFixed(2); return { bg: `rgba(248,113,113,${opacity})`, text: 'var(--red)', label: Math.round(val) + '%' }; } } }; activeNames.forEach(name => {
    const list = seriesMap[name] || []; const vals = showDates.map(dt => { const entry = list.find(r => r.date === dt); return getMetricValue(entry, metric); }); const nonNull = vals.filter(v => v !== null); const avg = nonNull.length ? nonNull.reduce((s, v) => s + v, 0) / nonNull.length : null; const avgStyle = getCellColor(avg, metric); const displayName = SRT_SHORT[name] || name.replace(' IN', ''); const escapedName = name.replace(/'/g, "\\'"); html += `<div style="display:flex;align-items:center;margin-bottom:2px">`; html += `<div onclick="sectorDrillOpen('${escapedName}')" title="Click to view constituent VCP stocks in ${name}"
      style="width:${LABEL_W}px;font-size:${FONT_SNAME};font-weight:600;color:var(--text);text-decoration:underline;text-decoration-style:dashed;text-decoration-color:rgba(255,255,255,.2);text-underline-offset:2px;cursor:pointer;
             white-space:nowrap;overflow:hidden;text-overflow:ellipsis;padding:0 4px;
             display:block;line-height:${CELL_H}px"
      onmouseover="this.style.color='var(--teal)'" onmouseout="this.style.color='var(--text)'"
    >${displayName}</div>`; vals.forEach(val => {
      const c = getCellColor(val, metric); html += `<div style="width:${CELL_W}px;height:${CELL_H}px;background:${c.bg};
                color:${c.text};font-size:${FONT_CELL};font-weight:600;text-align:center;
                line-height:${CELL_H}px;border-radius:2px;margin:0 1px;
                transition:opacity .15s" title="${val !== null ? val.toFixed(1) + (metric === 'vcp' ? ' candidates' : '%') : 'No data'}">${c.label}</div>`;
    }); html += `<div style="width:${CELL_W}px;height:${CELL_H}px;background:${avgStyle.bg};
              color:${avgStyle.text};font-size:${FONT_AVG};font-weight:700;text-align:center;
              line-height:${CELL_H}px;border-radius:2px;border:1px solid rgba(255,255,255,.08)">${avgStyle.label}</div>`; html += `</div>`;
  }); html += `<div style="margin-top:8px;display:flex;gap:8px;align-items:center;flex-wrap:wrap;font-size:9px;color:var(--dim)">`; if (metric === 'vcp') { html += `<span style="display:flex;align-items:center;gap:3px"><span style="width:14px;height:10px;background:rgba(248,113,113,.12);border-radius:2px;display:inline-block"></span>0 (Weak)</span>`; html += `<span style="display:flex;align-items:center;gap:3px"><span style="width:14px;height:10px;background:rgba(251,191,36,.35);border-radius:2px;display:inline-block"></span>1-2 (Neutral)</span>`; html += `<span style="display:flex;align-items:center;gap:3px"><span style="width:14px;height:10px;background:rgba(74,222,128,.55);border-radius:2px;display:inline-block"></span>≥3 (Strong)</span>`; } else { html += `<span style="display:flex;align-items:center;gap:3px"><span style="width:14px;height:10px;background:rgba(248,113,113,.25);border-radius:2px;display:inline-block"></span>&lt;40% (Weak)</span>`; html += `<span style="display:flex;align-items:center;gap:3px"><span style="width:14px;height:10px;background:rgba(251,191,36,.28);border-radius:2px;display:inline-block"></span>40-59% (Neutral)</span>`; html += `<span style="display:flex;align-items:center;gap:3px"><span style="width:14px;height:10px;background:rgba(74,222,128,.55);border-radius:2px;display:inline-block"></span>≥60% (Strong)</span>`; }
  html += `<span style="margin-left:auto">Numbers = cell values (left-to-right is chronological)</span>`; html += `</div>`; html += `</div>`; grid.innerHTML = html;
}
function sccTab(tab) {
  const colors = { breadth: 'var(--teal)', rrg: 'var(--purple)', heatmap: 'var(--teal)', chart: 'var(--teal)', clusters: 'var(--teal)' };['breadth', 'rrg', 'heatmap', 'chart', 'clusters'].forEach(t => {
    const btn = document.getElementById('scc-tab-' + t); const pane = document.getElementById('scc-pane-' + t); const active = t === tab; if (btn) { btn.style.color = active ? colors[tab] : 'var(--dim)'; btn.style.borderBottom = active ? `2px solid ${colors[tab]}` : '2px solid transparent'; btn.style.fontWeight = active ? '700' : '600'; }
    if (pane) pane.style.display = active ? 'block' : 'none';
  }); const dGrid = document.querySelector('.dash-grid'); if (dGrid) { if (tab === 'chart') { dGrid.classList.add('wide-command'); } else { dGrid.classList.remove('wide-command'); } }
  if (tab === 'rrg') { setTimeout(() => { brrgRebuildChips(); brrgDraw(); }, 50); }
  if (tab === 'heatmap') setTimeout(() => slhRender(), 50);
  if (tab === 'clusters') setTimeout(() => sccRenderClusters(), 50);
  if (tab === 'chart') {
    if (window.innerWidth <= 600 && _sccChartLayout !== '1') { _sccChartLayout = '1'; const layoutSelect = document.getElementById('scc-chart-layout-select'); if (layoutSelect) layoutSelect.value = '1'; }
    setTimeout(() => sccChartRebuildGrid(), 50);
  }
}
function toggleMaximizeSectorCommand() {
  const card = document.getElementById('srt-home-card'); const btn = document.getElementById('srt-max-btn'); if (!card) return; const isMax = card.classList.toggle('maximized'); if (btn) { if (isMax) { btn.innerHTML = '<span style="font-size:12px;line-height:1;">🗗</span>'; btn.title = 'Restore Window'; } else { btn.innerHTML = '<span style="font-size:12px;line-height:1;">⛶</span>'; btn.title = 'Maximize Window'; } }
  if (isMax) { document.body.style.overflow = 'hidden'; } else { document.body.style.overflow = ''; }
  const isRrgActive = document.getElementById('scc-pane-rrg').style.display !== 'none'; const isHeatmapActive = document.getElementById('scc-pane-heatmap').style.display !== 'none'; const isChartActive = document.getElementById('scc-pane-chart') && document.getElementById('scc-pane-chart').style.display !== 'none'; const isClustersActive = document.getElementById('scc-pane-clusters') && document.getElementById('scc-pane-clusters').style.display !== 'none'; if (isRrgActive) { setTimeout(() => { if (typeof brrgDraw === 'function') brrgDraw(); }, 80); } else if (isHeatmapActive) { setTimeout(() => { if (typeof slhRender === 'function') slhRender(); }, 80); } else if (isChartActive) { setTimeout(() => { const count = parseInt(_sccChartLayout); for (let i = 0; i < count; i++) { sccChartRenderPanel(i); } }, 80); } else if (isClustersActive) { setTimeout(() => { if (typeof sccRenderClusters === 'function') sccRenderClusters(); }, 80); } else { setTimeout(() => { if (typeof brrgDraw === 'function') brrgDraw(); }, 80); }
}
function sccChartZoom(index, direction) {
  sccChartSetActivePanel(index); if (typeof _sccLwCharts !== 'undefined' && _sccLwCharts[index]) { try { const ts = _sccLwCharts[index].timeScale(); const range = ts.getVisibleLogicalRange(); if (range) { const span = range.to - range.from; const shift = span * (direction > 0 ? -0.2 : 0.25); ts.setVisibleLogicalRange({ from: range.from - shift / 2, to: range.to + shift / 2 }); return; } } catch (e) { } } let zoomFactor = _sccChartZoomFactors[index] || 1.0; if (direction > 0) { zoomFactor *= 0.85; } else { zoomFactor *= 1.15; }
  zoomFactor = Math.max(0.15, Math.min(5.0, zoomFactor)); _sccChartZoomFactors[index] = zoomFactor; localStorage.setItem('_sccChartZoomFactors', JSON.stringify(_sccChartZoomFactors)); sccChartRenderPanel(index);
}
function sccChartZoomReset(index) { sccChartSetActivePanel(index); if (typeof _sccLwCharts !== 'undefined' && _sccLwCharts[index]) { try { _sccLwCharts[index].timeScale().fitContent(); return; } catch (e) { } } _sccChartZoomFactors[index] = 1.0; localStorage.setItem('_sccChartZoomFactors', JSON.stringify(_sccChartZoomFactors)); sccChartRenderPanel(index); }
function sccChartGetCount() {
  if (_sccChartLayout === 'watchlist') {
    return _sccWatchlistSymbols.length;
  }
  return parseInt(_sccChartLayout) || 1;
}
function sccChartGetSymbol(index) {
  if (_sccChartLayout === 'watchlist') {
    return _sccWatchlistSymbols[index] || '';
  }
  return _sccChartSymbols[index] || '';
}
function sccChartSetSymbol(index, symbol) {
  if (_sccChartLayout === 'watchlist') {
    if (index >= 0 && index < _sccWatchlistSymbols.length) {
      _sccWatchlistSymbols[index] = symbol;
      sccSaveWatchlistsLocalAndSync();
      sccWatchlistRender();
    }
  } else {
    _sccChartSymbols[index] = symbol;
    localStorage.setItem('_sccChartSymbols', JSON.stringify(_sccChartSymbols));
  }
}

let _sccActivePanelIndex = 0;
function sccChartRebuildGrid() {
  updateWinPillStyles();
  const grid = document.getElementById('scc-chart-grid'); if (!grid) return; sccApplyWatchlistVisibility(); sccWlRenderTabs(); sccWatchlistRender(); const layoutSelect = document.getElementById('scc-chart-layout-select'); if (layoutSelect && layoutSelect.value !== _sccChartLayout) { layoutSelect.value = _sccChartLayout; }
  const typeSelect = document.getElementById('scc-chart-type-select'); if (typeSelect && typeSelect.value !== _sccChartType) { typeSelect.value = _sccChartType; }

  const syncCbLabel = document.getElementById('scc-chart-sync-symbols')?.closest('label');
  if (syncCbLabel) {
    syncCbLabel.style.display = _sccChartLayout === 'watchlist' ? 'none' : 'flex';
  }
  const syncCb = document.getElementById('scc-chart-sync-symbols'); if (syncCb && syncCb.checked !== _sccSyncSymbols) { syncCb.checked = _sccSyncSymbols; }
  const globalWrap = document.getElementById('scc-chart-global-sym-wrap'); if (globalWrap) { globalWrap.style.display = (_sccSyncSymbols && _sccChartLayout !== 'watchlist') ? 'flex' : 'none'; }
  if (_sccSyncSymbols && _sccChartLayout !== 'watchlist') { const globalInput = document.getElementById('scc-chart-global-symbol'); if (globalInput && globalInput.value !== sccChartGetSymbol(0)) { globalInput.value = sccChartGetSymbol(0) || ''; } }

  const count = sccChartGetCount();
  if (_sccChartLayout === 'watchlist' && count === 0) {
    grid.className = 'scc-chart-grid-1';
    grid.style.gridTemplateColumns = '1fr';
    grid.innerHTML = `
          <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:300px; color:var(--dim); font-size:13px; gap:8px;">
            <span>No symbols in the current watchlist.</span>
            <span style="font-size:11px;">Add stocks on the right sidebar or select a different layout.</span>
          </div>
        `;
    return;
  }

  if (_sccChartLayout === 'watchlist') {
    grid.className = 'scc-chart-grid-wl';
    if (count === 1) {
      grid.style.gridTemplateColumns = '1fr';
    } else {
      grid.style.gridTemplateColumns = 'repeat(2, 1fr)';
    }
  } else if (count === 4) { grid.className = 'scc-chart-grid-4'; grid.style.gridTemplateColumns = 'repeat(2, 1fr)'; } else if (count === 2) { grid.className = 'scc-chart-grid-2'; grid.style.gridTemplateColumns = 'repeat(2, 1fr)'; } else { grid.className = 'scc-chart-grid-1'; grid.style.gridTemplateColumns = '1fr'; }
  if (typeof _sccLwCharts !== 'undefined') { Object.keys(_sccLwCharts).forEach(k => { try { _sccLwCharts[k].remove(); } catch(e){} }); _sccLwCharts = {}; } if (typeof _sccLwObservers !== 'undefined') { Object.keys(_sccLwObservers).forEach(k => { try { _sccLwObservers[k].disconnect(); } catch(e){} }); _sccLwObservers = {}; }
  let html = ''; for (let i = 0; i < count; i++) {
    const symbol = sccChartGetSymbol(i); const timeframe = _sccChartTimeframes[i] || 'D'; const tvUrl = `https://www.tradingview.com/chart/?symbol=NSE%3A${encodeURIComponent(symbol)}`; const isActive = i === _sccActivePanelIndex; const borderStyle = isActive ? 'border: 1px solid var(--accent);' : 'border: 1px solid var(--border);'; const shadowStyle = isActive ? 'box-shadow: 0 0 10px rgba(91, 163, 245, 0.25);' : 'box-shadow: none;'; html += `
      <div class="sd-chart-card" id="scc-chart-card-${i}" onclick="sccChartSetActivePanel(${i})" style="cursor: pointer; ${borderStyle} ${shadowStyle}">
        <div class="sd-chart-header" style="padding: 4px 8px; gap: 4px;">
          
          <div style="position:relative; width: 85px;">
            <input type="text" id="scc-chart-input-${i}" value="${symbol}" placeholder="Symbol..." 
                   oninput="sccChartInputHandler(${i}, this.value)"
                   onkeyup="if(event.key==='Enter') { sccChartSubmitSymbol(${i}, this.value); }"
                   onfocus="this.style.borderColor='var(--teal)';"
                   onblur="setTimeout(()=> { const el=document.getElementById('scc-chart-suggest-${i}'); if(el)el.style.display='none'; }, 200);"
                   style="width: 100%; background: var(--bg4); border: 1px solid var(--border); color: var(--text); font-family: var(--body); font-size: 11px; padding: 3px 5px; outline: none; border-radius: 3px; height: 22px; box-sizing: border-box; text-transform: uppercase;">
            <div id="scc-chart-suggest-${i}" class="max-suggest-box" style="width: 160px; left: 0; top: 100%;"></div>
          </div>

          <div id="scc-chart-title-${i}" style="display:flex; align-items:center; overflow:hidden; flex: 1; min-width: 0; padding-left: 2px;">
            <span style="font-family:var(--disp);font-size:11px;font-weight:800;color:var(--teal)">${symbol}</span>
          </div>

          <div id="scc-chart-stats-${i}" style="font-size: 10px; display:flex; align-items:center; white-space:nowrap; gap: 4px;"></div>

          <select onchange="sccChartSetTimeframe(${i}, this.value)" style="background:var(--bg4);border:1px solid var(--border);color:var(--text);font-size:10px;font-weight:600;padding:2px 4px;border-radius:3px;outline:none;height:22px;cursor:pointer;">
            <option value="1H" ${timeframe === '1H' ? 'selected' : ''}>1H</option>
            <option value="D" ${timeframe === 'D' ? 'selected' : ''}>D</option>
            <option value="W" ${timeframe === 'W' ? 'selected' : ''}>W</option>
            <option value="M" ${timeframe === 'M' ? 'selected' : ''}>M</option>
          </select>

          <div style="display:flex; align-items:center; gap:3px;">
            
            <button class="sd-chart-max-btn" onclick="sccChartZoom(${i}, 1); event.stopPropagation();" title="Zoom In"
                    style="height:22px; width:22px; font-weight:bold; border:1px solid var(--border);">
              +
            </button>
            <button class="sd-chart-max-btn" onclick="sccChartZoom(${i}, -1); event.stopPropagation();" title="Zoom Out"
                    style="height:22px; width:22px; font-weight:bold; border:1px solid var(--border);">
              -
            </button>
            <button class="sd-chart-max-btn" onclick="sccChartZoomReset(${i}); event.stopPropagation();" title="Reset Zoom"
                    style="height:22px; width:22px; border:1px solid var(--border);">
              ↺
            </button>
            <a href="javascript:void(0)" onclick="if('${symbol}')window.open('https://www.tradingview.com/chart/?symbol=NSE%3A'+encodeURIComponent('${symbol}'),'_blank');event.stopPropagation();" title="TradingView"
               style="font-size:10px;color:var(--accent);text-decoration:none;padding:2px 4px;border-radius:3px;border:1px solid rgba(91,163,245,.2);background:rgba(91,163,245,.05);display:flex;align-items:center;justify-content:center;height:22px;box-sizing:border-box;cursor:pointer;">
               ↗
            </a>
            <button class="sd-chart-max-btn" onclick="openMaximizedChart('${symbol}')" title="Maximize Chart"
                    style="height:22px; width:22px; padding:0; display:flex; align-items:center; justify-content:center; border:1px solid var(--border); border-radius:3px; background:transparent;">
              ⛶
            </button>
          </div>
        </div>

        <div class="sd-chart-container" style="flex:1; position:relative; overflow:hidden;">
          <div id="scc-chart-lw-${i}" style="width:100%; height:100%; position:relative;"></div>
          <canvas id="scc-chart-canvas-${i}" style="display:none;"></canvas>
          <div id="scc-chart-loader-${i}" style="position:absolute; inset:0; display:flex; align-items:center; justify-content:center; background:#131722; color:var(--dim); font-size:11px; flex-direction:column; gap:6px;">
            Loading chart…
          </div>
        </div>
        
        <div id="scc-chart-table-${i}" style="flex-shrink:0; background:var(--bg3); border-top:1px solid var(--border);"></div>
      </div>
    `;
  }
  grid.innerHTML = html; for (let i = 0; i < count; i++) { sccChartRenderPanel(i); }
}

function sccChartSetActivePanel(index) {
  _sccActivePanelIndex = index;
  const count = sccChartGetCount();
  for (let i = 0; i < count; i++) {
    const card = document.getElementById(`scc-chart-card-${i}`);
    if (card) {
      if (i === index) {
        card.style.borderColor = 'var(--accent)';
        card.style.boxShadow = '0 0 10px rgba(91, 163, 245, 0.25)';
      } else {
        card.style.borderColor = 'var(--border)';
        card.style.boxShadow = 'none';
      }
    }
  }
}

// SHIBU'S WIN INDICATOR ENGINE & TOGGLE STATE (TRADINGVIEW CUSTOMIZATION)
// ==========================================

function hexToRgba(hex, opacity) {
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
  const a = Math.max(0, Math.min(1, opacity != null ? (opacity > 1 ? opacity / 100 : opacity) : 1));
  return 'rgba(' + r + ', ' + g + ', ' + b + ', ' + a + ')';
}

function openFullPageChart(sym) {
  let target = sym;
  if (!target) {
    if (typeof _sdMaximizedChartSymbol !== 'undefined' && _sdMaximizedChartSymbol) {
      target = _sdMaximizedChartSymbol;
    } else if (typeof _sccChartSymbols !== 'undefined' && _sccChartSymbols[0]) {
      target = _sccChartSymbols[0];
    } else if (typeof _wlItems !== 'undefined' && _wlItems.length > 0 && _wlItems[0].s) {
      target = _wlItems[0].s;
    } else {
      target = 'RELIANCE';
    }
  }
  if (typeof openMaximizedChart === 'function') {
    openMaximizedChart(target);
  }
}
window.openFullPageChart = openFullPageChart;

// ── STOCK FUNDAMENTALS & TRADINGVIEW STYLE EPS/SALES TABLE ───────
const _fundamentalsCache = new Map();

function parseFundamentalsData(symbol, result) {
  const data = {
    symbol: symbol,
    quarters: [],
    roe: null,
    roeFormatted: '—',
    marketCap: null,
    capCategory: '—',
    screenerUrl: 'https://www.screener.in/company/' + encodeURIComponent(symbol) + '/consolidated/'
  };

  if (!result) return data;

  // 1. ROE from financialData
  if (result.financialData && result.financialData.returnOnEquity && result.financialData.returnOnEquity.raw != null) {
    data.roe = result.financialData.returnOnEquity.raw;
    data.roeFormatted = (data.roe * 100).toFixed(1) + '%';
  }

  // 2. Market Cap & Cap Category
  const shares = result.defaultKeyStatistics?.sharesOutstanding?.raw;
  const curPrice = result.financialData?.currentPrice?.raw;
  if (shares && curPrice) {
    data.marketCap = shares * curPrice;
  } else if (result.financialData?.marketCap?.raw) {
    data.marketCap = result.financialData.marketCap.raw;
  }
  if (data.marketCap) {
    const mcInCr = data.marketCap / 1e7;
    if (mcInCr >= 20000) data.capCategory = 'LargeCap';
    else if (mcInCr >= 5000) data.capCategory = 'MidCap';
    else if (mcInCr >= 1000) data.capCategory = 'SmallCap';
    else data.capCategory = 'MicroCap';
  }

  // 3. Quarterly EPS & Sales
  const qList = result.earnings?.financialsChart?.quarterly || [];
  const incList = result.incomeStatementHistoryQuarterly?.incomeStatementHistory || [];
  const quarterlyItems = [];

  if (Array.isArray(qList) && qList.length > 0) {
    for (const item of qList) {
      quarterlyItems.push({
        date: item.date,
        revenue: item.revenue != null ? item.revenue : null,
        earnings: item.earnings != null ? item.earnings : null
      });
    }
  } else if (Array.isArray(incList) && incList.length > 0) {
    for (const item of incList) {
      quarterlyItems.push({
        date: item.endDate?.fmt || 'Qtr',
        revenue: item.totalRevenue?.raw != null ? item.totalRevenue.raw : null,
        earnings: item.netIncome?.raw != null ? item.netIncome.raw : null
      });
    }
  }

  // Reverse so newest quarter is at index 0 (descending order)
  const sortedDesc = [...quarterlyItems].reverse();
  const latestEarningsGrowth = result.financialData?.earningsGrowth?.raw;
  const latestRevenueGrowth = result.financialData?.revenueGrowth?.raw;

  const parsedQuarters = [];
  for (let i = 0; i < sortedDesc.length; i++) {
    const cur = sortedDesc[i];
    let epsPct = null;
    let salesPct = null;

    if (i + 4 < sortedDesc.length) {
      const prevYear = sortedDesc[i + 4];
      if (prevYear.earnings && cur.earnings != null) {
        epsPct = Math.round(((cur.earnings - prevYear.earnings) / Math.abs(prevYear.earnings)) * 100);
      }
      if (prevYear.revenue && cur.revenue != null) {
        salesPct = Math.round(((cur.revenue - prevYear.revenue) / Math.abs(prevYear.revenue)) * 100);
      }
    } else if (i === 0) {
      if (latestEarningsGrowth != null) epsPct = Math.round(latestEarningsGrowth * 100);
      if (latestRevenueGrowth != null) salesPct = Math.round(latestRevenueGrowth * 100);
    }

    if (epsPct == null && i + 1 < sortedDesc.length) {
      const prevQ = sortedDesc[i + 1];
      if (prevQ.earnings && cur.earnings != null) {
        epsPct = Math.round(((cur.earnings - prevQ.earnings) / Math.abs(prevQ.earnings)) * 100);
      }
      if (prevQ.revenue && cur.revenue != null) {
        salesPct = Math.round(((cur.revenue - prevQ.revenue) / Math.abs(prevQ.revenue)) * 100);
      }
    }

    let displayDate = cur.date || '—';
    if (/^\d{4}-\d{2}-\d{2}$/.test(displayDate)) {
      const d = new Date(displayDate);
      const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      displayDate = months[d.getUTCMonth()] + '-' + String(d.getUTCFullYear()).slice(-2);
    } else if (/^(\d)Q(\d{4})$/.test(displayDate)) {
      const m = displayDate.match(/^(\d)Q(\d{4})$/);
      displayDate = 'Q' + m[1] + ' ' + m[2].slice(-2);
    }

    parsedQuarters.push({
      date: displayDate,
      epsPct: epsPct,
      salesPct: salesPct,
      earnings: cur.earnings,
      revenue: cur.revenue
    });
  }

  data.quarters = parsedQuarters;
  return data;
}

async function fetchStockFundamentals(symbol) {
  if (!symbol) return null;
  const sUpper = symbol.toUpperCase().replace('.NS', '');
  if (_fundamentalsCache.has(sUpper)) {
    const cached = _fundamentalsCache.get(sUpper);
    if (cached && cached.quarters && cached.quarters.length > 0) return cached;
  }
  // 1. Try Screener.in first (most accurate for NSE)
  try {
    const screenerData = await fetchScreenerFundamentals(sUpper);
    if (screenerData && screenerData.quarters && screenerData.quarters.length > 0) {
      _fundamentalsCache.set(sUpper, screenerData);
      return screenerData;
    }
  } catch (e) { }
  const yfSymbol = sUpper + '.NS';
  const targetUrl = 'https://query1.finance.yahoo.com/v10/finance/quoteSummary/' + yfSymbol + '?modules=earnings,financialData,defaultKeyStatistics,incomeStatementHistoryQuarterly';

  const currentOrigin = window.location.origin;
  const proxies = [
    url => 'https://nse-chart-proxy.shibu-mk.workers.dev/?url=' + encodeURIComponent(url),
    url => {
      if (!currentOrigin || currentOrigin.startsWith('file') || currentOrigin === 'null' || currentOrigin.includes('github.io')) return '';
      return currentOrigin + '/api/proxy?url=' + encodeURIComponent(url);
    },
    url => 'http://localhost:9090/?url=' + encodeURIComponent(url),
    url => 'https://api.allorigins.win/raw?url=' + encodeURIComponent(url),
    url => 'https://api.codetabs.com/v1/proxy?quest=' + encodeURIComponent(url)
  ];

  for (const proxyFn of proxies) {
    try {
      const pUrl = proxyFn(targetUrl);
      if (!pUrl) continue;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);
      const resp = await fetch(pUrl, { signal: controller.signal });
      clearTimeout(timeoutId);
      if (resp.ok) {
        let text = await resp.text();
        if (text.trim().startsWith('{')) {
          const parsed = JSON.parse(text);
          if (parsed.contents) text = parsed.contents;
        }
        const data = typeof text === 'string' ? JSON.parse(text) : text;
        const result = data?.quoteSummary?.result?.[0];
        if (result) {
          const parsedFundamentals = parseFundamentalsData(sUpper, result);
          _fundamentalsCache.set(sUpper, parsedFundamentals);
          return parsedFundamentals;
        }
      }
    } catch (e) {
      // try next proxy
    }
  }

  const fallback = {
    symbol: sUpper,
    quarters: [],
    roe: null,
    roeFormatted: '—',
    marketCap: null,
    capCategory: '—',
    screenerUrl: 'https://www.screener.in/company/' + encodeURIComponent(sUpper) + '/consolidated/'
  };
  _fundamentalsCache.set(sUpper, fallback);
  return fallback;
}

async function renderMaxChartEpsTable(symbol) {
  const container = document.getElementById('max-chart-eps-table');
  if (!container) return;

  const show = _winConfig.inputs.showEpsTable !== false && (!_winConfig.style.epsTable || _winConfig.style.epsTable.visible);
  if (!show || !symbol || symbol === '-' || symbol.toUpperCase() === '^NSEI') {
    container.style.display = 'none';
    return;
  }

  container.style.display = 'block';
  const op = (_winConfig.style.epsTable && _winConfig.style.epsTable.opacity) || 90;
  container.style.opacity = (op / 100).toFixed(2);

  const sUpper = symbol.toUpperCase().replace('.NS', '');

  // Render initial frame with direct Screener link and available fundamentals immediately
  const renderFallbackView = () => {
    let extraInfo = '';
    if (typeof getStockDetails === 'function') {
      const d = getStockDetails(sUpper);
      if (d && d.stats) {
        const epsR = d.stats.eps_rating != null ? d.stats.eps_rating : '';
        const rsR = d.stats.rs_rating != null ? d.stats.rs_rating : '';
        if (epsR || rsR) {
          extraInfo = '<div style="font-size:9px;color:#94a3b8;margin:2px 0 6px 0;">' +
            (epsR ? 'EPS Rating: <b style="color:#22c55e;">' + epsR + '</b> ' : '') +
            (rsR ? '· RS: <b style="color:#a855f7;">' + rsR + '</b>' : '') +
          '</div>';
        }
      }
    }
    container.innerHTML = '<table class="tv-eps-tbl">' +
      '<thead><tr><th style="text-align:left;">Qtr</th><th>EPS%</th><th>Sales%</th></tr></thead>' +
      '<tbody>' +
        '<tr><td colspan="3" style="text-align:center;padding:8px 4px;">' +
          '<div style="font-size:10px;font-weight:700;color:#f0f3fa;">' + sUpper + ' Financials</div>' +
          extraInfo +
          '<a href="https://www.screener.in/company/' + encodeURIComponent(sUpper) + '/consolidated/" target="_blank" ' +
             'style="display:inline-flex;align-items:center;gap:3px;color:#2962ff;font-size:9px;text-decoration:none;font-weight:700;padding:2px 6px;border-radius:3px;background:rgba(41,98,255,0.12);border:1px solid rgba(41,98,255,0.3);">' +
            '<span>View Screener Quarters ↗</span>' +
          '</a>' +
        '</td></tr>' +
      '</tbody>' +
    '</table>';
  };

  if (!_fundamentalsCache.has(sUpper)) {
    renderFallbackView();
  }

  try {
    const fundPromise = fetchStockFundamentals(sUpper);
    const timeoutPromise = new Promise(resolve => setTimeout(() => resolve(null), 3000));
    const fund = await Promise.race([fundPromise, timeoutPromise]);

    if (!fund || !fund.quarters || fund.quarters.length === 0) {
      renderFallbackView();
      return;
    }

    const rowsLimit = Math.max(1, Math.min(8, _winConfig.inputs.epsRowsToShow || 4));
    const quartersToShow = fund.quarters.slice(0, rowsLimit);

    let rowsHtml = '';
    for (const q of quartersToShow) {
      const epsTxt = q.epsPct != null ? (q.epsPct >= 0 ? '+' : '') + q.epsPct + '%' : '—';
      const epsClass = q.epsPct == null ? 'tv-eps-neu' : q.epsPct >= 0 ? 'tv-eps-pos' : 'tv-eps-neg';
      const salesTxt = q.salesPct != null ? (q.salesPct >= 0 ? '+' : '') + q.salesPct + '%' : '—';
      const salesClass = q.salesPct == null ? 'tv-eps-neu' : q.salesPct >= 0 ? 'tv-eps-pos' : 'tv-eps-neg';

      rowsHtml += '<tr>' +
        '<td style="text-align:left;color:#d1d4dc;font-weight:600;">' + q.date + '</td>' +
        '<td class="' + epsClass + '">' + epsTxt + '</td>' +
        '<td class="' + salesClass + '">' + salesTxt + '</td>' +
      '</tr>';
    }

    container.innerHTML = '<table class="tv-eps-tbl">' +
      '<thead>' +
        '<tr>' +
          '<th style="text-align:left;">Qtr</th>' +
          '<th>EPS%</th>' +
          '<th>Sales%</th>' +
        '</tr>' +
      '</thead>' +
      '<tbody>' +
        rowsHtml +
      '</tbody>' +
    '</table>' +
    '<div style="display:flex;align-items:center;justify-content:space-between;padding:3px 8px;background:rgba(0,0,0,0.35);border-top:1px solid #2a2e39;font-size:8px;">' +
      '<span style="color:#787b86;">YoY Growth</span>' +
      '<a href="https://www.screener.in/company/' + encodeURIComponent(sUpper) + '/consolidated/" target="_blank" style="color:#2962ff;text-decoration:none;font-weight:600;">Screener ↗</a>' +
    '</div>';
  } catch (err) {
    renderFallbackView();
  }
}

window.fetchStockFundamentals = fetchStockFundamentals;
window.renderMaxChartEpsTable = renderMaxChartEpsTable;

window.hexToRgba = hexToRgba;

const WIN_DEFAULT_CONFIG = {
  inputs: {
    ema1Period: 10,
    ema2Period: 20,
    sma1Period: 50,
    sma2Period: 200,
    sma30wPeriod: 30,
    volLen: 50,
    atrLen: 14,
    adrLen: 20,
    udLen: 50,
    purpleRoc: 5.0,
    purpleVol: 1000000,
    vcpRangePct: 2.0,
    powerPocketVolMult: 1.5,
    vtLookback: 25,
    vtRows: 30,
    vtHvnPct: 60.0,
    vtLvnPct: 40.0,
    showEpsTable: true,
    epsRowsToShow: 4,
  },
  style: {
    ema10: { visible: true, color: '#3b82f6', opacity: 100, width: 1.5, lineStyle: 0 },
    ema20: { visible: true, color: '#ef4444', opacity: 100, width: 1.5, lineStyle: 0 },
    sma50: { visible: true, color: '#06b6d4', opacity: 100, width: 1.5, lineStyle: 0 },
    sma200: { visible: true, color: '#22c55e', opacity: 100, width: 2.0, lineStyle: 0 },
    sma30w: { visible: true, color: '#f97316', opacity: 100, width: 2.0, lineStyle: 0 },
    rs: { visible: true, color: '#38bdf8', opacity: 100, width: 1.8, lineStyle: 0 },
    vt: { visible: true, color: '#4863fc', opacity: 100, width: 1.5, lineStyle: 2 },
    dots: { visible: true },
    purpleDot: { visible: true, color: '#d203f7', opacity: 100 },
    vcp: { visible: true, color: '#ffffff', opacity: 100 },
    powerPocket: { visible: true, color: '#94a3b8', opacity: 100 },
    hud: { visible: true },
    epsTable: { visible: true, opacity: 90 }
  }
};

let _winConfig = JSON.parse(JSON.stringify(WIN_DEFAULT_CONFIG));

function loadWinSettings() {
  try {
    const s = localStorage.getItem('shibu_win_config_v2');
    if (s) {
      const parsed = JSON.parse(s);
      if (parsed.inputs) _winConfig.inputs = Object.assign({}, WIN_DEFAULT_CONFIG.inputs, parsed.inputs);
      if (parsed.style) {
        for (const k in WIN_DEFAULT_CONFIG.style) {
          _winConfig.style[k] = Object.assign({}, WIN_DEFAULT_CONFIG.style[k], (parsed.style && parsed.style[k]) || {});
        }
      }
    } else {
      const old = localStorage.getItem('shibu_win_settings');
      if (old) {
        const pOld = JSON.parse(old);
        for (const k in pOld) {
          if (_winConfig.style[k]) _winConfig.style[k].visible = !!pOld[k];
        }
      }
    }
  } catch (e) {
    console.warn("Could not load WIN config", e);
  }
  updateWinPillStyles();
  updateWinLegendLabels();
}

function saveWinSettings() {
  try {
    localStorage.setItem('shibu_win_config_v2', JSON.stringify(_winConfig));
    const legacy = {};
    for (const k in _winConfig.style) {
      legacy[k] = _winConfig.style[k].visible;
    }
    localStorage.setItem('shibu_win_settings', JSON.stringify(legacy));
  } catch (e) { }
}

function updateWinLegendLabels() {
  const el = document.getElementById('max-chart-tv-legend-params');
  if (el && _winConfig && _winConfig.inputs) {
    const inp = _winConfig.inputs;
    el.textContent = `(${inp.ema1Period}, ${inp.ema2Period}, ${inp.sma1Period}, ${inp.sma2Period}, ${inp.sma30wPeriod})`;
  }
  const inp = _winConfig.inputs;
  const setPillText = (id, text) => {
    const btn = document.getElementById(id);
    if (btn) btn.textContent = text;
  };
  setPillText('win-btn-ema10', `${inp.ema1Period} EMA`);
  setPillText('win-btn-ema20', `${inp.ema2Period} EMA`);
  setPillText('win-btn-sma50', `${inp.sma1Period} SMA`);
  setPillText('win-btn-sma200', `${inp.sma2Period} SMA`);
  setPillText('win-btn-sma30w', `${inp.sma30wPeriod}W SMA`);

  setPillText('scc-win-btn-ema10', `${inp.ema1Period} EMA`);
  setPillText('scc-win-btn-ema20', `${inp.ema2Period} EMA`);
  setPillText('scc-win-btn-sma50', `${inp.sma1Period} SMA`);
  setPillText('scc-win-btn-sma200', `${inp.sma2Period} SMA`);
  setPillText('scc-win-btn-sma30w', `${inp.sma30wPeriod}W`);

  const setLblText = (id, text) => {
    const elLbl = document.getElementById(id);
    if (elLbl) elLbl.textContent = text;
  };
  setLblText('tv-style-lbl-ema10', `${inp.ema1Period} EMA`);
  setLblText('tv-style-lbl-ema20', `${inp.ema2Period} EMA`);
  setLblText('tv-style-lbl-sma50', `${inp.sma1Period} SMA`);
  setLblText('tv-style-lbl-sma200', `${inp.sma2Period} SMA`);
  setLblText('tv-style-lbl-sma30w', `Weekly ${inp.sma30wPeriod} SMA`);
}

function updateWinPillStyles() {
  const keys = ['ema10', 'ema20', 'sma50', 'sma200', 'sma30w', 'rs', 'dots', 'vt', 'hud'];
  keys.forEach(k => {
    const active = _winConfig.style[k] ? !!_winConfig.style[k].visible : true;
    const btns = [document.getElementById('win-btn-' + k), document.getElementById('scc-win-btn-' + k)];
    btns.forEach(btn => {
      if (!btn) return;
      if (active) {
        btn.classList.add('active');
        btn.classList.remove('inactive');
      } else {
        btn.classList.remove('active');
        btn.classList.add('inactive');
      }
    });
  });
}

function winToggleFeature(key) {
  if (!_winConfig.style[key]) _winConfig.style[key] = { visible: true };
  _winConfig.style[key].visible = !_winConfig.style[key].visible;
  saveWinSettings();
  updateWinPillStyles();

  // If Maximized Chart Modal is currently open, redraw
  const maxOverlay = document.getElementById('chart-max-overlay');
  if (maxOverlay && maxOverlay.style.display !== 'none' && typeof drawMaxChartLightweight === 'function') {
    drawMaxChartLightweight();
    const tableContainer = document.getElementById('max-chart-table-container');
    if (tableContainer) {
      if (!_winConfig.style.hud || !_winConfig.style.hud.visible) {
        tableContainer.style.display = 'none';
      } else {
        tableContainer.style.display = 'block';
        if (typeof _sdMaximizedChartSymbol !== 'undefined' && _sdMaximizedChartSymbol && _maxCandles) {
          const details = typeof getStockDetails === 'function' ? getStockDetails(_sdMaximizedChartSymbol) : { symbol: _sdMaximizedChartSymbol };
          const vt = calcVolumeTrigger(_maxCandles, _winConfig.inputs.vtLookback, _winConfig.inputs.vtRows, _winConfig.inputs.vtHvnPct, _winConfig.inputs.vtLvnPct);
          tableContainer.innerHTML = renderWinHudTableHtml(_maxCandles, details, vt);
        }
      }
    }
  }

  // Also re-render Chart Workbench panels if visible
  const chartPane = document.getElementById('scc-pane-chart');
  if (chartPane && chartPane.style.display !== 'none') {
    const count = typeof sccChartGetCount === 'function' ? sccChartGetCount() : 6;
    for (let i = 0; i < count; i++) {
      if (typeof sccChartRenderPanel === 'function') sccChartRenderPanel(i);
    }
  }
}

// ── TradingView Settings Modal Handlers ──

// Expose TV Settings functions to window
window._winConfig = _winConfig;
window.openWinSettingsModal = openWinSettingsModal;
window.closeWinSettingsModal = closeWinSettingsModal;
window.switchWinTab = switchWinTab;
window.resetWinSettingsToDefault = resetWinSettingsToDefault;
window.applyWinSettingsFromModal = applyWinSettingsFromModal;
window.winToggleFeature = winToggleFeature;

function openWinSettingsModal() {
  const overlay = document.getElementById('win-settings-overlay');
  if (!overlay) return;

  const inp = _winConfig.inputs;
  const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };
  const setChk = (id, val) => { const el = document.getElementById(id); if (el) el.checked = !!val; };

  // Inputs
  setVal('tv-in-ema1Period', inp.ema1Period);
  setVal('tv-in-ema2Period', inp.ema2Period);
  setVal('tv-in-sma1Period', inp.sma1Period);
  setVal('tv-in-sma2Period', inp.sma2Period);
  setVal('tv-in-sma30wPeriod', inp.sma30wPeriod);
  setVal('tv-in-volLen', inp.volLen);
  setVal('tv-in-atrLen', inp.atrLen);
  setVal('tv-in-adrLen', inp.adrLen);
  setVal('tv-in-udLen', inp.udLen);
  setVal('tv-in-purpleRoc', inp.purpleRoc);
  setVal('tv-in-purpleVol', inp.purpleVol);
  setVal('tv-in-vcpRangePct', inp.vcpRangePct);
  setVal('tv-in-powerPocketVolMult', inp.powerPocketVolMult);
  setVal('tv-in-vtLookback', inp.vtLookback);
  setVal('tv-in-vtRows', inp.vtRows);
  setVal('tv-in-vtHvnPct', inp.vtHvnPct);
  setVal('tv-in-vtLvnPct', inp.vtLvnPct);
  setChk('tv-in-showEpsTable', inp.showEpsTable !== false);
  setVal('tv-in-epsRowsToShow', inp.epsRowsToShow || 4);

  // Style
  const st = _winConfig.style;
  const loadPlotStyle = (key) => {
    const cfg = st[key] || {};
    setChk('tv-style-' + key + '-vis', cfg.visible);
    if (cfg.color) setVal('tv-style-' + key + '-col', cfg.color);
    if (cfg.width != null) setVal('tv-style-' + key + '-w', cfg.width);
    if (cfg.lineStyle != null) setVal('tv-style-' + key + '-st', cfg.lineStyle);
    if (cfg.opacity != null) setVal('tv-style-' + key + '-op', cfg.opacity);
  };

  ['ema10', 'ema20', 'sma50', 'sma200', 'sma30w', 'rs', 'vt'].forEach(loadPlotStyle);
  setChk('tv-style-purpleDot-vis', st.purpleDot.visible);
  setVal('tv-style-purpleDot-col', st.purpleDot.color);
  if (st.purpleDot.opacity != null) setVal('tv-style-purpleDot-op', st.purpleDot.opacity);
  if (st.vcp.opacity != null) setVal('tv-style-vcp-op', st.vcp.opacity);
  if (st.powerPocket.opacity != null) setVal('tv-style-powerPocket-op', st.powerPocket.opacity);
  setChk('tv-style-vcp-vis', st.vcp.visible);
  setVal('tv-style-vcp-col', st.vcp.color);
  setChk('tv-style-powerPocket-vis', st.powerPocket.visible);
  setVal('tv-style-powerPocket-col', st.powerPocket.color);
  setChk('tv-style-hud-vis', st.hud.visible);
  setChk('tv-style-epsTable-vis', st.epsTable ? st.epsTable.visible : true);
  if (st.epsTable && st.epsTable.opacity != null) setVal('tv-style-epsTable-op', st.epsTable.opacity);

  switchWinTab('inputs');
  overlay.style.display = 'flex';
}

function closeWinSettingsModal() {
  const overlay = document.getElementById('win-settings-overlay');
  if (overlay) overlay.style.display = 'none';
}

function switchWinTab(tabName) {
  const btnInp = document.getElementById('win-tab-btn-inputs');
  const btnSt = document.getElementById('win-tab-btn-style');
  const tabInp = document.getElementById('win-tab-content-inputs');
  const tabSt = document.getElementById('win-tab-content-style');

  if (tabName === 'inputs') {
    if (btnInp) btnInp.classList.add('active');
    if (btnSt) btnSt.classList.remove('active');
    if (tabInp) tabInp.style.display = 'block';
    if (tabSt) tabSt.style.display = 'none';
  } else {
    if (btnInp) btnInp.classList.remove('active');
    if (btnSt) btnSt.classList.add('active');
    if (tabInp) tabInp.style.display = 'none';
    if (tabSt) tabSt.style.display = 'block';
  }
}

function resetWinSettingsToDefault() {
  _winConfig = JSON.parse(JSON.stringify(WIN_DEFAULT_CONFIG));
  saveWinSettings();
  openWinSettingsModal();
  updateWinPillStyles();
  updateWinLegendLabels();
  if (typeof drawMaxChartLightweight === 'function') drawMaxChartLightweight();
}

function applyWinSettingsFromModal() {
  const getNum = (id, def) => {
    const el = document.getElementById(id);
    const n = el ? parseFloat(el.value) : def;
    return isNaN(n) ? def : n;
  };
  const getChk = (id, def) => {
    const el = document.getElementById(id);
    return el ? el.checked : def;
  };
  const getVal = (id, def) => {
    const el = document.getElementById(id);
    return el ? el.value : def;
  };

  _winConfig.inputs.ema1Period = Math.max(1, Math.round(getNum('tv-in-ema1Period', 10)));
  _winConfig.inputs.ema2Period = Math.max(1, Math.round(getNum('tv-in-ema2Period', 20)));
  _winConfig.inputs.sma1Period = Math.max(1, Math.round(getNum('tv-in-sma1Period', 50)));
  _winConfig.inputs.sma2Period = Math.max(1, Math.round(getNum('tv-in-sma2Period', 200)));
  _winConfig.inputs.sma30wPeriod = Math.max(1, Math.round(getNum('tv-in-sma30wPeriod', 30)));
  _winConfig.inputs.volLen = Math.max(1, Math.round(getNum('tv-in-volLen', 50)));
  _winConfig.inputs.atrLen = Math.max(1, Math.round(getNum('tv-in-atrLen', 14)));
  _winConfig.inputs.adrLen = Math.max(1, Math.round(getNum('tv-in-adrLen', 20)));
  _winConfig.inputs.udLen = Math.max(1, Math.round(getNum('tv-in-udLen', 50)));
  _winConfig.inputs.purpleRoc = Math.max(0.1, getNum('tv-in-purpleRoc', 5.0));
  _winConfig.inputs.purpleVol = Math.max(1000, Math.round(getNum('tv-in-purpleVol', 1000000)));
  _winConfig.inputs.vcpRangePct = Math.max(0.1, getNum('tv-in-vcpRangePct', 2.0));
  _winConfig.inputs.powerPocketVolMult = Math.max(0.5, getNum('tv-in-powerPocketVolMult', 1.5));
  _winConfig.inputs.vtLookback = Math.max(5, Math.min(100, Math.round(getNum('tv-in-vtLookback', 25))));
  _winConfig.inputs.vtRows = Math.max(10, Math.min(100, Math.round(getNum('tv-in-vtRows', 30))));
  _winConfig.inputs.vtHvnPct = Math.max(10, Math.min(99, getNum('tv-in-vtHvnPct', 60.0)));
  _winConfig.inputs.vtLvnPct = Math.max(5, Math.min(99, getNum('tv-in-vtLvnPct', 40.0)));
  _winConfig.inputs.showEpsTable = getChk('tv-in-showEpsTable', true);
  _winConfig.inputs.epsRowsToShow = Math.max(1, Math.min(8, Math.round(getNum('tv-in-epsRowsToShow', 4))));

  const savePlotStyle = (key) => {
    if (!_winConfig.style[key]) _winConfig.style[key] = {};
    _winConfig.style[key].visible = getChk('tv-style-' + key + '-vis', true);
    _winConfig.style[key].color = getVal('tv-style-' + key + '-col', _winConfig.style[key].color);
    _winConfig.style[key].width = parseFloat(getVal('tv-style-' + key + '-w', _winConfig.style[key].width || 1.5));
    _winConfig.style[key].lineStyle = parseInt(getVal('tv-style-' + key + '-st', _winConfig.style[key].lineStyle || 0));
    _winConfig.style[key].opacity = parseInt(getVal('tv-style-' + key + '-op', _winConfig.style[key].opacity || 100));
  };

  ['ema10', 'ema20', 'sma50', 'sma200', 'sma30w', 'rs', 'vt'].forEach(savePlotStyle);

  _winConfig.style.purpleDot = {
    visible: getChk('tv-style-purpleDot-vis', true),
    color: getVal('tv-style-purpleDot-col', '#d203f7'),
    opacity: parseInt(getVal('tv-style-purpleDot-op', 100))
  };
  _winConfig.style.vcp = {
    visible: getChk('tv-style-vcp-vis', true),
    color: getVal('tv-style-vcp-col', '#ffffff'),
    opacity: parseInt(getVal('tv-style-vcp-op', 100))
  };
  _winConfig.style.powerPocket = {
    visible: getChk('tv-style-powerPocket-vis', true),
    color: getVal('tv-style-powerPocket-col', '#94a3b8'),
    opacity: parseInt(getVal('tv-style-powerPocket-op', 100))
  };
  _winConfig.style.dots.visible = _winConfig.style.purpleDot.visible || _winConfig.style.vcp.visible || _winConfig.style.powerPocket.visible;
  _winConfig.style.hud = {
    visible: getChk('tv-style-hud-vis', true)
  };
  _winConfig.style.epsTable = {
    visible: getChk('tv-style-epsTable-vis', true),
    opacity: parseInt(getVal('tv-style-epsTable-op', 90))
  };

  saveWinSettings();
  updateWinPillStyles();
  updateWinLegendLabels();
  closeWinSettingsModal();

  // Redraw charts
  const maxOverlay = document.getElementById('chart-max-overlay');
  if (maxOverlay && maxOverlay.style.display !== 'none' && typeof drawMaxChartLightweight === 'function') {
    drawMaxChartLightweight();
  }
  const chartPane = document.getElementById('scc-pane-chart');
  if (chartPane && chartPane.style.display !== 'none') {
    const count = typeof sccChartGetCount === 'function' ? sccChartGetCount() : 6;
    for (let i = 0; i < count; i++) {
      if (typeof sccChartRenderPanel === 'function') sccChartRenderPanel(i);
    }
  }
}

// Indicator math functions
function calculateSMA(candles, period) {
  const sma = [];
  let sum = 0;
  for (let i = 0; i < candles.length; i++) {
    sum += candles[i].close;
    if (i >= period) {
      sum -= candles[i - period].close;
    }
    if (i >= period - 1) {
      sma.push(sum / period);
    } else {
      sma.push(null);
    }
  }
  return sma;
}

function calculateADR(candles, period) {
  const p = period || 20;
  const adr = [];
  let sum = 0;
  for (let i = 0; i < candles.length; i++) {
    const c = candles[i];
    const rangePct = c.close > 0 ? ((c.high - c.low) / c.close) * 100 : 0;
    sum += rangePct;
    if (i >= p) {
      const prevC = candles[i - p];
      sum -= prevC.close > 0 ? ((prevC.high - prevC.low) / prevC.close) * 100 : 0;
    }
    if (i >= p - 1) {
      adr.push(sum / p);
    } else {
      adr.push(null);
    }
  }
  return adr;
}

function calculateATR(candles, period) {
  const p = period || 14;
  const atr = [];
  if (!candles || candles.length === 0) return atr;
  let trSum = 0;
  let prevAtr = null;
  for (let i = 0; i < candles.length; i++) {
    const c = candles[i];
    let tr = c.high - c.low;
    if (i > 0) {
      const prevClose = candles[i - 1].close;
      tr = Math.max(tr, Math.abs(c.high - prevClose), Math.abs(c.low - prevClose));
    }
    if (i < p - 1) {
      trSum += tr;
      atr.push(null);
    } else if (i === p - 1) {
      trSum += tr;
      prevAtr = trSum / p;
      atr.push(prevAtr);
    } else {
      prevAtr = (prevAtr * (p - 1) + tr) / p;
      atr.push(prevAtr);
    }
  }
  return atr;
}

function calculateUDRatio(candles, period) {
  const p = period || 50;
  if (!candles || candles.length < 2) return 1.0;
  const start = Math.max(1, candles.length - p);
  let upVol = 0;
  let downVol = 0;
  for (let i = start; i < candles.length; i++) {
    const c = candles[i];
    const prevC = candles[i - 1];
    if (c.close > prevC.close) {
      upVol += (c.volume || 0);
    } else if (c.close < prevC.close) {
      downVol += (c.volume || 0);
    }
  }
  return downVol > 0 ? Math.round((upVol / downVol) * 100) / 100 : (upVol > 0 ? 2.0 : 1.0);
}

function calculateAvgVol(candles, period) {
  const p = period || 50;
  const avgVol = [];
  let sum = 0;
  for (let i = 0; i < candles.length; i++) {
    sum += (candles[i].volume || 0);
    if (i >= p) {
      sum -= (candles[i - p].volume || 0);
    }
    if (i >= p - 1) {
      avgVol.push(sum / p);
    } else {
      avgVol.push(null);
    }
  }
  return avgVol;
}

function calcVolumeTrigger(candles, vtLookback, vtRows, vtHvnPct, vtLvnPct) {
  const lb = vtLookback || (_winConfig && _winConfig.inputs && _winConfig.inputs.vtLookback) || 25;
  const rows = vtRows || (_winConfig && _winConfig.inputs && _winConfig.inputs.vtRows) || 30;
  const hvnPct = vtHvnPct || (_winConfig && _winConfig.inputs && _winConfig.inputs.vtHvnPct) || 60;
  const lvnPct = vtLvnPct || (_winConfig && _winConfig.inputs && _winConfig.inputs.vtLvnPct) || 40;

  if (!candles || candles.length < lb) return null;
  const slice = candles.slice(candles.length - lb);
  let vtHigh = -Infinity;
  let vtLow = Infinity;
  for (const c of slice) {
    if (c.high > vtHigh) vtHigh = c.high;
    if (c.low < vtLow) vtLow = c.low;
  }
  const vtRange = vtHigh - vtLow;
  if (vtRange <= 0) return null;
  const rowSize = vtRange / rows;
  const vtVol = new Array(rows).fill(0);

  for (let i = 0; i < slice.length; i++) {
    const c = slice[i];
    const candleRange = c.high - c.low;
    if (candleRange > 0 && c.volume > 0) {
      let firstRow = Math.floor((c.low - vtLow) / rowSize);
      let lastRow = Math.floor((c.high - vtLow) / rowSize);
      firstRow = Math.max(0, Math.min(rows - 1, firstRow));
      lastRow = Math.max(0, Math.min(rows - 1, lastRow));
      for (let r = firstRow; r <= lastRow; r++) {
        const rowLow = vtLow + r * rowSize;
        const rowHigh = rowLow + rowSize;
        const overlap = Math.max(0, Math.min(c.high, rowHigh) - Math.max(c.low, rowLow));
        if (overlap > 0) {
          const allocated = c.volume * (overlap / candleRange);
          vtVol[r] += allocated;
        }
      }
    }
  }

  let maxVol = 0;
  let pocRow = 0;
  for (let r = 0; r < rows; r++) {
    if (vtVol[r] > maxVol) {
      maxVol = vtVol[r];
      pocRow = r;
    }
  }
  if (maxVol <= 0) return null;

  const hvnThreshold = maxVol * (hvnPct / 100);
  let upperHvnRow = pocRow;
  let lowerHvnRow = pocRow;

  for (let r = pocRow + 1; r < rows; r++) {
    if (vtVol[r] >= hvnThreshold) upperHvnRow = r;
    else break;
  }
  for (let r = pocRow - 1; r >= 0; r--) {
    if (vtVol[r] >= hvnThreshold) lowerHvnRow = r;
    else break;
  }

  const lvnThreshold = maxVol * (lvnPct / 100);
  let lvnRow = null;
  for (let r = upperHvnRow + 1; r < rows; r++) {
    if (vtVol[r] <= lvnThreshold) {
      lvnRow = r;
      break;
    }
  }

  let volTriggerPrice;
  if (lvnRow !== null) {
    volTriggerPrice = vtLow + lvnRow * rowSize;
  } else {
    volTriggerPrice = vtLow + (upperHvnRow + 1) * rowSize;
  }
  const lastClose = candles[candles.length - 1].close;
  return {
    price: Math.round(volTriggerPrice * 100) / 100,
    isAboveClose: volTriggerPrice > lastClose,
    diffPct: lastClose > 0 ? (((volTriggerPrice - lastClose) / lastClose) * 100).toFixed(1) : '0'
  };
}

function calculateWinMarkers(candles, ema10, avgVol50, isDaily) {
  const markers = [];
  if (!candles || candles.length < 3) return markers;

  const inp = _winConfig.inputs;
  const st = _winConfig.style;

  const showPurple = st.purpleDot && st.purpleDot.visible;
  const showVcp = st.vcp && st.vcp.visible;
  const showPP = st.powerPocket && st.powerPocket.visible;

  const purpleColor = (st.purpleDot && st.purpleDot.color) || '#d203f7';
  const vcpColor = (st.vcp && st.vcp.color) || '#ffffff';
  const ppColor = (st.powerPocket && st.powerPocket.color) || '#94a3b8';

  const minRoc = inp.purpleRoc || 5.0;
  const minVol = inp.purpleVol || 1000000;
  const maxVcpRange = inp.vcpRangePct || 2.0;
  const ppMult = inp.powerPocketVolMult || 1.5;

  for (let i = 2; i < candles.length; i++) {
    const c = candles[i];
    const prevC = candles[i - 1];
    const prevC2 = candles[i - 2];
    const t = c.time;

    // 1. Purple Momentum Dot
    const roc = prevC.close > 0 ? ((c.close - prevC.close) / prevC.close) * 100 : 0;
    const isPurple = showPurple && isDaily && Math.abs(roc) >= minRoc && (c.volume || 0) >= minVol;

    // 2. VCP Tightness (3 consecutive bars)
    const rPct0 = c.close > 0 ? ((c.high - c.low) / c.close) * 100 : 10;
    const rPct1 = prevC.close > 0 ? ((prevC.high - prevC.low) / prevC.close) * 100 : 10;
    const rPct2 = prevC2.close > 0 ? ((prevC2.high - prevC2.low) / prevC2.close) * 100 : 10;
    const isVcp = showVcp && (rPct0 < maxVcpRange && rPct1 < maxVcpRange && rPct2 < maxVcpRange);

    // 3. Power Pocket
    const e10 = ema10 ? ema10[i] : null;
    const aVol = avgVol50 ? avgVol50[i] : null;
    const isPP = showPP && (e10 != null && aVol != null && aVol > 0 &&
      c.close > e10 &&
      (c.volume || 0) > aVol * ppMult &&
      c.close > prevC.close &&
      c.close > c.open);

    if (isPurple) {
      markers.push({
        time: t,
        position: 'aboveBar',
        color: purpleColor,
        shape: 'circle', size: 1,
      });
    }

    if (isVcp && isPP) {
      markers.push({
        time: t,
        position: 'belowBar',
        color: '#38bdf8',
        shape: 'arrowUp',
        size: 1,
      });
    } else if (isVcp) {
      markers.push({
        time: t,
        position: 'belowBar',
        color: vcpColor,
        shape: 'square',
        size: 1,
      });
    } else if (isPP) {
      markers.push({
        time: t,
        position: 'belowBar',
        color: ppColor,
        shape: 'arrowUp',
        size: 1,
      });
    }
  }

  markers.sort((a, b) => a.time - b.time);
  return markers;
}

function fVolFormat(v) {
  if (v == null || isNaN(v)) return '—';
  if (v >= 1e7) return (v / 1e7).toFixed(2) + ' Cr';
  if (v >= 1e5) return (v / 1e5).toFixed(2) + ' L';
  if (v >= 1e3) return (v / 1e3).toFixed(1) + ' k';
  return Math.round(v).toLocaleString();
}

function renderWinHudTableHtml(candles, details, vt) {
  if (!candles || candles.length === 0) {
    return generateStatsTableHtml(details);
  }
  const lastC = candles[candles.length - 1];
  const close = lastC.close;
  const inp = _winConfig.inputs;

  // EMA1 (default 10)
  const ema10Vals = calculateEMA(candles, inp.ema1Period);
  const ema10 = ema10Vals[candles.length - 1];
  const dist10 = ema10 != null ? ((close - ema10) / ema10) * 100 : null;
  const dist10Txt = dist10 != null ? (dist10 >= 0 ? '+' : '') + dist10.toFixed(1) + '%' : '—';
  const c10 = dist10 == null ? 'var(--sub)' : dist10 <= 4 ? '#22c55e' : dist10 <= 8 ? '#fb923c' : '#ef4444';

  // SMA1 (default 50)
  const sma50Vals = calculateSMA(candles, inp.sma1Period);
  const sma50 = sma50Vals[candles.length - 1];
  const dist50 = sma50 != null ? ((close - sma50) / sma50) * 100 : null;
  const dist50Txt = dist50 != null ? (dist50 >= 0 ? '+' : '') + dist50.toFixed(1) + '%' : '—';
  const c50 = dist50 == null ? 'var(--sub)' : dist50 <= 15 ? '#22c55e' : dist50 <= 30 ? '#fb923c' : '#ef4444';

  // SMA2 (default 200)
  const sma200Vals = calculateSMA(candles, inp.sma2Period);
  const sma200 = sma200Vals[candles.length - 1];
  const dist200 = sma200 != null ? ((close - sma200) / sma200) * 100 : null;
  const dist200Txt = dist200 != null ? (dist200 >= 0 ? '+' : '') + dist200.toFixed(1) + '%' : '—';
  const c200 = dist200 == null ? 'var(--sub)' : dist200 <= 50 ? '#22c55e' : '#fb923c';

  // 52W High (up to 252 bars)
  const lookback52 = Math.min(252, candles.length);
  const slice52 = candles.slice(candles.length - lookback52);
  let hh52 = -Infinity;
  for (const c of slice52) if (c.high > hh52) hh52 = c.high;
  const dist52 = hh52 > 0 ? ((close - hh52) / hh52) * 100 : null;
  const dist52Txt = dist52 != null ? dist52.toFixed(1) + '%' : '—';
  const c52 = dist52 == null ? 'var(--sub)' : dist52 >= -10 ? '#22c55e' : dist52 >= -25 ? '#fb923c' : '#ef4444';

  // ADR%
  const adrVals = calculateADR(candles, inp.adrLen);
  const adr = adrVals[candles.length - 1];
  const adrTxt = adr != null ? adr.toFixed(1) + '%' : '—';
  const cAdr = adr == null ? 'var(--sub)' : adr >= 5 ? '#22c55e' : adr >= 3 ? '#fb923c' : '#ef4444';

  // ATR%
  const atrVals = calculateATR(candles, inp.atrLen);
  const atr = atrVals[candles.length - 1];
  const atrPct = (atr != null && close > 0) ? (atr / close) * 100 : null;
  const atrTxt = atrPct != null ? atrPct.toFixed(1) + '%' : '—';
  const cAtr = atrPct == null ? 'var(--sub)' : (atrPct >= 1.5 && atrPct < 3.0) ? '#22c55e' : atrPct >= 3.0 ? '#fb923c' : '#ef4444';

  // AvgVol & Volume & RVol
  const avgVolVals = calculateAvgVol(candles, inp.volLen);
  const avgVol = avgVolVals[candles.length - 1];
  const avgVolTxt = avgVol != null ? fVolFormat(avgVol) : '—';
  const volTxt = fVolFormat(lastC.volume || 0);
  const rVol = (avgVol != null && avgVol > 0) ? Math.round(((lastC.volume || 0) / avgVol) * 100) : null;
  const rVolTxt = rVol != null ? rVol + '%' : '—';
  const cRvol = rVol == null ? 'var(--sub)' : rVol >= 110 ? '#22c55e' : rVol >= 80 ? '#fb923c' : '#ef4444';

  // U/D Ratio
  const udRatio = calculateUDRatio(candles, inp.udLen);
  const udTxt = udRatio.toFixed(2);
  const cUd = udRatio >= 1.5 ? '#22c55e' : udRatio >= 1.0 ? '#fb923c' : '#ef4444';

  // VT Price
  let vtTxt = '—';
  let cVt = 'var(--sub)';
  if (vt) {
    if (vt.isAboveClose) {
      vtTxt = `${vt.price.toFixed(1)} (+${vt.diffPct}%)`;
      cVt = (_winConfig.style.vt && _winConfig.style.vt.color) || '#818cf8';
    } else {
      vtTxt = `${vt.price.toFixed(1)} (crossed)`;
      cVt = 'var(--dim)';
    }
  }

  // Scanner Stats
  const stats = (details && details.stats) ? details.stats : {};
  const r90 = stats.r90 != null ? (stats.r90 >= 0 ? '+' : '') + parseFloat(stats.r90).toFixed(1) + '%' : '—';
  const r90Color = stats.r90 >= 50 ? '#4ade80' : stats.r90 >= 30 ? '#fbbf24' : stats.r90 < 0 ? '#f87171' : 'var(--text)';
  const dd = stats.drawdown != null ? parseFloat(stats.drawdown).toFixed(1) + '%' : '—';
  const ddColor = stats.drawdown >= -5 ? '#4ade80' : stats.drawdown >= -15 ? '#fbbf24' : '#f87171';
  const setupVal = stats.setup || '—';
  const rsRating = stats.rs_rating != null ? Math.round(stats.rs_rating) : '—';
  const scoreVal = stats.final_score != null ? Math.round(stats.final_score) : (stats.vcp_score != null ? Math.round(stats.vcp_score) : '—');
  const gradeVal = stats.grade || '—';
  const gradeColors = { 'A+': '#2dd4bf', 'A': '#4ade80', 'B': '#fbbf24', 'C': '#fb923c', 'REJECT': '#f87171' };
  const gradeColor = gradeColors[gradeVal] || 'var(--dim)';

  const symHud = (details && details.symbol) ? details.symbol.toUpperCase().replace('.NS', '') : '';
  const fundHud = symHud && typeof _fundamentalsCache !== 'undefined' ? _fundamentalsCache.get(symHud) : null;
  const roeVal = (fundHud && fundHud.roeFormatted) ? fundHud.roeFormatted : '—';
  const roeColor = (fundHud && fundHud.roe != null) ? (fundHud.roe >= 0.15 ? '#22c55e' : fundHud.roe >= 0.08 ? '#fbbf24' : '#ef4444') : 'var(--sub)';
  const capVal = (fundHud && fundHud.capCategory) ? fundHud.capCategory : '—';

  return `
    <div style="width:100%;background:var(--bg3);border-collapse:collapse;font-size:10px;font-family:var(--mono);">
      <div style="display:flex;align-items:center;justify-content:space-between;padding:5px 10px;border-bottom:1px solid var(--border);flex-wrap:wrap;gap:8px;">
        <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
          <span><span style="color:var(--dim);font-weight:600">P/${inp.ema1Period}EMA:</span> <b style="color:${c10}">${dist10Txt}</b></span>
          <span><span style="color:var(--dim);font-weight:600">P/${inp.sma1Period}SMA:</span> <b style="color:${c50}">${dist50Txt}</b></span>
          <span><span style="color:var(--dim);font-weight:600">P/${inp.sma2Period}SMA:</span> <b style="color:${c200}">${dist200Txt}</b></span>
          <span><span style="color:var(--dim);font-weight:600">P/52W Hi:</span> <b style="color:${c52}">${dist52Txt}</b></span>
          <span><span style="color:var(--dim);font-weight:600">ADR(${inp.adrLen}):</span> <b style="color:${cAdr}">${adrTxt}</b></span>
          <span><span style="color:var(--dim);font-weight:600">ATR%(${inp.atrLen}):</span> <b style="color:${cAtr}">${atrTxt}</b></span>
          <span><span style="color:var(--dim);font-weight:600">AvgVol:</span> <b style="color:var(--text)">${avgVolTxt}</b></span>
          <span><span style="color:var(--dim);font-weight:600">Vol:</span> <b style="color:var(--text)">${volTxt}</b></span>
          <span><span style="color:var(--dim);font-weight:600">RVol:</span> <b style="color:${cRvol}">${rVolTxt}</b></span>
          <span><span style="color:var(--dim);font-weight:600">U/D(${inp.udLen}):</span> <b style="color:${cUd}">${udTxt}</b></span>
          <span><span style="color:var(--dim);font-weight:600">VT GTT:</span> <b style="color:${cVt}">${vtTxt}</b></span>
        </div>
      </div>
      <div style="display:flex;align-items:center;justify-content:space-between;padding:4px 10px;flex-wrap:wrap;gap:8px;background:rgba(0,0,0,0.18);">
        <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
          <span><span style="color:var(--dim);font-weight:600">Sector:</span> <span style="color:var(--text)">${(details && details.sector) || '—'}</span></span>
          <span><span style="color:var(--dim);font-weight:600">Industry:</span> <span style="color:var(--sub)">${(details && details.industry) || '—'}</span></span>
          <span><span style="color:var(--dim);font-weight:600">Cap:</span> <span style="color:var(--teal)">${capVal}</span></span>
          <span><span style="color:var(--dim);font-weight:600">ROE:</span> <b style="color:${roeColor}">${roeVal}</b></span>
          <span><span style="color:var(--dim);font-weight:600">90D%:</span> <b style="color:${r90Color}">${r90}</b></span>
          <span><span style="color:var(--dim);font-weight:600">DD%:</span> <b style="color:${ddColor}">${dd}</b></span>
          <span><span style="color:var(--dim);font-weight:600">Setup:</span> <b style="color:var(--text)">${setupVal}</b></span>
          <span><span style="color:var(--dim);font-weight:600">RS Rating:</span> <b style="color:#fb923c">${rsRating}</b></span>
          <span><span style="color:var(--dim);font-weight:600">Score:</span> <b style="color:var(--teal)">${scoreVal}</b></span>
          <span><span style="color:var(--dim);font-weight:600">Grade:</span> <span style="background:${gradeColor}18;border:1px solid ${gradeColor}40;color:${gradeColor};padding:1px 5px;border-radius:3px;font-weight:700">${gradeVal}</span></span>
        </div>
      </div>
    </div>
  `;
}

let _sccLwCharts = {};
let _sccLwObservers = {};

function sccRenderLwChart(index, candles, niftyCandles) {
  const container = document.getElementById(`scc-chart-lw-${index}`);
  if (!container || !candles || candles.length === 0 || typeof LightweightCharts === 'undefined') return false;

  if (_sccLwCharts[index]) {
    try { _sccLwCharts[index].remove(); } catch (e) { }
    delete _sccLwCharts[index];
  }
  container.innerHTML = '';

  const rect = container.getBoundingClientRect();
  const width = rect.width || container.clientWidth || 300;
  const height = rect.height || container.clientHeight || 200;

  const sorted = [...candles].sort((a, b) => a.time - b.time);
  const seenTimes = new Set();
  const cleanCandles = [];
  for (const c of sorted) {
    const tSec = Math.floor(c.time / 1000);
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
  if (cleanCandles.length === 0) return false;

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
      borderColor: 'rgba(255, 255, 255, 0.06)',
      scaleMargins: { top: 0.08, bottom: 0.22 },
    },
    timeScale: {
      borderColor: 'rgba(255, 255, 255, 0.06)',
      timeVisible: _sccChartTimeframes[index] === '1H',
      secondsVisible: false,
    },
  });

  _sccLwCharts[index] = chart;

  let priceSeries;
  if (_sccChartType === 'ohlc') {
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
  _maxLwPriceSeries = priceSeries;

  const volSeries = chart.addHistogramSeries({
    priceFormat: { type: 'volume' },
    priceScaleId: 'scc_vol_scale',
  });
  chart.priceScale('scc_vol_scale').applyOptions({
    scaleMargins: { top: 0.82, bottom: 0 },
    visible: false,
  });
  volSeries.setData(cleanCandles.map(c => ({
    time: c.time,
    value: c.volume,
    color: c.close >= c.open ? 'rgba(38, 166, 154, 0.35)' : 'rgba(239, 83, 80, 0.35)',
  })));

  const tf = _sccChartTimeframes[index] || 'D';
  const isWeekly = (tf === 'W');
  const isDaily = (tf === 'D');

  const inp = _winConfig.inputs;
  const st = _winConfig.style;

  const ema10Vals = calculateEMA(cleanCandles, inp.ema1Period);
  const ema20Vals = calculateEMA(cleanCandles, inp.ema2Period);
  const sma50Vals = calculateSMA(cleanCandles, inp.sma1Period);
  const sma200Vals = calculateSMA(cleanCandles, inp.sma2Period);
  const sma30wVals = calculateSMA(cleanCandles, inp.sma30wPeriod);
  const avgVolVals = calculateAvgVol(cleanCandles, inp.volLen);

  // EMA 1
  if (st.ema10 && st.ema10.visible) {
    const data = [];
    for (let i = 0; i < cleanCandles.length; i++) {
      if (ema10Vals[i] != null) data.push({ time: cleanCandles[i].time, value: ema10Vals[i] });
    }
    const s = chart.addLineSeries({
      color: hexToRgba(st.ema10.color || '#3b82f6', (st.ema10.opacity != null ? st.ema10.opacity : 100) / 100),
      lineWidth: st.ema10.width || 1.2,
      lineStyle: st.ema10.lineStyle || 0,
      priceLineVisible: false,
      lastValueVisible: false,
      title: ''
    });
    s.setData(data);
  }

  // EMA 2
  if (st.ema20 && st.ema20.visible) {
    const data = [];
    for (let i = 0; i < cleanCandles.length; i++) {
      if (ema20Vals[i] != null) data.push({ time: cleanCandles[i].time, value: ema20Vals[i] });
    }
    const s = chart.addLineSeries({
      color: hexToRgba(st.ema20.color || '#ef4444', (st.ema20.opacity != null ? st.ema20.opacity : 100) / 100),
      lineWidth: st.ema20.width || 1.2,
      lineStyle: st.ema20.lineStyle || 0,
      priceLineVisible: false,
      lastValueVisible: false,
      title: ''
    });
    s.setData(data);
  }

  // SMA 1 (Daily only)
  if (st.sma50 && st.sma50.visible && !isWeekly) {
    const data = [];
    for (let i = 0; i < cleanCandles.length; i++) {
      if (sma50Vals[i] != null) data.push({ time: cleanCandles[i].time, value: sma50Vals[i] });
    }
    const s = chart.addLineSeries({
      color: hexToRgba(st.sma50.color || '#06b6d4', (st.sma50.opacity != null ? st.sma50.opacity : 100) / 100),
      lineWidth: st.sma50.width || 1.2,
      lineStyle: st.sma50.lineStyle || 0,
      priceLineVisible: false,
      lastValueVisible: false,
      title: ''
    });
    s.setData(data);
  }

  // SMA 2 (Daily only)
  if (st.sma200 && st.sma200.visible && !isWeekly) {
    const data = [];
    for (let i = 0; i < cleanCandles.length; i++) {
      if (sma200Vals[i] != null) data.push({ time: cleanCandles[i].time, value: sma200Vals[i] });
    }
    const s = chart.addLineSeries({
      color: hexToRgba(st.sma200.color || '#22c55e', (st.sma200.opacity != null ? st.sma200.opacity : 100) / 100),
      lineWidth: st.sma200.width || 1.8,
      lineStyle: st.sma200.lineStyle || 0,
      priceLineVisible: false,
      lastValueVisible: false,
      title: ''
    });
    s.setData(data);
  }

  // SMA 30W (Weekly only)
  if (st.sma30w && st.sma30w.visible && isWeekly) {
    const data = [];
    for (let i = 0; i < cleanCandles.length; i++) {
      if (sma30wVals[i] != null) data.push({ time: cleanCandles[i].time, value: sma30wVals[i] });
    }
    const s = chart.addLineSeries({
      color: hexToRgba(st.sma30w.color || '#f97316', (st.sma30w.opacity != null ? st.sma30w.opacity : 100) / 100),
      lineWidth: st.sma30w.width || 1.8,
      lineStyle: st.sma30w.lineStyle || 0,
      priceLineVisible: false,
      lastValueVisible: false,
      title: ''
    });
    s.setData(data);
  }

  // RS Nifty
  if (st.rs && st.rs.visible && niftyCandles && niftyCandles.length > 0) {
    const nMap = new Map();
    for (const nc of niftyCandles) {
      nMap.set(new Date(nc.time).toISOString().split('T')[0], nc.close);
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
      const rsSeries = chart.addLineSeries({
        color: hexToRgba(st.rs.color || '#38bdf8', (st.rs.opacity != null ? st.rs.opacity : 100) / 100),
        lineWidth: st.rs.width || 1.4,
        lineStyle: st.rs.lineStyle || 0,
        priceScaleId: 'scc_rs_scale',
        priceLineVisible: false,
        lastValueVisible: false,
        title: '',
      });
      chart.priceScale('scc_rs_scale').applyOptions({
        scaleMargins: { top: 0.05, bottom: 0.70 },
        visible: false,
      });
      rsSeries.setData(rsData);
    }
  }

  // WIN Markers
  if (st.dots && st.dots.visible) {
    const markers = calculateWinMarkers(cleanCandles, ema10Vals, avgVolVals, isDaily);
    priceSeries.setMarkers(markers);
  } else {
    priceSeries.setMarkers([]);
  }

  // Volume Trigger V4
  const vt = calcVolumeTrigger(cleanCandles, inp.vtLookback, inp.vtRows, inp.vtHvnPct, inp.vtLvnPct);
  if (st.vt && st.vt.visible && isDaily && vt && vt.isAboveClose) {
    priceSeries.createPriceLine({
      price: vt.price,
      color: typeof hexToRgba === 'function' ? hexToRgba(st.vt.color || '#4863fc', (st.vt.opacity != null ? st.vt.opacity : 100) / 100) : (st.vt.color || '#4863fc'),
      lineWidth: st.vt.width || 1.2,
      lineStyle: st.vt.lineStyle != null ? st.vt.lineStyle : LightweightCharts.LineStyle.Dashed,
      axisLabelVisible: false,
      title: '',
    });
  }

  // Update workbench panel table
  const tableEl = document.getElementById(`scc-chart-table-${index}`);
  if (tableEl && _sccChartSymbols[index]) {
    const details = typeof getStockDetails === 'function' ? getStockDetails(_sccChartSymbols[index]) : { symbol: _sccChartSymbols[index] };
    tableEl.innerHTML = renderWinHudTableHtml(cleanCandles, details, vt);
  }

  const statsEl = document.getElementById(`scc-chart-stats-${index}`);
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

  const vBars = Math.min(cleanCandles.length, Math.max(30, Math.round(width / 8)));
  chart.timeScale().applyOptions({ rightOffset: 6, barSpacing: 8, minBarSpacing: 3 });
  chart.timeScale().setVisibleLogicalRange({
    from: Math.max(0, cleanCandles.length - vBars),
    to: cleanCandles.length + 6
  });

  if (_sccLwObservers[index]) {
    try { _sccLwObservers[index].disconnect(); } catch (e) { }
  }
  _sccLwObservers[index] = new ResizeObserver(entries => {
    if (!entries || !entries.length || !_sccLwCharts[index]) return;
    const cr = entries[0].contentRect;
    if (cr.width > 0 && cr.height > 0) {
      _sccLwCharts[index].applyOptions({ width: cr.width, height: cr.height });
    }
  });
  _sccLwObservers[index].observe(container);
  return true;
}

async function sccChartRenderPanel(index) {
  const symbol = sccChartGetSymbol(index); const timeframe = _sccChartTimeframes[index]; const canvasId = `scc-chart-canvas-${index}`; const loaderId = `scc-chart-loader-${index}`; const titleId = `scc-chart-title-${index}`; const statsId = `scc-chart-stats-${index}`; const loader = document.getElementById(loaderId); const titleEl = document.getElementById(titleId); const statsEl = document.getElementById(statsId); if (!symbol) {
    if (loader) { loader.innerHTML = '<span style="color:var(--dim)">Enter symbol</span>'; loader.style.display = 'flex'; }
    return;
  }
  const input = document.getElementById(`scc-chart-input-${index}`); if (input && input.value !== symbol) { input.value = symbol; }
  if (loader) { loader.style.display = 'flex'; loader.innerHTML = 'Loading chart…'; }
  let range = '1y'; let interval = '1d'; if (timeframe === '1H') { range = '2y'; interval = '60m'; } else if (timeframe === 'D') { range = '1y'; interval = '1d'; } else if (timeframe === 'W') { range = '2y'; interval = '1wk'; } else if (timeframe === 'M') { range = '5y'; interval = '1mo'; }
  const details = getStockDetails(symbol); const companyName = details.company; if (titleEl) {
    titleEl.innerHTML = `
      <div style="display:flex; flex-direction:column; min-width:0; line-height:1.2;">
        <div style="display:flex; align-items:center; gap:6px;">
          <span style="font-family:var(--disp); font-size:11px; font-weight:800; color:var(--teal);">${details.symbol}</span>
          <span style="font-size:9px; color:var(--text); font-weight:500; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:140px;" title="${details.company}">${details.company}</span>
        </div>
        <div style="display:flex; align-items:center; gap:4px; font-size:9px; color:var(--dim); margin-top:2px;">
          <span style="background:rgba(255,255,255,0.04); padding:1px 4px; border-radius:2px; border:1px solid var(--border); white-space:nowrap;">${details.sector}</span>
          <span style="color:var(--sub); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:140px;" title="${details.industry}">${details.industry}</span>
        </div>
      </div>
    `;
  }
  const tableEl = document.getElementById(`scc-chart-table-${index}`); if (tableEl) { tableEl.innerHTML = generateStatsTableHtml(details); }
  try {
    const [candles, niftyCandles] = await Promise.all([fetchYfData(symbol.toUpperCase(), range, interval), symbol.toUpperCase() !== '^NSEI' ? fetchYfData('^NSEI', range, interval).catch(() => null) : Promise.resolve(null)]); if (loader) loader.style.display = 'none'; const lwDone = sccRenderLwChart(index, candles, niftyCandles); if (!lwDone) { const canvas = document.getElementById(canvasId); let drawCountOverride = null; if (canvas && candles && candles.length > 0) { const rect = canvas.getBoundingClientRect(); const minCandlePx = (_sccChartType === 'ohlc') ? 3 : 4; const maxFitCount = Math.max(20, Math.floor(rect.width / minCandlePx)); const totalCount = candles.length; const defaultDrawCount = Math.min(totalCount, maxFitCount); const zoomFactor = _sccChartZoomFactors[index] || 1.0; drawCountOverride = Math.min(totalCount, Math.max(10, Math.round(defaultDrawCount * zoomFactor))); } drawAnyChart(canvasId, candles, _sccChartType, drawCountOverride, niftyCandles); }
    const canvas = document.getElementById(canvasId); if (!lwDone && canvas && !canvas.dataset.hasWheelListener) {
      canvas.dataset.hasWheelListener = "true"; canvas.addEventListener('wheel', (e) => {
        e.preventDefault(); sccChartSetActivePanel(index); let zoomFactor = _sccChartZoomFactors[index] || 1.0; if (e.deltaY < 0) { zoomFactor *= 0.85; } else { zoomFactor *= 1.15; }
        zoomFactor = Math.max(0.15, Math.min(5.0, zoomFactor)); _sccChartZoomFactors[index] = zoomFactor; localStorage.setItem('_sccChartZoomFactors', JSON.stringify(_sccChartZoomFactors)); sccChartRenderPanel(index);
      }, { passive: false });
    }
    if (candles && candles.length > 0) {
      const lastCandle = candles[candles.length - 1]; const prevCandle = candles.length > 1 ? candles[candles.length - 2] : lastCandle; const price = lastCandle.close; const pctChange = ((price - prevCandle.close) / prevCandle.close) * 100; const sign = pctChange >= 0 ? '+' : ''; const color = pctChange >= 0 ? 'var(--lime)' : 'var(--red)'; let statsStr = `<span style="font-family:var(--mono);font-weight:600;margin-right:2px">${price.toFixed(1)}</span>
                      <span style="color:${color};font-family:var(--mono);font-weight:600;margin-right:2px">${sign}${pctChange.toFixed(1)}%</span>`; if (statsEl) statsEl.innerHTML = statsStr;
    }
  } catch (err) {
    console.error("YF scc chart error for " + symbol, err); if (loader) {
      loader.innerHTML = `
        <div style="color:var(--sub);font-size:10px;text-align:center;padding:12px;line-height:1.5;">
          <span style="color:var(--red);font-weight:600;display:block;margin-bottom:4px;">Failed to load data</span>
          Check connection or proxy.
        </div>`;
    }
  }
}

function sccChartInputHandler(index, value) {
  sccChartSuggestInput(index, value); const upperVal = value.toUpperCase().trim(); if (_sccSyncSymbols) { const count = sccChartGetCount(); for (let i = 0; i < count; i++) { sccChartSetSymbol(i, upperVal); } } else { sccChartSetSymbol(index, upperVal); }
  if (window._sccChartTypingTimeout) clearTimeout(window._sccChartTypingTimeout); window._sccChartTypingTimeout = setTimeout(() => { if (_sccSyncSymbols) { const count = sccChartGetCount(); for (let i = 0; i < count; i++) { sccChartRenderPanel(i); } } else { sccChartRenderPanel(index); } }, 500);
}
function sccChartSuggestInput(index, val) {
  const suggestBox = document.getElementById(`scc-chart-suggest-${index}`); if (!suggestBox) return; const query = val.trim().toLowerCase(); if (!query) { suggestBox.style.display = 'none'; suggestBox.innerHTML = ''; return; }
  let allStocks = n500CsvGetCached() || []; if (allStocks.length === 0 && _sdCurrentData?.stocks) { allStocks = _sdCurrentData.stocks; }
  const matches = []; for (const s of allStocks) { if ((s.symbol && s.symbol.toLowerCase().includes(query)) || (s.company && s.company.toLowerCase().includes(query))) { matches.push(s); if (matches.length >= 6) break; } }
  if (matches.length === 0) { suggestBox.style.display = 'none'; suggestBox.innerHTML = ''; return; }
  suggestBox.innerHTML = matches.map(s => {
    return `
      <div class="max-suggest-item" onclick="sccChartSelectStock(${index}, '${s.symbol.replace(/'/g, "\\'")}')">
        <span style="font-weight:700;color:var(--teal);">${s.symbol}</span>
        <span class="comp-name" style="max-width:90px">${s.company || ''}</span>
      </div>`;
  }).join(''); suggestBox.style.display = 'block';
}
function sccChartSelectStock(index, symbol) {
  const suggestBox = document.getElementById(`scc-chart-suggest-${index}`); if (suggestBox) suggestBox.style.display = 'none'; if (_sccSyncSymbols) { const count = sccChartGetCount(); for (let i = 0; i < count; i++) { sccChartSetSymbol(i, symbol); } } else { sccChartSetSymbol(index, symbol); }
  sccChartRebuildGrid();
}
function sccChartSubmitSymbol(index, value) {
  const upperVal = value.toUpperCase().trim(); const suggestBox = document.getElementById(`scc-chart-suggest-${index}`); if (suggestBox) suggestBox.style.display = 'none'; if (_sccSyncSymbols) { const count = sccChartGetCount(); for (let i = 0; i < count; i++) { sccChartSetSymbol(i, upperVal); } } else { sccChartSetSymbol(index, upperVal); }
  sccChartRebuildGrid();
}
function sccChartSetLayout(val) { _sccChartLayout = val; localStorage.setItem('_sccChartLayout', val); sccChartRebuildGrid(); }
function sccChartSetType(val) { _sccChartType = val; localStorage.setItem('_sccChartType', val); const count = sccChartGetCount(); for (let i = 0; i < count; i++) { sccChartRenderPanel(i); } }
function sccChartSetTimeframe(index, val) { _sccChartTimeframes[index] = val; localStorage.setItem('_sccChartTimeframes', JSON.stringify(_sccChartTimeframes)); sccChartRenderPanel(index); }
function sccChartSetSync(checked) {
  _sccSyncSymbols = checked; localStorage.setItem('_sccSyncSymbols', JSON.stringify(checked)); const globalWrap = document.getElementById('scc-chart-global-sym-wrap'); if (globalWrap) { globalWrap.style.display = checked ? 'flex' : 'none'; }
  if (checked) {
    const primarySymbol = sccChartGetSymbol(0) || 'RELIANCE'; const count = sccChartGetCount(); for (let i = 0; i < count; i++) { sccChartSetSymbol(i, primarySymbol); }
    sccChartRebuildGrid();
  }
}
function sccChartGlobalInput(value) {
  sccChartGlobalSuggest(value); const upperVal = value.toUpperCase().trim(); for (let i = 0; i < _sccChartSymbols.length; i++) { _sccChartSymbols[i] = upperVal; }
  localStorage.setItem('_sccChartSymbols', JSON.stringify(_sccChartSymbols)); if (window._sccChartGlobalTimeout) clearTimeout(window._sccChartGlobalTimeout); window._sccChartGlobalTimeout = setTimeout(() => { const count = parseInt(_sccChartLayout); for (let i = 0; i < count; i++) { sccChartRenderPanel(i); } }, 500);
}
function sccChartGlobalSuggest(val) {
  const suggestBox = document.getElementById('scc-chart-global-suggest'); if (!suggestBox) return; const query = val.trim().toLowerCase(); if (!query) { suggestBox.style.display = 'none'; suggestBox.innerHTML = ''; return; }
  let allStocks = n500CsvGetCached() || []; if (allStocks.length === 0 && _sdCurrentData?.stocks) { allStocks = _sdCurrentData.stocks; }
  const matches = []; for (const s of allStocks) { if ((s.symbol && s.symbol.toLowerCase().includes(query)) || (s.company && s.company.toLowerCase().includes(query))) { matches.push(s); if (matches.length >= 8) break; } }
  if (matches.length === 0) { suggestBox.style.display = 'none'; suggestBox.innerHTML = ''; return; }
  suggestBox.innerHTML = matches.map(s => {
    return `
      <div class="max-suggest-item" onclick="sccChartGlobalSelect('${s.symbol.replace(/'/g, "\\'")}')">
        <span style="font-weight:700;color:var(--teal);">${s.symbol}</span>
        <span class="comp-name">${s.company || ''}</span>
      </div>`;
  }).join(''); suggestBox.style.display = 'block';
}
function sccChartGlobalSelect(symbol) {
  const globalInput = document.getElementById('scc-chart-global-symbol'); if (globalInput) globalInput.value = symbol; const suggestBox = document.getElementById('scc-chart-global-suggest'); if (suggestBox) suggestBox.style.display = 'none'; for (let i = 0; i < _sccChartSymbols.length; i++) { _sccChartSymbols[i] = symbol; }
  localStorage.setItem('_sccChartSymbols', JSON.stringify(_sccChartSymbols)); sccChartRebuildGrid();
}
function sccSaveWatchlistsLocalAndSync() { localStorage.setItem('_sccWatchlists', JSON.stringify(_sccWatchlists)); localStorage.setItem('_sccSymbolFlags', JSON.stringify(_sccSymbolFlags)); const now = Date.now(); localStorage.setItem('_sccWatchlistsUpdatedAt', now.toString()); pushToCloud(); }
function sccApplyWatchlistVisibility() {
  const panel = document.getElementById('scc-watchlist-panel'); const btn = document.getElementById('scc-watchlist-toggle-btn'); if (!panel) return; if (_sccShowWatchlist) {
    panel.style.display = 'flex'; if (btn) { btn.style.background = 'rgba(91, 163, 245, 0.15)'; btn.style.borderColor = 'var(--accent)'; btn.style.color = 'var(--text)'; }
    sccWatchlistFetchAll();
  } else { panel.style.display = 'none'; if (btn) { btn.style.background = 'rgba(91, 163, 245, 0.06)'; btn.style.borderColor = 'rgba(91, 163, 245, 0.2)'; btn.style.color = 'var(--accent)'; } }
}
function sccToggleWatchlist() { _sccShowWatchlist = !_sccShowWatchlist; localStorage.setItem('_sccShowWatchlist', _sccShowWatchlist); sccApplyWatchlistVisibility(); }
function sccGetOrderedTabs() {
  const colorsMap = { red: '#ef4444', blue: '#3b82f6', green: '#22c55e', yellow: '#eab308', purple: '#a855f7', cyan: '#06b6d4', pink: '#ec4899' };
  if (typeof _sccWatchlists === 'object' && _sccWatchlists) {
    Object.keys(_sccWatchlists).forEach(name => {
      if (name.startsWith('__flag') || name.startsWith('__flage')) {
        const match = name.match(/__flag[e]?_([a-zA-Z]+)/);
        if (match) {
          const c = match[1].toLowerCase();
          const syms = _sccWatchlists[name] || [];
          syms.forEach(s => { _sccSymbolFlags[s.toUpperCase()] = c; });
        }
        delete _sccWatchlists[name];
      }
    });
  }

  const rawTabs = Object.keys(_sccWatchlists || {}).concat(['VCP']);
  Object.keys(colorsMap).forEach(c => {
    const hasSymbols = Object.keys(_sccSymbolFlags || {}).some(sym => _sccSymbolFlags[sym] === c);
    if (hasSymbols || _sccActiveWatchlist === `__flag_${c}` || _sccActiveWatchlist === `__flage_${c}`) {
      rawTabs.push(`__flag_${c}`);
    }
  });

  let savedOrder = [];
  try {
    savedOrder = JSON.parse(localStorage.getItem('_sccCustomTabOrder') || '[]');
  } catch (e) { }

  const ordered = [];
  savedOrder.forEach(t => {
    if (rawTabs.includes(t) && !ordered.includes(t)) ordered.push(t);
  });
  rawTabs.forEach(t => {
    if (!ordered.includes(t)) ordered.push(t);
  });
  return ordered;
}
window.sccGetOrderedTabs = sccGetOrderedTabs;

function sccWlRenderTabs() {
  const tabsBar = document.getElementById('scc-wl-tabs-bar');
  if (!tabsBar) return;
  const colorsMap = { red: '#ef4444', blue: '#3b82f6', green: '#22c55e', yellow: '#eab308', purple: '#a855f7', cyan: '#06b6d4', pink: '#ec4899' };
  const orderedTabs = sccGetOrderedTabs();
  let html = '';

  orderedTabs.forEach(name => {
    const isActive = (name === _sccActiveWatchlist) || (name.startsWith('__flag_') && _sccActiveWatchlist === name.replace('__flag_', '__flage_'));
    const isFlag = name.startsWith('__flag_') || name.startsWith('__flage_');
    const isVcp = (name === 'VCP');
    const tabColor = isActive ? 'var(--teal)' : 'var(--dim)';
    const borderStyle = isActive ? 'border-bottom: 2px solid var(--teal); font-weight: 700;' : 'border-bottom: 2px solid transparent; font-weight: 600;';

    if (isFlag) {
      const c = name.replace(/^__flag[e]?_/, '');
      const flagCol = colorsMap[c] || c;
      html += `
        <div onclick="sccWlSwitchTab('${name}')" 
             draggable="true"
             ondragstart="sccTabDragStart(event, '${name}')"
             ondragover="sccTabDragOver(event)"
             ondrop="sccTabDrop(event, '${name}')"
             ondragend="sccTabDragEnd(event)"
             title="${c.toUpperCase()} Flag Watchlist"
             style="padding: 6px 10px; ${borderStyle} cursor:pointer; display:flex; align-items:center; height: 100%; box-sizing:border-box; transition: opacity 0.15s; opacity: ${isActive ? '1' : '0.5'}"
             onmouseover="this.style.opacity='1'"
             onmouseout="this.style.opacity='${isActive ? '1' : '0.5'}'">
          <svg width="8" height="14" viewBox="0 0 10 18" fill="${flagCol}">
            <path d="M0 0h10v18l-5-4-5 4V0z"/>
          </svg>
        </div>
      `;
    } else if (isVcp) {
      html += `
        <div onclick="sccWlSwitchTab('VCP')" 
             draggable="true"
             ondragstart="sccTabDragStart(event, 'VCP')"
             ondragover="sccTabDragOver(event)"
             ondrop="sccTabDrop(event, 'VCP')"
             ondragend="sccTabDragEnd(event)"
             style="padding: 6px 8px; font-size:10px; color:${tabColor}; ${borderStyle} cursor:pointer; display:flex; align-items:center; gap:2px; height: 100%; box-sizing:border-box; user-select:none; transition: color 0.15s;"
             onmouseover="this.style.color='var(--text)'"
             onmouseout="this.style.color='${isActive ? 'var(--teal)' : 'var(--dim)'}'">
          <span>⚡ VCP</span>
        </div>
      `;
    } else {
      const keys = Object.keys(_sccWatchlists || {});
      const closeBtn = keys.length > 1 ? `<span class="scc-wl-tab-close" onclick="event.stopPropagation(); sccWlDeleteTab('${name.replace(/'/g, "\\'")}')" style="font-size:11px; margin-left:6px; opacity:0.5; color:var(--dim); cursor:pointer; font-weight:bold; width:12px; display:inline-flex; align-items:center; justify-content:center; border-radius:50%;" onmouseover="this.style.opacity='1'; this.style.color='var(--red)';" onmouseout="this.style.opacity='0.5'; this.style.color='var(--dim)';">×</span>` : '';
      html += `
        <div onclick="sccWlSwitchTab('${name.replace(/'/g, "\\'")}')" 
             draggable="true"
             ondragstart="sccTabDragStart(event, '${name.replace(/'/g, "\\'")}')"
             ondragover="sccTabDragOver(event)"
             ondrop="sccTabDrop(event, '${name.replace(/'/g, "\\'")}')"
             ondragend="sccTabDragEnd(event)"
             style="padding: 6px 8px; font-size:10px; color:${tabColor}; ${borderStyle} cursor:pointer; display:flex; align-items:center; gap:2px; height: 100%; box-sizing:border-box; user-select:none; transition: color 0.15s;"
             onmouseover="this.style.color='var(--text)'"
             onmouseout="this.style.color='${isActive ? 'var(--teal)' : 'var(--dim)'}'">
          <span>${name}</span>
          ${closeBtn}
        </div>
      `;
    }
  });

  html += `
    <button onclick="sccWlCreateTabPrompt()" title="Create new watch list"
            style="background:none; border:none; color:var(--accent); font-size:14px; font-weight:bold; cursor:pointer; padding:4px 8px; outline:none; display:flex; align-items:center; justify-content:center; height: 100%;"
            onmouseover="this.style.color='var(--text)'" onmouseout="this.style.color='var(--accent)'">+</button>
  `;
  tabsBar.innerHTML = html;
  if (typeof updateMaxChartSidebarWatchlist === 'function') {
    updateMaxChartSidebarWatchlist();
  }
}
function sccWlSwitchTab(name) {
  _sccActiveWatchlist = name; localStorage.setItem('_sccActiveWatchlist', _sccActiveWatchlist); _sccWlSelectedSymbols = []; _sccWlLastSelectedSymbol = null; _sccWlIsBreadthSorted = false; if (name === 'VCP') { _sccWatchlistSymbols = []; } else if (name.startsWith('__flag_')) { const color = name.replace('__flag_', ''); _sccWatchlistSymbols = Object.keys(_sccSymbolFlags).filter(s => _sccSymbolFlags[s] === color); } else { _sccWatchlistSymbols = _sccWatchlists[name] || []; }
  sccWlRenderTabs(); sccWatchlistRender(); sccWatchlistFetchAll();
  if (_sccChartLayout === 'watchlist') sccChartRebuildGrid();
}
function sccWlCreateTabPrompt() {
  const name = prompt("Enter new Watch List name:"); if (name === null) return; const cleaned = name.trim(); if (!cleaned) { alert("Watch List name cannot be empty."); return; }
  if (_sccWatchlists[cleaned]) { alert("A Watch List with this name already exists."); return; }
  _sccWatchlists[cleaned] = []; _sccActiveWatchlist = cleaned; _sccWatchlistSymbols = _sccWatchlists[cleaned]; localStorage.setItem('_sccActiveWatchlist', _sccActiveWatchlist); sccSaveWatchlistsLocalAndSync(); _sccWlSelectedSymbols = []; _sccWlLastSelectedSymbol = null; sccWlRenderTabs(); sccWatchlistRender(); sccWatchlistFetchAll();
}
function sccWlDeleteTab(name) {
  if (confirm(`Are you sure you want to delete the watchlist "${name}"?`)) {
    delete _sccWatchlists[name]; if (_sccActiveWatchlist === name) { const keys = Object.keys(_sccWatchlists); _sccActiveWatchlist = keys[0] || "Main"; _sccWatchlistSymbols = _sccWatchlists[_sccActiveWatchlist]; localStorage.setItem('_sccActiveWatchlist', _sccActiveWatchlist); }
    sccSaveWatchlistsLocalAndSync(); _sccWlSelectedSymbols = []; _sccWlLastSelectedSymbol = null; sccWlRenderTabs(); sccWatchlistRender(); sccWatchlistFetchAll();
  }
}
function sccWatchlistRender() {
  let watchlistItems = []; let flatSymbols = []; const isRowDraggable = _sccActiveWatchlist !== 'VCP' && !_sccWlIsBreadthSorted; if (_sccActiveWatchlist === 'VCP') {
    const cachedDrill = sectorDrillGetCached(); const activeMap = cachedDrill ? (_vcpbViewMode === 'industry' ? cachedDrill.industries : cachedDrill.sectors) : null; if (cachedDrill && activeMap) {
      calculateRSRatings(cachedDrill); let sortedSectors; if (_sccWlIsBreadthSorted) { const rankedSectors = sccGetRankedSectors(); sortedSectors = Object.keys(activeMap).sort((a, b) => { let rankA = rankedSectors.indexOf(a); let rankB = rankedSectors.indexOf(b); if (rankA === -1) rankA = 9999; if (rankB === -1) rankB = 9999; return rankA - rankB; }); } else { sortedSectors = Object.keys(activeMap).sort(); }
      sortedSectors.forEach(secName => { const sec = activeMap[secName]; if (sec && Array.isArray(sec.stocks) && sec.stocks.length > 0) { const isCollapsed = _sccWlCollapsedSectors.has(secName); watchlistItems.push({ type: 'header', label: secName, collapsed: isCollapsed }); if (!isCollapsed) { const sortedStocks = [...sec.stocks].sort((a, b) => a.symbol.localeCompare(b.symbol)); sortedStocks.forEach(s => { watchlistItems.push({ type: 'stock', symbol: s.symbol }); flatSymbols.push(s.symbol.toUpperCase()); }); } } });
    }
    _sccWatchlistSymbols = flatSymbols;
  } else if (_sccActiveWatchlist.startsWith('__flag_')) { const color = _sccActiveWatchlist.replace('__flag_', ''); _sccWatchlistSymbols = Object.keys(_sccSymbolFlags).filter(s => _sccSymbolFlags[s] === color); _sccWatchlistSymbols.forEach(sym => { watchlistItems.push({ type: 'stock', symbol: sym }); }); } else { _sccWatchlistSymbols = _sccWatchlists[_sccActiveWatchlist] || []; _sccWatchlistSymbols.forEach(sym => { watchlistItems.push({ type: 'stock', symbol: sym }); }); }
  const countEl = document.getElementById('scc-wl-count'); if (countEl) countEl.innerText = `${_sccWatchlistSymbols.length} items`; const rowsContainer = document.getElementById('scc-wl-rows'); if (!rowsContainer) return; if (watchlistItems.length === 0) {
    rowsContainer.innerHTML = `
      <div style="color:var(--dim); padding:20px; text-align:center; font-size:11px;">
        Watch list is empty.
      </div>
    `; return;
  }
  const activeSymbols = _sccChartLayout === 'watchlist' ? _sccWatchlistSymbols.map(s => s ? s.toUpperCase() : '') : _sccChartSymbols.map(s => s ? s.toUpperCase() : ''); let html = ''; watchlistItems.forEach(item => {
    if (item.type === 'header') {
      const isCollapsed = item.collapsed; html += `
        <div class="scc-wl-section-hdr" onclick="sccWlToggleSector('${item.label.replace(/'/g, "\\'")}')" 
             style="padding: 6px 12px; background: var(--bg3); color: var(--teal); font-weight: 700; font-size: 10px; border-bottom: 1px solid var(--border); letter-spacing: 0.5px; text-transform: uppercase; margin-top: 4px; display: flex; align-items: center; justify-content: space-between; cursor: pointer; user-select: none;"
             onmouseover="this.style.background='var(--border)'"
             onmouseout="this.style.background='var(--bg3)'">
          <span>${item.label}</span>
          <span style="font-size: 8px; color: var(--dim);">${isCollapsed ? '▶' : '▼'}</span>
        </div>
      `; return;
    }
    const sym = item.symbol; const sUpper = sym.toUpperCase(); const data = _sccWatchlistData[sUpper]; const isSelected = _sccWlSelectedSymbols.includes(sUpper); const isChartActive = activeSymbols.includes(sUpper); let itemBg = 'background: transparent;'; if (isSelected) { itemBg = 'background: rgba(91, 163, 245, 0.15);'; } else if (isChartActive) { itemBg = 'background: rgba(91, 163, 245, 0.05);'; }
    const borderStyle = isChartActive ? 'border-left: 3px solid var(--accent);' : 'border-left: 3px solid transparent;'; const itemPadding = isChartActive ? 'padding: 8px 12px 8px 9px;' : 'padding: 8px 12px;'; const meta = findStockMetadata(sUpper); const companyName = meta.company; const flagColorName = _sccSymbolFlags[sUpper] || 'none'; const hasFlag = flagColorName !== 'none'; const colorsMap = { red: '#ef4444', blue: '#3b82f6', green: '#22c55e', yellow: '#eab308', purple: '#a855f7', cyan: '#06b6d4', pink: '#ec4899' }; const flagColor = hasFlag ? colorsMap[flagColorName] : 'var(--dim)'; const flagClass = hasFlag ? 'wl-flag-flagged' : 'wl-flag-unflagged'; let priceStr = '<span style="color:var(--dim)">...</span>'; let changeStr = '<span style="color:var(--dim)">...</span>'; if (data) { if (data.error) { priceStr = '<span style="color:var(--red)">Err</span>'; changeStr = '<span style="color:var(--red)">--</span>'; } else { priceStr = data.price.toFixed(1); const changeVal = data.change; const sign = changeVal >= 0 ? '+' : ''; const color = changeVal >= 0 ? 'var(--lime)' : 'var(--red)'; changeStr = `<span style="color:${color}">${sign}${changeVal.toFixed(1)}%</span>`; } }
    const showRemoveBtn = _sccActiveWatchlist !== 'VCP'; const removeBtnHtml = showRemoveBtn ? `
      <button class="wl-del-btn" onclick="event.stopPropagation(); sccWatchlistRemoveSymbol('${sUpper}');" title="Remove from Watch List"
              style="background:none; border:none; color:var(--dim); cursor:pointer; font-size:13px; font-weight:bold; padding:0 2px; opacity:0.3; transition:opacity 0.15s, color 0.15s; outline:none;"
              onmouseover="this.style.opacity='1'; this.style.color='var(--red)';"
              onmouseout="this.style.opacity='0.3'; this.style.color='var(--dim)';">
        ×
      </button>
    `: ''; const dragAttr = isRowDraggable ? `draggable="true" ondragstart="sccRowDragStart(event, '${sUpper}')" ondragover="sccRowDragOver(event)" ondrop="sccRowDrop(event, '${sUpper}')" ondragend="sccRowDragEnd(event)" ontouchstart="sccRowTouchStart(event, '${sUpper}')" ontouchmove="sccRowTouchMove(event)" ontouchend="sccRowTouchEnd(event)"` : ''; html += `
      <div class="scc-wl-item" id="scc-wl-item-${sUpper}" ${dragAttr}
           onclick="sccWlItemClick(event, '${sUpper}')" 
           oncontextmenu="sccWlItemContextMenu(event, '${sUpper}')"
           style="display:flex; align-items:center; justify-content:space-between; ${itemBg} ${borderStyle} ${itemPadding} border-bottom:1px solid rgba(255,255,255,0.03); cursor:pointer; transition:background 0.15s;"
           onmouseover="this.style.background='${isSelected ? 'rgba(91, 163, 245, 0.18)' : 'rgba(91, 163, 245, 0.04)'}'"
           onmouseout="this.style.background='${isSelected ? 'rgba(91, 163, 245, 0.15)' : (isChartActive ? 'rgba(91, 163, 245, 0.05)' : 'transparent')}'">

        <div style="display:flex; align-items:center; min-width:0; flex:1; padding-right:8px;">
          
          <svg class="${flagClass}" 
               onclick="sccWatchlistFlagClick(event, this, '${sUpper}')" 
               onmousedown="sccFlagPressStart(event, this, '${sUpper}')" 
               onmouseup="sccFlagPressEnd(event, this, '${sUpper}')" 
               onmouseleave="sccFlagPressCancel()"
               ontouchstart="sccFlagPressStart(event, this, '${sUpper}')" 
               ontouchend="sccFlagPressEnd(event, this, '${sUpper}')" 
               ontouchmove="sccFlagPressCancel()"
               width="8" height="14" viewBox="0 0 10 18" 
               fill="${flagColor}" 
               style="cursor:pointer; color:${flagColor}; margin-right:8px; flex-shrink:0;"
               title="${hasFlag ? 'Click to remove flag, hold to change color' : 'Click to choose flag'}">
            <path d="M0 0h10v18l-5-4-5 4V0z"/>
          </svg>
          
          <div style="display:flex; flex-direction:column; min-width:0; flex:1;">
            <span style="font-weight:700; color:var(--text); font-size:12px; font-family:var(--body);">${sUpper}</span>
            <span style="font-size:9px; color:var(--dim); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${companyName}">${companyName}</span>
          </div>
        </div>

        <div style="font-family:var(--mono); font-size:11px; font-weight:600; text-align:right; margin-right:12px; width:70px; flex-shrink:0; color:var(--text);">
          ${priceStr}
        </div>

        <div style="width:65px; text-align:right; flex-shrink:0; display:flex; align-items:center; justify-content:flex-end; gap:6px;">
          <span style="font-family:var(--mono); font-weight:600; font-size:11px;">
            ${changeStr}
          </span>
          ${removeBtnHtml}
        </div>
      </div>
    `;
  }); rowsContainer.innerHTML = html;
}
function sccWlToggleSector(secName) {
  if (_sccWlCollapsedSectors.has(secName)) { _sccWlCollapsedSectors.delete(secName); } else { _sccWlCollapsedSectors.add(secName); }
  sccWatchlistRender();
}
function sccGetStockSector(symbol) {
  if (!symbol) return 'Other'; const sUpper = symbol.toUpperCase().replace('.NS', ''); const cachedDrill = sectorDrillGetCached(); if (cachedDrill) { const activeMap = _vcpbViewMode === 'industry' ? cachedDrill.industries : cachedDrill.sectors; if (activeMap) { for (const secName in activeMap) { const sec = activeMap[secName]; if (sec && Array.isArray(sec.stocks)) { if (sec.stocks.some(x => x.symbol && x.symbol.toUpperCase() === sUpper)) { return secName; } } } } }
  const allStocks = n500CsvGetCached() || []; const found = allStocks.find(s => s.symbol && s.symbol.toUpperCase() === sUpper); if (found) { if (_vcpbViewMode === 'industry') { if (typeof csvIndustryMap === 'function') { return csvIndustryMap(found.symbol, found.company || '', found.industry || ''); } } else { if (typeof csvSectorMap === 'function') { return csvSectorMap(found.symbol, found.company || '', found.industry || ''); } } }
  return 'Other';
}
function sccGetRankedSectors() { const cached = vcpbGetCached(); const activeList = cached ? (_vcpbViewMode === 'industry' ? cached.industries : cached.sectors) : null; if (!cached || !Array.isArray(activeList)) return []; const list = activeList.map(s => { return { sector: s.sector, score: typeof vcpbScore === 'function' ? vcpbScore(s) : (s.composite || 0) }; }); list.sort((a, b) => b.score - a.score); return list.map(x => x.sector); }
function sccWlSortByBreadth() {
  if (_sccWlIsBreadthSorted) return; if (!_sccWlOriginalOrders[_sccActiveWatchlist]) { if (_sccActiveWatchlist === 'VCP') { } else if (_sccActiveWatchlist.startsWith('__flag_')) { } else { _sccWlOriginalOrders[_sccActiveWatchlist] = [...(_sccWatchlists[_sccActiveWatchlist] || [])]; } }
  _sccWlIsBreadthSorted = true; if (_sccActiveWatchlist !== 'VCP' && !_sccActiveWatchlist.startsWith('__flag_')) {
    const rankedSectors = sccGetRankedSectors(); const currentList = _sccWatchlists[_sccActiveWatchlist] || []; const sorted = [...currentList].sort((a, b) => {
      const secA = sccGetStockSector(a); const secB = sccGetStockSector(b); let rankA = rankedSectors.indexOf(secA); let rankB = rankedSectors.indexOf(secB); if (rankA === -1) rankA = 9999; if (rankB === -1) rankB = 9999; if (rankA !== rankB) { return rankA - rankB; }
      return a.localeCompare(b);
    }); _sccWatchlists[_sccActiveWatchlist] = sorted; _sccWatchlistSymbols = sorted; sccSaveWatchlistsLocalAndSync();
  }
  sccWatchlistRender();
  if (_sccChartLayout === 'watchlist') sccChartRebuildGrid();
}
function sccWlResetOrder() {
  if (!_sccWlIsBreadthSorted) return; _sccWlIsBreadthSorted = false; if (_sccActiveWatchlist !== 'VCP' && !_sccActiveWatchlist.startsWith('__flag_')) { const orig = _sccWlOriginalOrders[_sccActiveWatchlist]; if (orig) { _sccWatchlists[_sccActiveWatchlist] = [...orig]; _sccWatchlistSymbols = _sccWatchlists[_sccActiveWatchlist]; sccSaveWatchlistsLocalAndSync(); } }
  sccWatchlistRender();
  if (_sccChartLayout === 'watchlist') sccChartRebuildGrid();
}
function sccWlCopySymbols() {
  const symbols = [...new Set(_sccWatchlistSymbols.map(s => s.trim().toUpperCase()))].filter(Boolean); if (symbols.length === 0) { alert('Watch List is empty. Nothing to copy.'); return; }
  if (symbols.length <= 10) { const text = symbols.join(', '); navigator.clipboard.writeText(text).then(() => { alert(`Copied ${symbols.length} symbol(s) to clipboard:\n\n${text}`); }).catch(err => { console.error('Failed to copy symbols: ', err); sccWlOpenCopyModal(symbols, text); }); } else {
    const lines = []; for (let i = 0; i < symbols.length; i += 10) { lines.push(symbols.slice(i, i + 10).join(',')); }
    const text = lines.join(',\n'); sccWlOpenCopyModal(symbols, text);
  }
}
function sccWlOpenCopyModal(symbols, text) { const overlay = document.getElementById('scc-wl-copy-overlay'); const textarea = document.getElementById('scc-wl-copy-textarea'); const countEl = document.getElementById('scc-wl-copy-count'); if (overlay && textarea && countEl) { countEl.textContent = symbols.length; textarea.value = text; overlay.classList.add('open'); textarea.select(); } }
function sccWlCloseCopyModal() { const overlay = document.getElementById('scc-wl-copy-overlay'); if (overlay) { overlay.classList.remove('open'); } }
function sccWlCopyTextareaContent() { const textarea = document.getElementById('scc-wl-copy-textarea'); if (textarea) { textarea.select(); navigator.clipboard.writeText(textarea.value).then(() => { alert('Copied to clipboard!'); sccWlCloseCopyModal(); }).catch(err => { console.error('Failed to copy text: ', err); alert('Failed to copy to clipboard. Please copy manually from the text window.'); }); } }
function sccTabDragStart(event, name) { _sccDraggedTabName = name; event.dataTransfer.effectAllowed = 'move'; event.target.style.opacity = '0.4'; }
function sccTabDragOver(event) { event.preventDefault(); event.dataTransfer.dropEffect = 'move'; }
function sccTabDrop(event, targetName) {
  event.preventDefault();
  if (!_sccDraggedTabName || _sccDraggedTabName === targetName) return;
  const tabs = sccGetOrderedTabs();
  const fromIndex = tabs.indexOf(_sccDraggedTabName);
  const toIndex = tabs.indexOf(targetName);
  if (fromIndex !== -1 && toIndex !== -1) {
    tabs.splice(fromIndex, 1);
    tabs.splice(toIndex, 0, _sccDraggedTabName);
    localStorage.setItem('_sccCustomTabOrder', JSON.stringify(tabs));
    sccWlRenderTabs();
    if (typeof updateMaxChartSidebarWatchlist === 'function') updateMaxChartSidebarWatchlist();
  }
}
function sccTabDragEnd(event) { event.target.style.opacity = '1'; _sccDraggedTabName = null; }
function sccRowDragStart(event, symbol) { _sccDraggedRowSymbol = symbol.toUpperCase(); event.dataTransfer.effectAllowed = 'move'; event.currentTarget.classList.add('wl-dragging'); }
function sccRowDragOver(event) { event.preventDefault(); event.dataTransfer.dropEffect = 'move'; }
function sccRowDrop(event, targetSymbol) { event.preventDefault(); const dragSym = _sccDraggedRowSymbol; const targetSym = targetSymbol.toUpperCase(); if (!dragSym || dragSym === targetSym) return; sccPerformStockSwap(dragSym, targetSym); }
function sccRowDragEnd(event) { event.currentTarget.classList.remove('wl-dragging'); _sccDraggedRowSymbol = null; }
function sccRowTouchStart(event, symbol) { const touch = event.touches[0]; _sccTouchStartY = touch.clientY; _sccTouchDraggedSym = symbol.toUpperCase(); _sccTouchDraggedEl = event.currentTarget; _sccTouchActive = false; _sccTouchTimeout = setTimeout(() => { _sccTouchActive = true; if (_sccTouchDraggedEl) { _sccTouchDraggedEl.classList.add('wl-dragging'); } }, 250); }
function sccRowTouchMove(event) {
  if (!_sccTouchDraggedSym) return; const touch = event.touches[0]; if (!_sccTouchActive) {
    if (Math.abs(touch.clientY - _sccTouchStartY) > 10) { clearTimeout(_sccTouchTimeout); _sccTouchDraggedSym = null; _sccTouchDraggedEl = null; }
    return;
  }
  event.preventDefault(); const elementUnderTouch = document.elementFromPoint(touch.clientX, touch.clientY); if (!elementUnderTouch) return; const targetEl = elementUnderTouch.closest('.scc-wl-item'); if (!targetEl || targetEl === _sccTouchDraggedEl) return; const targetSym = targetEl.id.replace('scc-wl-item-', '').toUpperCase(); if (!targetSym || targetSym === _sccTouchDraggedSym) return; sccPerformStockSwap(_sccTouchDraggedSym, targetSym); const newDraggedEl = document.getElementById(`scc-wl-item-${_sccTouchDraggedSym}`); if (newDraggedEl) { _sccTouchDraggedEl = newDraggedEl; _sccTouchDraggedEl.classList.add('wl-dragging'); }
}
function sccRowTouchEnd(event) {
  clearTimeout(_sccTouchTimeout); if (_sccTouchDraggedEl) { _sccTouchDraggedEl.classList.remove('wl-dragging'); }
  _sccTouchDraggedSym = null; _sccTouchDraggedEl = null; _sccTouchActive = false;
}
function sccPerformStockSwap(dragSym, targetSym) { dragSym = dragSym.toUpperCase(); targetSym = targetSym.toUpperCase(); if (dragSym === targetSym) return; if (_sccActiveWatchlist.startsWith('__flag_')) { const color = _sccActiveWatchlist.replace('__flag_', ''); const currentList = Object.keys(_sccSymbolFlags).filter(s => _sccSymbolFlags[s] === color); const fromIndex = currentList.indexOf(dragSym); const toIndex = currentList.indexOf(targetSym); if (fromIndex !== -1 && toIndex !== -1) { currentList.splice(fromIndex, 1); currentList.splice(toIndex, 0, dragSym); const newFlags = {}; currentList.forEach(s => { newFlags[s] = color; }); Object.keys(_sccSymbolFlags).forEach(s => { if (_sccSymbolFlags[s] !== color) { newFlags[s] = _sccSymbolFlags[s]; } }); _sccSymbolFlags = newFlags; _sccWatchlistSymbols = currentList; sccSaveWatchlistsLocalAndSync(); sccWatchlistRender(); } } else if (_sccActiveWatchlist !== 'VCP') { const currentList = _sccWatchlists[_sccActiveWatchlist] || []; const fromIndex = currentList.indexOf(dragSym); const toIndex = currentList.indexOf(targetSym); if (fromIndex !== -1 && toIndex !== -1) { currentList.splice(fromIndex, 1); currentList.splice(toIndex, 0, dragSym); _sccWatchlists[_sccActiveWatchlist] = currentList; _sccWatchlistSymbols = currentList; sccSaveWatchlistsLocalAndSync(); sccWatchlistRender(); } } if (_sccChartLayout === 'watchlist') sccChartRebuildGrid(); }
function sccFlagPressStart(event, element, symbol) { _sccFlagHoldActive = false; _sccFlagHoldTimeout = setTimeout(() => { _sccFlagHoldActive = true; sccWatchlistOpenFlagPopup(element, symbol); }, 350); }
function sccFlagPressEnd(event, element, symbol) { clearTimeout(_sccFlagHoldTimeout); if (_sccFlagHoldActive) { event.preventDefault(); event.stopPropagation(); } }
function sccFlagPressCancel() { clearTimeout(_sccFlagHoldTimeout); }
function sccWatchlistFlagClick(event, element, symbol) {
  if (event) { event.stopPropagation(); event.preventDefault(); }
  const sym = symbol.toUpperCase();
  sccWatchlistOpenFlagPopup(element, sym);
}
function sccWlItemClick(event, symbol) {
  const sym = symbol.toUpperCase(); const list = _sccWatchlistSymbols.map(s => s.toUpperCase()); const index = list.indexOf(sym); if (index === -1) return; if (event.ctrlKey || event.metaKey) {
    if (_sccWlSelectedSymbols.includes(sym)) { _sccWlSelectedSymbols = _sccWlSelectedSymbols.filter(s => s !== sym); } else { _sccWlSelectedSymbols.push(sym); }
    _sccWlLastSelectedSymbol = sym;
  } else if (event.shiftKey && _sccWlLastSelectedSymbol && list.includes(_sccWlLastSelectedSymbol)) { const lastIndex = list.indexOf(_sccWlLastSelectedSymbol); const start = Math.min(index, lastIndex); const end = Math.max(index, lastIndex); const range = list.slice(start, end + 1); range.forEach(s => { if (!_sccWlSelectedSymbols.includes(s)) { _sccWlSelectedSymbols.push(s); } }); _sccWlLastSelectedSymbol = sym; } else { _sccWlSelectedSymbols = [sym]; _sccWlLastSelectedSymbol = sym; sccWatchlistSelect(sym); }
  sccWatchlistRender();
}
function sccWlItemContextMenu(event, symbol) {
  event.preventDefault(); event.stopPropagation(); const sym = symbol.toUpperCase(); if (!_sccWlSelectedSymbols.includes(sym)) { _sccWlSelectedSymbols = [sym]; _sccWlLastSelectedSymbol = sym; sccWatchlistRender(); }
  sccWlOpenContextMenu(event);
}
function sccWlOpenContextMenu(event) {
  sccWlCloseContextMenu(); const menu = document.createElement('div'); menu.id = 'scc-wl-context-menu'; menu.style.position = 'fixed'; menu.style.zIndex = '999999'; menu.style.background = 'var(--bg3)'; menu.style.border = '1px solid var(--bdr2)'; menu.style.borderRadius = '6px'; menu.style.boxShadow = '0 10px 32px rgba(0,0,0,0.7)'; menu.style.padding = '6px 0'; menu.style.width = '200px'; menu.style.fontFamily = 'var(--body)'; menu.style.fontSize = '12px'; menu.style.color = 'var(--text)'; let left = event.clientX; let top = event.clientY; const menuWidth = 200; const menuHeight = 220; if (left + menuWidth > window.innerWidth) left = window.innerWidth - menuWidth - 10; if (top + menuHeight > window.innerHeight) top = window.innerHeight - menuHeight - 10; menu.style.left = `${left}px`; menu.style.top = `${top}px`; const flagColors = { red: '#ef4444', blue: '#3b82f6', green: '#22c55e', yellow: '#eab308', purple: '#a855f7', cyan: '#06b6d4', pink: '#ec4899' }; let html = `
    <div style="padding: 6px 12px; color: var(--dim); font-size: 10px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px;">
      Flag/Unflag selected
    </div>
    <div style="display: flex; gap: 6px; padding: 4px 12px; align-items: center; border-bottom: 1px solid var(--border); padding-bottom: 8px;">
  `; Object.keys(flagColors).forEach(c => {
    html += `
      <div onclick="sccWlSetFlagSelected('${c}')" 
           title="${c.toUpperCase()} Flag"
           style="width: 14px; height: 14px; border-radius: 50%; background: ${flagColors[c]}; cursor: pointer; transition: transform 0.1s;"
           onmouseover="this.style.transform='scale(1.2)'"
           onmouseout="this.style.transform='scale(1.0)'"></div>
    `;
  }); html += `
      <div onclick="sccWlSetFlagSelected('none')" 
           title="Clear Flag"
           style="width: 14px; height: 14px; border-radius: 50%; background: #475569; position: relative; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: transform 0.1s;"
           onmouseover="this.style.transform='scale(1.2)'"
           onmouseout="this.style.transform='scale(1.0)'">
        <div style="width: 100%; height: 1px; background: rgba(255,255,255,0.6); transform: rotate(45deg);"></div>
      </div>
    </div>
  `; const watchlistNames = Object.keys(_sccWatchlists); html += `
    <div class="scc-ctx-item" onclick="sccWlSetFlagSelected('none')" style="padding: 8px 16px; cursor: pointer; display: flex; align-items: center; justify-content: space-between; transition: background 0.15s;">
      <span>Unflag selected</span>
    </div>
    <div style="height: 1px; background: var(--border); margin: 4px 0;"></div>
  `; const otherLists = watchlistNames.filter(name => name !== _sccActiveWatchlist); if (otherLists.length > 0) {
    html += `
      <div class="scc-ctx-item scc-ctx-has-submenu" style="padding: 8px 16px; cursor: pointer; display: flex; align-items: center; justify-content: space-between; position: relative; transition: background 0.15s;">
        <span>Move selected to...</span>
        <span style="font-size: 10px; color: var(--dim);">▶</span>
        <div class="scc-ctx-submenu" style="display: none; position: absolute; left: 100%; top: 0; background: var(--bg3); border: 1px solid var(--border); border-radius: 6px; box-shadow: 0 10px 32px rgba(0,0,0,0.7); width: 160px; padding: 4px 0; z-index: 9999999;">
      `; otherLists.forEach(name => {
      html += `
          <div onclick="sccWlMoveSelectedTo('${name.replace(/'/g, "\\'")}')" 
               class="scc-ctx-item" 
               style="padding: 8px 16px; cursor: pointer; text-align: left; transition: background 0.15s;">
            ${name}
          </div>
        `;
    }); html += `
        </div>
      </div>
    `;
  } else {
    html += `
      <div class="scc-ctx-item disabled" style="padding: 8px 16px; color: var(--dim); cursor: not-allowed; display: flex; align-items: center; justify-content: space-between;">
        <span>Move selected to...</span>
      </div>
    `;
  }
  html += `
    <div class="scc-ctx-item" onclick="sccWlCreateListFromSelected()" style="padding: 8px 16px; cursor: pointer; display: flex; align-items: center; justify-content: space-between; transition: background 0.15s;">
      <span>Move to new list...</span>
    </div>
    <div style="height: 1px; background: var(--border); margin: 4px 0;"></div>
    <div class="scc-ctx-item" onclick="sccWlDeleteSelected()" style="padding: 8px 16px; cursor: pointer; color: var(--red); display: flex; align-items: center; justify-content: space-between; transition: background 0.15s;">
      <span>Delete selected</span>
      <span style="font-size: 10px; color: var(--dim); margin-left: 10px;">Del</span>
    </div>
  `; menu.innerHTML = html; document.body.appendChild(menu); const submenuTrigger = menu.querySelector('.scc-ctx-has-submenu'); if (submenuTrigger) { const submenu = submenuTrigger.querySelector('.scc-ctx-submenu'); submenuTrigger.addEventListener('mouseenter', () => { if (submenu) submenu.style.display = 'block'; }); submenuTrigger.addEventListener('mouseleave', () => { if (submenu) submenu.style.display = 'none'; }); }
  const items = menu.querySelectorAll('.scc-ctx-item'); items.forEach(item => { if (!item.classList.contains('disabled')) { item.addEventListener('mouseenter', () => { item.style.background = 'rgba(91, 163, 245, 0.1)'; }); item.addEventListener('mouseleave', () => { item.style.background = 'transparent'; }); } }); setTimeout(() => { document.addEventListener('click', sccWlCloseContextMenuOutside); document.addEventListener('contextmenu', sccWlCloseContextMenuOutside); }, 10);
}
function sccWlCloseContextMenu() {
  const menu = document.getElementById('scc-wl-context-menu'); if (menu) { menu.remove(); }
  document.removeEventListener('click', sccWlCloseContextMenuOutside); document.removeEventListener('contextmenu', sccWlCloseContextMenuOutside);
}
function sccWlCloseContextMenuOutside(e) { const menu = document.getElementById('scc-wl-context-menu'); if (menu && !menu.contains(e.target)) { sccWlCloseContextMenu(); } }
function sccWlSetFlagSelected(color) {
  _sccWlSelectedSymbols.forEach(sym => { const s = sym.toUpperCase(); if (color === 'none') { delete _sccSymbolFlags[s]; } else { _sccSymbolFlags[s] = color; } }); sccSaveWatchlistsLocalAndSync(); if (_sccActiveWatchlist.startsWith('__flag_')) { const activeColor = _sccActiveWatchlist.replace('__flag_', ''); _sccWatchlistSymbols = Object.keys(_sccSymbolFlags).filter(s => _sccSymbolFlags[s] === activeColor); const hasSymbols = Object.keys(_sccSymbolFlags).some(s => _sccSymbolFlags[s] === activeColor); if (!hasSymbols) { _sccActiveWatchlist = Object.keys(_sccWatchlists)[0] || "Main"; _sccWatchlistSymbols = _sccWatchlists[_sccActiveWatchlist] || []; localStorage.setItem('_sccActiveWatchlist', _sccActiveWatchlist); } }
  sccWlCloseContextMenu(); sccWlRenderTabs(); sccWatchlistRender();
}
function sccWlMoveSelectedTo(targetList) {
  const currentList = _sccWatchlists[_sccActiveWatchlist]; const target = _sccWatchlists[targetList]; _sccWlSelectedSymbols.forEach(sym => {
    const s = sym.toUpperCase(); if (_sccActiveWatchlist.startsWith('__flag_')) { delete _sccSymbolFlags[s]; } else if (currentList) { const idx = currentList.indexOf(s); if (idx !== -1) currentList.splice(idx, 1); }
    if (target && !target.includes(s)) { target.push(s); }
  }); sccSaveWatchlistsLocalAndSync(); if (_sccActiveWatchlist.startsWith('__flag_')) { const activeColor = _sccActiveWatchlist.replace('__flag_', ''); _sccWatchlistSymbols = Object.keys(_sccSymbolFlags).filter(s => _sccSymbolFlags[s] === activeColor); const hasSymbols = Object.keys(_sccSymbolFlags).some(s => _sccSymbolFlags[s] === activeColor); if (!hasSymbols) { _sccActiveWatchlist = Object.keys(_sccWatchlists)[0] || "Main"; _sccWatchlistSymbols = _sccWatchlists[_sccActiveWatchlist] || []; localStorage.setItem('_sccActiveWatchlist', _sccActiveWatchlist); } }
  sccWlCloseContextMenu(); _sccWlSelectedSymbols = []; _sccWlLastSelectedSymbol = null; sccWlRenderTabs(); sccWatchlistRender(); sccWatchlistFetchAll();
}
function sccWlCreateListFromSelected() {
  const name = prompt("Enter new Watch List name:"); if (name === null) return; const cleaned = name.trim(); if (!cleaned) { alert("Watch List name cannot be empty."); return; }
  if (_sccWatchlists[cleaned]) { alert("A Watch List with this name already exists."); return; }
  _sccWatchlists[cleaned] = [..._sccWlSelectedSymbols]; const currentList = _sccWatchlists[_sccActiveWatchlist]; _sccWlSelectedSymbols.forEach(sym => { const s = sym.toUpperCase(); if (_sccActiveWatchlist.startsWith('__flag_')) { delete _sccSymbolFlags[s]; } else if (currentList) { const idx = currentList.indexOf(s); if (idx !== -1) currentList.splice(idx, 1); } }); _sccActiveWatchlist = cleaned; _sccWatchlistSymbols = _sccWatchlists[cleaned]; localStorage.setItem('_sccActiveWatchlist', _sccActiveWatchlist); sccSaveWatchlistsLocalAndSync(); sccWlCloseContextMenu(); _sccWlSelectedSymbols = []; _sccWlLastSelectedSymbol = null; sccWlRenderTabs(); sccWatchlistRender(); sccWatchlistFetchAll();
}
function sccWlDeleteSelected() {
  if (_sccActiveWatchlist === 'VCP') { alert("VCP is an automatic system watchlist based on screener data and cannot be modified manually."); return; }
  if (_sccActiveWatchlist.startsWith('__flag_')) { const color = _sccActiveWatchlist.replace('__flag_', ''); _sccWlSelectedSymbols.forEach(sym => { delete _sccSymbolFlags[sym.toUpperCase()]; }); _sccWatchlistSymbols = Object.keys(_sccSymbolFlags).filter(s => _sccSymbolFlags[s] === color); const hasSymbols = Object.keys(_sccSymbolFlags).some(s => _sccSymbolFlags[s] === color); if (!hasSymbols) { _sccActiveWatchlist = Object.keys(_sccWatchlists)[0] || "Main"; _sccWatchlistSymbols = _sccWatchlists[_sccActiveWatchlist] || []; localStorage.setItem('_sccActiveWatchlist', _sccActiveWatchlist); } } else { const currentList = _sccWatchlists[_sccActiveWatchlist]; if (currentList) { _sccWlSelectedSymbols.forEach(sym => { const idx = currentList.indexOf(sym.toUpperCase()); if (idx !== -1) { currentList.splice(idx, 1); } }); } }
  sccSaveWatchlistsLocalAndSync(); sccWlCloseContextMenu(); _sccWlSelectedSymbols = []; _sccWlLastSelectedSymbol = null; sccWlRenderTabs(); sccWatchlistRender();
  if (_sccChartLayout === 'watchlist') sccChartRebuildGrid();
}
function sccWatchlistOpenFlagPopup(element, symbol) {
  sccWatchlistCloseFlagPopup();
  const sym = symbol.toUpperCase();
  const currentFlag = _sccSymbolFlags[sym] || 'none';
  const popup = document.createElement('div');
  popup.id = 'scc-wl-flag-popup';
  popup.style.position = 'fixed';
  popup.style.zIndex = '999999';
  popup.style.background = 'var(--bg3)';
  popup.style.border = '1px solid var(--bdr2)';
  popup.style.borderRadius = '6px';
  popup.style.boxShadow = '0 8px 24px rgba(0,0,0,0.6)';
  popup.style.padding = '8px 10px';
  popup.style.display = 'flex';
  popup.style.gap = '8px';
  popup.style.alignItems = 'center';
  const rect = element.getBoundingClientRect();
  let left = rect.left;
  let top = rect.bottom + 4;
  const popupWidth = 200;
  const popupHeight = 36;
  if (left + popupWidth > window.innerWidth) left = window.innerWidth - popupWidth - 10;
  if (top + popupHeight > window.innerHeight) top = rect.top - popupHeight - 4;
  popup.style.left = `${Math.max(10, left)}px`;
  popup.style.top = `${Math.max(10, top)}px`;
  const colors = { red: '#ef4444', blue: '#3b82f6', green: '#22c55e', yellow: '#eab308', purple: '#a855f7', cyan: '#06b6d4', pink: '#ec4899' };
  let html = '';
  Object.keys(colors).forEach(c => {
    const isSelected = currentFlag === c;
    const border = isSelected ? 'border: 2px solid var(--text);' : 'border: 1px solid rgba(255,255,255,0.2);';
    html += `
      <div onclick="sccWatchlistSetFlag('${sym}', '${c}')" 
           title="${c.toUpperCase()} Flag"
           style="width: 14px; height: 14px; border-radius: 50%; background: ${colors[c]}; cursor: pointer; ${border} box-sizing: border-box; transition: transform 0.1s;"
           onmouseover="this.style.transform=\'scale(1.2)\'"
           onmouseout="this.style.transform=\'scale(1.0)\'"></div>
    `;
  });
  const isNoneSelected = currentFlag === 'none';
  const noneBorder = isNoneSelected ? 'border: 2px solid var(--text);' : 'border: 1px solid rgba(255,255,255,0.2);';
  html += `
    <div onclick="sccWatchlistSetFlag('${sym}', 'none')" 
         title="Clear Flag"
         style="width: 14px; height: 14px; border-radius: 50%; background: #475569; position: relative; cursor: pointer; ${noneBorder} box-sizing: border-box; display: flex; align-items: center; justify-content: center; transition: transform 0.1s;"
         onmouseover="this.style.transform=\'scale(1.2)\'"
         onmouseout="this.style.transform=\'scale(1.0)\'">
      <div style="width: 100%; height: 1px; background: rgba(255,255,255,0.6); transform: rotate(45deg);"></div>
    </div>
  `;
  popup.innerHTML = html;
  document.body.appendChild(popup);
  setTimeout(() => {
    document.addEventListener('pointerdown', sccWatchlistCloseFlagPopupOutside);
  }, 10);
}
function sccWatchlistCloseFlagPopup() {
  const popup = document.getElementById('scc-wl-flag-popup');
  if (popup) { popup.remove(); }
  document.removeEventListener('pointerdown', sccWatchlistCloseFlagPopupOutside);
}
function sccWatchlistCloseFlagPopupOutside(e) {
  const popup = document.getElementById('scc-wl-flag-popup');
  if (popup && !popup.contains(e.target)) {
    sccWatchlistCloseFlagPopup();
  }
}
function sccWatchlistSetFlag(symbol, color) {
  const sym = symbol.toUpperCase();
  if (color === 'none') {
    delete _sccSymbolFlags[sym];
  } else {
    _sccSymbolFlags[sym] = color;
  }
  sccSaveWatchlistsLocalAndSync();
  if (_sccActiveWatchlist.startsWith('__flag_')) {
    const activeColor = _sccActiveWatchlist.replace('__flag_', '');
    _sccWatchlistSymbols = Object.keys(_sccSymbolFlags).filter(s => _sccSymbolFlags[s] === activeColor);
    const hasSymbols = Object.keys(_sccSymbolFlags).some(s => _sccSymbolFlags[s] === activeColor);
    if (!hasSymbols) {
      _sccActiveWatchlist = Object.keys(_sccWatchlists)[0] || "Main";
      _sccWatchlistSymbols = _sccWatchlists[_sccActiveWatchlist] || [];
      localStorage.setItem('_sccActiveWatchlist', _sccActiveWatchlist);
    }
  }
  sccWatchlistCloseFlagPopup();
  sccWlRenderTabs();
  sccWatchlistRender();
  if (typeof updateMaxChartSidebarWatchlist === 'function') {
    updateMaxChartSidebarWatchlist();
  }
}
window.sccWatchlistOpenFlagPopup = sccWatchlistOpenFlagPopup;
window.sccWatchlistSetFlag = sccWatchlistSetFlag;
window.sccWatchlistCloseFlagPopup = sccWatchlistCloseFlagPopup;
function sccWatchlistSelect(symbol) {
  const sym = symbol.toUpperCase();
  if (_sccChartLayout === 'watchlist') {
    const idx = _sccWatchlistSymbols.indexOf(sym);
    if (idx !== -1) {
      sccChartSetActivePanel(idx);
      const card = document.getElementById(`scc-chart-card-${idx}`);
      if (card) {
        card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
    sccWatchlistRender();
    return;
  }
  if (_sccSyncSymbols) { for (let i = 0; i < _sccChartSymbols.length; i++) { _sccChartSymbols[i] = sym; } } else { _sccChartSymbols[_sccActivePanelIndex] = sym; }
  localStorage.setItem('_sccChartSymbols', JSON.stringify(_sccChartSymbols)); sccChartRebuildGrid(); sccWatchlistRender();
}
function sccWatchlistAddSymbol(symbol) {
  if (_sccActiveWatchlist === 'VCP') { alert("VCP is an automatic system watchlist based on screener data and cannot be modified manually."); return; }
  const sym = symbol.toUpperCase().trim(); if (!sym) return; if (_sccActiveWatchlist.startsWith('__flag_')) { const color = _sccActiveWatchlist.replace('__flag_', ''); _sccSymbolFlags[sym] = color; _sccWatchlistSymbols = Object.keys(_sccSymbolFlags).filter(s => _sccSymbolFlags[s] === color); sccSaveWatchlistsLocalAndSync(); sccWlRenderTabs(); sccWatchlistRender(); sccWatchlistFetchSymbolData(sym); } else { if (!_sccWatchlistSymbols.includes(sym)) { _sccWatchlistSymbols.push(sym); sccSaveWatchlistsLocalAndSync(); sccWatchlistRender(); sccWatchlistFetchSymbolData(sym); } }
  if (_sccChartLayout === 'watchlist') sccChartRebuildGrid();
}
function sccWatchlistRemoveSymbol(symbol) {
  const sym = symbol.toUpperCase(); if (_sccActiveWatchlist.startsWith('__flag_')) {
    delete _sccSymbolFlags[sym]; const color = _sccActiveWatchlist.replace('__flag_', ''); _sccWatchlistSymbols = Object.keys(_sccSymbolFlags).filter(s => _sccSymbolFlags[s] === color); const hasSymbols = Object.keys(_sccSymbolFlags).some(s => _sccSymbolFlags[s] === color); if (!hasSymbols) { _sccActiveWatchlist = Object.keys(_sccWatchlists)[0] || "Main"; _sccWatchlistSymbols = _sccWatchlists[_sccActiveWatchlist] || []; localStorage.setItem('_sccActiveWatchlist', _sccActiveWatchlist); }
    _sccWlSelectedSymbols = _sccWlSelectedSymbols.filter(s => s !== sym); sccSaveWatchlistsLocalAndSync(); sccWlRenderTabs(); sccWatchlistRender();
  } else { const index = _sccWatchlistSymbols.indexOf(sym); if (index !== -1) { _sccWatchlistSymbols.splice(index, 1); sccSaveWatchlistsLocalAndSync(); _sccWlSelectedSymbols = _sccWlSelectedSymbols.filter(s => s !== sym); sccWatchlistRender(); } }
  if (_sccChartLayout === 'watchlist') sccChartRebuildGrid();
}
function sccWatchlistSuggest(val) {
  const suggestBox = document.getElementById('scc-wl-suggest'); if (!suggestBox) return; const query = val.trim().toLowerCase(); if (!query) { suggestBox.style.display = 'none'; suggestBox.innerHTML = ''; return; }
  let allStocks = n500CsvGetCached() || []; if (allStocks.length === 0 && _sdCurrentData?.stocks) { allStocks = _sdCurrentData.stocks; }
  const matches = []; for (const s of allStocks) { if ((s.symbol && s.symbol.toLowerCase().includes(query)) || (s.company && s.company.toLowerCase().includes(query))) { matches.push(s); if (matches.length >= 6) break; } }
  if (matches.length === 0) { suggestBox.style.display = 'none'; suggestBox.innerHTML = ''; return; }
  suggestBox.innerHTML = matches.map(s => {
    return `
      <div class="max-suggest-item" onclick="sccWatchlistSuggestSelect('${s.symbol.replace(/'/g, "\\'")}')">
        <span style="font-weight:700;color:var(--teal);">${s.symbol}</span>
        <span class="comp-name" style="max-width:140px">${s.company || ''}</span>
      </div>`;
  }).join(''); suggestBox.style.display = 'block';
}
function sccWatchlistSuggestSelect(symbol) { sccWatchlistAddSymbol(symbol); const input = document.getElementById('scc-wl-add-input'); if (input) input.value = ''; const suggestBox = document.getElementById('scc-wl-suggest'); if (suggestBox) suggestBox.style.display = 'none'; }
function sccWatchlistAddFromInput(val) {
  const symbol = val.trim().toUpperCase(); if (symbol) {
    sccWatchlistAddSymbol(symbol); const input = document.getElementById('scc-wl-add-input'); if (input) { input.value = ''; input.blur(); }
    const suggestBox = document.getElementById('scc-wl-suggest'); if (suggestBox) suggestBox.style.display = 'none';
  }
}
async function sccWatchlistFetchSymbolData(symbol) {
  const sym = symbol.toUpperCase(); try { const candles = await fetchYfData(sym, '5d', '1d'); if (candles && candles.length > 0) { const lastCandle = candles[candles.length - 1]; const prevCandle = candles.length > 1 ? candles[candles.length - 2] : lastCandle; const price = lastCandle.close; const pctChange = ((price - prevCandle.close) / prevCandle.close) * 100; _sccWatchlistData[sym] = { price, change: pctChange }; } } catch (err) { console.error("Watchlist fetch error for " + sym, err); if (!_sccWatchlistData[sym]) { _sccWatchlistData[sym] = { error: true }; } }
  sccWatchlistRender();
}
function sccWatchlistFetchAll(bypassCache = false) {
  _sccWatchlistSymbols.forEach(sym => {
    const sUpper = sym.toUpperCase(); if (bypassCache) { const yfSymbol = sUpper.startsWith('^') ? sUpper : (sUpper + '.NS'); const cacheKey = `${yfSymbol}_5d_1d`; _yfDataCache.delete(cacheKey); _yfDataCache.delete(`${yfSymbol}_6mo_1d`); }
    sccWatchlistFetchSymbolData(sUpper);
  });
}
document.addEventListener('click', (e) => { const insideWl = e.target.closest('.scc-wl-item') || e.target.closest('#scc-wl-tabs-bar') || e.target.closest('#scc-wl-flag-popup') || e.target.closest('#scc-wl-context-menu') || e.target.closest('#scc-wl-add-input') || e.target.closest('#scc-wl-suggest') || e.target.closest('.wl-del-btn') || e.target.closest('button[onclick*="sccWatchlist"]') || e.target.closest('button[onclick*="sccToggleWatchlist"]'); if (!insideWl) { if (_sccWlSelectedSymbols.length > 0) { _sccWlSelectedSymbols = []; _sccWlLastSelectedSymbol = null; sccWatchlistRender(); } } }); document.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
    if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'SELECT' && e.target.tagName !== 'TEXTAREA') {
      if (_sccShowWatchlist && _sccWatchlistSymbols.length > 0) {
        e.preventDefault(); const activeChartSymbol = (sccChartGetSymbol(_sccActivePanelIndex) || '').toUpperCase(); const currentSymbol = (_sccWlLastSelectedSymbol || activeChartSymbol || '').toUpperCase(); const list = _sccWatchlistSymbols.map(s => s.toUpperCase()); let index = list.indexOf(currentSymbol); if (e.key === 'ArrowUp') { if (index === -1) { index = list.length - 1; } else { index = (index - 1 + list.length) % list.length; } } else { if (index === -1) { index = 0; } else { index = (index + 1) % list.length; } }
        const targetSymbol = list[index]; _sccWlSelectedSymbols = [targetSymbol]; _sccWlLastSelectedSymbol = targetSymbol; sccWatchlistSelect(targetSymbol); setTimeout(() => { const itemEl = document.getElementById(`scc-wl-item-${targetSymbol}`); if (itemEl) { itemEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } }, 50); return;
      }
    }
  }
  if (e.altKey && e.key.toLowerCase() === 'w') {
    const pane = document.getElementById('scc-pane-chart'); if (pane && pane.style.display !== 'none') { e.preventDefault(); const activeSymbol = sccChartGetSymbol(_sccActivePanelIndex); if (activeSymbol) { sccWatchlistAddSymbol(activeSymbol); } }
    return;
  }
  if (e.key === 'Delete') {
    const pane = document.getElementById('scc-pane-chart'); if (pane && pane.style.display !== 'none' && _sccWlSelectedSymbols.length > 0) { if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'SELECT' && e.target.tagName !== 'TEXTAREA') { e.preventDefault(); sccWlDeleteSelected(); } }
    return;
  }
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') { return; }
  const pane = document.getElementById('scc-pane-chart'); if (!pane || pane.style.display === 'none') return; const char = e.key; if (char === 'Escape') { sccHideTimeframePopup(); return; }
  if (/^[a-zA-Z]$/.test(char) && !e.ctrlKey && !e.metaKey && !e.altKey) { const input = document.getElementById(`scc-chart-input-${_sccActivePanelIndex}`); if (input) { input.focus(); input.value = char.toUpperCase(); sccChartInputHandler(_sccActivePanelIndex, input.value); e.preventDefault(); } }
  if (/^[0-9]$/.test(char)) { sccShowTimeframePopup(char); e.preventDefault(); }
}); function sccShowTimeframePopup(initialChar) { const popup = document.getElementById('scc-timeframe-popup'); const input = document.getElementById('scc-timeframe-popup-input'); if (!popup || !input) return; popup.style.display = 'flex'; input.value = initialChar; input.focus(); }
function sccHideTimeframePopup() { const popup = document.getElementById('scc-timeframe-popup'); if (popup) popup.style.display = 'none'; }
function sccTimeframePopupKey(e) {
  if (e.key === 'Enter') {
    const val = e.target.value.toUpperCase().trim(); sccHideTimeframePopup(); let tf = 'D'; if (val === '60' || val === '1H' || val === 'H') { tf = '1H'; } else if (val === '1D' || val === 'D' || val === '1') { tf = 'D'; } else if (val === '1W' || val === 'W') { tf = 'W'; } else if (val === '1M' || val === 'M') { tf = 'M'; } else { return; }
    sccChartSetTimeframe(_sccActivePanelIndex, tf);
  } else if (e.key === 'Escape') { sccHideTimeframePopup(); }
}
const LS_VCPB_URL = 'nse_vcpb_url_v1'; const LS_VCPB_DATA = 'nse_vcpb_data_v1'; const LS_VCPB_HIST = 'nse_vcpb_hist_v1'; let _vcpbSort = 'composite'; let _vcpbSortAsc = false; let _vcpbViewMode = 'sector'; let _vcpbSearchQuery = ''; let _vcpbFilter = 'all'; let _vcpbShowConfidence = true; const PSU_BANKS_TICKERS = new Set(['SBIN', 'PNB', 'BOB', 'CANBK', 'UNIONBANK', 'INDIANB', 'UCOBANK', 'BANKBARODA', 'BANKINDIA', 'MAHABANK', 'CENTRALBK', 'IOB', 'PSB']); const PRIVATE_BANKS_TICKERS = new Set(['HDFCBANK', 'ICICIBANK', 'KOTAKBANK', 'AXISBANK', 'INDUSINDBK', 'FEDERALBNK', 'IDFCFIRSTB', 'BANDHANBNK', 'YESBANK', 'CUB', 'KTKBANK', 'RBLBANK', 'SOUTHBANK', 'CSBBANK', 'AUBANK', 'INDUSIND']); const INSURANCE_TICKERS = new Set(['HDFCLIFE', 'SBILIFE', 'ICICIPRULI', 'LIC', 'GICRE', 'NIACL', 'MAXFSL', 'ICICIGI', 'STARHEALTH']); const AMC_TICKERS = new Set(['HDFCAMC', 'NAM-INDIA', 'UTIAMC', 'ABSLAMC']); const CAPITAL_MARKETS_TICKERS = new Set(['CDSL', 'BSE', 'MCX', 'CAMS', 'KFINTECH', 'ANGELONE', 'ISEC', 'MUTHOOTOT', '5PAISA', 'ANANDRATHI', 'GEODJITFSL', 'MOTILALOFS']); const CABLES_TICKERS = new Set(['POLYCAB', 'KEI', 'RRKABEL', 'FINCABLES']); const TRANSFORMERS_TICKERS = new Set(['VOLTAMP', 'CGPOWER', 'TRIL', 'TRANSFORM', 'SCHNEIDER']); const BEARINGS_TICKERS = new Set(['SKFINDIA', 'TIMKEN', 'SHAFFLER', 'SCHAEFFLER', 'HARSHA']); const COMPRESSORS_TICKERS = new Set(['ELGIEQUIP', 'KPIL', 'KIRLPNU']); const HVAC_TICKERS = new Set(['VOLTAS', 'BLUESTARCO', 'HITACHIHAM']); const COPPER_TICKERS = new Set(['HINDCOPPER']); const STEEL_TICKERS = new Set(['TATASTEEL', 'JSWSTEEL', 'SAIL', 'JSL', 'JINDALSTEL', 'KALYANISTEEL', 'APLAPOLLO', 'WELCORP', 'MAHSEAMLES']); const ALUMINIUM_TICKERS = new Set(['HINDALCO', 'NATIONALUM']); const MINING_TICKERS = new Set(['COALINDIA', 'NMDC', 'GMDC']); const EXPLOSIVES_TICKERS = new Set(['SOLARINDS', 'PREMEXPLN']); const DYES_PIGMENTS_TICKERS = new Set(['BODALCHEM', 'KIRIINDUS', 'SUDARSCHEM', 'MEGH']); const GAS_TRADING_TICKERS = new Set(['GAIL', 'GSPL']); const CGD_TICKERS = new Set(['IGL', 'MGL', 'ATGL', 'GUJGASLTD']); const SOLAR_TICKERS = new Set(['TATAPOWER', 'ADANIGREEN', 'SWSOLAR', 'WAAREEENER', 'WEBSOL']); const POWER_EQUIP_TICKERS = new Set(['BHEL', 'SUZLON', 'INOXWIND', 'GET&D']); const CDMO_TICKERS = new Set(['DIVISLAB', 'SYNGENE', 'SUVENPHAR', 'LAURUSLABS']); const DIAGNOSTICS_TICKERS = new Set(['LALPATHLAB', 'METROPOLIS', 'THYROCARE', 'VIJAYA']); const MEDICAL_DEVICES_TICKERS = new Set(['POLYMED']); const COMMERCIAL_VEH_TICKERS = new Set(['ASHOKLEY', 'SMLISUZU']); const PASSENGER_VEH_TICKERS = new Set(['MARUTI', 'M&M', 'TATAMOTORS', 'HYUNDAI']); const TYRES_TICKERS = new Set(['MRF', 'APOLLOTYRE', 'CEATLTD', 'JKTYRE', 'BALKRISIND']); const EV_COMPONENTS_TICKERS = new Set(['SONACOMS', 'MINDACORP', 'UNOMINDA']); const BATTERIES_TICKERS = new Set(['EXIDEIND', 'AMARAJABAT', 'ARE&M']); const TRACTORS_TICKERS = new Set(['ESCORTS', 'VSTTILLERS']); const RETAIL_TICKERS = new Set(['TRENT', 'DMART', 'ABFRL', 'SHOPERSTOP', 'VMART', 'ETHOSLTD']); const JEWELLERY_TICKERS = new Set(['TITAN', 'KALYANKJIL', 'SENCO', 'RAJESHEXPO']); const FOOTWEAR_TICKERS = new Set(['BATAINDIA', 'METROBRAND', 'RELAXO', 'CAMPUS']); const RESTAURANTS_QSR_TICKERS = new Set(['JUBLFOOD', 'DEVYANI', 'WESTLIFE', 'RBA', 'SAPPHIRE']); const TEXTILES_TICKERS = new Set(['PAGEIND', 'ARVIND', 'VTL', 'RAYMOND', 'WELSPUNLIV', 'ALOKIND', 'GARFIBRES', 'GOKEX', 'KPRMILL']); const AEROSPACE_DEFENCE_TICKERS = new Set(['HAL', 'BEL', 'BDL', 'ASTRAMICRO', 'PARAS', 'DATAPATTNS', 'ZENTEC', 'MTARTECH', 'DYNAMATECH', 'IDEAFORGE']); const SHIPBUILDING_TICKERS = new Set(['MAZDOCK', 'COCHINSHIP', 'GRSE']); const EMS_TICKERS = new Set(['DIXON', 'KAYNES', 'SYRMA', 'AVALON']); const DATA_CENTERS_TICKERS = new Set(['NETWEB', 'ANANTRAJ']); const RAILWAY_TICKERS = new Set(['IRFC', 'IRCTC', 'RVNL', 'IRCON', 'RITES', 'TITAGARH', 'TEXMACO', 'RAILTEL', 'JWL']); const AGRO_TICKERS = new Set(['CHAMBLFERT', 'FACT', 'COROMANDEL', 'GNFC', 'GSFC', 'RCF', 'UPL']); const MS_GROUP_TO_SECTOR = { 'Aerospace/Defense': 'Defense', 'Apparel-Clothing Mfg': 'Textiles', 'Apparel-Shoes & Rel Mfg': 'Consumer Durables', 'Auto Manufacturers': 'Automobile and Auto Components', 'Auto/Truck-Original Eqp': 'Automobile and Auto Components', 'Auto/Truck-Replace Parts': 'Automobile and Auto Components', 'Auto/Truck-Tires & Misc': 'Automobile and Auto Components', 'Banks-Money Center': 'Banks', 'Beverages-Alcoholic': 'Fast Moving Consumer Goods', 'Beverages-Non-Alcoholic': 'Fast Moving Consumer Goods', 'Bldg-A/C & Heating Prds': 'Consumer Durables', 'Bldg-Cement/Concrt/Ag': 'Construction Materials', 'Bldg-Constr Prds/Misc': 'Capital Goods', 'Bldg-Heavy Construction': 'Construction', 'Bldg-Resident/Comml': 'Realty', 'Chemicals-Agricultural': 'Agrochemicals & Fertilizers', 'Chemicals-Basic': 'Specialty Chemicals', 'Chemicals-Paints': 'Consumer Durables', 'Chemicals-Plastics': 'Specialty Chemicals', 'Chemicals-Specialty': 'Specialty Chemicals', 'Comml Svcs-Advertising': 'Media Entertainment & Publication', 'Comml Svcs-Consulting': 'Services', 'Comml Svcs-Healthcare': 'Hospitals & Healthcare', 'Comml Svcs-Market Rsrch': 'Services', 'Comml Svcs-Outsourcing': 'Services', 'Comp Sftwr-Spec Enterprs': 'Information Technology', 'Computer Sftwr-Database': 'Information Technology', 'Computer Sftwr-Desktop': 'Information Technology', 'Computer-Hardware/Perip': 'Information Technology', 'Computer-Networking': 'Information Technology', 'Computer-Tech Services': 'Information Technology', 'Consumer Prod-Electronic': 'Consumer Durables', 'Consumer Prod-Specialty': 'Consumer Durables', 'Consumer Svcs-Education': 'Consumer Services', 'Cosmetics/Personal Care': 'Fast Moving Consumer Goods', 'Diversified Operations': 'Diversified', 'Elec-Misc Products': 'Capital Goods', 'Electrical-Power/Equipmt': 'Capital Goods', 'Energy-Alternative/Other': 'Power', 'Energy-Coal': 'Oil Gas & Consumable Fuels', 'Energy-Solar': 'Power', 'Finance-Commercial Loans': 'NBFCs & Finance', 'Finance-Consumer Loans': 'NBFCs & Finance', 'Finance-Crdtcard/Pmtpr': 'NBFCs & Finance', 'Finance-Invest Bnk/Bkrs': 'NBFCs & Finance', 'Finance-Investment Mgmt': 'NBFCs & Finance', 'Finance-Mrtg&Rel Svc': 'NBFCs & Finance', 'Finance-Property Reit': 'Realty', 'Financial Svcs-Specialty': 'NBFCs & Finance', 'Food-Grain & Related': 'Fast Moving Consumer Goods', 'Food-Misc Preparation': 'Fast Moving Consumer Goods', 'Food-Packaged': 'Fast Moving Consumer Goods', 'Hsehold-Appliances/Wares': 'Consumer Durables', 'Insurance-Acc & Health': 'NBFCs & Finance', 'Insurance-Brokers': 'NBFCs & Finance', 'Insurance-Diversified': 'NBFCs & Finance', 'Insurance-Life': 'NBFCs & Finance', 'Insurance-Prop/Cas/Titl': 'NBFCs & Finance', 'Internet-Content': 'Consumer Services', 'Leisure-Lodging': 'Consumer Services', 'Leisure-Movies & Related': 'Media Entertainment & Publication', 'Leisure-Services': 'Consumer Services', 'Leisure-Travel Booking': 'Consumer Services', 'Machinery-Constr/Mining': 'Capital Goods', 'Machinery-Farm': 'Automobile and Auto Components', 'Machinery-Gen Industrial': 'Capital Goods', 'Machinery-Mtl Hdlg/Autmn': 'Capital Goods', 'Machinery-Tools & Rel': 'Capital Goods', 'Media-Radio/Tv': 'Media Entertainment & Publication', 'Medical-Biomed/Biotech': 'Pharma', 'Medical-Diversified': 'Pharma', 'Medical-Generic Drugs': 'Pharma', 'Medical-Hospitals': 'Hospitals & Healthcare', 'Medical-Products': 'Pharma', 'Medical-Research Eqp/Svc': 'Pharma', 'Medical-Services': 'Hospitals & Healthcare', 'Medical-Supplies': 'Pharma', 'Medical-Systems/Equip': 'Pharma', 'Medical-Whlsle Drg/Suppl': 'Pharma', 'Metal Proc & Fabrication': 'Metals & Mining', 'Mining-Metal Ores': 'Metals & Mining', 'Oil&Gas-Integrated': 'Oil Gas & Consumable Fuels', 'Oil&Gas-Intl Expl&Prod': 'Oil Gas & Consumable Fuels', 'Oil&Gas-Refining/Mktg': 'Oil Gas & Consumable Fuels', 'Oil&Gas-Transprt/Pipelne': 'Oil Gas & Consumable Fuels', 'Real Estate Dvlpmt/Ops': 'Realty', 'Retail-Department Stores': 'Consumer Services', 'Retail-Internet': 'Consumer Services', 'Retail-Mail Order&Direct': 'Consumer Services', 'Retail-Restaurants': 'Consumer Services', 'Retail-Specialty': 'Consumer Services', 'Retail-Super/Mini Mkts': 'Consumer Services', 'Retail/Whlsle-Jewelry': 'Consumer Durables', 'Steel-Producers': 'Metals & Mining', 'Steel-Specialty Alloys': 'Metals & Mining', 'Telecom Svcs-Cable/Satl': 'Telecommunication', 'Telecom Svcs-Integrated': 'Telecommunication', 'Telecom Svcs-Wireless': 'Telecommunication', 'Telecom-Consumer Prods': 'Telecommunication', 'Telecom-Infrastructure': 'Telecommunication', 'Tobacco': 'Fast Moving Consumer Goods', 'Transportation-Airline': 'Services', 'Transportation-Equip Mfg': 'Capital Goods', 'Transportation-Logistics': 'Services', 'Transportation-Ship': 'Services', 'Trucks & Parts-Hvy Duty': 'Automobile and Auto Components', 'Utility-Electric Power': 'Power', 'Utility-Gas Distribution': 'Oil Gas & Consumable Fuels' }; function getMsIndustryMapping(symbol, company, industry) {
  const sym = symbol.toUpperCase().replace('.NS', ''); const comp = company.toUpperCase(); const ind = industry.toUpperCase(); let industryGroup = null; let parentSector = null; const filterMap = filterStocksGetCached(); if (filterMap && filterMap[sym]) { const rawGroup = filterMap[sym]; parentSector = MS_GROUP_TO_SECTOR[rawGroup] || 'Diversified'; industryGroup = rawGroup; if (!industryGroup.endsWith(' IN')) { industryGroup = industryGroup + ' IN'; } }
  if (!industryGroup) {
    if (RAILWAY_TICKERS.has(sym) || comp.includes('RAILWAY')) { industryGroup = "Transportation-Rail IN"; parentSector = "Railways"; }
    else if (AEROSPACE_DEFENCE_TICKERS.has(sym) || ["AEROSPACE", "DEFENCE", "DEFENSE", "DYNAMICS"].some(x => comp.includes(x))) { industryGroup = "Aerospace/Defense IN"; parentSector = "Defense"; }
    else if (ind.includes("FINANCIAL") || ind.includes("BANKS")) { if (PSU_BANKS_TICKERS.has(sym) || ["STATE BANK", "PUNJAB NATIONAL", "BANK OF BARODA", "CANARA", "UNION BANK", "INDIAN BANK", "UCO BANK", "BANK OF INDIA", "MAHARASHTRA", "CENTRAL BANK", "OVERSEAS", "SHUBH", "PSU"].some(x => comp.includes(x))) { industryGroup = "Banks-Money Center IN"; parentSector = "Banks"; } else if (PRIVATE_BANKS_TICKERS.has(sym) || ["HDFC BANK", "ICICI BANK", "KOTAK", "AXIS", "INDUSIND", "FEDERAL", "IDFC FIRST", "BANDHAN", "YES BANK", "CITY UNION", "KARUR VYSYA", "RBL", "SOUTH INDIAN", "CSB BANK", "AU SMALL"].some(x => comp.includes(x))) { industryGroup = "Banks-Money Center IN"; parentSector = "Banks"; } else if (INSURANCE_TICKERS.has(sym) || ["INSURANCE", "LIFE", "GENERAL INS", "ASSURANCE", "MAX FINANCIAL"].some(x => comp.includes(x))) { industryGroup = "Insurance-Life IN"; parentSector = "NBFCs & Finance"; } else if (AMC_TICKERS.has(sym) || ["AMC", "MUTUAL FUND", "ASSET MANAGEMENT", "NIPPON LIFE"].some(x => comp.includes(x))) { industryGroup = "Finance-Investment Mgmt IN"; parentSector = "NBFCs & Finance"; } else if (CAPITAL_MARKETS_TICKERS.has(sym) || ind.includes("CAPITAL MARKETS") || ["CDSL", "BSE", "MCX", "CAMS", "KFIN", "ANGEL ONE", "SECURITIES", "WEALTH", "BROKING", "INVESTMENT"].some(x => comp.includes(x))) { industryGroup = "Finance-Invest Bnk/Bkrs IN"; parentSector = "NBFCs & Finance"; } else { industryGroup = "Finance-Consumer Loans IN"; parentSector = "NBFCs & Finance"; } }
    else if (ind.includes("CAPITAL GOODS") || ind.includes("INDUSTRIAL") || ind.includes("MACHINERY")) { if (AEROSPACE_DEFENCE_TICKERS.has(sym) || ["AEROSPACE", "DEFENCE", "DEFENSE", "DYNAMICS"].some(x => comp.includes(x))) { industryGroup = "Aerospace/Defense IN"; parentSector = "Defense"; } else if (SHIPBUILDING_TICKERS.has(sym) || ["SHIPYARD", "SHIPBUILD", "MAZAGON"].some(x => comp.includes(x))) { industryGroup = "Transportation-Ship IN"; parentSector = "Defense"; } else if (CABLES_TICKERS.has(sym) || ["CABLE", "RR KABEL"].some(x => comp.includes(x))) { industryGroup = "Electrical-Power/Equipmt IN"; parentSector = "Capital Goods"; } else if (TRANSFORMERS_TICKERS.has(sym) || ["TRANSFORMER", "SCHNEIDER"].some(x => comp.includes(x))) { industryGroup = "Electrical-Power/Equipmt IN"; parentSector = "Capital Goods"; } else if (BEARINGS_TICKERS.has(sym) || comp.includes("BEARING")) { industryGroup = "Machinery-Gen Industrial IN"; parentSector = "Capital Goods"; } else if (COMPRESSORS_TICKERS.has(sym) || ["COMPRESSOR", "PNEUMATIC"].some(x => comp.includes(x))) { industryGroup = "Machinery-Gen Industrial IN"; parentSector = "Capital Goods"; } else if (HVAC_TICKERS.has(sym) || ["VOLTAS", "BLUE STAR"].some(x => comp.includes(x))) { industryGroup = "Bldg-A/C &amp; Heating Prds IN"; parentSector = "Capital Goods"; } else if (comp.includes("AUTOMATION") || comp.includes("HONEYWELL")) { industryGroup = "Machinery-Gen Industrial IN"; parentSector = "Capital Goods"; } else { industryGroup = "Machinery-Gen Industrial IN"; parentSector = "Capital Goods"; } }
    else if (ind.includes("METALS & MINING") || ind.includes("METALS") || ind.includes("MINING") || ind.includes("MATERIALS")) { if (COPPER_TICKERS.has(sym) || comp.includes("COPPER")) { industryGroup = "Mining-Metal Ores IN"; parentSector = "Metals & Mining"; } else if (ALUMINIUM_TICKERS.has(sym) || comp.includes("ALUMINIUM") || comp.includes("NALCO")) { industryGroup = "Mining-Metal Ores IN"; parentSector = "Metals & Mining"; } else if (MINING_TICKERS.has(sym) || ind.includes("MINING") || ["COAL INDIA", "NMDC", "GMDC"].some(x => comp.includes(x))) { industryGroup = "Mining-Metal Ores IN"; parentSector = "Metals & Mining"; } else if (STEEL_TICKERS.has(sym) || ["STEEL", "PIPE", "APOLLO TUBES", "WELSPUN CORP"].some(x => comp.includes(x))) { industryGroup = "Steel-Producers IN"; parentSector = "Metals & Mining"; } else { industryGroup = "Metal Proc &amp; Fabrication IN"; parentSector = "Metals & Mining"; } }
    else if (ind.includes("CHEMICALS")) { if (["AGRICULTURAL", "FERTILIZER", "AGRI"].some(x => comp.includes(x)) || AGRO_TICKERS.has(sym)) { industryGroup = "Chemicals-Agricultural IN"; parentSector = "Agrochemicals & Fertilizers"; } else if (EXPLOSIVES_TICKERS.has(sym) || ["EXPLOSIVE", "SOLAR IND"].some(x => comp.includes(x))) { industryGroup = "Chemicals-Specialty IN"; parentSector = "Specialty Chemicals"; } else if (DYES_PIGMENTS_TICKERS.has(sym) || ["DYE", "PIGMENT", "SUDARSHAN"].some(x => comp.includes(x))) { industryGroup = "Chemicals-Specialty IN"; parentSector = "Specialty Chemicals"; } else { industryGroup = "Chemicals-Specialty IN"; parentSector = "Specialty Chemicals"; } }
    else if (ind.includes("POWER") || ind.includes("OIL GAS") || ind.includes("ENERGY")) { if (GAS_TRADING_TICKERS.has(sym) || comp.includes("GAIL") || comp.includes("GSPL")) { industryGroup = "Utility-Gas Distribution IN"; parentSector = "Oil Gas & Consumable Fuels"; } else if (CGD_TICKERS.has(sym) || ["GUJARAT GAS", "INDRAPRASTHA GAS", "MAHANAGAR GAS", "ADANI TOTAL"].some(x => comp.includes(x))) { industryGroup = "Utility-Gas Distribution IN"; parentSector = "Oil Gas & Consumable Fuels"; } else if (SOLAR_TICKERS.has(sym) || ["SOLAR", "ADANI GREEN", "WAAREE"].some(x => comp.includes(x))) { industryGroup = "Energy-Solar IN"; parentSector = "Power"; } else if (POWER_EQUIP_TICKERS.has(sym) || ["SUZLON", "WIND", "BHEL", "GET&D"].some(x => comp.includes(x))) { industryGroup = "Electrical-Power/Equipmt IN"; parentSector = "Power"; } else { industryGroup = "Energy-Alternative/Other IN"; parentSector = "Power"; } }
    else if (ind.includes("HEALTHCARE") || ind.includes("PHARMACEUTICALS")) { if (comp.includes("CHEMICAL") && !comp.includes("PHARM")) { industryGroup = "Chemicals-Specialty IN"; parentSector = "Specialty Chemicals"; } else if (CDMO_TICKERS.has(sym) || ["CDMO", "DIVI'S", "SYNGENE", "LAURUS"].some(x => comp.includes(x))) { industryGroup = "Medical-Biomed/Biotech IN"; parentSector = "Pharma"; } else if (DIAGNOSTICS_TICKERS.has(sym) || ["DIAGNOSTIC", "LAL PATH", "METROPOLIS"].some(x => comp.includes(x))) { industryGroup = "Medical-Services IN"; parentSector = "Hospitals & Healthcare"; } else if (MEDICAL_DEVICES_TICKERS.has(sym) || ["MEDICURE", "DEVICE"].some(x => comp.includes(x))) { industryGroup = "Medical-Products IN"; parentSector = "Hospitals & Healthcare"; } else if (["PHARMA", "LAB", "BIOTECH", "DRUG", "MEDICINE"].some(x => comp.includes(x))) { industryGroup = "Medical-Generic Drugs IN"; parentSector = "Pharma"; } else { industryGroup = "Medical-Hospitals IN"; parentSector = "Hospitals & Healthcare"; } }
    else if (ind.includes("AUTO") || ind.includes("VEHICLE")) { if (TYRES_TICKERS.has(sym) || ["TYRE", "CEAT", "MRF"].some(x => comp.includes(x))) { industryGroup = "Auto/Truck-Tires &amp; Misc  IN"; parentSector = "Automobile and Auto Components"; } else if (EV_COMPONENTS_TICKERS.has(sym) || ["EV", "SONA BLW", "MINDA"].some(x => comp.includes(x))) { industryGroup = "Auto/Truck-Original Eqp IN"; parentSector = "Automobile and Auto Components"; } else if (BATTERIES_TICKERS.has(sym) || ["BATTERY", "EXIDE", "AMARA RAJA"].some(x => comp.includes(x))) { industryGroup = "Auto/Truck-Replace Parts IN"; parentSector = "Automobile and Auto Components"; } else if (TRACTORS_TICKERS.has(sym) || comp.includes("TRACTOR")) { industryGroup = "Machinery-Farm IN"; parentSector = "Automobile and Auto Components"; } else if (COMMERCIAL_VEH_TICKERS.has(sym) || ["ASHOK LEYLAND", "COMMERCIAL VEHICLE"].some(x => comp.includes(x))) { industryGroup = "Trucks &amp; Parts-Hvy Duty IN"; parentSector = "Automobile and Auto Components"; } else { industryGroup = "Auto Manufacturers IN"; parentSector = "Automobile and Auto Components"; } }
    else if (ind.includes("CONSUMER") || ind.includes("RETAIL") || ind.includes("TEXTILES") || ind.includes("SERVICES")) { if (TEXTILES_TICKERS.has(sym) || ind.includes("TEXTILES") || ["SPINNING", "WEAVING", "PAGE INDUSTRIES", "WELSPUN LIVING", "RAYMOND"].some(x => comp.includes(x))) { industryGroup = "Apparel-Clothing Mfg IN"; parentSector = "Textiles"; } else if (RETAIL_TICKERS.has(sym) || ind.includes("RETAIL") || ["TRENT", "AVENUE SUPERMARTS", "SHOPPERS STOP"].some(x => comp.includes(x))) { if (sym === 'TRENT') { industryGroup = "Retail-Department Stores IN"; parentSector = "Consumer Services"; } else if (sym === 'DMART') { industryGroup = "Retail-Super/Mini Mkts IN"; parentSector = "Consumer Services"; } else { industryGroup = "Retail-Specialty IN"; parentSector = "Consumer Services"; } } else if (JEWELLERY_TICKERS.has(sym) || ["JEWELLER", "TITAN", "GOLD"].some(x => comp.includes(x))) { industryGroup = "Retail/Whlsle-Jewelry IN"; parentSector = "Consumer Durables"; } else if (FOOTWEAR_TICKERS.has(sym) || ["FOOTWEAR", "BATA", "METRO BRAND", "RELAXO"].some(x => comp.includes(x))) { industryGroup = "Apparel-Shoes &amp; Rel Mfg IN"; parentSector = "Consumer Durables"; } else if (RESTAURANTS_QSR_TICKERS.has(sym) || ["RESTAURANT", "FOODWORKS", "DEVYANI", "WESTLIFE", "SAPPHIRE"].some(x => comp.includes(x))) { industryGroup = "Retail-Restaurants IN"; parentSector = "Consumer Services"; } }
    else if (AEROSPACE_DEFENCE_TICKERS.has(sym) || ["AEROSPACE", "DEFENCE", "DEFENSE", "DYNAMICS"].some(x => comp.includes(x))) { industryGroup = "Aerospace/Defense IN"; parentSector = "Defense"; } else if (EMS_TICKERS.has(sym) || ["EMS", "DIXON", "KAYNES", "SYRMA", "AVALON"].some(x => comp.includes(x))) { industryGroup = "Electronic-Parts IN"; parentSector = "Capital Goods"; } else if (DATA_CENTERS_TICKERS.has(sym) || comp.includes("DATA CENTER") || comp.includes("NETWEB")) { industryGroup = "Computer-Hardware/Perip IN"; parentSector = "Information Technology"; }
    else if (ind.includes("TELECOMMUNICATION")) { industryGroup = "Telecom Svcs-Wireless IN"; parentSector = "Telecommunication"; } else if (ind.includes("INFORMATION TECHNOLOGY")) { industryGroup = "Computer-Tech Services IN"; parentSector = "Information Technology"; } else if (ind.includes("CONSTRUCTION MATERIALS")) { industryGroup = "Bldg-Cement/Concrt/Ag IN"; parentSector = "Construction Materials"; } else if (ind.includes("CONSTRUCTION")) { industryGroup = "Bldg-Heavy Construction IN"; parentSector = "Construction"; } else if (ind.includes("REALTY")) { industryGroup = "Real Estate Dvlpmt/Ops IN"; parentSector = "Realty"; } else if (ind.includes("MEDIA") || ind.includes("PUBLICATION")) { industryGroup = "Media-Radio/Tv IN"; parentSector = "Media Entertainment & Publication"; } else { const rawIndMap = { 'FAST MOVING CONSUMER GOODS': ["Food-Packaged IN", "Fast Moving Consumer Goods"], 'CONSUMER SERVICES': ["Retail-Specialty IN", "Consumer Services"], 'CONSUMER DURABLES': ["Consumer Prod-Electronic IN", "Consumer Durables"], 'SERVICES': ["Comml Svcs-Consulting IN", "Services"], 'DIVERSIFIED': ["Diversified Operations IN", "Diversified"], 'OIL GAS & CONSUMABLE FUELS': ["Oil&amp;Gas-Refining/Mktg IN", "Oil Gas & Consumable Fuels"], 'POWER': ["Utility-Electric Power IN", "Power"], 'TELECOMMUNICATION': ["Telecom Svcs-Wireless IN", "Telecommunication"], 'INFORMATION TECHNOLOGY': ["Computer-Tech Services IN", "Information Technology"], 'METALS & MINING': ["Mining-Metal Ores IN", "Metals & Mining"], 'CHEMICALS': ["Chemicals-Basic IN", "Specialty Chemicals"], 'HEALTHCARE': ["Medical-Generic Drugs IN", "Pharma"], 'AUTOMOBILE AND AUTO COMPONENTS': ["Auto/Truck-Original Eqp IN", "Automobile and Auto Components"], 'TEXTILES': ["Apparel-Clothing Mfg IN", "Textiles"], 'REALTY': ["Real Estate Dvlpmt/Ops IN", "Realty"], 'MEDIA ENTERTAINMENT & PUBLICATION': ["Media-Radio/Tv IN", "Media Entertainment & Publication"], 'CONSTRUCTION MATERIALS': ["Bldg-Cement/Concrt/Ag IN", "Construction Materials"], 'CONSTRUCTION': ["Bldg-Heavy Construction IN", "Construction"] }; if (rawIndMap[ind]) { const [grp, sec] = rawIndMap[ind]; industryGroup = grp; parentSector = sec; } else { industryGroup = "Diversified Operations IN"; parentSector = "Diversified"; } }
  }
  const railwayTickers = new Set(['IRFC', 'IRCTC', 'RVNL', 'IRCON', 'RITES', 'TITAGARH', 'TEXMACO', 'RAILTEL', 'JWL']); if (railwayTickers.has(sym) || comp.includes('RAILWAY')) { industryGroup = "Railways"; parentSector = "Railways"; } else if (new Set(['MAZDOCK', 'COCHINSHIP', 'GRSE']).has(sym)) { parentSector = "Defense"; }
  return { industryGroup, parentSector };
}
function csvIndustryMap(symbol, company, industry) { return getMsIndustryMapping(symbol, company, industry).industryGroup; }
function vcpbApplySearch(val) { _vcpbSearchQuery = val.trim(); const clearBtn = document.getElementById('vcpb-search-clear'); if (clearBtn) clearBtn.style.display = _vcpbSearchQuery ? 'block' : 'none'; const card = document.getElementById('srt-home-card'); if (card && card._vcpbData) { vcpbRenderTable(_vcpbViewMode === 'sector' ? card._vcpbData.sectors : (card._vcpbData.industries || [])); } }
function vcpbClearSearch() { const inp = document.getElementById('vcpb-search'); if (inp) inp.value = ''; vcpbApplySearch(''); }
function vcpbSetFilter(filterVal) { _vcpbFilter = filterVal; document.querySelectorAll('.vcpb-filter-btn').forEach(btn => { if (btn.getAttribute('data-filter') === filterVal) { btn.style.background = 'var(--border)'; btn.style.color = 'var(--text)'; } else { btn.style.background = 'transparent'; btn.style.color = 'var(--sub)'; } }); const card = document.getElementById('srt-home-card'); if (card && card._vcpbData) { vcpbRenderTable(_vcpbViewMode === 'sector' ? card._vcpbData.sectors : (card._vcpbData.industries || [])); } }
function vcpbToggleConfidenceCol(checked) { _vcpbShowConfidence = checked; const card = document.getElementById('srt-home-card'); if (card && card._vcpbData) { vcpbRenderTable(_vcpbViewMode === 'sector' ? card._vcpbData.sectors : (card._vcpbData.industries || [])); } }
function vcpbSetViewMode(mode) {
  _vcpbViewMode = mode; const secBtn = document.getElementById('vcpb-view-sector'); const indBtn = document.getElementById('vcpb-view-industry'); if (secBtn && indBtn) { if (mode === 'sector') { secBtn.style.background = 'var(--accent)'; secBtn.style.color = '#050508'; secBtn.style.fontWeight = '700'; indBtn.style.background = 'transparent'; indBtn.style.color = 'var(--sub)'; indBtn.style.fontWeight = '600'; } else { indBtn.style.background = 'var(--accent)'; indBtn.style.color = '#050508'; indBtn.style.fontWeight = '700'; secBtn.style.background = 'transparent'; secBtn.style.color = 'var(--sub)'; secBtn.style.fontWeight = '600'; } }
  const card = document.getElementById('srt-home-card'); if (card && card._vcpbData) { vcpbRender(card._vcpbData); }
  if (typeof slhRender === 'function') slhRender();
}
function vcpbGetUrl() { const stored = localStorage.getItem(LS_VCPB_URL); if (stored) return stored.trim().replace(/\/$/, ''); const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.protocol === 'file:'; return isLocal ? 'http://localhost:9090' : 'https://mkshibu2.github.io/breadth-radar'; }
function vcpbSetStoredUrl(url) { localStorage.setItem(LS_VCPB_URL, url.trim().replace(/\/$/, '')); }
function vcpbToggleLocalGlobal() {
  const current = vcpbGetUrl(); const localUrl = 'http://localhost:9090'; const globalUrl = 'https://mkshibu2.github.io/breadth-radar'; if (current.includes('localhost') || current.includes('127.0.0.1')) { vcpbSetStoredUrl(globalUrl); } else { vcpbSetStoredUrl(localUrl); }
  const inp = document.getElementById('vcpb-url-input'); if (inp) inp.value = vcpbGetUrl(); vcpbUpdateToggleBtn(); vcpbFetch(true);
}
function vcpbUpdateToggleBtn() { const btn = document.getElementById('vcpb-toggle-src-btn'); if (!btn) return; const current = vcpbGetUrl(); if (current.includes('localhost') || current.includes('127.0.0.1')) { btn.textContent = 'Switch to GitHub'; btn.title = 'Switch to fetching daily data from GitHub Pages'; } else { btn.textContent = 'Switch to Local'; btn.title = 'Switch to fetching scanned data from localhost proxy'; } }
function vcpbGetCached() { try { return JSON.parse(localStorage.getItem(LS_VCPB_DATA)) || null; } catch (e) { return null; } }
function vcpbSetCached(data) { try { localStorage.setItem(LS_VCPB_DATA, JSON.stringify(data)); } catch (e) { } }
function vcpbGetHist() { try { return JSON.parse(localStorage.getItem(LS_VCPB_HIST)) || {}; } catch (e) { return {}; } }
function vcpbSetHist(h) { try { localStorage.setItem(LS_VCPB_HIST, JSON.stringify(h)); } catch (e) { } }
const VCPB_NSE_URLS = { 'Capital Goods': 'https://www.nseindia.com/index-tracker/NIFTY%20CAPITAL%20MKT', 'NBFCs & Finance': 'https://www.nseindia.com/index-tracker/NIFTY%20FIN%20SERVICE', 'Banks': 'https://www.nseindia.com/index-tracker/NIFTY%20BANK', 'Pharma': 'https://www.nseindia.com/index-tracker/NIFTY%20PHARMA', 'Hospitals & Healthcare': 'https://www.nseindia.com/index-tracker/NIFTY%20HEALTHCARE%20INDEX', 'Automobile and Auto Components': 'https://www.nseindia.com/index-tracker/NIFTY%20AUTO', 'Information Technology': 'https://www.nseindia.com/index-tracker/NIFTY%20IT', 'Metals & Mining': 'https://www.nseindia.com/index-tracker/NIFTY%20METAL', 'Oil Gas & Consumable Fuels': 'https://www.nseindia.com/index-tracker/NIFTY%20ENERGY', 'Power': 'https://www.nseindia.com/index-tracker/NIFTY%20INDIA%20MFG', 'Realty': 'https://www.nseindia.com/index-tracker/NIFTY%20REALTY', 'Fast Moving Consumer Goods': 'https://www.nseindia.com/index-tracker/NIFTY%20FMCG', 'Specialty Chemicals': 'https://www.nseindia.com/index-tracker/NIFTY%20COMMODITIES', 'Construction': 'https://www.nseindia.com/index-tracker/NIFTY%20INFRA', 'Construction Materials': 'https://www.nseindia.com/index-tracker/NIFTY%20INFRA', 'Defense': 'https://www.nseindia.com/index-tracker/NIFTY%20IND%20DEFENCE', 'Telecommunication': 'https://www.nseindia.com/index-tracker/NIFTY%20MEDIA', 'Consumer Services': 'https://www.nseindia.com/index-tracker/NIFTY%20CONSUMER%20DURABLES', 'Consumer Durables': 'https://www.nseindia.com/index-tracker/NIFTY%20CONSUMER%20DURABLES', 'Services': 'https://www.nseindia.com/index-tracker/NIFTY%20SERV%20SECTOR', 'Railways': 'https://www.nseindia.com/index-tracker/NIFTY%20INDIA%20MFG', 'Textiles': 'https://www.nseindia.com/index-tracker/NIFTY%20INDIA%20MFG', 'Agrochemicals & Fertilizers': 'https://www.nseindia.com/index-tracker/NIFTY%20COMMODITIES', 'Diversified': 'https://www.nseindia.com/index-tracker/NIFTY%20500', 'Media Entertainment & Publication': 'https://www.nseindia.com/index-tracker/NIFTY%20MEDIA', }; function vcpbNseUrl(sec) { return VCPB_NSE_URLS[sec] || 'https://www.nseindia.com/market-data/live-equity-market?symbol=NIFTY%20500'; }
function vcpbScore(s) { return Math.round(s.a20_pct * 0.50 + s.a50_pct * 0.30 + s.a200_pct * 0.20); }
function srtCheckMinerviniTrend(sector) { const h = sector.history; if (!h) return false; const validH = h.filter(e => e.close && e.niftyClose); if (validH.length < 40) return false; const last = validH[validH.length - 1]; const close = last.close; const ma10 = srtMA(validH, 10); const ma20 = srtMA(validH, 20); const ma30 = srtMA(validH, 30); const ma40 = srtMA(validH, 40); if (!ma10 || !ma20 || !ma30 || !ma40) return false; const cond1 = close > ma30 && close > ma40; const ma40_prev = srtMA(validH.slice(0, -4), 40); const cond2 = ma40_prev ? ma40 > ma40_prev : true; const cond3 = ma10 > ma20 && ma20 > ma30 && ma30 > ma40; const cond4 = close > ma10 && close > ma20; const recentCloses = validH.slice(-52).map(e => e.close); const high52 = Math.max(...recentCloses); const low52 = Math.min(...recentCloses); const cond5 = close >= high52 * 0.75; const cond6 = close >= low52 * 1.30; return cond1 && cond2 && cond3 && cond4 && cond5 && cond6; }
function srtIsBlueSkyRS(sector) { const series = rrgComputeSeries(sector); if (!series || series.length < 5) return false; const current = series[series.length - 1].rsRatio; const windowSize = Math.min(series.length, 52); const recent = series.slice(-windowSize); const max = Math.max(...recent.map(p => p.rsRatio)); return current >= max; }
function vcpbCalculateADScore(sectorName) {
  const hist = vcpbGetHist(); const raw = hist[sectorName]; if (!raw || raw.length < 2) return { net: 0, acc: 0, dist: 0 }; const sorted = [...raw].sort((a, b) => a.date.localeCompare(b.date)); const recent = sorted.slice(-21); let acc = 0; let dist = 0; for (let i = 1; i < recent.length; i++) { const change = recent[i].score - recent[i - 1].score; if (change >= 2.5) acc++; else if (change <= -2.5) dist++; }
  return { net: acc - dist, acc, dist };
}
const VCPB_HIST_MAX_DAYS = 60; function vcpbGetActiveNames() { const cached = vcpbGetCached(); if (!cached) return []; const list = _vcpbViewMode === 'industry' ? cached.industries : cached.sectors; if (!list || !Array.isArray(list)) return []; return list.map(x => x.sector); }
function vcpbAccumulateHistory(data) { if (!data) return; const hist = vcpbGetHist(); const date = data.scan_date; if (!date) return; const items = []; if (data.sectors) items.push(...data.sectors); if (data.industries) items.push(...data.industries); items.forEach(s => { if (!hist[s.sector]) hist[s.sector] = []; if (hist[s.sector].some(e => e.date === date)) return; hist[s.sector].push({ date, score: vcpbScore(s), a20: s.a20_pct, a50: s.a50_pct, a200: s.a200_pct, }); hist[s.sector].sort((a, b) => a.date.localeCompare(b.date)); if (hist[s.sector].length > VCPB_HIST_MAX_DAYS) { hist[s.sector] = hist[s.sector].slice(-VCPB_HIST_MAX_DAYS); } }); vcpbSetHist(hist); }
function vcpbShowState(state) { ['vcpb-loading', 'vcpb-needs-config', 'vcpb-error', 'vcpb-data', 'vcpb-source-row'].forEach(id => { const el = document.getElementById(id); if (el) el.style.display = 'none'; }); const show = document.getElementById(state); if (show) show.style.display = 'block'; }
function vcpbShowConfig() { vcpbShowState('vcpb-needs-config'); }
function vcpbSaveUrl() {
  const inp = document.getElementById('vcpb-url-input'); const msg = document.getElementById('vcpb-url-msg'); if (!inp) return; const raw = inp.value.trim(); if (!raw || !raw.startsWith('http')) {
    if (msg) { msg.style.color = 'var(--red)'; msg.textContent = 'Enter a valid URL starting with https://'; }
    return;
  }
  vcpbSetStoredUrl(raw); if (msg) { msg.style.color = 'var(--lime)'; msg.textContent = 'Saved — fetching…'; }
  vcpbFetch(true);
}
async function vcpbFetch(force) {
  const baseUrl = vcpbGetUrl(); if (force) { _n500CsvCache = null; localStorage.removeItem(LS_N500_CSV); _filterStocksCache = null; localStorage.removeItem(LS_FILTER_STOCKS_CSV); }
  if (!baseUrl) {
    const cached = vcpbGetCached(); if (cached) { vcpbRender(cached); return; }
    vcpbShowState('vcpb-needs-config'); return;
  }
  if (!force) { const cached = vcpbGetCached(); if (cached) { vcpbRender(cached); } else { vcpbShowState('vcpb-loading'); } } else { vcpbShowState('vcpb-loading'); }
  let resp; let localSuccess = false; let jsonUrl = baseUrl + '/sector_breadth.json?_=' + Date.now(); if (window.location.protocol === 'file:') { try { const localUrl = 'http://localhost:9090/local/sector_breadth.json?_=' + Date.now(); resp = await fetch(localUrl, { cache: 'no-store' }); if (resp.ok) { localSuccess = true; jsonUrl = 'http://localhost:9090/local/sector_breadth.json'; } } catch (e) { } }
  if (!localSuccess) { try { resp = await fetch(jsonUrl, { cache: 'no-store' }); if (!resp.ok && jsonUrl.includes('localhost:9090')) throw new Error('Local proxy down'); } catch (e) { jsonUrl = 'https://mkshibu2.github.io/breadth-radar/sector_breadth.json?_=' + Date.now(); resp = await fetch(jsonUrl, { cache: 'no-store' }); } }
  const srcEl = document.getElementById('vcpb-source-url'); if (srcEl) srcEl.textContent = jsonUrl.split('?')[0]; try { if (!resp.ok) throw new Error('HTTP ' + resp.status + ' — file not found. Has the scanner run today?'); const data = await resp.json(); if (!data.sectors || !Array.isArray(data.sectors)) throw new Error('Unexpected JSON format.'); vcpbSetCached(data); vcpbAccumulateHistory(data); vcpbRender(data); sdFetchCsv(force); } catch (e) {
    const cached = vcpbGetCached(); if (cached && !force) { vcpbRender(cached); return; }
    vcpbShowState('vcpb-error'); const errEl = document.getElementById('vcpb-error-msg'); if (errEl) errEl.textContent = '⚠ ' + e.message;
  }
}
function vcpbSetSort(key) {
  const s1 = document.getElementById('vcpb-sort-1'); if (_vcpbSort === key) { _vcpbSortAsc = !_vcpbSortAsc; } else { _vcpbSort = key; _vcpbSortAsc = (key === 'sector'); if (s1) s1.value = key; }
  const card = document.getElementById('srt-home-card'); if (card && card._vcpbData) vcpbRenderTable(_vcpbViewMode === 'sector' ? card._vcpbData.sectors : (card._vcpbData.industries || []));
}
function vcpbPopulateSortDropdowns() { const options = [{ value: 'none', text: 'None' }, { value: 'composite', text: 'Score' }, { value: 'universe', text: 'VCP(Univ)' }, { value: 'a20_pct', text: '>20EMA' }, { value: 'a50_pct', text: '>50SMA' }, { value: 'a200_pct', text: '>200SMA' }, { value: '_trend', text: 'Trend' }, { value: '_med90', text: 'Med90%' }, { value: '_accel', text: 'Accel' }, { value: '_adScore', text: 'A/D' }, { value: '_rs', text: 'RS wk' }, { value: '_stageScore', text: 'Stage' }, { value: '_daysAtTop', text: '@Top' }, { value: '_confidence', text: 'Conf' }, { value: 'sector', text: 'Sector' }];['vcpb-sort-1', 'vcpb-sort-2', 'vcpb-sort-3', 'vcpb-sort-4', 'vcpb-sort-5', 'vcpb-sort-6'].forEach(id => { const el = document.getElementById(id); if (!el) return; el.innerHTML = options.map(opt => { if (id === 'vcpb-sort-1' && opt.value === 'none') return ''; return `<option value="${opt.value}">${opt.text}</option>`; }).join(''); }); const s1 = document.getElementById('vcpb-sort-1'); const s2 = document.getElementById('vcpb-sort-2'); const s3 = document.getElementById('vcpb-sort-3'); const s4 = document.getElementById('vcpb-sort-4'); const s5 = document.getElementById('vcpb-sort-5'); const s6 = document.getElementById('vcpb-sort-6'); if (s1) s1.value = 'composite'; if (s2) s2.value = '_med90'; if (s3) s3.value = '_accel'; if (s4) s4.value = '_adScore'; if (s5) s5.value = '_rs'; if (s6) s6.value = 'none'; }
function vcpbApplyMultiSort() {
  const s1 = document.getElementById('vcpb-sort-1'); if (s1) { const key = s1.value; if (_vcpbSort !== key) { _vcpbSort = key; _vcpbSortAsc = (key === 'sector'); } }
  const card = document.getElementById('srt-home-card'); if (card && card._vcpbData) vcpbRenderTable(_vcpbViewMode === 'sector' ? card._vcpbData.sectors : (card._vcpbData.industries || []));
}
function vcpbSetPreset(presetName) { if (presetName === 'minervini') { const keys = ['_stageScore', '_rs', 'composite', '_accel', '_daysAtTop', '_med90']; keys.forEach((key, idx) => { const el = document.getElementById('vcpb-sort-' + (idx + 1)); if (el) el.value = key; }); _vcpbSort = '_stageScore'; _vcpbSortAsc = false; vcpbApplyMultiSort(); } else if (presetName === 'oneil') { const keys = ['_rs', '_adScore', 'composite', '_daysAtTop', '_accel', '_med90']; keys.forEach((key, idx) => { const el = document.getElementById('vcpb-sort-' + (idx + 1)); if (el) el.value = key; }); _vcpbSort = '_rs'; _vcpbSortAsc = false; vcpbApplyMultiSort(); } else if (presetName === 'zanger') { const keys = ['_med90', '_accel', '_rs', '_stageScore', 'composite', '_daysAtTop']; keys.forEach((key, idx) => { const el = document.getElementById('vcpb-sort-' + (idx + 1)); if (el) el.value = key; }); _vcpbSort = '_med90'; _vcpbSortAsc = false; vcpbApplyMultiSort(); } }
function vcpbResetSort() { const defaults = ['composite', '_med90', '_accel', '_adScore', '_rs', 'none']; defaults.forEach((key, idx) => { const el = document.getElementById('vcpb-sort-' + (idx + 1)); if (el) el.value = key; }); _vcpbSort = 'composite'; _vcpbSortAsc = false; const card = document.getElementById('srt-home-card'); if (card && card._vcpbData) { vcpbRenderTable(_vcpbViewMode === 'sector' ? card._vcpbData.sectors : (card._vcpbData.industries || [])); } }
function vcpbPctColor(pct) { if (pct >= 60) return 'var(--lime)'; if (pct >= 40) return 'var(--yellow)'; return 'var(--red)'; }
function vcpbTrendBar(a20, a50, a200) {
  return '<div style="display:flex;gap:2px;align-items:flex-end;height:20px">' +
    [{ v: a20, l: '20E' }, { v: a50, l: '50S' }, { v: a200, l: '200S' }].map(s => { const h = Math.max(3, Math.round(s.v / 100 * 20)); return `<div title="${s.l}: ${s.v}%" style="width:11px;height:${h}px;background:${vcpbPctColor(s.v)};border-radius:1px 1px 0 0;opacity:.85"></div>`; }).join('') + '</div>';
}
function vcpbMedianR90(sectorName) { try { const data = sectorDrillGetCached(); if (!data) return null; const activeMap = _vcpbViewMode === 'industry' ? data.industries : data.sectors; const secData = activeMap?.[sectorName]; const stocks = secData?.stocks || []; if (!stocks.length) return null; const r90s = stocks.map(s => s.r90).filter(v => v != null && !isNaN(v)); if (!r90s.length) return null; r90s.sort((a, b) => a - b); const mid = Math.floor(r90s.length / 2); return r90s.length % 2 ? r90s[mid] : Math.round((r90s[mid - 1] + r90s[mid]) / 2 * 10) / 10; } catch (e) { return null; } }
function vcpbAcceleration(sectorName) { const hist = vcpbGetHist(); const raw = hist[sectorName]; if (!raw || raw.length < 11) return null; const sorted = [...raw].sort((a, b) => a.date.localeCompare(b.date)); const n = sorted.length; const cur = sorted[n - 1].score; const mid = sorted[n - 6].score; const old = sorted[Math.max(0, n - 11)].score; const recentDelta = cur - mid; const priorDelta = mid - old; return Math.round((recentDelta - priorDelta) * 10) / 10; }
function vcpbDaysAtTop(sectorName) {
  const hist = vcpbGetHist(); const sectorHist = hist[sectorName]; if (!sectorHist || sectorHist.length < 2) return 0; const allSectors = Object.keys(hist); const sorted = [...sectorHist].sort((a, b) => a.date.localeCompare(b.date)); let days = 0; for (let i = sorted.length - 1; i >= 0; i--) { const date = sorted[i].date; const scores = allSectors.map(sec => (hist[sec] || []).find(e => e.date === date)?.score).filter(v => v != null); if (!scores.length) break; scores.sort((a, b) => a - b); const median = scores[Math.floor(scores.length / 2)]; if (sorted[i].score >= median) days++; else break; }
  return days;
}
function vcpbScoreTrend(sectorName) { const hist = vcpbGetHist(); const raw = hist[sectorName]; if (!raw || raw.length < 2) return null; const sorted = [...raw].sort((a, b) => a.date.localeCompare(b.date)); const cur = sorted.at(-1).score; const prev = sorted[Math.max(0, sorted.length - 6)].score; return cur - prev; }
function vcpbGetSrtOverlay() { try { const secs = srtLoad ? srtLoad() : []; const map = {}; secs.forEach(s => { if (s.id === 'NIFTY50') return; map[s.name] = { rs: s.rs, stage: s.stage, vs20: s.vs20, isMinervini: srtCheckMinerviniTrend(s), isBlueSky: srtIsBlueSkyRS(s) }; }); return map; } catch (e) { return {}; } }
function stageToScore(stage) { return { S2: 4, S1: 3, S3: 2, S4: 1 }[stage] || 0; }
function updateTableHeaderSortIndicators() {
  const headers = { 'sector': { text: 'Sector / Theme' }, 'universe': { text: 'VCP(Univ)' }, 'composite': { text: 'Score' }, 'a20_pct': { text: '>20EMA' }, 'a50_pct': { text: '>50SMA' }, 'a200_pct': { text: '>200SMA' }, '_trend': { text: 'Trend' }, '_med90': { text: 'Med90%' }, '_accel': { text: 'Accel' }, '_adScore': { text: 'A/D' }, '_rs': { text: 'RS wk' }, '_stageScore': { text: 'Stage' }, '_daysAtTop': { text: '@Top' }, '_confidence': { text: 'Conf' } }; Object.keys(headers).forEach(k => {
    const el = document.getElementById('vcpb-h-' + k); if (!el) return; let displayName = headers[k].text; if (k === _vcpbSort) { displayName += _vcpbSortAsc ? ' ▲' : ' ▼'; el.style.textDecoration = 'underline'; el.style.opacity = '1'; } else { el.style.textDecoration = 'none'; if (k === '_rs' || k === '_stageScore') { el.style.opacity = '0.5'; } else { el.style.opacity = '0.85'; } }
    el.innerHTML = displayName;
  });
}
function vcpbRenderTable(sectors) {
  const tbody = document.getElementById('vcpb-tbody'); if (!tbody) return; if (!sectors || !Array.isArray(sectors)) return; updateTableHeaderSortIndicators(); const overlay = vcpbGetSrtOverlay(); const enriched = sectors.map(s => {
    const over = overlay[s.sector] || Object.entries(overlay).find(([k]) => k.toLowerCase().includes(s.sector.toLowerCase().split(' ')[0]) || s.sector.toLowerCase().includes(k.toLowerCase().split(' ')[0]))?.[1] || null; const med90 = vcpbMedianR90(s.sector); const accel = vcpbAcceleration(s.sector); const adInfo = vcpbCalculateADScore(s.sector); const universe = s.universe || 0; const daysAtTop = vcpbDaysAtTop(s.sector); const stage = (over && over.stage) ? over.stage : ''; const rs = (over && over.rs != null) ? over.rs : -9999; let confidence = 'Medium'; if (universe >= 5 && daysAtTop >= 10 && (stage === 'S2' || rs >= 0)) { confidence = 'High'; } else if (universe <= 2 || vcpbScore(s) < 40) { confidence = 'Low'; }
    const confScore = confidence === 'High' ? 3 : confidence === 'Medium' ? 2 : 1; return { ...s, composite: vcpbScore(s), _over: over, _rs: (over && over.rs != null) ? over.rs : -9999, _stageScore: (over && over.stage) ? stageToScore(over.stage) : -1, _isMinervini: (over && over.isMinervini) ? 1 : 0, _isBlueSky: (over && over.isBlueSky) ? 1 : 0, _daysAtTop: vcpbDaysAtTop(s.sector), _trend: vcpbScoreTrend(s.sector), _med90: med90 !== null ? med90 : -9999, _accel: accel !== null ? accel : -9999, _adScore: adInfo.net, _adAcc: adInfo.acc, _adDist: adInfo.dist, _confidence: confidence, _confidenceScore: confScore };
  }); let filtered = [...enriched]; if (_vcpbSearchQuery) { const q = _vcpbSearchQuery.toLowerCase(); filtered = filtered.filter(s => s.sector.toLowerCase().includes(q)); }
  if (_vcpbFilter !== 'all') { if (_vcpbFilter === 'strong') { filtered = filtered.filter(s => s.composite >= 60); } else if (_vcpbFilter === 'neutral') { filtered = filtered.filter(s => s.composite >= 40 && s.composite < 60); } else if (_vcpbFilter === 'weak') { filtered = filtered.filter(s => s.composite < 40); } else if (_vcpbFilter === 'stage2') { filtered = filtered.filter(s => s._stageScore === 4); } else if (_vcpbFilter === 'high_conf') { filtered = filtered.filter(s => s._confidence === 'High'); } else if (_vcpbFilter === 'emerging') { filtered = filtered.filter(s => { if (_vcpbViewMode === 'industry') { return s.parent_sector === 'Emerging'; } else { const name = s.sector.toLowerCase(); return name.includes('defen') || name.includes('aero') || name.includes('ship') || name.includes('drone'); } }); } }
  const compareFields = (a, b, key, asc) => {
    let valA = a[key]; let valB = b[key]; if (key === 'universe') {
      const vcpA = a.vcp_count !== undefined ? a.vcp_count : 0; const vcpB = b.vcp_count !== undefined ? b.vcp_count : 0; if (vcpA !== vcpB) { return asc ? (vcpA - vcpB) : (vcpB - vcpA); }
      const uniA = a.universe !== undefined ? a.universe : 0; const uniB = b.universe !== undefined ? b.universe : 0; return asc ? (uniA - uniB) : (uniB - uniA);
    }
    if (key === 'sector') { const strA = valA || ''; const strB = valB || ''; return asc ? strA.localeCompare(strB) : strB.localeCompare(strA); }
    if (key === '_confidence') { const vA = a._confidenceScore || 2; const vB = b._confidenceScore || 2; return asc ? (vA - vB) : (vB - vA); }
    const isInvalidA = (valA === null || valA === undefined || valA === -9999 || valA === -1); const isInvalidB = (valB === null || valB === undefined || valB === -9999 || valB === -1); if (isInvalidA && isInvalidB) return 0; if (isInvalidA) return 1; if (isInvalidB) return -1; return asc ? (valA - valB) : (valB - valA);
  }; const sorted = [...filtered].sort((a, b) => {
    const s1 = document.getElementById('vcpb-sort-1'); const s2 = document.getElementById('vcpb-sort-2'); const s3 = document.getElementById('vcpb-sort-3'); const s4 = document.getElementById('vcpb-sort-4'); const s5 = document.getElementById('vcpb-sort-5'); const s6 = document.getElementById('vcpb-sort-6'); const keys = [s1 ? s1.value : _vcpbSort, s2 ? s2.value : 'none', s3 ? s3.value : 'none', s4 ? s4.value : 'none', s5 ? s5.value : 'none', s6 ? s6.value : 'none'].filter(k => k && k !== 'none'); for (let index = 0; index < keys.length; index++) { const key = keys[index]; const asc = (index === 0) ? _vcpbSortAsc : (key === 'sector'); const res = compareFields(a, b, key, asc); if (res !== 0) return res; }
    return 0;
  }); let sliced = sorted; if (_vcpbFilter === 'top10') { sliced = sorted.slice(0, 10); } else if (_vcpbFilter === 'top25') { sliced = sorted.slice(0, 25); }
  const confHeader = document.getElementById('vcpb-h-_confidence'); if (confHeader) { confHeader.style.display = _vcpbShowConfidence ? 'table-cell' : 'none'; }
  tbody.innerHTML = sliced.map((s, i) => {
    const scoreC = vcpbPctColor(s.composite); const a20C = vcpbPctColor(s.a20_pct); const a50C = vcpbPctColor(s.a50_pct); const a200C = vcpbPctColor(s.a200_pct); const rowBg = i === 0 ? 'rgba(45,212,191,.04)' : 'transparent'; const trendArrow = s._trend === null ? '' : s._trend > 2 ? '<span style="color:var(--lime);font-size:10px;margin-left:2px">&#8593;</span>' : s._trend < -2 ? '<span style="color:var(--red);font-size:10px;margin-left:2px">&#8595;</span>' : '<span style="color:var(--dim);font-size:10px;margin-left:2px">&#8594;</span>'; const m90val = s._med90 !== -9999 ? s._med90 : null; const m90C = m90val === null ? 'var(--border)' : m90val >= 30 ? 'var(--lime)' : m90val >= 10 ? '#fb923c' : m90val >= 0 ? 'var(--yellow)' : 'var(--red)'; const m90Cell = m90val !== null ? `<span style="color:${m90C};font-weight:600">${m90val > 0 ? '+' : ''}${m90val}%</span>` : '<span style="color:var(--border)">—</span>'; const accVal = s._accel !== -9999 ? s._accel : null; const accC = accVal === null ? 'var(--border)' : accVal >= 3 ? 'var(--lime)' : accVal >= 0 ? 'var(--yellow)' : accVal >= -3 ? '#fb923c' : 'var(--red)'; const accArrow = accVal === null ? '' : accVal >= 3 ? '↑↑' : accVal >= 0 ? '↑' : accVal >= -3 ? '↓' : '↓↓'; const accCell = accVal !== null ? `<span style="font-size:10px;font-weight:700;color:${accC};font-family:var(--mono)">${accArrow}</span><span style="font-size:9px;color:${accC};opacity:.8;margin-left:2px">${accVal > 0 ? '+' : ''}${accVal}</span>` : '<span style="color:var(--border)">—</span>'; const adVal = s._adScore; const adC = adVal > 0 ? 'var(--lime)' : adVal < 0 ? 'var(--red)' : 'var(--dim)'; const adText = adVal > 0 ? `+${adVal}` : adVal; const adCell = `<span style="font-size:11px;font-family:var(--mono);font-weight:700;color:${adC}" title="Breadth A/D over last 20 days: ${s._adAcc} Accumulation days vs ${s._adDist} Distribution days">${adText}</span>`; const over = s._over; const rsCell = over && over.rs != null ? `<span style="color:${over.rs >= 0 ? 'var(--lime)' : 'var(--red)'}">${over.rs > 0 ? '+' : ''}${over.rs}</span>` : '<span style="color:var(--border)">—</span>'; const stageInfo = over && over.stage ? ({ S2: { c: 'var(--lime)', l: 'S2' }, S1: { c: 'var(--accent)', l: 'S1' }, S3: { c: 'var(--yellow)', l: 'S3' }, S4: { c: 'var(--red)', l: 'S4' } })[over.stage] || null : null; const isMinervini = s._isMinervini; const stageCell = stageInfo ? `<span style="font-size:9px;font-weight:700;color:${stageInfo.c};background:rgba(0,0,0,.2);padding:1px 5px;border-radius:3px" ${isMinervini ? 'title="Minervini Stage 2 Trend Template Verified"' : ''}>${stageInfo.l}${isMinervini ? ' ⚡' : ''}</span>` : '<span style="color:var(--border)">—</span>'; const dTop = s._daysAtTop; const dTopC = dTop >= 15 ? 'var(--lime)' : dTop >= 7 ? 'var(--yellow)' : 'var(--dim)'; const wks = dTop > 0 ? Math.round(dTop / 5) : 0; const dTopCell = dTop > 0 ? `<span style="font-size:10px;font-family:var(--mono);font-weight:600;color:${dTopC}">${wks}w</span>` : '<span style="color:var(--border)">—</span>'; const starHtml = s._isBlueSky ? '<span style="color:var(--yellow);font-size:11px;margin-left:4px" title="Blue Sky RS: Weekly relative strength vs Nifty 50 at 52-week high">🌟</span>' : ''; const confColor = s._confidence === 'High' ? 'var(--lime)' : s._confidence === 'Low' ? 'var(--red)' : 'var(--yellow)'; const confCell = _vcpbShowConfidence ? `<td style="padding:5px 4px;text-align:center;font-size:10px;font-weight:700;color:${confColor}">${s._confidence}</td>` : ''; return `<tr style="border-bottom:1px solid var(--border);background:${rowBg};cursor:pointer"
      onmouseenter="this.style.background='rgba(45,212,191,.06)'"
      onmouseleave="this.style.background='${rowBg}'"
      title="Click sector name to see stocks · NSE opens index page">
      <td style="padding:5px 4px;color:var(--dim);font-size:10px;font-family:var(--mono)">${i + 1}</td>
      <td style="padding:5px 4px;font-weight:700;font-size:12px;font-family:var(--disp)">
        <span onclick="sectorDrillOpen('${s.sector.replace(/'/g, "\\'")}')" style="cursor:pointer;text-decoration:underline;text-decoration-color:rgba(45,212,191,.3);text-underline-offset:3px">${s.sector}</span>${starHtml}
        <a href="${vcpbNseUrl(s.sector)}" target="_blank" rel="noopener"
           onclick="event.stopPropagation()"
           style="display:inline-block;margin-left:5px;font-size:9px;color:var(--teal);opacity:.7;text-decoration:none;background:rgba(45,212,191,.1);padding:0 4px;border-radius:2px;border:1px solid rgba(45,212,191,.2);vertical-align:middle">NSE↗</a>
      </td>
      <td style="padding:5px 4px;text-align:center;color:var(--sub);font-size:11px;font-family:var(--mono)">${s.vcp_count !== undefined ? s.vcp_count : 0}(${s.universe !== undefined ? s.universe : 0})</td>
      <td style="padding:5px 4px;text-align:center;font-family:var(--disp);font-size:16px;font-weight:800;color:${scoreC}">${s.composite}${trendArrow}</td>
      <td style="padding:5px 4px;text-align:right;font-size:11px;font-family:var(--mono);color:${a20C}">${s.a20_pct}%</td>
      <td style="padding:5px 4px;text-align:right;font-size:11px;font-family:var(--mono);color:${a50C}">${s.a50_pct}%</td>
      <td style="padding:5px 4px;text-align:right;font-size:11px;font-family:var(--mono);color:${a200C}">${s.a200_pct}%</td>
      <td style="padding:5px 4px;text-align:center">${vcpbTrendBar(s.a20_pct, s.a50_pct, s.a200_pct)}</td>
      <td style="padding:5px 4px;text-align:right">${m90Cell}</td>
      <td style="padding:5px 4px;text-align:center;white-space:nowrap">${accCell}</td>
      <td style="padding:5px 4px;text-align:center;white-space:nowrap">${adCell}</td>
      <td style="padding:5px 4px;text-align:center;font-size:11px;font-family:var(--mono);opacity:.7">${rsCell}</td>
      <td style="padding:5px 4px;text-align:center;opacity:.7">${stageCell}</td>
      <td style="padding:5px 4px;text-align:center">${dTopCell}</td>
      ${confCell}
    </tr>`;
  }).join('');
}
function vcpbRender(data) {
  const card = document.getElementById('srt-home-card'); if (card) card._vcpbData = data; vcpbShowState('vcpb-data'); const srcRow = document.getElementById('vcpb-source-row'); const timeEl = document.getElementById('vcpb-scan-time'); const qualEl = document.getElementById('vcpb-qualified'); const badgeEl = document.getElementById('vcpb-scan-badge'); if (srcRow) srcRow.style.display = 'flex'; vcpbUpdateToggleBtn(); if (timeEl) timeEl.textContent = data.scan_time || data.scan_date || '—'; if (qualEl) qualEl.textContent = data.total_scanned || '?'; if (badgeEl) { badgeEl.textContent = data.scan_date || ''; badgeEl.style.display = 'inline'; }
  const activeList = _vcpbViewMode === 'sector' ? data.sectors : (data.industries || []); const enrichedStrip = activeList.map(s => ({ name: s.sector, score: vcpbScore(s), trend: vcpbScoreTrend(s.sector), accel: vcpbAcceleration(s.sector), med90: vcpbMedianR90(s.sector), vcp_count: s.vcp_count !== undefined ? s.vcp_count : 0, universe: s.universe !== undefined ? s.universe : 0, })).sort((a, b) => b.score - a.score); const n = enrichedStrip.length; const topCut = Math.ceil(n * 0.25); const botCut = Math.floor(n * 0.75); const leaders = enrichedStrip.slice(0, topCut); const watching = enrichedStrip.slice(topCut, botCut).filter(s => s.trend === null || s.trend >= 0); const avoid = enrichedStrip.slice(botCut); const pill = (s, c, bg) => {
    const label = SRT_SHORT[s.name] || s.name.split(' ')[0]; const esc = s.name.replace(/'/g, "\\'"); const accelTip = s.accel !== null ? ` · Accel: ${s.accel > 0 ? '+' : ''}${s.accel}` : ''; const med90Tip = s.med90 !== null ? ` · Med90: ${s.med90 > 0 ? '+' : ''}${s.med90}%` : ''; return `<span onclick="sectorDrillOpen('${esc}')"
      style="display:inline-block;margin:1px 3px 1px 0;padding:2px 8px;border-radius:3px;background:${bg};color:${c};font-size:10px;font-weight:700;font-family:var(--mono);cursor:pointer;transition:opacity .15s"
      onmouseenter="this.style.opacity='.75'" onmouseleave="this.style.opacity='1'"
      title="${s.name} · Score: ${s.score}${accelTip}${med90Tip} · Click for stocks">${label} <span style="font-weight:400;opacity:.75">${s.vcp_count}(${s.universe})</span></span>`;
  }; const leadEl = document.getElementById('vcpb-ls-lead'); const watchEl = document.getElementById('vcpb-ls-watch'); const avoidEl = document.getElementById('vcpb-ls-avoid'); if (leadEl) leadEl.innerHTML = leaders.map(s => pill(s, '#0e1420', 'var(--lime)')).join(''); if (watchEl) watchEl.innerHTML = watching.length ? watching.map(s => pill(s, '#0e1420', 'var(--yellow)')).join('') : '<span style="color:var(--dim);font-size:10px">—</span>'; if (avoidEl) avoidEl.innerHTML = avoid.map(s => pill(s, '#fff', 'rgba(248,113,113,.2)')).join(''); vcpbRenderTable(activeList); const rrgPane = document.getElementById('scc-pane-rrg'); if (rrgPane && rrgPane.style.display !== 'none') { brrgRebuildChips(); brrgDraw(); }
  if (typeof sccRenderDashboardWidget === 'function') sccRenderDashboardWidget(data);
}
function vcpbInit() { vcpbPopulateSortDropdowns(); const saved = vcpbGetUrl(); const inp = document.getElementById('vcpb-url-input'); if (inp && saved) inp.value = saved; vcpbUpdateToggleBtn(); vcpbFetch(false); sdFetchSectorStocksBackground(); }
let _brrgTailDays = 10; let _brrgTopN = 8; let _brrgHighlight = new Set(); let _brrgAnimTimer = null; const BRRG_SMOOTH = 5; function brrgSetTail(d) { _brrgTailDays = d; const disp = document.getElementById('brrg-tail-display'); if (disp) disp.textContent = d + 'd';[5, 10, 20, 40].forEach(n => { const b = document.getElementById('brrg-t-' + n); if (!b) return; const active = n === d; b.style.background = active ? 'var(--purple)' : 'transparent'; b.style.color = active ? '#fff' : 'var(--dim)'; b.style.fontWeight = active ? '600' : '400'; b.style.borderColor = active ? 'var(--purple)' : 'var(--border)'; }); brrgDraw(); }
function brrgAdjustTail(delta) { const steps = [3, 5, 7, 10, 15, 20, 30, 40, 60]; const cur = steps.indexOf(_brrgTailDays); const next = Math.max(0, Math.min(steps.length - 1, (cur === -1 ? 3 : cur) + delta)); brrgSetTail(steps[next]); }
function brrgSetTopN(n) { _brrgTopN = n; const disp = document.getElementById('brrg-top-display'); if (disp) disp.textContent = n || 'All';[4, 8, 12, 0].forEach(v => { const b = document.getElementById('brrg-n-' + v); if (!b) return; const active = v === n; b.style.background = active ? 'var(--accent)' : 'transparent'; b.style.color = active ? '#000' : 'var(--dim)'; b.style.fontWeight = active ? '600' : '400'; b.style.borderColor = active ? 'var(--accent)' : 'var(--border)'; }); brrgRebuildChips(); brrgDraw(); }
function brrgAdjustTop(delta) { const hist = vcpbGetHist(); const total = Object.keys(hist).filter(k => hist[k] && hist[k].length >= 3).length; const cur = _brrgTopN === 0 ? total : _brrgTopN; const next = Math.max(2, Math.min(total, cur + delta)); _brrgTopN = next === total ? 0 : next; brrgSetTopN(_brrgTopN); }
function brrgEMA(arr, period) { if (!arr.length) return []; const k = 2 / (period + 1); const out = [arr[0]]; for (let i = 1; i < arr.length; i++)out.push(arr[i] * k + out[i - 1] * (1 - k)); return out; }
function brrgComputeAll() { const hist = vcpbGetHist(); const activeNames = new Set(vcpbGetActiveNames()); const allSectors = Object.keys(hist).filter(k => activeNames.has(k) && hist[k] && hist[k].length >= 3); if (!allSectors.length) return null; const dateSet = new Set(); allSectors.forEach(sec => hist[sec].forEach(e => dateSet.add(e.date))); const dates = [...dateSet].sort(); const rawScores = {}; allSectors.forEach(sec => { const map = {}; hist[sec].forEach(e => { map[e.date] = e.score; }); let last = null; rawScores[sec] = dates.map(d => { if (map[d] !== undefined) last = map[d]; return last; }).filter(v => v !== null); }); const avgByDate = dates.map((_, di) => { const vals = allSectors.map(s => rawScores[s][di]).filter(v => v != null); return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 50; }); const series = {}; allSectors.forEach(sec => { const scores = rawScores[sec]; if (scores.length < 3) return; const normX = scores.map((s, i) => (avgByDate[i] > 0 ? (s / avgByDate[i]) * 100 : 100)); const smoothed = brrgEMA(normX, BRRG_SMOOTH); const WINDOW = Math.max(3, Math.round(_brrgTailDays / 4)); series[sec] = smoothed.map((x, i) => { const prev = i >= WINDOW ? smoothed[i - WINDOW] : smoothed[0]; const mom = prev > 0 ? (x / prev) * 100 : 100; return { date: dates[Math.min(i, dates.length - 1)], x, y: mom, score: scores[i] }; }); }); return { series, dates }; }
function brrgRebuildChips() {
  const container = document.getElementById('brrg-chips'); if (!container) return; const hist = vcpbGetHist(); const activeNames = new Set(vcpbGetActiveNames()); const allSecs = Object.keys(hist).filter(k => activeNames.has(k) && hist[k] && hist[k].length >= 3); let displayed = allSecs; if (_brrgTopN > 0) { const computed = brrgComputeAll(); if (computed) { displayed = allSecs.filter(s => computed.series[s]).sort((a, b) => computed.series[b].at(-1).score - computed.series[a].at(-1).score).slice(0, _brrgTopN); } }
  container.innerHTML = '<span style="font-size:9px;color:var(--dim);margin-right:2px">Highlight:</span>'; displayed.forEach((sec, idx) => {
    const color = RRG_COLORS[idx % RRG_COLORS.length]; const active = _brrgHighlight.has(sec); const chip = document.createElement('span'); const label = SRT_SHORT[sec] || sec.split(' ')[0]; chip.textContent = label; chip.style.cssText = `font-size:9px;padding:2px 7px;border-radius:3px;border:1px solid ${color};
      background:${active ? color : 'transparent'};color:${active ? '#000' : color};
      cursor:pointer;transition:all .15s;font-weight:600`; chip.title = sec; chip.onclick = () => { if (_brrgHighlight.has(sec)) _brrgHighlight.delete(sec); else _brrgHighlight.add(sec); brrgRebuildChips(); brrgDraw(); }; container.appendChild(chip);
  });
}
function brrgAnimate() {
  if (_brrgAnimTimer) { brrgStopAnim(); return; }
  const computed = brrgComputeAll(); if (!computed) return; const totalPts = Math.max(...Object.values(computed.series).map(s => s.length)); const minStart = Math.max(3, totalPts - _brrgTailDays - 20); let cur = minStart; const btn = document.getElementById('brrg-anim-btn'); const wrap = document.getElementById('brrg-anim-bar-wrap'); const bar = document.getElementById('brrg-anim-bar'); const label = document.getElementById('brrg-anim-day-label'); if (wrap) wrap.style.display = 'block'; if (btn) { btn.textContent = '⏸ Pause'; btn.style.color = 'var(--yellow)'; }
  _brrgAnimTimer = setInterval(() => {
    if (cur > totalPts) { brrgStopAnim(); return; }
    if (label) label.textContent = `Day ${cur - minStart + 1} / ${totalPts - minStart}`; if (bar) bar.style.width = `${((cur - minStart) / (totalPts - minStart)) * 100}%`; brrgDraw(cur); cur++;
  }, 350);
}
function brrgStopAnim() {
  if (_brrgAnimTimer) { clearInterval(_brrgAnimTimer); _brrgAnimTimer = null; }
  const btn = document.getElementById('brrg-anim-btn'); const wrap = document.getElementById('brrg-anim-bar-wrap'); if (btn) { btn.textContent = '▶ Play'; btn.style.color = 'var(--yellow)'; }
  if (wrap) wrap.style.display = 'none'; brrgDraw();
}
function brrgDraw(animUpTo) {
  const canvas = document.getElementById('brrg-canvas'); if (!canvas) return; const notice = document.getElementById('brrg-notice'); const histInfo = document.getElementById('brrg-hist-info'); const computed = brrgComputeAll(); if (!computed) {
    canvas.style.display = 'none'; if (notice) { notice.style.display = 'block'; notice.textContent = '⏳ Not enough history yet. The RRG builds automatically each day you load the dashboard. Come back after 3+ trading days for first tails.'; }
    return;
  }
  canvas.style.display = 'block'; if (notice) notice.style.display = 'none'; const { series } = computed; const maxDays = Math.max(...Object.keys(series).map(k => series[k].length)); if (histInfo) histInfo.textContent = `${maxDays} trading days accumulated`; let displayed = Object.keys(series).filter(s => series[s].length >= 3); if (_brrgTopN > 0) { displayed = displayed.sort((a, b) => series[b].at(-1).score - series[a].at(-1).score).slice(0, _brrgTopN); }
  if (!displayed.length) return; const tailed = displayed.map((sec, idx) => { const pts = animUpTo ? series[sec].slice(0, animUpTo) : series[sec]; const tail = pts.slice(-(_brrgTailDays + 1)); return { name: sec, color: RRG_COLORS[idx % RRG_COLORS.length], points: tail }; }); const allX = tailed.flatMap(s => s.points.map(p => p.x)); const allY = tailed.flatMap(s => s.points.map(p => p.y)); const padX = Math.max(3, Math.max(...allX.map(x => Math.abs(x - 100))) + 2); const padY = Math.max(1.5, Math.max(...allY.map(y => Math.abs(y - 100))) + 1); const xMin = 100 - padX, xMax = 100 + padX; const yMin = 100 - padY, yMax = 100 + padY; const isMaximized = document.getElementById('srt-home-card')?.classList.contains('maximized'); const parentWidth = canvas.parentElement.offsetWidth || 360; let W = parentWidth; let H = Math.round(W * 0.82); if (isMaximized) { const maxH = Math.max(300, window.innerHeight - 280); if (H > maxH) { H = maxH; W = Math.round(H / 0.82); } }
  canvas.width = W * devicePixelRatio; canvas.height = H * devicePixelRatio; canvas.style.width = W + 'px'; canvas.style.height = H + 'px'; const ctx = canvas.getContext('2d'); ctx.scale(devicePixelRatio, devicePixelRatio); const PAD = { l: 34, r: 14, t: 14, b: 26 }; const toX = v => PAD.l + ((v - xMin) / (xMax - xMin)) * (W - PAD.l - PAD.r); const toY = v => PAD.t + ((yMax - v) / (yMax - yMin)) * (H - PAD.t - PAD.b); const ox = toX(100), oy = toY(100); const Q = [{ x: PAD.l, y: PAD.t, w: ox - PAD.l, h: oy - PAD.t, bg: 'rgba(91,163,245,.07)', lbl: 'Improving', lx: PAD.l + 6, ly: PAD.t + 13, lc: '#5ba3f5' }, { x: ox, y: PAD.t, w: W - PAD.r - ox, h: oy - PAD.t, bg: 'rgba(74,222,128,.07)', lbl: 'Leading', lx: ox + 6, ly: PAD.t + 13, lc: '#4ade80' }, { x: PAD.l, y: oy, w: ox - PAD.l, h: H - PAD.b - oy, bg: 'rgba(248,113,113,.07)', lbl: 'Lagging', lx: PAD.l + 6, ly: oy + 13, lc: '#f87171' }, { x: ox, y: oy, w: W - PAD.r - ox, h: H - PAD.b - oy, bg: 'rgba(251,191,36,.07)', lbl: 'Weakening', lx: ox + 6, ly: oy + 13, lc: '#fbbf24' },]; Q.forEach(q => { ctx.fillStyle = q.bg; ctx.fillRect(q.x, q.y, q.w, q.h); ctx.font = 'bold 9px sans-serif'; ctx.fillStyle = q.lc; ctx.globalAlpha = 0.65; ctx.textAlign = 'left'; ctx.fillText(q.lbl, q.lx, q.ly); ctx.globalAlpha = 1; }); ctx.strokeStyle = 'rgba(255,255,255,.04)'; ctx.lineWidth = 1;[xMin, xMax].forEach(v => { const x = toX(v); ctx.beginPath(); ctx.moveTo(x, PAD.t); ctx.lineTo(x, H - PAD.b); ctx.stroke(); }); ctx.strokeStyle = 'rgba(255,255,255,.18)'; ctx.lineWidth = 1; ctx.setLineDash([3, 4]); ctx.beginPath(); ctx.moveTo(ox, PAD.t); ctx.lineTo(ox, H - PAD.b); ctx.stroke(); ctx.beginPath(); ctx.moveTo(PAD.l, oy); ctx.lineTo(W - PAD.r, oy); ctx.stroke(); ctx.setLineDash([]); ctx.font = '8px sans-serif'; ctx.fillStyle = 'rgba(255,255,255,.28)'; ctx.textAlign = 'center'; ctx.fillText('Breadth Strength (vs market avg) →', W / 2, H - 6); ctx.save(); ctx.translate(11, H / 2); ctx.rotate(-Math.PI / 2); ctx.fillText('Breadth Momentum ↑', 0, 0); ctx.restore(); const anyHighlighted = _brrgHighlight.size > 0; tailed.forEach(({ name, color, points }) => {
    if (points.length < 2) return; const highlighted = _brrgHighlight.size === 0 || _brrgHighlight.has(name); const opacity = anyHighlighted && !highlighted ? 0.15 : 1; for (let i = 1; i < points.length; i++) { const p0 = points[i - 1], p1 = points[i]; const a = (0.12 + (i / points.length) * 0.6) * opacity; ctx.beginPath(); ctx.moveTo(toX(p0.x), toY(p0.y)); ctx.lineTo(toX(p1.x), toY(p1.y)); ctx.strokeStyle = color; ctx.lineWidth = highlighted ? 2 : 1.5; ctx.globalAlpha = a; ctx.stroke(); ctx.globalAlpha = 1; }
    points.slice(0, -1).forEach((p, i) => { const a = (0.08 + (i / points.length) * 0.3) * opacity; ctx.beginPath(); ctx.arc(toX(p.x), toY(p.y), 2, 0, Math.PI * 2); ctx.fillStyle = color; ctx.globalAlpha = a; ctx.fill(); ctx.globalAlpha = 1; }); const cur = points.at(-1); const cx2 = toX(cur.x), cy2 = toY(cur.y); ctx.globalAlpha = opacity; ctx.beginPath(); ctx.arc(cx2, cy2, highlighted ? 6 : 5, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill(); ctx.strokeStyle = '#0d1520'; ctx.lineWidth = 1.5; ctx.stroke(); ctx.globalAlpha = 1; if (points.length >= 2) { const pp = points.at(-2); const dx = cur.x - pp.x, dy = -(cur.y - pp.y); const len = Math.sqrt(dx * dx + dy * dy); if (len > 0.03) { const nx = dx / len * 6, ny = dy / len * 6; ctx.globalAlpha = 0.8 * opacity; ctx.beginPath(); ctx.moveTo(cx2 - ny * 0.5, cy2 - nx * 0.5); ctx.lineTo(cx2 + nx, cy2 + ny); ctx.lineTo(cx2 + ny * 0.5, cy2 + nx * 0.5); ctx.fillStyle = color; ctx.fill(); ctx.globalAlpha = 1; } }
    const lbl = SRT_SHORT[name] || name.split(' ')[0]; const side = cx2 > W * 0.72 ? 'right' : 'left'; ctx.font = highlighted ? 'bold 10px sans-serif' : '9px sans-serif'; ctx.fillStyle = color; ctx.globalAlpha = highlighted ? 1 : 0.6 * opacity; ctx.textAlign = side; ctx.fillText(lbl, cx2 + (side === 'right' ? -9 : 9), cy2 + 3); ctx.font = '8px sans-serif'; ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fillText(Math.round(cur.score), cx2 + (side === 'right' ? -9 : 9), cy2 + 12); ctx.globalAlpha = 1;
  });
}
function brrgShowSeedPanel() { const p = document.getElementById('brrg-seed-panel'); if (p) p.style.display = p.style.display === 'none' ? 'block' : 'none'; }
function brrgSeedFromEod() {
  const msg = document.getElementById('brrg-seed-eod-msg'); const setMsg = (t, c) => { if (msg) { msg.textContent = t; msg.style.color = c; } }; let records = []; try { const LS_EOD = 'nse_eod_v1'; records = JSON.parse(localStorage.getItem(LS_EOD)) || []; } catch (e) { }
  if (!records.length) { setMsg('No 30-day history found.', 'var(--red)'); return; }
  const hist = vcpbGetHist(); let added = 0; records.forEach(r => { if (!r.date) return; const a20 = parseFloat(r.e20) || 0, a50 = parseFloat(r.s50) || 0, a200 = parseFloat(r.s200) || 0; if (!a20 && !a50 && !a200) return; const sec = 'Market (Index)'; if (!hist[sec]) hist[sec] = []; if (hist[sec].some(e => e.date === r.date)) return; hist[sec].push({ date: r.date, score: Math.round(a20 * 0.50 + a50 * 0.30 + a200 * 0.20), a20, a50, a200 }); added++; }); if (added) { Object.keys(hist).forEach(k => hist[k].sort((a, b) => a.date.localeCompare(b.date))); vcpbSetHist(hist); setMsg(`✓ Added ${added} days as "Market (Index)"`, 'var(--lime)'); brrgRebuildChips(); brrgDraw(); } else { setMsg('Already seeded or no new dates found.', 'var(--yellow)'); }
}
function brrgImportCsv() {
  const ta = document.getElementById('brrg-csv-input'); const msg = document.getElementById('brrg-csv-msg'); const setMsg = (t, c) => { if (msg) { msg.textContent = t; msg.style.color = c; } }; if (!ta || !ta.value.trim()) { setMsg('Nothing to import.', 'var(--yellow)'); return; }
  const hist = vcpbGetHist(); let added = 0, skipped = 0, errors = 0; ta.value.trim().split('\n').forEach(line => {
    line = line.trim(); if (!line || line.startsWith('#') || line.toLowerCase().startsWith('date')) return; const [date, sector, a20Raw, a50Raw, a200Raw] = line.split(',').map(p => p.trim()); if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) { errors++; return; }
    const a20 = parseFloat(a20Raw), a50 = parseFloat(a50Raw), a200 = parseFloat(a200Raw); if (isNaN(a20) || isNaN(a50) || isNaN(a200)) { errors++; return; }
    if (!hist[sector]) hist[sector] = []; if (hist[sector].some(e => e.date === date)) { skipped++; return; }
    hist[sector].push({ date, score: Math.round(a20 * 0.50 + a50 * 0.30 + a200 * 0.20), a20, a50, a200 }); added++;
  }); Object.keys(hist).forEach(k => hist[k].sort((a, b) => a.date.localeCompare(b.date))); vcpbSetHist(hist); const parts = [`✓ ${added} rows`]; if (skipped) parts.push(`${skipped} duplicates skipped`); if (errors) parts.push(`${errors} bad rows`); setMsg(parts.join(' · '), added ? 'var(--lime)' : 'var(--yellow)'); if (added) { brrgRebuildChips(); brrgDraw(); }
}
function brrgClearHistory() {
  if (!confirm('Clear all Breadth RRG history from localStorage?')) return; localStorage.removeItem(LS_VCPB_HIST); _sectorStocksCache = null; const msg = document.getElementById('brrg-csv-msg'); if (msg) { msg.textContent = 'History cleared.'; msg.style.color = 'var(--yellow)'; }
  brrgRebuildChips(); brrgDraw();
}
function srtRender() {
  const sectors = srtLoad(); const sorted = [...sectors].filter(s => s.id !== 'NIFTY50').sort((a, b) => { const sa = srtStageMeta(a.stage).score; const sb = srtStageMeta(b.stage).score; if (sb !== sa) return sb - sa; return (b.vs20 || 0) - (a.vs20 || 0); }); const lead = sorted.filter(s => s.stage === 'S2').length; const base = sorted.filter(s => s.stage === 'S1').length; const weak = sorted.filter(s => s.stage === 'S3' || s.stage === 'S4').length; const hLead = document.getElementById('srt-hero-lead'); const hBase = document.getElementById('srt-hero-base'); const hWeak = document.getElementById('srt-hero-weak'); const hSub = document.getElementById('srt-hero-sub'); const hRows = document.getElementById('srt-hero-rows'); const hEmpty = document.getElementById('srt-hero-empty'); if (hLead) hLead.textContent = sorted.length ? lead : '—'; if (hBase) hBase.textContent = sorted.length ? base : '—'; if (hWeak) hWeak.textContent = sorted.length ? weak : '—'; if (hSub) {
    if (sorted.length) {
      const top = sorted[0], m = srtStageMeta(top.stage); hSub.innerHTML = 'Top sector: <b style="color:' + m.color + '">' + top.name + '</b>'
        + ' · ' + m.label
        + ' · ' + (top.vs20 >= 0 ? '+' : '') + top.vs20.toFixed(1) + '% vs 20MA'
        + (top.rs != null ? ' · RS ' + (top.rs >= 0 ? '+' : '') + top.rs.toFixed(1) : '');
    } else { hSub.textContent = 'No sector data — add via Control Panel → Sectors tab'; }
  }
  if (hRows) { if (!sorted.length) { hRows.innerHTML = ''; if (hEmpty) hEmpty.style.display = 'block'; } else { if (hEmpty) hEmpty.style.display = 'none'; hRows.innerHTML = sorted.map((s, i) => srtBuildRow(s, i, { clickable: false, deletable: false })).join(''); } }
  const cLead = document.getElementById('srt-count-lead'); const cBase = document.getElementById('srt-count-base'); const cWeak = document.getElementById('srt-count-weak'); if (cLead) cLead.textContent = lead; if (cBase) cBase.textContent = base; if (cWeak) cWeak.textContent = weak; const tbody = document.getElementById('srt-tbody'); const empty = document.getElementById('srt-empty'); if (!tbody) return; if (!sorted.length) { tbody.innerHTML = ''; if (empty) empty.style.display = 'block'; return; }
  if (empty) empty.style.display = 'none'; tbody.innerHTML = sorted.map((s, i) => srtBuildRow(s, i, { clickable: true, deletable: true })).join('');
}
const LS_MPM = 'nse_mpm_v1'; const LS_GUEST_BIN = 'nse_guest_bin'; function isGuestMode() { return !!lsGet(LS_GUEST_BIN); }
const mpmLoad = () => { try { return JSON.parse(lsGet(LS_MPM)) || []; } catch (e) { return []; } }; const mpmSave = d => lsSet(LS_MPM, JSON.stringify(d.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 150))); const getCfg = () => ({ key: lsGet(LS_KEY) || '', bin: lsGet(LS_BIN) || '' }); const saveCfg = (k, b) => { lsSet(LS_KEY, k); lsSet(LS_BIN, b); }; const JB = 'https://api.jsonbin.io/v3'; async function jbCreate(key, data) { const payload = Array.isArray(data) ? { records: data, bsr: [] } : data; const r = await fetch(`${JB}/b`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Master-Key': key, 'X-Bin-Name': 'NSE-Breadth-Radar', 'X-Bin-Private': 'true' }, body: JSON.stringify(payload) }); if (!r.ok) throw new Error('Create failed: ' + r.status); const j = await r.json(); return j.metadata.id; }
async function jbRead(key, bin) { const r = await fetch(`${JB}/b/${bin}/latest`, { headers: { 'X-Master-Key': key } }); if (!r.ok) throw new Error('Read failed: ' + r.status); const j = await r.json(); const rec = j.record; console.log('[jbRead] OK — records:', rec?.records?.length || 0, 'mpm:', rec?.mpm?.length || 0, 'bsr:', rec?.bsr?.length || 0); return rec; }
async function jbUpdate(key, bin, payload) { const body = JSON.stringify(payload); const r = await fetch(`${JB}/b/${bin}`, { method: 'PUT', headers: { 'Content-Type': 'application/json', 'X-Master-Key': key }, body: body }); const respText = await r.text(); if (!r.ok) throw new Error('Update failed: ' + r.status + ' ' + respText.slice(0, 100)); console.log('[jbUpdate] OK — pushed', JSON.parse(body)?.records?.length || 0, 'records'); }
function setSyncStatus(state, label) { const dot = document.getElementById('sync-dot'); const lbl = document.getElementById('sync-label'); const btn = dot && dot.closest('.sync-status'); dot.className = 'sync-dot ' + (state || ''); lbl.textContent = label || 'Cloud Sync'; if (btn) { btn.title = state === 'warn' ? 'Click to configure cloud sync' : state === 'ok' ? 'Synced — click to manage' : state === 'err' ? 'Sync error — click to fix' : 'Cloud sync settings'; btn.style.borderColor = state === 'warn' ? 'rgba(224,123,58,.4)' : state === 'ok' ? 'rgba(61,214,140,.3)' : state === 'err' ? 'rgba(224,84,84,.3)' : ''; } }
function showSetup() { openControlPanel('sync'); }
function setupFlash(msg, color) { cfgBanner(msg, color === 'var(--lime)' ? 'ok' : color === 'var(--red)' ? 'err' : color === 'var(--orange)' ? 'warn' : 'inf', 'cfg-banner'); }
function buildPayload() { const now = Date.now(); return { _pushedAt: now, records: loadLocal(), bsr: bsrLoad(), bsrMode: bsrGetMode(), bsrModeUpdatedAt: parseInt(lsGet('_bsrModeUpdatedAt') || '0', 10), bsrQuick: bsrQuickLoad(), mpm: mpmLoad(), ftd: ftdLoad(), srt: srtLoad(), sccWatchlists: _sccWatchlists, sccSymbolFlags: _sccSymbolFlags, sccWatchlistsUpdatedAt: parseInt(localStorage.getItem('_sccWatchlistsUpdatedAt') || '0') }; }
function mergeByKey(cloudArr, localArr, keyFn) {
  const map = {}; (cloudArr || []).forEach(d => { const k = keyFn(d); if (k) map[k] = d; }); (localArr || []).forEach(d => {
    const k = keyFn(d); if (!k) return; const existing = map[k]; if (!existing) { map[k] = d; return; }
    const ct = existing._updatedAt || 0; const lt = d._updatedAt || 0; if (lt > ct) map[k] = d;
  }); return Object.values(map);
}
async function testConnection() {
  const cfg = getCfg(); if (!cfg.key || !cfg.bin) { setupFlash('Enter Key and Bin ID first', 'var(--orange)'); return; }
  setSyncStatus('syncing', 'Testing…'); try { const raw = await jbRead(cfg.key, cfg.bin); const recs = Array.isArray(raw) ? raw : (raw.records || []); const bsrT = Array.isArray(raw) ? [] : (raw.bsr || []); setSyncStatus('ok', 'Synced'); setupFlash(`✓ Connection OK — ${recs.length} breadth records + ${bsrT.length} BSR trades in cloud`, 'var(--lime)'); } catch (e) { setSyncStatus('err', 'Error'); setupFlash('✗ ' + e.message, 'var(--red)'); }
}
async function pullFromCloud(key, bin) {
  const cfg = key ? { key, bin } : getCfg(); if (!cfg.key || !cfg.bin) { setupFlash('No credentials configured', 'var(--orange)'); return; }
  setSyncStatus('syncing', 'Pulling…'); try {
    const raw = await jbRead(cfg.key, cfg.bin); const cloudRecs = Array.isArray(raw) ? raw : (raw.records || []); const cloudBsr = Array.isArray(raw) ? [] : (raw.bsr || []); const cloudMpm = Array.isArray(raw) ? [] : (raw.mpm || []); const cloudFtd = (typeof raw === 'object' && !Array.isArray(raw)) ? (raw.ftd || []) : []; const cloudSrt = (typeof raw === 'object' && !Array.isArray(raw)) ? (raw.srt || []) : []; saveLocal(mergeByKey(cloudRecs, loadLocal(), r => r.date)); bsrSave(mergeByKey(cloudBsr, bsrLoad(), t => t.id || (t.sym + '_' + t.date))); mpmSave(mergeByKey(cloudMpm, mpmLoad(), d => d.date)); srtSave(mergeByKey(cloudSrt, srtLoad(), s => s.id)); const mergedFtd = mergeByKey(cloudFtd, ftdLoad(), d => d.date).sort((a, b) => b.date.localeCompare(a.date)); ftdSaveData(mergedFtd); ensureOctoberDataSeeded(); ftdScanUndercutAll(); if (typeof raw === 'object' && !Array.isArray(raw)) { if (raw.bsrMode) mergeBsrMode(raw.bsrMode, raw.bsrModeUpdatedAt); if (raw.bsrQuick) mergeBsrQuick(raw.bsrQuick); } const cloudWatchlists = (typeof raw === 'object' && !Array.isArray(raw)) ? raw.sccWatchlists : null; const cloudSymbolFlags = (typeof raw === 'object' && !Array.isArray(raw)) ? raw.sccSymbolFlags : null; if (cloudWatchlists) {
      _sccWatchlists = cloudWatchlists; if (cloudSymbolFlags) _sccSymbolFlags = cloudSymbolFlags; localStorage.setItem('_sccWatchlists', JSON.stringify(_sccWatchlists)); localStorage.setItem('_sccSymbolFlags', JSON.stringify(_sccSymbolFlags)); if (!_sccWatchlists[_sccActiveWatchlist] && !_sccActiveWatchlist.startsWith('__flag_')) { const keys = Object.keys(_sccWatchlists); _sccActiveWatchlist = keys.length > 0 ? keys[0] : "Main"; localStorage.setItem('_sccActiveWatchlist', _sccActiveWatchlist); }
      if (_sccActiveWatchlist.startsWith('__flag_')) { const color = _sccActiveWatchlist.replace('__flag_', ''); _sccWatchlistSymbols = Object.keys(_sccSymbolFlags).filter(s => _sccSymbolFlags[s] === color); } else if (_sccActiveWatchlist !== 'VCP') { _sccWatchlistSymbols = _sccWatchlists[_sccActiveWatchlist] || []; }
      _sccWlSelectedSymbols = []; _sccWlLastSelectedSymbol = null;
    }
    const merged = loadLocal(); setSyncStatus('ok', 'Synced'); setupFlash(`✓ Pulled — ${merged.length} breadth + ${bsrLoad().length} BSR + ${mpmLoad().length} MPM + ${srtLoad().length} sectors`, 'var(--lime)'); renderAll(); bsrRenderAll(); mpmRenderAll(); renderRPG(); renderMarketSummary(); renderMarketCycle(); ftdRender(); renderAnalysisFTD(); srtRender(); sccWlRenderTabs(); sccWatchlistRender(); sccWatchlistFetchAll();
  } catch (e) { setSyncStatus('err', 'Sync Error'); setupFlash('✗ Pull failed: ' + e.message, 'var(--red)'); }
}
async function pushToCloud() {
  const cfg = getCfg(); if (!cfg.key || !cfg.bin) {
    const mpmMsg = document.getElementById('mpm-sync-msg'); if (mpmMsg) { mpmMsg.textContent = '⚠ Cloud not configured — data saved locally only. Configure JSONBin above to persist across devices.'; mpmMsg.style.color = 'var(--orange)'; mpmMsg.style.display = 'block'; }
    return false;
  }
  setSyncStatus('syncing', 'Saving…'); try { await jbUpdate(cfg.key, cfg.bin, buildPayload()); setSyncStatus('ok', 'Synced'); return true; } catch (e) { setSyncStatus('err', 'Sync Error'); console.warn('Cloud push failed:', e.message); return false; }
}
async function forcePull() { await pullFromCloud(); }
async function forcePush() {
  const cfg = getCfg(); if (!cfg.key || !cfg.bin) { setupFlash('No credentials configured', 'var(--orange)'); return; }
  setSyncStatus('syncing', 'Pushing…'); try { await jbUpdate(cfg.key, cfg.bin, buildPayload()); setSyncStatus('ok', 'Synced'); setupFlash('✓ All local data pushed to cloud', 'var(--lime)'); } catch (e) { setSyncStatus('err', 'Error'); setupFlash('✗ Push failed: ' + e.message, 'var(--red)'); }
}
function clearCredentials() { if (!confirm('Remove cloud credentials from this device?')) return; lsDel(LS_KEY); lsDel(LS_BIN); const kEl = document.getElementById('cfg-key'); if (kEl) kEl.value = ''; const bEl = document.getElementById('cfg-bin'); if (bEl) bEl.value = ''; setSyncStatus('warn', 'Not Configured · Click to Setup'); setupFlash('Credentials cleared from this device', 'var(--yellow)'); cpRefreshSyncState(); }
const todayISO = () => new Date().toISOString().slice(0, 10); const fmt = iso => { if (!iso) return '—'; const d = new Date(iso + 'T00:00:00'); return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' }); }; const fmtLong = iso => { if (!iso) return '—'; const d = new Date(iso + 'T00:00:00'); return d.toLocaleDateString('en-IN', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' }); }; function calcScore(r) { const adv = +r.adv || 0, dec = +r.dec || 0, hi = +r.hi || 0, lo = +r.lo || 0; const e20 = +r.e20 || 0, s50 = +r.s50 || 0, s200 = +r.s200 || 0; const advPct = adv / (adv + dec || 1) * 100; const hlPct = (hi + lo) > 0 ? hi / (hi + lo) * 100 : 50; const smaPct = (e20 + s50 + s200) / 3; return Math.min(100, Math.max(0, Math.round(advPct * 0.35 + hlPct * 0.15 + smaPct * 0.50))); }
function getZone(s) { if (s >= 55) return { name: 'HEALTHY', r: '2–3R', color: 'var(--lime)', bg: 'rgba(74,222,128,0.12)' }; if (s >= 45) return { name: 'EXPANDING', r: '1–2R', color: 'var(--green)', bg: 'rgba(34,197,94,0.12)' }; if (s >= 35) return { name: 'CAUTION', r: '0.5–1R', color: 'var(--yellow)', bg: 'rgba(250,204,21,0.12)' }; if (s >= 20) return { name: 'DEFENSIVE', r: '0.25R pilot', color: 'var(--orange)', bg: 'rgba(251,146,60,0.12)' }; return { name: 'CORRECTION', r: '0R — stand aside', color: 'var(--red)', bg: 'rgba(248,113,113,0.12)' }; }
function spark(vals, w, h, color) { const v = vals.filter(x => x != null && !isNaN(x)); if (v.length < 2) return `<svg class="spk" width="${w}" height="${h}"></svg>`; const mn = Math.min(...v), mx = Math.max(...v), rng = mx - mn || 1; const pts = v.map((n, i) => `${i / (v.length - 1) * w},${h - (n - mn) / rng * (h - 4) + 2}`).join(' '); const lx = w, ly = h - (v[v.length - 1] - mn) / rng * (h - 4) + 2; return `<svg class="spk" width="${w}" height="${h}"><polyline points="${pts}" fill="none" stroke="${color}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><circle cx="${lx}" cy="${ly}" r="3" fill="${color}"/></svg>`; }
function trendDir(vals) { const v = vals.filter(x => x != null && !isNaN(x)); if (v.length < 3) return 'flat'; const recent = v.slice(-3).reduce((a, b) => a + b, 0) / 3; const older = v.slice(0, 3).reduce((a, b) => a + b, 0) / 3; if (recent - older > 1.5) return 'up'; if (recent - older < -1.5) return 'dn'; return 'flat'; }
function chgArrow(curr, prev) { if (prev == null || prev === '' || isNaN(+prev)) return '<span class="flat">—</span>'; const d = (+curr) - (+prev); if (d > 0.05) return `<span class="up">&#9650; ${Math.abs(d).toFixed(1)}</span>`; if (d < -0.05) return `<span class="dn">&#9660; ${Math.abs(d).toFixed(1)}</span>`; return '<span class="flat">&#9644; 0</span>'; }
function dirLabel(dir) { if (dir === 'up') return '<span class="trend-dir up">&#9650;&#9650; Rising</span>'; if (dir === 'dn') return '<span class="trend-dir dn">&#9660;&#9660; Falling</span>'; return '<span class="trend-dir flat">&#9644; Sideways</span>'; }
const pctClr = v => v >= 60 ? 'var(--lime)' : v >= 50 ? 'var(--green)' : v >= 40 ? 'var(--yellow)' : v >= 25 ? 'var(--orange)' : 'var(--red)'; const adClr = v => v >= 1.8 ? 'var(--lime)' : v >= 1.2 ? 'var(--green)' : v >= 0.8 ? 'var(--yellow)' : 'var(--red)'; function sigLabel(type, val) { const v = +val; const L = (t, c) => `<span style="color:${c};font-size:10px;font-weight:600;font-family:var(--mono)">${t}</span>`; if (type === 'adv') return v >= 65 ? L('STRONG BULL', 'var(--lime)') : v >= 55 ? L('BULL', 'var(--green)') : v >= 45 ? L('NEUTRAL', 'var(--yellow)') : L('BEAR', 'var(--red)'); if (type === 'e20') return v >= 60 ? L('RALLY MODE', 'var(--lime)') : v >= 50 ? L('RISING', 'var(--green)') : v >= 40 ? L('MIXED', 'var(--yellow)') : L('WEAK', 'var(--red)'); if (type === 's50') return v >= 55 ? L('HEALTHY', 'var(--lime)') : v >= 45 ? L('MIXED', 'var(--yellow)') : L('BREADTH WEAK', 'var(--red)'); if (type === 's200') return v >= 50 ? L('BULL MKT', 'var(--green)') : v >= 35 ? L('MIXED', 'var(--yellow)') : L('DOWNTREND', 'var(--red)'); if (type === 'hl') return v >= 70 ? L('EXPANDING', 'var(--lime)') : v >= 50 ? L('POSITIVE', 'var(--green)') : L('CONTRACTING', 'var(--red)'); return ''; }
async function saveToday() {
  const g = id => document.getElementById(id).value.trim(); const adv = g('i-adv'), dec = g('i-dec'), e20 = g('i-e20'), s50 = g('i-s50'), s200 = g('i-s200'); if (!adv && !dec && !e20 && !s50) { flash('⚠ Enter at least Advances + Declines or EMA/SMA values', 'var(--orange)'); return; }
  const today = todayISO(); const allData = loadLocal(); const data = allData.filter(r => r.date !== today); const vol = g('i-vol'); const row = { date: today, adv, dec, unc: g('i-unc'), hi: g('i-hi'), lo: g('i-lo'), e20, s50, s200, nifty: g('i-nifty'), niftyLow: g('i-nifty-low'), vol, notes: g('i-notes'), _updatedAt: Date.now() }; row.score = calcScore(row); const z = getZone(row.score); row.zone = z.name; row.r = z.r; data.push(row); const sorted = data.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 30); saveLocal(sorted); const niftyClose = parseFloat(row.nifty); const niftyVol = parseFloat(row.vol); if (!isNaN(niftyClose) && !isNaN(niftyVol)) { const prevRow = allData.find(r => r.date !== today && r.nifty); const prevClose = prevRow ? parseFloat(prevRow.nifty) : NaN; const prevVol = prevRow ? parseFloat(prevRow.vol) : NaN; if (!isNaN(prevClose) && !isNaN(prevVol)) { const dtype = niftyClose > prevClose && niftyVol > prevVol ? 'acc' : niftyClose < prevClose && niftyVol > prevVol ? 'dist' : 'neutral'; const mpmDays = mpmLoad().filter(d => d.date !== today); const alreadyHasMpm = mpmLoad().some(d => d.date === today); if (!alreadyHasMpm) { mpmDays.unshift({ id: 'eod_' + today, date: today, close: niftyClose, pclose: prevClose, vol: niftyVol, pvol: prevVol, dtype, auto: true, _updatedAt: Date.now() }); mpmSave(mpmDays); } } }
  const voidMsg = ftdScanUndercutAll(); if (voidMsg) { flash('⚠ Rally Attempt VOIDED — ' + voidMsg, 'var(--red)'); }
  const nClose2 = parseFloat(row.nifty); const nLow2 = parseFloat(row.niftyLow) || nClose2 || 0; const prevRow2 = sorted.find(r => r.date !== today); const prevClose2 = prevRow2 ? parseFloat(prevRow2.nifty) : NaN; const prevVol2 = prevRow2 ? parseFloat(prevRow2.vol) : NaN; const nVol2 = parseFloat(row.vol); const movePct = (!isNaN(nClose2) && !isNaN(prevClose2) && prevClose2 > 0) ? +((nClose2 - prevClose2) / prevClose2 * 100).toFixed(2) : 0; const volUp = (!isNaN(nVol2) && !isNaN(prevVol2)) ? nVol2 > prevVol2 : false; const isAttemptDay = document.getElementById('i-ftd-attempt') && document.getElementById('i-ftd-attempt').checked; const isFtdDay = document.getElementById('i-ftd-followthrough') && document.getElementById('i-ftd-followthrough').checked; const { status: ftdStatus, rallyDay: currentRallyDay } = ftdComputeState(); const hasActiveAttempt = (ftdStatus === 'watching' || ftdStatus === 'confirmed'); let autoType = null; let isAuto = true; if (isAttemptDay) { autoType = 'attempt'; isAuto = false; } else if (isFtdDay) { autoType = 'followthrough'; isAuto = false; } else if (hasActiveAttempt && currentRallyDay >= FTD_MIN_DAY && movePct >= FTD_MIN_MOVE && volUp) { autoType = 'followthrough'; isAuto = true; } else if (!hasActiveAttempt && !isNaN(nClose2) && !isNaN(prevClose2) && movePct > 0) { autoType = 'attempt'; isAuto = true; } else if (!isNaN(nClose2) && !isNaN(prevClose2) && movePct < 0 && volUp) { autoType = 'distribution'; isAuto = true; }
  if (autoType) { let ftdDays = ftdLoad().filter(d => d.date !== today); ftdDays.unshift({ id: Date.now(), date: today, _updatedAt: Date.now(), close: nClose2 || 0, prev: prevClose2 || 0, low: nLow2 || 0, movePct, volUp, type: autoType, auto: isAuto }); ftdSaveData(ftdDays); ftdScanUndercutAll(); if (autoType === 'followthrough') { flash((isAuto ? '🎯 Follow-Through Day AUTO-DETECTED' : '🚀 Follow-Through Day MANUALLY LOGGED') + ' — Day ' + (currentRallyDay + 1) + ' · +' + movePct + '% · Vol ↑', 'var(--lime)'); } else if (autoType === 'attempt') { flash((isAuto ? '📍 Day 1 of Rally Attempt AUTO-DETECTED' : '📍 Day 1 of Rally Attempt LOGGED') + ' — Benchmark Rally Low: ' + nLow2, 'var(--yellow)'); } else if (autoType === 'distribution') { flash('📉 Distribution Day auto-logged — Close↓ + Vol↑', 'var(--orange)'); } }
  flash(`✓ Saved — Score: ${row.score}  Zone: ${z.name}  R: ${z.r}`, 'var(--lime)'); clearInputs(); renderAll(); cpUpdateHomeStatus(); await pushToCloud();
}
function clearInputs() { ['i-adv', 'i-dec', 'i-unc', 'i-hi', 'i-lo', 'i-e20', 'i-s50', 'i-s200', 'i-nifty', 'i-nifty-low', 'i-vol', 'i-notes'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; }); const cb = document.getElementById('i-ftd-attempt'); if (cb) cb.checked = false; const cbF = document.getElementById('i-ftd-followthrough'); if (cbF) cbF.checked = false; eodAutoFill(); }
function loadTodayIntoForm() {
  const row = loadLocal().find(r => r.date === todayISO()); if (!row) { flash('No entry for today yet', 'var(--sub)'); return; }
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = v || ''; }; set('i-adv', row.adv); set('i-dec', row.dec); set('i-unc', row.unc); set('i-hi', row.hi); set('i-lo', row.lo); set('i-e20', row.e20); set('i-s50', row.s50); set('i-s200', row.s200); set('i-nifty', row.nifty); set('i-nifty-low', row.niftyLow || ''); set('i-vol', row.vol); set('i-notes', row.notes); const _ftdCb = document.getElementById('i-ftd-attempt'); const _ftdF = document.getElementById('i-ftd-followthrough'); const _todayFtd = ftdLoad().find(d => d.date === todayISO()); if (_ftdCb) { _ftdCb.checked = !!(_todayFtd && (_todayFtd.type === 'attempt' || (_todayFtd.type === 'void' && _todayFtd._origType === 'attempt'))); }
  if (_ftdF) { _ftdF.checked = !!(_todayFtd && (_todayFtd.type === 'followthrough' || (_todayFtd.type === 'void' && _todayFtd._origType === 'followthrough'))); }
  eodAutoFill(); flash('Today loaded — click Save & Sync to overwrite', 'var(--yellow)');
}
async function fetchAndAutofillToday() { const btn = document.getElementById('btn-fetch-today'); const oldText = btn.innerHTML; btn.innerHTML = '⏳ Fetching...'; btn.disabled = true; try { const res = await fetch('http://localhost:9090/local-api/fetch-eod?date=today'); if (!res.ok) throw new Error('Fetch failed from local proxy'); const data = await res.json(); if (data.error) throw new Error(data.error); const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = v !== undefined && v !== null ? v : ''; }; set('i-adv', data.adv); set('i-dec', data.dec); set('i-unc', data.unc); set('i-hi', data.hi); set('i-lo', data.lo); set('i-e20', data.e20); set('i-s50', data.s50); set('i-s200', data.s200); set('i-nifty', data.nifty); set('i-nifty-low', data.niftyLow); set('i-vol', data.vol); eodAutoFill(); flash('⚡ Autofill successful! Review and click Save & Sync All.', 'var(--lime)'); } catch (err) { console.error(err); flash('❌ Error: ' + err.message, 'var(--red)'); } finally { btn.innerHTML = oldText; btn.disabled = false; } }
async function fetchAndAutofillPast() {
  const dateEl = document.getElementById('p-date'); const dateVal = dateEl ? dateEl.value : ''; if (!dateVal) { alert('Please select a date first!'); return; }
  const btn = document.getElementById('btn-fetch-past'); const oldText = btn.innerHTML; btn.innerHTML = '⏳ Fetching...'; btn.disabled = true; const msgEl = document.getElementById('past-save-msg'); if (msgEl) { msgEl.textContent = 'Fetching data...'; msgEl.style.color = 'var(--yellow)'; }
  try { const res = await fetch(`http://localhost:9090/local-api/fetch-eod?date=${dateVal}`); if (!res.ok) throw new Error('Fetch failed from local proxy'); const data = await res.json(); if (data.error) throw new Error(data.error); const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = v !== undefined && v !== null ? v : ''; }; set('p-adv', data.adv); set('p-dec', data.dec); set('p-unc', data.unc); set('p-hi', data.hi); set('p-lo', data.lo); set('p-e20', data.e20); set('p-s50', data.s50); set('p-s200', data.s200); set('p-nifty', data.nifty); set('p-nifty-low', data.niftyLow); set('p-vol', data.vol); if (msgEl) { msgEl.textContent = '⚡ Autofill successful! Review and click Save Past Entry.'; msgEl.style.color = 'var(--lime)'; } } catch (err) { console.error(err); if (msgEl) { msgEl.textContent = '❌ Error: ' + err.message; msgEl.style.color = 'var(--red)'; } } finally { btn.innerHTML = oldText; btn.disabled = false; }
}
function eodAutoFill() { const data = loadLocal(); const today = todayISO(); const prev = data.find(r => r.date !== today && r.nifty); const pClose = document.getElementById('i-prev-nifty'); const pVol = document.getElementById('i-prev-vol'); if (pClose && prev) pClose.value = prev.nifty || ''; if (pVol && prev) pVol.value = prev.vol || ''; }
function flash(msg, color) { const el = document.getElementById('save-msg'); el.textContent = msg; el.style.color = color; el.style.opacity = '1'; setTimeout(() => el.style.opacity = '0', 5000); }
async function del(date) { if (!confirm('Delete entry for ' + fmt(date) + '?')) return; const data = loadLocal().filter(r => r.date !== date); saveLocal(data); renderAll(); await pushToCloud(); }
function renderHero(data) {
  const el = id => document.getElementById(id) || { textContent: '', innerHTML: '', style: {}, className: '', classList: { add: () => { }, remove: () => { }, contains: () => false }, value: '', offsetWidth: 0, offsetHeight: 0, getBoundingClientRect: () => ({ width: 0, height: 0, top: 0, left: 0, right: 0, bottom: 0 }) }; if (!data.length) { ['h-score', 'h-zone', 'h-r'].forEach(id => { el(id).textContent = '—'; el(id).style.color = 'var(--dim)'; }); const hf0 = el('h-fill'); if (hf0) { hf0.style.width = '0%'; } el('h-lastdate').textContent = '—'; el('h-trend').innerHTML = '—'; el('h-entries').textContent = '0 entries stored'; el('score-bk').innerHTML = '';['h-momentum'].forEach(id => { el(id).textContent = '—'; el(id).style.color = 'var(--dim)'; }); el('h-momentum-label').textContent = 'vs yesterday'; return; }
  const r = data[0], prev = data[1], s = r.score, z = getZone(s); el('h-score').textContent = s; el('h-score').style.color = z.color; el('h-zone').textContent = z.name; el('h-zone').style.color = z.color; el('h-r').textContent = z.r; el('h-r').style.color = z.color; const hf = el('h-fill'); if (hf) { hf.style.width = s + '%'; hf.style.background = z.color; }
  el('h-lastdate').textContent = fmtLong(r.date); el('h-entries').textContent = data.length + ' / 30 entries stored'; if (prev) { const d = s - prev.score, pz = getZone(prev.score); el('h-trend').innerHTML = d > 0 ? `<span class="up">&#9650; +${d} pts</span> vs ${fmtLong(prev.date)}` : d < 0 ? `<span class="dn">&#9660; ${d} pts</span> vs ${fmtLong(prev.date)}` : `<span class="flat">— unchanged</span> from ${fmtLong(prev.date)}`; } else { el('h-trend').innerHTML = '<span class="flat">First entry</span>'; }
  const adv = +r.adv || 0, dec = +r.dec || 0, hi = +r.hi || 0, lo = +r.lo || 0, e20 = +r.e20 || 0, s50 = +r.s50 || 0, s200 = +r.s200 || 0, tot = adv + dec || 1; el('score-bk').innerHTML = `<span>A/D%: <b>${(adv / tot * 100).toFixed(0)}%</b> ×0.35</span><span>EMA20: <b style="color:${pctClr(e20)}">${e20}%</b></span><span>SMA50: <b style="color:${pctClr(s50)}">${s50}%</b></span><span>SMA200: <b style="color:${pctClr(s200)}">${s200}%</b></span><span>H/L%: <b>${(hi + lo) > 0 ? (hi / (hi + lo) * 100).toFixed(0) + '%' : '—'}</b> ×0.15</span>`; renderMomentumThrust(data);
}
function renderMomentumThrust(data) {
  const el = id => document.getElementById(id) || { textContent: '', innerHTML: '', style: {}, className: '', classList: { add: () => { }, remove: () => { }, contains: () => false }, value: '', offsetWidth: 0, offsetHeight: 0, getBoundingClientRect: () => ({ width: 0, height: 0, top: 0, left: 0, right: 0, bottom: 0 }) }; function momentumColor(d) { if (d >= 10) return 'var(--lime)'; if (d >= 5) return '#86efac'; if (d >= 0) return 'var(--yellow)'; return 'var(--red)'; }
  function momentumLabel(d) { if (d >= 10) return 'Strong Expansion'; if (d >= 5) return 'Improving Breadth'; if (d >= 0) return 'Neutral'; return 'Weakening Breadth'; }
  function thrustColor(d) { if (d >= 15) return 'var(--lime)'; if (d >= 10) return '#86efac'; return 'var(--sub)'; }
  function thrustSignal(d) { if (d >= 15) return '🚀 Strong Breadth Thrust'; if (d >= 10) return '↑ Moderate Thrust'; return 'No Thrust'; }
  const mCell = document.getElementById('momentum-cell'); if (data.length >= 2) { const d = data[0].score - data[1].score; const sign = d > 0 ? '+' : ''; const col = momentumColor(d); el('h-momentum').textContent = sign + d; el('h-momentum').style.color = col; el('h-momentum-label').textContent = momentumLabel(d); el('h-momentum-label').style.color = col; if (mCell) mCell.style.background = d >= 10 ? 'rgba(74,222,128,.07)' : d < 0 ? 'rgba(248,113,113,.06)' : 'rgba(250,204,21,.05)'; } else { el('h-momentum').textContent = '—'; el('h-momentum-label').textContent = 'Need 2+ entries'; el('h-momentum').style.color = 'var(--dim)'; el('h-momentum-label').style.color = 'var(--dim)'; }
}
function renderChart(data) {
  const canvas = document.getElementById('score-chart'); if (!canvas) return; const ctx = canvas.getContext('2d'); const wrap = canvas.parentElement; if (!wrap) return; const dpr = window.devicePixelRatio || 1; const rect = wrap.getBoundingClientRect ? wrap.getBoundingClientRect() : { width: 0 }; const W = rect.width || wrap.offsetWidth || wrap.scrollWidth || 600; const H = 150; canvas.width = W * dpr; canvas.height = H * dpr; canvas.style.width = W + 'px'; canvas.style.height = H + 'px'; ctx.scale(dpr, dpr); ctx.clearRect(0, 0, W, H); const pts = data.slice().reverse(); if (!pts.length) { ctx.fillStyle = 'rgba(62,84,112,0.5)'; ctx.font = '13px Inter,sans-serif'; ctx.textAlign = 'center'; ctx.fillText('Save data to see the breadth score chart', W / 2, H / 2); return; }
  const PAD = { t: 20, r: 20, b: 40, l: 44 }; const cW = W - PAD.l - PAD.r, cH = H - PAD.t - PAD.b; const colorMap = { 'var(--lime)': '#4ade80', 'var(--green)': '#22c55e', 'var(--yellow)': '#facc15', 'var(--orange)': '#fb923c', 'var(--red)': '#f87171' };[{ from: 55, to: 100, c: 'rgba(74,222,128,0.04)' }, { from: 45, to: 55, c: 'rgba(34,197,94,0.04)' }, { from: 35, to: 45, c: 'rgba(250,204,21,0.04)' }, { from: 20, to: 35, c: 'rgba(251,146,60,0.04)' }, { from: 0, to: 20, c: 'rgba(248,113,113,0.04)' }].forEach(z => { ctx.fillStyle = z.c; ctx.fillRect(PAD.l, PAD.t + cH - Math.min(z.to, 100) / 100 * cH, cW, (Math.min(z.to, 100) - z.from) / 100 * cH); });[[55, 'rgba(74,222,128,0.3)'], [45, 'rgba(34,197,94,0.25)'], [35, 'rgba(250,204,21,0.25)'], [20, 'rgba(251,146,60,0.25)']].forEach(([v, c]) => { const y = PAD.t + cH - v / 100 * cH; ctx.beginPath(); ctx.strokeStyle = c; ctx.setLineDash([4, 4]); ctx.lineWidth = 1; ctx.moveTo(PAD.l, y); ctx.lineTo(PAD.l + cW, y); ctx.stroke(); ctx.setLineDash([]); ctx.fillStyle = c; ctx.font = '9px JetBrains Mono,monospace'; ctx.textAlign = 'right'; ctx.fillText(v, PAD.l - 4, y + 3); }); const step = pts.length > 1 ? cW / (pts.length - 1) : cW; ctx.fillStyle = 'rgba(122,155,181,0.6)'; ctx.font = '9px JetBrains Mono,monospace'; ctx.textAlign = 'center'; pts.forEach((p, i) => {
    if (i === 0 || i === pts.length - 1 || (pts.length > 8 && i % Math.ceil(pts.length / 6) === 0))
      ctx.fillText(fmt(p.date), PAD.l + i * step, H - 6);
  }); if (pts.length >= 2) { ctx.beginPath(); pts.forEach((p, i) => { const x = PAD.l + i * step, y = PAD.t + cH - p.score / 100 * cH; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.lineTo(PAD.l + (pts.length - 1) * step, PAD.t + cH); ctx.lineTo(PAD.l, PAD.t + cH); ctx.closePath(); const g = ctx.createLinearGradient(0, PAD.t, 0, PAD.t + cH); g.addColorStop(0, 'rgba(56,189,248,0.15)'); g.addColorStop(1, 'rgba(56,189,248,0.0)'); ctx.fillStyle = g; ctx.fill(); for (let i = 1; i < pts.length; i++) { const x0 = PAD.l + (i - 1) * step, y0 = PAD.t + cH - pts[i - 1].score / 100 * cH; const x1 = PAD.l + i * step, y1 = PAD.t + cH - pts[i].score / 100 * cH; ctx.beginPath(); ctx.strokeStyle = colorMap[getZone((pts[i - 1].score + pts[i].score) / 2).color] || '#38bdf8'; ctx.lineWidth = 2.5; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke(); } }
  pts.forEach((p, i) => { const x = PAD.l + i * step, y = PAD.t + cH - p.score / 100 * cH; const c = colorMap[getZone(p.score).color] || '#38bdf8'; ctx.beginPath(); ctx.arc(x, y, 3.5, 0, Math.PI * 2); ctx.fillStyle = c; ctx.fill(); if (i === pts.length - 1 || pts.length <= 8) { ctx.fillStyle = c; ctx.font = 'bold 10px JetBrains Mono,monospace'; ctx.textAlign = 'center'; ctx.fillText(p.score, x, y - 9); } });
}
function renderSnapshot() {}
function renderHistory(data) {
  const tbody = document.getElementById('hist-body'); if (!tbody) return; if (!data.length) { tbody.innerHTML = '<tr><td colspan="17" style="color:var(--dim);padding:28px;text-align:center;letter-spacing:2px;font-size:11px;font-family:var(--mono);">NO HISTORY YET</td></tr>'; return; }
  tbody.innerHTML = data.map(r => {
    const adv = +r.adv || 0, dec = +r.dec || 0, hi = +r.hi || 0, lo = +r.lo || 0; const z = getZone(r.score || 0); const isToday = r.date === todayISO(); return `<tr style="${isToday ? 'background:rgba(56,189,248,0.05);' : ''}">
      <td>${fmt(r.date)}${isToday ? ' <span style="color:var(--accent);font-size:9px;font-family:var(--mono)">TODAY</span>' : ''}</td>
      <td style="color:var(--green)">${r.adv || '—'}</td>
      <td style="color:var(--red)">${r.dec || '—'}</td>
      <td style="color:var(--sub)">${r.unc || '—'}</td>
      <td style="color:${adClr(dec > 0 ? adv / dec : 0)}">${dec > 0 ? (adv / dec).toFixed(2) : '—'}</td>
      <td style="color:var(--lime)">${r.hi || '—'}</td>
      <td style="color:var(--red)">${r.lo || '—'}</td>
      <td>${(hi + lo) > 0 ? (hi / (hi + lo) * 100).toFixed(0) + '%' : '—'}</td>
      <td style="color:${pctClr(+r.e20)}">${r.e20 ? r.e20 + '%' : '—'}</td>
      <td style="color:${pctClr(+r.s50)}">${r.s50 ? r.s50 + '%' : '—'}</td>
      <td style="color:${pctClr(+r.s200)}">${r.s200 ? r.s200 + '%' : '—'}</td>
      <td style="color:var(--sub)">${r.nifty || '—'}</td>
      <td style="color:${z.color};font-weight:700">${r.score || '—'}</td>
      <td><span class="pill" style="background:${z.bg};color:${z.color}">${r.zone || '—'}</span></td>
      <td style="color:${z.color};font-weight:700">${r.r || '—'}</td>
      <td style="color:var(--sub);font-size:10px;max-width:120px;overflow:hidden;text-overflow:ellipsis">${r.notes || ''}</td>
      <td><button class="del-btn" onclick="del('${r.date}')">&#10005;</button></td>
    </tr>`;
  }).join('');
}
function exportCSV() {
  const data = loadLocal(); if (!data.length) { alert('No data to export'); return; }
  const hdr = ['Date', 'Advances', 'Declines', 'Unchanged', 'A/D', '52W-H', '52W-L', 'H/L%', '%AboveEMA20', '%AboveSMA50', '%AboveSMA200', 'Nifty', 'Score', 'Zone', 'R', 'Notes']; const rows = data.map(r => { const dec = +r.dec || 0, adv = +r.adv || 0, hi = +r.hi || 0, lo = +r.lo || 0; return [r.date, r.adv, r.dec, r.unc, dec > 0 ? (adv / dec).toFixed(2) : '', r.hi, r.lo, (hi + lo) > 0 ? (hi / (hi + lo) * 100).toFixed(0) : '', r.e20, r.s50, r.s200, r.nifty, r.score, r.zone, r.r, '"' + (r.notes || '').replace(/"/g, '""') + '"'].join(','); }); const blob = new Blob([[hdr.join(','), ...rows].join('\n')], { type: 'text/csv' }); const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: 'nse_breadth_' + todayISO() + '.csv' }); a.click(); URL.revokeObjectURL(a.href);
}
function countDistributionDays(mpmDays, attemptDate) { const allMpmDays = mpmLoad(); const last25 = mpmDays.slice(0, 25); const activeDds = last25.filter(d => { if (d.dtype !== 'dist') return false; const movePct = d.pclose ? ((d.close - d.pclose) / d.pclose * 100) : 0; if (movePct > -0.2) return false; if (attemptDate && d.date < attemptDate) return false; const subsequentDays = allMpmDays.filter(x => x.date > d.date && x.close > 0); const isCancelled = subsequentDays.some(x => x.close >= d.close * 1.05); if (isCancelled) return false; return true; }); return activeDds.length; }
function computeMarketCondition() {
  const records = loadLocal(); if (!records.length) return null;
  const mpmDays = mpmLoad();
  const ftdDays = ftdLoad();
  const voidIdx = ftdDays.findIndex(d => d.type === 'void');
  const activeDays = voidIdx >= 0 ? ftdDays.slice(0, voidIdx) : ftdDays;
  const attempts = activeDays.filter(d => d.type === 'attempt');
  const ftds = activeDays.filter(d => d.type === 'followthrough');
  const attemptDate = attempts.length ? attempts[0].date : (ftds.length ? ftds[0].date : null);
  const distCount = countDistributionDays(mpmDays, attemptDate);
  const { status: ftdStatus, rallyDay, ftdConfirmed, isCorrection: ftdCorrectionTriggered, distCount: corrDistCount, declineFromHigh: corrDecline } = ftdComputeState();

  // Exact definitions from Market Status Defenitions.docx
  const DESC_CONFIRMED = "A Confirmed Uptrend market status indicates the Nifty is in an uptrend. The uptrend begins with a follow-through day or when the index reclaims its previous uptrend high. At this stage, the index is not showing signs of significant distribution or heavy selling by institutional investors. This is the perfect time to be looking out for fundamentally strong stocks at proper buy points.\n\nA follow-through day is identified when a major index (Sensex or Nifty 50) closes significantly higher, over 1.5% for the day, on higher volume than the previous session. It happens on fourth day or later of an attempted rally. The most powerful follow-through days often happen on fourth through seventh day of an attempted rally. They serve as a confirmation that the market has really changed direction and is in a new uptrend. The strength in a follow-through day can be gauged by the action in leading stocks. A follow-through day coupled with leading stocks breaking out from their base patterns provides signs of a sustainable rally. A follow-through day is a key concept in the market-timing system developed by William J. O'Neil.";
  const DESC_PRESSURE = "An Uptrend Under Pressure market status is normally associated with rising number of distribution days on the Nifty. The index has 3-4 distribution days in the last five weeks and is showing some signs of deterioration. The index may be close to its 50-day and/or 200-day moving average support level, but is typically above at least one of the levels. Investors need to exercise caution and keep their buying decisions reserved to fundamentally strong stocks showing technical strength.";
  const DESC_RALLY = "A Rally Attempt begins the third day the index closes higher off the most recent bottom after being in a Correction (also known as Downtrend). During a Rally Attempt, we are on the lookout for a Follow-Through Day to confirm the trend has reversed and we have entered a Confirmed Uptrend. A Rally Attempt fails and the index goes back into a Correction if it undercuts the most recent low.";
  const DESC_CORRECTION = "A major index generally goes into Correction when the number of distribution days in the last five weeks rises to 5-6. The index has typically declined 5-7% or more from its recent high. Also, the index most likely breaches its support levels of 50-day and 200-day moving averages. Investors should avoid new purchases, get off margin, and raise cash. This is a good time to build your watch list of fundamentally-strong stocks that you would like to own when market condition improves.";

  let condition = 'Correction';
  let color = 'var(--red)';
  let driver = 'Selling pressure / Market in Correction';
  let desc = DESC_CORRECTION;

  if (ftdConfirmed) {
    if (distCount < 3) {
      condition = 'Confirmed Uptrend';
      color = 'var(--lime)';
      driver = `FTD Confirmed · Low Distribution: ${distCount} days`;
      desc = DESC_CONFIRMED;
    } else if (distCount === 3 || distCount === 4) {
      condition = 'Uptrend Under Pressure';
      color = 'var(--yellow)';
      driver = `FTD Confirmed · Elevated Distribution: ${distCount} days`;
      desc = DESC_PRESSURE;
    } else {
      condition = 'Correction';
      color = 'var(--red)';
      driver = `Heavy Distribution: ${distCount} days in 5 weeks · FTD under pressure`;
      desc = DESC_CORRECTION;
    }
  } else if (ftdStatus === 'watching') {
    condition = 'Rally Attempt';
    color = 'var(--teal)';
    if (rallyDay >= 3) {
      driver = `Rally Day ${rallyDay} off bottom · Low held · Awaiting Day 4+ FTD`;
    } else {
      driver = `Day ${rallyDay} of Attempt · Low held · Day 3 begins Rally Attempt`;
    }
    desc = DESC_RALLY;
  } else {
    condition = 'Correction';
    color = 'var(--red)';
    if (ftdStatus === 'void') {
      driver = 'Rally attempt failed & voided (most recent low undercut)';
    } else if (ftdCorrectionTriggered) {
      driver = (corrDistCount >= 5) ? `Correction: ${corrDistCount} distribution days` : `Correction: Index declined ${corrDecline}% from high`;
    } else {
      driver = `Market in Correction · No active rally attempt`;
    }
    desc = DESC_CORRECTION;
  }
  return { condition, color, driver, desc };
}
function renderMarketCycle() {
  const _d = { textContent: '', innerHTML: '', style: {}, className: '' }; const el = id => document.getElementById(id) || _d; const phaseEl = el('as-phase'); const descEl = el('as-desc'); const sigsEl = el('as-pills'); const updEl = null; if (!document.getElementById('as-phase') || !document.getElementById('as-desc')) return; const records = loadLocal(); const bsrTrades = bsrLoad(); const mpmDays = mpmLoad(); const condState = computeMarketCondition(); if (!condState) {
    if (phaseEl) { phaseEl.textContent = '—'; phaseEl.style.color = 'var(--dim)'; }
    if (descEl) descEl.textContent = 'Waiting for data — save breadth, BSR and MPM entries.'; if (sigsEl) sigsEl.innerHTML = ''; if (updEl) updEl.textContent = '—'; return;
  }
  const { condition, color, driver, desc } = condState; if (phaseEl) { phaseEl.textContent = condition; phaseEl.style.color = color; }
  const driverEl = document.getElementById('as-driver'); if (driverEl) { driverEl.textContent = driver; driverEl.style.color = color; driverEl.style.opacity = '.65'; }
  if (descEl) descEl.textContent = desc; const breadthScore = records.length ? records[0].score : null; const breadthPrev = records.length >= 2 ? records[1].score : null; const breadthMomentum = (breadthScore !== null && breadthPrev !== null) ? breadthScore - breadthPrev : null; const bsrStats = bsrGetEffectiveStats(); const bsrPct = bsrStats.pct; const bsrDeclining = bsrStats.isDeclining;
  const last25 = mpmDays.slice(0, 25); const mpmAcc = last25.filter(d => d.dtype === 'acc').length; const mpmDist = last25.filter(d => d.dtype === 'dist').length; const mpmScore = last25.length ? mpmAcc - mpmDist : null; const pills = []; if (breadthScore !== null) { const bc = breadthScore >= 55 ? 'ok' : breadthScore >= 35 ? 'warn' : 'bad'; pills.push([`Score: ${breadthScore}`, bc]); }
  if (breadthMomentum !== null) { const sign = breadthMomentum > 0 ? '+' : ''; const mc = breadthMomentum >= 5 ? 'ok' : breadthMomentum >= 0 ? 'warn' : 'bad'; pills.push([`Momentum: ${sign}${breadthMomentum}`, mc]); } else { pills.push(['Momentum: —', 'dim']); }
  if (bsrPct !== null) { const bc2 = bsrPct >= 60 ? 'ok' : bsrPct >= 40 ? 'warn' : 'bad'; pills.push([`BSR: ${bsrPct}%${bsrDeclining ? ' ↓' : ''}`, bc2]); } else { pills.push(['BSR: —', 'dim']); }
  if (mpmScore !== null) { const sign = mpmScore > 0 ? '+' : ''; const mc2 = mpmScore >= 2 ? 'ok' : mpmScore >= 0 ? 'warn' : 'bad'; pills.push([`Pressure: ${sign}${mpmScore}`, mc2]); } else { pills.push(['Pressure: —', 'dim']); }
  if (sigsEl) sigsEl.innerHTML = pills.map(([lbl, cls]) => `<span class="as-pill ${cls}">${lbl}</span>`).join(''); if (updEl && records.length) updEl.textContent = fmtLong(records[0].date); renderA1Sparkline(records); renderAnalysisFTD(); renderAnalysisDDC(); // Divergence, Trend Bias, Inst Bias, and Expansion Rate removed
}
function renderA1Sparkline(records) {
  const canvas = document.getElementById('as-spk-canvas'); if (!canvas) return; const cell = document.getElementById('ss-chart-cell') || document.getElementById('as-chart-cell'); const wrap = document.getElementById('ss-chart-wrap') || document.getElementById('as-chart-wrap'); if (!cell || !wrap) return; const dpr = window.devicePixelRatio || 1; const W = Math.max(120, wrap.offsetWidth); const H = Math.max(50, wrap.offsetHeight); canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr); canvas.style.width = W + 'px'; canvas.style.height = H + 'px'; const ctx = canvas.getContext('2d'); ctx.scale(dpr, dpr); ctx.clearRect(0, 0, W, H); const pts = records.slice(0, 25).reverse(); const scores = pts.map(r => +(r.score) || 0); const dates = pts.map(r => r.date || ''); const lbl = document.getElementById('as-spk-label'); if (scores.length < 2) { ctx.fillStyle = 'rgba(91,163,245,.06)'; ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(0, 0, W, H, 4); else ctx.rect(0, 0, W, H); ctx.fill(); ctx.fillStyle = 'rgba(136,153,176,.5)'; ctx.font = '10px DM Sans,sans-serif'; ctx.textAlign = 'center'; ctx.fillText('Save EOD entries to see score trend', W / 2, H / 2 + 4); if (lbl) lbl.textContent = '—'; return; }
  const zoneColor = s => s >= 55 ? '#4ade80' : s >= 45 ? '#34d399' : s >= 35 ? '#fbbf24' : s >= 20 ? '#fb923c' : '#f87171'; const zoneRgb = s => s >= 55 ? '74,222,128' : s >= 45 ? '52,211,153' : s >= 35 ? '251,191,36' : s >= 20 ? '251,146,60' : '248,113,113'; const lastS = scores[scores.length - 1]; const lastC = zoneColor(lastS); if (lbl) { lbl.textContent = Math.round(lastS); lbl.style.color = lastC; }
  const PAD = { l: 18, r: 2, t: 10, b: 8 }; const cW = W - PAD.l - PAD.r; const cH = H - PAD.t - PAD.b; const sy = s => PAD.t + cH * (1 - s / 100); const zLines = [{ v: 20, c: 'rgba(251,146,60,.3)' }, { v: 35, c: 'rgba(251,191,36,.25)' }, { v: 45, c: 'rgba(52,211,153,.25)' }, { v: 55, c: 'rgba(74,222,128,.25)' },]; ctx.font = '7px DM Mono,monospace'; zLines.forEach(z => { ctx.strokeStyle = z.c; ctx.lineWidth = 0.5; ctx.setLineDash([2, 3]); ctx.beginPath(); ctx.moveTo(PAD.l, sy(z.v)); ctx.lineTo(PAD.l + cW, sy(z.v)); ctx.stroke(); ctx.setLineDash([]); ctx.fillStyle = 'rgba(136,153,176,.5)'; ctx.textAlign = 'right'; ctx.fillText(z.v, PAD.l - 3, sy(z.v) + 2.5); }); const n = scores.length; const gap = Math.max(1, Math.floor(cW / n * 0.18)); const barW = Math.max(2, Math.floor((cW - gap * (n - 1)) / n)); const baseY = sy(0); scores.forEach((s, i) => { const x = PAD.l + i * (barW + gap); const top = sy(s); const ht = baseY - top; const c = zoneColor(s); const isLast = i === n - 1; const grad = ctx.createLinearGradient(0, top, 0, baseY); grad.addColorStop(0, `rgba(${zoneRgb(s)},.75)`); grad.addColorStop(1, `rgba(${zoneRgb(s)},.25)`); ctx.fillStyle = grad; const radius = Math.min(2, barW / 2); ctx.beginPath(); if (ctx.roundRect) { ctx.roundRect(x, top, barW, ht, [radius, radius, 0, 0]); } else { ctx.rect(x, top, barW, ht); } ctx.fill(); if (isLast) { ctx.strokeStyle = c; ctx.lineWidth = 1; ctx.beginPath(); if (ctx.roundRect) { ctx.roundRect(x, top, barW, ht, [radius, radius, 0, 0]); } else { ctx.rect(x, top, barW, ht); } ctx.stroke(); } }); ctx.beginPath(); scores.forEach((s, i) => { const x = PAD.l + i * (barW + gap) + barW / 2; if (i === 0) ctx.moveTo(x, sy(s)); else ctx.lineTo(x, sy(s)); }); ctx.strokeStyle = 'rgba(255,255,255,.2)'; ctx.lineWidth = 1; ctx.lineJoin = 'round'; ctx.stroke(); scores.forEach((s, i) => { const x = PAD.l + i * (barW + gap) + barW / 2; const top = sy(s); ctx.fillStyle = zoneColor(s); ctx.font = 'bold 9px DM Mono,monospace'; ctx.textAlign = 'center'; ctx.fillText(Math.round(s), x, top - 2); }); ctx.strokeStyle = 'rgba(39,52,71,.8)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(PAD.l, baseY); ctx.lineTo(PAD.l + cW, baseY); ctx.stroke(); ctx.font = '7px DM Mono,monospace'; ctx.fillStyle = 'rgba(136,153,176,.5)'; const labelIdx = [0, Math.floor(n / 2), n - 1]; labelIdx.forEach(i => { const d = dates[i]; if (!d) return; const p = d.split('-'); const lb = p.length === 3 ? p[2] + '/' + p[1] : d.slice(5); const x = PAD.l + i * (barW + gap) + barW / 2; ctx.textAlign = i === 0 ? 'left' : i === n - 1 ? 'right' : 'center'; ctx.fillText(lb, x, H - 1); });
}
(function () {
  const tip = () => document.getElementById('chart-hover-tip'); const fmtD = d => { if (!d) return ''; const p = d.split('-'); return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0].slice(2) : d; }; const colorMap = { 'var(--lime)': '#4ade80', 'var(--green)': '#34d399', 'var(--yellow)': '#fbbf24', 'var(--orange)': '#fb923c', 'var(--red)': '#f87171' }; function showTip(e, score, date, zone) { const t = tip(); if (!t) return; const c = colorMap[zone.color] || zone.color; document.getElementById('cht-date').textContent = fmtD(date); document.getElementById('cht-score').textContent = 'Score: ' + score; document.getElementById('cht-score').style.color = c; document.getElementById('cht-zone').textContent = zone.name; document.getElementById('cht-zone').style.color = c; document.getElementById('cht-r').textContent = 'Size: ' + zone.r; t.classList.add('visible'); moveTip(e); }
  function moveTip(e) { const t = tip(); if (!t) return; const tw = t.offsetWidth, th = t.offsetHeight; let x = e.clientX + 14, y = e.clientY - th / 2; if (x + tw > window.innerWidth - 8) x = e.clientX - tw - 14; if (y < 8) y = 8; if (y + th > window.innerHeight - 8) y = window.innerHeight - th - 8; t.style.left = x + 'px'; t.style.top = y + 'px'; }
  function hideTip() { const t = tip(); if (t) t.classList.remove('visible'); }
  function wireBarChart() {
    const canvas = document.getElementById('as-spk-canvas'); if (!canvas || canvas._tipWired) return; canvas._tipWired = true; canvas.addEventListener('mousemove', function (e) {
      const records = loadLocal(); const pts = records.slice(0, 25).reverse(); if (pts.length < 2) { hideTip(); return; }
      const dpr = window.devicePixelRatio || 1; const wrap = document.getElementById('ss-chart-wrap') || document.getElementById('as-chart-wrap'); if (!wrap) return; const W = Math.max(120, wrap.offsetWidth); const H = Math.max(50, wrap.offsetHeight); const PAD = { l: 18, r: 2, t: 4, b: 14 }; const cW = W - PAD.l - PAD.r; const n = pts.length; const gap = Math.max(1, Math.floor(cW / n * 0.18)); const barW = Math.max(2, Math.floor((cW - gap * (n - 1)) / n)); const rect = canvas.getBoundingClientRect(); const mx = e.clientX - rect.left; let hit = -1; for (let i = 0; i < n; i++) { const x = PAD.l + i * (barW + gap); if (mx >= x && mx <= x + barW) { hit = i; break; } }
      if (hit === -1) { let minD = Infinity; for (let i = 0; i < n; i++) { const cx = PAD.l + i * (barW + gap) + barW / 2; const d = Math.abs(mx - cx); if (d < minD) { minD = d; hit = i; } } }
      if (hit >= 0) { const r = pts[hit]; showTip(e, r.score, r.date, getZone(+(r.score) || 0)); } else { hideTip(); }
    }); canvas.addEventListener('mouseleave', hideTip); canvas.style.cursor = 'crosshair';
  }
  function wireLineChart() {
    const canvas = document.getElementById('score-chart'); if (!canvas || canvas._tipWired) return; canvas._tipWired = true; canvas.addEventListener('mousemove', function (e) {
      const data = loadLocal(); const pts = data.slice().reverse(); if (!pts.length) { hideTip(); return; }
      const wrap = canvas.parentElement; if (!wrap) return; const W = wrap.getBoundingClientRect ? wrap.getBoundingClientRect().width : wrap.offsetWidth; const H = 150; const PAD = { t: 20, r: 20, b: 40, l: 44 }; const cW = W - PAD.l - PAD.r; const step = pts.length > 1 ? cW / (pts.length - 1) : cW; const rect = canvas.getBoundingClientRect(); const mx = e.clientX - rect.left - PAD.l; let hit = 0, minD = Infinity; for (let i = 0; i < pts.length; i++) { const d = Math.abs(mx - i * step); if (d < minD) { minD = d; hit = i; } }
      const r = pts[hit]; showTip(e, r.score, r.date, getZone(+(r.score) || 0));
    }); canvas.addEventListener('mouseleave', hideTip); canvas.style.cursor = 'crosshair';
  }
  const _origA1 = window.renderA1Sparkline; window.renderA1Sparkline = function (records) { _origA1 && _origA1(records); setTimeout(wireBarChart, 0); }; const _origChart = window.renderChart; window.renderChart = function (data) { _origChart && _origChart(data); setTimeout(wireLineChart, 0); }; document.addEventListener('DOMContentLoaded', () => { setTimeout(() => { wireBarChart(); wireLineChart(); }, 500); });
})(); const DHAN_PROXY = 'http://localhost:9090/dhan'; const DHAN_LS_CRED = 'nse_dhan_cred_v1'; const DHAN_LS_SIDE = 'dhan_order_side'; const DHAN_LS_MODE = 'nse_dhan_mode_v1'; const DHAN_LS_APIKEY = 'nse_dhan_apikey_v1'; function dhanSwitchMode(mode) { localStorage.setItem(DHAN_LS_MODE, mode); document.getElementById('dhan-panel-token').style.display = mode === 'token' ? 'block' : 'none'; document.getElementById('dhan-panel-apikey').style.display = mode === 'apikey' ? 'block' : 'none'; const btnToken = document.getElementById('dhan-mode-token'); const btnApiKey = document.getElementById('dhan-mode-apikey'); if (mode === 'token') { btnToken.style.background = 'var(--teal)'; btnToken.style.color = '#0e1420'; btnApiKey.style.background = 'transparent'; btnApiKey.style.color = 'var(--sub)'; } else { btnApiKey.style.background = 'var(--teal)'; btnApiKey.style.color = '#0e1420'; btnToken.style.background = 'transparent'; btnToken.style.color = 'var(--sub)'; const saved = dhanGetApiKeyCreds(); if (saved) { const el = id => document.getElementById(id); if (el('dhan-apikey-clientid') && !el('dhan-apikey-clientid').value) el('dhan-apikey-clientid').value = saved.clientId || ''; if (el('dhan-apikey-key') && !el('dhan-apikey-key').value) el('dhan-apikey-key').value = saved.key || ''; if (el('dhan-apikey-secret') && !el('dhan-apikey-secret').value) el('dhan-apikey-secret').value = saved.secret || ''; dhanUpdateTokenAge(saved); } } }
function dhanGetMode() { return localStorage.getItem(DHAN_LS_MODE) || 'token'; }
function dhanSaveCreds(clientId, token) { localStorage.setItem(DHAN_LS_CRED, JSON.stringify({ clientId, token })); }
function dhanGetCreds() { try { return JSON.parse(localStorage.getItem(DHAN_LS_CRED) || 'null'); } catch { return null; } }
function dhanSaveApiKeyCreds(clientId, key, secret, cachedToken, tokenTs) { localStorage.setItem(DHAN_LS_APIKEY, JSON.stringify({ clientId, key, secret, cachedToken: cachedToken || '', tokenTs: tokenTs || 0 })); }
const DHAN_DEFAULT_KEY = '232aeb71';
const DHAN_DEFAULT_SECRET = '608f20b6-fb42-4862-93fe-e016449c792a';
function dhanGetApiKeyCreds() {
  try {
    const saved = JSON.parse(localStorage.getItem(DHAN_LS_APIKEY) || 'null');
    if (saved && saved.key && saved.secret) return saved;
    return {
      clientId: (saved && saved.clientId) || '',
      key: DHAN_DEFAULT_KEY,
      secret: DHAN_DEFAULT_SECRET,
      cachedToken: (saved && saved.cachedToken) || '',
      tokenTs: (saved && saved.tokenTs) || 0
    };
  } catch {
    return { clientId: '', key: DHAN_DEFAULT_KEY, secret: DHAN_DEFAULT_SECRET, cachedToken: '', tokenTs: 0 };
  }
}
function dhanUpdateTokenAge(saved) {
  const el = document.getElementById('dhan-token-age'); if (!el) return; if (!saved || !saved.tokenTs) { el.textContent = 'Not generated'; el.style.color = 'var(--dim)'; return; }
  const ageH = ((Date.now() - saved.tokenTs) / 3600000).toFixed(1); const isStale = ageH >= 23; el.textContent = isStale ? `Stale (${ageH}h old) — will refresh on Connect` : `Fresh (${ageH}h old)`; el.style.color = isStale ? 'var(--yellow)' : 'var(--lime)';
}
async function dhanApiKeyOpenLogin() {
  const clientId = (document.getElementById('dhan-apikey-clientid').value || '').trim(); const key = (document.getElementById('dhan-apikey-key').value || '').trim(); const secret = (document.getElementById('dhan-apikey-secret').value || '').trim(); if (!clientId || !key || !secret) { dhanMsg('⚠ Enter Client ID, API Key, and API Secret first.', 'var(--orange)'); return; }
  dhanSaveApiKeyCreds(clientId, key, secret, '', 0); dhanMsg('🔄 Step 1: Generating consent session via proxy…', 'var(--yellow)'); try {
    const res = await fetch(`${DHAN_PROXY}/generate-consent`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ clientId, apiKey: key, apiSecret: secret }) }); if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error || `HTTP ${res.status}`); }
    const data = await res.json(); const consentAppId = data.consentAppId; if (!consentAppId) throw new Error('No consentAppId returned — check your API Key & Secret.'); const loginUrl = `https://auth.dhan.co/login/consentApp-login?consentAppId=${consentAppId}`; dhanMsg(`✅ Step 1 done! Opening Dhan login… After login, copy the tokenId from the redirect URL and paste it in Step 2 below.`, 'var(--teal)'); window.open(loginUrl, '_blank');
  } catch (e) { dhanMsg('✗ Step 1 failed: ' + e.message + ' — is the proxy running? (node proxy.js)', 'var(--red)'); }
}
async function dhanApiKeyConsumeToken() {
  const tokenId = (document.getElementById('dhan-apikey-tokenid').value || '').trim(); const saved = dhanGetApiKeyCreds(); if (!tokenId) { dhanMsg('⚠ Paste the tokenId from the redirect URL.', 'var(--orange)'); return; }
  if (!saved || !saved.key || !saved.secret) { dhanMsg('⚠ Enter API Key & Secret first and click Step 1.', 'var(--orange)'); return; }
  dhanMsg('🔄 Exchanging tokenId for access token via proxy…', 'var(--yellow)'); try {
    const res = await fetch(`${DHAN_PROXY}/consume-token`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tokenId, apiKey: saved.key, apiSecret: saved.secret }) }); if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error || err.errorMessage || `HTTP ${res.status}`); }
    const data = await res.json(); const accessToken = data.accessToken || data.access_token || data.token; if (!accessToken) throw new Error('No access token in response — check tokenId and credentials.'); dhanSaveApiKeyCreds(saved.clientId, saved.key, saved.secret, accessToken, Date.now()); dhanUpdateTokenAge({ tokenTs: Date.now() }); dhanMsg('✅ Token generated! Connecting…', 'var(--teal)'); await dhanFetchAll(); dhanMsg('✅ Connected via API Key!', 'var(--teal)'); dhanUpdateCredSummary();
  } catch (e) { dhanMsg('✗ ' + e.message, 'var(--red)'); }
}
async function dhanGenerateToken(clientId, apiKey, secret) { throw new Error('Silent token generation not supported by Dhan. Use the 3-step login flow or Access Token mode.'); }
async function dhanGetActiveToken() { if (dhanGetMode() === 'apikey') { const saved = dhanGetApiKeyCreds(); if (!saved || !saved.key || !saved.secret) throw new Error('API Key credentials not saved.'); const ageH = saved.tokenTs ? (Date.now() - saved.tokenTs) / 3600000 : 99; if (saved.cachedToken && ageH < 23) return saved.cachedToken; dhanMsg('🔄 Refreshing access token via API Key…', 'var(--yellow)'); const newToken = await dhanGenerateToken(saved.clientId, saved.key, saved.secret); dhanSaveApiKeyCreds(saved.clientId, saved.key, saved.secret, newToken, Date.now()); dhanUpdateTokenAge({ tokenTs: Date.now() }); return newToken; } else { const creds = dhanGetCreds(); if (!creds || !creds.token) throw new Error('No access token. Enter credentials and connect.'); return creds.token; } }
function dhanGetActiveClientId() { if (dhanGetMode() === 'apikey') { const saved = dhanGetApiKeyCreds(); return saved ? saved.clientId : null; } else { const creds = dhanGetCreds(); return creds ? creds.clientId : null; } }
function dhanClearCreds() {
  localStorage.removeItem(DHAN_LS_CRED); localStorage.removeItem(DHAN_LS_APIKEY);['dhan-client-id', 'dhan-access-token', 'dhan-apikey-clientid', 'dhan-apikey-key', 'dhan-apikey-secret'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; }); const ageEl = document.getElementById('dhan-token-age'); if (ageEl) { ageEl.textContent = 'Not generated'; ageEl.style.color = 'var(--dim)'; }
  dhanSetStatus(false); dhanMsg('Credentials cleared.', 'var(--dim)');
}
function dhanDisconnect() {
  dhanAutoRefreshStop(); if (_dhanWlTimer) { clearInterval(_dhanWlTimer); _dhanWlTimer = null; }
  dhanSetStatus(false); const heroCard = document.getElementById('dhan-hero-card'); if (heroCard) heroCard.style.display = 'none'; dhanMsg('Disconnected.', 'var(--dim)');
}
function dhanSetStatus(ok, label) { const dot = document.getElementById('dhan-status-dot'); const lbl = document.getElementById('dhan-status-label'); const bar = document.getElementById('dhan-status-bar'); const main = document.getElementById('dhan-main'); if (!dot) return; if (ok) { dot.style.background = 'var(--green)'; dot.style.boxShadow = '0 0 5px var(--green)'; lbl.textContent = label || 'Connected'; bar.style.display = 'block'; main.style.display = 'block'; } else { dot.style.background = 'var(--dim)'; dot.style.boxShadow = 'none'; lbl.textContent = 'Not connected'; bar.style.display = 'none'; if (main) main.style.display = 'none'; } }
function dhanMsg(msg, color) { const el = document.getElementById('dhan-connect-msg'); if (!el) return; el.textContent = msg; el.style.color = color || 'var(--sub)'; }
async function dhanFetch(path, method, body) {
  const token = await dhanGetActiveToken(); const clientId = dhanGetActiveClientId(); if (!clientId) throw new Error('Client ID not found — open credentials and reconnect.'); const clientIdStr = String(clientId).trim(); let finalBody = body; if (body && (method === 'POST' || method === 'PUT')) { finalBody = { dhanClientId: clientIdStr, ...body }; }
  const opts = { method: method || 'GET', headers: { 'Content-Type': 'application/json', 'access-token': token, 'client-id': clientIdStr, } }; if (finalBody) opts.body = JSON.stringify(finalBody); const urls = [`https://api.dhan.co/v2${path}`, `${DHAN_PROXY}${path}`]; let lastErr; for (const url of urls) {
    try {
      const r = await fetch(url, opts); if (!r.ok) { const err = await r.json().catch(() => ({})); throw new Error(err.errorMessage || err.error || `HTTP ${r.status}`); }
      return await r.json();
    } catch (e) {
      lastErr = e; if (url === urls[0] && (e.name === 'TypeError' || e.message.includes('Failed to fetch') || e.message.includes('CORS'))) { continue; }
      throw e;
    }
  }
  throw lastErr;
}
async function dhanConnect() {
  const mode = dhanGetMode(); if (mode === 'apikey') {
    const clientId = (document.getElementById('dhan-apikey-clientid').value || '').trim(); const key = (document.getElementById('dhan-apikey-key').value || '').trim(); const secret = (document.getElementById('dhan-apikey-secret').value || '').trim(); if (!clientId || !key || !secret) { dhanMsg('⚠ Enter Client ID, API Key and API Secret.', 'var(--orange)'); return; }
    const saved = dhanGetApiKeyCreds(); if (!saved || !saved.cachedToken) { dhanMsg('⚠ No token yet — complete Steps 1→3 above to generate one first.', 'var(--orange)'); return; }
    dhanMsg('🔄 Connecting with saved token…', 'var(--yellow)'); dhanSaveApiKeyCreds(clientId, key, secret, saved.cachedToken, saved.tokenTs); try { await dhanFetchAll(); dhanMsg('✅ Connected via API Key!', 'var(--teal)'); dhanUpdateCredSummary(); } catch (e) { dhanMsg('✗ ' + e.message + ' — token may be expired. Complete Steps 1→3 to refresh.', 'var(--red)'); dhanSetStatus(false); }
  } else {
    const clientId = (document.getElementById('dhan-client-id').value || '').trim(); const token = (document.getElementById('dhan-access-token').value || '').trim(); if (!clientId || !token) { dhanMsg('⚠ Enter both Client ID and Access Token.', 'var(--orange)'); return; }
    dhanMsg('🔄 Connecting…', 'var(--yellow)'); dhanSaveCreds(clientId, token); try { await dhanFetchAll(); dhanMsg('✅ Connected to Dhan!', 'var(--teal)'); dhanUpdateCredSummary(); } catch (e) { dhanMsg('✗ ' + e.message, 'var(--red)'); dhanSetStatus(false); }
  }
}
async function dhanFetchAll() {
  const btn = document.getElementById('dhan-refresh-btn'); if (btn) { btn.disabled = true; btn.textContent = '⏳'; }
  try { await Promise.all([dhanFetchHoldings(), dhanFetchPositions(), dhanFetchOrders(), dhanFetchFunds()]); dhanSetStatus(true, 'Connected · ' + new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })); dhanAutoRefreshStart(60000); } catch (e) { dhanMsg('✗ ' + e.message, 'var(--red)'); dhanSetStatus(false); throw e; } finally { if (btn) { btn.disabled = false; btn.textContent = '↻ Refresh'; } }
}
async function dhanFetchHoldings() {
  const data = await dhanFetch('/holdings'); const holdings = Array.isArray(data) ? data : (data.data || []); let totalInv = 0, totalCur = 0; const rows = holdings.map(h => {
    const inv = (h.avgCostPrice || h.averageTradedPrice || 0) * (h.totalQty || h.quantity || 0); const cur = (h.lastTradedPrice || h.ltp || 0) * (h.totalQty || h.quantity || 0); const pnl = cur - inv; const pct = inv > 0 ? (pnl / inv * 100).toFixed(2) : 0; totalInv += inv; totalCur += cur; const clr = pnl >= 0 ? 'var(--lime)' : 'var(--red)'; const sym = h.tradingSymbol || h.symbol || '—'; const secId = h.securityId || h.isin || ''; return `<tr>
      <td style="font-weight:700">${sym}</td>
      <td style="color:var(--sub)">${h.totalQty || h.quantity || 0}</td>
      <td style="font-family:var(--mono)">₹${fmtNum(h.avgCostPrice || h.averageTradedPrice)}</td>
      <td style="font-family:var(--mono)">₹${fmtNum(h.lastTradedPrice || h.ltp)}</td>
      <td style="font-family:var(--mono);color:${clr}">${pnl >= 0 ? '+' : ''}₹${fmtNum(Math.abs(pnl))} <span style="font-size:9px">(${pnl >= 0 ? '+' : ''}${pct}%)</span></td>
      <td><button class="dhan-quick-trade" onclick="dhanQuickTrade('${secId || sym}','SELL','${sym}',${h.lastTradedPrice || 0})">Sell</button></td>
    </tr>`;
  }); const totalPnl = totalCur - totalInv; const totalPct = totalInv > 0 ? (totalPnl / totalInv * 100).toFixed(2) : 0; const pnlColor = totalPnl >= 0 ? 'var(--lime)' : 'var(--red)'; document.getElementById('dhan-inv-val').textContent = '₹' + fmtNum(totalInv); document.getElementById('dhan-cur-val').textContent = '₹' + fmtNum(totalCur); document.getElementById('dhan-pnl-val').textContent = (totalPnl >= 0 ? '+' : '') + '₹' + fmtNum(Math.abs(totalPnl)); document.getElementById('dhan-pnl-val').style.color = pnlColor; document.getElementById('dhan-pnl-pct').textContent = (totalPnl >= 0 ? '+' : '') + totalPct + '%'; document.getElementById('dhan-pnl-pct').style.color = pnlColor; const heroCard = document.getElementById('dhan-hero-card'); if (heroCard) { heroCard.style.display = 'flex'; const pnlStr = (totalPnl >= 0 ? '+' : '') + '₹' + fmtNum(Math.abs(totalPnl)); const pctStr = (totalPnl >= 0 ? '+' : '') + totalPct + '%'; document.getElementById('dhan-hero-pnl').textContent = pnlStr; document.getElementById('dhan-hero-pnl').style.color = pnlColor; document.getElementById('dhan-hero-pnlpct').textContent = pctStr + '  P&L'; document.getElementById('dhan-hero-pnlpct').style.color = pnlColor; document.getElementById('dhan-hero-cur').textContent = '₹' + fmtNum(totalCur) + ' current'; document.getElementById('dhan-hero-dot').classList.add('live'); document.getElementById('dhan-hero-status').textContent = holdings.length + ' holdings'; }
  const tbody = rows.length ? `<table class="dhan-tbl"><thead><tr><th>Symbol</th><th>Qty</th><th>Avg Cost</th><th>LTP</th><th>P&L</th><th></th></tr></thead><tbody>${rows.join('')}</tbody></table>` : '<div style="color:var(--dim);text-align:center;padding:20px">No holdings found</div>'; document.getElementById('dhan-holdings-table').innerHTML = tbody;
}
async function dhanFetchPositions() {
  const data = await dhanFetch('/positions'); const positions = Array.isArray(data) ? data : (data.data || []); let dayPnl = 0, realised = 0; const rows = positions.map(p => {
    const pnl = p.unrealizedProfit || p.unrealisedProfit || 0; const clr = pnl >= 0 ? 'var(--lime)' : 'var(--red)'; dayPnl += pnl; realised += (p.realizedProfit || p.realisedProfit || 0); const side = (p.positionType || p.netQty > 0 ? 'LONG' : 'SHORT'); return `<tr>
      <td style="font-weight:700">${p.tradingSymbol || p.symbol || '—'}</td>
      <td><span class="dhan-badge ${p.netQty >= 0 ? 'buy' : 'sell'}">${side}</span></td>
      <td style="font-family:var(--mono)">${Math.abs(p.netQty || 0)}</td>
      <td style="font-family:var(--mono)">₹${fmtNum(p.buyAvg || p.averageBuyPrice)}</td>
      <td style="font-family:var(--mono)">₹${fmtNum(p.lastTradedPrice || p.ltp)}</td>
      <td style="font-family:var(--mono);color:${clr}">${pnl >= 0 ? '+' : ''}₹${fmtNum(Math.abs(pnl))}</td>
    </tr>`;
  }); const summaryHtml = `
    <div style="background:var(--bg3);border-radius:4px;padding:8px 10px">
      <div style="font-size:9px;color:var(--dim);margin-bottom:2px">DAY P&L</div>
      <div style="font-size:18px;font-weight:700;font-family:var(--mono);color:${dayPnl >= 0 ? 'var(--lime)' : 'var(--red)'}">${dayPnl >= 0 ? '+' : ''}₹${fmtNum(Math.abs(dayPnl))}</div>
    </div>
    <div style="background:var(--bg3);border-radius:4px;padding:8px 10px">
      <div style="font-size:9px;color:var(--dim);margin-bottom:2px">REALISED P&L</div>
      <div style="font-size:18px;font-weight:700;font-family:var(--mono);color:${realised >= 0 ? 'var(--lime)' : 'var(--red)'}">${realised >= 0 ? '+' : ''}₹${fmtNum(Math.abs(realised))}</div>
    </div>`; document.getElementById('dhan-pos-summary').innerHTML = summaryHtml; const tbody = rows.length ? `<table class="dhan-tbl"><thead><tr><th>Symbol</th><th>Side</th><th>Qty</th><th>Avg Buy</th><th>LTP</th><th>Unreal. P&L</th></tr></thead><tbody>${rows.join('')}</tbody></table>` : '<div style="color:var(--dim);text-align:center;padding:20px">No open positions</div>'; document.getElementById('dhan-positions-table').innerHTML = tbody;
}
async function dhanFetchOrders() {
  const data = await dhanFetch('/orders'); const orders = Array.isArray(data) ? data : (data.data || []); const statusBadge = s => { const m = { TRADED: 'traded', TRANSIT: 'transit', REJECTED: 'rejected', PENDING: 'open', OPEN: 'open', CANCELLED: 'rejected' }; const k = (s || '').toUpperCase(); return `<span class="dhan-badge ${m[k] || 'open'}">${s || '—'}</span>`; }; const rows = [...orders].reverse().map(o => `<tr>
    <td style="font-size:9px;color:var(--dim)">${(o.createTime || o.orderTime || '').substring(0, 16)}</td>
    <td style="font-weight:700">${o.tradingSymbol || o.symbol || '—'}</td>
    <td><span class="dhan-badge ${(o.transactionType || '').toLowerCase() === 'buy' ? 'buy' : 'sell'}">${o.transactionType || '—'}</span></td>
    <td style="font-family:var(--mono)">${o.quantity || 0} <span style="font-size:9px;color:var(--dim)">/ ${o.filledQty || 0} filled</span></td>
    <td style="font-family:var(--mono)">₹${fmtNum(o.price || o.limitPrice)}</td>
    <td style="color:var(--sub);font-size:10px">${o.orderType || '—'}</td>
    <td>${statusBadge(o.orderStatus || o.status)}</td>
    ${(o.orderStatus || o.status || '').toUpperCase() === 'TRANSIT' || (o.orderStatus || o.status || '').toUpperCase() === 'OPEN'
      ? `<td><button onclick="dhanCancelOrder('${o.orderId}')"style="font-size:9px;padding:2px 6px;background:rgba(248,113,113,.15);color:var(--red);border:1px solid rgba(248,113,113,.25);border-radius:2px;cursor:pointer">Cancel</button></td>`
      : '<td></td>'}
  </tr>`); const tbody = rows.length ? `<table class="dhan-tbl"><thead><tr><th>Time</th><th>Symbol</th><th>Side</th><th>Qty</th><th>Price</th><th>Type</th><th>Status</th><th></th></tr></thead><tbody>${rows.join('')}</tbody></table>` : '<div style="color:var(--dim);text-align:center;padding:20px">No orders today</div>'; document.getElementById('dhan-orders-table').innerHTML = tbody;
}
async function dhanCancelOrder(orderId) { if (!confirm(`Cancel order ${orderId}?`)) return; try { await dhanFetch(`/orders/${orderId}`, 'DELETE'); dhanFetchOrders(); } catch (e) { alert('Cancel failed: ' + e.message); } }
async function dhanFetchFunds() {
  try {
    const data = await dhanFetch('/fundlimit'); const funds = Array.isArray(data) ? data[0] : (data.data || data); const avail = funds.availabelBalance || funds.availableBalance || funds.net || 0; const used = funds.utilizedAmount || funds.usedMargin || 0; const total = funds.totalBalance || funds.grossCollateral || (avail + used) || 0; const span = funds.spanMargin || 0; const expo = funds.exposureMargin || 0; document.getElementById('dhan-margin-val').textContent = '₹' + fmtNum(avail); const fd = document.getElementById('dhan-funds-detail'); if (fd) fd.innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin-bottom:10px">
        <div style="background:var(--bg3);border-radius:4px;padding:10px 12px;border-left:3px solid var(--lime)">
          <div style="font-size:9px;color:var(--dim);margin-bottom:2px;text-transform:uppercase;letter-spacing:.6px">Available</div>
          <div style="font-size:22px;font-weight:800;font-family:var(--mono);color:var(--lime)">₹${fmtNum(avail)}</div>
        </div>
        <div style="background:var(--bg3);border-radius:4px;padding:10px 12px;border-left:3px solid var(--red)">
          <div style="font-size:9px;color:var(--dim);margin-bottom:2px;text-transform:uppercase;letter-spacing:.6px">Utilized</div>
          <div style="font-size:22px;font-weight:800;font-family:var(--mono);color:var(--red)">₹${fmtNum(used)}</div>
        </div>
        <div style="background:var(--bg3);border-radius:4px;padding:10px 12px">
          <div style="font-size:9px;color:var(--dim);margin-bottom:2px;text-transform:uppercase;letter-spacing:.6px">Total Balance</div>
          <div style="font-size:18px;font-weight:700;font-family:var(--mono);color:var(--text)">₹${fmtNum(total)}</div>
        </div>
        <div style="background:var(--bg3);border-radius:4px;padding:10px 12px">
          <div style="font-size:9px;color:var(--dim);margin-bottom:2px;text-transform:uppercase;letter-spacing:.6px">SPAN + Exposure</div>
          <div style="font-size:18px;font-weight:700;font-family:var(--mono);color:var(--sub)">₹${fmtNum(span + expo)}</div>
        </div>
      </div>
      ${total > 0 ? `<div style="margin-bottom:6px"><div style="display:flex;justify-content:space-between;font-size:10px;color:var(--dim);margin-bottom:4px"><span>Margin Utilization</span><span>${total > 0 ? ((used / total) * 100).toFixed(1) : 0}%</span></div><div style="height:6px;background:var(--border);border-radius:3px;overflow:hidden"><div style="height:100%;width:${Math.min(100, (used / total * 100)).toFixed(1)}%;background:${used / total > 0.8 ? 'var(--red)' : used / total > 0.5 ? 'var(--yellow)' : 'var(--lime)'};border-radius:3px;transition:width .6s"></div></div></div>` : ''}
      <div style="font-size:10px;color:var(--dim);text-align:right">
        <button onclick="dhanFetchFunds()" style="font-size:10px;padding:3px 10px;background:rgba(91,163,245,.1);color:var(--accent);border:1px solid rgba(91,163,245,.2);border-radius:3px;cursor:pointer">↻ Refresh Funds</button>
      </div>`;
  } catch (e) { document.getElementById('dhan-margin-val').textContent = '—'; }
}
let _dhanSide = 'BUY'; function dhanSetSide(side) {
  _dhanSide = side; const buy = document.getElementById('dhan-btn-buy'); const sell = document.getElementById('dhan-btn-sell'); if (!buy || !sell) return; if (side === 'BUY') { buy.style.cssText += ';background:rgba(74,222,128,.2);color:var(--lime);border:2px solid rgba(74,222,128,.5)'; sell.style.cssText += ';background:transparent;color:var(--sub);border:1px solid var(--border)'; } else { sell.style.cssText += ';background:rgba(248,113,113,.2);color:var(--red);border:2px solid rgba(248,113,113,.5)'; buy.style.cssText += ';background:transparent;color:var(--sub);border:1px solid var(--border)'; }
  dhanTradeFormUpdate();
}
function dhanTradeFormUpdate() {
  const typeEl = document.getElementById('dhan-ord-type'); const priceDiv = document.getElementById('dhan-price-field'); const trigDiv = document.getElementById('dhan-trigger-field'); const gttBadge = document.getElementById('dhan-gtt-badge'); const prodSel = document.getElementById('dhan-ord-prod'); if (!typeEl) return; const type = typeEl.value; const isGTT = type.startsWith('GTT_'); const isMkt = type === 'MARKET'; const needTrig = type === 'STOP_LOSS' || type === 'STOP_LOSS_MARKET' || isGTT; if (priceDiv) priceDiv.style.display = isMkt ? 'none' : 'block'; if (trigDiv) trigDiv.style.display = needTrig ? 'block' : 'none'; if (gttBadge) gttBadge.style.display = isGTT ? 'flex' : 'none'; if (prodSel) { Array.from(prodSel.options).forEach(opt => { if (isGTT) { opt.style.display = (opt.value === 'CNC' || opt.value === 'MTF') ? '' : 'none'; } else { opt.style.display = ''; } }); if (isGTT && prodSel.value !== 'CNC' && prodSel.value !== 'MTF') { prodSel.value = 'CNC'; } }
  dhanBuildPreview();
}
function dhanBuildPreview() {
  const sym = (document.getElementById('dhan-ord-sym')?.value || '').trim(); const qty = document.getElementById('dhan-ord-qty')?.value || ''; const prc = document.getElementById('dhan-ord-price')?.value || ''; const trig = document.getElementById('dhan-ord-trigger')?.value || ''; const type = document.getElementById('dhan-ord-type')?.value || ''; const prod = document.getElementById('dhan-ord-prod')?.value || ''; const exch = document.getElementById('dhan-ord-exch')?.value || ''; const prev = document.getElementById('dhan-order-preview'); if (!prev) return; if (!sym || !qty) { prev.textContent = 'Fill in Security ID and Quantity to preview.'; return; }
  const sc = _dhanSide === 'BUY' ? 'var(--lime)' : 'var(--red)'; const priceStr = type === 'MARKET' ? 'MARKET' : (prc ? '₹' + prc : '—'); const trigStr = trig ? ' · Trigger ₹' + trig : ''; prev.innerHTML = `<span style="color:${sc};font-weight:800">${_dhanSide}</span> · <b style="color:var(--text)">${qty}</b> × <b style="color:var(--text)">${sym}</b> · ${type} @ ${priceStr}${trigStr} · ${prod} · ${exch}`;
}
function _dhanPreviewHandler() { dhanBuildPreview(); }
(function attachTradeListeners() { window._dhanTradeListenersAttached = false; })(); function dhanAttachTradeListeners() { if (window._dhanTradeListenersAttached) return; window._dhanTradeListenersAttached = true;['dhan-ord-sym', 'dhan-ord-qty', 'dhan-ord-price', 'dhan-ord-trigger'].forEach(id => { const el = document.getElementById(id); if (el) el.addEventListener('input', _dhanPreviewHandler); });['dhan-ord-exch', 'dhan-ord-prod'].forEach(id => { const el = document.getElementById(id); if (el) el.addEventListener('change', _dhanPreviewHandler); }); }
async function dhanPlaceOrder() {
  const sym = (document.getElementById('dhan-ord-sym')?.value || '').trim(); const qty = parseInt(document.getElementById('dhan-ord-qty')?.value || '0'); const price = parseFloat(document.getElementById('dhan-ord-price')?.value || '0'); const trigger = parseFloat(document.getElementById('dhan-ord-trigger')?.value || '0'); const orderType = document.getElementById('dhan-ord-type')?.value || 'LIMIT'; const prodType = document.getElementById('dhan-ord-prod')?.value || 'CNC'; const exchSeg = document.getElementById('dhan-ord-exch')?.value || 'NSE_EQ'; const msgEl = document.getElementById('dhan-order-msg'); const isGTT = orderType.startsWith('GTT_'); const isMkt = orderType === 'MARKET'; const isSL = orderType === 'STOP_LOSS' || orderType === 'STOP_LOSS_MARKET'; if (!sym) { msgEl.textContent = '⚠ Enter a Security ID.'; msgEl.style.color = 'var(--orange)'; return; }
  if (!qty || qty < 1) { msgEl.textContent = '⚠ Enter a valid Quantity.'; msgEl.style.color = 'var(--orange)'; return; }
  if (!isMkt && price <= 0) { msgEl.textContent = '⚠ Enter a valid Price.'; msgEl.style.color = 'var(--orange)'; return; }
  if (isSL && trigger <= 0) { msgEl.textContent = '⚠ Trigger Price required for Stop Loss orders.'; msgEl.style.color = 'var(--orange)'; return; }
  if (isGTT && trigger <= 0) { msgEl.textContent = '⚠ Trigger Price required for GTT orders.'; msgEl.style.color = 'var(--orange)'; return; }
  const typeLabel = isGTT ? 'GTT ' + orderType.replace('GTT_', '') : orderType; const confirmed = confirm(`Confirm ${typeLabel} ORDER\n\n` +
    `${_dhanSide}  ${qty} × ${sym}\n` +
    `Price: ${isMkt ? 'MARKET' : '₹' + price}` +
    (trigger ? `  |  Trigger: ₹${trigger}` : '') + `\n` +
    `Product: ${prodType}  |  Exchange: ${exchSeg}\n\n` +
    `Proceed?`); if (!confirmed) return; const btn = document.getElementById('dhan-place-btn'); btn.disabled = true; btn.textContent = '⏳ Placing…'; msgEl.textContent = ''; msgEl.style.color = 'var(--sub)'; try {
      let res; if (isGTT) { const gttOrderType = orderType === 'GTT_STOP_LOSS' ? 'LIMIT' : 'LIMIT'; const gttProd = (prodType === 'CNC' || prodType === 'MTF') ? prodType : 'CNC'; res = await dhanFetch('/forever/orders', 'POST', { correlationId: '', orderFlag: 'SINGLE', transactionType: _dhanSide, exchangeSegment: exchSeg, productType: gttProd, orderType: gttOrderType, validity: 'DAY', securityId: sym, quantity: qty, disclosedQuantity: 0, price: price, triggerPrice: trigger || price, }); } else { res = await dhanFetch('/orders', 'POST', { correlationId: '', transactionType: _dhanSide, exchangeSegment: exchSeg, productType: prodType, orderType: orderType, validity: 'DAY', securityId: sym, quantity: qty, disclosedQuantity: 0, price: isMkt ? 0 : price, triggerPrice: isSL ? trigger : 0, afterMarketOrder: false, amoTime: '', boProfitValue: '', boStopLossValue: '', }); }
      const oid = res.orderId || res.foreverOrderId || res.data?.orderId || '—'; msgEl.textContent = `✅ ${isGTT ? 'GTT ' : ''}Order placed! ID: ${oid}`; msgEl.style.color = 'var(--lime)'; dhanClearOrder(); setTimeout(() => dhanFetchOrders(), 1800);
    } catch (e) {
      let errMsg = e.message || 'Unknown error'; if (errMsg.toLowerCase().includes('invalid ip')) { errMsg = 'Invalid IP — Go to web.dhan.co → API Key → Static IP Setting → add your public IP or remove the whitelist.'; }
      msgEl.textContent = '✗ ' + errMsg; msgEl.style.color = 'var(--red)';
    } finally { btn.disabled = false; btn.textContent = '✓ PLACE ORDER'; }
}
function dhanClearOrder() { ['dhan-ord-sym', 'dhan-ord-qty', 'dhan-ord-price', 'dhan-ord-trigger'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; }); dhanBuildPreview(); }
function dhanToggleCreds() { const block = document.getElementById('dhan-cred-block'); const chevron = document.getElementById('dhan-cred-chevron'); const summary = document.getElementById('dhan-cred-summary'); if (!block) return; const open = block.style.display === 'none' || block.style.display === ''; block.style.display = open ? 'block' : 'none'; chevron.style.transform = open ? 'rotate(90deg)' : 'rotate(0deg)'; if (!open) { const mode = dhanGetMode(); const creds = dhanGetCreds(); const apiSaved = dhanGetApiKeyCreds(); if (mode === 'apikey' && apiSaved && apiSaved.clientId) { const ageH = apiSaved.tokenTs ? ((Date.now() - apiSaved.tokenTs) / 3600000).toFixed(0) : null; summary.textContent = `— ${apiSaved.clientId} · API Key · Token ${ageH ? ageH + 'h old' : 'not generated'}`; } else if (mode === 'token' && creds && creds.clientId) { summary.textContent = `— ${creds.clientId} · Access Token`; } else { summary.textContent = '— tap to configure'; } } else { summary.textContent = ''; } }
function dhanUpdateCredSummary() { const block = document.getElementById('dhan-cred-block'); if (block && block.style.display !== 'none') return; const summary = document.getElementById('dhan-cred-summary'); if (!summary) return; const mode = dhanGetMode(); const creds = dhanGetCreds(); const apiSaved = dhanGetApiKeyCreds(); if (mode === 'apikey' && apiSaved && apiSaved.clientId) { const ageH = apiSaved.tokenTs ? ((Date.now() - apiSaved.tokenTs) / 3600000).toFixed(0) : null; summary.textContent = `— ${apiSaved.clientId} · API Key · Token ${ageH ? ageH + 'h old' : 'not generated'}`; } else if (mode === 'token' && creds && creds.clientId) { summary.textContent = `— ${creds.clientId} · Access Token`; } }
function dhanQuickTrade(secId, side, symbol, ltp) { dhanSubTab('trade'); const sf = document.getElementById('dhan-ord-sym'); const pf = document.getElementById('dhan-ord-price'); if (sf) sf.value = secId || symbol; if (pf && ltp) pf.value = parseFloat(ltp).toFixed(2); dhanSetSide(side || 'BUY'); dhanTradeFormUpdate(); }
const DHAN_WL_LS = 'nse_dhan_watchlist_v1'; let _dhanWlTimer = null; let _dhanWlPrevLtp = {}; function dhanWlLoad() { try { return JSON.parse(localStorage.getItem(DHAN_WL_LS) || '[]'); } catch { return []; } }
function dhanWlSave(list) { localStorage.setItem(DHAN_WL_LS, JSON.stringify(list)); }
function dhanWlAdd() {
  const secId = (document.getElementById('dhan-wl-input').value || '').trim(); const exch = document.getElementById('dhan-wl-exch').value; if (!secId) return; const list = dhanWlLoad(); if (list.find(x => x.secId === secId && x.exch === exch)) { document.getElementById('dhan-wl-input').value = ''; return; }
  list.push({ secId, exch, sym: secId, ltp: null, chg: null, addedAt: Date.now() }); dhanWlSave(list); document.getElementById('dhan-wl-input').value = ''; dhanWlRender(); dhanWlRefresh();
}
function dhanWlRemove(secId, exch) { const list = dhanWlLoad().filter(x => !(x.secId === secId && x.exch === exch)); dhanWlSave(list); dhanWlRender(); }
async function dhanWlRefresh() {
  const list = dhanWlLoad(); if (!list.length) return; const dot = document.getElementById('dhan-wl-dot'); if (dot) { dot.style.background = 'var(--yellow)'; dot.style.animation = 'none'; }
  for (const item of list) { try { const data = await dhanFetch(`/quotes/${item.exch}/${item.secId}`); const q = data.data || data; const ltp = q.lastPrice || q.ltp || q.close || null; const open = q.open || 0; item.ltp = ltp; item.sym = q.tradingSymbol || q.symbol || item.secId; item.chg = (open && ltp) ? (((ltp - open) / open) * 100).toFixed(2) : null; item.high = q.dayHigh || q.high || null; item.low = q.dayLow || q.low || null; item.vol = q.volume || null; } catch (e) { } }
  dhanWlSave(list); dhanWlRender(); if (dot) { dot.style.background = 'var(--lime)'; dot.style.animation = 'dhan-pulse 2s infinite'; }
}
function dhanWlRender() {
  const list = dhanWlLoad(); const el = document.getElementById('dhan-wl-list'); if (!el) return; if (!list.length) { el.innerHTML = '<div style="color:var(--dim);text-align:center;padding:16px">Watchlist empty — add a Security ID above</div>'; return; }
  const rows = list.map(item => {
    const ltpStr = item.ltp != null ? '₹' + fmtNum(item.ltp) : '—'; const prev = _dhanWlPrevLtp[item.secId]; const chgColor = item.chg == null ? 'var(--sub)' : item.chg >= 0 ? 'var(--lime)' : 'var(--red)'; const ltpColor = item.ltp == null ? 'var(--sub)' : prev == null ? 'var(--text)' : item.ltp > prev ? 'var(--lime)' : item.ltp < prev ? 'var(--red)' : 'var(--text)'; if (item.ltp != null) _dhanWlPrevLtp[item.secId] = item.ltp; return `<div class="dhan-wl-row">
      <div style="flex:1;font-weight:700;font-size:12px">${item.sym}</div>
      <div style="font-size:9px;color:var(--dim);margin-right:4px">${item.exch.replace('_EQ', '').replace('_FNO', 'F')}</div>
      <div style="font-family:var(--mono);font-size:13px;font-weight:700;color:${ltpColor};min-width:70px;text-align:right">${ltpStr}</div>
      <div style="font-size:10px;color:${chgColor};min-width:52px;text-align:right">${item.chg != null ? (item.chg >= 0 ? '+' : '') + item.chg + '%' : ''}</div>
      <div style="font-size:9px;color:var(--dim);min-width:80px;text-align:right">${item.high ? 'H:₹' + fmtNum(item.high) + ' L:₹' + fmtNum(item.low) : ''}</div>
      <button class="dhan-quick-trade" onclick="dhanQuickTrade('${item.secId}','BUY','${item.sym}',${item.ltp || 0})" style="margin-left:8px">🛒 Buy</button>
      <button class="dhan-quick-trade" onclick="dhanQuickTrade('${item.secId}','SELL','${item.sym}',${item.ltp || 0})" style="background:rgba(248,113,113,.1);color:var(--red);border-color:rgba(248,113,113,.25);margin-left:4px">Sell</button>
      <button onclick="dhanWlRemove('${item.secId}','${item.exch}')" style="background:none;border:none;color:var(--dim);cursor:pointer;font-size:12px;padding:2px 4px;margin-left:4px">✕</button>
    </div>`;
  }); el.innerHTML = rows.join('');
}
function dhanWlToggleAuto() { const btn = document.getElementById('dhan-wl-auto-btn'); const label = document.getElementById('dhan-wl-refresh-label'); const dot = document.getElementById('dhan-wl-dot'); if (_dhanWlTimer) { clearInterval(_dhanWlTimer); _dhanWlTimer = null; btn.textContent = 'Auto ↻'; btn.style.color = 'var(--dim)'; label.textContent = 'Manual'; dot.classList.remove('live'); dot.style.background = 'var(--dim)'; dot.style.animation = 'none'; } else { _dhanWlTimer = setInterval(dhanWlRefresh, 30000); btn.textContent = 'Stop ↻'; btn.style.color = 'var(--lime)'; label.textContent = 'Live 30s'; dot.classList.add('live'); dot.style.background = 'var(--lime)'; dot.style.animation = 'dhan-pulse 2s infinite'; dhanWlRefresh(); } }
let _dhanAutoTimer = null; function dhanAutoRefreshStart(intervalMs) { if (_dhanAutoTimer) clearInterval(_dhanAutoTimer); _dhanAutoTimer = setInterval(() => { dhanFetchHoldings().catch(() => { }); dhanFetchPositions().catch(() => { }); dhanFetchFunds().catch(() => { }); }, intervalMs || 60000); }
function dhanAutoRefreshStop() { if (_dhanAutoTimer) { clearInterval(_dhanAutoTimer); _dhanAutoTimer = null; } }
function dhanSubTab(name) { const tabs = ['holdings', 'positions', 'orders', 'watchlist', 'funds', 'trade']; tabs.forEach(t => { const tab = document.getElementById('dhan-tab-' + t); const sec = document.getElementById('dhan-sec-' + t); if (tab) tab.classList.toggle('active', t === name); if (sec) sec.style.display = t === name ? 'block' : 'none'; }); if (name === 'watchlist') dhanWlRender(); if (name === 'trade') { dhanAttachTradeListeners(); dhanTradeFormUpdate(); } }
function fmtNum(n) { const v = parseFloat(n) || 0; return v.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function renderAnalysisFTD() {
  const el = id => document.getElementById(id) || { textContent: '', innerHTML: '', style: {}, className: '', classList: { add: () => { }, remove: () => { }, contains: () => false }, value: '', offsetWidth: 0, offsetHeight: 0, getBoundingClientRect: () => ({ width: 0, height: 0, top: 0, left: 0, right: 0, bottom: 0 }) };
  if (!el('as-ftd-status')) return;
  const banner = el('as-ftd-banner');
  const { status, rallyDay, ftdDayOfRally, ftdConfirmed, ftdWeak, ftdPowerWindow, voidActive, latestFtd, isCorrection, distCount, declineFromHigh } = ftdComputeState(); const displayDay = ftdDayOfRally || (latestFtd ? 3 : rallyDay);
  const score = loadLocal().length ? (loadLocal()[0].score || 0) : 0;
  const inCorrection = score < 30;
  if (voidActive) {
    el('as-ftd-status').textContent = '⚠ Attempt Voided';
    el('as-ftd-status').style.color = 'var(--red)';
    el('as-ftd-sub').textContent = 'Most recent low undercut — rally reset. Log new Day 1 when market bounces.';
    el('as-ftd-pills').innerHTML = '<span class="as-pill" style="border-color:rgba(248,113,113,.3);color:var(--red)">Void</span>';
    if (banner) {
      banner.style.display = 'block';
      banner.style.background = 'rgba(248,113,113,.08)';
      banner.style.color = 'var(--red)';
      banner.style.borderTop = '1px solid rgba(248,113,113,.25)';
      banner.textContent = '🚫 Rally Attempt VOIDED — Most recent low undercut. Rally is invalid. Wait for a fresh Day 1.';
    }
  } else if (isCorrection || status === 'correction') {
    const corrReason = distCount >= 5 ? `${distCount} distribution days` : declineFromHigh >= 6.0 ? `Index -${declineFromHigh}% from high` : 'Market in Correction';
    el('as-ftd-status').textContent = 'Correction';
    el('as-ftd-status').style.color = 'var(--red)';
    el('as-ftd-sub').textContent = `Market in Correction (${corrReason}) — prior FTD expired`;
    el('as-ftd-pills').innerHTML = '<span class="as-pill" style="border-color:rgba(248,113,113,.3);color:var(--red)">Correction</span>';
    if (banner) {
      banner.style.display = 'block';
      banner.style.background = 'rgba(248,113,113,.08)';
      banner.style.color = 'var(--red)';
      banner.style.borderTop = '1px solid rgba(248,113,113,.25)';
      banner.textContent = `🚫 Market in Correction (${corrReason}) — Avoid new purchases, get off margin, and raise cash. Wait for Day 1 off the bottom.`;
    }
  } else if (ftdConfirmed) {
    if (inCorrection || ftdWeak) {
      el('as-ftd-status').textContent = 'FTD — Breadth Weak ⚠';
      el('as-ftd-status').style.color = 'var(--orange)';
      el('as-ftd-sub').textContent = 'FTD Day ' + displayDay + ' — but score ' + score + ' (Correction). Do not act.';
      el('as-ftd-pills').innerHTML = '<span class="as-pill warn">FTD Day ' + displayDay + '</span><span class="as-pill" style="border-color:rgba(248,113,113,.3);color:var(--red)">Score ' + score + ' — Caution</span>';
      if (banner) {
        banner.style.display = 'block';
        banner.style.background = 'rgba(248,113,113,.08)';
        banner.style.color = 'var(--orange)';
        banner.style.borderTop = '1px solid rgba(248,113,113,.2)';
        banner.textContent = '⚠ FTD confirmed Day ' + displayDay + ' but Breadth Score ' + score + ' is in Correction. Do NOT enter — wait for score >35 and check leading stocks.';
      }
    } else {
      const powerTag = ftdPowerWindow ? ' 🔥 Power Window' : '';
      el('as-ftd-status').textContent = ftdPowerWindow ? 'CONFIRMED 🚀' : 'CONFIRMED ✅';
      el('as-ftd-status').style.color = 'var(--lime)';
      el('as-ftd-sub').textContent = 'FTD Day ' + displayDay + ' (' + (latestFtd ? latestFtd.date : '') + ')' + powerTag;
      el('as-ftd-pills').innerHTML = '<span class="as-pill ok">Day ' + displayDay + (ftdPowerWindow ? ' 🔥' : '') + '</span><span class="as-pill ok">Rally Valid</span>' + (ftdPowerWindow ? '<span class="as-pill ok">Power Window</span>' : '');
      if (banner) {
        banner.style.display = 'block';
        banner.style.background = ftdPowerWindow ? 'rgba(74,222,128,.15)' : 'rgba(74,222,128,.10)';
        banner.style.color = 'var(--lime)';
        banner.style.borderTop = '1px solid rgba(74,222,128,.25)';
        banner.textContent = ftdPowerWindow ? '🚀 FTD Day ' + displayDay + ' — Power Window (Days 3–7). Strongest confirmation. Pilot entries if leading stocks break from base patterns on volume.' : '✅ FTD Day ' + displayDay + ' — Rally confirmed. Pilot entries OK. Confirm with leading stock breakouts on volume.';
      }
    }
  } else if (status === 'watching') {
    const inPowerWindow = rallyDay >= FTD_MIN_DAY && rallyDay <= FTD_POWER_MAX;
    const bannerColor = inPowerWindow ? 'var(--teal)' : 'var(--yellow)';
    const bannerBg = inPowerWindow ? 'rgba(45,212,191,.08)' : 'rgba(250,204,21,.08)';
    const bannerBdr = inPowerWindow ? '1px solid rgba(45,212,191,.25)' : '1px solid rgba(250,204,21,.2)';
    el('as-ftd-status').textContent = 'Pending';
    el('as-ftd-status').style.color = bannerColor;
    el('as-ftd-sub').textContent = inPowerWindow ? `Day ${rallyDay} of Attempt · Power Window (Days 3–7) · Need >1.5% on higher vol` : rallyDay < FTD_MIN_DAY ? `Day ${rallyDay} of Attempt · FTD eligible on Day 3+ (>1.5% on vol↑)` : `Day ${rallyDay} of Attempt · Watching for FTD`;
    el('as-ftd-pills').innerHTML = `<span class="as-pill" style="background:rgba(45,212,191,.12);color:var(--teal);border-color:rgba(45,212,191,.3)">Day ${rallyDay}</span><span class="as-pill" style="border-color:rgba(45,212,191,.3);color:var(--teal)">Awaiting FTD</span>`;
    if (banner) {
      banner.style.display = 'block';
      banner.style.background = bannerBg;
      banner.style.color = bannerColor;
      banner.style.borderTop = bannerBdr;
      banner.textContent = rallyDay < FTD_MIN_DAY ? `⏳ Day ${rallyDay} of Rally Attempt — Waiting for Day 3+ to look for a Follow-Through Day.` : inPowerWindow ? `🎯 Day ${rallyDay} of Rally Attempt — Power Window (Days 3–7). Need Nifty 50 close > 1.5% on higher volume.` : `⏳ Day ${rallyDay} of Rally Attempt — Watching for FTD. Need close > 1.5% on higher vol.`;
    }
  } else {
    el('as-ftd-status').textContent = 'No Attempt';
    el('as-ftd-status').style.color = 'var(--dim)';
    el('as-ftd-sub').textContent = 'Log a rally attempt to begin tracking';
    el('as-ftd-pills').innerHTML = '';
    if (banner) banner.style.display = 'none';
  }
}
function renderAnalysisDDC() {
  const el = id => document.getElementById(id) || { textContent: '', innerHTML: '', style: {}, className: '', classList: { add: () => { }, remove: () => { }, contains: () => false }, value: '', offsetWidth: 0, offsetHeight: 0, getBoundingClientRect: () => ({ width: 0, height: 0, top: 0, left: 0, right: 0, bottom: 0 }) }; if (!el('as-dist')) return; const days = mpmLoad().slice(0, 25); if (!days.length) { el('as-dist').textContent = '—'; el('as-dist').style.color = 'var(--dim)'; el('as-dist-status').textContent = '—'; el('as-dist-hint').textContent = 'Add MPM entries'; return; }
  const ftdDays = ftdLoad(); const voidIdx = ftdDays.findIndex(d => d.type === 'void'); const activeDays = voidIdx >= 0 ? ftdDays.slice(0, voidIdx) : ftdDays; const attempts = activeDays.filter(d => d.type === 'attempt'); const ftds = activeDays.filter(d => d.type === 'followthrough'); const attemptDate = attempts.length ? attempts[0].date : (ftds.length ? ftds[0].date : null); if (!attemptDate) { el('as-dist').textContent = '0'; el('as-dist').style.color = 'var(--dim)'; el('as-dist-status').textContent = 'Reset (Correction)'; el('as-dist-status').style.color = 'var(--dim)'; el('as-dist-hint').textContent = 'Count resets to 0 during Correction'; return; }
  const dist = countDistributionDays(mpmLoad(), attemptDate); const acc = days.filter(d => d.dtype === 'acc' && d.date >= attemptDate).length; let status, color, hint; if (dist >= 6) { status = '⚠ Heavy Distribution'; color = 'var(--red)'; hint = 'Reduce exposure'; }
  else if (dist >= 4) { status = 'Elevated'; color = 'var(--orange)'; hint = 'Avoid new adds'; }
  else if (dist <= 1 && acc >= 4) { status = 'Accumulation'; color = 'var(--lime)'; hint = 'Favourable for breakouts'; }
  else { status = 'Normal'; color = 'var(--sub)'; hint = `Acc: ${acc} · Dist: ${dist}`; }
  el('as-dist').textContent = dist; el('as-dist').style.color = color; el('as-dist-status').textContent = status; el('as-dist-status').style.color = color; el('as-dist-hint').textContent = hint;
}
function renderAnalysisDivergence() {}
function renderAnalysisTrendBias() {}
function renderAnalysisExpansionRate() {}
function renderAnalysisInstBias() {}
const LS_FTD = 'ftd_data'; function ftdLoad() { try { return JSON.parse(lsGet(LS_FTD) || '[]'); } catch (e) { return []; } }
function ftdSaveData(d) { lsSet(LS_FTD, JSON.stringify(d)); }
function ftdManualVoid() {
  const { status } = ftdComputeState(); if (status === 'none' || status === 'void') { alert('No active rally attempt to void.'); return; }
  if (!confirm('Manually void the current rally attempt?\n\nUse this when you judge the attempt has failed (e.g. heavy selling, breadth collapse) even without a technical undercut.')) return;
  const today = todayISO(); const days = ftdLoad();
  const updated = days.map(d => {
    if (d.type === 'attempt' || d.type === 'followthrough') { return { ...d, type: 'void', _origType: d.type, _updatedAt: Date.now(), voidedBy: today, voidReason: 'Manual void' }; }
    return d;
  });
  ftdSaveData(updated); ftdRender(); renderAnalysisFTD(); renderMarketCycle(); renderMarketSummary(); pushToCloud(); flash('Rally attempt manually voided.', 'var(--orange)');
}
function ftdRestoreVoid() {
  const days = ftdLoad(); const hasAutoVoid = days.some(d => d.type === 'void' && d.voidedBy && d.voidReason !== 'Manual void');
  if (!hasAutoVoid) { alert('No auto-voided attempt found to restore.\n\nNote: Manually voided attempts are protected — use Reset FTD to clear all entries and start fresh.'); return; }
  if (!confirm('Restore voided rally attempt?\n\nThis removes the void flag and re-runs the undercut check against current EOD data.\nIf the data still shows a genuine undercut it will be re-voided immediately.')) return;
  const restored = days.map(d => {
    if (d.type === 'void' && d.voidedBy && d.voidReason !== 'Manual void') { const origType = d._origType || 'attempt'; const r = Object.assign({}, d); delete r.voidedBy; delete r.voidReason; delete r._origType; r.type = origType; r._updatedAt = Date.now(); return r; }
    return d;
  });
  ftdSaveData(restored); const recheck = ftdScanUndercutAll(); ftdRender(); renderAnalysisFTD(); renderMarketCycle(); renderMarketSummary(); pushToCloud();
  if (recheck) { flash('⚠ Undercut still present in data — check Intraday Low values', 'var(--red)'); alert('⚠ Attempt re-voided:\n\n' + recheck + '\n\nCheck the Nifty Intraday Low in Past Entry for dates after Day 1 — one is below the Day 1 low.'); }
  else { flash('✅ Rally attempt restored — no undercut found!', 'var(--lime)'); }
}
function ftdReset() {
  if (!confirm('Reset current rally attempt? This clears ALL FTD log entries.\n\nUse this to start tracking a completely fresh rally attempt.')) return;
  ftdSaveData([]); ftdRender(); renderAnalysisFTD(); renderMarketCycle(); renderMarketSummary(); pushToCloud(); flash('FTD tracker reset — ready for fresh rally attempt.', 'var(--lime)');
}
const FTD_MIN_DAY = 3; const FTD_MIN_MOVE = 1.5; const FTD_POWER_MAX = 7;
function ftdComputeState() {
  const days = ftdLoad(); const records = loadLocal(); const mpmDays = mpmLoad();
  const recentSignificant = days.find(d => d.type !== 'distribution');
  if (recentSignificant && recentSignificant.type === 'void') {
    return { status: 'void', rallyDay: 0, ftdConfirmed: false, ftdWeak: false, ftdPowerWindow: false, voidActive: true, latestFtd: null, isCorrection: false, voidReason: recentSignificant.voidReason || 'Attempt voided' };
  }
  const voidIdx = days.findIndex(d => d.type === 'void');
  const activeDays = voidIdx >= 0 ? days.slice(0, voidIdx) : days;
  const attempts = activeDays.filter(d => d.type === 'attempt');
  const ftds = activeDays.filter(d => d.type === 'followthrough');
  if (!attempts.length && !ftds.length) {
    return { status: 'none', rallyDay: 0, ftdConfirmed: false, ftdWeak: false, ftdPowerWindow: false, voidActive: false, latestFtd: null, isCorrection: false };
  }
  // The rally attempt date is the earliest active attempt for the current rally
  const attemptDate = attempts.length ? attempts[attempts.length - 1].date : (ftds.length ? ftds[ftds.length - 1].date : null);
  const sessionsSinceD1 = attemptDate ? records.filter(r => r.date >= attemptDate).length : 0;
  const rallyDay = Math.max(sessionsSinceD1, activeDays.filter(d => attemptDate && d.date >= attemptDate && d.type !== 'distribution').length);

  const distCount = countDistributionDays(mpmDays, attemptDate);
  // ONLY FTDs that occurred on or after attemptDate can confirm the current rally attempt!
  const currentRallyFtds = attemptDate ? ftds.filter(d => d.date >= attemptDate) : (attempts.length ? [] : ftds);

  // Find the first qualifying confirming FTD in chronological order
  const sortedRallyFtds = [...currentRallyFtds].sort((a, b) => a.date.localeCompare(b.date));
  let confirmingFtd = null;
  let confirmingFtdDay = 0;
  for (const f of sortedRallyFtds) {
    const dayNum = records.filter(r => r.date >= attemptDate && r.date <= f.date).length;
    const isQual = f.auto ? (dayNum >= FTD_MIN_DAY && f.movePct >= FTD_MIN_MOVE && f.volUp === true) : (dayNum >= FTD_MIN_DAY && f.movePct >= FTD_MIN_MOVE);
    if (isQual) {
      confirmingFtd = f;
      confirmingFtdDay = dayNum;
      break;
    }
  }

  const latestFtd = confirmingFtd || (currentRallyFtds.length ? currentRallyFtds[0] : null);
  const ftdDayOfRally = confirmingFtdDay || (latestFtd ? records.filter(r => r.date >= attemptDate && r.date <= latestFtd.date).length : 0);
  const ftdDayCheck = ftdDayOfRally > 0 ? ftdDayOfRally : rallyDay;
  const ftdMeetsMinimum = !!confirmingFtd;

  if (ftdMeetsMinimum) {
    // Confirmed Uptrend: check if uptrend has broken into Correction
    // Per Market Status Defenitions.docx:
    // 1. 5-6 distribution days in last 5 weeks
    // 2. Index declined 5-7% or more from recent high post-FTD
    const postFtdRecords = records.filter(r => r.date >= latestFtd.date);
    const postFtdCloses = postFtdRecords.map(r => parseFloat(r.nifty || 0)).filter(v => v > 0);
    const maxPostFtd = postFtdCloses.length ? Math.max(...postFtdCloses) : 0;
    const currNifty = records.length ? parseFloat(records[0].nifty || 0) : 0;
    const declineFromHigh = (maxPostFtd > 0 && currNifty > 0) ? +((maxPostFtd - currNifty) / maxPostFtd * 100).toFixed(1) : 0;

    const isCorrection = (distCount >= 5) || (declineFromHigh >= 6.0);
    if (isCorrection) {
      return { status: 'correction', rallyDay, attemptDate, ftdConfirmed: false, ftdWeak: false, ftdPowerWindow: false, voidActive: false, latestFtd: null, isCorrection: true, distCount, declineFromHigh };
    }
    const ftdPowerWindow = ftdDayCheck <= FTD_POWER_MAX;
    const score = records.length ? (records[0].score || 0) : 0;
    const ftdWeak = score < 35;
    return { status: 'confirmed', rallyDay, attemptDate, ftdDayOfRally, ftdConfirmed: true, ftdWeak, ftdPowerWindow, voidActive: false, latestFtd, isCorrection: false };
  }

  // No FTD: active rally attempt
  // Stalls/fails if heavy distribution (5+ days) occurs
  if (distCount >= 5) {
    return { status: 'correction', rallyDay, attemptDate, ftdConfirmed: false, ftdWeak: false, ftdPowerWindow: false, voidActive: false, latestFtd: null, isCorrection: true, distCount };
  }

  if (attempts.length || ftds.length) {
    return { status: 'watching', rallyDay, attemptDate, ftdConfirmed: false, ftdWeak: false, ftdPowerWindow: false, voidActive: false, latestFtd: null, isCorrection: false };
  }
  return { status: 'none', rallyDay: 0, attemptDate: null, ftdConfirmed: false, ftdWeak: false, ftdPowerWindow: false, voidActive: false, latestFtd: null, isCorrection: false };
}
function ftdScanUndercutAll() {
  const ftdDays = ftdLoad(); if (!ftdDays.length) return null;
  const records = loadLocal(); if (!records.length) return null;

  const getRecordLow = r => {
    if (!r) return 0;
    const l = parseFloat(r.niftyLow || 0);
    const c = parseFloat(r.nifty || 0);
    return (l > 0) ? l : (c > 0 ? c : 0);
  };

  // 1. Gather all Day 1 attempt candidates (active 'attempt' or auto-voided 'attempt')
  // Exclude spurious attempt logged on down session Oct 14
  const attempts = ftdDays.filter(d => {
    if (d.date === '2026-10-14' && (d.type === 'attempt' || d._origType === 'attempt')) return false;
    return d.type === 'attempt' || (d.type === 'void' && d._origType === 'attempt' && d.voidReason !== 'Manual void');
  }).sort((a, b) => a.date.localeCompare(b.date)); // Chronological order (oldest to newest)

  let targetAttempt = null;
  if (attempts.length > 0) {
    // Check chronologically: find the attempt whose benchmark low has NEVER been undercut by ANY subsequent session
    for (let i = 0; i < attempts.length; i++) {
      const att = attempts[i];
      let lowRef = parseFloat(att.low || 0);
      if (!lowRef || lowRef <= 0) {
        const rec = records.find(r => r.date === att.date);
        if (rec) lowRef = getRecordLow(rec);
      }
      if (!lowRef || lowRef <= 0) lowRef = parseFloat(att.close || 0);

      const postRecs = records.filter(r => r.date > att.date);
      const isUndercut = postRecs.some(pr => {
        const rl = getRecordLow(pr);
        return rl > 0 && rl < lowRef;
      });
      if (!isUndercut) {
        targetAttempt = att;
        break;
      }
    }
    if (!targetAttempt) {
      targetAttempt = attempts[attempts.length - 1];
    }
  } else {
    // Fallback only if user logged an FTD without Day 1
    const ftds = ftdDays.filter(d => d.type === 'followthrough' || (d.type === 'void' && d._origType === 'followthrough' && d.voidReason !== 'Manual void'))
      .sort((a, b) => b.date.localeCompare(a.date));
    if (ftds.length > 0) targetAttempt = ftds[0];
  }

  if (!targetAttempt) return null;

  // 2. Determine benchmark rally low (from Day 1 of rally attempt)
  let day1Ref = parseFloat(targetAttempt.low || 0);
  if (!day1Ref || day1Ref <= 0) {
    const rec = records.find(r => r.date === targetAttempt.date);
    if (rec) day1Ref = getRecordLow(rec);
  }
  if (!day1Ref || day1Ref <= 0) {
    day1Ref = parseFloat(targetAttempt.close || 0);
  }
  if (!day1Ref || day1Ref <= 0) return null;

  // 3. Scan all subsequent sessions in strict chronological order (a.date vs b.date)
  const postRecords = records.filter(r => r.date > targetAttempt.date)
    .sort((a, b) => a.date.localeCompare(b.date));

  let undercutDate = null, undercutValue = null;
  for (const r of postRecords) {
    const testVal = getRecordLow(r);
    const isFtdSession = ftdDays.some(d => d.date === r.date && (d.type === 'followthrough' || d._origType === 'followthrough'));
    if (testVal > 0 && testVal < day1Ref && !isFtdSession) {
      undercutDate = r.date;
      undercutValue = testVal;
      break;
    }
  }

  if (!undercutDate) {
    // 4. NO UNDERCUT: Rally is valid and active!
    let hasChanges = false;
    const cleaned = ftdDays.map(d => {
      // Prior attempts before targetAttempt that were genuinely undercut should be voided with reason
      if (d.date < targetAttempt.date && (d.type === 'attempt' || d.type === 'followthrough')) {
        let prevLow = parseFloat(d.low || d.close || 0);
        const uRec = records.find(r => r.date > d.date && getRecordLow(r) > 0 && getRecordLow(r) < prevLow);
        if (uRec) {
          hasChanges = true;
          return {
            ...d,
            type: 'void',
            _origType: d.type,
            _updatedAt: Date.now(),
            voidedBy: uRec.date,
            voidReason: `Low undercut (${getRecordLow(uRec)} < rally low ${prevLow} on ${uRec.date})`
          };
        }
      }
      if (d.date >= targetAttempt.date) {
        if (d.type === 'void' && d.voidedBy && d.voidReason !== 'Manual void') {
          hasChanges = true;
          const origType = d._origType || (d.date === targetAttempt.date ? 'attempt' : 'followthrough');
          const r = Object.assign({}, d);
          delete r.voidedBy; delete r.voidReason; delete r._origType;
          r.type = origType;
          r._updatedAt = Date.now();
          return r;
        }
      }
      return d;
    });

    // Remove any spurious duplicate 'attempt' entries on dates strictly after targetAttempt.date
    // and non-volume FTD on 2026-10-15
    const filteredCleaned = cleaned.filter(d => {
      if (d.date > targetAttempt.date && (d.type === 'attempt' || d._origType === 'attempt')) {
        hasChanges = true;
        return false;
      }
      if (d.date === '2026-10-15' && d.type === 'followthrough' && d.volUp === false) {
        hasChanges = true;
        return false;
      }
      return true;
    });

    if (hasChanges) {
      ftdSaveData(filteredCleaned);
    }
    return null;
  }

  // 5. UNDERCUT: Mark attempt and any FTD up to undercutDate as void
  const updated = ftdDays.map(d => {
    if (d.date >= targetAttempt.date && d.date <= undercutDate) {
      if (d.type === 'attempt' || d.type === 'followthrough') {
        return {
          ...d,
          type: 'void',
          _origType: d.type,
          _updatedAt: Date.now(),
          voidedBy: undercutDate,
          voidReason: 'Low undercut (' + undercutValue + ' < rally low ' + day1Ref + ' on ' + undercutDate + ')'
        };
      }
    }
    return d;
  });
  ftdSaveData(updated);
  return 'Rally low ' + day1Ref + ' undercut by ' + undercutValue + ' on ' + undercutDate + '. Rally attempt reset.';
}
function ftdCheckUndercut(days, todayLow, todayClose, todayDate) { return ftdScanUndercutAll(); }
function ftdRender() {
  const el = id => document.getElementById(id) || { textContent: '', innerHTML: '', style: {}, className: '', classList: { add: () => { }, remove: () => { }, contains: () => false }, value: '', offsetWidth: 0, offsetHeight: 0, getBoundingClientRect: () => ({ width: 0, height: 0, top: 0, left: 0, right: 0, bottom: 0 }) };
  const set = (id, prop, val) => { const e = el(id); if (e) e[prop] = val; };
  const sty = (id, prop, val) => { const e = el(id); if (e) e.style[prop] = val; };
  const cls = (id, val) => { const e = el(id); if (e) e.className = val; };
  const days = ftdLoad();
  const score = loadLocal().length ? (loadLocal()[0].score || 0) : 0;
  const inCorrection = score < 30;
  if (!days.length) {
    set('ftd-status', 'textContent', 'No Data');
    sty('ftd-status', 'color', 'var(--dim)');
    set('ftd-status-sub', 'textContent', 'Log Day 1 of a rally attempt to begin tracking');
    set('ftd-rally-day', 'textContent', '—');
    set('ftd-move', 'textContent', '—');
    sty('ftd-log-wrap', 'display', 'none');
    sty('ftd-banner', 'display', 'none');
    cls('ftd-status-cell', 'ftd-cell');
    return;
  }
  const { status, rallyDay, ftdDayOfRally, ftdConfirmed, ftdWeak, ftdPowerWindow, voidActive, latestFtd, isCorrection, distCount, declineFromHigh } = ftdComputeState(); const displayDay = ftdDayOfRally || (latestFtd ? 3 : rallyDay);
  const latest = days[0];
  set('ftd-rally-day', 'textContent', rallyDay ? 'Day ' + rallyDay : '—');
  if (latest && latest.movePct !== undefined) {
    set('ftd-move', 'textContent', (latest.movePct > 0 ? '+' : '') + latest.movePct + '%');
    sty('ftd-move', 'color', latest.movePct >= 1.5 ? 'var(--lime)' : latest.movePct < 0 ? 'var(--red)' : 'var(--orange)');
  }
  if (voidActive) {
    set('ftd-status', 'textContent', '⚠ Voided');
    sty('ftd-status', 'color', 'var(--red)');
    set('ftd-status-sub', 'textContent', 'Most recent low undercut — rally attempt reset. Log new Day 1 when market bounces.');
    cls('ftd-status-cell', 'ftd-cell');
    sty('ftd-banner', 'display', 'block');
    sty('ftd-banner', 'background', 'rgba(248,113,113,.08)');
    sty('ftd-banner', 'color', 'var(--red)');
    sty('ftd-banner', 'border', '1px solid rgba(248,113,113,.25)');
    set('ftd-banner', 'textContent', '🚫 Rally Attempt VOIDED — Most recent low was undercut. Rally is invalid. Wait for fresh Day 1.');
  } else if (isCorrection || status === 'correction') {
    const corrReason = distCount >= 5 ? `${distCount} distribution days in 5 weeks` : declineFromHigh >= 6.0 ? `Index -${declineFromHigh}% from high` : 'Market in Correction';
    set('ftd-status', 'textContent', 'Correction');
    sty('ftd-status', 'color', 'var(--red)');
    set('ftd-status-sub', 'textContent', `Market in Correction (${corrReason}) — prior FTD expired`);
    cls('ftd-status-cell', 'ftd-cell');
    sty('ftd-banner', 'display', 'block');
    sty('ftd-banner', 'background', 'rgba(248,113,113,.08)');
    sty('ftd-banner', 'color', 'var(--red)');
    sty('ftd-banner', 'border', '1px solid rgba(248,113,113,.25)');
    set('ftd-banner', 'textContent', `🚫 Market in Correction (${corrReason}) — Avoid new purchases, get off margin, and raise cash. Wait for Day 1 off the bottom.`);
  } else if (ftdConfirmed && (inCorrection || ftdWeak)) {
    set('ftd-status', 'textContent', 'FTD ⚠ Weak');
    sty('ftd-status', 'color', 'var(--orange)');
    set('ftd-status-sub', 'textContent', 'FTD Day ' + rallyDay + ' confirmed — but breadth score ' + score + ' too weak to act');
    cls('ftd-status-cell', 'ftd-cell ftd-attempt');
    sty('ftd-banner', 'display', 'block');
    sty('ftd-banner', 'background', 'rgba(248,113,113,.07)');
    sty('ftd-banner', 'color', 'var(--orange)');
    sty('ftd-banner', 'border', '1px solid rgba(248,113,113,.2)');
    set('ftd-banner', 'textContent', '⚠ FTD confirmed on Day ' + rallyDay + ' but Breadth Score ' + score + ' is in Correction zone. Do NOT enter until score recovers above 35. Monitor leading stocks for breakouts.');
  } else if (ftdConfirmed) {
    const powerMsg = ftdPowerWindow ? '✅ FTD on Day ' + displayDay + ' (Days 3–7 Power Window) — Strong confirmation. Enter pilots if leading stocks break from base patterns on volume.' : '✅ FTD on Day ' + displayDay + ' — Rally confirmed. Pilot entries OK; verify with leading stock breakouts.';
    set('ftd-status', 'textContent', ftdPowerWindow ? 'CONFIRMED 🚀' : 'CONFIRMED ✅');
    sty('ftd-status', 'color', 'var(--lime)');
    set('ftd-status-sub', 'textContent', 'FTD Day ' + displayDay + ' (' + (latestFtd ? latestFtd.date : '') + (ftdPowerWindow ? ') — Power Window 🔥' : ') — Rally Valid'));
    cls('ftd-status-cell', 'ftd-cell ftd-detected');
    sty('ftd-banner', 'display', 'block');
    sty('ftd-banner', 'background', ftdPowerWindow ? 'rgba(74,222,128,.15)' : 'rgba(74,222,128,.10)');
    sty('ftd-banner', 'color', 'var(--lime)');
    sty('ftd-banner', 'border', '1px solid rgba(74,222,128,.3)');
    set('ftd-banner', 'textContent', powerMsg);
  } else if (status === 'watching') {
    const inPowerWindow = rallyDay >= FTD_MIN_DAY && rallyDay <= FTD_POWER_MAX;
    const bannerColor = inPowerWindow ? 'var(--teal)' : 'var(--yellow)';
    const bannerBg = inPowerWindow ? 'rgba(45,212,191,.08)' : 'rgba(250,204,21,.08)';
    const bannerBdr = inPowerWindow ? '1px solid rgba(45,212,191,.25)' : '1px solid rgba(250,204,21,.2)';
    const sub = rallyDay < FTD_MIN_DAY ? `Day ${rallyDay} of Attempt · FTD eligible on Day 3+ (>1.5% on vol↑)` : inPowerWindow ? `Day ${rallyDay} of Attempt · Power Window (Days 3–7) · Need close > 1.5% on higher vol` : `Day ${rallyDay} of Attempt · Watching for FTD (outside peak power window)`;
    const msg = rallyDay < FTD_MIN_DAY ? `⏳ Day ${rallyDay} of Attempt — Per O'Neil rules, Follow-Through Day eligibility begins on Day 3 or later.` : inPowerWindow ? `🎯 Day ${rallyDay} of Rally Attempt — Power Window (Days 3–7). Need Nifty 50 close > 1.5% on higher volume.` : `⏳ Rally Attempt Day ${rallyDay} — Waiting for FTD. Power window (Days 4–7) has passed; any FTD now carries less conviction.`;
    set('ftd-status', 'textContent', 'Pending');
    sty('ftd-status', 'color', bannerColor);
    set('ftd-status-sub', 'textContent', sub);
    cls('ftd-status-cell', 'ftd-cell ftd-attempt');
    sty('ftd-banner', 'display', 'block');
    sty('ftd-banner', 'background', bannerBg);
    sty('ftd-banner', 'color', bannerColor);
    sty('ftd-banner', 'border', bannerBdr);
    set('ftd-banner', 'textContent', msg);
  } else {
    set('ftd-status', 'textContent', 'No Attempt');
    sty('ftd-status', 'color', 'var(--dim)');
    set('ftd-status-sub', 'textContent', 'Market in correction — wait for Day 1 of rally attempt');
    cls('ftd-status-cell', 'ftd-cell');
    sty('ftd-banner', 'display', 'none');
  }
  sty('ftd-log-wrap', 'display', 'block');
  const typeLabel = { attempt: 'Rally Day 1', followthrough: 'Follow-Through ✅', distribution: 'Distribution', void: '⚠ Voided (Undercut)' };
  const typeColor = { attempt: 'var(--yellow)', followthrough: 'var(--lime)', distribution: 'var(--red)', void: 'var(--red)' };
  const logEl = el('ftd-log');
  const existingRows = logEl.querySelectorAll ? logEl.querySelectorAll('.ftd-data-row') : [];
  existingRows.forEach(r => r.remove());
  const rowsHtml = days.slice(0, 15).map(d => {
    const isVoid = d.type === 'void';
    const autoTag = d.auto ? '<span style="font-size:9px;color:var(--dim);margin-left:4px">auto</span>' : '';
    return `<div class="ftd-row ftd-data-row" style="${isVoid ? 'opacity:.5;' : ''}">
      <span style="color:var(--sub)">${d.date}</span>
      <span style="color:${typeColor[d.type] || 'var(--sub)'};font-weight:600;${isVoid ? 'text-decoration:line-through' : ''}">${typeLabel[d.type] || d.type}${autoTag}</span>
      <span style="font-family:var(--mono)">${d.close || '—'}</span>
      <span style="color:${d.movePct >= 1.5 ? 'var(--lime)' : d.movePct < 0 ? 'var(--red)' : 'var(--sub)'}">${d.movePct !== undefined ? (d.movePct > 0 ? '+' : '') + d.movePct + '%' : '—'}</span>
      <span style="color:${d.volUp ? 'var(--lime)' : 'var(--dim)'}">${d.volUp ? '↑ Yes' : '— No'}</span>
    </div>`;
  }).join('');
  if (logEl.insertAdjacentHTML) { logEl.insertAdjacentHTML('beforeend', rowsHtml); } else { logEl.innerHTML += rowsHtml; }
}
function ddcRender() {
  const el = id => document.getElementById(id) || { textContent: '', innerHTML: '', style: {}, className: '', classList: { add: () => { }, remove: () => { }, contains: () => false }, value: '', offsetWidth: 0, offsetHeight: 0, getBoundingClientRect: () => ({ width: 0, height: 0, top: 0, left: 0, right: 0, bottom: 0 }) }; if (!el('ddc-count')) return; const days = mpmLoad().slice(0, 25); if (!days.length) { el('ddc-count').textContent = '—'; el('ddc-count').style.color = 'var(--dim)'; el('ddc-status').textContent = '—'; el('ddc-net').textContent = '—'; el('ddc-acc').textContent = '—'; el('ddc-gauge').innerHTML = ''; return; }
  const ftdDays = ftdLoad(); const voidIdx = ftdDays.findIndex(d => d.type === 'void'); const activeDays = voidIdx >= 0 ? ftdDays.slice(0, voidIdx) : ftdDays; const attempts = activeDays.filter(d => d.type === 'attempt'); const ftds = activeDays.filter(d => d.type === 'followthrough'); const attemptDate = attempts.length ? attempts[0].date : (ftds.length ? ftds[0].date : null); if (!attemptDate) { el('ddc-count').textContent = '0'; el('ddc-count').style.color = 'var(--dim)'; el('ddc-status').textContent = 'Reset (Correction)'; el('ddc-status').style.color = 'var(--dim)'; el('ddc-net').textContent = '—'; el('ddc-acc').textContent = '0'; el('ddc-hint').textContent = 'Count resets to 0 during Correction'; el('ddc-gauge').innerHTML = ''; return; }
  const dist = countDistributionDays(mpmLoad(), attemptDate); const acc = days.filter(d => d.dtype === 'acc' && d.date >= attemptDate).length; const net = acc - dist; el('ddc-count').textContent = dist; el('ddc-acc').textContent = acc; el('ddc-net').textContent = (net >= 0 ? '+' : '') + net; el('ddc-net').style.color = net >= 3 ? 'var(--lime)' : net >= 0 ? 'var(--yellow)' : 'var(--red)'; let status, hint, color; if (dist >= 6) { status = '⚠ Heavy Distribution'; color = 'var(--red)'; hint = dist + ' distribution days — historically precedes corrections. Reduce exposure, tighten stops.'; } else if (dist >= 4) { status = 'Elevated Distribution'; color = 'var(--orange)'; hint = dist + ' distribution days — caution warranted. Avoid adding new positions.'; } else if (dist <= 1 && acc >= 4) { status = 'Accumulation Phase'; color = 'var(--lime)'; hint = 'Low distribution, strong accumulation. Institutions are buying. Favourable for breakouts.'; } else { status = 'Normal'; color = 'var(--sub)'; hint = 'Distribution within normal range. Monitor for clustering of dist days.'; }
  el('ddc-count').style.color = color; el('ddc-status').textContent = status; el('ddc-status').style.color = color; el('ddc-hint').textContent = hint; const last10 = [...days].sort((a, b) => a.date.localeCompare(b.date)).slice(-10); el('ddc-gauge').innerHTML = last10.map(d => { const c = d.dtype === 'dist' ? '#f87171' : d.dtype === 'acc' ? '#4ade80' : '#4a5e76'; const h = d.dtype === 'neutral' ? 6 : 24; return `<div class="ddc-bar-w"><div class="ddc-bar-b" style="background:${c};height:${h}px"></div><div class="ddc-bar-n">${d.dtype === 'dist' ? 'D' : d.dtype === 'acc' ? 'A' : 'N'}</div></div>`; }).join('');
}
function nhnlRender(data) {
  const el = id => document.getElementById(id) || { textContent: '', innerHTML: '', style: {}, className: '', classList: { add: () => { }, remove: () => { }, contains: () => false }, value: '', offsetWidth: 0, offsetHeight: 0, getBoundingClientRect: () => ({ width: 0, height: 0, top: 0, left: 0, right: 0, bottom: 0 }) }; if (!el('nhnl-today') || !data.length) {
    if (el('nhnl-today')) { el('nhnl-today').textContent = '—'; el('nhnl-5d').textContent = '—'; el('nhnl-10d').textContent = '—'; el('nhnl-trend').textContent = '—'; el('nhnl-bars').innerHTML = ''; }
    return;
  }
  function hlRatio(r) { const hi = +r.hi || 0, lo = +r.lo || 0; return (hi + lo) > 0 ? hi / (hi + lo) : null; }
  const today = hlRatio(data[0]); const todayPct = today !== null ? Math.round(today * 100) : null; el('nhnl-today').textContent = todayPct !== null ? todayPct + '%' : '—'; el('nhnl-today').style.color = todayPct === null ? 'var(--dim)' : todayPct >= 60 ? 'var(--lime)' : todayPct >= 40 ? 'var(--yellow)' : 'var(--red)'; let sig = '—', sigColor = 'var(--dim)'; if (todayPct !== null) {
    if (todayPct >= 70) { sig = '🟢 Strongly Bullish'; sigColor = 'var(--lime)'; }
    else if (todayPct >= 55) { sig = '↑ Bullish'; sigColor = 'var(--lime)'; }
    else if (todayPct >= 40) { sig = '→ Neutral'; sigColor = 'var(--yellow)'; }
    else if (todayPct >= 25) { sig = '↓ Bearish'; sigColor = 'var(--orange)'; }
    else { sig = '🔴 Strongly Bearish'; sigColor = 'var(--red)'; }
  }
  el('nhnl-signal').textContent = sig; el('nhnl-signal').style.color = sigColor; const ratios5 = data.slice(0, 5).map(hlRatio).filter(v => v !== null); const avg5 = ratios5.length ? Math.round(ratios5.reduce((a, b) => a + b, 0) / ratios5.length * 100) : null; el('nhnl-5d').textContent = avg5 !== null ? avg5 + '%' : '—'; el('nhnl-5d').style.color = avg5 === null ? 'var(--dim)' : avg5 >= 55 ? 'var(--lime)' : avg5 >= 40 ? 'var(--yellow)' : 'var(--red)'; const ratios10 = data.slice(0, 10).map(hlRatio).filter(v => v !== null); const avg10 = ratios10.length ? Math.round(ratios10.reduce((a, b) => a + b, 0) / ratios10.length * 100) : null; el('nhnl-10d').textContent = avg10 !== null ? avg10 + '%' : '—'; el('nhnl-10d').style.color = 'var(--sub)'; if (avg5 !== null && avg10 !== null) { const diff = avg5 - avg10; const trendSymbol = diff >= 5 ? '↑↑' : diff >= 0 ? '↑' : diff >= -5 ? '↓' : '↓↓'; const trendColor = diff >= 3 ? 'var(--lime)' : diff >= 0 ? 'var(--yellow)' : 'var(--red)'; el('nhnl-trend').textContent = trendSymbol; el('nhnl-trend').style.color = trendColor; el('nhnl-trend-sig').textContent = (diff >= 0 ? '+' : '') + diff + 'pp — ' + (diff >= 3 ? 'Expanding' : diff >= 0 ? 'Stable' : 'Contracting'); el('nhnl-trend-sig').style.color = trendColor; } else { el('nhnl-trend').textContent = '—'; el('nhnl-trend-sig').textContent = 'Need 5+ entries'; }
  const bars = data.slice(0, 10).reverse(); el('nhnl-bars').innerHTML = bars.map(r => { const ratio = hlRatio(r); const h = ratio !== null ? Math.max(3, Math.round(ratio * 28)) : 3; const c = ratio === null ? 'var(--dim)' : ratio >= 0.6 ? '#4ade80' : ratio >= 0.4 ? '#fbbf24' : '#f87171'; return `<div class="nhnl-bar" style="background:${c};height:${h}px;flex:1"></div>`; }).join('');
}
function renderMarketSummary() {
  const _dummy = { textContent: '', innerHTML: '', style: {} }; const el = id => document.getElementById(id) || _dummy; if (!document.getElementById('msem-phase')) return; const records = loadLocal(); const mpmDays = mpmLoad().slice(0, 25); const bsrTrades = bsrLoad(); const ftdDays = ftdLoad(); if (!records.length) { el('msem-phase').textContent = '—'; el('msem-phase').style.color = 'var(--dim)'; el('msem-summary').textContent = 'Save your first EOD entry to generate market summary.'; el('msem-guidance').innerHTML = '<li>No data yet</li>'; el('msem-risk').innerHTML = '—'; el('msem-exp-pct').textContent = '—'; el('msem-exp-range').textContent = '—'; el('msem-exp-note').textContent = 'Save EOD data to calculate exposure.'; el('msem-exp-fill').style.width = '0%'; return; }
  const r = records[0]; const prev = records[1] || {}; const score = r.score || 0; const momentum = (r.score && prev.score) ? r.score - prev.score : null; const mpmAcc = mpmDays.filter(d => d.dtype === 'acc').length; const mpmDist = mpmDays.filter(d => d.dtype === 'dist').length; const mpmScore = mpmDays.length ? mpmAcc - mpmDist : null; const voidIdx = ftdDays.findIndex(d => d.type === 'void'); const activeDays = voidIdx >= 0 ? ftdDays.slice(0, voidIdx) : ftdDays; const attempts = activeDays.filter(d => d.type === 'attempt'); const ftds = activeDays.filter(d => d.type === 'followthrough'); const attemptDate = attempts.length ? attempts[0].date : (ftds.length ? ftds[0].date : null); const distCount = countDistributionDays(mpmLoad(), attemptDate); const bsrStats = bsrGetEffectiveStats(); const bsrSucc = bsrStats.succ; const bsrFail = bsrStats.fail; const bsrPct = bsrStats.pct; const hasFTD = ftdDays.some(d => d.type === 'followthrough'); const hasAttempt = ftdDays.some(d => d.type === 'attempt'); const condState = computeMarketCondition(); let phase = '—', phaseColor = 'var(--dim)'; if (condState) { phase = condState.condition; phaseColor = condState.color; }
  el('msem-phase').textContent = phase; el('msem-phase').style.color = phaseColor; if (el('msem-updated') && records.length) { el('msem-updated').textContent = 'As of ' + fmtLong(r.date); }
  const summaryParts = []; const hlVal = r.hlRatio !== undefined ? Math.round(r.hlRatio * 100) : null; const ema20 = r.ema20 !== undefined ? Math.round(r.ema20) : null; const sma50 = r.sma50 !== undefined ? Math.round(r.sma50) : null; if (score >= 55) { summaryParts.push(`Breadth Score ${score} — Healthy Bull. Strong participation: most Nifty 500 stocks above short and medium MAs.`); } else if (score >= 45) { summaryParts.push(`Breadth Score ${score} — Expansion. Participation is improving; majority above EMA20 and SMA50.`); } else if (score >= 35) { summaryParts.push(`Breadth Score ${score} — Caution zone. Participation is mixed; market is healing but not confirmed.`); } else if (score >= 20) { summaryParts.push(`Breadth Score ${score} — Correction. Broad weakness across Nifty 500; most stocks below key MAs.`); } else { summaryParts.push(`Breadth Score ${score} — Deep Correction. Widespread selling; stand aside.`); }
  if (momentum !== null) { const mSign = momentum >= 0 ? '+' : ''; if (Math.abs(momentum) >= 10) summaryParts.push(`Breadth momentum ${mSign}${momentum} pts (day-over-day) — sharp ${momentum > 0 ? 'expansion' : 'deterioration'}, act accordingly.`); else if (Math.abs(momentum) >= 3) summaryParts.push(`Momentum ${mSign}${momentum} pts — gradual ${momentum > 0 ? 'improvement' : 'weakening'}.`); else if (momentum === 0) summaryParts.push('Momentum flat — no directional change; wait for conviction.'); else summaryParts.push(`Momentum ${mSign}${momentum} pts — minor ${momentum > 0 ? 'uptick' : 'drift lower'}; watch for follow-through.`); }
  if (mpmScore !== null) { if (mpmScore >= 4) summaryParts.push(`MPM +${mpmScore}: institutions accumulating — volume confirms buying interest. Institutional backdrop is supportive.`); else if (mpmScore >= 1) summaryParts.push(`MPM +${mpmScore}: mild accumulation. Institutions leaning bullish but not yet decisive.`); else if (mpmScore === 0) summaryParts.push('MPM 0: accumulation and distribution balanced. Institutions are sidelined — wait for tilt.'); else summaryParts.push(`MPM ${mpmScore}: distribution exceeds accumulation. Institutions are selling; do not fight the tape.`); }
  if (ema20 !== null && sma50 !== null) { summaryParts.push(`${ema20}% of stocks above EMA20, ${sma50}% above SMA50${hlVal !== null ? `,H/L ratio ${hlVal}%` : ''}.`); }
  if (hasFTD) { summaryParts.push('Follow-Through Day confirmed ✓ — O\'Neil uptrend signal active. Breakout entries are justified.'); } else if (hasAttempt) { summaryParts.push('Rally attempt underway — no FTD yet. Wait for Day 4+ move of ≥1.5% on rising volume before adding exposure.'); } else if (score < 35) { summaryParts.push('No rally attempt logged. Market showing no base-building signs yet.'); }
  el('msem-summary').textContent = summaryParts.join(' '); const guidance = []; const bearDiv = false; const bullDiv = false; const tcEl = document.getElementById('pet-total-capital'); const ivEl = document.getElementById('pet-invested'); const tc = tcEl ? parseFloat(tcEl.value || 0) : 0; const iv = ivEl ? parseFloat(ivEl.value || 0) : 0; if (bearDiv) { guidance.push({ text: '⛔ Bearish divergence active — no new longs today regardless of score', cls: 'bad' }); }
  if (score < 30) { guidance.push({ text: `Score ${score} — Stand aside. Capital preservation only`, cls: 'bad' }); guidance.push({ text: 'Close weakest positions; raise cash above 70%', cls: 'bad' }); guidance.push({ text: 'No new entries until score recovers above 35', cls: 'warn' }); } else if (score < 40) { guidance.push({ text: `Score ${score} — Pilot mode: max 0.25R per trade, 1–2 positions only`, cls: 'warn' }); guidance.push({ text: 'Only stocks with RS > 90 qualify for entry', cls: '' }); if (!hasFTD) guidance.push({ text: 'Wait for FTD confirmation before adding any exposure', cls: 'warn' }); if (hasFTD) guidance.push({ text: 'FTD logged ✓ — pilot entries permitted, keep size tight', cls: 'good' }); } else if (score < 50) { guidance.push({ text: `Score ${score} — Selective: 0.5–1R per trade, max 3 concurrent positions`, cls: '' }); guidance.push({ text: 'Target early-stage Stage 2 bases only; no extended stocks', cls: 'good' }); guidance.push({ text: 'Use tight stops 5–7% from pivot; do not give back gains', cls: 'warn' }); if (hasFTD) guidance.push({ text: 'FTD confirmed ✓ — scale up gradually as positions prove', cls: 'good' }); else guidance.push({ text: 'No FTD yet — size half until confirmation arrives', cls: 'warn' }); } else if (score < 60) { guidance.push({ text: `Score ${score} — Normal: 1–2R per trade, standard stop 7–8% from pivot`, cls: 'good' }); guidance.push({ text: 'Act on clean breakouts from flat/cup bases; confirm volume', cls: 'good' }); guidance.push({ text: 'Add to winners on follow-through days; trim laggards', cls: '' }); } else { guidance.push({ text: `Score ${score} — Aggressive: 2–3R per trade, let leaders run`, cls: 'good' }); guidance.push({ text: 'Trail stops; buy pullbacks to 21-EMA in leading stocks', cls: 'good' }); guidance.push({ text: 'New breakouts have high follow-through probability — act decisively', cls: 'good' }); }
  if (mpmScore !== null) { if (mpmScore <= -3) { guidance.push({ text: `MPM ${mpmScore} — distribution dominates, reduce all adds until MPM turns positive`, cls: 'bad' }); } else if (mpmScore >= 4) { guidance.push({ text: `MPM +${mpmScore} — strong accumulation, institutional backdrop supports entries`, cls: 'good' }); } }
  if (bsrPct !== null && bsrPct < 40) { guidance.push({ text: `BSR ${bsrPct}% — breakouts failing >60% of the time. Skip breakout chasing, wait for BSR > 50%`, cls: 'bad' }); } else if (bsrPct !== null && bsrPct >= 65) { guidance.push({ text: `BSR ${bsrPct}% — breakout environment healthy. Setups meeting your criteria should be actioned`, cls: 'good' }); }
  if (bullDiv) { guidance.push({ text: '✦ Bullish divergence — breadth improving faster than price; watch for reversal entries', cls: '' }); }
  if (condState && condState.condition === 'Uptrend Under Pressure') {
    guidance.unshift({ text: '⚠️ Uptrend Under Pressure — exercise caution; keep buying decisions reserved to fundamentally strong stocks showing technical strength', cls: 'warn' });
  }
  el('msem-guidance').innerHTML = guidance.map(g => `<li class="${g.cls}">${g.text}</li>`).join(''); const risks = []; if (distCount >= 5) { risks.push({ color: 'var(--red)', text: `<strong>${distCount} distribution days</strong> in last 25 sessions — institutional selling pressure is elevated. Major index generally goes into Correction. Avoid new purchases, get off margin, and raise cash.` }); } else if (distCount >= 3) { risks.push({ color: 'var(--yellow)', text: `<strong>${distCount} distribution days</strong> in 5 weeks (Uptrend Under Pressure) — index showing signs of deterioration. Exercise caution; keep buying decisions reserved to fundamentally strong stocks showing technical strength.` }); } else if (distCount <= 2 && mpmDays.length >= 10) { risks.push({ color: 'var(--lime)', text: `Only <strong>${distCount} distribution days</strong> in 25 sessions — institutional pressure is low. Market conditions stabilising.` }); } else { risks.push({ color: 'var(--sub)', text: `<strong>${distCount} distribution days</strong> in last 25 sessions — within normal range.` }); }
  if (mpmScore !== null) { if (mpmScore < 0) { risks.push({ color: 'var(--orange)', text: `Market Pressure <strong>${mpmScore}</strong> — distribution is dominating accumulation. Market risk remains elevated. Do not fight the tape.` }); } else if (mpmScore >= 3) { risks.push({ color: 'var(--lime)', text: `Market Pressure <strong>+${mpmScore}</strong> — accumulation is improving. Institutional participation increasing. Favourable backdrop.` }); } else { risks.push({ color: 'var(--sub)', text: `Market Pressure <strong>+${mpmScore}</strong> — accumulation slightly ahead of distribution. Monitor for improvement.` }); } } else { risks.push({ color: 'var(--dim)', text: 'Add MPM entries to see institutional pressure analysis.' }); }
  if (bsrPct !== null) { if (bsrPct < 40) { risks.push({ color: 'var(--red)', text: `BSR ${bsrPct}% — breakouts are <strong>failing more than succeeding</strong>. This is not a breakout market. Avoid chasing.` }); } else if (bsrPct >= 65) { risks.push({ color: 'var(--lime)', text: `BSR ${bsrPct}% — breakouts are working well. Market environment supports momentum entries.` }); } }
  if (!hasFTD && score >= 35) { risks.push({ color: 'var(--yellow)', text: 'No Follow-Through Day confirmed. Per O\u2019Neil method, new uptrend is <strong>unconfirmed</strong>. Size accordingly.' }); }
  if (bearDiv) { risks.push({ color: 'var(--orange)', text: '<strong>Bearish Breadth Divergence active</strong> — Nifty is rising but Breadth Score is falling. Hidden weakness. Reduce exposure, tighten stops.' }); } else if (bullDiv) { risks.push({ color: 'var(--teal)', text: '<strong>Bullish Breadth Divergence active</strong> — Nifty is falling but Breadth Score is rising. Hidden strength. Watch for reversal entry.' }); }
  let baseExposure = 0; if (score < 30) baseExposure = 5; else if (score < 40) baseExposure = 17; else if (score < 50) baseExposure = 37; else if (score < 60) baseExposure = 62; else baseExposure = 87; if (mpmScore !== null) { if (mpmScore >= 4) baseExposure += 8; else if (mpmScore >= 1) baseExposure += 4; else if (mpmScore < 0) baseExposure -= 8; }
  if (distCount >= 6) baseExposure -= 10; else if (distCount >= 4) baseExposure -= 5; else if (distCount <= 1) baseExposure += 5; if (hasFTD) baseExposure += 5; const exposure = Math.min(100, Math.max(0, Math.round(baseExposure)));
  if (tc > 0 && iv > 0) { const sugInr = tc * exposure / 100; const gap = sugInr - iv; const actualPct = (iv / tc) * 100; const diff = actualPct - exposure; if (diff > 15) { risks.push({ color: 'var(--red)', text: `<strong>Personal Exposure alert</strong>: You are ${Math.round(diff)}% over-deployed vs market-suggested ceiling (${petFmtInr(iv)} invested vs ${petFmtInr(sugInr)} suggested). Reduce positions to manage risk.` }); } else if (diff > 5) { risks.push({ color: 'var(--orange)', text: `<strong>Slightly over-deployed</strong>: ${petFmtInr(iv)} invested vs ${petFmtInr(sugInr)} suggested for current conditions. Monitor and trim on weakness.` }); } else if (gap > 0 && gap > tc * 0.10) { risks.push({ color: 'var(--lime)', text: `<strong>Exposure headroom: ${petFmtInr(gap)}</strong> available within current market ceiling. New setups meeting your criteria can be considered.` }); } }
  el('msem-risk').innerHTML = risks.map(r => `<div class="msem-risk-item"><div class="msem-risk-dot" style="background:${r.color}"></div><div class="msem-risk" style="color:var(--text)">${r.text}</div></div>`).join('');
  let expRange, expNote, expColor; if (exposure <= 10) { expRange = '0 – 10%'; expNote = 'Capital preservation mode. No new swing trades.'; expColor = 'var(--red)'; } else if (exposure <= 25) { expRange = '10 – 25%'; expNote = 'Pilot entries only (0.25R). Highest RS stocks only.'; expColor = 'var(--orange)'; } else if (exposure <= 50) { expRange = '25 – 50%'; expNote = 'Selective entries at 0.5–1R. Confirm each position before adding.'; expColor = 'var(--yellow)'; } else if (exposure <= 75) { expRange = '50 – 75%'; expNote = 'Normal position sizing. Breakouts should be actioned.'; expColor = 'var(--green)'; } else { expRange = '75 – 100%'; expNote = 'Healthy bull market. Full position sizing. Let winners run.'; expColor = 'var(--lime)'; }
  el('msem-exp-pct').textContent = exposure + '%'; el('msem-exp-pct').style.color = expColor; el('msem-exp-range').textContent = 'Range: ' + expRange; el('msem-exp-note').textContent = expNote; el('msem-exp-fill').style.width = exposure + '%'; el('msem-exp-fill').style.background = expColor;
}
function petFmtInr(val) { if (val >= 100000) return '₹' + (val / 100000).toFixed(2) + 'L'; if (val >= 1000) return '₹' + (val / 1000).toFixed(1) + 'K'; return '₹' + Math.round(val); }
function petLoad() { try { return JSON.parse(localStorage.getItem('pet_capital') || '{}'); } catch (e) { return {}; } }
function petSave() {
  const tc = parseFloat(document.getElementById('pet-total-capital')?.value || 0); const iv = parseFloat(document.getElementById('pet-invested')?.value || 0); localStorage.setItem('pet_capital', JSON.stringify({ totalCapital: tc, invested: iv })); const note = document.getElementById('pet-saved-note'); if (note) { note.textContent = '✓ Saved'; setTimeout(() => { note.textContent = ''; }, 2000); }
  petUpdate();
}
function petUpdate() {
  const tc = parseFloat(document.getElementById('pet-total-capital')?.value || 0) || 0; const iv = parseFloat(document.getElementById('pet-invested')?.value || 0) || 0; const expPctEl = document.getElementById('msem-exp-pct'); const expPct = expPctEl ? parseFloat(expPctEl.textContent) : NaN; const sugInrEl = document.getElementById('pet-suggested-inr'); const invInrEl = document.getElementById('pet-invested-inr'); const gapInrEl = document.getElementById('pet-gap-inr'); const bannerEl = document.getElementById('pet-status-banner'); if (!sugInrEl) return; if (!tc) { sugInrEl.textContent = 'Enter capital'; invInrEl.textContent = '—'; gapInrEl.textContent = '—'; if (bannerEl) bannerEl.style.display = 'none'; return; }
  invInrEl.textContent = petFmtInr(iv); if (isNaN(expPct)) { sugInrEl.textContent = '—'; gapInrEl.textContent = '—'; if (bannerEl) bannerEl.style.display = 'none'; return; }
  const sugInr = tc * expPct / 100; const gap = sugInr - iv; sugInrEl.textContent = petFmtInr(sugInr); gapInrEl.textContent = (gap >= 0 ? '+' : '') + petFmtInr(Math.abs(gap)); gapInrEl.style.color = gap >= 0 ? 'var(--lime)' : 'var(--red)'; if (bannerEl) {
    bannerEl.style.display = 'block'; const actualPct = tc > 0 ? (iv / tc * 100) : 0; const diff = actualPct - expPct; let msg, bg, color; if (diff > 15) { msg = `⚠ Overexposed by ${Math.abs(Math.round(diff))}% — You are deployed ${petFmtInr(iv)} vs suggested ${petFmtInr(sugInr)}. Consider reducing ${petFmtInr(Math.abs(gap))} to align with market conditions.`; bg = 'rgba(248,113,113,.08)'; color = 'var(--red)'; } else if (diff > 5) { msg = `↑ Slightly overexposed (${Math.round(diff)}% above suggested). Monitor closely — tighten stops on weaker positions.`; bg = 'rgba(251,146,60,.08)'; color = 'var(--orange)'; } else if (diff < -20) { msg = `→ Under-deployed by ${petFmtInr(Math.abs(gap))}. Market environment supports more exposure — consider new setups.`; bg = 'rgba(74,222,128,.08)'; color = 'var(--lime)'; } else { msg = `✓ Exposure aligned. ${petFmtInr(iv)} deployed vs ${petFmtInr(sugInr)} suggested (${Math.round(expPct)}%). On track.`; bg = 'rgba(52,211,153,.08)'; color = 'var(--green)'; }
    bannerEl.textContent = msg; bannerEl.style.background = bg; bannerEl.style.color = color; const borderMap = { 'var(--red)': 'rgba(248,113,113,.25)', 'var(--orange)': 'rgba(251,146,60,.25)', 'var(--lime)': 'rgba(74,222,128,.25)', 'var(--green)': 'rgba(52,211,153,.25)', 'var(--yellow)': 'rgba(250,204,21,.25)' }; bannerEl.style.border = '1px solid ' + (borderMap[color] || 'rgba(91,163,245,.25)');
  }
}
function petInit() { const d = petLoad(); const tcEl = document.getElementById('pet-total-capital'); const ivEl = document.getElementById('pet-invested'); if (tcEl && d.totalCapital) tcEl.value = d.totalCapital; if (ivEl && d.invested) ivEl.value = d.invested; petUpdate(); }
function renderRPG() {
  const _safeEl = id => document.getElementById(id) || { textContent: '', innerHTML: '', style: {} }; const arcEl = document.getElementById('ss-rpg-arc'); const pctEl = document.getElementById('ss-rpg-pct'); const sigEl = document.getElementById('ss-rpg-signal'); const brkEl = document.getElementById('ss-rpg-bk'); if (!arcEl) return; const records = loadLocal(); const mpmDays = mpmLoad().slice(0, 25); const bsrTrades = bsrLoad(); const ftdDays = ftdLoad(); if (!records.length) { pctEl.textContent = '—'; sigEl.textContent = 'No Data'; sigEl.style.color = 'var(--dim)'; if (brkEl) brkEl.innerHTML = ''; arcEl.style.strokeDashoffset = '94.2'; return; }
  const r = records[0]; const prev = records[1] || {}; const score = r.score || 0; const momentum = (r.score && prev.score) ? r.score - prev.score : 0; const r3 = records[3] || {}; const thrust = r3.score ? score - r3.score : momentum; const mpmAcc = mpmDays.filter(d => d.dtype === 'acc').length; const mpmDist = mpmDays.filter(d => d.dtype === 'dist').length; const mpmScore = mpmDays.length ? mpmAcc - mpmDist : null; const distCount = mpmDist; const bsrStats = bsrGetEffectiveStats(); const bsrSucc = bsrStats.succ; const bsrFail = bsrStats.fail; const bsrPct = bsrStats.pct; const hasFTD = ftdDays.some(d => d.type === 'followthrough'); const components = []; const c1 = score > 45 ? 20 : score > 35 ? 10 : score > 25 ? 5 : 0; components.push({ lbl: 'Breadth Score', pts: c1, max: 20, earned: score > 45 }); const c2 = momentum > 5 ? 15 : momentum > 0 ? 8 : momentum === 0 ? 3 : 0; components.push({ lbl: 'Momentum', pts: c2, max: 15, earned: momentum > 0 }); const c3 = thrust > 10 ? 15 : thrust > 5 ? 8 : thrust > 0 ? 4 : 0; components.push({ lbl: 'Thrust', pts: c3, max: 15, earned: thrust > 5 }); let bsrMax = 20; let c4 = 0; let bsrNote = ''; if (bsrPct !== null) { c4 = bsrPct >= 65 ? 20 : bsrPct >= 50 ? 12 : bsrPct >= 35 ? 6 : 0; components.push({ lbl: 'BSR ' + bsrPct + '%', pts: c4, max: 20, earned: bsrPct >= 50 }); } else { bsrMax = 0; bsrNote = 'BSR: no trades (redistributed)'; components.push({ lbl: 'BSR (no trades)', pts: 0, max: 0, earned: false, dim: true }); }
  const c5 = distCount <= 2 ? 15 : distCount <= 4 ? 10 : distCount <= 6 ? 4 : 0; components.push({ lbl: 'Dist Days ' + distCount, pts: c5, max: 15, earned: distCount <= 4 }); const c6 = mpmScore === null ? 0 : mpmScore >= 4 ? 15 : mpmScore >= 1 ? 10 : mpmScore === 0 ? 5 : 0; components.push({ lbl: 'Pressure ' + (mpmScore !== null ? (mpmScore > 0 ? '+' : '') + mpmScore : '—'), pts: c6, max: 15, earned: mpmScore !== null && mpmScore >= 0 }); let raw = c1 + c2 + c3 + c4 + c5 + c6; const effectiveMax = 100 - bsrMax; let pct = effectiveMax > 0 ? Math.round(raw / effectiveMax * 100) : 0; let ftdBonus = 0; if (hasFTD) { ftdBonus = 10; pct = Math.min(100, pct + 10); }
  pct = Math.min(100, Math.max(0, pct)); let signal, color; if (pct >= 85) { signal = 'Very High'; color = 'var(--lime)'; }
  else if (pct >= 70) { signal = 'High'; color = 'var(--green)'; }
  else if (pct >= 50) { signal = 'Moderate'; color = 'var(--yellow)'; }
  else if (pct >= 30) { signal = 'Low'; color = 'var(--orange)'; }
  else { signal = 'Very Low'; color = 'var(--red)'; }
  const asExpPct = document.getElementById('as-exp-pct'); const asExpFill = document.getElementById('as-exp-fill'); const asExpLabel = document.getElementById('as-exp-label'); const asExpRange = document.getElementById('as-exp-range'); const asExpNote = document.getElementById('as-exp-note'); const _score2 = records.length ? records[0].score || 0 : 0; let _exp = _score2 < 30 ? 5 : _score2 < 40 ? 17 : _score2 < 50 ? 37 : _score2 < 60 ? 62 : 87; if (mpmScore !== null) { if (mpmScore >= 4) _exp += 8; else if (mpmScore >= 1) _exp += 4; else if (mpmScore < 0) _exp -= 8; }
  if (distCount >= 6) _exp -= 10; else if (distCount >= 4) _exp -= 5; else if (distCount <= 1) _exp += 5; if (hasFTD) _exp += 5; _exp = Math.min(100, Math.max(0, Math.round(_exp))); const _expColor = _exp <= 10 ? 'var(--red)' : _exp <= 25 ? 'var(--orange)' : _exp <= 50 ? 'var(--yellow)' : _exp <= 75 ? 'var(--green)' : 'var(--lime)'; const _expNote = _exp <= 10 ? 'Capital preservation' : _exp <= 25 ? 'Pilot entries only' : _exp <= 50 ? 'Selective entries' : _exp <= 75 ? 'Normal sizing' : 'Full sizing'; if (asExpPct) { asExpPct.textContent = _exp + '%'; asExpPct.style.color = _expColor; }
  if (asExpFill) { asExpFill.style.width = _exp + '%'; asExpFill.style.background = _expColor; }
  if (asExpLabel) { asExpLabel.textContent = ''; }
  if (asExpRange) { asExpRange.textContent = ''; }
  if (asExpNote) { asExpNote.textContent = ''; }
  const arcLen = 94.2; const offset = arcLen * (1 - pct / 100); if (arcEl) { arcEl.style.strokeDashoffset = offset.toFixed(1); arcEl.style.stroke = color; }
  if (pctEl) { pctEl.textContent = pct + '%'; pctEl.style.fill = color; }
  if (sigEl) { sigEl.textContent = signal; sigEl.style.color = color; }
  const visible = components.filter(c => c.max > 0); if (brkEl) { const top3 = visible.slice(0, 3).map(c => `${c.lbl.split(' ')[0]} ${c.pts}/${c.max}`).join(' · '); brkEl.textContent = top3 + (ftdBonus ? ' · FTD +10' : ''); }
  if (brkEl) brkEl.innerHTML = visible.map(c => {
    const barW = c.max > 0 ? Math.round(c.pts / c.max * 100) : 0; const clr = c.earned ? color : 'var(--dim)'; return `<div class="rpg-row">
      <span class="rpg-row-lbl">${c.lbl}</span>
      <span class="rpg-row-pts" style="color:${clr}">${c.pts}/${c.max}</span>
    </div>`;
  }).join(''); if (ftdBonus) {
    brkEl.innerHTML += `<div class="rpg-row">
      <span class="rpg-row-lbl" style="color:var(--lime)">FTD Bonus</span>
      <span class="rpg-row-pts" style="color:var(--lime)">+${ftdBonus}</span>
    </div>`;
  }
  if (bsrNote) { brkEl.innerHTML += `<div style="font-size:8px;color:var(--dim);margin-top:3px">${bsrNote}</div>`; }
}
function renderAll() { const data = loadLocal(); const safe = (fn, name) => { try { fn(); } catch (e) { console.warn('[renderAll] ' + name + ' failed:', e.message); } }; safe(() => renderHero(data), 'renderHero'); safe(() => renderMarketCycle(), 'renderMarketCycle'); safe(() => renderAnalysisFTD(), 'renderAnalysisFTD'); safe(() => renderRPG(), 'renderRPG'); safe(() => renderMarketSummary(), 'renderMarketSummary'); safe(() => petInit(), 'petInit'); safe(() => ftdRender(), 'ftdRender'); safe(() => ddcRender(), 'ddcRender'); safe(() => renderSnapshot(data), 'renderSnapshot'); safe(() => renderHistory(data), 'renderHistory'); safe(() => bsrRenderAll(), 'bsrRenderAll'); safe(() => mpmRenderAll(), 'mpmRenderAll'); safe(() => srtRender(), 'srtRender'); safe(() => slhRender(), 'slhRender'); safe(() => vcpbInit(), 'vcpbInit'); safe(() => brrgRebuildChips(), 'brrgRebuildChips'); safe(() => brrgDraw(), 'brrgDraw'); safe(() => capitalInputInit(), 'capitalInputInit'); renderChart(data); }
async function seedHistoricalData() {
  if (loadLocal().length > 0) return; const seedData = [{ date: '2026-03-12', adv: 312, dec: 174, unc: 14, hi: 28, lo: 6, e20: 54, s50: 42, s200: 38, nifty: 0, notes: 'ET seed' }, { date: '2026-03-11', adv: 425, dec: 75, unc: 0, hi: 0, lo: 0, e20: 39, s50: 35, s200: 37, nifty: 22342.95, notes: 'ET seed' }, { date: '2026-03-10', adv: 425, dec: 75, unc: 0, hi: 0, lo: 0, e20: 28, s50: 31, s200: 37, nifty: 22342.95, notes: 'ET seed' }, { date: '2026-03-06', adv: 170, dec: 330, unc: 0, hi: 0, lo: 0, e20: 20, s50: 29, s200: 29, nifty: 22481.30, notes: 'ET seed' }, { date: '2026-03-05', adv: 383, dec: 117, unc: 0, hi: 0, lo: 0, e20: 23, s50: 29, s200: 31, nifty: 22697.80, notes: 'ET seed' }, { date: '2026-03-04', adv: 54, dec: 446, unc: 0, hi: 0, lo: 0, e20: 14, s50: 26, s200: 28, nifty: 22409.80, notes: 'ET seed' }, { date: '2026-03-02', adv: 56, dec: 444, unc: 0, hi: 0, lo: 0, e20: 26, s50: 33, s200: 31, nifty: 22835.95, notes: 'ET seed' }, { date: '2026-02-27', adv: 118, dec: 382, unc: 0, hi: 0, lo: 0, e20: 39, s50: 42, s200: 35, nifty: 23166.85, notes: 'ET seed' }, { date: '2026-02-26', adv: 260, dec: 240, unc: 0, hi: 0, lo: 0, e20: 52, s50: 49, s200: 38, nifty: 23448.50, notes: 'ET seed' }, { date: '2026-02-25', adv: 314, dec: 186, unc: 0, hi: 0, lo: 0, e20: 53, s50: 49, s200: 38, nifty: 23403.80, notes: 'ET seed' }, { date: '2026-02-24', adv: 182, dec: 318, unc: 0, hi: 0, lo: 0, e20: 47, s50: 44, s200: 36, nifty: 23304.60, notes: 'ET seed' }, { date: '2026-02-23', adv: 298, dec: 202, unc: 0, hi: 0, lo: 0, e20: 53, s50: 48, s200: 37, nifty: 23484.95, notes: 'ET seed' }, { date: '2026-02-20', adv: 255, dec: 245, unc: 0, hi: 0, lo: 0, e20: 51, s50: 46, s200: 36, nifty: 23395.00, notes: 'ET seed' }, { date: '2026-02-19', adv: 68, dec: 432, unc: 0, hi: 0, lo: 0, e20: 52, s50: 44, s200: 36, nifty: 23297.45, notes: 'ET seed' }, { date: '2026-02-18', adv: 292, dec: 208, unc: 0, hi: 0, lo: 0, e20: 65, s50: 53, s200: 40, nifty: 23645.80, notes: 'ET seed' }, { date: '2026-02-17', adv: 337, dec: 163, unc: 0, hi: 0, lo: 0, e20: 65, s50: 48, s200: 39, nifty: 23540.05, notes: 'ET seed' }, { date: '2026-02-16', adv: 293, dec: 207, unc: 0, hi: 0, lo: 0, e20: 58, s50: 44, s200: 37, nifty: 23472.45, notes: 'ET seed' }, { date: '2026-02-13', adv: 70, dec: 430, unc: 0, hi: 0, lo: 0, e20: 55, s50: 42, s200: 38, nifty: 23313.15, notes: 'ET seed' }, { date: '2026-02-12', adv: 136, dec: 364, unc: 0, hi: 0, lo: 0, e20: 71, s50: 50, s200: 41, nifty: 23651.55, notes: 'ET seed' }, { date: '2026-02-11', adv: 238, dec: 262, unc: 0, hi: 0, lo: 0, e20: 76, s50: 55, s200: 44, nifty: 23783.05, notes: 'ET seed' }, { date: '2026-02-10', adv: 292, dec: 208, unc: 0, hi: 0, lo: 0, e20: 78, s50: 54, s200: 42, nifty: 23753.75, notes: 'ET seed' }, { date: '2026-02-09', adv: 422, dec: 78, unc: 0, hi: 0, lo: 0, e20: 75, s50: 51, s200: 41, nifty: 23683.40, notes: 'ET seed' }, { date: '2026-02-06', adv: 214, dec: 286, unc: 0, hi: 0, lo: 0, e20: 55, s50: 41, s200: 37, nifty: 23434.00, notes: 'ET seed' }, { date: '2026-02-05', adv: 214, dec: 286, unc: 0, hi: 0, lo: 0, e20: 55, s50: 39, s200: 36, nifty: 23411.70, notes: 'ET seed' }, { date: '2026-02-04', adv: 160, dec: 340, unc: 0, hi: 0, lo: 0, e20: 59, s50: 41, s200: 37, nifty: 23534.95, notes: 'ET seed' }, { date: '2026-02-03', adv: 329, dec: 171, unc: 0, hi: 0, lo: 0, e20: 52, s50: 38, s200: 37, nifty: 23446.30, notes: 'ET seed' }, { date: '2026-02-02', adv: 448, dec: 52, unc: 0, hi: 0, lo: 0, e20: 24, s50: 23, s200: 30, nifty: 22837.00, notes: 'ET seed' }, { date: '2026-02-01', adv: 313, dec: 187, unc: 0, hi: 0, lo: 0, e20: 17, s50: 19, s200: 27, nifty: 22611.30, notes: 'ET seed' }, { date: '2026-01-30', adv: 120, dec: 380, unc: 0, hi: 0, lo: 0, e20: 30, s50: 29, s200: 32, nifty: 23079.50, notes: 'ET seed' }, { date: '2026-01-29', adv: 328, dec: 172, unc: 0, hi: 0, lo: 0, e20: 21, s50: 23, s200: 31, nifty: 23134.80, notes: 'ET seed' },]; const existing = loadLocal(); const existingDates = new Set(existing.map(r => r.date)); const toAdd = seedData.filter(r => !existingDates.has(r.date)).map(r => { r.score = calcScore(r); const z = getZone(r.score); r.zone = z.name; r.r = z.r; return r; }); if (toAdd.length > 0) { saveLocal([...existing, ...toAdd]); }
}
(async function init() {
  document.getElementById('hdr-date').textContent = new Date().toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' }); const _etEl = document.getElementById('entry-today'); if (_etEl) _etEl.textContent = todayISO(); const _bsrDate = document.getElementById('bsr-date'); if (_bsrDate) _bsrDate.value = todayISO(); seedHistoricalData(); ensureOctoberDataSeeded(); if (initGuestMode()) return; const cfg = getCfg(); if (!cfg.key || !cfg.bin) { setSyncStatus('warn', 'Not Configured · Click to Setup'); } else {
    setSyncStatus('syncing', 'Syncing…'); try {
      const payload = await jbRead(cfg.key, cfg.bin); const isLegacy = Array.isArray(payload); const cRec = isLegacy ? payload : (payload.records || []); saveLocal(mergeByKey(cRec, loadLocal(), r => r.date)); const cBsr = isLegacy ? [] : (payload.bsr || []); bsrSave(mergeByKey(cBsr, bsrLoad(), t => t.id || (t.sym + '_' + t.date))); if (!isLegacy && payload.bsrMode) mergeBsrMode(payload.bsrMode, payload.bsrModeUpdatedAt); if (!isLegacy && payload.bsrQuick) mergeBsrQuick(payload.bsrQuick); const cMpm = isLegacy ? [] : (payload.mpm || []); mpmSave(mergeByKey(cMpm, mpmLoad(), d => d.date)); const cFtd = isLegacy ? [] : (payload.ftd || []); const mergedFtd = mergeByKey(cFtd, ftdLoad(), d => d.date).sort((a, b) => b.date.localeCompare(a.date)); ftdSaveData(mergedFtd); ensureOctoberDataSeeded(); ftdScanUndercutAll(); if (!cFtd.some(d => d.date === '2026-10-13' && d.type === 'followthrough') || cFtd.some(d => d.date === '2026-10-14' && d.type === 'attempt') || cFtd.filter(d => d.date === '2026-10-09').length > 1) { setTimeout(() => pushToCloud().catch(() => {}), 1000); } const cSrt = isLegacy ? [] : (payload.srt || []); srtSave(mergeByKey(cSrt, srtLoad(), s => s.id)); const cloudWatchlists = (typeof payload === 'object' && !Array.isArray(payload)) ? payload.sccWatchlists : null; const cloudSymbolFlags = (typeof payload === 'object' && !Array.isArray(payload)) ? payload.sccSymbolFlags : null; if (cloudWatchlists) {
        _sccWatchlists = cloudWatchlists; if (cloudSymbolFlags) _sccSymbolFlags = cloudSymbolFlags; localStorage.setItem('_sccWatchlists', JSON.stringify(_sccWatchlists)); localStorage.setItem('_sccSymbolFlags', JSON.stringify(_sccSymbolFlags)); if (!_sccWatchlists[_sccActiveWatchlist] && !_sccActiveWatchlist.startsWith('__flag_')) { const keys = Object.keys(_sccWatchlists); _sccActiveWatchlist = keys.length > 0 ? keys[0] : "Main"; localStorage.setItem('_sccActiveWatchlist', _sccActiveWatchlist); }
        if (_sccActiveWatchlist.startsWith('__flag_')) { const color = _sccActiveWatchlist.replace('__flag_', ''); _sccWatchlistSymbols = Object.keys(_sccSymbolFlags).filter(s => _sccSymbolFlags[s] === color); } else if (_sccActiveWatchlist !== 'VCP') { _sccWatchlistSymbols = _sccWatchlists[_sccActiveWatchlist] || []; }
        _sccWlSelectedSymbols = []; _sccWlLastSelectedSymbol = null;
      }
      const recCount = loadLocal().length; const bsrCount = bsrLoad().length; const mpmCount = mpmLoad().length; const srtCount = srtLoad().filter(s => s.id !== 'NIFTY50').length; setSyncStatus('ok', 'Synced'); console.log('[Init] Synced — Records:', recCount, 'BSR:', bsrCount, 'MPM:', mpmCount);
    } catch (e) { setSyncStatus('warn', 'Offline · Local data shown'); console.warn('[Init] Cloud pull failed:', e.message); }
  }
  renderAll(); bsrRenderAll(); mpmRenderAll(); renderRPG(); renderMarketSummary(); renderMarketCycle(); eodAutoFill(); cpUpdateHomeStatus();
})(); window.addEventListener('resize', () => { setTimeout(() => { renderChart(loadLocal()); bsrRenderChart(); renderA1Sparkline(loadLocal()); if (typeof brrgDraw === 'function') brrgDraw(); if (document.getElementById('sector-drill-overlay') && document.getElementById('sector-drill-overlay').style.display !== 'none' && _sdActiveTab === 'charts' && _sdChartsLayout === 'auto') { sdRenderCharts(_sdCurrentSector, _sdCurrentData); } if (document.getElementById('chart-max-overlay') && document.getElementById('chart-max-overlay').style.display !== 'none' && _sdMaximizedChartSymbol) { drawMaxChart(); } const sccChartPane = document.getElementById('scc-pane-chart'); if (sccChartPane && sccChartPane.style.display !== 'none') { const count = sccChartGetCount(); for (let i = 0; i < count; i++) { sccChartRenderPanel(i); } } }, 100); }); window.addEventListener('load', () => { setTimeout(() => { renderA1Sparkline(loadLocal()); renderChart(loadLocal()); brrgRebuildChips(); if (typeof brrgDraw === 'function') brrgDraw(); }, 300); }); (function setupResizeObservers() {
  const _origErr = window.onerror; window.onerror = function (msg, src, line, col, err) { if (typeof msg === 'string' && msg.includes('ResizeObserver loop')) return true; return _origErr ? _origErr(msg, src, line, col, err) : false; }; const chartWrap = document.querySelector('.chart-canvas-wrap'); const bsrWrap = document.querySelector('.bsr-canvas-wrap'); let chartRafId = null, bsrRafId = null; const ssWrap = document.getElementById('ss-chart-wrap'); if (window.ResizeObserver && ssWrap) { let ssCellRafId = null; const roCell = new ResizeObserver(() => { if (ssCellRafId) cancelAnimationFrame(ssCellRafId); ssCellRafId = requestAnimationFrame(() => { renderA1Sparkline(loadLocal()); ssCellRafId = null; }); }); roCell.observe(ssWrap); }
  if (window.ResizeObserver && chartWrap) {
    const ro = new ResizeObserver(entries => {
      if (chartRafId) cancelAnimationFrame(chartRafId); chartRafId = requestAnimationFrame(() => {
        for (const entry of entries) { if (entry.contentRect.width > 10) { const data = loadLocal(); renderChart(data); renderSnapshot(data); renderHistory(data); } }
        chartRafId = null;
      });
    }); ro.observe(chartWrap);
  }
  if (window.ResizeObserver && bsrWrap) {
    let bsrReady = false; const ro2 = new ResizeObserver(entries => {
      if (bsrRafId) cancelAnimationFrame(bsrRafId); bsrRafId = requestAnimationFrame(() => {
        for (const entry of entries) { if (entry.contentRect.width > 10) { bsrRenderChart(); bsrReady = true; } }
        bsrRafId = null;
      });
    }); ro2.observe(bsrWrap);
  }
})(); function bsrDaysSince(dateStr) { const d = new Date(dateStr + 'T00:00:00Z'); const now = new Date(); const nowUTC = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()); return Math.floor((nowUTC - d.getTime()) / 86400000); }
function bsrCalcR(trade) { const pivot = +trade.pivot; const curr = +trade.curr; const stop = trade.stop ? +trade.stop : pivot * 0.95; const risk = pivot - stop; if (risk <= 0) return 0; return (curr - pivot) / risk; }
function bsrEval(trade) { const pivot = +trade.pivot, curr = +trade.curr; const stop = trade.stop ? +trade.stop : pivot * 0.95; const days = bsrDaysSince(trade.date); if (curr <= stop) return 'failed'; if (curr >= pivot * 1.05) return 'success'; if (days > 60) return 'stale'; return 'pending'; }
function bsrIsResolved(trade) { const s = bsrEval(trade); return s === 'success' || s === 'failed'; }
function bsrZone(pct) { if (pct >= 80) return { name: 'STRONG BREAKOUT ENV', color: 'var(--purple)', bg: 'rgba(168,85,247,0.12)' }; if (pct >= 65) return { name: 'HEALTHY ENVIRONMENT', color: 'var(--green)', bg: 'rgba(34,197,94,0.12)' }; if (pct >= 50) return { name: 'MIXED CONDITIONS', color: 'var(--yellow)', bg: 'rgba(250,204,21,0.12)' }; if (pct >= 30) return { name: 'WEAK BREAKOUTS', color: 'var(--orange)', bg: 'rgba(251,146,60,0.12)' }; return { name: 'AVOID BREAKOUTS', color: 'var(--red)', bg: 'rgba(248,113,113,0.12)' }; }
function bsrCalcLogStats(trades) {
  const results = trades.map(t => bsrEval(t));
  const succ = results.filter(r => r === 'success').length;
  const fail = results.filter(r => r === 'failed').length;
  const pend = results.filter(r => r === 'pending').length;
  const stale = results.filter(r => r === 'stale').length;
  const total = succ + fail;
  const pct = total > 0 ? Math.round(succ / total * 100) : null;
  const zone = pct !== null ? bsrZone(pct) : { name: 'No Data', color: 'var(--dim)', bg: 'transparent' };
  const resolved = trades.filter(t => bsrIsResolved(t));
  let expectancy = '—';
  if (resolved.length > 0) {
    const sumR = resolved.reduce((sum, t) => sum + bsrCalcR(t), 0);
    const expVal = sumR / resolved.length;
    expectancy = (expVal >= 0 ? '+' : '') + expVal.toFixed(2) + 'R';
  }
  let isDeclining = false;
  if (trades.length >= 10) {
    const evalAll = trades.map(t => bsrEval(t) === 'success' ? 1 : bsrEval(t) === 'failed' ? 0 : null).filter(v => v !== null);
    const recent5 = evalAll.slice(0, 5).reduce((a, b) => a + b, 0) / 5;
    const prev5 = evalAll.slice(5, 10).reduce((a, b) => a + b, 0) / 5;
    isDeclining = recent5 < prev5;
  }
  return { mode: 'log', pct, succ, fail, pend, stale, total, tradesCount: trades.length, zone, expectancy, isDeclining };
}

function bsrGetEffectiveStats() {
  const mode = bsrGetMode();
  const trades = bsrLoad();
  const q = bsrQuickLoad();
  const won = (q.won !== null && q.won !== undefined && q.won !== '') ? Math.max(0, parseInt(q.won, 10)) : null;
  const lost = (q.lost !== null && q.lost !== undefined && q.lost !== '') ? Math.max(0, parseInt(q.lost, 10)) : null;
  const totalBase = (q.total !== null && q.total !== undefined && q.total !== '') ? parseInt(q.total, 10) : 10;
  if (mode === 'quick') {
    if (won !== null && lost !== null && (won + lost) > 0) {
      const evalTotal = won + lost;
      const pct = Math.round((won / evalTotal) * 100);
      const zone = bsrZone(pct);
      const pend = Math.max(0, totalBase - evalTotal);
      return { mode: 'quick', pct, succ: won, fail: lost, pend, stale: 0, total: evalTotal, totalBase, zone, expectancy: `${pct}% Win`, isDeclining: false };
    } else if (won !== null && totalBase > 0) {
      const pct = Math.round((won / totalBase) * 100);
      const zone = bsrZone(pct);
      return { mode: 'quick', pct, succ: won, fail: Math.max(0, totalBase - won), pend: 0, stale: 0, total: totalBase, totalBase, zone, expectancy: `${pct}% Win`, isDeclining: false };
    } else if (trades.length > 0) {
      const logStats = bsrCalcLogStats(trades);
      return { ...logStats, mode: 'quick', isFallback: true };
    }
    return { mode: 'quick', pct: null, succ: 0, fail: 0, pend: 0, stale: 0, total: 0, totalBase, zone: { name: 'No Data', color: 'var(--dim)', bg: 'transparent' }, expectancy: '—', isDeclining: false };
  }
  if (trades.length > 0) {
    return bsrCalcLogStats(trades);
  } else if (won !== null) {
    const evalTotal = (won + (lost || 0)) || totalBase;
    const pct = Math.round((won / evalTotal) * 100);
    const zone = bsrZone(pct);
    return { mode: 'log', pct, succ: won, fail: lost || 0, pend: 0, stale: 0, total: evalTotal, totalBase, zone, expectancy: `${pct}% Win`, isDeclining: false, tradesCount: 0 };
  }
  return { mode: 'log', pct: null, succ: 0, fail: 0, pend: 0, stale: 0, total: 0, tradesCount: 0, zone: { name: 'No Data', color: 'var(--dim)', bg: 'transparent' }, expectancy: '—', isDeclining: false };
}

function bsrUpdateModeUI() {
  const mode = bsrGetMode();
  const btnQuick = document.getElementById('bsr-mode-btn-quick');
  const btnLog = document.getElementById('bsr-mode-btn-log');
  const pnlQuick = document.getElementById('bsr-quick-panel');
  const logSection = document.getElementById('bsr-log-section') || document.getElementById('bsr-log-controls');
  const badge = document.getElementById('bsr-source-badge');
  if (btnQuick) btnQuick.classList.toggle('active', mode === 'quick');
  if (btnLog) btnLog.classList.toggle('active', mode === 'log');
  if (pnlQuick) pnlQuick.style.display = (mode === 'quick') ? 'block' : 'none';
  if (logSection) logSection.style.display = (mode === 'log') ? 'block' : 'none';
  if (badge) {
    if (mode === 'quick') {
      badge.textContent = '⚡ Active: Quick Ratio (/10)';
      badge.style.color = 'var(--purple)';
      badge.style.borderColor = 'rgba(167,139,250,.35)';
      badge.style.background = 'rgba(167,139,250,.12)';
    } else {
      badge.textContent = '📋 Active: Trade Log';
      badge.style.color = 'var(--teal)';
      badge.style.borderColor = 'rgba(45,212,191,.35)';
      badge.style.background = 'rgba(45,212,191,.12)';
    }
  }
  const q = bsrQuickLoad();
  const inpWon = document.getElementById('bsr-quick-won');
  const inpLost = document.getElementById('bsr-quick-lost');
  if (inpWon && !inpWon.matches(':focus')) {
    inpWon.value = (q.won !== null && q.won !== undefined) ? q.won : '';
  }
  if (inpLost && !inpLost.matches(':focus')) {
    inpLost.value = (q.lost !== null && q.lost !== undefined) ? q.lost : '';
  }
  bsrQuickCalcPreview();
  if (mode === 'log') {
    bsrRenderTable(bsrLoad());
    bsrRenderChart();
  }
}

function bsrQuickCalcPreview() {
  const inpWon = document.getElementById('bsr-quick-won');
  const inpLost = document.getElementById('bsr-quick-lost');
  const valEl = document.getElementById('bsr-qcalc-val');
  const zoneEl = document.getElementById('bsr-qcalc-zone');
  if (!valEl) return;
  const wonStr = inpWon ? inpWon.value.trim() : '';
  const lostStr = inpLost ? inpLost.value.trim() : '';
  if (wonStr === '' && lostStr === '') {
    valEl.textContent = '—';
    valEl.style.color = 'var(--dim)';
    if (zoneEl) { zoneEl.textContent = 'Enter Won / Lost'; zoneEl.style.color = 'var(--dim)'; }
    return;
  }
  const w = wonStr !== '' ? Math.max(0, parseInt(wonStr, 10)) : 0;
  const l = lostStr !== '' ? Math.max(0, parseInt(lostStr, 10)) : 0;
  const tot = (w + l) > 0 ? (w + l) : 10;
  const pct = Math.round((w / tot) * 100);
  const z = bsrZone(pct);
  valEl.textContent = pct + '%';
  valEl.style.color = z.color;
  if (zoneEl) { zoneEl.textContent = z.name; zoneEl.style.color = z.color; }
}

let _bsrCloudDebounce = null;

function bsrQuickOnInput(source) {
  const inpWon = document.getElementById('bsr-quick-won');
  const inpLost = document.getElementById('bsr-quick-lost');
  if (source === 'won' && inpWon && inpLost) {
    const rawVal = inpWon.value.trim();
    if (rawVal === '') {
      inpLost.value = '';
      inpLost.dataset.autoFilled = 'true';
    } else {
      let w = parseInt(rawVal, 10);
      if (!isNaN(w)) {
        if (w < 0) { w = 0; inpWon.value = '0'; }
        if (w > 10) { w = 10; inpWon.value = '10'; }
        const diff = Math.max(0, 10 - w);
        inpLost.value = diff;
        inpLost.dataset.autoFilled = 'true';
      }
    }
  } else if (source === 'lost' && inpLost) {
    inpLost.dataset.autoFilled = 'false';
    const rawVal = inpLost.value.trim();
    if (rawVal !== '') {
      let l = parseInt(rawVal, 10);
      if (!isNaN(l)) {
        if (l < 0) { l = 0; inpLost.value = '0'; }
        if (l > 10) { l = 10; inpLost.value = '10'; }
      }
    }
  }

  const wonStr = inpWon ? inpWon.value.trim() : '';
  const lostStr = inpLost ? inpLost.value.trim() : '';
  const won = wonStr !== '' ? parseInt(wonStr, 10) : null;
  const lost = lostStr !== '' ? parseInt(lostStr, 10) : null;

  const data = { won: won, lost: lost, total: 10, _updatedAt: Date.now() };
  bsrQuickSave(data);
  lsSet(LS_BSR_MODE, 'quick');
  lsSet('_bsrModeUpdatedAt', Date.now().toString());

  bsrRenderAll();

  clearTimeout(_bsrCloudDebounce);
  _bsrCloudDebounce = setTimeout(() => {
    const cfg = getCfg();
    if (cfg.key && cfg.bin) {
      pushToCloud().then(pushed => {
        if (pushed) flashBsrSaved('✓ BSR Score Saved');
      });
    }
  }, 1000);
}

function flashBsrSaved(msg) {
  const text = msg || '✓ BSR Score Saved';
  const el = document.getElementById('bsr-save-flash');
  if (el) {
    el.textContent = text;
    el.style.color = (text.startsWith('⚠') || text.startsWith('✗')) ? 'var(--orange)' : 'var(--lime)';
    el.style.display = 'inline-flex';
    void el.offsetWidth;
    el.style.opacity = '1';
    clearTimeout(el._fadeTimer);
    clearTimeout(el._hideTimer);
    el._fadeTimer = setTimeout(() => {
      el.style.opacity = '0';
      el._hideTimer = setTimeout(() => {
        el.style.display = 'none';
      }, 400);
    }, 3500);
  }
  const logMsg = document.getElementById('bsr-msg');
  if (logMsg) {
    logMsg.textContent = text;
    logMsg.style.color = (text.startsWith('⚠') || text.startsWith('✗')) ? 'var(--orange)' : 'var(--lime)';
    logMsg.style.opacity = '1';
    clearTimeout(logMsg._fadeTimer);
    logMsg._fadeTimer = setTimeout(() => {
      logMsg.style.opacity = '0';
    }, 3500);
  }
}

async function bsrQuickSaveAndApply() {
  clearTimeout(_bsrCloudDebounce);
  const inpWon = document.getElementById('bsr-quick-won');
  const inpLost = document.getElementById('bsr-quick-lost');
  const btnApply = document.getElementById('btn-bsr-apply') || document.querySelector('.btn-bsr-apply');
  const badge = document.getElementById('bsr-apply-badge');

  const wonStr = inpWon ? inpWon.value.trim() : '';
  const lostStr = inpLost ? inpLost.value.trim() : '';

  if (wonStr === '') {
    if (btnApply) {
      const origText = btnApply.innerHTML;
      btnApply.classList.add('warn');
      btnApply.innerHTML = '⚠ Enter Won First';
      setTimeout(() => {
        btnApply.classList.remove('warn');
        btnApply.innerHTML = origText;
      }, 1500);
    }
    flashBsrSaved('⚠ Enter Won Breakouts first');
    return;
  }

  const won = parseInt(wonStr, 10);
  let lost = lostStr !== '' ? parseInt(lostStr, 10) : Math.max(0, 10 - won);
  if (inpLost && lostStr === '') {
    inpLost.value = lost;
    inpLost.dataset.autoFilled = 'true';
  }

  const data = { won: won, lost: lost, total: 10, _updatedAt: Date.now() };
  bsrQuickSave(data);
  lsSet(LS_BSR_MODE, 'quick');
  lsSet('_bsrModeUpdatedAt', Date.now().toString());
  bsrRenderAll();

  // Highlight pulse animation on BSR numbers
  const numEl = document.getElementById('bsr-num');
  const qvalEl = document.getElementById('bsr-qcalc-val');
  if (numEl) {
    numEl.classList.remove('bsr-score-pulse');
    void numEl.offsetWidth;
    numEl.classList.add('bsr-score-pulse');
    setTimeout(() => numEl.classList.remove('bsr-score-pulse'), 700);
  }
  if (qvalEl) {
    qvalEl.classList.remove('bsr-score-pulse');
    void qvalEl.offsetWidth;
    qvalEl.classList.add('bsr-score-pulse');
    setTimeout(() => qvalEl.classList.remove('bsr-score-pulse'), 700);
  }

  // Button tactile feedback
  if (btnApply) {
    btnApply.classList.add('applied');
    btnApply.innerHTML = '✓ Applied!';
    clearTimeout(btnApply._applyTimer);
    btnApply._applyTimer = setTimeout(() => {
      btnApply.classList.remove('applied');
      btnApply.innerHTML = '✓ Apply Score';
    }, 1800);
  }

  const cfg = getCfg();
  const hasCloud = !!(cfg.key && cfg.bin);

  // Inline badge feedback
  if (badge) {
    if (hasCloud) {
      badge.innerHTML = '☁ Syncing…';
      badge.style.color = 'var(--teal)';
      badge.classList.add('visible');
    } else {
      badge.innerHTML = '✓ Saved Locally <span style="opacity:.7;font-weight:400">(Cloud not setup)</span>';
      badge.style.color = 'var(--orange)';
      badge.classList.add('visible');
      clearTimeout(badge._timer);
      badge._timer = setTimeout(() => {
        badge.classList.remove('visible');
      }, 3500);
    }
  }

  const stats = bsrGetEffectiveStats();
  const pctStr = stats.pct !== null ? stats.pct + '%' : '—';

  if (!hasCloud) {
    flashBsrSaved(`✓ BSR Score ${pctStr} Saved Locally · Cloud not configured (setup JSONBin in Control Panel)`);
    flash(`✓ BSR Score ${pctStr} Saved Locally`, 'var(--lime)');
  } else {
    flashBsrSaved(`⏳ BSR Score ${pctStr} Saving to Cloud…`);
    pushToCloud().then(pushed => {
      if (pushed) {
        if (badge) {
          badge.innerHTML = '☁ Cloud Synced ✓';
          badge.style.color = 'var(--lime)';
          clearTimeout(badge._timer);
          badge._timer = setTimeout(() => {
            badge.classList.remove('visible');
          }, 3000);
        }
        flashBsrSaved(`✓ BSR Score ${pctStr} Successfully Updated on Cloud (JSONBin)`);
        flash(`✓ BSR Score ${pctStr} Updated on Cloud`, 'var(--lime)');
      } else {
        if (badge) {
          badge.innerHTML = '⚠ Cloud Sync Error';
          badge.style.color = 'var(--red)';
        }
        flashBsrSaved(`⚠ BSR Score saved locally, but Cloud sync failed`);
      }
    });
  }
}

function bsrQuickSetPreset(won, lost) {
  clearTimeout(_bsrCloudDebounce);
  const inpWon = document.getElementById('bsr-quick-won');
  const inpLost = document.getElementById('bsr-quick-lost');
  if (inpWon) inpWon.value = won;
  if (inpLost) { inpLost.value = lost; inpLost.dataset.autoFilled = 'true'; }
  bsrQuickSaveAndApply();
}

async function bsrQuickReset() {
  clearTimeout(_bsrCloudDebounce);
  const inpWon = document.getElementById('bsr-quick-won');
  const inpLost = document.getElementById('bsr-quick-lost');
  if (inpWon) inpWon.value = '';
  if (inpLost) { inpLost.value = ''; inpLost.dataset.autoFilled = 'false'; }
  bsrQuickSave({ won: null, lost: null, total: 10, _updatedAt: Date.now() });
  lsSet('_bsrModeUpdatedAt', Date.now().toString());
  bsrRenderAll();
  flashBsrSaved('↺ BSR Score Reset');
  const cfg = getCfg();
  if (cfg.key && cfg.bin) {
    await pushToCloud();
  }
}

let _bsrFilter = 'all'; function bsrSetFilter(f) { _bsrFilter = f;['all', 'pending', 'success', 'failed', 'stale'].forEach(k => { const btn = document.getElementById('bsr-f-' + k); if (btn) btn.classList.toggle('active', k === f); }); bsrRenderTable(bsrLoad()); }
function bsrAdd() {
  const sym = document.getElementById('bsr-sym').value.trim().toUpperCase(); const pivot = document.getElementById('bsr-pivot').value.trim(); const stopInput = document.getElementById('bsr-stop').value.trim(); const curr = document.getElementById('bsr-curr').value.trim(); const date = document.getElementById('bsr-date').value; if (!sym || !pivot || !date) { flashBsrSaved('⚠ Symbol, Pivot Price and Date are required'); return; }
  const pivotVal = parseFloat(pivot); const stopVal = stopInput ? parseFloat(stopInput) : pivotVal * 0.95; const trades = bsrLoad(); const id = Date.now().toString(); trades.push({ id, sym, pivot: pivotVal, stop: stopVal, curr: curr ? parseFloat(curr) : pivotVal, date, _updatedAt: Date.now() }); bsrSave(trades); flashBsrSaved(`✓ Added ${sym} — BSR Score Saved`);['bsr-sym', 'bsr-pivot', 'bsr-stop', 'bsr-curr'].forEach(i => { const el = document.getElementById(i); if (el) el.value = ''; }); const dateEl = document.getElementById('bsr-date'); if (dateEl) dateEl.value = ''; bsrRenderAll(); renderRPG(); renderMarketSummary(); renderMarketCycle(); pushToCloud();
}
function bsrDelete(id) { if (!confirm('Remove this trade?')) return; const trades = bsrLoad().filter(t => t.id !== id); bsrSave(trades); bsrRenderAll(); renderRPG(); renderMarketSummary(); renderMarketCycle(); pushToCloud(); }
function bsrUpdatePrice(id, newPrice) {
  const trades = bsrLoad(); const t = trades.find(x => x.id === id); if (!t) return; const prevStatus = bsrEval(t); t.curr = parseFloat(newPrice); t._updatedAt = Date.now(); const newStatus = bsrEval(t); bsrSave(trades); if (prevStatus !== newStatus) { if (newStatus === 'success') flashBsrSaved('🎯 ' + t.sym + ' → Success! ≥5% above pivot'); else if (newStatus === 'failed') flashBsrSaved('✗ ' + t.sym + ' → Failed — hit stop loss'); else if (newStatus === 'stale') flashBsrSaved('⏳ ' + t.sym + ' → Stale — pending >60 days'); } else { flashBsrSaved('✓ BSR Score Saved'); }
  bsrRenderAll(); renderRPG(); renderMarketSummary(); renderMarketCycle(); pushToCloud();
}
function bsrFlash(msg, color) { flashBsrSaved(msg); }
function bsrRenderHero(trades) {
  const _d = { textContent: '', innerHTML: '', style: {}, className: '' }; const el = id => document.getElementById(id) || _d;
  const stats = bsrGetEffectiveStats();
  const { mode, pct, succ, fail, pend, stale, total, totalBase, zone: z, expectancy } = stats;
  el('bsr-sn').textContent = succ; el('bsr-fn').textContent = fail; el('bsr-pn').textContent = pend;
  if (mode === 'quick') {
    el('bsr-total').textContent = `⚡ Quick: ${succ}W / ${fail}L`;
  } else {
    el('bsr-total').textContent = trades.length + ' trade' + (trades.length !== 1 ? 's' : '') + ' logged';
  }
  const expEl = el('bsr-expectancy');
  if (expEl) {
    expEl.textContent = expectancy;
    expEl.style.color = (pct !== null && pct >= 50) ? 'var(--lime)' : (pct !== null ? 'var(--red)' : 'var(--dim)');
  }
  if (pct === null) {
    el('bsr-num').textContent = '—'; el('bsr-num').style.color = 'var(--dim)';
    el('bsr-zone').textContent = 'No Data'; el('bsr-zone').style.color = 'var(--dim)';
    el('bsr-fill').style.width = '0%'; el('bsr-breakdown').textContent = '';
    el('hero-bsr-pct').textContent = '—'; el('hero-bsr-pct').style.color = 'var(--dim)';
    el('hero-bsr-zone').textContent = '—'; el('hero-bsr-zone').style.color = 'var(--dim)';
    el('hero-bsr-counts').textContent = mode === 'quick' ? '⚡ Quick (empty)' : trades.length + ' trades';
  } else {
    el('bsr-num').textContent = pct + '%'; el('bsr-num').style.color = z.color;
    el('bsr-zone').textContent = z.name; el('bsr-zone').style.color = z.color;
    el('bsr-fill').style.width = pct + '%'; el('bsr-fill').style.background = z.color;
    if (mode === 'quick') {
      el('bsr-breakdown').innerHTML = `<span>⚡ Quick Ratio: ${succ} won + ${fail} lost = ${total} evaluated &nbsp;|&nbsp; Base: /${totalBase} &nbsp;|&nbsp; (${pct}% BSR)</span>`;
      el('hero-bsr-pct').textContent = pct + '%'; el('hero-bsr-pct').style.color = z.color;
      el('hero-bsr-zone').textContent = z.name; el('hero-bsr-zone').style.color = z.color;
      el('hero-bsr-counts').textContent = `⚡ ${succ}✓ ${fail}✗ / ${totalBase}`;
    } else {
      el('bsr-breakdown').innerHTML = `<span>${succ} success + ${fail} failed = ${total} evaluated &nbsp;|&nbsp; ${pend} pending · ${stale} stale (excluded from %)</span>`;
      el('hero-bsr-pct').textContent = pct + '%'; el('hero-bsr-pct').style.color = z.color;
      el('hero-bsr-zone').textContent = z.name; el('hero-bsr-zone').style.color = z.color;
      el('hero-bsr-counts').textContent = `${succ}✓ ${fail}✗ ${pend}⏳${stale ? ' ' + stale + '📌' : ''}`;
    }
  }
  if (trades.length > 0) {
    const last = trades[trades.length - 1]; el('bsr-last-sym').textContent = last.sym;
    const s = bsrEval(last); const sc = s === 'success' ? 'var(--lime)' : s === 'failed' ? 'var(--red)' : 'var(--yellow)';
    el('bsr-last-info').innerHTML = `Pivot &#8377;${last.pivot} &nbsp;<span style="color:${sc};text-transform:uppercase;font-size:9px;font-weight:700">${s}</span>`;
  } else {
    el('bsr-last-sym').textContent = mode === 'quick' ? '⚡ Quick' : '—';
    el('bsr-last-info').textContent = mode === 'quick' ? `${pct !== null ? pct + '%' : '—'} Active` : '—';
  }
  bsrUpdateModeUI();
}
function bsrRenderTable(trades) {
  const tbody = document.getElementById('bsr-tbody'); if (!tbody) return; const label = document.getElementById('bsr-filter-label'); if (!tbody) return; if (!trades.length) { tbody.innerHTML = '<tr><td colspan="10" style="color:var(--dim);padding:24px;text-align:center;letter-spacing:2px;font-size:11px;font-family:var(--mono);">NO TRADES LOGGED YET — Add potential breakout setups above</td></tr>'; if (label) label.textContent = ''; return; }
  const sorted = [...trades].sort((a, b) => b.date.localeCompare(a.date)); const filtered = sorted.filter(t => { const s = bsrEval(t); if (_bsrFilter === 'all') return true; if (_bsrFilter === 'pending') return s === 'pending'; if (_bsrFilter === 'success') return s === 'success'; if (_bsrFilter === 'failed') return s === 'failed'; if (_bsrFilter === 'stale') return s === 'stale'; return true; }); const staleCount = sorted.filter(t => bsrEval(t) === 'stale').length; const pendingCount = sorted.filter(t => bsrEval(t) === 'pending').length; if (label) { const parts = []; if (staleCount) parts.push(staleCount + ' stale'); if (pendingCount) parts.push(pendingCount + ' pending'); label.textContent = filtered.length + ' shown' + (parts.length ? ' · ' + parts.join(' · ') : ''); }
  if (!filtered.length) { tbody.innerHTML = '<tr><td colspan="10" style="color:var(--dim);padding:16px;text-align:center;font-size:11px">No trades match this filter</td></tr>'; return; }
  const statusClass = { success: 'success', failed: 'failed', pending: 'pending', stale: 'pending' }; const statusLabel = { success: '✓ Success', failed: '✗ Failed', pending: '⏳ Pending', stale: '⏳ Stale' }; tbody.innerHTML = filtered.map(t => {
    const pivot = +t.pivot, curr = +t.curr; const stop = t.stop ? +t.stop : pivot * 0.95; const days = bsrDaysSince(t.date); const status = bsrEval(t); const chgPct = ((curr - pivot) / pivot * 100).toFixed(2); const rVal = bsrCalcR(t); const rValStr = (rVal >= 0 ? '+' : '') + rVal.toFixed(2) + 'R'; const chgColor = +chgPct >= 5 ? 'var(--lime)' : +chgPct >= 0 ? 'var(--green)' : 'var(--red)'; const rColor = rVal >= 1.5 ? 'var(--purple)' : rVal >= 0 ? 'var(--lime)' : 'var(--red)'; const isStale = status === 'stale'; const isResolved = status === 'success' || status === 'failed'; const rowClass = isStale ? 'bsr-tr-stale' : isResolved ? 'bsr-tr-resolved' : ''; const staleBadge = isStale ? '<span class="bsr-stale-badge">60d+</span>' : ''; const ageLabel = days <= 5 ? 'Early' : days <= 15 ? 'Mid' : days <= 60 ? 'Late' : 'Stale'; return `<tr class="${rowClass}">
      <td style="font-weight:700;color:var(--text);font-size:12px">${t.sym}${staleBadge}</td>
      <td style="color:var(--sub)">${fmt(t.date)}</td>
      <td style="color:var(--sub)">${days}d <span style="font-size:9px;color:${isStale ? 'var(--red)' : 'var(--dim)'}">${ageLabel}</span></td>
      <td style="color:var(--text)">₹${pivot.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
      <td style="color:var(--dim)">₹${stop.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
      <td>
        <input class="bsr-price-input" type="number" value="${curr}" step="0.05"
          onblur="if(this.value && +this.value !== ${curr}) bsrUpdatePrice('${t.id}', this.value)"
          onkeydown="if(event.key==='Enter') this.blur()"
          title="Update current price — status auto-updates">
      </td>
      <td style="color:${chgColor};font-weight:600;text-align:right">${+chgPct >= 0 ? '+' : ''}${chgPct}%</td>
      <td style="color:${rColor};font-weight:700;text-align:right">${rValStr}</td>
      <td><span class="bsr-status ${statusClass[status] || 'pending'}">${statusLabel[status] || status}</span></td>
      <td><button class="del-btn" onclick="bsrDelete('${t.id}')" title="Remove only if entered by mistake">✕</button></td>
    </tr>`;
  }).join('');
}
function bsrRenderChart() {
  const canvas = document.getElementById('bsr-chart'); if (!canvas) return; const ctx = canvas.getContext('2d'); const wrap = canvas.parentElement; if (!wrap) return; const dpr = window.devicePixelRatio || 1; const bRect = wrap.getBoundingClientRect ? wrap.getBoundingClientRect() : { width: 0 }; const W = bRect.width || wrap.offsetWidth || 400, H = 160; canvas.width = W * dpr; canvas.height = H * dpr; canvas.style.width = W + 'px'; canvas.style.height = H + 'px'; ctx.scale(dpr, dpr); ctx.clearRect(0, 0, W, H); const trades = bsrLoad(); if (trades.length < 2) { ctx.fillStyle = 'rgba(62,84,112,0.5)'; ctx.font = '12px Inter, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('Add at least 2 trades to see BSR trend', W / 2, H / 2); return; }
  const PAD = { t: 16, r: 20, b: 36, l: 44 }; const cW = W - PAD.l - PAD.r, cH = H - PAD.t - PAD.b; const sorted = [...trades].sort((a, b) => a.date.localeCompare(b.date)); const points = []; sorted.forEach((t, i) => { const slice = sorted.slice(0, i + 1); const results = slice.map(x => bsrEval(x)); const s = results.filter(r => r === 'success').length; const f = results.filter(r => r === 'failed').length; const total = s + f; const pct = total > 0 ? Math.round(s / total * 100) : null; if (pct !== null) points.push({ label: t.sym, pct, date: t.date }); }); if (points.length < 2) { ctx.fillStyle = 'rgba(62,84,112,0.5)'; ctx.font = '12px Inter, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('Waiting for evaluated trades (Success or Failed)…', W / 2, H / 2); return; }
  [[65, 100, 'rgba(34,197,94,0.05)'], [50, 65, 'rgba(250,204,21,0.05)'], [0, 50, 'rgba(248,113,113,0.05)']].forEach(([lo, hi, c]) => { ctx.fillStyle = c; ctx.fillRect(PAD.l, PAD.t + cH - hi / 100 * cH, cW, (hi - lo) / 100 * cH); });[[65, 'rgba(34,197,94,0.35)'], [50, 'rgba(250,204,21,0.3)']].forEach(([v, c]) => { const y = PAD.t + cH - v / 100 * cH; ctx.beginPath(); ctx.strokeStyle = c; ctx.setLineDash([4, 4]); ctx.lineWidth = 1; ctx.moveTo(PAD.l, y); ctx.lineTo(PAD.l + cW, y); ctx.stroke(); ctx.setLineDash([]); ctx.fillStyle = c; ctx.font = '9px JetBrains Mono,monospace'; ctx.textAlign = 'right'; ctx.fillText(v + '%', PAD.l - 4, y + 3); });[0, 25, 50, 75, 100].forEach(v => { ctx.fillStyle = 'rgba(122,155,181,0.4)'; ctx.font = '9px JetBrains Mono,monospace'; ctx.textAlign = 'right'; ctx.fillText(v + '%', PAD.l - 6, PAD.t + cH - v / 100 * cH + 3); }); const step = points.length > 1 ? cW / (points.length - 1) : cW; ctx.beginPath(); points.forEach((p, i) => { const x = PAD.l + i * step, y = PAD.t + cH - p.pct / 100 * cH; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.lineTo(PAD.l + (points.length - 1) * step, PAD.t + cH); ctx.lineTo(PAD.l, PAD.t + cH); ctx.closePath(); const g = ctx.createLinearGradient(0, PAD.t, 0, PAD.t + cH); g.addColorStop(0, 'rgba(168,85,247,0.2)'); g.addColorStop(1, 'rgba(168,85,247,0.0)'); ctx.fillStyle = g; ctx.fill(); ctx.beginPath(); points.forEach((p, i) => { const x = PAD.l + i * step, y = PAD.t + cH - p.pct / 100 * cH; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.strokeStyle = '#c084fc'; ctx.lineWidth = 2.5; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.stroke(); points.forEach((p, i) => {
    const x = PAD.l + i * step, y = PAD.t + cH - p.pct / 100 * cH; const c = p.pct >= 65 ? '#22c55e' : p.pct >= 50 ? '#facc15' : '#f87171'; ctx.beginPath(); ctx.arc(x, y, 3.5, 0, Math.PI * 2); ctx.fillStyle = c; ctx.fill(); if (points.length <= 8 || i === points.length - 1) { ctx.fillStyle = c; ctx.font = 'bold 9px JetBrains Mono,monospace'; ctx.textAlign = 'center'; ctx.fillText(p.pct + '%', x, y - 9); }
    ctx.fillStyle = 'rgba(122,155,181,0.6)'; ctx.font = '8px JetBrains Mono,monospace'; ctx.textAlign = 'center'; if (i === 0 || i === points.length - 1 || (points.length <= 8))
      ctx.fillText(p.label, x, H - 6);
  });
}
function bsrExport() {
  const trades = bsrLoad(); if (!trades.length) { alert('No trades to export'); return; }
  const hdr = ['Symbol', 'Breakout Date', 'Days', 'Pivot', 'Stop Loss', 'Current Price', 'Change%', 'R-Value', 'Status']; const rows = trades.map(t => { const pivot = +t.pivot, curr = +t.curr, days = bsrDaysSince(t.date); const stop = t.stop ? +t.stop : pivot * 0.95; const chg = ((curr - pivot) / pivot * 100).toFixed(2); const rVal = bsrCalcR(t).toFixed(2); return [t.sym, t.date, days, pivot, stop, curr, chg, rVal, bsrEval(t)].join(','); }); const blob = new Blob([[hdr.join(','), ...rows].join('\n')], { type: 'text/csv' }); const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: 'bsr_trades_' + todayISO() + '.csv' }); a.click(); URL.revokeObjectURL(a.href);
}
function mpmClassify(close, pclose, vol, pvol) { const closeUp = +close > +pclose; const volUp = +vol > +pvol; if (closeUp && volUp) return 'acc'; if (!closeUp && volUp) return 'dist'; return 'neutral'; }
function mpmCondition(score) { if (score >= 5) return { name: 'STRONG BUYING', color: 'var(--lime)', hint: 'Institutions actively accumulating. Favourable for breakouts.' }; if (score >= 2) return { name: 'HEALTHY', color: 'var(--green)', hint: 'More accumulation than distribution. Market internals positive.' }; if (score >= 0) return { name: 'NEUTRAL', color: 'var(--yellow)', hint: 'Balanced pressure. Watch for direction shift before acting.' }; if (score >= -3) return { name: 'WEAK / CAUTION', color: 'var(--orange)', hint: 'Distribution starting to dominate. Reduce risk, tighten stops.' }; return { name: 'HEAVY SELLING', color: 'var(--red)', hint: 'Sustained distribution. Avoid new breakout entries.' }; }
function mpmNeedlePos(score) { const c = Math.max(-10, Math.min(10, score)); return ((c + 10) / 20 * 90 + 5).toFixed(1) + '%'; }
let _mpmParsed = []; function mpmOpenNSE() {
  var today = new Date(); var from = new Date(); from.setDate(today.getDate() - 35); var pad = function (n) { return String(n).padStart(2, '0'); }; var fmtDMY = function (d) { return pad(d.getDate()) + '-' + pad(d.getMonth() + 1) + '-' + d.getFullYear(); }; var url = 'https://www.nseindia.com/reports-indices-historical-index-data'; window.open(url, '_blank'); mpmFlash('NSE page opened in new tab. Select Nifty 50 · From: ' + fmtDMY(from) +
    ' · To: ' + fmtDMY(today) + ' · Get Data · Download CSV · drop file here.', 'var(--teal)');
}
function mpmHandleDrop(e) { e.preventDefault(); document.getElementById('mpm-drop-zone').classList.remove('drag-over'); const file = e.dataTransfer.files[0]; if (file) mpmHandleFile(file); }
function mpmHandleFile(file) {
  if (!file || !file.name.toLowerCase().endsWith('.csv')) { mpmFlash('Please select a .csv file downloaded from NSE', 'var(--orange)'); return; }
  const reader = new FileReader(); reader.onload = e => mpmParseCSV(e.target.result, file.name); reader.readAsText(file);
}
function mpmParseCSV(text, filename) {
  let raw = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n'); const lines = raw.split('\n').map(l => l.trim()).filter(Boolean); if (lines.length < 2) { mpmFlash('CSV appears empty — check the file', 'var(--red)'); return; }
  function splitCSVLine(line) {
    const result = []; let cur = '', inQ = false; for (let i = 0; i < line.length; i++) {
      const ch = line[i]; if (ch === '"') { inQ = !inQ; continue; }
      if (ch === ',' && !inQ) { result.push(cur.trim()); cur = ''; continue; }
      cur += ch;
    }
    result.push(cur.trim()); return result;
  }
  const header = splitCSVLine(lines[0]).map(h => h.replace(/"/g, '').trim().toLowerCase()); console.log('[MPM Import] File:', filename); console.log('[MPM Import] Header columns:', header); console.log('[MPM Import] First data row:', lines[1]); const colIdx = (keywords) => {
    for (const kw of keywords) { const idx = header.findIndex(h => h.includes(kw)); if (idx !== -1) return idx; }
    return -1;
  }; const iName = colIdx(['index name']); const iDate = colIdx(['index date', 'date']); const iClose = colIdx(['closing index value', 'closing', 'close']); const iVol = colIdx(['shares traded', 'volume', 'vol']); console.log('[MPM Import] Column indices → name:', iName, 'date:', iDate, 'close:', iClose, 'vol:', iVol); if (iDate === -1 || iClose === -1) {
    const headerStr = header.slice(0, 8).join(' | '); mpmFlash('Column not found. Columns detected: ' + headerStr +
      ' — Open browser console (F12) for full debug info.', 'var(--red)'); return;
  }
  const isMultiIndex = iName !== -1; const rows = []; for (let i = 1; i < lines.length; i++) {
    const cols = splitCSVLine(lines[i]); if (cols.length < 3) continue; if (isMultiIndex) { const nm = (cols[iName] || '').toLowerCase().trim(); if (nm !== 'nifty 50') continue; }
    const dateRaw = (cols[iDate] || '').trim(); const closeRaw = (cols[iClose] || '').trim(); const volRaw = iVol !== -1 ? (cols[iVol] || '').trim() : ''; if (!dateRaw || dateRaw.toLowerCase().includes('date')) continue; if (!closeRaw || closeRaw === '-' || closeRaw === '') continue; let date; const clean = dateRaw.replace(/\//g, '-').toUpperCase(); const MONTHS = { JAN: '01', FEB: '02', MAR: '03', APR: '04', MAY: '05', JUN: '06', JUL: '07', AUG: '08', SEP: '09', OCT: '10', NOV: '11', DEC: '12' }; if (/^\d{2}-[A-Z]{3}-\d{4}$/.test(clean)) {
      const parts = clean.split('-'); const mm = MONTHS[parts[1]]; if (!mm) { console.log('[MPM Import] Unknown month:', parts[1]); continue; }
      date = parts[2] + '-' + mm + '-' + parts[0];
    } else if (/^\d{2}-\d{2}-\d{4}$/.test(clean)) { const p = clean.split('-'); date = p[2] + '-' + p[1] + '-' + p[0]; } else if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) { date = clean.toLowerCase(); } else { console.log('[MPM Import] Skipping unrecognised date:', dateRaw); continue; }
    const close = parseFloat(closeRaw.replace(/,/g, '')); if (isNaN(close)) continue; let vol = 0; if (volRaw && volRaw !== '-') { const volAbs = parseFloat(volRaw.replace(/,/g, '')); if (!isNaN(volAbs)) { vol = volAbs > 100000 ? volAbs / 10000000 : volAbs; } }
    rows.push({ date, close, vol });
  }
  console.log('[MPM Import] Rows parsed:', rows.length, rows.slice(0, 3)); if (rows.length === 0) {
    mpmFlash('No data rows found after filtering. ' +
      (isMultiIndex ? 'Check that the file contains "Nifty 50" rows (not Nifty 500).' : 'File may be empty.') +
      ' Check browser console (F12) for details.', 'var(--orange)'); return;
  }
  rows.sort((a, b) => a.date.localeCompare(b.date)); const days = []; for (let i = 1; i < rows.length; i++) { const r = rows[i]; const prev = rows[i - 1]; days.push({ date: r.date, close: r.close.toFixed(2), pclose: prev.close.toFixed(2), vol: r.vol.toFixed(4), pvol: prev.vol.toFixed(4), }); }
  if (days.length === 0) { mpmFlash('Only 1 row found — select a wider date range (at least 30 days) on NSE to get 25 trading days.', 'var(--orange)'); return; }
  const hasVol = days.some(d => +d.vol > 0); if (!hasVol) { console.warn('[MPM Import] Volume column is all zeros — Acc/Dist classification will only use close direction.'); mpmFlash('⚠ Volume data missing in file — days classified by close direction only. Import will still work.', 'var(--yellow)'); }
  const last25 = days.slice(-25); _mpmParsed = last25; const preview = document.getElementById('mpm-preview'); const previewRows = document.getElementById('mpm-preview-rows'); if (!previewRows) return; const previewTitle = document.getElementById('mpm-preview-title'); const importBtn = document.getElementById('btn-mpm-import'); previewTitle.textContent = last25.length + ' Nifty 50 trading days parsed from ' + filename + ':'; const displayRows = [...last25].reverse().slice(0, 10); if (!previewRows) return; previewRows.innerHTML = displayRows.map(d => {
    const dtype = mpmClassify(d.close, d.pclose, d.vol, d.pvol); const icon = dtype === 'acc' ? '▲' : dtype === 'dist' ? '▼' : '▬'; const color = dtype === 'acc' ? '#4ade80' : dtype === 'dist' ? '#f87171' : '#3e5470'; const closeFmt = (+d.close).toLocaleString('en-IN', { minimumFractionDigits: 2 }); const volFmt = (+d.vol).toFixed(2); return '<span style="color:' + color + '">' + icon + '  ' + d.date +
      '  Close: ₹' + closeFmt + '  Vol: ' + volFmt + ' Cr</span>\n';
  }).join('') + (last25.length > 10 ? '<span style="color:var(--dim)">… and ' + (last25.length - 10) + ' more</span>' : ''); preview.style.display = 'block'; importBtn.disabled = false; importBtn.textContent = 'Import ' + last25.length + ' Days'; const acc = last25.filter(d => mpmClassify(d.close, d.pclose, d.vol, d.pvol) === 'acc').length; const dist = last25.filter(d => mpmClassify(d.close, d.pclose, d.vol, d.pvol) === 'dist').length; mpmFlash('NSE CSV parsed — ' + last25.length + ' days  |  ' + acc + ' Acc  ' + dist + ' Dist. Review and click Import.', 'var(--teal)');
}
async function mpmImportConfirm() {
  if (!_mpmParsed.length) return; const existing = mpmLoad(); const byDate = {}; existing.forEach(d => { byDate[d.date] = d; }); _mpmParsed.forEach(d => { byDate[d.date] = { id: d.date, date: d.date, close: d.close, pclose: d.pclose, vol: d.vol, pvol: d.pvol, dtype: mpmClassify(d.close, d.pclose, d.vol, d.pvol), _updatedAt: Date.now() }; }); const merged = Object.values(byDate).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 25); mpmSave(merged); console.log('[mpmImport] Saved', merged.length, 'days to localStorage'); console.log('[mpmImport] LS_MPM size after save:', (lsGet('nse_mpm_v1') || '').length, 'bytes'); console.log('[mpmImport] buildPayload mpm count:', buildPayload().mpm.length); _mpmParsed = []; document.getElementById('mpm-preview').style.display = 'none'; document.getElementById('btn-mpm-import').disabled = true; document.getElementById('mpm-drop-zone').classList.remove('drag-over'); const acc = merged.filter(d => d.dtype === 'acc').length; const dist = merged.filter(d => d.dtype === 'dist').length; mpmFlash('Imported ' + merged.length + ' days — ' + acc + ' Acc, ' + dist + ' Dist days', 'var(--lime)'); mpmRenderAll(); const cfg2 = getCfg(); const syncMsgEl = document.getElementById('mpm-sync-msg'); if (!cfg2.key || !cfg2.bin) { if (syncMsgEl) { syncMsgEl.textContent = '⚠ Data saved locally only. Configure JSONBin credentials to sync.'; syncMsgEl.style.color = 'var(--orange)'; syncMsgEl.style.display = 'block'; } } else {
    if (syncMsgEl) { syncMsgEl.textContent = '☁ Pushing to cloud…'; syncMsgEl.style.color = 'var(--teal)'; syncMsgEl.style.display = 'block'; }
    try {
      await jbUpdate(cfg2.key, cfg2.bin, buildPayload()); setSyncStatus('ok', 'Synced'); const n2 = mpmLoad().length; if (syncMsgEl) { syncMsgEl.textContent = '✓ ' + n2 + ' MPM days saved to cloud'; syncMsgEl.style.color = 'var(--lime)'; }
      setTimeout(() => { if (syncMsgEl) syncMsgEl.style.display = 'none'; }, 8000);
    } catch (err) { if (syncMsgEl) { syncMsgEl.textContent = '✗ Cloud push failed: ' + err.message; syncMsgEl.style.color = 'var(--red)'; } }
  }
}
function mpmClassifyNoVol(close, pclose) { const c = parseFloat(close), p = parseFloat(pclose); if (isNaN(c) || isNaN(p) || p === 0) return 'neutral'; return c > p ? 'acc' : c < p ? 'dist' : 'neutral'; }
function mpmDelete(id) { if (!confirm('Remove this day?')) return; const days = mpmLoad().filter(d => d.id !== id); mpmSave(days); mpmRenderAll(); pushToCloud(); }
function mpmRenderHero(days) {
  const _d = { textContent: '', innerHTML: '', style: {}, className: '' }; const el = id => document.getElementById(id) || _d; const last25 = days.slice(0, 25); const acc = last25.filter(d => d.dtype === 'acc').length; const dist = last25.filter(d => d.dtype === 'dist').length; const neut = last25.filter(d => d.dtype === 'neutral').length; const score = acc - dist; const cond = mpmCondition(score); el('mpm-acc-n').textContent = acc; el('mpm-dist-n').textContent = dist; el('mpm-neut-n').textContent = neut; el('mpm-window').textContent = 'Showing ' + last25.length + ' of last 25 trading days'; if (!days.length) { el('mpm-score').textContent = '—'; el('mpm-score').style.color = 'var(--dim)'; el('mpm-cond').textContent = 'No Data'; el('mpm-cond').style.color = 'var(--dim)'; el('mpm-hint').textContent = 'Enter Nifty daily data to see market pressure analysis.'; el('mpm-needle').style.left = '50%'; el('mpm-bars').innerHTML = ''; el('hero-mpm-score').textContent = '—'; el('hero-mpm-score').style.color = 'var(--dim)'; el('hero-mpm-cond').textContent = '—'; el('hero-mpm-cond').style.color = 'var(--dim)'; el('hero-mpm-counts').textContent = 'A:0 D:0 / 25d'; return; }
  const sStr = score > 0 ? '+' + score : '' + score; el('mpm-score').textContent = sStr; el('mpm-score').style.color = cond.color; el('mpm-cond').textContent = cond.name; el('mpm-cond').style.color = cond.color; el('mpm-hint').textContent = cond.hint; el('mpm-needle').style.left = mpmNeedlePos(score); el('hero-mpm-score').textContent = sStr; el('hero-mpm-score').style.color = cond.color; el('hero-mpm-cond').textContent = cond.name; el('hero-mpm-cond').style.color = cond.color; el('hero-mpm-counts').textContent = 'A:' + acc + '  D:' + dist + '  N:' + neut; const bars10 = [...last25].sort((a, b) => a.date.localeCompare(b.date)).slice(-10); el('mpm-bars').innerHTML = bars10.map(d => {
    const c = d.dtype === 'acc' ? 'var(--lime)' : d.dtype === 'dist' ? 'var(--red)' : 'var(--dim)'; const h = d.dtype === 'neutral' ? 8 : 32; const lbl = d.dtype === 'acc' ? 'A' : d.dtype === 'dist' ? 'D' : 'N'; return '<div class="mpm-bar-group"><div class="mpm-bar-val" style="color:' + c + '">' + lbl + '</div>' +
      '<div class="mpm-bar-fill" style="background:' + c + ';height:' + h + 'px"></div>' +
      '<div class="mpm-bar-lbl">' + fmt(d.date).slice(0, 6) + '</div></div>';
  }).join('');
}
function mpmRenderTable(days) {
  const tbody = document.getElementById('mpm-tbody'); if (!tbody) return; if (!days.length) { tbody.innerHTML = '<tr><td colspan="10" style="color:var(--dim);padding:24px;text-align:center;letter-spacing:2px;font-size:11px;font-family:var(--mono);">NO DATA YET</td></tr>'; return; }
  const asc = [...days].sort((a, b) => a.date.localeCompare(b.date)); let runAcc = 0, runDist = 0; const withRun = asc.map(d => { if (d.dtype === 'acc') runAcc++; if (d.dtype === 'dist') runDist++; return Object.assign({}, d, { rs: runAcc - runDist }); }).reverse(); tbody.innerHTML = withRun.map(function (d) { var cc = d.pclose ? ((+d.close - +d.pclose) / +d.pclose * 100).toFixed(2) : null; var vc = d.pvol ? ((+d.vol - +d.pvol) / +d.pvol * 100).toFixed(2) : null; var closeC = cc ? (+cc > 0 ? 'var(--green)' : +cc < 0 ? 'var(--red)' : 'var(--dim)') : 'var(--dim)'; var volC = vc ? (+vc > 0 ? 'var(--teal)' : 'var(--dim)') : 'var(--dim)'; var sc = d.rs > 0 ? 'var(--lime)' : d.rs < 0 ? 'var(--red)' : 'var(--yellow)'; var tcls = d.dtype === 'acc' ? 'acc' : d.dtype === 'dist' ? 'dist' : 'neutral'; var tlbl = d.dtype === 'acc' ? '&#9650; Accumulation' : d.dtype === 'dist' ? '&#9660; Distribution' : '&#9644; Neutral'; var ccStr = cc ? ((+cc >= 0 ? '+' : '') + cc + '%') : '&mdash;'; var vcStr = vc ? ((+vc >= 0 ? '+' : '') + vc + '%') : '&mdash;'; var rsStr = (d.rs > 0 ? '+' : '') + d.rs; var cFmt = (+d.close).toLocaleString('en-IN', { minimumFractionDigits: 2 }); var pcFmt = (+d.pclose).toLocaleString('en-IN', { minimumFractionDigits: 2 }); return ['<tr>', '<td style="color:var(--sub)">' + fmt(d.date) + '</td>', '<td><span class="mpm-dtype ' + tcls + '">' + tlbl + '</span></td>', '<td style="color:var(--text)">&#8377;' + cFmt + '</td>', '<td style="color:var(--sub)">&#8377;' + pcFmt + '</td>', '<td style="color:' + closeC + ';font-weight:600">' + ccStr + '</td>', '<td style="color:var(--teal)">' + (+d.vol).toFixed(2) + '</td>', '<td style="color:var(--sub)">' + (+d.pvol).toFixed(2) + '</td>', '<td style="color:' + volC + '">' + vcStr + '</td>', '<td style="color:' + sc + ';font-weight:700">' + rsStr + '</td>', '<td><button class="del-btn" onclick="mpmDelete(this.dataset.id)" data-id="' + d.id + '" title="Remove">&#10005;</button></td>', '</tr>'].join(''); }).join('');
}
function mpmExport() {
  const days = mpmLoad(); if (!days.length) { alert('No MPM data to export'); return; }
  const hdr = ['Date', 'Day Type', 'Close', 'Prev Close', 'Close Chg%', 'Volume(Cr)', 'Prev Vol(Cr)', 'Vol Chg%']; const rows = days.map(d => { const cc = d.pclose ? ((+d.close - +d.pclose) / +d.pclose * 100).toFixed(2) : ''; const vc = d.pvol ? ((+d.vol - +d.pvol) / +d.pvol * 100).toFixed(2) : ''; return [d.date, d.dtype, d.close, d.pclose, cc, d.vol, d.pvol, vc].join(','); }); const blob = new Blob([[hdr.join(','), ...rows].join('\n')], { type: 'text/csv' }); const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: 'mpm_' + todayISO() + '.csv' }); a.click(); URL.revokeObjectURL(a.href);
}
async function forcePushMpm() {
  const cfg = getCfg(); const msgEl = document.getElementById('mpm-sync-msg'); if (!cfg.key || !cfg.bin) {
    if (msgEl) { msgEl.textContent = '⚠ Configure JSONBin credentials first (click "Cloud Sync" in the header)'; msgEl.style.color = 'var(--orange)'; msgEl.style.display = 'block'; }
    return;
  }
  if (msgEl) { msgEl.textContent = '☁ Pushing to cloud…'; msgEl.style.color = 'var(--teal)'; msgEl.style.display = 'block'; }
  setSyncStatus('syncing', 'Saving…'); try {
    await jbUpdate(cfg.key, cfg.bin, buildPayload()); setSyncStatus('ok', 'Synced'); const n = mpmLoad().length; if (msgEl) { msgEl.textContent = '✓ ' + n + ' MPM days pushed to cloud — safe across all devices'; msgEl.style.color = 'var(--lime)'; }
    setTimeout(() => { if (msgEl) msgEl.style.display = 'none'; }, 6000);
  } catch (e) { setSyncStatus('err', 'Error'); if (msgEl) { msgEl.textContent = '✗ Push failed: ' + e.message; msgEl.style.color = 'var(--red)'; } }
}
function mpmRenderAll() { const days = mpmLoad(); mpmRenderHero(days); mpmRenderTable(days); renderMarketCycle(); ddcRender(); }
function bsrRenderAll() { const trades = bsrLoad(); bsrRenderHero(trades); bsrRenderTable(trades); bsrRenderChart(); renderRPG(); renderMarketSummary(); renderMarketCycle(); bsrUpdateModeUI(); }
function openControlPanel(tab) { const overlay = document.getElementById('cp-overlay'); if (!overlay) return; overlay.classList.add('open'); cpSwitchTab(tab || 'eod'); const el = document.getElementById('entry-today'); if (el) el.textContent = todayISO(); cpRefreshSyncState(); if (tab === 'past') renderPastSeedList(); }
function closeControlPanel() { const overlay = document.getElementById('cp-overlay'); if (overlay) overlay.classList.remove('open'); }
function cpSwitchTab(tab) {
  ['eod', 'past', 'scanner', 'sync', 'dhan'].forEach(t => {
    const tb = document.getElementById('cp-tab-' + t);
    const sc = document.getElementById('cp-sec-' + t);
    if (tb) tb.classList.toggle('active', t === tab);
    if (sc) sc.classList.toggle('active', t === tab);
  });
  if (tab === 'past') renderPastSeedList();
  if (tab === 'sync') cpRefreshSyncState();
  if (tab === 'scanner') cpRefreshScannerState();
}

const LS_GH_PAT = 'nse_gh_pat_v1';
function getGhToken() { return lsGet(LS_GH_PAT) || ''; }
function saveGhToken() {
  const inp = document.getElementById('gh-token-input');
  if (!inp) return;
  const val = inp.value.trim();
  if (!val) { alert('Please enter a GitHub Personal Access Token.'); return; }
  lsSet(LS_GH_PAT, val);
  cpRefreshScannerState();
  setupFlash('GitHub Token Saved', 'var(--teal)');
}
function clearGhToken() {
  if (!confirm('Remove GitHub token from this device?')) return;
  lsDel(LS_GH_PAT);
  const inp = document.getElementById('gh-token-input');
  if (inp) inp.value = '';
  cpRefreshScannerState();
  setupFlash('GitHub Token Cleared', 'var(--yellow)');
}
function cpRefreshScannerState() {
  const token = getGhToken();
  const inp = document.getElementById('gh-token-input');
  const statusEl = document.getElementById('gh-token-status');
  if (inp && token) inp.value = token;
  if (statusEl) {
    if (token) {
      statusEl.innerHTML = `<span style="color:var(--lime);font-weight:600">✓ Token saved (${token.substring(0, 4)}••••${token.slice(-4)})</span>`;
    } else {
      statusEl.innerHTML = `<span style="color:var(--dim)">Token: Not configured</span>`;
    }
  }
}

let _scanPollInterval = null;
let _scanStartTime = null;

async function cpTriggerScan() {
  cpSwitchTab('scanner');

  const progressBox = document.getElementById('scan-progress-box');
  const progressTitle = document.getElementById('scan-progress-title');
  const progressMsg = document.getElementById('scan-progress-msg');
  const timerEl = document.getElementById('scan-timer');
  const linksEl = document.getElementById('scan-result-links');
  const spinnerEl = document.getElementById('scan-spinner');
  const startBtn = document.getElementById('btn-start-scan');
  const quickBtn = document.getElementById('btn-quick-scan');

  const token = getGhToken();
  if (!token) {
    if (progressBox) progressBox.style.display = 'block';
    if (progressTitle) {
      progressTitle.textContent = 'GitHub Token Required for 1-Click Scan';
      progressTitle.style.color = 'var(--yellow)';
    }
    if (progressMsg) {
      progressMsg.innerHTML = 'Enter a GitHub Personal Access Token below to trigger scans directly with 1 click, or <a href="https://github.com/mkshibu2/breadth-radar/actions/workflows/update_screener.yaml" target="_blank" style="color:var(--accent);font-weight:700">Open GitHub Actions ↗</a> to run manually.';
    }
    const inp = document.getElementById('gh-token-input');
    if (inp) inp.focus();
    return;
  }

  if (_scanPollInterval) clearInterval(_scanPollInterval);

  if (progressBox) progressBox.style.display = 'block';
  if (linksEl) linksEl.style.display = 'none';
  if (spinnerEl) spinnerEl.style.display = 'inline-block';
  if (startBtn) startBtn.disabled = true;
  if (quickBtn) quickBtn.disabled = true;

  _scanStartTime = Date.now();
  const updateTimer = () => {
    if (timerEl && _scanStartTime) {
      const elapsed = Math.round((Date.now() - _scanStartTime) / 1000);
      const m = Math.floor(elapsed / 60);
      const s = elapsed % 60;
      timerEl.textContent = (m > 0 ? `${m}m ` : '') + `${s}s`;
    }
  };
  updateTimer();
  const timerInterval = setInterval(updateTimer, 1000);

  if (progressTitle) {
    progressTitle.textContent = '🚀 Dispatching Workflow to GitHub Actions...';
    progressTitle.style.color = 'var(--blue)';
  }
  if (progressMsg) progressMsg.textContent = 'Sending workflow_dispatch signal to update_screener.yaml...';

  const repoOwner = 'mkshibu2';
  const repoName = 'breadth-radar';
  const workflowFile = 'update_screener.yaml';
  const dispatchUrl = `https://api.github.com/repos/${repoOwner}/${repoName}/actions/workflows/${workflowFile}/dispatches`;

  try {
    const res = await fetch(dispatchUrl, {
      method: 'POST',
      headers: {
        'Accept': 'application/vnd.github+json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ ref: 'main' })
    });

    if (res.status === 204 || res.status === 200) {
      if (progressTitle) progressTitle.textContent = '⏳ Queued on GitHub Actions...';
      if (progressMsg) progressMsg.textContent = 'Workflow dispatched! Waiting for GitHub runner to pick up the job...';

      const dispatchTime = Date.now();

      _scanPollInterval = setInterval(async () => {
        try {
          const runsRes = await fetch(`https://api.github.com/repos/${repoOwner}/${repoName}/actions/workflows/${workflowFile}/runs?per_page=3`, {
            headers: {
              'Accept': 'application/vnd.github+json',
              'Authorization': `Bearer ${token}`
            }
          });
          if (!runsRes.ok) return;
          const runsData = await runsRes.json();
          const runs = runsData.workflow_runs || [];

          let activeRun = runs.find(r => {
            const createdAt = new Date(r.created_at).getTime();
            return (createdAt >= dispatchTime - 30000);
          });
          if (!activeRun && runs.length > 0) activeRun = runs[0];

          if (activeRun) {
            const ghLink = document.getElementById('btn-gh-action-link');
            if (ghLink) ghLink.href = activeRun.html_url;

            if (activeRun.status === 'queued') {
              if (progressTitle) progressTitle.textContent = `⏳ Job Queued on GitHub (#${activeRun.run_number})`;
              if (progressMsg) progressMsg.innerHTML = `Runner is initializing. <a href="${activeRun.html_url}" target="_blank" style="color:var(--accent)">View live on GitHub ↗</a>`;
            } else if (activeRun.status === 'in_progress') {
              if (progressTitle) {
                progressTitle.textContent = `⚙️ Scanning in Progress (#${activeRun.run_number})`;
                progressTitle.style.color = 'var(--teal)';
              }
              if (progressMsg) progressMsg.innerHTML = `Running Python EOD automation &amp; VCP scan across NSE universe... <a href="${activeRun.html_url}" target="_blank" style="color:var(--accent)">View run ↗</a>`;
            } else if (activeRun.status === 'completed') {
              clearInterval(_scanPollInterval);
              clearInterval(timerInterval);
              if (startBtn) startBtn.disabled = false;
              if (quickBtn) quickBtn.disabled = false;
              if (spinnerEl) spinnerEl.style.display = 'none';

              if (activeRun.conclusion === 'success') {
                if (progressTitle) {
                  progressTitle.textContent = `✅ Scan Completed Successfully! (#${activeRun.run_number})`;
                  progressTitle.style.color = 'var(--lime)';
                }
                if (progressMsg) {
                  progressMsg.innerHTML = `VCP Screener Results &amp; Sector Breadth have been updated and pushed to GitHub!`;
                }
                if (linksEl) linksEl.style.display = 'flex';
                if (typeof sccFetchData === 'function') sccFetchData();
              } else {
                if (progressTitle) {
                  progressTitle.textContent = `❌ Scan Finished: ${activeRun.conclusion || 'Failed'} (#${activeRun.run_number})`;
                  progressTitle.style.color = 'var(--red)';
                }
                if (progressMsg) {
                  progressMsg.innerHTML = `The workflow encountered an issue. <a href="${activeRun.html_url}" target="_blank" style="color:var(--accent)">View error logs on GitHub ↗</a>`;
                }
              }
            }
          }
        } catch (pollErr) {
          console.warn('Poll error:', pollErr);
        }
      }, 4000);

    } else {
      clearInterval(timerInterval);
      if (startBtn) startBtn.disabled = false;
      if (quickBtn) quickBtn.disabled = false;
      if (spinnerEl) spinnerEl.style.display = 'none';

      const errText = await res.text();
      let errMsg = `GitHub API returned ${res.status}`;
      try {
        const j = JSON.parse(errText);
        if (j.message) errMsg = j.message;
      } catch (e) { }

      if (progressTitle) {
        progressTitle.textContent = '❌ Dispatch Failed';
        progressTitle.style.color = 'var(--red)';
      }
      if (progressMsg) {
        if (res.status === 401 || res.status === 403) {
          progressMsg.innerHTML = `Token authorization error: <b>${errMsg}</b>.<br>Make sure your GitHub Token has <b>Actions: Write</b> (or classic <b>repo</b>) scope.`;
        } else {
          progressMsg.textContent = `Error: ${errMsg}`;
        }
      }
    }
  } catch (err) {
    clearInterval(timerInterval);
    if (startBtn) startBtn.disabled = false;
    if (quickBtn) quickBtn.disabled = false;
    if (spinnerEl) spinnerEl.style.display = 'none';

    if (progressTitle) {
      progressTitle.textContent = '❌ Network Error';
      progressTitle.style.color = 'var(--red)';
    }
    if (progressMsg) progressMsg.textContent = `Failed to contact GitHub API: ${err.message}`;
  }
}

function cpRefreshSyncState() {
  const cfg = getCfg(); const configured = document.getElementById('cp-sync-configured'); const setup = document.getElementById('cp-sync-setup'); if (!configured || !setup) return; if (cfg.key && cfg.bin) { configured.style.display = 'block'; setup.style.display = 'none'; const disp = document.getElementById('cp-sync-binid-display'); if (disp) disp.textContent = 'Bin ID: ' + cfg.bin; } else {
    configured.style.display = 'none'; setup.style.display = 'block'; if (cfg.key) { const k = document.getElementById('cfg-key'); if (k) k.value = cfg.key; }
    if (cfg.bin) { const b = document.getElementById('cfg-bin'); if (b) b.value = cfg.bin; }
    const guestBin = lsGet(LS_GUEST_BIN); if (guestBin) { const gb = document.getElementById('cfg-guest-bin'); if (gb) gb.value = guestBin; const ex = document.getElementById('cfg-exit-guest-btn'); if (ex) ex.style.display = 'inline-block'; }
  }
}
function cpClearPastForm() { ['p-adv', 'p-dec', 'p-unc', 'p-hi', 'p-lo', 'p-e20', 'p-s50', 'p-s200', 'p-nifty', 'p-nifty-low', 'p-vol'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; }); const pCb = document.getElementById('p-ftd-attempt'); if (pCb) pCb.checked = false; const pF = document.getElementById('p-ftd-followthrough'); if (pF) pF.checked = false; const d = new Date(); d.setDate(d.getDate() - 1); const pd = document.getElementById('p-date'); if (pd) pd.value = d.toISOString().split('T')[0]; const msg = document.getElementById('past-save-msg'); if (msg) msg.textContent = ''; }
function openPastEntry() { openControlPanel('past'); }
function closePastEntry() { const old = document.getElementById('past-modal'); if (old && old.style.display !== 'none') { old.style.display = 'none'; } else { closeControlPanel(); } }
function loadPastRowIntoModal(date) {
  const row = loadLocal().find(r => r.date === date); if (!row) return; cpSwitchTab('past'); document.getElementById('p-date').value = date; document.getElementById('p-adv').value = row.adv || ''; document.getElementById('p-dec').value = row.dec || ''; document.getElementById('p-unc').value = row.unc || ''; document.getElementById('p-hi').value = row.hi || ''; document.getElementById('p-lo').value = row.lo || ''; document.getElementById('p-e20').value = row.e20 || ''; document.getElementById('p-s50').value = row.s50 || ''; document.getElementById('p-s200').value = row.s200 || ''; document.getElementById('p-nifty').value = row.nifty || ''; const pnl = document.getElementById('p-nifty-low'); if (pnl) pnl.value = row.niftyLow || ''; const pv = document.getElementById('p-vol'); if (pv) pv.value = row.vol || ''; const pCb = document.getElementById('p-ftd-attempt'); const pF = document.getElementById('p-ftd-followthrough'); const ftdEntry = ftdLoad().find(d => d.date === date); if (pCb) { pCb.checked = !!(ftdEntry && (ftdEntry.type === 'attempt' || (ftdEntry.type === 'void' && ftdEntry._origType === 'attempt'))); }
  if (pF) { pF.checked = !!(ftdEntry && (ftdEntry.type === 'followthrough' || (ftdEntry.type === 'void' && ftdEntry._origType === 'followthrough'))); }
}
function renderPastSeedList() {
  const el = document.getElementById('past-seed-list'); if (!el) return; const data = loadLocal().sort((a, b) => b.date.localeCompare(a.date)); if (!data.length) { el.innerHTML = '<div style="color:var(--dim);font-size:11px">No entries yet</div>'; return; }
  const ftdDays = ftdLoad(); el.innerHTML = data.map(r => {
    const z = getZone(r.score || 0); const isSeed = r.notes && r.notes.includes('ET seed'); const ftdEntry = ftdDays.find(d => d.date === r.date); const isDay1 = !!(ftdEntry && (ftdEntry.type === 'attempt' || (ftdEntry.type === 'void' && ftdEntry._origType === 'attempt'))); const isFtd = !!(ftdEntry && (ftdEntry.type === 'followthrough' || (ftdEntry.type === 'void' && ftdEntry._origType === 'followthrough'))); const pin = isDay1 ? '📍' : isFtd ? '🚀' : ''; return `<div onclick="loadPastRowIntoModal('${r.date}')" style="display:grid;grid-template-columns:100px 50px 90px 1fr 20px;gap:6px;align-items:center;padding:5px 8px;border-radius:4px;cursor:pointer;border-bottom:1px solid var(--border);font-size:11px" onmouseover="this.style.background='rgba(255,255,255,.03)'" onmouseout="this.style.background='none'">
      <span style="color:var(--text);font-family:var(--mono)">${r.date}</span>
      <span style="font-family:var(--disp);font-size:16px;font-weight:800;color:${z.color}">${r.score || '—'}</span>
      <span style="color:${z.color};font-size:10px">${r.zone || '—'}</span>
      <span style="color:var(--dim);font-size:10px">${isSeed ? '<span style="color:var(--purple);font-size:9px">ET seed</span>' : r.notes || ''}</span>
      <span title="Day 1 or FTD">${pin}</span>
    </div>`;
  }).join('');
}
async function savePastEntry() {
  const g = id => { const el = document.getElementById(id); return el ? el.value.trim() : ''; }; const date = g('p-date'); if (!date) { showPastMsg('⚠ Select a date', 'var(--orange)'); return; }
  if (date >= todayISO()) { showPastMsg('⚠ Use EOD Entry tab for today', 'var(--orange)'); return; }
  const adv = g('p-adv'), e20 = g('p-e20'); if (!adv && !e20) { showPastMsg('⚠ Enter at least Advances or SMA% values', 'var(--orange)'); return; }
  const row = { date, adv, dec: g('p-dec'), unc: g('p-unc'), hi: g('p-hi'), lo: g('p-lo'), e20, s50: g('p-s50'), s200: g('p-s200'), nifty: g('p-nifty'), niftyLow: g('p-nifty-low'), vol: g('p-vol'), notes: (adv || g('p-dec')) ? '' : 'ET seed', _updatedAt: Date.now() }; row.score = calcScore(row); const z = getZone(row.score); row.zone = z.name; row.r = z.r; const existing = loadLocal().filter(r => r.date !== date); saveLocal([...existing, row]); const pCb = document.getElementById('p-ftd-attempt'); const pF = document.getElementById('p-ftd-followthrough'); const isAttemptChecked = pCb && pCb.checked; const isFtdChecked = pF && pF.checked;
  const curClose = parseFloat(g('p-nifty')) || 0;
  const niftyLowVal = parseFloat(g('p-nifty-low')) || curClose;
  let ftdDays = ftdLoad();
  if (isAttemptChecked || isFtdChecked) {
    const type = isAttemptChecked ? 'attempt' : 'followthrough';
    if (!niftyLowVal || niftyLowVal <= 0) {
      showPastMsg(`⚠ Saved EOD data, but ${type === 'attempt' ? 'Day 1' : 'FTD'} requires Nifty price — fill it and save again.`, 'var(--orange)');
    } else {
      ftdDays = ftdDays.filter(d => d.date !== date);
      const prevRec = loadLocal().filter(r => r.date < date && r.nifty).sort((a, b) => b.date.localeCompare(a.date));
      const prevClose = prevRec.length ? parseFloat(prevRec[0].nifty) : 0;
      const movePct = (curClose && prevClose) ? +((curClose - prevClose) / prevClose * 100).toFixed(2) : 0;
      ftdDays.push({ id: Date.now(), date, _updatedAt: Date.now(), close: curClose || 0, prev: prevClose || 0, low: niftyLowVal, movePct, volUp: false, type: type, auto: false });
      ftdDays.sort((a, b) => b.date.localeCompare(a.date));
      ftdSaveData(ftdDays);
    }
  } else {
    const hadFtdEntry = ftdDays.some(d => d.date === date && (d.type === 'attempt' || d.type === 'followthrough' || (d.type === 'void' && (d._origType === 'attempt' || d._origType === 'followthrough'))));
    if (hadFtdEntry) {
      ftdSaveData(ftdDays.filter(d => d.date !== date));
    }
  }
  const voidMsg = ftdScanUndercutAll(); if (voidMsg) { showPastMsg('✓ Saved ' + date + ' · ⚠ Rally VOIDED — ' + voidMsg, 'var(--red)'); } else { let logMsg = ''; if (isAttemptChecked && niftyLowVal > 0) logMsg = ' · 📍 Day 1 logged'; else if (isFtdChecked && niftyLowVal > 0) logMsg = ' · 🚀 FTD logged'; showPastMsg('✓ Saved ' + date + ' — Score: ' + row.score + ' (' + z.name + ')' + logMsg, 'var(--lime)'); }
  cpUpdateHomeStatus(); renderPastSeedList(); renderAll(); ftdRender(); renderAnalysisFTD(); await pushToCloud();
}
function showPastMsg(msg, color) { const el = document.getElementById('past-save-msg'); if (el) { el.textContent = msg; el.style.color = color; } }
function cpUpdateHomeStatus() { }
const INFO = { 'breadth-score': { title: 'Breadth Score', what: 'A 0–100 composite score measuring how broadly the NSE Nifty 500 market is participating in any move. High score = wide participation = healthy market.', how: '<b>Advance/Decline Ratio</b> (35%) + <b>% stocks above EMA20</b> (20%) + <b>% above SMA50</b> (15%) + <b>% above SMA200</b> (15%) + <b>52W H/L Ratio</b> (15%). Weighted average of all five, scaled 0–100.', use: 'Above <b>55</b> = Healthy Bull — full position sizing. <b>45–55</b> = Expansion. <b>35–45</b> = Recovery — pilot entries only. Below <b>35</b> = Danger — stand aside. This is your primary market posture signal.' }, 'market-zone': { title: 'Market Zone & Position Size', what: 'Translates the Breadth Score into a named market phase and recommended position size in R (risk units), making it instantly actionable.', how: 'Score &lt; 30 → <b>Correction</b> (0R). 30–45 → <b>Recovery</b> (0.25–0.5R). 45–55 → <b>Expansion</b> (1–2R). &gt;55 → <b>Healthy Bull</b> (2–3R). The R size is a guideline based on O\'Neil / Minervini methodology.', use: 'Check this first every session. It sets your trade sizing ceiling immediately — don\'t take a 2R trade when the zone says Recovery.' }, 'zone-meter': { title: 'Zone Meter (Score Bar)', what: 'A visual progress bar showing where the current Breadth Score sits across the full 0–100 spectrum, with colour-coded zone bands and correct position sizes.', how: '<b style="color:var(--red)">CORRECTION</b> 0–20 (0R) · <b style="color:var(--orange)">DEFENSIVE</b> 20–35 (0.25R pilot) · <b style="color:var(--yellow)">CAUTION</b> 35–45 (0.5–1R) · <b style="color:var(--green)">EXPANDING</b> 45–55 (1–2R) · <b style="color:var(--lime)">HEALTHY</b> 55–100 (2–3R). Fill width = Score/100.', use: 'The score number tells you <i>where</i>; the bar shows you <i>how far into that zone</i> you are — e.g. a score of 52 is near the top of Expansion, almost into Healthy territory. Use this to gauge whether a zone change is imminent.' }, 'bsr-rate': { title: 'BSR — Breakout Success Rate', what: 'The percentage of your logged breakout trades that succeeded — defined as gaining <b>5% or more</b> from the pivot buy point within the trade window.', how: 'From your BSR Trade Log: <b>BSR% = Successful trades ÷ Total trades × 100</b>. A trade is marked success when you log a gain ≥ 5%. The rate is recalculated live as you log trades.', use: 'Above <b>65%</b> — market is rewarding breakouts, act confidently. <b>40–65%</b> — mixed, be selective. Below <b>40%</b> — breakouts are failing, avoid new entries even if the score is decent. This is your real-world feedback loop.' }, 'market-pressure': { title: 'Market Pressure (MPM)', what: 'Net institutional buying pressure over the last 25 sessions. Positive = institutions accumulating. Negative = distribution dominating.', how: '<b>Pressure = Accumulation Days − Distribution Days</b> (rolling 25-day window). An Accumulation Day = Nifty closes higher on above-average volume. A Distribution Day = closes lower on above-average volume. You log each in the Pressure Day Log.', use: '<b>+4 or above</b> — strong institutional backing, high confidence. <b>+1 to +3</b> — mild positive. <b>0 to −2</b> — caution. <b>Below −3</b> — institutional selling dominating, reduce exposure sharply. Always read alongside Breadth Score.' }, 'breadth-momentum': { title: 'Breadth Momentum', what: 'The day-over-day <i>change</i> in Breadth Score. Tells you whether market participation is improving or deteriorating right now.', how: '<b>Momentum = Today\'s Score − Yesterday\'s Score</b>. A jump of +10 in a single day is a strong breadth expansion signal. Negative momentum means participation is narrowing even if the absolute score is still decent.', use: 'Positive and rising → confirm your entries. Flat → neutral, wait for direction. Negative two days in a row → tighten stops and reduce new exposure. Watch for momentum divergence — score still high but momentum turning negative is an early warning.' }, 'breadth-thrust': { title: 'Breadth Thrust', what: 'The 3-day cumulative change in Breadth Score. A momentum acceleration signal that detects rapid, broad market expansion.', how: '<b>Thrust = Today\'s Score − Score 3 days ago</b>. Above <b>+10</b> in 3 days = strong thrust, historically associated with the early stages of sustained rallies. Negative thrust = rapid deterioration.', use: 'A Thrust &gt; +10 alongside a rising score is one of the strongest "all-clear" signals in the dashboard. Combine with FTD confirmation for highest conviction. Thrust &lt; −10 = potential distribution phase beginning — reduce exposure.' }, 'rally-prob': { title: 'Rally Probability Gauge', what: 'A 0–100% composite probability score estimating how likely the current market environment is to sustain a rally. Combines 6 indicators into one reading.', how: '<b>Breadth Score</b> (20pts) + <b>Momentum</b> (15pts) + <b>Thrust</b> (15pts) + <b>BSR</b> (20pts) + <b>Distribution Days</b> (15pts) + <b>Pressure</b> (15pts) + <b>FTD bonus</b> (+10pts). If no BSR trades logged, 20pts redistributed across other 5 indicators and scaled to 100.', use: '<b>85–100%</b> Very High — full sizing. <b>70–84%</b> High — normal entries. <b>50–69%</b> Moderate — selective pilot only. <b>30–49%</b> Low — wait. Below <b>30%</b> — stand aside entirely. This is your single best "go / no-go" signal.' }, 'market-condition': { title: 'Market Condition (William J. O\'Neil System)', what: 'Classifies the Nifty index into one of four conditions based on William J. O\'Neil\'s market-timing system:<br><br>• <b>Confirmed Uptrend</b>: A Confirmed Uptrend market status indicates the Nifty is in an uptrend. The uptrend begins with a follow-through day or when the index reclaims its previous uptrend high. At this stage, the index is not showing signs of significant distribution or heavy selling by institutional investors. This is the perfect time to be looking out for fundamentally strong stocks at proper buy points.<br><br>• <b>Uptrend Under Pressure</b>: An Uptrend Under Pressure market status is normally associated with rising number of distribution days on the Nifty. The index has 3-4 distribution days in the last five weeks and is showing some signs of deterioration. The index may be close to its 50-day and/or 200-day moving average support level, but is typically above at least one of the levels. Investors need to exercise caution and keep their buying decisions reserved to fundamentally strong stocks showing technical strength.<br><br>• <b>Rally Attempt</b>: A Rally Attempt begins the third day the index closes higher off the most recent bottom after being in a Correction (also known as Downtrend). During a Rally Attempt, we are on the lookout for a Follow-Through Day to confirm the trend has reversed and we have entered a Confirmed Uptrend. A Rally Attempt fails and the index goes back into a Correction if it undercuts the most recent low.<br><br>• <b>Correction</b>: A major index generally goes into Correction when the number of distribution days in the last five weeks rises to 5-6. The index has typically declined 5-7% or more from its recent high. Also, the index most likely breaches its support levels of 50-day and 200-day moving averages. Investors should avoid new purchases, get off margin, and raise cash. This is a good time to build your watch list of fundamentally-strong stocks that you would like to own when market condition improves.', how: 'Evaluated automatically from Follow-Through Day confirmation (Day 4+ close >1.5% on higher volume), 5-week distribution count (3–4 days = Uptrend Under Pressure, 5–6 days = Correction), % pullback from peak, and 50-day / 200-day moving average support levels.', use: '<b>Confirmed Uptrend:</b> Perfect time to look for fundamentally strong stocks at proper buy points.<br><b>Uptrend Under Pressure:</b> Investors need to exercise caution and keep their buying decisions reserved to fundamentally strong stocks showing technical strength.<br><b>Rally Attempt:</b> On the lookout for a Follow-Through Day to confirm trend reversal; build watchlist.<br><b>Correction:</b> Avoid new purchases, get off margin, and raise cash.' }, 'ftd': { title: 'Follow-Through Day (FTD)', what: 'A follow-through day is identified when a major index (Sensex or Nifty 50) closes significantly higher, over 1.5% for the day, on higher volume than the previous session. It happens on fourth day or later of an attempted rally. The most powerful follow-through days often happen on fourth through seventh day of an attempted rally. They serve as a confirmation that the market has really changed direction and is in a new uptrend. The strength in a follow-through day can be gauged by the action in leading stocks. A follow-through day coupled with leading stocks breaking out from their base patterns provides signs of a sustainable rally. A follow-through day is a key concept in the market-timing system developed by William J. O\'Neil.', how: 'A Rally Attempt begins the third day the index closes higher off the most recent bottom after being in a Correction. On <b>Day 4 or later</b>, an index close <b>over 1.5%</b> on <b>higher volume than the previous session</b> confirms the FTD. If the index undercuts the most recent low, or accumulates 5–6 distribution days, or declines 5–7%+ from high, the rally attempt / FTD fails and the index reverts to Correction.', use: 'Before FTD: Stand aside or pilot mode (0.25R) only after Day 3 if leading stocks break out. After FTD: Confirmed Uptrend is established — full position sizing justified on fundamentally strong stocks breaking out from sound base patterns.' }, 'dist-days': { title: 'Distribution Days', what: 'A distribution day is indicated by a major market index such as the Sensex or Nifty closing down 0.2% or more on higher volume than the previous day. Distribution in the stock market refers to the increased selling of stock by large institutions. The number of distribution days on the Sensex helps us in tracking the general market condition. Our studies have shown that four to six days of distribution over a period of five weeks are often enough to turn a previously advancing market into decline. Once you notice increasing distribution, it is best to hold off on any further stock purchases, and perhaps even cut back on some of your positions, especially if you are on margin.', how: 'Auto-counted from your Pressure Day Log over a rolling 25-session (5-week) window. Distribution days older than 25 sessions or cancelled by a 5% index rise are dropped.', use: '<b>0–2 days:</b> Healthy market, institutions not distributing.<br><b>3–4 days:</b> Uptrend Under Pressure — rising distribution days on the Nifty (3-4 days in last 5 weeks); index showing signs of deterioration. Exercise caution; keep buying decisions reserved to fundamentally strong stocks showing technical strength.<br><b>5–6 days:</b> Major index generally goes into Correction — avoid new purchases, get off margin, and raise cash.' }, 'hl-ratio': { title: 'H/L Ratio Trend (52-Week)', what: 'The ratio of stocks making new 52-week highs vs new 52-week lows across the Nifty 500. Measures the underlying health and breadth of leadership.', how: '<b>H/L Ratio = New 52W Highs ÷ (New 52W Highs + New 52W Lows) × 100</b>. You enter the raw H and L counts in the EOD entry. The dashboard shows today\'s ratio, the 5-day average, and the 10-day average for trend context.', use: '<b>Above 50%</b> — more stocks making highs than lows = healthy leadership breadth. <b>25–50%</b> — mixed. <b>Below 25%</b> — deteriorating leadership, broad weakness. A falling H/L ratio even as the index holds up = internal distribution, a leading warning signal.' }, 'exposure': { title: 'Personal Exposure Tracker — Market-Adjusted Capital', what: 'Calculates the exact ₹ amount you should have deployed in active positions given current market conditions. Enter your total capital and current invested amount — the tracker shows your suggested ceiling in rupees, your actual deployment, and whether you are over- or under-exposed vs what the market supports.', how: '<b>Suggested Exposure%</b> is computed from: Breadth Score (base 0–87%), MPM Pressure (±4–8%), Distribution Days (−5 to −10%), FTD status (+5%). Suggested ₹ = Exposure% × Your Capital. Gap = Suggested ₹ − Currently Invested.', use: 'If gap is positive → you have headroom to deploy. If gap is negative → you are overexposed, reduce before adding new positions. The status banner in the card provides direct contextual advice. This value also feeds directly into the Risk Advisory section of Market Summary — any overexposure triggers an automatic alert there.' }, 'market-summary': { title: 'Market Summary & Trading Guidance', what: 'A rule-based plain-English synthesis of <b>all</b> dashboard signals into one unified morning briefing — covering market phase, trading rules for today, and risk warnings. Now integrates Breadth Divergence (WBD), Personal Exposure gap, Sector Heatmap trend, and FTD status for a complete picture.', how: 'The engine reads: Breadth Score, Momentum, MPM Pressure, Distribution Days, FTD status, H/L Ratio, Breadth Divergence (from WBD card), and your Personal Exposure gap (from Exposure Tracker). It applies a multi-signal decision tree to generate three sections: <b>Market Summary</b> (phase narrative + MPM + divergence context), <b>Trading Guidance</b> (size rules, divergence actions), <b>Risk Advisory</b> (all red flags in one place).', use: 'Read this card every session morning in under 60 seconds. It tells you exactly what posture to take today. Key integration points: if Breadth Divergence is Bear → guidance automatically adds a no-new-longs rule. If you are overexposed vs the exposure ceiling → Risk Advisory alerts you. If sector heatmap shows broad rotation out → guidance reflects that. Trust this over your instincts on high-conviction days — it applies O\'Neil / Minervini rules mechanically without emotion.' }, 'sector-rotation': { title: 'Sector Rotation Tracker', what: 'Ranks all 13 NSE sector indices by trend strength every week. Uses your manually entered weekly closing prices to auto-calculate 20-week and 50-week moving averages, then classifies each sector into a Stage (1-4) based on where price sits relative to those MAs.', how: '<b>Stage 2</b> = above both MAs - advancing trend, hunt breakouts here. <b>Stage 1</b> = above 20MA but below 50MA - basing, add to watchlist. <b>Stage 3</b> = below 20MA but above 50MA - topping, avoid new entries. <b>Stage 4</b> = below both MAs - declining, skip entirely. <b>RS</b> = sector weekly % minus Nifty 50 weekly % - positive means outperforming. Tap RRG button to see the Relative Rotation Graph.', use: 'Before scanning for stocks, check this card first. Only scan stocks in Stage 2 sectors with positive RS. Update every Friday evening. MAs become reliable after ~20 weeks of history.' }, 'rrg': { title: 'Relative Rotation Graph (RRG)', what: 'A 4-quadrant chart that plots every sector by two metrics: RS-Ratio (X-axis) = is the sector stronger or weaker than Nifty 50? RS-Momentum (Y-axis) = is that relative strength improving or deteriorating? The tail shows the last N weeks of movement so you can see direction, not just position.', how: '<b>Leading</b> (top-right, green) = strong AND improving - best breakout hunting ground. <b>Improving</b> (top-left, blue) = gaining momentum, rotating into leadership - early entry zone. <b>Weakening</b> (bottom-right, yellow) = still strong but momentum slowing - consider exits or tighter stops. <b>Lagging</b> (bottom-left, red) = weak AND deteriorating - avoid completely. Clockwise rotation is the natural cycle: Leading → Weakening → Lagging → Improving → Leading.', use: 'Use tail direction, not just dot position. A sector in Lagging but moving right and upward is recovering - worth watching. A sector in Leading but tail curving down is topping - reduce exposure. Combine with Stage: Stage 2 + Leading quadrant = highest conviction. Use 4w tail for recent momentum, 12w tail for the bigger trend picture.' }, 'score-trend': { what: 'A canvas line chart showing how the Breadth Score has moved over the last 30 trading sessions, giving historical context to the current reading.', how: 'Plots the <b>Breadth Score</b> (blue line) for each saved EOD record. Colour-coded horizontal zone bands: red (Crash), orange (Defensive), yellow (Caution), green (Expansion), lime (Healthy). Up to 30 data points plotted.', use: 'Look for the trend direction, not just today\'s value. A score of 48 rising from 30 is very different from 48 falling from 60. Sustained scores above 45 with rising momentum = confirmed expansion. A score crossing below 35 from above = regime change warning.' }, 'bsr-tracker': { title: 'BSR Tracker — Trade Log', what: 'Your personal breakout trade journal used to calculate the Breakout Success Rate (BSR). Every breakout entry you make should be logged here.', how: 'Log each breakout trade with: Stock, Date, Buy Price, Result (Win/Loss), Exit Price. The dashboard calculates <b>success = exit gain ≥ 5%</b>, counts wins and losses, and updates the BSR% in the status strip in real time. Data saved to localStorage and synced to JSONBin cloud.', use: 'A falling BSR (even if the score looks ok) is your earliest warning that breakouts are failing. Log every trade — the more complete the data, the more reliable the BSR signal. Aim for ≥ 65% in a healthy market.' }, 'mpm-tracker': { title: 'Market Pressure Monitor (MPM)', what: 'A daily log of Accumulation and Distribution Days used to calculate the net market pressure score shown in the status strip.', how: 'Each day you observe: if Nifty closes <b>up on above-avg volume</b> → log as Accumulation (+1). If <b>down on above-avg volume</b> → log as Distribution (−1). The rolling 25-day window is auto-managed. <b>MPM Score = Acc − Dist</b> days in window.', use: 'Maintain the log daily for accurate pressure readings. Missing entries reduce signal accuracy. A shift from positive to negative MPM before the price breaks down is your earliest institutional selling warning. Use this alongside Distribution Day count for confirmation.' }, 'breadth-div': { title: 'Breadth Divergence', what: 'Compares the 5-day direction of Nifty 50 price vs Breadth Score. When they agree — both rising or both falling — the trend is confirmed. When they disagree, that is an early warning signal.', how: 'Price direction = Nifty close today vs 5 sessions ago. Breadth direction = Score today vs 5 sessions ago. Four states: Confirmed ↑ (both up), Confirmed ↓ (both down), Bearish Divergence (price up, breadth down — hidden weakness), Bullish Divergence (price down, breadth up — hidden strength).', use: 'Bearish Divergence → reduce exposure, tighten stops. Bullish Divergence → watch for reversal entry. Confirmed ↑ → normal entry conditions apply per your zone.' }, 'trend-bias': { title: 'Market Trend Bias (10d)', what: 'Counts how many of the last 10 sessions had Nifty closing up vs down. A market spending more time going up is healthier than one spending more time going down.', how: 'Each day is classified as Up (close > prev close), Down, or Flat. Net = Up days − Down days over last 10 sessions. Score direction used as fallback when Nifty close is missing.', use: 'Net ≥+4 = Bullish bias — look for breakouts. Net −1 to +1 = Neutral — be selective. Net ≤−4 = Bearish bias — reduce exposure or stand aside.' }, 'thrust-quality': { title: 'Thrust Quality', what: 'Measures the quality of recent market bounces. Are up-days happening on broad SMA participation, or on narrow/weak breadth? High conviction = stocks broadly above their MAs on up-days.', how: 'Compares average SMA breadth (mean of %>EMA20, %>SMA50, %>SMA200) on positive-breadth days vs negative-breadth days over last 10 sessions. A positive spread = up-days have better participation.', use: 'Strong = breakouts more likely to follow through, act on setups. Weak or Narrow = bounces are traps — avoid new entries until conviction improves.' }, 'inst-bias': { title: 'Institutional Bias 10d', what: 'Shows what institutions have been doing in the last 10 sessions based on MPM data. Accumulation days (close↑ + volume↑) = buying. Distribution days (close↓ + volume↑) = selling.', how: 'From your MPM log: counts Accumulation, Distribution and Neutral days in the last 10 sessions. Net = Acc − Dist. The mini bar chart shows the day-by-day pattern (teal=acc, red=dist, grey=neutral).', use: 'Net ≥+2 = Institutions accumulating — safe to hold and add. Net 0 to −1 = Neutral — hold, no new adds. Net ≤−2 = Institutions distributing — tighten stops, reduce exposure.' }, 'snapshot': { title: 'Detailed Metrics Snapshot', what: 'A compact table showing every key breadth metric for the latest session and previous session side-by-side, with the 10-day trend sparkline, direction arrow, and a signal label. Covers all 7 indicators: EMA20%, SMA50%, SMA200%, Advance/Decline ratio, H/L Ratio, Score, and Momentum.', how: 'Data is pulled from your saved EOD entries. The Change column = Latest − Prev. The 10-Day Trend sparkline is a mini line chart of the last 10 values. Direction = ↑ if improving, ↓ if deteriorating. Signal labels follow the same thresholds used in the Analysis Strip.', use: 'Use this for a quick cross-check when a signal in the status strip surprises you. If Score says Expansion but SMA200% is still low, breadth is improving on short-term MAs only — be selective. If EMA20% and SMA50% are both rising but SMA200% is lagging, the market is recovering from a correction but longer-term structure is not yet repaired. Expand this card only when you want deeper context — the Analysis Strip covers daily use.' }, 'sector-heatmap': { title: 'Sector Leadership Heatmap', what: 'A weekly colour-coded grid showing which NSE sectors are outperforming or underperforming Nifty 50. Green = sector beat the index that week. Red = sector lagged. Reveals which sectors are leading and which are rotating out.', how: 'Each row is a sector. Each column is one week, newest on the right. Colour intensity reflects the degree of outperformance/underperformance. Enter weekly sector close prices in the Control Panel → Sectors tab.', use: 'Your single fastest sector rotation read. Consistently green rows = institutional money is flowing into that sector — prioritise stocks from those sectors for breakout entries. Consecutive red rows = distribution underway in that sector — avoid new longs regardless of individual stock setup quality. Use alongside the RRG for confirmation.' }, 'personal-exposure': { title: 'Personal Exposure Tracker', what: 'Translates the dashboard\'s market-environment exposure percentage into an actual ₹ amount against your real trading capital. Tells you exactly how much money should be deployed right now — and whether you are over- or under-invested vs what current conditions justify.', how: 'Enter your total trading capital and current invested amount. The tracker computes the market-suggested ₹ ceiling (Exposure% × Total Capital), compares it to your actual invested amount, and flags whether you are aligned, overexposed, or have headroom to deploy.', use: 'Check this every morning before placing orders. If you are overexposed, reduce before adding new positions. If you have headroom and the market score is rising, that gap = new setup budget. Never use this as a reason to force-deploy — headroom is an upper limit, not a target.' }, 'wbd-alert': { title: 'Weekly Breadth Divergence Alert', what: 'Detects the most dangerous (and most rewarding) early warning in market analysis: when price and breadth move in opposite directions. A Bear Divergence (price up, breadth down) often precedes corrections. A Bull Divergence (price down, breadth up) often precedes recoveries.', how: 'Compares Nifty 50 price direction and Breadth Score direction over the last 5 trading sessions. Four states: <b style="color:var(--lime)">Confirmed ↑</b> (both up), <b style="color:var(--red)">Confirmed ↓</b> (both down), <b style="color:var(--orange)">Bear Diverge ⚠</b> (price up but breadth falling), <b style="color:var(--teal)">Bull Diverge ✦</b> (price down but breadth improving).', use: '<b>Bear Diverge</b> → Reduce exposure, tighten stop losses, avoid new entries even if price looks bullish. Smart money is not participating. <b>Bull Diverge</b> → Watch for reversal — accumulate pilot positions in strongest RS stocks. <b>Confirmed ↑</b> → Green light, proceed per your zone guidance. This card directly feeds the Risk Advisory in Market Summary — any divergence triggers an automatic alert there too.' }, 'breadth-expansion': { title: 'Breadth Expansion Rate', what: 'Measures how fast breadth is improving or deteriorating — the velocity of change in the Breadth Score over the last 5 sessions. A market can have the same score two weeks apart but the rate of change tells a completely different story.', how: 'Takes the last 5 breadth score readings and calculates the average daily change (pts/day). Positive = expanding, Negative = contracting. Also shows total change over the 5-day window.', use: 'Rapid expansion (+3 to +5 pts/day) = high-quality rally, act on breakouts. Slow (+1 to +2) = improving but unconvincing. Stalling (0) = caution. Contracting = avoid new entries regardless of absolute score level.' }, 'sector-command': { title: 'Sector Command Centre', what: 'Three views in one card. SECTORS tab: auto-populated daily from your VCP scanner — composite MA breadth score per sector across the full Nifty 500 universe. RRG tab: Relative Rotation Graph showing sector momentum trajectories. Heatmap tab: weekly RS vs Nifty 50 history grid.', how: 'Breadth data loads automatically from sector_breadth.json on your GitHub Pages (configure URL once in the SECTORS tab). RRG and Heatmap use weekly data entered via Control Panel → Sectors tab.', use: 'SECTORS tab: Sort by Score to instantly rank sectors by participation breadth. Green ≥60%, Yellow 40–59%, Red <40%. RRG tab: Leading quadrant = strong + improving, hunt breakouts there. Clockwise rotation = bullish. Heatmap: consistent green rows = durable multi-week leaders.' }, 'vcpb': { title: 'Sector Breadth — SECTORS Tab', what: 'Daily breadth across the full Nifty 500 universe per sector. Composite Score = avg(%>20EMA + %>50SMA + %>200SMA). Shows how broadly each sector participates in the rally across all 3 timeframes. RS wk and Stage columns are optional overlays from your manually-entered weekly sector data.', how: 'Fetched automatically from sector_breadth.json generated by vcp_scanner.py at 6 PM IST daily via GitHub Actions. Enter your GitHub Pages base URL once to activate.', use: 'Sectors with Score ≥60 = broad momentum — prioritise for new entries. Trend Bar (3 mini-bars): all green = healthy across all timeframes. High %>200SMA but low %>20EMA = structurally strong but momentum cooling — wait. Cross-check RS wk column against breadth score as a sanity check: if both are green, the sector is genuinely leading.' }, 'scc-feature-breadth': { title: 'SECTORS Tab Features', what: 'Provides daily market breadth analysis across the Nifty 500 index grouped by sector. Features:<ul><li><b>Dynamic Leaderboard:</b> Displays sector ranking with interactive bidirectional headers. Click any column header to sort; click it again to toggle direction (indicated by ▲/▼).</li><li><b>Multi-Sort Controls:</b> Sort sectors by up to six nested criteria sequentially (Sort 1 > Sort 2 > Sort 3 > Sort 4 > Sort 5 > Sort 6). Click "⚡ Minervini", "📈 O\'Neil", or "🔥 Zanger" to instantly load their presets.</li><li><b>Metric Definitions:</b> Point cursor on column headers for explanations.</li><li><b>Participant Drill-down:</b> Click any sector name to open a pop-up listing all constituent stocks and their VCP/EMA setup status.</li><li><b>NSE Index Links:</b> Click "NSE↗" next to any sector to open the live exchange tracking page.</li><li><b>Consensus Strip:</b> Auto-aggregates sectors into Leaders (top 25%), Watch (mid-ranking, improving), and Avoid (bottom 25%) at the top.</li></ul>', how: '• <b>Composite Score:</b> Calculated daily as 50% × (percentage of stocks above 20EMA) + 30% × (percentage of stocks above 50SMA) + 20% × (percentage of stocks above 200SMA).<br>• <b>Med90%:</b> Median 90-day price return of all VCP scanner candidate stocks in that sector.<br>• <b>Accel:</b> Velocity change of breadth (rolling 5d net score gain minus prior 5d net score gain).<br>• <b>A/D:</b> Count of days where Breadth Score rose by ≥2.5 points (Accumulation) vs. fell by ≥2.5 points (Distribution) over the last 20 trading days.', use: '• <b>Mark Minervini Preset (⚡):</b> Stage > RS wk > Score > Accel > @Top > Med90%. Ranks sectors strictly by Stage 2 markup first, then relative strength, then participation.<br>• <b>William O\'Neil Preset (📈):</b> RS wk > A/D > Score > @Top > Accel > Med90%. Ranks sectors by CANSLIM leadership and institutional sponsorship first.<br>• <b>Dan Zanger Preset (🔥):</b> Med90% > Accel > RS wk > Stage > Score > @Top. Ranks sectors by price velocity, momentum expansion, and relative strength first to catch explosive breakouts.' }, 'scc-feature-rrg': { title: 'RRG Tab Features', what: 'Relative Rotation Graph (RRG) visually modeling the relative strength and momentum of sectors vs. the Nifty 50. Features:<ul><li><b>Four-Quadrant Rotation Map:</b> Categorizes sectors into:<ul><li><i>Leading (Green):</i> Outperforming Nifty 50 with rising momentum.</li><li><i>Weakening (Yellow):</i> Outperforming Nifty 50 but momentum is slowing down.</li><li><i>Lagging (Red):</i> Underperforming Nifty 50 with falling momentum.</li><li><i>Improving (Blue):</i> Underperforming Nifty 50 but momentum is gaining speed.</li></ul></li><li><b>Sector Highlighter:</b> Click a tail or a sector label to dim all other sectors.</li><li><b>Time Tail Length Control:</b> Modify weekly history length from 5w to 40w.</li><li><b>Animation Control:</b> Play/pause controls to visualize historical rotation paths.</li></ul>', how: '• <b>RS-Ratio (X-axis):</b> Calculated as the ratio of weekly sector prices vs. Nifty 50, normalized around a benchmark of 100.<br>• <b>RS-Momentum (Y-axis):</b> Calculated as the rate of change of the RS-Ratio over a smoothed period.<br>• A sector\'s position is updated using manual weekly closing prices entered in the Control Panel → Sectors tab.', use: '• Natural rotation moves clockwise. Scan for sectors in the <b>Improving</b> quadrant curving upward and rightward, or established leaders in the <b>Leading</b> quadrant.<br>• Dim sectors to inspect individual trails. A longer tail suggests high velocity; a short tail indicates a tight base or consolidation.' }, 'scc-feature-heatmap': { title: 'Heatmap Tab Features', what: 'A weekly color-coded leadership grid tracking relative performance history. Features:<ul><li><b>Chronological Performance Grid:</b> Matrix showing weekly returns vs Nifty 50 (latest week on the right).</li><li><b>Intensity Color Scales:</b> Green blocks show positive outperformance (darker = stronger). Red blocks show underperformance. Grey blocks are neutral.</li><li><b>Sector Name Links:</b> Click any sector name on the left of the grid to drill down to constituent stocks.</li></ul>', how: 'Calculates the performance spread weekly: <b>Sector Return % − Nifty 50 Return %</b> for each individual week. Colors are scaled dynamically based on the size of the spread.', use: '• Scan for rows with a solid sequence of dark green cells over the last 3-6 weeks, indicating sustained institutional accumulation.<br>• Avoid sectors with consecutive red cells, signaling active distribution and capital flight.<br>• Use alongside RRG to confirm if a sector\'s rotation is supported by actual weekly outperformance.' }, 'scc-feature-chart': { title: 'Chart Tab Features', what: 'A direct multi-chart workbench for manually tracking stocks. Features:<ul><li><b>Layout Options:</b> Toggle between 2-column (2 charts side-by-side) and 4-column (4 charts side-by-side) grid formats.</li><li><b>Independent Settings:</b> Set the symbol and timeframe (Daily/Weekly) for each chart pane individually.</li><li><b>Sync Option:</b> Synchronize all panels to a single symbol for multi-timeframe analysis (e.g. Daily next to Weekly).</li><li><b>TradingView Integration:</b> Quick external links to TradingView chart views.</li><li><b>Maximizer:</b> Instantly enlarge any chart panel into full screen view.</li></ul>', how: 'Fetches historical stock prices directly from Yahoo Finance using the local proxy server or public CORS fallbacks. Renders high-quality price bars or Volume Candles with a smoothed 20-period Exponential Moving Average (EMA 20 in orange).', use: '• <b>Volume Candles:</b> Look for wide, green candles on high volume to confirm massive institutional accumulation.<br>• <b>Multi-Timeframe Analysis:</b> Check the same symbol on both the Daily (6-month view) and Weekly (2-year view) side-by-side. The trend is healthy if the price stays consistently above the rising EMA 20 (orange line) on both timeframes.' }, 'scc-feature-clusters': { title: 'Fresh High Breakout Clusters', what: 'Tracks institutional breakout clustering across 120+ granular industries using the 3,000+ NSE stock universe (inspired by Manas Arora\'s Breadth Ledger methodology). When multiple stocks in the same industry hit or hover near new highs simultaneously, it signals high-conviction group sponsorship.', how: '• <b>Breakout Density Formula:</b> % of industry constituents trading within <b>2% of 1-Month High</b> (short-term momentum leader) and within <b>3% of 52-Week High</b> (structural leadership).<br>• Filtered for minimum group size (default N ≥ 3) to eliminate 1-stock distortions.<br>• Dual-colored visual bars display the exact percentage share of fresh highs across the entire industry.', use: '• <b>Cluster Hunting:</b> Focus on industries where ≥35% of stocks are within 2% of 1-Month Highs — this indicates real group momentum rather than isolated moves.<br>• <b>Watchlist Export:</b> Click the 📋 Copy TV button on any industry card or use the bulk export button to instantly paste tickers into TradingView.<br>• <b>Tier Breakdown:</b> Click on any industry card to expand all constituent stocks, highlighted by High 52W Leaders (Teal), 1-Month High Leaders (Mint), and Base consolidations.' } }; function showInfoTip(id, btnEl) {
  const d = INFO[id]; if (!d) return; const tip = document.getElementById('info-tooltip'); document.getElementById('tip-title').textContent = d.title; const sections = [{ lbl: 'What it is', txt: d.what }, { lbl: 'How it\'s calculated', txt: d.how }, { lbl: 'How to use it', txt: d.use }]; const tipBody = document.getElementById('tip-body'); tipBody.innerHTML = sections.map((s, i) => `<div class="tip-section">
      <div class="tip-sec-lbl">${s.lbl}</div>
      <div class="tip-sec-txt">${s.txt}</div>
    </div>${i < sections.length - 1 ? '<div class="tip-divider"></div>' : ''}`).join(''); tip.style.display = 'flex'; tipBody.scrollTop = 0; const vh = window.innerHeight, vw = window.innerWidth; const maxTipH = Math.min(720, vh - 24); tip.style.maxHeight = maxTipH + 'px'; const rect = btnEl.getBoundingClientRect(); const tw = tip.offsetWidth || 440; const th = tip.offsetHeight; let left = rect.right - tw; if (left < 10) left = 10; if (left + tw > vw - 10) left = vw - tw - 10; let top = rect.bottom + 6; if (top + th > vh - 12) top = rect.top - th - 6; if (top < 12) top = 12; if (top + th > vh - 12) top = Math.max(12, vh - th - 12); tip.style.left = left + 'px'; tip.style.top = top + 'px'; document.removeEventListener('click', _outsideTipClose); setTimeout(() => { document.addEventListener('click', _outsideTipClose); }, 10);
}
function _outsideTipClose(e) { const tip = document.getElementById('info-tooltip'); if (!tip || tip.style.display === 'none') return; if (!tip.contains(e.target) && !e.target.closest('.info-btn')) closeInfoTip(); }
function closeInfoTip() { const tip = document.getElementById('info-tooltip'); if (tip) tip.style.display = 'none'; document.removeEventListener('click', _outsideTipClose); }
document.addEventListener('keydown', e => { if (e.key === 'Escape') { closeInfoTip(); const cp = document.getElementById('cp-overlay'); if (cp && cp.classList.contains('open')) closeControlPanel(); } }); function openCfgModal() { openControlPanel('sync'); }
function closeCfgModal() { closeControlPanel(); }
function cfgBanner(msg, type, id) {
  const el = document.getElementById(id || 'cfg-banner'); if (!el) return; if (!msg) { el.style.display = 'none'; el.textContent = ''; return; }
  el.textContent = msg; el.className = 'cfg-banner ' + (type || 'inf'); el.style.display = 'block';
}
function cfgUpdateSteps() { const key = (document.getElementById('cfg-key') || {}).value || ''; const bin = (document.getElementById('cfg-bin') || {}).value || ''; const btn = document.getElementById('cfg-connect-btn'); if (key && bin) { if (btn) btn.textContent = 'Connect & Pull Data'; } else if (key) { if (btn) btn.textContent = 'Connect & Create Bin'; } else { if (btn) btn.textContent = 'Connect & Create Bin'; } }
async function cfgConnect() {
  const keyEl = document.getElementById('cfg-key'); const binEl = document.getElementById('cfg-bin'); const key = keyEl ? keyEl.value.trim() : ''; let bin = binEl ? binEl.value.trim() : ''; const btn = document.getElementById('cfg-connect-btn'); if (!key) { cfgBanner('⚠ Please enter your JSONBin Master Key first.', 'warn'); return; }
  if (btn) btn.disabled = true; cfgBanner('🔄 Connecting to JSONBin…', 'inf'); setSyncStatus('syncing', 'Connecting…'); try { if (!bin) { bin = await jbCreate(key, buildPayload()); if (binEl) binEl.value = bin; saveCfg(key, bin); setSyncStatus('ok', 'Synced'); cfgBanner(`✅ Connected! Bin created.\n\nYour Bin ID: ${bin}\n\nCopy this ID to set up other devices.`, 'ok'); if (binEl) setTimeout(() => { binEl.style.borderColor = 'var(--lime)'; }, 300); cpRefreshSyncState(); } else { saveCfg(key, bin); await pullFromCloud(key, bin); await pushToCloud(); const recCount = loadLocal().length; const bsrCount = bsrLoad().length; const mpmCount = mpmLoad().length; const srtCount = srtLoad().filter(s => s.id !== 'NIFTY50').length; cfgBanner(`✅ Connected & data pulled!\n${recCount} breadth records · ${bsrCount} BSR trades · ${mpmCount} MPM entries · ${srtCount} sectors synced.`, 'ok'); cpRefreshSyncState(); } } catch (e) { setSyncStatus('err', 'Sync Error'); cfgBanner('✗ Error: ' + e.message + '\n\nCheck your Master Key and Bin ID are correct.', 'err'); }
  if (btn) btn.disabled = false;
}
async function cfgTestExisting() { const cfg = getCfg(); cfgBanner('🔄 Testing connection…', 'inf', 'cp-sync-msg'); try { const raw = await jbRead(cfg.key, cfg.bin); const recs = Array.isArray(raw) ? raw : (raw.records || []); const mpm = Array.isArray(raw) ? [] : (raw.mpm || []); cfgBanner(`✅ Connection OK — ${recs.length} records · ${mpm.length} MPM entries in cloud.`, 'ok', 'cp-sync-msg'); setSyncStatus('ok', `Synced · ${recs.length}rec`); } catch (e) { cfgBanner('✗ ' + e.message, 'err', 'cp-sync-msg'); setSyncStatus('err', 'Error'); } }
async function cfgForcePull() { cfgBanner('🔄 Pulling from cloud…', 'inf', 'cp-sync-msg'); try { await forcePull(); cfgBanner('✅ Data pulled and merged successfully.', 'ok', 'cp-sync-msg'); } catch (e) { cfgBanner('✗ Pull failed: ' + e.message, 'err', 'cp-sync-msg'); } }
async function cfgForcePush() { cfgBanner('🔄 Pushing to cloud…', 'inf', 'cp-sync-msg'); try { await forcePush(); cfgBanner('✅ All local data pushed to cloud.', 'ok', 'cp-sync-msg'); } catch (e) { cfgBanner('✗ Push failed: ' + e.message, 'err', 'cp-sync-msg'); } }
function cfgClearCreds() { if (!confirm('Remove cloud credentials from this device?\n\nYour data in the cloud stays intact. You can reconnect anytime with your Master Key and Bin ID.')) return; clearCredentials(); closeCfgModal(); }
function applyGuestMode() { document.body.classList.add('guest-mode'); const badge = document.getElementById('guest-badge'); const banner = document.getElementById('guest-banner'); if (badge) badge.classList.add('visible'); if (banner) banner.classList.add('visible'); window._guestMode = true; window._origPushToCloud = window.pushToCloud; window.pushToCloud = async () => { console.log('[Guest] pushToCloud blocked'); }; setSyncStatus('ok', 'Guest View · Read-Only'); const syncBtn = document.querySelector('.sync-status'); if (syncBtn) syncBtn.style.borderColor = 'rgba(232,184,75,.3)'; }
async function cfgConnectGuest() {
  const binEl = document.getElementById('cfg-guest-bin'); const bin = binEl ? binEl.value.trim() : ''; if (!bin) { cfgBanner('⚠ Please enter the Bin ID from the dashboard owner.', 'warn', 'cfg-guest-msg'); return; }
  cfgBanner('🔄 Connecting to shared bin…', 'inf', 'cfg-guest-msg'); try {
    const payload = await jbReadPublic(bin);
    const recs = Array.isArray(payload) ? payload : (payload.records || []);
    const bsr = Array.isArray(payload) ? [] : (payload.bsr || []);
    const mpm = Array.isArray(payload) ? [] : (payload.mpm || []);
    const ftd = Array.isArray(payload) ? [] : (payload.ftd || []);
    const srt = Array.isArray(payload) ? [] : (payload.srt || []);
    saveLocal(recs);
    bsrSave(mergeByKey(bsr, bsrLoad(), t => t.id || (t.sym + '_' + t.date)));
    mpmSave(mpm);
    ftdSaveData(ftd.sort((a, b) => b.date.localeCompare(a.date)));
    srtSave(srt);
    if (typeof payload === 'object' && !Array.isArray(payload)) {
      if (payload.bsrMode) mergeBsrMode(payload.bsrMode, payload.bsrModeUpdatedAt);
      if (payload.bsrQuick) mergeBsrQuick(payload.bsrQuick);
    }
    lsSet(LS_GUEST_BIN, bin);
    cfgBanner(`✅ Connected! ${recs.length} records · ${bsr.length} BSR · ${mpm.length} MPM · ${srt.length} sectors loaded.`, 'ok', 'cfg-guest-msg');
    const exitBtn = document.getElementById('cfg-exit-guest-btn'); if (exitBtn) exitBtn.style.display = 'inline-block';
    applyGuestMode();
    renderAll();
    bsrRenderAll();
    mpmRenderAll();
    renderRPG();
    renderMarketSummary();
    renderMarketCycle();
    ftdRender();
    srtRender();
    slhRender();
    setTimeout(closeCfgModal, 2000);
  } catch (e) {
    cfgBanner('✗ ' + e.message + '\n\nMake sure the Bin is set to Public on jsonbin.io.', 'err', 'cfg-guest-msg');
  }
}
async function jbReadPublic(bin) {
  const r = await fetch(`${JB}/b/${bin}/latest`); if (!r.ok) { if (r.status === 401) throw new Error('Bin is private. Ask the owner to make it Public on jsonbin.io.'); throw new Error('Read failed: ' + r.status); }
  const j = await r.json(); return j.record || j;
}
async function guestPullData() {
  const guestBin = lsGet(LS_GUEST_BIN); if (!guestBin) { alert('No guest bin configured.'); return; }
  const btn = document.getElementById('guest-pull-btn'); if (btn) { btn.disabled = true; btn.textContent = '🔄 Pulling…'; }
  setSyncStatus('syncing', 'Syncing...'); try {
    const payload = await jbReadPublic(guestBin);
    const recs = Array.isArray(payload) ? payload : (payload.records || []);
    const bsr = Array.isArray(payload) ? [] : (payload.bsr || []);
    const mpm = Array.isArray(payload) ? [] : (payload.mpm || []);
    const ftd = Array.isArray(payload) ? [] : (payload.ftd || []);
    const srt = Array.isArray(payload) ? [] : (payload.srt || []);
    saveLocal(recs);
    bsrSave(mergeByKey(bsr, bsrLoad(), t => t.id || (t.sym + '_' + t.date)));
    mpmSave(mpm);
    ftdSaveData(ftd.sort((a, b) => b.date.localeCompare(a.date)));
    srtSave(srt);
    if (typeof payload === 'object' && !Array.isArray(payload)) {
      if (payload.bsrMode) mergeBsrMode(payload.bsrMode, payload.bsrModeUpdatedAt);
      if (payload.bsrQuick) mergeBsrQuick(payload.bsrQuick);
    }
    setSyncStatus('ok', `Guest · ${recs.length}rec · ${mpm.length}mpm · ${srt.length}sec`);
    renderAll();
    bsrRenderAll();
    mpmRenderAll();
    renderRPG();
    renderMarketSummary();
    renderMarketCycle();
    ftdRender();
    srtRender();
    slhRender();
    flash('✅ Data pulled successfully from cloud!', 'var(--lime)');
  } catch (e) {
    setSyncStatus('err', 'Guest · Pull Failed');
    flash('✗ Pull failed: ' + e.message, 'var(--red)');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '🔄 Pull Data'; }
  }
}
function cfgExitGuest() { if (!confirm('Exit Guest Mode?\n\nThis will clear the guest data from this browser. You can reconnect anytime with the Bin ID.')) return; lsDel(LS_GUEST_BIN); document.body.classList.remove('guest-mode'); window._guestMode = false; if (window._origPushToCloud) window.pushToCloud = window._origPushToCloud; const badge = document.getElementById('guest-badge'); const banner = document.getElementById('guest-banner'); if (badge) badge.classList.remove('visible'); if (banner) banner.classList.remove('visible'); saveLocal([]); bsrSave([]); mpmSave([]); ftdSaveData([]); setSyncStatus('warn', 'Not Configured · Click to Setup'); renderAll(); bsrRenderAll(); mpmRenderAll(); ftdRender(); srtRender(); slhRender(); closeCfgModal(); }
function cfgCopyGuestLink() {
  const cfg = getCfg(); if (!cfg.bin) { cfgBanner('⚠ No Bin ID configured.', 'warn', 'cp-sync-msg'); return; }
  const link = window.location.origin + window.location.pathname + '?bin=' + encodeURIComponent(cfg.bin); navigator.clipboard.writeText(link).then(() => { cfgBanner('📋 Guest share link copied to clipboard!', 'ok', 'cp-sync-msg'); }).catch(err => { try { const tempInput = document.createElement('input'); tempInput.value = link; document.body.appendChild(tempInput); tempInput.select(); document.execCommand('copy'); document.body.removeChild(tempInput); cfgBanner('📋 Guest share link copied to clipboard!', 'ok', 'cp-sync-msg'); } catch (e) { cfgBanner('✗ Copy failed. Link: ' + link, 'err', 'cp-sync-msg'); } });
}
function initGuestMode() {
  try { const urlParams = new URLSearchParams(window.location.search); const queryBin = urlParams.get('bin') || urlParams.get('guest_bin') || urlParams.get('share'); if (queryBin) { lsSet(LS_GUEST_BIN, queryBin.trim()); window.history.replaceState({}, document.title, window.location.pathname); } } catch (e) { console.error('[Guest] URL parsing failed:', e); }
  const guestBin = lsGet(LS_GUEST_BIN); if (!guestBin) return false; applyGuestMode(); const exitBtn = document.getElementById('cfg-exit-guest-btn'); if (exitBtn) exitBtn.style.display = 'inline-block'; const binEl = document.getElementById('cfg-guest-bin'); if (binEl) binEl.value = guestBin; jbReadPublic(guestBin).then(payload => {
    const recs = Array.isArray(payload) ? payload : (payload.records || []);
    const bsr = Array.isArray(payload) ? [] : (payload.bsr || []);
    const mpm = Array.isArray(payload) ? [] : (payload.mpm || []);
    const ftd = Array.isArray(payload) ? [] : (payload.ftd || []);
    const srt = Array.isArray(payload) ? [] : (payload.srt || []);
    saveLocal(recs);
    bsrSave(mergeByKey(bsr, bsrLoad(), t => t.id || (t.sym + '_' + t.date)));
    mpmSave(mpm);
    ftdSaveData(ftd.sort((a, b) => b.date.localeCompare(a.date)));
    ensureOctoberDataSeeded();
    ftdScanUndercutAll();
    srtSave(srt);
    if (typeof payload === 'object' && !Array.isArray(payload)) {
      if (payload.bsrMode) mergeBsrMode(payload.bsrMode, payload.bsrModeUpdatedAt);
      if (payload.bsrQuick) mergeBsrQuick(payload.bsrQuick);
    }
    setSyncStatus('ok', `Guest · ${recs.length}rec · ${mpm.length}mpm · ${srt.length}sec`);
    renderAll();
    bsrRenderAll();
    mpmRenderAll();
    renderRPG();
    renderMarketSummary();
    renderMarketCycle();
    ftdRender();
    renderAnalysisFTD();
    srtRender();
    slhRender();
  }).catch(e => { setSyncStatus('err', 'Guest · Pull Failed'); console.warn('[Guest] Refresh failed:', e.message); }); return true;
}

// Auto-sync across devices on tab visibility change & focus (e.g. switching back to browser on mobile)
let _lastAutoPullTime = 0;
async function pullFromCloudSilently() {
  const cfg = getCfg();
  if (!cfg.key || !cfg.bin) return;
  try {
    const raw = await jbRead(cfg.key, cfg.bin);
    const isLegacy = Array.isArray(raw);
    const cloudRecs = isLegacy ? raw : (raw.records || []);
    const cloudBsr = isLegacy ? [] : (raw.bsr || []);
    const cloudMpm = isLegacy ? [] : (raw.mpm || []);
    const cloudFtd = (typeof raw === 'object' && !Array.isArray(raw)) ? (raw.ftd || []) : [];
    const cloudSrt = (typeof raw === 'object' && !Array.isArray(raw)) ? (raw.srt || []) : [];
    saveLocal(mergeByKey(cloudRecs, loadLocal(), r => r.date));
    bsrSave(mergeByKey(cloudBsr, bsrLoad(), t => t.id || (t.sym + '_' + t.date)));
    mpmSave(mergeByKey(cloudMpm, mpmLoad(), d => d.date));
    srtSave(mergeByKey(cloudSrt, srtLoad(), s => s.id));
    const mergedFtd = mergeByKey(cloudFtd, ftdLoad(), d => d.date).sort((a, b) => b.date.localeCompare(a.date));
    ftdSaveData(mergedFtd);
    ensureOctoberDataSeeded();
    ftdScanUndercutAll();
    if (typeof raw === 'object' && !Array.isArray(raw)) {
      if (raw.bsrMode) mergeBsrMode(raw.bsrMode, raw.bsrModeUpdatedAt);
      if (raw.bsrQuick) mergeBsrQuick(raw.bsrQuick);
    }
    setSyncStatus('ok', 'Synced');
    renderAll();
    bsrRenderAll();
    mpmRenderAll();
    renderRPG();
    renderMarketSummary();
    renderMarketCycle();
    ftdRender();
    renderAnalysisFTD();
  } catch (e) {
    console.warn('[AutoSync] pull failed:', e.message);
  }
}
async function guestPullDataSilently() {
  const guestBin = lsGet(LS_GUEST_BIN);
  if (!guestBin) return;
  try {
    const payload = await jbReadPublic(guestBin);
    const recs = Array.isArray(payload) ? payload : (payload.records || []);
    const bsr = Array.isArray(payload) ? [] : (payload.bsr || []);
    const mpm = Array.isArray(payload) ? [] : (payload.mpm || []);
    const ftd = Array.isArray(payload) ? [] : (payload.ftd || []);
    const srt = Array.isArray(payload) ? [] : (payload.srt || []);
    saveLocal(recs);
    bsrSave(mergeByKey(bsr, bsrLoad(), t => t.id || (t.sym + '_' + t.date)));
    mpmSave(mpm);
    ftdSaveData(ftd.sort((a, b) => b.date.localeCompare(a.date)));
    ensureOctoberDataSeeded();
    ftdScanUndercutAll();
    srtSave(srt);
    if (typeof payload === 'object' && !Array.isArray(payload)) {
      if (payload.bsrMode) mergeBsrMode(payload.bsrMode, payload.bsrModeUpdatedAt);
      if (payload.bsrQuick) mergeBsrQuick(payload.bsrQuick);
    }
    renderAll();
    bsrRenderAll();
    mpmRenderAll();
    renderRPG();
    renderMarketSummary();
    renderMarketCycle();
    ftdRender();
    renderAnalysisFTD();
  } catch (e) {
    console.warn('[GuestAutoSync] failed:', e.message);
  }
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    const now = Date.now();
    if (now - (_lastAutoPullTime || 0) > 15000) {
      _lastAutoPullTime = now;
      if (isGuestMode()) {
        guestPullDataSilently();
      } else {
        pullFromCloudSilently();
      }
    }
  }
});
window.addEventListener('focus', () => {
  const now = Date.now();
  if (now - (_lastAutoPullTime || 0) > 15000) {
    _lastAutoPullTime = now;
    if (isGuestMode()) {
      guestPullDataSilently();
    } else {
      pullFromCloudSilently();
    }
  }
});
function openAboutModal() { document.getElementById('about-modal-overlay').classList.add('open'); }
function closeAboutModal() { document.getElementById('about-modal-overlay').classList.remove('open'); }
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    // Dismiss Watchlist Add suggest dropdown
    const suggestBox = document.getElementById('max-chart-sidebar-suggest');
    if (suggestBox && suggestBox.style.display !== 'none') {
      suggestBox.style.display = 'none';
      _sidebarSuggestActiveIdx = -1;
    }
    // Close flag popup if open
    if (typeof sccWatchlistCloseFlagPopup === 'function') sccWatchlistCloseFlagPopup();
    // Close context menu if open
    if (typeof sccWlCloseContextMenu === 'function') sccWlCloseContextMenu();
    // Close coordinates dialog if open
    if (typeof closeCoordsDialog === 'function') closeCoordsDialog();
    // Blur any focused input
    if (document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA')) {
      document.activeElement.blur();
    }
    // Deselect drawings if any
    if (typeof _selectedDrawingIndex !== 'undefined' && _selectedDrawingIndex != null) {
      _selectedDrawingIndex = null;
      if (typeof hideFloatingToolbar === 'function') hideFloatingToolbar();
      if (typeof redrawChartDrawings === 'function') redrawChartDrawings();
    }
    // Close info modal/tip
    if (typeof closeInfoTip === 'function') closeInfoTip();
    closeAboutModal();
    closeCfgModal();
    const secDrill = document.getElementById('sector-drilldown-modal');
    if (secDrill && secDrill.classList.contains('open')) {
      sectorDrillClose();
    }
    // Note: Never call closeMaximizedChart() on Escape!
  }
}); const LS_SECTOR_STOCKS = 'nse_sector_stocks_v1'; const LS_N500_CSV = 'nse_n500csv_v1'; const LS_FILTER_STOCKS_CSV = 'nse_filter_stocks_csv_v1'; let _sectorStocksCache = null; let _n500CsvCache = null; let _filterStocksCache = null; let _sdCurrentSector = ''; let _sdCurrentData = null; let _sdActiveTab = 'vcp'; let _sdSearchQuery = ''; let _sdChartsSource = 'vcp'; let _sdChartsPage = 0; let _sdChartsPerPage = 9; let _sdChartsInterval = 'D'; let _sdChartsLayout = 'auto'; let _sdAutoChartsLimit = 12; let _sdChartType = 'volume_candles'; let _sdSortBy = 'score'; let _sdMaximizedChartSymbol = null; let _sdMaximizedChartCompany = null; let _sdMaximizedChartStats = '';
// ── Max chart TV-style interaction state ──
let _maxCandles = null;          // full candle array for the maximized chart
let _maxNiftyCandles = null;
let _maxViewOffset = 0;          // bars from the right end that are hidden (pan)
let _maxBarWidth = 8;            // px per bar (zoom)
let _maxIsDragging = false;
let _maxDragStartX = 0;
let _maxDragStartOffset = 0;
let _maxRightScaleWidth = 60;
let _maxBottomHeight = 18;
let _maxVolFrac = 0.18;          // fraction of chart for volume panel
let _maxPricePad = 0.06;         // price padding fraction (vertical zoom via right-scale drag)
let _maxRsDragActive = false;    // dragging right scale (vertical zoom)
let _maxRsDragStartY = 0;
let _maxRsDragStartPad = 0.06;
let _maxBaDragActive = false;    // dragging bottom axis (horizontal zoom)
let _maxBaDragStartX = 0;
let _maxBaDragStartBw = 8;
let _sccChartSymbols = ['RELIANCE', 'TCS', 'INFY', 'HDFCBANK']; let _sccChartTimeframes = ['D', 'W', '1H', 'M']; let _sccChartLayout = '1'; let _sccChartType = 'volume_candles'; let _sccSyncSymbols = false; let _sccChartZoomFactors = [1.0, 1.0, 1.0, 1.0]; let _sccWatchlists = { "Main": ['RELIANCE', 'TCS', 'INFY', 'HDFCBANK', 'ICICIBANK', 'TATASTEEL', 'SBIN', 'BHARTIARTL', 'LT'] }; let _sccActiveWatchlist = "Main"; let _sccWatchlistSymbols = _sccWatchlists["Main"]; let _sccWatchlistData = {}; let _sccSymbolFlags = {}; let _sccShowWatchlist = true; let _sccWlSelectedSymbols = []; let _sccWlLastSelectedSymbol = null; let _sccWlCollapsedSectors = new Set(); let _sccWlOriginalOrders = {}; let _sccWlIsBreadthSorted = false; let _sccDraggedTabName = null; let _sccDraggedRowSymbol = null; let _sccTouchActive = false; let _sccTouchTimeout = null; let _sccTouchDraggedSym = null; let _sccTouchStartY = 0; let _sccTouchDraggedEl = null; let _sccFlagHoldTimeout = null; let _sccFlagHoldActive = false; try {
  const savedSyms = localStorage.getItem('_sccChartSymbols'); if (savedSyms) _sccChartSymbols = JSON.parse(savedSyms); const savedTfs = localStorage.getItem('_sccChartTimeframes'); if (savedTfs) _sccChartTimeframes = JSON.parse(savedTfs); const savedLayout = localStorage.getItem('_sccChartLayout'); if (savedLayout) _sccChartLayout = savedLayout; if (window.innerWidth <= 600 && _sccChartLayout !== 'watchlist') _sccChartLayout = '1'; const savedType = localStorage.getItem('_sccChartType'); if (savedType) _sccChartType = savedType; const savedSync = localStorage.getItem('_sccSyncSymbols'); if (savedSync) _sccSyncSymbols = JSON.parse(savedSync); const savedZooms = localStorage.getItem('_sccChartZoomFactors'); if (savedZooms) _sccChartZoomFactors = JSON.parse(savedZooms); const savedWls = localStorage.getItem('_sccWatchlists'); if (savedWls) _sccWatchlists = JSON.parse(savedWls); const savedActiveWl = localStorage.getItem('_sccActiveWatchlist'); if (savedActiveWl) _sccActiveWatchlist = savedActiveWl; const savedFlags = localStorage.getItem('_sccSymbolFlags'); if (savedFlags) _sccSymbolFlags = JSON.parse(savedFlags); if (_sccActiveWatchlist && _sccActiveWatchlist.startsWith('__flag_')) { const color = _sccActiveWatchlist.replace('__flag_', ''); _sccWatchlistSymbols = Object.keys(_sccSymbolFlags).filter(s => _sccSymbolFlags[s] === color); } else {
    if (!_sccWatchlists[_sccActiveWatchlist]) { const keys = Object.keys(_sccWatchlists); _sccActiveWatchlist = keys.length > 0 ? keys[0] : "Main"; if (keys.length === 0) { _sccWatchlists["Main"] = ['RELIANCE', 'TCS', 'INFY', 'HDFCBANK', 'ICICIBANK', 'TATASTEEL', 'SBIN', 'BHARTIARTL', 'LT']; } }
    _sccWatchlistSymbols = _sccWatchlists[_sccActiveWatchlist] || [];
  }
  const savedShowWl = localStorage.getItem('_sccShowWatchlist'); if (savedShowWl !== null) _sccShowWatchlist = savedShowWl === 'true';
} catch (e) { console.warn("Failed to load Chart tab / Watchlist localStorage preferences", e); }
function sectorDrillGetCached() { if (_sectorStocksCache) return _sectorStocksCache; try { _sectorStocksCache = JSON.parse(localStorage.getItem(LS_SECTOR_STOCKS)) || null; return _sectorStocksCache; } catch (e) { return null; } }
function sectorDrillSetCached(data) { _sectorStocksCache = data; try { localStorage.setItem(LS_SECTOR_STOCKS, JSON.stringify(data)); } catch (e) { } }
function n500CsvGetCached() { if (_n500CsvCache) return _n500CsvCache; try { _n500CsvCache = JSON.parse(localStorage.getItem(LS_N500_CSV)) || null; return _n500CsvCache; } catch (e) { return null; } }
function n500CsvSetCached(data) { _n500CsvCache = data; try { localStorage.setItem(LS_N500_CSV, JSON.stringify(data)); } catch (e) { } }
function filterStocksGetCached() { if (_filterStocksCache) return _filterStocksCache; try { _filterStocksCache = JSON.parse(localStorage.getItem(LS_FILTER_STOCKS_CSV)) || null; return _filterStocksCache; } catch (e) { return null; } }
function filterStocksSetCached(data) { _filterStocksCache = data; try { localStorage.setItem(LS_FILTER_STOCKS_CSV, JSON.stringify(data)); } catch (e) { } }
async function sdFetchSectorStocksBackground() {
  const baseUrl = vcpbGetUrl(); if (!baseUrl) return; try {
    let resp; let localSuccess = false; if (window.location.protocol === 'file:') { try { const localUrl = 'http://localhost:9090/local/sector_stocks.json?_=' + Date.now(); resp = await fetch(localUrl, { cache: 'no-store' }); if (resp.ok) localSuccess = true; } catch (e) { } }
    if (!localSuccess) { try { resp = await fetch(baseUrl + '/sector_stocks.json?_=' + Date.now(), { cache: 'no-store' }); if (!resp.ok && baseUrl.includes('localhost:9090')) throw new Error('Local down'); } catch (e) { resp = await fetch('https://mkshibu2.github.io/breadth-radar/sector_stocks.json?_=' + Date.now(), { cache: 'no-store' }); } }
    if (resp && resp.ok) { const fresh = await resp.json(); sectorDrillSetCached(fresh); calculateRSRatings(fresh); console.log('[Background] Fetched and cached sector stocks'); sccWatchlistRender(); sccWatchlistFetchAll(); }
  } catch (e) { console.warn('[Background] Failed to fetch sector stocks:', e); }
}
function findStockMetadata(symbol) {
  if (!symbol) return { company: '', rs_rating: '' }; const sUpper = symbol.toUpperCase().replace('.NS', ''); let company = ''; let rs_rating = ''; const cachedDrill = sectorDrillGetCached(); if (cachedDrill) {
    if (typeof calculateRSRatings === 'function') { calculateRSRatings(cachedDrill); }
    const activeMap = cachedDrill.sectors || cachedDrill.industries; if (activeMap) { for (const secName in activeMap) { const sec = activeMap[secName]; if (sec && Array.isArray(sec.stocks)) { const found = sec.stocks.find(x => x.symbol && x.symbol.toUpperCase() === sUpper); if (found) { company = found.company || ''; rs_rating = found.rs_rating != null ? found.rs_rating : ''; break; } } } }
  }
  if (!company) { const allStocks = n500CsvGetCached() || []; const found = allStocks.find(s => s.symbol && s.symbol.toUpperCase() === sUpper); if (found) { company = found.company || ''; } }
  if (!rs_rating && _sdCurrentData && Array.isArray(_sdCurrentData.stocks)) { const found = _sdCurrentData.stocks.find(x => x.symbol && x.symbol.toUpperCase() === sUpper); if (found) { if (!company) company = found.company || ''; rs_rating = found.rs_rating != null ? found.rs_rating : ''; } }
  return { company, rs_rating };
}
function parseN500Csv(text) {
  const lines = text.trim().split('\n'); const out = []; for (let i = 1; i < lines.length; i++) { const parts = lines[i].split(','); if (parts.length < 3) continue; const company = parts[0].trim().replace(/^"|"$/g, ''); const industry = parts[1].trim().replace(/^"|"$/g, ''); const symbol = parts[2].trim().replace(/^"|"$/g, ''); if (symbol) out.push({ symbol, company, industry }); }
  return out;
}
function parseFilterStocksCsv(text) {
  const lines = text.trim().split('\n'); const out = {}; for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim(); if (!line) continue; const parts = []; let current = ''; let inQuotes = false; for (let j = 0; j < line.length; j++) { const char = line[j]; if (char === '"') { inQuotes = !inQuotes; } else if (char === ',' && !inQuotes) { parts.push(current.trim()); current = ''; } else { current += char; } }
    parts.push(current.trim()); if (parts.length >= 12) { const symbol = parts[1].replace(/^"|"$/g, '').trim().toUpperCase(); const group = parts[11].replace(/^"|"$/g, '').trim(); if (symbol && group) { out[symbol] = group; } }
  }
  return out;
}
function csvSectorMap(symbol, company, industry) { return getMsIndustryMapping(symbol, company, industry).parentSector; }
function sdSwitchTab(tab) { _sdActiveTab = tab;['vcp', 'universe', 'charts'].forEach(t => { const btn = document.getElementById('sd-tab-' + t); if (!btn) return; const active = t === tab; btn.style.color = active ? 'var(--teal)' : 'var(--dim)'; btn.style.borderBottom = active ? '2px solid var(--teal)' : '2px solid transparent'; btn.style.fontWeight = active ? '700' : '600'; }); const body = document.getElementById('sd-body'); if (!body || !_sdCurrentSector) return; if (tab === 'vcp') sdRenderVcp(_sdCurrentSector, _sdCurrentData); if (tab === 'universe') sdRenderUniverse(_sdCurrentSector); if (tab === 'charts') { _sdAutoChartsLimit = 12; sdRenderCharts(_sdCurrentSector, _sdCurrentData); } }
function sdHandleSearch(val) {
  _sdSearchQuery = val.trim().toLowerCase(); const clearBtn = document.getElementById('sd-search-clear'); if (clearBtn) { clearBtn.style.display = val ? 'block' : 'none'; }
  const body = document.getElementById('sd-body'); if (!body || !_sdCurrentSector) return; if (_sdActiveTab === 'vcp') sdRenderVcp(_sdCurrentSector, _sdCurrentData); if (_sdActiveTab === 'universe') sdRenderUniverse(_sdCurrentSector); if (_sdActiveTab === 'charts') sdRenderCharts(_sdCurrentSector, _sdCurrentData);
}
function sdClearSearch() { const input = document.getElementById('sd-search-input'); if (input) { input.value = ''; sdHandleSearch(''); } }
let _sdFilter = 'all'; function sdSetFilter(f) { _sdFilter = f; if (_sdActiveTab === 'charts') { _sdAutoChartsLimit = 12; sdRenderCharts(_sdCurrentSector, _sdCurrentData); } else { sdRenderVcp(_sdCurrentSector, _sdCurrentData); } }
function calculateRSRatings(data) { if (!data) return; const uniqueStocks = []; const symbolMap = new Map(); const mapsToProcess = []; if (data.sectors) mapsToProcess.push(data.sectors); if (data.industries) mapsToProcess.push(data.industries); mapsToProcess.forEach(m => { for (const secName in m) { const sec = m[secName]; if (sec && Array.isArray(sec.stocks)) { sec.stocks.forEach(s => { if (!symbolMap.has(s.symbol)) { const r90 = parseFloat(s.r90) || 0; const dist52 = parseFloat(s.dist52) || 0; const drawdown = parseFloat(s.drawdown) || 0; const score = r90 * 1.5 + (100 + dist52) * 1.0 + (100 + drawdown) * 0.5; const obj = { symbol: s.symbol, score, stockRefs: [s] }; symbolMap.set(s.symbol, obj); uniqueStocks.push(obj); } else { symbolMap.get(s.symbol).stockRefs.push(s); } }); } } }); if (uniqueStocks.length === 0) return; uniqueStocks.sort((a, b) => a.score - b.score); const N = uniqueStocks.length; uniqueStocks.forEach((obj, idx) => { const rank = N > 1 ? Math.min(99, Math.max(1, Math.round((idx / (N - 1)) * 98) + 1)) : 99; obj.stockRefs.forEach(s => { s.rs_rating = rank; }); }); }
function getStockDetails(symbol) {
  if (!symbol) return { symbol: '', company: '', sector: '', industry: '', stats: null }; const sUpper = symbol.toUpperCase().replace('.NS', ''); let sector = ''; let industry = ''; let company = ''; let scanStats = null; const cached = sectorDrillGetCached(); if (cached) {
    if (typeof calculateRSRatings === 'function' && !cached._rs_calculated) { calculateRSRatings(cached); cached._rs_calculated = true; }
    if (cached.sectors) { for (const [secName, secObj] of Object.entries(cached.sectors)) { if (secObj && Array.isArray(secObj.stocks)) { const found = secObj.stocks.find(x => x.symbol && x.symbol.toUpperCase() === sUpper); if (found) { sector = secName; company = found.company || ''; scanStats = found; break; } } } }
    if (cached.industries) { for (const [indName, indObj] of Object.entries(cached.industries)) { if (indObj && Array.isArray(indObj.stocks)) { const found = indObj.stocks.find(x => x.symbol && x.symbol.toUpperCase() === sUpper); if (found) { industry = indName; if (!company) company = found.company || ''; if (!scanStats) scanStats = found; break; } } } }
  }
  if (!sector || !industry || !company) { const allStocks = n500CsvGetCached() || []; const found = allStocks.find(s => s.symbol && s.symbol.toUpperCase() === sUpper); if (found) { if (!company) company = found.company || ''; const mapping = getMsIndustryMapping(found.symbol, found.company, found.industry); if (!sector) sector = mapping.parentSector || 'Diversified'; if (!industry) industry = mapping.industryGroup || found.industry || ''; } }
  if (!sector || !industry) { const mapping = getMsIndustryMapping(sUpper, company, ''); if (!sector) sector = mapping.parentSector || 'Diversified'; if (!industry) industry = mapping.industryGroup || ''; }
  if (industry.endsWith(' IN')) { industry = industry.slice(0, -3); }
  return { symbol: sUpper, company: company, sector: sector, industry: industry, stats: scanStats };
}
function generateStatsTableHtml(details) {
  const stats = details.stats; const fmt = (val, isPct = false) => {
    if (val == null || isNaN(val)) return '—'; const num = parseFloat(val); if (isPct) { return (num >= 0 ? '+' : '') + num.toFixed(1) + '%'; }
    return num.toFixed(1);
  }; const r90Val = stats ? fmt(stats.r90, true) : '—'; const dist52Val = stats ? fmt(stats.dist52, true) : '—'; const ddVal = stats ? fmt(stats.drawdown, true) : '—'; const setupVal = stats ? (stats.setup || '—') : '—'; const rsVal = stats ? (stats.rs_rating != null ? Math.round(stats.rs_rating) : '—') : '—'; const scoreVal = stats ? (stats.final_score != null ? Math.round(stats.final_score) : '—') : '—'; const gradeVal = stats ? (stats.grade || '—') : '—'; const getGradeColor = (g) => { const colors = { 'A+': '#2dd4bf', 'A': '#4ade80', 'B': '#fbbf24', 'C': '#fb923c', 'REJECT': '#f87171' }; return colors[g] || 'var(--dim)'; }; const gradeColor = getGradeColor(gradeVal); const r90Color = stats && stats.r90 >= 50 ? '#4ade80' : (stats && stats.r90 >= 30 ? '#fbbf24' : (stats && stats.r90 < 0 ? '#f87171' : 'var(--text)')); const ddColor = stats && stats.drawdown >= -5 ? '#4ade80' : (stats && stats.drawdown >= -15 ? '#fbbf24' : '#f87171'); return `
    <table style="width:100%; border-collapse:collapse; font-size:10px; text-align:center; table-layout: fixed; background:var(--bg3);">
      <thead>
        <tr style="color:var(--dim); font-size:8px; text-transform:uppercase; letter-spacing:0.3px; background:rgba(0,0,0,0.25); border-bottom: 1px solid var(--border);">
          <th style="padding:4px 2px; border-right:1px solid var(--border); font-weight:600; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">90D%</th>
          <th style="padding:4px 2px; border-right:1px solid var(--border); font-weight:600; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">52W%</th>
          <th style="padding:4px 2px; border-right:1px solid var(--border); font-weight:600; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">DD%</th>
          <th style="padding:4px 2px; border-right:1px solid var(--border); font-weight:600; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; width: 30%;">Setup</th>
          <th style="padding:4px 2px; border-right:1px solid var(--border); font-weight:600; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">RS</th>
          <th style="padding:4px 2px; border-right:1px solid var(--border); font-weight:600; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">Score</th>
          <th style="padding:4px 2px; font-weight:600; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">Grade</th>
        </tr>
      </thead>
      <tbody>
        <tr style="height: 24px;">
          <td style="padding:4px 2px; border-right:1px solid var(--border); font-family:var(--mono); color:${r90Color}; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${r90Val}</td>
          <td style="padding:4px 2px; border-right:1px solid var(--border); font-family:var(--mono); color:#60a5fa; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${dist52Val}</td>
          <td style="padding:4px 2px; border-right:1px solid var(--border); font-family:var(--mono); color:${ddColor}; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${ddVal}</td>
          <td style="padding:4px 2px; border-right:1px solid var(--border); font-weight:600; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:9px; color:var(--text);" title="${setupVal}">${setupVal}</td>
          <td style="padding:4px 2px; border-right:1px solid var(--border); font-family:var(--mono); color:#fb923c; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${rsVal}</td>
          <td style="padding:4px 2px; border-right:1px solid var(--border); font-family:var(--mono); color:var(--teal); font-weight:bold; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${scoreVal}</td>
          <td style="padding:4px 2px; font-weight:bold; color:${gradeColor}; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
            <span style="background:${gradeColor}15; border:1px solid ${gradeColor}30; padding:1px 4px; border-radius:3px; font-size:9px;">${gradeVal}</span>
          </td>
        </tr>
      </tbody>
    </table>
  `;
}
function openMaximizedChart(symbol) {
  setTimeout(() => {
    if (typeof updateMaxChartSidebarWatchlist === 'function') updateMaxChartSidebarWatchlist();
  }, 50);
  updateWinPillStyles();
  updateWinLegendLabels();
  const overlay = document.getElementById('chart-max-overlay'); const maxSymbol = document.getElementById('max-chart-symbol'); const maxCompany = document.getElementById('max-chart-company'); const maxStats = document.getElementById('max-chart-stats'); const loader = document.getElementById('max-chart-loader'); const tfSelect = document.getElementById('max-chart-timeframe'); const typeSelect = document.getElementById('max-chart-type'); if (!overlay) return; _sdMaximizedChartSymbol = symbol; _maxViewOffset = 0;// reset pan on new symbol
  if (tfSelect) tfSelect.value = _sdChartsInterval; if (typeSelect) typeSelect.value = _sdChartType; const details = getStockDetails(symbol); let statsHtml = ''; if (details.stats) { const s = details.stats; const rsVal = s.rs_rating != null ? s.rs_rating : '—'; const score = s.final_score > 0 ? s.final_score : s.vcp_score; statsHtml = score != null ? `RS: <b style="color:var(--purple)">${rsVal}</b> · Score: <b style="color:var(--teal)">${Math.round(score)}</b>` : `RS: <b style="color:var(--purple)">${rsVal}</b>`; }
  _sdMaximizedChartCompany = details.company; _sdMaximizedChartStats = statsHtml; if (maxSymbol) maxSymbol.textContent = details.symbol; if (maxCompany) { maxCompany.innerHTML = `<span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:200px;">${details.company || '—'}</span><span style="font-size:10px;color:var(--dim);background:rgba(255,255,255,0.04);border:1px solid var(--border);padding:1px 6px;border-radius:3px;font-weight:500;white-space:nowrap;flex-shrink:0;">${details.sector}</span><span style="font-size:10px;color:var(--sub);font-weight:500;white-space:nowrap;flex-shrink:0;">${details.industry}</span>`; }
  if (maxStats) maxStats.innerHTML = statsHtml || ''; const maxTableContainer = document.getElementById('max-chart-table-container'); if (maxTableContainer) { maxTableContainer.innerHTML = generateStatsTableHtml(details); }
  if (loader) { loader.style.display = 'flex'; loader.innerHTML = 'Loading chart…'; }
  _selectedDrawingIndex = null;
  if (typeof hideFloatingToolbar === 'function') hideFloatingToolbar();
  if (typeof initChartDrawingCanvas === 'function') initChartDrawingCanvas();
  if (typeof renderMaxChartEpsTable === 'function') renderMaxChartEpsTable(symbol);
  overlay.style.display = 'flex'; _maxFetchAndDraw(symbol);
}
function _maxFetchAndDraw(symbol) {
  if (typeof fetchStockFundamentals === 'function' && symbol && symbol.toUpperCase() !== '^NSEI') {
    fetchStockFundamentals(symbol).catch(() => null);
  }
  const loader = document.getElementById('max-chart-loader');
  if (loader) { loader.style.display = 'flex'; loader.innerHTML = 'Loading chart…'; }

  const is15m = (_sdChartsInterval === '15m');
  const is1H = (_sdChartsInterval === '1H');
  const isW = (_sdChartsInterval === 'W');
  const isM = (_sdChartsInterval === 'M');

  const range = is15m ? '60d' :
                is1H ? '730d' :
                isW ? '10y' :
                isM ? 'max' : '5y';
  const interval = is15m ? '15m' :
                   is1H ? '60m' :
                   isW ? '1wk' :
                   isM ? '1mo' : '1d';

  // Primary Candle Fetcher (Dhan HQ API or Yahoo Finance)
  let candlePromise;
  if (_chartDataSource === 'dhan') {
    candlePromise = fetchDhanCandles(symbol, range, interval).catch(err => {
      console.warn('[Dhan API] Could not load candles:', err.message);
      showChartToast('⚡ Dhan: ' + err.message + ' (Using YF fallback)', '#f59e0b');
      // If token missing, prompt user
      if (err.message.includes('token') || err.message.includes('Client ID') || err.message.includes('401')) {
        openDhanConnectModal();
      }
      return fetchYfData(symbol, range, interval);
    });
  } else {
    candlePromise = fetchYfData(symbol, range, interval);
  }

  const niftyPromise = (symbol.toUpperCase() !== '^NSEI') ? fetchYfData('^NSEI', range, interval).catch(() => null) : Promise.resolve(null);

  Promise.all([candlePromise, niftyPromise]).then(([candles, niftyCandles]) => {
    if (loader) loader.style.display = 'none';
    _maxCandles = candles;
    _maxNiftyCandles = niftyCandles;
    drawMaxChart();
    _maxSetupInteraction();
  }).catch(err => {
    console.error("Max Chart Error", err);
    if (loader) {
      loader.innerHTML = '<div style="color:var(--sub);font-size:11px;text-align:center;padding:12px;line-height:1.5;max-width:280px;margin:0 auto;"><span style="color:var(--red);font-weight:600;display:block;margin-bottom:6px;">Failed to load chart data</span>Check your internet connection or data source.</div>';
    }
  });
}
function drawMaxChartLightweight() {
  const container = document.getElementById('max-chart-lw-container');
  if (!container || !_maxCandles || _maxCandles.length === 0 || typeof LightweightCharts === 'undefined') return false;

  if (_maxLwChart) {
    try { _maxLwChart.remove(); } catch (e) { }
    _maxLwChart = null;
  }
  container.innerHTML = '';

  const rect = container.getBoundingClientRect();
  const width = rect.width || container.clientWidth || 800;
  const height = rect.height || container.clientHeight || 500;

  const sorted = [..._maxCandles].sort((a, b) => a.time - b.time);
  const seenTimes = new Set();
  const cleanCandles = [];
  for (const c of sorted) {
    const tSec = Math.floor(c.time / 1000);
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
  if (cleanCandles.length === 0) return false;

  _maxLwChart = LightweightCharts.createChart(container, {
    width: width,
    height: height,
    layout: {
      background: { color: '#050508' },
      textColor: '#94a3b8',
      fontFamily: "'Inter', sans-serif",
      fontSize: 11,
    },
    grid: {
      vertLines: { color: 'rgba(255, 255, 255, 0.03)' },
      horzLines: { color: 'rgba(255, 255, 255, 0.03)' },
    },
    crosshair: {
      mode: LightweightCharts.CrosshairMode.Normal,
      vertLine: { color: 'rgba(91, 163, 245, 0.4)', width: 1, style: 2 },
      horzLine: { color: 'rgba(91, 163, 245, 0.4)', width: 1, style: 2 },
    },
    rightPriceScale: {
      borderColor: 'rgba(255, 255, 255, 0.08)',
      scaleMargins: { top: 0.1, bottom: 0.22 },
    },
    timeScale: {
      borderColor: 'rgba(255, 255, 255, 0.08)',
      timeVisible: _sdChartsInterval === '1H',
      secondsVisible: false,
    },
  });

  let priceSeries;
  if (_sdChartType === 'ohlc') {
    priceSeries = _maxLwChart.addBarSeries({
      upColor: '#26a69a',
      downColor: '#ef5350',
      wickVisible: true,
    });
  } else {
    priceSeries = _maxLwChart.addCandlestickSeries({
      upColor: '#26a69a',
      downColor: '#ef5350',
      borderVisible: false,
      wickUpColor: '#26a69a',
      wickDownColor: '#ef5350',
    });
  }
  priceSeries.setData(cleanCandles);
  _maxLwPriceSeries = priceSeries;

  const volSeries = _maxLwChart.addHistogramSeries({
    priceFormat: { type: 'volume' },
    priceScaleId: 'vol_scale',
  });
  _maxLwChart.priceScale('vol_scale').applyOptions({
    scaleMargins: { top: 0.82, bottom: 0 },
    visible: false,
  });
  // VCP & Pocket Pivot Volume Color Hierarchy
  const volPeriod = 50;
  const avgVols = [];
  let volSum = 0;
  for (let i = 0; i < cleanCandles.length; i++) {
    volSum += cleanCandles[i].volume;
    if (i >= volPeriod) {
      volSum -= cleanCandles[i - volPeriod].volume;
      avgVols.push(volSum / volPeriod);
    } else {
      avgVols.push(volSum / (i + 1));
    }
  }

  const volData = cleanCandles.map((c, i) => {
    const curVol = c.volume;
    const avg = avgVols[i] || 1;
    const isUp = c.close >= c.open;

    // Lookback 20 bars for lowest and highest volume
    const windowStart = Math.max(0, i - 19);
    const windowBars = cleanCandles.slice(windowStart, i + 1);
    let minVol = Infinity;
    let maxVol = -Infinity;
    for (const b of windowBars) {
      if (b.volume > 0) {
        if (b.volume < minVol) minVol = b.volume;
        if (b.volume > maxVol) maxVol = b.volume;
      }
    }

    // Down bars in previous 10 days for Pocket Pivot test
    const downBars10 = cleanCandles.slice(Math.max(0, i - 10), i).filter(b => b.close < b.open);
    const maxDownVol10 = downBars10.length ? Math.max(...downBars10.map(b => b.volume)) : 0;
    const isPocketPivot = isUp && curVol > maxDownVol10 && curVol >= avg * 1.05;

    let col;
    // 1. Highest volume day in lookback OR Pocket Pivot -> Blue (#2196f3)
    if ((curVol >= maxVol && curVol >= avg) || isPocketPivot) {
      col = '#2196f3';
    }
    // 2. Lowest volume day (Dry Volume / VDU) in lookback -> Yellow (#ffeb3b)
    else if (curVol <= minVol && curVol < avg) {
      col = '#ffeb3b';
    }
    // 3. Low volume day (below average volume) -> Gray
    else if (curVol < avg) {
      col = 'rgba(148, 163, 184, 0.45)';
    }
    // 4. Power Volume (extreme surge >= 1.75x average) -> Power Volume Up / Down (#c8e6ca / #fbc4bd)
    else if (curVol >= avg * 1.75) {
      col = isUp ? '#c8e6ca' : '#fbc4bd';
    }
    // 5. Above average Up day -> High Up Green (#4caf50)
    else if (isUp) {
      col = '#4caf50';
    }
    // 6. Above average Down day -> High Down Red (#f23645)
    else {
      col = '#f23645';
    }

    return {
      time: c.time,
      value: c.volume,
      color: col
    };
  });
  volSeries.setData(volData);

  const isWeekly = (_sdChartsInterval === 'W');
  const isDaily = (_sdChartsInterval === 'D');

  const inp = _winConfig.inputs;
  const st = _winConfig.style;

  const ema10Vals = calculateEMA(cleanCandles, inp.ema1Period);
  const ema20Vals = calculateEMA(cleanCandles, inp.ema2Period);
  const sma50Vals = calculateSMA(cleanCandles, inp.sma1Period);
  const sma200Vals = calculateSMA(cleanCandles, inp.sma2Period);
  const sma30wVals = calculateSMA(cleanCandles, inp.sma30wPeriod);
  const avgVolVals = calculateAvgVol(cleanCandles, inp.volLen);

  // EMA 1
  const ema10Map = new Map();
  if (st.ema10 && st.ema10.visible) {
    const data = [];
    for (let i = 0; i < cleanCandles.length; i++) {
      if (ema10Vals[i] != null) {
        data.push({ time: cleanCandles[i].time, value: ema10Vals[i] });
        ema10Map.set(cleanCandles[i].time, ema10Vals[i]);
      }
    }
    const s = _maxLwChart.addLineSeries({
      color: typeof hexToRgba === 'function' ? hexToRgba(st.ema10.color || '#3b82f6', (st.ema10.opacity != null ? st.ema10.opacity : 100) / 100) : (st.ema10.color || '#3b82f6'),
      lineWidth: st.ema10.width || 1.5,
      lineStyle: st.ema10.lineStyle || 0,
      priceLineVisible: false,
      lastValueVisible: false,
      title: ''
    });
    s.setData(data);
  }

  // EMA 2
  const ema20Map = new Map();
  if (st.ema20 && st.ema20.visible) {
    const data = [];
    for (let i = 0; i < cleanCandles.length; i++) {
      if (ema20Vals[i] != null) {
        data.push({ time: cleanCandles[i].time, value: ema20Vals[i] });
        ema20Map.set(cleanCandles[i].time, ema20Vals[i]);
      }
    }
    const s = _maxLwChart.addLineSeries({
      color: typeof hexToRgba === 'function' ? hexToRgba(st.ema20.color || '#ef4444', (st.ema20.opacity != null ? st.ema20.opacity : 100) / 100) : (st.ema20.color || '#ef4444'),
      lineWidth: st.ema20.width || 1.5,
      lineStyle: st.ema20.lineStyle || 0,
      priceLineVisible: false,
      lastValueVisible: false,
      title: ''
    });
    s.setData(data);
  }

  // SMA 1 (Daily only)
  const sma50Map = new Map();
  if (st.sma50 && st.sma50.visible && !isWeekly) {
    const data = [];
    for (let i = 0; i < cleanCandles.length; i++) {
      if (sma50Vals[i] != null) {
        data.push({ time: cleanCandles[i].time, value: sma50Vals[i] });
        sma50Map.set(cleanCandles[i].time, sma50Vals[i]);
      }
    }
    const s = _maxLwChart.addLineSeries({
      color: typeof hexToRgba === 'function' ? hexToRgba(st.sma50.color || '#06b6d4', (st.sma50.opacity != null ? st.sma50.opacity : 100) / 100) : (st.sma50.color || '#06b6d4'),
      lineWidth: st.sma50.width || 1.5,
      lineStyle: st.sma50.lineStyle || 0,
      priceLineVisible: false,
      lastValueVisible: false,
      title: ''
    });
    s.setData(data);
  }

  // SMA 2 (Daily only)
  const sma200Map = new Map();
  if (st.sma200 && st.sma200.visible && !isWeekly) {
    const data = [];
    for (let i = 0; i < cleanCandles.length; i++) {
      if (sma200Vals[i] != null) {
        data.push({ time: cleanCandles[i].time, value: sma200Vals[i] });
        sma200Map.set(cleanCandles[i].time, sma200Vals[i]);
      }
    }
    const s = _maxLwChart.addLineSeries({
      color: typeof hexToRgba === 'function' ? hexToRgba(st.sma200.color || '#22c55e', (st.sma200.opacity != null ? st.sma200.opacity : 100) / 100) : (st.sma200.color || '#22c55e'),
      lineWidth: st.sma200.width || 2,
      lineStyle: st.sma200.lineStyle || 0,
      priceLineVisible: false,
      lastValueVisible: false,
      title: ''
    });
    s.setData(data);
  }

  // SMA 30W (Weekly only)
  const sma30wMap = new Map();
  if (st.sma30w && st.sma30w.visible && isWeekly) {
    const data = [];
    for (let i = 0; i < cleanCandles.length; i++) {
      if (sma30wVals[i] != null) {
        data.push({ time: cleanCandles[i].time, value: sma30wVals[i] });
        sma30wMap.set(cleanCandles[i].time, sma30wVals[i]);
      }
    }
    const s = _maxLwChart.addLineSeries({
      color: typeof hexToRgba === 'function' ? hexToRgba(st.sma30w.color || '#f97316', (st.sma30w.opacity != null ? st.sma30w.opacity : 100) / 100) : (st.sma30w.color || '#f97316'),
      lineWidth: st.sma30w.width || 2,
      lineStyle: st.sma30w.lineStyle || 0,
      priceLineVisible: false,
      lastValueVisible: false,
      title: ''
    });
    s.setData(data);
  }

  // RS Nifty
  const rsMap = new Map();
  if (st.rs && st.rs.visible && _maxNiftyCandles && _maxNiftyCandles.length > 0) {
    const nMap = new Map();
    for (const nc of _maxNiftyCandles) {
      nMap.set(new Date(nc.time).toISOString().split('T')[0], nc.close);
    }
    const rsData = [];
    for (const c of cleanCandles) {
      const dStr = new Date(c.time * 1000).toISOString().split('T')[0];
      const nClose = nMap.get(dStr);
      if (nClose != null && nClose > 0) {
        const ratio = (c.close / nClose) * 1000;
        rsData.push({ time: c.time, value: ratio });
        rsMap.set(c.time, ratio);
      }
    }
    if (rsData.length > 0) {
      const rsSeries = _maxLwChart.addLineSeries({
        color: typeof hexToRgba === 'function' ? hexToRgba(st.rs.color || '#38bdf8', (st.rs.opacity != null ? st.rs.opacity : 100) / 100) : (st.rs.color || '#38bdf8'),
        lineWidth: st.rs.width || 1.8,
        lineStyle: st.rs.lineStyle || 0,
        priceScaleId: 'rs_scale',
        priceLineVisible: false,
        lastValueVisible: false,
        title: '',
      });
      _maxLwChart.priceScale('rs_scale').applyOptions({
        scaleMargins: { top: 0.05, bottom: 0.70 },
        visible: false,
      });
      rsSeries.setData(rsData);
    }
  }

  // WIN Markers
  if (st.dots && st.dots.visible) {
    const markers = calculateWinMarkers(cleanCandles, ema10Vals, avgVolVals, isDaily);
    priceSeries.setMarkers(markers);
  } else {
    priceSeries.setMarkers([]);
  }

  // Volume Trigger V4 / GTT Line
  const vt = calcVolumeTrigger(cleanCandles, inp.vtLookback, inp.vtRows, inp.vtHvnPct, inp.vtLvnPct);
  if (st.vt && st.vt.visible && isDaily && vt && vt.isAboveClose) {
    priceSeries.createPriceLine({
      price: vt.price,
      color: typeof hexToRgba === 'function' ? hexToRgba(st.vt.color || '#4863fc', (st.vt.opacity != null ? st.vt.opacity : 100) / 100) : (st.vt.color || '#4863fc'),
      lineWidth: st.vt.width || 1.2,
      lineStyle: st.vt.lineStyle != null ? st.vt.lineStyle : LightweightCharts.LineStyle.Dashed,
      axisLabelVisible: false,
      title: '',
    });
  }

  // Floating OHLC tooltip
  const tipEl = document.getElementById('max-chart-ohlc-tip');
  const resetBtn = document.getElementById('max-chart-reset-btn');
  if (resetBtn) resetBtn.style.display = 'flex';

  const formatTip = (time, bar, vol) => {
    if (!tipEl || !bar) return;
    const d = new Date(time * 1000);
    const dateStr = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    const isUp = bar.close >= bar.open;
    const col = isUp ? 'var(--lime)' : 'var(--red)';
    const pct = (((bar.close - bar.open) / bar.open) * 100).toFixed(2);
    const sign = isUp ? '+' : '';
    let volStr = vol != null ? fVolFormat(vol) : '';

    tipEl.style.display = 'block';
    tipEl.innerHTML = `
      <span style="color:var(--text);font-weight:700;margin-right:8px;">${dateStr}</span>
      O: <b style="color:var(--sub)">${bar.open.toFixed(1)}</b>&nbsp;
      H: <b style="color:var(--sub)">${bar.high.toFixed(1)}</b>&nbsp;
      L: <b style="color:var(--sub)">${bar.low.toFixed(1)}</b>&nbsp;
      C: <b style="color:${col}">${bar.close.toFixed(1)} (${sign}${pct}%)</b>&nbsp;
      ${volStr ? `Vol: <b style="color:var(--sub)">${volStr}</b>` : ''}
    `;
  };

  const lastC = cleanCandles[cleanCandles.length - 1];
  formatTip(lastC.time, lastC, lastC.volume);

  _maxLwChart.subscribeCrosshairMove(param => {
    if (!param || !param.time || !param.seriesData.get(priceSeries)) {
      formatTip(lastC.time, lastC, lastC.volume);
      return;
    }
    const bar = param.seriesData.get(priceSeries);
    const vol = volSeries ? param.seriesData.get(volSeries)?.value : null;
    formatTip(param.time, bar, vol);
  });

  // Render WIN HUD Table in modal
  const tableContainer = document.getElementById('max-chart-table-container');
  if (tableContainer) {
    if (!st.hud || !st.hud.visible) {
      tableContainer.style.display = 'none';
    } else {
      tableContainer.style.display = 'block';
      const details = typeof getStockDetails === 'function' && _sdMaximizedChartSymbol ? getStockDetails(_sdMaximizedChartSymbol) : { symbol: _sdMaximizedChartSymbol };
      tableContainer.innerHTML = renderWinHudTableHtml(cleanCandles, details, vt);
    }
  }

  _maxLwChart.timeScale().fitContent();

  try {
    _maxLwChart.timeScale().subscribeVisibleLogicalRangeChange(() => {
      redrawChartDrawings();
      if (typeof updateFloatingToolbar === 'function') updateFloatingToolbar();
    });
  } catch (e) { }
  if (typeof initChartDrawingCanvas === 'function') initChartDrawingCanvas();
  if (typeof redrawChartDrawings === 'function') redrawChartDrawings();
  if (typeof renderMaxChartEpsTable === 'function') renderMaxChartEpsTable(_sdMaximizedChartSymbol);

  if (_maxLwResizeObserver) {
    try { _maxLwResizeObserver.disconnect(); } catch (e) { }
  }
  _maxLwResizeObserver = new ResizeObserver(entries => {
    if (!entries || !entries.length || !_maxLwChart) return;
    const cr = entries[0].contentRect;
    if (cr.width > 0 && cr.height > 0) {
      _maxLwChart.applyOptions({ width: cr.width, height: cr.height });
      if (typeof syncCanvasSize === 'function') syncCanvasSize();
      if (typeof redrawChartDrawings === 'function') redrawChartDrawings();
      if (typeof updateFloatingToolbar === 'function') updateFloatingToolbar();
    }
  });
  _maxLwResizeObserver.observe(container);
  return true;
}

function drawMaxChart() {
  if (typeof LightweightCharts !== 'undefined' && document.getElementById('max-chart-lw-container')) {
    if (drawMaxChartLightweight()) return;
  }
  const canvas = document.getElementById('max-chart-canvas');
  if (!canvas || !_maxCandles || _maxCandles.length === 0) return;
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  const targetW = Math.round(rect.width * dpr);
  const targetH = Math.round(rect.height * dpr);
  if (canvas.width !== targetW || canvas.height !== targetH) {
    canvas.width = targetW;
    canvas.height = targetH;
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const W = rect.width, H = rect.height;
  const RSW = _maxRightScaleWidth, BAH = _maxBottomHeight;
  const chartW = W - RSW, chartH = H - BAH;
  const volPanelH = Math.round(chartH * _maxVolFrac);
  const priceH = chartH - volPanelH - 1;

  const barsVisible = Math.max(10, Math.floor(chartW / _maxBarWidth));
  const total = _maxCandles.length;
  _maxViewOffset = Math.max(-15, Math.min(_maxViewOffset, total - 5));

  const barSlot = chartW / barsVisible;
  const barX = (slot) => slot * barSlot + barSlot / 2;

  const fullEma20 = calculateEMA(_maxCandles, 20);
  const exactStartCandle = total - 1 - _maxViewOffset - (barsVisible - 1);
  const startCandleIdx = Math.floor(exactStartCandle);

  const slotItems = [];
  const visCandles = [];
  for (let s = 0; s < barsVisible; s++) {
    const cIdx = startCandleIdx + s;
    if (cIdx >= 0 && cIdx < total) {
      const c = _maxCandles[cIdx];
      const ema = fullEma20[cIdx];
      const item = { candle: c, ema: ema, slot: s, globalIdx: cIdx };
      slotItems[s] = item;
      visCandles.push(item);
    } else {
      slotItems[s] = null;
    }
  }

  if (visCandles.length === 0) return;

  let minP = Infinity, maxP = -Infinity, maxVol = 0;
  for (const item of visCandles) {
    const c = item.candle;
    if (c.low < minP) minP = c.low;
    if (c.high > maxP) maxP = c.high;
    if (c.volume > maxVol) maxVol = c.volume;
    if (item.ema != null) {
      if (item.ema < minP) minP = item.ema;
      if (item.ema > maxP) maxP = item.ema;
    }
  }
  const pad = (maxP - minP) * _maxPricePad;
  minP -= pad; maxP += pad;
  const pRange = maxP - minP || 1;
  const pxY = (price) => priceH - ((price - minP) / pRange) * priceH;

  // ── backgrounds ──
  ctx.fillStyle = '#050508'; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#070810'; ctx.fillRect(0, priceH + 1, chartW, volPanelH);
  ctx.strokeStyle = 'rgba(255,255,255,0.06)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(0, priceH); ctx.lineTo(chartW, priceH); ctx.stroke();
  ctx.fillStyle = '#0a0b10'; ctx.fillRect(chartW, 0, RSW, chartH);
  ctx.strokeStyle = 'rgba(255,255,255,0.07)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(chartW, 0); ctx.lineTo(chartW, chartH); ctx.stroke();

  // ── price grid ──
  ctx.strokeStyle = 'rgba(255,255,255,0.035)';
  const gridCount = 6;
  for (let i = 0; i <= gridCount; i++) {
    const price = minP + (pRange / gridCount) * i;
    const y = pxY(price);
    if (y < 0 || y > priceH) continue;
    ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(chartW, y); ctx.stroke();
    ctx.fillStyle = '#3d5166'; ctx.font = '9px monospace'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText(price.toFixed(price > 1000 ? 0 : 1), chartW + 5, y);
  }

  // ── volume bars ──
  const avgVol = visCandles.reduce((sum, it) => sum + it.candle.volume, 0) / visCandles.length;
  const volTop = priceH + 1;
  for (const item of visCandles) {
    const c = item.candle;
    const isUp = c.close >= c.open;
    let bw = Math.max(1, barSlot * 0.7);
    if (_sdChartType === 'volume_candles') { const vf = Math.min(2.5, Math.max(0.4, (c.volume / (avgVol || 1)))); bw = Math.max(1, barSlot * 0.7 * vf); }
    const barH = maxVol > 0 ? (c.volume / maxVol) * (volPanelH - 2) : 0;
    const x = barX(item.slot);
    ctx.fillStyle = isUp ? 'rgba(38,166,154,0.35)' : 'rgba(239,83,80,0.35)';
    ctx.fillRect(x - bw / 2, volTop + volPanelH - barH, bw, barH);
  }
  ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.font = '8px monospace'; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  ctx.fillText('VOL', chartW + 5, volTop + 2);

  // ── candles ──
  const cw = Math.max(1, barSlot * 0.68);
  for (const item of visCandles) {
    const c = item.candle;
    const isUp = c.close >= c.open;
    const col = isUp ? '#26a69a' : '#ef5350';
    const x = barX(item.slot);
    const yO = pxY(c.open), yC = pxY(c.close), yH = pxY(c.high), yL = pxY(c.low);
    ctx.strokeStyle = col; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x, yH); ctx.lineTo(x, yL); ctx.stroke();
    let bw = cw;
    if (_sdChartType === 'volume_candles') { const vf = Math.min(2.5, Math.max(0.4, (c.volume / (avgVol || 1)))); bw = Math.max(1, cw * vf); }
    if (_sdChartType === 'ohlc') {
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(x - bw / 2, yO); ctx.lineTo(x, yO); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x, yC); ctx.lineTo(x + bw / 2, yC); ctx.stroke();
    } else {
      const bodyH = Math.abs(yC - yO) || 1;
      ctx.fillStyle = col; ctx.fillRect(x - bw / 2, Math.min(yO, yC), bw, bodyH);
    }
  }

  // ── EMA20 ──
  ctx.strokeStyle = 'rgba(239,68,68,0.6)'; ctx.lineWidth = 1.3; ctx.beginPath();
  let fE = true;
  for (let s = 0; s < barsVisible; s++) {
    const item = slotItems[s];
    if (item && item.ema != null) {
      const x = barX(s); const y = pxY(item.ema);
      if (fE) { ctx.moveTo(x, y); fE = false; } else ctx.lineTo(x, y);
    }
  }
  ctx.stroke();

  // ── RS line ──
  if (_maxNiftyCandles && _maxNiftyCandles.length > 0) {
    const nMap = new Map();
    for (const nc of _maxNiftyCandles) nMap.set(new Date(nc.time).toISOString().split('T')[0], nc.close);
    const rsVals = slotItems.map(it => { if (!it) return null; const n = nMap.get(new Date(it.candle.time).toISOString().split('T')[0]); return (n && n > 0) ? it.candle.close / n : null; });
    let minRS = Infinity, maxRS = -Infinity;
    rsVals.forEach(v => { if (v != null) { if (v < minRS) minRS = v; if (v > maxRS) maxRS = v; } });
    if (minRS !== Infinity && minRS !== maxRS) {
      const rsRange = maxRS - minRS;
      const rsY = (v) => priceH * 0.85 - ((v - minRS) / rsRange) * (priceH * 0.55);
      ctx.strokeStyle = 'rgba(56,189,248,0.5)'; ctx.lineWidth = 1.3; ctx.beginPath();
      let fR = true;
      rsVals.forEach((v, s) => { if (v != null) { const x = barX(s); const y = rsY(v); if (fR) { ctx.moveTo(x, y); fR = false; } else ctx.lineTo(x, y); } });
      ctx.stroke();
      ctx.fillStyle = 'rgba(56,189,248,0.55)'; ctx.font = '9px sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      ctx.fillText('RS Line (vs Nifty 50)', 6, priceH * 0.28);
    }
  }

  // ── date axis ──
  ctx.fillStyle = '#07080d'; ctx.fillRect(0, chartH, W, BAH);
  ctx.strokeStyle = 'rgba(255,255,255,0.05)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(0, chartH); ctx.lineTo(W, chartH); ctx.stroke();
  ctx.fillStyle = '#3d5166'; ctx.font = '9px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  let lastLbl = '';
  for (let s = 0; s < barsVisible; s++) {
    const item = slotItems[s];
    if (!item) continue;
    const d = new Date(item.candle.time);
    let lbl = d.toLocaleString('default', { month: 'short' });
    if (d.getMonth() === 0 || s === 0) lbl += ` ${d.getFullYear().toString().slice(2)}`;
    if (lbl !== lastLbl) {
      const x = barX(s);
      if (x > 30 && x < chartW - 20) {
        ctx.fillText(lbl, x, chartH + BAH / 2); lastLbl = lbl;
        ctx.strokeStyle = 'rgba(255,255,255,0.07)'; ctx.beginPath(); ctx.moveTo(x, chartH); ctx.lineTo(x, chartH + 3); ctx.stroke();
      }
    }
  }

  // last price tag on right scale
  const lastItem = visCandles[visCandles.length - 1];
  if (lastItem) {
    const lastC = lastItem.candle;
    const ly = pxY(lastC.close);
    const isUp = lastC.close >= lastC.open;
    ctx.fillStyle = isUp ? '#26a69a' : '#ef5350';
    ctx.fillRect(chartW + 1, ly - 10, RSW - 2, 20);
    ctx.fillStyle = '#fff'; ctx.font = 'bold 10px monospace'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText(lastC.close.toFixed(lastC.close > 1000 ? 1 : 2), chartW + 5, ly);
  }

  canvas._maxState = { visCandles, slotItems, barsVisible, barX, pxY, chartW, chartH, priceH, volPanelH, volTop, RSW, BAH, W, H, dpr, minP, maxP, barSlot };
  const resetBtn = document.getElementById('max-chart-reset-btn');
  if (resetBtn) {
    const isModified = (_maxViewOffset !== 0 || _maxBarWidth !== 8 || Math.abs(_maxPricePad - 0.06) > 0.001);
    resetBtn.style.display = isModified ? 'inline-flex' : 'none';
  }
}
function maxChartSearchInput(val) {
  const suggestBox = document.getElementById('max-chart-suggest'); if (!suggestBox) return; const query = val.trim().toLowerCase(); if (!query) { suggestBox.style.display = 'none'; suggestBox.innerHTML = ''; return; }
  let allStocks = n500CsvGetCached() || []; if (allStocks.length === 0 && _sdCurrentData?.stocks) { allStocks = _sdCurrentData.stocks; }
  const matches = []; for (const s of allStocks) { if ((s.symbol && s.symbol.toLowerCase().includes(query)) || (s.company && s.company.toLowerCase().includes(query))) { matches.push(s); if (matches.length >= 8) break; } }
  if (matches.length === 0) { suggestBox.style.display = 'none'; suggestBox.innerHTML = ''; return; }
  suggestBox.innerHTML = matches.map(s => {
    return `
      <div class="max-suggest-item" onclick="maxChartSelectStock('${s.symbol.replace(/'/g, "\\'")}')">
        <span style="font-weight:700;color:var(--teal);">${s.symbol}</span>
        <span class="comp-name">${s.company || ''}</span>
      </div>`;
  }).join(''); suggestBox.style.display = 'block';
}
function maxChartSelectStock(symbol) {
  const searchInput = document.getElementById('max-chart-search');
  if (searchInput) searchInput.value = '';
  const suggestBox = document.getElementById('max-chart-suggest');
  if (suggestBox) suggestBox.style.display = 'none';
  if (typeof maxChartOnStockSelected === 'function') {
    maxChartOnStockSelected(symbol);
  } else {
    openMaximizedChart(symbol);
  }
}
async function sectorDrillOpen(sectorName, tabToOpen = 'vcp') {
  const overlay = document.getElementById('sector-drill-overlay'); const title = document.getElementById('sd-title'); const body = document.getElementById('sd-body'); if (!overlay || !title || !body) return; _sdCurrentSector = sectorName; _sdCurrentData = null; _sdFilter = 'all'; _sdChartsSource = 'vcp'; _sdChartsPage = 0; _sdAutoChartsLimit = 12; _sdSearchQuery = ''; const searchInput = document.getElementById('sd-search-input'); if (searchInput) searchInput.value = ''; const clearBtn = document.getElementById('sd-search-clear'); if (clearBtn) clearBtn.style.display = 'none'; title.textContent = sectorName; body.innerHTML = '<div style="padding:30px;text-align:center;color:var(--dim);font-size:11px">Loading…</div>'; overlay.style.display = 'flex'; let data = sectorDrillGetCached(); const today = new Date().toISOString().slice(0, 10); if (!data || data.scan_date !== today) {
    const baseUrl = vcpbGetUrl(); if (baseUrl) {
      try {
        let resp; let localSuccess = false; if (window.location.protocol === 'file:') { try { const localUrl = 'http://localhost:9090/local/sector_stocks.json?_=' + Date.now(); resp = await fetch(localUrl, { cache: 'no-store' }); if (resp.ok) localSuccess = true; } catch (e) { } }
        if (!localSuccess) { try { resp = await fetch(baseUrl + '/sector_stocks.json?_=' + Date.now(), { cache: 'no-store' }); if (!resp.ok && baseUrl.includes('localhost:9090')) throw new Error('Local down'); } catch (e) { resp = await fetch('https://mkshibu2.github.io/breadth-radar/sector_stocks.json?_=' + Date.now(), { cache: 'no-store' }); } }
        if (resp && resp.ok) { const fresh = await resp.json(); sectorDrillSetCached(fresh); data = fresh; sccWatchlistRender(); sccWatchlistFetchAll(); }
      } catch (e) { }
    }
  }
  if (data) { calculateRSRatings(data); sdPopulateSectorsDropdown(data); }
  _sdCurrentData = data ? ((_vcpbViewMode === 'industry' ? data.industries?.[sectorName] : data.sectors?.[sectorName]) || null) : null; sdFetchCsv(); sdSwitchTab(tabToOpen);
}
function sectorDrillClose() { const overlay = document.getElementById('sector-drill-overlay'); const modal = document.getElementById('sector-drill-modal'); const btn = document.getElementById('sd-max-btn'); if (overlay) overlay.style.display = 'none'; if (modal) modal.classList.remove('maximized'); if (overlay) overlay.classList.remove('maximized'); if (btn) { btn.innerHTML = '<span style="font-size:12px;line-height:1;">⛶</span>'; btn.title = 'Maximize Window'; } }
function toggleMaximizeSectorDrill() {
  const modal = document.getElementById('sector-drill-modal'); const overlay = document.getElementById('sector-drill-overlay'); const btn = document.getElementById('sd-max-btn'); if (!modal || !overlay) return; const isMax = modal.classList.toggle('maximized'); overlay.classList.toggle('maximized', isMax); if (btn) { if (isMax) { btn.innerHTML = '<span style="font-size:12px;line-height:1;">🗗</span>'; btn.title = 'Restore Window'; } else { btn.innerHTML = '<span style="font-size:12px;line-height:1;">⛶</span>'; btn.title = 'Maximize Window'; } }
  if (_sdActiveTab === 'charts') { sdRenderCharts(_sdCurrentSector, _sdCurrentData); }
}
async function sdFetchCsv(force = false) {
  const baseUrl = vcpbGetUrl(); if (!baseUrl) return; if (force) { _n500CsvCache = null; localStorage.removeItem(LS_N500_CSV); _filterStocksCache = null; localStorage.removeItem(LS_FILTER_STOCKS_CSV); }
  if (!n500CsvGetCached()) {
    try {
      async function fetchOneCsv(filename) {
        let resp; let localSuccess = false; if (window.location.protocol === 'file:') { try { const localUrl = `http://localhost:9090/local/${filename}?_=` + Date.now(); resp = await fetch(localUrl, { cache: 'no-store' }); if (resp.ok) localSuccess = true; } catch (e) { } }
        if (!localSuccess) { resp = await fetch(baseUrl + `/${filename}?_=` + Date.now(), { cache: 'no-store' }); }
        if (resp && resp.ok) { return await resp.text(); }
        throw new Error(`Failed to fetch ${filename}`);
      }
      let text500 = ''; let text400 = ''; try { text500 = await fetchOneCsv('ind_nifty500list.csv'); } catch (e) { console.error('Error fetching ind_nifty500list.csv:', e); }
      try { text400 = await fetchOneCsv('ind_niftymidsmallcap400list.csv'); } catch (e) { console.error('Error fetching ind_niftymidsmallcap400list.csv:', e); }
      const parsed500 = text500 ? parseN500Csv(text500) : []; const parsed400 = text400 ? parseN500Csv(text400) : []; const combined = [...parsed500, ...parsed400]; const seen = new Set(); const uniqueCombined = []; for (const item of combined) { if (!item.symbol) continue; const symUpper = item.symbol.trim().toUpperCase(); if (!seen.has(symUpper)) { seen.add(symUpper); uniqueCombined.push({ symbol: item.symbol.trim(), company: item.company, industry: item.industry }); } }
      if (uniqueCombined.length > 100) { n500CsvSetCached(uniqueCombined); console.log(`Successfully fetched and merged CSV lists. Unique symbols cached: ${uniqueCombined.length}`); }
    } catch (e) { console.error('Error merging stock lists:', e); }
  }
  if (!filterStocksGetCached()) {
    try {
      let resp; let localSuccess = false; if (window.location.protocol === 'file:') { try { const localUrl = 'http://localhost:9090/local/Filter_India_Stocks.csv?_=' + Date.now(); resp = await fetch(localUrl, { cache: 'no-store' }); if (resp.ok) localSuccess = true; } catch (e) { } }
      if (!localSuccess) { try { resp = await fetch(baseUrl + '/Filter_India_Stocks.csv?_=' + Date.now(), { cache: 'no-store' }); if (!resp.ok && baseUrl.includes('localhost:9090')) throw new Error('Local down'); } catch (e) { resp = await fetch('https://mkshibu2.github.io/breadth-radar/Filter_India_Stocks.csv?_=' + Date.now(), { cache: 'no-store' }); } }
      if (resp && resp.ok) { const text = await resp.text(); const parsed = parseFilterStocksCsv(text); if (Object.keys(parsed).length > 100) { filterStocksSetCached(parsed); console.log('Successfully fetched and cached Filter_India_Stocks.csv mappings:', Object.keys(parsed).length); } }
    } catch (e) { console.error('Error fetching Filter_India_Stocks.csv:', e); }
  }
}
function sdRenderVcp(sectorName, secData) {
  const body = document.getElementById('sd-body'); if (!body) return; const stocks = secData?.stocks || []; const universe = secData?.universe || '?'; const vcpCount = secData?.vcp_count || 0; const scanTime = _sdCurrentData ? (_sdCurrentData.scan_time || '') : ''; const summaryHtml = `
    <div style="display:flex;gap:16px;flex-wrap:wrap;padding:8px 16px;background:var(--bg3);border-bottom:1px solid var(--border);font-size:10px;flex-shrink:0;align-items:center">
      <span style="color:var(--dim)">Universe: <b style="color:var(--text)">${universe}</b> stocks</span>
      <span style="color:var(--dim)">VCP today: <b style="color:var(--teal)">${vcpCount}</b></span>
      ${scanTime ? `<span style="color:var(--dim)">Scan:<b style="color:var(--sub)">${scanTime}</b></span>` : ''}
    </div>`; if (!secData) {
    body.innerHTML = summaryHtml + `<div style="padding:24px 16px;font-size:11px;color:var(--yellow)">
      ⚠ sector_stocks.json not found or scanner hasn't run today.<br>
      <span style="color:var(--dim);font-size:10px">Run the VCP scanner and push sector_stocks.json to your GitHub repo.</span>
    </div>`; return;
  }
  if (stocks.length === 0) {
    body.innerHTML = summaryHtml + `<div style="padding:30px;text-align:center;color:var(--dim);font-size:11px">
      No VCP candidates in <b>${sectorName}</b> today.<br>
      <span style="font-size:10px;opacity:.7">Universe of ${universe} stocks scanned — none qualified.</span>
    </div>`; return;
  }
  let filtered = [...stocks]; if (_sdFilter === 'rs90') { filtered = filtered.filter(s => (s.rs_rating || 0) >= 90); } else if (_sdFilter === 'rs80') { filtered = filtered.filter(s => (s.rs_rating || 0) >= 80); } else if (_sdFilter === 'score70') { filtered = filtered.filter(s => { const score = s.final_score > 0 ? s.final_score : s.vcp_score; return (score || 0) >= 70; }); }
  if (_sdSearchQuery) { filtered = filtered.filter(s => (s.symbol && s.symbol.toLowerCase().includes(_sdSearchQuery)) || (s.company && s.company.toLowerCase().includes(_sdSearchQuery))); }
  const filterHtml = `
    <div style="display:flex;align-items:center;gap:6px;padding:6px 16px;background:var(--bg2);border-bottom:1px solid var(--border);font-size:10px;flex-shrink:0;flex-wrap:wrap">
      <span style="color:var(--dim);text-transform:uppercase;font-weight:600;margin-right:auto">Filter:</span>
      <button onclick="sdSetFilter('all')" style="background:${_sdFilter === 'all' ? 'var(--border)' : 'transparent'};border:1px solid var(--border);color:${_sdFilter === 'all' ? 'var(--text)' : 'var(--dim)'};padding:2px 8px;border-radius:3px;cursor:pointer;font-size:9px;font-weight:600;transition:all .15s">All (${stocks.length})</button>
      <button onclick="sdSetFilter('rs90')" style="background:${_sdFilter === 'rs90' ? 'rgba(34,197,94,.15)' : 'transparent'};border:1px solid ${_sdFilter === 'rs90' ? 'var(--lime)' : 'var(--border)'};color:${_sdFilter === 'rs90' ? 'var(--lime)' : 'var(--dim)'};padding:2px 8px;border-radius:3px;cursor:pointer;font-size:9px;font-weight:600;transition:all .15s">RS ≥ 90</button>
      <button onclick="sdSetFilter('rs80')" style="background:${_sdFilter === 'rs80' ? 'rgba(34,197,94,.15)' : 'transparent'};border:1px solid ${_sdFilter === 'rs80' ? 'var(--lime)' : 'var(--border)'};color:${_sdFilter === 'rs80' ? 'var(--lime)' : 'var(--dim)'};padding:2px 8px;border-radius:3px;cursor:pointer;font-size:9px;font-weight:600;transition:all .15s">RS ≥ 80</button>
      <button onclick="sdSetFilter('score70')" style="background:${_sdFilter === 'score70' ? 'rgba(45,212,191,.15)' : 'transparent'};border:1px solid ${_sdFilter === 'score70' ? 'var(--teal)' : 'var(--border)'};color:${_sdFilter === 'score70' ? 'var(--teal)' : 'var(--dim)'};padding:2px 8px;border-radius:3px;cursor:pointer;font-size:9px;font-weight:600;transition:all .15s">Score ≥ 70</button>
      <div style="margin-left:auto;display:flex;align-items:center;gap:6px">
        <span style="color:var(--dim);font-size:9px;">Sort:</span>
        <select onchange="sdSetSortBy(this.value)" style="background:var(--bg4);border:1px solid var(--border);color:var(--text);font-size:9px;font-weight:600;padding:2px 4px;border-radius:3px;outline:none;height:20px;">
          <option value="score" ${_sdSortBy === 'score' ? 'selected' : ''}>Score</option>
          <option value="rs" ${_sdSortBy === 'rs' ? 'selected' : ''}>RS Rating</option>
          <option value="stage" ${_sdSortBy === 'stage' ? 'selected' : ''}>Stage</option>
          <option value="symbol" ${_sdSortBy === 'symbol' ? 'selected' : ''}>Symbol</option>
        </select>
        <button onclick="_sdChartsSource='vcp';sdSwitchTab('charts')" style="background:rgba(91,163,245,.12);border:1px solid rgba(91,163,245,.25);color:var(--accent);padding:2px 8px;border-radius:3px;cursor:pointer;font-size:9px;font-weight:600;transition:all .15s;margin-left:6px">📈 View Charts</button>
      </div>
    </div>`; if (filtered.length === 0) {
    body.innerHTML = summaryHtml + filterHtml + `<div id="sd-no-results" style="padding:40px 16px;text-align:center;color:var(--dim);font-size:11px"></div>`; const noResultsDiv = document.getElementById('sd-no-results'); if (noResultsDiv) { noResultsDiv.textContent = _sdSearchQuery ? `No candidates found matching "${_sdSearchQuery}".` : 'No candidates match the selected filter criteria today.'; }
    return;
  }
  const sorted = [...filtered].sort((a, b) => { if (_sdSortBy === 'rs') { return (b.rs_rating || 0) - (a.rs_rating || 0); } else if (_sdSortBy === 'stage') { const stageScore = s => ({ S2: 4, S1: 3, S3: 2, S4: 1 }[s.stage || s.setup] || 0); return stageScore(b) - stageScore(a); } else if (_sdSortBy === 'symbol') { return a.symbol.localeCompare(b.symbol); } else { const scoreA = a.final_score > 0 ? a.final_score : a.vcp_score; const scoreB = b.final_score > 0 ? b.final_score : b.vcp_score; return (scoreB || 0) - (scoreA || 0); } }); const gradeColor = g => ({ 'A+': 'var(--lime)', A: 'var(--lime)', B: 'var(--yellow)', C: 'var(--orange)', D: 'var(--red)' }[g] || 'var(--dim)'); const rows = sorted.map(s => {
    const tvUrl = `https://www.tradingview.com/chart/?symbol=NSE%3A${encodeURIComponent(s.symbol)}`; const msUrl = `https://marketsmithindia.com/mstool/eval/${s.symbol.toLowerCase()}/evaluation.jsp#/`; const r90C = s.r90 >= 20 ? 'var(--lime)' : s.r90 >= 0 ? 'var(--yellow)' : 'var(--red)'; const ddC = s.drawdown >= -10 ? 'var(--lime)' : s.drawdown >= -20 ? 'var(--yellow)' : 'var(--red)'; const dist52C = s.dist52 >= -5 ? 'var(--lime)' : s.dist52 >= -15 ? 'var(--yellow)' : 'var(--dim)'; const score = s.final_score > 0 ? s.final_score : s.vcp_score; const scoreC = score >= 70 ? 'var(--lime)' : score >= 50 ? 'var(--yellow)' : 'var(--dim)'; const rsVal = s.rs_rating != null ? s.rs_rating : '—'; const rsColor = rsVal >= 90 ? 'var(--lime)' : rsVal >= 80 ? 'var(--green)' : rsVal >= 50 ? 'var(--yellow)' : 'var(--dim)'; const grade = s.grade && s.grade !== '—' ? s.grade : '—'; const mcap = s.mktcap ? (s.mktcap >= 10000 ? `₹${(s.mktcap / 100).toFixed(0)}kCr` : `₹${Math.round(s.mktcap)}Cr`) : '—'; return `<tr style="border-bottom:1px solid var(--border)" onmouseenter="this.style.background='rgba(255,255,255,.03)'" onmouseleave="this.style.background='transparent'">
      <td style="padding:6px;white-space:nowrap">
        <a href="javascript:void(0)" onclick="openMaximizedChart('${s.symbol}')" style="font-weight:800;font-size:13px;color:var(--teal);text-decoration:none;font-family:var(--mono)" title="Click to view chart">${s.symbol}</a>
        <a href="${tvUrl}"  target="_blank" rel="noopener" style="font-size:9px;color:var(--accent);text-decoration:none;margin-left:5px;padding:1px 4px;border-radius:2px;border:1px solid rgba(91,163,245,.2);background:rgba(91,163,245,.08)" title="TradingView">TV↗</a>
        <a href="${msUrl}"  target="_blank" rel="noopener" style="font-size:9px;color:#f59e0b;text-decoration:none;margin-left:3px;padding:1px 4px;border-radius:2px;border:1px solid rgba(245,158,11,.25);background:rgba(245,158,11,.08)" title="MarketSmith India">MS↗</a>
      </td>
      <td style="padding:6px;font-size:11px;color:var(--sub);max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${s.company}</td>
      <td style="padding:6px;text-align:right;font-size:11px;font-family:var(--mono)">₹${s.price}</td>
      <td style="padding:6px;text-align:right;font-size:11px;font-family:var(--mono);color:var(--dim)">${mcap}</td>
      <td style="padding:6px;text-align:right;font-size:11px;font-family:var(--mono);color:${r90C}">${s.r90 > 0 ? '+' : ''}${s.r90}%</td>
      <td style="padding:6px;text-align:right;font-size:11px;font-family:var(--mono);color:${dist52C}">${s.dist52 > 0 ? '+' : ''}${s.dist52}%</td>
      <td style="padding:6px;text-align:right;font-size:11px;font-family:var(--mono);color:${ddC}">${s.drawdown}%</td>
      <td style="padding:6px;text-align:center;font-size:9px;color:var(--yellow)">${s.setup ? s.setup.replace(/[🎯🌱📐🔮🧲👀]/u, '').trim() : '—'}</td>
      <td style="padding:6px;text-align:center;font-family:var(--mono);font-size:13px;font-weight:800;color:${rsColor}">${rsVal}</td>
      <td style="padding:6px;text-align:center;font-family:var(--disp);font-size:15px;font-weight:800;color:${scoreC}">${Math.round(score)}</td>
      <td style="padding:6px;text-align:center">${grade !== '—' ? `<span style="font-size:9px;font-weight:800;color:${gradeColor(grade)};padding:1px 5px;border-radius:3px;background:rgba(0,0,0,.2)">${grade}</span>` : '<span style="color:var(--border)">—</span>'}</td>
    </tr>`;
  }).join(''); body.innerHTML = summaryHtml + filterHtml + `<div style="overflow-x:auto">
    <table style="width:100%;border-collapse:collapse;min-width:600px">
      <thead><tr style="border-bottom:1px solid var(--border);background:var(--bg2)">
        <th style="padding:5px 6px;text-align:left;color:var(--sub);font-size:10px;text-transform:uppercase">Symbol</th>
        <th style="padding:5px 6px;text-align:left;color:var(--sub);font-size:10px;text-transform:uppercase">Company</th>
        <th style="padding:5px 6px;text-align:right;color:var(--sub);font-size:10px;text-transform:uppercase">Price</th>
        <th style="padding:5px 6px;text-align:right;color:var(--sub);font-size:10px;text-transform:uppercase">MCap</th>
        <th style="padding:5px 6px;text-align:right;color:var(--sub);font-size:10px;text-transform:uppercase">90D%</th>
        <th style="padding:5px 6px;text-align:right;color:var(--sub);font-size:10px;text-transform:uppercase">52W%</th>
        <th style="padding:5px 6px;text-align:right;color:var(--sub);font-size:10px;text-transform:uppercase">DD%</th>
        <th style="padding:5px 6px;text-align:center;color:var(--sub);font-size:10px;text-transform:uppercase">Setup</th>
        <th style="padding:5px 6px;text-align:center;color:var(--accent);font-size:10px;text-transform:uppercase">RS</th>
        <th style="padding:5px 6px;text-align:center;color:var(--teal);font-size:10px;text-transform:uppercase">Score</th>
        <th style="padding:5px 6px;text-align:center;color:var(--sub);font-size:10px;text-transform:uppercase">Grade</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table></div>`;
}
function sdRenderUniverse(sectorName) {
  const body = document.getElementById('sd-body'); if (!body) return; const csv = n500CsvGetCached(); if (!csv) {
    body.innerHTML = `<div style="padding:24px 16px;font-size:11px;color:var(--yellow)">
      ⏳ Loading stock list from GitHub…
      <span style="color:var(--dim);font-size:10px;display:block;margin-top:4px">
        Make sure your GitHub Pages URL is configured in the SECTORS tab.
      </span>
    </div>`; sdFetchCsv().then(() => { const fresh = n500CsvGetCached(); if (fresh) sdRenderUniverse(sectorName); }); return;
  }
  const stocks = csv.filter(s => { const mapped = _vcpbViewMode === 'industry' ? csvIndustryMap(s.symbol, s.company, s.industry) : csvSectorMap(s.symbol, s.company, s.industry); return mapped === sectorName; }); stocks.sort((a, b) => a.symbol.localeCompare(b.symbol)); if (!stocks.length) {
    body.innerHTML = `<div style="padding:24px 16px;font-size:11px;color:var(--dim)">
      No stocks found for <b>${sectorName}</b> in the scan universe.
    </div>`; return;
  }
  let filtered = [...stocks]; if (_sdSearchQuery) { filtered = filtered.filter(s => (s.symbol && s.symbol.toLowerCase().includes(_sdSearchQuery)) || (s.company && s.company.toLowerCase().includes(_sdSearchQuery))); }
  const vcpSymbols = new Set((_sdCurrentData?.stocks || []).map(s => s.symbol)); const summaryHtml = `
    <div style="display:flex;gap:16px;flex-wrap:wrap;padding:8px 16px;background:var(--bg3);border-bottom:1px solid var(--border);font-size:10px;align-items:center">
      <span style="color:var(--dim)"><b style="color:var(--text)">${stocks.length}</b> stocks in universe</span>
      ${vcpSymbols.size ? `<span style="color:var(--dim)"><b style="color:var(--teal)">${vcpSymbols.size}</b>VCP candidates today</span>` : ''}
      <div style="margin-left:auto;display:flex;align-items:center;gap:8px">
        <button onclick="_sdChartsSource='universe';sdSwitchTab('charts')" style="background:rgba(91,163,245,.12);border:1px solid rgba(91,163,245,.25);color:var(--accent);padding:2px 8px;border-radius:3px;cursor:pointer;font-size:9px;font-weight:600;transition:all .15s">📈 View Charts</button>
        <span style="color:var(--dim);font-size:9px;font-style:italic">TV↗ = TradingView &nbsp;·&nbsp; NSE↗ = NSE India &nbsp;·&nbsp; MS↗ = MarketSmith</span>
      </div>
    </div>`; if (!filtered.length) {
    body.innerHTML = summaryHtml + `<div id="sd-universe-no-results" style="padding:40px 16px;text-align:center;color:var(--dim);font-size:11px"></div>`; const noResultsDiv = document.getElementById('sd-universe-no-results'); if (noResultsDiv) { noResultsDiv.textContent = `No stocks found matching "${_sdSearchQuery}".`; }
    return;
  }
  const rows = filtered.map(s => {
    const tvUrl = `https://www.tradingview.com/chart/?symbol=NSE%3A${encodeURIComponent(s.symbol)}`; const msUrl = `https://marketsmithindia.com/mstool/eval/${s.symbol.toLowerCase()}/evaluation.jsp#/`; const isVcp = vcpSymbols.has(s.symbol); const symColor = isVcp ? 'var(--teal)' : 'var(--text)'; const scannerStockObj = isVcp ? (_sdCurrentData?.stocks || []).find(x => x.symbol === s.symbol) : null; const rsBadge = (isVcp && scannerStockObj && scannerStockObj.rs_rating != null) ? `<span style="font-size:8px;background:rgba(167,139,250,.15);color:var(--purple);padding:0 4px;border-radius:2px;margin-left:4px;border:1px solid rgba(167,139,250,.25)" title="Scanner Relative Strength Rating">RS ${scannerStockObj.rs_rating}</span>` : ''; const vcpBadge = isVcp ? `<span style="font-size:8px;background:rgba(45,212,191,.15);color:var(--teal);padding:0 4px;border-radius:2px;margin-left:4px;border:1px solid rgba(45,212,191,.25)">VCP</span>${rsBadge}` : ''; return `<tr style="border-bottom:1px solid var(--border)" onmouseenter="this.style.background='rgba(255,255,255,.03)'" onmouseleave="this.style.background='transparent'">
      <td style="padding:7px 10px;font-weight:800;font-size:13px;font-family:var(--mono);color:${symColor};white-space:nowrap">
        <a href="javascript:void(0)" onclick="openMaximizedChart('${s.symbol}')" style="color:inherit;text-decoration:none;cursor:pointer" title="Click to view chart">${s.symbol}</a>${vcpBadge}
      </td>
      <td style="padding:7px 10px;font-size:11px;color:var(--sub)">${s.company}</td>
      <td style="padding:7px 10px;text-align:center;white-space:nowrap">
        <a href="${tvUrl}" target="_blank" rel="noopener"
           style="font-size:10px;font-weight:600;color:var(--accent);text-decoration:none;padding:2px 7px;border-radius:3px;border:1px solid rgba(91,163,245,.25);background:rgba(91,163,245,.08)">TV↗</a>
        <a href="javascript:void(0)" onclick="openMaximizedChart('${s.symbol}')"
           style="font-size:10px;font-weight:600;color:var(--teal);text-decoration:none;padding:2px 7px;border-radius:3px;border:1px solid rgba(45,212,191,.25);background:rgba(45,212,191,.08);margin-left:4px" title="Open Chart">Chart</a>
        <a href="${msUrl}" target="_blank" rel="noopener"
           style="font-size:10px;font-weight:600;color:#f59e0b;text-decoration:none;padding:2px 7px;border-radius:3px;border:1px solid rgba(245,158,11,.25);background:rgba(245,158,11,.08);margin-left:4px">MS↗</a>
      </td>
    </tr>`;
  }).join(''); body.innerHTML = summaryHtml + `<div style="overflow-x:auto">
    <table style="width:100%;border-collapse:collapse">
      <thead><tr style="border-bottom:1px solid var(--border);background:var(--bg2)">
        <th style="padding:5px 10px;text-align:left;color:var(--sub);font-size:10px;text-transform:uppercase;letter-spacing:.4px">Symbol</th>
        <th style="padding:5px 10px;text-align:left;color:var(--sub);font-size:10px;text-transform:uppercase;letter-spacing:.4px">Company</th>
        <th style="padding:5px 10px;text-align:center;color:var(--sub);font-size:10px;text-transform:uppercase;letter-spacing:.4px">Links</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table></div>`;
}
function getChartsGridStyle(layout) {
  if (layout === '1') return 'grid-template-columns: 1fr;'; if (layout === '4') return 'grid-template-columns: repeat(2, 1fr);'; if (layout === '6') return 'grid-template-columns: repeat(3, 1fr);'; if (layout === '9') return 'grid-template-columns: repeat(3, 1fr);'; if (layout === '12') return 'grid-template-columns: repeat(4, 1fr);'; if (layout === '16') return 'grid-template-columns: repeat(4, 1fr);'; if (layout === '20') return 'grid-template-columns: repeat(5, 1fr);'; if (layout === '24') return 'grid-template-columns: repeat(6, 1fr);'; if (layout === '30') return 'grid-template-columns: repeat(6, 1fr);'; if (layout === '36') return 'grid-template-columns: repeat(6, 1fr);'; if (layout === '48') return 'grid-template-columns: repeat(8, 1fr);'; if (layout === 'auto') { const w = window.innerWidth; if (w >= 1400) return 'grid-template-columns: repeat(4, 1fr);'; if (w >= 900) return 'grid-template-columns: repeat(3, 1fr);'; return 'grid-template-columns: repeat(2, 1fr);'; }
  return 'grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));';
}
function getChartsCardHeight(layout) { if (layout === '1') return '520px'; if (layout === '4') return '380px'; if (layout === '6') return '320px'; if (layout === '9') return '300px'; if (layout === '12') return '260px'; if (layout === '16') return '240px'; if (layout === '20') return '220px'; if (layout === '24') return '200px'; if (layout === '30') return '180px'; if (layout === '36') return '180px'; if (layout === '48') return '160px'; return '350px'; }
function sdSetChartsSource(source) { _sdChartsSource = source; _sdChartsPage = 0; _sdAutoChartsLimit = 12; sdRenderCharts(_sdCurrentSector, _sdCurrentData); }
function sdSetLayout(layout) {
  _sdChartsLayout = layout; if (layout === 'auto') { _sdChartsPerPage = 9; } else { _sdChartsPerPage = parseInt(layout); }
  _sdChartsPage = 0; _sdAutoChartsLimit = 12; sdRenderCharts(_sdCurrentSector, _sdCurrentData);
}
function sdSetChartsInterval(interval) { _sdChartsInterval = interval; _sdChartsPage = 0; _sdAutoChartsLimit = 12; sdRenderCharts(_sdCurrentSector, _sdCurrentData); }
function sdSetChartType(type) { _sdChartType = type; sdRenderCharts(_sdCurrentSector, _sdCurrentData); }
function sdSetSortBy(val) { _sdSortBy = val; if (_sdActiveTab === 'charts') { sdRenderCharts(_sdCurrentSector, _sdCurrentData); } else if (_sdActiveTab === 'vcp') { sdRenderVcp(_sdCurrentSector, _sdCurrentData); } }
function sdChartsLoadMore() { _sdAutoChartsLimit += 12; sdRenderCharts(_sdCurrentSector, _sdCurrentData); }
function sdChartsPrevPage() { if (_sdChartsPage > 0) { _sdChartsPage--; sdRenderCharts(_sdCurrentSector, _sdCurrentData); } }
function sdChartsNextPage(totalPages) { if (_sdChartsPage < totalPages - 1) { _sdChartsPage++; sdRenderCharts(_sdCurrentSector, _sdCurrentData); } }
const _yfDataCache = new Map(); async function fetchYfData(symbol, range, interval) {
  const yfSymbol = symbol.startsWith('^') ? symbol : (symbol + '.NS'); const cacheKey = `${yfSymbol}_${range}_${interval}`; if (_yfDataCache.has(cacheKey)) { return _yfDataCache.get(cacheKey); }
  const targetUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${yfSymbol}?range=${range}&interval=${interval}`; const currentOrigin = window.location.origin; const proxies = [url => `https://nse-chart-proxy.shibu-mk.workers.dev/?url=${encodeURIComponent(url)}`,url => {
    if (!currentOrigin || currentOrigin.startsWith('file') || currentOrigin === 'null' || currentOrigin.includes('github.io')) { return ''; }
    return `${currentOrigin}/api/proxy?url=${encodeURIComponent(url)}`;
  }, url => `http://localhost:9090/?url=${encodeURIComponent(url)}`, url => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`, url => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`]; for (const proxyFn of proxies) {
    try {
      const pUrl = proxyFn(targetUrl); if (!pUrl) continue; console.log('[fetchYfData] Requesting:', yfSymbol, 'via', pUrl); const controller = new AbortController(); const timeoutId = setTimeout(() => controller.abort(), 7000); const resp = await fetch(pUrl, { signal: controller.signal }); clearTimeout(timeoutId); if (resp.ok) {
        let text = await resp.text(); if (text.trim().startsWith('{')) { const parsed = JSON.parse(text); if (parsed.contents) { text = parsed.contents; } }
        const trimmed = text.trim(); if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) { throw new Error("Response is not JSON"); }
        const data = JSON.parse(text); const candles = parseYfData(data); if (candles && candles.length > 0) { _yfDataCache.set(cacheKey, candles); return candles; }
      }
    } catch (e) { console.warn('[fetchYfData] Proxy failed:', e.message); }
  }
  throw new Error("Unable to load Yahoo Finance chart data");
}
function parseYfData(data) {
  const result = data?.chart?.result?.[0]; if (!result) return null; const timestamps = result.timestamp || []; const quote = result.indicators?.quote?.[0] || {}; const opens = quote.open || []; const highs = quote.high || []; const lows = quote.low || []; const closes = quote.close || []; const volumes = quote.volume || []; const candles = []; for (let i = 0; i < timestamps.length; i++) { if (opens[i] != null && highs[i] != null && lows[i] != null && closes[i] != null) { candles.push({ time: timestamps[i] * 1000, open: opens[i], high: highs[i], low: lows[i], close: closes[i], volume: volumes[i] || 0 }); } }
  return candles;
}
function calculateEMA(candles, period) {
  const ema = []; const k = 2 / (period + 1); let prevEma = null; for (let i = 0; i < candles.length; i++) {
    if (i < period - 1) { ema.push(null); } else if (i === period - 1) {
      let sum = 0; for (let j = 0; j < period; j++) { sum += candles[i - j].close; }
      prevEma = sum / period; ema.push(prevEma);
    } else { const val = candles[i].close * k + prevEma * (1 - k); ema.push(val); prevEma = val; }
  }
  return ema;
}
function drawAnyChart(canvasId, candles, chartType, drawCountOverride, niftyCandles) {
  const canvas = document.getElementById(canvasId); if (!canvas) return; const ctx = canvas.getContext('2d'); let symbol = ''; if (canvasId.startsWith('yf-chart-')) { symbol = canvasId.replace('yf-chart-', '').toUpperCase(); } else if (canvasId === 'max-chart-canvas') { symbol = (_sdMaximizedChartSymbol || '').toUpperCase(); } else if (canvasId.startsWith('scc-chart-canvas-')) { const idx = parseInt(canvasId.replace('scc-chart-canvas-', '')); if (!isNaN(idx) && _sccChartSymbols[idx]) { symbol = _sccChartSymbols[idx].toUpperCase(); } }
  let rsRating = ''; if (symbol) { const meta = findStockMetadata(symbol); rsRating = meta.rs_rating; }
  const dpr = window.devicePixelRatio || 1; const rect = canvas.getBoundingClientRect(); const tW = Math.round(rect.width * dpr); const tH = Math.round(rect.height * dpr); if (canvas.width !== tW || canvas.height !== tH) { canvas.width = tW; canvas.height = tH; } ctx.setTransform(dpr, 0, 0, dpr, 0, 0); const width = rect.width; const height = rect.height; ctx.clearRect(0, 0, width, height); ctx.fillStyle = '#050508'; ctx.fillRect(0, 0, width, height); if (!candles || candles.length === 0) { ctx.fillStyle = '#64748b'; ctx.font = '10px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('No chart data found', width / 2, height / 2); return; }
  const minCandlePx = (chartType === 'ohlc') ? 3 : 4; const maxFitCount = Math.max(20, Math.floor(width / minCandlePx)); const totalCount = candles.length; let drawCount = Math.min(totalCount, maxFitCount); if (drawCountOverride != null) { drawCount = Math.min(totalCount, Math.max(10, drawCountOverride)); }
  const startIndex = Math.max(0, totalCount - drawCount); const ema20 = calculateEMA(candles, 20); const drawCandles = candles.slice(startIndex); const drawEma = ema20.slice(startIndex); let minPrice = Infinity; let maxPrice = -Infinity; let maxVolume = 0; for (const c of drawCandles) { if (c.low < minPrice) minPrice = c.low; if (c.high > maxPrice) maxPrice = c.high; if (c.volume > maxVolume) maxVolume = c.volume; }
  for (let i = 0; i < drawCandles.length; i++) { if (drawEma[i] != null) { if (drawEma[i] < minPrice) minPrice = drawEma[i]; if (drawEma[i] > maxPrice) maxPrice = drawEma[i]; } }
  const priceRange = maxPrice - minPrice; minPrice -= priceRange * 0.05; maxPrice += priceRange * 0.05; const finalRange = maxPrice - minPrice; const chartHeight = height - 16; const candleCount = drawCandles.length; const candleWidth = width / candleCount; ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)'; ctx.lineWidth = 1; const gridLevels = 4; for (let i = 0; i <= gridLevels; i++) { const y = (chartHeight / gridLevels) * i; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke(); const priceVal = maxPrice - (finalRange / gridLevels) * i; ctx.fillStyle = '#64748b'; ctx.font = '8px monospace'; ctx.textAlign = 'right'; ctx.fillText(priceVal.toFixed(1), width - 4, y - 2); }
  const avgVolume = drawCandles.reduce((sum, c) => sum + c.volume, 0) / drawCandles.length; for (let i = 0; i < candleCount; i++) {
    const c = drawCandles[i]; const x = i * candleWidth + candleWidth / 2; const yOpen = chartHeight - ((c.open - minPrice) / finalRange) * chartHeight; const yClose = chartHeight - ((c.close - minPrice) / finalRange) * chartHeight; const yHigh = chartHeight - ((c.high - minPrice) / finalRange) * chartHeight; const yLow = chartHeight - ((c.low - minPrice) / finalRange) * chartHeight; const isUp = c.close >= c.open; const color = isUp ? '#10b981' : '#f87171'; let bodyWidth = Math.max(1, candleWidth * 0.7); if (chartType === 'volume_candles') { let widthFactor = c.volume / (avgVolume || 1); widthFactor = Math.min(2.5, Math.max(0.4, widthFactor)); bodyWidth = Math.max(1, candleWidth * 0.7 * widthFactor); }
    if (chartType === 'ohlc') { ctx.strokeStyle = color; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x, yHigh); ctx.lineTo(x, yLow); ctx.stroke(); ctx.beginPath(); ctx.moveTo(x - bodyWidth / 2, yOpen); ctx.lineTo(x, yOpen); ctx.stroke(); ctx.beginPath(); ctx.moveTo(x, yClose); ctx.lineTo(x + bodyWidth / 2, yClose); ctx.stroke(); } else { ctx.strokeStyle = color; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x, yHigh); ctx.lineTo(x, yLow); ctx.stroke(); ctx.fillStyle = color; const bodyHeight = Math.abs(yClose - yOpen) || 1; const bodyY = Math.min(yOpen, yClose); ctx.fillRect(x - bodyWidth / 2, bodyY, bodyWidth, bodyHeight); }
    if (maxVolume > 0) { const volHeight = (c.volume / maxVolume) * (chartHeight * 0.15); ctx.fillStyle = isUp ? 'rgba(16, 185, 129, 0.12)' : 'rgba(248, 113, 113, 0.12)'; ctx.fillRect(x - bodyWidth / 2, chartHeight - volHeight, bodyWidth, volHeight); }
  }
  const getY = (val) => chartHeight - ((val - minPrice) / finalRange) * chartHeight; ctx.strokeStyle = 'rgba(239, 68, 68, 0.5)'; ctx.lineWidth = 1.2; ctx.beginPath(); let firstEma = true; for (let i = 0; i < candleCount; i++) { if (drawEma[i] != null) { const x = i * candleWidth + candleWidth / 2; const y = getY(drawEma[i]); if (firstEma) { ctx.moveTo(x, y); firstEma = false; } else { ctx.lineTo(x, y); } } }
  ctx.stroke(); if (niftyCandles && niftyCandles.length > 0) {
    const niftyTimeMap = new Map(); const niftyDateMap = new Map(); for (const nc of niftyCandles) { niftyTimeMap.set(nc.time, nc.close); const dateStr = new Date(nc.time).toISOString().split('T')[0]; niftyDateMap.set(dateStr, nc.close); }
    const rsValues = []; let minRs = Infinity; let maxRs = -Infinity; for (let i = 0; i < candleCount; i++) {
      const c = drawCandles[i]; let nClose = niftyTimeMap.get(c.time); if (nClose == null) { const dateStr = new Date(c.time).toISOString().split('T')[0]; nClose = niftyDateMap.get(dateStr); }
      if (nClose != null && nClose > 0) { const ratio = c.close / nClose; rsValues.push(ratio); if (ratio < minRs) minRs = ratio; if (ratio > maxRs) maxRs = ratio; } else { rsValues.push(null); }
    }
    if (minRs !== Infinity && minRs !== maxRs) {
      const getRsY = (val) => { const rsRange = maxRs - minRs; const pct = (val - minRs) / rsRange; return chartHeight * 0.8 - pct * (chartHeight * 0.5); }; ctx.strokeStyle = 'rgba(56, 189, 248, 0.5)'; ctx.lineWidth = 1.5; ctx.beginPath(); let firstRs = true; for (let i = 0; i < candleCount; i++) { const val = rsValues[i]; if (val !== null) { const x = i * candleWidth + candleWidth / 2; const y = getRsY(val); if (firstRs) { ctx.moveTo(x, y); firstRs = false; } else { ctx.lineTo(x, y); } } }
      ctx.stroke(); ctx.fillStyle = '#38bdf8'; ctx.font = '8px sans-serif'; ctx.textAlign = 'left'; let legendText = 'RS Line (vs Nifty 50)'; ctx.fillText(legendText, 6, chartHeight * 0.3 - 4);
    }
  }
  let lastMonth = ''; ctx.fillStyle = '#64748b'; ctx.font = '8px sans-serif'; ctx.textAlign = 'center'; for (let i = 0; i < candleCount; i++) { const date = new Date(drawCandles[i].time); const month = date.toLocaleString('default', { month: 'short' }); if (month !== lastMonth && i > 0 && i < candleCount - 4) { const x = i * candleWidth + candleWidth / 2; ctx.fillText(month, x, height - 4); lastMonth = month; ctx.strokeStyle = 'rgba(255, 255, 255, 0.02)'; ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, chartHeight); ctx.stroke(); } }
}
function sdRenderCharts(sectorName, secData) {
  const body = document.getElementById('sd-body'); if (!body) return; let stocks = []; if (_sdChartsSource === 'vcp') {
    stocks = secData?.stocks || []; if (_sdFilter === 'rs90') { stocks = stocks.filter(s => (s.rs_rating || 0) >= 90); } else if (_sdFilter === 'rs80') { stocks = stocks.filter(s => (s.rs_rating || 0) >= 80); } else if (_sdFilter === 'score70') { stocks = stocks.filter(s => { const score = s.final_score > 0 ? s.final_score : s.vcp_score; return (score || 0) >= 70; }); }
    stocks = [...stocks].sort((a, b) => { if (_sdSortBy === 'rs') { return (b.rs_rating || 0) - (a.rs_rating || 0); } else if (_sdSortBy === 'stage') { const stageScore = s => ({ S2: 4, S1: 3, S3: 2, S4: 1 }[s.stage || s.setup] || 0); return stageScore(b) - stageScore(a); } else if (_sdSortBy === 'symbol') { return a.symbol.localeCompare(b.symbol); } else { const scoreA = a.final_score > 0 ? a.final_score : a.vcp_score; const scoreB = b.final_score > 0 ? b.final_score : b.vcp_score; return (scoreB || 0) - (scoreA || 0); } });
  } else {
    const csv = n500CsvGetCached(); if (!csv) {
      body.innerHTML = `
        <div class="sd-charts-controls">
          <div style="display:flex;align-items:center;gap:6px">
            <span style="color:var(--dim)">Source:</span>
            <select onchange="sdSetChartsSource(this.value)" style="background:var(--bg4);border:1px solid var(--border);color:var(--text);font-size:10px;font-weight:600;padding:3px 6px;border-radius:3px;outline:none;height:24px;">
              <option value="vcp" ${_sdChartsSource === 'vcp' ? 'selected' : ''}>VCP Candidates</option>
              <option value="universe" ${_sdChartsSource === 'universe' ? 'selected' : ''}>Sector Universe</option>
            </select>
          </div>
        </div>
        <div style="padding:40px 16px;text-align:center;color:var(--yellow);font-size:11px">
          ⏳ Loading sector stock list from GitHub…
        </div>`; sdFetchCsv().then(() => { const fresh = n500CsvGetCached(); if (fresh) sdRenderCharts(sectorName, secData); }); return;
    }
    stocks = csv.filter(s => { const mapped = _vcpbViewMode === 'industry' ? csvIndustryMap(s.symbol, s.company, s.industry) : csvSectorMap(s.symbol, s.company, s.industry); return mapped === sectorName; }); stocks = [...stocks].sort((a, b) => a.symbol.localeCompare(b.symbol));
  }
  if (_sdSearchQuery) { stocks = stocks.filter(s => (s.symbol && s.symbol.toLowerCase().includes(_sdSearchQuery)) || (s.company && s.company.toLowerCase().includes(_sdSearchQuery))); }
  if (stocks.length === 0) {
    body.innerHTML = `
      <div class="sd-charts-controls">
        <div style="display:flex;align-items:center;gap:6px">
          <span style="color:var(--dim)">Source:</span>
          <select onchange="sdSetChartsSource(this.value)" style="background:var(--bg4);border:1px solid var(--border);color:var(--text);font-size:10px;font-weight:600;padding:3px 6px;border-radius:3px;outline:none;height:24px;">
            <option value="vcp" ${_sdChartsSource === 'vcp' ? 'selected' : ''}>VCP Candidates</option>
            <option value="universe" ${_sdChartsSource === 'universe' ? 'selected' : ''}>Sector Universe</option>
          </select>
        </div>
      </div>
      <div style="padding:40px 16px;text-align:center;color:var(--dim);font-size:11px">
        No stocks found matching the criteria. Try clearing the search bar or changing filters.
      </div>`; return;
  }
  const totalCharts = stocks.length; const isAuto = (_sdChartsLayout === 'auto'); let pageStocks; let startIdx = 0; let endIdx = 0; let totalPages = 1; if (isAuto) { startIdx = 0; endIdx = Math.min(_sdAutoChartsLimit, totalCharts); pageStocks = stocks.slice(0, endIdx); } else { totalPages = Math.ceil(totalCharts / _sdChartsPerPage); if (_sdChartsPage >= totalPages) _sdChartsPage = Math.max(0, totalPages - 1); startIdx = _sdChartsPage * _sdChartsPerPage; endIdx = Math.min(startIdx + _sdChartsPerPage, totalCharts); pageStocks = stocks.slice(startIdx, endIdx); }
  const cardHeight = getChartsCardHeight(_sdChartsLayout); const gridStyle = getChartsGridStyle(_sdChartsLayout); const chartCardsHtml = pageStocks.map(s => {
    const tvUrl = `https://www.tradingview.com/chart/?symbol=NSE%3A${encodeURIComponent(s.symbol)}`; const msUrl = `https://marketsmithindia.com/mstool/eval/${s.symbol.toLowerCase()}/evaluation.jsp#/`; let statsHtml = ''; const emaLegend = ` | <span style="color:var(--dim);font-size:9px">EMA20: <b style="color:rgba(239, 68, 68, 0.5)">●</b></span>`; if (_sdChartsSource === 'vcp') {
      const rsVal = s.rs_rating != null ? s.rs_rating : '—'; const score = s.final_score > 0 ? s.final_score : s.vcp_score; statsHtml = `
        <span style="color:var(--dim);font-size:9px">
          RS: <b style="color:var(--purple)">${rsVal}</b> | Score: <b style="color:var(--teal)">${Math.round(score)}</b>${emaLegend}
        </span>`;
    } else {
      const vcpData = (_sdCurrentData?.stocks || []).find(x => x.symbol === s.symbol); let vcpBadges = ''; if (vcpData) {
        const rsVal = vcpData.rs_rating != null ? vcpData.rs_rating : '—'; vcpBadges = `
          <span style="font-size:8px;background:rgba(45,212,191,.15);color:var(--teal);padding:1px 4px;border-radius:2px;border:1px solid rgba(45,212,191,.25);font-weight:600">VCP</span>
          <span style="font-size:8px;background:rgba(167,139,250,.15);color:var(--purple);padding:1px 4px;border-radius:2px;border:1px solid rgba(167,139,250,.25);font-weight:600;margin-left:2px">RS ${rsVal}</span>`;
      }
      statsHtml = `
        <div style="display:flex;align-items:center;gap:3px">
          ${vcpBadges}
          <span style="color:var(--dim);font-size:9px;margin-left:3px">EMA20: <b style="color:rgba(239, 68, 68, 0.5)">●</b></span>
        </div>`;
    }
    return `
      <div class="sd-chart-card" id="sd-card-${s.symbol}" data-symbol="${s.symbol}" style="height:${cardHeight}">
        <div class="sd-chart-header">
          <div style="display:flex;align-items:center;gap:6px">
            <span style="font-weight:800;font-size:12px;color:var(--teal);font-family:var(--mono)">${s.symbol}</span>
            <span style="color:var(--dim);font-size:9px;max-width:110px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${s.company}</span>
          </div>
          <div style="display:flex;align-items:center;gap:6px">
            ${statsHtml}
            <a href="${tvUrl}" target="_blank" rel="noopener"
               style="font-size:8px;color:var(--accent);text-decoration:none;padding:1px 4px;border-radius:2px;border:1px solid rgba(91,163,245,.2);background:rgba(91,163,245,.08)"
               title="Open full chart on TradingView">TV↗</a>
            <a href="${msUrl}" target="_blank" rel="noopener"
               style="font-size:8px;color:#f59e0b;text-decoration:none;padding:1px 4px;border-radius:2px;border:1px solid rgba(245,158,11,.25);background:rgba(245,158,11,.08)"
               title="Open stock on MarketSmith India">MS↗</a>
            <button onclick="openMaximizedChart('${s.symbol}')"
               class="sd-chart-max-btn"
               title="Enlarge Chart">⛶</button>
          </div>
        </div>
        <div class="sd-chart-container" style="background:#0c0d12;display:flex;flex-direction:column;justify-content:center;position:relative;">
          <canvas id="yf-chart-${s.symbol}" style="width:100%;height:100%;display:block;"></canvas>
          <div id="yf-loader-${s.symbol}" style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:#0c0d12;color:var(--dim);font-size:10px;">
            Loading chart…
          </div>
        </div>
      </div>`;
  }).join(''); let vcpFiltersHtml = ''; if (_sdChartsSource === 'vcp') {
    vcpFiltersHtml = `
      <div style="display:flex;align-items:center;gap:6px;margin-left:2px;border-left:1px solid var(--border);padding-left:8px;">
        <span style="color:var(--dim)">Filter:</span>
        <select onchange="sdSetFilter(this.value)" style="background:var(--bg4);border:1px solid var(--border);color:var(--text);font-size:10px;font-weight:600;padding:3px 6px;border-radius:3px;outline:none;height:24px;">
          <option value="all" ${_sdFilter === 'all' ? 'selected' : ''}>All</option>
          <option value="rs90" ${_sdFilter === 'rs90' ? 'selected' : ''}>RS ≥ 90</option>
          <option value="rs80" ${_sdFilter === 'rs80' ? 'selected' : ''}>RS ≥ 80</option>
          <option value="score70" ${_sdFilter === 'score70' ? 'selected' : ''}>Score ≥ 70</option>
        </select>
      </div>`;
  }
  const controlsHtml = `
    <div class="sd-charts-controls">
      <div style="display:flex;align-items:center;gap:6px">
        <span style="color:var(--dim)">Source:</span>
        <select onchange="sdSetChartsSource(this.value)" style="background:var(--bg4);border:1px solid var(--border);color:var(--text);font-size:10px;font-weight:600;padding:3px 6px;border-radius:3px;outline:none;height:24px;">
          <option value="vcp" ${_sdChartsSource === 'vcp' ? 'selected' : ''}>VCP Candidates</option>
          <option value="universe" ${_sdChartsSource === 'universe' ? 'selected' : ''}>Sector Universe</option>
        </select>
      </div>

      ${vcpFiltersHtml}

      <div style="display:flex;align-items:center;gap:6px;margin-left:2px;border-left:1px solid var(--border);padding-left:8px;">
        <span style="color:var(--dim)">Layout:</span>
        <select onchange="sdSetLayout(this.value)" style="background:var(--bg4);border:1px solid var(--border);color:var(--text);font-size:10px;font-weight:600;padding:3px 6px;border-radius:3px;outline:none;height:24px;">
          <option value="auto" ${_sdChartsLayout === 'auto' ? 'selected' : ''}>Auto-Grid</option>
          <option value="1" ${_sdChartsLayout === '1' ? 'selected' : ''}>1x1 (Single)</option>
          <option value="4" ${_sdChartsLayout === '4' ? 'selected' : ''}>2x2 (4 Charts)</option>
          <option value="6" ${_sdChartsLayout === '6' ? 'selected' : ''}>3x2 (6 Charts)</option>
          <option value="9" ${_sdChartsLayout === '9' ? 'selected' : ''}>3x3 (9 Charts)</option>
          <option value="12" ${_sdChartsLayout === '12' ? 'selected' : ''}>4x3 (12 Charts)</option>
          <option value="16" ${_sdChartsLayout === '16' ? 'selected' : ''}>4x4 (16 Charts)</option>
          <option value="20" ${_sdChartsLayout === '20' ? 'selected' : ''}>5x4 (20 Charts)</option>
          <option value="24" ${_sdChartsLayout === '24' ? 'selected' : ''}>6x4 (24 Charts)</option>
          <option value="30" ${_sdChartsLayout === '30' ? 'selected' : ''}>6x5 (30 Charts)</option>
          <option value="36" ${_sdChartsLayout === '36' ? 'selected' : ''}>6x6 (36 Charts)</option>
          <option value="48" ${_sdChartsLayout === '48' ? 'selected' : ''}>8x6 (48 Charts)</option>
        </select>
      </div>

      <div style="display:flex;align-items:center;gap:6px;margin-left:2px;border-left:1px solid var(--border);padding-left:8px;">
        <span style="color:var(--dim)">Timeframe:</span>
        <select onchange="sdSetChartsInterval(this.value)" style="background:var(--bg4);border:1px solid var(--border);color:var(--text);font-size:10px;font-weight:600;padding:3px 6px;border-radius:3px;outline:none;height:24px;">
          <option value="D" ${_sdChartsInterval === 'D' ? 'selected' : ''}>Daily</option>
          <option value="W" ${_sdChartsInterval === 'W' ? 'selected' : ''}>Weekly</option>
        </select>
      </div>

      <div style="display:flex;align-items:center;gap:6px;margin-left:2px;border-left:1px solid var(--border);padding-left:8px;">
        <span style="color:var(--dim)">Type:</span>
        <select onchange="sdSetChartType(this.value)" style="background:var(--bg4);border:1px solid var(--border);color:var(--text);font-size:10px;font-weight:600;padding:3px 6px;border-radius:3px;outline:none;height:24px;">
          <option value="candlestick" ${_sdChartType === 'candlestick' ? 'selected' : ''}>Candles</option>
          <option value="ohlc" ${_sdChartType === 'ohlc' ? 'selected' : ''}>Bars</option>
          <option value="volume_candles" ${_sdChartType === 'volume_candles' ? 'selected' : ''}>Volume Candles</option>
        </select>
      </div>

      <div style="display:flex;align-items:center;gap:6px;margin-left:2px;border-left:1px solid var(--border);padding-left:8px;">
        <span style="color:var(--dim)">Sort:</span>
        <select onchange="sdSetSortBy(this.value)" style="background:var(--bg4);border:1px solid var(--border);color:var(--text);font-size:10px;font-weight:600;padding:3px 6px;border-radius:3px;outline:none;height:24px;">
          <option value="score" ${_sdSortBy === 'score' ? 'selected' : ''}>Score</option>
          <option value="rs" ${_sdSortBy === 'rs' ? 'selected' : ''}>RS Rating</option>
          <option value="stage" ${_sdSortBy === 'stage' ? 'selected' : ''}>Stage</option>
          <option value="symbol" ${_sdSortBy === 'symbol' ? 'selected' : ''}>Symbol</option>
        </select>
      </div>

      <div style="display:flex;align-items:center;gap:6px;margin-left:auto;">
        ${isAuto ? `<span style="color:var(--dim)">Showing ${endIdx}of ${totalCharts}charts</span>` : `<span style="color:var(--dim)">Showing ${startIdx + 1}-${endIdx}of ${totalCharts}</span><button onclick="sdChartsPrevPage()"${_sdChartsPage === 0 ? 'disabled' : ''}
style="background:var(--bg4);border:1px solid var(--border);color:${_sdChartsPage === 0 ? 'var(--dim)' : 'var(--text)'};padding:2px 8px;border-radius:3px;cursor:${_sdChartsPage === 0 ? 'not-allowed' : 'pointer'};font-weight:600;height:24px;font-size:8px;">◀</button><span style="font-family:var(--mono);color:var(--sub)">${_sdChartsPage + 1}/${totalPages}</span><button onclick="sdChartsNextPage(${totalPages})"${_sdChartsPage >= totalPages - 1 ? 'disabled' : ''}
style="background:var(--bg4);border:1px solid var(--border);color:${_sdChartsPage >= totalPages - 1 ? 'var(--dim)' : 'var(--text)'};padding:2px 8px;border-radius:3px;cursor:${_sdChartsPage >= totalPages - 1 ? 'not-allowed' : 'pointer'};font-weight:600;height:24px;font-size:8px;">▶</button>`}
      </div>
    </div>`; let viewMoreHtml = ''; if (isAuto && endIdx < totalCharts) {
    viewMoreHtml = `
      <div style="text-align:center;padding:20px 0;background:var(--bg);">
        <button onclick="sdChartsLoadMore()" 
                style="background:var(--teal);color:#0e1420;border:none;padding:8px 20px;border-radius:4px;cursor:pointer;font-weight:700;font-size:12px;transition:all .15s;box-shadow:0 4px 10px rgba(45,212,191,.2);"
                onmouseenter="this.style.opacity='0.9';this.style.transform='translateY(-1px)'"
                onmouseleave="this.style.opacity='1';this.style.transform='none'">
          View More Charts (${totalCharts - endIdx} remaining)
        </button>
      </div>`;
  }
  body.innerHTML = controlsHtml + `
    <div class="sd-charts-grid" style="display:grid;${gridStyle}">
      ${chartCardsHtml}
    </div>`+ viewMoreHtml; const range = _sdChartsInterval === 'D' ? '1y' : '2y'; const interval = _sdChartsInterval === 'D' ? '1d' : '1wk'; const observer = new IntersectionObserver((entries, obs) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const symbol = entry.target.getAttribute('data-symbol'); obs.unobserve(entry.target); Promise.all([fetchYfData(symbol, range, interval), symbol.toUpperCase() !== '^NSEI' ? fetchYfData('^NSEI', range, interval).catch(() => null) : Promise.resolve(null)]).then(([candles, niftyCandles]) => { const loader = document.getElementById(`yf-loader-${symbol}`); if (loader) loader.style.display = 'none'; drawAnyChart(`yf-chart-${symbol}`, candles, _sdChartType, null, niftyCandles); }).catch(err => {
          console.error("YF Chart Error for " + symbol, err); const loader = document.getElementById(`yf-loader-${symbol}`); if (loader) {
            loader.innerHTML = `
                <div style="color:var(--sub);font-size:10px;text-align:center;padding:12px;line-height:1.5;max-width:260px;margin:0 auto;">
                  <span style="color:var(--red);font-weight:600;display:block;margin-bottom:6px;">Failed to load chart data</span>
                  Check your internet connection or proxy.
                </div>`;
          }
        });
      }
    });
  }, { root: document.getElementById('sd-body'), rootMargin: '100px', threshold: 0.01 }); pageStocks.forEach(s => { const card = document.getElementById(`sd-card-${s.symbol}`); if (card) observer.observe(card); });
}
function sdToggleSectorDropdown(event) { event.stopPropagation(); const dropdown = document.getElementById('sd-sector-dropdown'); if (!dropdown) return; const isHidden = dropdown.style.display === 'none' || dropdown.style.display === ''; dropdown.style.display = isHidden ? 'block' : 'none'; }
function sdPopulateSectorsDropdown(data) {
  const dropdown = document.getElementById('sd-sector-dropdown'); const activeMap = data ? (_vcpbViewMode === 'industry' ? data.industries : data.sectors) : null; if (!dropdown || !data || !activeMap) return; const sectors = Object.keys(activeMap).sort(); dropdown.innerHTML = sectors.map(sec => {
    const isCurrent = sec === _sdCurrentSector; return `
      <div onclick="sdChangeSector('${sec.replace(/'/g, "\\'")}')" 
           style="padding: 8px 14px; font-size: 12px; color: ${isCurrent ? 'var(--teal)' : 'var(--text)'}; font-weight: ${isCurrent ? '700' : 'normal'}; cursor: pointer; transition: background 0.15s; display: flex; align-items: center; justify-content: space-between;"
           onmouseenter="this.style.background='rgba(255,255,255,0.05)'" 
           onmouseleave="this.style.background='transparent'">
        <span>${sec}</span>
        ${isCurrent ? '<span>✓</span>' : ''}
      </div>`;
  }).join('');
}
function sdChangeSector(sec) { const dropdown = document.getElementById('sd-sector-dropdown'); if (dropdown) dropdown.style.display = 'none'; sectorDrillOpen(sec, _sdActiveTab); }
document.addEventListener('click', () => { const dropdown = document.getElementById('sd-sector-dropdown'); if (dropdown) dropdown.style.display = 'none'; });
function sdChangeSector(sec) { const dropdown = document.getElementById('sd-sector-dropdown'); if (dropdown) dropdown.style.display = 'none'; sectorDrillOpen(sec, _sdActiveTab); }
document.addEventListener('click', () => { const dropdown = document.getElementById('sd-sector-dropdown'); if (dropdown) dropdown.style.display = 'none'; });
function ensureOctoberDataSeeded() {
  try {
    // 1. Seed October Breadth Records if missing or update key Nifty levels
    const existingRecs = loadLocal();
    const recMap = new Map(existingRecs.map(r => [r.date, r]));
    let recsChanged = false;

    const octRecords = [
      { date: '2026-10-29', adv: 293, dec: 203, unc: 1, hi: 8, lo: 9, e20: 31.2, s50: 19.5, s200: 32.6, nifty: 22866.35, niftyLow: 22656.75, vol: 19.26, notes: 'Current session' },
      { date: '2026-10-28', adv: 148, dec: 154, unc: 2, hi: 6, lo: 18, e20: 28.3, s50: 21.7, s200: 31.6, nifty: 22698.85, niftyLow: 22497.70, vol: 23.72, notes: '' },
      { date: '2026-10-27', adv: 353, dec: 146, unc: 0, hi: 7, lo: 25, e20: 25.7, s50: 17.6, s200: 32.3, nifty: 22749.75, niftyLow: 22636.85, vol: 37.14, notes: '' },
      { date: '2026-10-26', adv: 337, dec: 162, unc: 0, hi: 3, lo: 66, e20: 15.6, s50: 13.0, s200: 29.1, nifty: 22753.20, niftyLow: 22387.35, vol: 27.26, notes: '' },
      { date: '2026-10-23', adv: 39, dec: 460, unc: 0, hi: 3, lo: 110, e20: 11.0, s50: 10.0, s200: 25.3, nifty: 22600.00, niftyLow: 22372.00, vol: 30.67, notes: '' },
      { date: '2026-10-22', adv: 141, dec: 357, unc: 1, hi: 3, lo: 71, e20: 17.2, s50: 13.6, s200: 30.3, nifty: 22687.65, niftyLow: 22554.85, vol: 34.58, notes: '' },
      { date: '2026-10-21', adv: 82, dec: 416, unc: 1, hi: 3, lo: 62, e20: 17.8, s50: 13.8, s200: 32.1, nifty: 22811.35, niftyLow: 22649.90, vol: 31.24, notes: '' },
      { date: '2026-10-19', adv: 86, dec: 412, unc: 1, hi: 4, lo: 23, e20: 25.1, s50: 18.6, s200: 37.5, nifty: 22888.95, niftyLow: 22845.00, vol: 26.88, notes: '' },
      { date: '2026-10-16', adv: 258, dec: 240, unc: 1, hi: 7, lo: 15, e20: 33.3, s50: 22.2, s200: 39.7, nifty: 23146.15, niftyLow: 22913.80, vol: 42.14, notes: '' },
      { date: '2026-10-15', adv: 207, dec: 291, unc: 1, hi: 4, lo: 13, e20: 30.9, s50: 20.2, s200: 40.5, nifty: 22997.35, niftyLow: 22637.40, vol: 34.22, notes: '' },
      { date: '2026-10-14', adv: 244, dec: 255, unc: 0, hi: 3, lo: 8, e20: 34.7, s50: 24.0, s200: 40.9, nifty: 22622.70, niftyLow: 22558.95, vol: 30.73, notes: '' },
      { date: '2026-10-13', adv: 369, dec: 130, unc: 0, hi: 4, lo: 16, e20: 29.5, s50: 20.8, s200: 39.3, nifty: 22721.95, niftyLow: 22288.45, vol: 28.21, notes: '🚀 Follow-Through Day (FTD) +1.60% on vol' },
      { date: '2026-10-12', adv: 270, dec: 227, unc: 2, hi: 4, lo: 15, e20: 22.4, s50: 19.6, s200: 37.7, nifty: 22363.35, niftyLow: 22304.45, vol: 23.91, notes: '' },
      { date: '2026-10-09', adv: 352, dec: 147, unc: 0, hi: 3, lo: 27, e20: 18.6, s50: 17.2, s200: 37.5, nifty: 22520.45, niftyLow: 22179.90, vol: 28.06, notes: '📍 Day 1 of Rally Attempt off 22179.90 bottom' },
      { date: '2026-10-08', adv: 36, dec: 463, unc: 0, hi: 1, lo: 58, e20: 13.0, s50: 14.0, s200: 35.5, nifty: 22231.80, niftyLow: 22179.90, vol: 34.28, notes: 'Market bottom / selling climax' },
      { date: '2026-10-07', adv: 147, dec: 351, unc: 1, hi: 10, lo: 24, e20: 27.1, s50: 22.6, s200: 37.5, nifty: 22603.05, niftyLow: 22546.30, vol: 32.64, notes: '' },
      { date: '2026-10-06', adv: 358, dec: 139, unc: 2, hi: 5, lo: 8, e20: 26.9, s50: 23.4, s200: 39.1, nifty: 22776.10, niftyLow: 22561.60, vol: 28.71, notes: '' },
      { date: '2026-10-05', adv: 272, dec: 226, unc: 1, hi: 0, lo: 23, e20: 15.4, s50: 20.0, s200: 38.1, nifty: 22555.75, niftyLow: 22397.10, vol: 38.38, notes: '' },
      { date: '2026-10-01', adv: 111, dec: 387, unc: 1, hi: 2, lo: 68, e20: 12.0, s50: 16.6, s200: 37.7, nifty: 22421.95, niftyLow: 22217.30, vol: 39.27, notes: '' }
    ];

    octRecords.forEach(octR => {
      const existing = recMap.get(octR.date);
      if (!existing || existing.adv > 400 || existing.e20 > 40 || existing.notes === 'Consolidation' || existing.notes === 'Bounce from support') {
        octR.score = calcScore(octR);
        const z = getZone(octR.score);
        octR.zone = z.name;
        octR.r = z.r;
        octR._updatedAt = Date.now();
        recMap.set(octR.date, octR);
        recsChanged = true;
      }
    });

    if (recsChanged) {
      const mergedRecs = Array.from(recMap.values()).sort((a, b) => b.date.localeCompare(a.date));
      saveLocal(mergedRecs);
    }

    // 2. Ensure October FTD entries are seeded, active and confirmed
    let ftdData = ftdLoad();
    let ftdChanged = false;

    // Remove any duplicate or spurious attempts on down day Oct 14 or non-volume FTD on Oct 15
    const originalLen = ftdData.length;
    ftdData = ftdData.filter(d => {
      if (d.date === '2026-10-14' && (d.type === 'attempt' || d._origType === 'attempt')) return false;
      if (d.date === '2026-10-15' && d.type === 'followthrough' && d.volUp === false) return false;
      return true;
    });
    if (ftdData.length !== originalLen) ftdChanged = true;

    // Deduplicate all entries by date (keeping the most authoritative)
    const dedupMap = new Map();
    for (const d of ftdData) {
      if (!d.date) continue;
      if (!dedupMap.has(d.date)) {
        dedupMap.set(d.date, d);
      } else {
        ftdChanged = true;
        const existing = dedupMap.get(d.date);
        if (existing.type === 'void' && d.type !== 'void') {
          dedupMap.set(d.date, d);
        } else if ((d.type === 'attempt' || d.type === 'followthrough') && existing.type !== 'attempt' && existing.type !== 'followthrough') {
          dedupMap.set(d.date, d);
        }
      }
    }
    ftdData = Array.from(dedupMap.values());

    const oct9 = ftdData.find(d => d.date === '2026-10-09');
    if (!oct9 || oct9.type !== 'attempt' || parseFloat(oct9.low || 0) > 22179.90 || oct9.close !== 22520.45) {
      ftdData = ftdData.filter(d => d.date !== '2026-10-09');
      ftdData.push({
        id: 1728475200000,
        date: '2026-10-09',
        _updatedAt: Date.now(),
        close: 22520.45,
        prev: 22231.80,
        low: 22179.90,
        movePct: 1.30,
        volUp: false,
        type: 'attempt',
        auto: true
      });
      ftdChanged = true;
    }

    const oct13 = ftdData.find(d => d.date === '2026-10-13');
    if (!oct13 || oct13.type !== 'followthrough' || oct13.volUp !== true || oct13.movePct !== 1.60) {
      ftdData = ftdData.filter(d => d.date !== '2026-10-13');
      ftdData.push({
        id: 1728820800000,
        date: '2026-10-13',
        _updatedAt: Date.now(),
        close: 22721.95,
        prev: 22363.35,
        low: 22288.45,
        movePct: 1.60,
        volUp: true,
        type: 'followthrough',
        auto: true
      });
      ftdChanged = true;
    }

    if (ftdChanged || recsChanged) {
      if (ftdChanged) {
        ftdData.sort((a, b) => b.date.localeCompare(a.date));
        ftdSaveData(ftdData);
      }
      const cfg = getCfg();
      if (cfg && cfg.key && cfg.bin) {
        setTimeout(() => { pushToCloud().catch(() => {}); }, 1200);
      }
    }

    // 3. Ensure MPM accumulation day on Oct 13 exists
    let mpmData = mpmLoad();
    if (!mpmData.some(d => d.date === '2026-10-13')) {
      mpmData.unshift({
        id: 'eod_2026-10-13',
        date: '2026-10-13',
        close: 22721.95,
        pclose: 22363.35,
        vol: 30.89,
        pvol: 25.88,
        dtype: 'acc',
        auto: true,
        _updatedAt: Date.now()
      });
      mpmSave(mpmData);
    }
  } catch (e) {
    console.warn('[ensureOctoberDataSeeded] error:', e);
  }
}


/* 60-Second EOD Checklist Modal handlers */
function openEodChecklistModal() {
  const el = document.getElementById('eod-checklist-modal-overlay');
  if (el) el.classList.add('open');
}
function closeEodChecklistModal() {
  const el = document.getElementById('eod-checklist-modal-overlay');
  if (el) el.classList.remove('open');
}
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    closeEodChecklistModal();
  }
});

loadWinSettings();


function sccWlCycleFlag(sym, e) {
  if (e) e.stopPropagation();
  const sUpper = sym.toUpperCase();
  const current = _sccSymbolFlags[sUpper] || 'none';
  const order = ['none', 'red', 'blue', 'green', 'yellow', 'pink'];
  const nextIdx = (order.indexOf(current) + 1) % order.length;
  const nextColor = order[nextIdx];
  if (nextColor === 'none') {
    delete _sccSymbolFlags[sUpper];
  } else {
    _sccSymbolFlags[sUpper] = nextColor;
  }
  sccSaveWatchlistsLocalAndSync();
  sccWlRenderTabs();
  sccWatchlistRender();
  if (typeof updateMaxChartSidebarWatchlist === 'function') updateMaxChartSidebarWatchlist();
}
window.sccWlCycleFlag = sccWlCycleFlag;


// ── SCREENER.IN QUARTERLY EPS & SALES ENGINE ─────────────────────
function parseScreenerHtml(symbol, html) {
  if (!html) return null;
  const quartersMatch = html.match(/<section id="quarters"[\s\S]*?<\/section>/);
  if (!quartersMatch) return null;
  const tableHtml = quartersMatch[0];

  const theadMatch = tableHtml.match(/<thead>[\s\S]*?<\/thead>/);
  if (!theadMatch) return null;
  const thMatches = [...theadMatch[0].matchAll(/<th[^>]*>([\s\S]*?)<\/th>/g)].map(m => m[1].replace(/<[^>]+>/g, '').trim()).filter(Boolean);

  const rowMatches = [...tableHtml.matchAll(/<tr>[\s\S]*?<\/tr>/g)];
  let salesRow = null;
  let epsRow = null;
  let netProfitRow = null;

  for (const r of rowMatches) {
    const rowStr = r[0];
    const textCell = rowStr.match(/<td[^>]*class="text"[^>]*>([\s\S]*?)<\/td>/);
    if (!textCell) continue;
    const label = textCell[1].replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim().toLowerCase();
    const cells = [...rowStr.matchAll(/<td(?![^>]*class="text")[^>]*>([\s\S]*?)<\/td>/g)].map(m => {
      const val = parseFloat(m[1].replace(/,/g, '').trim());
      return isNaN(val) ? null : val;
    });

    if (label.startsWith('sales')) salesRow = cells;
    else if (label.startsWith('eps')) epsRow = cells;
    else if (label.startsWith('net profit')) netProfitRow = cells;
  }

  if (!thMatches.length || (!salesRow && !epsRow && !netProfitRow)) return null;

  const items = [];
  for (let i = 0; i < thMatches.length; i++) {
    items.push({
      dateStr: thMatches[i],
      sales: salesRow ? salesRow[i] : null,
      eps: epsRow ? epsRow[i] : (netProfitRow ? netProfitRow[i] : null),
      netProfit: netProfitRow ? netProfitRow[i] : null
    });
  }

  const quarters = [];
  for (let i = items.length - 1; i >= 0; i--) {
    const cur = items[i];
    let epsPct = null;
    let salesPct = null;

    if (i >= 4) {
      const prevYear = items[i - 4];
      if (cur.eps != null && prevYear.eps != null && prevYear.eps !== 0) {
        epsPct = Math.round(((cur.eps - prevYear.eps) / Math.abs(prevYear.eps)) * 100);
      }
      if (cur.sales != null && prevYear.sales != null && prevYear.sales !== 0) {
        salesPct = Math.round(((cur.sales - prevYear.sales) / Math.abs(prevYear.sales)) * 100);
      }
    }

    let dFormatted = cur.dateStr;
    const dParts = cur.dateStr.split(' ');
    if (dParts.length === 2) {
      dFormatted = dParts[0].slice(0, 3) + '-' + dParts[1].slice(-2);
    }

    quarters.push({
      date: dFormatted,
      epsPct: epsPct,
      salesPct: salesPct,
      salesCr: cur.sales,
      netProfitCr: cur.netProfit,
      eps: cur.eps
    });
  }

  // Extract Market Cap & ROE from Screener's top ratios if present
  let roeFormatted = '—';
  let roe = null;
  const roeMatch = html.match(new RegExp("Return on equity[\\s\\S]*?<span class=\"number\">([0-9.]+)</span>%", "i"));
  if (roeMatch) {
    roe = parseFloat(roeMatch[1]) / 100;
    roeFormatted = roeMatch[1] + '%';
  }

  let capCategory = '—';
  let marketCap = null;
  const mcMatch = html.match(new RegExp("Market Cap[\\s\\S]*?<span class=\"number\">([0-9,]+)</span>", "i"));
  if (mcMatch) {
    const mcInCr = parseFloat(mcMatch[1].replace(/,/g, ''));
    if (!isNaN(mcInCr)) {
      marketCap = mcInCr * 1e7;
      if (mcInCr >= 20000) capCategory = 'LargeCap';
      else if (mcInCr >= 5000) capCategory = 'MidCap';
      else if (mcInCr >= 1000) capCategory = 'SmallCap';
      else capCategory = 'MicroCap';
    }
  }

  return {
    symbol: symbol,
    quarters: quarters,
    roe: roe,
    roeFormatted: roeFormatted,
    marketCap: marketCap,
    capCategory: capCategory,
    screenerUrl: 'https://www.screener.in/company/' + encodeURIComponent(symbol) + '/consolidated/'
  };
}

async function fetchScreenerFundamentals(symbol) {
  if (!symbol) return null;
  const sUpper = symbol.toUpperCase().replace('.NS', '');
  const urls = [
    'https://www.screener.in/company/' + encodeURIComponent(sUpper) + '/consolidated/',
    'https://www.screener.in/company/' + encodeURIComponent(sUpper) + '/'
  ];

  const proxies = [
    url => 'http://localhost:9090/?url=' + encodeURIComponent(url),
    url => 'https://nse-chart-proxy.shibu-mk.workers.dev/?url=' + encodeURIComponent(url),
    url => 'https://api.allorigins.win/get?url=' + encodeURIComponent(url),
    url => 'https://api.codetabs.com/v1/proxy?quest=' + encodeURIComponent(url),
    url => 'https://corsproxy.io/?url=' + encodeURIComponent(url)
  ];

  for (const targetUrl of urls) {
    for (const proxyFn of proxies) {
      try {
        const pUrl = proxyFn(targetUrl);
        if (!pUrl) continue;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 6000);
        const resp = await fetch(pUrl, { signal: controller.signal });
        clearTimeout(timeoutId);
        if (resp.ok) {
          let text = await resp.text();
          if (text.trim().startsWith('{')) {
            try {
              const j = JSON.parse(text);
              if (j.contents) text = j.contents;
            } catch (e) { }
          }
          if (text.includes('id="quarters"') || text.includes('Quarters') || text.includes('quarters')) {
            const data = parseScreenerHtml(sUpper, text);
            if (data && data.quarters && data.quarters.length > 0) {
              return data;
            }
          }
        }
      } catch (e) { }
    }
  }
  return null;
}


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

function saveChartDrawings() {
  try {
    localStorage.setItem('nse_chart_drawings_v2', JSON.stringify(_chartDrawings));
  } catch (e) { }
}

function getActiveDrawingSymbol() {
  return ((_maxChartLayout !== '1' && _layoutSymbols[_activeLayoutTile - 1]) || _sdMaximizedChartSymbol || 'DEFAULT').toUpperCase().replace('.NS', '');
}

function clearChartDrawings() {
  const sym = getActiveDrawingSymbol();
  if (!sym) return;
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
    if (!d || !d.p1) continue;

    const pt1 = pointToPixels(d.p1, timeScale, series);
    const pt2 = d.p2 ? pointToPixels(d.p2, timeScale, series) : pt1;

    // 1. Check anchor handles first (tolerance 9px)
    if (d.type === 'trendline' || d.type === 'ray') {
      if (Math.hypot(x - pt1.x, y - pt1.y) <= 9) return { index: i, drawing: d, handle: 'p1', pt: pt1 };
      if (Math.hypot(x - pt2.x, y - pt2.y) <= 9) return { index: i, drawing: d, handle: 'p2', pt: pt2 };
      if (distToSegment(x, y, pt1.x, pt1.y, pt2.x, pt2.y) <= 7) return { index: i, drawing: d, handle: 'body' };
    } else if (d.type === 'ray_h') {
      if (Math.hypot(x - pt1.x, y - pt1.y) <= 9) return { index: i, drawing: d, handle: 'p1', pt: pt1 };
      if (Math.abs(y - pt1.y) <= 7 && x >= pt1.x - 6) return { index: i, drawing: d, handle: 'body' };
    } else if (d.type === 'rect' || d.type === 'scale' || d.type === 'measure') {
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
      const minY = Math.min(pt1.y, pt2.y) - 6;
      const maxY = Math.max(pt1.y, pt2.y) + 6;
      const minX = Math.min(pt1.x, pt2.x) - 10;
      const maxX = Math.max(pt1.x, pt2.x, 900);
      if (y >= minY && y <= maxY && x >= minX && x <= maxX) {
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
  syncCanvasSize();

  const getEventCoords = e => {
    syncCanvasSize();
    const rect = canvas.getBoundingClientRect();
    const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
    const y = Math.max(0, Math.min(rect.height, e.clientY - rect.top));

    const { chart, series, timeScale } = getDrawingContext();

    let logical = null;
    let price = null;
    if (chart && timeScale && typeof timeScale.coordinateToLogical === 'function') {
      try { logical = timeScale.coordinateToLogical(x); } catch (err) { }
    }
    if (series && typeof series.coordinateToPrice === 'function') {
      try { price = series.coordinateToPrice(y); } catch (err) { }
    }
    return { x, y, logical, price };
  };

  const commitNewDrawing = (drawing) => {
    const sym = getActiveDrawingSymbol();
    if (!sym) return;
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
        if (hit.handle === 'body') canvas.style.cursor = 'move';
        else if (hit.handle === 'nw' || hit.handle === 'se') canvas.style.cursor = 'nwse-resize';
        else if (hit.handle === 'ne' || hit.handle === 'sw') canvas.style.cursor = 'nesw-resize';
        else if (hit.handle === 'p2' && hit.drawing.type === 'pricenote') canvas.style.cursor = 'move';
        else canvas.style.cursor = 'pointer';
      } else {
        if (_selectedDrawingIndex != null) {
          canvas.style.pointerEvents = 'all';
          canvas.style.cursor = 'default';
        } else {
          canvas.style.pointerEvents = 'none';
          canvas.style.cursor = 'default';
        }
      }
    });
  }

  // MOUSE DOWN on canvas
  canvas.addEventListener('mousedown', e => {
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
        width: 1,
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
        width: 1,
        style: 'solid'
      });
      showChartToast('✔ Placed Price Note at ₹ ' + pVal, '#2962ff');
      return;
    }

    // 3. Single-click tool: Text Annotation
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

    // 4. Two-point tools: trendline, ray, rect, scale
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
        color: _currentDrawTool === 'scale' ? '#22c55e' : _currentDrawTool === 'ray' ? '#eab308' : '#38bdf8',
        width: 1,
        style: 'solid',
        fillOpacity: 0
      };
      redrawChartDrawings();
    } else if (_drawStep === 1) {
      const p2 = {
        x: coords.x,
        y: coords.y,
        logical: coords.logical,
        price: coords.price != null ? coords.price : _drawStart.price
      };
      const dx = Math.abs(p2.x - _drawStart.x);
      const dy = Math.abs(p2.y - _drawStart.y);
      if (dx >= 2 || dy >= 2) {
        commitNewDrawing({
          type: _activeDrawing.type,
          p1: _activeDrawing.p1,
          p2: p2,
          color: _activeDrawing.color,
          width: _activeDrawing.width || 1,
          style: _activeDrawing.style || 'solid',
          fillOpacity: _activeDrawing.fillOpacity != null ? _activeDrawing.fillOpacity : 0
        });
        showChartToast('✔ Placed ' + _activeDrawing.type, _activeDrawing.color);
      } else {
        _activeDrawing = null;
        _drawStep = 0;
        _drawStart = null;
        setDrawingTool('select');
        redrawChartDrawings();
      }
    }
  });

  // MOUSE MOVE on window (for smooth preview and modifying drag)
  window.addEventListener('mousemove', e => {
    // A. Preview while drawing
    if (_drawStep === 1 && _activeDrawing) {
      const coords = getEventCoords(e);
      _activeDrawing.p2 = {
        x: coords.x,
        y: coords.y,
        logical: coords.logical,
        price: coords.price != null ? coords.price : _drawStart.price
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

        d.p1.x = _dragStartDrawing.p1.x + dx;
        d.p1.y = _dragStartDrawing.p1.y + dy;
        if (_dragStartDrawing.p1.logical != null) d.p1.logical = _dragStartDrawing.p1.logical + dLogical;
        if (_dragStartDrawing.p1.price != null) d.p1.price = _dragStartDrawing.p1.price + dPrice;

        if (d.p2 && _dragStartDrawing.p2) {
          d.p2.x = _dragStartDrawing.p2.x + dx;
          d.p2.y = _dragStartDrawing.p2.y + dy;
          if (_dragStartDrawing.p2.logical != null) d.p2.logical = _dragStartDrawing.p2.logical + dLogical;
          if (_dragStartDrawing.p2.price != null) d.p2.price = _dragStartDrawing.p2.price + dPrice;
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

    // 2. Drag-to-draw gesture for new drawing
    if (_drawStep === 1 && _isDrawMouseDown && _drawStart && _activeDrawing) {
      _isDrawMouseDown = false;
      const coords = getEventCoords(e);
      const dx = Math.abs(coords.x - _drawStart.x);
      const dy = Math.abs(coords.y - _drawStart.y);
      const dt = Date.now() - _drawStart.time;
      if (dt >= 150 && (dx >= 20 || dy >= 20)) {
        const p2 = {
          x: coords.x,
          y: coords.y,
          logical: coords.logical,
          price: coords.price != null ? coords.price : _drawStart.price
        };
        commitNewDrawing({
          type: _activeDrawing.type,
          p1: _activeDrawing.p1,
          p2: p2,
          color: _activeDrawing.color,
          width: _activeDrawing.width || 1,
          style: _activeDrawing.style || 'solid',
          fillOpacity: _activeDrawing.fillOpacity != null ? _activeDrawing.fillOpacity : 0
        });
        showChartToast('✔ Placed ' + _activeDrawing.type, _activeDrawing.color);
      }
    }
  });

  // KEYBOARD: ESC deselects, Delete/Backspace removes selected drawing
  window.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      if (_drawStep === 1 || _currentDrawTool !== 'select') {
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
    }
  });

  // Double-click to edit text annotations or Price Notes
  canvas.addEventListener('dblclick', e => {
    const coords = getEventCoords(e);
    const hit = hitTestChartDrawings(coords.x, coords.y);
    if (hit && (hit.drawing.type === 'text' || hit.drawing.type === 'pricenote')) {
      _selectedDrawingIndex = hit.index;
      updateFloatingToolbar();
      editDrawingText(e);
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

  const toPx = p => pointToPixels(p, timeScale, series);

  for (let idx = 0; idx < drawings.length; idx++) {
    const d = drawings[idx];
    if (!d || !d.p1) continue;

    const isSelected = (idx === _selectedDrawingIndex);
    const color = d.color || '#38bdf8';
    const width = d.width || 1;
    const style = d.style || 'solid';

    ctx.save();

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
        ctx.lineTo(W, y);
        ctx.stroke();
        ctx.setLineDash([]);

        // Origin anchor dot
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fill();

        // Right edge price tag
        const pTxt = d.p1.price != null ? ('₹ ' + d.p1.price.toFixed(1)) : '';
        if (pTxt) {
          ctx.font = 'bold 10px -apple-system,BlinkMacSystemFont,sans-serif';
          const tw = ctx.measureText(pTxt).width;
          ctx.fillStyle = '#1e222d';
          ctx.fillRect(W - tw - 16, y - 10, tw + 14, 20);
          ctx.strokeStyle = color;
          ctx.lineWidth = 1;
          ctx.strokeRect(W - tw - 16, y - 10, tw + 14, 20);
          ctx.fillStyle = color;
          ctx.fillText(pTxt, W - tw - 9, y + 3.5);
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
      const rx = Math.min(x1, x2);
      const ry = Math.min(y1, y2);
      const rw = Math.max(1, Math.abs(x2 - x1));
      const rh = Math.max(1, Math.abs(y2 - y1));

      const p1Price = (d.p1 && d.p1.price != null) ? d.p1.price : 0;
      const p2Price = (d.p2 && d.p2.price != null) ? d.p2.price : 0;
      const diffPrice = p2Price - p1Price;
      const pct = p1Price ? ((diffPrice / p1Price) * 100) : 0;
      const isUp = diffPrice >= 0;
      // Default colors: green (#22c55e) for +ve, red (#ef4444) for -ve
      const clr = (color && color !== '#22c55e' && color !== '#ef4444') ? color : (isUp ? '#22c55e' : '#ef4444');
      const fillOp = (d.fillOpacity != null && d.fillOpacity > 0) ? d.fillOpacity : 0.14;

      // Fill measurement box - NO BORDER lines
      const bgClr = typeof hexToRgba === 'function' ? hexToRgba(clr, fillOp) : (isUp ? 'rgba(34, 197, 94, 0.14)' : 'rgba(239, 68, 68, 0.14)');
      ctx.fillStyle = bgClr;
      ctx.fillRect(rx, ry, rw, rh);

      // Values: % and (no. of bars) only
      const bCount = (d.p1 && d.p1.logical != null && d.p2 && d.p2.logical != null) ? Math.abs(Math.round(d.p2.logical - d.p1.logical)) + 1 : Math.round(rw / 10);
      const sign = isUp ? '+' : '';
      const txt = sign + pct.toFixed(2) + '% (' + bCount + ' bars)';

      ctx.font = 'bold 11px -apple-system,BlinkMacSystemFont,sans-serif';
      const tw = ctx.measureText(txt).width;
      const badgeW = tw + 18;
      const badgeH = 22;
      const midX = rx + rw / 2;
      const bx = Math.max(10, Math.min(W - badgeW - 10, midX - badgeW / 2));

      // Stats badge position: above on +ve, below on -ve
      let by;
      const badgePos = d.badgePos || 'auto';
      if (badgePos === 'inside' || badgePos === 'center') {
        by = Math.max(10, Math.min(H - badgeH - 10, ry + rh / 2 - badgeH / 2));
      } else if (isUp) {
        by = ry - badgeH - 4;
        if (by < 10) by = 10;
      } else {
        by = ry + rh + 4;
        if (by + badgeH > H - 10) by = H - badgeH - 10;
      }

      // Label badge: solid dark pill - NO BORDER line
      ctx.fillStyle = 'rgba(15, 23, 42, 0.90)';
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(bx, by, badgeW, badgeH, 4);
      else ctx.rect(bx, by, badgeW, badgeH);
      ctx.fill();

      // Text in badge
      ctx.fillStyle = clr;
      ctx.font = 'bold 11px -apple-system,BlinkMacSystemFont,sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(txt, bx + badgeW / 2, by + badgeH / 2);
      ctx.textBaseline = 'alphabetic';
      ctx.textAlign = 'left';

      if (isSelected) {
        drawAnchorHandle(ctx, rx, ry);
        drawAnchorHandle(ctx, rx + rw, ry);
        drawAnchorHandle(ctx, rx + rw, ry + rh);
        drawAnchorHandle(ctx, rx, ry + rh);
      }
    }
    ctx.restore();
  }
}
window.redrawChartDrawings = redrawChartDrawings;

// ── FLOATING CUSTOMIZATION TOOLBAR LOGIC ──
const TV_DRAW_PALETTE = ['#38bdf8', '#2962ff', '#22c55e', '#eab308', '#f97316', '#ef4444', '#a855f7', '#f0f3fa'];

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
  const pt1 = pointToPixels(d.p1, timeScale, series);
  const pt2 = d.p2 ? pointToPixels(d.p2, timeScale, series) : pt1;

  const midX = (pt1.x + pt2.x) / 2;
  const minY = Math.min(pt1.y, pt2.y);

  const stage = document.getElementById('max-chart-stage');
  const stageW = stage ? stage.clientWidth : 800;
  const stageH = stage ? stage.clientHeight : 500;

  const barW = 220;
  const targetLeft = Math.max(15, Math.min(stageW - barW - 15, midX - barW / 2));
  const targetTop = Math.max(50, Math.min(stageH - 60, minY - 44));

  bar.style.left = targetLeft + 'px';
  bar.style.top = targetTop + 'px';
  bar.style.display = 'flex';

  const clr = d.color || '#38bdf8';
  const width = d.width || 1;
  const style = d.style || 'solid';
  const styleIcon = style === 'dotted' ? '···' : style === 'dashed' ? '- -' : '──';
  const hasFill = (d.type === 'rect' || d.type === 'scale' || d.type === 'measure');
  const fillPct = Math.round((d.fillOpacity != null ? d.fillOpacity : 0) * 100);

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
    '<button class="tv-float-btn" onclick="cycleDrawingWidth(event)" title="Line Width">' +
      '<span>' + width + 'px</span>' +
    '</button>' +
    '<button class="tv-float-btn" onclick="cycleDrawingStyle(event)" title="Line Style">' +
      '<span style="font-family:monospace;letter-spacing:1px;">' + styleIcon + '</span>' +
    '</button>' +
    (hasFill ? (
      '<div class="tv-float-sep"></div>' +
      '<button class="tv-float-btn" onclick="cycleDrawingOpacity(event)" title="Fill Opacity (0% = Transparent)">' +
        '<span>' + fillPct + '%</span>' +
      '</button>'
    ) : '') +
    (d.type === 'scale' || d.type === 'measure' ? (
      '<div class="tv-float-sep"></div>' +
      '<button class="tv-float-btn" onclick="toggleScaleBadgePos(event)" title="Stats Badge Position (Above / Inside)">' +
        '<span style="font-size:10px;">' + ((d.badgePos || 'above') === 'above' ? '▲ Above' : '■ Inside') + '</span>' +
      '</button>'
    ) : '') +
    (d.type === 'text' || d.type === 'pricenote' ? (
      '<div class="tv-float-sep"></div>' +
      '<button class="tv-float-btn" onclick="editDrawingText(event)" title="Edit Text / Price Note">' +
        '<span>✎ Edit</span>' +
      '</button>'
    ) : '') +
    '<div class="tv-float-sep"></div>' +
    '<button class="tv-float-btn" onclick="openCoordsDialog(_chartDrawings[getActiveDrawingSymbol()][_selectedDrawingIndex])" title="Precise Coordinates">' +
      '<span style="font-size:10px;">⌖ Coord</span>' +
    '</button>' +
    '<button class="tv-float-btn" onclick="deleteSelectedDrawing(event)" title="Delete" style="color:#ef4444;">' +
      '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>' +
    '</button>' +
    '<button class="tv-float-btn" onclick="deselectDrawing(event)" title="Close" style="color:#94a3b8;font-size:12px;">✕</button>';
}
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
    d.badgePos = (d.badgePos || 'above') === 'above' ? 'inside' : 'above';
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
    const promptMsg = d.type === 'pricenote' ? 'Edit Price Note text / price:' : 'Edit annotation text:';
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

// ── MISSING STUDIO CONTROL HANDLERS ──
function closeMaximizedChart() {
  const overlay = document.getElementById('chart-max-overlay');
  if (overlay) overlay.style.display = 'none';
  _selectedDrawingIndex = null;
  hideFloatingToolbar();
  if (_maxLwChart) {
    try { _maxLwChart.remove(); } catch (e) { }
    _maxLwChart = null;
    _maxLwPriceSeries = null;
  }
  for (let i = 2; i <= 4; i++) {
    if (_subLwCharts[i]) {
      try { _subLwCharts[i].remove(); } catch (e) { }
      _subLwCharts[i] = null;
      _subLwSeries[i] = null;
    }
  }
  setDrawingTool('select');
}
window.closeMaximizedChart = closeMaximizedChart;

function maxChartChangeTimeframe(interval) {
  _sdChartsInterval = interval;
  const sel = document.getElementById('max-chart-timeframe');
  if (sel && sel.value !== interval) sel.value = interval;
  if (_sdMaximizedChartSymbol) {
    _maxFetchAndDraw(_sdMaximizedChartSymbol);
  }
}
window.maxChartChangeTimeframe = maxChartChangeTimeframe;

function maxChartChangeType(type) {
  _sdChartType = type;
  const sel = document.getElementById('max-chart-type');
  if (sel && sel.value !== type) sel.value = type;
  if (_sdMaximizedChartSymbol) {
    drawMaxChart();
  }
}
window.maxChartChangeType = maxChartChangeType;

function maxChartResetView() {
  if (_maxLwChart) {
    try {
      _maxLwChart.timeScale().resetTimeScale();
      _maxLwChart.priceScale('right').applyOptions({ autoScale: true });
      _maxLwChart.timeScale().fitContent();
    } catch (e) { }
  }
  for (let i = 2; i <= 4; i++) {
    if (_subLwCharts[i]) {
      try {
        _subLwCharts[i].timeScale().resetTimeScale();
        _subLwCharts[i].priceScale('right').applyOptions({ autoScale: true });
        _subLwCharts[i].timeScale().fitContent();
      } catch (e) { }
    }
  }
  syncCanvasSize();
  redrawChartDrawings();
  updateFloatingToolbar();
  showChartToast('⟲ Chart view reset');
}
window.maxChartResetView = maxChartResetView;

function maxChartRefresh() {
  if (_sdMaximizedChartSymbol) {
    _maxFetchAndDraw(_sdMaximizedChartSymbol);
  }
}
window.maxChartRefresh = maxChartRefresh;

function loadSeedIntoModal() { }
window.loadSeedIntoModal = loadSeedIntoModal;


// ── TRADINGVIEW MULTI-CHART LAYOUT & TILE STOCK SELECTION ──
let _maxChartLayout = '1'; // '1', '2h', '2v', '4'
let _activeLayoutTile = 1; // 1, 2, 3, or 4
let _layoutSymbols = ['SHYAMMETL', 'RELIANCE', 'TCS', 'HDFCBANK'];
let _subLwCharts = [null, null, null, null]; // Sub-chart instances for tiles 2, 3, 4
let _subLwSeries = [null, null, null, null];

// Set active layout tile (1, 2, 3, 4) with blue focus ring
function maxChartSetActiveTile(tileNum) {
  _activeLayoutTile = tileNum;
  for (let i = 1; i <= 4; i++) {
    const id = i === 1 ? 'max-chart-lw-container' : ('max-chart-lw-container-' + i);
    const el = document.getElementById(id);
    if (!el) continue;
    if (_maxChartLayout !== '1' && i === tileNum) {
      el.style.boxShadow = 'inset 0 0 0 2px #2962ff';
      el.style.zIndex = '10';
    } else {
      el.style.boxShadow = _maxChartLayout !== '1' ? 'inset 0 0 0 1px #2a2e39' : 'none';
      el.style.zIndex = '1';
    }
    const hdr = document.getElementById('tv-tile-hdr-' + i);
    if (hdr) hdr.classList.toggle('active-tile', i === tileNum);
  }

  // Update top header info to reflect active tile
  const sym = _layoutSymbols[tileNum - 1] || _sdMaximizedChartSymbol;
  const maxSymbol = document.getElementById('max-chart-symbol');
  if (maxSymbol && sym) maxSymbol.textContent = sym;
  if (typeof getStockDetails === 'function') {
    const details = getStockDetails(sym);
    const maxCompany = document.getElementById('max-chart-company');
    if (maxCompany && details) {
      maxCompany.innerHTML = '<span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:200px;">' + (details.company || '—') + '</span><span style="font-size:10px;color:var(--dim);background:rgba(255,255,255,0.04);border:1px solid var(--border);padding:1px 6px;border-radius:3px;font-weight:500;white-space:nowrap;flex-shrink:0;">' + (details.sector || '') + '</span>';
    }
  }
  updateMaxChartSidebarWatchlist();
}
window.maxChartSetActiveTile = maxChartSetActiveTile;

// Set symbol for a specific tile
function maxChartSetTileSymbol(tileNum, symbol) {
  if (!symbol) return;
  const sUpper = symbol.toUpperCase().replace('.NS', '').trim();
  _layoutSymbols[tileNum - 1] = sUpper;

  if (tileNum === 1) {
    _sdMaximizedChartSymbol = sUpper;
    _layoutSymbols[0] = sUpper;
    const maxSymbol = document.getElementById('max-chart-symbol');
    if (maxSymbol) maxSymbol.textContent = sUpper;
    _maxFetchAndDraw(sUpper);
    maxChartAttachTileHeader(1, sUpper);
  } else {
    maxChartRenderSubTile(tileNum, sUpper);
  }
  maxChartSetActiveTile(tileNum);
  showChartToast('Tile ' + tileNum + ' → <b>' + sUpper + '</b>', '#2962ff');
}
window.maxChartSetTileSymbol = maxChartSetTileSymbol;

// Unified handler when a stock is selected anywhere (Watchlist click, search, autocomplete)
function maxChartOnStockSelected(symbol) {
  if (!symbol) return;
  const sUpper = symbol.toUpperCase().replace('.NS', '').trim();
  if (_maxChartLayout === '1') {
    _layoutSymbols[0] = sUpper;
    openMaximizedChart(sUpper);
  } else {
    maxChartSetTileSymbol(_activeLayoutTile, sUpper);
  }
}
window.maxChartOnStockSelected = maxChartOnStockSelected;

// Switch Layout (1, 2h, 2v, 4)
function maxChartSetLayout(layout) {
  _maxChartLayout = layout;
  const stage = document.getElementById('max-chart-stage');
  const c1 = document.getElementById('max-chart-lw-container');
  const c2 = document.getElementById('max-chart-lw-container-2');
  const c3 = document.getElementById('max-chart-lw-container-3');
  const c4 = document.getElementById('max-chart-lw-container-4');
  if (!stage || !c1) return;

  const select = document.getElementById('max-chart-layout-select');
  if (select && select.value !== layout) select.value = layout;

  // Make sure c1 is clickable to focus Tile 1
  if (!c1._tileWired) {
    c1._tileWired = true;
    c1.addEventListener('mousedown', () => maxChartSetActiveTile(1), true);
    if (c2) c2.addEventListener('mousedown', () => maxChartSetActiveTile(2), true);
    if (c3) c3.addEventListener('mousedown', () => maxChartSetActiveTile(3), true);
    if (c4) c4.addEventListener('mousedown', () => maxChartSetActiveTile(4), true);
  }

  if (layout === '1') {
    c1.style.width = '100%'; c1.style.height = '100%'; c1.style.top = '0'; c1.style.left = '0';
    if (c2) c2.style.display = 'none';
    if (c3) c3.style.display = 'none';
    if (c4) c4.style.display = 'none';
    const h1 = document.getElementById('tv-tile-hdr-1');
    if (h1) h1.style.display = 'none';
    maxChartSetActiveTile(1);
  } else if (layout === '2h') {
    c1.style.width = '50%'; c1.style.height = '100%'; c1.style.top = '0'; c1.style.left = '0';
    if (c2) { c2.style.display = 'block'; c2.style.width = '50%'; c2.style.height = '100%'; c2.style.top = '0'; c2.style.left = '50%'; c2.style.borderLeft = '1px solid #2a2e39'; }
    if (c3) c3.style.display = 'none';
    if (c4) c4.style.display = 'none';
    maxChartAttachTileHeader(1, _layoutSymbols[0]);
  } else if (layout === '2v') {
    c1.style.width = '100%'; c1.style.height = '50%'; c1.style.top = '0'; c1.style.left = '0';
    if (c2) { c2.style.display = 'block'; c2.style.width = '100%'; c2.style.height = '50%'; c2.style.top = '50%'; c2.style.left = '0'; c2.style.borderTop = '1px solid #2a2e39'; }
    if (c3) c3.style.display = 'none';
    if (c4) c4.style.display = 'none';
    maxChartAttachTileHeader(1, _layoutSymbols[0]);
  } else if (layout === '4') {
    c1.style.width = '50%'; c1.style.height = '50%'; c1.style.top = '0'; c1.style.left = '0';
    if (c2) { c2.style.display = 'block'; c2.style.width = '50%'; c2.style.height = '50%'; c2.style.top = '0'; c2.style.left = '50%'; c2.style.borderLeft = '1px solid #2a2e39'; }
    if (c3) { c3.style.display = 'block'; c3.style.width = '50%'; c3.style.height = '50%'; c3.style.top = '50%'; c3.style.left = '0'; c3.style.borderTop = '1px solid #2a2e39'; }
    if (c4) { c4.style.display = 'block'; c4.style.width = '50%'; c4.style.height = '50%'; c4.style.top = '50%'; c4.style.left = '50%'; c4.style.borderLeft = '1px solid #2a2e39'; c4.style.borderTop = '1px solid #2a2e39'; }
    maxChartAttachTileHeader(1, _layoutSymbols[0]);
  }

  // Resize main chart
  if (typeof _maxLwChart !== 'undefined' && _maxLwChart) {
    const rect = c1.getBoundingClientRect();
    _maxLwChart.applyOptions({ width: rect.width, height: rect.height });
  }

  // Populate sub-charts if multi-chart layout
  if (layout !== '1') {
    // Populate default list if empty
    let wl = _sccWatchlistSymbols || [];
    if (!wl.length) wl = ['AVALON', 'RELIANCE', 'TCS', 'HDFCBANK', 'CARBORUNIV', 'AEGISVOPAK'];
    const curSym = (_layoutSymbols[0] || _sdMaximizedChartSymbol || '').toUpperCase().replace('.NS', '');
    const pool = wl.filter(s => s.toUpperCase() !== curSym);

    if (!_layoutSymbols[1]) _layoutSymbols[1] = pool[0] || 'RELIANCE';
    if (!_layoutSymbols[2]) _layoutSymbols[2] = pool[1] || 'TCS';
    if (!_layoutSymbols[3]) _layoutSymbols[3] = pool[2] || 'HDFCBANK';

    if (layout === '2h' || layout === '2v') {
      maxChartRenderSubTile(2, _layoutSymbols[1]);
    } else if (layout === '4') {
      maxChartRenderSubTile(2, _layoutSymbols[1]);
      maxChartRenderSubTile(3, _layoutSymbols[2]);
      maxChartRenderSubTile(4, _layoutSymbols[3]);
    }
    maxChartSetActiveTile(_activeLayoutTile || 1);
  }
  maxChartResetView();
}
window.maxChartSetLayout = maxChartSetLayout;

// Attach header controls directly inside Tile container
function maxChartAttachTileHeader(tileNum, symbol) {
  const containerId = tileNum === 1 ? 'max-chart-lw-container' : ('max-chart-lw-container-' + tileNum);
  const container = document.getElementById(containerId);
  if (!container) return;

  // Remove existing header
  const oldHdr = document.getElementById('tv-tile-hdr-' + tileNum);
  if (oldHdr) oldHdr.remove();

  if (_maxChartLayout === '1' && tileNum === 1) return;

  const hdr = document.createElement('div');
  hdr.id = 'tv-tile-hdr-' + tileNum;
  hdr.className = 'tv-tile-header ' + (tileNum === _activeLayoutTile ? 'active-tile' : '');
  hdr.onclick = e => { e.stopPropagation(); maxChartSetActiveTile(tileNum); };

  hdr.innerHTML = '<button class="tv-tile-sym-btn" onclick="maxChartOpenTilePicker(' + tileNum + ', event)" title="Select stock for Tile ' + tileNum + '">' +
    '<span>' + symbol + '</span>' +
    '<svg width="7" height="5" viewBox="0 0 10 6"><path d="M0 0l5 6 5-6z" fill="currentColor"/></svg>' +
  '</button>' +
  '<button class="tv-tile-nav-btn" onclick="maxChartTilePrevNext(' + tileNum + ', -1, event)" title="Previous Watchlist Stock">◀</button>' +
  '<button class="tv-tile-nav-btn" onclick="maxChartTilePrevNext(' + tileNum + ', 1, event)" title="Next Watchlist Stock">▶</button>';

  container.appendChild(hdr);
}

// Next/Previous Stock for a tile
function maxChartTilePrevNext(tileNum, delta, event) {
  if (event) event.stopPropagation();
  let list = _sccWatchlistSymbols;
  if (!list || !list.length) list = ['AVALON', 'RELIANCE', 'TCS', 'HDFCBANK', 'CARBORUNIV', 'AEGISVOPAK'];
  const cur = (_layoutSymbols[tileNum - 1] || '').toUpperCase();
  let idx = list.indexOf(cur);
  if (idx === -1) idx = 0;
  let nextIdx = (idx + delta + list.length) % list.length;
  const nextSym = list[nextIdx];
  maxChartSetTileSymbol(tileNum, nextSym);
}
window.maxChartTilePrevNext = maxChartTilePrevNext;

// Open Tile Stock Picker Dropdown Popover
function maxChartOpenTilePicker(tileNum, event) {
  if (event) event.stopPropagation();
  maxChartSetActiveTile(tileNum);

  // Remove any existing menu
  document.querySelectorAll('.tv-tile-picker-menu').forEach(m => m.remove());

  const hdr = document.getElementById('tv-tile-hdr-' + tileNum);
  if (!hdr) return;

  const menu = document.createElement('div');
  menu.className = 'tv-tile-picker-menu';
  menu.onclick = e => e.stopPropagation();

  menu.innerHTML = '<input type="text" class="tv-tile-picker-inp" placeholder="Type stock for Tile ' + tileNum + '…" ' +
    'oninput="maxChartTileSearchInput(' + tileNum + ', this.value)" ' +
    'onkeydown="if(event.key===\'Enter\'&&this.value.trim()){maxChartSetTileSymbol(' + tileNum + ', this.value.trim()); this.closest(\'div\').remove();}">' +
    '<div id="tv-tile-picker-list-' + tileNum + '"></div>';

  hdr.appendChild(menu);

  // Render initial list with active watchlist symbols
  maxChartTileSearchInput(tileNum, '');

  const inp = menu.querySelector('input');
  if (inp) { inp.focus(); }

  // Auto-close on outside click
  setTimeout(() => {
    const closeListener = e => {
      if (!menu.contains(e.target)) {
        menu.remove();
        window.removeEventListener('click', closeListener);
      }
    };
    window.addEventListener('click', closeListener);
  }, 10);
}
window.maxChartOpenTilePicker = maxChartOpenTilePicker;

function maxChartTileSearchInput(tileNum, query) {
  const listEl = document.getElementById('tv-tile-picker-list-' + tileNum);
  if (!listEl) return;
  const q = (query || '').trim().toLowerCase();

  let pool = _sccWatchlistSymbols || [];
  if (!pool.length) pool = ['AVALON', 'RELIANCE', 'TCS', 'HDFCBANK', 'CARBORUNIV', 'AEGISVOPAK', 'TATATECH', 'IDFCFIRSTB'];

  if (q) {
    let allStocks = (typeof n500CsvGetCached === 'function' ? n500CsvGetCached() : []) || [];
    if (allStocks.length > 0) {
      pool = allStocks.filter(s => (s.symbol && s.symbol.toLowerCase().includes(q)) || (s.company && s.company.toLowerCase().includes(q))).map(s => s.symbol).slice(0, 10);
    } else {
      pool = pool.filter(s => s.toLowerCase().includes(q));
    }
  }

  if (!pool.length) {
    listEl.innerHTML = '<div style="color:#787b86;font-size:10px;padding:6px;text-align:center;">No matching stock found</div>';
    return;
  }

  listEl.innerHTML = pool.map(s => {
    const sUpper = s.toUpperCase();
    return '<div class="tv-tile-picker-item" onclick="maxChartSetTileSymbol(' + tileNum + ', \'' + sUpper + '\'); this.closest(\'.tv-tile-picker-menu\').remove();">' +
      '<span style="font-weight:700;color:var(--teal);">' + sUpper + '</span>' +
      '<span style="font-size:9px;color:#94a3b8;">Select</span>' +
    '</div>';
  }).join('');
}
window.maxChartTileSearchInput = maxChartTileSearchInput;

// Render Sub-Chart Tile (2, 3, 4)
async function maxChartRenderSubTile(tileNum, symbol) {
  const container = document.getElementById('max-chart-lw-container-' + tileNum);
  if (!container || typeof LightweightCharts === 'undefined') return;

  const rect = container.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return;

  // Clean old instance
  if (_subLwCharts[tileNum]) {
    try { _subLwCharts[tileNum].remove(); } catch (e) { }
    _subLwCharts[tileNum] = null;
  }
  container.innerHTML = '';

  // Make container clickable to focus
  container.onclick = () => maxChartSetActiveTile(tileNum);

  // Attach Tile Header
  maxChartAttachTileHeader(tileNum, symbol);

  const chart = LightweightCharts.createChart(container, {
    width: rect.width,
    height: rect.height,
    layout: { background: { color: '#050508' }, textColor: '#787b86', fontSize: 10 },
    grid: { vertLines: { color: 'rgba(255, 255, 255, 0.03)' }, horzLines: { color: 'rgba(255, 255, 255, 0.03)' } },
    timeScale: { borderColor: '#2a2e39', timeVisible: false },
    rightPriceScale: { borderColor: '#2a2e39' }
  });
  _subLwCharts[tileNum] = chart;

  const series = chart.addCandlestickSeries({
    upColor: '#26a69a', downColor: '#ef5350', borderVisible: false, wickUpColor: '#26a69a', wickDownColor: '#ef5350'
  });
  _subLwSeries[tileNum] = series;

  try {
    let candles;
    if (_chartDataSource === 'dhan') {
      candles = await fetchDhanCandles(symbol, '1y', '1d').catch(() => fetchYfData(symbol, '1y', '1d'));
    } else {
      candles = await fetchYfData(symbol, '1y', '1d');
    }
    if (candles && candles.length) {
      const clean = [];
      const seen = new Set();
      for (const c of candles) {
        const tSec = typeof c.time === 'number' ? Math.floor(c.time / 1000) : c.time;
        if (!seen.has(tSec)) {
          seen.add(tSec);
          clean.push({ time: tSec, open: c.open, high: c.high, low: c.low, close: c.close });
        }
      }
      clean.sort((a, b) => a.time - b.time);
      series.setData(clean);
      chart.timeScale().fitContent();
      try {
        chart.timeScale().subscribeVisibleLogicalRangeChange(() => redrawChartDrawings());
      } catch (e) { }
    }
  } catch (e) { }
}


// ── DHAN HQ DATA API & AUTHENTICATION ENGINE ──────────────────────
const DHAN_SECURITY_MAP = {
  'RELIANCE': '2885', 'TCS': '11536', 'HDFCBANK': '1333', 'INFY': '1594', 'ICICIBANK': '4963',
  'SBIN': '3045', 'BHARTIARTL': '10604', 'ITC': '1660', 'KOTAKBANK': '1922', 'LT': '11483',
  'AXISBANK': '5900', 'TATAMOTORS': '3456', 'MARUTI': '10999', 'TITAN': '3506', 'SUNPHARMA': '3351',
  'BAJFINANCE': '317', 'TRENT': '1964', 'BEL': '383', 'HAL': '2303', 'SYRMA': '7618',
  'AVALON': '15386', 'SHYAMMETL': '4220', 'ATHERENERG': '20311', 'INDHOTEL': '1512', 'TECHM': '13538',
  'PVRINOX': '13147', 'CHENNPETRO': '637', 'LAURUSLABS': '19234', 'PPLPHARMA': '11373', 'IGIL': '16155',
  'WELSPUNLIV': '3718', 'DIXON': '21690', 'CDSL': '21174', 'BSE': '1904', 'ZOMATO': '5097',
  'PAYTM': '4717', 'NYKAA': '6545', 'COALINDIA': '20374', 'NTPC': '11630', 'ONGC': '2475',
  'POWERGRID': '14977', 'JSWSTEEL': '11723', 'TATASTEEL': '3499', 'HINDALCO': '1363', 'VEDL': '3063',
  'ADANIENT': '25', 'ADANIPORTS': '15083', 'CIPLA': '694', 'DRREDDY': '881', 'EICHERMOT': '910',
  'GRASIM': '1232', 'HCLTECH': '7229', 'HEROMOTOCO': '1348', 'HINDUNILVR': '1394', 'JIOFIN': '18143',
  'M&M': '2031', 'NESTLEIND': '17963', 'ULTRACEMCO': '11532', 'WIPRO': '3787', 'APOLLOHOSP': '157'
};

let _dhanScripMaster = null;
async function resolveDhanSecurityId(symbol) {
  if (!symbol) return null;
  const sUpper = symbol.toUpperCase().replace('.NS', '').trim();
  if (DHAN_SECURITY_MAP[sUpper]) return DHAN_SECURITY_MAP[sUpper];

  if (!_dhanScripMaster) {
    try {
      const resp = await fetch('https://images.dhan.co/api-data/api-scrip-master.csv');
      if (resp.ok) {
        const text = await resp.text();
        _dhanScripMaster = {};
        const lines = text.split('\n');
        for (let i = 1; i < lines.length; i++) {
          const parts = lines[i].split(',');
          if (parts.length >= 4) {
            const secId = parts[1]?.trim();
            const sym = parts[3]?.trim().toUpperCase();
            if (sym && secId) _dhanScripMaster[sym] = secId;
          }
        }
      }
    } catch (e) { }
  }
  if (_dhanScripMaster && _dhanScripMaster[sUpper]) {
    return _dhanScripMaster[sUpper];
  }
  return null;
}

function getDhanSecurityId(symbol) {
  if (!symbol) return null;
  const sUpper = symbol.toUpperCase().replace('.NS', '').trim();
  if (DHAN_SECURITY_MAP[sUpper]) return DHAN_SECURITY_MAP[sUpper];
  return null;
}

// Fetch daily/historical candles from Dhan HQ API
async function fetchDhanCandles(symbol, range, interval) {
  const sUpper = symbol.toUpperCase().replace('.NS', '').trim();
  const secId = await resolveDhanSecurityId(sUpper);
  if (!secId) {
    throw new Error('Dhan security ID not mapped for ' + sUpper);
  }

  const token = await dhanGetActiveToken();
  const clientId = dhanGetActiveClientId();
  if (!token) throw new Error('Dhan Access Token missing or expired');

  const toDate = new Date().toISOString().split('T')[0];
  const fromDateObj = new Date();
  fromDateObj.setFullYear(fromDateObj.getFullYear() - 5);
  const fromDate = fromDateObj.toISOString().split('T')[0];

  const payload = {
    securityId: String(secId),
    exchangeSegment: 'NSE_EQ',
    instrument: 'EQUITY',
    expiryCode: 0,
    oi: false,
    fromDate: fromDate,
    toDate: toDate
  };

  const urls = [
    'https://api.dhan.co/v2/charts/historical',
    'http://localhost:9090/dhan/charts/historical'
  ];

  let lastErr;
  for (const url of urls) {
    try {
      const resp = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'access-token': token,
          'client-id': String(clientId || '')
        },
        body: JSON.stringify(payload)
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.errorMessage || err.error || ('HTTP ' + resp.status));
      }
      const data = await resp.json();
      const times = data.start_Time || data.timestamp || [];
      const opens = data.open || [];
      const highs = data.high || [];
      const lows = data.low || [];
      const closes = data.close || [];
      const volumes = data.volume || [];

      if (!times.length) throw new Error('Dhan returned 0 candles for ' + sUpper);

      const candles = [];
      for (let i = 0; i < times.length; i++) {
        candles.push({
          time: times[i] * 1000,
          open: opens[i],
          high: highs[i],
          low: lows[i],
          close: closes[i],
          volume: volumes[i] || 0
        });
      }
      return candles;
    } catch (e) {
      lastErr = e;
      if (url === urls[0] && (e.name === 'TypeError' || e.message.includes('CORS') || e.message.includes('Failed to fetch'))) {
        continue; // Try proxy on localhost:9090
      }
      throw e;
    }
  }
  throw lastErr;
}

function openDhanConnectModal() {
  const modal = document.getElementById('dhan-chart-modal');
  if (modal) modal.style.display = 'flex';
}
window.openDhanConnectModal = openDhanConnectModal;

function closeDhanConnectModal() {
  const modal = document.getElementById('dhan-chart-modal');
  if (modal) modal.style.display = 'none';
}
window.closeDhanConnectModal = closeDhanConnectModal;

function dhanSaveQuickToken() {
  const inp = document.getElementById('dhan-quick-token');
  const token = inp ? inp.value.trim() : '';
  if (!token) {
    alert('Please paste your 24-hour Dhan Access Token.');
    return;
  }

  // Save to both token credentials and API key credentials
  dhanSaveCreds('DhanUser', token);
  const cur = dhanGetApiKeyCreds();
  dhanSaveApiKeyCreds(cur?.clientId || 'DhanUser', DHAN_DEFAULT_KEY, DHAN_DEFAULT_SECRET, token, Date.now());

  closeDhanConnectModal();
  showChartToast('⚡ Dhan Access Token Saved! Refreshing chart…', '#22c55e');

  _chartDataSource = 'dhan';
  const dsSelect = document.getElementById('max-chart-datasource');
  if (dsSelect) dsSelect.value = 'dhan';

  maxChartRefresh();
}
window.dhanSaveQuickToken = dhanSaveQuickToken;

function dhanQuickOAuthLogin() {
  const clientIdInp = document.getElementById('dhan-quick-clientid');
  const cId = clientIdInp ? clientIdInp.value.trim() : '';
  if (!cId) {
    alert('Please enter your Dhan Client ID first.');
    return;
  }
  dhanSaveApiKeyCreds(cId, DHAN_DEFAULT_KEY, DHAN_DEFAULT_SECRET, '', 0);
  if (typeof dhanApiKeyOpenLogin === 'function') {
    dhanApiKeyOpenLogin();
  }
}
window.dhanQuickOAuthLogin = dhanQuickOAuthLogin;

function maxChartSetDataSource(source) {
  _chartDataSource = source;
  const dsSelect = document.getElementById('max-chart-datasource');
  if (dsSelect) dsSelect.value = source;

  if (source === 'dhan') {
    const creds = (typeof dhanGetApiKeyCreds === 'function') ? dhanGetApiKeyCreds() : null;
    const tokenCreds = (typeof dhanGetCreds === 'function') ? dhanGetCreds() : null;
    const hasToken = (creds && creds.cachedToken) || (tokenCreds && tokenCreds.token);

    if (!hasToken) {
      openDhanConnectModal();
    } else {
      showChartToast('⚡ Connected to Dhan HQ API', '#22c55e');
    }
  } else {
    showChartToast('📈 Yahoo Finance Active', '#2962ff');
  }
  maxChartRefresh();
}
window.maxChartSetDataSource = maxChartSetDataSource;


// ── TRADINGVIEW MAXIMIZED WATCHLIST SIDEBAR ──────────────────────
function toggleMaxChartWatchlist() {
  const sidebar = document.getElementById('max-chart-sidebar-wl');
  const btn = document.getElementById('max-chart-wl-btn');
  if (!sidebar) return;
  const isHidden = sidebar.style.display === 'none' || getComputedStyle(sidebar).display === 'none';
  sidebar.style.display = isHidden ? 'flex' : 'none';
  if (btn) btn.classList.toggle('active', isHidden);

  setTimeout(() => {
    if (typeof _maxLwChart !== 'undefined' && _maxLwChart) {
      const container = document.getElementById('max-chart-lw-container');
      if (container) {
        _maxLwChart.applyOptions({ width: container.clientWidth, height: container.clientHeight });
        redrawChartDrawings();
      }
    }
  }, 80);

  if (isHidden) updateMaxChartSidebarWatchlist();
}
window.toggleMaxChartWatchlist = toggleMaxChartWatchlist;

function maxChartSidebarAddSymbol(sym) {
  if (!sym) return;
  const sUpper = sym.trim().toUpperCase().replace('.NS', '');
  if (!sUpper) return;

  if (typeof sccWatchlistAddSymbol === 'function') {
    sccWatchlistAddSymbol(sUpper);
  } else {
    if (!_sccWatchlists[_sccActiveWatchlist]) _sccWatchlists[_sccActiveWatchlist] = [];
    if (!_sccWatchlists[_sccActiveWatchlist].includes(sUpper)) {
      _sccWatchlists[_sccActiveWatchlist].push(sUpper);
    }
    _sccWatchlistSymbols = _sccWatchlists[_sccActiveWatchlist];
    sccSaveWatchlistsLocalAndSync();
    sccWatchlistRender();
  }

  updateMaxChartSidebarWatchlist();
}
window.maxChartSidebarAddSymbol = maxChartSidebarAddSymbol;

// Comprehensive stock aggregator across all sources
function getAllAvailableStocks() {
  const stockMap = new Map();

  // 1. n500 CSV cache
  if (typeof n500CsvGetCached === 'function') {
    const list = n500CsvGetCached();
    if (Array.isArray(list)) {
      for (const s of list) {
        if (s && s.symbol) {
          const sym = s.symbol.toUpperCase().replace('.NS', '').trim();
          if (!stockMap.has(sym)) {
            stockMap.set(sym, { symbol: sym, company: s.company || '', sector: s.sector || s.industry || '' });
          }
        }
      }
    }
  }

  // 2. Sector drill cache (sectors & industries)
  if (typeof sectorDrillGetCached === 'function') {
    const drill = sectorDrillGetCached();
    if (drill) {
      const maps = [drill.sectors, drill.industries];
      for (const m of maps) {
        if (m) {
          for (const k in m) {
            const sec = m[k];
            if (sec && Array.isArray(sec.stocks)) {
              for (const s of sec.stocks) {
                if (s && s.symbol) {
                  const sym = s.symbol.toUpperCase().replace('.NS', '').trim();
                  if (!stockMap.has(sym)) {
                    stockMap.set(sym, { symbol: sym, company: s.company || '', sector: k });
                  } else if (!stockMap.get(sym).company && s.company) {
                    stockMap.get(sym).company = s.company;
                  }
                }
              }
            }
          }
        }
      }
    }
  }

  // 3. Current sector scan data
  if (typeof _sdCurrentData !== 'undefined' && _sdCurrentData?.stocks && Array.isArray(_sdCurrentData.stocks)) {
    for (const s of _sdCurrentData.stocks) {
      if (s && s.symbol) {
        const sym = s.symbol.toUpperCase().replace('.NS', '').trim();
        if (!stockMap.has(sym)) {
          stockMap.set(sym, { symbol: sym, company: s.company || '', sector: s.sector || '' });
        }
      }
    }
  }

  // 4. Fallback popular NSE stocks
  const fallbacks = [
    { symbol: 'RELIANCE', company: 'Reliance Industries Ltd', sector: 'Energy' },
    { symbol: 'TCS', company: 'Tata Consultancy Services', sector: 'IT' },
    { symbol: 'HDFCBANK', company: 'HDFC Bank Ltd', sector: 'Banking' },
    { symbol: 'INFY', company: 'Infosys Ltd', sector: 'IT' },
    { symbol: 'ICICIBANK', company: 'ICICI Bank Ltd', sector: 'Banking' },
    { symbol: 'SBIN', company: 'State Bank of India', sector: 'Banking' },
    { symbol: 'BHARTIARTL', company: 'Bharti Airtel Ltd', sector: 'Telecom' },
    { symbol: 'ITC', company: 'ITC Ltd', sector: 'FMCG' },
    { symbol: 'KOTAKBANK', company: 'Kotak Mahindra Bank', sector: 'Banking' },
    { symbol: 'LT', company: 'Larsen & Toubro Ltd', sector: 'Capital Goods' },
    { symbol: 'TATAMOTORS', company: 'Tata Motors Ltd', sector: 'Auto' },
    { symbol: 'MARUTI', company: 'Maruti Suzuki India', sector: 'Auto' },
    { symbol: 'SUNPHARMA', company: 'Sun Pharmaceutical', sector: 'Pharma' },
    { symbol: 'TITAN', company: 'Titan Company Ltd', sector: 'Consumer' },
    { symbol: 'BAJFINANCE', company: 'Bajaj Finance Ltd', sector: 'Finance' },
    { symbol: 'TRENT', company: 'Trent Ltd', sector: 'Retail' },
    { symbol: 'BEL', company: 'Bharat Electronics Ltd', sector: 'Defence' },
    { symbol: 'HAL', company: 'Hindustan Aeronautics Ltd', sector: 'Defence' },
    { symbol: 'SHYAMMETL', company: 'Shyam Metalics and Energy', sector: 'Metals' },
    { symbol: 'SYRMA', company: 'Syrma SGS Technology', sector: 'Electronics' },
    { symbol: 'INDHOTEL', company: 'Indian Hotels Co Ltd', sector: 'Hospitality' },
    { symbol: 'TECHM', company: 'Tech Mahindra Ltd', sector: 'IT' },
    { symbol: 'PVRINOX', company: 'PVR INOX Ltd', sector: 'Media' },
    { symbol: 'CHENNPETRO', company: 'Chennai Petroleum Corp', sector: 'Energy' },
    { symbol: 'LAURUSLABS', company: 'Laurus Labs Ltd', sector: 'Pharma' },
    { symbol: 'PPLPHARMA', company: 'Piramal Pharma Ltd', sector: 'Pharma' },
    { symbol: 'IGIL', company: 'Ingersoll-Rand India Ltd', sector: 'Capital Goods' },
    { symbol: 'ACUTAAS', company: 'Acutaas Ltd', sector: 'Metals' },
    { symbol: 'WELSPUNLIV', company: 'Welspun Living Ltd', sector: 'Textiles' },
    { symbol: 'ATHERENERG', company: 'Ather Energy Ltd', sector: 'Auto' }
  ];
  for (const fb of fallbacks) {
    if (!stockMap.has(fb.symbol)) {
      stockMap.set(fb.symbol, fb);
    }
  }

  return Array.from(stockMap.values());
}
window.getAllAvailableStocks = getAllAvailableStocks;

let _sidebarSuggestActiveIdx = -1;

function maxChartSidebarSearchInput(val) {
  const suggestBox = document.getElementById('max-chart-sidebar-suggest');
  if (!suggestBox) return;

  _sidebarSuggestActiveIdx = -1;
  const query = (val || '').trim().toLowerCase();
  const allStocks = getAllAvailableStocks();

  let matches = [];
  if (!query) {
    // Show top trending stocks when clicking in empty input
    matches = allStocks.slice(0, 8);
  } else {
    // Ranked matching: startsWith first, contains second
    const exactStart = [];
    const symContains = [];
    const compContains = [];

    for (const s of allStocks) {
      const symLow = (s.symbol || '').toLowerCase();
      const compLow = (s.company || '').toLowerCase();

      if (symLow.startsWith(query)) {
        exactStart.push(s);
      } else if (symLow.includes(query)) {
        symContains.push(s);
      } else if (compLow.includes(query)) {
        compContains.push(s);
      }
      if (exactStart.length + symContains.length + compContains.length >= 15) break;
    }
    matches = exactStart.concat(symContains, compContains).slice(0, 10);
  }

  if (matches.length === 0) {
    if (query) {
      const qUpper = query.toUpperCase();
      suggestBox.innerHTML =
        '<div class="max-suggest-item" style="padding:8px 10px;cursor:pointer;border-bottom:1px solid #2a2e39;display:flex;align-items:center;justify-content:space-between;" ' +
          'onmouseenter="maxChartSidebarHighlightItem(this)" ' +
          'onmouseleave="this.style.background=\'transparent\'" ' +
          'onmousedown="maxChartSidebarSelectStock(\'' + qUpper + '\')">' +
          '<div style="display:flex;align-items:center;gap:6px;">' +
            '<span style="font-weight:700;font-size:12px;color:var(--teal);font-family:var(--mono);">+ Add "' + qUpper + '"</span>' +
          '</div>' +
          '<span style="font-size:10px;font-weight:700;color:#22c55e;background:rgba(34,197,94,0.12);border:1px solid rgba(34,197,94,0.3);padding:2px 6px;border-radius:3px;">Custom Ticker</span>' +
        '</div>';
      suggestBox.style.display = 'block';
    } else {
      suggestBox.style.display = 'none';
      suggestBox.innerHTML = '';
    }
    return;
  }

  suggestBox.innerHTML = matches.map((s, idx) => {
    const symEsc = s.symbol.replace(/'/g, "\\'");
    const details = typeof getStockDetails === 'function' ? getStockDetails(s.symbol) : null;
    const compName = s.company || details?.company || '';
    const secName = s.sector || details?.sector || '';

    return '<div class="max-suggest-item" data-index="' + idx + '" data-symbol="' + symEsc + '" ' +
      'style="padding:7px 10px;cursor:pointer;border-bottom:1px solid #2a2e39;display:flex;align-items:center;justify-content:space-between;transition:background .12s;" ' +
      'onmouseenter="maxChartSidebarHighlightItem(this)" ' +
      'onmouseleave="this.style.background=\'transparent\'" ' +
      'onmousedown="maxChartSidebarSelectStock(\'' + symEsc + '\')">' +
      '<div style="display:flex;flex-direction:column;min-width:0;gap:2px;">' +
        '<div style="display:flex;align-items:center;gap:6px;">' +
          '<span style="font-weight:700;font-size:12px;color:var(--teal);font-family:var(--mono);">' + s.symbol + '</span>' +
          (secName ? '<span style="font-size:9px;color:#787b86;background:rgba(255,255,255,0.05);padding:1px 4px;border-radius:3px;border:1px solid #2a2e39;">' + secName + '</span>' : '') +
        '</div>' +
        '<span class="comp-name" style="font-size:10px;color:#94a3b8;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:170px;">' + compName + '</span>' +
      '</div>' +
      '<span style="font-size:10px;font-weight:700;color:#22c55e;background:rgba(34,197,94,0.12);border:1px solid rgba(34,197,94,0.3);padding:2px 6px;border-radius:3px;flex-shrink:0;">+ Add</span>' +
    '</div>';
  }).join('');

  suggestBox.style.display = 'block';
}
window.maxChartSidebarSearchInput = maxChartSidebarSearchInput;

function maxChartSidebarHighlightItem(el) {
  const suggestBox = document.getElementById('max-chart-sidebar-suggest');
  if (!suggestBox) return;
  suggestBox.querySelectorAll('.max-suggest-item').forEach(item => {
    item.style.background = 'transparent';
    item.style.borderLeft = 'none';
  });
  if (el) {
    el.style.background = '#262b3d';
    el.style.borderLeft = '3px solid #2962ff';
    const idx = parseInt(el.getAttribute('data-index'));
    if (!isNaN(idx)) _sidebarSuggestActiveIdx = idx;
  }
}
window.maxChartSidebarHighlightItem = maxChartSidebarHighlightItem;

function maxChartSidebarKeyDown(e) {
  const suggestBox = document.getElementById('max-chart-sidebar-suggest');
  const inp = document.getElementById('max-chart-sidebar-add-input');
  if (!inp) return;

  const items = suggestBox ? suggestBox.querySelectorAll('.max-suggest-item') : [];

  if (e.key === 'ArrowDown') {
    e.preventDefault();
    if (!items.length) return;
    _sidebarSuggestActiveIdx = (_sidebarSuggestActiveIdx + 1) % items.length;
    const target = items[_sidebarSuggestActiveIdx];
    maxChartSidebarHighlightItem(target);
    target.scrollIntoView({ block: 'nearest' });
    return;
  }

  if (e.key === 'ArrowUp') {
    e.preventDefault();
    if (!items.length) return;
    _sidebarSuggestActiveIdx = (_sidebarSuggestActiveIdx - 1 + items.length) % items.length;
    const target = items[_sidebarSuggestActiveIdx];
    maxChartSidebarHighlightItem(target);
    target.scrollIntoView({ block: 'nearest' });
    return;
  }

  if (e.key === 'Enter') {
    e.preventDefault();
    if (_sidebarSuggestActiveIdx >= 0 && items[_sidebarSuggestActiveIdx]) {
      const sym = items[_sidebarSuggestActiveIdx].getAttribute('data-symbol');
      if (sym) { maxChartSidebarSelectStock(sym); return; }
    }
    if (items.length > 0) {
      const sym = items[0].getAttribute('data-symbol');
      if (sym) { maxChartSidebarSelectStock(sym); return; }
    }
    const val = inp.value.trim().toUpperCase();
    if (val) {
      maxChartSidebarSelectStock(val);
    }
    return;
  }

  if (e.key === 'Escape') {
    if (suggestBox) suggestBox.style.display = 'none';
    _sidebarSuggestActiveIdx = -1;
  }
}
window.maxChartSidebarKeyDown = maxChartSidebarKeyDown;

function maxChartSidebarSelectStock(sym) {
  const inp = document.getElementById('max-chart-sidebar-add-input');
  if (inp) {
    inp.value = '';
    inp.blur();
  }
  const suggestBox = document.getElementById('max-chart-sidebar-suggest');
  if (suggestBox) suggestBox.style.display = 'none';
  _sidebarSuggestActiveIdx = -1;

  maxChartSidebarAddSymbol(sym);
  showChartToast('⭐ Added <b>' + sym + '</b> to Watchlist', '#22c55e');
}
window.maxChartSidebarSelectStock = maxChartSidebarSelectStock;

function maxChartSidebarEnterKey() {
  maxChartSidebarKeyDown({ key: 'Enter', preventDefault: () => {} });
}
window.maxChartSidebarEnterKey = maxChartSidebarEnterKey;

// Global listener to dismiss suggestion box when clicking outside using capturing pointerdown
document.addEventListener('pointerdown', e => {
  const suggestBox = document.getElementById('max-chart-sidebar-suggest');
  if (suggestBox && suggestBox.style.display !== 'none') {
    if (!e.target.closest('#max-chart-sidebar-add-input') && !e.target.closest('#max-chart-sidebar-suggest')) {
      suggestBox.style.display = 'none';
      _sidebarSuggestActiveIdx = -1;
    }
  }
}, true);

function updateMaxChartSidebarWatchlist() {
  const rowsEl = document.getElementById('max-chart-sidebar-rows');
  const flagsEl = document.getElementById('max-chart-sidebar-flags');
  const tabsEl = document.getElementById('max-chart-sidebar-tabs');
  if (!rowsEl) return;

  // Render tabs in Max Chart Sidebar
  if (tabsEl && typeof sccGetOrderedTabs === 'function') {
    const ordered = sccGetOrderedTabs();
    const colorsMap = { red: '#ef4444', blue: '#3b82f6', green: '#22c55e', yellow: '#eab308', purple: '#a855f7', cyan: '#06b6d4', pink: '#ec4899' };
    let tabsHtml = '';
    ordered.forEach(name => {
      const isActive = (name === _sccActiveWatchlist) || (name.startsWith('__flag_') && _sccActiveWatchlist === name.replace('__flag_', '__flage_'));
      const isFlag = name.startsWith('__flag_') || name.startsWith('__flage_');
      const isVcp = (name === 'VCP');
      if (isFlag) {
        const c = name.replace(/^__flag[e]?_/, '');
        const col = colorsMap[c] || c;
        tabsHtml += `
          <div onclick="sccWlSwitchTab('${name}'); updateMaxChartSidebarWatchlist();"
               draggable="true"
               ondragstart="sccTabDragStart(event, '${name}')"
               ondragover="sccTabDragOver(event)"
               ondrop="sccTabDrop(event, '${name}')"
               ondragend="sccTabDragEnd(event)"
               class="tv-wl-tab-pill ${isActive ? 'active' : ''}"
               title="${c.toUpperCase()} Flag">
            <svg width="8" height="13" viewBox="0 0 10 18" fill="${col}">
              <path d="M0 0h10v18l-5-4-5 4V0z"/>
            </svg>
          </div>
        `;
      } else if (isVcp) {
        tabsHtml += `
          <div onclick="sccWlSwitchTab('VCP'); updateMaxChartSidebarWatchlist();"
               draggable="true"
               ondragstart="sccTabDragStart(event, 'VCP')"
               ondragover="sccTabDragOver(event)"
               ondrop="sccTabDrop(event, 'VCP')"
               ondragend="sccTabDragEnd(event)"
               class="tv-wl-tab-pill ${isActive ? 'active' : ''}">
            <span>⚡ VCP</span>
          </div>
        `;
      } else {
        tabsHtml += `
          <div onclick="sccWlSwitchTab('${name.replace(/'/g, "\\\'")}'); updateMaxChartSidebarWatchlist();"
               draggable="true"
               ondragstart="sccTabDragStart(event, '${name.replace(/'/g, "\\\'")}')"
               ondragover="sccTabDragOver(event)"
               ondrop="sccTabDrop(event, '${name.replace(/'/g, "\\\'")}')"
               ondragend="sccTabDragEnd(event)"
               class="tv-wl-tab-pill ${isActive ? 'active' : ''}">
            <span>${name}</span>
          </div>
        `;
      }
    });
    tabsHtml += `
      <button onclick="sccWlCreateTabPrompt()" title="Create new watch list"
              style="background:none;border:none;color:#38bdf8;font-size:13px;font-weight:bold;cursor:pointer;padding:2px 6px;">+</button>
    `;
    tabsEl.innerHTML = tabsHtml;
  }

  // Active symbol for whichever layout tile is currently focused
  const curSym = (_layoutSymbols[_activeLayoutTile - 1] || _sdMaximizedChartSymbol || '').toUpperCase().replace('.NS', '');

  let syms = _sccWatchlistSymbols;
  if (_sccActiveWatchlist === 'VCP') {
    const cachedDrill = (typeof sectorDrillGetCached === 'function') ? sectorDrillGetCached() : null;
    const activeMap = cachedDrill ? (_vcpbViewMode === 'industry' ? cachedDrill.industries : cachedDrill.sectors) : null;
    const flatSymbols = [];
    if (cachedDrill && activeMap) {
      if (typeof calculateRSRatings === 'function') calculateRSRatings(cachedDrill);
      Object.keys(activeMap).forEach(secName => {
        const sec = activeMap[secName];
        if (sec && Array.isArray(sec.stocks)) {
          sec.stocks.forEach(s => {
            if (s.symbol && !flatSymbols.includes(s.symbol.toUpperCase())) {
              flatSymbols.push(s.symbol.toUpperCase());
            }
          });
        }
      });
    }
    syms = flatSymbols;
    _sccWatchlistSymbols = flatSymbols;
  } else if (_sccActiveWatchlist.startsWith('__flag_') || _sccActiveWatchlist.startsWith('__flage_')) {
    const col = _sccActiveWatchlist.replace(/^__flag[e]?_/, '');
    syms = Object.keys(_sccSymbolFlags).filter(s => _sccSymbolFlags[s] === col);
  } else if (!syms || !syms.length) {
    if (typeof _sccWatchlists !== 'undefined' && _sccWatchlists && _sccWatchlists['Main'] && _sccWatchlists['Main'].length) {
      syms = _sccWatchlists['Main'];
    } else if (typeof _sccWatchlists !== 'undefined' && _sccWatchlists && Object.keys(_sccWatchlists).length) {
      syms = Object.values(_sccWatchlists)[0] || [];
    } else if (typeof _wlItems !== 'undefined' && _wlItems.length) {
      syms = _wlItems.map(i => i.s);
    } else {
      syms = ['AVALON', 'RELIANCE', 'TCS', 'HDFCBANK', 'CARBORUNIV', 'AEGISVOPAK', 'TATATECH', 'IDFCFIRSTB'];
    }
  }

  if (!syms.length) {
    rowsEl.innerHTML = '<div style="color:#787b86;padding:20px;text-align:center;font-size:11px;">List empty. Use input above to add symbols.</div>';
    return;
  }

  let rowsHtml = '';
  const flagCols = { red: '#ef4444', blue: '#3b82f6', green: '#22c55e', yellow: '#eab308', pink: '#ec4899', purple: '#a855f7', cyan: '#06b6d4' };

  syms.forEach(s => {
    const sUpper = s.toUpperCase();
    const isCur = sUpper === curSym;
    const flagColor = _sccSymbolFlags[sUpper] ? flagCols[_sccSymbolFlags[sUpper]] : 'rgba(255,255,255,0.2)';
    const data = _sccWatchlistData[sUpper] || {};
    const price = data.price != null ? data.price.toFixed(1) : '—';
    const chg = data.change != null ? (data.change >= 0 ? '+' : '') + data.change.toFixed(1) + '%' : '—';
    const chgColor = data.change != null ? (data.change >= 0 ? '#22c55e' : '#ef4444') : '#94a3b8';

    rowsHtml += '<div class="tv-max-wl-row ' + (isCur ? 'active' : '') + '" onclick="maxChartOnStockSelected(\'' + sUpper + '\')">' +
      '<div style="display:flex;align-items:center;gap:6px;">' +
        '<svg width="8" height="12" viewBox="0 0 10 18" fill="' + flagColor + '" onclick="sccWatchlistOpenFlagPopup(this, \'' + sUpper + '\'); event.stopPropagation();" style="cursor:pointer;flex-shrink:0;" title="Change flag color">' +
          '<path d="M0 0h10v18l-5-4-5 4V0z"/>' +
        '</svg>' +
        '<span style="font-weight:700;' + (isCur ? 'color:#2962ff;' : '') + '">' + sUpper + '</span>' +
      '</div>' +
      '<div style="display:flex;align-items:center;gap:8px;">' +
        '<span style="color:#94a3b8;">' + price + '</span>' +
        '<span style="color:' + chgColor + ';font-weight:600;min-width:44px;text-align:right;">' + chg + '</span>' +
      '</div>' +
    '</div>';
  });
  rowsEl.innerHTML = rowsHtml;
}
window.updateMaxChartSidebarWatchlist = updateMaxChartSidebarWatchlist;


// ── TRADINGVIEW GLOBAL KEYBOARD SHORTCUTS (Alt+W & Typing) ──
window.addEventListener('keydown', e => {
  const overlay = document.getElementById('chart-max-overlay');
  const isMaxOpen = overlay && overlay.style.display !== 'none';

  // 1. Shortcut: Alt + W (Add active stock to current Watchlist / Colored Flag)
  if (e.altKey && (e.key === 'w' || e.key === 'W' || e.code === 'KeyW' || e.keyCode === 87)) {
    e.preventDefault();
    e.stopPropagation();
    const sym = (_sdMaximizedChartSymbol || (_sccChartSymbols && _sccChartSymbols[0]) || (_stockData && _stockData.symbol) || '').toUpperCase().replace('.NS', '').trim();
    if (!sym) return;
    maxChartSidebarAddSymbol(sym);
    const listName = _sccActiveWatchlist.startsWith('__flag_') ? _sccActiveWatchlist.replace('__flag_', '').toUpperCase() + ' Flag' : (_sccActiveWatchlist || 'Main');
    showChartToast('⭐ Added <b>' + sym + '</b> to ' + listName, '#22c55e');
    return;
  }

  // Only handle typing when chart studio is open and user is NOT typing in an input
  if (!isMaxOpen) return;
  const tag = (e.target && e.target.tagName) || '';
  if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target && e.target.isContentEditable)) return;
  if (e.ctrlKey || e.metaKey || e.altKey) return;

  // 2. Typing numbers (1-9) -> Change interval (TV style)
  if (e.key === '1') {
    e.preventDefault();
    if (typeof maxChartChangeTimeframe === 'function') {
      maxChartChangeTimeframe('1H');
      showChartToast('⏱ Timeframe: <b>1H</b> (Hourly)');
    }
    return;
  }

  // 3. Typing letters (A-Z) -> Stock selection (TV style)
  if (e.key.length === 1 && /^[a-zA-Z]$/.test(e.key)) {
    e.preventDefault();
    const searchInp = document.getElementById('max-chart-search');
    if (searchInp) {
      searchInp.value = e.key.toUpperCase();
      searchInp.focus();
      if (typeof maxChartSearchInput === 'function') {
        maxChartSearchInput(e.key.toUpperCase());
      }
    }
    return;
  }
}, true); // Capture phase guarantees immediate processing

// Auto-initialize Drawing Canvas on load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    if (typeof initChartDrawingCanvas === 'function') initChartDrawingCanvas();
  });
} else {
  if (typeof initChartDrawingCanvas === 'function') initChartDrawingCanvas();
}


// ── TRADINGVIEW PRECISE COORDINATES EDITOR ──
function openCoordsDialog(drawing) {
  const dlg = document.getElementById('tv-coords-dialog');
  const titleEl = document.getElementById('tv-coords-title');
  const fieldsEl = document.getElementById('tv-coords-fields');
  if (!dlg || !titleEl || !fieldsEl || !drawing) return;

  const names = {
    scale: 'Price & Date Range Coordinates',
    measure: 'Price & Date Range Coordinates',
    pricenote: 'Price Note Coordinates',
    ray_h: 'Horizontal Ray Coordinate',
    ray: 'Arrow Ray Coordinates',
    trendline: 'Trend Line Coordinates',
    rect: 'Rectangle Zone Coordinates',
    fib: 'Fibonacci Retracement Coordinates',
    text: 'Text Annotation'
  };

  titleEl.innerText = names[drawing.type] || 'Edit Coordinates';

  let html = '';
  const p1Val = drawing.p1 && drawing.p1.price != null ? drawing.p1.price.toFixed(2) : '';
  html += `<div>
    <label class="tv-coord-label">Point 1 Price (₹)</label>
    <input type="number" step="0.05" id="tv-coord-p1-price" class="tv-coord-input" value="${p1Val}">
  </div>`;

  if (drawing.p2 || drawing.type === 'scale' || drawing.type === 'measure' || drawing.type === 'trendline' || drawing.type === 'ray' || drawing.type === 'rect' || drawing.type === 'fib') {
    const p2Val = drawing.p2 && drawing.p2.price != null ? drawing.p2.price.toFixed(2) : (drawing.p1 && drawing.p1.price != null ? drawing.p1.price.toFixed(2) : '');
    html += `<div>
      <label class="tv-coord-label">Point 2 Price (₹)</label>
      <input type="number" step="0.05" id="tv-coord-p2-price" class="tv-coord-input" value="${p2Val}">
    </div>`;
  }

  if (drawing.type === 'pricenote' || drawing.type === 'text') {
    html += `<div>
      <label class="tv-coord-label">Label / Note Text</label>
      <input type="text" id="tv-coord-text" class="tv-coord-input" value="${(drawing.text || '').replace(/"/g, '&quot;')}">
    </div>`;
  }

  fieldsEl.innerHTML = html;
  dlg.style.display = 'block';
  const inp1 = document.getElementById('tv-coord-p1-price');
  if (inp1) { inp1.focus(); inp1.select(); }
}
window.openCoordsDialog = openCoordsDialog;

function closeCoordsDialog() {
  const dlg = document.getElementById('tv-coords-dialog');
  if (dlg) dlg.style.display = 'none';
}
window.closeCoordsDialog = closeCoordsDialog;

function applyDrawingCoordinates() {
  const sym = getActiveDrawingSymbol();
  const drawings = _chartDrawings[sym] || [];
  if (_selectedDrawingIndex == null || !drawings[_selectedDrawingIndex]) {
    closeCoordsDialog();
    return;
  }
  const d = drawings[_selectedDrawingIndex];
  const { series } = getDrawingContext();

  const p1Inp = document.getElementById('tv-coord-p1-price');
  const p2Inp = document.getElementById('tv-coord-p2-price');
  const txtInp = document.getElementById('tv-coord-text');

  if (p1Inp && p1Inp.value) {
    const newP1 = parseFloat(p1Inp.value);
    if (!isNaN(newP1)) {
      d.p1.price = newP1;
      if (series && typeof series.priceToCoordinate === 'function') {
        const cy = series.priceToCoordinate(newP1);
        if (cy != null && isFinite(cy)) d.p1.y = cy;
      }
    }
  }

  if (p2Inp && p2Inp.value) {
    const newP2 = parseFloat(p2Inp.value);
    if (!isNaN(newP2)) {
      if (!d.p2) d.p2 = { ...d.p1 };
      d.p2.price = newP2;
      if (series && typeof series.priceToCoordinate === 'function') {
        const cy = series.priceToCoordinate(newP2);
        if (cy != null && isFinite(cy)) d.p2.y = cy;
      }
    }
  }

  if (txtInp) {
    d.text = txtInp.value.trim();
  } else if (d.type === 'pricenote' && p1Inp && p1Inp.value) {
    d.text = '₹ ' + parseFloat(p1Inp.value).toFixed(2);
  }

  closeCoordsDialog();
  saveChartDrawings();
  redrawChartDrawings();
  updateFloatingToolbar();
  showChartToast('✔ Coordinates updated precisely', '#22c55e');
}
window.applyDrawingCoordinates = applyDrawingCoordinates;

// ==============================================================================
// ⭐ SECTOR COMMAND: FRESH HIGHS & BREAKOUT CLUSTERS ENGINE (Manas Arora Model)
// ==============================================================================

let _sccClustersCache = [];
let _sccFilteredClusters = [];
let _sccUniverseStocks = [];
let _sccClusterExpandedMap = {};

function sccEscapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function sccComputeClusters() {
  const data = window.SCREENER_DATA || window.SCREENER_UNIVERSE;
  const stocks = data && Array.isArray(data.stocks) ? data.stocks : [];
  _sccUniverseStocks = stocks;

  const indMap = {};
  stocks.forEach(s => {
    const ind = (s.industry && s.industry.trim()) || 'Other / Diversified';
    if (!indMap[ind]) {
      indMap[ind] = {
        name: ind,
        sector: s.sector || '',
        total: 0,
        h1m: 0,
        h52w: 0,
        stocks: []
      };
    }
    const cluster = indMap[ind];
    cluster.total++;

    const is1m = (s.dist_high_1m_pct != null && s.dist_high_1m_pct <= 2.0);
    const is52w = (s.dist_52w_high != null && s.dist_52w_high <= 3.0);

    if (is1m) cluster.h1m++;
    if (is52w) cluster.h52w++;

    cluster.stocks.push({
      symbol: s.symbol,
      company: s.company || s.symbol,
      price: s.price != null ? s.price : 0,
      change_pct: s.change_pct != null ? s.change_pct : 0,
      dist_1m: s.dist_high_1m_pct != null ? s.dist_high_1m_pct : 999,
      dist_52w: s.dist_52w_high != null ? s.dist_52w_high : 999,
      is1m: is1m,
      is52w: is52w,
      mkt_cap_cr: s.mkt_cap_cr || 0,
      pe_ratio: s.pe_ratio
    });
  });

  const clusters = Object.values(indMap).map(c => {
    c.stocks.sort((a, b) => {
      if (a.is52w !== b.is52w) return a.is52w ? -1 : 1;
      if (a.is1m !== b.is1m) return a.is1m ? -1 : 1;
      return a.dist_1m - b.dist_1m;
    });

    const pct1m = c.total > 0 ? +((c.h1m / c.total) * 100).toFixed(1) : 0;
    const pct52w = c.total > 0 ? +((c.h52w / c.total) * 100).toFixed(1) : 0;

    return Object.assign({}, c, {
      pct1m: pct1m,
      pct52w: pct52w
    });
  });

  _sccClustersCache = clusters;
  if (typeof sccRenderDashboardWidget === 'function') {
    sccRenderDashboardWidget();
  }
  return clusters;
}

function sccRenderClusters() {
  const container = document.getElementById('cluster-cards-container');
  const ribbon = document.getElementById('cluster-summary-ribbon');
  if (!container) return;

  if (!_sccClustersCache || !_sccClustersCache.length) {
    sccComputeClusters();
  }

  if (!_sccClustersCache.length) {
    container.innerHTML = `
      <div style="padding:40px 14px; text-align:center; color:var(--dim); font-size:12px;">
        <span style="opacity:0.7">Loading universe dataset (screener_stocks.js)…</span>
      </div>`;
    setTimeout(() => {
      sccComputeClusters();
      sccRenderClusters();
    }, 300);
    return;
  }

  const searchInput = document.getElementById('cluster-search-input');
  const query = searchInput ? searchInput.value.trim().toLowerCase() : '';

  const minSizeSelect = document.getElementById('cluster-min-size');
  const minSize = minSizeSelect ? parseInt(minSizeSelect.value) || 3 : 3;

  const densitySelect = document.getElementById('cluster-density-filter');
  const densityFilter = densitySelect ? densitySelect.value : 'all';

  const sortBySelect = document.getElementById('cluster-sort-by');
  const sortBy = sortBySelect ? sortBySelect.value : 'pct1m';

  const allHighsCount = _sccUniverseStocks.filter(s => s.dist_high_1m_pct != null && s.dist_high_1m_pct <= 2.0).length;
  const allHighsEl = document.getElementById('cluster-all-highs-count');
  if (allHighsEl) allHighsEl.textContent = allHighsCount;

  let filtered = _sccClustersCache.filter(c => {
    if (c.total < minSize) return false;

    if (densityFilter === 'dense' && c.pct1m < 35) return false;
    if (densityFilter === 'super' && c.pct1m < 50) return false;
    if (densityFilter === 'lead52' && c.pct52w < 15) return false;

    if (query) {
      const matchInd = c.name.toLowerCase().includes(query);
      const matchSec = c.sector.toLowerCase().includes(query);
      const matchStock = c.stocks.some(s => s.symbol.toLowerCase().includes(query) || s.company.toLowerCase().includes(query));
      if (!matchInd && !matchSec && !matchStock) return false;
    }

    return true;
  });

  filtered.sort((a, b) => {
    if (sortBy === 'pct1m') {
      return (b.pct1m - a.pct1m) || (b.pct52w - a.pct52w) || (b.total - a.total);
    } else if (sortBy === 'pct52w') {
      return (b.pct52w - a.pct52w) || (b.pct1m - a.pct1m) || (b.total - a.total);
    } else if (sortBy === 'count1m') {
      return (b.h1m - a.h1m) || (b.pct1m - a.pct1m) || (b.total - a.total);
    } else if (sortBy === 'total') {
      return (b.total - a.total) || (b.pct1m - a.pct1m);
    } else if (sortBy === 'alpha') {
      return a.name.localeCompare(b.name);
    }
    return 0;
  });

  _sccFilteredClusters = filtered;

  if (ribbon) {
    const totalIndustries = _sccClustersCache.length;
    const qualClusters = filtered.length;
    const univ52wCount = _sccUniverseStocks.filter(s => s.dist_52w_high != null && s.dist_52w_high <= 3.0).length;
    const univTotal = _sccUniverseStocks.length || 3000;
    const univ1mPct = ((allHighsCount / univTotal) * 100).toFixed(1);
    const univ52wPct = ((univ52wCount / univTotal) * 100).toFixed(1);

    ribbon.innerHTML = `
      <div class="cluster-sum-card">
        <span class="cluster-sum-label">Active Clusters</span>
        <span class="cluster-sum-val" style="color:var(--text)">${qualClusters} <span style="font-size:11px;color:var(--dim);font-weight:400">of ${totalIndustries}</span></span>
        <span class="cluster-sum-sub">Granular industry groups</span>
      </div>
      <div class="cluster-sum-card">
        <span class="cluster-sum-label">1-Month High Leaders</span>
        <span class="cluster-sum-val" style="color:#34d399">${allHighsCount} <span style="font-size:11px;color:var(--dim);font-weight:400">(${univ1mPct}%)</span></span>
        <span class="cluster-sum-sub">Stocks within 2% of 1M High</span>
      </div>
      <div class="cluster-sum-card">
        <span class="cluster-sum-label">52-Week High Leaders</span>
        <span class="cluster-sum-val" style="color:var(--teal)">${univ52wCount} <span style="font-size:11px;color:var(--dim);font-weight:400">(${univ52wPct}%)</span></span>
        <span class="cluster-sum-sub">Stocks within 3% of 52W High</span>
      </div>
      <div class="cluster-sum-card">
        <span class="cluster-sum-label">Top Cluster</span>
        <span class="cluster-sum-val" style="font-size:13px;color:var(--yellow);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${filtered[0] ? sccEscapeHtml(filtered[0].name) : 'None'}</span>
        <span class="cluster-sum-sub">${filtered[0] ? (filtered[0].pct1m + '% at 1M High (' + filtered[0].h1m + '/' + filtered[0].total + ')') : '—'}</span>
      </div>
    `;
  }

  if (!filtered.length) {
    container.innerHTML = `
      <div style="padding:40px 14px; text-align:center; color:var(--dim); font-size:12px;">
        No industry clusters match the current filter criteria. Try lowering the constituent threshold or clearing search.
      </div>`;
    return;
  }

  let html = '';
  filtered.forEach((c, idx) => {
    const rank = idx + 1;
    const rankClass = rank === 1 ? 'top1' : (rank <= 3 ? 'top3' : '');
    const isExpanded = _sccClusterExpandedMap[c.name] !== undefined ? _sccClusterExpandedMap[c.name] : (rank <= 4);
    const safeId = 'cluster-chips-' + idx;

    html += `
      <div class="cluster-card" id="cluster-card-${idx}">
        <div class="cluster-card-head" onclick="sccToggleClusterChips(${idx})">
          <div class="cluster-card-rank-col">
            <span class="cluster-rank-badge ${rankClass}">#${rank}</span>
          </div>
          <div class="cluster-card-title-col">
            <div class="cluster-industry-name">
              <span>${sccEscapeHtml(c.name)}</span>
              ${c.sector ? `<span class="cluster-sector-pill">${sccEscapeHtml(c.sector)}</span>` : ''}
            </div>
            <div class="cluster-meta-sub">
              <span class="cluster-total-badge">${c.total} Stocks in Industry</span>
              <span class="cluster-sep">·</span>
              <span class="cluster-stat-pill mint">🔥 ${c.h1m} (${c.pct1m}%) at 1M High</span>
              <span class="cluster-sep">·</span>
              <span class="cluster-stat-pill teal">⭐ ${c.h52w} (${c.pct52w}%) at 52W High</span>
            </div>
          </div>
          
          <div class="cluster-card-actions">
            <button class="cluster-btn-copy" onclick="event.stopPropagation(); sccCopyClusterTv(${idx})" title="Copy TradingView Watchlist for this Industry">
              📋 Copy TV (${c.total})
            </button>
            <button class="cluster-btn-expand" onclick="event.stopPropagation(); sccToggleClusterChips(${idx})" title="Toggle Constituent Stocks">
              <span id="cluster-arrow-${idx}" style="display:inline-block; transition:transform 0.2s; transform:${isExpanded ? 'rotate(180deg)' : 'rotate(0deg)'}">▼</span>
            </button>
          </div>
        </div>

        <div class="cluster-bar-container" title="1-Month Highs: ${c.pct1m}% | 52-Week Highs: ${c.pct52w}%">
          <div class="cluster-bar-track">
            <div class="cluster-bar-fill-52w" style="width: ${Math.min(100, c.pct52w)}%;"></div>
            <div class="cluster-bar-fill-1m" style="width: ${Math.max(0, Math.min(100, c.pct1m - c.pct52w))}%;"></div>
          </div>
        </div>

        <div class="cluster-chips-panel" id="${safeId}" style="display: ${isExpanded ? 'flex' : 'none'};">
          ${c.stocks.map(s => {
            const chipClass = s.is52w ? 'leader-52w' : (s.is1m ? 'leader-1m' : 'base');
            const distLabel = s.is52w ? `⭐ 52W (-${s.dist_52w.toFixed(1)}%)` : (s.is1m ? `🔥 1M (-${s.dist_1m.toFixed(1)}%)` : `-${s.dist_1m.toFixed(1)}% 1M`);
            const chgSign = s.change_pct >= 0 ? '+' : '';
            const chgClass = s.change_pct >= 0 ? 'pos' : 'neg';
            const priceStr = s.price ? '₹' + s.price.toLocaleString('en-IN', { maximumFractionDigits: 1 }) : '';
            return `
              <div class="cluster-stock-chip ${chipClass}" 
                   onclick="sccClusterChipClick('${s.symbol}')"
                   title="${sccEscapeHtml(s.company)} · ${priceStr} (${chgSign}${s.change_pct.toFixed(2)}%) · Click to open TradingView chart">
                <span class="cluster-chip-sym">${s.symbol}</span>
                <span class="cluster-chip-dist">${distLabel}</span>
                <span class="cluster-chip-chg ${chgClass}">${chgSign}${s.change_pct.toFixed(1)}%</span>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  });

  container.innerHTML = html;
}

function sccToggleClusterChips(idx) {
  const c = _sccFilteredClusters[idx];
  if (!c) return;
  const panel = document.getElementById('cluster-chips-' + idx);
  const arrow = document.getElementById('cluster-arrow-' + idx);
  if (!panel) return;
  const isHidden = panel.style.display === 'none';
  panel.style.display = isHidden ? 'flex' : 'none';
  _sccClusterExpandedMap[c.name] = isHidden;
  if (arrow) {
    arrow.style.transform = isHidden ? 'rotate(180deg)' : 'rotate(0deg)';
  }
}

function sccClusterChipClick(symbol) {
  if (!symbol) return;
  const url = 'https://in.tradingview.com/chart/fZ5fwxUh/?symbol=NSE:' + encodeURIComponent(symbol);
  window.open(url, '_blank');
}

function sccCopyClusterTv(idx) {
  const c = _sccFilteredClusters[idx];
  if (!c || !c.stocks || !c.stocks.length) return;
  const tvString = c.stocks.map(s => 'NSE:' + s.symbol).join(',');
  navigator.clipboard.writeText(tvString).then(() => {
    if (typeof showChartToast === 'function') {
      showChartToast(`📋 Copied <b>${c.stocks.length}</b> symbols for TradingView (<b>${sccEscapeHtml(c.name)}</b>)`, '#2dd4bf');
    }
  }).catch(() => {
    sccCopyFallback(tvString);
    if (typeof showChartToast === 'function') {
      showChartToast(`📋 Copied <b>${c.stocks.length}</b> symbols for TradingView`, '#2dd4bf');
    }
  });
}

function sccCopyTopClustersTv(topN = 5) {
  if (!_sccFilteredClusters || !_sccFilteredClusters.length) return;
  const list = _sccFilteredClusters.slice(0, topN);
  const syms = [];
  list.forEach(c => {
    c.stocks.forEach(s => {
      const sym = 'NSE:' + s.symbol;
      if (!syms.includes(sym)) syms.push(sym);
    });
  });
  if (!syms.length) return;
  const text = syms.join(',');
  navigator.clipboard.writeText(text).then(() => {
    if (typeof showChartToast === 'function') {
      showChartToast(`📋 Copied <b>${syms.length}</b> symbols from Top ${list.length} Clusters for TradingView!`, '#2dd4bf');
    }
  }).catch(() => {
    sccCopyFallback(text);
    if (typeof showChartToast === 'function') {
      showChartToast(`📋 Copied <b>${syms.length}</b> symbols for TradingView`, '#2dd4bf');
    }
  });
}

function sccCopyAllFreshHighsTv() {
  if (!_sccUniverseStocks || !_sccUniverseStocks.length) {
    sccComputeClusters();
  }
  const highStocks = _sccUniverseStocks.filter(s => s.dist_high_1m_pct != null && s.dist_high_1m_pct <= 2.0);
  if (!highStocks.length) return;
  const text = highStocks.map(s => 'NSE:' + s.symbol).join(',');
  navigator.clipboard.writeText(text).then(() => {
    if (typeof showChartToast === 'function') {
      showChartToast(`🚀 Copied <b>${highStocks.length}</b> Fresh High Breakout symbols for TradingView!`, '#34d399');
    }
  }).catch(() => {
    sccCopyFallback(text);
    if (typeof showChartToast === 'function') {
      showChartToast(`🚀 Copied <b>${highStocks.length}</b> Fresh High Breakout symbols`, '#34d399');
    }
  });
}

function sccCopyFallback(text) {
  try {
    const tempInput = document.createElement('textarea');
    tempInput.value = text;
    tempInput.style.position = 'fixed';
    tempInput.style.opacity = '0';
    document.body.appendChild(tempInput);
    tempInput.select();
    document.execCommand('copy');
    document.body.removeChild(tempInput);
  } catch (e) {
    console.warn('Clipboard copy failed:', e);
  }
}

function sccRenderDashboardWidget(data) {
  const topSecEl = document.getElementById('scc-dash-top-sectors');
  const topClustEl = document.getElementById('scc-dash-top-clusters');
  if (!topSecEl && !topClustEl) return;

  // 1. Top Leading Sectors
  if (topSecEl) {
    let sectors = (data && Array.isArray(data.sectors)) ? data.sectors : null;
    if (!sectors) {
      const card = document.getElementById('srt-home-card');
      if (card && card._vcpbData && Array.isArray(card._vcpbData.sectors)) {
        sectors = card._vcpbData.sectors;
      } else if (typeof vcpbGetCached === 'function') {
        const cached = vcpbGetCached();
        if (cached && Array.isArray(cached.sectors)) sectors = cached.sectors;
      }
    }

    if (sectors && sectors.length) {
      const overlay = typeof vcpbGetSrtOverlay === 'function' ? vcpbGetSrtOverlay() : {};
      const sorted = [...sectors].map(s => {
        const score = typeof vcpbScore === 'function' ? vcpbScore(s) : 50;
        const over = overlay[s.sector] || Object.entries(overlay).find(([k]) => k.toLowerCase().includes(s.sector.toLowerCase().split(' ')[0]) || s.sector.toLowerCase().includes(k.toLowerCase().split(' ')[0]))?.[1] || null;
        const stage = over && over.stage ? over.stage : '';
        return { ...s, score, stage };
      }).sort((a, b) => b.score - a.score);

      const top5 = sorted.slice(0, 5);
      topSecEl.innerHTML = top5.map((s, idx) => {
        const scoreCol = s.score >= 60 ? 'var(--lime)' : (s.score >= 40 ? 'var(--yellow)' : 'var(--red)');
        const rankBadge = idx === 0 ? '<span style="font-family:var(--mono);font-size:10px;font-weight:800;color:var(--yellow);background:rgba(250,204,21,0.12);border:1px solid rgba(250,204,21,0.3);padding:1px 5px;border-radius:3px;">#1</span>' :
                          idx === 1 ? '<span style="font-family:var(--mono);font-size:10px;font-weight:800;color:var(--teal);background:rgba(45,212,191,0.12);border:1px solid rgba(45,212,191,0.3);padding:1px 5px;border-radius:3px;">#2</span>' :
                          idx === 2 ? '<span style="font-family:var(--mono);font-size:10px;font-weight:800;color:var(--teal);background:rgba(45,212,191,0.12);border:1px solid rgba(45,212,191,0.3);padding:1px 5px;border-radius:3px;">#3</span>' :
                          `<span style="font-family:var(--mono);font-size:10px;font-weight:700;color:var(--dim);background:var(--bg);border:1px solid var(--border);padding:1px 5px;border-radius:3px;">#${idx + 1}</span>`;
        const stagePill = s.stage ? `<span style="font-size:9px;font-weight:700;padding:1px 4px;border-radius:3px;background:rgba(52,211,153,0.12);color:#34d399;border:1px solid rgba(52,211,153,0.3);font-family:var(--mono)">${s.stage}</span>` : '';
        const shortName = (typeof SRT_SHORT !== 'undefined' && SRT_SHORT[s.sector]) ? SRT_SHORT[s.sector] : s.sector;
        return `
          <div style="display:flex;align-items:center;justify-content:space-between;padding:5px 8px;background:var(--bg2);border:1px solid var(--border);border-radius:4px;font-size:11px;transition:border-color .15s"
               onmouseenter="this.style.borderColor='rgba(45,212,191,0.4)'" onmouseleave="this.style.borderColor='var(--border)'">
            <div style="display:flex;align-items:center;gap:6px;min-width:0;flex:1;">
              ${rankBadge}
              <a href="sectors.html?tab=breadth" target="_blank" style="font-weight:700;color:var(--text);text-decoration:none;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="${s.sector} · Click to view in Sector Command">${shortName}</a>
              ${stagePill}
            </div>
            <div style="display:flex;align-items:center;gap:8px;font-family:var(--mono);">
              <span style="font-size:10px;color:var(--dim);" title="% stocks > 20EMA">&gt;20E: <span style="color:var(--text);font-weight:600">${s.a20_pct}%</span></span>
              <span style="font-size:11px;font-weight:800;color:${scoreCol};min-width:24px;text-align:right" title="Composite Breadth Score">${s.score}</span>
            </div>
          </div>
        `;
      }).join('');
    }
  }

  // 2. Top Breakout Clusters
  if (topClustEl) {
    if (!_sccClustersCache || !_sccClustersCache.length) {
      if (typeof sccComputeClusters === 'function') sccComputeClusters();
    }
    const clusters = (_sccClustersCache || []).filter(c => c.total >= 3 && (c.h1m > 0 || c.h52w > 0)).sort((a, b) => {
      if (b.pct1m !== a.pct1m) return b.pct1m - a.pct1m;
      return b.h1m - a.h1m;
    });

    if (clusters && clusters.length) {
      const top3 = clusters.slice(0, 3);
      topClustEl.innerHTML = top3.map((c, idx) => {
        const rankBadge = idx === 0 ? '<span style="font-family:var(--mono);font-size:10px;font-weight:800;color:var(--yellow);background:rgba(250,204,21,0.12);border:1px solid rgba(250,204,21,0.3);padding:1px 5px;border-radius:3px;">#1</span>' :
                          idx === 1 ? '<span style="font-family:var(--mono);font-size:10px;font-weight:800;color:var(--teal);background:rgba(45,212,191,0.12);border:1px solid rgba(45,212,191,0.3);padding:1px 5px;border-radius:3px;">#2</span>' :
                          '<span style="font-family:var(--mono);font-size:10px;font-weight:800;color:var(--teal);background:rgba(45,212,191,0.12);border:1px solid rgba(45,212,191,0.3);padding:1px 5px;border-radius:3px;">#3</span>';
        
        const topStocks = (c.stocks || []).slice(0, 4);
        const chipsHtml = topStocks.map(s => {
          const chipColor = s.is52w ? 'var(--teal)' : (s.is1m ? '#34d399' : 'var(--text)');
          const chipBorder = s.is52w ? 'rgba(45,212,191,0.35)' : (s.is1m ? 'rgba(52,211,153,0.35)' : 'var(--border)');
          return `<span onclick="sccClusterChipClick('${s.symbol}')"
                        style="cursor:pointer;font-size:9px;font-family:var(--mono);font-weight:700;color:${chipColor};background:var(--bg);border:1px solid ${chipBorder};padding:1px 5px;border-radius:3px;"
                        title="${s.symbol}: ₹${s.price} (${s.change_pct >= 0 ? '+' : ''}${s.change_pct}%) · Click for chart">${s.symbol}</span>`;
        }).join('');

        return `
          <div style="padding:6px 8px;background:var(--bg2);border:1px solid var(--border);border-radius:4px;display:flex;flex-direction:column;gap:4px;transition:border-color .15s"
               onmouseenter="this.style.borderColor='rgba(52,211,153,0.4)'" onmouseleave="this.style.borderColor='var(--border)'">
            <div style="display:flex;align-items:center;justify-content:space-between;gap:6px;">
              <div style="display:flex;align-items:center;gap:6px;min-width:0;flex:1;">
                ${rankBadge}
                <a href="sectors.html?tab=clusters" target="_blank" style="font-weight:700;color:var(--text);font-size:11px;text-decoration:none;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="${c.name} (${c.sector})">${c.name}</a>
              </div>
              <div style="display:flex;align-items:center;gap:4px;font-family:var(--mono);font-size:10px;">
                <span style="color:#34d399;font-weight:700;">${c.pct1m}%</span>
                <span style="color:var(--dim);">(${c.h1m}/${c.total})</span>
              </div>
            </div>
            <div style="display:flex;align-items:center;gap:4px;flex-wrap:wrap;padding-left:22px;">
              ${chipsHtml}
            </div>
          </div>
        `;
      }).join('');
    } else {
      topClustEl.innerHTML = `<div style="font-size:11px;color:var(--dim);padding:8px 0;text-align:center">No active clusters found</div>`;
    }
  }
}
window.sccRenderDashboardWidget = sccRenderDashboardWidget;
