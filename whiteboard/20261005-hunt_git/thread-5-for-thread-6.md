# Thread 5: what thread 6 is handed (2026-10-05)

From `thread-5-hunt_repo.md`. Read it before touching the downloads, the hunts page's folded list,
or `QuizNotFound`.

## Done already (pulled forward)

* The gear's *Download as git* (`QuizManageModal`) and the Full History tab's *Download Full
  History* (`FullHistoryDownload`, which now takes `hunt` in place of `quiz`) download the hunt's
  repository as `<hunt label>.zip`, unpacking to `<hunt label>/`: `HuntMirror.downloadHuntRepo(hunt)`,
  over `Huntgit.zipHuntRepo`. Both had to move: the `/quizzes` repository they zipped is no longer
  written, and the e2e reads the history's tags through the download. The Full History tab's
  blurb says "this hunt".

## Left for thread 6

* A download on the hunt's own page (`HuntMirror.downloadHuntRepo` takes `_id`, `label`, `branch`).
* `OrphanedRepos` (the hunts page's fold) and `QuizNotFound`'s list still read the per-quiz
  repositories of before: `HuntMirror.listQuizRepos` and `downloadQuizRepo`, over
  `Huntgit.listQuizRepos`, `orphansAmong`, `zipQuizRepo` and `QuizReposRoot`, through
  `src/state/use-quiz-repos.ts`. Nothing makes such a repository now, so these list only what a
  browser kept before this sprint. To list hunt repositories instead, walk `Huntgit.RepoRoot`
  (`/hunts`) as `listQuizRepos` walks `QuizReposRoot`, naming each by the `label` in its
  `hunt.tqh.json` at `HEAD` (the directory is the hunt's id); an orphan is then a repository of a
  hunt the visitor is not on. Then the `/quizzes` helpers can go.
* `src/content/full-history.md`, and the notices `noHistoryHere` and `nothingToMilestone`
  (`src/lib/notices.ts`), still speak of a quiz's history.
* Two e2e tests went with the per-quiz lists, since no spec can make such a repository now:
  `quiz-history.spec.ts`'s "a deleted quiz leaves its history on the hunts page, folded away" (a
  deleted quiz now leaves its history in the hunt's repository; tested instead: its files removed
  in a commit, the history keeping them) and `routing.spec.ts`'s "lists the history repositories
  this browser holds, including those of deleted quizzes". Their replacements, for hunt
  repositories, are thread 6's.
* `e2e/quiz-history.spec.ts` has `downloadedHistory(page)`: the gear's zip, unzipped, with a
  function asking the real git about it. Reuse it.
