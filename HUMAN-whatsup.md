# THIS DOCUMENT IS **FROM** AGENTS **TO** COACHES
It does not represent authoritative decisions: it is a conversational scratchpad. Agents should not use this as input, but are encouraged to write to it.
Agents: add at the top of the document, add a level two header;  Put the date before your title, following the examples seen here:

## 2026-10-05: Export tweaks, and a quiz's `q1_preamble` widened in with a backfill

* **Raw Export** holds just a centred *Prepare export* until asked, in about the space the box
  takes; once read, the box with *Copy* and *Refresh export* beside it. The box does not follow
  edits (a change on screen withdraws it, back to *Prepare export*), so Refresh stays: it is how
  to catch up with an edit to another quiz of the hunt, which leaves the box standing. The *Download
  Full History* button is gone from this tab; the Full History tab still has it.
* **LL Export** has a mode pulldown (Plain, Playtesting, Go live) and an (i) tooltip saying what
  each does. Playtesting puts the whole smith's note, then a blank line, ahead of the first
  question; Go live puts the quiz's Q1 preamble there, and shows it in a field beside the pulldown
  to be rewritten. "First" is the lowest rank; in a quiz where no question has a Q#, it is the
  first unranked one, so the lead never vanishes silently. The mode is the tab's own state, not
  saved, and starts on Go live (Coach's call). Rebased onto the dbpolicy and categories sprints:
  the preamble's field is read-only unless `offers.reviseQuiz`, as the smith's note is;
  `set_q1_preamble` is a content action under `mayReviseClaimedQuiz`, as `set_smiths_note` is;
  and it reaches the dispatcher by a narrow `onQ1Preamble` from `Workbench` through `Panels`,
  not by handing the panel `dispatch` back.
* **The smith's note box keeps its lines**: each line break becomes `[br]` then the line break.
  The bulk records stay on one line as before.
* **Your step once this is deployed:** `q1_preamble` is a new field on quiz rows, so this is the
  widen half of the usual migration. Run, against production:

  ```sh
  ./scripts/doppledo prd_janitor npx convex run migrations:run '{"fn": "migrations:backfillQ1Preambles", "dryRun": true}'
  ./scripts/doppledo prd_janitor npx convex run migrations:run '{"fn": "migrations:backfillQ1Preambles"}'
  ```

  Then merge the stacked tightening PR, `20261004-tighten_q1_preamble` (field required in the
  schema, fallbacks and backfill dropped, ledger row added). Its push checks every quiz, so it
  lands only once the backfill is complete. Until then, a quiz without the field reads as having
  the default.

## 2026-10-04: Sprint dbpolicy done -- ten threads, ten PRs open, a deploy in order

* **The sprint.** A browser is a Convex Auth anonymous session that asserts a username; who is
  asking reaches every function as `ctx.actor`. Policy is pure functions in `src/lib/approve.ts`,
  dispatched by action kind and shared by server and browser; `convex/authorize.ts` gathers
  evidence in one parallel round from what the browser affirms, and a hunt's functions hold a
  database scoped to that hunt. Rows carry their `hunt_id` (and a few more copies); one `label`
  per row; reviewers are sent what a review needs (the answer included, shielded only in the view,
  as you ruled); the library is an admin's, on a mutation of its own. Plan, handoff and the
  finished threads' sections: `whiteboard/20261003-dbpolicy/`. Live mirror: the *Sprint dbpolicy*
  Claude Doc.
* **The PRs, each stacked on the one before** (land the top, #93, to take them all, or one at a
  time): #79 sessions and the actor (also carries the planning branch's five commits) <- #81
  `Approve` <- #82 one label and integrity repairs <- #83 denormalize <- #86 affirmations <- #88
  the scoped database <- #89 reads shaped by role <- #90 views ask `Approve` <- #92 the library
  behind an admin <- #93 tighten. **Deploying takes steps on production, in order**: the entry
  below this one.
* **Reviews**: every thread reviewed at medium; 2 `fix:` commits kept (#79 a sign-in retry, #82 a
  relabel the backfill would have undone), nothing flagged. Normal mode: no YOLO decisions.
* **Read a production export.** Thread 10 found `data/triquet-prod-20261004.zip` on disk and
  read it by script to check the tightened schema would take production's rows (no orphans; eight
  `forced_label` overrides fold without a clash). Nothing was imported and its extract was
  deleted. No rule forbade it, but say if agents should leave such files alone.
