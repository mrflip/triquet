# A hunt's git repository

The **mirror** (`notes/vocabulary.md`) is moving from one repository per quiz to one per hunt.
This file is the index of what such a repository holds and where. It is the spec for the
`hunt_git` sprint, whose plan is `whiteboard/20261005-hunt_git/hunt_git-plan.md`.

**Status: proposed (2026-10-05), not built.** The URL scheme is now
`notes/decisions/urls.md`, and **the paths and key paths below are still to be re-aligned with
it** (its rule 10: drop `~{org}/{hunt}` and add `.json`; its *Serialized files*: the JSON path
matches the URL path). Directory names marked ⟨url⟩ are the ones that move. The per-quiz
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

Everything a person sees is named by label, never by id: the repository's directories, its
files, the keys inside the JSON, a chain's target, a widgeting's widget, a member, its tags,
and the zip it downloads as (`<hunt label>.zip`, unpacking to a `<hunt label>/` folder). No file
carries a row id.

Where the repository sits in the browser's own filesystem is not user-facing, and it is keyed
by the hunt's id, `/hunts/<hunt _id>`, so that relabelling a hunt, here or in another browser,
neither moves nor strands its history.

## Jsonballs at their paths

Every `.tq.json` file is a **jsonball rooted at the hunt**: it holds its piece of the hunt
nested under the keys that lead to it, so that **deep-merging every `.tq.json` in the
repository reconstitutes the hunt**.

```jsonc
// home/quiet_otter/quiz.tq.json -- the whole quiz, its questions included
{ "realms": { "home": { "quizzes": { "quiet_otter": { "label": "quiet_otter", "title": "…", "questions": […], "widgetings": […], "columns": […] } } } } }
// home/quiet_otter/questions.qq.json -- the exception: the questions alone, a bare list, not merged
[ { "label": "nantes", "clueing": "…", … }, … ]
```

**The one exception is a quiz's questions file**, `questions.qq.json`. It holds the questions a
second time, on purpose, as a bare list in quiz order, rooted nowhere. That is exactly what the
Import box already accepts as a bare list of questions, so it can be pasted straight back in.
Its `.qq.json` extension keeps it out of the merge.

**Collections across files are objects keyed by label, not arrays** (settled 2026-10-05). A merge cannot know that
two arrays' elements are the same realm, and merge libraries disagree about arrays (es-toolkit
and lodash merge them by index, `deepmerge` concatenates, `jq`'s `*` replaces). A keyed object
merges the same way in every tool, and its keys are exactly the labels the file path names. The
rule that makes this safe: **no array is ever contributed to by two files.** Arrays appear only
inside one file's leaf: a quiz's questions in quiz order, its widgetings, its columns, the
wheel's slots. The order of collections that are keyed (realms, quizzes) is kept as a
`position` field where the data has one (realms). Quizzes have none, since their order is the
order they were made in, so a reconstituted realm lists its quizzes by label. **Open: revisit
quiz order once the URL scheme is settled** (plan, *For the Coach*).

As a result, `jq -s 'reduce .[] as $f ({}; . * $f)' $(git ls-files '*.tq.json')` rebuilds the
hunt, at any commit, with no Triquet involved, and `es-toolkit`'s `merge` does the same inside
the app's tests.

## The rules every file follows

1. **Every resource is written once, in both formats**: a jsonball, and a `.tsv` beside it with
   the same stem, legible in a diff. The quiz is one jsonball holding everything about it,
   questions included. Its questions are also written alone (`questions.qq.json`, the exception
   above) beside `questions.qq.tsv`, their legible table, so `quiz.tq.tsv` leaves the questions
   out rather than repeat them as keypath lines. A question edit therefore diffs in
   `quiz.tq.json`, `questions.qq.json` and `questions.qq.tsv`, and any other edit in exactly one
   JSON file and one TSV file.
2. **JSON** is `UU.jsonify(…, { pretty: true })`, with sorted keys and a trailing newline.
3. **TSV** is a view of its jsonball's leaf, not part of the merge, and **every TSV reads the
   same way** (settled 2026-10-05): a header line, then one row per item, quoted by Papa Parse,
   with `\n` line endings and a trailing newline. Columns are named by keypath and sorted, and
   rows are sorted by label, so a reorder does not churn the diff (the order is still in the
   JSON). A single record (the hunt, a realm, a quiz, a widget) is a header and one row, even
   where that row is wide: a quiz's widgetings and columns come out as columns named
   `widgetings.0.params.prompt` and the like.
