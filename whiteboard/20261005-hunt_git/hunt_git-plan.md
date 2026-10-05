# Hunt git: the new URL scheme, one repository per hunt, and one file format for the history, Import and Export

Sprint plan, 2026-10-05. Mode: **normal**. Review level: **medium**. At most **3** threads at
once. Issued by the Coach (Flip): "execute the plan for the new url scheme, git repo location,
and file format; modify the import and export so that their files have similar structure (and
use the same code). If my suggestions on the shape of the json files are unworkable or
cumbersome to rearrange, forgo it and do something more natural. Same with the urls."
**Status: done. Threads 0-6 landed (#121, #125, #126, #127, #128, #129, #130).** `hunt_git-progress.md`, beside this file, is newer than this plan wherever
the two disagree.

## Read first

Beyond CLAUDE.md and its auto-loads (`notes/stack.md`, `notes/testing.md`, `notes/convex.md`,
`notes/views.md`):

* `notes/decisions/urls.md` -- the Coach's URL scheme and serialized-file rules. This sprint
  builds it, with the departures under *Decisions taken*, below, which win where they differ.
* `notes/hunt_git.md` -- the spec for the hunt repository. Written before `urls.md` settled:
  where the two disagree on paths, file names or key paths, `urls.md` and *Decisions taken*
  win, and thread 3 brings `hunt_git.md` up to date.
* `notes/vocabulary.md` (*mirror*, *branch*, *label*) and `STYLE.md`, before naming anything.
* `notes/queries_hooks_and_subscriptions.md`, before thread 4 adds a query function or a watch.
* The code as it stands: `src/lib/routes.ts` and the routes under `src/app/(synced)/`;
  `src/lib/exporting.ts`, `src/lib/importing.ts`, `src/models/import.ts`,
  `src/components/panels/ExportImportPanel.tsx` and `LibraryForm.tsx`; `src/lib/quizgit.ts`,
  `src/state/quiz-mirror.ts`, `src/state/commit-scheduler.ts`, and `useHistoryFeed` in
  `src/state/use-hunt.ts`.

## Ground rules

`notes/git_hygiene.md` (*The spine*, *A thread, start to finish*, *Sprints*) and
`.claude/agents/thread-worker.md`. Particular to this sprint:

* **No schema change, no production migration.** Everything here is derived from rows that
  already exist. A thread that finds it needs one stops and reports `blocked`.
* **The per-quiz repositories under `/quizzes` get no special treatment**: no migration, and
  nothing new reads them. They are replaced, not kept beside.
* **Old addresses keep working**: `/h/...`, `/c/...` and `?act=` redirect to their new form,
  because people have links and bookmarks.
* **Old exports keep importing.** Raw Export has been people's backup; Import keeps reading the
  shapes it ever emitted, while every export emits the new one.
* The mirror stays fire-and-forget: a failure to commit is reported, never fails an edit.

## Decisions taken (departures from the Coach's sketch, under their licence)

1. **The realm slot shows the realm's own label, `home`**, not `a`: `a` breaks the Coach's own
   label rule (`/^[a-z](_?[a-z0-9])+$/` asks for two characters), and relabelling every realm
   would be a migration for no gain. `/~pat/spring_hunt/quizzes/home/legends`.
2. **`~{org}` is derived, not stored**: the ident label of the hunt's earliest smith (its
   maker). Hunt labels stay unique across the app, so the org segment is context, as the realm
   is (urls.md rule 6): an address with any other org redirects to the canonical one. Stored
   orgs, and hunt labels unique only within one, are a later change with a migration of their
   own.
