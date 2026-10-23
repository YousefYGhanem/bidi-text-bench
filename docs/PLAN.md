# bidi-text-bench — Project Plan (v1, 10 weeks)

> Named **bidi-text-bench** at Gate G0 (ADR-0002); the working name was "bidi-bench".
> Progress is tracked in `TASKS.md`. This file explains what each phase must deliver and how we know it's done.

## 1. Outcome

By the end of week 10, three things are public and linked from Yousef's CV, LinkedIn and GitHub:

1. **Corpus.** About 200 mixed-direction fixtures in Arabic and Hebrew. A native reader (Yousef) verifies each one. It is released under CC BY 4.0 with a DOI.
2. **Checker.** An open-source Playwright/TypeScript tool that renders fixtures in a real UI and reports bidi failures. Its accuracy is proven on a labelled "bug zoo".
3. **Audit.** "State of RTL in AI tools (2026)" scores 15–25 AI chat and coding tools with a published rubric. Every confirmed failure is reported upstream, with evidence and a reproducible method.

### Success metrics
| Level | Target | Who controls it |
|---|---|---|
| Must-hit | 200+ verified fixtures; 15+ audited products; 10+ upstream reports with reproductions; 1+ merged PR; report and methodology published | You |
| Good signal | 3+ reports acknowledged or labelled by maintainers; 1+ fix that cites your fixture; 100–300 GitHub stars; shared by at least one i18n, accessibility or Israeli tech newsletter | Partly you |
| Inbound | recruiter or engineer messages that cite the audit; 1–2 paid RTL/i18n audit gigs; 1 accepted talk | Outcome |

Star counts are noisy. Employers check maintainer acknowledgements and fixes.

## 2. Scope

**In v1:**
- Web surfaces. Desktop and Electron apps are covered through the manual protocol.
- Arabic and Hebrew.
- Chromium, Firefox and WebKit.
- A desktop viewport and one mobile viewport.
- Track B (optional): a mini-check of LLM output with ≤50 prompts.