4. **Paths follow addresses.** A resource with a page of its own sits at the repository path
   that its URL names below the hunt. One function produces the URL, the path and the jsonball's
   key path, so the three cannot drift (thread 1 of the plan). Renaming a quiz or realm renames
   its files, which real git follows as a rename by similarity once the repository is downloaded.
   That is all that is asked of renames: the repository is a backup, a history and a download,
   not a database. (isomorphic-git follows only renames that leave a file's contents
   byte-identical, and the app reads no history back, so nothing here leans on it.)
5. **A deletion is a commit that removes the files.** The history keeps them, so a deleted quiz
   no longer leaves an orphaned repository behind.

## The index

| Resource | Rows it is made from | Jsonball, and where its leaf sits | TSV |
|---|---|---|---|
| Hunt | `hunts` | `hunt.tq.json`: `{ label, title, branch }` | `hunt.tq.tsv` (one row) |
| Members | `huntings` | `members.tq.json`: `{ members: { <ident_label>: { title, role } } }` | `members.tq.tsv` (a row per member) |
| Categories | `hunts.wheel` | `categories.tq.json`: `{ wheel: [ … ] }`, the default wheel written out in full when the hunt has never arranged one | `categories.tq.tsv` (a row per slot) |
| Realm | `realms` | ⟨url⟩`<realm>/realm.tq.json`: `{ realms: { <realm>: { label, title, position } } }` | `realm.tq.tsv` (one row) |
| Quiz | `quizzes`, `questions` + `widgeteds`, `widgetings`, `columns` | ⟨url⟩`<realm>/<quiz>/quiz.tq.json`: `…quizzes: { <quiz>: { label, title, locked, smiths_note, q1_preamble, questions, widgetings, columns } }`; questions in quiz order, chains by label, each with every widgeting's status and value | `quiz.tq.tsv` (one row, questions left out) |
| Questions, alone | the same questions | `<realm>/<quiz>/questions.qq.json`: a bare list, **not a jsonball, not merged** | `questions.qq.tsv` (today's format, by label) |
| Reviews | `reviews` + `reviewings`, **shared only** | `<realm>/<quiz>/reviews/<ident_label>.review.tq.json`: `…quizzes: { <quiz>: { reviews: { <ident_label>: { overall, phase, verdicts: { <question label>: { … } } } } } }` | `<ident_label>.review.tq.tsv` (a row per question) |
| Widgets worked | `widgets` (the library's) | `widget/<scope>/<label>.widget.tq.json`: `{ widgets: { <scope>: { <label>: { … } } } }`, as `Widget.exported` gives it | `<label>.widget.tq.tsv` (one row) |

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

## Branches

**The branch belongs to the hunt** (settled 2026-10-05). What the code called a quiz's
`version` is renamed `branch` and moved to the hunt: `notes/decisions/urls.md` has a version
name the state of the whole hunt (`{hunt}@{ref}`), and the hunt's own page is where it is set.
One hunt, one branch at a time, so a hunt repository is on exactly the branch the hunt names:

* **Changing the hunt's branch starts or joins a git branch, as a quiz's version did.** A new
  name branches from the current tip, and a name the history has seen checks that branch out
  again. Every commit goes to the hunt's branch.
* **Tags must follow the label rule**, since `@{ref}` names them. Their exact shape (today's
  `<version>-m-<stamp>` has a hyphen) is open until the URL conversation.

## Watching and committing, by file

The feed watches **at the grain of the files**, through query functions sized to match: one
for the hunt-level files (hunt, members, categories, realms, and the list of quizzes), and one
per quiz for its frame, its questions, and its shared reviews. A change re-runs only the queries
whose reads it touched, and Convex resends only their results.

* **Dirty files, not whole trees.** Each watch maps its result to the files it owns. The
  scheduler keeps, per hunt, the set of files whose body differs from what was last committed.
  A commit writes only those blobs into its branch's tree, and drops the files of anything that
  went.
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
