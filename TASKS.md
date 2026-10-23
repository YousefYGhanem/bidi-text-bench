# Tasks — bidi-text-bench v1

Tags: **[C]** Claude Code · **[Y]** Yousef · **[P]** pair (Claude drafts, Yousef decides).
Claude ticks `[x]` when a task is done. Claude never ticks a [Y] task or a gate; it asks Yousef.
For details and acceptance criteria, see `docs/PLAN.md` §6. At the end of each work week, run `/weekly`.

## Phase 0 — Foundation (week 1)
- [ ] 0.1 [Y] Install the prerequisites and the Playwright CLI skill, then run `gh auth login`. Open the repo in Claude Code and accept the trust prompt (see START_HERE.md).
- [x] 0.2 [C] Run `git init`. Scaffold package.json with the scripts listed in CLAUDE.md, strict TypeScript, Biome, Vitest and a Playwright config (chromium, firefox, webkit). Keep `.gitignore` and `.env.example`.
- [x] 0.3 [C] Write a Dockerfile:
  - Base it on `mcr.microsoft.com/playwright:v<same version as @playwright/test>-noble`.
  - Add `fonts-noto-core` and `fonts-noto-mono`; the official image ships no Arabic- or Hebrew-specific fonts.
  - The build must assert `fc-list :lang=ar` and `:lang=he`.
  - Add `npm run docker:test`.
- [x] 0.4 [C] Add GitHub Actions that run `npm run check` and the Playwright tests in the Docker image.
- [x] 0.5 [C] Add these files:
  - LICENSE (Apache-2.0)
  - LICENSE-DATA (CC BY 4.0, for corpus/ and audit/)
  - a README stub with a WIP banner and an AI-use note
  - CONTRIBUTING.md and CITATION.cff
  - issue templates: new fixture, false positive, bug
