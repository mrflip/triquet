# Hunt git: one history repository per hunt, every resource in JSON and TSV, paths that match addresses

Sprint plan, 2026-10-05. Mode: **to be set**. Review level: **medium** unless the Coach says
otherwise. Issued by the Coach (Flip).
**Status: draft. Not started.** This is waiting on the Coach's URL scheme (thread 1) and the
answers under *For the Coach*. No `-progress.md` exists yet; it is seeded when the sprint starts.

The spec is `notes/hunt_git.md`: the index of resources and paths, the file rules, and the
commit, branch and tag design. This plan is the order in which to build it.

## Read first

Beyond CLAUDE.md and its auto-loads:

* `notes/hunt_git.md`, the spec, in full.
* `notes/vocabulary.md` (*mirror*) and `STYLE.md`, before naming anything.
* `notes/queries_hooks_and_subscriptions.md`, before thread 3 adds a query function or a watch.
* `src/lib/quizgit.ts`, `src/state/quiz-mirror.ts`, `src/state/commit-scheduler.ts`, and
  `useHistoryFeed` in `src/state/use-hunt.ts`: the per-quiz mirror as it stands.
* `src/lib/exporting.ts` and `src/lib/exposure.ts`: the existing JSON and TSV shapes, which the
  new files grow out of.
* `tests/lib/quizgit.test.ts`: the way the mirror is tested, against the real git CLI.

## Ground rules

`notes/git_hygiene.md` (*A thread, start to finish*, *Sprints*) and
`.claude/agents/thread-worker.md`. Particular to this sprint:

* The old per-quiz repositories under `/quizzes` get no special treatment: no migration, and
  nothing new reads them.
* The mirror stays fire-and-forget. A failure to commit is reported (`Postmortem.report`) and
  never fails an edit.
* Nothing reads app state back from a repository.

## Threads

Stacked in this order. Each depends on the one before, unless marked otherwise.

### 1. The URL scheme

*Coach's text: to come.*

Gloss: this thread is first because rule 4 of the spec (paths follow addresses) wants a single
function from a resource to both its URL and its repository path. Thread 2 calls that function,
rather than inventing paths that thread 1 would then move. This probably touches
`src/lib/routes.ts`, the route directories under `src/app/(synced)/`, every `Routes.*Path`
caller, and the e2e specs that assert URLs (`NewHuntUrl` in `e2e/support.ts`, `routing.spec.ts`).
**Look-ahead:** export a `repoPathOf(resource)` (name to taste) beside the URL builders: one
label path, from which the URL, the repository path and the jsonball's key path are all made. Thread 2 consumes it. If the Coach's
scheme gives a resource no page (members, columns, widgetings), the spec's file name under its
parent's directory stands.

### 2. A hunt's files, pure

*Proposed text:* Write the files a hunt's repository holds, as `notes/hunt_git.md` indexes them:
each resource once, as a jsonball rooted at the hunt and as a TSV, at the path its address
names. Pure functions only. No filesystem, no wiring.

Gloss: a new `src/lib/huntgit.ts`, holding one function per resource from its query's result
to its files (thread 3's watches call these one by one), and `huntFiles` over them all for the
catch-up commit. Two TSV writers are shared by every resource: `recordTsv` (keypath/value) and
`collectionTsv` (header and rows). `questionsTsv` stays as it is. For keypath flattening, look
in es-toolkit (`flattenObject`) before writing a walker. **The defining test:** es-toolkit's
`merge` over every jsonball reconstitutes the snapshot (labels in place of ids), and no array
is contributed to by two files. Tests also check an exact path set, each body, and a TSV
round-trip through Papa Parse.
**Look-ahead:** each per-resource function takes exactly what thread 3's query for that grain
returns, so there is no conversion step between them.

### 3. Watches at the grain of the files

*Proposed text:* Feed the mirror from the whole hunt, for a smith, through watches at the
grain of the files: the hunt-level files, and per quiz its frame, its questions and its shared
reviews. Changes from any browser count.

Gloss: the query functions, sized to the files: a hunt-level one (hunt, members, wheel, realms,
quiz list), and per quiz the frame (`quizzes.open` may already serve), the questions whole in
one result rather than a watch per question, and the shared reviews with their verdicts. Settle
the names with `notes/queries_hooks_and_subscriptions.md`, and reuse what the screens already
watch where the shapes match. The feed follows the quiz list as `useHistoryFeed` follows
`row_ordering` today, opening and closing per-quiz watches. **Measure** subscription count and
payload for a large fixture hunt over a burst of edits, and put the numbers in the progress
document. Touches `convex/` (and `convex/_generated/`, regenerated and committed),
`convex/authorize.ts`, `src/state/use-hunt.ts` (or a hook of its own beside it), and tests in
`tests/convex/`. Name `/convex-reviewer` before marking it ready.

### 4. One repository per hunt

*Proposed text:* Keep each hunt's history in one repository, on `main`, committing only the
files that changed, with a catch-up commit on a tab's first full reading. Milestones, imports
and deletions keep working, with tags that name the quiz.

Gloss: the repository sits at `/hunts/<hunt _id>` in the browser's filesystem (not user-facing;
the id keeps a relabel from moving or stranding it). The scheduler is keyed by hunt id and holds
a dirty-file set, not a pair of snapshots. Commit messages are the per-quiz summary lines from the spec.
Tags take the form `<quiz>/<version>/…`. `markedChange` and `milestoneQuiz` flush the hunt.
`openHistory` becomes the catch-up commit (`git.hashBlob` against HEAD's tree). The per-quiz
code in `quizgit.ts` and `quiz-mirror.ts` is replaced, not kept beside the new code. The e2e
specs in `quiz-history.spec.ts` that read refs and tags change to match.

### 5. Downloads and the hunts page

*Proposed text:* Download a hunt's whole history from the hunt (the hunts list and the quiz's
gear), named for the hunt. On the hunts page, the folded list shows the hunt repositories this
browser holds for hunts you are not on, each downloadable.

Gloss: `FullHistoryDownload` and `QuizManageModal`'s *Download as git* download the hunt's
repository. `OrphanedRepos` (PR #102) lists `/hunts` repositories whose id is not one of your
hunts', each by the hunt label its `hunt.tq.json` holds. `/quizzes` is not read at all. `content/full-history.md` is rewritten for a hunt
repository, `jq` line included.

## For the Coach

Settled on 2026-10-05: no special treatment for the per-quiz repositories; scoped by label;
the quiz as one jsonball, with its questions as a jsonball of their own; jsonballs rooted at
the hunt, so that a deep merge reconstitutes it; watches and commits at the grain of the files;
renames need only be followed by the real git CLI, and the browser filesystem's own paths are
not user-facing.

1. **Collections as keyed objects, not arrays** (`{ realms: { home: { quizzes: { … } } } }`).
   That is a refinement of your sketch: it is what lets any merge tool reconstitute the hunt
   without knowing that elements are matched by label. Quizzes have no stored order, so a
   reconstituted realm lists them by label. Is that OK?
2. **Versions stop being branches.** One branch, `main`. `version` becomes a field, and tags
   carry the quiz: `<quiz>/<version>/m-<stamp>`. Is that OK?
3. **Reviews: shared only.** Only a smith's browser keeps history, and it records the reviews a
   smith may read.
4. **Anything else as keypath/value TSV lines**, rather than a one-row table too wide to diff.
5. **The URL scheme** is thread 1's text. The paths marked ⟨url⟩ in `notes/hunt_git.md` follow
   it.
