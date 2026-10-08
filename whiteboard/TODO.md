## Tiny Tasks

* widget remote call errors should log to console. Probably lots of things should log to console
* debug mode for expressions, widgets
* on a failed bot call, include the input and the error in the logs and in the popup error sigil
* making a new entry is hard. Does each need to be a widget, or can there be a single widget for entry and the widgeting
  chooses? (I'm not sure, discuss)


## Known Bugs

* **The production deploy of #163 did not start its backfills.** `scripts/convex-migrations.ts
  after-vercel-build` should run `migrations:runAll` on a production build; after the recap chain's
  deploy, `migrations:outstanding` showed all three `unknown` with nothing processed, and the Coach
  ran them by hand (2026-10-07; done, and #183 has since removed them). Read that build's Vercel
  log (`Backfills:`) and find why, before the next migration relies on it.

* **Resize handles on other boxes.** The recap note's box has one (`ReadonlyBox`'s `resizable`,
  CSS `resize: vertical`): give the other read-only boxes and the long editing boxes one too.
  Asked by the Coach, 2026-10-07.
* **A panel's widen arrow only while it is open.** Show the arrow only when the panel is unfolded;
  folding a widened panel narrows it again; unfolding then leaves it at its natural width. Asked by
  the Coach, 2026-10-07.

* **Better 404 pages.** An address that leads nowhere (an old or mistyped one, `/~undefined/...`)
  gets Next's bare not-found. It should say what was asked for, why it found nothing (no such org,
  hunt or quiz, or not one you are on), and offer the way back: your hunts, or the hunt the address
  half-named. Asked by the Coach, 2026-10-07, after an old address threw `hunts:open`'s validation
  error (fixed: addresses now refuse what the server would).

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


## Someday

* **Scan the code to scourge backwards compatibility**: e.g. ancient imports with dotted column
  names (`question.title`, `categories.masie`, read for good by the importer since the columnwise
  sprint, `whiteboard/20261008-columnwise/preplan.md`), and the pre-widgets reply fields
  (`guess`, `clueing_ishes`, `hint_ishes`) if that port lands. Each such reading should be named
  in the code for what it is, so this scan can find them.

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

* Strikethrough as fancy spoilers in markdown on screen: not clearly wanted, it means clicking to
  hide, and it would be weird while editing.

* **Author BBCode can break the recap's frame.** BBCode typed in a text passes through as typed, so
  a `[/quote]` in a clueing closes the question's quote early, and a `[/spoiler]` in an answer
  reveals it. The smith previews before posting. (Coach, recap sprint.)

* **O5: unlimited usernames per session, unlimited anonymous sign-in.** One username may make 99
  hunts (recap thread 8), but a session may assert any number of usernames, so a determined session
  can still fill the app's hunt cap. A rate limit on sign-in and new idents would close it. (Coach,
  2026-10-08.)

* **O8: no time budget per quiz run for formulas.** A formula's timebox is per evaluation, on the
  main thread, so a slow formula over many questions can hold the page. A budget per run, or
  formulas in a Worker, would close it. (Coach, 2026-10-08.)


## Flaky specs

Most full e2e runs under load have at least one spec that then passes alone, unchanged
(`pnpm e2e:log` keeps count). The most frequent, 2026-10-06 to 2026-10-08:

* **`reviews.spec.ts` › "the smith's note folded to a line"** (7 flakes; about 1 in 4 even run
  alone): its locator is built from the fold's `aria-controls`, a `useId` value, and sometimes finds
  no element by it. A locator by role or label inside the *Smith's note* region would not depend on
  the id.
* `routing.spec.ts` › "opens in the mode the visitor works in when it names none" (5), and
  › "takes the author's address along when the friend relabels the quiz" (4).
* `reviews.spec.ts` › "opens a first review for a reviewer who arrives straight at the review's
  address" (5).
* `quiz-history.spec.ts` › "an edit commits only the files it changed ... a milestone ... tags it" (4).

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
* Not handled, written as their text: footnotes, tables, task lists (none of those extensions is
  loaded).

## From recap sprint, thread 4: field templates

`src/lib/templating.ts` (`fill`, `bagOf`; Liquid since 2026-10-08), the face in `components/cells/markdown.tsx`, the
gear's *Templates*. Left, as not worth a hero's effort yet:

* **The review screen shows a templated field as typed**: a playtester reads `{{ qn.photo }}`, not the
  photo. Filling it there needs the quiz's run on the review screen (and a reviewer is not sent
  what the widgetings stored).
* **A templated image reaches the LL Export as markdown** (`![alt](https://..)`): `ll-bbcode.ts`
  has no image rule. The league's own image syntax would go there.
* A templated widgeting that is not a text entry (a JSONata readout, say) can be nominated only
  while already nominated, and nothing fills it on screen: its readout is no markdown face.
* **Each templated face may fill to 100,000 characters** and re-parses on every render
  (`components/cells/use-face.ts`), so a quiz of many templated cells near the cap costs the parse
  of each. Memoize `faceOf` by text and bag, or a lower cap for field templates. (Thread 7.)
* A column's own copy of the questions (a formula reading `qns`) holds templated fields as typed,
  since a formula runs before any template is filled.
* A templated widgeting's widgeted is filled in the recap's bag whenever its value is text, a
  readout's as well as a text entry's; the grid fills only text entries.

## From recap sprint, thread 5: the recap panel

`src/lib/recap.ts` (`noteOf`), `components/panels/RecapPanel.tsx`. Left, as not worth a hero's
effort yet:

* `Correct Answer %:` reads only a column labelled `correct_pct` (thread 14, the Coach's answer);
  nothing in the app records the share yet.
* The league's own form writes `{Add Optional Text For Qn Here or Delete}` where a question has no
  recap; ours writes nothing there.
* The note's box is `ReadonlyBox`'s dense face, which wraps mid-word (`word-break: break-all`).

## From recap sprint, thread 14: the editable recap template

`src/lib/recap.ts` (`DefaultTemplate`, `bagOf`, `noteOf`), the Recap panel's *Recap template*. Left:

* **One document, one set of link definitions.** The note is converted whole, so a reference link
  (`[x][1]`) in one question resolves against a `[1]: ...` defined in any text of the note, the
  first winning. Two questions both defining `[1]` differently link the second wrong. Inline links
  are unaffected.
* **An unclosed block swallows the rest of the note.** An unclosed fenced code block, or a raw HTML
  block (`<pre>`, `<!--` with no close), in the head *or any question's recap* runs to the end of
  the one document, so everything after it -- later questions, their answers included, outside
  their spoilers -- comes out as literal text (it was contained when each text was converted
  alone). Wontfix-adjacent: the smith previews before posting. A fix would close such blocks in
  a recap and the head, or convert those texts alone again.
* **An answer with its own `**` or `~~`** can tangle with the default template's `~~**...**~~`
  around `qn.full_answer | oneline`; `*Hamlet*` comes out `[i][b]..[/b][/i]` (same look on the board).
* **On a very large quiz the default note may pass `FilledMax`** (100,000 characters): about 999
  questions of ordinary length. A real LL quiz is far smaller; a budget scaled to the quiz would
  close it.

## From recap sprint, thread 10: the markdown dialect

The dialect is written down in `notes/markdown.md`. Left, small:

* **Bare addresses are links in bbjank but text on screen.** The screen loads only GFM's
  strikethrough; `micromark-extension-gfm-autolink-literal` would make `https://..` and `www.`
  clickable there too, as one more remark plugin beside it. Not asked for; one line when wanted.
* **A text opening `1984.` after a numbered list joins that list** (CommonMark continues a list
  across a blank line whatever its numbers), on screen and in bbjank alike. `1984\.` keeps it a year.
* **The LL export writes strikeout, links and images as typed**: `ll-bbcode.ts` converts only
  emphasis and quotes. The league's site has its own image and link syntax, if wanted.

## From recap sprint, thread 6: quiz-level widgetings and entries

Widgetings of the `quiz` tier (the runner's quiz steps, `quiz_widgeteds`, the gear's *Widgetings*,
the *Quiz entries* panel). Built small; left (thread 11 let the tiers interleave and dropped the
questions pivot, closing the two items about it):

* **An import does not carry the quiz's own entries back.** The export writes them under the
  quiz's `widgeteds`, and an import adds the widgetings; reading `widgeteds` into
  `enter_quiz_widgeted` actions (as `enteredFrom` does a question's) is the rest.
* **No `aibot` at the quiz's level**: no cell to ask from. It would need an ask button in the panel,
  `record_widgeted` taking no question, and a prompt over the quiz's bag.
* **A quiz text entry cannot be templated**, nor shown as a markdown face in the panel: the panel's
  box is plain text. The recap's head and tail, always templated, read it as `quiz.<label>`.
* **A reviewer is sent none of the quiz's entries**, as none of a question's stored widgeteds.

## From columnwise sprint, thread 2: entry families

Built: `boolean` and `enum` entries, params per family, the named patterns, entries first. Left:

* **The browser installs no Zod error map** (`Reporting.installErrorMap` runs in Convex and the
  tests, not in `src/app/providers.tsx`), so a message a view shows from a parse reads Zod's own
  words ("Too small: expected number to be >=1") unless the parse passes `{ error:
  Reporting.customError }`, as the entry cells, the params fields and the widgeting planner now do.
  Installing it once beside `AlarmsProvider` would make every view's sentences the server's; check
  the specs that read a sentence first.
* **A choice column sorts alphabetically**, not in its options' order (`Sortings.sortValueOf`
  reads the text). Sorting by the option's place wants the column to know its widgeting's params.
* **An enum cell holding an option since dropped** shows it as an extra option until another is
  picked; nothing lists the cells a revised list strands.

## From columnwise sprint, thread 5a: the folding editor

Built: columns lead, each widgeting a panel folded to its line, the dialogs retired. Left:

* **Params sent and refused by the server stay in their fields** (`FoldedParams` in
  `WidgetingPanel.tsx` shows sent params until the quiz's watch brings them back, so a second field
  left before the echo builds on the first). The planner holds params to the widget as the server
  does, so a refusal there is a race (the widget revised meanwhile); the alarm says so, and the
  fields show what was sent until the next change. The same shape as thread 2's `useDraft` leftover.
* **A new widget written from the folding editor's doors is not told the widgeting it is for**
  (`NewWidgetDoor`): the widgeting is made after the widget, labelled as it. The widget editor's
  preview and advice prompt therefore name no widgeting there; *Edit the widget…* in a panel does.
* **A column's header follows what it shows only while it is the default one** (`retitledPatch`);
  a column label never follows a relabel. If authors want the label to follow too, it is the same
  rule one field over, but a column label is named by the quiz's sort memory.

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

## From recap sprint, thread 7: security

Detail, evidence and fix sketches: `whiteboard/20261005-recap/security-findings.md`; decisions worth
a security reviewer's eye: `notes/security.md`. Fixed since: O2 (`TRIQUET_ADMINS`), O4, O6's
headers, O7, and images from formula and bot columns. O5 and O8 are wontfix (above).

* **Review and test the Content Security Policy.** The other headers are on (`next.config.ts`).
  A `script-src` policy needs Next's inline scripts allowed, by a per-request nonce (which costs
  the prerendered, client-first pages) or by their hashes: try it on a preview first. LiquidJS
  needs no `eval`. An `img-src` rule could also answer O9. (Coach, 2026-10-08.)
* **O1, the ask route answers any POST** on the server's Anthropic key (Opus tier, `max_tokens` as
  asked): no session, no rate limit. *Coach, 2026-10-08:* once there is OAuth, asking becomes
  bring-your-own-key.
* **O3, unheld legacy idents.** An ident nobody holds goes to the first session asserting it
  (`claimFor`), and `hunts.open` tells anyone a hunt's smiths' usernames. Close out unheld idents;
  name smiths only to a session with a username.
* **O9, info.** An image may be any `https` address, the viewer's own network included.
