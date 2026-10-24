import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { allFixtures, loadFixtureFiles } from '../../src/corpus/load.ts';
import type { Fixture } from '../../src/corpus/validate.ts';
import { expectedOrder } from '../../src/engine/bidi.ts';

const fixtures = allFixtures(loadFixtureFiles());
const fx = (id: string) => fixtures.find((f) => f.id === id) as Fixture;
const visual = (text: string, line: number[]) => line.map((i) => text[i]).join('');

describe('expectedOrder', () => {
  it('lays out an RTL paragraph that starts with a Latin word right-to-left (ar-bd-001)', () => {
    const { text } = fx('ar-bd-001');
    const { paragraphLevel, lines } = expectedOrder(text, 'rtl');
    expect(paragraphLevel).toBe(1);
    // Visual order is left to right, so the first logical word ends up at the far right.
    expect(visual(text, lines[0] as number[]).endsWith('Python')).toBe(true);
  });

  it('keeps an isolated path contiguous and in typed order (ar-iso-001)', () => {
    const { text, isolate_spans } = fx('ar-iso-001');
    const span = isolate_spans[0] as string;
    const plain = text.replaceAll('`', '');
    const start = plain.indexOf(span);
    const line = expectedOrder(plain, 'rtl', { isolate: [span] }).lines[0] as number[];
    const at = line.indexOf(start);
    expect(line.slice(at, at + span.length)).toEqual(
      Array.from({ length: span.length }, (_, k) => start + k),
    );
    // Without isolation the trailing backslash jumps to the far end of the path.
    expect(visual(plain, expectedOrder(plain, 'rtl').lines[0] as number[])).toContain(
      '\\C:\\Users\\demo\\reports',
    );
  });

  it('draws plain-text C++ as ++C, and C++ when isolated as LTR (he-np-002, author span)', () => {
    const { text, author_spans } = fx('he-np-002');
    expect(visual(text, expectedOrder(text, 'rtl').lines[0] as number[])).toContain('++C');
    expect(
      visual(text, expectedOrder(text, 'rtl', { ltrIsolate: author_spans }).lines[0] as number[]),
    ).toContain('C++');
  });

  it('reorders each line on its own (rule L2)', () => {
    const text = 'שלום עולם hello world';
    const { lines } = expectedOrder(text, 'rtl', {
      lines: [
        [0, 9],
        [10, 20],
      ],
    });
    expect(visual(text, lines[1] as number[])).toBe('hello world');
    expect(lines.flat().sort((a, b) => a - b)).toEqual(Array.from({ length: 21 }, (_, i) => i));
  });
});

it('no fixture uses a character whose Bidi_Class drifted after UCD 13.0 (ADR-0004)', () => {
  const ranges = readFileSync('tests/data/uba-13-vs-18-bidi-class-drift.txt', 'utf8')
    .split('\n')
    .filter((l) => /^[0-9A-F]/.test(l))
    .map((l) => {
      const [lo, hi = lo] = (l.split(';')[0] as string)
        .split('..')
        .map((h) => Number.parseInt(h, 16));
      return [lo as number, hi as number] as const;
    });
  const drifted = fixtures.flatMap((f) =>
    [...f.text]
      .map((c) => c.codePointAt(0) as number)
      .filter((cp) => ranges.some(([lo, hi]) => cp >= lo && cp <= hi))
      .map((cp) => `${f.id} U+${cp.toString(16).toUpperCase()}`),
  );
  expect(drifted).toEqual([]);
});
