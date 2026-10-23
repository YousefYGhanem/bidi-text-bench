# Name check (task 0.7)

Checked on **2026-10-22**. The decision is yours at Gate G0 and is recorded in ADR-0002. npm results are from `npm view <name>`, where a 404 means the name is free. GitHub results come from github.com repository search.

## Evidence

**"BiDi" already means a browser-automation protocol to our audience.** WebDriver BiDi is a W3C protocol ([spec](https://w3c.github.io/webdriver-bidi/)). Selenium documents it under "BiDi" ([Selenium docs](https://www.selenium.dev/documentation/webdriver/bidi/)). Mozilla's Firefox BiDi milestones target Playwright as a client ([Mozilla wiki](https://wiki.mozilla.org/WebDriver/RemoteProtocol/WebDriver_BiDi)). Playwright users are our audience too.
- On npm, a search for "bidi test" returns mostly WebDriver BiDi packages: `chromium-bidi`, `webdriver-bidi-protocol` and `webdriver`. The exception is `bidi-js`, the UBA library ([npm search](https://www.npmjs.com/search?q=bidi%20test)).
- On GitHub, the closest names to "bidi benchmark" are WebDriver BiDi projects: [emanlove/selenium-bidi-benchmark](https://github.com/emanlove/selenium-bidi-benchmark) and [triposat/browser-automation-bench](https://github.com/triposat/browser-automation-bench) ([search](https://github.com/search?q=bidi+benchmark&type=repositories)).

**"RTL" already means register-transfer level in AI-benchmark circles.**
- [rockyco/rtl-bench](https://github.com/rockyco/rtl-bench) is a hardware RTL benchmark for LLMs (Aug 2026).
- 34 repos match `rtl-bench`, mostly hardware ([search](https://github.com/search?q=rtl-bench+in%3Aname&type=repositories)).
- See also [RTL-BenchLS](https://arxiv.org/pdf/2606.08976).

**Neighbouring tools on npm (Aug 2026):**
- `rtlcheck`, "Playwright audits for bilingual RTL layouts" ([npm](https://www.npmjs.com/package/rtlcheck));
- `rtl-lint` ([npm](https://www.npmjs.com/package/rtl-lint)).

Both names are taken.

| Name | npm | GitHub exact repo | Web search | Confusion risk |
|---|---|---|---|---|
| `bidi-bench` (working name) | free | none ([search](https://github.com/search?q=bidi-bench+OR+bidi-text-bench+OR+rtl-bidi-bench+OR+bidibench&type=repositories)) | no hits (furniture only) | **medium–high**: WebDriver BiDi, among the same Playwright users |
| `rtl-bench` | free | **taken** (hardware) | hardware RTL benchmarks | **high** in AI/LLM contexts |
| `bidi-text-bench` | free | none | — | low: "text" disambiguates. The name is longer |
| `rtl-bidi-bench` | free | none | — | low–medium: has both search keywords, but is clunky |
| `yamin` | free | not checked | no software hits | NEEDS-YOUSEF: in Hebrew "ימין" also means the political right, and "Yamina" was the name of an Israeli political party. That clashes with the plan's no-politics framing |

Not checked: your own GitHub namespace, since I don't have your username. Run `gh repo view <you>/<name>` before creating the repo (0.9).

## Options
1. **Keep `bidi-bench`.** It is short, technically accurate (mixed direction, not just RTL) and free everywhere. Mitigate the confusion with the tagline "RTL/bidi **text** test suite", and keep the words "Unicode Bidirectional Algorithm" in the description and npm keywords.
2. **`bidi-text-bench`.** Same accuracy, no WebDriver BiDi ambiguity, and free everywhere. It costs 5 characters.
3. **`rtl-bench`.** Rejected: the exact GitHub repo is taken and "RTL" is ambiguous in AI benchmarks.

**Recommendation: option 2, `bidi-text-bench`** if you value unambiguous search results. Otherwise option 1, which costs nothing to keep. Renaming now is cheap: there is no remote and no package yet.
