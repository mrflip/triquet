# Little fixes B: the gearbox's controls, the panels' folds and exports, the top bar

Sprint plan, 2026-10-09. Mode: **YOLO**. Review level: **medium**. At most **3** threads at once.
Issued by the Coach (Flip) in chat, as one list of seventeen small asks; the orchestrator grouped
them into four threads ("I don't want a ton of PRs": unrelated asks may share a PR as separate
commits). **Status: thread 1 landed #212; 2 underway, 3 in review, 4 underway.** `little_fixes_b-progress.md`, beside this file, is newer than this
plan wherever the two disagree.

## Read first

Beyond CLAUDE.md and its auto-loads (`notes/stack.md`, `notes/testing.md`, `notes/convex.md`,
`notes/views.md`):

* `notes/vocabulary.md` and `STYLE.md`, before naming anything.
* `whiteboard/20261009-ux_flows/findings.md` (the Coach's latest thinking on navigation: *key path*,
  *home*, *reference*, and its ten principles) -- thread 4 must; threads 1-2 should skim its
  *controls audit*.
* `src/components/QuizManageModal.tsx` (the gearbox), `WidgetingsEditor.tsx`, `WidgetingPanel.tsx`,
  `ColumnsEditor.tsx`, `ColumnFields.tsx`, `ConfirmRemove.tsx`, `FoldButton.tsx` -- threads 1-2.
* `src/components/panels/Panel.tsx`, `Panels.tsx`, `ExportImportPanel.tsx`, `RawExport.tsx`,
  `ReadonlyBox.tsx`, `src/lib/exporting.ts`, `src/lib/importing.ts` -- thread 3.
* `src/components/SiteHeader.tsx`, `QuizSwitcher.tsx`, `QuizHeader.tsx`, `Workbench.tsx`,
  `HuntsList.tsx` (*IdentTitle*, "Be someone else"), `src/state/use-ident.ts` -- thread 4.

## Ground rules

`notes/git_hygiene.md` (*The spine*, *A thread, start to finish*, *Sprints*) and
`.claude/agents/thread-worker.md`. Particular to this sprint:

* **One commit per ask** where the asks are unrelated, so the Coach can read each on its own in
  the PR. Commit messages say which ask they answer.
* **No row shapes change**, as far as the orchestrator can see. Thread 4's *percent* entry kind is
  the one possible exception: adding a value to an enum is a widening; if it needs a schema push,
  follow `notes/deploy.md`, *Schema pushes*, and say so in the PR title and report.
* **Library first**: MUI's `Tooltip`, `ToggleButton`, `IconButton`, `Menu`, `Breadcrumbs`,
  `Divider` and `@mui/icons-material` cover nearly all of this. Nothing here should need a new
  package; if one seems to, propose it in the report.
* **Views are judged in the browser.** Each thread screenshots its changed screens at desktop and
  narrow widths (`/run`, `playwright-cli`) and keeps them in its scratch directory; mention them in
  the thread file.
* **Prove with `pnpm e2e --touched`** (CI runs the whole suite). Specs that look for text or roles
  this sprint changes (the "Library" tab, the "Quiz" pill, the second navbar, "Your hunts", remove
  buttons) are updated in the thread that changes them.

## Decisions taken in YOLO

1. **Four threads, not seventeen.** The grouping is by corner of the tree (below).
2. **"entity" is read as "entry"**: no "entity" text exists; the vacuous explanation is the Entries
   note in `WidgetingsEditor.tsx` ("Entries are typed, and read nothing, so they run first...").
