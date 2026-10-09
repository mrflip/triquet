# Data relations, as built

2026-10-09, at `ec3184a0`, from `convex/schema.ts` and the row validators in `src/models/`. Rows,
not a tree; children are read through their parent's index and refer to each other by label
where exports must round-trip (a widgeting names its widget by label; a column's source names a
widgeting by label; `chains_to` is the one id reference a question holds).

```mermaid
erDiagram
  IDENT ||--o{ HUNTING : "is on"
  HUNT ||--o{ HUNTING : "members, with a role"
  IDENT ||--o{ HUNT : "org of: orglabel, copied at making"
  HUNT ||--|{ REALM : "holds: home, only"
  HUNT ||--o| WHEEL : "arranges categories round"
  HUNT ||--o| MIRROR : "git history, in the browser"
  REALM ||--o{ QUIZ : "holds"
  QUIZ ||--o{ QUESTION : "holds, in row_ordering"
  QUESTION }o--o| QUESTION : "chains_to"
  QUIZ ||--o{ COLUMN : "shows through, in position order"
  QUIZ ||--o{ WIDGETING : "puts to work, in run order"
  COLUMN }o--o| WIDGETING : "source ref, by label"
  WIDGETING }o--|| WIDGET : "works, by label"
  LIBRARY ||--o{ WIDGET : "holds, scope pub, in position order"
  WIDGETING ||--o{ WIDGETED : "came to, per question"
  QUESTION ||--o{ WIDGETED : "for"
  WIDGETING ||--o| QUIZ_WIDGETED : "came to, once for the quiz"
  QUIZ ||--o{ REVIEW : "reviewed in"
  IDENT ||--o{ REVIEW : "writes"
  REVIEW ||--o{ REVIEWING : "verdict on"
  QUESTION ||--o{ REVIEWING : "judged in"
  QUIZ ||--|| SIGNAL : "change signal"

  IDENT {
    label label
    text title
  }
  HUNT {
    label label
    label orglabel
    text title
    label branch
    wheel wheel
  }
  HUNTING {
    enum role
  }
  REALM {
    label label
    int position
  }
  QUIZ {
    label label
    text title
    md smiths_note
    text q1_preamble
    md recap_head
    md recap_tail
    liquid recap_template
    list templateable
    bool locked
    label last_sortkey
    ids row_ordering
  }
  QUESTION {
    label label
    text qnum
    text title
    md clueing
    md hint
    md full_answer
    md notes
    md recap
    text alt_text
    enum viz
    id chains_to
  }
  COLUMN {
    label label
    text title
    ref source
    jsonata formula
    liquid template
    enum readout
    bool collapsed
    enum align
    int width_px
    int position
  }
  WIDGETING {
    label label
    label widget_label
    enum tier
    text description
    json params
    int position
  }
  WIDGET {
    enum scope
    label label
    text title
    text description
    enum formulary
    text formula
    jsonata input_formula
    json config
    int position
  }
  WIDGETED {
    enum status
    json value
    json result_meta
  }
  REVIEW {
    md overall
    enum phase
  }
  REVIEWING {
    int get_rate
    text guesses
    text comments
    num minutes
    bool keep_it
    bool needs_fact_check
    bool elimination_candidate
    bool peeked
  }
```

## What the picture says

* **Two trees and a library.** The hunt's tree (realm, quiz, question, column, widgeting,
  widgeted) and the ident's (hunting, review, reviewing) meet at the quiz. The library stands
  apart, joined by a label.
* **The hunt's own fields are few** (title, label, org, branch, wheel) and each is edited
  somewhere different: title and label in two dialogs, branch on the hunt page, wheel on its own
  page.
* **A column points at a widgeting, a widgeting at a widget**: the chain the folding editor
  draws, a widgeting folded beneath its column and the widget behind a door in the widgeting's
  panel. The navigation follows the relation here, exactly.
* **Members and reviews hang off the hunt and the quiz, not off a page.** Both are addressed
  (`/members`, `/reviews/{ident}`) and neither is served.
