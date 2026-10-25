// A small local-only HTTP server for the manual helper and the triage view, in the same shape as
// the review tool: 127.0.0.1 only, and a per-run token on every API call and file request, so
// other sites cannot read or post to it.
import { randomBytes } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';

export interface LocalServerOptions {
  port: number;
  /** The single HTML page, which embeds the token. */
  page: (token: string) => string;
  /** POST /api/<name> with a JSON body; the return value is sent back as JSON. */
  api: Record<string, (body: Record<string, unknown>) => unknown>;
  /** GET /file?path=…&t=<token>: the file on disk to serve for `path`, or null to refuse. */
  file?: (path: string) => string | null;
}

export interface LocalServer {
  url: string;
  token: string;
  close: () => void;
}

const MAX_BODY = 25 * 1024 * 1024; // two pasted screenshots as data URLs

export function startLocalServer(opts: LocalServerOptions): Promise<LocalServer> {
  const token = randomBytes(16).toString('hex');
  const server = createServer((req, res) => {
    const send = (
      status: number,
      body: string | Buffer,
      type = 'application/json; charset=utf-8',
    ) => {
      res.writeHead(status, { 'content-type': type, 'cache-control': 'no-store' });
      res.end(body);
    };
    const url = new URL(req.url ?? '/', 'http://127.0.0.1');
    if (req.method === 'GET' && url.pathname === '/')
      return send(200, opts.page(token), 'text/html; charset=utf-8');
    if (req.method === 'GET' && url.pathname === '/file') {
      const path =
        url.searchParams.get('t') === token && opts.file?.(url.searchParams.get('path') ?? '');
      if (!path) return send(404, '{"error":"not found"}');
      try {
        return send(200, readFileSync(path), 'image/png');
      } catch {
        return send(404, '{"error":"not found"}');
      }
    }
    const handler = url.pathname.startsWith('/api/') && opts.api[url.pathname.slice(5)];
    if (req.method !== 'POST' || !handler) return send(404, '{"error":"not found"}');
    if (req.headers['x-token'] !== token) return send(403, '{"error":"bad token"}');
    let body = '';
    req.on('data', (c) => {
      body += c;
      if (body.length > MAX_BODY) req.destroy();
    });
    req.on('end', async () => {
      try {
        send(200, JSON.stringify((await handler(body ? JSON.parse(body) : {})) ?? {}));
      } catch (e) {
        send(400, JSON.stringify({ error: (e as Error).message }));
      }
    });
  });
  return new Promise((resolve) =>
    server.listen(opts.port, '127.0.0.1', () => {
      const { port } = server.address() as AddressInfo;
      resolve({ url: `http://127.0.0.1:${port}/`, token, close: () => server.close() });
    }),
  );
}

/** Writes a pasted `data:image/png;base64,…` URL to `path` (validated, not trusted). Browsers
 * paste clipboard images as PNG. */
export function saveDataUrl(dataUrl: unknown, path: string): void {
  const m =
    typeof dataUrl === 'string' ? /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl) : null;
  if (!m?.[1]) throw new Error('expected a PNG data URL');
  writeFileSync(path, Buffer.from(m[1], 'base64'));
}

/** The client-side helper the pages share: POST /api/<name> with the token. */
export const clientApi = (token: string) => `
const TOKEN = ${JSON.stringify(token)};
async function api(name, body = {}) {
  const r = await fetch('/api/' + name, { method: 'POST', headers: { 'content-type': 'application/json', 'x-token': TOKEN }, body: JSON.stringify(body) });
  const j = await r.json();
  if (!r.ok) throw new Error(j.error || r.statusText);
  return j;
}
const fileUrl = (p) => '/file?t=' + TOKEN + '&path=' + encodeURIComponent(p);
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => '&#' + c.charCodeAt(0) + ';');
function status(msg, error = false) { $('status').textContent = msg; $('status').className = error ? 'error' : ''; }
`;
