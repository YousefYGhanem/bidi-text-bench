# Fixture spec

A **fixture** is one short, realistic piece of mixed-direction text, plus a native reader's description of how it must look. The text is Arabic or Hebrew mixed with things like Latin words, code, numbers and links. Fixtures are the core of the project: the checker and the audit are only as credible as the expected results recorded here.

## 1. Rules
1. **Logical order only.** Type the text the way a person types it. Never reverse text to "make it look right".
2. **Realistic.** Write something a person would type to, or read from, an AI assistant: coding help, tech support, shopping, travel, school. Test one main failure per fixture. Keep it to 2 lines or fewer unless it tests lists, tables or code.
3. **Base direction = the dominant language** as a native reader sees it, *not* the first strong character. An Arabic sentence that starts with "Python" is still RTL.
4. **Neutral content.**
   - No politics, religion, ethnicity or conflict.
   - No real people or private data.
   - Use example.com, fictional names (Lina, Noam, Sami, Maya) and obviously fake numbers (+972-50-000-0000).
5. **Unicode hygiene.**
   - Use NFC normalisation.
   - Don't include invisible controls (LRM, RLM, isolates and so on) unless the fixture is about them.
   - If it is, name each control by code point in `expected_notes`.
6. **Both languages.** Every category gets Arabic and Hebrew fixtures written natively, not translated from each other. Colloquial Arabic (for example Levantine) and everyday Hebrew tech slang are welcome, because that is where real users break things.
7. **Who is responsible?**
   - A span goes in `isolate_spans` only if the *renderer* controls it: Markdown code, links and auto-linked URLs, emails, mentions, chips.
   - If correct display needs the *author* to add markup (e.g. plain-text `C++` inside Hebrew), put the span in `author_spans` instead. UIs are not penalised for it; Track B checks whether models emit safe markup.
   - The reference render (golden page, review tool) shows author spans *as correctly authored*: an LTR isolate, as if the author had added LRI…PDI. `expected_notes` describe that correct display, and add that plain-text UIs may show it otherwise without being penalised.

## 2. Taxonomy
| ID | Category | What breaks | Checked |
|---|---|---|---|
| BD | Base direction | An RTL paragraph is laid out LTR, often when it starts with a Latin word or a number | auto |
| AL | Alignment | RTL text is left-aligned; `text-align: left` is used instead of `start` | auto |
| ISO | Isolation | Renderer-owned LTR units (code spans, links, emails, mentions, paths) leak into the surrounding order; punctuation at their edges jumps | auto |
| NP | Neutrals & punctuation | ? ! . : brackets, quotes and slashes land on the wrong side; brackets don't pair | auto (order); mirroring manual |
| NUM | Numbers & formats | Ranges, currency, %, dates, times, phone numbers and versions are reordered | auto |
| CODE | Code | Fenced or inline code inherits RTL; lines are reversed or right-aligned | auto |
| LIST | Lists & quotes | Markers, indents or the quote bar sit on the wrong side | auto |
| TBL | Tables | Column order is not mirrored; cells are misaligned | auto |
| FONT | Glyphs, shaping & marks | Tofu boxes; Arabic letters don't join; tashkeel or nikud are clipped or misplaced | partial |
| TRUNC | Truncation | The ellipsis is on the wrong end; titles are cut at the wrong end | auto |
| MIR | UI mirroring | Arrows, back buttons and sidebars are not mirrored | manual in v1 (automatable by an LTR vs forced-RTL comparison) |
| COPY | Copy, selection & data integrity | Copied or stored text is reordered or carries stray controls | manual |

The categories describe what a reader *sees*. One root cause, such as a wrong base direction, can produce symptoms in several categories. The rubric counts each fixture once, in its own category. At triage, each failure also gets a **cause**: `base-direction`, `isolation`, `code-direction`, `physical-css`, `font`, `input`, `streaming`, `author` or `other`. Published failures are grouped by cause.

**Surfaces.** Every fixture is checked on each surface in its `surfaces` list: `message`, `input`, `stream` and `title`. Two rules apply to surfaces, not categories:
- **INP** applies on `input`: the compose box stays LTR, the placeholder is misaligned, or the caret jumps. Direction is checked automatically; the caret is checked by hand.
- **STRM** applies on `stream`: direction is decided from the first chunk, or the layout flips while streaming. It is checked automatically by sampling.

Scores are reported per category and per surface.

This table is taxonomy v1, decided at Gate G0. See [ADR-0003](adr/0003-taxonomy-v1.md): INP and STRM became surfaces, DIAC merged into FONT, COPY was widened, and `cause` was added. Record any later change in a new ADR.

