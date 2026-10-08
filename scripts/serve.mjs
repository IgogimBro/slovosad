import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../dist');
const port = Number(process.env.SLOVOSAD_PORT ?? 4173);
const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
};
try {
  await stat(path.join(root, 'index.html'));
} catch {
  console.error('Нет dist/index.html. Сначала выполните pnpm build.');
  process.exit(1);
}
const server = http.createServer(async (req, res) => {
  if (!['GET', 'HEAD'].includes(req.method)) {
    res.writeHead(405);
    res.end();
    return;
  }
  try {
    const requested = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const file = path.resolve(
      root,
      '.' + requested + (requested.endsWith('/') ? 'index.html' : ''),
    );
    const relative = path.relative(root, file);
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      res.writeHead(403);
      res.end();
      return;
    }
    const content = await readFile(file);
    res.writeHead(200, {
      'Content-Type': mime[path.extname(file)] ?? 'application/octet-stream',
      'Cache-Control': 'no-cache',
      'X-Content-Type-Options': 'nosniff',
    });
    res.end(req.method === 'HEAD' ? undefined : content);
  } catch {
    res.writeHead(404);
    res.end('Not found');
  }
});
server.listen(port, '127.0.0.1', () =>
  console.log(`Словосад: http://127.0.0.1:${port}/\nОстановить: Ctrl+C`),
);
process.on('SIGINT', () => server.close(() => process.exit(0)));
