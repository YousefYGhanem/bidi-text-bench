import { expect, test } from '@playwright/test';
import { ADAPTERS } from '../../src/adapters/index.ts';
import { allFixtures, loadFixtureFiles } from '../../src/corpus/load.ts';
import { probe } from '../../src/probe/probe.ts';
import { runRules } from '../../src/rules/rules.ts';

// Smoke test for one running target: TARGET=<id> npx playwright test targets --project=chromium.
// Needs `npm run mock-llm` and the target's compose file up, so CI skips it.
const target = process.env.TARGET;
test.skip(!target, 'set TARGET=<id> with the target and the mock LLM running');

test(`adapter ${target} sends a fixture and returns the probed reply`, async ({ page }) => {
  const adapter = ADAPTERS[target ?? ''];
  if (!adapter?.send || !adapter.input) throw new Error(`no auto-chat adapter ${target}`);
  const models = await fetch('http://127.0.0.1:11435/v1/models').catch(() => null);
  expect(models?.ok, 'the mock LLM is not running (npm run mock-llm)').toBe(true);

  const fixtures = allFixtures(loadFixtureFiles());
  await adapter.open(page);
  await expect(await adapter.input(page)).toBeVisible();
  // Two in a row: the second reply must be found after the first, not instead of it.
  for (const id of ['he-bd-001', 'ar-bd-001']) {
    const fx = fixtures.find((f) => f.id === id);
    if (!fx) throw new Error(`missing fixture ${id}`);
    const reply = await adapter.send(page, fx);
    await expect(reply).toHaveText(fx.text);
    const results = runRules(fx, await probe(reply, { exclude: adapter.exclude }));
    console.log(id, results.map((r) => `${r.rule}:${r.status}`).join(' '));
    expect(results.length).toBeGreaterThan(0);
  }
});
