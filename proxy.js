const http = require('http');
const https = require('https');
const url = require('url');

const PORT = process.env.PORT || 9090;

const server = http.createServer((req, res) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, authorization, access-token, client-id');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  const parsedUrl = url.parse(req.url, true);

  // 1. Route Dhan requests (starts with /dhan/)
  if (parsedUrl.pathname.startsWith('/dhan/')) {
    const targetPath = parsedUrl.pathname.replace('/dhan', ''); // remove prefix

    // Gather request body for POST authentication calls
    let bodyData = [];
    req.on('data', chunk => {
      bodyData.push(chunk);
    }).on('end', () => {
      const rawBody = Buffer.concat(bodyData).toString();
      let parsedBody = {};
      try {
        if (rawBody) parsedBody = JSON.parse(rawBody);
      } catch (e) {
        console.warn('Failed to parse incoming JSON body');
      }

      // Handle Step 1: Generate Consent
      if (targetPath === '/generate-consent') {
        const { clientId, apiKey, apiSecret } = parsedBody;
        const targetUrl = `https://auth.dhan.co/app/generate-consent?client_id=${clientId}`;
        console.log(`[Dhan OAuth] Generate Consent for Client: ${clientId}`);
        
        sendProxyRequest(req, res, targetUrl, 'POST', JSON.stringify({}), {
          'app_id': apiKey,
          'app_secret': apiSecret,
          'Content-Type': 'application/json'
        });
        return;
      }

      // Handle Step 3: Consume Token
      if (targetPath === '/consume-token') {
        const { tokenId, apiKey, apiSecret } = parsedBody;
        const targetUrl = `https://auth.dhan.co/app/consumeApp-consent?tokenId=${tokenId}`;
        console.log(`[Dhan OAuth] Consume Token ID: ${tokenId}`);
        
        sendProxyRequest(req, res, targetUrl, 'POST', JSON.stringify({}), {
          'app_id': apiKey,
          'app_secret': apiSecret,
          'Content-Type': 'application/json'
        });
        return;
      }

      // Handle standard Dhan v2 APIs (Holdings, Positions, Funds, etc.)
      const targetUrl = `https://api.dhan.co/v2${targetPath}${parsedUrl.search || ''}`;
      console.log(`[Dhan API] ${req.method} -> ${targetUrl}`);
      
      const headers = {};
      if (req.headers['access-token']) headers['access-token'] = req.headers['access-token'];
      if (req.headers['client-id']) headers['client-id'] = req.headers['client-id'];
      if (req.headers['content-type']) headers['Content-Type'] = req.headers['content-type'];

      sendProxyRequest(req, res, targetUrl, req.method, rawBody, headers);
    });
    return;
  }

  // 1b. Route Fyers requests (starts with /fyers/)
  if (parsedUrl.pathname.startsWith('/fyers/')) {
    const targetPath = parsedUrl.pathname.replace('/fyers', ''); // remove prefix

    // Handle token validation route: /fyers/validate-authcode
    if (targetPath === '/validate-authcode') {
      const crypto = require('crypto');
      let bodyData = [];
      req.on('data', chunk => bodyData.push(chunk)).on('end', () => {
        try {
          const { appId, secretId, authCode } = JSON.parse(Buffer.concat(bodyData).toString());
          if (!appId || !secretId || !authCode) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ s: 'error', message: 'Missing appId, secretId or authCode' }));
            return;
          }
          const rawHash = `${appId}:${secretId}`;
          const appIdHash = crypto.createHash('sha256').update(rawHash).digest('hex');

          const payload = JSON.stringify({
            grant_type: 'authorization_code',
            appIdHash: appIdHash,
            code: authCode
          });

          console.log('[Fyers OAuth] Exchanging authCode for Access Token...');
          sendProxyRequest(req, res, 'https://api-t1.fyers.in/api/v3/validate-authcode', 'POST', payload, {
            'Content-Type': 'application/json'
          });
        } catch (err) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ s: 'error', message: err.message }));
        }
      });
      return;
    }

    const targetUrl = `https://api-t1.fyers.in${targetPath}${parsedUrl.search || ''}`;
    console.log(`[Fyers API] ${req.method} -> ${targetUrl}`);

    const headers = {};
    if (req.headers['authorization']) headers['Authorization'] = req.headers['authorization'];
    if (req.headers['content-type']) headers['Content-Type'] = req.headers['content-type'];

    if (req.method === 'POST' || req.method === 'PUT') {
      let bodyData = [];
      req.on('data', chunk => {
        bodyData.push(chunk);
      }).on('end', () => {
        const rawBody = Buffer.concat(bodyData).toString();
        sendProxyRequest(req, res, targetUrl, req.method, rawBody, headers);
      });
      return;
    }

    sendProxyRequest(req, res, targetUrl, req.method, null, headers);
    return;
  }

  // 2. Route Local Scanner requests (/run-scanner)
  if (parsedUrl.pathname === '/run-scanner') {
    const { exec } = require('child_process');
    console.log('[Proxy Scanner] Running vcp_scanner.py locally...');
    exec('python vcp_scanner.py', { cwd: __dirname }, (error, stdout, stderr) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      if (error) {
        console.error('[Proxy Scanner Error]:', error.message);
        res.end(JSON.stringify({ success: false, error: error.message }));
      } else {
        console.log('[Proxy Scanner] Completed successfully.');
        res.end(JSON.stringify({ success: true, message: 'Scan completed locally' }));
      }
    });
    return;
  }

  // 2b. Route Fundamental Sync requests (/sync-financials)
  if (parsedUrl.pathname === '/sync-financials') {
    const { exec } = require('child_process');
    console.log('[Proxy Financials] Running sync_exact_financials.py locally...');
    exec('python sync_exact_financials.py', { cwd: __dirname }, (error, stdout, stderr) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      if (error) {
        console.error('[Proxy Financials Error]:', error.message);
        res.end(JSON.stringify({ success: false, error: error.message }));
      } else {
        console.log('[Proxy Financials] Fundamentals sync completed successfully.');
        res.end(JSON.stringify({ success: true, message: 'Fundamentals synced successfully' }));
      }
    });
    return;
  }

  // 2c. Serve exact_quarterly_financials.json directly with CORS
  if (parsedUrl.pathname === '/exact_quarterly_financials.json') {
    const fs = require('fs');
    const path = require('path');
    const fPath = path.join(__dirname, 'exact_quarterly_financials.json');
    if (fs.existsSync(fPath)) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(fs.readFileSync(fPath));
    } else {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end('{}');
    }
    return;
  }

  // 2d. MarketSmith India Ratings (/ms-ratings?symbol=RELIANCE)
  if (parsedUrl.pathname === '/ms-ratings') {
    const rawSym = (parsedUrl.query.symbol || '').toString().trim().toUpperCase().replace(/\.(NS|BO)$/i, '');
    if (!rawSym) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: 'Missing symbol parameter' }));
      return;
    }
    getMarketSmithRatings(rawSym)
      .then((data) => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(data));
      })
      .catch((err) => {
        res.writeHead(502, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, symbol: rawSym, error: err.message }));
      });
    return;
  }

  // 3. Route Yahoo Finance / Chart / TradingView Scanner requests (using ?url= parameter)
  const targetUrl = parsedUrl.query.url;
  if (!targetUrl) {
    res.writeHead(400, { 'Content-Type': 'text/plain' });
    res.end('Missing URL path or "url" query parameter.');
    return;
  }

  if (req.method === 'POST' || req.method === 'PUT') {
    let bodyData = [];
    req.on('data', chunk => {
      bodyData.push(chunk);
    }).on('end', () => {
      const rawBody = Buffer.concat(bodyData).toString();
      const extraHeaders = {};
      if (req.headers['content-type']) extraHeaders['Content-Type'] = req.headers['content-type'];
      console.log(`[Proxy] ${req.method} -> ${targetUrl}`);
      sendProxyRequest(req, res, targetUrl, req.method, rawBody, extraHeaders);
    });
    return;
  }

  console.log(`[Chart Proxy] GET -> ${targetUrl}`);
  sendProxyRequest(req, res, targetUrl, 'GET', null);
});

