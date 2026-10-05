# A hunt's git repository

The **mirror** (`notes/vocabulary.md`) is moving from one repository per quiz to one per hunt.
This file is the index of what such a repository holds and where. It is the spec for the
`hunt_git` sprint, whose plan is `whiteboard/20261005-hunt_git/hunt_git-plan.md`.

**Status (2026-10-05): the files are built; the repository that holds them is not yet.**
`src/lib/huntfiles.ts` (`Huntfiles`) writes every file below from a hunt's snapshot, and one
resource's files from that resource alone; the watches that feed it and the repository per hunt
are threads 4 and 5 of the sprint. Paths follow `notes/decisions/urls.md` (rule 10, with the
realm written `home`), through `src/lib/addresses.ts`. The per-quiz repositories of today
(`/quizzes/<quiz _id>`, `src/lib/quizgit.ts`) get **no special treatment**: there is no
migration, and nothing new reads or lists them.

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

Every merged file is a **jsonball rooted at the hunt** (`notes/vocabulary.md`, *jsonball*;
`src/lib/jsonball.ts`): it holds its piece of the hunt nested under the key path that leads to
it, so that **deep-merging every `*.tq?.json` in the repository reconstitutes the hunt**, exactly
as Raw Export emits it.

```jsonc
// quizzes/home/legends.tqq.json -- the whole quiz, its questions included
{ "quizzes": { "home": { "legends": { "title": "…", "locked": false, "questions": { "leon": { "position": 0, … } }, "widgetings": { … }, "columns": { … } } } } }
// quizzes/home/legends/questions.qq.json -- the exception: the questions alone, rooted at the quiz, not merged
{ "questions": { "leon": { "position": 0, "qnum": "1", "clueing": "…", "chains_to": "nantes", "dumdum": { "status": "ok", "value": … } }, … } }
```

**The one exception is a quiz's questions alone**, `questions.qq.json`, beside the quiz's own
file in a directory named for it. It holds the questions a second time, on purpose, as the
quiz's ball holds them but rooted at the quiz, naming no quiz, so it pastes straight into any
quiz's Import. Its `.qq` pre-extension keeps it out of the `*.tq?.json` merge.

