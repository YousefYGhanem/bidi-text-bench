// npm run corpus:validate — checks every corpus/fixtures/<lang>/*.yaml against FIXTURE_SPEC §4.
import { allFixtures, loadFixtureFiles } from '../corpus/load.ts';
import { openQuestions, validateFixtures } from '../corpus/validate.ts';

const files = loadFixtureFiles();
const errors = validateFixtures(files);
const fixtures = allFixtures(files);
if (errors.length) {
  for (const e of errors) console.error(e);
  console.error(`\n${errors.length} problem(s) in ${fixtures.length} fixtures.`);
  process.exitCode = 1;
} else {
  console.log(`${fixtures.length} fixtures valid in ${files.length} files.`);
  const open = openQuestions(fixtures);
  if (open.length)
    console.warn(
      `warning: ${open.length} verified fixture(s) still ask NEEDS-YOUSEF: ${open.map((f) => f.id).join(', ')}`,
    );
}
