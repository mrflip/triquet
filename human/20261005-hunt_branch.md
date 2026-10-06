# 2026-10-05: A hunt has a branch, set on its own page; a quiz's version is retired

* **What changed.** The quiz's `version` is now the hunt's `branch`: one line of work for every quiz
  of the hunt, as `notes/decisions/urls.md` has a version name the state of the whole hunt. It is
  set on the hunt's page (`/h/<hunt>`), in a *Branch* panel with a *Switch branch* button, for a
  smith; anyone else sees it read-only. The gear's *Version* field is gone. The action is
  `rebranch_hunt`, an account action like `arrange_categories`, under `mayChangeHunt`.
* **The in-browser history** commits to the hunt's branch, and a milestone or a marked change tags
  it, starting the branch first if the hunt was switched since the last commit, as a quiz's version
  did before.
* **This is the widening half of a migration** (`notes/deploy.md`, *Schema pushes*). Once it is
  merged and deployed, run `migrations:runAll`: it gives each hunt the version most of its quizzes
  were on (`main` winning a tie it is in), then takes `version` off every quiz. Until it has run,
  a hunt reads as on `main`, and editing a hunt's title or label first gives it `main` (and the
  backfill then leaves it there). The tightening PR, after the backfill, makes `branch` required,
  drops `version` from the quiz's schema, and adds the ledger row.
* **Small tidy.** `huntLabelOf` was copied into two e2e specs and was wanted by a third: it lives in
  `e2e/support.ts` now.
* **Tightened** (`20261005-tighten_hunt_branch`), once the Coach had run the backfill on
  production: `branch` is required on hunts, `version` is gone from the quiz schema, the
  fallbacks and both migrations go, and the ledger gains #115's row. Its push checks every row,
  so it lands only if the backfill finished.