**Out of v1** (write these down; don't build them):
- Terminal/TUI automation and desktop-app automation.
- iOS.
- Languages beyond Arabic and Hebrew. Persian, Urdu and Yiddish can come later as community contributions.
- A SaaS product or a browser extension. These belong to the growth phase.
- Fixing other projects beyond 1–3 PRs.

## 3. How it works

```
corpus/fixtures/*.yaml ──► engine (bidi-js, UAX #9) ──► expected visual order
        │                                                        │
        ▼                                                        ▼
adapter renders the fixture in a target ──► DOM probe ──► rules ──► results.jsonl + evidence
(auto-chat via mock LLM · auto-page · manual protocol)                     │
                                                                           ▼
                                        triage (you) ──► rubric score ──► report site
                                                    └──► upstream bug drafts (you post them)
```
For the details see:
- `docs/CHECKER_SPEC.md` for the checker.
- `docs/FIXTURE_SPEC.md` for the fixture format.
- `docs/AUDIT_PROTOCOL.md` for the audit rules.

## 4. Repository layout (target)
```
corpus/   schema/  fixtures/<lang>/<category>.yaml
src/      engine/  probe/  rules/  adapters/  cli/  report/
tools/    mock-llm/  review/            (local fixture review UI)
zoo/      golden.html  bugs/<RULE>-<n>.html   (labelled synthetic bugs)
audit/    targets.yaml  targets/<id>/compose.yaml  runs/  manual/
trackb/   promptfoo config + assertions (optional)
site/     VitePress docs + generated report pages
docs/     PLAN, specs, adr/, LANDSCAPE, REPORTS, METRICS, WEEKLY_LOG
drafts/   (gitignored) bug-report and social drafts for you to post
```

## 5. Who does what
| Work | Owner |
|---|---|
| Code, tests, CI, Docker, docs scaffolding, research summaries, first drafts | Claude Code |
| Failure taxonomy, every fixture's expected result, rubric weights, severity calls, triage of every failure | **You** |
| Posting anything outside the repo (issues, PRs to other projects, launch posts), npm and GitHub releases | **You** |
| The article's voice, the talk, CV and LinkedIn text | **You** (Claude edits for clarity only) |

This split is the credibility story. The machine work is automated, and the judgement is visibly yours. Your verification commits carry your name, and the decisions are recorded in ADRs.

## 6. Phases and gates

Every phase ends with a gate. Claude Code stops at each gate and asks you to decide.

### Phase 0 — Foundation (week 1)
**Deliverables:**
- A working environment.
- The repo scaffold: TypeScript strict, Biome, Vitest, Playwright, Docker with Noto Arabic/Hebrew fonts, and CI.
- Licences: Apache-2.0 for code and CC BY 4.0 for data.
- CONTRIBUTING, CITATION.cff and issue templates.
- `docs/LANDSCAPE.md`, which covers:
  - fitlocale, tried hands-on;
  - Android pseudo-locales and rtlcss;
  - existing corpora;
  - a catalogue of open RTL issues in AI-tool repos.
- A name check.

**Gate G0 — decide:**
- (a) fitlocale: depend on it, contribute to it, or build our own engine;
- (b) the final name;
- (c) taxonomy v1.

These decisions are recorded as ADR-0001…0003.

**Accept when:**
- `npm run check` and CI are green on the empty scaffold.
- The Docker build asserts that Arabic and Hebrew fonts are present (`fc-list :lang=ar`, `fc-list :lang=he`).

### Phase 1 — Corpus v0 + review tool (week 2)
**Deliverables:** a JSON Schema and `npm run corpus:validate`; a reference renderer that uses correct markup; the review tool (`npm run review`); and 80 drafted fixtures covering every category in both languages.
**Gate G1:** you have verified at least 80 fixtures, and their verification hashes pass in CI.

### Phase 2 — Checker v0 (week 3)
**Deliverables:**
- The expected-order engine, tested against a subset of the Unicode conformance tests.
- The DOM probe.
- Rules BD, AL, ISO, NP, NUM, CODE, LIST, TBL, TRUNC and FONT (notdef).
- The bug zoo.
- A calibration test across Chromium, Firefox and WebKit.

**Gate G2:**
- For every shipped rule, the zoo table shows 100% recall on the bug pages and 0 failures on the golden page.
- You have read each rule's logic summary and accepted it.

### Phase 3 — Pilot (week 4)
**Deliverables:**
- The mock LLM server.
- The adapter interface and adapters for 2 open-source chat UIs.
- `npm run audit`, the manual helper (`npm run manual`) and the triage view (`npm run triage`).
- A pilot run on 2 automated targets and 1 manual target.
- A false-positive log.
- The first 2–3 upstream reports. Claude drafts them; you check and post them.

**Gate G3:** the pilot findings hold up under your manual review, and the first reports are filed.

### Phase 4 — Corpus 200 + rubric (week 5)
**Deliverables:** about 200 verified fixtures, including dialect and code-switching cases plus streaming and input traps; rubric v1 with your weights, implemented with tests.
**Gate G4:** the rubric is frozen for the v1 audit.

### Phase 5 — Full audit (week 6)
**Deliverables:**
- 15–25 targets in `audit/targets.yaml`, each with its version and terms-of-service notes.
- Every automated target run.
- Every manual target done by you, with 30 stratified fixtures each.
- Every failure triaged and scores computed.

**Optional Track B** (`trackb/`, promptfoo) runs about 50 prompts against 3–5 models. Use one low-cost model per vendor plus one local open model through Ollama. It checks four things:
1. No legacy embedding or override controls (U+202A–U+202E).
2. Commands, paths and code inside RTL sentences are in backticks or isolated.
3. Numerals follow what the prompt asked for.
4. Arabic prose uses Arabic punctuation (، ؛ ؟).

Report these results as observations (small n), not as a leaderboard. Set a spend cap with each provider.

**Gate G5:** no failures are left untriaged.

### Phase 6 — Report + dataset (week 7)
**Deliverables:**
- The report site: scoreboard, per-target pages, evidence, methodology, limitations, AI-use disclosure, and how to reproduce.
- Dataset release prep: v1.0.0, CHANGELOG, a Zenodo DOI guide, and an optional Hugging Face card.
- ADRs.
- Your draft of the launch article.

**Gate G6:**
- You approve the site preview.
- Every published failure links to a filed report, or documents why it was not reported.
- The courtesy window is met: each failure is published at least 7 days after its report was filed.

### Phase 7 — Launch (week 8)
**Deliverables:** 8–15 upstream reports in total; at least 1 PR to an open-source project; the launch, following `docs/LAUNCH.md`; and a metrics snapshot.
**Gate G7:** you have launched and handled responses for 72 hours.

### Phase 8 — Packaging + mobile (week 9)
**Deliverables:**
- An npm package and a GitHub Action. You publish them.
- An Android add-on on the Pixel 8, using Appium with the ar-XB pseudo-locale and real ar/he locales, covering 2 apps.
- Community triage.

### Phase 9 — Talk + write-up (week 10)
**Deliverables:**
- A 20-minute talk deck plus a recorded version.
- A 1,500-word write-up.
- 2–3 CFP submissions.
- CV, LinkedIn and Upwork updates with real numbers.

**Gate G9:** a retrospective, and the quarterly re-audit scheduled.

## 7. Timeline (Sunday-start weeks)
| Week | Dates | Phase |
|---|---|---|
| 1 | 25 – 31 Oct 2026 | 0 Foundation |
| 2 | 1 – 7 Nov | 1 Corpus v0 |
| 3 | 8 – 14 Nov | 2 Checker v0 |
| 4 | 15 – 21 Nov | 3 Pilot + first reports |
| 5 | 22 – 28 Nov | 4 Corpus 200 + rubric |
| 6 | 29 Nov – 5 Dec | 5 Full audit |
| 7 | 6 – 12 Dec | 6 Report + dataset |
| 8 | 13 – 19 Dec | 7 **Launch (Tue 15 or Wed 16 Dec)** |
| 9 | 20 – 26 Dec | 8 Packaging + mobile |
| 10 | 27 Dec – 2 Jan 2027 | 9 Talk + write-up |

If you slip by more than a week, move the launch to 12–14 Jan 2027. Late-December launches get little attention.

## 8. Time and money
**Weekly time (35 h):**
- Building: about 18 h.
- Fixtures and review: about 6 h.
- Audit and bug reports: about 5 h.
- Writing and visibility: about 3 h.
- Job applications: about 3 h. Keep applying throughout the project.

**Money:**
- Free: GitHub (Actions and Pages for a public repo), Docker Desktop (personal use), Zenodo and Hugging Face.
- Track B API calls: cap at about $10–15 in each provider's dashboard.
- Optional domain: about $10–15 a year.
- Claude usage: your current plan. The setup routes routine work to cheaper models to stretch your limits.

## 9. Risks
| Risk | Mitigation |
|---|---|
| Someone ships the same idea (fitlocale is only days old) | The moat is the verified corpus, the audit and the upstream impact. Contribute rather than compete on engines (decided at G0). |
| Maintainers ignore reports | Prefer active repos. Comment on existing issues with reproductions instead of opening duplicates. Measure acknowledgements, not fixes. |
| False positives undermine the report | Bug zoo plus calibration. You triage every failure before anything is published. |
| Terms of service | Never automate logged-in consumer products; use the manual protocol. Visit public pages only, at a low rate. Use neutral wording. |
| Doubts about an "AI-generated portfolio" | Verification hashes, verification commits you author yourself, ADRs, an AI-use disclosure and a recorded talk. |
| Scope creep | Gates, the out-of-scope list above, and web first. |
| 16 GB RAM and Windows friction | Run one Docker target at a time, cap memory in `.wslconfig`, and run heavy cross-browser jobs in CI. |
| Sensitivity of pairing Arabic and Hebrew | Purely technical framing. Both languages are treated equally, with no conflict-related content anywhere. |

## 10. AI-use policy (goes into the README)
This project is built with Claude Code as a pair programmer.
- Code commits keep the AI co-author trailer.
- A native reader verified every fixture's expected result and every published finding. Verification commits are authored by a human and hash-checked in CI.
- Decisions are recorded in `docs/adr/`.

## 11. After v1 (growth)
- A quarterly re-audit with a "fixed since last time" table.
- Wider adoption of the GitHub Action and the npm package.
- An "RTL lint" bookmarklet for manual testers.
- Appium checks on mobile.
- Community fixtures for Persian and Urdu, with native reviewers.
- Paid RTL/i18n audits through an Upwork offer.
- Accessibility checks of screen-reader order (IS 5568 / EAA).
