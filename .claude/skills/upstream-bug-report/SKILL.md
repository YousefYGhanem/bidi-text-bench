---
name: upstream-bug-report
description: "Drafts a bug report or issue comment for another project from a confirmed bidi-text-bench finding: duplicate search, minimal reproduction, evidence and a courteous tone. Use whenever preparing anything that will be posted outside this repository. Produces drafts only and never posts."
---

# Upstream bug report

## Preconditions (stop if either fails)
- Yousef has **confirmed** the finding in triage: its `npm run triage` status is `confirmed`.
- You know the right channel (GitHub issues, a forum, in-app feedback). It is listed in `audit/targets.yaml`.

## Steps
1. **Search for duplicates (read-only).**
   - Run `gh search issues "<keywords>" --repo <owner/repo> --include-prs --limit 30`.
   - Use several queries: `rtl`, `right-to-left`, `arabic`, `hebrew`, `bidi`, `direction`, plus the symptom (e.g. `punctuation`, `code block`).
   - Record the queries and the hits.
2. **If a matching issue exists,** draft a **comment** that adds new evidence (version, minimal reproduction, fixture) instead of a new issue.
3. **Follow the project's rules.** Read its issue template and CONTRIBUTING file, and follow them exactly.
4. **Draft the report:**
   - **Title:** the specific symptom and where it happens, e.g. `RTL: Arabic reply that starts with an English word is rendered left-to-right in chat messages`.
   - **Summary:** 1–2 sentences on the impact on users.
   - **Environment:** product version, OS, browser and date.
   - **Steps to reproduce:** numbered. Give the fixture text twice: in a fenced block (say it is in logical order) and as plain text.
   - **Expected:** one sentence, plus the reference screenshot (the bidi-text-bench reference render).
   - **Actual:** one sentence, plus a screenshot.
   - **Possible fix:** optional, and only if you are confident. For example, `dir="auto"` on the message container, or `unicode-bidi: isolate` on inline code.
   - **Reference:** exactly one link, to the fixture's permalink. No other promotion.
   - Close by offering to test a fix.
5. **Save the draft** to `drafts/bugs/<target>-<fixture-id>.md`. Start it with a header giving the channel URL, the duplicate-search queries and results, and `status: draft`.
6. **Hand over.** Tell Yousef the draft is ready. **Never** run `gh issue create`, `gh issue comment`, `gh pr create` or `gh api` against other repositories, and never post to forums.

## Tone
Courteous, factual and short. No blame, no "your app is broken", no marketing. One issue per root cause.
