# ADR-0001: Build our own bidi engine and contribute small fixes to fitlocale

- Status: accepted
- Date: 2026-10-23
- Decided by: Yousef Ghanem at Gate G0

## Context
fitlocale 0.5.0 is a 4-day-old MIT Playwright plugin. Its RTL rules partly overlap with our checker. In a hands-on run against the seed fixtures, it flagged 13 of 16 broken pages, all through the page-level `rtl/missing-dir` rule. It missed every break inside code: it always skips `code`, `pre`, `kbd`, `samp`, `textarea` and `contenteditable`. Its `rtl/bidi-order` rule is a token heuristic. That rule deliberately ignores `%`, dates and plain numbers, and skips any token that contains an Arabic or Hebrew letter, such as `ב-C++`. The project has one maintainer and no outside contributions yet. See [LANDSCAPE §1](../LANDSCAPE.md#1-fitlocale-hands-on) and [§7](../LANDSCAPE.md#7-what-this-means-for-gate-g0-inputs-only-you-decide).

Options: (1) depend on fitlocale; (2) contribute to it; (3) build our own engine.

## Decision
- **Build our own engine.** It computes the expected order with bidi-js (UAX #9) and compares it with the DOM probe ([CHECKER_SPEC](../CHECKER_SPEC.md)), covering BD, AL, ISO, NP, NUM, CODE, LIST, TBL, TRUNC and FONT, plus INP and STRM on their surfaces.
- **Contribute small, evidence-backed fixes upstream.** The first candidate is the `ב-C++` false negative. Claude drafts them in `drafts/`; Yousef checks for duplicates and posts them.
- **No runtime dependency on fitlocale.** We may revisit this for MIR, which stays manual in v1 (ADR-0003).

## Consequences
- The credibility rests on our own oracle plus native-verified fixtures, and that is our core work for Phase 2.
- The comparison in LANDSCAPE stays honest: fitlocale is credited for mirroring and its CSS pointer, which we don't have.
- If fitlocale fixes code skipping or number handling, re-evaluate before Phase 8 (packaging).
