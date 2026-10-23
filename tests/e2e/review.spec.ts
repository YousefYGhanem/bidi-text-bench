import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { allFixtures, loadFixtureFiles } from '../../src/corpus/load.ts';
import { validateFixtures } from '../../src/corpus/validate.ts';
import { startReviewServer } from '../../src/review/server.ts';

// Always a temp copy: the real corpus is only ever changed by Yousef.
let root: string;
let close: () => void;
let url: string;

test.beforeEach(async () => {
  root = mkdtempSync(join(tmpdir(), 'review-')).replaceAll('\\', '/');
  cpSync('corpus/fixtures', `${root}/corpus/fixtures`, { recursive: true });
  ({ url, close } = await startReviewServer({ root, port: 0, reviewer: 'E2E Reviewer' }));
});

test.afterEach(() => {
  close();
  rmSync(root, { recursive: true, force: true });
});

const fixtures = () => {
  const files = loadFixtureFiles(`${root}/corpus/fixtures`);
  expect(validateFixtures(files)).toEqual([]);
  return allFixtures(files);
};

test('keyboard decisions are written to the YAML and the review log', async ({ page }) => {
  await page.goto(url);
  await expect(page.locator('#position')).toHaveText('1 / 11');
  await expect(page.locator('#render .fx')).toHaveAttribute('dir', 'rtl');
  const first = await page.locator('#render .fx').getAttribute('id');

  await page.keyboard.press('n');
  await page.keyboard.type('reads fine');
  await page.keyboard.press('Escape');
  await page.keyboard.press('a');
  await expect(page.locator('#status')).toHaveText(`${first}: approve recorded.`);
  await expect(page.locator('#position')).toHaveText('1 / 10');

  const second = await page.locator('#render .fx').getAttribute('id');
  await page.keyboard.press('f');
  await expect(page.locator('#status')).toHaveText(`${second}: needs-fix recorded.`);
  const third = await page.locator('#render .fx').getAttribute('id');
  await page.keyboard.press('x');
  await expect(page.locator('#status')).toHaveText(`${third}: reject recorded.`);

  const byId = new Map(fixtures().map((f) => [f.id, f]));
  expect(byId.get(first as string)?.status).toBe('verified');
  expect(byId.get(first as string)?.verification?.by).toBe('E2E Reviewer');
  expect(byId.get(second as string)?.status).toBe('draft');
  expect(byId.get(third as string)?.status).toBe('rejected');

  const log = readFileSync(`${root}/corpus/review-log.jsonl`, 'utf8')
    .trim()
    .split('\n')
    .map((l) => JSON.parse(l));
  expect(log.map((e) => [e.id, e.decision, e.note])).toEqual([
    [first, 'approve', 'reads fine'],
    [second, 'needs-fix', ''],
    [third, 'reject', ''],
  ]);
});

test('the API refuses requests without the page token', async ({ request }) => {
  const res = await request.post(`${url}api/decision`, {
    data: { id: 'ar-bd-001', decision: 'approve' },
  });
  expect(res.status()).toBe(403);
  expect(existsSync(`${root}/corpus/review-log.jsonl`)).toBe(false);
});

test('logical text shows every code point in typed order', async ({ page }) => {
  await page.goto(url);
  const id = await page.locator('#render .fx').getAttribute('id');
  const text = fixtures().find((f) => f.id === id)?.text ?? '';
  await expect(page.locator('#chips .chip')).toHaveCount([...text].length);
});
