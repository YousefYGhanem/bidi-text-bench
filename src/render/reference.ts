// Reference renderer: each fixture with the markup a correct UI would use (dir, isolates,
// logical CSS). Used by the review tool and as zoo/golden.html. It does not compute the
// expected visual order; that is the engine's job (docs/CHECKER_SPEC.md §2).
import { Marked } from 'marked';
import type { Fixture } from '../corpus/validate.ts';

export const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

// Fixtures can arrive in contributors' PRs: raw HTML inside Markdown is shown as text, never run.
const markdown = new Marked({ gfm: true, renderer: { html: ({ text }) => escapeHtml(text) } });

// Renderer-owned spans get <bdi> (direction from their content). Author-owned spans are shown as
// correctly authored: an LTR isolate, as if the author had added LRI…PDI (FIXTURE_SPEC §1.7).
const isolateTag = (fx: Fixture, span: string) =>
  fx.author_spans.includes(span) ? '<bdi dir="ltr">' : '<bdi>';

/** Plain text, escaped, with each listed span isolated (FIXTURE_SPEC §1.7). */
function plainText(fx: Fixture): string {
  const spans = [...new Set([...fx.isolate_spans, ...fx.author_spans])].sort(
    (a, b) => b.length - a.length,
  );
  let html = '';
  let i = 0;
  while (i < fx.text.length) {
    const span = spans.find((s) => fx.text.startsWith(s, i));
    if (span) {
      html += `${isolateTag(fx, span)}${escapeHtml(span)}</bdi>`;
      i += span.length;
    } else {
      html += escapeHtml(fx.text[i] as string);
      i += 1;
    }
  }
  return `<p>${html.replaceAll('\n', '<br>')}</p>`;
}

/**
 * In rendered Markdown, isolate each listed span that is not already inside code or a link
 * (mentions, for example). Only text between tags is touched, never attributes.
 */
function isolateLooseSpans(fx: Fixture, html: string, spans: string[]): string {
  let inside = 0;
  return html
    .split(/(<[^>]+>)/)
    .map((part) => {
      if (part.startsWith('<')) {
        if (/^<(code|a|pre)\b/i.test(part)) inside++;
        else if (/^<\/(code|a|pre)>/i.test(part)) inside--;
        return part;
      }
      if (inside > 0) return part;
      return spans.reduce((text, s) => text.replaceAll(s, `${isolateTag(fx, s)}${s}</bdi>`), part);
    })
    .join('');
}

export function renderFixture(fx: Fixture): string {
  // Spans with HTML-special characters are left alone here; in practice those are code or links.
  const loose = [...fx.isolate_spans, ...fx.author_spans].filter((s) => s === escapeHtml(s));
  const body = fx.markdown
    ? isolateLooseSpans(fx, markdown.parse(fx.text, { async: false }) as string, loose)
    : plainText(fx);
  return `<article class="fx" id="${escapeHtml(fx.id)}" lang="${fx.lang}" dir="${fx.base_direction}">\n${body.trim()}\n</article>`;
}

export const REFERENCE_CSS = `
body { margin: 24px; font: 16px/1.6 "Noto Sans Arabic", "Noto Sans Hebrew", "Noto Sans", sans-serif; }
.fx { max-width: 760px; margin-block: 0 24px; padding: 12px 16px; border: 1px solid #ccc; text-align: start; }
.fx p, .fx ul, .fx ol, .fx blockquote, .fx table, .fx pre { margin-block: 0 8px; }
.fx code, .fx kbd, .fx samp { direction: ltr; unicode-bidi: isolate; font-family: "Noto Sans Mono", monospace; }
.fx pre { direction: ltr; unicode-bidi: isolate; text-align: left; padding: 8px; background: #f4f4f4; overflow-x: auto; }
.fx a { unicode-bidi: plaintext; }
.fx ul, .fx ol { padding-inline-start: 2em; }
.fx blockquote { margin-inline: 0; padding-inline-start: 12px; border-inline-start: 3px solid #999; }
.fx th, .fx td { text-align: start; padding: 4px 8px; border: 1px solid #ccc; }
`.trim();

export function renderPage(fixtures: Fixture[], title: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>
${REFERENCE_CSS}
</style>
</head>
<body>
${fixtures.map(renderFixture).join('\n')}
</body>
</html>
`;
}