* **Open questions, gathered** (numbers are the plan's *For the Coach*; none blocks a merge):
  - **Deploy prerequisites** (1, 6): Convex Auth keys and clearing `identings` before #79;
    `migrations:runAll` after #83 and before #86; #93 last.
  - **Usernames** (2, 3): the first session to assert an existing username claims it; a session
    may hold more than one. **Session lifetime**: ten years, or a year unvisited (#79), so an
    anonymous session doesn't strand its username monthly. Clearing site data loses a username
    until there is a real sign-in. Each anonymous sign-in mints a `users` row: rate limiting is
    nearer than *Later*.
  - **The admin** (4): `Actor.isAdmin` approves every username, so anyone may change the library
    and see usage counts (#92). Give it a rule when ready; nothing else changes.
  - **What a reviewer is sent** (5): beyond the answer, the proposal as built; it lives in
    `Question.sentTo.reviewer`. **A widgeteds backstop** (9): a smith-only read rule in queries,
    one rule and a test.
  - **Import's `forced_label` key** (7): import still prefers a pasted one; drop it, or reserve
    the label for widgetings again.
  - **Idents through a hunt's scoped database** (8): readable, never writable, because
    `add_hunting` and `reviews.forQuiz` need them; the alternative is a copy on reviews.
    `reviews.forQuiz` still reads each reviewer's ident (not policy; a copy would end it).
  - **The browser dispatcher's refusal** (11): tells the author, as well as reporting a bug,
    because of the lock-under-a-draft race (#90). **`idents.current` sends a session its own
    `user_id`** (12).
  - **The e2e role** (10): threads 1 to 6 ran `pnpm test:e2e` on the shared `e2e` role; it may
    want a reset.
  - **`unicorn/prefer-combined-guards`** contradicts `notes/policy_approve.md`: disabled with a
    reason file-wide in `src/lib/approve.ts`, in `Review.isActiveOwner`, and on two lines of
    `convex/authorize.ts`. Switch it off for policy code in `eslint.config.mjs`?
  - **A smith re-adding themselves at their current role** is now refused `ownHunting` (was a
    silent no-op, #81).
  - **`CLAUDE.md`** still lists "the browser key" under `src/state/`; it is now the session
    (`use-session`).
  - **Polish not taken**: a change of standing re-asks the quiz's watches and shows *Opening…*
    for a round trip (#86, #90).

## 2026-10-04: Deploying the dbpolicy stack, in order (dbpolicy thread 10, PR #93)

The sprint is done: ten PRs, #79 to #93, each stacked on the one before. Merging them takes
these steps on production, in this order:

1. **Before #79:** set Convex Auth's `JWT_PRIVATE_KEY`, `JWKS` and `SITE_URL`, and clear
   `identings` by hand (`notes/deploy.md`, *Sessions*).
2. **Merge #79 to #92 in order.** Straight after #83 deploys, and before #86 does, run
   `./scripts/doppledo prd_janitor npx convex run migrations:runAll`. From #83 on it runs all ten
   backfills of threads 1, 3 and 4. A dry run of `runAll` tries only its first migration, so to
   preview one, use `migrations:run '{"fn": "migrations:<name>", "dryRun": true}'`. #86 to #92 read the copies
   with no fallback, so a row not yet backfilled is denied to everyone. If you deploy the stack in
   one go, run it straight after.
3. **Merge #93 last**, once `npx convex run --component migrations lib:getStatus` says all ten are
   done. Its push is refused while any row still lacks a field. If it names a row, that row's
   parent is gone: delete the row and redeploy. The 2026-10-04 export has no such row.

Open, and not blocking: import still reads a pasted `forced_label` (*For the Coach* 7 in the
plan). The sprint's other questions for you are in `whiteboard/20261003-dbpolicy/` (the plan's
*For the Coach*, and each thread's section of the progress document).

## 2026-10-04: Every username is an admin of the library, until you say who is (dbpolicy thread 9, PR #92)

* **Anyone with a username can now change the shared widget library**: add, revise, move, remove
  and import widgets, and count how far a widget is used. They can do it from any client, with no
  hunt open. Before, it took a smith of the hunt on screen. This is the plan's *For the Coach* 4,
  as accepted. The library editor is still only reached from a smith's Workbench, but the
  mutation (`widgets.perform`) is open to any session with a username.
* **To close it**, give `Actor.isAdmin` in `src/lib/actor.ts` a real rule. It is the only place
  admin standing is decided; nothing else changes. It takes the actor alone and reads nothing, so
  a rule that needs the database (an admins table, a flag on the ident) also needs a read in
  `affirmLibraryAction`, which is the library mutation's `affirm` and may be async.

## 2026-10-04: A lint rule against the policy guardrails (dbpolicy thread 2, PR #81)

* **`unicorn/prefer-combined-guards` contradicts `notes/policy_approve.md`.** The rule wants two
  guards in a row that return the same value merged with `||`; the note asks for one guard per
  line, each beside its rule, and no compound booleans. Thread 2 disables the rule, with a reason,
  for all of `src/lib/approve.ts`, around `Review.isActiveOwner`'s guards, and on one line of
  `affirmPerform`. Threads 5 and 6 will write more guard lists. Your call: switch it off for
  policy code in `eslint.config.mjs`, or keep disabling it where it bites.
* **A smith asking for the role they already hold is now refused** (`ownHunting`), where it used
  to be a silent no-op: the "not oneself" check is policy now and runs before the membership is
  read. Say if you would rather the no-op came back.

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
## 2026-10-04: Sprint categories done -- four threads, four PRs open

* **The sprint.** A hunt now has a *wheel* of 24 subject categories (fixed titles, from your
  Wuxing spike), arranged by drag or key at `/c/<hunt>/categories`; Masie, Artie and Poppy sit at
  slots 0, 8 and 16 and get a question by how far its categories sit from them; a quiz can work a
  *category estimate* entry (pills of category and difficulty) whose columns show each persona's
  chance and their average; and a *Category spread* panel draws the quiz's questions as a radar
  round the wheel, raw and smoothed, widening in the page on a click. Plan and handoff:
  `whiteboard/20261004-categories/`. Live mirror: the *Sprint: categories* Claude Doc.
* **The PRs, stacked in order** (land the top, #94, to take them all, or one at a time):
  #85 categories, the wheel and its editor <- #87 personas <- #91 the estimate entry and column
  parts <- #94 the spread panel and Recharts. #85 also carries your unmerged `chore: redact notes`
  (`20261004-redact`) and the sprint's plan commit beneath it.
* **Deploy**: every schema change is additive (an optional hunt `wheel`, a fifth `entry_kind`, a
  wider column source), so no migration. Run `seeding:seedWidgets` on production after #91 lands,
  for the seeded `categories` widget (thread 3's entry below).
* **Reviews**: all four threads at medium; one `fix:` kept (#91: the pills cell could wait forever
  for a superseded write). Nothing significant left open.
* **YOLO decisions, yours to overturn** (the plan's *Decisions taken in YOLO*): the wheel stored
  with its holes, total order derived by your fill rule; personas at slots, not categories; the
  chance curve linear between plateaus (best within one slot, worst within one of opposite), so
  null lands exactly halfway; a new pill's difficulty is medium; column hooks as
  `<widgeting>.<part>` sources, persona parts worked out on render; Recharts for the chart; the
  route exactly `/c/<hunt>/categories`.
* **Open questions, gathered** (detail in each thread's progress section and entries below):
  - Recharts or `@mui/x-charts`? Only `SpreadPanel.tsx` imports Recharts.
  - The new chart colours `seriesA`/`seriesB` (thread 4's entry below).
  - A hunt `wheel` optional for good (`Absentable`), or backfilled and required?
  - Should the wheel ride the hunt's Export? Today the Export box works chances against the
    default wheel.
  - The five decision notes now in `aside/` while CLAUDE.md, `stack.md` and `convex.md` point at
    `notes/decisions/`: bring back, or repoint?
  - A refused pills write leaves the cell on the unsaved value (a follow-up: `onCommit` reporting
    the mutation's outcome through `Workbench`'s `dispatch`).
  - Small things to confirm: the all-blank cell written rather than deleted; "(blank)" wording;
    difficulty by chip colour; persona cards naming one category each way; "Every question names a
    category." on an empty quiz; tiny tiles at rest in a 340px column.
  - Unconfirmed in a browser: at slots 8 and 16 a persona card may cover a tile's outer corner
    (that corner then can't be grabbed for a drag).
  - Adding a category later needs a migration: stored wheels are exactly 24 slots over the enum.

## 2026-10-04: Categories thread 4 -- chart colours that are not the brand's swatches, and Recharts installed

* **Two new palette tokens, `seriesA` and `seriesB`** (`src/app/palette.ts`), for a chart's
  lines: the brand's purple and verdigris made vivid enough to chart (light `#614092` and
  `#008c7a`, dark `#9274c3` and `#37a69a`). The theme's own `primary`/`secondary` failed the
  dataviz validator. In dark mode, bermuda and the lifted verdigris are indistinguishable to a
  deuteranope (ΔE 3.1), and every brand accent reads as grey on a chart (OKLCH chroma under 0.10).
  The new pair passes every check in both modes. Say if you would rather the brand bend
  differently.
* **Recharts 3.10 is in `package.json`**, per the plan's YOLO decision 6 and listed in
  `notes/stack.md`. `@mui/x-charts` stays the alternative. Only `SpreadPanel.tsx` imports
  Recharts, so swapping is a one-file change if you prefer MUI's.

## 2026-10-04: Categories thread 3 -- a new seed widget wants a seeding run on production

* **Run `seeding:seedWidgets` on production after #91 deploys.** The library gains a seeded
  category-estimate entry, `categories`. Seeding is by hand (`notes/deploy.md`, step 4 of the
  rewidgeting procedure: `./scripts/doppledo prd_janitor npx convex run seeding:seedWidgets`),
  and it adds only what is absent, so it is safe to run. Until it runs, a smith can still make the
  widget in the library (Entry kind: *Category estimates*); nothing breaks either way. The schema
  change itself is additive (a fifth `entry_kind`), with no migration.
* **The wheel and the export, again.** Thread 1 asked whether the wheel belongs in the hunt's
  export. It now matters a little more: a formula reading a persona's chance
  (`qn.categories.masie`) is worked out for the Export box against the default wheel, since
  `HuntT` carries none, while the grid, the server's sort and the history mirror use the hunt's
  own wheel.

## 2026-10-04: Categories thread 1 -- a field that is optional for good, and a decision note behind the curtain

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
