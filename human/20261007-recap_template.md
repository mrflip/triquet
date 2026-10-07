# 2026-10-07: The recap template is editable -- how to write one

Recap threads 14 and 15. The Recap panel's *Recap template* (folded, below the tail) holds the template the
whole note is made by: mustache over markdown, filled in once, then written in bbjank once. Empty
the box (and click away) to go back to the default; there is no reset button, at your word.

What the template reads, beside everything a templated field reads (`quiz.title`, `qns`, ...):

* `{{recap_head}}`, `{{recap_tail}}`: already filled in as templates.
* `{{#played}}...{{/played}}`: each question played (no archived, no alternates, none blank), in
  rank order. Inside: `{{number}}`, every field and column by its label (`{{title}}`, `{{hint}}`,
  `{{my_column}}`), `{{pct}}` (the `correct_pct` column's value; blank without one), and each of
  the question's own fields (`clueing`, `hint`, `full_answer`, `notes`, `recap`) shaped three ways
  for fragile spots, named by the field:
  - `{{quoted.clueing}}`, `{{quoted.hint}}`, ... -- to follow a `> ` on the same line: every later
    line opens `> `, so a multi-line text stays in its quote.
  - `{{oneline.full_answer}}`, ... -- on one line, for inside `~~**...**~~`.
  - `{{below.recap}}`, ... -- safe on the line straight after another.

Writing `{{clueing}}` raw after a `> ` works for one-line clueings only; that is the catch you asked
about, and what the shaped values are for. A section on a field reaches its shaped value inside it,
as the default does for the question's own hint:

```
> {AS: Q{{number}}}{{number}}. {{quoted.clueing}}
{{#hint}}
>
> ...OR ELSE...
>
> {{quoted.hint}}
{{/hint}}
```

**Thread 15 renamed** (2026-10-07): a template written under thread 14's names fills them in as
nothing, with no error. Replace `{{quoted_body}}` with the block above (it was the clueing plus
the *chained-to* question's hint after BUT NOT; the recap now shows the question's own, after OR
ELSE), `{{answer_line}}` with `{{oneline.full_answer}}` (and `{{#answer_line}}..{{/answer_line}}`
with `{{#full_answer}}..{{/full_answer}}`), and `{{recap_below}}` with `{{below.recap}}`. Or empty
the box to take the new default. The LL Export keeps its BUT NOT. A broken template is outlined red with the reason, and
logged to the console (`Triquet: could not fill in the template in ...`), as are a broken head, tail
or templated field.

Two things to know: the note is one markdown document now, so a reference-style link definition
(`[1]: url`) in one question is seen by every question (the first wins); and a head with an
unclosed ``` fence (or raw HTML block) in the head or a recap swallows the rest, later answers included. Both in `whiteboard/TODO.md`.
