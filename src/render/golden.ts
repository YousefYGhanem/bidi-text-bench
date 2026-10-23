import { allFixtures, loadFixtureFiles } from '../corpus/load.ts';
import { validateFixtures } from '../corpus/validate.ts';
import { renderPage } from './reference.ts';

export const GOLDEN_PATH = 'zoo/golden.html';

/** The golden page: every fixture in the corpus, rendered with correct markup. */
export function goldenHtml(): string {
  const files = loadFixtureFiles();
  const errors = validateFixtures(files);
  if (errors.length)
    throw new Error(`corpus is invalid; run npm run corpus:validate\n${errors.join('\n')}`);
  return renderPage(allFixtures(files), 'bidi-text-bench golden page');
}
