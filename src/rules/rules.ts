// Checker rules v0 (docs/CHECKER_SPEC.md §4): compare what the probe measured with what the engine
// expects, per fixture. Each rule returns pass, fail or na, with evidence.
import type { Fixture } from '../corpus/validate.ts';
import type { ProbeResult } from '../probe/probe.ts';
import { authorGraphemes, expectedLines, type LinePair } from './expected.ts';

export type RuleId =
  | 'BD'
  | 'AL'
  | 'ISO'
  | 'NP'
  | 'NUM'
  | 'CODE'
  | 'LIST'
  | 'TBL'
  | 'TRUNC'
  | 'FONT';
export const RULES: RuleId[] = [
  'BD',
  'AL',
  'ISO',
  'NP',
  'NUM',
  'CODE',
  'LIST',
  'TBL',
  'TRUNC',
  'FONT',
];

export interface RuleResult {
  fixture: string;
  rule: RuleId;
  status: 'pass' | 'fail' | 'na';
  severity: Fixture['severity'];
  evidence: {
    detail: string;
    expected?: string;
    actual?: string;
    /** Grapheme indices (probe) where actual and expected disagree. */
    diffAt?: number[];
    styles?: { direction: string; unicodeBidi: string; textAlign: string };
  };
}

interface Ctx {
  fx: Fixture;
  probe: ProbeResult;
  lines: LinePair[];
  author: Set<number>;
}
type Outcome = Omit<RuleResult, 'fixture' | 'rule' | 'severity'>;

const na = (detail: string): Outcome => ({ status: 'na', evidence: { detail } });
const pass = (detail: string): Outcome => ({ status: 'pass', evidence: { detail } });
const same = (a: number[], b: number[]) => a.length === b.length && a.every((x, i) => x === b[i]);
const text = (p: ProbeResult, order: number[]) =>
  order.map((i) => p.graphemes[i]?.text ?? '').join('');
const styles = (b: ProbeResult['blocks'][number]) => ({
  direction: b.direction,
  unicodeBidi: b.unicodeBidi,
  textAlign: b.textAlign,
});
const lineFail = (c: Ctx, l: LinePair, detail: string, diffAt: number[]): Outcome => ({
  status: 'fail',
  evidence: {
    detail,
    expected: text(c.probe, l.expected),
    actual: text(c.probe, l.actual),
    diffAt,
    styles: styles(c.probe.blocks[l.block] as ProbeResult['blocks'][number]),
  },
});
/** The side a block's text is aligned to, from its computed text-align and direction. */
const alignedSide = (b: { textAlign: string; direction: string }) => {
  const rtl = b.direction === 'rtl';
  // Chromium keeps legacy -webkit-right/-webkit-left/-webkit-center as computed values.
  const align = b.textAlign.replace(/^-(webkit|moz)-/, '');
  if (align === 'start' || align === 'justify') return rtl ? 'right' : 'left';
  if (align === 'end') return rtl ? 'left' : 'right';
  return align; // left, right, center
};
const textBlocks = (c: Ctx) =>
  c.probe.blocks
    .map((b, i) => ({ b, i }))
    .filter(
      ({ b, i }) =>
        b.container !== 'pre' && c.probe.graphemes.some((g) => g.block === i && !g.codeDirection),
    );
/** Neighbours of grapheme g in an order, as [left, right] (undefined at the edges). */
const neighbours = (order: number[], g: number) => {
  const k = order.indexOf(g);
  return [order[k - 1], order[k + 1]];
};

