# Thread 4: Narrow two Convex reads (2026-10-09)

Branch `20261009-convex_reads`, PR filed at landing; see the report. Suites: `pnpm justify` green
(183 files); full `pnpm e2e` at landing (the report gives the tally and any flakes). **No schema
change.**

**Only the `questions.open` half lands here.** The `makeHuntFor` half needs a hand-rolled tally,
which CLAUDE.md says a Coach must approve first, so it waits on the local branch
`20261009-convex_reads_tally` (tip `7857b74b`, not pushed). That branch is this one plus commit
`9ca53ab4` and the original thread file; see *Held for the Coach*, below.

**Measured**, with `tests/support/counting.ts`, a database proxy that counts documents read, index
ranges opened, and the tables reached:

| `questions.open` | before | after |
|---|---|---|
| stored part, 10 widgetings, 3 with history | 16 docs, 11 ranges, reads `widgetings` | 5 docs, 3 ranges, `widgeteds` only |
| whole (affirm + stored), the test fixture's 3 widgetings | 7 docs, 6 ranges | 4 docs, 4 ranges; tables `huntings`, `questions`, `widgeteds` |

The tests in `tests/convex/reading.test.ts` (`storedFor`) and `questions.test.ts` assert these
counts. The `questions.test.ts` test also shows that relabelling a widgeting leaves a question's
reading unchanged.

* **Built**:
  - **`storedFor(db, question_id)`** (`convex/reading.ts`). It walks the question's own range of
    `widgeteds` newest first, one cell at a time (`cellsBelow`). Each cell is read as far as its
    newest `ok` row, and the walk then restarts below that widgeting id (`.lt('widgeting_id', …)`),
    so the older history goes unread. The result is the same as `cellRowsOf` per cell, in one
    range per cell that has an `ok` row, plus one range that finds the end. It reads no
    widgeting. `questions.open` uses it.
  - **The shape it leaves, for thread 6:**
    - `SeenQuestionT.stored` is keyed by **widgeting id** (`SentStoredT`), not by label.
    - `QuizFrameT` gains `widgeting_ids: Record<label, Id<'widgetings'>>`, which `frameOf` fills
      from the widgeting rows.
    - `quizFromSeen` puts each cell under its label with `storedUnder(frame, stored)`, in the
      frame's run order. It keeps only widgetings of the `question` tier that the frame holds,
      and it omits `widgeting_ids` from the `QuizT`.
    - `QuizT` and `QuestionT` are unchanged.
    - `assembledQuiz`, `useQuiz` and the hunt feed are untouched. Thread 6 assembles the same
      readings as before, except that `reading.stored` needs the frame to resolve.
    - **A stable-question cache in thread 6 must key on the frame's `widgeting_ids` and
      `widgetings` as well as the reading.** A relabelled widgeting now changes only the frame,
      not the question's reading.
  - The server-side whole-quiz path (`allStoredOf` → `QuizRows.stored`, `quizFrom`, the export) is
    keyed by id too (`QuestionStoredRows`), so the two paths share one projection. It still reads
    one range per storing widgeting, as before, which keeps a whole quiz inside the transaction's
    bound.
  - `tests/support/counting.ts` (`counting`, `plainReads`), for any later thread that wants to
    count reads.
  - `notes/convex.md`: the bounded-reads bullet now describes the question's walk.
* **Decisions taken**:
  - **A skip-scan walk rather than reading the whole question range.** Every ask appends a row,
    so a question's whole `widgeteds` range grows without bound. The walk keeps the bound that
    `notes/convex.md` gives a cell.
  - **The frame carries ids by label**, rather than as an array parallel to `widgetings`. This
    survives a change of the widgetings' container (see the keyed-widgetings note below). The
    resolution walks `frame.widgetings` for run order.
* **Deviations**: only half the thread lands; see *Held for the Coach*.
* **Discoveries**:
  - `questions.open` still reruns for every question on any write to the **hunt row** or to the
    reader's **hunting**, through `affirmForHunt`'s evidence. Those writes are rare (retitle,
    wheel, role), so I left them alone.
  - A `tt.run` in convex-test refuses to return a `Map` or `Set`. `plainReads` exists for that.
  - **Where this meets the Coach's keyed-widgetings thread:**
    - `frameOf` (`widgeting_ids`, built from rows by label);
    - `storedUnder`/`quizFromSeen` (walks `frame.widgetings` as an array, reading `label` and
      `tier`);
    - `allStoredOf`/`storedOf` (id-keyed now).
    If widgetings become a record keyed by label, `storedUnder` iterates that record instead and
    `widgeting_ids` can fold into it. The question's own read knows no labels, so nothing on the
    server side of `questions.open` moves.
* **For the Coach**:
  - **At deploy:** the new functions go live a moment before the new pages. A tab left open
    across the deploy then reads the new key (cells by widgeting id) with the old page, and shows
    saved bot and entry cells as empty until it is reloaded. Nothing is lost. Reload open tabs
    after this deploy.
  - **The tally half is waiting for your yes** (below).

## Held for the Coach: the `makeHuntFor` tally (`20261009-convex_reads_tally`)

- **Problem.** `makeHuntFor` reads every hunt (up to 999) to check `PA.HuntsInApp`. Its read set
  therefore meets every hunt inserted, deleted or edited beside it.
- **What the branch does.** It adds a new table, `tallies` (`src/models/tally.ts`): one row per
  tallied table, holding its count.
  - A trigger beside the stamps and signals (`convex/tallying.ts`) moves the count ±1 at each
    insert and delete of a hunt.
  - No backfill is needed. The first hunt made that finds no tally counts the hunts once and
    writes the tally.
  - `expectSound` gains the check "every tally counts its table".
  - `notes/convex.md` gains a *Tallies* section, and `notes/stack.md` an entry under *Hand-rolled
    on purpose*.
- **Measured** reads per hunt made: 17 plus every hunt (117 with 100 hunts, 517 with 500)
  before; 19 after, however many hunts there are. The once-only first count is 518.
- **Why hand-rolled** rather than `@convex-dev/aggregate` or the sharded counter:
  - either needs a backfill, since a counter cannot tell "never counted" from zero;
  - their tables are not emptied by `testing:clearAll`, so an e2e backend's count would climb
    run after run;
  - either brings a B-tree or shards for one number.
- **What no exact count fixes.** Two hunts made at once still conflict. The tally removes the
  999-hunt read, and the conflicts with every hunt edit.
- **Costs.** It is a schema change: one new table, with no existing row reshaped. A hunt
  inserted or deleted from the dashboard puts the count off; deleting the tally row makes the
  next hunt recount.
- **To land it after a yes:** rebase `20261009-convex_reads_tally` onto the spine, keeping
  `9ca53ab4` and dropping its duplicate of this thread's first commit. Push your local Convex
  backend so `convex/_generated/api.d.ts` regenerates (it gains `tallying`), then prove and land
  as a schema-change PR.
- **The alternative, if no:** leave the full scan as it is.
