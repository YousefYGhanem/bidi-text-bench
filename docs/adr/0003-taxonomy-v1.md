# ADR-0003: Taxonomy v1

- Status: accepted
- Date: 2026-10-23
- Decided by: Yousef Ghanem at Gate G0

## Context
The v0 taxonomy mixed what a reader sees (NP, NUM) with where the text is (INP, STRM, which overlap with the fixture's `surfaces` field). DIAC was thin. Real-world issues showed bidi reordering leaking into stored data. Evidence: [TAXONOMY_REVIEW.md](../TAXONOMY_REVIEW.md), [LANDSCAPE §1.3](../LANDSCAPE.md#13-experiment) and [RTL_ISSUES.md](../RTL_ISSUES.md).

## Decision
Proposals T1–T5 were all accepted:
1. **T1:** NP and NUM stay fixture categories. Every triaged failure also gets a **cause**: `base-direction`, `isolation`, `code-direction`, `physical-css`, `font`, `input`, `streaming`, `author` or `other`. Published failures are grouped by cause.
2. **T2:** INP and STRM are no longer categories. Their rules run on the `input` and `stream` surfaces of every fixture that lists them, and scores are reported per category and per surface.
3. **T3:** COPY becomes "Copy, selection & data integrity": copied or *stored* text is reordered or carries stray controls.
4. **T4:** MIR stays manual and unscored in v1, and is marked as automatable by an LTR vs forced-RTL comparison.
5. **T5:** DIAC merges into FONT, which becomes "Glyphs, shaping & marks".

The v1 categories are BD, AL, ISO, NP, NUM, CODE, LIST, TBL, FONT, TRUNC, MIR and COPY.

## Consequences
- [FIXTURE_SPEC §2 and §6](../FIXTURE_SPEC.md#2-taxonomy) were updated: the coverage target is now FONT ≥4 (at least 2 marks), plus surface-specific input and stream fixtures. [CHECKER_SPEC §4](../CHECKER_SPEC.md) and [AUDIT_PROTOCOL §5–6](../AUDIT_PROTOCOL.md) were updated too. The rubric v0 weights moved: INP 8 and STRM 6 became surface weights, to be set at G4, and FONT became 4 + 3 = 7.
- The schema (task 1.1) must reject the IDs INP, STRM and DIAC as categories, and the triage view (task 3.4) needs the `cause` field.
- Open native-reader question, to settle by Gate G4: under T1, is a wrong-side `?` in a paragraph that already has the wrong base direction one failure or two?
