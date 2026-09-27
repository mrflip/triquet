# Hunts, idents and reviews: the playtester milestone

Status: plan, 2026-09-27, agreed with the Coach (Flip). For the implementing agent.

**Progress:** PRs 1 (bots, `20260927-bots`) and 2 (idents and hunts, `20260927-hunts`) are
built and committed, neither merged nor deployed. PR 3 starts from `20260927-hunts`. Read
`whiteboard/hunts-and-idents-handoff.md` first: it records where the build departs from this
plan (reads are scoped to the open hunt; the history is keyed by the quiz's hidden id, its files
by hunt, realm and quiz label) and what alpha.56 taught. Where this plan and the handoff
disagree, the handoff is newer.

The goal is narrow: within a week, a couple of friends open a link, say who they are, and
review one quiz without stepping on the author's work. Everything here is the first cut of the
model sketched in `notes/future-models.md`, shaped so that roles, creds and real authorization
bolt on later rather than rework it. **Everything starts wide open**: roles and permissions are
the last two pull requests, not the first.

Read first: `CLAUDE.md`, `STYLE.md`, `notes/vocabulary.md`, `notes/guidelines.md`,
`notes/decisions/2026-09-jazz.md`, `notes/decisions/2026-09-path-routing.md`,
`notes/deploy.md`, `notes/future-models.md`, and the `jazz` skill. Work from the installed
`jazz-tools` (2.0.0-alpha.56), never from memory.

## Decided with the Coach

* **Wide open first.** Every hunt table is readable and writable by every account until PR 6.
  Membership and roles (PR 5) and then permissions (PR 6) come after the reviewers are reviewing.
* **Realm** is the middle segment between hunt and quiz. Where you meet *puzzle* in the notes:
  if it scopes something, it means realm; if it is the not-soon idea that quizzes may come in
  other shapes, it is puzzle and is not this milestone.
* **The existing data is not carried.** The Coach has the questions and the git repository
  backed up and will re-import by hand through the Import panel (merges by question label; no
  change needed). Migrations may drop and recreate freely.
* **Production is not behind Vercel Deployment Protection** (checked in an incognito tab).
* **A logged-out visitor goes to the login screen**, types an ident label, becomes that new or
  old ident, and is sent back to the route they asked for.
* Assumed and not contradicted: the ident label is the label alphabet (lowercase letters,
  digits, underscore, letter first) at 6..24 characters, normalised from what is typed; the
  current ident is recorded as a row (an identing), not in browser storage.

## What we are building, in one paragraph

A visitor lands anywhere, is sent to `/` if they have no ident, types an ident label (and a
title), becomes that ident, and is sent back. `/` with an ident goes to `/my/hunts`. A hunt
holds one realm `home` and one quiz, and lives at `/h/<hunt>/<realm>/<quiz>`. The path names
the resource; `?act=smith` or `?act=review` names the presentation. A smith sees today's
Workbench. A reviewer sees the review screen: every question's clueing, its chained BUT NOT, its
answer behind a lock, and fields for what they made of it, plus an overall note; nothing of it
reaches the smiths until the reviewer shares it. Later, hunts get members with roles, and later
still the server enforces them. Along the way the model bots that answer questions stop being
called *players*, freeing that word for humans.

## Vocabulary (add to `notes/vocabulary.md`)

* **ident** -- a persona in the app, named by a global label a person types to become it. No
  password: anyone may assume any ident, for now. Has a `title` for display.
* **identing** -- one account taking on one ident. The account's newest identing is its current
  ident. (Later, a cred will be the thing an identing hangs off.)
* **hunt** -- the unit of URL scope and, later, of membership: has realms and expressions.
* **realm** -- a division of a hunt, holding quizzes. Every hunt starts with one, `home`.
* **review** -- one ident's review of one quiz: an overall note and a **phase** (`empty`,
  `draft`, `shared`). Hidden from the smiths until shared.
* **reviewing** -- one review's verdict on one question: get rate, guesses, comments, minutes,
  and three flags.
* **hunting** (PR 5) -- one ident's membership of one hunt, with a **role**: `smith` or
  `reviewer`.
* **bot**, **botting** -- what *player* and *playing* were: a model with a brief that can be
  put a question (dumdum, numnum), and one time it was. *Player* is now reserved for a human
  taking the quiz; the prompts have always used it that way.
* **act** -- the presentation a URL asks for: `smith` or `review`.
* **workspace** -- retired. See *Whether the workspace survives*.

