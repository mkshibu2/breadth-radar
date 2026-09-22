const http = require('http');
const https = require('https');
const url = require('url');

const PORT = 9090;

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

  // 2. Route Yahoo Finance / Chart requests (using ?url= parameter)
  const targetUrl = parsedUrl.query.url;
  if (!targetUrl) {
    res.writeHead(400, { 'Content-Type': 'text/plain' });
    res.end('Missing URL path or "url" query parameter.');
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
