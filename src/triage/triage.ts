// Triage (docs/AUDIT_PROTOCOL.md §5): every failure of a run, grouped so that one decision covers
// the same fixture, surface and rule across browsers and viewports. Decisions are appended to
// <run>/triage.jsonl; the latest one for a key wins, and results.jsonl is never edited.
import { appendFileSync, existsSync, readdirSync, readFileSync } from 'node:fs';
import type { ResultLine } from '../audit/run.ts';

export const LABELS = ['confirmed', 'false-positive', 'duplicate', 'wont-report'] as const;
export const CAUSES = [
  'base-direction',
  'isolation',
  'code-direction',
  'physical-css',
  'font',
  'input',
  'streaming',
  'author',
  'other',
] as const;
export const SEVERITIES = ['blocker', 'major', 'minor'] as const;

export interface Decision {
  key: string;
  label: (typeof LABELS)[number];
  cause: (typeof CAUSES)[number];
  severity: (typeof SEVERITIES)[number];
  /** The existing issue (duplicate) or the reason (won't report). */
  link: string;
  note: string;
  at: string;
}

export interface TriageItem {
  run: string;
  key: string;
  fixture: string;
  surface: ResultLine['surface'];
  rule: string | null;
  severity: ResultLine['severity'];
  members: ResultLine[];
  decision: Decision | null;
}

const readJsonl = <T>(path: string): T[] =>
  existsSync(path)
    ? readFileSync(path, 'utf8')
        .split('\n')
        .filter(Boolean)
        .map((l) => JSON.parse(l) as T)
    : [];

export const itemKey = (l: Pick<ResultLine, 'fixture' | 'surface' | 'rule'>) =>
  `${l.fixture}|${l.surface}|${l.rule ?? 'ERROR'}`;

/** Every run folder (one with a results.jsonl) under the given roots. */
export function findRuns(roots = ['audit/runs', 'audit/manual']): string[] {
  return roots.flatMap((root) =>
    existsSync(root)
      ? readdirSync(root, { withFileTypes: true })
          .filter((d) => d.isDirectory() && existsSync(`${root}/${d.name}/results.jsonl`))
          .map((d) => `${root}/${d.name}`)
          .sort()
      : [],
  );
}

export function triageItems(run: string): TriageItem[] {
  const decisions = new Map<string, Decision>();
  for (const d of readJsonl<Decision>(`${run}/triage.jsonl`)) decisions.set(d.key, d);
  const items = new Map<string, TriageItem>();
  for (const l of readJsonl<ResultLine>(`${run}/results.jsonl`)) {
    if (l.status !== 'fail' && l.status !== 'error') continue;
    const key = itemKey(l);
    const item = items.get(key) ?? {
      run,
      key,
      fixture: l.fixture,
      surface: l.surface,
      rule: l.rule,
      severity: l.severity,
      members: [],
      decision: decisions.get(key) ?? null,
    };
    item.members.push(l);
    items.set(key, item);
  }
  return [...items.values()];
}

/** Validates a decision from the page and appends it to the run's triage.jsonl. */
export function recordDecision(run: string, body: Record<string, unknown>, at: string): Decision {
  const pick = <T extends string>(field: string, allowed: readonly T[]): T => {
    const v = body[field];
    if (typeof v !== 'string' || !allowed.includes(v as T)) throw new Error(`invalid ${field}`);
    return v as T;
  };
  const text = (field: string) =>
    typeof body[field] === 'string' ? (body[field] as string).trim() : '';
  const key = text('key');
  if (!triageItems(run).some((i) => i.key === key)) throw new Error(`no failure ${key} in ${run}`);
  const d: Decision = {
    key,
    label: pick('label', LABELS),
    cause: pick('cause', CAUSES),
    severity: pick('severity', SEVERITIES),
    link: text('link'),
    note: text('note'),
    at,
  };
  if ((d.label === 'duplicate' || d.label === 'wont-report') && !d.link)
    throw new Error(
      d.label === 'duplicate'
        ? 'a duplicate needs the existing issue'
        : "won't report needs a reason",
    );
  appendFileSync(`${run}/triage.jsonl`, `${JSON.stringify(d)}\n`);
  return d;
}
