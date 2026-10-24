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
}

const noDir = (h: string) => h.replace(' dir="rtl"', '');
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
  {
    id: 'ISO-3',
    rule: 'ISO',
    fixture: 'he-iso-004',
    why: 'mention not isolated: the @ jumps',
    html: (h) => h.replace('<bdi>@noam-dev</bdi>', '@noam-dev'),
  },
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
];
