# 2026-10-05: Sprint hunt_git done -- eight threads, eight PRs open on top of #119

* **The sprint.** Hunts and quizzes live at `/~org/hunt/quizzes/home/quiz/!edit` (old addresses
  move there); every resource is a jsonball keyed by label, which Raw Export, Import and the
  history all share; each hunt's history is one git repository, on the hunt's branch, holding
  each resource as `.json` and `.tsv` at the path its address names, committing only what
  changed, from watches that hear every browser's edits. The hunts page, a missing quiz's page
  and the hunt's own page list and download hunt histories; nothing reads the old per-quiz
  repositories. Plan, progress and every thread's file: `whiteboard/20261005-hunt_git/`. Live
  mirror: the *Sprint hunt_git* Claude Doc.
* **Open, in order** (each stacked on the one before; land #133 to take them all, or one at a time):
  1. **#121** -- thread 0, one address model (`Addresses`). Stacked on #119.
  2. **#125** -- thread 1, the URL scheme.
  3. **#126** -- thread 2, jsonballs, and Import and Export through them.
     **Merge only after the production check** of widgetings labelled `position` comes back
     empty, or its hits are relabelled (the command is in chat).
  4. **#127** -- thread 3, a hunt's files (`Huntfiles`, `Tsv`).
  5. **#128** -- thread 4, watches at the grain of the files (`quizzes.whole`, `useHuntFeed`).
  6. **#129** -- thread 5, one repository per hunt (`Huntgit`, `HuntMirror`).
  7. **#130** -- thread 6, downloads and the hunts page.
  8. **#133** -- thread 7, your follow-ups: the stored `orglabel` (a schema **widen**: after
     merging, run `migrations:runAll` on production, dry run first, then a tighten PR follows),
     hunt labels unique within an org, the bare quiz address by role, quiz lists by label, Import
     carrying the whole quiz, the tables per `notes/decisions/tsv-formats.md`, widgets at
     `/pub/widgets/<label>`, off-screen watches opened after load.
* **Beneath them**: #118 (the Switch branch button on a phone) and #119 (the tightening of
  #115: merge only once `migrations:runAll` has finished on production).
* **Reviews**: threads 0, 1 and 6 clean; 3, 4 and 5 kept one fix each (a TSV header's escaping;
  a failing watch reported once; a milestone settling its feeds); thread 2 flagged the `position`
  reservation, which you decided (keep it, check production).
* **Decisions taken under your licence** (the plan's *Decisions taken*): the realm slot reads
  `home`, not `a`; `~org` is derived from the hunt's members, not stored; collections are objects
  keyed by label with a `position` where order matters; quizzes sort by label (you agreed);
  `!edit`/`!playtest` replace `?act=`; a bare quiz address opens `!playtest` for everyone.
* **Open questions** (none blocking; each also in its PR, thread file and the progress document;
  the orchestrator's recommendation in brackets):
  - The org: the earliest current smith (as built) or the earliest member whatever their role?
    [earliest member: a demotion never moves the address] (#121, #125)
  - A widget's URL keeps its scope, `/lib/widgets/pub/<label>`? [keep] (#121)
  - A bare quiz link opens `!playtest` for a smith too, where opening it inserts an empty,
    unshared review row. [keep the rule; open a review on its first write instead] (#125)
  - Should the app's own quiz lists sort by label, like the files? [yes]
  - Should Import carry a pasted quiz's columns, title and note? [yes, later] Raw Export for one
    quiz alone? [either] (#126)
  - A review's table a row per question [yes]; the quiz's 141-column one-row table [keep]; TSV
    escapes in a spreadsheet [as built]. (#127)
  - `quizzes.whole` per off-screen quiz (86 KB per edit, 82 subscriptions on a 20x40 hunt) or
    per-question watches (1.9 KB, 842)? [keep] (#128)
  - The tag scheme `<branch>_<quiz>_<mark>_<stamp>z` can pass 40 characters [keep; `@ref` can
    take git ref names]; `papaparse` uninstalled [fine]; a branch switched on the hunt page is
    committed at the next quiz screen's reading [acceptable for now]. (#129)
* **Follow-ups** (small, not built):
  - `FullHistoryDownload` and the gear's download don't catch a failed zip: the user is told
    nothing. `HuntRepoList`'s alarm is the pattern.
  - At 360 px the site header overlaps the visitor's label and the hunt's `~org` crumb.
  - `e2e/reviews.spec.ts:52` (the smith's note folded to one line) flakes under load: three
    landings today.
  - `.claude/agents/thread-worker.md` asks a worker to commit its PR number into its thread file,
    which can't be landed once `pnpm land` has pushed; the progress table holds the numbers.
  - `pnpm restack` conflicts replaying branches that merged under new SHAs with changed context.
* **Thread 7's open points** (in #133): a whole-hunt paste into a quiz matching none of its
  quizzes carries the first quiz's title, notes and columns [carry them only on a label or title
  match, or a single-quiz paste]; a column re-added for its alignment can clear the quiz's sort
  memory; an export imported into a brand-new quiz lands after its five starter questions.
