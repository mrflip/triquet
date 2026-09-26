# Vocabulary

The words this project uses for its own things. They are specific, several were chosen to stay
clear of a near neighbour, and none is guessable. Use them exactly: in code, in UI copy and in
chat. `STYLE.md` holds the general-purpose naming tags (`kind`, `label`, `bag`, `ckey`); this is
the domain.

## Widgets



## The things an author makes

* **workspace** -- everything the tool holds for one person in one browser: their quizzes, their
  expressions, and which quiz is open. Found by a cookie; there are no accounts. It is also
  exactly what Export emits and Import accepts.
* **quiz** -- an ordered list of questions, plus the widgets and columns that say what else the
  grid shows. The array order *is* the display order; sorting and dragging rewrite it.
* **question** -- one row. Its base fields are the constant of the whole tool: `title`, `clueing`,
  `hint`, `full_answer`, `qnum`, `chains_to`, `alt_text`, `notes`. Everything else a quiz shows
  is a widget.
* **clueing** -- the question as it will be asked. Never "question text" and never "question":
  that word is the row. (The prompts still say "question" to the model, because a player would.)
  Never rewritten by the tool, not even trimmed.
* **title** -- a brief name for the question, and what other questions' chain pickers call it.
  Not the answer.
* **full_answer** -- the answer, as it will be read out.
* **hint** -- this question's own "BUT NOT ..." misdirection: a clue for something that shares
  the answer's name but is not it. It belongs to the question whose answer it disguises, and is
  *shown* beside whichever other question chains to this one.
* **qnum** (Q#) -- the author's own question number, kept as text. Blank, gappy, duplicated and
  decimal are all legal; `3.1` means "between 3 and 4" without renumbering anything.
* **rank** -- a question's 1-based place once the quiz is put in Q# order; null without a Q#.
  Rank is derived and dense where Q# is typed and loose. Exports are always in rank order.

## Chains

* **chain**, `chains_to` -- the question that follows this one. Solving this one hands the player
  a pointer to the next. Stored as the target's id; shown to formulas as its label. A chain that
  dangles or points at itself is cleared, never kept.
* **butnot** -- the BUT NOT text presented with a question: the *chained-to* question's hint. A
  **view** (`question.butnot`, `question.butnot_ishes`), worked out and stored nowhere.
* **chain order** -- walking the chains from the lowest Q#; the one sort that is not a column's.

## Identity

* **id** -- Jazz's own row id, whatever it wants it to be; fixed for life, never shown. An
  internal detail: where a label relationship is reasonable and equally powerful, refer by label
  instead, scoped where it must be (`quizlabel-questionlabel` as a selector id).
* **label** -- a freeform-string-derived identifier a person can read, type and paste back:
  lowercase letters, digits, underscore; letter first. Unique among siblings, not globally.
  Labels are what URLs, formulas, exports, git paths and column sources use, because people
  export, edit and re-import -- so many things refer by label where an id would be easier.
* **forced_label** / **effective label** -- a generated label (`quiet_otter`) can be overridden by
  an author-chosen `forced_label`; whichever is in force is the effective label, and the only
  one the outside world sees. `Labelmaker` is the facility for all of this.
* **version** -- which line of work a quiz is on; also its git branch. A **milestone** is a tag.

## Widgets and columns

* **widget** -- something that has a value for every question. A quiz opts into its widgets; they
  sit in one ordered list. Two kinds exist: expressing and playing. The questions' own fields
  behave as a built-in widget labelled `question`, which no other widget may be labelled.
* **column** -- what the grid shows: a `label`, a `title`, a `width_px` and a `source`. Kept apart
  from widgets on purpose: a widget *has* a value, a column *shows* one. Removing a column keeps
  its widget; removing a widget takes its columns.
* **source** -- what a column shows: `question.<field>`, `question.<view>`, or a widget's label.
* **expression** -- a reusable JSONata **formula** with a label and description, owned by the
  workspace (`owner` is `tq` for the seeded ones). Generic: it knows nothing of any quiz.
* **expressing** -- a widget: one expression put to work in one quiz. The noun is deliberate --
  an *expression* is the recipe, an *expressing* is it being worked here.
* **expressed** -- what an expressing came to for one question: a value, `nothing` (a muted
  dash; never zero), or an error. Computed on render, stored nowhere.
* **bag** (the quiz bag) -- the document a formula reads: `quiz`, `qns`, `qn`, `qn_label`,
  `quiz_label`. No ids; everything by label.
* **exposed** -- the class-level list of fields a thing shows the outside world. The bag, its
  JSON Schema and the git table are all built from these lists, so hiding a field is one edit.

## Players

* **player** -- someone who can be put a question and reply; a model with a brief. Seeded:
  **dumdum**, the hasty guesser, and **numnum**, the number spotter.
* **playing** -- two things, related. As a *widget*, a connection from a quiz to a player for one
  textkind. As a *row* in `playings`, one time a player was put one text, append-only. Named
  "playing" rather than "answering" to stay clear of `full_answer`; the reply is `reply_text`.
* **ask** -- the act of putting a text to a player, and the request that does it. An ask has a
  **job** (`guess`, `ishes`, `bulk_ishes`).
* **textkind** -- which of a question's texts a player is shown: `clueing` or `hint`.
* **slot** -- one played cell: a (player, textkind) pair and the question field that shows it.
  The newest playing per slot is what the grid projects.
* **guess** -- dumdum's reply to a clueing. The ambiguity signal: a guess that differs from the
  answer means a second reading the author could not see from inside.
* **ish**, **ishes** -- a number-like span numnum found in a text ("300 million", "third", "千"),
  with the value a player would total for it. `kind` is `numeral` (digits) or `wordish`. The
  **sums** over them are seeded expressions; they exist for quizzes whose meta is numeric.
* **stale** -- derived, never discarded: a result whose `asked_text` is no longer the question's
  text stays on screen, marked.
* **last_err** -- a failed ask never replaces a value; it rides along on the cell until a success
  clears it.
* **model tier** -- `quick` or `careful`: a feature of the player, not a cost dodge.
* **servicelabel** -- which outside service serves a player (`claude`), and so whose credentials
  it needs. **unavailable** is a player with none.

## Around the edges

* **locked** -- a quiz frozen against edits. Never a trap: switching, unlocking, exporting and
  editing the workspace's expressions all stay available.
* **sort memory** (`last_sortkey`) -- which column last committed the quiz to its order. A
  label, not a live sort.
* **notice** -- a sentence shown to the author in place of a result. Failures reach the author
  as sentences, never codes; they live together in `lib/notices.ts`.
* **mirror** -- the quiz's git history in the browser. A past-versions view and an exit door,
  not a source of truth. `.qq.tsv` is the diffable table; `.tq.json` is the whole quiz.
* **meta** -- the second-layer puzzle a quiz can hide. The reason widgets exist.
* **Coach**, **agent** -- the humans and the AI on this project. See `CLAUDE.md`.
