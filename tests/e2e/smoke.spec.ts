import { expect, test } from '@playwright/test';

// Smoke test of the browser setup: an RTL paragraph must lay out right-to-left in every engine.
for (const [lang, word] of [
  ['ar', 'مرحبا'],
  ['he', 'שלום'],
] as const) {
  test(`${lang}: an RTL paragraph puts a trailing Latin word on the left`, async ({ page }) => {
    await page.setContent(
      `<p dir="rtl" lang="${lang}"><span id="rtl">${word}</span> <span id="ltr">Python</span></p>`,
    );
    await expect(page.locator('p')).toHaveCSS('direction', 'rtl');
    const [rtlX, ltrX] = await page.evaluate(() =>
      ['rtl', 'ltr'].map((id) => document.getElementById(id)?.getBoundingClientRect().x ?? NaN),
    );
    expect(ltrX).toBeLessThan(rtlX as number);
  });
}
