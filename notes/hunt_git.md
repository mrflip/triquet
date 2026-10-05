# A hunt's git repository

The **mirror** (`notes/vocabulary.md`) is moving from one repository per quiz to one per hunt.
This file is the index of what such a repository holds and where. It is the spec for the
`hunt_git` sprint, whose plan is `whiteboard/20261005-hunt_git/hunt_git-plan.md`.

**Status: proposed (2026-10-05), not built.** Today each quiz has its own repository at
`/quizzes/<quiz _id>`, holding `tq/hunt/<hunt>/realm/<realm>/quiz/<quiz>.qq.tsv`, the whole quiz as
`<quiz>.tq.json`, and `tq/widget/<scope>/<label>.tqwidget.json` for each widget it works
(`src/lib/quizgit.ts`). Directory names below marked ⟨url⟩ wait on the Coach's new URL scheme;
the defaults shown follow today's `/h/<hunt>/<realm>/<quiz>`.

## What stays the same

* The repository is **a past-versions view and an exit door, never a source of truth**. Nothing
  reads app state back from it.
* It lives **in this browser** (LightningFS over IndexedDB), and each browser keeps its own.
  Per-browser is accepted for now: it is a wontfix in the todo list.
* It is written **only from what a smith is sent whole** (`Question.isSentWhole`). A reviewer's
  browser keeps no history, because one built from a reviewer's view would show the smiths'
  notes as blanked.
* **Labels, never ids.** No file carries a row id. A chain names its question by label, a
  widgeting names its widget by label, and a member is named by ident label.

## The rules every file follows

1. **Every resource is written exactly once, in both formats**: a `.json` that holds all of it,
   and a `.tsv` beside it with the same stem, legible in a diff. An edit therefore shows up in one
   JSON file and one TSV file, never in a third copy somewhere else.
2. **JSON** is `UU.jsonify(…, { pretty: true })`, with sorted keys and a trailing newline. A
   list is kept in the order the app shows it (questions in quiz order, realms in hunt order).
3. **TSV** comes in two shapes, both quoted by Papa Parse, with `\n` line endings and a trailing
   newline:
   * **A collection** (questions, members, widgetings, columns, reviewings) is a header line and
     one row per item. Columns are sorted by keypath and rows by label, so a reorder does not
     churn the diff (the order is still in the JSON).
   * **A single record** (the hunt, a realm, a quiz, a widget) is two columns, `keypath` and
     `value`, one line per leaf field, sorted by keypath.

   Either way, a nested object is flattened to keypaths (`params.prompt`), and a list nested
   inside a row is written as compact JSON in its cell.
4. **Paths follow addresses.** A resource with a page of its own sits at the repository path
   that its URL names below the hunt. One function produces both the URL and the path, so the
   two cannot drift (thread 2 of the plan). Renaming a hunt, realm or quiz renames its files,
   and git reads that as a rename.
5. **A deletion is a commit that removes the files.** The history keeps them, which is why a
   per-hunt repository does away with orphaned repositories for deleted quizzes.

## The index

The repository root is the hunt itself: `/hunts/<hunt _id>` in the browser's filesystem. It is
keyed by id so that relabelling the hunt never orphans its history, and it is zipped under the
hunt's label.

