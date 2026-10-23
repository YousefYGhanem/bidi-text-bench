---
description: Run the audit for one target and prepare my triage list
argument-hint: <target id from audit/targets.yaml>
---
1. Check that target $ARGUMENTS exists in audit/targets.yaml and that its mode is auto-chat or auto-page. If its mode is manual, tell me to run `npm run manual -- --target $ARGUMENTS` and stop.
2. Start only what this target needs: the mock LLM, and `docker compose` for this target alone. Then run `npm run audit -- --target $ARGUMENTS`.
3. Stop the containers (`docker compose down`) and the mock LLM.
4. Run the audit-triager subagent on the new run folder and show me its summary.
