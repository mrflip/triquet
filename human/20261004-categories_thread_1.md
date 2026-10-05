# 2026-10-04: Categories thread 1 -- a field that is optional for good, and a decision note behind the curtain

* **A hunt's `wheel` is optional forever, not optional-until-backfilled.** Until now every row
  field was required, bar those mid-migration (`Backfilling`, `Retiring` in
  `tests/convex/schema.test.ts`). The wheel is absent on every hunt until someone arranges it,
  and absence reads as the default wheel, so it needs no migration on production. The schema test
  gains a third list, `Absentable`, and `notes/deploy.md` (*Schema pushes*) says when a field
  belongs there. Say if you would rather every new hunt be written with the default wheel and the
  field backfilled and tightened instead.
* **`notes/decisions/2026-09-drag-and-drop.md` lives in `aside/` now** (moved by `af677fb`), along
  with the client-first, convex, path-routing and resource-urls decisions, while `CLAUDE.md`,
  `notes/stack.md` and `notes/convex.md` still point at `notes/decisions/`. Agents may not read
  `aside/`, so the drag-and-drop note was not updated: the wheel's extension is a new note,
  `notes/decisions/2026-10-drag-and-drop-boards.md`. Worth bringing the five back, or repointing.
