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
  - Log known deltas in an ADR.
- API note: `bidiFactory()` → `getEmbeddingLevels(text, dir)` and `getReorderSegments(text, levels, lineStart, lineEnd)`. All ranges are **inclusive**.
- For the computation only, each `isolate_spans` entry is wrapped in FSI (U+2068) … PDI (U+2069). The indices are then mapped back to the original text.
- Line breaks come from the probe, which records which graphemes landed on which line. Each line is reordered with the paragraph's embedding levels (UAX #9 rule L2).
- **Calibration test:** for every verified fixture, probing the **golden page** (correct markup) must give the engine's expected order. This must hold in Chromium, Firefox and WebKit. A mismatch means one of these:
  - a bug in the engine or the probe;
  - a wrong expectation;
  - a browser bug.

  Investigate any mismatch before trusting any rule.

## 3. DOM probe
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
  - hidden spans.

## 4. Rules (v0)
Each rule returns `pass`, `fail` or `na`, with evidence. There is one rule per category ID, plus INP and STRM, which run on the `input` and `stream` surfaces (taxonomy v1, ADR-0003).

| Rule | Check | Main false-positive risk |
|---|---|---|
| BD | The resolved paragraph direction (the computed direction plus the side where the first logical grapheme lands) equals `base_direction` | Apps that use `unicode-bidi: plaintext` per line |
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
- **auto-page:** public pages with no login, visited at a low rate. Example: a GitHub issue in your own repo where you posted the fixtures once.
- **manual:** closed products. See `docs/AUDIT_PROTOCOL.md`.

## 6. Mock LLM (`tools/mock-llm/`)
- Uses Node's `http` module only, with no dependencies.
- Implements the OpenAI-compatible `GET /v1/models` and `POST /v1/chat/completions`, both streaming and non-streaming.
- Finds `#fx:<id>` in the last user message and replies with that fixture's `text` verbatim.
- Streaming splits the reply by graphemes: `MOCK_CHUNK` per chunk (default 3), with `MOCK_DELAY_MS` between chunks (default 30).
- Listens on port `MOCK_LLM_PORT` (11435). Containers reach it at `http://host.docker.internal:11435/v1`.
- Ships with `node --test` self-tests for both modes.

## 7. Determinism and evidence
- Run audits and take screenshots in the project Docker image. It is based on `mcr.microsoft.com/playwright:v<X.Y.Z>-noble`, with the version pinned to match `@playwright/test`. The official image ships no Arabic- or Hebrew-specific fonts, so add `fonts-noto-core` and `fonts-noto-mono`. The image build asserts both languages with `fc-list :lang=ar` and `:lang=he`, filtered to Noto faces: the base image's generic fonts already cover both languages (8 Arabic and 28 Hebrew faces in v1.64.1), so an unfiltered check would always pass. A unit test keeps the image tag equal to the `@playwright/test` version.
- Environment:
  - `TZ=UTC`;
  - browser locale `en-US` for v1 (an RTL app-UI pass comes later);
  - viewports: desktop 1280×800 and mobile 390×844;
  - animations disabled, except for STRM.
- Each run writes to `audit/runs/<date>-<target>/`:
  - `env.json`: target version, commit or image digest, browser versions, bidi-text-bench commit;
  - `results.jsonl`;
  - `evidence/`: cropped PNGs of failures only.

  Full-page screenshots stay local in `raw/` (gitignored) and are attached to GitHub and Zenodo releases.

## 8. Quality gates for the checker itself
- **Bug zoo** (`zoo/`): `golden.html` plus at least one labelled buggy page per rule. `npm run zoo` prints recall and false positives per rule; CI requires 100% recall and 0 false positives.
- **Calibration** (§2) in all three engines.
- **Dogfooding:** bidi-text-bench checks its own review tool and report site. CI also runs axe-core (WCAG 2.1 AA) on them.
- **Performance budget:** at most 15 minutes per target for 200 fixtures on the dev PC. Run one target at a time (16 GB RAM).
