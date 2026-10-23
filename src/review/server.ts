// Local review server for npm run review. Binds to 127.0.0.1 only; every POST must carry the
// per-run token embedded in the page, so other sites cannot post decisions to localhost.
import { randomBytes } from 'node:crypto';
import { appendFileSync, readFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { allFixtures, loadFixtureFiles } from '../corpus/load.ts';
import type { Fixture } from '../corpus/validate.ts';
import { renderFixture } from '../render/reference.ts';
import { applyDecision, type Decision } from './apply.ts';
import { reviewPage } from './page.ts';

export interface ReviewOptions {
  /** Folder that contains corpus/fixtures (the repo root, or a temp copy in tests). */
  root: string;
  port: number;
  reviewer: string;
  now?: () => string;
}

const DECISIONS: Decision[] = ['approve', 'needs-fix', 'reject'];

export function startReviewServer(
  opts: ReviewOptions,
): Promise<{ url: string; close: () => void }> {
  const token = randomBytes(16).toString('hex');
  const fixtureRoot = `${opts.root}/corpus/fixtures`;
  const logPath = `${opts.root}/corpus/review-log.jsonl`;
  const now = opts.now ?? (() => new Date().toISOString());

  const drafts = () =>
    loadFixtureFiles(fixtureRoot).flatMap((file) =>
      allFixtures([file])
        .filter((fx) => fx.status === 'draft')
        .map((fx: Fixture) => ({
          path: file.path,
          file: file.path.slice(opts.root.length + 1),
          fx,
          html: renderFixture(fx),
        })),
    );

  const server = createServer((req, res) => {
    const send = (status: number, body: string, type = 'application/json; charset=utf-8') => {
      res.writeHead(status, { 'content-type': type, 'cache-control': 'no-store' });
      res.end(body);
    };
    try {
      if (req.method === 'GET' && req.url === '/')
        return send(200, reviewPage(token, opts.reviewer), 'text/html; charset=utf-8');
      if (req.headers['x-review-token'] !== token)
        return send(403, JSON.stringify({ error: 'bad token' }));
      if (req.method === 'GET' && req.url === '/api/drafts')
        return send(200, JSON.stringify(drafts()));
      if (req.method === 'POST' && req.url === '/api/decision') {
        let body = '';
        req.on('data', (c) => {
          body += c;
        });
        req.on('end', () => {
          try {
            const { id, decision, note } = JSON.parse(body) as {
              id: string;
              decision: Decision;
              note?: string;
            };
            if (!DECISIONS.includes(decision)) throw new Error(`unknown decision ${decision}`);
            const item = drafts().find((d) => d.fx.id === id);
            if (!item) throw new Error(`${id} is not a draft`);
            const result = applyDecision(
              item.path,
              readFileSync(item.path, 'utf8'),
              id,
              decision,
              note ?? '',
              opts.reviewer,
              now(),
            );
            writeFileSync(item.path, result.yamlText);
            appendFileSync(logPath, `${JSON.stringify(result.log)}\n`);
            send(200, JSON.stringify(result.log));
          } catch (e) {
            send(400, JSON.stringify({ error: (e as Error).message }));
          }
        });
        return;
      }
      send(404, JSON.stringify({ error: 'not found' }));
    } catch (e) {
      send(500, JSON.stringify({ error: (e as Error).message }));
    }
  });

  return new Promise((resolve) =>
    server.listen(opts.port, '127.0.0.1', () => {
      const { port } = server.address() as AddressInfo;
      resolve({ url: `http://127.0.0.1:${port}/`, close: () => server.close() });
    }),
  );
}
