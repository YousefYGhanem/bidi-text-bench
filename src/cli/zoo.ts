// npm run zoo [-- --browser chromium|firefox|webkit|all] [--rule BD]: rebuilds zoo/bugs/*.html, then prints
// recall and false positives per rule. Exits 1 unless every rule has 100% recall and 0 false positives.
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { chromium, firefox, webkit } from '@playwright/test';
import { evaluateZoo, ZOO_DIR, zooFiles, zooPassed, zooTable } from '../zoo/zoo.ts';

const { values } = parseArgs({
  options: { browser: { type: 'string', default: 'chromium' }, rule: { type: 'string' } },
});
const engines = { chromium, firefox, webkit };
const names = values.browser === 'all' ? Object.keys(engines) : [values.browser];

rmSync(ZOO_DIR, { recursive: true, force: true });
mkdirSync(ZOO_DIR, { recursive: true });
for (const [name, html] of zooFiles()) writeFileSync(`${ZOO_DIR}/${name}`, html);

let ok = true;
for (const name of names) {
  const engine = engines[name as keyof typeof engines];
  if (!engine) throw new Error(`unknown browser ${name}`);
  const browser = await engine.launch();
  const all = await evaluateZoo(await browser.newPage({ viewport: { width: 1280, height: 800 } }));
  await browser.close();
  const rows = values.rule ? all.filter((r) => r.rule === values.rule) : all;
  console.log(`${zooTable(rows, name)}\n`);
  ok &&= zooPassed(rows);
}
process.exitCode = ok ? 0 : 1;
