// Applies one review decision to a fixture file. Only the review tool calls this, on
// Yousef's keypress (CLAUDE.md rule 1). It replaces just the `status` and `verification`
// values in the source text, so the rest of the file stays byte-identical in the diff.
import { isMap, isScalar, isSeq, parseDocument } from 'yaml';
import { type Fixture, fixtureHash, validateFixtures } from '../corpus/validate.ts';

export type Decision = 'approve' | 'needs-fix' | 'reject';

export interface LogEntry {
  id: string;
  decision: Decision;
  note: string;
  by: string;
  at: string;
  hash: string;
}

const quote = (s: string) => `'${s.replaceAll("'", "''")}'`;

/** Returns the new file text (unchanged for needs-fix) and the review-log entry to append. */
export function applyDecision(
  path: string,
  yamlText: string,
  id: string,
  decision: Decision,
  note: string,
  by: string,
  at: string,
): { yamlText: string; log: LogEntry } {
  const doc = parseDocument(yamlText);
  const fixtures = doc.toJS() as Fixture[];
  const errors = validateFixtures([{ path, fixtures }]);
  if (errors.length) throw new Error(`fix the file first:\n${errors.join('\n')}`);

  const index = fixtures.findIndex((f) => f.id === id);
  const fx = fixtures[index];
  if (!fx) throw new Error(`${id} is not in ${path}`);
  if (fx.status !== 'draft') throw new Error(`${id} is ${fx.status}, not a draft`);
  if (!by.trim()) throw new Error('reviewer name is empty: set git config user.name');

  const hash = fixtureHash(fx);
  const log = { id, decision, note, by, at, hash };
  if (decision === 'needs-fix') return { yamlText, log };

  const map = isSeq(doc.contents) ? doc.contents.items[index] : null;
  if (!isMap(map)) throw new Error(`${id}: unexpected YAML shape`);
  const range = (key: string) => {
    const value = map.items.find((p) => isScalar(p.key) && p.key.value === key)?.value;
    if (!isScalar(value) || !value.range) throw new Error(`${id}: cannot locate ${key}`);
    return value.range;
  };
  const edits = [
    { range: range('status'), text: decision === 'approve' ? 'verified' : 'rejected' },
    { range: range('verification'), text: `{ by: ${quote(by)}, at: '${at}', hash: '${hash}' }` },
  ].sort((a, b) => b.range[0] - a.range[0]);

  let out = yamlText;
  for (const {
    range: [start, end],
    text,
  } of edits)
    out = out.slice(0, start) + text + out.slice(end);
  return { yamlText: out, log };
}
