# ADR-0002: Name the project bidi-text-bench

- Status: accepted
- Date: 2026-10-23
- Decided by: Yousef Ghanem at Gate G0

## Context
The working name `bidi-bench` was free on npm and GitHub. But "BiDi" means the WebDriver BiDi protocol to Playwright and Selenium users, who are our audience, and npm and GitHub searches for "bidi" show those projects first. `rtl-bench` is taken on GitHub by a register-transfer-level hardware benchmark, and "RTL" is ambiguous in AI-benchmark circles. Evidence: [NAME_CHECK.md](../NAME_CHECK.md).

## Decision
The project is named **bidi-text-bench**. It is free on npm and has no exact GitHub repo as of 2026-10-22.

## Consequences
- These were renamed: the package name, README, CITATION.cff, the docs, the agents and skills, and the Docker image tag (`bidi-text-bench-test`).
- The local folder name, and the setup guides that refer to it (START_HERE.md and KICKOFF_PROMPT.md), stay as they are.
- Task 0.9 creates the GitHub repo under this name. Check `gh repo view <owner>/bidi-text-bench` first.
