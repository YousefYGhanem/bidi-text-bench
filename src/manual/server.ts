// npm run manual: the local helper for one closed product (docs/AUDIT_PROTOCOL.md §4).
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import type { ResultLine } from '../audit/run.ts';
import type { Fixture } from '../corpus/validate.ts';
import { type LocalServer, saveDataUrl, startLocalServer } from '../local/server.ts';
import { renderFixture } from '../render/reference.ts';
import { checksFor, type ManualSave, manualLines, PROMPT } from './manual.ts';
import { manualPage } from './page.ts';

export interface ManualOptions {
  target: { id: string; name: string };
  fixtures: Fixture[];
  /** The run folder: env.json, results.jsonl and evidence/ go here. */
  dir: string;
  benchCommit: string;
  port: number;
}

const ENV_FIELDS = ['productVersion', 'os', 'browser', 'window', 'uiLanguage'] as const;
const STATUSES = ['pass', 'fail', 'na'];

export function startManualServer(o: ManualOptions): Promise<LocalServer> {
  mkdirSync(`${o.dir}/evidence`, { recursive: true });
  const resultsPath = `${o.dir}/results.jsonl`;
  const envPath = `${o.dir}/env.json`;
  const readLines = (): ResultLine[] =>
    existsSync(resultsPath)
      ? readFileSync(resultsPath, 'utf8')
          .split('\n')
          .filter(Boolean)
          .map((l) => JSON.parse(l))
      : [];
  const readEnv = () => (existsSync(envPath) ? JSON.parse(readFileSync(envPath, 'utf8')) : null);

  return startLocalServer({
    port: o.port,
    page: (token) => manualPage(token, o.target.name),
    file: (path) => {
      // Only this run's own evidence.
      const m = /^evidence\/[\w-]+\.png$/.exec(path);
      return m ? `${o.dir}/${path}` : null;
    },
    api: {
      state: () => {
        const lines = readLines();
        return {
          env: readEnv(),
          items: o.fixtures.map((fx) => ({
            fx,
            html: renderFixture(fx),
            prompt: `${PROMPT}\n\n${fx.text}`,
            checks: checksFor(fx),
            saved: lines.filter((l) => l.fixture === fx.id),
          })),
        };
      },
      env: (body) => {
        const env: Record<string, unknown> = {};
        for (const f of ENV_FIELDS) {
          const v = body[f];
          if (typeof v !== 'string' || !v.trim()) throw new Error(`${f} is required`);
          env[f] = v.trim();
        }
        const full = {
          date: new Date().toISOString(),
          target: o.target.id,
          mode: 'manual (npm run manual)',
          ...env,
          locale: 'as set in the product',
          benchCommit: o.benchCommit,
          fixtures: o.fixtures.map((f) => f.id),
        };
        writeFileSync(envPath, `${JSON.stringify(full, null, 2)}\n`);
        return full;
      },
      save: (body) => {
        const env = readEnv();
        if (!env) throw new Error('fill in the environment first');
        const fx = o.fixtures.find((f) => f.id === body.id);
        if (!fx) throw new Error(`${String(body.id)} is not in this run`);
        const statuses = (body.statuses ?? {}) as Record<string, string>;
        for (const s of Object.values(statuses))
          if (!STATUSES.includes(s)) throw new Error(`unknown status ${s}`);
        const screenshots: ManualSave['screenshots'] = {};
        for (const kind of ['input', 'reply'] as const) {
          const rel = `evidence/${fx.id}-${kind}.png`;
          if (body[kind]) saveDataUrl(body[kind], `${o.dir}/${rel}`);
          if (existsSync(`${o.dir}/${rel}`)) screenshots[kind] = rel;
        }
        const lines = manualLines(fx, o.target.id, env.browser, {
          statuses: statuses as ManualSave['statuses'],
          note: typeof body.note === 'string' ? body.note : '',
          contentChanged: body.contentChanged === true,
          screenshots,
        });
        // Re-saving a fixture replaces its lines, so a session can be corrected and resumed.
        const kept = readLines().filter((l) => l.fixture !== fx.id);
        writeFileSync(
          resultsPath,
          [...kept, ...lines].map((l) => `${JSON.stringify(l)}\n`).join(''),
        );
        return { lines };
      },
    },
  });
}
