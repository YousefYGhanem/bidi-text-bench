// Builds test pages from the seed fixtures for the fitlocale hands-on (task 0.6).
// Each seed gets 3 variants: golden (correct markup), nodir (no dir anywhere) and auto
// (first-strong dir="auto" with unisolated code), plus 4 UI-shell pages for fitlocale's
// mirroring, font and clipped-mark rules.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { marked } from 'marked';
import YAML from 'yaml';

// The 11 seeds run on 2026-10-22. Task 1.4 moved them from _seed.yaml into category files.
const SEED_IDS = [
  'ar-bd-001',
  'ar-iso-001',
  'ar-np-001',
  'ar-num-001',
  'ar-code-001',
  'he-bd-001',
  'he-iso-001',
  'he-np-001',
  'he-np-002',
  'he-num-001',
  'he-list-001',
];
const seeds = SEED_IDS.map((id) => {
  const [lang, category] = id.split('-');
  const file = `../../corpus/fixtures/${lang}/${category}.yaml`;
  return YAML.parse(readFileSync(file, 'utf8')).find((f) => f.id === id);
});
const esc = (s) => s.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);
const body = (fx) => (fx.markdown ? marked.parse(fx.text) : `<p>${esc(fx.text)}</p>`);
const base = 'body{font:16px/1.5 sans-serif;margin:24px}.msg{max-width:900px}';

const variants = {
  golden: (fx) => ({
    html: `lang="${fx.lang}" dir="rtl"`,
    css: `${base}.msg code{direction:ltr;unicode-bidi:isolate}.msg pre{direction:ltr;text-align:left;unicode-bidi:isolate}`,
    msg: `dir="${fx.base_direction}" lang="${fx.lang}"`,
  }),
  nodir: (fx) => ({ html: `lang="${fx.lang}"`, css: base, msg: '' }),
  auto: (fx) => ({ html: `lang="${fx.lang}" dir="rtl"`, css: base, msg: 'dir="auto"' }),
};

const page = (html, css, content) =>
  `<!doctype html><html ${html}><head><meta charset="utf-8"><style>${css}</style></head><body>${content}</body></html>\n`;

mkdirSync('pages', { recursive: true });
const index = [];
for (const fx of seeds) {
  for (const [variant, make] of Object.entries(variants)) {
    const v = make(fx);
    const file = `${fx.id}.${variant}.html`;
    writeFileSync(
      `pages/${file}`,
      page(v.html, v.css, `<div class="msg" ${v.msg}>${body(fx)}</div>`),
    );
    index.push({
      file,
      kind: 'message',
      fixture: fx.id,
      category: fx.category,
      lang: fx.lang,
      variant,
    });
  }
}

// UI shells. The English ones run fitlocale's pseudo-rtl mirroring mode.
const chevron =
  '<svg class="icon-chevron-left" width="16" height="16" viewBox="0 0 16 16"><path d="M10 2 4 8l6 6" fill="none" stroke="currentColor" stroke-width="2"/></svg>';
const shell = () =>
  `<nav class="sidebar">Chats</nav><main><button class="back" aria-label="Back">${chevron}</button><h1>Settings</h1><p>Language and region</p></main>`;
const physical = `${base}.sidebar{position:absolute;left:0;top:0;width:200px;height:100vh;background:#eee}main{margin-left:220px}.back{float:left}`;
const logical = `${base}.sidebar{position:absolute;inset-inline-start:0;top:0;width:200px;height:100vh;background:#eee}main{margin-inline-start:220px}.back{float:inline-start}:dir(rtl) .icon-chevron-left{transform:scaleX(-1)}`;
writeFileSync('pages/shell-en-physical.html', page('lang="en"', physical, shell()));
writeFileSync('pages/shell-en-logical.html', page('lang="en"', logical, shell()));
index.push({ file: 'shell-en-physical.html', kind: 'shell-en', variant: 'physical' });
index.push({ file: 'shell-en-logical.html', kind: 'shell-en', variant: 'logical' });

// RTL shells: a one-line title in a font without Arabic/Hebrew glyphs, with a tight line box.
for (const fx of seeds.filter((f) => f.category === 'BD')) {
  const css = `${base}h1{font:24px/1 "Liberation Sans";height:24px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;width:320px}`;
  const file = `shell-${fx.lang}-tight.html`;
  writeFileSync(
    `pages/${file}`,
    page(`lang="${fx.lang}" dir="rtl"`, css, `<h1>${esc(fx.text)}</h1>`),
  );
  index.push({ file, kind: 'shell-rtl', lang: fx.lang, variant: 'tight-fallback' });
}

// Controls for rtl/bidi-order: the same values with and without an RTL letter in the token.
const controls = {
  'ctl-he-cpp-noprefix': ['he', 'אני כותב C++ כבר חמש שנים.'],
  'ctl-he-cpp-prefix': ['he', 'אני כותב קוד ב-C++ כבר חמש שנים.'],
  'ctl-ar-usd': ['ar', 'السعر $220 شهريًا.'],
  'ctl-he-usd': ['he', 'המחיר $220 לחודש.'],
};
for (const [id, [lang, text]] of Object.entries(controls)) {
  const file = `${id}.html`;
  writeFileSync(
    `pages/${file}`,
    page(`lang="${lang}" dir="rtl"`, base, `<div class="msg" dir="rtl"><p>${esc(text)}</p></div>`),
  );
  index.push({ file, kind: 'control', lang, variant: id });
}

writeFileSync('pages/index.json', `${JSON.stringify(index, null, 2)}\n`);
console.log(`${index.length} pages`);
