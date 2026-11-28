# Cloudflare Worker — deploy notes

Two jobs in one worker:

| Route | Purpose | Needs auth? |
| --- | --- | --- |
| `/chart?url=…` | Yahoo Finance chart passthrough, so the dashboard can load candles from `file://` or GitHub Pages where cross-origin fetch is blocked | No — public market data only |
| `/api/health`, `/api/sync`, `/api/ms-ratings`, `/api/drawings/*` | D1 storage for drawings and sync | `SYNC_TOKEN` if set |

## Why `/chart` exists

Charts were empty because all three data routes failed at once:

* the worker answered **404** — the `/chart` route had never been committed, so the
  deployed worker only served D1 endpoints;
* the public fallbacks (`allorigins`, `codetabs`) answered **429** — rate-limited;
* opening `index.html` from disk makes the page origin `null`, which some proxies reject.

`/chart` is the reliable path. It is deliberately **not** an open proxy: only
`https://query1|query2.finance.yahoo.com/v8/finance/chart/*` is allowed. An open proxy
would be found and abused within hours.

## Deploy

```bash
cd cloudflare-worker
npx wrangler deploy
```

If you use the D1 features, also set the secret (previously deployed? it is preserved):

```bash
npx wrangler secret put SYNC_TOKEN
npx wrangler d1 execute mradar-db --file=./schema.sql
```

## Verify after deploying

```bash
curl -s "https://nse-chart-proxy.shibu-mk.workers.dev/api/health"
# {"ok":true,"backend":"cloudflare-d1"}

curl -s -o /dev/null -w "%{http_code}\n" \
  "https://nse-chart-proxy.shibu-mk.workers.dev/chart?url=$(python3 -c "import urllib.parse;print(urllib.parse.quote('https://query1.finance.yahoo.com/v8/finance/chart/RELIANCE.NS?range=5d&interval=1d'))")"
# 200
```

Then reload the dashboard with the console open — candles should appear without
the `404` storm. If the route is still missing the client trips a circuit breaker
after the first `404` and stops asking, so you will see one warning rather than dozens.

## Local alternative (no deploy needed)

If you just want charts working on your PC, you do **not** need the worker:

```bash
node proxy.js                 # CORS proxy on :9090
python -m http.server 8000    # serve the folder
# open http://localhost:8000/index.html
```

The page tries `localhost:9090` first when it is served from loopback.
