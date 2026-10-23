# Launch & visibility playbook

## 1. Build in public (from week 2)
- Make the repo public from Phase 1 with a "work in progress" banner. Keep audit results out of it until they've been reported (see AUDIT_PROTOCOL §1.5).
- Post one short update on LinkedIn every week. `/weekly` drafts it, and **you rewrite it in your own words**. Each post covers one finding, one screenshot and one lesson. Rotate between English, Hebrew and Arabic.

## 2. Pre-launch checklist (week 7)
- [ ] README: a one-line pitch, a 20-second before/after GIF, a quick start, a "Found bugs" table linking the upstream issues, the AI-use disclosure and a citation.
- [ ] Report site live, with methodology and limitations pages. Every failure has evidence.
- [ ] Dataset release v1.0.0 with a DOI (via Zenodo) and CITATION.cff. A Hugging Face dataset card is optional.
- [ ] A 60–90-second demo video: a screen recording with your voice.
- [ ] A 3-line GitHub profile README: who you are, the flagship project, and "bugs I've found in public".
- [ ] LinkedIn:
  - your headline;
  - Featured section: the report and your best bug thread;
  - About: your niche in one sentence;
  - "Open to work", visible to recruiters only.
- [ ] Upwork: a fixed-price "RTL/i18n QA audit" offer that uses the report as proof.

## 3. Launch day (Tue/Wed of week 8, starting 15:00–16:00 Israel time)
1. **Show HN:** post `Show HN: I tested 20 AI chat tools with Arabic and Hebrew – here's what broke`, linking the report.
   - Your first comment says you're the author and explains what it is, the method and the limitations.
   - Answer every comment for 3 hours.
2. **LinkedIn (English):** an article or post with 3 screenshots. Follow with Hebrew and Arabic posts over the next two days.
3. **dev.to:** a write-up covering the method and the 3 most interesting bugs.
4. **Reddit:** r/QualityAssurance, r/Playwright, r/webdev and r/localization. Read each subreddit's self-promotion rules first.
5. **Ministry of Testing Club** and the Playwright community channels.

Never mass-DM people, never tag companies to shame them, and keep politics out of it.

## 4. Israel & talks
- **Test.IL** (the Israeli testing community): offer a 20-minute talk, "What AI tools get wrong about Arabic and Hebrew".
- **Other communities:** Jerusalem tech meetups and Arabic-speaking developer communities.
- **Online CFPs:** OnlineTestConf, Ministry of Testing events (TestBash, "99-second talks") and TestMu. Check their current deadlines, and prefer pre-recorded formats.

## 5. Turning attention into interviews
- When a maintainer acknowledges a report, thank them. When it's fixed, post about the fix and credit them.
- Message i18n or developer-experience engineers at the audited companies **about their bug, with the evidence of the fix**, not about your CV. Send one message and one follow-up a week later, then stop.
- Keep applying to roles in parallel, both in Jerusalem/Israel and remote. Attach the report link instead of writing a long cover letter.

## 6. CV / LinkedIn lines
Replace the placeholders with real numbers that anyone can check.

**CV — Flagship project (top section):**
- *bidi-bench — open-source RTL/BiDi test suite (Playwright, TypeScript, GitHub Actions, Docker).* Built a [200]-case Arabic/Hebrew fixture corpus verified by a native reader. Audited [20] AI chat and coding tools and filed [12] reproducible upstream reports ([N] acknowledged, [M] fixed), including [anthropics/claude-code, openai/codex].
- Designed a severity-weighted RTL quality rubric and validated the checker on a labelled bug zoo ([100]% recall, [0] false positives). Published the report and the dataset with a DOI ([cited by …]).
- Extended the checks to LLM output ([50] prompts across Arabic, Hebrew and Levantine code-switching) and to Android on a physical device.

**LinkedIn headline:** Computer Engineer | Test Engineering | RTL/i18n & AI-product testing (Arabic · Hebrew · English)

## 7. Metrics (update weekly in `docs/METRICS.md`)
- fixtures verified
- targets audited
- reports filed, acknowledged and fixed
- PRs opened and merged
- stars
- report visits
- inbound messages
- talks submitted and accepted
- gigs
