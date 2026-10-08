# Markdown, our dialect

What a quiz's text is written in, and what each place that reads it makes of it, so nobody has to
re-derive it from the code. Settled by the recap sprint, October 2026 (thread 10). The code:
`src/lib/markdown.ts` (the indent rule, the parse, the screen's options, the one allowlist),
`src/lib/bbjank.ts` (the message boards), `src/lib/ll-bbcode.ts` (the league's site: the smith's
note and the quiz import). Their tests pin every row below; where this note and they disagree, the
note is the bug.

## What an author writes

CommonMark, with these on top:

* **The indent rule.** Every four spaces a line opens with is a quote level, as an author indents
  verse, never a code block; eight spaces are two levels. Each line is quoted exactly as deep as it
  is indented: a line that steps back out leaves the quote, where markdown's lazy continuation would
  carry it in. A list's, a fenced code block's and an HTML block's own lines keep their indents,
  which are markdown's (four spaces in a list nest it); but an indent markdown would make code
  inside a list (verse after an item and a blank line) is still a quote, since the dialect has no
  indented code. Applied before anything reads the text, in
  every place: `Markdown.indentsQuoted` for the screen, bbjank and the `quote` template helper;
  `Markdown.indentsAsQuotes`, line by line, for the LL export, which writes each line's own indent.
  This is the dialect, not a workaround: name it, don't re-derive it.
* **A line break is a line break**, as typed. No trailing spaces or backslash needed.
* **Strikeout** is `~~text~~`, never a single `~`: trivia is full of `~50 years`. GFM's strikethrough
  extension alone, with `singleTilde: false`; never `remark-gfm` whole.
* **Emphasis**: `*text*` and `_text_` are italics, `**text**` is bold, and `__text__` is bold too,
  except on the message boards, where it underlines. The parser keeps no marker, so bbjank reads
  the source at the node.
* **HTML is never built.** Typed into a field, it is shown and exported as the characters typed.
* **BBCode typed into the text** passes through both league outputs as typed (`[u]..[/u]` was the
  only underline before `__text__`). An author can break a recap's frame with it; wontfix, by the
  Coach: the smith previews before posting.
* Not in the dialect: tables, footnotes, task lists. Each place shows them as their text.

## What each place makes of it

| Written | On screen | bbjank (message boards) | LL export (smith's note, import) |
|---|---|---|---|
| `**bold**` | bold | `[b]` | `[b]` |
| `__under__` | bold | `[u]` | `[b]` |
| `*it*`, `_it_` | italics | `[i]` | `[i]` |
| `~~struck~~` | struck through | `[spoiler]`; `{AS: note}` inside annotates it | as typed |
| a quote, or an indent | a blockquote | `[quote="who"]` when it opens `{AS: who}`, else an indenting `[list]`; spaces short of four dropped | four spaces a level, every leading space kept |
| a line break | a break | a line break | `[br]` |
| `1984. text` | a list from 1984 | `[list=1984]` (the board shows 1; the poster sees why) | as typed |
| `- item` | a list | `[list]` and `[*] ` | as typed |
| a link | a link, to http, https or mailto | `[url=..]`, to http or https; else its text | as typed |
| a bare `https://..` | its text | `[url]..[/url]` | as typed |
| an image | the image, https only, in any field; a thumbnail in a grid cell; in a reviewer's words, or a formula's or a bot's column filled into a template, a link to it, never fetched on sight | `[img]`, https only, alt text below; a YouTube image an embed; from a formula's or a bot's column a link | as typed |
| a heading | a heading | `[b]` | as typed |
| `` `code` ``, a fence | code | `[code]` | as typed |
| `<b>HTML</b>` | the characters | the characters | the characters |

**Quotes convert differently on purpose.** The league's site shows a line's leading spaces, so the
LL export keeps every space a quoted line had. The boards ignore them inside a `[list]`, so bbjank
does not rescue the spaces short of a quote level. Each module's doc block says so, and a test in
each pins it.

`fixtures/bbjank-verifier.md` and `fixtures/bbjank-verifier.bbjank.txt` hold one of everything
bbjank does, held equal by `tests/lib/bbjank.test.ts`: paste the second into a board's preview to
see the boards agree.

## The order things happen in

Liquid fills a template first (escaping off), then the indent rule, then the parse, then the
writer, and the sanitizer last. On screen that is `react-markdown`, then `rehype-sanitize` under
`Markdown.Allowlist` (the one allowlist; widen it there and nowhere else). In bbjank the writer is
the sanitizer: it writes only the node types it knows, and only to the addresses it allows.

## Changing the dialect

A syntax every place should read goes into both of `markdown.ts`'s parses: `treeOf` (the league's
outputs and the indent rule) and the screen's `renderOptionsFor`, as a remark plugin of the one
extension. Then a row here, and a test in each module's suite.
