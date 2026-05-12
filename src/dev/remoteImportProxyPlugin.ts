import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Plugin, ViteDevServer } from 'vite';

const DEV_PROXY_PATH = '/.netlify/functions/remote-import';

function writeProxyError(res: ServerResponse, statusCode: number, message: string): void {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({ error: message }));
}

async function proxyRemoteImportRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (!req.url) {
    writeProxyError(res, 400, 'Missing request URL');
    return;
  }

  const requestUrl = new URL(req.url, 'http://localhost');
  const target = requestUrl.searchParams.get('url');

  if (!target) {
    writeProxyError(res, 400, 'Missing url query parameter');
    return;
  }

  let targetUrl: URL;
  try {
    targetUrl = new URL(target);
  } catch {
    writeProxyError(res, 400, 'Invalid target URL');
    return;
  }

  if (!/^https?:$/.test(targetUrl.protocol)) {
    writeProxyError(res, 400, 'Only http and https URLs are supported');
    return;
  }

  try {
    const upstream = await fetch(targetUrl, { method: 'GET' });
    const body = Buffer.from(await upstream.arrayBuffer());

    res.statusCode = upstream.status;

    const contentType = upstream.headers.get('content-type');
    if (contentType) {
      res.setHeader('Content-Type', contentType);
    }

    const cacheControl = upstream.headers.get('cache-control');
    if (cacheControl) {
      res.setHeader('Cache-Control', cacheControl);
    }

    res.end(body);
  } catch (error) {
    writeProxyError(res, 502, error instanceof Error ? error.message : 'Proxy request failed');
  }
}

export function createRemoteImportProxyPlugin(): Plugin {
  return {
    name: 'sparktype-remote-import-proxy',
    apply: 'serve',
    configureServer(server: ViteDevServer) {
      server.middlewares.use(async (req, res, next) => {
        if (req.method !== 'GET' || !req.url?.startsWith(DEV_PROXY_PATH)) {
          next();
          return;
        }

        await proxyRemoteImportRequest(req, res);
      });
    },
  };
}
