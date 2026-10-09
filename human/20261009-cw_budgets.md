# 2026-10-09: Compute budgets (columnwise thread 9) -- one grep before deploying

Thread 9 refuses LiquidJS's `*_exp` filters (`where_exp`, `reject_exp`, `group_by_exp`,
`has_exp`, `find_exp`, `find_index_exp`) as a template is read, as `include` is. A template already
stored that names one stops filling in after the deploy: a recap shows its template as typed with
the sentence, a column template or `liquidize` cell shows the issue, a templateable text stays as
typed, and a `liquidize` widgeting's params that name one are refused on their next edit.

**Before deploying**: grep production's raw export for `_exp:` (Liquid writes a filter's arguments
after a colon) in `recap_template`, `recap_head`, `recap_tail`, columns' `template`, `liquidize`
widgets' `formula` and widgetings' `params.template`, and the templateable fields. Expect none; a
hit is rewritten with its twin (`qns | where_exp: "qn", "qn.recap != blank"` becomes
`qns | where: "recap"`, an empty value being false). The repo's own tests held one such recap
template; nothing in the seeds or fixtures does.

Also worth a look, none blocking:

* A sort is now worked out in the browser and the server commits the order it is sent
  (`sort_questions` carries every question's id); no mutation runs the quiz any more.
  `Runner.RunMs`, the browser's bound on a run, is a loose five seconds, and a column's own formula
  has as long. A sort clicked within a round trip of an edit sorts the quiz as it was (accepted;
  optimistic updates remove it, `whiteboard/TODO.md`).
* A face (a templateable field's cell in the grid) is still filled outside any column's budget, and
  a JSONata range of millions allocates in one step: both in `whiteboard/TODO.md`.
