import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { test } from 'fitlocale/playwright';

type Entry = { file: string; kind: string; fixture?: string; lang?: string; variant: string };
const pages: Entry[] = JSON.parse(readFileSync('pages/index.json', 'utf8'));

// No cloud upload, no baseline, never fail: we only record what fitlocale reports.
test.use({
  fitlocale: {
    setLocale: async () => {},
    viewports: 'current',
    baseline: false,
    failOn: 'never',
    screenshots: false,
    modes: ['pseudo-rtl'],
  },
});

// Visual order of every non-space grapheme, line by line, plus which side each line sits on.
const probe = () => {
  const root = document.querySelector('.msg');
  if (!root) return null;
  const seg = new Intl.Segmenter('und', { granularity: 'grapheme' });
  const box = root.getBoundingClientRect();
  const items: { g: string; x: number; y: number }[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const range = document.createRange();
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    for (const { segment, index } of seg.segment(n.nodeValue ?? '')) {
      if (/^\s+$/.test(segment)) continue;
      range.setStart(n, index);
      range.setEnd(n, index + segment.length);
      const r = range.getClientRects()[0];
      if (!r || r.width === 0) continue;
      items.push({ g: segment, x: r.left + r.width / 2, y: r.top + r.height / 2 });
    }
  }
  const lines: { y: number; items: typeof items }[] = [];
  for (const it of items) {
    const line = lines.find((l) => Math.abs(l.y - it.y) < 4);
    if (line) line.items.push(it);
    else lines.push({ y: it.y, items: [it] });
  }
  lines.sort((a, b) => a.y - b.y);
  return {
    direction: getComputedStyle(root).direction,
    lines: lines.map((l) => {
      const xs = l.items.map((i) => i.x);
      const side = box.right - Math.max(...xs) < Math.min(...xs) - box.left ? 'right' : 'left';
      return {
        visual: [...l.items]
          .sort((a, b) => a.x - b.x)
          .map((i) => i.g)
          .join(''),
        side,
      };
    }),
  };
};

for (const entry of pages) {
  test(entry.file, async ({ page, useLocale, localeCheck }, testInfo) => {
    await page.goto(pathToFileURL(resolve('pages', entry.file)).href);
    if (entry.lang) await useLocale(entry.lang);
    const result = await localeCheck();
    const out = resolve('out', testInfo.project.name);
    mkdirSync(out, { recursive: true });
    writeFileSync(
      resolve(out, `${entry.file}.json`),
      JSON.stringify({
        ...entry,
        browser: testInfo.project.name,
        issues: result.issues.map(({ rule, severity, mode, text, visual, selector }) => ({
          rule,
          severity,
          mode,
          text,
          visual,
          selector,
        })),
        probe: await page.evaluate(probe),
      }),
    );
  });
}
