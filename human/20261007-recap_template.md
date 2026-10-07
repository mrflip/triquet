# 2026-10-07: The recap template is editable -- how to write one, and what the default leaves to columns

Recap threads 14, 15, 16, 17 and 12. The Recap panel's *Recap template* (folded, below the tail) holds the
template the whole note is made by: mustache over markdown, filled in once, then written in bbjank
once. Empty the box (and click away) to go back to the default; there is no reset button, at your
word.

## The default, on the app's basic tools (thread 16)

The default now reads only what every template reads -- the questions loop `{{#qns}}`, each
question's own fields and its columns by label -- plus `{{recap_head}}` and `{{recap_tail}}` (the
head and tail, filled in), plain mustache, and the three template helpers (thread 17, below):

```
{{#recap_head}}
{{recap_head}}
{{! A rule under the head. Not ---, which would make the line above a heading. }}
***

{{/recap_head}}
{{#qns}}
{{! Only the questions with a rank (a Q#), and not the alternates. }}
{{#rank}}
{{^secondary}}
> {AS: Q{{rank}}}{{rank}}. {{#quote}}{{clueing}}{{/quote}}
{{#hint}}
>
> ...OR ELSE...
>
> {{#quote}}{{hint}}{{/quote}}
{{/hint}}

Answer: {{#full_answer}}~~**{{#oneline}}{{full_answer}}{{/oneline}}**~~{{/full_answer}}
Correct Answer %: {{correct_pct}}
{{#apart}}{{recap}}{{/apart}}

{{/secondary}}
{{/rank}}
{{/qns}}
{{recap_tail}}
```

* `{{#qns}}` holds the questions a screen shows: never an archived one (thread 12), alternates
  included. `{{#quiz.questions}}` holds every question, the archived too.
* `{{#rank}}..{{/rank}}` is a section on the question's rank (its place in Q# order), which is
  blank for one with no Q#: so it skips those (and a fresh quiz's blank rows).
  `{{^secondary}}..{{/secondary}}` skips the alternates: every question says whether it is
  `secondary` (an alternate) and whether it is `archived` (thread 12), for a template or a formula.
* A field the quiz templates reads filled in (thread 12): `{{clueing}}` inside `{{#qns}}` shows a
  templated clueing as the grid does, not its mustache. So do the head and tail. Inside a section on a field, the field is the context and the question's other
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

## The template helpers (thread 17)

Three helpers, usable in every template (this one, the head and tail, any templated field), and
only as a section: the section is filled in first, then shaped.

* `{{#quote}}...{{/quote}}` -- to follow a `> ` you wrote: every line after the first gets `> `
  put back, a four-space indent (verse) becomes a quote inside the quote, and blank lines at the
  ends are dropped. `> {{#quote}}{{clueing}}{{/quote}}`.
* `{{#oneline}}...{{/oneline}}` -- folds what is inside onto one line, blank lines dropped:
  `~~**{{#oneline}}{{full_answer}}{{/oneline}}**~~`.
* `{{#apart}}...{{/apart}}` -- for the line straight after another: a first line of `---` or `===`
  is set a blank line apart, so it does not turn the line above into a heading. `{{#apart}}{{recap}}{{/apart}}`.

They work on anything: a field, a column (`{{#oneline}}{{my_column}}{{/oneline}}`), text and tags
together, and each other (`{{#oneline}}{{#quote}}...{{/quote}}{{/oneline}}`). Written with the
closing tag on a line of its own, a section keeps its last line break; closed on the same line, it
keeps none. The bare names are reserved: `{{quote}}`, `{{oneline}}`, `{{apart}}` fill in nothing,
and a column labelled `quote` is read as `{{quote.value}}`. `played`'s `{{oneline.full_answer}}`
and the like still work (a dotted name is not a helper). The helpers are code in the app, never
anything in the quiz's data.

## Also new in thread 12

* **Images in every field**, templated or not: `![alt](https://...)`, https only, held to a
  thumbnail's height in the grid's cells (the row grows to it once it loads). The recap writes
  them as bbjank's `[img]`, as before.
* **Categories in every bag**: `{{#categories}}{{title}}, {{/categories}}` (and `categories` in a
  formula), the hunt's, round its wheel.

