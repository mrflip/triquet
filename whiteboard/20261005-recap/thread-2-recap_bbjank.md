# Thread 2: Markdown to bbjank (2026-10-06)

Branch `20261006-recap_bbjank`, PR filed at landing; see the report. Suites: `pnpm justify` green
(typecheck, lint, 4544 unit tests); e2e not run yet (no view changed: the module has no caller).

* **Built**: `src/lib/bbjank.ts`, one entrypoint, `Bbjank.toBbjank(markdown)` (import it
  `import * as Bbjank from '../lib/bbjank'`), plus `youtubeIdOf(url)`, exported for its tests.
  `tests/lib/bbjank.test.ts` holds 80 table-driven cases: every example in the spec's closing
  block, the recap's question block as thread 5 will spell it, and the unsafe inputs (HTML,
  `javascript:` in any case, relative and `data:` addresses, a bracket in an address). New
  packages, listed in `notes/stack.md` under *mdast-util-from-markdown*:
  `micromark-extension-gfm-strikethrough` + `mdast-util-gfm-strikethrough` (`singleTilde:
  false`), `micromark-extension-gfm-autolink-literal` + `mdast-util-gfm-autolink-literal`,
  `mdast-util-to-string`, `micromark-util-sanitize-uri` (for `normalizeUri`), `@types/mdast`
  (dev). `notes/vocabulary.md` has a **bbjank** entry.
* **Decisions taken**:
  - **The indent rule reuses `Markdown.forScreen`**, not bare `indentsAsQuotes`: a line is quoted
    only as deep as it is indented, so `...BUT NOT...` set back out of an indented verse leaves
    the quote, where markdown's lazy continuation would carry it in. The lines `forScreen` puts in
    to close a quote are tracked, so they never count as an author's blank line. A top-level
    list's lines and a fenced code block's are left out of the rule (found by a first parse):
    their indents are markdown's own, so a four-space-nested list still nests.
  - **Spacing follows the source**: blocks that touched are joined by one line break, blocks with
    a blank line between by two. List items always by one.
  - **Underline**: none from markdown (`<u>` is HTML, and the parser offers nothing). BBCode typed
    in the text passes through as typed, so `[u]..[/u]` underlines; recorded in the doc block.
  - **Addresses**: `[url]` only to `http`/`https`; `[img]` only to `https`; anything else (a
    `javascript:`, `mailto:`, relative or `data:` address) is written as its text or alt text
    alone. Every address passes `normalizeUri`, so no `]`, `"` or space in it can end its tag.
    These are bbjank's own two sets, not `Markdown.Allowlist`: the allowlist has no `img` until
    thread 4 widens it, and it lets `mailto` through, which the board has no use for. Thread 7
    should weigh whether the two ought to share one source.
  - **A bare address** (`<https://..>`, or GFM's literal `https://..`/`www.`) is `[url]..[/url]`;
    one written as `[text](..)` is `[url=..]text[/url]`, even with empty text. Told apart by
    whether the source at the link opens with `[`.
  - **Tag arguments** (a quote's speaker, a spoiler's annotation) have `[`/`]` softened to
    parentheses and `"` to `'`, so they cannot end the opening tag.
  - **Images**: alt text on the next line as `[list](alt)[/list]`, as the closing block does it.
    YouTube: the embed set apart by blank lines; captioned by alt text (and a wrapping link's own
    text) as a link to the wrapping link, or else to the video; no caption, no caption line.
  - Not in the spec, chosen: a heading is `[b]..[/b]`; a thematic break is 40 dashes; a
    reference link (`[text][ref]`) is the link its definition makes; an inline code span is
    `[code]..[/code]`; a numbered list is always `[list=1]`.
* **Discoveries**:
  - `mdast-util-from-markdown` hands back link URLs exactly as written, brackets and all; it is
    micromark's HTML compiler that encodes them. Hence `normalizeUri`.
  - **For thread 5**: keep `{AS: Qn}` on the same line as the clueing's start (`> {AS: Q1}1.
    ...`). On a line of its own, a following `1. ...` line is an ordered list. A multi-line
    clueing filled into `> {AS: Q1}{{qn.clueing}}` reaches the quote only by lazy continuation,
    and a blank line or an indented line in it ends or misreads the quote. Build each question's
    block by running the clueing through `Markdown.forScreen` and prefixing every line with `> `,
    rather than leaning on the template. Answers as `~~**ANSWER**~~` are solid, `~` and all.
  - The module has no caller yet; thread 5 is its first.
* **Deviations**: the plan said `indentsAsQuotes`-style; it is `forScreen` (same rule, plus the
  set-back), for the reason above. Left in `whiteboard/TODO.md`, *From recap sprint, thread 2*:
  constructs untried on the boards, a code block in a list item being set in, an embed
  mid-paragraph, a `{AS:}` name holding emphasis.
* **Review** (`fixed`): c52436c leaves an HTML block's indented lines as typed, outside the indent
  rule; 7d8c8dd leaves out an unnamed quote that comes to nothing. Left open, minor, and in the PR:
  - A link definition inside a quote or list item (or an indented one) is not collected, and a
    label defined twice resolves to the last, not the first. `mdast-util-definitions` would fix
    both; adding it was refused by the session's permission check, so it is the Coach's call.
  - A fenced code block in a list item gains the item's indent (also in TODO).
  - An escaped `\[b\]`, or `[/code]` inside code, reaches the board as a live tag: BBCode
    passes through.
  - `{AS:}` with an empty name gives `[quote=""]`; an annotation spanning a line break puts a
    newline inside `[spoiler=..]`.
  - Underline is since settled (plan thread 10): `__text__` will become `[u]` in a later thread.
* **For the Coach**: two `eslint-disable-line` comments in `tests/lib/bbjank.test.ts`
  (`unicorn/prefer-https`, `sonarjs/no-clear-text-protocols`) on the two cases whose input is a
  plain-http address on purpose. Worth pasting one recap into a board preview once thread 5
  lands: headings, rules and `[img]` inside `[url]` are guesses.
