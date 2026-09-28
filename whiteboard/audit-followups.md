# Audit follow-ups

What the Coach set aside from the audit of 2026-09-28 (`whiteboard/audit-2026-09-28.md`) to
look at in a session of its own, each with where it is described. Nothing here is planned;
each is a thread to open. The query-boundary items are in `whiteboard/query-boundaries-plan.md`
and the view habits in `whiteboard/views-after-convex.md`; neither is repeated here.

## To handle later

* **The unused utility library** under `src/lib/`: `strings.ts`, `collections.ts`, `props.ts`,
  `errors.ts`, `type-tools.ts`. Outside their own tests, only `Inconsistent` and the three
  functions `vv/reporting.ts` calls are used. Audit §4, first bullet.
* **The second validator kit**: `lib/vv/kit.ts` (`Kit`) beside `lib/validator.ts`
  (`ValidatorKit`), overlapping aliases under different names; only `vv/checks/*` import the
  first. Audit §4, *Two kits*.
* **`inspectify-browser.ts`**, a `util.inspect` for the browser, used by the error map to quote
  a refused value. Audit §4.
* **The unused validator checks** (re-raised; the Coach could not find the mention). Audit §4,
  *Unused validator checks*: `vv/checks/contact.ts` (email, phone, postcode, PO box, given
  name...), `vv/checks/numbers.ts` (latitude, longitude, money, port numbers) and most of
  `vv/checks/strings.ts` and `vv/patterns.ts` are imported by nothing but their tests. The
  models use about seven: `textish`, `noteish`, `titleish`, `label`, `identlabel`,
  `formulaish`, `convexid`.

## Flagged, for the Coach to look into

* **JSONata's timebox** (`lib/formulas.ts`, around line 98) hooks `__evaluate_entry` and
  `__evaluate_exit`, which JSONata's own exerciser uses but which are not public API; pinned at
  1.8.9. Audit §4.
* **Two validation libraries**, the one wanted not the one used. Audit §4 *Two kits* and §5
  `validator.ts`.
* **Three registries of in-flight writes** (`Writing.count`, the `writing` state, the mirror's
  `writing` set). `whiteboard/views-after-convex.md`, item 4. A thread of its own.
* **The commit scheduler keeps its own timer.** Tried on 2026-09-28: es-toolkit's `throttle`,
  and its lodash-shaped `_.throttle` and `_.debounce` with `maxWait`, reschedule the trailing
  call on every call inside the window, and only fire "once per window" when a *later* call
  arrives after it. So "commit `seconds` after the first edit, whatever follows", which
  `tests/state/commit-scheduler.test.ts` pins, is not expressible with them. The per-quiz
  `setTimeout` in `src/state/commit-scheduler.ts` stays; record it under *Hand-rolled on
  purpose* in `notes/stack.md` if the Coach agrees. (The resize hook, a true debounce, now
  uses `_.debounce`.)
* **Raw elements left inside the grid's cells**: the chain picker's `<select>`
  (`cells/chain.tsx`) and the error badge's `<button>` (`cells/ErrBadge.tsx`). Under the bespoke
  grid decision; not changed on 2026-09-28 when the chrome's were.

## Complexity, one session each (audit §5)

* `convex/writing/quiz_writing.ts`: the tree-to-rows diff is gone (the import change of
  2026-09-28); what is left is the update helpers and the inserts.
* `src/lib/importing.ts`: one pass now, no ids; the three payload shapes remain.
* `src/components/QuestionRow.tsx` and `cells/fields.tsx`: row-height negotiation through
  layout effects and a resize token. Inherent to the approved grid.
* `src/state/use-hunt.ts`: four concerns in one hook. `whiteboard/views-after-convex.md`,
  items 3 to 5.
* The git mirror as a subsystem: `quizgit.ts`, `quiz-mirror.ts`, `commit-scheduler.ts`,
  `changes.ts`, `exposure.ts` and half of `exporting.ts`.
* `src/models/botting.ts`: the second half went with `record_botting`; what is left is the
  projection from rows to cells.
* `src/lib/validator.ts`: the callable wrapper and its unwrapping are two thirds of the file.
* `src/lib/strings.ts` and `src/lib/vv/reporting.ts`: an eight-case sentence joiner serving
  one error map.
* `hunts.open` as a query: `whiteboard/query-boundaries-plan.md`, item 1.
