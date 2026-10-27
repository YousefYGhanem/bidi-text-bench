// The bug zoo (docs/CHECKER_SPEC.md §8): labelled pages, each one a verified fixture rendered with
// a known bidi bug. The rule named by `rule` must fail on it (recall). CONTROLS are correct pages
// that no rule may fail on, next to the golden page (false positives).
import type { RuleId } from '../rules/rules.ts';

export interface ZooPage {
  id: string;
  fixture: string;
  why: string;
  /** Extra CSS appended after the reference stylesheet. */
  css?: string;
  /** Transform of the golden article HTML. */
  html?: (article: string) => string;
}

export interface Bug extends ZooPage {
  rule: RuleId;
  /** Rules that must not fail on this page: a false positive next to a real bug. */
  clean?: RuleId[];
}

const noDir = (h: string) => h.replace(' dir="rtl"', '');
// Open WebUI shows code blocks in CodeMirror, not pre > code (pilot, 2026-10-26).
const codeMirror = (h: string) =>
  h.replace(
    // As in Open WebUI's DOM: no newline before the editor or between lines, and Svelte's
    // whitespace text nodes beside and inside the wrapper that holds the editor.
    /\s*<pre><code[^>]*>([\s\S]*?)\n?<\/code><\/pre>/,
    (_, code: string) =>
      ` <div dir="ltr"> <div class="cm-editor"><div class="cm-scroller"><div class="cm-content" style="white-space: pre">${code
        .split('\n')
        .map((l) => `<div class="cm-line">${l}</div>`)
        .join('')}</div></div></div></div>`,
  );
// Both pilot apps autolink "ל-support@…" with the hyphen inside the link, unisolated.
const autolinkHyphen = (h: string) =>
  h.replace(
    /ל-?<a [^>]*>-?support@example\.com<\/a>|ל-<bdi>support@example\.com<\/bdi>/,
    'ל<a href="mailto:-support@example.com">-support@example.com</a>',
  );
const unisolatedCode = '.fx code { direction: inherit; unicode-bidi: normal; }';
const title =
  '.fx { width: 140px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }';

