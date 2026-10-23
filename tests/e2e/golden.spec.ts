import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { expect, test } from '@playwright/test';
import { allFixtures, loadFixtureFiles } from '../../src/corpus/load.ts';

const fixtures = allFixtures(loadFixtureFiles());

test.beforeEach(async ({ page }) => {
  await page.goto(pathToFileURL(resolve('zoo/golden.html')).href);
});

test('every fixture is laid out in its expected base direction', async ({ page }) => {
  for (const fx of fixtures) {
    await expect(page.locator(`[id="${fx.id}"]`)).toHaveCSS('direction', fx.base_direction);
  }
});

test('code blocks are LTR', async ({ page }) => {
  for (const pre of await page.locator('pre').all())
    await expect(pre).toHaveCSS('direction', 'ltr');
});

// The property ISO and CODE rest on: inside an isolated LTR unit, characters run left to right.
test('characters inside code and bdi are drawn left to right', async ({ page }) => {
  const backwards = await page.evaluate(() => {
    const bad: string[] = [];
    for (const el of document.querySelectorAll('.fx code, .fx bdi')) {
      const range = document.createRange();
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      const chars: { x: number; top: number }[] = [];
      for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        for (let i = 0; i < (n.nodeValue ?? '').length; i++) {
          range.setStart(n, i);
          range.setEnd(n, i + 1);
          const r = range.getClientRects()[0];
          if (r && r.width > 0) chars.push({ x: r.left, top: r.top });
        }
      }
      if (
        chars.some(
          (c, i) =>
            i > 0 && Math.abs(c.top - (chars[i - 1]?.top ?? 0)) < 2 && c.x < (chars[i - 1]?.x ?? 0),
        )
      )
        bad.push(`${el.closest('.fx')?.id}: ${el.textContent}`);
    }
    return bad;
  });
  expect(backwards).toEqual([]);
});
