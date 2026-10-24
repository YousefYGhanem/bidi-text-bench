import { expect, type Page, test } from '@playwright/test';
import { allFixtures, loadFixtureFiles } from '../../src/corpus/load.ts';
import type { Fixture } from '../../src/corpus/validate.ts';
import { probe } from '../../src/probe/probe.ts';
import { REFERENCE_CSS, renderFixture } from '../../src/render/reference.ts';
import { type RuleId, runRules } from '../../src/rules/rules.ts';

const fixtures = allFixtures(loadFixtureFiles());
const fx = (id: string) => fixtures.find((f) => f.id === id) as Fixture;

/** Renders one fixture (optionally broken by `mutate`) and runs every rule on it. */
async function check(page: Page, f: Fixture, mutate = (html: string) => html, css = '') {
  await page.setContent(
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><style>${REFERENCE_CSS}${css}</style></head><body>${mutate(renderFixture(f))}</body></html>`,
  );
  const results = runRules(f, await probe(page.locator('.fx')));
  return Object.fromEntries(results.map((r) => [r.rule, r])) as Record<
    RuleId,
    (typeof results)[number]
  >;
}

test('golden renders of every verified fixture raise no failure', async ({ page }) => {
  const failures: string[] = [];
  for (const f of fixtures.filter((x) => x.status === 'verified')) {
    for (const r of Object.values(await check(page, f)))
      if (r.status === 'fail') failures.push(`${f.id} ${r.rule}: ${r.evidence.detail}`);
  }
  expect(failures).toEqual([]);
});

test('BD fails when the paragraph has no dir, or picks LTR by first strong character', async ({
  page,
}) => {
  const f = fx('he-bd-001');
  expect((await check(page, f)).BD.status).toBe('pass');
  expect((await check(page, f, (h) => h.replace(' dir="rtl"', ''))).BD.status).toBe('fail');
  expect((await check(page, f, (h) => h.replace(' dir="rtl"', ' dir="auto"'))).BD.status).toBe(
    'fail',
  );
});

test('AL fails when RTL text is left-aligned', async ({ page }) => {
  const r = await check(page, fx('he-al-001'), (h) => h, '.fx { text-align: left; }');
  expect(r.AL.status).toBe('fail');
  expect(r.BD.status).toBe('pass');
});

test('ISO and CODE fail when inline code is not isolated and inherits RTL', async ({ page }) => {
  const r = await check(
    page,
    fx('ar-iso-001'),
    (h) => h,
    '.fx code { direction: inherit; unicode-bidi: normal; }',
  );
  expect(r.ISO.status).toBe('fail');
  expect(r.CODE.status).toBe('fail');
});

test('NP fails when an RTL question is laid out LTR', async ({ page }) => {
  const r = await check(page, fx('he-np-001'), (h) => h.replace(' dir="rtl"', ' dir="ltr"'));
  expect(r.NP.status).toBe('fail');
});

test('NUM fails when digits are visually reversed', async ({ page }) => {
  const r = await check(page, fx('he-num-001'), (h) => h, '.fx p { unicode-bidi: bidi-override; }');
  expect(r.NUM.status).toBe('fail');
});

test('CODE fails when a code block inherits RTL and is right-aligned', async ({ page }) => {
  const r = await check(
    page,
    fx('ar-code-001'),
    (h) => h,
    '.fx pre { direction: rtl; text-align: right; }',
  );
  expect(r.CODE.status).toBe('fail');
});

test('LIST fails when an RTL list is laid out LTR', async ({ page }) => {
  const r = await check(page, fx('he-list-001'), (h) => h.replace('<ol>', '<ol dir="ltr">'));
  expect(r.LIST.status).toBe('fail');
});

test('LIST fails when a quote bar stays on the left in RTL', async ({ page }) => {
  const f = fx('ar-list-003');
  expect((await check(page, f)).LIST.status).toBe('pass');
  const r = await check(
    page,
    f,
    (h) => h,
    '.fx blockquote { border-inline-start: 0; border-left: 3px solid #999; }',
  );
  expect(r.LIST.status).toBe('fail');
});

test('TBL fails when an RTL table keeps LTR column order', async ({ page }) => {
  const f = fx('ar-tbl-001');
  expect((await check(page, f)).TBL.status).toBe('pass');
  expect((await check(page, f, (h) => h.replace('<table>', '<table dir="ltr">'))).TBL.status).toBe(
    'fail',
  );
});

test('TRUNC fails when an RTL title is cut at the wrong end', async ({ page }) => {
  const f = fx('he-trunc-001');
  const title =
    '.fx { width: 140px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }';
  expect((await check(page, f, (h) => h, title)).TRUNC.status).toBe('pass');
  expect(
    (await check(page, f, (h) => h.replace(' dir="rtl"', ' dir="ltr"'), title)).TRUNC.status,
  ).toBe('fail');
});

test('FONT fails on a missing glyph and passes on real Arabic and Hebrew', async ({ page }) => {
  expect((await check(page, fx('ar-font-001'))).FONT.status).toBe('pass');
  const tofu = { ...fx('he-font-001'), text: `${fx('he-font-001').text} ` };
  expect((await check(page, tofu)).FONT.status).toBe('fail');
});
