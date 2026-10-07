# 2026-10-07: The recap template is editable -- how to write one, and what the default leaves to columns

Recap threads 14, 15 and 16. The Recap panel's *Recap template* (folded, below the tail) holds the
template the whole note is made by: mustache over markdown, filled in once, then written in bbjank
once. Empty the box (and click away) to go back to the default; there is no reset button, at your
word.

## The default, on the app's basic tools (thread 16)

The default now reads only what every template reads -- the questions loop `{{#qns}}`, each
question's own fields and its columns by label -- plus `{{recap_head}}` and `{{recap_tail}}` (the
head and tail, filled in), and plain mustache:

```
{{#recap_head}}
{{recap_head}}
{{! A rule under the head. Not ---, which would make the line above a heading. }}
***

{{/recap_head}}
{{#qns}}
{{! Only the questions with a rank: those with a Q#, and not archived. }}
{{#rank}}
> {AS: Q{{rank}}}{{rank}}. {{clueing}}
{{#hint}}
>
> ...OR ELSE...
>
> {{hint}}
{{/hint}}

Answer: {{#full_answer}}~~**{{full_answer}}**~~{{/full_answer}}
Correct Answer %: {{correct_pct}}
{{recap}}

{{/rank}}
{{/qns}}
{{recap_tail}}
```

* `{{#rank}}..{{/rank}}` is a section on the question's rank (its place in Q# order), which is
  blank for an archived question and for one with no Q#: so it skips those (and a fresh quiz's
  blank rows). Inside a section on a field, the field is the context and the question's other
  fields are still found, which is why `{{clueing}}` works inside `{{#rank}}`, and `{{hint}}`
  inside `{{#hint}}`.
* `{{correct_pct}}` is just a column, read by its label. To put your own expression in place of
  that line, add a `jsonata` column (say `solved_by`) and write `{{solved_by}}` instead of the
  line. A test holds this, with
  `$type(qn.correct_pct.value) = 'number' ? 'Solved by ' & qn.correct_pct.value & '% of teams' : 'Not yet scored'`.

**Where `played`, `quoted` and `oneline` came from** (you asked): they were the recap's own
additions to the bag, built in code. `{{#played}}` was the questions the recap covers (no archived,
no alternates, no blank rows, in Q# order), with `{{number}}` counting them; `quoted.<field>` was a
field with `> ` put back on every line after the first, so a multi-line clueing or hint stays
inside the quote (your guess was right); `oneline.<field>` folded a field onto one line, for inside
the answer's spoiler; `below.<field>` set a recap opening `---` a line apart; `pct` was
`correct_pct`. **They are still in the bag**, unused by the default, so a template of your own may
still read them while you decide what the app should keep.

## The gap list

What the basic default gets wrong that the old shaped values got right, and what closes each. Each
recipe is the formula of a `jsonata` widget (input formula `$`, the whole bag). Every one is held by
a test (`tests/lib/recap.test.ts`, *The default template's gaps*), and with all of them in place
the template writes the old note again, but for templated fields (gap 9).

1. **Order.** `{{#qns}}` is the quiz's own order (the grid's), not Q# order. *Closes with a
   quiz-level column*, placed below the question columns (it reads them as they stand at its
   place), labelled `in_order`:
   `[$map(qns[$type(rank) = 'number']^(rank), function($qn, $idx) { $merge([$qn, { 'number': $idx + 1 }]) })]`
   -- and the template loops `{{#quiz.in_order.value}}..{{/quiz.in_order.value}}` in place of
   `{{#qns}}..{{/qns}}`.
2. **Numbering.** `{{rank}}` counts every question with a Q#, alternates too, so the questions
   after an alternate are numbered one high; the old `number` counted only the questions played.
   *The same column* gives `{{number}}`, counting what it lists -- which still includes alternates
   (gap 3).
3. **Alternates are in.** *Needs the app*: the bag does not say which questions are alternates
   (`viz` is not among the fields formulas and templates see), so neither mustache nor a formula
   can leave them out. Thread 12 plans an `archived` flag; an alternate flag beside it closes this.
   For now, clearing an alternate's Q# leaves it out.
4. **Questions with no Q# are left out** (the old recap put them last). *Needs the app*, the same
   flag: their rank is as blank as an archived question's, so nothing can tell them apart.
5. **The rule under the head** shows even when no question follows. *The quiz-level column* closes
   it: `{{#quiz.in_order.value.0}}`, `***`, `{{/quiz.in_order.value.0}}`.
6. **A multi-line clueing or hint leaves its quote** where a line reads as markdown structure: a
   `---` or `===` under a line (the quote closes, and a rule or heading follows), an indented verse
   line (it runs into the line above, unquoted), a blank line and another paragraph (outside the
   quote). A plain second line stays in. *Closes with a column* per field, `quoted_clueing`:
   `$join($map($split(qn.clueing, '\n'), function($line) { $replace($line, /^ {4}/, '> ') }), '\n> ')`
   (and `quoted_hint`, the same over `qn.hint`), written `{{quoted_clueing}}` and
   `> {{quoted_hint}}`. Its limits: one level of verse indent; a line straight after verse joins
   the verse (leave a blank line after it); a clueing that opens with verse is not moved to the
   line below its number.
7. **A blank line in an answer breaks its spoiler open**, writing `~~**` and the answer in plain
   sight; a second line opening `- ` turns into a list. The worst of them: it spoils. A one-line
   answer opening `1984.`, `- `, `>` or `---` is safe (it is mid-line). *Closes with a column*,
   `answer_line`: `$join($split(qn.full_answer, '\n').$trim($)[$ != ''], ' ')`, written
   `~~**{{answer_line}}**~~`.
8. **A recap opening `---` or `===`** turns the `Answer:` and `Correct Answer %:` lines above it
   into a heading. *Closes with a column*, `recap_below`:
   `$contains(qn.recap, /^ {0,3}(-+|=+)[ \t]*(\n|$)/) ? '\n' & qn.recap : qn.recap`, written
   `{{recap_below}}`. (Or, with no column, a blank line before `{{recap}}`, which sets every recap
   a paragraph below.)
9. **A templated field shows its mustache as typed** (`By {{qn.author}}`): `qns` holds every field
   as written, and mustache never fills a filled-in value again. *Needs the app*: JSONata cannot
   fill a template. The recap bag's `qns` could carry templated fields filled, as `played` does; or
   write such a text as a `jsonata` column (`'By ' & qn.author.value`) instead of templating it.

Gained: inside `{{#qns}}` nothing hides a column (`played`'s `quoted`, `oneline`, `below`,
`number` and `pct` hid columns of those labels).

To close the gaps in the app rather than by columns, the choices as I see them: ship the recipes as
library widgets; expose an alternate flag, and fill templated fields in the recap's `qns`; or keep
`played` and its shaped values and name them in the panel. Your call.

## Older notes

**Thread 15 renamed** (2026-10-07): a template written under thread 14's names fills them in as
nothing, with no error: `{{quoted_body}}` became the clueing-and-OR-ELSE block, `{{answer_line}}`
became `{{oneline.full_answer}}`, `{{recap_below}}` became `{{below.recap}}`. The LL Export keeps
its BUT NOT. A broken template is outlined red with the reason, and logged to the console
(`Triquet: could not fill in the template in ...`), as are a broken head, tail or templated field.

Two things to know: the note is one markdown document, so a reference-style link definition
(`[1]: url`) in one question is seen by every question (the first wins); and an unclosed ``` fence
(or raw HTML block) in the head or a recap swallows the rest, later answers included. Both in
`whiteboard/TODO.md`.
