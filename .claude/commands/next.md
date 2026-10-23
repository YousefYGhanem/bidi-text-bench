---
description: Do the next unchecked task in TASKS.md (stops at gates and at tasks that are Yousef's)
argument-hint: "[optional extra instructions]"
---
1. Read TASKS.md and find the first unchecked item.
2. If it is a gate (G#) or tagged [Y], stop.
   - For a gate, prepare the decision memo described in docs/PLAN.md §6. Keep it to one page at most: the options, the evidence and your recommendation. Then ask me with AskUserQuestion.
   - For a [Y] task, tell me exactly what to do, in at most 5 steps.
3. Otherwise, read only the docs this task needs and state your plan in at most 5 bullets. Then do the task. Use plan mode if it touches more than 3 files.
4. The task is done when:
   - tests are added or updated;
   - `npm run check` is green;
   - docs are updated;
   - TASKS.md is ticked;
   - one Conventional Commit is made.
5. Report in at most 3 lines: what changed, anything marked NEEDS-YOUSEF, and what's next.

Extra instructions from me (may be empty): $ARGUMENTS
