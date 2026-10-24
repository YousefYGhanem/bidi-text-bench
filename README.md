# bidi-text-bench

> **Work in progress.** There are no verified fixtures, no checker and no audit results yet.
> Progress is tracked in [TASKS.md](TASKS.md). The name was chosen at Gate G0 (docs/adr/0002-project-name.md).

An open-source test suite for right-to-left and bidirectional text in Arabic and Hebrew:

1. **Corpus.** Short, realistic mixed-direction fixtures: Arabic or Hebrew with Latin words, code, numbers and links. A native reader verifies each one.
2. **Checker.** A Playwright/TypeScript tool that renders fixtures in real UIs and flags bidi failures.
3. **Audit.** A public, repeatable audit of AI chat and coding tools. Every confirmed bug is reported upstream before it is published.

Scope, phases and gates are in [docs/PLAN.md](docs/PLAN.md).

## Development

You need Node 22 or later and Docker.

```bash
npm ci
npx playwright install
npm run check          # lint, typecheck, unit tests, corpus validation
npm run test:e2e       # Playwright on this machine
npm run docker:test    # Playwright in the reference image (Noto Arabic and Hebrew fonts)
npm run golden         # rebuild zoo/golden.html (the reference render) after editing fixtures
npm run zoo            # bug zoo: recall and false positives per checker rule
npm run review         # review draft fixtures in the browser (yours only; see FIXTURE_SPEC §5)
```

Screenshots and audit evidence come from the Docker image, not from your machine's fonts.

## AI use

This project is built with Claude Code as a pair programmer.

- Code commits keep the AI co-author trailer.
- A native reader (Yousef Ghanem) verifies every fixture's expected result and every published finding. Verification commits are authored by a human; CI will check their hashes from task 1.1 on.
- Decisions are recorded in [docs/adr/](docs/adr/).

## Licence

- Code: [Apache-2.0](LICENSE).
- Data in `corpus/` and `audit/`: [CC BY 4.0](LICENSE-DATA).

To cite this project, see [CITATION.cff](CITATION.cff).
