# A hunt's git repository

The **mirror** (`notes/vocabulary.md`) is one git repository per hunt. This file is the index of
what such a repository holds and where, and how it is kept. It was the spec for the `hunt_git`
sprint, whose plan is `whiteboard/20261005-hunt_git/hunt_git-plan.md`.

**Status (2026-10-05): built.** `src/lib/huntfiles.ts` (`Huntfiles`) writes every file below from
a hunt's snapshot, and one resource's files from that resource alone; `src/state/hunt-feed.ts`
reads them from watches; `src/state/hunt-mirror.ts` commits them, after a wait
(`src/state/commit-scheduler.ts`), to the hunt's repository (`src/lib/huntgit.ts`), each commit
written and named by `src/state/hunt-commits.ts` (*Watching and committing, by file*, below).
Paths follow `notes/decisions/urls.md` (rule 10, with the realm written `home`), through
`src/lib/addresses.ts`. The per-quiz repositories of before (`/quizzes/<quiz _id>`) get **no
special treatment**: there is no migration, and nothing writes or reads them; a browser that held
them still holds them, unlisted.

## Downloading, and finding a history again

A hunt's history downloads as `<hunt label>.zip` (`HuntMirror.downloadHuntRepo`), from the hunt's
own page, the quiz's gear (*Download as git*) and the Full History tab, each with a pointer to
what one does with it (`src/content/full-history.md`). Anything waiting to be committed is
committed first. The hunt's own page runs no feed, so its download is the history as this
browser last recorded it.

