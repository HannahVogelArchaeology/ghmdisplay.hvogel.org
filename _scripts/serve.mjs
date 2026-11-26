// Serves a built site folder on 127.0.0.1 for local audits and Playwright tests,
// compressing text files with gzip as GitHub Pages does so Lighthouse measures real transfer sizes.
// Folders serve their index.html; anything missing returns 404.
//
// Usage: node _scripts/serve.mjs <dir> <port>
import { createServer } from 'node:http';
import { createReadStream, statSync } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';
import { createGzip } from 'node:zlib';

const [dir, port] = process.argv.slice(2);
const root = resolve(dir);
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.vtt': 'text/vtt; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.m4a': 'audio/mp4',
  '.mp4': 'video/mp4',
};

// Binary media, images, and fonts are already compressed
const COMPRESS = new Set(['.html', '.css', '.js', '.mjs', '.json', '.map', '.xml', '.txt', '.vtt', '.svg']);

const find = path => {
  try {
    return statSync(path).isDirectory() ? find(join(path, 'index.html')) : path;
  } catch {
    return null;
  }
};

createServer((req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, 'http://127.0.0.1').pathname);
  const rel = normalize(pathname).replace(/^(\.\.(\/|\\|$))+/, '');
  const file = find(join(root, rel));
  if (!file) {
    const notFound = find(join(root, '404.html'));
    if (notFound) {
      res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
      return createReadStream(notFound).pipe(res);
    }
    return res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Not found');
  }
  const type = extname(file).toLowerCase();
  const gzip = COMPRESS.has(type) && /\bgzip\b/.test(req.headers['accept-encoding'] ?? '');
  res.writeHead(200, {
    'Content-Type': TYPES[type] ?? 'application/octet-stream',
    ...(gzip && { 'Content-Encoding': 'gzip', Vary: 'Accept-Encoding' }),
  });
  const body = createReadStream(file);
  (gzip ? body.pipe(createGzip()) : body).pipe(res);
}).listen(Number(port), '127.0.0.1');
