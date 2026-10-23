// npm run review [-- --port 4321 --root <dir>] — the local fixture review tool (FIXTURE_SPEC §5).
import { execFileSync } from 'node:child_process';
import { parseArgs } from 'node:util';
import { startReviewServer } from '../review/server.ts';

const { values } = parseArgs({
  options: { port: { type: 'string', default: '4321' }, root: { type: 'string', default: '.' } },
});
const reviewer = execFileSync('git', ['config', 'user.name'], { encoding: 'utf8' }).trim();
if (!reviewer)
  throw new Error('git config user.name is empty: verification records need your name');

const { url } = await startReviewServer({ root: values.root, port: Number(values.port), reviewer });
console.log(`Reviewing as ${reviewer}: open ${url}  (Ctrl+C to stop)`);
