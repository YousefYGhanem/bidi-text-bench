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
  if (b.textAlign === 'start' || b.textAlign === 'justify') return rtl ? 'right' : 'left';
  if (b.textAlign === 'end') return rtl ? 'left' : 'right';
  return b.textAlign; // left, right, center
};
const textBlocks = (c: Ctx) =>
  c.probe.blocks
    .map((b, i) => ({ b, i }))
    .filter(
      ({ b, i }) =>
        b.tag !== 'pre' && c.probe.graphemes.some((g) => g.block === i && !g.codeDirection),
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
    for (const { b, i } of blocks) {
      const side = alignedSide(b);
      if (side === 'center') return na(`block ${i} is centred by design`);
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
    for (const span of spans) {
      const at = c.probe.text.indexOf(span);
      if (at === -1) continue;
      const members = c.probe.graphemes.flatMap((g, i) =>
        g.start >= at && g.end <= at + span.length ? [i] : [],
      );
      const line = c.lines.find((l) => members.every((m) => l.actual.includes(m)));
      if (!line || !members.length) continue; // wraps across lines
      checked++;
      const pos = members.map((m) => line.actual.indexOf(m));
      const contiguous = Math.max(...pos) - Math.min(...pos) === members.length - 1;
      const ascending = pos.every((p, k) => k === 0 || p === (pos[k - 1] as number) + 1);
      if (!contiguous || !ascending)
        return lineFail(c, line, `span "${span}" is not one left-to-right unit`, members);
    }
    return checked ? pass(`${checked} span(s) isolated`) : na('spans missing or wrapped');
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
    const groups = [...c.probe.text.matchAll(/[+$€£₪]?\p{Nd}(?:[\p{Nd}.,:/\-٫٬]*\p{Nd})?%?/gu)]
      .map((m) =>
        c.probe.graphemes.flatMap((g, i) =>
          g.start >= (m.index ?? 0) && g.end <= (m.index ?? 0) + m[0].length ? [i] : [],
        ),
      )
      .filter((gs) => gs.length > 1 && !gs.some((g) => c.author.has(g)));
    if (!groups.length) return na('no multi-character numbers');
    for (const gs of groups) {
      const l = c.lines.find((x) => gs.every((g) => x.actual.includes(g)));
      if (!l) continue; // wraps across lines
      const slice = (order: number[]) => {
        const pos = gs.map((g) => order.indexOf(g));
        return order.slice(Math.min(...pos) - 1, Math.max(...pos) + 2);
      };
      if (!same(slice(l.actual), slice(l.expected)))
        return lineFail(c, l, 'a number is reordered or split', gs);
    }
    return pass(`${groups.length} number(s) intact`);
  },

  CODE: (c) => {
    const code = c.probe.graphemes.filter((g) => g.codeDirection);
    if (!code.length) return na('no code');
    const rtl = code.find((g) => g.codeDirection !== 'ltr');
    if (rtl)
      return {
        status: 'fail',
        evidence: { detail: `code "${rtl.text}…" resolves to ${rtl.codeDirection}` },
      };
    for (const [i, b] of c.probe.blocks.entries()) {
      if (b.tag !== 'pre') continue;
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
      .filter(({ b }) => b.tag === 'li' || b.quoteBar !== null);
    if (!items.length) return na('no list items or quotes');
    const want = c.fx.base_direction === 'rtl' ? 'right' : 'left';
    for (const { b, i } of items)
      if (b.quoteBar !== null && b.quoteBar !== want)
        return {
          status: 'fail',
          evidence: {
            detail: `quote bar of block ${i} is on the ${b.quoteBar}`,
            styles: styles(b),
          },
        };
      else if (b.direction !== c.fx.base_direction || alignedSide(b) !== want)
        return {
          status: 'fail',
          evidence: {
            detail: `list item ${i} is ${b.direction}, aligned ${alignedSide(b)}`,
            styles: styles(b),
          },
        };
    return pass(`${items.length} item(s) ${c.fx.base_direction}`);
  },

  TBL: (c) => {
    const cells = c.probe.blocks
      .map((b, i) => ({
        b,
        i,
        y: Math.round(c.probe.graphemes.find((g) => g.block === i)?.y ?? Number.NaN),
      }))
      .filter(({ b, y }) => (b.tag === 'td' || b.tag === 'th') && !Number.isNaN(y));
    if (cells.length < 2) return na('no table');
    const rows = new Map<number, typeof cells>();
    for (const cell of cells) {
      const key = [...rows.keys()].find((k) => Math.abs(k - cell.y) < 8) ?? cell.y;
      rows.set(key, [...(rows.get(key) ?? []), cell]);
    }
    for (const row of rows.values()) {
      const xs = row.map(({ b }) => (b.box.left + b.box.right) / 2);
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
    return pass(`${rows.size} row(s) mirrored correctly`);
  },

  TRUNC: (c) => {
    const { clipped, box } = c.probe.context;
    if (!clipped) return na('not truncated');
    const visible = (i: number) => {
      const g = c.probe.graphemes[i];
      return g !== undefined && g.x >= box.left && g.x <= box.right;
    };
    const all = c.probe.graphemes.map((_, i) => i);
    const shown = all.filter(visible);
    const hidden = all.filter((i) => !visible(i));
    if (!hidden.length) return na('clipped vertically only');
    const lastShown = Math.max(...shown.map((i) => c.probe.graphemes[i]?.start ?? 0));
    const firstHidden = Math.min(...hidden.map((i) => c.probe.graphemes[i]?.start ?? 0));
    if (shown.length && lastShown > firstHidden)
      return {
        status: 'fail',
        evidence: { detail: 'the start of the text is cut instead of the end', diffAt: hidden },
      };
    return pass('the end is cut');
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
