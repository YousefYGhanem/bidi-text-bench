import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { ResultLine } from '../../src/audit/run.ts';
import { allFixtures, loadFixtureFiles } from '../../src/corpus/load.ts';
import { checksFor, manualLines, pickStratified } from '../../src/manual/manual.ts';
import { findRuns, recordDecision, reviewed, triageItems } from '../../src/triage/triage.ts';

const fixtures = allFixtures(loadFixtureFiles());

describe('pickStratified', () => {
  it('is deterministic, covers every category and language, and has no repeats', () => {
    const a = pickStratified(fixtures, 30, 'manual-v1');
    expect(a.map((f) => f.id)).toEqual(pickStratified(fixtures, 30, 'manual-v1').map((f) => f.id));
    expect(a).toHaveLength(30);
    expect(new Set(a.map((f) => f.id)).size).toBe(30);
    const groups = new Set(fixtures.map((f) => `${f.category}/${f.lang}`));
    expect(new Set(a.map((f) => `${f.category}/${f.lang}`))).toEqual(groups);
    expect(pickStratified(fixtures, 30, 'other').map((f) => f.id)).not.toEqual(a.map((f) => f.id));
  });

  it('stops at the number of fixtures available', () => {
    expect(pickStratified(fixtures.slice(0, 5), 30, 's')).toHaveLength(5);
  });
});

describe('manualLines', () => {
  const fx = fixtures.find((f) => f.id === 'he-bd-001');
  if (!fx) throw new Error('missing he-bd-001');
  const statuses = { 'message:BD': 'fail', 'message:AL': 'fail', 'input:INP': 'pass' } as const;

  it('writes one line per check, with the screenshot of its surface', () => {
    expect(checksFor(fx).map((c) => `${c.surface}:${c.rule}`)).toEqual(Object.keys(statuses));
    const lines = manualLines(fx, 'chatgpt-web', 'Chrome 156', {
      statuses,
      note: 'starts LTR',
      contentChanged: false,
      screenshots: { reply: 'evidence/he-bd-001-reply.png' },
    });
    expect(lines.map((l) => [l.surface, l.rule, l.status, l.evidence.screenshot])).toEqual([
      ['message', 'BD', 'fail', 'evidence/he-bd-001-reply.png'],
      ['message', 'AL', 'fail', 'evidence/he-bd-001-reply.png'],
      ['input', 'INP', 'pass', undefined],
    ]);
    expect(lines[0]).toMatchObject({
      viewport: 'manual',
      browser: 'Chrome 156',
      severity: fx.severity,
    });
  });

  it('records changed content as one error line, and refuses unmarked checks', () => {
    const changed = manualLines(fx, 't', 'b', {
      statuses: {},
      note: 'translated it',
      contentChanged: true,
      screenshots: {},
    });
    expect(changed).toMatchObject([
      { rule: null, status: 'error', evidence: { detail: 'content changed: translated it' } },
    ]);
    expect(() =>
      manualLines(fx, 't', 'b', {
        statuses: { 'message:BD': 'pass' },
        note: '',
        contentChanged: false,
        screenshots: {},
      }),
    ).toThrow(/no status/);
  });
});

describe('triage', () => {
  const line = (over: Partial<ResultLine>): ResultLine => ({
    fixture: 'he-bd-001',
    target: 'nextchat',
    surface: 'message',
    browser: 'chromium',
    viewport: 'desktop',
    severity: 'major',
    rule: 'BD',
    status: 'fail',
    evidence: { detail: 'ltr' },
    ...over,
  });

  it('groups a failure across browsers and viewports, skips passes, and the latest decision wins', () => {
    const root = mkdtempSync(join(tmpdir(), 'triage-'));
    const run = `${root}/runs/2026-10-25-nextchat`;
    mkdirSync(run, { recursive: true });
    const lines = [
      line({}),
      line({ browser: 'webkit' }),
      line({ viewport: 'mobile' }),
      line({ rule: 'AL' }),
      line({ rule: 'FONT', status: 'pass' }),
      line({ fixture: 'ar-bd-001', rule: null, status: 'error', evidence: { detail: 'timeout' } }),
    ];
    writeFileSync(`${run}/results.jsonl`, lines.map((l) => `${JSON.stringify(l)}\n`).join(''));
    expect(findRuns([`${root}/runs`, `${root}/missing`])).toEqual([run]);

    const items = triageItems(run);
    expect(items.map((i) => [i.key, i.members.length])).toEqual([
      ['he-bd-001|message|BD', 3],
      ['he-bd-001|message|AL', 1],
      ['ar-bd-001|message|ERROR', 1],
    ]);
    expect(items.every((i) => i.decision === null)).toBe(true);

    const base = { key: 'he-bd-001|message|BD', cause: 'base-direction', severity: 'major' };
    recordDecision(run, { ...base, label: 'false-positive' }, '2026-10-25T10:00:00Z');
    recordDecision(
      run,
      { ...base, label: 'confirmed', note: ' dir=auto ' },
      '2026-10-25T11:00:00Z',
    );
    expect(triageItems(run)[0]?.decision).toMatchObject({ label: 'confirmed', note: 'dir=auto' });
    expect(readFileSync(`${run}/triage.jsonl`, 'utf8').trim().split('\n')).toHaveLength(2);

    expect(() => recordDecision(run, { ...base, label: 'duplicate' }, 'x')).toThrow(
      /existing issue/,
    );
    expect(() => recordDecision(run, { ...base, label: 'nope' }, 'x')).toThrow(/invalid label/);
    expect(() => recordDecision(run, { ...base, key: 'x|y|z', label: 'confirmed' }, 'x')).toThrow(
      /no failure/,
    );
  });

  it('counts agent-proposed labels as not reviewed until Yousef saves his own', () => {
    const d = (note: string) => ({
      decision: {
        key: 'k',
        label: 'confirmed',
        cause: 'other',
        severity: 'major',
        link: '',
        note,
        at: 'T',
      } as const,
    });
    expect(reviewed({ decision: null })).toBe(false);
    expect(reviewed(d('[AI: proposed by Sonnet, verified by Opus] dir=auto'))).toBe(false);
    expect(reviewed(d('dir=auto, see [AI] notes'))).toBe(true);
  });
});
