# Thread 10: The markdown dialect, settled (2026-10-07)

Branch `20261007-recap_dialect`, PR filed at landing; see the report. Review fixes 95893dd, 434550a. Suites: `pnpm justify` green
(typecheck, lint, 4912 unit tests); `pnpm e2e:smoke` green (30); `pnpm e2e --touched` at landing
(the whole suite: `cells/markdown.tsx` and `lib/markdown.ts` reach every screen).

* **Built**:
  - **The indent rule, named once**, in `src/lib/markdown.ts`: `Markdown.indentsAsQuotes` (line
    by line; the LL export), `Markdown.indentsQuoted` (successor of `forScreen`, which is gone: also
    closes a quote where the indent steps back; the screen, bbjank, `Shaping.quotedOf`), and
    `Markdown.quotedByIndent` (the same, with the closer lines bbjank's spacing passes over).
    `Markdown.treeOf` is the one parse the league's outputs read (CommonMark, `~~` strikeout, bare
    addresses), moved from bbjank. `Bbjank.indentsQuoted` is gone; `shaping.ts` no longer imports bbjank.
  - **Strikeout on screen**: `~~text~~` renders `<del>` (a few-line remark plugin of GFM's one
    extension, `singleTilde: false`, in `markdown.ts`); `del` joins `Markdown.Allowlist`.
  - **bbjank**: `__text__` writes `[u]` (`strongOf` reads the source at the node), `**text**` stays
    `[b]`; a numbered list writes its start, `[list=1984]`. Doc block says the spaces short of a
    quote level are not rescued, unlike the LL export.
  - **ll-bbcode**: unchanged in behaviour but for the fix below; its doc block says `__text__`
    stays bold (underline is bbjank's alone) and that a quoted line keeps every space, unlike bbjank.
  - **The verifier**: `fixtures/bbjank-verifier.md` and `fixtures/bbjank-verifier.bbjank.txt`,
    held equal by a test in `tests/lib/bbjank.test.ts`. Sections: spoilers (annotated, softened
    annotation, `~50`), quotes (`{AS:}` inline and on its own line, unnamed, nested, indents, six
    spaces), lists (nested, numbered with continuation and a quote, `1984.`, `1984\.`), code,
    emphasis (underline, both italics, nesting across lines), links (text, bare, autolink, a bracket
    in the address), an image with alt, YouTube (wrapped, alt-only, uncaptioned), what goes nowhere
    (`javascript:`, relative, http image, HTML, script, typed BBCode), and the Coach's sample (Q1
    with BUT NOT, Q2 with OR ELSE, `Correct Answer %: 76`). Its headings say what to look for, so
    the `.bbjank.txt` can be pasted into a board's preview as is.
  - Docs: **`notes/markdown.md`**, the dialect in one place (what an author writes, a table of what
    the screen, bbjank and the LL export make of each construct, the order, how to change it);
    `notes/vocabulary.md` (*the dialect*; bbjank underlines); `notes/stack.md` (react-markdown's
    strikeout plugin, `Markdown.treeOf`); `whiteboard/TODO.md` (thread 2's underline and thread 5's
    `1984.` struck; a thread 10 section).
  - **The client-first pointer**: `notes/decisions/2026-09-client-first.md` written short (the
    rule, its two named exceptions, why Vercel, where else it is written), so the pointers from
    `CLAUDE.md`, `notes/stack.md`, `notes/database-decisions.md` and `e2e/client-first.spec.ts`
    all land without editing any of them.
* **Decisions taken**:
  - **One indent rule everywhere, exemptions included.** bbjank already left a top-level list's,
    a fenced code block's and an HTML block's indents alone; the screen and the LL export did not.
    Now all three do. On screen a list nested four spaces in nests (it became a quote holding a
    list) and a fence keeps its indented lines (they showed `> `).
  - **`[list=N]`** for the `1984.` answer: the board numbers from 1 whatever the tag says, so the
    number in the tag is for the poster, as the Coach asked.
  - **The decision file, not a `CLAUDE.md` edit**: the plan allowed either; writing the file at the
    path already named fixes four pointers and leaves `CLAUDE.md` alone.
  - **No autolinks on screen**: only strikeout was asked for; the difference is in `notes/markdown.md`
    and TODO.
* **Review** (`fixed`): 95893dd reads an indent inside a list that markdown would make code as a
  quote (`- Hamlet\n\n        *To be*` was code); 434550a parts the LL export's lines at a bare `\r`
  too. Left open, in the PR: a line indented four spaces after a list item and a blank line, or
  lazily continuing one, joins that item (CommonMark's reading); verse after a list leaving the
  list would be a rule change.
* **Pulled forward / struck**: `mdast-util-definitions` was thread 14's; nothing taken from later threads.
* **Discoveries**:
  - **A bug fixed on the way**: the LL export (`ll-bbcode.ts`) wrote `> ` in place of four spaces
    on an indented line inside a fenced code block or an HTML block (the `>` there is no quote
    marker, so nothing turned it back). Now those indents are kept.
  - `1984.` after a numbered list joins it, across a blank line (CommonMark): the verifier puts a
    sentence between them. In TODO.
  - unified types a plugin's `this.data()` bare until `remark-parse`'s types register the parser's
    extension lists, so the plugin casts it once (`as ParserData`), with a comment. No lint or type
    suppressions.
* **For the Coach**:
  - `CLAUDE.md`'s *Notable files* could name `notes/markdown.md`; left to you, since agents do not
    edit `CLAUDE.md` on an agent's word.
  - `notes/stack.md` also points at `notes/decisions/2026-09-convex.md` and `2026-09-jazz.md`, which
    went to `aside/` with the client-first file and are dangling too; and `notes/database-decisions.md`
    duplicates `notes/decisions/20260928-database-decisions.md` (they differ by one paragraph).
  - Writing the decision file, I first read the old one from git history (`af677fbc^`), before
    seeing it had since moved to `aside/`; the new one is written from `notes/stack.md`, `CLAUDE.md`,
    the database decisions and the client-first spec.