export const BUGS: Bug[] = [
  {
    id: 'BD-1',
    rule: 'BD',
    fixture: 'he-bd-001',
    why: 'no dir at all: the message is LTR',
    html: noDir,
  },
  {
    id: 'BD-2',
    rule: 'BD',
    fixture: 'he-bd-001',
    why: 'dir="auto" picks LTR from the leading Latin word',
    html: (h) => h.replace(' dir="rtl"', ' dir="auto"'),
  },
  {
    id: 'BD-3',
    rule: 'BD',
    fixture: 'ar-bd-001',
    why: 'unicode-bidi: plaintext sets the paragraph direction from the first strong character',
    css: '.fx p { unicode-bidi: plaintext; }',
  },
  {
    id: 'AL-1',
    rule: 'AL',
    fixture: 'he-al-001',
    why: 'text-align: left',
    css: '.fx { text-align: left; }',
  },
  {
    id: 'AL-2',
    rule: 'AL',
    fixture: 'ar-al-002',
    why: 'text-align: end, which is left in RTL',
    css: '.fx, .fx * { text-align: end; }',
  },
  {
    id: 'ISO-1',
    rule: 'ISO',
    fixture: 'ar-iso-001',
    why: 'inline code not isolated',
    css: unisolatedCode,
  },
  {
    id: 'ISO-2',
    rule: 'ISO',
    fixture: 'he-iso-001',
    why: 'inline code not isolated',
    css: unisolatedCode,
  },
  {
    id: 'NP-1',
    rule: 'NP',
    fixture: 'he-np-001',
    why: 'an RTL question laid out LTR',
    html: (h) => h.replace(' dir="rtl"', ' dir="ltr"'),
  },
  {
    id: 'NUM-1',
    rule: 'NUM',
    fixture: 'he-num-001',
    why: 'bidi-override reverses the digits',
    css: '.fx p { unicode-bidi: bidi-override; }',
  },
  {
    id: 'NUM-2',
    rule: 'NUM',
    fixture: 'ar-num-002',
    why: 'bidi-override reverses the ranges and times',
    css: '.fx p { unicode-bidi: bidi-override; }',
  },
  {
    id: 'CODE-1',
    rule: 'CODE',
    fixture: 'ar-code-001',
    why: 'code block inherits RTL and is right-aligned',
    css: '.fx pre { direction: rtl; text-align: right; }',
  },
  {
    id: 'CODE-2',
    rule: 'CODE',
    fixture: 'ar-code-004',
    why: 'inline code set to RTL',
    css: '.fx code { direction: rtl; }',
  },
  {
    id: 'LIST-1',
    rule: 'LIST',
    fixture: 'he-list-001',
    why: 'ordered list laid out LTR',
    html: (h) => h.replace('<ol>', '<ol dir="ltr">'),
  },
  {
    id: 'LIST-2',
    rule: 'LIST',
    fixture: 'ar-list-003',
    why: 'quote bar on the left in RTL',
    css: '.fx blockquote { border-inline-start: 0; border-left: 3px solid #999; }',
  },
  {
    id: 'TBL-1',
    rule: 'TBL',
    fixture: 'ar-tbl-001',
    why: 'table keeps LTR column order',
    html: (h) => h.replace('<table>', '<table dir="ltr">'),
  },
  {
    id: 'TRUNC-1',
    rule: 'TRUNC',
    fixture: 'he-trunc-001',
    why: 'RTL title truncated as LTR: the start is cut',
    css: title,
    html: (h) => h.replace(' dir="rtl"', ' dir="ltr"'),
  },
  {
    id: 'TRUNC-2',
    rule: 'TRUNC',
    fixture: 'ar-trunc-001',
    why: 'Arabic title with an embedded English word, truncated as LTR',
    css: title,
    html: (h) => h.replace(' dir="rtl"', ' dir="ltr"'),
  },
  {
    id: 'FONT-1',
    rule: 'FONT',
    fixture: 'he-font-001',
    why: 'a character no font covers (U+E001) is drawn as tofu',
    html: (h) => h.replace('</p>', ' \uE001</p>'),
  },
  // Added in task 2.6 from the rule-reviewer findings.
  {
    id: 'AL-3',
    rule: 'AL',
    fixture: 'ar-al-002',
    why: 'centred heading, then a left-aligned paragraph',
    css: '.fx h2 { text-align: center; } .fx p { text-align: left; }',
  },
  // ISO-3 (an unisolated plain-text mention) was removed in ADR-0005: such mentions are author spans.
  {
    id: 'ISO-4',
    rule: 'ISO',
    fixture: 'he-iso-005',
    why: 'inline code with leading dashes not isolated',
    css: unisolatedCode,
  },
  {
    id: 'NP-2',
    rule: 'NP',
    fixture: 'he-np-001',
    why: 'the question mark is trapped inside an LTR span around the English word',
    html: (h) => h.replace('Windows?', '<span dir="ltr">Windows?</span>'),
  },
  {
    id: 'NP-3',
    rule: 'NP',
    fixture: 'ar-np-001',
    why: 'the final period is trapped inside an LTR span around the email',
    html: (h) => h.replace('lina@example.com.', '<span dir="ltr">lina@example.com.</span>'),
  },
  {
    id: 'NUM-3',
    rule: 'NUM',
    fixture: 'he-num-001',
    why: 'date parts isolated one by one, so they run right to left',
    html: (h) => h.replace('31.12.2026', '<bdi>31</bdi>.<bdi>12</bdi>.<bdi>2026</bdi>'),
  },
  {
    id: 'CODE-3',
    rule: 'CODE',
    fixture: 'ar-code-001',
    why: 'highlighter-style block (code display:block) right-aligned inside an RTL pre',
    css: '.fx pre { direction: rtl; text-align: right; } .fx pre code { display: block; }',
  },
  {
    id: 'LIST-3',
    rule: 'LIST',
    fixture: 'ar-list-001',
    why: 'list indent on the left (physical padding) in an RTL list',
    css: '.fx ol { padding-inline-start: 0; padding-left: 2em; }',
  },
  {
    id: 'LIST-4',
    rule: 'LIST',
    fixture: 'ar-list-001',
    why: 'loose list: each item is a paragraph inside the li, laid out LTR',
    html: (h) => h.replace(/<li>(.*?)<\/li>/g, '<li><p dir="ltr">$1</p></li>'),
  },
  {
    id: 'TBL-2',
    rule: 'TBL',
    fixture: 'ar-tbl-001',
    why: 'cells wrap their text in a div, table keeps LTR column order',
    html: (h) =>
      h
        .replace('<table>', '<table dir="ltr">')
        .replace(/<(td|th)>(.*?)<\/(td|th)>/g, '<$1><div>$2</div></$3>'),
  },
  // Added in task 3.0 (Gate G2 condition): every TRUNC fixture, and tofu from real code points.
  ...['ar-trunc-002', 'ar-trunc-003', 'he-trunc-002', 'he-trunc-003'].map(
    (fixture, k): Bug => ({
      id: `TRUNC-${k + 3}`,
      rule: 'TRUNC',
      fixture,
      why: 'RTL title truncated as LTR: the start is cut',
      css: title,
      html: (h) => h.replace(' dir="rtl"', ' dir="ltr"'),
    }),
  ),
  {
    id: 'TRUNC-7',
    rule: 'TRUNC',
    fixture: 'he-trunc-003',
    why: 'unicode-bidi: plaintext lays the Latin-first title out LTR, so its start is cut',
    css: `${title} .fx p { unicode-bidi: plaintext; }`,
  },
  {
    id: 'FONT-2',
    rule: 'FONT',
    fixture: 'ar-font-002',
    // Sunuwar: the Docker image falls back to Unifont, which covers unassigned and most new code points.
    why: 'a Sunuwar letter (Unicode 16) no font covers (U+11BC1) is drawn as tofu',
    html: (h) => h.replace('</p>', ' \u{11BC1}</p>'),
  },
  {
    id: 'FONT-3',
    rule: 'FONT',
    fixture: 'he-font-001',
    why: 'tofu (Sunuwar U+11BC0, Unicode 16) inside a Hebrew word',
    html: (h) => h.replace('שלום', 'של\u{11BC0}ום'),
  },
  {
    id: 'FONT-4',
    rule: 'FONT',
    fixture: 'ar-font-001',
    why: 'a plane-16 private-use character (6 hex digits) is drawn as tofu',
    html: (h) => h.replace('</p>', ' \u{10FFFD}</p>'),
  },
  // Added in task 3.6 from the pilot's false positives (docs/FALSE_POSITIVES.md).
  {
    id: 'CODE-4',
    rule: 'CODE',
    fixture: 'ar-code-001',
    why: 'CodeMirror code block laid out RTL and right-aligned',
    css: '.fx .cm-content { direction: rtl; text-align: right; }',
    html: codeMirror,
  },
  {
    id: 'NP-4',
    rule: 'NP',
    fixture: 'he-iso-003',
    why: 'an autolink that swallowed the hyphen of "ל-", isolated LTR (plaintext), draws it at the far end',
    css: '.fx a { unicode-bidi: plaintext; }',
    html: autolinkHyphen,
  },
  {
    id: 'BD-4',
    rule: 'BD',
    fixture: 'ar-list-002',
    why: 'list laid out LTR; "Firefox 120" stays intact, so NUM must not fail',
    html: (h) => h.replace(' dir="rtl"', ' dir="ltr"'),
    clean: ['NUM'],
  },
  // FP-6: NextChat's reply bubble shrinks to fit its text, so alignment can't be seen.
  {
    id: 'BD-5',
    rule: 'BD',
    fixture: 'he-bd-001',
    why: 'message laid out LTR in a shrink-to-fit bubble; its alignment has no room to show, so AL must not fail',
    // nowrap: one line at both viewports, like a short chat reply.
    css: '.fx { width: fit-content; white-space: nowrap; }',
    html: (h) => h.replace(' dir="rtl"', ' dir="ltr"'),
    clean: ['AL'],
  },
  {
    id: 'AL-4',
    rule: 'AL',
    fixture: 'he-al-001',
    why: 'narrow shrink-to-fit bubble whose text wraps, left-aligned: the last line shows it',
    css: '.fx { width: fit-content; max-width: 220px; } .fx p { text-align: left; }',
  },
];