## Sequencing: six pull requests

Each carries its own migration (`./scripts/doppledo dev_claude ./scripts/jazz_migration` at
every commit-able milestone; stop and raise it if the tool writes something you don't recognise).
The Coach deploys each to production with `jazz_deploy` under `prd_janitor` before merging, per
`notes/deploy.md`; agents never deploy production.

1. **Bots.** The rename, alone. Mechanical, one migration. First, so its diff does not tangle
   with the second PR's, which rewrites the same schema and state files for other reasons.
2. **Idents and hunts, wide open.** Schema, models, state, routes, the login gate, `/my/hunts`,
   the smith view (the Workbench, re-homed). No roles: every hunt lists for everyone and `act`
   defaults to `smith`.
3. **Reviews.** The `reviews` table and the review screen's first form: the questions, the
   overall note, a share button. This is what the friends use on day one.
4. **Reviewings.** The per-question verdicts and the full review screen, with the answer lock.
5. **Huntings.** Members and roles: the creator is a smith, smiths add idents, `/my/hunts`
   filters by membership, `act` redirects by role, a members panel.
6. **Permissions.** The policy that enforces PR 5 on the server.

PRs 3 and 4 could be one; keep them apart so a reviewer can start on the overall note while the
per-question screen is being built.

## PR 1: players become bots

Every identifier, file, table, column and enum value that says player/playing/players/playings
becomes bot/botting/bots/bottings. Case-preserving, everywhere `grep -ri player src tests e2e`
finds it. The one exception: **prose meaning a human quiz-taker stays**, chiefly the prompt
templates in `lib/ask/prompts.ts` ("a reasonable player would add up"), which `vocabulary.md`
already notes are addressed to the model as if it were a human player. Judge each hit.

Concretely:

* Schema: table `playings` -> `bottings`; column `player_label` -> `bot_label` (on `widgets` and
  `bottings`); widget `kind` value `playing` -> `botting` (`WidgetkindVals`); relation
  `questions.playings` -> `questions.bottings`; row types `PlayingRow` -> `BottingRow`.
* Models: `player.ts` -> `bot.ts` (`BotValidators`, `SeedBots`, `BotT`), `player-label.ts` ->
  `bot-label.ts` (`BotLabelVals`, `BotLabel`), `player-status.ts` -> `bot-status.ts`,
  `playing.ts` -> `botting.ts` (`BottingValidators`, `BottingT`, `BotSlot`, `BotSlots`,
  `slotkeyOf` unchanged). In `widget.ts`, `PlayingWidget` -> `BottingWidget`; in `layout.ts`,
  `DefaultPlayings` -> `DefaultBottings`.
* Lib: `lib/ask/players.ts` -> `lib/ask/bots.ts` (`botFor`, `botStatuses`); `lib/players/port.ts`
  -> `lib/bots/port.ts` (`fetchBotStatuses`); `lib/notices.ts` (`botUnavailableNotice`).
* Route handler: `app/api/players` -> `app/api/bots`; `BotsRoutepath`. This is the second server
  function that already exists beside the ask route; renaming it is not adding one.
* State: `use-players.ts` -> `use-bots.ts` (`useBots`, `BotForAskkind`); action kinds and
  patches in `actions.ts`, `quiz-actions.ts`, `quiz-writing.ts`, `quiz-rows.ts`
  (`HeldPlaying` -> `HeldBotting`, `askedAt`), `widget-edit.ts`.
* Components: `cells/guess.tsx`, `cells/ishes.tsx`, `WidgetsEditor.tsx`, `QuizManageModal.tsx`,
  `Footnote.tsx`, `Workbench.tsx`, and any UI copy that says "player" of dumdum or numnum.
* Tests and e2e mirror the moves (`e2e/players.spec.ts` -> `bots.spec.ts`).
* Docs: `vocabulary.md` (the *Players* section becomes *Bots*; add the reservation of *player*
  for humans), the enum list in the table in `notes/deploy.md`, `notes/stack.md` if it mentions
  players.
* `quizgit.ts` and `sheets.ts` name columns in the `.qq.tsv` history table and in sheet exports.
  Rename those headers too: old mirrors live in old browsers and nothing reads them back.

The seeded bots keep their labels `dumdum` and `numnum`, their titles, and every prompt. The
widget labels a quiz starts with (`dumdum`, `numnum_clueing`, `numnum_hint`) do not change.

Migration: a table rename in Jazz's migration DSL is a drop and a create; data in `playings` is
not carried. Agreed.

## PR 2: idents and hunts, wide open

### Schema (`src/db/schema.ts`)

New tables, each with its `Validator` block and DNA/Real types in `src/models/` (one file per
noun: `ident.ts`, `identing.ts`, `hunt.ts`, `realm.ts`):

```
idents      { label: string, title: string }
identings   { ident_id: uuid }                                             rel ident
hunts       { label: string, forced_label?: string, title: string }
realms      { hunt_id: uuid, label: string, title: string, position: int }   rel hunt; reverse quizzes
```

Changed tables:

* `quizzes.workspace_id` -> `realm_id` (`rel('realms', 'realm_id')`). Everything else stays.
* `expressions.workspace_id` -> `hunt_id` (`rel('hunts', 'hunt_id')`). An expression is the
  hunt's, so every quiz in the hunt, and every reviewer's browser, can compute its columns.
* `workspaces` is dropped, and its reverses with it.

Reverses to declare: `hunts.realms`, `hunts.expressions`, `realms.quizzes`, `idents.identings`.
Keep every read flat regardless (one query per table, no `include`); the reverses are for the
coherence test and for later.

The coherence test (`tests/db/coherence.test.ts`) and `tests/db/schema.test.ts` grow a case per
new table. Row validators: `identLabel` is a new pattern in `lib/vv/patterns.ts`:

```
Identlabel = { re: /^[a-z][a-z0-9_]*$/, min: 6, max: 24, msg: '...' }
```

with a model test at 5, 6, 24 and 25 characters. Hunt, realm and quiz labels use today's
`label` shape.

### Label scopes

* **ident label**: global. Looked up by label across every ident the browser can read.
* **hunt label**: global. Minted at creation (`Labelmaker.localBlankLabel(existingHuntLabels,
  mintId())`), titleized into the initial title, overridable later through `forced_label` the
  way a quiz's is today. Never typed at creation.
* **realm label**: unique within a hunt. Only `home` exists; no UI makes or deletes one.
* **quiz label**: unique within a realm. Made, relabelled and minted as today, but the sibling
  set is the realm's quizzes rather than the workspace's.

Local-first cannot enforce global uniqueness. Two visitors who mint or type the same label in the
same moment make two rows with one label. For hunts the labels are random; for idents accept the
race and take the earliest by `$createdAt` when resolving. Do not build a check for it.

### Permissions (`src/db/permissions.ts`), wide open

Rewrite wholesale; the doc block says this is the trial's open door and points at PR 6.

* `identings`: all four actions `.where(ownAccount)`. The one private table.
* `idents`: `allowRead.always()`, `allowInsert.always()`, `allowUpdate.never()`,
  `allowDelete.never()`.
* `hunts`, `realms`, `expressions`, `quizzes`, `widgets`, `columns`, `questions`, `bottings`
  (and in PRs 3 to 5, `reviews`, `reviewings`, `huntings`): all four `.always()`.

The policy builder offers `always()` and `never()` beside `where()` (see
`node_modules/jazz-tools/dist/permissions/index.d.ts`, `ActionBuilder`). `$createdBy.account`
no longer means ownership of anything but an identing.

`tests/db/permissions.test.ts` is rewritten to state the new rules: two accounts each read and
change what the other wrote in a hunt; an identing is invisible across accounts; an ident cannot
be updated or deleted by anyone. Keep `sessionFor` and `openTestApp` from `tests/support/jazz.ts`.

### Models and projections

* `models/workspace.ts` goes. Its `Workspace.blank()` job (a quiz with the standard layout and
  the seeded expressions) moves to `Hunt.blank()`, which returns the whole tree a new hunt
  writes: hunt, one realm `home` titled `Home`, one quiz labelled and titled like the hunt, the
  seeded expressions, the default widgets and columns. `expressionUsage` moves to `hunt.ts`.
* `HuntT` is the tree the views read: `{ id, label, forced_label, title, realms: RealmT[],
  expressions: ExpressionT[] }`; `RealmT` holds `quizzes: QuizT[]`.
* `state/quiz-rows.ts`: `AccountRows` becomes `HeldRows` (every row this browser can read, which
  is now everyone's), and `workspaceFrom` becomes `huntFrom(rows, hunt_id)`. `quizRowsOf` is
  unchanged. Its doc block's "an account's rows are its own, so this is small" is no longer true;
  say instead that the trial's data is a few friends' hunts. Scoping subscriptions per hunt is a
  *Later* item in `notes/stack.md`, not this PR.
* `state/quiz-writing.ts`: `writeWorkspace` becomes `writeHunt`; quiz writing takes a
  `realm_id`; expression writing takes a `hunt_id`.
* `state/perform.ts`: `OpenQuiz` becomes `{ hunt_id, realm_id, quiz_id }`. `WorkspaceAction`
  becomes `HuntAction`. `open_quiz` and `active_quiz_id` are deleted: the address is the only
  thing that says which quiz is on screen. `replace_workspace` becomes `replace_hunt` (what
  Import of a whole export does).
* New actions: `new_hunt` (writes `Hunt.blank()` in one transaction), `assume_ident { label,
  title }` (finds or inserts the ident, then inserts an identing). `new_quiz` takes the realm
  from `open`.
* `models/import.ts` and the Export panel: Export emits the hunt tree (what the workspace
  export was). Import of questions into the open quiz is unchanged and is the Coach's transfer
  path.

### Reading rows and resolving labels (`state/use-hunt.ts`, replacing `use-workspace.ts`)

Subscriptions stay one per table with `useAll(app.<table>, LocalFirst)`, plus the new tables.
`useHunt(labels: { hunt, realm, quiz })` resolves each label against the rows and returns
`{ hunt, realm, quiz, ident, loaded, dispatch, unsaved, saveNotice }`.

The current ident is `useIdent()`: the account's newest identing (`app.identings.orderBy
('$createdAt')`, own-account rows only), joined to its ident.

**A fresh browser's local database is empty until the first sync.** Jazz in this build has no
client-side "hydrate these rows first" hook; its only seeding is for server rendering, which
this app does not do (`react-core/use-all.d.ts`). What it has is read tiers (`runtime/client.d.ts`,
`ReadTier`): `remote` waits for the server's answer, `remote-if-possible` falls back to local
knowledge only after an explicit disconnect. So the login gate's ident lookup and a deep link's
first resolution of a hunt label do one read at `remote-if-possible` under `withTimeout(...,
ServerLookupMillis)` before concluding "no such thing", exactly as `findOrMakeWorkspace` in
`quiz-actions.ts` does today. Lift that into a helper (`state/lookup.ts`, say: local read, then
remote read, then a verdict) and use it in both places. The subscriptions carry on from there.
Working with the network off still works: a browser that has synced once has the rows.

### Routes (`src/lib/routes.ts`, `src/app/`)

* `/` -- `IdentGate`, the login screen. With a current ident: `router.replace` to `?then=` when
  a deep link sent the visitor here, else to `/my/hunts`. Without: a form with *Ident label* and
  *Title* (MUI `TextField`s, a `Button`), the label normalised on the way in
  (`Labelmaker.normalize`) and checked by the ident validator, the title defaulting to
  `Labelmaker.titleize(label)` when blank and ignored when the ident exists. Submitting
  dispatches `assume_ident`, waits for it, then navigates. Replaces `OpenQuizRedirect`.
  `then` is validated as a same-origin path (starts with `/`, no scheme) before it is followed.
* `/my/hunts` -- `HuntsList`. In this PR, every hunt there is: its title, and under it the
  quizzes of its realms as links to `/h/<hunt>/<realm>/<quiz>`. A *+ New hunt* button dispatches
  `new_hunt` and navigates to the new quiz. No ident: redirect to `/?then=/my/hunts`. PR 5
  filters this to the ident's memberships and shows the role.
* `/h/[hunt]/[realm]/[quiz]` -- `QuizPage`, thin: reads the three segments with `useParams`
  and `act` with `useSearchParams` (wrap in `Suspense`, as the App Router requires; the
  `material-ui-nextjs` skill notes it), hands off to `QuizRoute`.
  - No ident: redirect to `/?then=<this path and query>`.
  - Any label unresolved (after the remote read): a `NoSuchQuiz` notice naming what was asked
    for. `QuizNotFound`'s "make a quiz called…" offer is dropped; making quizzes lives in the
    smith view's switcher.
  - `act` absent: `router.replace` to `?act=smith`. PR 5 makes this depend on the role.
  - `act=smith` -> `Workbench`; `act=review` -> `ReviewScreen` (PR 3).
* `/my/quiz/*` and `OpenQuizRedirect` are removed. Old links break by decision.
* `routes.ts` exports `rootPath(then?)`, `huntsPath()`, `quizPath({ hunt, realm, quiz }, act?)`.
  Add `notes/decisions/2026-09-resource-urls.md`, three paragraphs: the path names the resource,
  the query names the presentation, and why (a link a smith pastes to a reviewer should open the
  right view for whoever opens it). Amend `2026-09-path-routing.md` to say the address is now
  three segments and that the "workspace's `active_quiz_id` follows along behind" paragraph no
  longer applies.

The Workbench keeps its rule that navigation is a transition: `QuizSwitcher`, `new_quiz`,
`delete_quiz` and relabel all navigate to `quizPath(...)` with `act=smith`. The `open_quiz`
effect at `Workbench.tsx:64-66` is deleted along with the action. The switcher lists the
realm's quizzes.

### Quiz history mirror (`state/quiz-mirror.ts`, `lib/quizgit.ts`)

*As built:* the history follows the quiz, so its repository's storage folder stays keyed by the
quiz's hidden id (a relabel is a new label on the same thing). The files inside are by label:
`tq/hunt/<hunt>/realm/<realm>/quiz/<quiz>.{qq.tsv,tq.json}`, the hunt's expressions at
`tq/hunt/<hunt>/<hunt>.tqexpressions.json`. Old repositories are not migrated. A reviewer's
browser mirrors the quizzes it opens, which is harmless and matches the mirror's job as an exit
door.

### Migration

One migration: drop `workspaces`; create `idents`, `identings`, `hunts`, `realms`; alter
`quizzes` (`workspace_id` -> `realm_id`, relation) and `expressions` (`workspace_id` ->
`hunt_id`, relation). Let `jazz_migration` write it and check it says exactly that.

### Tests

* Models: `ident` (label bounds; normalisation is the gate's job, not the validator's), `hunt`
  (`Hunt.blank()` has one realm `home`, one quiz sharing the hunt's label and title, the seeded
  expressions), `realm`, `identing`.
* `tests/state/perform.test.ts`: `new_hunt` writes every row in one transaction; `assume_ident`
  finds before it makes, and makes an identing either way; the quiz actions carry on under
  `realm_id`. `tests/support/jazz.ts`: `seedWorkspace` becomes `seedHunt(testApp, Hunt.blank())`.
* `tests/state/quiz-rows.test.ts`: `huntFrom` projects realms in position order and quizzes in
  creation order.
* `tests/lib/routes.test.ts`: the three helpers, and that `then` refuses an absolute URL.
* `tests/db/permissions.test.ts`: as above.
* e2e: `support.ts` gains `assumeIdent(page, label)` and `newHunt(page)`; every spec that today
  starts at `/` and expects a grid first assumes an ident and makes a hunt (a shared fixture in
  `e2e/environment.setup.ts` or a `beforeEach` helper; keep it to one place). `routing.spec.ts`:
  `/` without an ident shows the gate; with one redirects to `/my/hunts`; a deep link without an
  ident bounces through `/` and returns to the same path and query; `act` absent redirects to
  `smith`. **The proof of the milestone**: a second `browser.newContext()` (a second local-first
  account) assumes another ident, opens the pasted link, and sees the first's questions, all
  against the local Jazz server on 3202.

## PR 3: reviews

### Schema and model

```
reviews  { quiz_id: uuid, ident_id: uuid, overall: string, phase: enum(empty, draft, shared) }   rel quiz, ident
```

`models/review.ts`: `overall` is `noteish`, may be empty; `ReviewPhaseVals = ['empty', 'draft',
'shared']`. One review per (quiz, ident): the actions upsert, never duplicate. Migration.

### Behaviour

* A review row is made, phase `empty`, when the reviewer first opens the review screen for a
  quiz. The first write to `overall`, or (PR 4) to any reviewing of it, moves it to `draft`.
  Nothing moves it back to `empty`.
* *Share with the smiths* sets `shared`; *Withdraw* sets `draft`. Edits after sharing stay
  shared: it is live, not a snapshot.
* Smiths see only `shared` reviews. In this PR that is a client-side filter (the rows are
  readable by everyone); PR 6 makes the server enforce it.

### Actions

`open_review { quiz_id }` (upsert the empty row for the current ident), `set_overall
{ quiz_id, overall }` (writes and sets `draft` unless already `shared`), `set_review_phase
{ quiz_id, phase: 'draft' | 'shared' }`.

### Views

* `components/ReviewScreen.tsx` (`act=review`): the quiz title; each question in rank order as a
  read-only row showing Q#, clueing, the chained BUT NOT (the chained-to question's hint, as
  `ButnotPreview` in `cells/chain.tsx` shows it; nothing when unchained) and the answer behind
  the lock (below); then the *Overall* field (`TextField multiline`), saved through `dispatch`
  on commit like every field, with the same `unsaved` marker the Workbench sets on `main`
  (`data-unsaved`, which e2e waits on); then the share and withdraw buttons and a line saying
  which phase the review is in. In PR 3 the per-question row has no fields of its own yet.
* `components/panels/ReviewsPanel.tsx` under the smith's grid: every shared review of the open
  quiz, one block per reviewer (ident title, overall verbatim). Read-only. PR 4 adds the
  per-question table to each block.

### The answer lock

The answer (`full_answer`) is present in every row but hidden behind a lock: an `IconButton`
showing 🔒 (an emoji in a `Typography`/`span`, not an icon font). Clicking it opens a MUI
`Dialog` asking to confirm ("Reveal the answer? Your get rate for this question will then be a
guess at what you'd have done."). Confirming shows the answer with a small 🔓 `IconButton`
beside it that hides it again without asking. Unlock state is per row and per session; it is
not stored, except that PR 4 records `peeked` on the reviewing when the answer is first revealed.

### Tests

Model (phase enum, `overall` bounds); `perform.test.ts` (`open_review` is idempotent,
`set_overall` moves `empty` to `draft` and leaves `shared` alone, `set_review_phase` both ways);
e2e: the second context's reviewer writes an overall note, the smith's panel shows nothing,
the reviewer shares, the panel shows it; the lock asks before revealing and the small lock
hides again.

## PR 4: reviewings

### Schema and model

```
reviewings { review_id: uuid, question_id: uuid,
             get_rate?: int, guesses: string, comments: string, minutes?: float,
             keep_it: boolean, needs_fact_check: boolean, elimination_candidate: boolean,
             peeked: boolean }                                   rel review, question
```

`models/reviewing.ts`: `get_rate` is an integer 0..100 or null ("how likely I'd have got it");
`guesses` is `noteish` (what they guessed, freeform); `comments` is `textish` (long prose, the
one field that may grow the row); `minutes` is a non-negative number or null, decimals allowed
(approximate minutes spent); the three flags are booleans, false by default; `peeked` is set
true the first time the answer is revealed and never cleared, so a smith can tell a blind get
rate from a seen one. One reviewing per (review, question): upsert. Migration.

### Actions

`set_reviewing { quiz_id, question_id, patch }` upserts the current ident's reviewing for the
question (the patch pattern from `notes/guidelines.md`: a key absent leaves the field), and
moves the review from `empty` to `draft`. `peek_answer { quiz_id, question_id }` sets `peeked`.
Rows are made lazily, on the first commit to that question's row, so a question added later
simply has no reviewing until the reviewer touches it, and opening the screen writes nothing.

### The review screen, complete

Each question's row now carries, after the clueing, BUT NOT and locked answer: *Get rate*
(a number field 0..100, like `QnumField` with the spinner suppressed), *Guesses*, *Comments*,
*Minutes*, and three emoji toggles (MUI `ToggleButton`, each with an `aria-label`): 👍 *keep
it*, 🔍 *needs fact check*, ✂️ *elimination candidate*.

**Row height** follows the grid's rule in `QuestionRow.tsx`: the clueing and the comments are
`GrowingField`s from `cells/fields.tsx` and report their natural height; the row takes the taller
of them, floored and capped as the grid does; every other text box in the row is a
`StretchField`, stretched to that height but never allowed to decide it (the way Alt Text
behaves). Reuse those two components; do not write a third.

`ReviewsPanel` gains, per shared review, a compact table of its reviewings by rank: title, get
rate (marked when `peeked`), minutes, the flags as their emoji, guesses and comments verbatim.
Read-only.

### Tests

Model bounds (get rate 0, 100, 101, -1; minutes 0, 2.5, -1); `perform.test.ts` (`set_reviewing`
upserts and moves the review to `draft`; a patch leaves absent fields alone; `peek_answer` sets
`peeked` once); e2e: the reviewer fills a row, the comments field grows the row and the guesses
field does not, the smith sees the row after sharing.

## PR 5: huntings

```
huntings { hunt_id: uuid, ident_id: uuid, role: enum(smith, reviewer) }   rel hunt, ident
```

* `new_hunt` also writes a `smith` hunting for the current ident. `add_hunting { ident_label,
  role }` resolves the label among readable idents, refuses an unknown one with a notice (*No
  ident is labelled "…". They need to visit the app and choose it first.*), and replaces the
  role of an existing hunting rather than duplicating. `remove_hunting { ident_id }`, not for
  oneself.
* `HuntT` gains `huntings`; `useHunt` returns `role` (the current ident's, or null).
* `/my/hunts` lists only hunts with a hunting for the current ident, with the role.
* `QuizRoute`: no hunting -> *You are not on this hunt. Ask a smith to add `<ident label>`.*
  `act` absent -> `smith` for a smith, `review` for a reviewer. `act=smith` as a reviewer ->
  the same notice, phrased for the role. Client enforcement until PR 6.
* `components/panels/MembersPanel.tsx`, smith view only: a table of huntings (ident title,
  label, role, remove) and a row to add one (label field, role `Select`, *Add*).
* Tests: model; `perform.test.ts` (creator is a smith; add replaces; remove refuses self);
  `routing.spec.ts` (redirect by role; stranger notice); e2e where the smith adds the second
  context's ident as a reviewer and it lands on the review screen with no `act`.

## PR 6: permissions

The design, to be checked against the installed source when the time comes; nothing before
this PR should use `exists` or `allowedTo` rules.

* An account's idents are its identings: `session.user.account` -> `identings.$createdBy.account`
  -> `ident_id`. A hunt is *mine* when a hunting on it names one of those idents.
* `hunts`: read where mine; update/delete where mine as a smith; insert always.
* `realms`, `expressions`, `quizzes`, `widgets`, `columns`, `questions`, `bottings`: read where
  the hunt is mine; write where mine as a smith. `huntings`: read where mine; write where mine
  as a smith.
* `reviews`: read where own ident's, or where `phase = shared` and the hunt is mine; write where
  own ident's. `reviewings`: through their review.
* `idents`: as now. `identings`: as now.
* The honour system stays in one respect: any account may still assume any ident, so the policy
  is only as strong as that. Creds close it, per `future-models.md`.
* `tests/db/permissions.test.ts` grows to a smith, a reviewer and a stranger on one hunt.

## Whether the workspace survives

It does not, and nothing of it needs to. It had three jobs:

1. **Hold the quizzes and expressions.** The hunt does that now, and does it for several people,
   which the workspace by construction could not.
2. **Remember which quiz was open**, so `/` had somewhere to go. `/` now goes to `/my/hunts`, and
   the address names the quiz; a memory would fight the path-routing decision.
3. **Be the export shape.** The hunt is the export shape.

What is left is one per-account fact: which ident this account currently is. That is the
identing, and it is not a workspace. Retire the word from `vocabulary.md`, and from the notes
that use it (`2026-09-jazz.md`'s *seams as built* paragraph). Do not keep a `workspaces` table
"for later".

## Concerns the implementer should carry

* **`useSearchParams`** needs a `Suspense` boundary above it or the build fails the page's
  prerender. Put it in `app/h/[hunt]/[realm]/[quiz]/page.tsx`.
* ~~**`in` queries and per-hunt scoping** are not attempted in this alpha.~~ Superseded in PR 2
  (the Coach agreed): whole-table reads could not survive the e2e suite, so everything below the
  directory is read for the open hunt, with `in` lists. New tables (reviews, reviewings,
  huntings) are scoped the same way; see the handoff.
* **The ask route is untouched**: still unauthenticated, still holding no key at present.
  Nothing here changes its guidance.
* **Every browser lists every hunt** (the directory: hunts, realms, quizzes), and the e2e suite's
  local server accumulates them across specs. Specs must not assume the hunts list is empty or
  has one entry; assert on the hunt they made.
* **Two accounts in one e2e spec** is new to the suite: two `browser.newContext()`s against the
  same local Jazz server on 3202. Write the helper once in `e2e/support.ts`.
* **Emoji in buttons** need an `aria-label`; the emoji is the glyph, not the name.
* **Wide open means wide open.** Until PR 5 a reviewer who edits the URL to `act=smith` gets the
  Workbench and can edit. The Coach accepts this for the week; do not add half-measures.
