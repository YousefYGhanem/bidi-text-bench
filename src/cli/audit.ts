// npm run audit -- --target <id> [--browser chromium|firefox|webkit|all] [--viewport desktop|mobile|all]
//   [--only id,id] [--local]
// Runs every verified fixture through the target's adapter and writes audit/runs/<date>-<target>/
// (docs/AUDIT_PROTOCOL.md §3). The browsers run in the project Docker image via `playwright
// run-server` (CHECKER_SPEC §7); --local uses this machine's browsers, for debugging only.
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { arch, platform, release } from 'node:os';
import { parseArgs } from 'node:util';
import { type Browser, chromium, firefox, webkit } from '@playwright/test';
import { parse } from 'yaml';
import { ADAPTERS } from '../adapters/index.ts';
import { runAudit, summarize, VIEWPORTS, type ViewportName } from '../audit/run.ts';
import { allFixtures, loadFixtureFiles } from '../corpus/load.ts';
import { isStale } from '../corpus/validate.ts';

const IMAGE = 'bidi-text-bench-test';
const PORT = 3333;
const { values } = parseArgs({
  options: {
    target: { type: 'string' },
    browser: { type: 'string', default: 'chromium' },
    viewport: { type: 'string', default: 'desktop' },
    only: { type: 'string' },
    local: { type: 'boolean', default: false },
  },
});

const fail = (msg: string): never => {
  console.error(msg);
  process.exit(1);
};
const run = (cmd: string, args: string[]) =>
  execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();

const id = values.target ?? fail('usage: npm run audit -- --target <id>');
const adapter = ADAPTERS[id] ?? fail(`no adapter for target ${id} (see src/adapters/index.ts)`);
if (adapter.mode !== 'auto-chat') fail(`${id} is ${adapter.mode}: only auto-chat runs here`);
const engines = { chromium, firefox, webkit };
const names = values.browser === 'all' ? Object.keys(engines) : [values.browser as string];
for (const n of names) if (!(n in engines)) fail(`unknown browser ${n}`);
const viewports = (
  values.viewport === 'all' ? Object.keys(VIEWPORTS) : [values.viewport]
) as ViewportName[];
for (const v of viewports) if (!(v in VIEWPORTS)) fail(`unknown viewport ${v}`);

const only = values.only?.split(',');
const fixtures = allFixtures(loadFixtureFiles()).filter(
  (fx) => fx.status === 'verified' && !isStale(fx) && (!only || only.includes(fx.id)),
);
if (only && fixtures.length !== only.length)
  fail(`not all of --only are verified fixtures: ${only}`);
const mock = await fetch('http://127.0.0.1:11435/v1/models').catch(() => null);
if (!mock?.ok) fail('the mock LLM is not running: start `npm run mock-llm` first');

// The image the target's compose file runs, with its digest, for env.json.
const composeFile = `audit/targets/${id}/compose.yaml`;
const images = Object.values(
  (parse(readFileSync(composeFile, 'utf8')) as { services: Record<string, { image: string }> })
    .services,
).map((s) => s.image);
const digest = (image: string) => {
  try {
    return run('docker', ['image', 'inspect', '--format', '{{index .RepoDigests 0}}', image]);
  } catch {
    return null;
  }
};

let container: string | null = null;
const browsers: Record<string, Browser> = {};
try {
  if (values.local) {
    for (const n of names) browsers[n] = await engines[n as keyof typeof engines].launch();
  } else {
    // pwuser, not root: these pages come from third-party UIs (see the Dockerfile note).
    container = run('docker', [
      ...['run', '-d', '--rm', '--init', '--ipc=host', '--user', 'pwuser'],
      ...['-p', `127.0.0.1:${PORT}:${PORT}`, '--add-host', 'host.docker.internal:host-gateway'],
      ...[IMAGE, 'npx', 'playwright', 'run-server', '--port', String(PORT), '--host', '0.0.0.0'],
    ]);
    process.env.TARGET_HOST = 'host.docker.internal';
    for (const n of names) {
      const engine = engines[n as keyof typeof engines];
      // The server needs a few seconds to start.
      for (let tries = 0; !browsers[n]; tries++) {
        try {
          browsers[n] = await engine.connect(`ws://127.0.0.1:${PORT}/`);
        } catch (e) {
          if (tries > 30) throw e;
          await new Promise((r) => setTimeout(r, 1000));
        }
      }
    }
  }

  const date = new Date().toISOString().slice(0, 10);
  const out = `audit/runs/${date}-${id}`;
  const env = {
    date: new Date().toISOString(),
    target: {
      id,
      compose: composeFile,
      images: images.map((image) => ({ image, digest: digest(image) })),
    },
    mode: values.local ? 'local' : `docker (${IMAGE}, playwright run-server)`,
    host: { os: `${platform()} ${release()} ${arch()}`, node: process.version },
    browsers: Object.fromEntries(Object.entries(browsers).map(([n, b]) => [n, b.version()])),
    viewports: Object.fromEntries(viewports.map((v) => [v, VIEWPORTS[v]])),
    locale: 'en-US',
    timezone: 'UTC',
    uiLanguage: 'en',
    benchCommit: run('git', ['rev-parse', 'HEAD']),
    benchDirty: run('git', ['status', '--porcelain']) !== '',
    fixtures: fixtures.length,
    surfaces: {
      run: ['message'],
      skipped: {
        input: 'no INP rule yet (rules v0)',
        stream: 'no STRM rule yet (rules v0)',
        title: 'adapters have no title locator yet',
      },
    },
  };
  rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });
  writeFileSync(`${out}/env.json`, `${JSON.stringify(env, null, 2)}\n`);

  const started = Date.now();
  const lines = await runAudit({ adapter, browsers, viewports, fixtures, out, log: console.log });
  console.log(
    `\n${id}: ${fixtures.length} fixtures, ${Math.round((Date.now() - started) / 1000)} s`,
  );
  console.log(summarize(lines));
  console.log(`\nwrote ${out}/ (results.jsonl, evidence/; raw/ stays local)`);
} finally {
  for (const b of Object.values(browsers)) await b.close().catch(() => {});
  if (container) spawnSync('docker', ['stop', container], { stdio: 'ignore' });
}
