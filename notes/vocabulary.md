# Vocabulary

The words this project uses for its own things. They are specific, several were chosen to stay
clear of a near neighbour, and none is guessable. Use them exactly: in code, in UI copy and in
chat. `STYLE.md` holds the general-purpose naming tags (`kind`, `label`, `bag`, `ckey`); this is
the domain.

## Widgets



## Who and where

* **ident** -- a persona in the app, named by a global label a person types to become it: 6 to
  24 characters of the label alphabet, normalised from what was typed. No password: anyone may
  assume any ident, for now. Has a `title` for display. Never changed or deleted.
* **identing** -- one account taking on one ident. The account's newest identing is its current
  ident; that row, not browser storage, is what "logged in" means. The one table no other account
  can read. (Later, a cred will be the thing an identing hangs off.)
* **hunt** -- the unit of URL scope and, later, of membership: holds realms and expressions, and
  is exactly what Export emits. Its label is global; should two share one, the earlier-made wins.
* **realm** -- a division of a hunt, holding quizzes; the address's middle segment. Every hunt
  starts with one, `home`, and nothing yet makes another. Where the notes say *puzzle* for a
  scope, they mean realm; *puzzle* is kept for the not-soon idea of quizzes of other shapes.
* **act** -- the presentation an address asks for (`?act=`): `smith` (the Workbench) or `review`.
  The path names the resource, the act how to show it. See
  `notes/decisions/2026-09-resource-urls.md`.
* **smith** -- someone making a hunt's quizzes; **reviewer** -- someone playtesting them.
* **workspace** -- retired in September 2026: what one account held, before hunts held quizzes
  and addresses said which was open. Import still reads an old workspace export, questions only.

## The things an author makes

* **quiz** -- an ordered list of questions, plus the widgets and columns that say what else the
  grid shows. Each question's `position` *is* the display order; sorting and dragging rewrite it.
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

* **id** -- Jazz's own row id, whatever it wants it to be; fixed for life, never shown: not on
  screen, not in the Export box, not in a quiz's history (`lib/exporting.ts`). An
  internal detail: where a label relationship is reasonable and equally powerful, refer by label
  instead, scoped where it must be (`quizlabel-questionlabel` as a selector id).
* **label** -- a freeform-string-derived identifier a person can read, type and paste back:
  lowercase letters, digits, underscore; letter first. Unique among siblings, not globally;
  idents and hunts have no parent, so theirs are global.
  Labels are what URLs, formulas, exports, git paths and column sources use, because people
  export, edit and re-import -- so many things refer by label where an id would be easier.
* **forced_label** / **effective label** -- a generated label (`quiet_otter`) can be overridden by
  an author-chosen `forced_label`; whichever is in force is the effective label, and the only
  one the outside world sees. `Labelmaker` is the facility for all of this.
* **version** -- which line of work a quiz is on; also its git branch. A **milestone** is a tag.

## Widgets and columns

* **widget** -- something that has a value for every question. A quiz opts into its widgets; they
  sit in one ordered list. Two kinds exist: expressing and botting. The questions' own fields
  behave as a built-in widget labelled `question`, which no other widget may be labelled.
* **column** -- what the grid shows: a `label`, a `title`, a `width_px` and a `source`. Kept apart
  from widgets on purpose: a widget *has* a value, a column *shows* one. Removing a column keeps
  its widget; removing a widget takes its columns.
* **source** -- what a column shows: `question.<field>`, `question.<view>`, or a widget's label.
* **expression** -- a reusable JSONata **formula** with a label and description, held by a
  hunt (`owner` is `tq` for the seeded ones). Generic: it knows nothing of any quiz.
* **expressing** -- a widget: one expression put to work in one quiz. The noun is deliberate --
  an *expression* is the recipe, an *expressing* is it being worked here.
* **expressed** -- what an expressing came to for one question: a value, `nothing` (a muted
  dash; never zero), or an error. Computed on render, stored nowhere.
* **bag** (the quiz bag) -- the document a formula reads: `quiz`, `qns`, `qn`, `qn_label`,
  `quiz_label`. No ids; everything by label.
* **exposed** -- the class-level list of fields a thing shows the outside world. The bag, its
  JSON Schema and the git table are all built from these lists, so hiding a field is one edit.

## Bots

*Player* means a human taking the quiz, and is kept for that. The prompts have always used it
that way; the model bots were called players until September 2026.

* **bot** -- something that can be put a question and reply; a model with a brief. Seeded:
  **dumdum**, the hasty guesser, and **numnum**, the number spotter.
* **botting** -- two things, related. As a *widget*, a connection from a quiz to a bot for one
  textkind. As a *row* in `bottings`, one time a bot was put one text, append-only. Named
  "botting" rather than "answering" to stay clear of `full_answer`; the reply is `reply_text`.
* **ask** -- the act of putting a text to a bot, and the request that does it. An ask has a
  **job** (`guess`, `ishes`, `bulk_ishes`).
* **textkind** -- which of a question's texts a bot is shown: `clueing` or `hint`.
* **slot** -- one played cell: a (bot, textkind) pair and the question field that shows it.
  The newest botting per slot is what the grid projects.
* **guess** -- dumdum's reply to a clueing. The ambiguity signal: a guess that differs from the
  answer means a second reading the author could not see from inside.
* **ish**, **ishes** -- a number-like span numnum found in a text ("300 million", "third", "千"),
  with the value a player would total for it. `kind` is `numeral` (digits) or `wordish`. The
  **sums** over them are seeded expressions; they exist for quizzes whose meta is numeric.
* **stale** -- derived, never discarded: a result whose `asked_text` is no longer the question's
  text stays on screen, marked.
* **last_err** -- a failed ask never replaces a value; it rides along on the cell until a success
  clears it.
* **model tier** -- `quick` or `careful`: a feature of the bot, not a cost dodge.
* **servicelabel** -- which outside service serves a bot (`claude`), and so whose credentials
  it needs. **unavailable** is a bot with none.

## Around the edges

* **locked** -- a quiz frozen against edits. Never a trap: switching, unlocking, exporting and
  editing the hunt's expressions all stay available.
* **sort memory** (`last_sortkey`) -- which column last committed the quiz to its order. A
  label, not a live sort.
* **notice** -- a sentence shown to the author in place of a result. Failures reach the author
  as sentences, never codes; they live together in `lib/notices.ts`.
* **mirror** -- the quiz's git history in the browser. A past-versions view and an exit door,
  not a source of truth. `.qq.tsv` is the diffable table; `.tq.json` is the whole quiz; both sit
  at `tq/hunt/<hunt>/realm/<realm>/quiz/`, and the hunt's expressions at
  `tq/hunt/<hunt>/<hunt>.tqexpressions.json`. The history follows the quiz: a relabel is a new
  label on the same thing, an edit new content for it.
* **meta** -- the second-layer puzzle a quiz can hide. The reason widgets exist.
* **Coach**, **agent** -- the humans and the AI on this project. See `CLAUDE.md`.
