# Thread 8: The Coach's second follow-ups (2026-10-06)

Branch `20261005-viz`, PR pending, stacked on #133. Suites, at the tip in lane 1: typecheck and
lint clean; vitest 4005 passed, 1 skipped; e2e 258 passed. The commits, in order: item 2, 3, 4,
5, 6, 1, 7, 8, the urls.md docs the Coach added mid-thread, this file; then, after the Coach's
answer on the stamping writer, stamps by trigger and the notes that go with it.

* **Built** (each commit message says more):
  1. **Realm pinned to `home`**: a refinement in `RealmValidators` (row and tree); the schema stays
     `string` (`tests/convex/schema.test.ts`, *… leaving the row validator to refuse it*).
  2. **Stamps**: `created_at`/`updated_at` on every table of ours but `identings`, written by a
     convex-helpers trigger (`convex/stamping.ts`, the Coach's recipe), on every mutation
     `functions.ts` builds (`triggers.wrapDB`, public and internal; ESLint
     `triquet/convex-mutations-through-triggers` bars Convex's own builders elsewhere but
     migrations). `created_at` is `floor(_creationTime)`, immutable (a change throws, `stampsAfter`);
     an insert's `updated_at` equals it, a later write's is `Date.now()`. Optional for good in row
     validators (`ValidatorKit.stamps`) and schema. Readers use `Stamps.of`; the hunt, quiz,
     question, review and verdict balls write ISO strings. A backfill per table, raw (no edit).
     First built as a hand-rolled `Proxy` writer (`3a0e491`), replaced at the Coach's word.
  3. **`viz`** (widen): `archived | secondary | normal`; `set_viz` (a reviser's); sent to both
     standings; `rows.vizOf` reads a missing one as normal; in the balls, carried by Import. `viz`,
     `created_at`, `updated_at` are reserved widgeting labels. Backfills in `runAll`, ledger row.
  4. **Views**: `QuestionTitle` (italic, `(alt)`), the grid's title cell, `(alt)` by the Q# on the
     review screen; archived off the grid, review screen, reviews panel, previews; the gear's
     *Archived questions* (un-archive, delete at once: now the only delete); batch mode's
     `ConfirmViz` and toolbar buttons; `Rank.alternatesLast`, `ranksOf` skipping archived,
     `Rank.ontoIdxAmong` for drags.
  5. **Starters**: `importQuestions` archives the untouched blank questions it did not name.
  6. **Unmatched hunt paste**: `Jsonball.quizzesIn` shape `ball` vs `hunt`; `importInto` returns
     `elsewhere`; `Workbench` goes to (or makes) the quiz of the label, the paste waiting in
     `src/components/pending-imports.ts`; its `ImportForm` reads it with `{ take }`, the Import tab
     shown first.
  7. **Exports**: Sheets and the questions alone drop archived; balls keep them; LL `exportedIn`.
  8. **Notes**: vocabulary, hunt_git, tsv-formats, convex.md (*Stamps*); e2e moved to
     `e2e/archiving.spec.ts` with the views. **urls.md** (the Coach's added item): built /
     unserved / future, *Key paths and files* (one key path, the questions-alone exception,
     `pub.widgets`, rule 10 pointing at hunt_git's index), and *Addresses that move*.
* **Decisions taken**:
  - **Which rows get stamps**: every table of ours but `identings` (appended, never edited: its
    `_creationTime` is its history). Widgeteds are in: an entry's row is replaced on each edit.
  - **A replace that leaves the stamps out keeps them** rather than throwing (the recipe would
    throw: newDoc lacks `created_at`); only a write *changing* a held `created_at` throws.
  - **`created_at` is floored**: `_creationTime` is fractional, and the stamps are whole ms.
  - **Balls carry stamps only for the hunt, quizzes, questions, reviews, verdicts**; layout,
    library and membership stamps are for forensics in the database.
  - **An unmatched hunt's label is already another quiz's**: the paste goes to that quiz. Labels
    are unique in the hunt, so that quiz *is* the pasted one. A paste whose quiz has no label (an
    old export) gets a fresh label.
  - **Single-quiz vs whole-hunt**: one quiz's ball with nothing beside it is single. A Raw Export
    of a hunt with one quiz still counts as a hunt (its root has the hunt's fields), so it goes to
    a quiz of its own.
  - **Ranks when questions are left out**: numbered among the exported questions only, from 1 with
    no gaps. An alternate ranks after its peer with the same Q#. A chain to a question that was
    left out still shows that question's hint as the BUT NOT (chains resolve over all questions).
  - **Archived questions have no rank** and keep their Q# through renumbering and drags.
  - **The review screen marks `(alt)` beside the Q#**, since it shows no titles. There is no
    "taker's screen" in the app; takers see the LL go-live export, which drops archived and
    secondary questions.
  - **Starters**: "all fields blank" ignores the title when it is the one the label gives. A
    starter with something typed into its cells is not archived.
  - **Batch mode**: archiving ends the selection; Make secondary/normal keeps it.
* **Files beside this one**: `thread-8-rebase-exec.md`, for anyone scripting a check of each commit.
* **Deviations**:
  - Item order in the history: 2, 3, 4, 5, 6, 1, 7, 8. Each item's views depended on the widens.
  - e2e specs were updated with the views (item 5) so every commit stays green, not in item 8.
  - `ConfirmDeleteQuestions` and `e2e/deleting.spec.ts` are renamed to `ConfirmViz` and
    `e2e/archiving.spec.ts`, and rewritten.
* **Discoveries**:
  - **Never run the unit suite under `git rebase --exec`**: the script tests then write into the
    worktree's own repository. What happened, and the guard it wants: `thread-8-rebase-exec.md`
    (read it before scripting a check of each commit).
  - `label.refine((val) => val === HomeRealmLabel)` infers a **type predicate** and narrows the
    TS type to `'home'`. Use `(val): boolean =>`.
  - convex-helpers' trigger writer wraps `insert/patch/replace/delete`, not `db.table(name).…`,
    which nothing here uses. Dashboard edits bypass the trigger.
  - Seeded test rows (`tests/support/seed.ts`) are written raw and carry no stamps, as rows the
    trigger never saw.
  - `/convex-reviewer`, applied by hand to the diff: no critical or important findings. Points
    noted:
    - `set_viz` goes through `affirmPerform` and the scoped writer.
    - `archiveStarters` reads one indexed `.first()` per candidate, bounded by the quiz's cap.
    - `Date.now()` is read only in a mutation's trigger, never in a query.
    - Each table is walked once by its backfill, questions twice (stamps and viz).
    - No new indexes.
* **For the Coach**: `human/20261006-viz.md`. In short:
  - One `migrations:runAll` after merging covers thread 7's and this thread's backfills; then one
    tighten PR.
  - Check production for widgetings labelled `viz`, `created_at` or `updated_at`.
  - The stamps stay optional for good; the tighten covers `orglabel` and `viz` only.
  - Dashboard edits bypass the trigger.
  - The rebase incident set `core.bare = true` on the main repository (now fixed by the Coach).
  - The first commit to each hunt's history after the deploy will rewrite every file once.

## Review

Medium review, `fixed`: one commit added (`c3e90a9`: a paste sent on to a locked quiz is let go,
saying so (`AppNotices.importSentToLocked`), rather than held to be read once the quiz is
unlocked; an e2e in `importing.spec.ts`). Minor findings left for the Coach:

* **Starters written before stamps.** `archiveStarters` reads a question the trigger never saw
  as untouched, by design (a backfill is no edit). But until `backfillQuestionViz` has run, a
  sort, renumber or drag writes `viz: 'normal'` to each question lacking one, which moves its
  `updated_at`, so an import afterwards will not archive those starters. It lasts only until
  `runAll`, and the blank and no-stored-cells checks still guard it.
* **The `as never` cast** in `convex/stamping.ts` (`change.id` typed as a plain string): typing
  the change with convex-helpers' own per-table change type would remove it.
