// Summarises out/<browser>/*.json into results/fitlocale-0.5.0.json and a console table.
// "differsFromGolden": the page's measured visual order or alignment side differs from the
// golden page (correct markup) in the same engine, i.e. a bidi break is present on the page.
// Our raw visual-order strings stay in out/ (not committed) so nothing reads as reversed text.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';

const browsers = ['chromium', 'firefox', 'webkit'];
const runs = browsers.flatMap((b) =>
  readdirSync(`out/${b}`).map((f) => JSON.parse(readFileSync(`out/${b}/${f}`, 'utf8'))),
);
const get = (b, file) => runs.find((r) => r.browser === b && r.file === file);
const shape = (r) => JSON.stringify(r.probe?.lines.map((l) => [l.visual, l.side]));
const issues = (r) =>
  r.issues.map(({ rule, severity, mode, text, visual }) => ({
    rule,
    severity,
    mode,
    text,
    visual,
  }));

const pages = [];
for (const r of runs.filter((r) => r.browser === 'chromium')) {
  const perBrowser = {};
  for (const b of browsers) {
    const run = get(b, r.file);
    const golden = r.kind === 'message' ? get(b, `${r.fixture}.golden.html`) : null;
    perBrowser[b] = {
      differsFromGolden: golden && r.variant !== 'golden' ? shape(run) !== shape(golden) : null,
      issues: issues(run),
    };
  }
  const { file, kind, fixture, category, lang, variant } = r;
  pages.push({ file, kind, fixture, category, lang, variant, perBrowser });
}
pages.sort((a, b) => a.file.localeCompare(b.file));
writeFileSync(
  'results/fitlocale-0.5.0.json',
  `${JSON.stringify({ fitlocale: '0.5.0', playwright: '1.64.1', date: '2026-10-22', pages }, null, 1)}\n`,
);

for (const p of pages) {
  const cells = browsers.map((b) => {
    const c = p.perBrowser[b];
    const d = c.differsFromGolden === null ? '·' : c.differsFromGolden ? 'DIFF' : 'same';
    return `${b[0]}:${d} ${[...new Set(c.issues.map((i) => i.rule))].join(',') || '-'}`;
  });
  console.log(`${p.file.padEnd(28)} ${cells.join(' | ')}`);
}
