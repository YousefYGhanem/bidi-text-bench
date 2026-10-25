import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { allFixtures, loadFixtureFiles } from '../../src/corpus/load.ts';
import { startManualServer } from '../../src/manual/server.ts';
import { startTriageServer } from '../../src/triage/server.ts';

const fixtures = allFixtures(loadFixtureFiles()).filter((f) =>
  ['he-bd-001', 'ar-iso-001'].includes(f.id),
);
// A 1×1 PNG, as a pasted screenshot would arrive.
const PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==';

test('manual helper: environment, one saved fixture with evidence, token required', async ({
  page,
}, info) => {
  const dir = info.outputPath('manual');
  const server = await startManualServer({
    target: { id: 'chatgpt-web', name: 'ChatGPT (web)' },
    fixtures,
    dir,
    benchCommit: 'abc',
    port: 0,
  });
  try {
    expect((await fetch(`${server.url}api/state`, { method: 'POST' })).status).toBe(403);
    await page.goto(server.url);
    await page.getByLabel('Product version').fill('web');
    await page.getByLabel('OS', { exact: true }).fill('Windows 11');
    await page.getByLabel('Browser and version').fill('Chrome 156');
    await page.getByLabel('Window size').fill('1280×800');
    await page.getByLabel('Product UI language').fill('English');
    await page.getByRole('button', { name: 'Save environment' }).click();
    await expect(page.locator('#facts')).toContainText(fixtures[0]?.id ?? '');
    await expect(page.locator('#prompt')).toContainText(fixtures[0]?.text ?? '');

    // Pasting needs a real clipboard; send the screenshot through the page's own API helper.
    await page.evaluate(`pasted.reply = ${JSON.stringify(PNG)}`);
    for (const rule of ['BD', 'AL']) await page.getByLabel(`${rule} fail`).check();
    for (const c of await page.locator('#checks tr').all()) {
      const pass = c.getByLabel(/ pass$/);
      if (!(await c.locator('input:checked').count())) await pass.check();
    }
    await page.getByLabel('Note').fill('laid out LTR');
    await page.getByRole('button', { name: 'Save' }).first().click();
    await expect(page.locator('#status')).toContainText('Saved');

    const env = JSON.parse(readFileSync(`${dir}/env.json`, 'utf8'));
    expect(env).toMatchObject({ target: 'chatgpt-web', browser: 'Chrome 156', benchCommit: 'abc' });
    const lines = readFileSync(`${dir}/results.jsonl`, 'utf8')
      .trim()
      .split('\n')
      .map((l) => JSON.parse(l));
    expect(
      lines
        .filter((l) => l.status === 'fail')
        .map((l) => l.rule)
        .sort(),
    ).toEqual(['AL', 'BD']);
    expect(lines.every((l) => l.fixture === fixtures[0]?.id && l.viewport === 'manual')).toBe(true);
  } finally {
    server.close();
  }
});

test('triage view: grouped failures with evidence, and a saved decision', async ({
  page,
}, info) => {
  const run = info.outputPath('runs/2026-10-25-fake').replaceAll('\\', '/');
  mkdirSync(`${run}/evidence`, { recursive: true });
  writeFileSync(
    `${run}/evidence/he-bd-001-chromium-desktop.png`,
    Buffer.from(PNG.split(',')[1] ?? '', 'base64'),
  );
  const line = (browser: string) => ({
    fixture: 'he-bd-001',
    target: 'fake',
    surface: 'message',
    browser,
    viewport: 'desktop',
    severity: 'major',
    rule: 'BD',
    status: 'fail',
    evidence: {
      detail: 'block 0 (p) is ltr, expected rtl',
      expected: 'abc',
      actual: 'cba',
      screenshot: `evidence/he-bd-001-${browser}-desktop.png`,
    },
  });
  writeFileSync(
    `${run}/results.jsonl`,
    [line('chromium'), line('webkit')].map((l) => `${JSON.stringify(l)}\n`).join(''),
  );

  const server = await startTriageServer({ runs: [run], fixtures, port: 0, now: () => 'T' });
  try {
    await page.goto(server.url);
    await expect(page.locator('#position')).toHaveText('1 of 1 · 1 untriaged');
    await expect(page.locator('.member')).toHaveCount(2);
    await expect(page.locator('.member img').first()).toHaveJSProperty('naturalWidth', 1);
    await page.getByLabel('confirmed').check();
    await page.getByLabel('Cause').selectOption('base-direction');
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.locator('#position')).toHaveText('1 of 1 · 0 untriaged');
    const d = JSON.parse(readFileSync(`${run}/triage.jsonl`, 'utf8'));
    expect(d).toEqual({
      key: 'he-bd-001|message|BD',
      label: 'confirmed',
      cause: 'base-direction',
      severity: 'major',
      link: '',
      note: '',
      at: 'T',
    });
    // Files outside the run's evidence are refused.
    expect((await fetch(`${server.url}file?t=${server.token}&path=package.json`)).status).toBe(404);
    expect(existsSync(`${run}/results.jsonl`)).toBe(true);
  } finally {
    server.close();
  }
});
