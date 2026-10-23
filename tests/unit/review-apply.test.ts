import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { type Fixture, fixtureHash, validateFixtures } from '../../src/corpus/validate.ts';
import { applyDecision } from '../../src/review/apply.ts';

const path = 'corpus/fixtures/he/_seed.yaml';
const source = readFileSync(path, 'utf8');
const AT = '2026-11-01T10:00:00.000Z';
const run = (id: string, decision: 'approve' | 'reject' | 'needs-fix', text = source) =>
  applyDecision(path, text, id, decision, 'note', "Yousef O'Test", AT);
const changedLines = (a: string, b: string) => {
  const [x, y] = [a.split('\n'), b.split('\n')];
  return x.flatMap((line, i) => (line === y[i] ? [] : [`${line} -> ${y[i]}`]));
};

describe('applyDecision', () => {
  it('approve changes only the status and verification lines, with the content hash', () => {
    const { yamlText, log } = run('he-iso-001', 'approve');
    const fx = (parse(yamlText) as Fixture[]).find((f) => f.id === 'he-iso-001') as Fixture;
    expect(fx.status).toBe('verified');
    expect(fx.verification).toEqual({ by: "Yousef O'Test", at: AT, hash: fixtureHash(fx) });
    expect(changedLines(source, yamlText)).toHaveLength(2);
    expect(validateFixtures([{ path, fixtures: parse(yamlText) }])).toEqual([]);
    expect(log).toMatchObject({
      id: 'he-iso-001',
      decision: 'approve',
      note: 'note',
      hash: fixtureHash(fx),
    });
  });

  it('reject marks the fixture rejected and records who decided', () => {
    const fx = (parse(run('he-np-001', 'reject').yamlText) as Fixture[]).find(
      (f) => f.id === 'he-np-001',
    );
    expect(fx?.status).toBe('rejected');
    expect(fx?.verification?.by).toBe("Yousef O'Test");
  });

  it('needs-fix leaves the file untouched and only logs', () => {
    const { yamlText, log } = run('he-np-001', 'needs-fix');
    expect(yamlText).toBe(source);
    expect(log.decision).toBe('needs-fix');
  });

  it('refuses fixtures that are no longer drafts, and unknown ids', () => {
    const once = run('he-iso-001', 'approve').yamlText;
    expect(() => run('he-iso-001', 'approve', once)).toThrow(/is verified, not a draft/);
    expect(() => run('he-xxx-001', 'approve')).toThrow(/not in/);
  });

  it('refuses an invalid file', () => {
    expect(() => run('he-iso-001', 'approve', source.replace('lang: he', 'lang: xx'))).toThrow(
      /fix the file first/,
    );
  });
});