const check: Record<RuleId, (c: Ctx) => Outcome> = {
  BD: (c) => {
    const blocks = textBlocks(c);
    if (!blocks.length) return na('no text blocks');
    for (const { b, i } of blocks) {
      if (b.direction !== c.fx.base_direction)
        return {
          status: 'fail',
          evidence: {
            detail: `block ${i} (${b.tag}) is ${b.direction}, expected ${c.fx.base_direction}`,
            styles: styles(b),
          },
        };
      // Laid out with the opposite paragraph direction (dir=auto, unicode-bidi: plaintext).
      const wrong = c.lines.find(
        (l) => l.block === i && !same(l.actual, l.expected) && same(l.actual, l.flipped),
      );
      if (wrong)
        return lineFail(
          c,
          wrong,
          `block ${i} is laid out as ${c.fx.base_direction === 'rtl' ? 'ltr' : 'rtl'}`,
          [],
        );
    }
    return pass(`${blocks.length} block(s) are ${c.fx.base_direction}`);
  },

  AL: (c) => {
    const want = c.fx.base_direction === 'rtl' ? 'right' : 'left';
    const blocks = textBlocks(c);
    if (!blocks.length) return na('no text blocks');
    // Centred blocks (by design) are skipped, not decisive: a later block can still be wrong.
    const judged = blocks.filter(({ b }) => alignedSide(b) !== 'center');
    if (!judged.length) return na('every block is centred by design');
    for (const { b, i } of judged) {
      const side = alignedSide(b);
      if (side !== want)
        return {
          status: 'fail',
          evidence: {
            detail: `block ${i} (${b.tag}) is aligned ${side}, expected ${want}`,
            styles: styles(b),
          },
        };
    }
    return pass(`aligned ${want}`);
  },

  ISO: (c) => {
    const spans = c.fx.isolate_spans.filter(
      (s) => !/[\p{Script=Arabic}\p{Script=Hebrew}]/u.test(s),
    );
    if (!spans.length) return na('no isolate spans');
    let checked = 0;
    const skipped: string[] = [];
    for (const span of spans) {
      const at = c.probe.text.indexOf(span);
      if (at === -1) {
        skipped.push(`"${span}" not in the rendered text`);
        continue;
      }
      const members = c.probe.graphemes.flatMap((g, i) =>
        g.start >= at && g.end <= at + span.length ? [i] : [],
      );
      const line = c.lines.find((l) => members.every((m) => l.actual.includes(m)));
      if (!line || !members.length) {
        skipped.push(`"${span}" wraps across lines`);
        continue;
      }
      checked++;
      const pos = members.map((m) => line.actual.indexOf(m));
      const contiguous = Math.max(...pos) - Math.min(...pos) === members.length - 1;
      const ascending = pos.every((p, k) => k === 0 || p === (pos[k - 1] as number) + 1);
      if (!contiguous || !ascending)
        return lineFail(c, line, `span "${span}" is not one left-to-right unit`, members);
    }
    const note = skipped.length ? `; skipped ${skipped.join(', ')}` : '';
    return checked ? pass(`${checked} span(s) isolated${note}`) : na(`nothing to check${note}`);
  },

  NP: (c) => {
    const neutrals = c.probe.graphemes.flatMap((g, i) =>
      /^[\p{P}\p{S}]+$/u.test(g.text) && !c.author.has(i) && !g.codeDirection ? [i] : [],
    );
    if (!neutrals.length) return na('no punctuation');
    for (const l of c.lines) {
      const bad = neutrals.filter((g) => {
        if (!l.actual.includes(g)) return false;
        const [a, e] = [neighbours(l.actual, g), neighbours(l.expected, g)];
        const wild = (x: number | undefined) => x !== undefined && c.author.has(x);
        return [0, 1].some((k) => a[k] !== e[k] && !wild(a[k]) && !wild(e[k]));
      });
      if (bad.length) return lineFail(c, l, 'punctuation is on the wrong side', bad);
    }
    return pass(`${neutrals.length} neutral(s) in place`);
  },

  NUM: (c) => {
    const groups = [...c.probe.text.matchAll(/[+$€£₪]?\p{Nd}(?:[\p{Nd}.,:/\-٫٬]*\p{Nd})?[%٪]?/gu)]
      .map((m) =>
        c.probe.graphemes.flatMap((g, i) =>
          g.start >= (m.index ?? 0) && g.end <= (m.index ?? 0) + m[0].length ? [i] : [],
        ),
      )
      .filter((gs) => gs.length > 1 && !gs.some((g) => c.author.has(g)));
    if (!groups.length) return na('no multi-character numbers');
    let checked = 0;
    for (const gs of groups) {
      const l = c.lines.find((x) => gs.every((g) => x.actual.includes(g)));
      if (!l) continue; // wraps across lines
      checked++;
      // The number plus one neighbour on each side, a side only where both orders have one: a
      // number at a line edge in just one of them (a flipped base direction, which BD reports)
      // says nothing about the number itself.
      const span = (order: number[]) => {
        const pos = gs.map((g) => order.indexOf(g));
        return [Math.min(...pos), Math.max(...pos), order.length] as const;
      };
      const [sa, se] = [span(l.actual), span(l.expected)];
      const left = sa[0] > 0 && se[0] > 0 ? 1 : 0;
      const right = sa[1] < sa[2] - 1 && se[1] < se[2] - 1 ? 1 : 0;
      const slice = (order: number[], [lo, hi]: readonly number[]) =>
        order.slice((lo as number) - left, (hi as number) + 1 + right);
      const [a, e] = [slice(l.actual, sa), slice(l.expected, se)];
      const wild = (x: number | undefined) => x !== undefined && c.author.has(x);
      const ok = a.length === e.length && a.every((x, k) => x === e[k] || wild(x) || wild(e[k]));
      if (!ok) return lineFail(c, l, 'a number is reordered or split', gs);
    }
    return checked
      ? pass(
          `${checked} number(s) intact${checked < groups.length ? `; ${groups.length - checked} wrap across lines` : ''}`,
        )
      : na('every number wraps across lines');
  },

  CODE: (c) => {
    const code = c.probe.graphemes.filter((g) => g.codeDirection);
    if (!code.length) return na('no code');
    // 'none': inline code with unicode-bidi: normal; its direction has no effect (ISO judges it).
    const rtl = code.find((g) => g.codeDirection === 'rtl');
    if (rtl)
      return {
        status: 'fail',
        evidence: { detail: `code "${rtl.text}…" resolves to ${rtl.codeDirection}` },
      };
    for (const [i, b] of c.probe.blocks.entries()) {
      if (b.container !== 'pre') continue; // includes pre > code { display: block } and line spans
      if (alignedSide(b) === 'right')
        return {
          status: 'fail',
          evidence: { detail: `code block ${i} is right-aligned`, styles: styles(b) },
        };
      const l = c.lines.find((x) => x.block === i && !same(x.actual, x.expected));
      if (l)
        return lineFail(c, l, `code block ${i} line ${l.line} is not in left-to-right order`, []);
    }
    return pass('code is LTR');
  },

  LIST: (c) => {
    const items = c.probe.blocks
      .map((b, i) => ({ b, i }))
      .filter(({ b }) => b.container === 'li' || b.quoteBar !== null);
    if (!items.length) return na('no list items or quotes');
    const want = c.fx.base_direction === 'rtl' ? 'right' : 'left';
    const fail = (i: number, b: ProbeResult['blocks'][number], detail: string): Outcome => ({
      status: 'fail',
      evidence: { detail: `block ${i}: ${detail}`, styles: styles(b) },
    });
    for (const { b, i } of items) {
      if (b.quoteBar !== null && b.quoteBar !== want)
        return fail(i, b, `quote bar on the ${b.quoteBar}`);
      if (b.listIndent !== null && b.listIndent !== want)
        return fail(i, b, `list indent on the ${b.listIndent}`);
      if (b.direction !== c.fx.base_direction) return fail(i, b, `item is ${b.direction}`);
      const side = alignedSide(b);
      if (side !== 'center' && side !== want) return fail(i, b, `item is aligned ${side}`);
    }
    return pass(`${items.length} item(s) ${c.fx.base_direction}`);
  },

  TBL: (c) => {
    // Cells grouped by their table row (not by y, which wrapping and vertical-align move), one
    // block per column (a cell can hold several blocks), in logical column order.
    const rows = new Map<string, Map<number, number>>();
    for (const b of c.probe.blocks) {
      if (!b.cell) continue;
      const key = `${b.cell.table}:${b.cell.row}`;
      const row = rows.get(key) ?? new Map<number, number>();
      if (!row.has(b.cell.col)) row.set(b.cell.col, (b.box.left + b.box.right) / 2);
      rows.set(key, row);
    }
    const multi = [...rows.values()].filter((r) => r.size > 1);
    if (!multi.length) return na('no table row with two or more cells');
    for (const row of multi) {
      const xs = [...row.entries()].sort(([a], [b]) => a - b).map(([, x]) => x);
      const ok = xs.every(
        (x, k) =>
          k === 0 ||
          (c.fx.base_direction === 'rtl' ? x < (xs[k - 1] as number) : x > (xs[k - 1] as number)),
      );
      if (!ok)
        return {
          status: 'fail',
          evidence: {
            detail: `table columns run ${c.fx.base_direction === 'rtl' ? 'left-to-right' : 'right-to-left'}`,
          },
        };
    }
    return pass(`${multi.length} row(s) mirrored correctly`);
  },

  TRUNC: (c) => {
    const { clippedX, box } = c.probe.context;
    if (!clippedX) return na('not truncated horizontally');
    // Cut at the inline end: in RTL, everything hidden is past the left edge and nothing is cut on
    // the right (and the mirror image in LTR). Visual, not logical: an embedded LTR word in an RTL
    // title legitimately loses its logical start when the line is cut on the left.
    const rtl = c.fx.base_direction === 'rtl';
    const cutAtStart = c.probe.graphemes.flatMap((g, i) =>
      (rtl ? g.x > box.right : g.x < box.left) ? [i] : [],
    );
    const cutAtEnd = c.probe.graphemes.some((g) => (rtl ? g.x < box.left : g.x > box.right));
    if (cutAtStart.length)
      return {
        status: 'fail',
        evidence: { detail: 'the start of the line is cut instead of the end', diffAt: cutAtStart },
      };
    return cutAtEnd ? pass('the end is cut') : na('clipped vertically only');
  },

  FONT: (c) => {
    const tofu = c.probe.graphemes.flatMap((g, i) => (g.notdef ? [i] : []));
    if (!tofu.length) return pass('every glyph is drawn');
    return {
      status: 'fail',
      evidence: {
        detail: `missing glyphs: ${tofu.map((i) => c.probe.graphemes[i]?.text).join(' ')}`,
        diffAt: tofu,
      },
    };
  },
};

/** Runs every v0 rule for one fixture against one probe of its rendering. */
export function runRules(fx: Fixture, probe: ProbeResult): RuleResult[] {
  const ctx: Ctx = {
    fx,
    probe,
    lines: expectedLines(probe, fx),
    author: authorGraphemes(probe, fx),
  };
  return RULES.map((rule) => ({
    fixture: fx.id,
    rule,
    severity: fx.severity,
    ...check[rule](ctx),
  }));
}
