import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { expect, test } from '@playwright/test';
import { allFixtures, loadFixtureFiles } from '../../src/corpus/load.ts';
import { probe } from '../../src/probe/probe.ts';
import { GOLDEN_PATH } from '../../src/render/golden.ts';
import { expectedLines } from '../../src/rules/expected.ts';

// CHECKER_SPEC §2: on the golden page, what the browser draws must equal what the engine expects,
// line by line, for every verified fixture. A mismatch is an engine or probe bug, a wrong
// expectation, or a browser bug, and must be investigated before any rule is trusted.
test('calibration: the golden page matches the engine for every verified fixture', async ({
  page,
}) => {
  await page.goto(pathToFileURL(resolve(GOLDEN_PATH)).href);
  const mismatches: string[] = [];
  let lines = 0;
  for (const fx of allFixtures(loadFixtureFiles()).filter((f) => f.status === 'verified')) {
    const p = await probe(page.locator(`[id="${fx.id}"]`));
    const show = (order: number[]) => order.map((i) => p.graphemes[i]?.text).join('');
    for (const l of expectedLines(p, fx, { golden: true })) {
      lines++;
      if (show(l.actual) !== show(l.expected))
        mismatches.push(
          `${fx.id} block ${l.block} line ${l.line}\n  drawn:    ${show(l.actual)}\n  expected: ${show(l.expected)}`,
        );
    }
  }
  expect(lines).toBeGreaterThan(80);
  expect(mismatches, mismatches.join('\n')).toEqual([]);
});

test('calibration is not vacuous: an expectation without the LTR author span mismatches', async ({
  page,
}) => {
  await page.goto(pathToFileURL(resolve(GOLDEN_PATH)).href);
  const fx = allFixtures(loadFixtureFiles()).find((f) => f.id === 'he-np-002');
  if (!fx) throw new Error('he-np-002 missing');
  const p = await probe(page.locator(`[id="${fx.id}"]`));
  const show = (order: number[]) => order.map((i) => p.graphemes[i]?.text).join('');
  const [plain] = expectedLines(p, fx); // author span left as plain text: "++C"
  expect(show(plain?.actual ?? [])).toContain('C++');
  expect(show(plain?.expected ?? [])).toContain('++C');
});
