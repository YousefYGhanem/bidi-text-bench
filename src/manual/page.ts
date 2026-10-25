import { clientApi } from '../local/server.ts';
import { escapeHtml, REFERENCE_CSS } from '../render/reference.ts';

// The helper's chrome is English (LTR); the prompt and the reference render carry their own dir.
export function manualPage(token: string, targetName: string): string {
  return `<!doctype html>
<html lang="en" dir="ltr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Manual run: ${escapeHtml(targetName)}</title>
<style>
${REFERENCE_CSS}
body { margin: 0; color: #1a1a1a; }
header, main { max-width: 960px; margin: 0 auto; padding: 12px 16px; }
header { display: flex; gap: 16px; align-items: baseline; flex-wrap: wrap; border-bottom: 1px solid #ddd; }
h1 { font-size: 18px; margin: 0; }
h2 { font-size: 13px; text-transform: uppercase; letter-spacing: .04em; color: #555; margin: 16px 0 6px; }
.meta { color: #555; font-size: 14px; }
label { display: block; margin-block: 6px; }
input[type=text], textarea { width: 100%; font: inherit; box-sizing: border-box; padding: 4px; }
pre.prompt { white-space: pre-wrap; border: 1px solid #ddd; padding: 8px; margin: 0; font: inherit; }
.paste { border: 2px dashed #999; border-radius: 6px; min-height: 80px; padding: 8px; }
.paste:focus { outline: 3px solid #0057b8; }
.paste img { max-width: 100%; display: block; }
.pastes { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
@media (max-width: 640px) { .pastes { grid-template-columns: 1fr; } }
table { border-collapse: collapse; }
td, th { padding: 4px 8px; border-bottom: 1px solid #eee; text-align: start; }
.actions { display: flex; gap: 8px; flex-wrap: wrap; margin-block: 12px; }
button { font: inherit; padding: 6px 12px; cursor: pointer; }
kbd { border: 1px solid #aaa; border-radius: 3px; padding: 0 4px; font-size: 12px; }
#status { min-height: 1.5em; font-size: 14px; }
#status.error { color: #b00; }
</style>
</head>
<body>
<header>
  <h1>Manual run: ${escapeHtml(targetName)}</h1>
  <span class="meta" id="position"></span>
</header>
<main>
  <p id="status" role="status" aria-live="polite"></p>
  <form id="envForm" hidden>
    <h2>Environment (AUDIT_PROTOCOL §2)</h2>
    <label>Product version (as shown in the product, or "web, no version shown")<input type="text" name="productVersion" required></label>
    <label>OS<input type="text" name="os" required placeholder="Windows 11 24H2"></label>
    <label>Browser and version, or app<input type="text" name="browser" required placeholder="Chrome 156"></label>
    <label>Window size<input type="text" name="window" required placeholder="1280×800"></label>
    <label>Product UI language<input type="text" name="uiLanguage" required placeholder="English"></label>
    <button type="submit">Save environment</button>
  </form>
  <section id="item" hidden>
    <p class="meta" id="facts"></p>
    <h2>1. Prompt</h2>
    <pre class="prompt" id="prompt"></pre>
    <div class="actions"><button id="copy" type="button"><kbd>C</kbd> Copy prompt</button></div>
    <h2>2–3. Screenshots (click a box, then paste with Ctrl+V)</h2>
    <div class="pastes">
      <div><p class="meta" id="inputLabel">Compose box, before sending</p><div class="paste" id="pasteInput" tabindex="0" role="button" aria-labelledby="inputLabel"></div></div>
      <div><p class="meta" id="replyLabel">The reply</p><div class="paste" id="pasteReply" tabindex="0" role="button" aria-labelledby="replyLabel"></div></div>
    </div>
    <h2>Reference render (what correct looks like)</h2>
    <div id="render"></div>
    <p class="meta" id="notes"></p>
    <h2>4. Checks</h2>
    <table><thead><tr><th>Surface</th><th>Check</th><th>Pass</th><th>Fail</th><th>N.a.</th></tr></thead><tbody id="checks"></tbody></table>
    <label>Note<textarea id="note" rows="2"></textarea></label>
    <label><input type="checkbox" id="changed"> The model changed the text (retry once first)</label>
    <div class="actions">
      <button id="save" type="button"><kbd>S</kbd> Save</button>
      <button id="prev" type="button"><kbd>K</kbd> Previous</button>
      <button id="next" type="button"><kbd>J</kbd> Next</button>
    </div>
  </section>
</main>
<script>
${clientApi(token)}
let items = [], index = 0, pasted = {};
async function load() {
  const s = await api('state');
  items = s.items;
  if (!s.env) { $('envForm').hidden = false; return; }
  $('envForm').hidden = true;
  const first = items.findIndex((i) => !i.saved.length);
  show(first === -1 ? 0 : first);
}
function show(i) {
  index = Math.max(0, Math.min(items.length - 1, i));
  const { fx, html, prompt, checks, saved } = items[index];
  pasted = {};
  $('item').hidden = false;
  $('position').textContent = (index + 1) + ' of ' + items.length + ' · ' + items.filter((x) => x.saved.length).length + ' saved';
  $('facts').textContent = fx.id + ' · ' + fx.category + ' · ' + fx.severity + (saved.length ? ' · saved' : '');
  $('prompt').textContent = prompt;
  $('prompt').dir = 'auto';
  $('render').innerHTML = html;
  $('notes').textContent = fx.expected_notes;
  const byKey = Object.fromEntries(saved.map((l) => [l.surface + ':' + l.rule, l.status]));
  $('checks').innerHTML = checks.map((c) => {
    const key = c.surface + ':' + c.rule;
    return '<tr><td>' + esc(c.surface) + '</td><th scope="row">' + esc(c.rule) + '</th>' + ['pass', 'fail', 'na'].map((v) =>
      '<td><input type="radio" name="' + esc(key) + '" value="' + v + '" aria-label="' + esc(c.rule + ' ' + v) + '"' + (byKey[key] === v ? ' checked' : '') + '></td>').join('') + '</tr>';
  }).join('');
  $('note').value = saved[0]?.evidence?.detail?.replace(/^content changed:? ?/, '') ?? '';
  $('changed').checked = saved.some((l) => l.status === 'error');
  for (const [box, kind] of [['pasteInput', 'input'], ['pasteReply', 'reply']]) {
    const shot = saved.find((l) => l.evidence?.screenshot?.endsWith('-' + kind + '.png'))?.evidence.screenshot;
    $(box).innerHTML = shot ? '<img alt="saved ' + kind + ' screenshot" src="' + fileUrl(shot) + '">' : '';
  }
}
for (const [box, kind] of [['pasteInput', 'input'], ['pasteReply', 'reply']]) {
  $(box).addEventListener('paste', (e) => {
    const file = [...e.clipboardData.items].find((x) => x.type.startsWith('image/'))?.getAsFile();
    if (!file) return status('The clipboard holds no image.', true);
    e.preventDefault();
    const reader = new FileReader();
    reader.onload = () => { pasted[kind] = reader.result; $(box).innerHTML = '<img alt="pasted ' + kind + ' screenshot" src="' + reader.result + '">'; };
    reader.readAsDataURL(file);
  });
}
$('envForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  try { await api('env', Object.fromEntries(new FormData(e.target))); status('Environment saved.'); load(); }
  catch (err) { status(err.message, true); }
});
async function save() {
  const { fx, checks } = items[index];
  const statuses = {};
  for (const c of checks) {
    const v = document.querySelector('input[name="' + CSS.escape(c.surface + ':' + c.rule) + '"]:checked')?.value;
    if (v) statuses[c.surface + ':' + c.rule] = v;
  }
  const changed = $('changed').checked;
  if (!changed && Object.keys(statuses).length < checks.length) return status('Mark every check, or tick "the model changed the text".', true);
  try {
    const r = await api('save', { id: fx.id, statuses, note: $('note').value, contentChanged: changed, ...pasted });
    items[index].saved = r.lines;
    status('Saved ' + fx.id + '.');
    show(index + 1);
  } catch (err) { status(err.message, true); }
}
$('copy').onclick = async () => { await navigator.clipboard.writeText(items[index].prompt); status('Prompt copied.'); };
$('save').onclick = save;
$('prev').onclick = () => show(index - 1);
$('next').onclick = () => show(index + 1);
document.addEventListener('keydown', (e) => {
  if (e.target.closest('input[type=text], textarea') || e.ctrlKey || e.metaKey || e.altKey || $('item').hidden) return;
  const k = e.key.toLowerCase();
  if (k === 'c') $('copy').click(); else if (k === 's') save(); else if (k === 'j') show(index + 1); else if (k === 'k') show(index - 1);
});
load().catch((err) => status(err.message, true));
</script>
</body>
</html>`;
}
