// Builds the zoo pages and measures recall and false positives per rule (docs/CHECKER_SPEC.md §8).
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { Page } from '@playwright/test';
import { allFixtures, loadFixtureFiles } from '../corpus/load.ts';
import type { Fixture } from '../corpus/validate.ts';
import { probe } from '../probe/probe.ts';
import { GOLDEN_PATH } from '../render/golden.ts';
import { escapeHtml, REFERENCE_CSS, renderFixture } from '../render/reference.ts';
import { RULES, type RuleId, runRules } from '../rules/rules.ts';
import { BUGS, type Bug, CONTROLS, type ZooPage } from './bugs.ts';

export const ZOO_DIR = 'zoo/bugs';

const fixtureById = () => new Map(allFixtures(loadFixtureFiles()).map((f) => [f.id, f]));

/** A standalone page for one zoo entry: the golden article for its fixture, broken as labelled. */
export function zooPageHtml(entry: ZooPage | Bug, fx: Fixture): string {
  const article = (entry.html ?? ((h: string) => h))(renderFixture(fx));
  const rule = 'rule' in entry ? entry.rule : 'none';
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="zoo-rule" content="${rule}">
<meta name="zoo-fixture" content="${escapeHtml(entry.fixture)}">
<title>${escapeHtml(`${entry.id}: ${entry.why}`)}</title>
<style>
${REFERENCE_CSS}
${entry.css ?? ''}
</style>
</head>
<body>
${article}
</body>
</html>
`;
}

/** Every zoo page as [file name, html], from the current corpus. */
export function zooFiles(): [string, string][] {
  const fixtures = fixtureById();
  return [...BUGS, ...CONTROLS].map((e) => {
    const fx = fixtures.get(e.fixture);
    if (!fx) throw new Error(`zoo entry ${e.id}: unknown fixture ${e.fixture}`);
    return [`${e.id}.html`, zooPageHtml(e, fx)];
  });
}

export interface ZooRow {
  rule: RuleId;
  bugs: number;
  caught: number;
  falsePositives: number;
  /** Bug ids the rule missed, and "page fixture: detail" for each false positive. */
  misses: string[];
  falses: string[];
}

const fileUrl = (path: string) => pathToFileURL(resolve(path)).href;

/** Loads the golden page, the controls and every bug page in `page`, and scores each rule. */
export async function evaluateZoo(page: Page): Promise<ZooRow[]> {
  const fixtures = fixtureById();
  const rows = new Map<RuleId, ZooRow>(
    RULES.map((rule) => [
      rule,
      { rule, bugs: 0, caught: 0, falsePositives: 0, misses: [], falses: [] },
    ]),
  );
  const row = (rule: RuleId) => rows.get(rule) as ZooRow;
  const noteFalses = (where: string, results: ReturnType<typeof runRules>) => {
    for (const r of results)
      if (r.status === 'fail') {
        row(r.rule).falsePositives++;
        row(r.rule).falses.push(`${where} ${r.fixture}: ${r.evidence.detail}`);
      }
  };

  await page.goto(fileUrl(GOLDEN_PATH));
  for (const fx of fixtures.values())
    noteFalses('golden', runRules(fx, await probe(page.locator(`[id="${fx.id}"]`))));

  for (const control of CONTROLS) {
    await page.goto(fileUrl(`${ZOO_DIR}/${control.id}.html`));
    noteFalses(
      control.id,
      runRules(fixtures.get(control.fixture) as Fixture, await probe(page.locator('.fx'))),
    );
  }

  for (const bug of BUGS) {
    await page.goto(fileUrl(`${ZOO_DIR}/${bug.id}.html`));
    const results = runRules(
      fixtures.get(bug.fixture) as Fixture,
      await probe(page.locator('.fx')),
    );
    const r = row(bug.rule);
    r.bugs++;
    noteFalses(
      bug.id,
      results.filter((x) => bug.clean?.includes(x.rule)),
    );
    if (results.find((x) => x.rule === bug.rule)?.status === 'fail') r.caught++;
    else r.misses.push(bug.id);
  }
  return [...rows.values()];
}

/** The table `npm run zoo` prints. */
export function zooTable(rows: ZooRow[], browser: string): string {
  const pct = (r: ZooRow) => (r.bugs ? `${Math.round((100 * r.caught) / r.bugs)}%` : 'n/a');
  const lines = [
    `Bug zoo (${browser})`,
    'rule   bugs  caught  recall  false positives',
    ...rows.map(
      (r) =>
        `${r.rule.padEnd(6)} ${String(r.bugs).padStart(4)} ${String(r.caught).padStart(7)} ${pct(r).padStart(7)} ${String(r.falsePositives).padStart(16)}`,
    ),
    ...rows.flatMap((r) => [
      ...r.misses.map((m) => `  MISSED ${m}`),
      ...r.falses.map((f) => `  FALSE ${r.rule} ${f}`),
    ]),
  ];
  return lines.join('\n');
}

export const zooPassed = (rows: ZooRow[]) =>
  rows.every((r) => r.caught === r.bugs && r.falsePositives === 0) && rows.every((r) => r.bugs > 0);
