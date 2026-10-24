import { expect, type Page, test } from '@playwright/test';
import { expectedOrder, toGraphemeOrder } from '../../src/engine/bidi.ts';
import { type ProbeResult, probe } from '../../src/probe/probe.ts';

const page$ = async (page: Page, body: string) => {
  await page.setContent(
    `<!doctype html><html lang="en"><body style="font:16px/1.5 sans-serif;margin:16px">${body}</body></html>`,
  );
  return page.locator('#root');
};

/** Each line's measured order, as grapheme text left to right. */
const drawn = (r: ProbeResult) =>
  r.blocks.map((b) => b.lines.map((l) => l.visual.map((i) => r.graphemes[i]?.text).join('')));

/** The engine's order for the same blocks and lines, in the probe's grapheme indices. */
const expected = (r: ProbeResult) => {
  const graphemeOf: number[] = [];
  r.graphemes.forEach((g, i) => {
    for (let cu = g.start; cu < g.end; cu++) graphemeOf[cu] = i;
  });
  return r.blocks.map((b) => {
    const base = b.direction === 'rtl' ? 'rtl' : 'ltr';
    const { lines } = expectedOrder(r.text, base, { lines: b.lines.map((l) => l.range) });
    return lines.map((line) =>
      toGraphemeOrder(line, graphemeOf)
        .map((i) => r.graphemes[i]?.text)
        .join(''),
    );
  });
};

test('LTR text: visual order equals logical order', async ({ page }) => {
  const r = await probe(await page$(page, '<p id="root">Hello, world.</p>'));
  expect(r.text).toBe('Hello, world.');
  expect(drawn(r)).toEqual([['Hello, world.']]);
});

test('RTL paragraph with a Latin word matches the engine', async ({ page }) => {
  const r = await probe(await page$(page, '<p id="root" dir="rtl">Python לגמרי עובד, נכון?</p>'));
  expect(r.blocks[0]?.direction).toBe('rtl');
  expect(drawn(r)).toEqual(expected(r));
  // The question mark is at the far left, the Latin word at the far right.
  expect(drawn(r)[0]?.[0]?.startsWith('?')).toBe(true);
  expect(drawn(r)[0]?.[0]?.endsWith('Python')).toBe(true);
});

test('a narrow box wraps into lines, each matching the engine per line (rule L2)', async ({
  page,
}) => {
  const r = await probe(
    await page$(
      page,
      '<p id="root" dir="rtl" style="width:120px">הריצו את npm test ואז את npm run build בבקשה</p>',
    ),
  );
  expect(r.blocks[0]?.lines.length).toBeGreaterThan(1);
  expect(drawn(r)).toEqual(expected(r));
});

test('blocks are separate paragraphs with their own direction', async ({ page }) => {
  const r = await probe(
    await page$(
      page,
      '<div id="root"><p dir="rtl">שלום עולם.</p><p dir="ltr">Hello world.</p></div>',
    ),
  );
  expect(r.blocks.map((b) => [b.tag, b.direction])).toEqual([
    ['p', 'rtl'],
    ['p', 'ltr'],
  ]);
  expect(drawn(r)).toEqual(expected(r));
});

test('excluded and hidden content is left out; collapsed extra spaces have no box', async ({
  page,
}) => {
  const r = await probe(
    await page$(
      page,
      '<div id="root"><p>keep   this</p><button class="copy">Copy</button><span hidden>secret</span><span style="visibility:hidden">ghost</span></div>',
    ),
    { exclude: ['.copy'] },
  );
  const seen = r.graphemes.map((g) => g.text).join('');
  expect(seen).toBe('keep this');
  expect(r.text).not.toContain('Copy');
});

test('text in an open shadow root and its slots is probed in rendering order', async ({ page }) => {
  const root = await page$(page, '<div id="root"><span>light</span></div>');
  await page.evaluate(() => {
    const host = document.getElementById('root') as HTMLElement;
    host.attachShadow({ mode: 'open' }).innerHTML = '<b>shadow-</b><slot></slot>';
  });
  const r = await probe(root);
  expect(r.text).toBe('shadow-light');
});

test('lam-alef and tashkeel keep every grapheme, and roles are recorded', async ({ page }) => {
  const r = await probe(
    await page$(page, '<p id="root" dir="rtl" lang="ar">لا تَنسَ <code>npm test</code></p>'),
  );
  expect(r.graphemes.map((g) => g.text).join('|')).toBe('ل|ا| |تَ|ن|سَ| |n|p|m| |t|e|s|t');
  expect(r.graphemes.find((g) => g.text === 'n')?.role).toBe('code');
  expect(r.graphemes[0]?.role).toBe('p');
  expect(drawn(r)).toEqual(expected(r));
});

test('context records the dir/lang chain, alignment, clipping and form controls', async ({
  page,
}) => {
  await page$(
    page,
    '<section dir="rtl" lang="he"><div id="root" style="width:60px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-align:start">כותרת ארוכה מאוד לשיחה<textarea dir="auto"></textarea></div></section>',
  );
  const r = await probe(page.locator('#root'));
  expect(r.context.dirChain.slice(0, 2)).toEqual([
    { tag: 'div', dir: null, lang: null },
    { tag: 'section', dir: 'rtl', lang: 'he' },
  ]);
  expect(r.context.direction).toBe('rtl');
  expect(r.context.textOverflow).toBe('ellipsis');
  expect(r.context.clipped).toBe(true);
  expect(r.context.controls).toEqual([
    // Empty and dir=auto: no strong character yet, so LTR until the user types (an INP trap).
    { tag: 'textarea', dir: 'auto', direction: 'ltr', textAlign: 'start' },
  ]);
});
