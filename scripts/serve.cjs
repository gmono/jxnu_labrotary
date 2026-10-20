const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve('public');
const types = { '.css': 'text/css; charset=utf-8', '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml' };
const server = http.createServer((request, response) => {
  let pathname;
  try { pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname); }
  catch { response.writeHead(400).end('Bad request'); return; }
  if (pathname === '/favicon.ico') { response.writeHead(204).end(); return; }
  const target = path.resolve(root, `.${pathname === '/' ? '/index.html' : pathname}`);
  if (target !== root && !target.startsWith(`${root}${path.sep}`)) { response.writeHead(403).end('Forbidden'); return; }
  fs.stat(target, (error, stats) => {
    const file = stats?.isDirectory() ? path.join(target, 'index.html') : target;
    fs.readFile(file, (readError, content) => {
      if (readError) { response.writeHead(404).end('Not found'); return; }
      response.writeHead(200, { 'content-type': types[path.extname(file)] ?? 'application/octet-stream' });
      response.end(content);
    });
  });
});

const port = Number(process.env.PORT ?? 8080);
server.listen(port, '0.0.0.0', () => console.log(`Serving public/ at http://localhost:${port}`));