**No arrays: every collection is an object keyed by label** (settled 2026-10-05). A merge cannot
know that two arrays' elements are the same thing, and merge libraries disagree about arrays
(es-toolkit and lodash merge them by index, `deepmerge` concatenates, `jq`'s `*` replaces). A
keyed object merges the same way in every tool, and its keys are exactly the labels the file
path names. Where order matters (a quiz's questions, widgetings and columns; the wheel's slots;
the library) each member carries its `position`. A list appears only where a value is itself
one, inside one file (a widgeting's params may hold one). Quizzes have no stored order, so a
hunt rebuilt from its files lists them by label (settled by the Coach, 2026-10-05). Realms are
not written: every hunt holds only `home`.

Every key is a label and no body repeats it: `quizzes.home.legends` holds no `label` field. The
hunt's own fields, its key path empty, sit at the root (`hunt.tqh.json`), its `label` among them.

So, at any commit, with no Triquet involved (`Huntfiles.MergeCommand`, in the README):

```sh
jq -s 'reduce .[] as $ball ({}; . * $ball)' $(git ls-files '*.tq?.json')
```

Git's pathspec `*` crosses `/`, so `*.tq?.json` (`Addresses.MergedPathspec`) finds every merged
ball at any depth, and not the questions alone; `tests/lib/huntfiles.test.ts` proves the line
against the real git and jq. `es-toolkit`'s `merge` does the same inside the app
(`Jsonball.merged`).

## The rules every file follows

1. **Every resource is written once, in both formats**: its jsonball, and a `.tsv` beside it
   with the same stem, legible in a diff. The quiz is one jsonball holding everything about it,
   questions included; its questions are also written alone (`questions.qq.json`, above) beside
   `questions.qq.tsv`, so the quiz's own table leaves the questions out rather than repeat them.
   A question edit therefore changes the quiz's `.tqq.json`, `questions.qq.json` and one line of
   `questions.qq.tsv`, and any other edit one JSON file and one table.
2. **JSON** is `UU.jsonify(ball, { pretty: true })`, keys sorted at every depth, with a trailing
   newline (`Huntfiles.jsonOf`).
3. **Every TSV reads the same way** (`src/lib/tsv.ts`, settled 2026-10-05): a header line of
   column names, then a line per row, `\n` line endings and a trailing newline. A row is a record
   flattened to its leaves, each column named by its dotted key path
   (`widgetings.dumdum.position`); columns are sorted, and rows sorted by their `label` column,
   which every table has, so that a reorder does not churn the diff (the order is still in the
   JSON's `position`s). Sorting is by code unit, never by locale. A collection is a row per
   member, labelled by its key; a single thing (the hunt, a quiz, a widget) is a header and one
   row, however wide. A review is a row per question it gave a verdict on, its `overall` left to
   its JSON.
4. **One line is one row.** A cell's tab, line break and carriage return are written `\t`, `\n`
   and `\r`, and its backslash `\\`, so no field breaks a row and the text reads back exactly.
   Nothing is quoted: a `"` is just a character. A list, or an empty object, is a cell of compact
   JSON; a null, or a field a row lacks, an empty cell. (This differs on purpose from Copy for
   Sheets, `src/lib/sheets.ts`, which writes a break as `<br/>` and a tab as a space for a paste
   into a spreadsheet: that is lossy, and the repository's tables are for reading diffs.)
5. **Paths follow addresses.** A resource sits at the repository path its URL names below the
   hunt, plus its pre-extension (`Addresses.filepathOf`): one key path makes the URL, the path
   and the jsonball's nesting, so the three cannot drift (`whiteboard/20261005-hunt_git/thread-0-addresses.md`,
   *The table*). Renaming a quiz renames its files, which real git follows as a rename by
   similarity once the repository is downloaded. That is all that is asked of renames: the
   repository is a backup, a history and a download, not a database. (isomorphic-git follows
   only renames that leave a file's contents byte-identical, and the app reads no history back,
   so nothing here leans on it.)
6. **The same resource writes the same bytes.** Every body is made from its resource alone,
   keys, columns and rows sorted, so a resource that has not changed writes files identical to
   the last, and committing the files that differ commits what changed.
7. **A deletion is a commit that removes the files.** The history keeps them, so a deleted quiz
   no longer leaves an orphaned repository behind.

## The index

| Resource | Rows it is made from | Jsonball, and where its piece sits | TSV |
|---|---|---|---|
| Hunt | `hunts` | `hunt.tqh.json`: `{ label, title, branch }` at the root | `hunt.tqh.tsv` (one row) |
| Categories | `hunts.wheel` | `categories.tqc.json`: `{ categories: { <label>: { position } } }`, every category, `position: null` for one in the pool | `categories.tqc.tsv` (a row per category) |
| Members | `huntings` | `members.tqm.json`: `{ members: { <ident_label>: { title, role } } }` | `members.tqm.tsv` (a row per member) |
| Quiz | `quizzes`, `questions` + `widgeteds`, `widgetings`, `columns` | `quizzes/<realm>/<quiz>.tqq.json`: `{ quizzes: { <realm>: { <quiz>: { title, smiths_note, q1_preamble, locked, questions, widgetings, columns } } } }`; each collection keyed by label with `position`, chains by label, each question with every widgeting's `{ status, value }` beside its fields | `<quiz>.tqq.tsv` (one row, questions left out) |
| Questions, alone | the same questions | `quizzes/<realm>/<quiz>/questions.qq.json`: `{ questions: { … } }`, rooted at the quiz, **not merged** | `questions.qq.tsv` (a row per question) |
| Review | `reviews` + `reviewings`, **shared only** | `quizzes/<realm>/<quiz>/reviews/<ident_label>.tqr.json`: `…<quiz>: { reviews: { <ident_label>: { overall, verdicts: { <question label>: { … } } } } }` | `<ident_label>.tqr.tsv` (a row per question) |
| Widget worked | `widgets` (the library's) | `widgets/<scope>/<label>.tqw.json`: `{ widgets: { <scope>: { <label>: { position, … } } } }`, as `Widget.exported` gives it, `position` its place in the library | `<label>.tqw.tsv` (one row) |

A `README.md` at the root (`Huntfiles.Readme`) says what the repository is, what each file
holds, how the tables read, and the `jq` line above. It names no hunt, so it is the same for
every hunt and never changes with one: written once, when the repository is made.

### Left out, on purpose

* **Ids**, `hunt_id`/`quiz_id` copies, `row_ordering` (the questions' `position`s carry it),
  and `last_sortkey`: these are bookkeeping, not content.
* **Widgeted history**: only the latest outcome per cell goes in, its `status` and `value`
  (`Exporting.quizBodyOf`). The repository's own history is the record of change.
* **Draft reviews**, a review's `phase` and a reviewing's `peeked`, and reviews whose reviewer
  is gone: only shared reviews are written, and a smith may not read the rest
  (`Approve.mayReadReview`).
* **Realms**: every hunt holds only `home`, so a realm's own title and position are not written.
  A realm written later wants a kind of its own (`realms.<realm>`), since `quizzes.<realm>` holds
  quizzes by label.
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
for the hunt-level files (hunt, members, categories, and the list of quizzes), and one per quiz
for its frame, its questions, and its shared reviews. A change re-runs only the queries whose
reads it touched, and Convex resends only their results.

Each watch's result becomes its files without the rest of the hunt: `Exporting`'s ball for each
resource (`huntBall`, `categoriesBall`, `membersBall`, `widgetBall`, and `quizBalls` for a quiz,
its questions alone and its shared reviews), handed to `Huntfiles.filesOf`.

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
