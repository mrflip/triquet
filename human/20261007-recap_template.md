# 2026-10-07: The recap template is editable -- how to write one

Recap thread 14. The Recap panel's *Recap template* (folded, below the tail) holds the template the
whole note is made by: mustache over markdown, filled in once, then written in bbjank once. Empty
the box (and click away) to go back to the default; there is no reset button, at your word.

What the template reads, beside everything a templated field reads (`quiz.title`, `qns`, ...):

* `{{recap_head}}`, `{{recap_tail}}`: already filled in as templates.
* `{{#played}}...{{/played}}`: each question played (no archived, no alternates, none blank), in
  rank order. Inside: `{{number}}`, every field and column by its label (`{{title}}`, `{{clueing}}`,
  `{{my_column}}`), and four values shaped for fragile spots:
  - `{{quoted_body}}` -- clueing plus BUT NOT, to follow `> {AS: Q{{number}}}{{number}}. ` on the
    same line: every later line opens `> `, so a multi-line clueing stays in its quote.
  - `{{answer_line}}` -- the full answer on one line, for inside `~~**...**~~`.
  - `{{recap_below}}` -- the question's recap, safe on the line straight after another.
  - `{{pct}}` -- the `correct_pct` column's value; blank without one.

Writing `{{clueing}}` raw after a `> ` works for one-line clueings only; that is the catch you asked
about, and what the shaped values are for. A broken template is outlined red with the reason, and
logged to the console (`Triquet: could not fill in the template in ...`), as are a broken head, tail
or templated field.

Two things to know: the note is one markdown document now, so a reference-style link definition
(`[1]: url`) in one question is seen by every question (the first wins); and a head with an
unclosed ``` fence swallows the rest. Both in `whiteboard/TODO.md`.
