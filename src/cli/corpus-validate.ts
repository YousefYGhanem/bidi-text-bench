// npm run corpus:validate — checks every corpus/fixtures/<lang>/*.yaml against FIXTURE_SPEC §4.
import { allFixtures, loadFixtureFiles } from '../corpus/load.ts';
import { validateFixtures } from '../corpus/validate.ts';

const files = loadFixtureFiles();
const errors = validateFixtures(files);
const count = allFixtures(files).length;
if (errors.length) {
  for (const e of errors) console.error(e);
  console.error(`\n${errors.length} problem(s) in ${count} fixtures.`);
  process.exitCode = 1;
} else {
  console.log(`${count} fixtures valid in ${files.length} files.`);
}
