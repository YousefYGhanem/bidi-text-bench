import { expect, it } from 'vitest';
import type { Fixture } from '../../src/corpus/validate.ts';
import type { ProbeResult } from '../../src/probe/probe.ts';
import { authorGraphemes, expectedLines } from '../../src/rules/expected.ts';

// One RTL line, "אב C++": one grapheme per character, as a probe would report it.
const text = 'אב C++';
const probe: ProbeResult = {
  text,
  graphemes: [...text].map((ch, i) => ({
    start: i,
    end: i + 1,
    text: ch,
    x: 100 - i * 10,
    y: 10,
    width: 8,
    height: 16,
    block: 0,
    role: 'p',
    codeDirection: null,
    notdef: false,
  })),
  blocks: [
    {
      tag: 'p',
      direction: 'rtl',
      unicodeBidi: 'isolate',
      textAlign: 'start',
      box: { left: 0, right: 200 },
      content: { left: 0, right: 200 },
      quoteBar: null,
      container: null,
      cell: null,
      listIndent: null,
      lines: [{ visual: [5, 4, 3, 2, 1, 0], range: [0, 5] }],
    },
  ],
  context: {} as ProbeResult['context'],
};
const fx = {
  base_direction: 'rtl',
  isolate_spans: [],
  author_spans: ['C++'],
} as unknown as Fixture;

it('maps the engine order to probe graphemes, with the opposite direction alongside', () => {
  const [line] = expectedLines(probe, fx);
  // Plain-text UAX #9: "++C" at the left, then the space and the Hebrew right to left.
  expect(line?.expected.map((g) => text[g]).join('')).toBe('++C בא');
  // LTR base: the Hebrew word still runs right to left internally, then "C++" in typed order.
  expect(line?.flipped.map((g) => text[g]).join('')).toBe('בא C++');
});

it('marks author-span graphemes, where either order is accepted', () => {
  expect([...authorGraphemes(probe, fx)]).toEqual([3, 4, 5]);
});