## 3. Severity
- **blocker:** the meaning changes or the text is unusable. Examples: reversed ranges or numbers, scrambled commands or paths someone would retype wrongly, an unreadable paragraph.
- **major:** readable only with effort, or misleading. Examples: the wrong base direction, punctuation or brackets on the wrong side, code inheriting RTL.
- **minor:** cosmetic. Examples: alignment, spacing, an icon that isn't mirrored.

## 4. Format
- Files live at `corpus/fixtures/<lang>/<category>.yaml`. Each file is a YAML list.
- IDs follow `<lang>-<category lowercase>-<nnn>` and are never reused.
- Use single-quoted YAML strings so backslashes stay literal. Use `|` for multi-line Markdown.

```yaml
- id: ar-iso-001
  lang: ar                    # ar | he
  category: ISO               # taxonomy ID
  title: Windows folder path ending in a backslash, inside inline code
  text: 'افتح المجلد `C:\Users\demo\reports\` ثم احذف النسخ القديمة.'
  markdown: true              # render as Markdown
  base_direction: rtl         # expected paragraph direction
  isolate_spans: ['C:\Users\demo\reports\']   # the renderer must show each one as a single LTR unit
  author_spans: []            # need author/model markup; not scored as UI bugs
  surfaces: [message]         # message | input | stream | title
  severity: major             # severity if this fixture fails
  expected_notes: >-          # what a native reader must see (in English)
    ...
  status: draft               # draft | verified | rejected
  verification: null          # set ONLY by the review tool: {by, at, hash}
  source: original            # original | adapted:<issue URL>
  related_issues: []          # upstream issue URLs this fixture reproduces
```

The validator (`npm run corpus:validate`) enforces:
- the schema;
- unique IDs;
- every span is a substring of `text`;
- NFC normalisation;
- no bidi control characters (U+061C, U+200E, U+200F, U+202A–U+202E, U+2066–U+2069) in `title`, `text` or spans, unless `expected_notes` names each one by code point in the form `U+200E`;
- each fixture sits in the folder of its `lang` and in the file of its `category` (files starting with `_`, such as the seeds, are exempt), and its ID starts with `<lang>-<category>-`;
- a draft has `verification: null`;
- for every verified fixture, `verification.hash` matches the current content.

**Hash** = SHA-256 of the canonical JSON of `{lang, text, markdown, base_direction, isolate_spans, author_spans, expected_notes}`. Canonical JSON means object keys are sorted at every level and there is no whitespace. The implementation is `fixtureHash` in [src/corpus/validate.ts](../src/corpus/validate.ts), and the schema is [corpus/schema/fixture.schema.json](../corpus/schema/fixture.schema.json). Any edit to a verified fixture invalidates it, and CI fails until it is re-verified.

## 5. Verification workflow
1. Claude (or a contributor) adds fixtures with `status: draft`. Open questions go inside `expected_notes`, marked `NEEDS-YOUSEF: …`.
2. You run `npm run review` and open the URL it prints. The server listens on 127.0.0.1 only; add `-- --port <n>` to change the port. For each draft, read:
   - the reference render;
   - the **logical text**: every code point in typed order, with bidi controls in red;
   - the spans and `expected_notes`, with `NEEDS-YOUSEF` highlighted.

   To fix the wording, edit the YAML in your editor, then press **R** to reload. Then decide:
   - **A** approves: `status: verified` plus `verification: {by, at, hash}`.
   - **X** rejects: `status: rejected` plus the same record.
   - **F** marks it as needing a fix: the file is unchanged, and the fixture stays in the queue.

   Other keys: **N** writes a note, **J**/**K** move to the next or previous draft, and **?** lists the keys.

   The tool changes only the `status` and `verification` lines, and only for drafts that pass the validator. `by` comes from `git config user.name`. Every decision and its note is appended to `corpus/review-log.jsonl`, which is committed as the audit trail.
3. You commit the verifications and the log yourself, e.g. `git commit -m "verify: ar ISO 001–012"`. Leave out the AI co-author trailer: this commit is your signature.

## 6. Coverage targets
| Release | Total | Per auto category × language | Extras |
|---|---|---|---|
| v0 (G1) | 80 | ≥3 | FONT ≥4 (at least 2 glyph or shaping, at least 2 marks) |
| v1 (G4) | ~200 | ≥6 | ≥20 dialect/code-switching · ≥10 written for the `stream` surface · ≥10 for the `input` surface |

## 7. Seed examples
The first 11 drafts were the seeds. They moved into their category files in task 1.4. They show the format and two hard cases:
- a `NEEDS-YOUSEF` judgement call (`ar-num-001`, `he-num-001`);
- an author-owned span (`he-np-002`).

Files whose names start with `_` are exempt from the one-category-per-file rule. Use them only for temporary mixed sets.
