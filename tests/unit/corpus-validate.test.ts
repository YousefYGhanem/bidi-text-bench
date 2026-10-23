import { describe, expect, it } from 'vitest';
import { allFixtures, loadFixtureFiles } from '../../src/corpus/load.ts';
import {
  canonicalJson,
  type Fixture,
  fixtureHash,
  isStale,
  openQuestions,
  validateFixtures,
} from '../../src/corpus/validate.ts';

// A real fixture reset to draft, so these tests don't depend on Yousef's review state.
const base = (): Fixture => ({
  ...structuredClone(allFixtures(loadFixtureFiles()).find((f) => f.id === 'ar-iso-001') as Fixture),
  status: 'draft',
  verification: null,
});
const check = (fixtures: unknown[], path = 'corpus/fixtures/ar/iso.yaml') =>
  validateFixtures([{ path, fixtures }]);

describe('validateFixtures', () => {
  it('accepts the committed corpus', () => {
    expect(validateFixtures(loadFixtureFiles())).toEqual([]);
  });

  it('accepts a well-formed fixture in its category file', () => {
    expect(check([base()])).toEqual([]);
  });

  it('rejects INP, STRM and DIAC, which are no longer categories (ADR-0003)', () => {
    for (const category of ['INP', 'STRM', 'DIAC']) {
      expect(check([{ ...base(), category }]).join()).toMatch(/schema: \/category/);
    }
  });

  it('rejects unknown fields', () => {
    expect(check([{ ...base(), extra: 1 }]).join()).toMatch(/additional properties/);
  });

  it('rejects duplicate ids across files', () => {
    const errors = validateFixtures([
      { path: 'corpus/fixtures/ar/iso.yaml', fixtures: [base()] },
      { path: 'corpus/fixtures/ar/_seed.yaml', fixtures: [base()] },
    ]);
    expect(errors.join()).toMatch(/duplicate id/);
  });

  it('rejects an id that does not match lang and category', () => {
    expect(check([{ ...base(), id: 'ar-np-001' }]).join()).toMatch(/id must start with "ar-iso-"/);
  });

  it('rejects a fixture in the wrong language folder or category file', () => {
    expect(check([base()], 'corpus/fixtures/he/iso.yaml').join()).toMatch(
      /does not match folder "he"/,
    );
    expect(check([base()], 'corpus/fixtures/ar/np.yaml').join()).toMatch(
      /does not belong in np.yaml/,
    );
  });

  it('rejects a span that is not a substring of text', () => {
    expect(check([{ ...base(), isolate_spans: ['C:\\Users\\other\\'] }]).join()).toMatch(
      /not a substring/,
    );
  });

  it('rejects text that is not NFC', () => {
    // "é" as e + U+0301 combining acute (NFD).
    expect(check([{ ...base(), title: 'Cafe\u0301 path' }]).join()).toMatch(/title is not NFC/);
  });

  it('rejects a stray bidi control, and accepts one named in expected_notes', () => {
    const withLrm = { ...base(), text: `${base().text}\u200E` };
    expect(check([withLrm]).join()).toMatch(/U\+200E is present/);
    expect(
      check([{ ...withLrm, expected_notes: `${withLrm.expected_notes} Ends with U+200E (LRM).` }]),
    ).toEqual([]);
  });

  it('requires verification: null on drafts', () => {
    const verification = { by: 'x', at: '2026-11-01', hash: 'a'.repeat(64) };
    expect(check([{ ...base(), verification }]).join()).toMatch(
      /draft must have verification: null/,
    );
  });

  it('checks the verification hash of verified fixtures', () => {
    const fx = base();
    const ok = {
      ...fx,
      status: 'verified',
      verification: { by: 'Yousef Ghanem', at: '2026-11-01', hash: fixtureHash(fx) },
    };
    expect(check([ok])).toEqual([]);
    expect(check([{ ...ok, text: `${fx.text} ` }]).join()).toMatch(/hash does not match/);
    expect(check([{ ...fx, status: 'verified' }]).join()).toMatch(/needs a verification record/);
  });
});

describe('isStale and openQuestions', () => {
  it('flags verified fixtures whose content changed, and verified ones that still ask NEEDS-YOUSEF', () => {
    const fx = base();
    const verified = {
      ...fx,
      status: 'verified' as const,
      verification: { by: 'Y', at: '2026-11-01', hash: fixtureHash(fx) },
    };
    expect(isStale(verified)).toBe(false);
    expect(isStale({ ...verified, text: `${fx.text} ` })).toBe(true);
    expect(isStale(fx)).toBe(false);
    const asking = { ...verified, expected_notes: 'NEEDS-YOUSEF: ok?' };
    expect(
      openQuestions([verified, asking, { ...fx, expected_notes: 'NEEDS-YOUSEF: draft' }]),
    ).toEqual([asking]);
  });
});

describe('canonicalJson', () => {
  it('sorts keys at every level and keeps array order', () => {
    expect(canonicalJson({ b: [2, { d: 1, c: 'ש' }], a: null })).toBe(
      '{"a":null,"b":[2,{"c":"ש","d":1}]}',
    );
  });
});
