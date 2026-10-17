// Local development server. No fixture data or production credentials are embedded.
'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

for (const file of ['.env', '.env.local']) {
  if (fs.existsSync(path.join(__dirname, file))) {
    process.loadEnvFile(path.join(__dirname, file));
  }
}

const api = new Set([
  'time', 'rooms', 'leaderboards', 'study-time', 'exam',
  'gemini', 'token', 'themes', 'admin-token', 'admin-users', 'admissions'
]);

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.wav': 'audio/wav'
};

const CSP = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self' https://accounts.google.com",
  "script-src 'self' 'unsafe-inline' https://meet.jit.si https://cdnjs.cloudflare.com https://cdn.jsdelivr.net https://static.cloudflareinsights.com https://jsme-editor.github.io https://www.gstatic.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  "img-src 'self' data: blob: https:",
  "media-src 'self' blob: https:",
  "connect-src 'self' https://*.firebaseio.com https://*.googleapis.com https://securetoken.googleapis.com https://identitytoolkit.googleapis.com https://www.googleapis.com https://generativelanguage.googleapis.com https://docs.google.com",
  "frame-src 'self' https://meet.jit.si https://drive.google.com https://*.google.com https://www.youtube.com https://www.youtube-nocookie.com"
].join('; ');

const BLOCKED_PATH = /^\/(api|lib|tests?|node_modules|scripts|config|docs)\/|^\/(package(-lock)?|vercel|database\.rules\.candidate|metadata|tailwind\.config|server)\.(json|cjs|js)$|\/\.[^/]+/;

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    res.status = code => { res.statusCode = code; return res; };
    res.json = value => {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify(value));
    };

    if (url.pathname.startsWith('/api/')) {
      const name = url.pathname.slice(5);
      if (!api.has(name)) return res.status(404).json({ error: 'Không tìm thấy API.' });
      let body = '', bytes = 0;
      for await (const chunk of req) {
        bytes += chunk.length;
        if (bytes > 3500000) return res.status(413).json({ error: 'Dữ liệu quá lớn.' });
        body += chunk;
      }
      try {
        req.body = body ? JSON.parse(body) : {};
      } catch {
        return res.status(400).json({ error: 'Dữ liệu không hợp lệ.' });
      }
      req.query = Object.fromEntries(url.searchParams);
      await require('./api/' + name + '.js')(req, res);
      return;
    }

    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405).end();
      return;
    }

    const relative = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname);
    const file = path.resolve(__dirname, '.' + relative);
    const extension = path.extname(file);

    if (
      !file.startsWith(__dirname + path.sep) ||
      !mime[extension] ||
      BLOCKED_PATH.test(relative) ||
      !fs.existsSync(file) ||
      !fs.statSync(file).isFile()
    ) {
      res.writeHead(404).end('Not found');
      return;
    }

    res.setHeader('Content-Type', mime[extension]);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Content-Security-Policy', CSP);
    res.setHeader('Permissions-Policy', 'camera=(self "https://meet.jit.si"), microphone=(self "https://meet.jit.si"), geolocation=()');
    res.setHeader('Cache-Control', 'no-cache');

    if (req.method === 'HEAD') res.end();
    else fs.createReadStream(file).pipe(res);
  } catch (error) {
    console.error('Local server', error);
    if (!res.headersSent) res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Không thể xử lý yêu cầu.');
  }
});

const port = Number(process.env.PORT) || 3000;
server.listen(port, '0.0.0.0', () => console.log(`WEBHOALIEM: http://0.0.0.0:${port}`));
