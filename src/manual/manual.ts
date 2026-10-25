// The manual protocol for closed products (docs/AUDIT_PROTOCOL.md §4): which fixtures, which
// checks, and the result lines, in the same format as automated runs.
import type { ResultLine } from '../audit/run.ts';
import type { Fixture } from '../corpus/validate.ts';

export const PROMPT = 'Repeat the following text exactly, with no changes and no extra words:';

/** A deterministic PRNG (mulberry32) seeded from a string, so a target always gets the same set. */
function random(seed: string): () => number {
  let a = [...seed].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619), 2166136261) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** `count` fixtures, round robin over category × language groups, shuffled within each group. */
export function pickStratified(fixtures: Fixture[], count: number, seed: string): Fixture[] {
  const rnd = random(seed);
  const groups = new Map<string, Fixture[]>();
  for (const fx of fixtures) {
    const key = `${fx.category}/${fx.lang}`;
    groups.set(key, [...(groups.get(key) ?? []), fx]);
  }
  const queues = [...groups.keys()].sort().map((k) => {
    const g = [...(groups.get(k) ?? [])];
    for (let i = g.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [g[i], g[j]] = [g[j] as Fixture, g[i] as Fixture];
    }
    return g;
  });
  const out: Fixture[] = [];
  while (out.length < count && queues.some((q) => q.length))
    for (const q of queues) {
      const fx = q.shift();
      if (fx && out.length < count) out.push(fx);
    }
  return out;
}

export interface Check {
  surface: 'message' | 'input';
  rule: string;
}

/** The fixture's own category plus BD and AL on the reply, and INP on the compose box. */
export const checksFor = (fx: Fixture): Check[] => [
  ...[...new Set([fx.category, 'BD', 'AL'])].map((rule): Check => ({ surface: 'message', rule })),
  { surface: 'input', rule: 'INP' },
];

export interface ManualSave {
  /** `<surface>:<rule>` → status */
  statuses: Record<string, 'pass' | 'fail' | 'na'>;
  note: string;
  contentChanged: boolean;
  /** Which screenshots exist, relative to the run folder. */
  screenshots: { input?: string; reply?: string };
}

export function manualLines(
  fx: Fixture,
  target: string,
  browser: string,
  s: ManualSave,
): ResultLine[] {
  const base = {
    fixture: fx.id,
    target,
    browser,
    viewport: 'manual' as const,
    severity: fx.severity,
  };
  if (s.contentChanged)
    return [
      {
        ...base,
        surface: 'message',
        rule: null,
        status: 'error',
        evidence: {
          detail: `content changed${s.note ? `: ${s.note}` : ''}`,
          screenshot: s.screenshots.reply,
        },
      },
    ];
  return checksFor(fx).map((c) => {
    const status = s.statuses[`${c.surface}:${c.rule}`];
    if (!status) throw new Error(`no status for ${c.surface} ${c.rule}`);
    const screenshot = c.surface === 'input' ? s.screenshots.input : s.screenshots.reply;
    return {
      ...base,
      surface: c.surface,
      rule: c.rule,
      status,
      evidence: { detail: s.note, ...(screenshot ? { screenshot } : {}) },
    };
  });
}
