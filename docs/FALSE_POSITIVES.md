# False positives

Every false positive the checker produced on a real target, with its cause and fix (AUDIT_PROTOCOL §5, task 3.6).
- **Zoo-first.** Each fix was first reproduced in the bug zoo, as a control page or as a bug page with rules that must stay `clean`. Only then was it fixed, and a bug page was added next to it, so the rule still catches the real defect.
- **Gates after every fix:** the zoo stays at 100% recall and 0 false positives in Chromium, Firefox and WebKit, and calibration stays at 0 mismatches.

## Pilot, 2026-10-26 (Open WebUI v0.12.4, NextChat v2.16.1; Chromium, desktop)

Found by triage of the pilot runs. Sonnet proposed the labels, and Opus verified them against the live DOM. Yousef reviews all of them.

### FP-1: code in a CodeMirror editor is judged as prose
- **Seen:** BD, AL and NP failures on code blocks in Open WebUI (ar-code-001/002/003, ar-copy-002, he-code-001/002/004). The code drew correctly, LTR and left-aligned.
- **Cause:** Open WebUI shows code blocks in CodeMirror (`.cm-content > div.cm-line`), not `pre > code`. The probe didn't treat those lines as code, so the rules expected RTL prose. The code block's toolbar (the language label, "bash") and the line-number gutter were also probed as text.
- **Fix:**
  - The probe treats `.cm-content` as a `pre` container with a code direction.
  - The Open WebUI adapter excludes the toolbar (`.sticky:has(.copy-code-button)`) and `.cm-gutters`.
- **Zoo:**
  - Controls `OK-CODE-codemirror` and `OK-CODE-codemirror-he`.
  - Bug `CODE-4`: CodeMirror content laid out RTL and right-aligned, which CODE must catch.

### FP-2: sibling blocks were one bidi paragraph in the expected order
- **Seen:** a CODE failure on he-code-002 in Open WebUI after FP-1 was fixed. The line `# בדיקת כניסה` drew correctly, with `#` on the left, but the expected order put `#` on the right.
- **Cause:** the probe builds its text from text nodes. CodeMirror's lines, and apps that emit no whitespace between elements, have no newline between sibling blocks. So the engine ran the previous paragraph and the line as one paragraph, and the neutral `#` took its direction from the Hebrew before it.
- **Fix:** the probe inserts a paragraph separator between text from sibling blocks. Nested blocks (an inline-block in a `p`, a sub-list in an `li`) keep one text run, as before.
- **Fix, second part:** the first fix didn't clear the live page. Svelte leaves empty and whitespace-only text nodes beside blocks, even directly under the reply's root. Their block is an ancestor of everything that follows, so no later block looked like a sibling. Whitespace-only nodes no longer decide paragraph boundaries. This was found by dumping the live probe text, then reproduced in the zoo before fixing.
- **Zoo:** control `OK-CODE-codemirror-he`. Like the app, its markup has no newline before the editor, and it has a root-level space beside the editor's wrapper.

### FP-3: CODE failed inline code whose `direction` has no effect
- **Seen:** CODE failures, "code … resolves to rtl", in both apps, on fixtures where the inline code drew correctly (ar-code-001, ar-iso-005, ar-list-003, he-code-003, he-copy-001, he-list-001, he-tbl-002).
- **Cause:** both apps leave inline `code` at `unicode-bidi: normal`, and it inherits `direction: rtl`. CSS ignores `direction` on an inline element with `unicode-bidi: normal`, so nothing visible depended on it.
- **Fix:** the probe reports such code with code direction `none`, and CODE fails only on `rtl`. What such code does to the text is judged by ISO and NP, from what is drawn.
- **Side effect, intended:** on 5 fixtures where the unisolated code really is damaged (ar-iso-001, ar-iso-004, ar-tbl-003, he-iso-001, he-iso-005), CODE no longer fails and ISO does. Each defect is now counted once, under ISO, instead of under both ISO and CODE.
- **Zoo:** control `OK-CODE-inline-normal`. The existing `CODE-2` (inline code isolated and RTL) still fails.

### FP-4: NUM failed at a line edge when the base direction flipped
- **Seen:** NUM failed on ar-list-002 in both apps; "Firefox 120" was intact and in order.
- **Cause:** NUM compares each number plus one neighbour on each side. In the LTR layout, 120 had a neighbour where the RTL expectation put it at the line's edge, so the slices differed in length.
- **Fix:** NUM compares a neighbour side only when both orders have a neighbour there. The flipped direction itself is BD's finding.
- **Zoo:** bug `BD-4` is ar-list-002 laid out LTR, with `clean: ['NUM']`.

### FP-5: an autolink that swallowed a neutral moved the expected isolate
- **Seen:** an NP failure on he-iso-003 in both apps. The hyphen of "ל-" drew between the prefix and the address, as the fixture's notes require.
- **Cause:** both apps (and marked, which our reference renderer uses) autolink `-support@example.com`, hyphen included. The expected order isolated the whole link text, so it moved the hyphen into the LTR unit. The apps don't isolate the link, so the hyphen stayed in place.
- **Also found:** our own reference render had the same autolink, with the link isolated (`unicode-bidi: plaintext`). So golden.html drew the hyphen at the far left of the address, contradicting the verified notes. Calibration couldn't see it, because the expected order followed the same link boundary.
- **Fix:**
  - In the expected order, a link that holds a listed `isolate_spans` item plus extra characters is isolated as the span.
  - The reference renderer keeps punctuation around such a span outside the link, and golden.html is rebuilt.
- **Zoo:**
  - Control `OK-NP-autolink-hyphen`: the apps' markup, link not isolated.
  - Bug `NP-4`: the same link isolated LTR, which moves the hyphen and must fail.
- **Open (Yousef):** the apps' link `mailto:-support@example.com` points to a wrong address, and its underline includes the hyphen. That is a product defect outside the bidi rules; whether to report it is undecided.

### Not a checker defect: ISO and CODE double counting
The verifier noted that the same inline-code defect failed both ISO and CODE. After FP-3 it is counted once, under ISO. Scoring (task 4.3) should still count each fixture once per category, as FIXTURE_SPEC §2 says.
