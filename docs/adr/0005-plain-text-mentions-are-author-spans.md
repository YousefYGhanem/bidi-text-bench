# ADR-0005: Plain-text @mentions are author spans

- Status: accepted
- Date: 2026-10-27
- Decided by: Yousef Ghanem, after the pilot triage (task 3.5)

## Context
FIXTURE_SPEC §1.7 listed mentions among the renderer-owned units that belong in `isolate_spans`, next to code, links and emails. Two fixtures followed that rule: ar-iso-004 (`@sami`) and he-iso-004 (`@noam-dev`).

In the pilot (Open WebUI v0.12.4, NextChat v2.16.1; 2026-10-26), both apps rendered these mentions as plain text, and the "@" was drawn to the right of the handle. The second verification pass (Opus) showed that this is what UAX #9 gives for plain text: "@" is a neutral between RTL text and the handle, so it takes the paragraph direction. No app can do better without first recognising the mention. The groups ar-iso-004 NP, he-iso-004 ISO and he-iso-004 NP failed in both apps for that reason.

## Decision
- A mention the UI does not render itself (no link, no chip) is author-owned and goes in `author_spans`, like plain-text `C++` and phone numbers. UIs are not penalised for its order. The reference render shows it as correctly authored, an LTR isolate.
- A mention the UI does render (a link or a chip) stays renderer-owned and goes in `isolate_spans`.

## Consequences
- **Fixtures:** ar-iso-004 and he-iso-004 now carry their mentions in `author_spans`, with rewritten `expected_notes`. They went back to `status: draft` for Yousef to re-verify; editing a verified fixture invalidates its hash.
  - he-iso-004 has no isolate span left, so it no longer tests ISO. Its notes carry a NEEDS-YOUSEF question: keep it, move it, or replace it.
- **Zoo:** bug ISO-3, an unisolated plain-text mention, was removed, because that rendering is now accepted.
- **Triage:** the six pilot groups above are labelled `wont-report`, with this ADR as the reason.
