// npm run corpus:validate — checks every corpus/fixtures/<lang>/*.yaml against FIXTURE_SPEC §4.
import { readdirSync, readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { type FixtureFile, validateFixtures } from '../corpus/validate.ts';

const root = 'corpus/fixtures';
const files: FixtureFile[] = readdirSync(root, { recursive: true, encoding: 'utf8' })
  .map((p) => p.replaceAll('\\', '/'))
  .filter((p) => /\.ya?ml$/.test(p))
  .sort()
  .map((p) => ({
    path: `${root}/${p}`,
    fixtures: parse(readFileSync(`${root}/${p}`, 'utf8')),
  }));

const errors = validateFixtures(files);
const count = files.reduce((n, f) => n + (Array.isArray(f.fixtures) ? f.fixtures.length : 0), 0);
if (errors.length) {
  for (const e of errors) console.error(e);
  console.error(`\n${errors.length} problem(s) in ${count} fixtures.`);
  process.exitCode = 1;
} else {
  console.log(`${count} fixtures valid in ${files.length} files.`);
}
