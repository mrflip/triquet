# Columnwise: the bag's shapes before thread 10

The bag formulas and templates read, against what git and the Raw Export panel write, as of
2026-10-09 (the spine at #202). Git and Raw Export are built from the same balls
(`Exporting.ballsOf`). Git writes them one file per resource (plus a `.tsv` beside each, and a
README); Raw Export merges them into one jsonball (`Exporting.wholeOf`). The formula bag is built
separately, by the runner (`Runner.QuizBag`, `baseQns`, `withWidgeteds` in
`src/lib/formulary/runner.ts`). Thread 10 converges them.

| | Formula bag (widgetings) | Git and Raw Export (jsonball) |
| --- | --- | --- |
| Questions | `qns`, an ordered list; `qn` is one of its items | `questions`, keyed by label, each with a `position` |
| A question's fields | `label`, `chains_to` (as a label), `qnum`, `clueing`, `hint`, `title`, `alt_text`, `notes`, `full_answer`, `recap`, plus three made-up fields: `rank`, `archived`, `secondary` | The same, minus `label` (it is the key), plus `viz` and the stamps. No `rank`, `archived` or `secondary` |
| A widgeting's result on a question | The whole widgeted (`status`, `value`, `err`) plus an estimate's parts (`masie` and the others) | `status` and `value` only |
| Results so far | Only the widgetings that ran before this one | All of them |
| Quiz | `quiz`: `label`, `title`, `smiths_note`, plus quiz-wide widgetings' results as `quiz.<label>` | Everything: `q1_preamble`, the recap fields, `templateable`, `locked`, `last_sortkey`, stamps, `widgetings`, `columns`; quiz-wide results under `widgeteds` |
| Hunt and realm | `hunt` and `realm` objects, `label` and `title` each | The hunt's fields (with `branch` and stamps) at the root; the realm appears only as a key in the path |
| Categories | `categories`: a list of `{label, title}` in the wheel's order | The wheel itself (slots and pool) |
| Only in the bag | `qn_label`, `quiz_label`, `params`, `widgeting_label` | |
| Only in the export | | Members, the library's widgets, and in git only, shared reviews |

How the template bag (`Templating.TemplateBag`, `bagOver` in `src/lib/templating.ts`) differs from
the formula bag:

* It has no `params` or `widgeting_label`.
* `qns` leaves out archived questions, while `quiz.questions` holds all of them.
* Templateable fields arrive already filled in (`finishedQnsOf`).
* Images in computed values become links (`imagesLinkedOf`).
* The recap adds `number`, a played question's place (`PlaceField`).

LiquidJS 10.30, probed:

* `{% for x in obj %}` over a keyed object yields `[key, value]` pairs.
* `{% for x in obj | values %}` silently renders nothing, because the `for` tag takes no filter.
* `{{ obj[key].title }}` works.
* `{% assign list = obj | values %}{% for x in list %}` works, given a `values` filter of our own.
