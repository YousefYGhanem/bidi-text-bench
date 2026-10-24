// DOM probe (docs/CHECKER_SPEC.md §3): what the browser actually draws. The logical text, every
// grapheme's box, blocks (each one a bidi paragraph), lines in visual order, and styling context.
import type { Locator } from '@playwright/test';

export interface ProbeGrapheme {
  /** [start, end) in code units of ProbeResult.text. */
  start: number;
  end: number;
  text: string;
  /** Centre of the grapheme's first client rect, in CSS px. */
  x: number;
  y: number;
  width: number;
  height: number;
  block: number;
  /** Nearest p, li, pre, code, a, td, textarea or contenteditable element, or null. */
  role: string | null;
  /** Computed direction of the nearest code or pre ancestor, or null outside code. */
  codeDirection: string | null;
  /** Drawn as the missing-glyph box (tofu): no font on this machine has it. */
  notdef: boolean;
}

export interface ProbeLine {
  /** Grapheme indices in visual order, left to right. */
  visual: number[];
  /** Inclusive [first, last] code units of the line in logical order (for the engine). */
  range: [number, number];
}

export interface ProbeBlock {
  tag: string;
  direction: string;
  unicodeBidi: string;
  textAlign: string;
  /** The block element's own box, in CSS px. */
  box: { left: number; right: number };
  /** Inside a blockquote: the side its quote bar (border) is drawn on, or null. */
  quoteBar: 'left' | 'right' | null;
  /**
   * Nearest structural container inside the root (the block itself counts): li, td, th, pre or
   * blockquote. Rules use this, not `tag`, so wrappers such as li > p or td > div don't hide it.
   */
  container: 'li' | 'td' | 'th' | 'pre' | 'blockquote' | null;
  /** For td/th containers: table index in the root, row index in the table, column index. */
  cell: { table: number; row: number; col: number } | null;
  /** For li containers: the side of the list's indent (larger horizontal padding), or null. */
  listIndent: 'left' | 'right' | null;
  lines: ProbeLine[];
}

export interface ProbeResult {
  text: string;
  graphemes: ProbeGrapheme[];
  blocks: ProbeBlock[];
  context: {
    direction: string;
    unicodeBidi: string;
    textAlign: string;
    /** dir and lang attributes from the root up to <html>. */
    dirChain: { tag: string; dir: string | null; lang: string | null }[];
    overflowX: string;
    textOverflow: string;
    /** The root's box, in CSS px. */
    box: { left: number; right: number; top: number; bottom: number };
    /** Content is wider or taller than the root's box. */
    clipped: boolean;
    /** Content is wider than the root's box and overflow-x hides it (truncation, TRUNC). */
    clippedX: boolean;
    /** Inputs and textareas: no per-character boxes, only direction and alignment (INP). */
    controls: { tag: string; dir: string | null; direction: string; textAlign: string }[];
  };
}