- [x] 0.6 [C] Write docs/LANDSCAPE.md:
  - Try fitlocale hands-on against the seed fixtures (MIT; v0.4.3 on 21 Oct 2026; 22 rules). Map its rules to our taxonomy as overlaps and gaps. Relevant rules: rtl/bidi-order, rtl/missing-dir, rtl/font-fallback, rtl/clipped-marks, rtl/not-mirrored, rtl/icon-not-mirrored, overflow/*.
  - Cover Android pseudo-locales, rtlcss and existing RTL corpora.
  - Catalogue the open RTL issues in AI-tool repos, with links and status.
- [x] 0.7 [P] Name check. Look at npm and GitHub availability and the risk of confusion with WebDriver BiDi. Propose 2–3 options with evidence.
- [x] 0.8 [P] Taxonomy review. Propose changes to docs/FIXTURE_SPEC.md §2 — for example, should the symptom categories NP and NUM be folded into the cause categories BD and ISO?
- [x] 0.9 [Y] Create the GitHub repo. Claude prepares the `gh repo create` command; you run it. Recommended: public with a WIP banner. Alternative: private until Phase 6.
- [x] G0 [Y] Decide the fitlocale strategy, the name and the taxonomy. Claude then writes ADR-0001…0003.

## Phase 1 — Corpus v0 + review tool (week 2)
- [x] 1.1 [C] Write corpus/schema/fixture.schema.json and `npm run corpus:validate`. It checks the schema, unique IDs, that every span is inside the text, NFC normalisation, stray bidi controls and the verification hash.
- [ ] 1.2 [C] Build the reference renderer with correct markup: dir, isolates, logical CSS and Markdown. The review tool uses it, and it doubles as zoo/golden.html.
- [ ] 1.3 [C] Build the review tool, `npm run review`:
  - It lists the drafts. For each one it shows the reference render, the logical text and the expected_notes.
  - It offers Approve / Needs fix / Reject, plus a note.
  - It writes `status` and `verification` {by, at, hash}.
  - It has keyboard shortcuts and an RTL-correct UI.
- [ ] 1.4 [P] Move the seeds into their category files. Draft fixtures up to 80 in total, covering every category in both ar and he (`/fixtures`).
- [ ] 1.5 [Y] Review all 80 in the review tool, then commit the verifications yourself (`verify: …`).
- [ ] G1 [Y] At least 80 fixtures are verified and CI is green.

## Phase 2 — Checker v0 (week 3)
- [ ] 2.1 [C] Build the engine on bidi-js: expected embedding levels and the visual order of each line. Tests include a subset of BidiCharacterTest.txt. Use the version that matches bidi-js's UBA (13.0.0), and document any drift from current Unicode.
- [ ] 2.2 [C] Build the DOM probe (graphemes, rects, lines, styles, overflow), with tests on hand-made pages.
- [ ] 2.3 [C] Write rules v0: BD, AL, ISO, NP, NUM, CODE, LIST, TBL, TRUNC and FONT (notdef).
- [ ] 2.4 [C] Build the bug zoo and `npm run zoo`, which prints a recall / false-positive table. CI requires 100% recall and 0 false positives.
- [ ] 2.5 [C] Calibrate: the probe output on the golden page must equal the engine output for every verified fixture, in chromium, firefox and webkit.
- [ ] 2.6 [C] Run the rule-reviewer subagent on every rule and fix what it finds.
- [ ] G2 [Y] Accept or reject each rule, based on its one-paragraph logic summary and the zoo table.

## Phase 3 — Pilot (week 4)
- [ ] 3.1 [C] Build tools/mock-llm: OpenAI-compatible, streaming and non-streaming, with `node --test` self-tests.
- [ ] 3.2 [C] Write the adapter interface plus 2 auto-chat adapters. Compose files go under audit/targets/<id>/.
- [ ] 3.3 [C] Build `npm run audit -- --target <id>`. It writes audit/runs/<date>-<target>/ containing env.json, results.jsonl and evidence/.
- [ ] 3.4 [C] Build the manual helper (`npm run manual -- --target <id>`) and the triage view (`npm run triage`).
- [ ] 3.5 [Y] Pilot on 2 automated targets (`/audit`) and 1 manual product. Triage every failure.
- [ ] 3.6 [P] Fix the rules or adapters behind each false positive, and log it in docs/FALSE_POSITIVES.md.
- [ ] 3.7 [P] File the first 2–3 upstream reports. Claude drafts them with `/draft-bug`; you check for duplicates, edit and post. Record them in docs/REPORTS.md.
- [ ] G3 [Y] The pilot findings are credible and the first reports are filed.

## Phase 4 — Corpus 200 + rubric (week 5)
- [ ] 4.1 [P] Draft up to about 200 fixtures. Include at least 20 dialect or code-switching cases, 10 streaming traps and 10 input traps, with at least 6 per category per language.
- [ ] 4.2 [Y] Review all the new fixtures.
- [ ] 4.3 [P] Set up the rubric. You set the weights and severity (docs/AUDIT_PROTOCOL.md §6); Claude implements the scoring and its tests.
- [ ] G4 [Y] Freeze the rubric for the v1 audit.

## Phase 5 — Full audit (week 6)
- [ ] 5.1 [C] Finalise audit/targets.yaml with 15–25 targets. For each, confirm it runs or is reachable, and record its version, report channel and ToS note.
- [ ] 5.2 [C] Run every automated target, one at a time, and produce the audit-triager summaries.
- [ ] 5.3 [Y] Run the manual targets, with 30 stratified fixtures each.
- [ ] 5.4 [Y] Triage every failure (`npm run triage`).
- [ ] 5.5 [P] Optional Track B: a promptfoo suite in trackb/ with about 50 prompts against 3–5 models, under an API spend cap.
- [ ] G5 [Y] No failures are left untriaged and the scores are computed.

## Phase 6 — Report + dataset (week 7)
- [ ] 6.1 [C] Build the report site (VitePress, deployed to GitHub Pages):
  - pages: scoreboard, one page per target, evidence, methodology, limitations, AI use, how to reproduce;
  - CI runs axe-core and bidi-text-bench's own checks against the site.
- [ ] 6.2 [C] Prepare the release: CHANGELOG, v1.0.0 notes, Zenodo DOI steps and an optional Hugging Face dataset card.
- [ ] 6.3 [C] Write ADRs for the key decisions (docs/adr/).
- [ ] 6.4 [Y] Write the launch article in your own voice. Claude edits for clarity only.
- [ ] G6 [Y] The site preview is approved. Every published failure links to a report filed at least 7 days earlier, or gives a reason for not filing one.

## Phase 7 — Launch (week 8)
- [ ] 7.1 [P] Reach 8–15 upstream reports in total, plus at least 1 PR to an open-source target.
- [ ] 7.2 [Y] Launch as described in docs/LAUNCH.md, and answer comments for 72 hours.
- [ ] 7.3 [C] Save a metrics snapshot to docs/METRICS.md.
- [ ] G7 [Y] Launched.

## Phase 8 — Packaging + mobile (week 9)
- [ ] 8.1 [C] Get the npm package and the GitHub Action ready to publish. You run `npm publish` and create the release.
- [ ] 8.2 [P] Build the Android add-on: Appium on the Pixel 8, with the ar-XB pseudo-locale and real ar/he locales, covering 2 apps.
- [ ] 8.3 [P] Handle community triage: labels, answers and fixture PRs. You verify the fixtures.

## Phase 9 — Talk + write-up (week 10)
- [ ] 9.1 [P] Prepare a 20-minute talk deck plus a recorded version, and a 1,500-word write-up.
- [ ] 9.2 [Y] Submit 2–3 CFPs.
- [ ] 9.3 [P] Update the CV, LinkedIn and Upwork with real numbers (docs/LAUNCH.md §6).
- [ ] G9 [Y] Hold a retrospective and schedule the quarterly re-audit.
