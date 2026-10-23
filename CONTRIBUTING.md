# Contributing

Thanks for helping make Arabic and Hebrew text work properly. The project is early (see [TASKS.md](TASKS.md)), so please open an issue before starting anything large.

## Fixtures

A fixture is one short, realistic mixed-direction text, plus a native reader's description of how it must look. [docs/FIXTURE_SPEC.md](docs/FIXTURE_SPEC.md) is the full spec. The rules people miss most often:

- **Logical order only.** Type the text the way a person types it. Never reverse it, and never add invisible controls (LRM, RLM, isolates and so on) unless the fixture is about them. If it is, name each control by code point.
- **Neutral content.** No politics, religion, ethnicity or conflict, no real people and no private data. Use example.com, fictional names and obviously fake numbers.
- **Write natively.** Arabic and Hebrew fixtures are each written in their own language, not translated from each other.
- **Drafts only.** New fixtures always have `status: draft` and `verification: null`. Only a native reviewer changes them, through `npm run review`.

To propose a fixture, open a **New fixture** issue, or send a PR that adds it to `corpus/fixtures/<lang>/<category>.yaml`.

## False positives and bugs

If the checker flags something that renders correctly, open a **False positive** issue. Include the fixture ID, the target, the rule, the browser and a screenshot. For anything else, open a **Bug** issue.

## Code

- `npm run check` must pass: lint, typecheck, unit tests and corpus validation.
- npm scripts must work on Windows, so use Node scripts instead of bash-only syntax.
- Use [Conventional Commits](https://www.conventionalcommits.org/), e.g. `fix(probe): skip collapsed whitespace`.
- Every new dependency needs a one-line justification in the commit body.
- AI-assisted contributions are welcome. Say so with a `Co-Authored-By:` trailer.

## Licensing

By contributing, you agree to license code under [Apache-2.0](LICENSE) and data in `corpus/` and `audit/` under [CC BY 4.0](LICENSE-DATA).
