# 2026-10-04: Production stuck behind `bulk_ishes_last`; a widen and a tighten to free it

* **Why main won't deploy.** Since #73, every production build is refused at the schema push:
  each of production's five quizzes still holds `bulk_ishes_last`, which main's schema no longer
  names. Setting it to null does not help (a field the schema lacks is refused whatever it
  holds), and the dashboard will not delete it, because the schema still serving requires it.
  The rewidgeting procedure's step 2 asked for exactly that; `notes/deploy.md` now says what to
  do instead.
* **The way out** is the usual widen, backfill, tighten. The widening PR lets a quiz hold the
  field (as anything) and adds `migrations:retireBulkIshesLast`; the tightening PR, stacked on
  it, takes both away again and enters it in the ledger. Rehearsed on a local backend holding a
  quiz shaped as production's: main's push refused it with *Object contains extra field
  `bulk_ishes_last`*, the widened push took it, the migration cleared it, main's push then
  landed, and `seeding:seedWidgets` added its seventeen widgets.
* **Production as of this morning**: `expressions`, `bottings` and `widgets` already emptied;
  `bulk_ishes_last` null on all five quizzes; `widgetings` and `widgeteds` empty. Production is
  still serving `0d41e29`.
