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
- the bidi-bench commit.

Automated runs write these to `env.json`. For manual runs, you fill in the same fields in the helper.

## 3. Automated runs
`npm run audit -- --target <id>` runs every verified fixture on each applicable surface and writes the results to `audit/runs/<date>-<target>/`. Then run `/audit <id>` to have Claude summarise and group the failures for your triage.

## 4. Manual runs (closed products)
Effort is capped at **30 fixtures per product**, stratified across categories (the helper picks them). That's about 1 hour per product.

`npm run manual -- --target <id>` opens a local helper. For each fixture:
1. The helper copies a prompt to your clipboard: *"Repeat the following text exactly, with no changes and no extra words:"* followed by the fixture text.
2. **Input check:** paste the prompt into the product's compose box *before sending*. Take a screenshot (Win+Shift+S) and paste it into the helper.
3. Send it, then screenshot the reply and paste that into the helper.
4. Mark each applicable check as pass, fail or n.a., and add a note. If the model changed the text, mark it "content changed" and retry once.

The helper saves `audit/manual/<date>-<target>/results.jsonl` and the evidence, in the same format as automated runs.

## 5. Triage (you)
`npm run triage` lists every failure with its expected and actual results and its evidence. Give each failure one label:
- **confirmed**;
- **false positive**: log it in `docs/FALSE_POSITIVES.md`, then fix the rule or the adapter;
- **duplicate of known issue**: link the existing issue;
- **won't report**: give the reason.

Confirm or change the severity of each failure as you go. Nothing reaches the report untriaged.

## 6. Scoring (rubric v0; you set the final weights at Gate G4)
For each category, compute a severity-weighted pass rate: *s = Σ(w·pass) / Σ(w·applicable)*. The weights are w = 3 for blocker, 2 for major and 1 for minor.
The target's score is Σ (category weight × s) over the applicable categories, renormalised to 100.

| Category | BD | ISO | NP | CODE | AL | NUM | INP | STRM | LIST | TBL | FONT | DIAC | TRUNC |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Weight v0 | 15 | 15 | 10 | 10 | 8 | 8 | 8 | 6 | 5 | 5 | 4 | 3 | 3 |

In v1, MIR and COPY are reported as findings but not scored. Publish the per-category results next to the total, because a single number hides what matters.

## 7. Reporting upstream
Run `/draft-bug <finding>`. Claude uses the `upstream-bug-report` skill to draft a report into `drafts/bugs/`, with a duplicate search, a minimal reproduction and the evidence. You check it, edit it and post it.

If an issue already exists, comment on it with your new evidence rather than opening a duplicate. Track every report in `docs/REPORTS.md`: target, link, date and status (open / acknowledged / fixed / closed).

## 8. Re-audit
Re-audit quarterly, with the same corpus version plus any new fixtures. Each re-audit adds a "fixed since last audit" table to the report, which gives you recurring news and proof of impact.
