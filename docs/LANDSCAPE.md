# Landscape: RTL/bidi testing tools, corpora and known issues

Status: research for task 0.6, as of **2026-10-22**. Every claim links to its source. The hands-on results are reproducible from [research/fitlocale-0.5.0/](../research/fitlocale-0.5.0/). Versions, counts and issue states change: re-check them before quoting this page.

<!-- SUMMARY -->

## 1. fitlocale (hands-on)

### 1.1 What it is
- fitlocale is an MIT-licensed npm package that "plugs into the Playwright tests you already have" to catch translation-caused layout bugs, including RTL mirroring ([README](https://github.com/melliforge/fitlocale/blob/v0.5.0/README.md)).
- It is young and moving fast. The registry lists 10 versions between 19 and 22 Oct 2026, with 0.5.0 published on 22 Oct ([npm registry](https://registry.npmjs.org/fitlocale)). TASKS.md was written against 0.4.3. We tested **0.5.0**.
- It has **22 rules**: 4 `overflow/*`, 3 `leak/*`, 1 `locale/*`, 9 `rtl/*` and 5 `i18n/*` ([README, Rules](https://github.com/melliforge/fitlocale/blob/v0.5.0/README.md#rules)).
- Version 0.5.0 renamed the repo from `melliforge/localization-layout-tester`. It also added an opt-in `fitlocale upload` command that sends reports to a hosted "fitlocale cloud" from GitHub Actions ([CHANGELOG 0.5.0](https://github.com/melliforge/fitlocale/blob/v0.5.0/CHANGELOG.md)). Our run never called it: upload is a separate CLI command ([README, CLI](https://github.com/melliforge/fitlocale/blob/v0.5.0/README.md#cli)).

### 1.2 How its RTL checks decide (source at v0.5.0)
- **`rtl/missing-dir`** fires only after `useLocale()` has declared a right-to-left locale, and only if the page's content direction is LTR ([check.ts L285–L289](https://github.com/melliforge/fitlocale/blob/v0.5.0/src/check.ts#L285-L289)). The content direction is a **majority vote** of the computed direction over visible text elements ([boxes.ts L49–L58](https://github.com/melliforge/fitlocale/blob/v0.5.0/src/browser/boxes.ts#L49-L58)). So it is a page-level check.
- **`rtl/bidi-order`**, `rtl/canvas` and `rtl/clipped-marks` run only when that content direction is RTL ([check.ts L290–L296](https://github.com/melliforge/fitlocale/blob/v0.5.0/src/check.ts#L290-L296)). `rtl/font-fallback` also needs Chromium DevTools and is skipped on Firefox and WebKit ([README, Limitations](https://github.com/melliforge/fitlocale/blob/v0.5.0/README.md#limitations)).
- `rtl/bidi-order` looks at whitespace-separated tokens only. A token qualifies if it mixes Latin letters, a `+digit` prefix or a `$ € £ ¥ ₹` sign with a symbol, and contains **no Arabic or Hebrew letter**. The rule flags the token when two adjacent characters are drawn right-to-left. Western digits with `%`, `-`, `#` or dates are deliberately treated as safe ([rules/bidi.ts L11–L33](https://github.com/melliforge/fitlocale/blob/v0.5.0/src/rules/bidi.ts#L11-L33)).
- Some elements are **always skipped**: `script`, `style`, `noscript`, `template`, `code`, `pre`, `kbd`, `samp`, `textarea` and `contenteditable` ([browser/dom.ts L6–L11](https://github.com/melliforge/fitlocale/blob/v0.5.0/src/browser/dom.ts#L6-L11)).
- The mirroring rules (`rtl/not-mirrored`, `rtl/icon-not-mirrored`, `rtl/icon-mirrored`) compare an LTR page with the same page forced RTL. On a page that is RTL already, they are skipped ([README, Right-to-left checks](https://github.com/melliforge/fitlocale/blob/v0.5.0/README.md#right-to-left-checks)).

### 1.3 Experiment
The 11 seed fixtures were rendered into one page each, in three variants. The run used Chromium, Firefox and WebKit in the bidi-bench Docker image at 1280×800. The method, the pages and the raw results are in [research/fitlocale-0.5.0/](../research/fitlocale-0.5.0/README.md) and [results/fitlocale-0.5.0.json](../research/fitlocale-0.5.0/results/fitlocale-0.5.0.json).
- **golden:** correct markup.
- **nodir:** no `dir` anywhere.
- **auto:** first-strong `dir="auto"`, with unisolated code.

A page counts as **broken** when the measured visual order or alignment side differs from the golden page in the same engine. The results below were **observed in fitlocale 0.5.0 on 2026-10-22** and were identical in all three engines, except where noted.

| Pages | Broken | fitlocale reported |
|---|---|---|
| nodir (11) | 11 (BD, AL) | `rtl/missing-dir` on all 11 |
| auto (11) | 5: `ar-bd-001` and `he-bd-001` (BD, first-strong picks LTR); `ar-iso-001` and `he-iso-001` (ISO: an edge character of the path in inline code jumps to the far end, drawn as `\C:\Users\demo\reports` and `/reports/.`); `ar-code-001` (CODE: `$` jumps to the right end) | `rtl/missing-dir` on the 2 BD pages. **Nothing on the 3 code pages.** |
| auto, not broken (6) | 0 | nothing |
| golden (11) | — | nothing. This includes `he-np-002`, where plain-text `ב-C++` is drawn as `++C`, which is author-owned in [FIXTURE_SPEC §1.7](FIXTURE_SPEC.md) |
| controls (4) | — | `rtl/bidi-order` on `C++` (Hebrew sentence, no prefix) and on `$220` (Arabic, drawn `220$`). **Not** on `ב-C++`, which is drawn `++C` too, because the token contains a Hebrew letter. Not on `$220` in Hebrew, which is drawn in order |
| English shell, physical CSS | — | `rtl/not-mirrored` ×4 and `rtl/icon-not-mirrored` ×1 |
| English shell, logical CSS | — | nothing |
| Arabic title, tight line box, Liberation Sans | — | `rtl/clipped-marks` in all 3 engines. `rtl/font-fallback` in Chromium only (Liberation Sans has no Arabic glyphs) |
| Hebrew title, same CSS | — | `rtl/clipped-marks` in WebKit only. No fallback: Liberation Sans has Hebrew glyphs |

**In short:** of 16 broken seed pages, fitlocale flagged 13, all through one page-level `rtl/missing-dir` error. It missed the 3 breaks inside code, which it skips by design. It raised no false positive on the 17 pages that render like golden.

Caveats:
- There is one fixture per page, which flatters a page-level check. A chat page with many messages, where one message picks the wrong direction, was not tested. The majority vote above suggests it would pass.
- n = 11 draft fixtures (not yet verified) on synthetic pages.
- NEEDS-YOUSEF: fitlocale treats `$220` drawn as `220$` in an Arabic sentence as wrong. Is it wrong for an Arabic reader?

### 1.4 Rule-by-rule mapping to our taxonomy

| fitlocale rule | Our category | Overlap | Notes |
|---|---|---|---|
| `rtl/missing-dir` | BD (AL follows) | partial | Page-level majority vote. It can't say which message or paragraph is wrong |
| `rtl/bidi-order` | NP, NUM, ISO outside code | partial | Token heuristic, not UAX #9. It misses Hebrew-prefixed values (`ב-C++`, `ה-API`), `₪`, `%`, dates and paths in code. It also flags author-owned plain text that FIXTURE_SPEC §1.7 does not count against the UI |
| `rtl/clipped-marks` | DIAC | yes | One-line labels. The Hebrew result differed by engine in our run |
| `rtl/font-fallback` | FONT (adjacent) | partial | About an undeclared fallback font, not tofu or broken joining. Chromium only |
| `rtl/not-mirrored` | MIR (AL, LIST) | yes, for apps with an LTR source locale | Points at the physical CSS declaration (Chromium). Skipped on pages that are already RTL |
| `rtl/icon-not-mirrored`, `rtl/icon-mirrored` | MIR | yes | Icons are recognised by name |
| `rtl/canvas`, `rtl/skipped-already-rtl` | — | — | Informational |
| `overflow/clipped`, `overflow/escapes-box`, `overflow/overlap`, `overflow/ellipsis` | TRUNC (adjacent) | partial | They measure overflow caused by translation against the source text. Real locales need `localeMessages`. None checks *which end* is cut. Not exercised here ([README](https://github.com/melliforge/fitlocale/blob/v0.5.0/README.md#switching-locale)) |
| `leak/*` (3), `locale/persistence`, `i18n/*` (5) | — | none | i18n hygiene, outside our scope |

**Our categories that no fitlocale rule covers:**
- ISO inside code spans;
- CODE;
- INP (inputs are skipped);
- STRM;
- TBL column order;
- LIST markers on RTL pages;
- NUM beyond the currency signs it lists;
- COPY;
- per-message BD.

**What fitlocale has that we planned to do by hand:** MIR, through the pseudo-RTL comparison, and a pointer to the CSS line to fix.

<!-- SECTIONS -->
