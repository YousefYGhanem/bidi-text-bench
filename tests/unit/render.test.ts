import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { Fixture } from '../../src/corpus/validate.ts';
import { GOLDEN_PATH, goldenHtml } from '../../src/render/golden.ts';
import { renderFixture } from '../../src/render/reference.ts';

const fx = (over: Partial<Fixture>): Fixture => ({
  id: 'he-iso-999',
  lang: 'he',
  category: 'ISO',
  title: 't',
  text: 'שלום',
  markdown: false,
  base_direction: 'rtl',
  isolate_spans: [],
  author_spans: [],
  expected_notes: 'n',
  status: 'draft',
  verification: null,
  ...over,
});

describe('renderFixture', () => {
  it('sets id, lang and the expected base direction on the article', () => {
    expect(renderFixture(fx({}))).toMatch(
      /^<article class="fx" id="he-iso-999" lang="he" dir="rtl">/,
    );
  });

  it('escapes plain text and isolates each renderer-owned span in <bdi>', () => {
    const html = renderFixture(
      fx({ text: 'כתבו ל-lina@example.com <b>', isolate_spans: ['lina@example.com'] }),
    );
    expect(html).toContain('<bdi>lina@example.com</bdi>');
    expect(html).toContain('&#60;b&#62;');
  });

  it('renders Markdown code as <code> and neutralises raw HTML', () => {
    const html = renderFixture(
      fx({ markdown: true, text: 'הריצו `npm test` <script>alert(1)</script>' }),
    );
    expect(html).toContain('<code>npm test</code>');
    expect(html).not.toContain('<script>');
  });
});

it('zoo/golden.html is up to date (run npm run golden)', () => {
  expect(readFileSync(GOLDEN_PATH, 'utf8')).toBe(goldenHtml());
});