Every repository this browser holds is listed by walking `/hunts` (`Huntgit.listHuntRepos`), each
named by the `label` in its `hunt.tqh.json` at the tip, since the directory is only the hunt's
id: on the hunts page, folded away, those of hunts the visitor is not on (`OrphanedRepos`: a
deleted hunt's, or one another visitor of this browser works on); and on a missing quiz's page,
every one (`QuizNotFound`), a hunt the visitor is on linking to its page. A repository of a hunt
the visitor is not on has no page to link to, and is named by its label alone.

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
// quizzes/home/legends.tqq.json -- the whole quiz, its questions included, the archived among them
{ "quizzes": { "home": { "legends": { "title": "…", "locked": false, "last_sortkey": "column:title", "created_at": "2026-10-05T09:30:00.000Z", "updated_at": "…", "questions": { "leon": { "position": 0, "viz": "normal", … } }, "widgetings": { … }, "columns": { … } } } } }
// quizzes/home/legends/questions.qq.json -- the exception: the questions alone, but the archived, rooted at the quiz, not merged
{ "questions": { "leon": { "position": 0, "qnum": "1", "clueing": "…", "chains_to": "nantes", "viz": "normal", "created_at": "…", "updated_at": "…", "dumdum": { "status": "ok", "value": … } }, … } }
```

**The one exception is a quiz's questions alone**, `questions.qq.json`, beside the quiz's own
file in a directory named for it. It holds the questions a second time, on purpose, as the
quiz's ball holds them but rooted at the quiz, naming no quiz, so it pastes straight into any
quiz's Import. Its `.qq` pre-extension keeps it out of the `*.tq?.json` merge. It leaves the
archived questions out, as every export handed on does, and so does its table; the quiz's own
ball keeps them, each with its `viz`, so the merge is the quiz whole.

**Stamps** (`created_at`, `updated_at`) are written as ISO-8601 in UTC wherever a row carries
them: the hunt's own, each quiz's and question's, each shared review's and verdict's. Since they
move with every edit of their row, they change a file whenever anything else in it does; the
first commit after they arrived changed every file once. A commit message names what an edit
changed and never the stamps (`Changes`).

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
3. **Every TSV reads the same way** (`src/lib/tsv.ts`; the rules are
   `notes/decisions/tsv-formats.md`): a header line of column names, then a line per row, `\n`
   line endings and a trailing newline. A row is a record flattened to its leaves, each column
   named by its dotted key path with no prefix added (`columns.title.width_px`, a question's
   `clueing` and `dumdum.status`); a bag opens only down to the level whose shape our schema fixes
   and which is not a union, so what a widgeting came to (its `value`), a widgeting's `params`
   and a widget's `config` are each one cell of JSON (`Huntfiles`' `WholesFor`). Columns are
   sorted, and rows sorted by their `label` column, which every table has, so that a reorder does
   not churn the diff (the order is still in the JSON's `position`s). Sorting is by code unit,
   never by locale. A collection is a row per member, labelled by its key; a single thing (the
   hunt, a quiz, a widget) is a header and one row, however wide. A review is a row per question
   it gave a verdict on, its `overall` left to its JSON.
4. **One line is one row.** A string cell is written as JSON encodes a string, without the quotes
   and without escaping `"`: a backslash, tab, line break, carriage return or other control
   character is its escape (`\\`, `\t`, `\n`, `\r`, `\u0001`), and everything else, `"` and
   non-ASCII included, is itself. A number is its decimal text and a boolean `true` or `false`,
   never escaped; a list, or a bag not opened, is compact JSON, not escaped again; null, a field
   the row lacks and an empty string are an empty cell. A column's name is escaped as a string
   cell is. (This differs on purpose from Copy for Sheets, `src/lib/sheets.ts`, which writes a
   break as `<br/>` and a tab as a space for a paste into a spreadsheet: that is lossy, and the
   repository's tables are for reading diffs.)
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
| Hunt | `hunts` | `hunt.tqh.json`: `{ label, title, branch, created_at, updated_at }` at the root | `hunt.tqh.tsv` (one row) |
| Categories | `hunts.wheel` | `categories.tqc.json`: `{ categories: { <label>: { position } } }`, every category, `position: null` for one in the pool | `categories.tqc.tsv` (a row per category) |
| Members | `huntings` | `members.tqm.json`: `{ members: { <ident_label>: { title, role } } }` | `members.tqm.tsv` (a row per member) |
| Quiz | `quizzes`, `questions` + `widgeteds`, `widgetings`, `columns` | `quizzes/<realm>/<quiz>.tqq.json`: `{ quizzes: { <realm>: { <quiz>: { title, smiths_note, q1_preamble, locked, last_sortkey, created_at, updated_at, questions, widgetings, columns } } } }`; each collection keyed by label with `position`, chains by label, every question (the archived too) with its `viz` and stamps, and every widgeting's `{ status, value }` beside its fields | `<quiz>.tqq.tsv` (one row, questions left out) |
| Questions, alone | the same questions, **but the archived** | `quizzes/<realm>/<quiz>/questions.qq.json`: `{ questions: { … } }`, rooted at the quiz, **not merged**, each `position` among those it holds | `questions.qq.tsv` (a row per question) |
| Review | `reviews` + `reviewings`, **shared only** | `quizzes/<realm>/<quiz>/reviews/<ident_label>.tqr.json`: `…<quiz>: { reviews: { <ident_label>: { overall, created_at, updated_at, verdicts: { <question label>: { …, created_at, updated_at } } } } }` | `<ident_label>.tqr.tsv` (a row per question) |
| Widget worked | `widgets` (the library's) | `<scope>/widgets/<label>.tqw.json` (`pub/widgets/dumdum.tqw.json`, at the path of its address, `/pub/widgets/dumdum`): `{ <scope>: { widgets: { <label>: { position, … } } } }`, as `Widget.exported` gives it, `position` its place in the library | `<label>.tqw.tsv` (one row, its `config` one cell of JSON) |

A `README.md` at the root (`Huntfiles.Readme`) says what the repository is, what each file
holds, how the tables read, and the `jq` line above. It names no hunt, so it is the same for
every hunt and never changes with one: written once, when the repository is made.

### Left out, on purpose

* **Ids**, `hunt_id`/`quiz_id` copies, and `row_ordering` (the questions' `position`s carry
  it): these are bookkeeping, not content. Every other field a quiz, a column or a widgeting
  stores is written, its sort memory (`last_sortkey`) and a column's alignment among them.
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

## Reading a ball back in

The quiz's Import reads any of these balls, any merge of them, and every older export's shape
(`Importing.importInto`, whose doc block is the rule). One quiz (a quiz's ball, its questions
alone, a bare list) is read into the quiz it is pasted into. A hunt (Raw Export, a merge of
several quizzes' balls) is read for its quiz matching that one, by label and then by title; a
hunt matching neither sends its first quiz to the quiz of its label in the hunt, made for it if
need be, which reads it as it opens (hunt_git thread 8). It carries the whole quiz; into a quiz
that already holds things, each part does this (decided 2026-10-05, hunt_git thread 7):

| Part | Into a quiz holding its own |
|---|---|
| Questions | Merged by label: a field the paste holds replaces, a null clears, an absent one stays; a new label is added at the end. None is removed. A question's `viz` is carried (null making it normal); its stamps are not: an import's writes are stamped as they are made. Once a question comes in, the quiz's untouched blank questions (blank, never edited, nothing in their cells) are archived. |
| Widgetings | Merged by label: one the quiz lacks is added (last, in the paste's order), one it holds has its description and params replaced. None is removed (its cells hold what was asked and typed), and the quiz's run order stands. |
| Columns | **Replaced**: the quiz's columns become the paste's, each added or revised (title, source, width, alignment) and put in the paste's order, and one the paste lacks removed, unless a pasted column could not be read. A paste holding no columns (the questions alone, a bare list, an export from before columns were exported) leaves them. |
| Title, smith's note, Q1 preamble | Replaced where the paste holds one (a null note clears it), kept where it does not. |
| Sort memory | Kept by the quiz, unless it held no questions: then its order is the paste's, and so is its memory. |
| Lock | Never read: an import neither locks nor unlocks. |

Importing a quiz's export into an empty quiz reproduces it whole (`tests/convex/hunts.test.ts`,
*a quiz's export, imported into an empty quiz*).

## Branches

**The branch belongs to the hunt** (settled 2026-10-05). What the code called a quiz's
`version` is renamed `branch` and moved to the hunt: `notes/decisions/urls.md` has a version
name the state of the whole hunt (`{hunt}@{ref}`), and the hunt's own page is where it is set.
One hunt, one branch at a time, so a hunt repository is on exactly the branch the hunt names:

* **Changing the hunt's branch starts or joins a git branch, as a quiz's version did.** A new
  name branches from the current tip, and a name the history has seen checks that branch out
  again. Every commit goes to the hunt's branch.
* **Tags follow the label rule**, since `@{ref}` names them (`Huntgit.tagFor`):
  `<branch>_<quiz>_<mark>_<stamp>z`, as `main_legends_m_20261005120000z`. The branch leads, so a
  branch's tags list together; the quiz the moment was marked from follows, so one quiz's
  milestones are told apart from another's in the hunt's one repository (`git tag -l
  'main_legends_*'`); the mark says what the moment was (`m` a milestone, `import` an import
  merged in, `delete` questions deleted); the stamp is the UTC second as fourteen digits and a
  `z`, so tags sort as text in time order. A second tag in the same second takes `_2`, `_3`. Since
  a branch and a quiz label may each hold underscores, a tag is a name to read, not a key to
  parse; and it runs past a label's 40 characters when both are long, which the rule's shape
  allows.

## Watching and committing, by file

The feed (`watchHunt`, and `useHuntFeed` around it, in `src/state/hunt-feed.ts`) reads **at the
grain of the files**, for a smith only (`Question.isSentWhole`): the hunt, the library and the
quiz on screen by watches, every other quiz by fetches when its change signal moves.

| Read | Query function | Files it writes |
|---|---|---|
| The hunt, and the list of its quizzes: a watch | `hunts.open` | `hunt.tqh`, `categories.tqc`, `members.tqm` |
| The library, whole: a watch | `widgets.library` | each `pub/widgets/<label>.tqw` a quiz works (a widget's `position` is its place in the whole library) |
| The quiz on screen: its frame, a watch per question, and its reviews | `quizzes.open`, `questions.open`, `reviews.forQuiz` | `<quiz>.tqq`, `<quiz>/questions.qq`, `<quiz>/reviews/<reviewer>.tqr` (shared ones only), through the screen's own subscriptions |
| Every quiz's change signal: one watch | `quizzes.signals` (smiths only) | none: it says which quiz to fetch |
| Each quiz not on screen, whole, and its reviews: fetches | `quizzes.whole` (smiths only), `reviews.forQuiz` | the same as the quiz on screen's |

Every watch is sent the affirms the screen sends, so one the screen also holds is one
subscription, and an author's edit to the quiz on screen arrives as the one question. The feed
follows the quiz list, reading a quiz as it is listed and letting it go as it goes, and moves the
quiz on screen between the two ways of reading it as the screen moves (`focus`); a quiz the
screen leaves starts from what the screen last read of it, and is not fetched until its signal
moves. A quiz's files depend on the library and the hunt's wheel as well as the quiz (its run), so
a change to either makes every quiz's files again, from what was last read of each; only the
bodies that differ are new.

**A quiz not on screen is fetched, not watched**, since Convex bills each rerun of a watched query
and what it reads, and a watch of a quiz whole is rerun and resent at every write to it (a bot's
every answer) in every smith's tab. Instead (`src/state/hunt-fetching.ts`):

* **Each quiz has a change signal** (`signals`, a table of one small row per quiz,
  `src/models/signal.ts`), moved by a trigger at each write to the quiz or anything its files are
  made from: its questions, widgetings, columns, what its widgetings stored, and its shared reviews
  and their verdicts (a draft's writes move nothing, so its smiths learn nothing of a draft). A
  write within `SignalGrainMs` (5 s) of the last move leaves it standing (`convex/signalling.ts`).
  Never the quiz row itself, whose every reader (the screen's frame) would then rerun at every
  write.
* **One watch of every quiz's signal** (`quizzes.signals`), for a smith of the hunt alone.
* **A quiz is fetched** (`quizzes.whole` and its `reviews.forQuiz`, `client.query`) at once the
  first time, then only once its signal moves, and **at most once every `Pace.fetchEveryMs`**
  (90 s): a burst of writes costs a fetch or two, and the history lags a change by that much at
  most. A signal seen to move is waited out `Pace.settleMs` (8 s: the grain and a write's landing)
  before a fetch is trusted to hold everything it stands for; one begun sooner is followed by
  another. A signal that never stops moving still has its quiz fetched once a window.
* **A hidden tab fetches nothing**; shown again, it fetches what moved meanwhile at once.
* **Waiting on the feed to be read** (a milestone, an import, a deletion) fetches at once every
  quiz whose signal has moved, so a tag lands on a commit holding what this browser has seen.
* **A quiz not on screen is read only once the page has loaded and the browser is idle**
  (`requestIdleCallback`, `IdleWaitMs` at the latest), so the screen's own reads come first; so the
  first reading, and the catch-up commit, wait for that too, and waiting on the feed reads them at
  once. Nothing is read again as the page unloads.

Times are this browser's own, measured from when it saw a signal move, so another clock's skew
does not enter, but once: a signal heard for the first time is dated by its own time, allowing
this clock `Pace.clockSlackMs` (10 minutes) of skew. A browser whose clock runs further ahead than
that could miss the last few seconds of writes to a quiz being written to as it loads, until the
quiz is next written to.

Each part's files are made from its watches alone (`huntPartOf`, `quizPartOf`, `widgetsPartOf`,
over `Exporting.huntLevelBalls`, `quizBallsIn` and `workedBalls`, handed to `Huntfiles.filesOf`),
and a reading (`HuntReadingT`) hands on every part, keyed (`hunt`, each quiz's id, `widgets`), and
all the files together. The first reading comes once every listed quiz has answered (below), and
says so (`first`); after it, a reading comes at each change that writes a file differently, a part
unchanged being the same object as before. `Huntfiles.changesBetween` says which files to write
and which to remove. What it costs on a large hunt is measured in
`whiteboard/20261005-hunt_git/thread-4-measured.md`, and with the change signal in
`whiteboard/20261005-hunt_git/thread-9-change_signal.md`.

* **One repository per hunt** at `/hunts/<hunt _id>` in the browser's filesystem (LightningFS,
  named `triquet-quizzes` for the per-quiz repositories it first held), so relabelling a hunt
  neither moves nor strands its history. Every commit goes to the branch the hunt names; a new
  name branches from the tip, and a name seen before is checked out again.
* **Dirty files, not whole trees.** The scheduler (`createCommitScheduler`) holds, per hunt, the
  reading its wait began from and the latest; at commit, the files that differ between them
  (`Huntfiles.changesBetween`) are written and removed, and each one's blob is compared with the
  branch's tip (`git.hashBlob`), so only what differs from the tip is committed, and nothing at
  all when it holds them already (another tab of this browser committed it first).
* **One clock per hunt.** The first change starts the wait, and later changes do not restart
  it. The wait is `NEXT_PUBLIC_TRIQUET_COMMIT_DEBOUNCE_SECONDS` (30 by default, 2 in the e2e
  suite).
* **Off the edit's path.** The feed makes each reading when the browser is next idle (2 s at the
  latest), not as the change arrives: making every quiz's files, which a change to the library,
  the wheel or the hunt's title asks, takes most of a second on a large hunt
  (`whiteboard/20261005-hunt_git/thread-4-measured.md`). The git work is asynchronous, after the
  wait. A failure to commit is reported (`Postmortem`), never fails an edit.
* **Consistency.** The Convex client applies every subscribed query's new result at one
  timestamp, and a quiz's fetch reads it and its reviews together, so no quiz's files mix two
  moments; but quizzes fetched at different times stand as of different moments, a minute or two
  apart at most. A new watch or fetch (a new quiz, or a question just added) reports a moment
  later, and until it has reported, its files are neither written nor removed.
* **The message is a line per part that moved**, joined on one line while it fits 72 characters,
  else the first line and a count, with every line below (`HuntCommits.messageFor`): the hunt's
  own files (`~hunt ~members`), each quiz by label with `Changes.shorthandLines` for what moved in
  it and its reviews (`legends: quiz ~title, leon +clueing, reviews ~lee_jones`), a quiz arriving
  or leaving as `+legends` or `-legends`, and the widgets (`widgets ~dumdum`). A quiz whose files
  moved only because what it runs on did has no line of its own.
* **Catch-up on a tab's first full reading.** A feed's first reading is committed at once,
  whole: whatever differs from the tip is committed, as `start: the hunt as this browser first
  read it` for a repository with no history, `catch up: changes made while this browser was
  away` for one under way, or, for a tab whose feed started over on a hunt it read before, by
  what moved since that reading. Without it, changes made elsewhere while this browser was away
  would ride along, mislabelled, in the next local commit. The README is written by the first
  commit, and never again. One feed serves every screen of a hunt, and is kept 10 s after the
  last lets go, so moving between the hunt's quizzes moves the feed rather than starting it over.
* **A quiz that cannot be read never stalls the hunt, nor loses its files.** The first reading
  waits for every listed quiz to answer: read whole, or found unreadable (its watch or fetch
  failed, or answered nothing while listed). An unreadable quiz is handed on as `unread`, with no files, and
  the catch-up keeps whatever files the tip has for it (`Huntfiles.isQuizFile`) rather than
  reading it as removed; once it can be read, it joins as `legends: caught up`. A quiz read before
  whose watch or fetch then fails stands as last read; a failing fetch is tried again a window on.
* **Taking up a branch** commits what was waiting to the branch it was done on, then the hunt
  whole to the new one, as `catch up: the hunt as it stands, on taking up branch <branch>`.
* **Milestones, imports and deletions.** A milestone flushes the hunt's waiting changes, after
  waiting (5 s at most) for the feed to hear from every watch it holds, then tags the tip. An
  import or a deletion of questions commits what was waiting, applies the change, commits it
  (waiting the same way, since the questions it adds arrive on watches opened as it lands), and
  tags that commit. A deleted quiz is a commit removing its files; the history keeps them.
