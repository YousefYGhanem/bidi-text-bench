# Checker spec

**Principle:** compare what a user *sees* with what a correct renderer would show. The comparison uses measurable DOM facts, such as computed styles and glyph positions. Pixels serve as evidence, not as the oracle.

## 1. Pipeline
1. **Load** the target and render a fixture (adapter, §5).
2. **Probe** the container: computed styles and the position of every grapheme (§3).
3. **Expect**: compute the correct visual order for the same text and the same line breaks (§2).
4. **Check**: the rules compare steps 2 and 3 and emit results with evidence (§4).
5. **Store** the results and evidence (§7).

## 2. Expected model
- The engine is `bidi-js` (UAX #9). The paragraph level is the fixture's `base_direction`; code blocks are always LTR.
- **Version drift:** bidi-js 1.1 implements UBA 13.0, while Unicode is at 18.0 and browsers use newer ICU.
  - Unit-test the engine against `https://www.unicode.org/Public/13.0.0/ucd/BidiCharacterTest.txt`.
  - Rely on calibration (below) to catch differences from real browsers.
  - Log known deltas in an ADR: [ADR-0004](adr/0004-engine-uba-version.md). The algorithm passes the full 13.0.0 and 18.0.0 conformance files; 1,352 code points have different Bidi_Class data, none used by a fixture (a unit test guards this).
- The engine is `expectedOrder(text, base, { isolate, ltrIsolate, lines })` in `src/engine/bidi.ts`. It works in UTF-16 code units and returns each line's visual order.
- API note: `bidiFactory()` → `getEmbeddingLevels(text, dir)` and `getReorderSegments(text, levels, lineStart, lineEnd)`. All ranges are **inclusive**.
- For the computation only, each `isolate_spans` entry is wrapped in FSI (U+2068) … PDI (U+2069). The indices are then mapped back to the original text. For the golden page (calibration), each `author_spans` entry is also wrapped, in LRI (U+2066) … PDI, matching how the reference render shows it as correctly authored. For real targets, author spans are excluded from scoring instead.
- Line breaks come from the probe, which records which graphemes landed on which line. Each line is reordered with the paragraph's embedding levels (UAX #9 rule L2).
- **Calibration test:** for every verified fixture, probing the **golden page** (`zoo/golden.html`, correct markup, built from the corpus by `npm run golden` with `src/render/reference.ts`) must give the engine's expected order. This must hold in Chromium, Firefox and WebKit. A mismatch means one of these:
  - a bug in the engine or the probe;
  - a wrong expectation;
  - a browser bug.

  Investigate any mismatch before trusting any rule.

  **Status (task 2.5, 2026-10-24):** `tests/e2e/calibration.spec.ts` probes every verified fixture on `zoo/golden.html` and compares each line with `expectedLines(probe, fixture, { golden: true })`, which isolates author spans as LTR the way the reference render shows them. All 80 fixtures match, with **0 mismatches**, in Chromium, Firefox and WebKit, at 1280×800 (153 lines) and 390×844 (209 lines, 52 fixtures wrapping). A negative control confirms the comparison can fail: `he-np-002` without its LTR author span expects `++C` where the page draws `C++`.

## 3. DOM probe
Implemented as `probe(locator, { exclude })` in `src/probe/probe.ts`. It returns the logical `text`; each grapheme with its `[start, end)` code units, box and role; **blocks**, the nearest non-inline ancestors, each one a bidi paragraph with its own direction, `unicode-bidi` and `text-align`; each block's lines, with the visual order and the logical code-unit range the engine needs; and the context. `toGraphemeOrder` in `src/engine/bidi.ts` turns the engine's code-unit order into the probe's grapheme order.

- **Logical text:** walk the container's text nodes in document order, including open shadow roots. Build the logical string and a map from each character to its node and offset.
- **Graphemes:** split the text with `Intl.Segmenter('und', { granularity: 'grapheme' })`.
- **Positions:** for each grapheme, create a `Range` and call `getClientRects()`. Keep the centre x/y and skip collapsed whitespace.
- **Lines:** group graphemes into lines by vertical overlap. The visual order of a line is its graphemes sorted by centre x; ties fall back to logical order inside the run.
- **Context:** also record `direction`, `unicode-bidi` and `text-align`. Record the `dir` and `lang` attributes up the ancestor chain, plus overflow and clipping. Record element roles: p, li, pre, code, a, td, textarea, contenteditable.
- **Known traps:**
  - copy buttons and line-number gutters inside code blocks (exclude them with adapter selectors);
  - lam-alef ligatures, which share one rect;
  - emoji;
  - `white-space: pre`;
  - hidden spans;
  - a rendered space has a box and belongs in the visual order; only collapsed extra spaces have none;
  - `input` and `textarea` values have no text nodes, so the probe records only their direction and alignment. An empty `dir="auto"` field resolves to LTR until the user types, so INP must re-read it after typing;
  - `checkVisibility()` is false for `display: contents` elements, slots included, so those are never treated as hidden.

## 4. Rules (v0)
Each rule returns `pass`, `fail` or `na`, with evidence. There is one rule per category ID, plus INP and STRM, which run on the `input` and `stream` surfaces (taxonomy v1, ADR-0003).

| Rule | Check | Main false-positive risk |
|---|---|---|
| BD | The block's computed direction equals `base_direction`, and no line matches the engine's order for the opposite base direction | Apps that use `unicode-bidi: plaintext` per line |
| AL | RTL blocks align to the inline end (right); `text-align` resolves to start or right | Messages centred by design (the adapter declares `align: center`) |
| ISO | Each `isolate_spans` item is contiguous in visual order and internally LTR, and the neutrals at its edges stay inside it | Spans split across lines (skip if the span wraps) |
| NP | Neutral characters (punctuation, brackets) sit where the expected order puts them | Font fallback changing widths (positions are compared relatively, not absolutely) |
| NUM | The digits and separators of each number group stay together, in the expected order | Eastern Arabic digits (compare graphemes, not numeric values) |
| CODE | `pre` and `code` resolve to LTR, code lines run in LTR visual order, and blocks are not right-aligned | Apps that deliberately right-align short inline code |
| LIST | The list container's direction matches its content, and markers are indented on the inline-start side | Custom bullet elements |
| TBL | In an RTL table, the first logical column is the rightmost | Tables with explicit `dir="ltr"` content |
| INP | After the fixture is typed, the input's or contenteditable's direction and alignment follow the text (`dir="auto"` or equivalent) | Inputs that switch direction only on blur |
| STRM | Direction is sampled every 100 ms while streaming. Fails as major if the final state is wrong, or minor if it flips mid-stream | A slow first chunk (widen the sampling window) |
| TRUNC | A truncated element hides the *end* of the text and shows the ellipsis at the inline end | — |
| FONT | A grapheme renders as the notdef/tofu glyph (detected by canvas comparison against a private-use character) | Colour emoji |
| FONT (marks) | (v1.5) Marks are clipped: compare screenshots taken with and without `overflow: visible` | — |

**Implementation** (`runRules(fixture, probe)` in `src/rules/rules.ts`; expected orders from `src/rules/expected.ts`):
- **Expected order:** the engine runs on the *rendered* text from the probe, per probe block and line, with the fixture's `base_direction`. Code blocks (`pre`) are always LTR.
  - Isolation follows FIXTURE_SPEC §1.7: listed `isolate_spans` and links are isolated with FSI, inline `code` as LTR.
  - Graphemes inside `author_spans` are not isolated and count as wildcards, so either order passes there.
- **BD** fails if a block's computed direction differs from `base_direction`, *or* if a line matches the engine's order for the opposite base direction and not the expected one. The second test catches `dir="auto"` and `unicode-bidi: plaintext` without position heuristics.
- **NP** compares the left and right neighbours of each punctuation or symbol grapheme. **NUM** compares each number group plus one neighbour on each side. Both ignore author-span graphemes.
- **LIST** also covers blockquotes: the quote bar (the larger of the left and right borders) must be on the inline-start side.
- **TRUNC** applies only when the root is clipped horizontally. The cut must be on the inline-end side: in RTL, hidden graphemes lie past the left edge and none past the right edge (mirrored for LTR). This is defined visually, because an embedded LTR word in an RTL title legitimately loses its logical start.
- **FONT** (notdef): the method depends on how the engine draws a missing glyph, which the probe tests per font. If U+E000 and U+E001 (private use; no font covers them) draw identically, as in Chromium and WebKit, a grapheme counts as missing when it is pixel-identical to U+E000. Otherwise (Firefox draws a box with the code point in hex), it counts as missing when its advance and ink box equal a private-use reference with as many hex digits. Metrics alone gave false positives on Windows code fonts, and WebKit reports no ink box. Emoji and whitespace are skipped. A system "last resort" font that draws different boxes per block would still hide missing glyphs (false negatives). The Playwright Docker image falls back to Unifont, which draws a glyph (often a hex placeholder) for unassigned code points and most new scripts, so those are not tofu there; the zoo therefore uses Sunuwar (Unicode 16), which no installed font covers on Windows or in the image.
- A rule with nothing to check returns `na`. On the golden page, BD, AL and FONT evaluate all 80 fixtures, NP 74, NUM 19, CODE 19, ISO 18, LIST 6 and TBL 6. TRUNC needs a truncated title surface.

**Rule review (task 2.6, 2026-10-24).** An independent rule-reviewer agent reviewed each rule. Every claimed miss or false alarm was first added to the zoo and run *before* any fix, so only confirmed defects were changed.
- **Confirmed and fixed:**
  - AL stopped at the first centred block (AL-3).
  - AL failed correct `text-align: -webkit-right` (OK-AL-webkit). Prefixed values are now normalised.
  - CODE, LIST and TBL checked the probe block's own tag, so wrappers escaped: highlighter `pre > code{display:block}` (CODE-3), loose lists `li > p` (LIST-4), and cells `td > div` (TBL-2). The probe now records each block's **container** (`li`, `td`/`th` with table, row and column, `pre`, `blockquote`), and the rules and the expected order use it.
  - LIST did not check the indent side (LIST-3). The probe now records the list's padding side.
- **Also fixed, from code reading:**
  - NUM compared an empty slice when a number sits at a line edge.
  - NUM ignored author-span neighbours inconsistently with NP.
  - NUM was missing the Arabic percent sign ٪.
  - ISO and NUM reported pass while silently skipping spans or numbers; the skips are now in the evidence, and all-skipped returns `na`.
  - TRUNC now needs *horizontal* clipping (`clippedX`). Not `scrollWidth` alone: Chromium leaves overflow past the start (right) edge of an RTL box out of `scrollWidth`, so the probe also counts graphemes drawn outside the box.
  - TBL groups cells by table row instead of y, and a table with no multi-cell row is `na`.
  - The probe waits for `document.fonts.ready`, and the tofu check skips only real emoji, so © ® ™ are checked.
- **New pages that were already caught** (kept as regression tests): ISO on a mention and on `--help`; NP with punctuation trapped in an LTR span; NUM with date parts isolated separately; controls for vertical clipping and 160 px Arabic.
- **Known limits, not fixed in v0.** Each is a documented false negative unless marked.
  - BD fires only when a line matches the opposite direction's order. Other wrong layouts, such as `bidi-override` on an RTL paragraph, are left to NP and NUM.
  - Renderer-injected LRM/RLM are part of the rendered text, so the expected order agrees with them. Comparing the rendered text with the fixture text belongs to COPY (manual).
  - Bracket mirroring (NP) is manual.
  - TRUNC sees only CSS overflow, not titles truncated in JavaScript with a literal "…", and it does not check that an ellipsis is drawn.
  - Tables and lists drawn with `div`s or custom bullets are `na`.
  - FONT checks missing glyphs only, not joining or clipped marks (DIAC was merged into FONT, so this is v1.5 work).
  - Numbers inside author spans, such as phone numbers, are not checked.
  - Possible false alarm: legitimately RTL content inside `code` (`<code dir="rtl">`) fails CODE. None exists in the corpus; triage decides.

Result record:
```json
{"fixture":"ar-iso-001","target":"open-webui","surface":"message","browser":"chromium","rule":"ISO",
 "status":"fail","severity":"major","evidence":{"expected":"…","actual":"…","diffAt":[12,13],
 "styles":{"direction":"rtl","unicodeBidi":"normal"},"screenshot":"evidence/ar-iso-001.png"}}
```

## 5. Adapters
```ts
export interface Adapter {
  id: string;                                       // = audit/targets.yaml id
  mode: 'auto-chat' | 'auto-page';
  open(page: Page): Promise<void>;                  // navigate and wait until ready; never log in to real accounts
  send?(page: Page, fx: Fixture): Promise<Locator>; // auto-chat: send "#fx:<id>", return the reply container
  input?(page: Page): Promise<Locator>;             // the compose box, for INP
  find?(page: Page, fx: Fixture): Promise<Locator>; // auto-page: locate an already-rendered fixture
  exclude?: string[];                               // selectors to ignore (copy buttons, gutters)
}
```
- **auto-chat:** self-hosted open-source chat UIs (Docker) pointed at the mock LLM. Prefer modes with authentication disabled. If a local instance needs an account, use throwaway test credentials in `.env.local` (localhost only).
- **Where they live:** `src/adapters/<id>.ts`, registered in `src/adapters/index.ts`; the interface and `settled()` (waits until a streamed reply stops changing) are in `src/adapters/adapter.ts`. Each auto-chat target has `audit/targets/<id>/compose.yaml` with a pinned image tag, a port published on 127.0.0.1 only, and the mock as its OpenAI endpoint. Built so far:

  | id | image | URL | reply container |
  |---|---|---|---|
  | open-webui | `ghcr.io/open-webui/open-webui:v0.12.4` (`WEBUI_AUTH=False`) | http://127.0.0.1:3101 | `.chat-assistant #response-content-container .markdown-prose` |
  | nextchat | `yidadaa/chatgpt-next-web:v2.16.1` | http://127.0.0.1:3102 | last assistant `.markdown-body` |

  `send` returns the next new reply after the ones already on the page, so a run can reuse one chat; the audit (task 3.3) still opens a fresh browser context per fixture.
- **Smoke test for one target:** start `npm run mock-llm` and `docker compose -f audit/targets/<id>/compose.yaml up -d`, then run `TARGET=<id> npx playwright test targets --project=chromium` (skipped when `TARGET` is unset, so CI never runs it). Run `docker compose ... down` afterwards.
- **To add a target:** add the compose file, an adapter, and an entry in `ADAPTERS`; `tests/unit/adapters.test.ts` checks that the id is in `audit/targets.yaml` with the same mode, the image is pinned, and the port is localhost-only.
- **auto-page:** public pages with no login, visited at a low rate. Example: a GitHub issue in your own repo where you posted the fixtures once.
- **manual:** closed products. See `docs/AUDIT_PROTOCOL.md`.

## 6. Mock LLM (`tools/mock-llm/`)
- Uses Node's `http` module only. Its one import is the project's corpus loader, which reads every fixture (drafts included; the audit picks the ids). Run it with `npm run mock-llm`; the model id is `bidi-text-bench-mock`.
- Implements the OpenAI-compatible `GET /v1/models` and `POST /v1/chat/completions`, both streaming and non-streaming. The `/v1` prefix is optional, because chat UIs differ in whether their base URL ends in it.
- Finds the latest `#fx:<id>` in the user messages and replies with that fixture's `text` verbatim. String content and the multimodal parts format are both read. With no `#fx:` id, or an unknown one, it replies with a short `bidi-text-bench mock:` note, not an error, so side requests from the UI do not break it. A title request (NextChat appends its own prompt after the fixture's message) therefore gets the fixture text as well, so the `title` surface shows it.
- Streaming splits the reply by graphemes: `MOCK_CHUNK` per chunk (default 3), with `MOCK_DELAY_MS` between chunks (default 30).
- Listens on `MOCK_LLM_HOST` (default 127.0.0.1) and port `MOCK_LLM_PORT` (11435). Containers reach it at `http://host.docker.internal:11435/v1`; Docker Desktop forwards that to the host's loopback (checked in task 3.2), and the compose files add `host-gateway` for Linux.
- Ships with `node --test` self-tests for both modes (`npm run mock-llm:test`, part of `npm run check`).

