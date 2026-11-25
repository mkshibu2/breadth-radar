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

    if (!isAuthorized(request, env)) {
      return jsonResponse({ error: 'Unauthorized: invalid or missing SYNC_TOKEN' }, 401);
    }

    const userId = 'default';

    // GET /api/sync -> reconstruct full payload from D1 tables
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
