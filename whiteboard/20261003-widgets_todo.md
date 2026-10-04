# Widgets todo: imported replies, and staleness back

PR #66 (import carries the bots' replies into empty cells, marked stale) merged to main while the
rewidgeting stack (#67 → #74) was open. Rebasing the stack onto it on 2026-10-04, #69 removes
everything #66 was built on (`bottings`, `guess`, `BotSlots`, the `stale` field), so #66's
behaviour is gone from #69 up. It still runs in #67 and #68, where the old bot model stands.

Both halves need to come back: the replies an import carries, and the stale mark on them.

## Why it matters for data

Deploying #69 clears `bottings` by hand (`whiteboard/20261001-rewidgeting/losses.md`). The
pre-deploy Raw Export holds each question's newest reply (`guess`, `clueing_ishes`,
`hint_ishes`), but nothing reads it back. Until the port below lands, keep those exports: they are
the only copy of the replies.

## What to build

The design is already written: `notes/decisions/2026-10-widgets.md`, *Imports of every kind merge
by label* (the bullet that follows "open PR #66"), and *Deferred*, *Staleness*.

1. **Carry pasted `aibot` widgeteds.** An `ok` value under an `aibot` widgeting's label is recorded
   as an `ok` row with `result_meta.imported: true`, only into a cell holding no row, so it never
   buries a real one. An `errored`, `missing` or unreadable value carries nothing, and is logged.
   Thread 8's `entered` path (`ImportValidators.importedQuestion`, `enterImported` in
   `convex/writing/quiz_actions.ts`) is the neighbour to follow; the difference is that an entry
   replaces and an `aibot` reply only fills.
2. **Read old exports.** A pre-#69 export names the replies by field, not widgeting label:
   `guess` → `dumdum`, `clueing_ishes` → `numnum_clueing`, `hint_ishes` → `numnum_hint`, with
   `{ status: 'done', text }` / `{ status: 'done', items }` in place of `{ status: 'ok', value }`.
   dumdum's value is now `{ guess, explanation }`, so the old plain-text guess needs a reading.
3. **Stale, by digest.** The `digest` column, and `stale` on `WidgetedT`, as *Deferred* sets out.
   A carried row has no digest, so it reads as stale until asked again, as #66 promised.

## Git refs

* #66 on main: merge `ce6bc9d`; its commits `4f33026` (a guess goes stale, from `asked_text`) and
  `0b8079c` (an import carries the bots' replies).
* Where the stack removes it: `feat: widgets, widgetings and widgeteds` on
  `20261001-widget_tables` (#69); before the 2026-10-04 rebase it was `94b808c`.
* #66's code to crib from: `git show ce6bc9d^2:src/lib/importing.ts` (`repliesFrom`,
  `bottingFrom`), `src/models/import.ts` (`importedGuess`, `importedIshes`, `importedBotting`), and
  `convex/writing/quiz_actions.ts` (`carryReplies`).

## Tests that went, to bring back in the new shape

From `4f33026`, `tests/models/botting.test.ts`:

* marks a guess stale once the clueing it was asked about has been edited
* marks a guess stale when what it was asked about is not known

From `0b8079c`:

* `e2e/importing.spec.ts`: a bot reply carried in fills its empty cell, marked stale
* `tests/convex/hunts.test.ts`, *the replies it carries*:
  - fills a cell holding no reply, where the reply reads as stale
  - fills the cells of a question it adds
  - never buries a reply the cell already holds, though it fills one that only ever failed
* `tests/lib/importing.test.ts`:
  - keeps what a bot replied out of the patch: a reply is carried, never revised
  - *what the bots replied*: carries a guess and each extraction as a reply to its cell, without
    what they were asked; carries nothing for a cell never asked, or one that only ever failed;
    leaves out a reply that will not read, and says so, but still takes the question; folds two
    pasted questions naming one label cell by cell, the later reply winning; carries a quiz's own
    replies back when its export is pasted; says how many replies it carried, and that they read
    as stale
* `tests/models/import.test.ts`:
  - takes one entry per label, each with what to change and no replies unless it carries some
  - takes the replies an entry carries, and refuses one from a bot not put that text

Read any of them with `git show 0b8079c -- <path>` or `git show 4f33026 -- <path>`.
