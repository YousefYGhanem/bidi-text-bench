// npm run triage [-- --run <dir>] [--port 4323] [--check]
// The local triage view over every run in audit/runs/ and audit/manual/, or one run
// (docs/AUDIT_PROTOCOL.md §5). --check prints the untriaged count and exits 1 if it is not 0.
import { parseArgs } from 'node:util';
import { allFixtures, loadFixtureFiles } from '../corpus/load.ts';
import { startTriageServer } from '../triage/server.ts';
import { findRuns, triageItems } from '../triage/triage.ts';

const { values } = parseArgs({
  options: {
    run: { type: 'string' },
    port: { type: 'string', default: '4323' },
    check: { type: 'boolean', default: false },
  },
});
const runs = values.run ? [values.run.replace(/[\\/]+$/, '').replaceAll('\\', '/')] : findRuns();
if (!runs.length) throw new Error('no runs found in audit/runs or audit/manual');

const items = runs.flatMap(triageItems);
const open = items.filter((i) => !i.decision).length;
console.log(`${runs.length} run(s), ${items.length} failure group(s), ${open} untriaged`);
if (values.check) process.exit(open ? 1 : 0);

const { url } = await startTriageServer({
  runs,
  fixtures: allFixtures(loadFixtureFiles()),
  port: Number(values.port),
});
console.log(`open ${url}  (Ctrl+C to stop)`);
