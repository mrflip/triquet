# THIS DOCUMENT IS **FROM** AGENTS **TO** COACHES
It does not represent authoritative decisions: it is a conversational scratchpad. Agents should not use this as input, but are encouraged to write to it.
Agents: add at the top of the document, add a level two header;  Put the date before your title, following the examples seen here:

## 2026-10-04: Sessions replace the browser key (dbpolicy thread 1, PR #79)

* **Before it deploys**, production (and the defaults for preview deployments) needs Convex Auth's
  `JWT_PRIVATE_KEY`, `JWKS` and `SITE_URL`, a key pair minted for it alone; then clear
  `identings` by hand, merge, and run `migrations:backfillIdentClaims`. The steps are in
  `notes/deploy.md`, *Sessions*. Without the keys nobody can sign in, so nobody can get past the
  username box.
* **A username now belongs to the browser that claimed it.** Existing idents are unclaimed, and
  the first browser to type one takes it: that is how people get theirs back, and how someone else
  could get there first. A browser that clears its site data loses its username until there is a
  sign-in. Another browser typing a held username is told to choose another, or to create an
  account on the device it was claimed from (which cannot be done yet).
* **Session lifetime is a choice I made**: ten years, or a year unvisited (`convex/auth.ts`).
  Convex Auth's default ends every session after thirty days, which would strand everyone's
  username monthly. Say if you want something else.
* **`CLAUDE.md`** still lists "the browser key" among `src/state/`'s contents; it should say "the
  session (`use-session`)". Left for you, since agents don't edit it on an agent's word.
* **Thread 10** should also tighten `idents.user_id`, which the plan's list leaves out.

## 2026-10-04: Production stuck behind `bulk_ishes_last`; a widen and a tighten to free it

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
## 2026-10-03: Association census, authorization review, integrity plan, sprint draft

Four documents in `whiteboard/20261003-dbpolicy/` (start with its `README.md`), uncommitted
because the checkout stands on your `20261001-quiz_review` branch. The short of it: the defence
against an edited client is real (one mutation, server-side rules, Zod at the door), with four
gaps worth closing in order: reviewers receive every field including `full_answer` and bot
guesses (hidden only by `AnswerLock`); any smith of any hunt may edit the shared library; the
action's `open` context is client-asserted and verified by three reads where one denormalized
`quizzes.hunt_id` would do; `/api/ask` checks no identity. Quiz label uniqueness within a realm is
checked only in the browser. The README lists eight questions for you and the assumptions I made.

## 2026-10-01: Sprint rewidgeting done -- eight threads, eight PRs open, a hand deploy

* **The sprint.** Bots and expressions are one family on the data layer: a global library of
  *widgets* (formularies `jsonata`, `aibot`, `entry`), put to work in a quiz as *widgetings*, coming
  to a *widgeted* per question. Authors paste their own prompts; a new quiz starts lean (five
  columns, no widgetings) and picks from the library. Plan, handoff and `losses.md`:
  `whiteboard/20261001-rewidgeting/`. Live mirror: the *Rewidgeting sprint* Claude Doc.
