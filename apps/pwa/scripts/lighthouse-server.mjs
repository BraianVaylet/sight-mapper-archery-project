// Serves the production build for Lighthouse CI the way an archer meets it: gzip, the SPA fallback,
// and an API that answers "nobody is signed in". Without that answer the session check gets the
// HTML fallback, retries, and Lighthouse measures the retries instead of the app.
//
//   node scripts/lighthouse-server.mjs [port]
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const DIST = fileURLToPath(new URL('../dist', import.meta.url));
const PORT = Number(process.argv[2] ?? 4180);
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
};
const COMPRESSIBLE = new Set(['.html', '.js', '.css', '.json', '.webmanifest', '.svg', '.txt']);

/** `null` for a malformed escape (`/%E0%A4%A`): a bad URL is a 404, never a crash. */
function decode(pathname) {
  try {
    return decodeURIComponent(pathname);
  } catch {
    return null;
  }
}

async function file(pathname) {
  const decoded = decode(pathname);
  if (decoded === null) return null;
  const path = normalize(join(DIST, decoded));
  // Never outside dist, whatever the URL says.
  if (path !== DIST && !path.startsWith(DIST + sep)) return null;
  try {
    return { body: await readFile(path), ext: extname(path) };
  } catch {
    return null;
  }
}

async function handle(req, res) {
  const { pathname } = new URL(req.url ?? '/', 'http://localhost');
  if (pathname.startsWith('/api/')) {
    // Signed out: what a new archer's first visit sees.
    res.writeHead(pathname === '/api/auth/get-session' ? 200 : 401, {
      'content-type': 'application/json',
    });
    res.end('null');
    return;
  }
  const found = (pathname !== '/' && (await file(pathname))) || (await file('/index.html'));
  if (found === null) {
    res.writeHead(404).end();
    return;
  }
  const headers = { 'content-type': TYPES[found.ext] ?? 'application/octet-stream' };
  const gzip = COMPRESSIBLE.has(found.ext) && /\bgzip\b/.test(req.headers['accept-encoding'] ?? '');
  res.writeHead(200, gzip ? { ...headers, 'content-encoding': 'gzip' } : headers);
  res.end(gzip ? gzipSync(found.body) : found.body);
}

createServer((req, res) => {
  handle(req, res).catch(() => {
    if (!res.headersSent) res.writeHead(500);
    res.end();
  });
  // Loopback only: this is a test fixture, never something to reach from the network.
}).listen(PORT, '127.0.0.1', () =>
  process.stdout.write(`lighthouse server on http://127.0.0.1:${PORT}\n`),
);
