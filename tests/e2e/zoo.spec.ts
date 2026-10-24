import { expect, test } from '@playwright/test';
import { evaluateZoo, zooTable } from '../../src/zoo/zoo.ts';

// CHECKER_SPEC §8: every rule catches every labelled bug and never fails on the golden page or a
// control page, in every engine and viewport.
test('bug zoo: 100% recall and 0 false positives for every rule', async ({ page }, info) => {
  const rows = await evaluateZoo(page);
  const table = zooTable(rows, info.project.name);
  for (const r of rows) {
    expect(r.bugs, `${r.rule} has no labelled bug\n${table}`).toBeGreaterThan(0);
    expect(r.misses, `${r.rule} missed bugs\n${table}`).toEqual([]);
    expect(r.falses, `${r.rule} false positives\n${table}`).toEqual([]);
  }
});