## 7. Determinism and evidence
- Run audits and take screenshots in the project Docker image. It is based on `mcr.microsoft.com/playwright:v<X.Y.Z>-noble`, with the version pinned to match `@playwright/test`. The official image ships no Arabic- or Hebrew-specific fonts, so add `fonts-noto-core` and `fonts-noto-mono`. The image build asserts both languages with `fc-list :lang=ar` and `:lang=he`, filtered to Noto faces: the base image's generic fonts already cover both languages (8 Arabic and 28 Hebrew faces in v1.64.1), so an unfiltered check would always pass. A unit test keeps the image tag equal to the `@playwright/test` version.
- Environment:
  - `TZ=UTC`;
  - browser locale `en-US` for v1 (an RTL app-UI pass comes later);
  - viewports: desktop 1280×800 and mobile 390×844;
  - animations disabled, except for STRM.
- **Runner** (`npm run audit`, `src/cli/audit.ts` and `src/audit/run.ts`, task 3.3):
  - The Node runner stays on the host. The browsers run in the project image through `npx playwright run-server`, as `pwuser` rather than root, because the pages come from third-party UIs. The runner connects with `browserType.connect()`.
  - Inside the container, the browser reaches the target at `host.docker.internal`: the adapters read their host from `TARGET_HOST`.
  - Each fixture gets a fresh browser context (`en-US`, UTC, reduced motion).
  - One JSON line is written per rule result, `na` included, because scoring needs the applicable count. Each line has `surface`, `browser`, `viewport` and `severity`.
  - An adapter or probe error becomes a `status: "error"` line with `rule: null`, and the run goes on.
  - Not done yet: Playwright's seccomp profile for Chromium's sandbox.
