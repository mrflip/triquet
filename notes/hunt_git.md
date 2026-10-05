# A hunt's git repository

The **mirror** (`notes/vocabulary.md`) is moving from one repository per quiz to one per hunt.
This file is the index of what such a repository holds and where. It is the spec for the
`hunt_git` sprint, whose plan is `whiteboard/20261005-hunt_git/hunt_git-plan.md`.

**Status: proposed (2026-10-05), not built.** Directory names marked ⟨url⟩ wait on the Coach's
new URL scheme; the defaults shown follow today's `/h/<hunt>/<realm>/<quiz>`. The per-quiz
repositories of today (`/quizzes/<quiz _id>`, `src/lib/quizgit.ts`) get **no special
treatment**: there is no migration, and nothing new reads or lists them.

## What stays the same

* The repository is **a past-versions view and an exit door, never a source of truth**. Nothing
  reads app state back from it.
* It lives **in this browser** (LightningFS over IndexedDB), and each browser keeps its own.
  Per-browser is accepted for now: it is a wontfix in the todo list.
* It is written **only from what a smith is sent whole** (`Question.isSentWhole`). A reviewer's
  browser keeps no history.

## Scoped by label

Everything is named by label, never by id: the repository, its directories, its files, the keys
inside the JSON, a chain's target, a widgeting's widget, a member. No file carries a row id.

