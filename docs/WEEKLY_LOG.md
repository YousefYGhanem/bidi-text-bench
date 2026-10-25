# Weekly log

Appended by `/weekly`, newest last.

## 2026-10-25 (week 1 of the plan)

**Progress: about 3 weeks ahead.**
- The plan (docs/PLAN.md §7) has week 1 (25–31 Oct) for Phase 0.
- Phases 0, 1 and 2 are done with Gates G0, G1 and G2 passed, and Phase 3 is under way (3.0–3.2 done). That is where the plan expects to be in week 4 (15–21 Nov).
- CI is green on main.
- Recommendation: keep the launch date (15/16 Dec). Use the buffer for more upstream reports and a careful triage, not for an earlier launch.

**Metrics** (docs/METRICS.md):
- Fixtures: 80 verified (40 ar, 40 he).
- Audit work: 0 targets audited, 0 reports filed / acknowledged / fixed, 0 PRs.
- Stars: 0.
- Checker: the bug zoo has 34 bugs and 11 controls, at 100% recall and 0 false positives in all three engines.

**Done this week:**
- Phase 0: the scaffold, Docker image, CI, landscape, name check and taxonomy review, with ADR-0001…0004.
- Phase 1: the schema and validator, the reference renderer, the review tool, and 80 fixtures verified by Yousef.
- Phase 2: the engine (bidi-js, UBA 13.0.0), the DOM probe, 10 rules, the bug zoo, calibration, and the independent rule review.
- Phase 3 so far:
  - FONT/TRUNC zoo strengthened (the G2 condition);
  - mock LLM;
  - adapters for Open WebUI and NextChat.

**Blockers and risks:**
1. **Untriaged first results.** Both Open WebUI and NextChat fail BD/AL/NP on he-bd-001 and ar-bd-001. Both render replies with `dir="auto"`, which lays out a Hebrew or Arabic sentence that starts with a Latin word as LTR. Nothing is triaged or searched for duplicates yet, so make no public claim until 3.5–3.7.
2. **Fragile adapter selectors.** NextChat's selectors match build-hashed CSS class names. Any image upgrade can break them; the `TARGET=<id>` smoke test is the check.
3. **Font-dependent FONT zoo.** The FONT bugs rely on no installed font covering Sunuwar (Unicode 16). The Docker image's Unifont fallback already broke the first choice (U+0378). A Windows or image font update could do the same.
4. **No local Firefox.** Firefox does not launch locally on Windows (mozglue error), so Firefox results come only from Docker and CI. That slows debugging Firefox-only failures.
5. **Review load in week 5.** Task 4.2 means reviewing about 120 new fixtures. Spread the drafting over two batches so the review fits next to job applications.

**Top 5 for next week:**
1. 3.3: `npm run audit -- --target <id>`, writing env.json, results.jsonl and evidence/.
2. 3.4: the manual helper and the triage view.
3. 3.5 [Y]: pilot on Open WebUI and NextChat plus 1 manual product, and triage every failure.
4. 3.6: fix any false positives, logged in docs/FALSE_POSITIVES.md.
5. 3.7: draft the first 2–3 upstream reports (Yousef checks for duplicates and posts), then decide G3.
