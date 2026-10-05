# 2026-10-04: Column rows edit in place (#75), and a failure #66 brings

* **#75** puts a column's title, what it shows and its width on one editable line in Manage,
  with its label read-only beside them; they give way to an MUI container query as the list
  narrows. Stacked on #66, whose two commits come in with it.
* **#66 breaks one e2e test.** `e2e/failures.spec.ts` › *a failed combined run is shown by its
  button and touches no cell* passes on `main` and fails on #66's tip: the "Couldn't
  recalculate: … Nothing was changed." line never appears. Not looked into further.
* **#76**, stacked on #75: the Danger Zone lays out by its own width (it sits in a dialog), and
  `notes/views.md` says when a view asks its container and when the window.
* **Possibly flaky:** `expressions.spec.ts` › *the prompt for a chatbot is copied…* failed once
  in a full e2e run, then passed 3 of 3 on its own.
