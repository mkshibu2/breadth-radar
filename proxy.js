const http = require('http');
const https = require('https');
const url = require('url');
const fs = require('fs');
const path = require('path');

const PORT = 9090;

const server = http.createServer((req, res) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, access-token, client-id');
  res.setHeader('Access-Control-Allow-Private-Network', 'true');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;

  // Serve static files from current directory
  if (!pathname.startsWith('/dhan/') && !parsedUrl.query.url && !pathname.startsWith('/local/') && !pathname.startsWith('/local-api/')) {
    const safePath = path.normalize(pathname).replace(/^(\.\.[\/\\])+/, '');
    const filePath = path.join(__dirname, safePath === '/' ? '/index.html' : safePath);
    
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      const ext = path.extname(filePath).toLowerCase();
      let contentType = 'text/plain';
      if (ext === '.html') contentType = 'text/html';
      else if (ext === '.css') contentType = 'text/css';
      else if (ext === '.js') contentType = 'text/javascript';
      else if (ext === '.json') contentType = 'application/json';
      else if (ext === '.png') contentType = 'image/png';
      else if (ext === '.jpg' || ext === '.jpeg') contentType = 'image/jpeg';
      else if (ext === '.svg') contentType = 'image/svg+xml';
      else if (ext === '.ico') contentType = 'image/x-icon';

      res.writeHead(200, { 'Content-Type': contentType });
      fs.createReadStream(filePath).pipe(res);
      return;
    }
  }

  // 1.25. Route local API requests (starts with /local-api/)
  if (parsedUrl.pathname.startsWith('/local-api/')) {
    const apiPath = parsedUrl.pathname.replace('/local-api/', '');
    
    if (apiPath === 'fetch-eod') {
      const dateVal = parsedUrl.query.date || 'today';
      const { exec } = require('child_process');
      const cmd = `python automate_eod.py --date "${dateVal}"`;
      
      console.log(`[Local API] Running: ${cmd}`);
      exec(cmd, (error, stdout, stderr) => {
        if (error) {
          console.error(`Error running automate_eod.py: ${error.message}`);
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: error.message, stderr: stderr }));
          return;
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(stdout);
      });
      return;
    }
  }

  // 1.5. Route local file requests (starts with /local/)
  if (parsedUrl.pathname.startsWith('/local/')) {
    const filename = parsedUrl.pathname.replace('/local/', '');
    const fs = require('fs');
    const path = require('path');
    const filePath = path.join(__dirname, filename);
    
    // Safety check to prevent directory traversal
    if (filePath.startsWith(__dirname)) {
      fs.readFile(filePath, (err, data) => {
        if (err) {
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          res.end(`File not found: ${filename}`);
        } else {
          let contentType = 'text/plain';
          if (filename.endsWith('.json')) contentType = 'application/json';
          else if (filename.endsWith('.csv')) contentType = 'text/csv';
          else if (filename.endsWith('.html')) contentType = 'text/html';
          res.writeHead(200, { 'Content-Type': contentType });
          res.end(data);
        }
      });
      return;
    }
  }

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
