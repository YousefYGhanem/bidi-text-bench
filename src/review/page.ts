import { escapeHtml, REFERENCE_CSS } from '../render/reference.ts';

// The page's chrome is English (LTR); each fixture panel carries its own lang and dir.
export function reviewPage(token: string, reviewer: string): string {
  return `<!doctype html>
<html lang="en" dir="ltr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Fixture review</title>
<style>
${REFERENCE_CSS}
body { margin: 0; color: #1a1a1a; }
header, main { max-width: 960px; margin: 0 auto; padding: 12px 16px; }
header { display: flex; gap: 16px; align-items: baseline; border-bottom: 1px solid #ddd; }
h1 { font-size: 18px; margin: 0; }
h2 { font-size: 13px; text-transform: uppercase; letter-spacing: .04em; color: #555; margin: 16px 0 6px; }
.meta { color: #555; font-size: 14px; }
.chips { direction: ltr; display: flex; flex-wrap: wrap; gap: 3px; }
.chip { unicode-bidi: isolate; display: inline-flex; flex-direction: column; align-items: center; min-width: 28px; padding: 2px 3px; border: 1px solid #ddd; border-radius: 4px; font-size: 15px; }
.chip small { font: 9px/1.2 "Noto Sans Mono", monospace; color: #666; }
.chip.ctrl { border-color: #b00; background: #fee; }
.notes { white-space: pre-wrap; }
mark { background: #ffe58a; }
textarea { width: 100%; min-height: 48px; font: inherit; box-sizing: border-box; }
.actions { display: flex; gap: 8px; flex-wrap: wrap; margin-block: 12px; }
button { font: inherit; padding: 6px 12px; cursor: pointer; }
kbd { border: 1px solid #aaa; border-radius: 3px; padding: 0 4px; font-size: 12px; }
#status { min-height: 1.5em; font-size: 14px; }
#status.error { color: #b00; }
dialog { max-width: 420px; }
</style>
</head>
<body>
<header>
  <h1>Fixture review</h1>
  <span class="meta" id="position"></span>
  <span class="meta">Reviewer: ${escapeHtml(reviewer)}</span>
</header>
<main>
  <p id="status" role="status" aria-live="polite"></p>
  <div id="empty" hidden><p>No drafts left to review.</p></div>
  <section id="item" hidden>
    <p class="meta" id="facts"></p>
    <h2>Reference render</h2>
    <div id="render"></div>
    <h2>Logical text (typed order)</h2>
    <div class="chips" id="chips"></div>
    <h2>Spans</h2>
    <p class="meta" id="spans"></p>
    <h2>Expected notes</h2>
    <p class="notes" id="notes"></p>
    <h2><label for="note">Note (optional)</label></h2>
    <textarea id="note" aria-keyshortcuts="N"></textarea>
    <div class="actions">
      <button id="approve" aria-keyshortcuts="A"><kbd>A</kbd> Approve</button>
      <button id="fix" aria-keyshortcuts="F"><kbd>F</kbd> Needs fix</button>
      <button id="reject" aria-keyshortcuts="X"><kbd>X</kbd> Reject</button>
      <button id="prev" aria-keyshortcuts="K"><kbd>K</kbd> Previous</button>
      <button id="next" aria-keyshortcuts="J"><kbd>J</kbd> Next</button>
      <button id="reload" aria-keyshortcuts="R"><kbd>R</kbd> Reload</button>
      <button id="help" aria-keyshortcuts="?"><kbd>?</kbd> Keys</button>
    </div>
  </section>
  <dialog id="keys">
    <p><kbd>A</kbd> approve · <kbd>F</kbd> needs fix · <kbd>X</kbd> reject</p>
    <p><kbd>J</kbd>/<kbd>K</kbd> next/previous · <kbd>R</kbd> reload after editing the YAML</p>
    <p><kbd>N</kbd> write a note, <kbd>Esc</kbd> to leave it · <kbd>?</kbd> this help</p>
    <form method="dialog"><button>Close</button></form>
  </dialog>
</main>
<script>
const TOKEN = ${JSON.stringify(token)};
const BIDI = /[\\u061C\\u200E\\u200F\\u202A-\\u202E\\u2066-\\u2069]/u;
let drafts = [], index = 0;
const $ = (id) => document.getElementById(id);
const esc = (s) => s.replace(/[&<>"']/g, (c) => '&#' + c.charCodeAt(0) + ';');
const say = (text, error = false) => { $('status').textContent = text; $('status').className = error ? 'error' : ''; };

async function load(keepId) {
  const res = await fetch('/api/drafts', { headers: { 'x-review-token': TOKEN } });
  drafts = await res.json();
  const at = keepId ? drafts.findIndex((d) => d.fx.id === keepId) : -1;
  index = at >= 0 ? at : Math.min(index, Math.max(drafts.length - 1, 0));
  show();
}

function show() {
  $('empty').hidden = drafts.length > 0;
  $('item').hidden = drafts.length === 0;
  $('position').textContent = drafts.length ? (index + 1) + ' / ' + drafts.length : '0 drafts';
  if (!drafts.length) return;
  const { fx, html, file } = drafts[index];
  $('facts').textContent = (drafts[index].stale ? 'RE-VERIFY (changed since you verified it) · ' : '') + fx.id + ' · ' + fx.category + ' · ' + fx.severity + ' · surfaces: ' + fx.surfaces.join(', ') + ' · ' + file + ' · ' + fx.title;
  $('render').innerHTML = html;
  $('chips').innerHTML = [...fx.text].map((c) => {
    const cp = 'U+' + c.codePointAt(0).toString(16).toUpperCase().padStart(4, '0');
    const shown = c === '\\n' ? '↵' : c === ' ' ? '␣' : BIDI.test(c) ? '◊' : c;
    return '<span class="chip' + (BIDI.test(c) ? ' ctrl' : '') + '"><span>' + esc(shown) + '</span><small>' + cp + '</small></span>';
  }).join('');
  const list = (xs) => xs.length ? xs.map((s) => '<bdi>' + esc(s) + '</bdi>').join(', ') : 'none';
  $('spans').innerHTML = 'isolate_spans: ' + list(fx.isolate_spans) + ' · author_spans: ' + list(fx.author_spans);
  $('notes').innerHTML = esc(fx.expected_notes).replace(/NEEDS-YOUSEF/g, '<mark>NEEDS-YOUSEF</mark>');
  $('note').value = '';
}

// One decision at a time: keys pressed while a decision is in flight are ignored, so a
// fast second key can never act on the fixture that is about to leave the queue.
let busy = false;
async function decide(decision) {
  if (!drafts.length || busy) return;
  busy = true;
  try { await submit(decision); } finally { busy = false; }
}

async function submit(decision) {
  const id = drafts[index].fx.id;
  const res = await fetch('/api/decision', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-review-token': TOKEN },
    body: JSON.stringify({ id, decision, note: $('note').value }),
  });
  const out = await res.json();
  if (!res.ok) return say(out.error, true);
  // Approved and rejected fixtures leave the queue; a needs-fix one stays, so move past it.
  await load();
  if (decision === 'needs-fix') move(1);
  say(id + ': ' + decision + ' recorded.');
}

const move = (d) => { if (drafts.length) { index = (index + d + drafts.length) % drafts.length; show(); } };
const actions = { approve: () => decide('approve'), fix: () => decide('needs-fix'), reject: () => decide('reject'),
  next: () => move(1), prev: () => move(-1), reload: () => load(drafts[index]?.fx.id).then(() => say('Reloaded.')), help: () => $('keys').showModal() };
for (const [id, fn] of Object.entries(actions)) $(id).addEventListener('click', fn);
const keys = { a: 'approve', f: 'fix', x: 'reject', j: 'next', k: 'prev', r: 'reload', '?': 'help' };
document.addEventListener('keydown', (e) => {
  if (e.target === $('note')) { if (e.key === 'Escape') $('note').blur(); return; }
  if (e.ctrlKey || e.metaKey || e.altKey || $('keys').open || busy) return;
  if (e.key === 'n') { e.preventDefault(); $('note').focus(); return; }
  const action = keys[e.key.toLowerCase()];
  if (action) { e.preventDefault(); actions[action](); }
});
load().catch((e) => say(String(e), true));
</script>
</body>
</html>
`;
}
