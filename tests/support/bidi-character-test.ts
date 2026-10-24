// Runs one line of Unicode's BidiCharacterTest.txt through the engine (src/engine/bidi.ts).
// Fields: code points; paragraph direction (0 LTR, 1 RTL, 2 auto); resolved paragraph level;
// resolved levels per code point ("x" = removed by rule X9); visual order of non-removed code points.
import { expectedOrder } from '../../src/engine/bidi.ts';

const DIRECTION = { '0': 'ltr', '1': 'rtl', '2': 'auto' } as const;

/** null when the engine agrees with the test line, otherwise a short description of the mismatch. */
export function runBidiCharacterTest(line: string): string | null {
  const [cps = '', dir = '', para = '', levelField = '', orderField = ''] = line.split(';');
  const chars = cps
    .trim()
    .split(' ')
    .map((h) => String.fromCodePoint(Number.parseInt(h, 16)));
  const text = chars.join('');
  // cpOf[codeUnit] = index of the code point it belongs to.
  const cpOf = chars.flatMap((c, i) => Array.from({ length: c.length }, () => i));
  const cuOf = chars.map((_, i) => cpOf.indexOf(i));

  const result = expectedOrder(text, DIRECTION[dir as keyof typeof DIRECTION]);
  if (String(result.paragraphLevel) !== para.trim())
    return `paragraph level ${result.paragraphLevel}, expected ${para.trim()}`;

  const expectedLevels = levelField.trim().split(' ');
  for (const [i, want] of expectedLevels.entries()) {
    if (want === 'x') continue;
    const got = result.levels[cuOf[i] as number];
    if (String(got) !== want) return `level of code point ${i} is ${got}, expected ${want}`;
  }

  const removed = new Set(expectedLevels.flatMap((l, i) => (l === 'x' ? [i] : [])));
  const visual = (result.lines[0] ?? [])
    .map((cu) => cpOf[cu] as number)
    .filter((cp, k, all) => k === 0 || cp !== all[k - 1]) // a surrogate pair counts once
    .filter((cp) => !removed.has(cp))
    .join(' ');
  if (visual !== orderField.trim()) return `visual order ${visual}, expected ${orderField.trim()}`;
  return null;
}

/** The test cases in a BidiCharacterTest file (comments and blank lines dropped). */
export const testCases = (file: string) =>
  file.split(/\r?\n/).filter((l) => l.trim() && !l.startsWith('#'));
