// npm run manual -- --target <id> [--count 30] [--resume audit/manual/<dir>] [--port 4322]
// The local helper for the manual protocol (docs/AUDIT_PROTOCOL.md §4). Closed products only.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { parse } from 'yaml';
import { allFixtures, loadFixtureFiles } from '../corpus/load.ts';
import { isStale } from '../corpus/validate.ts';
import { pickStratified } from '../manual/manual.ts';
import { startManualServer } from '../manual/server.ts';

const { values } = parseArgs({
  options: {
    target: { type: 'string' },
    count: { type: 'string', default: '30' },
    resume: { type: 'string' },
    port: { type: 'string', default: '4322' },
  },
});
const targets = parse(readFileSync('audit/targets.yaml', 'utf8')) as {
  id: string;
  name: string;
  mode: string;
}[];
const target = targets.find((t) => t.id === values.target);
if (!target)
  throw new Error(`usage: npm run manual -- --target <id> (a manual target in audit/targets.yaml)`);
if (target.mode !== 'manual') throw new Error(`${target.id} is ${target.mode}: use npm run audit`);

const verified = allFixtures(loadFixtureFiles()).filter(
  (fx) => fx.status === 'verified' && !isStale(fx),
);
// One fixed seed: every manual product gets the same fixtures, so their results compare.
const fixtures = pickStratified(verified, Number(values.count), 'manual-v1');
const dir = values.resume ?? `audit/manual/${new Date().toISOString().slice(0, 10)}-${target.id}`;
const benchCommit = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();

const { url } = await startManualServer({
  target,
  fixtures,
  dir,
  benchCommit,
  port: Number(values.port),
});
console.log(`${target.name}: ${fixtures.length} fixtures, saving to ${dir}/`);
console.log(`open ${url}  (Ctrl+C to stop; --resume ${dir} continues later)`);
