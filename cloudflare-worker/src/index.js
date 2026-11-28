const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}

function isAuthorized(request, env) {
  const expected = (env.SYNC_TOKEN || '').trim();
  if (!expected) return true; // If SYNC_TOKEN secret isn't set, allow access
  const auth = request.headers.get('Authorization') || '';
  const token = auth.replace(/^Bearer\s+/i, '').trim();
  return token === expected;
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    if (path === '/api/health' && request.method === 'GET') {
      return jsonResponse({ ok: true, backend: 'cloudflare-d1' });
    }

    if (path === '/api/ms-ratings' && request.method === 'GET') {
      const rawSym = (url.searchParams.get('symbol') || '').trim().toUpperCase().replace(/\.(NS|BO)$/i, '');
      if (!rawSym) return jsonResponse({ ok: false, error: 'Missing symbol' }, 400);
      try {
        const ua = {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Referer': 'https://marketsmithindia.com/',
        };
        const msBase = 'https://marketsmithindia.com/gateway/simple-api/ms-india';
        const srchRes = await fetch(`${msBase}/instr/srch.json?text=${encodeURIComponent(rawSym)}&lang=en&ver=2`, { headers: ua });
        const srchJson = await srchRes.json();
        const results = (srchJson.response && srchJson.response.results) || [];
        if (!results.length) return jsonResponse({ ok: false, symbol: rawSym, error: 'Not found' }, 404);
        const match = results.find((x) => String(x.symbol || '').toUpperCase() === rawSym) || results[0];
        const instrId = match.instrumentId;

        const pageRes = await fetch('https://marketsmithindia.com/mstool/eval/reliance/evaluation.jsp', { headers: ua });
        const setCookie = pageRes.headers.get('set-cookie') || '';
        const m = setCookie.match(/MSSESSIONID=([^;]+)/);
        const token = m ? m[1] : '';

        const wRes = await fetch(
          `${msBase}/instr/0/${instrId}/wisdom.json?lang=en&ver=2&x=y&ms-auth=${encodeURIComponent(token)}`,
          { headers: { ...ua, 'Cookie': `MSSESSIONID=${token}` } }
        );
        if (!wRes.ok) return jsonResponse({ ok: false, symbol: rawSym, error: `HTTP ${wRes.status}` }, 502);
        const wJson = await wRes.json();
        const items = (wJson.response && wJson.response.results) || [];
        const pick = (msid) => {
          const it = items.find((x) => Number(x.msid) === msid);
          return it && it.itemValue != null ? String(it.itemValue) : null;
        };
        return jsonResponse({
          ok: true,
          symbol: rawSym,
          instrumentId: instrId,
          epsStrength: pick(4589),
          priceStrength: pick(2),
          buyerDemand: pick(5),
          groupRank: pick(1989),
          masterScore: pick(1746),
          marketDirection: pick(4453),
          fetchedAt: Date.now(),
        });
      } catch (err) {
        return jsonResponse({ ok: false, symbol: rawSym, error: err.message }, 502);
      }
    }

    if (!isAuthorized(request, env)) {
      return jsonResponse({ error: 'Unauthorized: invalid or missing SYNC_TOKEN' }, 401);
    }

    const userId = 'default';

    // GET /api/sync -> reconstruct full payload from D1 tables
    // ── /chart?url=… — Yahoo Finance passthrough ────────────────────────────────
    // The dashboard fetches chart data through this route when it is served from
    // GitHub Pages or a file:// URL, where cross-origin requests are blocked.
    //
    // Deliberately narrow: only Yahoo Finance chart endpoints are proxied, and the
    // response is returned as-is. An open proxy (any URL, any host) would be abused
    // within hours, so the host is allow-listed rather than trusting the ?url=.
    if (path === '/chart' && request.method === 'GET') {
      const raw = url.searchParams.get('url');
      if (!raw) return jsonResponse({ ok: false, error: 'Missing url parameter' }, 400);

      let target;
      try {
        target = new URL(raw);
      } catch (e) {
        return jsonResponse({ ok: false, error: 'Malformed url parameter' }, 400);
      }

      const allowed = ['query1.finance.yahoo.com', 'query2.finance.yahoo.com'];
      if (target.protocol !== 'https:' || !allowed.includes(target.hostname)) {
        return jsonResponse({ ok: false, error: 'Host not allowed' }, 403);
      }
      if (!target.pathname.startsWith('/v8/finance/chart/')) {
        return jsonResponse({ ok: false, error: 'Path not allowed' }, 403);
      }

      try {
        const upstream = await fetch(target.toString(), {
          headers: {
            // Yahoo returns 401/empty payloads to unknown agents.
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'application/json,text/plain,*/*',
          },
          cf: { cacheTtl: 60, cacheEverything: true },
        });

        if (!upstream.ok) {
          return jsonResponse({ ok: false, error: 'Upstream HTTP ' + upstream.status }, upstream.status === 404 ? 404 : 502);
        }

        // Pass the JSON straight through; the client parses Yahoo's shape directly.
        return new Response(upstream.body, {
          status: 200,
          headers: {
            'Content-Type': 'application/json; charset=utf-8',
            // Charts are per-symbol and already cached at the edge for 60s.
            'Cache-Control': 'public, max-age=30',
            ...CORS_HEADERS,
          },
        });
      } catch (e) {
        return jsonResponse({ ok: false, error: 'Upstream fetch failed' }, 502);
      }
    }

    if (path === '/api/sync' && request.method === 'GET') {
      try {
        const sectionsRes = await env.DB.prepare(
          'SELECT section, data_json, updated_at FROM sync_sections WHERE user_id = ?'
        ).bind(userId).all();

        const drawingsRes = await env.DB.prepare(
          'SELECT symbol, drawings_json, updated_at FROM chart_drawings WHERE user_id = ?'
        ).bind(userId).all();

        const out = {
          _pushedAt: 0,
          records: [],
          bsr: [],
          bsrMode: 'quick',
          bsrModeUpdatedAt: 0,
          bsrQuick: { won: null, lost: null, total: 10 },
          mpm: [],
          ftd: [],
          srt: [],
          sccWatchlists: {},
          sccSymbolFlags: {},
          sccWatchlistsUpdatedAt: 0,
          chartDrawings: {},
          chartDrawingsUpdatedAt: 0,
          fyersCreds: null,
        };

        for (const row of sectionsRes.results || []) {
          const parsed = JSON.parse(row.data_json);
          if (row.updated_at > out._pushedAt) out._pushedAt = row.updated_at;
          if (row.section === 'records') out.records = parsed;
          else if (row.section === 'bsr') out.bsr = parsed;
          else if (row.section === 'mpm') out.mpm = parsed;
          else if (row.section === 'ftd') out.ftd = parsed;
          else if (row.section === 'srt') out.srt = parsed;
          else if (row.section === 'watchlists') {
            out.sccWatchlists = parsed.sccWatchlists || {};
            out.sccSymbolFlags = parsed.sccSymbolFlags || {};
            out.sccWatchlistsUpdatedAt = parsed.sccWatchlistsUpdatedAt || row.updated_at;
          } else if (row.section === 'prefs') {
            if (parsed.bsrMode) out.bsrMode = parsed.bsrMode;
            if (parsed.bsrModeUpdatedAt) out.bsrModeUpdatedAt = parsed.bsrModeUpdatedAt;
            if (parsed.bsrQuick) out.bsrQuick = parsed.bsrQuick;
            if (parsed.fyersCreds) out.fyersCreds = parsed.fyersCreds;
          }
        }

        let maxDrawTime = 0;
        for (const row of drawingsRes.results || []) {
          const arr = JSON.parse(row.drawings_json);
          if (Array.isArray(arr) && arr.length > 0) {
            out.chartDrawings[row.symbol] = arr;
          }
          if (row.updated_at > maxDrawTime) maxDrawTime = row.updated_at;
        }
        out.chartDrawingsUpdatedAt = maxDrawTime || out._pushedAt;

        return jsonResponse(out);
      } catch (err) {
        return jsonResponse({ error: err.message }, 500);
      }
    }

    // PUT /api/sync -> store each section & symbol drawing in its own D1 row
    if (path === '/api/sync' && request.method === 'PUT') {
      try {
        const body = await request.json();
        const now = body._pushedAt || Date.now();
        const stmts = [];

        const upsertSection = (section, value, ts = now) => {
          stmts.push(
            env.DB.prepare(
              `INSERT INTO sync_sections (user_id, section, data_json, updated_at)
               VALUES (?, ?, ?, ?)
               ON CONFLICT(user_id, section) DO UPDATE SET data_json = excluded.data_json, updated_at = excluded.updated_at`
            ).bind(userId, section, JSON.stringify(value), ts)
          );
        };

        if (Array.isArray(body.records)) upsertSection('records', body.records);
        if (Array.isArray(body.bsr)) upsertSection('bsr', body.bsr);
        if (Array.isArray(body.mpm)) upsertSection('mpm', body.mpm);
        if (Array.isArray(body.ftd)) upsertSection('ftd', body.ftd);
        if (Array.isArray(body.srt)) upsertSection('srt', body.srt);

        if (body.sccWatchlists) {
          upsertSection('watchlists', {
            sccWatchlists: body.sccWatchlists,
            sccSymbolFlags: body.sccSymbolFlags || {},
            sccWatchlistsUpdatedAt: body.sccWatchlistsUpdatedAt || now,
          }, body.sccWatchlistsUpdatedAt || now);
        }

        upsertSection('prefs', {
          bsrMode: body.bsrMode || 'quick',
          bsrModeUpdatedAt: body.bsrModeUpdatedAt || 0,
          bsrQuick: body.bsrQuick || { won: null, lost: null, total: 10 },
          fyersCreds: body.fyersCreds || null,
        });

        if (body.chartDrawings && typeof body.chartDrawings === 'object') {
          const drawTs = body.chartDrawingsUpdatedAt || now;
          for (const [sym, arr] of Object.entries(body.chartDrawings)) {
            stmts.push(
              env.DB.prepare(
                `INSERT INTO chart_drawings (user_id, symbol, drawings_json, updated_at)
                 VALUES (?, ?, ?, ?)
                 ON CONFLICT(user_id, symbol) DO UPDATE SET drawings_json = excluded.drawings_json, updated_at = excluded.updated_at`
              ).bind(userId, sym, JSON.stringify(arr || []), drawTs)
            );
          }
        }

        if (stmts.length > 0) {
          await env.DB.batch(stmts);
        }

        return jsonResponse({ ok: true, updatedAt: now, statements: stmts.length });
      } catch (err) {
        return jsonResponse({ error: err.message }, 500);
      }
    }

    // PUT /api/drawings/:symbol -> granular single-symbol drawing update
    if (path.startsWith('/api/drawings/') && request.method === 'PUT') {
      try {
        const symbol = decodeURIComponent(path.replace('/api/drawings/', '')).toUpperCase();
        const body = await request.json();
        const now = body.updatedAt || Date.now();
        await env.DB.prepare(
          `INSERT INTO chart_drawings (user_id, symbol, drawings_json, updated_at)
           VALUES (?, ?, ?, ?)
           ON CONFLICT(user_id, symbol) DO UPDATE SET drawings_json = excluded.drawings_json, updated_at = excluded.updated_at`
        ).bind(userId, symbol, JSON.stringify(body.drawings || []), now).run();
        return jsonResponse({ ok: true, symbol, updatedAt: now });
      } catch (err) {
        return jsonResponse({ error: err.message }, 500);
      }
    }

    return jsonResponse({ error: 'Not found' }, 404);
  },
};
