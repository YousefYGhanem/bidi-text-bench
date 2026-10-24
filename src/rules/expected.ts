// Bridges the engine and the probe: for every block and line the probe found, the order a correct
// renderer would draw, in the probe's grapheme indices (docs/CHECKER_SPEC.md §2, §4).
import type { Fixture } from '../corpus/validate.ts';
import { expectedOrder, toGraphemeOrder } from '../engine/bidi.ts';
import type { ProbeResult } from '../probe/probe.ts';

export interface LinePair {
  block: number;
  line: number;
  /** Probe: grapheme indices left to right. */
  actual: number[];
  /** Engine with the fixture's base direction (code blocks always LTR). */
  expected: number[];
  /** Engine with the opposite base direction, to recognise a wrong paragraph direction (BD). */
  flipped: number[];
}

/** Runs of contiguous graphemes with the same role, as text: inline code and links. */
function roleRuns(probe: ProbeResult, role: string): string[] {
  const runs: string[] = [];
  let start = -1;
  let end = -1;
  probe.graphemes.forEach((g, i) => {
    const inRole = g.role === role && probe.blocks[g.block]?.tag !== 'pre';
    if (inRole && start >= 0 && g.start <= end + 1) end = g.end;
    else {
      if (start >= 0) runs.push(probe.text.slice(start, end));
      [start, end] = inRole ? [g.start, g.end] : [-1, -1];
    }
    if (i === probe.graphemes.length - 1 && start >= 0) runs.push(probe.text.slice(start, end));
  });
  return runs.filter((r) => r.trim());
}

export function graphemeIndex(probe: ProbeResult): number[] {
  const of: number[] = [];
  probe.graphemes.forEach((g, i) => {
    for (let cu = g.start; cu < g.end; cu++) of[cu] = i;
  });
  return of;
}

/** Grapheme indices covered by the fixture's author spans: either order is accepted there. */
export function authorGraphemes(probe: ProbeResult, fx: Fixture): Set<number> {
  const of = graphemeIndex(probe);
  const out = new Set<number>();
  for (const span of fx.author_spans)
    for (let at = probe.text.indexOf(span); at !== -1; at = probe.text.indexOf(span, at + 1))
      for (let cu = at; cu < at + span.length; cu++) {
        const g = of[cu];
        if (g !== undefined) out.add(g);
      }
  return out;
}

/**
 * `golden`: the page is the reference render, which shows author spans as correctly authored, so
 * they are isolated as LTR too (CHECKER_SPEC §2 calibration). For real targets they stay wildcards.
 */
export function expectedLines(
  probe: ProbeResult,
  fx: Fixture,
  opts: { golden?: boolean } = {},
): LinePair[] {
  const of = graphemeIndex(probe);
  // Renderer-owned units (FIXTURE_SPEC §1.7): listed spans, plus inline code (LTR) and links.
  // shortcut: spans are located by string search, so an identical unformatted copy elsewhere in
  // the message is isolated too; switch to probe ranges if a fixture ever repeats a code span.
  const isolate = [
    ...fx.isolate_spans.filter((s) => probe.text.includes(s)),
    ...roleRuns(probe, 'a'),
  ];
  const ltrIsolate = [
    ...roleRuns(probe, 'code'),
    ...(opts.golden ? fx.author_spans.filter((s) => probe.text.includes(s)) : []),
  ];
  const opposite = fx.base_direction === 'rtl' ? 'ltr' : 'rtl';

  return probe.blocks.flatMap((block, b) => {
    const ranges = block.lines.map((l) => l.range);
    const base = block.container === 'pre' ? 'ltr' : fx.base_direction;
    const run = (dir: 'ltr' | 'rtl') =>
      expectedOrder(probe.text, dir, { isolate, ltrIsolate, lines: ranges }).lines.map((l) =>
        toGraphemeOrder(l, of).filter((g) => probe.graphemes[g]?.block === b),
      );
    const expected = run(base);
    const flipped = block.container === 'pre' ? expected : run(opposite);
    return block.lines.map((l, i) => ({
      block: b,
      line: i,
      actual: l.visual,
      expected: expected[i] ?? [],
      flipped: flipped[i] ?? [],
    }));
  });
}
