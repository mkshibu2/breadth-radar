const http = require('http');
const https = require('https');
const url = require('url');

const PORT = process.env.PORT || 9090;

const server = http.createServer((req, res) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, access-token, client-id');

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