3. **"home" in the Coach's top bar is the realm**: `…/~org/hunt/quizzes/home/{quiz}` -- the
   breadcrumb is logo Triquet / ~org / Hunt title / realm / Quiz title, each a link to its home
   (findings.md's sense), then a spacer, then *New quiz* and *Lock quiz*, then the account.
4. **"Account" is a menu at the far right of the top bar**: an icon button showing who you are;
   its menu holds the ident (`IdentTitle`, @label), *Be someone else* (`Routes.switchIdentPath()`),
   and *About* (moved out of the bar). Built as a standard component, `AccountMenu`.
5. **"Drag handles" on the export boxes means a resize grip** (the box can be dragged taller).
   If the worker finds the Coach plainly meant dragging the text out as a file, it records that
   and does the other.
6. **"correct pct" becomes a generic entry kind, `percent`**, offered next to `number` in the kind
   picker (a number from 0 to 100, shown with `%`). The Coach's own `correct_pct` widget and the
   recap's default template keep their label; relabelling the Coach's data is theirs.
7. **The quiz export carries what a duplicate needs**: the quiz's fields, questions, columns,
   widgetings and their params, templates and recap parts, *and the library widgets its
   widgetings use* (so it imports on a login whose library lacks them) -- but no quiz label, so
   import makes a new one. The importer takes it back.

## Threads

Wave one, side by side: 1, 3 and 4. Then 2, after 1 lands.

### 1. Gearbox: the (i) facility, the entries note, one remove-with-confirm, unique ids

*Coach's text:*

> 1. explanatory text like the block under "Columns" in the quiz gearbox: move them onto an "(i)"
>    information facility. (That should be a standard component)
> 2. the explanation for "entity" is vacuous, remove. Put a horizonttal line between entries and
>    widgets when there are both.
> 5. make remove column visually consistent (make a uniform component that does the <button, with
>    confirm in the same place> behavior)
>
> * adding a new column brings on two elements with the name "categories". ids should be scoped by
>   their parents' id chain

Gloss:
* **`InfoTip`** (a name the worker may better from the vocabulary): a standard component, an
  `InfoOutlined` icon button beside a heading whose `Tooltip` (or `Popover`, if the prose has
  links) holds the explanation; opens on hover and on click/tap; keyboard-reachable; one size.
  Extract it from the inline one in `panels/LeagueExport.tsx:60-64` and use it there. Move the
  gearbox's `microcopy` paragraphs (`QuizManageModal.tsx`: Columns, Widgetings, Templates,
  History, Hunt, Archived questions) onto it beside their headings. Helper texts on fields
  (`ColumnFields.tsx`, `WidgetingPanel.tsx`) that are *explanation* rather than *validation
  feedback* move too; error/validation helper text stays. Leave `panels/ExportImportPanel.tsx`
  and `RawExport.tsx` alone (thread 3 is rewriting them); thread 2 sweeps up what is left.
* Remove the Entries note; a `Divider` between the Entries list and the Widgetings list when both
  have members.
* **One remove-with-confirm component**: a button that, clicked, becomes its own confirmation in
  the same place and footprint ("Remove *x*?" Yes / Keep), and reverts on Keep, blur or Escape.
  Generalise `ConfirmRemove.tsx` (it is close) so every inline remove uses it: columns,
  widgetings, and the archived questions' delete, which has no confirm at all today. It offers an
  icon-button form and a text-button form at the same size as each other's confirm. `DangerZone`'s
  type-to-confirm is a different, deliberate gesture: leave it.
