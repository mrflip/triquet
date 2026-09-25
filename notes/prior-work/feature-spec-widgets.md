# Triquet: feature specification, in layered sprints

A specification written with the benefit of hindsight: it describes the system as it stands after
the work of this long session, in the order it would ideally have been built, with the detours and
reversals taken out. Where a decision was reversed along the way, the reversal is recorded in
[Revisions](#revisions-and-mind-changes) so that nobody re-litigates it.

## Purpose and shape

Triquet is a tool for constructing trivia quizzes, some with "meta" puzzles: a second layer that
appears as first solutions come in. It stores, edits and refines questions, and assesses them for
fairness and difficulty.

The organising idea, stated late in the session but true of all of it: **the base fields of a
question (title, clueing, hint, ...) are the constant; everything else is a widget that a quiz opts
into.** Chaining, number-counting, "does every clue hide an anagram of a team name": these are
specific to one quiz, and reusable by another. A widget is an expression (a formula), a player (an AI
agent's answer), or, later, a built-in module or an external worker. A quiz decides which widgets it
has and which columns show them.

### Values and constraints (from `CLAUDE.md`, applied throughout)

* Empathy, safety, readability. No heroics; prefer the toolkit to the home brew.
* Every new piece of code has a proportional doc block and tests. Validate at module entrypoints;
  no paranoia past them. Progress notes live in `HUMAN-whatsup.md`, never in code comments.
* Nobody uses the app yet: data shapes change without migration *paths* for people, but schema
  migrations are still generated because databases exist on developer machines.
* Agents use `pnpm dev:agent` / `build:agent` and `data/agent.db`; never touch the human's server,
  port or database. Secrets come from the environment (Doppler), never from a file.
* Too-tight validation gives instructive errors early in development; too-loose is the opposite.
  Prefer tight.

### Stack

Next.js 16 (App Router), React 19.3, TypeScript, MUI, Zod 4 through the `Validator` kit, libSQL
(local file) with Drizzle, JSONata 1.8.9, isomorphic-git in the browser, Vitest and Playwright.

---

## Sprint 0: Vocabulary and validators

**Goal.** One set of validators and one naming scheme that everything later uses.

* **String kinds**, from `lib/vv`: `textish` (any characters but control characters; newlines and
  tabs allowed; **not trimmed**; max 3600), `noteish` (as `textish` but trimmed), `titleish` (one
  line, trimmed, max 82), `label` (lowercase letters, digits and underscore; letter first, letter or
  digit last; 2 to 40), `ulid` (26-character lowercase Crockford), `formulaish` (as `textish`, min 1,
  max 999).
* Clueing and hint are `textish`. Full answer, alt text, notes, descriptions, AI replies and error
  messages are `noteish`. A question's `title` is a brief name that may be added to its text, capped
  at 82; the answer lives in `full_answer`.
* **Table column lengths come from the validators' patterns** (`PA.*`), never restated.
* **`Labelmaker.normalize`** turns whatever was typed into a label: deburr, lowercase, collapse every
  run of `[\W_]` to one `_`, trim underscores from the ends, repair to a letter-first, two-plus
  character label, cap at 40. `'Hello, World!'` gives `hello_world`; `'_'`, `'__'` and `' _ '` all
  collapse and repair to a label, never to a bare underscore.
* **Models follow Sketch/DNA/Real/Live.** Callable validators (`Foo.fill`, `FooValidators.foo(dna)`),
  enums lead with `FooVals`.
* **`plain(schema)`** unwraps callable validators (in place, semantics unchanged) so that
  `Z.toJSONSchema` can see through wrapped `.default()` and `.optional()`.
* **Emit JSON with `UU.jsonify`** (sorted keys) wherever JSON leaves the program.

**Acceptance.** Validator tests cover each kind's accept/refuse table and its length cap; a test
holds every table length to its pattern; `normalize` has the collapse cases above.

---

## Sprint 1: Persistence

**Goal.** Move from browser storage to a real database without changing what the author sees.

* **libSQL in local-file mode** (`file:data/triquet.db`; `file:data/agent.db` for agents; `:memory:`
  for tests). `openDb(url)` accepts only `file:` and `:memory:`, runs the Drizzle migrations from
  `/drizzle`, and rewrites seeded players on every open. `appDb()` caches the connection on
  `globalThis`; a running dev server must restart to pick up migrations. Cloud sync is later and
  arrives by adding an API key, not by changing the model.
* **A workspace per browser**, found by an httpOnly cookie `triquet_workspace`. There are no
  accounts. `GET /api/workspace` loads (or creates and sets the cookie); `POST` saves a change and
  always answers with a `SaveOutcome` sentence, never a stack trace.
* **Saves are diffs by identity.** `changeBetween(before, after)` sends only quizzes that are not the
  same object, whole, plus deletions. `saveChange` is transactional and refuses any quiz or question
  another workspace owns. The client store serialises saves, flushes on `pagehide`, refetches on a
  `BroadcastChannel` message from another tab, and warns `beforeunload` while unsaved
  (`data-unsaved` on `<main>`). POST uses `keepalive`.
* **Tables:** `workspaces`, `quizzes`, `questions` (ordered by `position`), `players`, `playings`
  (below). Ids are ULIDs minted client-side. Question fields are what the author writes; results
  live elsewhere.
* **The localStorage carry-in code is deleted**, with its tests and specs. The git history stays
  browser-side (isomorphic-git over LightningFS) for now.

**Acceptance.** Round-trip tests for every field; a foreign-id refusal test; an edit followed
immediately by a reload survives (the `reloadOnceSaved` e2e helper); two tabs converge.

---

## Sprint 2: Players and playings

**Goal.** The AI parts of the tool are players with prompts, and every answer is kept.

* **Player** (`players` table, seeded): `label` (`dumdum`, the hasty guesser; `numnum`, the number
  spotter), `title`, `blurb`, `servicelabel` (`claude`), `model_tier` (`quick`/`careful`),
  `max_tokens`, `prompts` by kind (`clueing`, `hint`, `bulk`). The Prompts-used panel shows exactly
  these.
* **Playing** (`playings` table, append-only): one row per player, question and text asked; the
  newest per slot is what the grid projects into `guess`, `clueing_ishes` and `hint_ishes`. Naming
  matters: **playing**, not "answering" (too close to `full_answer`); the reply column is
  `reply_text`.
* **AI replies are accepted as any string**, clipped to 3600 characters, then held to `textish`. They
  are never trimmed or sanitised; a control character is a probe and fails as unreadable.
* **Staleness is derived**: an extraction is stale when the text it was asked about is no longer the
  question's text (`asked_text`), and edits mark it stale rather than discarding it.
* The grid's ask cells (double-click or Enter/Space to ask, never a single click), the batched
  "Recalculate all ishes", and the token figure per cell (never per cell for a batched run) belong
  here.

**Acceptance.** Append-only history is tested (asking twice records twice; saving twice records
once); projection tests pick the newest; the `/api/ask` route validates in and out.

---

## Sprint 3: Credentials and availability

**Goal.** The tool says plainly when a player cannot play.

* `lib/credentials`: `has(servicelabel)` and `get(servicelabel)`; `claude` reads
  `ANTHROPIC_API_KEY` (blank counts as unset). Both throw on an unknown service (a typo must not read
  as "no key") and in a browser; `get` names the variable, never its value, when it is missing.
* `/api/ask` gates on `has(player.servicelabel)`. `GET /api/players` returns booleans only.
* A player that cannot play shows a calm notice in its cells ("Dumdum can't play yet -- no Claude
  credentials are set up for this app.") and its cells are disabled, including the sum-column
  shortcuts. Not knowing (route unreachable) presumes able.
* Playwright's server is given a fake key so nothing can spend real usage.

---

## Sprint 4: Routing

**Goal.** A quiz is addressable by its label, and the address is honest.

* Hash routing (`#label`) through `useSyncExternalStore`; the app writes the hash for the open quiz,
  and a hash the app wrote itself is not a request.
* Editing the hash on an open page moves to that quiz; back works.
* An address naming no quiz shows a "No such quiz" page: the label it looked for, a button to make a
  quiz under that label (only when the label is valid and unused), the workspace's quizzes, and,
  independently, every git repository in this browser including those of deleted quizzes.
* **Superseded (Sept 2026) by path routing**, `/my/quiz/<label>`. The hash design was defensible
  while the address was cosmetic; it stopped being so in this very sprint, when an address became a
  request that can fail. Reconciling the hash with `active_quiz_id` in both directions cost ~90 lines
  of hand-rolled router -- a module-level mutable `written`, a custom DOM event, and two effects that
  raced each other -- and two live bugs. See `notes/stack.md`.

---

## Sprint 5: Layout model, done once

**Goal.** A quiz keeps **widgets** and **columns** separately. Building this first would have
avoided the intermediate design in which an expressing carried its own title and width.

### Widgets

An ordered list on the quiz (`widgets` table; one table so both kinds share one order).

* **Label** unique within the quiz; `question` is reserved for the questions' own widget.
* **Expressing**: `label`, `expression_label`, `description`. Its value for a question is what the
  expression's formula comes to.
* **Playing** (a connection from a quiz to a player): `label`, `player_label`, `textkind`,
  `description`. Only combinations the tool supports are valid (`dumdum`+`clueing`,
  `numnum`+`clueing`, `numnum`+`hint`); the answers stay on the questions, so removing a playing only
  stops showing them.
* Widgets have an **ordering**, changed by `move_widget`.

### Columns

An ordered list (`columns` table): `label` (unique in the quiz), `title` (editable, max 82),
`source`, `width_px` (30 to 800; a px number, replacing the earlier skinny/medium).

`source` is one of:

* `question.<field>` for a base field: `title`, `clueing`, `hint`, `chains_to`, `qnum`, `alt_text`,
  `notes`, `full_answer`;
* `question.butnot` or `question.butnot_ishes`, views worked out from the chain;
* a widget's label, for that widget's value.

Fixed columns are ordinary columns: any can be moved, retitled, resized or removed. The row grip is
the grid's own and always first. Header kind is derived (a narrow computed column is vertical, a list
column centred, prose plain); sortability is derived from the source.

### Defaults

A new quiz gets three playing widgets (`dumdum`, `numnum_clueing`, `numnum_hint`), one expressing per
seeded sum whose expression still exists, and 21 columns: the six lead fields, the sums between Q#
and Alt Text at 78px, then notes and the players' answers. `defaultLayoutFor(expressions)` is the one
source.

### Integrity (checked on the quiz, not on the parts)

No two widgets or columns share a label; no widget is labelled `question`; every column shows
something the quiz has. The workspace checks that every expressing names an expression it holds.

### Sorting

A sort memory is `chain_order` or `column:<label>`. Sorting commits the order into the quiz and
remembers the column; absent values sink in both directions. Deleting or renaming a column keeps
or forgets its memory accordingly.

### Reducer

`add|edit|delete|move_widget`, `add|edit|delete|move_column`, and the expression actions live in a
layout reducer beside the workspace reducer. Widget and column actions are refused while the quiz is
locked; expression actions are not (they belong to the workspace). Deleting a widget deletes the
columns that showed it.

**Acceptance.** Reducer tests for every action and every refusal; a Quiz validity table; the default
layout validates as a quiz.

---

## Sprint 6: Expressions

**Goal.** An author writes a formula once and any quiz can use it.

### The model

* **Expression**: `owner` (`tq` today), `label` (unique per owner, fixed once made), `formula`
  (`formulaish`), `description`. Stored per workspace, keyed by (workspace, owner, label).
* **No `rel`.** A widget hangs off its quiz by `quiz_id` with cascade delete; a label reference would
  go stale on rename.
* **An expression cannot be deleted while any widget in any quiz works it**; deleting asks first.
* **Seeds**: the eight sums (`clueing_full`, `clueing_numeral`, `hint_full`, `hint_numeral`,
  `butnot_full`, `butnot_numeral`, `clueing_plus_rank`, `clueing_plus_butnot_full`), and five text
  calculations (`clueing_word_count`, `clueing_with_butnot`, `answer_letter_count`,
  `answer_reversed`, `answer_alphabetized`). Rounding is half-up (`$floor(x + 0.5)`), not JSONata's
  `$round`.
* A workspace holding no expressions (saved before there were any) is given the seeds on load, and
  its quizzes with no columns the default layout.

### Evaluation

* **JSONata 1.8.9, synchronous.** 2.x is async-only, which would make every cell arrive a tick late
  and make the reducer's sort wait. Swapping later is a one-file change plus making callers async.
* **The bag is the input document**, so a formula says `qn.clueing`: `quiz`, `qns`, `qn`, `qn_label`,
  `quiz_label`. No ids; questions refer to each other by label (`chains_to` is the target's label;
  `qns[label = $$.qn.chains_to]` finds it); each question carries a `rank`.
* **A formula answers with a value or `{ 'value', 'stale' }`.** Nothing, null and `''` are a muted
  dash ("nothing to say", never zero); lists and objects show as JSON; a function is an error.
* **Runaway formulas are stopped**: 100 ms or 500 levels deep, via JSONata's entry/exit hooks
  (tail-call optimisation makes `$f := function(){ $f() }` spin forever). The rest of that column
  reuses the failure. A failing formula spoils only its own cells.
* Values are computed on render and in the sorter, stored nowhere.

### Exposure (what a formula may read)

Class-level `exposed` lists say what each thing shows the outside world. Most things expose every
field except `id`; the judgements:

* **Question** hides `id`, `forced_label` (the label in force is shown) and the players' answers
  (which belong to playings). Exposes `alt_text`, `chains_to`, `clueing`, `full_answer`, `hint`,
  `label`, `notes`, `qnum`, `title`.
* **Quiz** exposes only `label` and `title` (not version, lock, remembered sort or batch cost).
* **A player's answer** exposes `status` and `text` (guess) or `items`, `stale` and `status`
  (extraction). Never tokens, tier, times, truncation, messages or failures.
* **Expressing** exposes `value`.

The formula bag, its JSON Schema and the git table are all produced from these lists; a test holds
every real bag to the schema.

**Acceptance.** The old sum specs pass against the seed formulas (regression proof); a runaway
formula test; a bag-exposure test; a schema-versus-bag test.

---

## Sprint 7: Editors

**Goal.** Author everything without leaving the page; nothing applies until Apply.

* **Manage-quiz dialog**: wide, one scrolling region (each section as tall as its content), every
  dialog with a close button. Sections: label and version; Columns; Widgets; History; All quizzes
  (60vh cap).
* **Columns list**: every column with a drag handle, an editable title, its label between the title
  and the gear where the screen is wide enough (the `md` breakpoint), and a gear opening title,
  label, source (grouped: question field, chain view, widget) and width. Removal asks first and
  keeps the widget. "+ New column".
* **Widgets list**: ordered, drag handles, gear per widget. "+ New expressing", "+ New playing",
  "Edit expressions".
* **Expressing editor**: widget label, description, the expression it works, and that expression's
  label, description and formula together; the formula has live syntax feedback. A new expressing may
  work an existing expression or a new one written on the spot ("New expression..."), and brings a
  column titled after it, placed before Alt Text. There is no standalone "new expression".
  Removing the widget asks first and takes its columns; the expression stays.
* **Preview**: pick any quiz and question (default: the open quiz's lowest Q#) and see what the
  *draft* formula comes to as it is typed. The input the formula reads is shown as three folds
  (`quiz`, `qns`, `qn`): one line of compact JSON to the right when closed, a max-height,
  pretty-printed box when open.
* **Expressions list**: label, description, usage, gear. Its editor reuses the formula editor and
  offers removal only when unused.
* **Prompt for a chatbot**: a button copies a prompt (no model is called). It carries whatever is
  filled in, the current formula offered neutrally as "what we have now" (or a request when there is
  none), the input schema, one real `qn`, the output schema, a few JSONata gotchas, and asks for the
  formula alone in the reply so it pastes straight back.
* **Modal behaviour**: the column, widget and expression editors ignore backdrop clicks (Escape and
  the close button still close them); confirmation before any removal is inline, not a second dialog.
* **A locked quiz** disables widget and column editing but leaves expressions editable.
* **Not built**: parameters on an expressing (there is room under the expression select).

---

## Sprint 8: Exports and history

**Goal.** Exports come from the same lists as the grid, and are stable.

* **Copy for Sheets (the downloadable TSV)**: a header row of column labels, columns in
  **alphabetical order by column label**, rows in rank order whatever the grid is sorted into, made
  from the displayed columns. One implementation, keyed exhaustively so a new source kind cannot be
  left out. Tabs and line breaks in fields become spaces and `<br/>`.
* **The BUT NOT fold** the old export did is now the seeded expression `clueing_with_butnot`.
* **Git working tree** (per quiz, in the browser): the `.qq.tsv` is a table of **every exposed field
  of every widget** (the questions' own, each playing's, each expressing's `value`), headed
  `widget.field`, sorted alphabetically by widget label then field label, rows sorted by question
  label. It does not follow the grid or the question order, so a diff shows only what changed. The
  `.tq.json` (sorted keys) holds the whole quiz and is what could restore one.
* **`tq/widgets/my.tqexpressions.json`** is in every repository, holding the workspace's expressions.
  A change to an expression alone makes a commit (`widgets ~expressions`); the mirror carries a
  quiz-and-expressions snapshot through the debounce.
* Commits are debounced; the message is a data-free shorthand.

---

## Sprint 9: Failure semantics

**Goal.** A failed ask never destroys what the author already has.

* A failed ask **leaves the value and its stale flag as they were** and sets `last_err`
  (`message` in the author's words, `response` as the JSON that came back, `at`). Any success nulls
  it. A cell that has never had a value shows the failure sentence, and is badged too.
* A **badge** marks a cell with a `last_err`: hover for the message, click for the JSON.
* A **failed combined run** touches no cell; its failure shows in the toolbar area, badged. A text a
  run leaves out gets its own per-cell `last_err`.
* Failures are stored as failed `playings` rows carrying the response; the projection shows a failure
  only while it is newer than every success. The server sends the SDK error's name, status and
  message (never the request) as `detail`.

---

## Sprint 10: Hardening

* Migrations exercised against a copy of a real developer database and against a legacy database
  built at the previous migration; remembered sorts renamed; every quiz given its widgets and columns.
* Full e2e suite; drag verified by sending the drag events (Playwright's own drag does not start on
  the handles), plus **one manual drag in a real browser** before release.
* `build:agent` green; lint with no disables; `HUMAN-whatsup.md` current.

---

## Revisions and mind changes

Things decided differently along the way, recorded so the reasoning is not lost.

| Topic | First | Settled | Why |
|---|---|---|---|
| Storage | localStorage | libSQL + Drizzle | Real queries, later cloud sync |
| Answer naming | "answering" | "playing", `reply_text` | Too close to `full_answer` |
| Text validators | one 3600 string | `textish` (untrimmed) vs `noteish` (trimmed) | Verse and spacing must survive |
| AI replies | sanitised | clipped, then `textish`, no trim | A control character means probing |
| Carry-in code | kept | deleted | "It will get too hairy"; nobody has data |
| `normalize` | strip underscores | collapse runs to `_` | `clueing_full` must survive |
| Async JSONata | 2.x | 1.8.9 sync | Render and sort stay synchronous; revisit if 2.x is needed |
| Expressing to quiz link | `rel` = quiz label | `quiz_id` in the quiz | Labels rename |
| Expression scope | global | per workspace | One person's edit must not change another's columns |
| Column width | skinny/medium | `width_px` | Fixed columns had to become columns |
| Expressing data | title + shape on the widget | title and width on a column | Columns and widgets separated |
| Expressing removal | delete button inline | gear, inline confirm | More fields than fit inline |
| New expression | standalone form | made inside a new expressing | "I'll leave it to you"; fewer paths |
| Export header | field/label/player label | column label, alphabetical | Stable for pasting into a sheet |
| Export first column | rank | raw Q# (rank via a computed column) | One implementation, faithful columns |
| Failed ask | overwrite with the message | keep the value, badge `last_err` | Never destroy what exists |
| "Playing" | ask rows | also the quiz-level widget | Connection from quiz to player |

## Open questions and backlog

* **Parameters** on an expressing (the editor has room).
* **More widget kinds**, the reason for the architecture: an AI-agent widget per column, built-in
  modules, and a widget that calls a worker or artifact (for example a Cloudflare Worker) and returns
  a value. Each is a new widget kind with its own exposed fields; nothing in the layout model should
  need to change.
* **BBCode helpers** for a league's forms (needs a decision on which tags).
* **Async JSONata 2.x**, if a formula ever needs it.
* **Column reordering by drag in the grid header**, and **expression rename** (would need to carry
  every widget that names it).
* **Expressions and widgets in import**: import currently merges questions only.
* **Git history server-side** (it stays browser-side until there is somewhere to put it).
* **"Recalculate all" is not gated** in the browser when a player cannot play; it fails with the
  older notice.
* **Data note**: a quiz whose every expressing was deleted, in a workspace that still has
  expressions, is given the standard sums back by migration 0008; and a workspace with no expressions
  is re-seeded on load.
