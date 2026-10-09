import { createReadStream, statSync } from 'node:fs';
import { createServer } from 'node:http';
import path from 'node:path';

const browserRoot = path.resolve(import.meta.dirname, '../../dist/apps/frontend/browser');
const contentTypes = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.html', 'text/html; charset=utf-8'],
  ['.ico', 'image/x-icon'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.png', 'image/png'],
  ['.svg', 'image/svg+xml'],
  ['.woff2', 'font/woff2'],
]);

/**
 * Checks whether a resolved path is the root itself or one of its descendants.
 *
 * @param {string} root - The directory that constrains the path.
 * @param {string} filePath - The path to check.
 * @returns {boolean} Whether the path is inside the root.
 */
function isInside(root, filePath) {
  return filePath === root || filePath.startsWith(`${root}${path.sep}`);
}

/**
 * Checks synchronously whether a path points to a regular file.
 *
 * @param {string} filePath - The path to check.
 * @returns {boolean} Whether the path exists and is a file.
 */
function isFile(filePath) {
  try {
    return statSync(filePath).isFile();
  } catch {
    return false;
  }
}

/**
 * Selects the highest-priority supported locale from an Accept-Language header.
 *
 * @param {string} [header] - The request's Accept-Language header; defaults to an empty string.
 * @returns {'en' | 'es'} The preferred supported locale, defaulting to English.
 */
function preferredLocale(header = '') {
  const preferences = header
    .split(',')
    .map((entry, index) => {
      const [language, ...parameters] = entry.trim().split(';');
      const qualityParameter = parameters.find((parameter) => parameter.trim().startsWith('q='));
      const quality = typeof qualityParameter === 'string' ? Number(qualityParameter.slice(2)) : 1;
      return {
        language: language.toLowerCase().split('-')[0],
        quality: Number.isNaN(quality) ? 1 : quality,
        index,
      };
    })
    .filter(({ language, quality }) => quality > 0 && (language === 'en' || language === 'es'))
    .sort((left, right) => right.quality - left.quality || left.index - right.index);

  return preferences.length > 0 ? preferences[0].language : 'en';
}

/**
 * Sends a file response when the requested path is a regular file.
 *
 * @param {import('node:http').IncomingMessage} request - The incoming HTTP request.
 * @param {import('node:http').ServerResponse} response - The response to write.
 * @param {string} filePath - The file to send.
 * @returns {boolean} Whether a file response was started.
 */
function sendFile(request, response, filePath) {
  if (!isFile(filePath)) {
    return false;
  }

  const stats = statSync(filePath);
  response.writeHead(200, {
    'cache-control': 'no-cache',
    'content-length': stats.size,
    'content-type': contentTypes.get(path.extname(filePath)) ?? 'application/octet-stream',
  });
  if (request.method === 'HEAD') {
    response.end();
  } else {
    createReadStream(filePath).pipe(response);
  }
  return true;
}

const server = createServer((request, response) => {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(request.url ?? '/', 'http://localhost').pathname);
  } catch {
    response.writeHead(400).end();
    return;
  }

  const localeMatch = pathname.match(/^\/(en|es)(?:\/|$)/u);
  if (!localeMatch) {
    const rootAsset = path.resolve(browserRoot, `.${pathname}`);
    if (isInside(browserRoot, rootAsset) && sendFile(request, response, rootAsset)) {
      return;
    }

    const locale = preferredLocale(request.headers['accept-language']);
    const localizedPath = pathname === '/' ? `/${locale}/` : `/${locale}${pathname}`;
    response
      .writeHead(302, {
        location: `${localizedPath}${new URL(request.url ?? '/', 'http://localhost').search}`,
        vary: 'Accept-Language',
      })
      .end();
    return;
  }

  const localeRoot = path.resolve(browserRoot, localeMatch[1]);
  const relativePath = pathname.slice(localeMatch[0].length).replace(/^\/+/, '') || 'index.html';
  const localeFile = path.resolve(localeRoot, relativePath);
  if (!isInside(localeRoot, localeFile)) {
    response.writeHead(400).end();
    return;
  }
  if (sendFile(request, response, localeFile)) {
    return;
  }
  if (path.extname(relativePath)) {
    response.writeHead(404).end();
    return;
  }
  sendFile(request, response, path.resolve(localeRoot, 'index.html'));
});

server.listen(Number(process.env['PORT'] ?? 4200), '127.0.0.1');
