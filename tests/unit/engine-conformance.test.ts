import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { runBidiCharacterTest, testCases } from '../support/bidi-character-test.ts';

const cases = testCases(readFileSync('tests/data/BidiCharacterTest-13.0.0.subset.txt', 'utf8'));

it('passes every case of the BidiCharacterTest-13.0.0 subset', () => {
  expect(cases.length).toBeGreaterThan(3000);
  const failures = cases.flatMap((line) => {
    const why = runBidiCharacterTest(line);
    return why ? [`${line} -> ${why}`] : [];
  });
  expect(failures).toEqual([]);
});

it('catches a wrong expectation (negative control)', () => {
  const [cps, dir, para, levels, order] = (cases[0] as string).split(';');
  const swapped = (order as string).trim().split(' ');
  [swapped[0], swapped[1]] = [swapped[1] as string, swapped[0] as string];
  expect(
    runBidiCharacterTest([cps, dir, para, levels, swapped.join(' ')].join(';')),
  ).not.toBeNull();
});