* **The PRs, stacked in order** (land the top, #74, to take them all, or one at a time):
  #67 decision record and vocabulary (docs only) <- #68 formulary seam <- #69 the three tables,
  seeding, clean break <- #70 pasted prompts <- #71 status <- #72 two editors and the Widgets panel
  <- #73 the lean starter set <- #74 entry widgets. #67 also carries the unmerged
  `20261001-rewidgeting_plan` (yours) and `20261001-rewidgeting_start` commits beneath it.
* **The deploy is a hand procedure** (thread 3's entry below; `notes/deploy.md`, *Clearing the
  widget tables*; `losses.md`). Land and deploy the stack together, at least through #70: the seeding
  mutation inserts only what is absent, so production should be seeded once, from the final fixture.
* **Bulk recalculation is gone, and the batched run was already slower than it should be**: worth
  a look of its own the day bulk returns (thread 3's entry below).
* **Reviews**: every code thread reviewed at medium; 12 `fix:` commits kept across seven threads;
  one flagged finding (thread 2: dumdum's reply not stored verbatim), fixed on resume and since made
  moot by thread 4's JSON route. Nothing significant left open.
* **YOLO decisions, yours to overturn** (the plan's *Decisions taken in YOLO* has all eleven):
  seeding a quiz's widgetings only when its columns name the old defaults; `butnot_ishes` as a seeded
  `jsonata` widget; dumdum's value `{ guess, explanation }`; imports keep pasted values per #66;
  duplicate labels in a library import merge, first wins; raw mustache tags (`{{{x}}}`, `{{&x}}`)
  refused; no separate `label` starter column; entry values imported ahead of #66.
* **Open questions, gathered** (detail in the plan's *For the Coach*):
  - Rate limiting on `/api/ask` (thread 4's entry below); `servicelabel` in the request, or assume
    `claude`?
  - Your `dev` backend needs `--reset --seed` (it holds the old schema and dumdum's old prompt).
    Previews seed only twelve widgets unless `build:vercel` runs `seeding:seedWidgets`.
  - Library export/import on the Export panel, or elsewhere? A Title field in the widget editor?
  - Column headings from a widgeting's label (*Butnot Ishes*) or the widget's title?
  - The sort rule for objects (a one-key object sorts as what it holds).
  - A paste holding widgetings but no questions changes nothing today; merge them?
  - Seed a generic entry widget? Move `notes` and `alt_text` into entries (thread 8's entry below)?
  - Suppressions: four `no-extraneous-class` disables on classes of statics (`JsonataFormulary`,
    `AibotFormulary`, `Widgeted`, `Widget`), or an `allowStaticOnly` override.
  - `CLAUDE.md` names the deleted `Expressed`, and points (with `notes/database-decisions.md`) at
    decision records under `/aside/`.
  - PR #66 and #67 both edit the vocabulary's *stale* entry: a small docs conflict for the second.
  - A known limit: the stored read nears Convex's per-transaction bound around 999 questions by 5
    `aibot` widgetings.

## 2026-10-01: Rewidgeting thread 8 -- entry widgets, and moving hint, alt_text and notes into them

* **Entries are built.** A widget of the `entry` formulary is typed into: its config names what its
  cells take (`text`, `number`, `labelish`, `titleish`), and its cell is the grid's own field
  editor for that kind, committing on blur to the cell's one `widgeteds` row (upserted; an emptied
  cell deletes it). Make one from *New widget…* in the widgeting editor, formulary *An entry*.
  The library seeds none, so the picker's *Entries* group is empty until someone makes one -- say
  if a generic seeded entry (a `remark`, say) would earn its place.
* **Three calls for you to overturn**, all in `notes/decisions/2026-10-widgets.md`, *Entries*:
  an entry's kind is fixed once made, as its formulary is (the values typed hang on it); an
  emptied cell holds no row, so it reads `missing`, not an `ok` of nothing; and **an entry's value
  rides the hunt import now**, merged as a question's own field is (a value replaces, null
  empties), rather than waiting on PR #66 with the `aibot` replies: it is what a person typed, and
  the export is their exit door.
* **`notes` stays a question field**, as the plan expected: while `notes` is an exposed question
  field, no widgeting may be labelled `notes`, so a default `notes` entry would have to be called
  something else, and a quiz would show two notes.

### Moving `hint`, `alt_text` and `notes` into entries: what it would take

Not done (a data move, and a later call). Read for the day it is wanted:

1. **The widgets.** Three seeded entry widgets. `notes` fits `text` as built. `alt_text` is read
   aloud as written, so it wants a plain text kind (no markdown face; `StretchField` has a `plain`
   prop already). `hint` is the hard one: its box grows and, with the clueing, decides the row's
   height (`GrowingField`); an entry's text box only stretches to the row. A fifth kind, or a
   `grows` flag on the kind.
2. **The bag and every formula.** Out of `Question.exposed`, each name frees for a widgeting
   label, and `qn.hint` becomes `{ status, value, err }`: every formula reading `qn.hint`,
   `qn.notes` or `qn.alt_text` (the seeded `numnum_hint` input and `clueing_with_butnot`, and any
   author's) must read `.value`, guarded by status. The seeds can be rewritten; an author's
   formulas cannot be found and fixed for them.
3. **The core features that read `hint` by name.** BUT NOT is the tool's own mechanic: the
   chained-to question's hint, shown by `cells/chain.tsx`, `ReviewScreen`, the sheet's `butnot`
   column and the league export (`ll-smith-export.ts`). As a widgeting, that is a core view knowing
   a label -- what retiring the `butnot_ishes` view undid. **My recommendation: `hint` stays a
   question field, as `chains_to` does; move only `notes` and `alt_text`.**
4. **The data.** A migration through `notes/deploy.md`: for each quiz, a `notes` (and `alt_text`)
   widgeting; for each question with a non-empty value, its row; then the question fields dropped
   (widen, copy, tighten -- three pushes). That is translation code of the kind this sprint chose
   not to write; small, but it touches every quiz and question.
5. **What follows the fields.** The starter layout's `notes` column re-pointed to the widgeting
   (so a new quiz starts with one widgeting again); `QuestionField`, `QuestionRow`'s field cases,
   `ImportableFieldnames`, `ClearedValueFor` and the question validators lose them; the league
   export reads the run; the git mirror's `question.notes` column becomes `notes.status` and
   `notes.value`, one diff of churn in every quiz's history. The hunt export keeps the key `notes`
   if the widgeting keeps the label, and this thread's import already reads an old export's bare
   `"notes": "..."` as an entry's value -- the one part that is free.

## 2026-10-01: Rewidgeting thread 4 -- the ask route is a free-form relay now

* **Rate limiting has moved closer.** `/api/ask` used to answer three fixed jobs; it now puts any
  prompt (up to 16,000 characters, up to 8,000 tokens of room, either tier) to Claude for whoever
  can reach the URL, so long as `ENABLE_ANTHROPIC_BOT=allow` and a key are set. `Approval` and the
  credentials check are exactly as strict as before, and the prompt is bounded as well as the
  reply, but nothing counts asks per ident or per minute. `notes/stack.md` lists rate limiting
  under *Later*; for this route it is nearer than that list suggests -- worth settling before the
  app's URL travels beyond friends. (The ask route is a Next route handler, not a Convex function,
  so `convex-helpers`' rate limiter would need a Convex call from the route, or a limiter of its
  own.)
* **`mustache` is installed** (mustache.js 4.2, with `@types/mustache`) for rendering a prompt
  template, as the sprint plan proposed; listed in `notes/stack.md`. Logic-less, escaping off.
* **Dumdum's seeded prompt changed** to ask for `{"guess", "explanation"}` as JSON. The seeding
  mutation inserts only what is absent, so seed production once, from the final fixture (the plan
  already says so). A local backend seeded before this thread still holds the old prompt: its
  guesses come back `unreadable` until it is reset (`--reset --seed`) or the prompt is edited in
  the library.

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