3. **No array fields, as urls.md asks: every collection is an object keyed by label**, and
   where order matters (questions, widgetings, columns, the wheel's slots) each member carries
   a `position`. Arrays remain only where a value is itself a list (a widgeting's params may
   hold one).
4. **Quizzes have no stored order**, so a hunt rebuilt from its files lists them by label.
   *Settled by the Coach, 2026-10-05: "sorting quizzes by label is a good idea."*
5. **Modes** replace `?act=`: `!edit` is today's smith presentation, `!playtest` the review
   screen. Thread 1 decides what a bare quiz address does, holding to urls.md rule 4 where the
   app allows it, and records why.
6. **Futures stay future**: `.json` raw records, `@ref`/`@!sha` versions, `images/`,
   `/lib/widgets/{widget}` pages and single-category pages are not built. The address model
   leaves room for each.

## Threads

Thread 0 first; then 1 and 2 side by side; 3 after 2; 4 after 3; 5 after 4; 6 after 5 and 1.

### 0. One address model

*Coach's text (from the plan):* One function from a resource to its URL, its repository path
and its jsonball key path, so the three cannot drift.

Gloss: a pure module (`src/lib/addresses.ts`, or grown inside `routes.ts`) naming each
resource by its **label path**: the hunt (with its derived org), `quizzes/<realm>/<quiz>`,
`categories`, `members`, a quiz's reviews, the library's widgets. From one label path come the
URL (`/~org/hunt/quizzes/home/legends`, modes appended), the repository path (urls.md rule
10: drop `~{org}/{hunt}`, add the resource's pre-extension and `.json`), and the key path
(`['quizzes', 'home', 'legends']`), plus parsing the URL back. Each resource's pre-extension is
settled here (`.tqh` hunt, `.tqq` quiz, `.tqc` categories, `.tqm` members, `.tqr` review,
`.tqw` widget, and the questions-alone file, whose name the worker chooses). Unit tests only; no
caller changes. Depends on: nothing. **Look-ahead:** threads 1, 2 and 3 all build on it, so
shape it for all three; derive the org from data a screen already has (the hunt's members).

### 1. The URL scheme

*Coach's text:* "execute the plan for the new url scheme ... If my suggestions ... are
unworkable or cumbersome ... do something more natural. Same with the urls."

Gloss: the routes under `src/app/(synced)/` move to `/~{org}/{hunt}`, `/~{org}/{hunt}/quizzes`,
`/~{org}/{hunt}/quizzes/{realm}/{quiz}/!{mode}`, `/~{org}/{hunt}/categories`, and `/~{org}`
for an org's hunts (the visitor's own hunts page may stay where it is, or become their org's:
the worker's call, recorded). Every `Routes.*Path` caller goes through thread 0's model.
Redirects from `/h/...`, `/c/...` and `?act=`, and from a wrong org or a stale realm. Next's
App Router takes a `~` and a `!` in a dynamic segment's value; prefer that to middleware.
e2e specs that assert addresses (`NewHuntUrl`, `routing.spec.ts`, `categories.spec.ts`) move
with it. Depends on: 0. **Look-ahead:** thread 6 links to hunts and quizzes from the downloads;
keep `Routes` the only writer of an address.

### 2. Jsonballs, and Import and Export through them

*Coach's text:* "Modify the import and export so that their files have similar structure (and
use the same code)."

Gloss: the jsonball for every resource, keyed by label at the key path thread 0 gives it, so
that deep-merging any set of them is the hunt (Decision 3); and Export and Import go through
the same code. Raw Export emits the hunt (or the quiz) as one merged jsonball; Import reads a
merged ball, any single resource's ball, the questions-alone list, and every older export
shape; the library's export and import do the same for widgets (`{ widgets: { <scope>: {
<label>: ... } } }`). One module owns the shapes and their validators (`src/lib/jsonball.ts`, or
`exporting.ts` and `importing.ts` reworked around one); `es-toolkit`'s `merge` is the deep
merge. The defining test: merging every resource's ball gives back the whole, and importing
the export of a quiz into an empty one reproduces it. Depends on: 0. **Look-ahead:** thread 3
writes these same balls as files, unchanged; thread 4's queries return exactly what each
ball is made from.

### 3. A hunt's files

*Coach's text (from the plan):* Write the files a hunt's repository holds: each resource once,
as its jsonball and as a TSV, at the path its address names. Pure functions only.

Gloss: `huntFiles(snapshot) → Map<path, body>`, and one function per resource, from thread 2's
balls at thread 0's paths; one TSV writer for all (a header of sorted keypaths, a row per item
sorted by label; a single record is one row); the questions-alone file, outside the merge;
a `README.md` written once, with the `jq` line that merges the balls. Brings
`notes/hunt_git.md` up to date with urls.md and the decisions here. Tests against the real
git CLI as `tests/lib/quizgit.test.ts` does, and `merge` over the `.json` balls reconstitutes
the snapshot. Depends on: 2.

### 4. Watches at the grain of the files

*Coach's text (from the plan):* Feed the mirror from the whole hunt, for a smith, through
watches at the grain of the files: the hunt-level files, and per quiz its frame, its questions
and its shared reviews. Changes from any browser count.

Gloss: as `hunt_git-plan`'s earlier draft had it: query functions sized to the files (reuse
what screens already watch where the shapes match), a feed that follows the quiz list,
opening and closing per-quiz watches; measure subscription count and payload for a large
fixture hunt and record the numbers. Touches `convex/` (regenerate and commit
`convex/_generated/`), `convex/authorize.ts`, `src/state/`. Name `/convex-reviewer` before
reporting ready. Depends on: 3.

### 5. One repository per hunt

*Coach's text (from the plan):* Keep each hunt's history in one repository, on the branch the
hunt names, committing only the files that changed, with a catch-up commit on a tab's first
full reading. Milestones, imports and deletions keep working.

Gloss: `/hunts/<hunt _id>` in the browser's filesystem; the scheduler keyed by hunt, holding
dirty files; commit messages summarised per quiz; tags following the label rule (urls.md: a
`@ref` names them); `quizgit.ts` and `quiz-mirror.ts` replaced. Depends on: 4.
~~Which files changed between readings~~ and ~~the first-full-reading signal~~: pulled forward
by thread 4 (`Huntfiles.changesBetween`, `HuntReadingT.first`).

### 6. Downloads and the hunts page

*Coach's text (from the plan):* Download a hunt's whole history, named for the hunt, from the
hunt's page and the quiz's gear. On the hunts page, the folded list shows the hunt repositories
this browser holds for hunts you are not on.

Gloss: ~~`FullHistoryDownload`, the gear's *Download as git*~~ (pulled forward by thread 5),
`OrphanedRepos` and `QuizNotFound`'s list read `/hunts`; `/quizzes` is not read at all. `src/content/full-history.md`
is rewritten for a hunt repository, `jq` line included. Depends on: 5 and 1.

## For the Coach

1. ~~**Quiz order**~~ -- settled: quizzes sort by label (Decision 4). No stored `position`.
2. The departures under *Decisions taken*: the realm slot, the derived org, keyed collections
   with `position`, and what is left for later.
