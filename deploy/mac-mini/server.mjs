import { createReadStream, existsSync } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { dirname, extname, join, normalize, resolve } from 'node:path';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptDirectory, '..', '..');
const distRoot = resolve(process.env.HANDLED_DIST ?? join(projectRoot, 'dist'));
const host = process.env.HANDLED_HOST ?? '127.0.0.1';
const port = Number(process.env.HANDLED_PORT ?? 4173);
const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.woff2': 'font/woff2',
};

function sendJson(response, status, body) {
  response.writeHead(status, {
    'Cache-Control': 'no-store',
    'Content-Type': 'application/json; charset=utf-8',
    'X-Content-Type-Options': 'nosniff',
  });
  response.end(JSON.stringify(body));
}

async function existingFile(path) {
  try {
    return (await stat(path)).isFile() ? path : null;
  } catch {
    return null;
  }
}

async function staticFile(pathname) {
  const decoded = decodeURIComponent(pathname);
  const candidate = resolve(distRoot, `.${normalize(decoded)}`);
  if (
    candidate !== distRoot &&
    !candidate.startsWith(`${distRoot}/`) &&
    !candidate.startsWith(`${distRoot}\\`)
  ) {
    return null;
  }
  return (
    (await existingFile(candidate)) ??
    (await existingFile(`${candidate}.html`)) ??
    (await existingFile(join(candidate, 'index.html'))) ??
    (await existingFile(join(distRoot, 'index.html')))
  );
}

const server = createServer(async (request, response) => {
  const requestUrl = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`);
  if (requestUrl.pathname === '/health') {
    sendJson(response, 200, { status: 'ok', timestamp: new Date().toISOString() });
    return;
  }
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    sendJson(response, 405, { error: 'Method not allowed.' });
    return;
  }

  const file = await staticFile(requestUrl.pathname);
  if (!file || !existsSync(file)) {
    sendJson(response, 404, { error: 'Not found.' });
    return;
  }
  const extension = extname(file).toLowerCase();
  const isHashedAsset =
    file.includes(`${projectRoot}/dist/_expo/`) || file.includes(`${projectRoot}\\dist\\_expo\\`);
  response.writeHead(200, {
    'Cache-Control': isHashedAsset ? 'public, max-age=31536000, immutable' : 'no-store',
    'Content-Type': contentTypes[extension] ?? 'application/octet-stream',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'SAMEORIGIN',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
  });
  if (request.method === 'HEAD') {
    response.end();
    return;
  }
  createReadStream(file).pipe(response);
});

server.listen(port, host, () => {
  console.log(`Handled web server listening on http://${host}:${port}`);
});
