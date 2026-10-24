# ADR-0004: Use bidi-js (UBA 13.0.0) as the expected-order engine and record its drift

- Status: accepted
- Date: 2026-10-24
- Decided by: Claude Code (task 2.1), within ADR-0001 ("build our own engine on bidi-js")

## Context
The engine (`src/engine/bidi.ts`) computes the expected embedding levels and the visual order of each line with bidi-js 1.1.0. Its README says it implements UBA 13.0.0. Unicode is now at 18.0.0, with UAX #9 at revision 52 ([LANDSCAPE §3](../LANDSCAPE.md#3-corpora-and-conformance-suites)), and browsers ship newer ICU data. We need to know where the engine can disagree with current Unicode.

## Measurements (2026-10-24, reproduce with `node scripts/uba-drift.ts`)
1. **Algorithm.** Through our engine wrapper, bidi-js passes all **91,699/91,699** cases of `BidiCharacterTest-13.0.0.txt` and all **91,707/91,707** of `BidiCharacterTest-18.0.0.txt`. The 18.0.0 file adds 8 cases, all paired brackets followed by ZWJ and a combining mark, and bidi-js passes them. A negative control showed the harness is not vacuous: it caught every corrupted expectation in 1,892 cases with swapped visual order or a flipped paragraph level.
2. **Character data.** bidi-js's Bidi_Class differs from UCD 18.0.0 `DerivedBidiClass.txt` at **1,352 code points in 112 ranges**. They are listed in [`tests/data/uba-13-vs-18-bidi-class-drift.txt`](../../tests/data/uba-13-vs-18-bidi-class-drift.txt). All are characters added or reclassified after Unicode 13.0. For the scripts we test:
   - Arabic (U+0600–06FF), ASCII, Latin-1 and General Punctuation: **no differences**.
   - Hebrew: only U+05C8–05C9, which are NSM in 18.0 and R in bidi-js.
   - Arabic Extended-A/B: 57 code points. Examples: U+0870–088F and U+0892–0896 are AL in 18.0 and R in bidi-js. U+0890–0891 (the pound and piastre marks above) are AN in 18.0 and R in bidi-js. U+0897–089F and U+08CA–08D2 are NSM in 18.0.
   - Arabic Presentation Forms: 44 symbols in U+FBC3–FBD2, FD40–FD4F, FD90–FD91, FDC8–FDCF and FDFE–FDFF are ON in 18.0 and AL in bidi-js.

## Decision
- Keep bidi-js 1.1.0 as the engine. Its algorithm matches the current conformance file exactly, and its data drift doesn't touch the characters our fixtures use.
- Unit tests run a committed subset of the 13.0.0 conformance file: every 25th case, 3,668 cases, with the Unicode License v3 notice. They also include a negative control.
- A **drift guard** test fails if any fixture contains a code point in the drift list. Today no fixture does.

## Consequences
- A fixture that needs a drifted character, for example the Arabic pound mark U+0890 or the newer honorific symbols, must first fix the engine: patch the class data or switch libraries. A new ADR then supersedes this one.
- The browsers' newer ICU data can still differ from the engine on drifted characters. Calibration in task 2.5 catches that for the verified fixtures.
- Re-run `scripts/uba-drift.ts` when bidi-js or Unicode is upgraded.
