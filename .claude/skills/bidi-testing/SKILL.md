---
name: bidi-testing
description: "Domain knowledge for testing right-to-left and bidirectional text (Arabic/Hebrew mixed with Latin, code, numbers, links): the Unicode Bidi Algorithm, isolation, CSS direction, Arabic/Hebrew typography and how bidi bugs look. Use when writing or reviewing fixtures, expected results, checker rules or bug reports in bidi-text-bench."
---

# Bidi testing knowledge

## Core model
- Text is stored in **logical order** (the order it was typed). The Unicode Bidirectional Algorithm (UAX #9) displays it in **visual order**.
- Each paragraph has a **base direction**: LTR or RTL. Every character has a bidi class:
  - strong: L, R, AL;
  - weak: EN, AN, ES, ET, CS, NSM, BN;
  - neutral: WS, ON, B, S.
- **Neutrals** (spaces, punctuation, brackets, slashes) take the direction of the text around them. When they sit between text of different directions, they take the **paragraph's** direction. That is why punctuation "jumps".
- **Numbers** are weak. The digits keep LTR order among themselves, but their position follows the surrounding text.
  - Separators and terminators attach to a number only when they touch it: ES `+ -`, ET `% ₪ $ #`, CS `. , : /`.
  - So `49.90`, `20%` and `31/12/2026` each stay one unit.
- **Isolates** make a run behave as one unit and stop its edges leaking into the surrounding text.
  - Unicode controls: LRI U+2066, RLI U+2067, FSI U+2068, closed by PDI U+2069.
  - HTML/CSS: `<bdi>`, `dir` on an inline element, or `unicode-bidi: isolate`.
  - Embeddings and overrides (U+202A–U+202E) are legacy. RLO in particular is abused for spoofing.
- **Marks** are invisible strong characters that authors use to fix neutrals: LRM U+200E, RLM U+200F, ALM U+061C.

## How apps break (look for these)
1. **No `dir` at all.** Everything renders LTR. (BD, AL)
2. **First-strong detection.** `dir="auto"` is applied to text that starts with Latin ("Python هي…", "React היא…"), so an RTL paragraph is shown LTR. (BD)
3. **Physical CSS.** `text-align: left`, `margin-left`, `padding-left` and `left:` are used instead of logical properties (`text-align: start`, `margin-inline-start`). (AL, LIST, MIR)
4. **Unisolated inline elements.** The app inserts code, links, mentions or chips without isolating them, so trailing `\ / . ) :` or leading `@ # -` jump to the wrong side. (ISO)
5. **Code inherits RTL.** Code blocks pick up `direction: rtl`. A leading `$ ` prompt or a trailing `;` then jumps to the other end of the line. (CODE)
6. **Inputs.** The input is fixed to LTR, or its direction is never re-evaluated while the user types. (INP)
7. **Streaming.** Direction is decided from the first chunk, or re-decided on every chunk, so the layout flips. (STRM)
8. **Truncation.** Truncating with the wrong direction cuts off the beginning of the text. (TRUNC)
9. **Fonts.** Glyphs are missing (tofu), Arabic letters don't join, or diacritics are clipped by a tight `line-height` combined with `overflow: hidden`. (FONT, DIAC)

## Correct techniques (to judge expectations; don't apply them blindly)
- **Paragraph direction:** set direction per message or paragraph, with `dir="auto"` or `unicode-bidi: plaintext`. First-strong detection fails for RTL text that starts with a Latin word, though. Good apps detect the **dominant** direction or respect the user's language.
- **Inserted elements:** isolate every element the app inserts into user text, using `<bdi>`, `dir="auto"` on inline code and links, or `unicode-bidi: isolate`.
- **Code:** put `direction: ltr; unicode-bidi: isolate` (or `dir="ltr"`) on `pre` and `code`. Use `text-align: left` for code blocks.
- **Inputs:** put `dir="auto"` on the textarea or contenteditable.
- **CSS:** use logical properties everywhere.

## Arabic notes
- **Punctuation:** comma ، (U+060C, class CS), semicolon ؛ (U+061B), question mark ؟ (U+061F) and percent ٪ (U+066A). The semicolon and question mark are class AL, which means they are strong RTL, not neutral.
- **Digits:** both Western 0–9 and Arabic-Indic ٠–٩ (U+0660–0669, class AN) are normal. Extended (Persian) digits ۰–۹ are not Arabic. Don't mix digit systems within one number.
- **Joining:** letters join, taking initial, medial, final or isolated forms. Lam-alef forms a ligature. Letters that don't join mean shaping has failed.
- **Marks:** tashkeel (U+064B–U+0652) sit above or below letters. Tatweel ـ stretches words.
- **Judgement calls:** placement of the percent sign and position of the currency vary by region and style. Flag them as NEEDS-YOUSEF instead of guessing.

## Hebrew notes
- **Punctuation:** maqaf ־ (U+05BE), geresh ׳ (U+05F3) and gershayim ״ (U+05F4) are often typed as - ' " instead.
- **Prefixes:** prefix letters attach to Latin words and numbers with a hyphen: ה-API, ב-2026, ל-Windows. This is a classic neutral-placement trap.
- **Plain-text trap:** "ב-C++" in plain text displays as "++C". That is author-owned (an `author_spans` case), not a UI bug.
- **Nikud and finals:** nikud (U+05B0–U+05C7) are combining marks. Final letter forms are ך ם ן ף ץ.
- **Numbers and currency:** Hebrew uses Western digits. In real use ₪ appears both before and after the amount.

## Writing and reviewing fixtures
- Follow `docs/FIXTURE_SPEC.md`. Write natural sentences in logical order, each testing one main failure.
- In `expected_notes`, describe what a native reader must see, in plain English. Describe the reading order first, e.g. "the path appears as one left-to-right unit; the period is at the far left".
- You can compute expectations with the engine, but **you cannot verify them**. Mark anything that depends on native judgement with `NEEDS-YOUSEF: <question>`. Never set `status: verified`.

## Describing a bug
1. Lead with the impact on users, e.g. "Arabic answers that start with an English word are shown left-to-right, so punctuation and word order look scrambled".
2. Give the fixture text in a fenced block and note that it is in logical order.
3. Attach two screenshots: the expected result (the reference render) and the actual one.
4. State the version, OS, browser and date.