* **The duplicate "categories"**: reproduce in the browser first (+ New column in the gearbox).
  The likely cause is `lib/column-menu.ts:43-53`, which lists the bag words (`quiz, hunt, realm,
  categories, qns`) *and* every widgeting label, so a widgeting labelled `categories` appears
  twice, and the keys collide (`ColumnFields.tsx:65`, `RefPicker`'s Autocomplete). The Coach's
  rule, "ids should be scoped by their parents' id chain": make DOM ids and React keys in the
  column and widgeting editors derive from their parents' (quiz, column) chain, and make the
  menu's two sources distinct (dedupe, or tell a bag word from a same-named widgeting). Whether a
  widgeting may be labelled with a bag word at all is a question for the Coach, not this thread.

Depends on: nothing. **Look-ahead:** thread 2 rebuilds the widgeting and column title rows and
puts the remove button and `InfoTip` into them; design both components so they sit in a dense
row (small, icon form) as well as a form's foot. Thread 3 uses `InfoTip` for the panels' blurbs
once it has landed, if it lands first.

### 2. Gearbox: the widgeting and column rows line up, with an icon grammar

*Coach's text:*

> 3. the elements of the widgetings editor are ragged -- don't line up vertically
>   - push the label onto the next row, sometimes it rides
>   - use an icon grammar for formula (sigma or beaker or something) , bot (robot)
> 4. make the title block of the columns edit short block the same width as the widgeting title
>    element. Move "Templated" into that row. Templated and collapsed should be click-to-set icon
>    buttons
>   - the datatype button in that row is in-place state: text (abc icon), markdoown (quill), code
>     (</>), label (tag iton)
>   - when the box is not folded, these become full controls at their natural location

Gloss:
* **Widgeting rows** (`WidgetingPanel.tsx:179-191`, the 220px label box, the tier chip, the
  FoldedLine): a fixed grid of columns so every row's parts line up, whatever their length; the
  label always on its own second line, never riding the first. An icon per formulary at the
  row's head -- formula (`Functions`, the sigma, or `Science`), bot/prompt (`SmartToy`), entry,
  and the rest of `FormularyWords` -- with the noun in its tooltip. One icon map in
  `widget-words.ts`, so the library and the Widgets panel can share it.
* **Column rows** (`ColumnsEditor.tsx:127-142`): the title block the same width as the widgeting
  title block (a shared width constant, or a shared row component if it falls out). In that row,
  folded: *Templated* and *Collapsed* as click-to-set `IconButton`s (or `ToggleButton`s) with
  tooltips, and the readout (datatype) as one in-place icon button that cycles default / plain
  (`Abc`) / markdown (a quill: `HistoryEdu` or `Draw`) / code (`Code`) / label (`Sell` or
  `LocalOffer`). Unfolded: these become the full controls at their natural places in the fold
  (the Readout select, the Collapsed switch, the Templated checkbox), and leave the title row.
* **Templated is per quiz, by source**: `quiz.templateable` lists the nominated source keys
  (`TemplateableEditor.tsx`, action `set_templateable`; #209 retired the old `templated`). The
  column's icon toggles its source's membership through the same action the Templates section
  dispatches; the two stay one state. *Orchestrator:* corrected after #209.
* Sweep: any explanatory prose thread 1 left outside the gearbox moves onto `InfoTip`.
* Double-click on a column or widgeting title to toggle its fold, if thread 3's fold cycle makes
  that natural; skip where the title is a text field. *Orchestrator:* thread 3's is
  `src/components/use-fold.ts` (`FoldT`, `nextFold`, `useFold`), landing beside you.

Depends on: **1** (its components, and the same lines). **Look-ahead:** none later.

### 3. Panels: the fold cycle, the raw export, the quiz export, the tabs

*Coach's text:*

> * Double clicking the title of a folded panel (and probably other things) should rotate folded -
>   open - embiggen - folded.
> * clicking the embiggen arrows should fully embiggen -- a "big but folded" state is useless
> * on the raw export screen, have the button be where it usually is; occupy the space of the text
>   box with a blank box and a fine outline half the height of what it will become
>   - the export boxes should have drag handles
> * change title of the library tab to "Widgets"
> * On Raw export, also add the ability to export questions -- quiz, including collumns and
>   widgetings, but no label. Include everything else interesting that I would want to use to
>   duplicate one quiz into another on a different login or device
> * swap places of "recap" and "Quiz Entries"

Gloss:
* **The fold cycle** (`panels/Panel.tsx:43-70`): today two booleans, `open` and `widened`. Make one
  three-state fold, `folded | open | big`, with double-click on the title cycling folded -> open
  -> big -> folded, and the embiggen arrows going to `big` from either `folded` or `open` (and the
  shrink arrows to `open`). Build it as a small hook or type others can use ("and probably other
  things": the gearbox's section panels, if they are `Panel`s; thread 2 may reach for it).
  `Panel.tsx:50` builds a DOM id from the title (`panel-${title}`), which collides when two
  panels share one: scope it (thread 1's rule).
* **Raw export** (`RawExport.tsx:118-136`, `ReadonlyBox.tsx`): before preparing, the button sits
  where the box's actions sit after; the box's place is held by an empty, finely outlined box half
  the height the filled one will be. The export boxes get a resize grip (Decision 5).
* **Quiz export** (Decision 7): a second export on the Raw export screen, of the current quiz.
  `src/lib/exporting.ts` has `quizBall` and `quizBodyOf`; extend rather than duplicate, and prove
  the round trip: export a quiz, import it into another hunt (on a fresh backend), and see its
  questions, columns and widgetings come back. A unit test of the ball's shape and an e2e of the
  round trip if one is cheap.
* Rename the *Library* tab to *Widgets* (`ExportImportPanel.tsx:68`, its blurbs, the comments in
  `Panels.tsx`). There is already a panel titled *Widgets* (`WidgetsPanel.tsx`): say in the thread
  file whether the two now read as confusingly alike, and suggest a fix if so.
* Swap *Recap* and *Quiz Entries* in `Panels.tsx:137-151`.
* Explanatory blurbs on the screens this thread rewrites go onto thread 1's `InfoTip` if it has
  landed by then (`pnpm catchup`); otherwise leave them as they are for thread 2's sweep.

Depends on: nothing. **Look-ahead:** the fold-cycle hook is the one others may reuse.

### 4. The top bar, the account, and small removals

*Coach's text:*

> * in the top bar, have it be `hat Triquet / ~mrflip / Hunt Title / home / Quiz Title  .... (new
>   quiz) (lock quiz)` -- basically moving the second of the three navbars into the topmost one.
> * get rid of the little (quiz) pill to the left of the quiz title on the smith screen
>  - also, the "Your hunts" button at the bottom of the categories screen
> * add a standard feature in the top right for "account".
> * Change "correct pct" to instead just generically be "percent", next to number

Gloss:
* **One top bar** (`SiteHeader.tsx` gains what `QuizSwitcher.tsx:178-201` holds): breadcrumbs per
  Decision 3, the quiz title being the switcher (a menu of the realm's quizzes, as the native
  select is now), then *New quiz* and *Lock quiz* at the right, then the account (Decision 4). On
  pages without a quiz the bar stops at the deepest level it has. The second bar goes. Mind
  narrow widths: the crumbs truncate before the buttons do. Read `findings.md` first.
* Remove the *Quiz* pill (`QuizHeader.tsx:99`, its CSS if now unused) and the *Your hunts* link
  at the foot of the categories screen (`CategoriesRoute.tsx:87-89`); the error pages' *Your
  hunts* links stay.
* **`AccountMenu`**, standard, at the bar's right on every page (Decision 4). Lift `IdentTitle`
  out of `HuntsList.tsx` if the menu needs it; the hunts page's own "You are ..." line may stay.
* **`percent`** (Decision 6): a new entry kind beside `number` in `models/widget.ts`
  (`EntryKindVals`, its params, its validators, its names and words in `widget-words.ts`), with a
  cell editor and readout (react-number-format, as `number` uses, with a `%` suffix and 0-100
  bounds by default). Check first whether the kind list reaches `convex/schema.ts`; if it does,
  the push is a widening -- say so.

Depends on: nothing. **Look-ahead:** none later.

## For the Coach

* Decisions 2-7 are readings of terse asks; each is a two-way door, and each thread records what
  it built so it can be turned around.
* Whether a widgeting may be labelled with a bag word (`categories`, `quiz`, ...) is yours (thread
  1 makes the editor cope either way).
