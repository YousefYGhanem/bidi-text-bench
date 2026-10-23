# Taxonomy review (task 0.8)

This is a proposal for changes to [FIXTURE_SPEC §2](FIXTURE_SPEC.md#2-taxonomy). Nothing has changed yet: the decision is yours at Gate G0 and is recorded in ADR-0003. Evidence as of 2026-10-23.

## Evidence
1. **NP and NUM broke only through BD.** In the hands-on run ([LANDSCAPE §1.3](LANDSCAPE.md#13-experiment)), all 5 NP and NUM seeds rendered exactly like golden under first-strong `dir="auto"`. They broke only when the base direction was wrong (the nodir variant). The renderer-owned breaks came from ISO and CODE.
2. **Real issues are mostly base direction.** In the catalogue of 286 issues ([RTL_ISSUES.md](RTL_ISSUES.md)), the best-guess categories are BD 211, AL 82, MIR 53, INP 34, NP 29, ISO 24, FONT 12, COPY 7, LIST 6, CODE 5, TBL 5, NUM 2, STRM 2 and DIAC 1. NUM, STRM and DIAC are almost never reported as such.
3. **INP and STRM describe *where* the text is, not *what* it is.** Fixtures already have `surfaces: [message, input, stream]`. Take `ar-bd-001`, whose surfaces are message, input and stream. Today a failure in its input box is counted under BD, the fixture's own category, so INP gets only fixtures written specially for inputs. FIXTURE_SPEC §6 already treats them as "input traps" and "streaming traps".
4. **Bidi reordering can leak into data.** Several reports describe reordered text being stored or copied: Hebrew usernames reversed in config paths, and clipboard text reversed ([claude-code#33713](https://github.com/anthropics/claude-code/issues/33713)). Today only COPY comes close.
5. **MIR can be automated.** fitlocale's pseudo-RTL comparison flagged our physical-CSS shell in all three engines and stayed silent on the logical one ([LANDSCAPE §1.3](LANDSCAPE.md#13-experiment)).

## Proposals
| # | Change | Why | Cost |
|---|---|---|---|
| T1 | **Keep NP and NUM as fixture categories; don't fold them into BD and ISO.** Add a `cause` field at triage with a fixed vocabulary: `base-direction`, `isolation`, `code-direction`, `physical-css`, `font`, `input`, `streaming`, `author`, `other`. Group published failures by cause | Categories name what a reader sees and set coverage targets. Folding would lose NUM's blocker cases (reversed ranges and dates). The cause field fixes the triage double-counting the question was about | Adds one triage field. The rubric is unchanged (each fixture still counts once) |
| T2 | **Turn INP and STRM into surfaces.** Drop them from the category list. Keep the INP and STRM *rules* and run them on the `input` and `stream` surfaces of every fixture. Report a score per surface next to the score per category | Removes the overlap above. Tests every fixture as typed input and as a stream, which is where real users break things (INP 34 issues) | The rubric weights for INP (8) and STRM (6) move to surface weights at G4. The coverage targets become per surface |
| T3 | **Widen COPY to "Copy, selection and data integrity".** That covers copied or *stored* text that is reordered or carries stray controls | Evidence 4 | None; it is still manual in v1 |
| T4 | **MIR stays manual and unscored in v1, but is marked as automatable.** Revisit it with decision (a): use fitlocale's comparison, or build our own | Evidence 5 | None now |
| T5 (optional) | **Merge DIAC into FONT** as "Glyphs, shaping and marks" | DIAC is thin (1 issue) and partly automated. It would then share FONT's v0 target of ≥2 fixtures per language | DIAC's rubric weight (3) merges into FONT's |

The categories would then be: BD, AL, ISO, NP, NUM, CODE, LIST, TBL, FONT, DIAC (or merged), TRUNC, MIR, COPY. Surfaces: message, input, stream, title.

NEEDS-YOUSEF: these are judgement calls about what an Arabic or Hebrew reader counts as one failure. In particular: under T1, is a wrong-side `?` in a paragraph that already has the wrong base direction one failure or two?
