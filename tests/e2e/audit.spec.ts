import { existsSync, readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import type { Adapter } from '../../src/adapters/adapter.ts';
import { type ResultLine, runAudit, summarize } from '../../src/audit/run.ts';
import { allFixtures, loadFixtureFiles } from '../../src/corpus/load.ts';
import { escapeHtml } from '../../src/render/reference.ts';

// The runner with a fake auto-chat adapter: a page that shows each fixture with the given dir.
const fake = (dir: string, broken = false): Adapter => ({
  id: 'fake',
  mode: 'auto-chat',
  url: () => 'about:blank',
  async open() {},
  async send(page, fx) {
    if (broken) throw new Error('reply container not found\nstack');
    await page.setContent(`<div class="reply" dir="${dir}"><p>${escapeHtml(fx.text)}</p></div>`);
    return page.locator('.reply');
  },
});

const fixtures = allFixtures(loadFixtureFiles()).filter((f) =>
  ['he-bd-001', 'ar-bd-001'].includes(f.id),
);

test('the runner writes one line per rule, evidence for failures, and keeps going on errors', async ({
  browser,
  browserName,
}, info) => {
  const run = async (adapter: Adapter, name: string) => {
    const out = info.outputPath(name);
    const lines = await runAudit({
      adapter,
      browsers: { [browserName]: browser },
      viewports: ['desktop'],
      fixtures,
      out,
    });
    const written = readFileSync(`${out}/results.jsonl`, 'utf8')
      .trim()
      .split('\n')
      .map((l) => JSON.parse(l) as ResultLine);
    expect(written).toEqual(lines);
    return { out, lines };
  };

  const good = await run(fake('rtl'), 'good');
  const bd = good.lines.filter((l) => l.rule === 'BD');
  expect(bd.map((l) => [l.fixture, l.status])).toEqual([
    ['ar-bd-001', 'pass'],
    ['he-bd-001', 'pass'],
  ]);
  expect(good.lines.every((l) => l.surface === 'message' && l.viewport === 'desktop')).toBe(true);
  expect(good.lines.some((l) => l.status === 'fail')).toBe(false);

  const bad = await run(fake('ltr'), 'bad');
  const fails = bad.lines.filter((l) => l.status === 'fail');
  expect(fails.map((l) => l.rule)).toContain('BD');
  for (const l of fails) {
    expect(l.evidence.screenshot).toBe(`evidence/${l.fixture}-${browserName}-desktop.png`);
    expect(existsSync(`${bad.out}/${l.evidence.screenshot}`)).toBe(true);
  }
  expect(summarize(bad.lines)).toMatch(/^BD\s+0\s+2\s+0\s+0$/m);

  const broken = await run(fake('rtl', true), 'broken');
  expect(broken.lines).toHaveLength(2);
  expect(broken.lines[0]).toMatchObject({
    rule: null,
    status: 'error',
    evidence: { detail: 'reply container not found' },
  });
});
