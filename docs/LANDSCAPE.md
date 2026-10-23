# Landscape: RTL/bidi testing tools, corpora and known issues

Status: research for task 0.6, as of **2026-10-22**. Every claim links to its source. The hands-on results are reproducible from [research/fitlocale-0.5.0/](../research/fitlocale-0.5.0/). Versions, counts and issue states change: re-check them before quoting this page.

## Summary
- **fitlocale** (§1) is the closest tool. It is a 4-day-old Playwright plugin with one maintainer. It catches page-level RTL direction, mirroring, clipped marks and some out-of-order values. By design it skips code, `pre`, inputs and number formats. In our run it flagged 13 of 16 broken seed pages and missed every break inside code.
- **Platform tools** (§2): Android and iOS pseudo-locales, Android Lint, rtlcss, and the logical-property linters check *layout* (AL, MIR, LIST). None of them checks text-level bidi (ISO, NP, NUM, CODE) against an expected order. Google's BidiChecker did check text-level bidi, but it has been unmaintained for about 14 years.
- **Corpora** (§3) test the algorithm (Unicode `BidiTest.txt` and `BidiCharacterTest.txt`, now 18.0.0) or browser engines (WPT, W3C i18n, Firefox and WebKit reftests). None of the sources we reviewed tests real AI-tool UIs rendering assistant output against native-verified expectations.
- **Chat-UI fixes** (§4): browser add-ons and userscripts patch direction on AI chat sites. We found no tool that *tests* them.
- **Known issues** (§6): 286 RTL/bidi issues across the audited AI tools, 80 of them open. Most are BD, then AL, MIR and INP. See [RTL_ISSUES.md](RTL_ISSUES.md).

## 1. fitlocale (hands-on)

