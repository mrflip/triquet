# THIS DOCUMENT IS **FROM** AGENTS **TO** COACHES
It does not represent authoritative decisions: it is a conversational scratchpad. Agents should not use this as input, but are encouraged to write to it.
Agents: add at the top of the document, add a level two header;  Put the date before your title, following the examples seen here:

## 2026-10-04: Column rows edit in place (#75), and a failure #66 brings

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
## 2026-10-01: Rewidgeting thread 3 -- the widget tables, and a deploy that needs you

* **The deploy of this sprint is a hand procedure**, not a plain merge: `notes/deploy.md`,
  *Clearing the widget tables*. Export the hunt; in the Convex dashboard clear `expressions`,
  `widgets` and `bottings` and delete `bulk_ishes_last` off each quiz; merge; run
  `seeding:seedWidgets`; re-ask the bots. What is lost is `whiteboard/20261001-rewidgeting/losses.md`
  (the bots' replies, and any expression an author wrote or revised).
* **Your `dev` backend will refuse the new schema** until it is emptied or cleared the same way:
  `doppler run -- scripts/convex_dev dev --reset --seed true` empties it and seeds it. Export what
  you want to keep first. `pnpm dev` now passes `--seed` on every start (idempotent).
* **Previews start with a library of twelve**: a new quiz brings the widgets its default
  widgetings work, but the five text formulas come only from `seeding:seedWidgets`. Adding
  `--preview-run seeding:seedWidgets` to `build:vercel`'s `convex deploy` would seed each preview;
  I left deploy config alone.
* **The batched run is gone, and it was already slower than it should be.** *Recalculate all
  ishes* put every text of a quiz to the careful model in one ask, with up to 32,000 tokens of
  room. Worth a look of its own the day bulk returns, for pasted prompts or any other.

## 2026-09-30: Sprint misc done -- six threads, four PRs open

* **The sprint.** Six threads issued over the afternoon, each built by a thread-worker and
  reviewed by the new thread-reviewer (its first run: two `fix:` commits kept across six
  threads, nothing flagged). Plan and handoff: `whiteboard/20260930-misc/`. Live mirror: the
  *Sprint misc* Claude Doc.

## 2026-09-27: Reviewed Changes

Coach has swept changes into future documents

## 2026-09-19: Reviewed Changes

Coach has swept changes into future documents