| Resource | Rows it is made from | JSON | TSV (shape) | Holds |
|---|---|---|---|---|
| Hunt | `hunts` | `hunt.tq.json` | `hunt.tq.tsv` (record) | label, title |
| Members | `huntings` | `members.tq.json` | `members.tq.tsv` (collection, by ident label) | ident_label, ident_title, role |
| Categories | `hunts.wheel` | `categories.tq.json` | `categories.tq.tsv` (collection, by slot) | slot, category; the default wheel written out in full when the hunt has never arranged one |
| Realm | `realms` | ⟨url⟩`<realm>/realm.tq.json` | `realm.tq.tsv` (record) | label, title, position |
| Quiz | `quizzes` | ⟨url⟩`<realm>/<quiz>/quiz.tq.json` | `quiz.tq.tsv` (record) | label, title, version, locked, smiths_note, q1_preamble |
| Questions | `questions` + `widgeteds` | `<realm>/<quiz>/questions.qq.json` | `questions.qq.tsv` (collection, by label: today's format) | each question's own fields, its chain by label, and what each widgeting came to (status and value) |
| Widgetings | `widgetings` | `<realm>/<quiz>/widgetings.tq.json` | `widgetings.tq.tsv` (collection) | label, widget_label, position, params by keypath |
| Columns | `columns` | `<realm>/<quiz>/columns.tq.json` | `columns.tq.tsv` (collection) | the grid's layout |
| Reviews | `reviews` + `reviewings`, **shared only** | `<realm>/<quiz>/reviews/<ident_label>.review.json` | `<ident_label>.review.tsv` (collection, a row per question, by question label) | overall and phase in the JSON; each question's get_rate, guesses, comments, minutes and flags |
| Widgets worked | `widgets` (the library's) | `widget/<scope>/<label>.tqwidget.json` | `.tqwidget.tsv` (record) | every widget that any quiz of the hunt works, as `Widget.exported` gives it |

A `README.md` at the root, written once when the repository is made, says what the repository
is and how to read it, so that someone who unzips it a year from now is not left guessing.

### Left out, on purpose

* **Ids**, `position` where the order is already shown, `hunt_id`/`quiz_id` copies, and
  `last_sortkey`: these are bookkeeping, not content.
* **Widgeted history**: only the latest outcome per cell goes in, as `quizExported` does today.
  The repository's own history is the record of change.
* **Draft and empty reviews**: a smith may not read them (`Approve.mayReadReview`), and the
  repository holds only what a smith's browser is sent.
* **Idents, identings, users, sessions**: these are accounts, not hunt content. Members carries
  what the hunt needs of them.
* **The library apart from what the hunt works**: it belongs to no hunt. A library repository of
  its own is possible later, and not part of this work.

## Branches, versions and tags

Today a quiz's `version` names the branch its repository is on. A hunt's quizzes each have their
own version, so one repository cannot be on all of them at once. **Proposed:** a hunt repository
has one branch, `main`. `version` becomes an ordinary field in `quiz.tq.json`, so changing it is
a diff like any other. Tags gain the quiz as a path segment:
`<quiz>/<version>/m-20261005184504z` for a milestone and `<quiz>/<version>/import-…` for an
import (git allows `/` in a tag name, and tools group tags by it). This needs the Coach's yes:
see the plan's *For the Coach*.

## Commits

* **One scheduler clock per hunt**, as there is per quiz today: the first change starts the
  wait, and later changes do not restart it.
* **A message summarises the whole burst across quizzes**, one line per quiz that moved, with
  the quiz's label leading `Changes.shorthandFor`'s shorthand (`quiet_otter: +2 qq, clueing×3`),
  then lines for the hunt-level changes (members, categories, realms).
* **A catch-up commit when the hunt is first read in a tab.** If the tree the hunt would write
  differs from HEAD, it is committed straight away as `catch up: changes made while this browser
  was away`. Today nothing does this (see *What the feed sees* below).
* Milestones, and the before-and-after commits around an import or a deletion, keep their
  meaning; they now flush the hunt's pending edits rather than the quiz's.

## What the feed sees

`useHistoryFeed` (`src/state/use-hunt.ts`) watches the open quiz's frame, a watch per question,
the hunt and the library. Every change those watches report is noted, whoever made it: this tab,
another tab, or another browser. Those changes are committed on the scheduler's clock. A
per-hunt repository needs the feed to see the whole hunt (thread 3 of the plan weighs the ways to
do that), not just the quiz on screen.

## The existing per-quiz repositories

They stay where they are, under `/quizzes`, and are never rewritten: merging separate histories
into one with isomorphic-git is not worth the risk. They remain listed and downloadable as
*legacy histories* (the list built in PR #102). A hunt repository starts with one commit of the
hunt as it stands.
