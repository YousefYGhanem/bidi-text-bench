# Start here: bidi-bench starter kit for Claude Code

This folder is a ready-to-run repo. It contains:
- the full plan and the specs;
- the project rules Claude Code loads in every session;
- custom agents and slash commands;
- two domain skills;
- 11 seed fixtures.

Claude Code writes the code itself, phase by phase. It stops at every decision that is yours to make.

## What's inside
| Path | What it is |
|---|---|
| `KICKOFF_PROMPT.md` | The first prompt to paste, plus the short prompts for later sessions |
| `CLAUDE.md` | Project rules Claude Code reads at the start of every session |
| `TASKS.md` | The checklist Claude works through. It is the source of truth for progress |
| `docs/PLAN.md` | Outcome, scope, architecture, phases and gates, timeline, budget, risks |
| `docs/FIXTURE_SPEC.md`, `docs/CHECKER_SPEC.md`, `docs/AUDIT_PROTOCOL.md` | How the fixtures, the checker and the audit work |
| `docs/LAUNCH.md` | Launch and visibility playbook, plus ready-made CV and LinkedIn lines |
| `.claude/agents/` | 4 helper agents: fixture-drafter, rule-reviewer, audit-triager and bug-report-drafter. Each runs on a cheaper model |
| `.claude/commands/` | `/next` `/phase` `/fixtures` `/audit` `/draft-bug` `/weekly` |
| `.claude/skills/` | `bidi-testing` (domain knowledge) and `upstream-bug-report` (drafting reports for other projects) |
| `.claude/settings.json` | Permissions. Routine commands run without asking. Pushes, installs and repo creation ask you first. Posting to other repos, `npm publish` and reading `.env` are blocked |
| `corpus/fixtures/*/_seed.yaml` | 11 example fixtures: drafts for you to verify |
| `audit/targets.yaml` | 17 candidate audit targets |

## One-time setup (Windows 11, about 45 minutes)
1. **Unzip** the kit to a short path, such as `C:\dev\bidi-bench`.
2. **Install the tools.** Open PowerShell and paste the lines below. winget skips anything that's already installed.
   ```powershell
   winget install -e --id Git.Git; winget install -e --id OpenJS.NodeJS.LTS; winget install -e --id GitHub.cli; winget install -e --id Docker.DockerDesktop
   irm https://claude.ai/install.ps1 | iex
   ```
   Close and reopen PowerShell. Start Docker Desktop once; it sets up WSL 2, so reboot if it asks.
3. **Cap Docker's memory** (your PC has 16 GB). Create `%USERPROFILE%\.wslconfig` with these two lines, then run `wsl --shutdown` and restart Docker Desktop:
   ```
   [wsl2]
   memory=8GB
   ```
4. **Sign in to GitHub:** run `gh auth login`, then choose GitHub.com → HTTPS → log in with a browser.
5. **Add the Playwright CLI skill.** This is Microsoft's official browser tool for coding agents, and it uses fewer tokens than a browser MCP server.
   ```powershell
   npm install -g @playwright/cli@latest
   cd C:\dev\bidi-bench
   playwright-cli install --skills
   ```
6. **Start Claude Code** in the folder:
   - Run `claude` and log in.
   - Accept the "trust this folder" prompt. The project permissions only apply after you do.
   - Run `/model opusplan`. Opus then plans and Sonnet writes the code, which stretches your usage limits without lowering quality.
7. **Paste the kickoff prompt** from `KICKOFF_PROMPT.md`.

To check the setup, run `git --version`, `node --version` (22 or higher), `gh --version`, `docker info` and `claude --version`.

## A normal work session
1. Run `claude` in the repo, or `claude --continue` to pick up where you left off.
2. Type `/next`, or `/phase N` at the start of a phase. Approve prompts as they come, such as installs and pushes.
3. When Claude stops at a [Y] task or a gate, do your part. That might mean reviewing fixtures with `npm run review`, making a decision, or posting a bug report.
4. Commit your verifications yourself: `git add corpus` then `git commit -m "verify: …"`.
5. At the end of your work week, run `/weekly`.

If a session gets long, run `/clear` and then `/next`. The state lives in TASKS.md and git, not in the chat.

## What stays yours
This is what makes the project credible:
- every fixture's expected result;
- the taxonomy, the rubric weights and the severity calls;
- triage of every failure;
- posting anything outside the repo;
- the article, the talk and your CV text.

Claude does the code, tests, research and first drafts. Your verification commits and the ADRs show where the judgement came from.

## Skills, MCP servers and connectors: what to use
| Tool | Use it? | Why |
|---|---|---|
| Project skills `bidi-testing`, `upstream-bug-report` | Included | Claude loads them only when it needs them |
| Playwright CLI skill | **Yes** (setup step 5) | Lets Claude explore target UIs, find selectors and check rendering. Uses few tokens |
| Playwright MCP server | Only as a fallback | Does the same job but uses more tokens. To add it: `claude mcp add playwright -- npx @playwright/mcp@latest` |
| GitHub CLI (`gh`) | **Yes** | Handles the repo, CI status and read-only issue searches. Cheaper than a GitHub MCP server |
| Other MCP servers (GitHub, Context7, …) | No | Every server adds tool definitions to every request, and nothing in this plan needs them |
| Official plugin `frontend-design` | Optional (Phases 1 and 6) | Better design for the review tool and the report site. Install with `/plugin install frontend-design@claude-plugins-official` |
| Official plugin `code-review` | Optional (before launch) | A second-opinion review pass. Install with `/plugin install code-review@claude-plugins-official` |
| Playwright Test Agents | Optional (Phase 6) | `npx playwright init-agents --loop=claude` adds planner, generator and healer agents for the report site's end-to-end tests. Note: it creates and overwrites `.mcp.json` |

Models are already routed to save usage: `opusplan` for the main session, Sonnet for three of the helper agents and Haiku for the audit triager.

## Costs
Almost everything is free: GitHub, Actions and Pages for a public repo, Docker Desktop for personal use, Zenodo and Hugging Face. Track B API calls are optional; cap them at about $10–15. Details are in `docs/PLAN.md` §8.

## Troubleshooting
| Problem | Fix |
|---|---|
| `playwright-cli` is not found | Reopen the terminal, or run `npx @playwright/cli@latest install --skills` |
| Docker says "WSL 2 installation is incomplete" | Run `wsl --update`, then reboot |
| Claude can't find Git Bash | Create `.claude/settings.local.json` containing `{"env": {"CLAUDE_CODE_GIT_BASH_PATH": "C:\\Program Files\\Git\\bin\\bash.exe"}}` |
| Arabic or Hebrew shows as boxes in screenshots | Run the tests in Docker (`npm run docker:test`). The project image installs Noto fonts |
| Errors about long paths during install | Keep the repo at `C:\dev\bidi-bench` and run `git config --global core.longpaths true` |