The repository root is `/hunts/<hunt label>`. Relabelling a hunt in this tab moves the
directory (LightningFS `rename`, in the mirror's queue). One consequence is accepted: a hunt
relabelled in another browser, while this one is away, leaves this browser's repository under
the old label. It is then listed with the repositories of hunts you are not on, and can still be
downloaded. A new hunt minted with a label an old repository still holds continues that
history. The label is the identity.

## Jsonballs at their paths

Every `.json` file is a **jsonball rooted at the hunt**: it holds its piece of the hunt nested
under the keys that lead to it, so that **deep-merging every `.json` in the repository
reconstitutes the hunt**.

```jsonc
// home/quiet_otter/quiz.tq.json
{ "realms": { "home": { "quizzes": { "quiet_otter": { "label": "quiet_otter", "title": "…", "widgetings": […], "columns": […] } } } } }
// home/quiet_otter/questions.qq.json
{ "realms": { "home": { "quizzes": { "quiet_otter": { "questions": [ … ] } } } } }
```

**Collections across files are objects keyed by label, not arrays.** A merge cannot know that
two arrays' elements are the same realm, and merge libraries disagree about arrays (es-toolkit
and lodash merge them by index, `deepmerge` concatenates, `jq`'s `*` replaces). A keyed object
merges the same way in every tool, and its keys are exactly the labels the file path names. The
rule that makes this safe: **no array is ever contributed to by two files.** Arrays appear only
inside one file's leaf: a quiz's questions in quiz order, its widgetings, its columns, the
wheel's slots. The order of collections that are keyed (realms, quizzes) is kept as a
`position` field where the data has one (realms). Quizzes have none, since their order is the
order they were made in, so a reconstituted realm lists its quizzes by label.

As a result, `jq -s 'reduce .[] as $f ({}; . * $f)' $(git ls-files '*.json')` rebuilds the
hunt, at any commit, with no Triquet involved, and `es-toolkit`'s `merge` does the same inside
the app's tests.

## The rules every file follows

1. **Every resource is written exactly once, in both formats**: a jsonball, and a `.tsv` beside
   it with the same stem, legible in a diff. The quiz is one jsonball holding everything about
   it (its widgetings and columns included) **except its questions**, which are a jsonball of
   their own. An edit therefore lands in exactly one JSON file and one TSV file.
2. **JSON** is `UU.jsonify(…, { pretty: true })`, with sorted keys and a trailing newline.
3. **TSV** is a view of its jsonball's leaf, not part of the merge. It comes in two shapes,
   both quoted by Papa Parse, with `\n` line endings and a trailing newline:
   * **A collection** (questions, members, a review's verdicts) is a header line and one row
     per item. Columns are sorted by keypath and rows by label, so a reorder does not churn the
     diff (the order is still in the JSON).
   * **Anything else** (the hunt, a realm, a quiz, a widget) is two columns, `keypath` and
     `value`, one line per leaf, sorted by keypath. A quiz's widgetings and columns come out as
     `widgetings.0.params.prompt` and the like.
4. **Paths follow addresses.** A resource with a page of its own sits at the repository path
   that its URL names below the hunt. One function produces the URL, the path and the jsonball's
   key path, so the three cannot drift (thread 1 of the plan). Renaming a quiz or realm renames
   its files. In the downloaded repository, real git reads that as a rename by similarity.
   isomorphic-git follows only renames that leave the contents byte-identical (`log` with
   `follow`), and the app reads no history back, so that difference does not matter yet.
5. **A deletion is a commit that removes the files.** The history keeps them, so a deleted quiz
   no longer leaves an orphaned repository behind.

## The index

| Resource | Rows it is made from | Jsonball, and where its leaf sits | TSV |
|---|---|---|---|
| Hunt | `hunts` | `hunt.tq.json`: `{ label, title }` | `hunt.tq.tsv` (keypath/value) |
| Members | `huntings` | `members.tq.json`: `{ members: { <ident_label>: { title, role } } }` | `members.tq.tsv` (a row per member) |
| Categories | `hunts.wheel` | `categories.tq.json`: `{ wheel: [ … ] }`, the default wheel written out in full when the hunt has never arranged one | `categories.tq.tsv` (a row per slot) |
| Realm | `realms` | ⟨url⟩`<realm>/realm.tq.json`: `{ realms: { <realm>: { label, title, position } } }` | `realm.tq.tsv` (keypath/value) |
| Quiz | `quizzes`, `widgetings`, `columns` | ⟨url⟩`<realm>/<quiz>/quiz.tq.json`: `…quizzes: { <quiz>: { label, title, version, locked, smiths_note, q1_preamble, widgetings, columns } }` | `quiz.tq.tsv` (keypath/value) |
| Questions | `questions` + `widgeteds` | `<realm>/<quiz>/questions.qq.json`: `…quizzes: { <quiz>: { questions: [ … ] } }`, in quiz order, chains by label, and each widgeting's status and value | `questions.qq.tsv` (today's format, by label) |
| Reviews | `reviews` + `reviewings`, **shared only** | `<realm>/<quiz>/reviews/<ident_label>.review.json`: `…quizzes: { <quiz>: { reviews: { <ident_label>: { overall, phase, verdicts: { <question label>: { … } } } } } }` | `<ident_label>.review.tsv` (a row per question) |
| Widgets worked | `widgets` (the library's) | `widget/<scope>/<label>.tqwidget.json`: `{ widgets: { <scope>: { <label>: { … } } } }`, as `Widget.exported` gives it | `.tqwidget.tsv` (keypath/value) |

A `README.md` at the root, written once when the repository is made, says what the repository
is, how to read it, and the `jq` line above.

### Left out, on purpose

* **Ids**, `hunt_id`/`quiz_id` copies, `row_ordering` (the questions' array order carries it),
  and `last_sortkey`: these are bookkeeping, not content.
* **Widgeted history**: only the latest outcome per cell goes in, as `quizExported` does today.
  The repository's own history is the record of change.
* **Draft and empty reviews**: a smith may not read them (`Approve.mayReadReview`).
* **Idents, identings, users, sessions**: these are accounts. Members carries what the hunt
  needs of them.
* **The library apart from what the hunt works**: it belongs to no hunt.

## Branches, versions and tags

Today a quiz's `version` names its repository's branch. A hunt's quizzes each have their own
version, so **a hunt repository has one branch, `main`**, and `version` is an ordinary field in
the quiz's jsonball. Tags carry the quiz as a path segment: `<quiz>/<version>/m-20261005184504z`
for a milestone, and `<quiz>/<version>/import-…` and `…/delete-…` around those changes. Git
allows `/` in a tag name, and tools group tags by it.

## Watching and committing, by file

The feed watches **at the grain of the files**, through query functions sized to match: one
for the hunt-level files (hunt, members, categories, realms, and the list of quizzes), and one
per quiz for its frame, its questions, and its shared reviews. A change re-runs only the queries
whose reads it touched, and Convex resends only their results.

* **Dirty files, not whole trees.** Each watch maps its result to the files it owns. The
  scheduler keeps, per hunt, the set of files whose body differs from what was last committed.
  A commit writes and `git.add`s only those, and removes the files of anything that went.
* **One clock per hunt.** The first change starts the wait, and later changes do not restart
  it.
* **Consistency.** The Convex client applies every subscribed query's new result at one
  timestamp, so the files never mix two moments. The exception is a new watch (a new quiz, or
  a quiz newly listed): it reports a moment later, and until it has reported, its files are
  neither written nor removed.
* **The message is the dirty set, summarised.** One line per quiz that moved, with its label
  leading `Changes.shorthandFor`'s shorthand (`quiet_otter: +2 qq, clueing×3`), then a line for
  each hunt-level file that moved.
* **Catch-up on the first full reading in a tab.** Each file's body is compared with HEAD's
  blob (`git.hashBlob` against the tree), and whatever differs is committed straight away as
  `catch up: changes made while this browser was away`. Without this, changes made elsewhere
  while this browser was away ride along, mislabelled, in the next local commit.
* Milestones, and the before-and-after commits around an import or a deletion, flush the hunt's
  pending files first, as they flush the quiz's today.