## The gap list

What the basic default gets wrong that the old shaped values got right, and what closes each. Each
recipe is the formula of a `jsonata` widget (input formula `$`, the whole bag). Every one is held by
a test (`tests/lib/recap.test.ts`, *The default template's gaps*), and with them in place the
template writes the old note again, but for templated fields (gap 9). Gaps 6 to 8 are closed in the
default itself by the helpers (thread 17).

1. **Order.** `{{#qns}}` is the quiz's own order (the grid's), not Q# order. *Closes with a
   quiz-level column*, placed below the question columns (it reads them as they stand at its
   place), labelled `in_order` -- rewritten in thread 12 to close gaps 2 to 4 as well:

   ```
   (
     $ranked := qns[$type(rank) = 'number' and $not(secondary)]^(rank);
     $unnumbered := qns[$type(rank) != 'number' and $not(archived) and $not(secondary) and clueing != ''];
     [$map($append($ranked, $unnumbered), function($qn, $idx) { $merge([$qn, { 'number': $idx + 1 }]) })]
   )
   ```

   -- and the template loops `{{#quiz.in_order.value}}..{{/quiz.in_order.value}}` in place of
   `{{#qns}}..{{/qns}}`, with `number` for `rank` (in `{{number}}` and the section `{{#number}}`).
   A formula's `qns` holds every question, the archived too, hence `$not(archived)`. One catch: the
   column's list is the formula's copy of the questions, so a templated field in it reads as typed
   (gap 9 stays open down that road).
2. **Numbering.** `{{rank}}` counts every question with a Q#, alternates too, so the questions
   after an alternate are numbered one high; the old `number` counted only the questions played.
   Still so in the default, which now leaves the alternate out but numbers by rank. *The same
   column* gives `{{number}}`, counting only what it lists, alternates left out.
3. ~~**Alternates are in.**~~ *Closed* (thread 12): every question says whether it is `secondary`,
   and the default skips them with `{{^secondary}}`.
4. **Questions with no Q# are left out** (the old recap put them last). *Closable now* (thread 12):
   with the archived gone from `qns`, a blank rank means no Q#. The column above puts them last,
   numbered on; the default still leaves them out, since putting them last in plain mustache means
   a second copy of the whole question block (a template cannot include another).
5. **The rule under the head** shows even when no question follows. *The quiz-level column* closes
   it: `{{#quiz.in_order.value.0}}`, `***`, `{{/quiz.in_order.value.0}}`.
6. **Closed by `{{#quote}}`** (thread 17). *Was:* **a multi-line clueing or hint leaves its quote** where a line reads as markdown structure: a
   `---` or `===` under a line (the quote closes, and a rule or heading follows), an indented verse
   line (it runs into the line above, unquoted), a blank line and another paragraph (outside the
   quote). The helper does what `quoted.<field>` did, the JSONata column is no longer needed.
7. **Closed by `{{#oneline}}`** (thread 17). *Was:* **a blank line in an answer breaks its spoiler open**, writing `~~**` and the answer in plain
   sight; a second line opening `- ` turns into a list. The worst of them: it spoiled.
8. **Closed by `{{#apart}}`** (thread 17). *Was:* **a recap opening `---` or `===`** turned the
   `Answer:` and `Correct Answer %:` lines above it into a heading.
9. ~~**A templated field shows its mustache as typed**~~ *Closed* (thread 12): the recap's bag
   carries every templated text filled in (fields and text entries), in `qns` and
   `quiz.questions`, once each, over its own question. Not in a column's copy of the questions
   (gap 1's catch).

Gained: inside `{{#qns}}` nothing hides a column (`played`'s `quoted`, `oneline`, `below`,
`number` and `pct` hid columns of those labels), but for the helpers' bare names (`{{quote}}`,
`{{oneline}}`, `{{apart}}`), read as `{{quote.value}}`.

To close the gaps in the app rather than by columns, the choices as I see them: ship the `in_order`
recipe as a library widget (gaps 1, 2, 4 and 5; thread 12 asked); have the app put a played-number
beside `rank` (gap 2 alone); or keep `played` and its shaped values and name them in the panel.
Thread 12 closed gaps 3 and 9 in the app. Your call.

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
