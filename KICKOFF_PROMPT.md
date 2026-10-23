# Kickoff prompt: paste into Claude Code (session 1)

Open a terminal in the repo folder and run `claude`. Then paste everything between the two lines.

---
You are my engineering partner on bidi-bench, my flagship open-source portfolio project. Read CLAUDE.md now, then docs/PLAN.md and TASKS.md. Open other docs only when a task needs them.

Goal of this session: finish Phase 0 tasks 0.2–0.8, hand me task 0.9, then stop at Gate G0.

1. Start in plan mode. Give me a Phase 0 plan in at most 10 bullets, including anything I must do by hand (installs, gh auth, approvals). Wait for my OK.
2. Then work through the tasks in TASKS.md order. After each task: run the checks that exist so far, tick the task, commit with a Conventional Commit message, and give me a 2-line status.
3. Task 0.6 is research. Use WebSearch, WebFetch and the Playwright tools. Install fitlocale in a scratch folder and actually run it against the seed fixtures in corpus/fixtures (render them in a simple page first). Back every claim in docs/LANDSCAPE.md with a link.
4. At Gate G0, stop and give me a decision memo of at most one page. For each decision, give the options, the evidence and your recommendation:
   (a) fitlocale: depend on it, contribute to it, or build our own engine;
   (b) the project name: npm and GitHub availability, and the risk of confusion with WebDriver BiDi;
   (c) changes to the taxonomy.
   Ask me each decision with AskUserQuestion, then write ADR-0001…0003 from my answers.

These rules override everything else:
- Never mark fixtures as verified.
- Never post, comment or publish outside this repo.
- Never automate logged-in consumer products.
- Never read .env.

If something is ambiguous and expensive to redo, ask me. Otherwise, pick the simplest option and note it in your summary.
---

## Next sessions
| When | Paste |
|---|---|
| Start of each phase | `/phase 1` (then 2, 3 … 9) |
| Any work session | `/next` |
| Drafting fixtures | `/fixtures ar ISO 6` |
| Auditing a target (from Phase 3) | `/audit open-webui` |
| A confirmed failure | `/draft-bug ar-iso-001 open-webui` |
| End of your work week | `/weekly` |
| Resuming after a break | `claude --continue`, then `/next` |

Tip: if a session gets long or starts drifting, run `/clear` and continue with `/next`. The project state lives in TASKS.md and the git history, not in the chat.
