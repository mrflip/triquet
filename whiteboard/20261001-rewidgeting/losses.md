# Rewidgeting: what the data model's clean break loses

Thread 3 (`20261001-widget_tables`). The schema change translates no rows: three tables are
cleared by hand at deploy, one field comes off the quiz rows, and one idempotent mutation
(`seeding:seedWidgets`) re-creates what the tool can make again. The Coach's steps are in
`notes/deploy.md`, *Clearing the widget tables*, with a row in its migration ledger. This is the
list of what goes, by table and by kind of row, with what brings each back and what nothing does.

What a person typed and nothing here touches: hunts, realms, quizzes (but one field), questions,
columns, idents, identings, huntings, reviews and reviewings.

## `expressions`: cleared

A hunt's calculations: thirteen seeded into every hunt as it was made, and any an author added.

| Row kind | What comes back | What is lost |
|---|---|---|
| The thirteen seeds, as seeded (`clueing_full` and the other seven sums; `clueing_word_count`, `clueing_with_butnot`, `answer_letter_count`, `answer_reversed`, `answer_alphabetized`) | Seeding puts each in the library as a `jsonata` widget under the same label, once for every hunt. The sums' formulas are rewritten to the new bag paths (`qn.numnum_clueing.value.items`), as bare values. | Each hunt's own copy: the library is shared. |
| A seed an author revised in their hunt (formula or description) | The seed, as the fixture has it. | The revision. It is in the hunt's Raw Export, taken before the deploy (step 1), to be typed back into the library by hand. |
| An expression an author wrote | Nothing. | The expression. Same remedy: copy its formula out of the export and write it again with *+ New formula…*. |

## `widgets` (the old shape: a quiz's expressings and bottings): cleared

The table keeps its name and changes its meaning: it is now the library. Its old rows were each a
quiz's widget, of two kinds.

| Row kind | What comes back | What is lost |
|---|---|---|
| The default layout's eleven: three bottings (`dumdum`, `numnum_clueing`, `numnum_hint`) and eight sum expressings, each labelled as its column's source | Seeding gives any quiz with no widgetings whose columns name any of the default set the whole default set: those eleven under the same labels, and `butnot_ishes` (new, a `jsonata` widgeting standing for the old BUT NOT ishes view). Its column (`question.butnot_ishes`) is re-pointed to it. | Nothing the columns show, once the bots are asked again. A description an author wrote on one of them. |
| An expressing of a text seed, or of an author's expression, or a default one relabelled | Nothing: seeding gives only the default set, under the default labels. | The widget. Its column stays, showing nothing (hidden from the grid, still listed under Columns); putting the widget to work again under the column's source label (*+ New formula…*, *Widgeting label*) brings the column back. |
| A botting an author added beyond the three pairs | Nothing. | The botting, and its column's contents. |
| A quiz whose columns name none of the default set | Nothing: it gets no widgetings. | Nothing it showed; widgetings are added from its gear. |

## `bottings`: cleared

Every time a bot was asked about one of a question's texts: dumdum's guesses, numnum's spans of the
clueing and of the hint, each failure, the tier that answered, the tokens it cost, and the text it
was asked about.

| Row kind | What comes back | What is lost |
|---|---|---|
| Answers and failures, every one | Nothing. Each cell reads *Double-click to ask*; asking again records a fresh `widgeteds` row, and the sums and BUT NOT ishes follow. There is no Recalculate all any more, so each cell is asked on its own (step 5). | Every reply and its history, and the model usage spent on them. The pre-deploy Raw Export carries each question's newest reply (`guess`, `clueing_ishes`, `hint_ishes`) as a record, but nothing reads it back: carrying pasted replies waits on open PR #66's rule. |
| `asked_text` | Nothing. | What each reply was asked about; with staleness off this sprint, nothing reads it. |

## `quizzes.bulk_ishes_last`: removed from each row

What the last *Recalculate all ishes* run cost, per quiz. Nothing brings it back: the batched run
is gone this sprint, and the field with it.

## Not a table, but changed by the deploy

* **Each quiz's history** (the browser's git mirror) keeps what it had. Its next commit drops the
  hunt's `<hunt>.tqexpressions.json` and writes `tq/widget/pub/<label>.tqwidget.json` for each
  widget the quiz works, and its table's bot columns become `<label>.status` and `<label>.value`;
  the commit records that as a change, as it should.
* **Staleness** (the greyed sums and the ishes' *· stale*) is off this sprint by design, so nothing
  is lost by clearing `asked_text`; the deferred digest design is in
  `notes/decisions/2026-10-widgets.md`.