export const CONTROLS: ZooPage[] = [
  { id: 'OK-TRUNC-he', fixture: 'he-trunc-001', why: 'RTL title truncated correctly', css: title },
  { id: 'OK-TRUNC-ar', fixture: 'ar-trunc-001', why: 'RTL title truncated correctly', css: title },
  {
    id: 'OK-CLIP-code',
    fixture: 'ar-code-001',
    why: 'message clipped vertically (max-height) with a wide code line: not a truncation',
    css: '.fx { max-height: 4.5em; overflow: hidden; } .fx pre { white-space: pre; }',
  },
  {
    id: 'OK-AL-webkit',
    fixture: 'he-al-001',
    why: 'text-align: -webkit-right is right-aligned',
    css: '.fx { text-align: -webkit-right; }',
  },
  {
    id: 'OK-FONT-large',
    fixture: 'ar-font-001',
    why: 'very large Arabic text is drawn, not tofu',
    css: '.fx { font-size: 160px; }',
  },
  ...['ar-trunc-002', 'ar-trunc-003', 'he-trunc-002', 'he-trunc-003'].map(
    (fixture): ZooPage => ({
      id: `OK-TRUNC-${fixture}`,
      fixture,
      why: 'RTL title truncated correctly',
      css: title,
    }),
  ),
  {
    id: 'OK-TRUNC-padded',
    fixture: 'he-trunc-001',
    why: 'correct truncation inside a padded title box',
    css: `${title} .fx { padding: 0 12px; }`,
  },
  {
    id: 'OK-FONT-symbols',
    fixture: 'he-font-002',
    why: 'text-style symbols (©, ®, ™) are drawn, not tofu',
    html: (h) => h.replace('</p>', ' © ® ™</p>'),
  },
  {
    id: 'OK-CODE-codemirror',
    fixture: 'ar-code-001',
    why: 'code block shown in CodeMirror (div lines, not pre), correctly LTR',
    html: codeMirror,
  },
  {
    id: 'OK-CODE-codemirror-he',
    fixture: 'he-code-002',
    why: 'CodeMirror lines are separate paragraphs: "# בדיקת כניסה" keeps # at the left',
    html: codeMirror,
  },
  {
    id: 'OK-CODE-inline-normal',
    fixture: 'ar-code-001',
    why: 'inline code with direction: rtl but unicode-bidi: normal, which has no effect',
    css: '.fx p code { direction: rtl; unicode-bidi: normal; }',
  },
  {
    id: 'OK-NP-autolink-hyphen',
    fixture: 'he-iso-003',
    why: 'autolink swallowed the hyphen but is not isolated, so the hyphen is drawn in place',
    css: '.fx a { unicode-bidi: normal; }',
    html: autolinkHyphen,
  },
  {
    id: 'OK-AL-shrink-code',
    fixture: 'ar-code-004',
    why: 'one line in a shrink-to-fit bubble ending in padded inline code (NextChat): no visible room',
    css: '.fx { width: fit-content; white-space: nowrap; } .fx p { text-align: left; } .fx code { padding: 2px 6px; }',
  },
  {
    id: 'OK-AL-shrink',
    fixture: 'he-al-001',
    why: 'one line in a shrink-to-fit bubble: text-align: left has no room to show',
    css: '.fx { width: fit-content; white-space: nowrap; } .fx p { text-align: left; }',
  },
];
