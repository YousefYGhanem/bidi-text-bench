# fitlocale 0.5.0, hands-on (task 0.6)

This folder holds the evidence behind the fitlocale section of [docs/LANDSCAPE.md](../../docs/LANDSCAPE.md). The results are **observed in fitlocale 0.5.0 on 2026-10-22**, using @playwright/test 1.64.1 in the bidi-text-bench Docker image. That image is `mcr.microsoft.com/playwright:v1.64.1-noble@sha256:7852dc5a…`, plus Noto fonts.

## What it does
`build-pages.mjs` turns the 11 seed fixtures (`corpus/fixtures/*/_seed.yaml`, status **draft**, not yet verified) into 41 pages:

| Pages | Markup |
|---|---|
| `<id>.golden.html` | Correct markup: `dir` on the message, inline code `direction: ltr; unicode-bidi: isolate`, `pre` LTR and left-aligned |
| `<id>.nodir.html` | `<html lang>` only, with no `dir` anywhere (a classic "no RTL support" app) |
| `<id>.auto.html` | `<html dir="rtl">`, first-strong `dir="auto"` on the message, unisolated code (a classic "half-done" app) |
| `ctl-*.html` | Controls for `rtl/bidi-order`: `C++` with and without a Hebrew prefix, and `$220` in Arabic and in Hebrew |
| `shell-en-*.html` | An English UI shell with physical CSS (`left`, `margin-left`, a left chevron) or logical CSS, for fitlocale's pseudo-RTL mirroring mode |
| `shell-{ar,he}-tight.html` | A one-line RTL title in Liberation Sans (no Arabic glyphs, has Hebrew) with a tight 24 px line box |

`tests/fitlocale.spec.ts` runs `localeCheck()` on each page in Chromium, Firefox and WebKit at 1280×800. The options are `baseline: false`, `failOn: 'never'`, `modes: ['pseudo-rtl']`, and a no-op `setLocale` so that `useLocale(<lang>)` declares the page's locale. It also measures the visual order and the alignment side of every non-space grapheme in the message.

`analyze.mjs` writes `results/fitlocale-0.5.0.json`. For each page and engine it records:
- `differsFromGolden`: the measured visual order or alignment side differs from the golden page in the same engine, which means a bidi break is present;
- the fitlocale issues.

## Reproduce
```bash
cd research/fitlocale-0.5.0
npm ci --ignore-scripts
npm run pages
docker build -t bidi-text-bench-test ../..          # or: npm run docker:test from the repo root
docker run --rm --init --ipc=host -v "$PWD:/work" -w /work bidi-text-bench-test npx playwright test
npm run analyze
```
On Windows Git Bash, prefix the `docker run` with `MSYS_NO_PATHCONV=1` and pass the absolute path to `-v`.

## Caveats
- The "golden" render shows correct *markup*. It is not a native-verified expectation: the seeds are drafts.
- There is one fixture per page. fitlocale's `rtl/missing-dir` is a page-level check, so this setup flatters it. On a page with many messages it was not tested.
- n = 11 fixtures, synthetic pages. These are observations, not a benchmark of fitlocale.
