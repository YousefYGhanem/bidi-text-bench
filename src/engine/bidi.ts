// Expected-order engine (docs/CHECKER_SPEC.md §2): UAX #9 embedding levels and the visual order of
// each line, from bidi-js (UBA 13.0.0; drift from current Unicode is recorded in ADR-0004).
// All indices are UTF-16 code units of the original text, matching DOM text offsets.
import bidiModule, { type Bidi } from 'bidi-js';

// bidi-js is CommonJS with an ESM-style d.ts; under nodenext Node hands us the factory itself.
const bidi = (bidiModule as unknown as () => Bidi)();
const FSI = '⁨';
const LRI = '⁦';
const PDI = '⁩';

export interface ExpectedOrder {
  /** Embedding level of each code unit of the original text (odd = RTL). */
  levels: number[];
  /** Resolved level of the first paragraph (0 = LTR, 1 = RTL). */
  paragraphLevel: number;
  /** For each line, original code-unit indices in visual order, left to right. */
  lines: number[][];
}

export interface EngineOptions {
  /** Renderer-owned spans, isolated with FSI…PDI (each occurrence). */
  isolate?: string[];
  /** Spans isolated as LTR with LRI…PDI: author spans on the golden page (ADR-0003). */
  ltrIsolate?: string[];
  /** Inclusive [start, end] code-unit ranges, one per rendered line. Default: one per paragraph. */
  lines?: [number, number][];
}

/** Every occurrence of each span, longest spans first so that overlaps keep the outer one. */
function spanRanges(
  text: string,
  spans: string[],
  open: string,
): { start: number; end: number; open: string }[] {
  const out: { start: number; end: number; open: string }[] = [];
  for (const span of [...new Set(spans)].sort((a, b) => b.length - a.length)) {
    for (let i = text.indexOf(span); i !== -1; i = text.indexOf(span, i + span.length)) {
      const end = i + span.length;
      if (!out.some((r) => i < r.end && end > r.start)) out.push({ start: i, end, open });
    }
  }
  return out.sort((a, b) => a.start - b.start);
}

export function expectedOrder(
  text: string,
  base: 'ltr' | 'rtl' | 'auto',
  opts: EngineOptions = {},
): ExpectedOrder {
  const ranges = [
    ...spanRanges(text, opts.isolate ?? [], FSI),
    ...spanRanges(text, opts.ltrIsolate ?? [], LRI),
  ]
    .sort((a, b) => a.start - b.start)
    .filter((r, i, all) => !all.slice(0, i).some((p) => r.start < p.end && r.end > p.start));

  // Build the augmented string; toAug[i] is the index of original code unit i in it.
  let augmented = '';
  const toAug: number[] = [];
  const inserted = new Set<number>();
  const insert = (ch: string) => {
    inserted.add(augmented.length);
    augmented += ch;
  };
  for (let i = 0; i < text.length; i++) {
    for (const r of ranges) if (r.start === i) insert(r.open);
    toAug.push(augmented.length);
    augmented += text[i];
    for (const r of ranges) if (r.end === i + 1) insert(PDI);
  }

  const embedding = bidi.getEmbeddingLevels(augmented, base === 'auto' ? undefined : base);
  const levels = toAug.map((a) => embedding.levels[a] ?? 0);
  const fromAug = new Map(toAug.map((a, i) => [a, i]));

  const lineRanges =
    opts.lines ??
    embedding.paragraphs.map((p) => [
      fromAug.get(p.start) ?? 0,
      fromAug.get(p.end) ?? text.length - 1,
    ]);

  const lines = lineRanges.map(([start, end]) => {
    const augStart = toAug[start] ?? 0;
    const augEnd = toAug[end] ?? augmented.length - 1;
    const order = Array.from({ length: augEnd - augStart + 1 }, (_, k) => augStart + k);
    // Each flip is a range of positions (not values) to reverse in place, applied in order.
    for (const [s, e] of bidi.getReorderSegments(augmented, embedding, augStart, augEnd) as [
      number,
      number,
    ][]) {
      const lo = s - augStart;
      order.splice(lo, e - s + 1, ...order.slice(lo, e - augStart + 1).reverse());
    }
    return order.filter((a) => !inserted.has(a)).map((a) => fromAug.get(a) as number);
  });

  return {
    levels,
    paragraphLevel: embedding.paragraphs[0]?.level ?? (base === 'rtl' ? 1 : 0),
    lines,
  };
}

/**
 * Maps a line's visual order from code units to graphemes, so it compares with the probe:
 * `graphemeOf[cu]` is the grapheme index of each code unit. A grapheme's code units (a letter and
 * its tashkeel, a surrogate pair) are reversed together in RTL runs, so they collapse to one entry.
 */
export function toGraphemeOrder(line: number[], graphemeOf: (number | undefined)[]): number[] {
  const out: number[] = [];
  for (const cu of line) {
    const g = graphemeOf[cu];
    if (g !== undefined && out.at(-1) !== g) out.push(g);
  }
  return out;
}
