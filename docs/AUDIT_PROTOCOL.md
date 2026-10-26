# Audit protocol

## 1. Ground rules
1. Audit only the targets listed in `audit/targets.yaml`.
2. **Never automate logged-in consumer products** (ChatGPT, Claude.ai, Gemini, Copilot, Perplexity and similar). Their terms restrict automated access, so they use the manual protocol (§4).
3. Automation runs only on two kinds of target:
   - self-hosted open-source apps on your own machine;
   - public pages without a login, visited at a low rate (at most one page load every 5 seconds).
4. No security testing, no bypassing controls, no personal data and no load testing.
5. Report first, publish later. Report each confirmed failure upstream, or record why you didn't, at least 7 days before it appears in the public report.
6. Word findings as "observed in <product> <version> on <date> (<OS>, <browser>)". Stick to facts and evidence. No blame and no ranking language such as "worst".

## 2. Record the environment
Every run, automated or manual, records:
- the date;
- the target version, commit or Docker image digest;
- the OS, browser and browser version;
- the viewport and the app's UI language;
- the bidi-text-bench commit.

Automated runs write these to `env.json`. For manual runs, you fill in the same fields in the helper.

## 3. Automated runs
`npm run audit -- --target <id>` runs every verified fixture on each applicable surface and writes the results to `audit/runs/<date>-<target>/`. Then run `/audit <id>` to have Claude summarise and group the failures for your triage.

- **Before a run:** start `npm run mock-llm` and the target (`docker compose -f audit/targets/<id>/compose.yaml up -d`). Afterwards, run `docker compose ... down`. The audit waits up to 3 minutes for the target to answer, because Open WebUI takes about a minute to boot. Ctrl+C also stops the browser container.
- **Flags:**
  - `--browser chromium|firefox|webkit|all` (default chromium);
  - `--viewport desktop|mobile|all` (default desktop);
  - `--only <id,id>` for a subset;
  - `--local` uses this machine's browsers instead of the Docker image. It is for debugging only, and `env.json` records it.
- **Surfaces:** the runner checks the `message` surface only for now. `env.json` lists `input`, `stream` and `title` as skipped, with the reason.
- **Timing:** about 2.3 s per fixture per browser and viewport (80 fixtures: 184 s in Chromium for NextChat on 2026-10-25). The 15-minute budget for 200 fixtures therefore covers 2 browser × viewport combinations, not all 6. Run the rest separately.
- **Runs stay local** (`audit/runs/` is gitignored) until each failure is reported upstream, per §1.5.

## 4. Manual runs (closed products)
Effort is capped at **30 fixtures per product**, stratified across categories (the helper picks them). That's about 1 hour per product.

`npm run manual -- --target <id>` opens a local helper. For each fixture:
1. The helper copies a prompt to your clipboard: *"Repeat the following text exactly, with no changes and no extra words:"* followed by the fixture text.
2. **Input check:** paste the prompt into the product's compose box *before sending*. Take a screenshot (Win+Shift+S) and paste it into the helper.
3. Send it, then screenshot the reply and paste that into the helper.
4. Mark each applicable check as pass, fail or n.a., and add a note. If the model changed the text, mark it "content changed" and retry once.

The helper saves `audit/manual/<date>-<target>/results.jsonl` and the evidence, in the same format as automated runs.

- **Which fixtures:** the helper picks the same 30 for every product (round robin over category × language, with a fixed seed), so products can be compared. `--count` changes the number.
- **First screen:** an environment form (§2), saved as `env.json`.
- **Then, per fixture:**
  - the prompt, with a Copy button (key C);
  - two paste boxes, for the input screenshot and the reply screenshot;
  - the reference render, for comparison;
  - the checks: the fixture's own category plus BD and AL on the reply, and INP on the compose box.
- **Content changed** is recorded as one `error` line.
- **Saving:** S saves; J and K move between fixtures. Re-saving a fixture replaces its lines.
- **Resuming:** `--resume audit/manual/<dir>` continues a session.
- Lines have `viewport: "manual"` and the browser from the form. Manual runs stay local (gitignored) like automated ones.

## 5. Triage (you)
`npm run triage` lists every failure with its expected and actual results and its evidence. Give each failure one label, and a **cause** from FIXTURE_SPEC §2:
- **confirmed**;
- **false positive**: log it in `docs/FALSE_POSITIVES.md`, then fix the rule or the adapter;
- **duplicate of known issue**: link the existing issue;
- **won't report**: give the reason.

Confirm or change the severity of each failure as you go. Nothing reaches the report untriaged.

- **What the view shows:** `npm run triage` opens a local page over every run in `audit/runs/` and `audit/manual/`; `--run <dir>` limits it to one run. One item covers one fixture, surface and rule, across all browsers and viewports, and lists each one's detail, expected and actual order, styles and screenshot.
- **Labels:** `confirmed`, `false-positive`, `duplicate` (needs the issue link) or `wont-report` (needs the reason), plus the cause and the severity.
- **Keys:** S saves; U jumps to the next untriaged item; J and K move.
- **Storage:** decisions are appended to `<run>/triage.jsonl` and the latest per item wins. `results.jsonl` is never edited.
- **Checking:** `npm run triage -- --check` prints the untriaged count and exits 1 while it is not 0.
- **Agent proposals:** a decision whose note starts with `[AI…]` was proposed by agents, not by you. It still counts as untriaged: the page shows it as an "AI proposal" with its reasoning in the note field, and `--check` keeps counting it until you save the item yourself (that save replaces it).

## 6. Scoring (rubric v0; you set the final weights at Gate G4)
For each category, compute a severity-weighted pass rate: *s = Σ(w·pass) / Σ(w·applicable)*. The weights are w = 3 for blocker, 2 for major and 1 for minor.
The target's score is Σ (category weight × s) over the applicable categories, renormalised to 100.

| Category | BD | ISO | NP | CODE | AL | NUM | LIST | TBL | FONT | TRUNC |
|---|---|---|---|---|---|---|---|---|---|---|
| Weight v0 | 15 | 15 | 10 | 10 | 8 | 8 | 5 | 5 | 7 | 3 |

| Surface | message | input | stream | title |
|---|---|---|---|---|
| Weight v0 | to set at G4 | to set at G4 | to set at G4 | to set at G4 |

Taxonomy v1 ([ADR-0003](adr/0003-taxonomy-v1.md)) moved INP (8) and STRM (6) from categories to surfaces and merged DIAC (3) into FONT (4 + 3 = 7). The surface weights are set at G4.

In v1, MIR and COPY are reported as findings but not scored. Publish the per-category results next to the total, because a single number hides what matters.

## 7. Reporting upstream
Run `/draft-bug <finding>`. Claude uses the `upstream-bug-report` skill to draft a report into `drafts/bugs/`, with a duplicate search, a minimal reproduction and the evidence. You check it, edit it and post it.

If an issue already exists, comment on it with your new evidence rather than opening a duplicate. Track every report in `docs/REPORTS.md`: target, link, date and status (open / acknowledged / fixed / closed).

## 8. Re-audit
Re-audit quarterly, with the same corpus version plus any new fixtures. Each re-audit adds a "fixed since last audit" table to the report, which gives you recurring news and proof of impact.
