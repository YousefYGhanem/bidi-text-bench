import { clientApi } from '../local/server.ts';
import { REFERENCE_CSS } from '../render/reference.ts';

// Expected and actual are visual-order strings (left to right as drawn). They are shown with
// unicode-bidi: bidi-override, a display-only CSS setting; no control characters are added.
export function triagePage(token: string): string {
  return `<!doctype html>
<html lang="en" dir="ltr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Triage</title>
<style>
${REFERENCE_CSS}
body { margin: 0; color: #1a1a1a; }
header, main { max-width: 1100px; margin: 0 auto; padding: 12px 16px; }
header { display: flex; gap: 16px; align-items: baseline; flex-wrap: wrap; border-bottom: 1px solid #ddd; }
h1 { font-size: 18px; margin: 0; }
h2 { font-size: 13px; text-transform: uppercase; letter-spacing: .04em; color: #555; margin: 16px 0 6px; }
.meta { color: #555; font-size: 14px; }
.visual { direction: ltr; unicode-bidi: bidi-override; font-size: 15px; }
.member { border: 1px solid #ddd; border-radius: 6px; padding: 8px; margin-block: 8px; overflow-wrap: anywhere; }
.member img { max-width: 100%; display: block; margin-top: 6px; border: 1px solid #eee; }
dl { display: grid; grid-template-columns: max-content 1fr; gap: 2px 12px; margin: 0; }
dt { color: #555; }
fieldset { border: 1px solid #ddd; margin-block: 8px; }
label { margin-inline-end: 12px; }
input[type=text], textarea, select { font: inherit; }
input[type=text], textarea { width: 100%; box-sizing: border-box; }
.actions { display: flex; gap: 8px; flex-wrap: wrap; margin-block: 12px; }
button { font: inherit; padding: 6px 12px; cursor: pointer; }
kbd { border: 1px solid #aaa; border-radius: 3px; padding: 0 4px; font-size: 12px; }
#status { min-height: 1.5em; font-size: 14px; }
#status.error { color: #b00; }
</style>
</head>
<body>
<header>
  <h1>Triage</h1>
  <span class="meta" id="position"></span>
</header>
<main>
  <p id="status" role="status" aria-live="polite"></p>
  <p id="empty" hidden>No failures in these runs.</p>
  <section id="item" hidden>
    <p class="meta" id="facts"></p>
    <h2>Reference render</h2>
    <div id="render"></div>
    <p class="meta" id="notes"></p>
    <h2>Failures (<span id="count"></span>)</h2>
    <div id="members"></div>
    <h2>Decision</h2>
    <fieldset><legend>Label</legend><div id="labels"></div></fieldset>
    <label for="link">Existing issue (duplicate) or reason (won't report)</label>
    <input type="text" id="link">
    <p><label for="cause">Cause</label> <select id="cause"></select>
       <label for="severity">Severity</label> <select id="severity"></select></p>
    <label for="note">Note</label>
    <textarea id="note" rows="2"></textarea>
    <div class="actions">
      <button id="save" type="button"><kbd>S</kbd> Save</button>
      <button id="prev" type="button"><kbd>K</kbd> Previous</button>
      <button id="next" type="button"><kbd>J</kbd> Next</button>
      <button id="nextOpen" type="button"><kbd>U</kbd> Next untriaged</button>
    </div>
  </section>
</main>
<script>
${clientApi(token)}
let data, index = 0;
const fill = (sel, values) => { $(sel).innerHTML = values.map((v) => '<option>' + esc(v) + '</option>').join(''); };
async function load() {
  data = await api('items');
  if (!data.items.length) { $('empty').hidden = false; return; }
  fill('cause', data.causes);
  fill('severity', data.severities);
  $('labels').innerHTML = data.labels.map((l) => '<label><input type="radio" name="label" value="' + l + '"> ' + l.replace('-', ' ') + '</label>').join('');
  const open = data.items.findIndex((i) => !i.decision);
  show(open === -1 ? 0 : open);
}
function show(i) {
  index = Math.max(0, Math.min(data.items.length - 1, i));
  const it = data.items[index];
  const open = data.items.filter((x) => !x.decision).length;
  $('item').hidden = false;
  $('position').textContent = (index + 1) + ' of ' + data.items.length + ' · ' + open + ' untriaged';
  $('facts').textContent = it.run + ' · ' + it.fixture + ' · ' + it.surface + ' · ' + (it.rule ?? 'ERROR') + ' · ' + it.severity + (it.decision ? ' · triaged: ' + it.decision.label : '');
  $('render').innerHTML = it.html;
  $('notes').textContent = it.notes ?? '';
  $('count').textContent = it.members.length;
  $('members').innerHTML = it.members.map((m) => {
    const ev = m.evidence;
    const row = (k, v, cls = '') => v ? '<dt>' + k + '</dt><dd class="' + cls + '">' + esc(v) + '</dd>' : '';
    return '<div class="member"><dl>' + row('browser', m.browser + ' · ' + m.viewport) + row('detail', ev.detail) +
      row('expected', ev.expected, 'visual') + row('actual', ev.actual, 'visual') +
      row('styles', ev.styles && JSON.stringify(ev.styles)) + '</dl>' +
      (ev.screenshot ? '<img alt="evidence for ' + esc(m.fixture + ' in ' + m.browser) + '" src="' + fileUrl(it.run + '/' + ev.screenshot) + '">' : '') + '</div>';
  }).join('');
  const d = it.decision;
  for (const r of document.getElementsByName('label')) r.checked = d?.label === r.value;
  $('cause').value = d?.cause ?? 'other';
  $('severity').value = d?.severity ?? it.severity;
  $('link').value = d?.link ?? '';
  $('note').value = d?.note ?? '';
}
async function save() {
  const it = data.items[index];
  const label = [...document.getElementsByName('label')].find((r) => r.checked)?.value;
  if (!label) return status('Pick a label.', true);
  try {
    it.decision = await api('decide', { run: it.run, key: it.key, label, cause: $('cause').value, severity: $('severity').value, link: $('link').value, note: $('note').value });
    status('Saved ' + it.fixture + ' (' + label + ').');
    nextOpen();
  } catch (err) { status(err.message, true); }
}
function nextOpen() {
  const n = data.items.length;
  for (let k = 1; k <= n; k++) if (!data.items[(index + k) % n].decision) return show((index + k) % n);
  show(index);
}
$('save').onclick = save;
$('prev').onclick = () => show(index - 1);
$('next').onclick = () => show(index + 1);
$('nextOpen').onclick = nextOpen;
document.addEventListener('keydown', (e) => {
  if (e.target.closest('input[type=text], textarea, select') || e.ctrlKey || e.metaKey || e.altKey || $('item').hidden) return;
  const k = e.key.toLowerCase();
  if (k === 's') save(); else if (k === 'j') show(index + 1); else if (k === 'k') show(index - 1); else if (k === 'u') nextOpen();
});
load().catch((err) => status(err.message, true));
</script>
</body>
</html>`;
}