// Helper function to send requests to target endpoints
function sendProxyRequest(clientReq, clientRes, targetUrl, method, body, extraHeaders = {}) {
  const parsed = url.parse(targetUrl);
  
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': '*/*',
    ...extraHeaders
  };

  const options = {
    hostname: parsed.hostname,
    path: parsed.path,
    method: method,
    headers: headers
  };

  const proxyReq = https.request(options, (proxyRes) => {
    clientRes.writeHead(proxyRes.statusCode, { 
      'Content-Type': proxyRes.headers['content-type'] || 'application/json' 
    });
    proxyRes.pipe(clientRes);
  });

  proxyReq.on('error', (err) => {
    console.error('Proxy connection error:', err.message);
    clientRes.writeHead(500, { 'Content-Type': 'text/plain' });
    clientRes.end(`Proxy error: ${err.message}`);
  });

  if (body) {
    proxyReq.write(body);
  }
  proxyReq.end();
}

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.log('\n===================================================');
    console.log(`  Unified CORS Proxy is ALREADY running on http://localhost:${PORT}`);
    console.log('===================================================');
    console.log('\nYou can close this terminal window as the active background');
    console.log('proxy process is already handling chart and Dhan data.\n');
    process.exit(0);
  } else {
    console.error('Server error:', err.message);
    process.exit(1);
  }
});

server.listen(PORT, () => {
  console.log('===================================================');
  console.log(`  Unified CORS Proxy running on http://localhost:${PORT}`);
  console.log('===================================================');
  console.log('\nKeep this window open. Chart and Dhan features');
  console.log('will now work dynamically from your dashboard.\n');
});

// ── MARKETSMITH INDIA RATINGS HELPER ──
const _msSession = { token: '', fetchedAt: 0 };
const _msRatingsCache = new Map(); // symbol -> { data, ts }
const MS_CACHE_TTL = 6 * 60 * 60 * 1000;
const MS_BASE = 'https://marketsmithindia.com/gateway/simple-api/ms-india';

function httpGetText(targetUrl, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = https.get(targetUrl, { headers }, (resp) => {
      let body = '';
      resp.on('data', (c) => { body += c; });
      resp.on('end', () => resolve({ status: resp.statusCode, headers: resp.headers, body }));
    });
    req.setTimeout(12000, () => req.destroy(new Error('MarketSmith request timeout')));
    req.on('error', reject);
  });
}

async function getMsSessionToken(force = false) {
  if (!force && _msSession.token && (Date.now() - _msSession.fetchedAt) < 25 * 60 * 1000) {
    return _msSession.token;
  }
  const resp = await httpGetText('https://marketsmithindia.com/mstool/eval/reliance/evaluation.jsp', {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  });
  const setCookies = resp.headers['set-cookie'] || [];
  for (const c of setCookies) {
    const m = c.match(/MSSESSIONID=([^;]+)/);
    if (m) {
      _msSession.token = m[1];
      _msSession.fetchedAt = Date.now();
      return _msSession.token;
    }
  }
  throw new Error('Could not obtain MarketSmith session token');
}

async function getMarketSmithRatings(symbol) {
  const cached = _msRatingsCache.get(symbol);
  if (cached && (Date.now() - cached.ts) < MS_CACHE_TTL) {
    return cached.data;
  }

  const ua = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Referer': 'https://marketsmithindia.com/',
  };

  const srchResp = await httpGetText(`${MS_BASE}/instr/srch.json?text=${encodeURIComponent(symbol)}&lang=en&ver=2`, ua);
  if (srchResp.status !== 200) throw new Error(`MS search HTTP ${srchResp.status}`);
  const srchJson = JSON.parse(srchResp.body);
  const results = (srchJson.response && srchJson.response.results) || [];
  if (!results.length) throw new Error(`Symbol ${symbol} not found on MarketSmith`);

  const match = results.find((x) => String(x.symbol || '').toUpperCase() === symbol) || results[0];
  const instrId = match.instrumentId;
  if (!instrId) throw new Error(`No instrumentId for ${symbol}`);

  let token = await getMsSessionToken(false);
  let wResp = await httpGetText(
    `${MS_BASE}/instr/0/${instrId}/wisdom.json?lang=en&ver=2&x=y&ms-auth=${encodeURIComponent(token)}`,
    { ...ua, 'Cookie': `MSSESSIONID=${token}` }
  );
  if (wResp.status === 401 || wResp.status === 403) {
    token = await getMsSessionToken(true);
    wResp = await httpGetText(
      `${MS_BASE}/instr/0/${instrId}/wisdom.json?lang=en&ver=2&x=y&ms-auth=${encodeURIComponent(token)}`,
      { ...ua, 'Cookie': `MSSESSIONID=${token}` }
    );
  }
  if (wResp.status !== 200) throw new Error(`MS wisdom HTTP ${wResp.status}`);

  const wJson = JSON.parse(wResp.body);
  const items = (wJson.response && wJson.response.results) || [];
  const pick = (msid) => {
    const it = items.find((x) => Number(x.msid) === msid);
    return it ? (it.itemValue != null ? String(it.itemValue) : null) : null;
  };

  const data = {
    ok: true,
    symbol,
    instrumentId: instrId,
    epsStrength: pick(4589),
    priceStrength: pick(2),
    buyerDemand: pick(5),
    groupRank: pick(1989),
    masterScore: pick(1746),
    marketDirection: pick(4453),
    fetchedAt: Date.now(),
  };
  _msRatingsCache.set(symbol, { data, ts: Date.now() });
  return data;
}
