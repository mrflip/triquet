
## Known Bugs

* Tune layout at small scales (eg "The site header overlaps itself at 360 px.")
* A failed history download tells the person nothing (`FullHistoryDownload`, and the gear's
  *Download as git* in `QuizManageModal`): `HuntRepoList`'s alarm is the pattern to copy.
* **Figure out reserved words vs our own use of them.** `PA.ReservedLabels` keeps words from every
  label, but two kinds of word the app itself uses as labels are left off it, and so stay open to
  authors:
  - `category`/`categories`: the library's category-estimate widget is labelled `categories`, and
    so is every widgeting of it.
  - `title`, `notes` and the question's other content fields: reserved only among widgetings
    (`ReservedWidgetingLabels`), as before. Column labels like `title` are normal; the starter
    columns use them.


## Ways to have workers spend less time twiddling thumbs waiting for e2e

The landing flow that came out of sprint little_fixes is `whiteboard/20261006-landing_flow/landing_flow-plan.md`:
prove before you bid, and bid cheaply. Two ideas were proposed along the way and pushed back on, kept here:

* **A machine-wide e2e lock** in `spine.ts`, so landings queue for e2e and stop failing each
  other. *The Coach: this might make it worse.* Once one worker queues behind another, the CPU
  is saturated by the suite running *and* no work gets done by the workers waiting for a
  bug-free green run. A flake sends its owner back to the end of the line, and another
  container on the machine makes it worse. Better to let e2e suites run in parallel whenever
  they like, so that nobody waits behind anyone longer than one test suite.
* **Wait a random 1-5 minutes before retrying** a landing that failed under load, rather than
  until the load falls below a threshold. *The Coach: "wait 5 minutes" makes my stomach turn.*
  Waiting is the cost we are trying to remove; rerunning a failed spec alone, at once, replaces it.

## Wontfix (fixable, but not devoting resources to fix it)

* After an import or a column change, the order the grid currently shows may become weird: a
  column deleted and re-added (an import does this to unset a column's alignment) clears the
  quiz's sort setting if it was sorted by that column.

* Git repos are per-browser: there's no actual full history. Also repos that were accessed from your browser as a different user show up as orphaned and are downloadable.


## From widgets sprint: imported replies, and staleness back

PR #66 (import carries the bots' replies into empty cells, marked stale) merged to main while the
rewidgeting stack (#67 → #74) was open. Rebasing the stack onto it on 2026-10-04, #69 removes
everything #66 was built on (`bottings`, `guess`, `BotSlots`, the `stale` field), so #66's
behaviour is gone from #69 up. It still runs in #67 and #68, where the old bot model stands.

Both halves need to come back: the replies an import carries, and the stale mark on them.

Deploying #69 clears `bottings` by hand (`whiteboard/20261001-rewidgeting/losses.md`). The
pre-deploy Raw Export holds each question's newest reply (`guess`, `clueing_ishes`,
`hint_ishes`), but nothing reads it back. Until the port below lands, keep those exports: they are
the only copy of the replies.

### What to build

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

## From recap sprint, thread 2: markdown to bbjank

`src/lib/bbjank.ts` (`toBbjank`). Left, as not worth a hero's effort yet:

* **Untried on the boards**: a heading written as `[b]..[/b]`, a thematic break as a line of 40
  dashes, `[img]` inside `[url]`, and an image's `[list](alt)[/list]` caption landing inside the
  `[url]` of a (non-YouTube) link around it. Paste one of each and see.
* A code block inside a list item has its lines set in two spaces, like the item's other further
  lines: harmless if the board trims leading spaces in `[code]`, wrong if it keeps them.
* A YouTube embed in the middle of a paragraph leaves the space before it at the end of its line.
* A quote's `{AS: name}` holding emphasis (`{AS: **Q1**}`) is no name: the quote is a `[list]` with
  the marker kept as text. Only a plain-text name is read.
* No underline from markdown: the plan refused `<u>`, and nothing in the parser falls out for it.
  BBCode typed in the text passes through as typed, so `[u]..[/u]` underlines.
* Not handled, written as their text: footnotes, tables, task lists (none of those extensions is
  loaded).

## From recap sprint, thread 4: field templates

`src/lib/templating.ts` (`fill`, `bagOf`), the face in `components/cells/markdown.tsx`, the
gear's *Templates*. Left, as not worth a hero's effort yet:

* **The review screen shows a templated field as typed**: a playtester reads `{{qn.photo}}`, not the
  photo. Filling it there needs the quiz's run on the review screen (and a reviewer is not sent
  what the widgetings stored).
* **A templated image reaches the LL Export as markdown** (`![alt](https://..)`): `ll-bbcode.ts`
  has no image rule. The league's own image syntax would go there.
* A templated widgeting that is not a text entry (a JSONata readout, say) can be nominated only
  while already nominated, and nothing fills it on screen: its readout is no markdown face.
* Categories are not in the template bag: `run.frame.order` holds the hunt's category labels, but
  not their titles. Add them in `bagOf` once a template wants them.
* An image that loads after a row has measured itself does not grow the row: `GrowingField`
  measures on layout, not on an image's load.
* `lib/ask/prompts.ts` and `lib/templating.ts` each check a template's parse and raw tags; one could
  lend the other its check.

## From recap sprint, thread 5: the recap panel

`src/lib/recap.ts` (`bbjankOf`), `components/panels/RecapPanel.tsx`. Left, as not worth a hero's
effort yet:

* **A stored, editable recap template** (the plan's Decision 6): the recap's frame (the quote per
  question, `Answer:`, `Correct Answer %:`) is fixed in code. A template would be mustache over
  bbjank, with each question's fields already converted in its bag.
* **A decision for the Coach: author BBCode can break the recap's frame.** BBCode typed in the
  text passes through as typed (thread 2's design), so a `[/quote]` in a clueing or hint closes the
  question's quote early, and a `[/spoiler]` or `[/b]` in an answer reveals it. Fixing it means
  choosing which BBCode an author may still write, and trying an escape on the board. Thread 7
  (security review) will look at it.
* A clueing opening `1984. ...` is read as a numbered list, and the board numbers it from 1: the
  bbjank writer drops an ordered list's start (thread 2's code).
* `Correct Answer %:` reads only a column labelled `correct_pct`, `pct_correct` and the like
  (`Recap.CorrectPctRE`); nothing in the app records the share yet.
* The league's own form writes `{Add Optional Text For Qn Here or Delete}` where a question has no
  recap; ours writes nothing there.
* The note's box is `ReadonlyBox`'s dense face, which wraps mid-word (`word-break: break-all`).

## Git refs

* #66 on main: merge `ce6bc9d`; its commits `4f33026` (a guess goes stale, from `asked_text`) and
  `0b8079c` (an import carries the bots' replies).
* Where the stack removes it: `feat: widgets, widgetings and widgeteds` on
  `20261001-widget_tables` (#69); before the 2026-10-04 rebase it was `94b808c`.
* #66's code to crib from: `git show ce6bc9d^2:src/lib/importing.ts` (`repliesFrom`,
  `bottingFrom`), `src/models/import.ts` (`importedGuess`, `importedIshes`, `importedBotting`), and
  `convex/writing/quiz_actions.ts` (`carryReplies`).

## From widgets sprint: Tests that went, to bring back in the new shape

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