/** Runs inside the page, so it must not reference anything outside its own body. */
export async function probeInPage(root: Element, exclude: string[]): Promise<ProbeResult> {
  // Web fonts change both glyph boxes and the tofu check, so measure only once they are loaded.
  await document.fonts.ready;
  const ROLES = 'p, li, pre, code, a, td, textarea, [contenteditable=""], [contenteditable="true"]';
  // checkVisibility() is false for display: contents (slots included): it has no box of its own.
  const skip = (el: Element) =>
    el.matches('script, style, template, noscript') ||
    exclude.some((s) => el.matches(s)) ||
    (getComputedStyle(el).display !== 'contents' &&
      !el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }));

  // Text nodes in rendering order: open shadow trees replace their host's children, slots
  // pull in their assigned nodes.
  const textNodes: Text[] = [];
  const visit = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      textNodes.push(node as Text);
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE && node.nodeType !== Node.DOCUMENT_FRAGMENT_NODE)
      return;
    if (node instanceof Element && node !== root && skip(node)) return;
    if (node instanceof HTMLSlotElement) {
      for (const n of node.assignedNodes({ flatten: true })) visit(n);
      return;
    }
    const children =
      node instanceof Element && node.shadowRoot ? node.shadowRoot.childNodes : node.childNodes;
    for (const child of children) visit(child);
  };
  visit(root);

  const blockOf = (el: Element) => {
    let cur: Element | null = el;
    while (cur && cur !== root) {
      const display = getComputedStyle(cur).display;
      if (display !== 'inline' && display !== 'contents') return cur;
      cur = cur.parentElement ?? (cur.getRootNode() as ShadowRoot).host ?? null;
    }
    return root;
  };
  const roleOf = (el: Element) => {
    const hit = el.closest(ROLES);
    return hit && (root.contains(hit) || hit === root) ? hit.tagName.toLowerCase() : null;
  };

  const codeDirectionOf = (el: Element) => {
    const code = el.closest('code, pre');
    return code && (root.contains(code) || code === root) ? getComputedStyle(code).direction : null;
  };
  // Tofu check, method chosen by what the engine does (measured in Chromium, WebKit, Firefox):
  // - one notdef glyph for every missing character (U+E000 and U+E001 draw alike, as in Chromium
  //   and WebKit): missing means pixel-identical to U+E000 (private use; no font covers it);
  // - a box with the code point in hex (Firefox): missing means the same advance and ink box as a
  //   private-use reference with as many hex digits. (WebKit reports no ink box, so metrics are
  //   only used here.) Canvas text uses the same font fallback as the page.
  const ctx = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
  const draw = (font: string, s: string) => {
    if (!ctx) return '';
    ctx.canvas.width = 96;
    ctx.canvas.height = 96;
    ctx.font = font;
    ctx.fillText(s, 8, 64);
    return ctx.getImageData(0, 0, 96, 96).data.join(',');
  };
  const metrics = (font: string, s: string) => {
    if (!ctx) return '';
    ctx.font = font;
    const m = ctx.measureText(s);
    const box = [m.width, m.actualBoundingBoxLeft, m.actualBoundingBoxRight];
    return [...box, m.actualBoundingBoxAscent, m.actualBoundingBoxDescent]
      .map((v) => v.toFixed(2))
      .join();
  };
  const REFERENCES = ['\uE000', '\u{F0000}', '\u{100000}'];
  const singleNotdef = new Map<string, boolean>();
  const notdefCache = new Map<string, boolean>();
  const isNotdef = (font: string, s: string) => {
    // Emoji drawn in colour are skipped; text-style symbols such as © ® ™ are still checked.
    if (/^\s+$/u.test(s) || /\p{Emoji_Presentation}|️/u.test(s)) return false;
    if (!singleNotdef.has(font))
      singleNotdef.set(font, draw(font, '\uE000') === draw(font, '\uE001'));
    const key = `${font}|${s}`;
    if (!notdefCache.has(key))
      notdefCache.set(
        key,
        singleNotdef.get(font)
          ? draw(font, s) === draw(font, '\uE000')
          : REFERENCES.some((ref) => metrics(font, ref) === metrics(font, s)),
      );
    return notdefCache.get(key) as boolean;
  };

  const segmenter = new Intl.Segmenter('und', { granularity: 'grapheme' });
  const range = document.createRange();
  const blockEls: Element[] = [];
  const graphemes: ProbeGrapheme[] = [];
  let text = '';
  for (const node of textNodes) {
    const value = node.nodeValue ?? '';
    const parent = node.parentElement ?? root;
    const blockEl = blockOf(parent);
    let block = blockEls.indexOf(blockEl);
    if (block === -1) block = blockEls.push(blockEl) - 1;
    const role = roleOf(parent);
    const codeDirection = codeDirectionOf(parent);
    const font = getComputedStyle(parent).font;
    for (const { segment, index } of segmenter.segment(value)) {
      range.setStart(node, index);
      range.setEnd(node, index + segment.length);
      const r = range.getClientRects()[0];
      if (r && r.width > 0 && r.height > 0)
        graphemes.push({
          start: text.length + index,
          end: text.length + index + segment.length,
          text: segment,
          x: r.left + r.width / 2,
          y: r.top + r.height / 2,
          width: r.width,
          height: r.height,
          block,
          role,
          codeDirection,
          notdef: isNotdef(font, segment),
        });
    }
    text += value;
  }

  const inRoot = (el: Element | null) => (el && (el === root || root.contains(el)) ? el : null);
  const sideOf = (left: string, right: string): 'left' | 'right' | null => {
    const [l, r] = [Number.parseFloat(left), Number.parseFloat(right)];
    return l > r ? 'left' : r > l ? 'right' : null;
  };
  const tables = [...root.querySelectorAll('table')];
  const structure = (el: Element) => {
    const c = inRoot(el.closest('li, td, th, pre, blockquote'));
    const container = (c?.tagName.toLowerCase() ?? null) as ProbeBlock['container'];
    const row = c?.closest('tr');
    const table = c?.closest('table');
    const cell =
      (container === 'td' || container === 'th') && row && table
        ? {
            table: tables.indexOf(table),
            row: [...table.rows].indexOf(row as HTMLTableRowElement),
            col: [...(row as HTMLTableRowElement).cells].indexOf(c as HTMLTableCellElement),
          }
        : null;
    const list = container === 'li' ? c?.closest('ol, ul') : null;
    const ls = list ? getComputedStyle(list) : null;
    return { container, cell, listIndent: ls ? sideOf(ls.paddingLeft, ls.paddingRight) : null };
  };

  const blocks: ProbeBlock[] = blockEls.map((el, b) => {
    const style = getComputedStyle(el);
    // Lines: graphemes whose vertical centres are within half a glyph height of each other.
    const lines: { y: number; h: number; members: number[] }[] = [];
    graphemes.forEach((g, i) => {
      if (g.block !== b) return;
      const line = lines.find((l) => Math.abs(l.y - g.y) < Math.min(l.h, g.height) / 2);
      if (line) line.members.push(i);
      else lines.push({ y: g.y, h: g.height, members: [i] });
    });
    lines.sort((a, z) => a.y - z.y);
    return {
      tag: el.tagName.toLowerCase(),
      direction: style.direction,
      unicodeBidi: style.unicodeBidi,
      textAlign: style.textAlign,
      box: { left: el.getBoundingClientRect().left, right: el.getBoundingClientRect().right },
      quoteBar: (() => {
        const q = el.closest('blockquote');
        if (!q) return null;
        const s = getComputedStyle(q);
        const [l, r] = [
          Number.parseFloat(s.borderLeftWidth),
          Number.parseFloat(s.borderRightWidth),
        ];
        return l > r ? 'left' : r > l ? 'right' : null;
      })(),
      ...structure(el),
      lines: lines.map((l) => {
        const gs = l.members.map((i) => graphemes[i] as ProbeGrapheme);
        return {
          // Ties (lam-alef shares one box) keep logical order: sort is stable on logical input.
          visual: [...l.members].sort(
            (a, z) => (graphemes[a] as ProbeGrapheme).x - (graphemes[z] as ProbeGrapheme).x,
          ),
          range: [Math.min(...gs.map((g) => g.start)), Math.max(...gs.map((g) => g.end)) - 1],
        };
      }),
    };
  });

  const rootStyle = getComputedStyle(root);
  const rootBox = root.getBoundingClientRect();
  const dirChain: ProbeResult['context']['dirChain'] = [];
  for (let el: Element | null = root; el; el = el.parentElement)
    dirChain.push({
      tag: el.tagName.toLowerCase(),
      dir: el.getAttribute('dir'),
      lang: el.getAttribute('lang'),
    });
  const controls = [
    ...root.querySelectorAll('input, textarea'),
    ...(root.matches('input, textarea') ? [root] : []),
  ].map((el) => {
    const s = getComputedStyle(el);
    return {
      tag: el.tagName.toLowerCase(),
      dir: el.getAttribute('dir'),
      direction: s.direction,
      textAlign: s.textAlign,
    };
  });

  return {
    text,
    graphemes,
    blocks,
    context: {
      direction: rootStyle.direction,
      unicodeBidi: rootStyle.unicodeBidi,
      textAlign: rootStyle.textAlign,
      dirChain,
      overflowX: rootStyle.overflowX,
      textOverflow: rootStyle.textOverflow,
      box: { left: rootBox.left, right: rootBox.right, top: rootBox.top, bottom: rootBox.bottom },
      clipped: root.scrollWidth > root.clientWidth + 1 || root.scrollHeight > root.clientHeight + 1,
      clippedX: root.scrollWidth > root.clientWidth + 1 && rootStyle.overflowX !== 'visible',
      controls,
    },
  };
}

/** Probes the element behind a locator. `exclude`: selectors to ignore (copy buttons, gutters). */
export const probe = (locator: Locator, opts: { exclude?: string[] } = {}) =>
  locator.evaluate(probeInPage, opts.exclude ?? []);