### 1.1 What it is
- fitlocale is an MIT-licensed npm package that "plugs into the Playwright tests you already have" to catch translation-caused layout bugs, including RTL mirroring ([README](https://github.com/melliforge/fitlocale/blob/v0.5.0/README.md)).
- It is young and moving fast. The registry lists 10 versions between 19 and 22 Oct 2026, with 0.5.0 published on 22 Oct ([npm registry](https://registry.npmjs.org/fitlocale)). TASKS.md was written against 0.4.3. We tested **0.5.0**.
- It has **22 rules**: 4 `overflow/*`, 3 `leak/*`, 1 `locale/*`, 9 `rtl/*` and 5 `i18n/*` ([README, Rules](https://github.com/melliforge/fitlocale/blob/v0.5.0/README.md#rules)).
- Version 0.5.0 renamed the repo from `melliforge/localization-layout-tester`. It also added an opt-in `fitlocale upload` command that sends reports to a hosted "fitlocale cloud" from GitHub Actions ([CHANGELOG 0.5.0](https://github.com/melliforge/fitlocale/blob/v0.5.0/CHANGELOG.md)). Our run never called it: upload is a separate CLI command ([README, CLI](https://github.com/melliforge/fitlocale/blob/v0.5.0/README.md#cli)).
- The library, the local report, the CLI and the Action are free. Cloud is the paid part: PR comments with crops and a hosted report, at $49 or $149 a month ([pricing](https://cloud.fitlocale.dev/pricing)). An open PR adds "the open-source side of fitlocale cloud billing" for 0.6.0 ([PR #23](https://github.com/melliforge/fitlocale/pull/23)).
- **Project health, checked 2026-10-23:**
  - 0 stars and 0 forks ([API](https://api.github.com/repos/melliforge/fitlocale)).
  - 1 contributor ([contributors](https://api.github.com/repos/melliforge/fitlocale/contributors?per_page=100)). All 23 PRs were opened by the owner, and there has never been an issue ([PRs](https://api.github.com/repos/melliforge/fitlocale/pulls?state=all&per_page=100)).
  - No CONTRIBUTING file; GitHub's community-health score is 42% ([community profile](https://api.github.com/repos/melliforge/fitlocale/community/profile)).
  - CI is green ([runs](https://api.github.com/repos/melliforge/fitlocale/actions/runs?per_page=10)), and releases go out with npm provenance ([0.5.0 manifest](https://registry.npmjs.org/fitlocale/0.5.0)).
  - The bidi rules arrived in the owner's [PR #3](https://github.com/melliforge/fitlocale/pull/3). No outside contribution has been tested yet.
- The docs say plainly that `50%`, ranges and dates are not reported ([RTL guide](https://melliforge.github.io/fitlocale/guides/rtl-testing-playwright)). No docs page covers inputs, streaming, code blocks, tables, lists, wrong-end truncation in RTL, or copy ([sitemap](https://melliforge.github.io/fitlocale/sitemap.xml)).

### 1.2 How its RTL checks decide (source at v0.5.0)
- **`rtl/missing-dir`** fires only after `useLocale()` has declared a right-to-left locale, and only if the page's content direction is LTR ([check.ts L285–L289](https://github.com/melliforge/fitlocale/blob/v0.5.0/src/check.ts#L285-L289)). The content direction is a **majority vote** of the computed direction over visible text elements ([boxes.ts L49–L58](https://github.com/melliforge/fitlocale/blob/v0.5.0/src/browser/boxes.ts#L49-L58)). So it is a page-level check.
- **`rtl/bidi-order`**, `rtl/canvas` and `rtl/clipped-marks` run only when that content direction is RTL ([check.ts L290–L296](https://github.com/melliforge/fitlocale/blob/v0.5.0/src/check.ts#L290-L296)). `rtl/font-fallback` also needs Chromium DevTools and is skipped on Firefox and WebKit ([README, Limitations](https://github.com/melliforge/fitlocale/blob/v0.5.0/README.md#limitations)).
- `rtl/bidi-order` looks at whitespace-separated tokens only. A token qualifies if it mixes Latin letters, a `+digit` prefix or a `$ € £ ¥ ₹` sign with a symbol, and contains **no Arabic or Hebrew letter**. The rule flags the token when two adjacent characters are drawn right-to-left. Western digits with `%`, `-`, `#` or dates are deliberately treated as safe ([rules/bidi.ts L11–L33](https://github.com/melliforge/fitlocale/blob/v0.5.0/src/rules/bidi.ts#L11-L33)).
- Some elements are **always skipped**: `script`, `style`, `noscript`, `template`, `code`, `pre`, `kbd`, `samp`, `textarea` and `contenteditable` ([browser/dom.ts L6–L11](https://github.com/melliforge/fitlocale/blob/v0.5.0/src/browser/dom.ts#L6-L11)).
- The mirroring rules (`rtl/not-mirrored`, `rtl/icon-not-mirrored`, `rtl/icon-mirrored`) compare an LTR page with the same page forced RTL. On a page that is RTL already, they are skipped ([README, Right-to-left checks](https://github.com/melliforge/fitlocale/blob/v0.5.0/README.md#right-to-left-checks)).

### 1.3 Experiment
The 11 seed fixtures were rendered into one page each, in three variants. The run used Chromium, Firefox and WebKit in the bidi-text-bench Docker image at 1280×800. The method, the pages and the raw results are in [research/fitlocale-0.5.0/](../research/fitlocale-0.5.0/README.md) and [results/fitlocale-0.5.0.json](../research/fitlocale-0.5.0/results/fitlocale-0.5.0.json).
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

## 2. Platform and CSS tools

| Tool | What it covers | Our categories | Limits |
|---|---|---|---|
| Android pseudo-locales `en-XA` and `ar-XB` | `ar-XB` makes LTR messages right-to-left and reverses their characters. Google lists hardcoded strings, concatenation, opposite-direction phrases and unmirrored UI as the bugs it reveals ([Android docs](https://developer.android.com/guide/topics/resources/pseudolocales)) | MIR, AL, BD (synthetic) | Synthetic text. The docs don't say whether it inserts bidi controls. Planned for our Phase 8 |
| Android Lint `RtlHardcoded`, `RtlSymmetry`, `RtlCompat`, `RtlEnabled` | Flags left/right gravity, padding and margins, one-sided spacing, missing `supportsRtl` ([RtlHardcoded](https://googlesamples.github.io/android-custom-lint-rules/checks/RtlHardcoded.md.html), [RtlSymmetry](https://googlesamples.github.io/android-custom-lint-rules/checks/RtlSymmetry.md.html), [RtlCompat](https://googlesamples.github.io/android-custom-lint-rules/checks/RtlCompat.md.html), [RtlEnabled](https://googlesamples.github.io/android-custom-lint-rules/checks/RtlEnabled.md.html)) | AL, MIR | Static layout checks only |
| Xcode right-to-left and double-length pseudolanguages | RTL layout without an RTL localization (`-AppleTextDirection YES`) ([Apple archive doc](https://developer.apple.com/library/archive/documentation/MacOSX/Conceptual/BPInternational/TestingYourInternationalApp/TestingYourInternationalApp.html)) | MIR, AL | iOS is out of v1 scope. The doc is archived |
| rtlcss 4.3.0 | Converts LTR CSS to RTL ([repo](https://github.com/MohammadYounes/rtlcss)). Last release 2024-08-27, lightly maintained ([npm](https://registry.npmjs.org/rtlcss)) | AL, MIR, LIST | Fixes CSS; tests nothing; no text-level bidi |
| postcss-rtlcss 6.0.0 | Emits `[dir]`-prefixed LTR and RTL rules from one stylesheet; active ([repo](https://github.com/elchininet/postcss-rtlcss)) | AL, MIR, LIST | Same |
| Stylelint layout-mappings rules, stylelint-use-logical, stylelint-plugin-logical-css | Enforce logical properties, with autofix ([Stylelint rules](https://stylelint.io/user-guide/rules/), [use-logical](https://github.com/csstools/stylelint-use-logical), now in maintenance mode, [logical-css](https://github.com/yuschick/stylelint-plugin-logical-css)) | AL, LIST, MIR | Can't see text direction or isolation |
| Google BidiChecker (2010) | JavaScript API that checks page direction, undeclared opposite-direction text, attributes, and numbers "spilling over" ([announcement](https://opensource.googleblog.com/2010/11/test-your-app-from-right-to-left.html), [catalog of checks](https://chromium.googlesource.com/external/bidichecker/+/master/docs/users_guide/catalog_of_checks.html?format=TEXT)) | BD, ISO, NUM | Unmaintained: the last commit is about 14 years old ([log](https://chromium.googlesource.com/external/bidichecker/+log)). It is the closest prior art to our checker |
| axe-core | Checks `lang` (`html-has-lang`, `valid-lang` and others). No rule checks `dir` or bidi ([rule list](https://github.com/dequelabs/axe-core/blob/develop/doc/rule-descriptions.md)) | — | Gap |
| npm newcomers `rtlcheck`, `rtl-lint` (Aug 2026) | "Playwright audits for bilingual RTL layouts", and physical CSS, Tailwind and missing `dir` ([rtlcheck](https://www.npmjs.com/package/rtlcheck), [rtl-lint](https://www.npmjs.com/package/rtl-lint)) | AL, MIR, BD | Not evaluated; listed for completeness |

**Bidi controls as a security issue.** Trojan Source (CVE-2021-42574) uses bidi controls to make source code look different from what the compiler reads ([trojansource.codes](https://trojansource.codes/)). GitHub warns on files that contain bidirectional Unicode ([changelog](https://github.blog/changelog/2021-10-31-warning-about-bidirectional-unicode-text/)), and rustc rejects bidi controls in comments and literals by default ([lints](https://doc.rust-lang.org/rustc/lints/listing/deny-by-default.html)). Our corpus validator rejects stray controls for the same reason. Track B checks that model output contains no legacy embedding or override controls.

## 3. Corpora and conformance suites

| Suite | Tests | Licence | Relation to bidi-text-bench |
|---|---|---|---|
| Unicode `BidiTest.txt`, `BidiCharacterTest.txt` | Algorithm output only: one paragraph, one line, independent of rendering ([BidiCharacterTest](https://www.unicode.org/Public/UCD/latest/ucd/BidiCharacterTest.txt), [BidiTest](https://www.unicode.org/Public/UCD/latest/ucd/BidiTest.txt)). Latest is 18.0.0 (2026-02-03). UAX #9 is at revision 52 ([UAX #9](https://www.unicode.org/reports/tr9/)) | [Unicode License v3](https://www.unicode.org/license.txt) | Our engine test uses the [13.0.0 files](https://www.unicode.org/Public/13.0.0/ucd/BidiCharacterTest.txt), because bidi-js implements UBA 13.0.0 ([README](https://raw.githubusercontent.com/lojjic/bidi-js/main/README.md)). bidi-js 1.1.0 came out on 2026-09-06 after a 3-year gap ([npm](https://registry.npmjs.org/bidi-js)) |
| Web Platform Tests | About 85 `bidi*` files in `css-writing-modes` ([listing](https://api.github.com/repos/web-platform-tests/wpt/contents/css/css-writing-modes)), `dir`/`dir=auto` tests ([global-attributes](https://api.github.com/repos/web-platform-tests/wpt/contents/html/dom/elements/global-attributes)), `<bdi>` reftests ([the-bdi-element](https://api.github.com/repos/web-platform-tests/wpt/contents/html/semantics/text-level-semantics/the-bdi-element)) and `:dir()` ([css/selectors](https://api.github.com/repos/web-platform-tests/wpt/contents/css/selectors)) | [BSD-3](https://raw.githubusercontent.com/web-platform-tests/wpt/master/LICENSE.md) | Browser engines, not apps. On 2026-10-22 the `dir-` subtests passed 104/104 in Chrome 156, 102/104 in Firefox 158 and 98/104 in Safari 27 ([wpt.fyi API](https://wpt.fyi/api/search)). Calibration has to watch those engine differences |
| W3C i18n tests | dir, dir=auto, bdi, bdo, dirname, isolation, bracket pairs, and interactive tests ([index](https://www.w3.org/International/i18n-tests/), [repo](https://raw.githubusercontent.com/w3c/i18n-tests/gh-pages/README.md)) | not detected by GitHub | Markup techniques. The guidance we judge against is [Inline markup and bidirectional text in HTML](https://www.w3.org/International/articles/inline-bidi-markup/) |
| Firefox `layout/reftests/bidi` (327 files), WebKit `fast/text/international` (157 entries) | Engine reftests ([Firefox](https://api.github.com/repos/mozilla-firefox/firefox/contents/layout/reftests/bidi), [WebKit](https://api.github.com/repos/WebKit/WebKit/contents/LayoutTests/fast/text/international)) | not checked | Engine-level |
| Hugging Face datasets | A search on 2026-10-23 found no bidi-rendering dataset ([search](https://huggingface.co/api/datasets?search=bidi&limit=30)). The Arabic–English and Hebrew–English code-switching sets are for NLP or ASR ([example](https://huggingface.co/api/datasets/MagedSaeed/arabic-english-code-switching-text)). ArabicMMLU and HeQ are QA benchmarks ([ArabicMMLU](https://huggingface.co/api/datasets/MBZUAI/ArabicMMLU), [HeQ](https://github.com/NNLP-IL/Hebrew-Question-Answering-Dataset)) | various | None tests rendering or formatting |

Among the sources above, as of 2026-10-23, none tests real AI chat or coding UIs rendering realistic assistant output (Markdown, code spans, streaming) against native-verified expectations. That is the gap bidi-text-bench fills. The search was not exhaustive: we did not search papers.

## 4. Fixes aimed at AI chat UIs
- AI RTL Pro (a Firefox add-on, v1.1.2) switches direction on ChatGPT, Claude, Gemini, Copilot and DeepSeek, and keeps code and URLs LTR ([AMO API](https://addons.mozilla.org/api/v5/addons/addon/ai-rtl-pro/)).
- The "RTL Fix for ChatGPT" userscript does the same for ChatGPT and DeepSeek ([OpenUserJS](https://openuserjs.org/scripts/sadat0063/RTL_Fix_for_ChatGPT)).
- Cursor users built their own workarounds ([CursorRTL thread](https://forum.cursor.com/t/cursorrtl-1-0-0-right-to-left-chat-for-persian-arabic-and-hebrew/172866)).

All of these are display fixes, not tests. Not evaluated: [arshape](https://github.com/Syamjith-NK/arshape), which measures Arabic shaping across renderers; the tessl skill [rtl-rendering-tester](https://tessl.io/registry/testland/rtl-rendering-tester); and a paper on RTL rendering of SHAP and LIME plots ([arXiv 2609.28565](https://arxiv.org/pdf/2609.28565)).

## 5. Not covered here
- Chromium/Blink bidi web tests. No path could be verified, and Blink mostly upstreams to WPT.
- Browser DevTools RTL emulation.
- Playwright and Cypress direction options.
- Gemini, Copilot web, Perplexity and Le Chat forums.

## 6. Open RTL issues in AI tools
The full catalogue is in [RTL_ISSUES.md](RTL_ISSUES.md): 286 issues, 80 open, built from the GitHub REST API and public Discourse JSON, read-only and without login. Each row's title, state and created date was independently re-checked on 2026-10-23.
- **Claude Code** (168 issues, 21 open) has the most. One cluster covers VS Code extension regressions at v2.1.63 (March 2026). Others cover Desktop window controls under an RTL OS language, and bidi reordering that leaks into data: Hebrew usernames reversed in config paths, and clipboard text reversed ([#33713](https://github.com/anthropics/claude-code/issues/33713)). Many were closed by the stale bot as not planned. The latest open example is VS Code list markers staying on the left in RTL messages ([#103923](https://github.com/anthropics/claude-code/issues/103923)).
- **Codex** (41, 33 open), mostly about the desktop app. [openai/codex#31903](https://github.com/openai/codex/issues/31903) is a bug report: "Hebrew RTL/BiDi rendering is broken in ChatGPT/Codex desktop workflows on macOS". It is open, with 6 comments. One of its suggested fixes is a regression fixture suite for Hebrew, Arabic, Persian and Urdu. It is a natural place to offer our corpus, which you would post yourself.
- **VS Code Copilot Chat** (16, 7 open), **Cursor forum** (18, 9 open), **Open WebUI** (16, 0 open), **LobeChat** (9), **LibreChat** (4), **NextChat** (2), **HF Chat UI** (1). big-AGI had no RTL issues.
- **ChatGPT** (11, from the public community forum only).
- Best-guess categories: BD 211, AL 82, MIR 53, INP 34, NP 29, ISO 24, FONT 12, COPY 7, LIST 6, CODE 5, TBL 5, NUM 2, STRM 2, DIAC 1. These are guesses from titles, not verified findings.
- `audit/targets.yaml` was corrected: LibreChat moved to `LibreChat-AI/LibreChat`, LobeChat to `lobehub/lobehub`, and the #31903 note was reworded.

## 7. What this means for Gate G0 (inputs only; you decide)
- **(a) fitlocale:**
  - Its rules don't overlap with our core (ISO, CODE, NUM, INP, STRM).
  - Its oracle is heuristic; ours is UAX #9 plus native-verified fixtures.
  - Its project is 4 days old, with one maintainer and no outside contributions so far.
  - Its MIR automation and its CSS pointer are ahead of ours.
  - The `ב-C++` false negative is a concrete, small upstream contribution.
- **(b) name:** see [NAME_CHECK.md](NAME_CHECK.md).
- **(c) taxonomy:** BD dominates real issues. INP and STRM look more like surfaces than categories. MIR is automatable. See the task 0.8 review.