- Each run writes to `audit/runs/<date>-<target>/`:
  - `env.json`: the target's images with their digests, run mode, host OS and Node version, browser versions, viewports, locale, time zone, UI language, the bidi-text-bench commit with a dirty flag, the fixture count, and the surfaces run or skipped;
  - `results.jsonl`;
  - `evidence/`: cropped PNGs of failures only.

  Full-page screenshots stay local in `raw/` (gitignored) and are attached to GitHub and Zenodo releases.

## 8. Quality gates for the checker itself
- **Bug zoo** (`zoo/`): `golden.html` plus at least one labelled buggy page per rule. `npm run zoo` prints recall and false positives per rule; CI requires 100% recall and 0 false positives.
  - The labelled bugs and controls are defined in `src/zoo/bugs.ts`. Each entry is a verified fixture, the rule it must trip, a reason, and the CSS or HTML change that breaks it. `npm run zoo` writes them to `zoo/bugs/<id>.html`; the pages are committed, and a unit test fails if they are stale. It then prints the table; `-- --browser firefox|webkit|all` picks the engine.
  - False positives are counted on `golden.html` (every fixture) and on **control** pages, which are correct renderings the golden page cannot show, such as properly truncated RTL titles.
  - CI runs `tests/e2e/zoo.spec.ts` in all three engines and both viewports.
  - To add a bug: add an entry to `BUGS`, run `npm run zoo`, and commit the new page. If a new correct pattern would otherwise go unchecked, add a control as well.
  - Gate G2 condition (task 3.0): TRUNC has a bug and a control for every truncation fixture, plus a `unicode-bidi: plaintext` bug and a padded-box control; FONT has tofu at the end of a paragraph, inside a Hebrew word and from a 6-hex-digit code point, plus a © ® ™ control.
  - The zoo already caught one false positive: a correctly truncated Arabic title with an embedded English word. TRUNC is now defined visually (the cut is on the inline-end side) instead of logically.
- **Calibration** (§2) in all three engines.
- **Dogfooding:** bidi-text-bench checks its own review tool and report site. CI also runs axe-core (WCAG 2.1 AA) on them.
- **Performance budget:** at most 15 minutes per target for 200 fixtures on the dev PC. Run one target at a time (16 GB RAM).
