import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { Ajv } from 'ajv';

export interface Fixture {
  id: string;
  lang: 'ar' | 'he';
  category: string;
  text: string;
  title: string;
  markdown: boolean;
  base_direction: 'rtl' | 'ltr';
  isolate_spans: string[];
  author_spans: string[];
  expected_notes: string;
  status: 'draft' | 'verified' | 'rejected';
  verification: { by: string; at: string; hash: string } | null;
  [key: string]: unknown;
}

export interface FixtureFile {
  /** Repo-relative path with forward slashes, e.g. corpus/fixtures/ar/iso.yaml */
  path: string;
  fixtures: unknown;
}

const schema = JSON.parse(
  readFileSync(new URL('../../corpus/schema/fixture.schema.json', import.meta.url), 'utf8'),
);
const checkSchema = new Ajv({ allErrors: true }).compile(schema);

// ALM, LRM, RLM, the legacy embeddings/overrides and the isolates.
const BIDI_CONTROLS = /[؜‎‏‪-‮⁦-⁩]/gu;
const codePoint = (c: string) =>
  `U+${(c.codePointAt(0) ?? 0).toString(16).toUpperCase().padStart(4, '0')}`;

/** JSON with object keys sorted at every level and no whitespace. */
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

/** FIXTURE_SPEC §4: SHA-256 of the canonical JSON of the fields a native reader verifies. */
export function fixtureHash(fx: Fixture): string {
  const { lang, text, markdown, base_direction, isolate_spans, author_spans, expected_notes } = fx;
  const payload = {
    lang,
    text,
    markdown,
    base_direction,
    isolate_spans,
    author_spans,
    expected_notes,
  };
  return createHash('sha256').update(canonicalJson(payload)).digest('hex');
}

/** Returns one message per problem; an empty list means the corpus is valid. */
export function validateFixtures(files: FixtureFile[]): string[] {
  const errors: string[] = [];
  const seen = new Map<string, string>();

  for (const file of files) {
    if (!Array.isArray(file.fixtures)) {
      errors.push(`${file.path}: must be a YAML list of fixtures`);
      continue;
    }
    const parts = file.path.split('/');
    const dirLang = parts.at(-2);
    const base = (parts.at(-1) ?? '').replace(/\.ya?ml$/, '');

    file.fixtures.forEach((raw, i) => {
      const where = `${file.path}[${i}]${(raw as { id?: string })?.id ? ` ${(raw as { id: string }).id}` : ''}`;
      if (!checkSchema(raw)) {
        for (const e of checkSchema.errors ?? [])
          errors.push(`${where}: schema: ${e.instancePath || '/'} ${e.message}`);
        return;
      }
      const fx = raw as Fixture;
      const err = (msg: string) => errors.push(`${where}: ${msg}`);

      const first = seen.get(fx.id);
      if (first) err(`duplicate id (first seen in ${first})`);
      else seen.set(fx.id, file.path);

      if (!fx.id.startsWith(`${fx.lang}-${fx.category.toLowerCase()}-`))
        err(`id must start with "${fx.lang}-${fx.category.toLowerCase()}-"`);
      if (dirLang !== fx.lang) err(`lang "${fx.lang}" does not match folder "${dirLang}"`);
      // Files starting with "_" (the seeds) hold mixed categories until task 1.4.
      if (!base.startsWith('_') && base !== fx.category.toLowerCase())
        err(`category ${fx.category} does not belong in ${base}.yaml`);

      for (const span of [...fx.isolate_spans, ...fx.author_spans])
        if (!fx.text.includes(span)) err(`span "${span}" is not a substring of text`);

      for (const [field, value] of Object.entries({
        title: fx.title,
        text: fx.text,
        expected_notes: fx.expected_notes,
        spans: [...fx.isolate_spans, ...fx.author_spans].join('\n'),
      }))
        if (value !== value.normalize('NFC')) err(`${field} is not NFC-normalised`);

      const controls = new Set(
        [fx.title, fx.text, ...fx.isolate_spans, ...fx.author_spans]
          .join('\n')
          .match(BIDI_CONTROLS) ?? [],
      );
      for (const c of controls)
        if (!fx.expected_notes.toUpperCase().includes(codePoint(c)))
          err(`bidi control ${codePoint(c)} is present but expected_notes does not name it`);

      if (fx.status === 'draft' && fx.verification !== null)
        err('a draft must have verification: null');
      if (fx.status === 'verified') {
        if (!fx.verification) err('a verified fixture needs a verification record');
        else if (fx.verification.hash !== fixtureHash(fx))
          err(
            'verification hash does not match the current content: re-verify with npm run review',
          );
      }
    });
  }
  return errors;
}
