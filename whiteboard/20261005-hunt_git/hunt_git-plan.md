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

* The old per-quiz repositories under `/quizzes` are **never rewritten or deleted**. They stay
  listed and downloadable.
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
segment list, with the URL and the path both made from it. Thread 2 consumes it. If the Coach's
scheme gives a resource no page (members, columns, widgetings), the spec's file name under its
parent's directory stands.

### 2. A hunt's files, pure

*Proposed text:* Write the files a hunt's repository holds, as `notes/hunt_git.md` indexes them:
every resource once, as JSON and as TSV, at the path its address names. Pure functions only. No
filesystem, no wiring.

Gloss: a new `src/lib/huntgit.ts`, or `quizgit.ts` grown and renamed. Its heart is
`huntFiles(snapshot) → Map<path, body>`, plus two TSV writers (`recordTsv` for keypath/value,
`collectionTsv` for header and rows) that every resource shares. `questionsTsv` stays as it is
and becomes the questions resource. For keypath flattening, look in es-toolkit (`flattenObject`)
before writing a walker. Tests follow `quizgit.test.ts`: a snapshot in, an exact path set out,
each body checked, and a TSV round-trip through Papa Parse.
**Look-ahead:** the snapshot type defined here is what thread 3's query returns. Shape it as the
query will most naturally send it (the hunt whole, members, the wheel, shared reviews by quiz),
so thread 3 adds no conversion step.

### 3. A feed that sees the whole hunt

*Proposed text:* Feed the mirror from the whole hunt, not just the quiz on screen, for a smith:
every quiz, the members, the categories, and the shared reviews. Changes from any browser count.

Gloss: the choice to make is how to watch. **Recommended:** add a smith-only query function,
`hunts.mirror` (the name is the worker's to settle with `notes/queries_hooks_and_subscriptions.md`),
that returns thread 2's snapshot. Watch it once per tab, in place of the per-question watches
`useHistoryFeed` keeps today. It is the simplest thing that sees everything, and `hunts.whole`
already does most of the reading. Its cost is that Convex resends the whole result on every
change, so the thread's **first step is to measure** the payload for a large fixture hunt over a
burst of edits, and put the numbers in the progress document. If they are bad, the fallback is
to keep watching the open quiz and the hunt as today, and make a one-shot fetch of
`hunts.mirror` when the commit is due. Remote edits to other quizzes would then land in the next
commit or the next catch-up, rather than prompting one. Touches `convex/hunts.ts` (and
`convex/_generated/`, regenerated and committed), `convex/authorize.ts` (the affirm),
`src/state/use-hunt.ts`, and tests in `tests/convex/`. Name `/convex-reviewer` before marking it
ready.

### 4. One repository per hunt

*Proposed text:* Keep each hunt's history in one repository, written from thread 2's files and
fed by thread 3. Add a catch-up commit when a tab first reads a hunt. Milestones, imports and
deletions keep working.

Gloss: `/hunts/<hunt _id>`, on the one branch `main` (pending the Coach's word on versions). The
scheduler is keyed by hunt id instead of quiz id. Commit messages are the per-quiz summary lines
from the spec. Tags take the form `<quiz>/<version>/…`. `markedChange` and `milestoneQuiz` flush
the hunt. `openHistory` becomes the catch-up commit: write the tree, and commit only if it
differs from HEAD. That fixes today's gap, where edits made while this browser was away ride
along, mislabelled, in the next local commit, or are never committed. The e2e specs in
`quiz-history.spec.ts` that read refs and tags change to match.

### 5. Downloads and the hunts page

*Proposed text:* Download a hunt's whole history from the hunt (the hunts list and the quiz's
gear), named for the hunt. On the hunts page, the folded list shows the legacy per-quiz histories
and the hunt histories of hunts you are not on, each downloadable.

Gloss: `FullHistoryDownload` and `QuizManageModal`'s *Download as git* download the hunt's
repository. `OrphanedRepos` (PR #102) lists two kinds of repository with the same row:
`listRepos` gains a sibling for `/hunts`. `content/full-history.md` is rewritten for a hunt
repository. This thread could run before thread 4 only partly, so keep it stacked.

## For the Coach

1. **Quiz file: the whole quiz, or the quiz without its questions?** You asked for "the quiz as
   a file, and also the questions alone". The spec currently reads that as no duplication:
   `quiz.tq.json` holds the quiz's own fields, and questions, widgetings and columns each have a
   file of their own, so every edit lands in exactly one place. The other reading is that
   `quiz.tq.json` stays the whole quiz as Import reads it today, with the questions also written
   on their own. That keeps one-file restore at the cost of a questions edit diffing in two
   places. Under the split reading, restoring a quiz from its history means Import learning to
   read a quiz directory, which is a follow-up and not part of this sprint.
2. **Versions stop being branches.** One branch, `main`, per hunt repository. `version` becomes
   a field, and tags carry the quiz: `<quiz>/<version>/m-<stamp>`. Is that OK, or should versions
   keep meaning something to git?
3. **How the feed watches** (thread 3): one whole-hunt watch, measured first, with a commit-time
   fetch as the fallback. Is it OK to let the measurement decide?
4. **Reviews: shared only.** A smith's browser is the only one that keeps history, and it records
   the reviews a smith may read. Reviewers' own drafts are never recorded anywhere.
5. **Single-record TSV as keypath/value lines.** Rather than a one-row table that is too wide to
   diff. Is that OK?
6. **The URL scheme** is thread 1's text, and the paths in `notes/hunt_git.md` marked ⟨url⟩
   follow it.
