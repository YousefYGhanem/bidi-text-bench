# bidi-text-bench — instructions for Claude Code

## Mission
bidi-text-bench is an open-source RTL/bidi test suite with three parts:
1. a corpus of Arabic and Hebrew fixtures, verified by a native reader;
2. a Playwright checker that renders the fixtures in real UIs and flags bidi failures;
3. a public, repeatable audit of AI tools, with every confirmed bug reported upstream.

Owner: Yousef Ghanem (native Arabic, professional Hebrew and English, ISTQB CTFL). This is his public portfolio, so **credibility beats speed.**

## Read on demand (don't preload)
- Progress: `TASKS.md` is the source of truth.
- Plan, gates and acceptance criteria: `docs/PLAN.md`.
- Specs: `docs/FIXTURE_SPEC.md`, `docs/CHECKER_SPEC.md`, `docs/AUDIT_PROTOCOL.md`.
- Launch: `docs/LAUNCH.md`.
- Decisions: `docs/adr/`.
- Domain knowledge: the skill `bidi-testing`.
- Drafting bug reports for other projects: the skill `upstream-bug-report`.

## Non-negotiable rules
1. Never set a fixture to `status: verified` and never write its `verification` field. Only Yousef does that, through `npm run review`. Every fixture you write is `status: draft`.
2. Never post, comment, or open issues or PRs on other repositories. Never publish anything (npm, releases, GitHub Pages, social media). Draft into `drafts/` and stop.
3. Never automate logged-in consumer products (ChatGPT, Claude.ai, Gemini, Copilot and the like) and never type credentials. These products go through the manual protocol.
4. Never read, print or commit secrets. Keys live in `.env`, which is gitignored; `.env.example` holds the variable names only.
5. Audit only the targets in `audit/targets.yaml`, at a low rate, following `docs/AUDIT_PROTOCOL.md`.
6. Report findings as "observed in <product> <version> on <date>". Make no claims beyond the evidence.
7. For anything that needs a native speaker's judgement, write `NEEDS-YOUSEF: <question>` and list it in your summary.
8. Stop at every gate (G0…G9) and at every task tagged [Y], and ask with AskUserQuestion.

## Workflow
- At the start of a session, read TASKS.md and find the first unchecked task. State a plan in at most 5 bullets, then do it. Use plan mode when a task touches more than 3 files or the architecture.
- Make small commits with Conventional Commit messages, and keep the Co-Authored-By trailer (AI-use transparency). Yousef makes his own `verify:` commits; never add the trailer to those.
- A task is done when:
  - tests are written;
  - `npm run check` is green;
  - docs are updated;
  - TASKS.md is ticked;
  - you've written a summary of at most 3 lines covering what changed, any NEEDS-YOUSEF items, and what comes next.
- Do the simplest thing that works. Any new dependency needs a one-line justification in the commit body.
- Yousef develops on Windows 11, so npm scripts must not use bash-only syntax. Use node scripts instead.
- The machine has 16 GB of RAM. Run one Docker target at a time and run `docker compose down` after each audit.
- To explore a target UI (finding selectors, checking rendering), use the `playwright-cli` skill. It costs fewer tokens than an MCP browser. Never use it on logged-in consumer products. Put throwaway exploration scripts in a gitignored `scratch/` folder.

## npm scripts (created during Phases 0–3)
- `npm run check`: lint, typecheck, unit tests and corpus:validate.
- `npm test` and `npm run test:e2e`.
- `npm run corpus:validate`, `npm run review` and `npm run zoo`.
- `npm run mock-llm`.
- `npm run audit -- --target <id>`, `npm run manual -- --target <id>`, `npm run triage` and `npm run report`.
- `npm run docker:test`.

## Slash commands
- `/next`: do the next task.
- `/phase <n>`: work through a whole phase.
- `/fixtures <ar|he> <category> <count>`
- `/audit <target>`
- `/draft-bug <finding>`
- `/weekly`

## Stack
- TypeScript (strict) on Node LTS.
- Testing: @playwright/test and Vitest.
- Libraries: bidi-js, yaml and ajv.
- Linting and formatting: Biome.
- Docker: the official Playwright image plus Noto Arabic, Hebrew and Mono fonts.
- CI: GitHub Actions. Docs and report site: VitePress.

## Text handling
- Keep Arabic and Hebrew text in source files in logical order. Never "fix" how text displays by reversing it or adding control characters.
- In YAML fixtures, use single-quoted strings (so backslashes stay literal) and keep the text NFC-normalised.
