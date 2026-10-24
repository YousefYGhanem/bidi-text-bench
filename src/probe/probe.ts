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
    /** Content is wider or taller than the root's box. */
    clipped: boolean;
    /** Inputs and textareas: no per-character boxes, only direction and alignment (INP). */
    controls: { tag: string; dir: string | null; direction: string; textAlign: string }[];
  };
}

/** Runs inside the page, so it must not reference anything outside its own body. */
export function probeInPage(root: Element, exclude: string[]): ProbeResult {
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
        });
    }
    text += value;
  }

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
      clipped: root.scrollWidth > root.clientWidth + 1 || root.scrollHeight > root.clientHeight + 1,
      controls,
    },
  };
}

/** Probes the element behind a locator. `exclude`: selectors to ignore (copy buttons, gutters). */
export const probe = (locator: Locator, opts: { exclude?: string[] } = {}) =>
  locator.evaluate(probeInPage, opts.exclude ?? []);
