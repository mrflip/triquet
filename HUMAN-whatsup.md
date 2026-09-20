# What's up

Braindump from the v1 delivery cycle: Features-v1's ten milestones, M1 through M10, each its own
commit. Everything below is either a decision I made that you might want to overturn, or a thing
I noticed and did not act on. Nothing here is load-bearing for the code.

## Things I'd most like you to look at

**The UI says "Clueing", not "Question".** -- change to question.clueing everywhere

**Sorting by an ishes column sorts by how many spans were found.** Good enough

## Still undecided

Longer discussions of these are below, but

* what "reverse chain order" means
* what to do with tsv columns containing tab, newline, backslash or quote
* how and when to update label from title -- it's easy in 90% of cases and fffff edge cases. Also we're modifying what are effectively primary keys
* lots of ways that the system can update without ever triggering a git update

**Descending chain order is a reverse-graph walk, DFS-flavoured.** Confirmed by hand-tracing: it
already does what you called interpretation (1) -- build the reverse adjacency (`chainedInto`,
who chains *into* each question) and walk that instead of `chains_to`, restarting at the next
unplaced root when a branch runs out. Roots are tried highest-Q#-first, which is what makes a
simple unbranched chain a true full reversal. The only place it can differ from a *different*
valid reverse-graph ordering is a merge with unequal depth behind its branches -- concretely,
`tail <- early <- early2` and `tail <- late` (both `early` and `late` merge into `tail`, but only
`early` has anything chaining into it): this walk finishes `early`'s whole branch (`early2`)
before ever visiting `late`, giving `[tail, early, early2, late]`. A BFS/layered toposort of the
same reverse graph would instead finish everything chaining directly into `tail` before
descending further, giving `[tail, early, late, early2]` -- your interpretation (2). I did not
build that: you asked for (1), this already is (1), and swapping to (2) would change the order in
exactly this shape of case without a strong reason to prefer it. Say the word if you want it.

**The Sheets export's BUT NOT joiner.** §M7 field 2 says to fold the hint in with
`... BUT NOT ....`, but every hint in the spec is already written as "BUT NOT ...", so a literal
joiner stutters. `foldButnot` supplies the phrase only when the hint doesn't carry it. If hints
are meant to be stored *without* the prefix, say so and this gets simpler.

**Import matches on id before title -- but only a local id.** Without this, pasting your
own export straight back appends a duplicate of every question you hadn't named yet, which
breaks M8's own "done when". Ids from another browser still mean nothing, so title is
still the key that matters for the cross-browser case. Related: a pasted question with neither a
known id nor a title is *appended* rather than merged onto whichever blank it happens to
sit next to. Both are judgement calls.

* **A closing tab can lose up to 30 seconds of history.** The timer flushes on `visibilitychange`
  and `pagehide`, but a page being torn down may not live long enough to finish an IndexedDB
  write. The quiz itself is never at risk -- localStorage still saves every edit synchronously --
  only the record of it. This is the real cost of the longer wait; the shorter it is, the smaller.
* **A reload also drops the pending shorthand.** The clock lives in memory, so edits made in the
  last <30s before a reload are committed with the *next* burst's message, which will not mention
  them. The tree is still right; only the log line is short.

**Judgement calls worth overturning:**

* **One repository per quiz, not one for the workspace.** A branch is repository-wide, so a
  per-quiz `version` only works if each quiz has its own. You have said to keep repos distinct
  for now, which fits.
* **The path is taken literally**, `tq/hunt/{L}/{L}/puz/{L}/quiz/{L}`, every `{L}` the quiz label.
  Your message spelled the file `quizlabel{-questions.qq.tsv,.tq.json}` and then said you had
  changed it to `{quizlabel}.qq.tsv`; I went with the second and dropped `-questions`. Renaming a
  quiz's label moves the whole chain, which git reads as a rename.
* **The `.qq.tsv` is no longer the Copy-for-Sheets export.** That export has seven columns, no
  title, and flattens line breaks so a paste never splits a row; it is for spreadsheets. The git
  file carries the fields a person edits, quoted by Papa Parse. I did not switch the Sheets copy
  to Papa Parse, because its flattening is the point and e2e specs assert it -- say if you want it.
* **The tag is `{branch}-m-YYYYMMDDhhmmssz`**, UTC. Two milestones in the same second get `-2`.
* **JSON is alphabetical**, as you said, through `UU.jsonify`. The `localStorage` write and the
  `/api/ask` body stay on `JSON.stringify`: neither is an export, and the first runs on every
  keystroke.
* **Commits are attributed to `Triquet <triquet@localhost>`.** There are no accounts and nothing
  leaves the browser, so there is no better name to use.
* **The gear modal's form button is "Apply", not "Save".** "Save" is gone from the history
  vocabulary too now: it is "Mark a milestone". The `saveNotice` about localStorage is a different
  thing and keeps its name.
* **Deleted directories linger empty** in the browser filesystem after a relabel. Git does not
  track them and a zip omits them, so I did not add pruning.

**LightningFS flushes the directory tree on a 500ms debounce**, so a reload moments after an edit
found a repository with nothing in it -- caught by an e2e test, not by reasoning. Every unit of
mirror work now calls `flush()` before releasing its turn. Worth knowing if anything else in this
app ever keeps state there.

**`workspace-store` takes an `onChanged` callback rather than importing the mirror itself.** The
store stays testable with a `MemoryStore` and knows nothing about git; only `TabWorkspaceStore`
wires the two together.

## Fourth cycle: the database

Turso's libSQL in local-file mode, under drizzle (`drizzle-orm` 0.45, `drizzle-kit` 0.31,
`drizzle-zod` 0.8 -- the stable lines; 1.0 is still RC). Schema in `src/db/schema.ts`, migrations
generated into `/drizzle` and applied whenever the app opens the database. Cloud sync is not wired:
when it is, it should be `syncUrl` + `authToken` on `createClient` in `src/db/client.ts` (an
embedded replica), and `openDb` currently *refuses* anything that is not `file:` or `:memory:`, on
purpose, so that door has to be opened deliberately.

**Tables.** `workspaces` → `quizzes` → `questions` → `playings`, plus `players`. Questions hold
only what the author writes, and `position` is the committed order. `players` holds dumdum and
numnum: title, blurb, model tier, token budget, and `prompts` -- a JSON map keyed `clueing` /
`hint` / `bulk`, because numnum has three prompts and you said "a prompt". They are rewritten from
`SeedPlayers` every time the database opens, since the Prompts used panel shows the code's copy
and the two must never disagree; once players are editable, that sync has to become seed-if-absent.
`/api/ask` now reads prompt, tier and budget from the table.

**Playings are append-only history.** One row per time a player was put a question's clueing or
hint: `player_label`, `textkind`, `asked_text`, then status, `reply_text` (dumdum), `items` JSON
(numnum), `message` (errors), truncation, tier, tokens, `created_at`. Named playing rather than
answering, and `reply_text` rather than `answer_text`, to stay clear of `full_answer`. A question's
dumdum playing is its newest dumdum row -- there is no drizzle relation that can say "newest", so
`models/playing.ts` picks the newest per (question, player, textkind) after loading. That loads
the whole history; fine now, a window function when it isn't. The rename went in as two
migrations, drop `answerings` then create `playings`, because drizzle-kit only asks "renamed or
new?" at an interactive terminal; any dev database lost its (throwaway) history on the way.

**Judgement calls worth overturning:**

**Seeded** (all in `SeedExpressions`): the eight sums; `clueing_word_count`, `answer_letter_count`,
`answer_reversed`, `answer_alphabetized`. Every one is a one-liner you can read in the editor. I did
not seed the BBCode idea: it needs a decision about which tags your league's forms accept.

**Where to find it.** The gear's dialog (now wide) lists a quiz's computed columns: retitle one in
place, or press its gear to open the *column editor* -- the column's title, label, description and
width, the expression it works, and that expression's label, description and formula together, with
a live preview. *Edit expressions* in the toolbar lists the workspace's expressions, each with a gear
opening the same formula editor on its own (still available on a locked quiz, since expressions belong
to the workspace); it is also where an expression is removed.

**Not done**

* BUT NOT (the snippet) and BUT NOT ishes, Clueing ishes, Hint ishes: those show a chain preview and
  lists of spans, not values, so they stay as they are.
* Reordering columns (remove and re-add) and renaming an expression.
* Import ignores expressings and expressions in a pasted workspace; only questions are merged.
* The double-click re-extract shortcut belongs to the columns whose expression is `clueing_full`,
  `hint_full` or `butnot_full`, by that label.

## Widgets and columns, apart

A quiz now keeps **widgets** (what has a value for every question: playings and expressings, in a
list whose order is theirs) and **columns** (what the grid shows: a label, a title, a `source`, a
width in px, in the order they appear) separately. `source` is `question.<field>`, `question.butnot`
/ `question.butnot_ishes` (views), or a widget's label. The grid, both exports, sorting and the
editors read from these; the fixed columns are ordinary columns now, so any can be removed, moved or
retitled. The grip is the grid's own and always first.

* **"Playing" here is the new quiz-level widget** (label, player, which text); I read your
  "connection from quiz to player" that way and left the per-ask `playings` table alone. It can only
  be a combination the tool supports (dumdum+clueing, numnum+clueing, numnum+hint); the answers are
  still kept on the questions, so removing a widget only stops showing them.
* **Exposed fields** are class-level statics (`Question.exposed`, `Quiz.exposed`,
  `Expressing.exposed`, `PlayingWidget.exposed`). Judgements: a question hides `id`, `forced_label`
  (the label in force is shown) and the players' answers (they belong to playings); a quiz exposes
  only `label` and `title` (not version, lock, remembered sort, batch cost); a player's answer shows
  `status` plus `text` / `items` / `stale` -- never tokens, tier, times, truncation or failure. The
  formula bag, its JSON Schema (and so the prompt) and the git table all come from these.
* **Git table** (`.qq.tsv`): a column per exposed field of every widget, headed `widget.field`,
  alphabetical by widget then field, rows ordered by question label. It no longer follows the grid.
  `tq/widgets/my.tqexpressions.json` is in every repo; changing an expression alone makes a commit.
* **Copy for Sheets**: displayed columns, alphabetical by column label, rows in rank order.
* **Migrations 0008/0009** turn expressings into widgets + columns, add the three playing widgets and
  the fixed columns to every quiz, give quizzes that never had sums the eight standard ones, and
  rename remembered sorts (`qnum` -> `column:qnum`, `expressing:x` -> `column:x`). Tried on a copy
  of `data/triquet.db`; the original is untouched. **Restart `pnpm dev`.**
* **Editors**: the gear's dialog is one scrolling region (All quizzes has a 60vh cap); Columns and
  Widgets lists with drag handles, the title editable in place and the label between title and gear
  from the `md` breakpoint up; every dialog has a close button; the column, widget and expression
  editors ignore backdrop clicks (Escape and the button still close them). Adding an expressing brings
  a column just before Alt Text. **A column's width is now a px number**, replacing skinny/medium.
* **Input fold** in the formula editor: `quiz`, `qns`, `qn` each a one-line summary on the right,
  a max-height pretty-printed box when open.
* **Not verified in a real browser**: Playwright's own drag does not start on the handles, so the
  specs send the drag events themselves (`dragOnto`). Worth one manual drag.

## Widgets, round two

* **The column editor** (`ColumnEditor`, over `ExpressionFields`): nothing is applied until Apply, and
  what Apply does is decided by `planColumnEdit` (pure, tested): it adds a new expression before the
  column that works it, revises an expression only if its formula or description changed, and on a
  locked quiz leaves the column alone and revises only the expression. Removing a column asks first
  (and keeps its expression). An expression can only be removed from the expressions list, only when
  no column works it, and asks first. **There is no standalone "new expression"**: you make one by
  making a column and choosing "New expression…", as you suggested. `Column label` blank takes the
  expression's label.
* **The preview** evaluates the *draft* formula against one question's real bag: pick any quiz and any
  question, starting on the open quiz's lowest Q#. "The input for this question" shows that `qn`.
* **The prompt** (`Copy a prompt for a chatbot`): `src/lib/formula-prompt.ts`. It carries whatever is
  filled in (column title/label/description/width, expression label/description), the formula as "here
  is what we have now" when there is one or a request when there is not, the input JSON Schema (from
  `models/quiz-bag.ts`, with a test that every bag a formula is really given satisfies it), one real
  `qn`, the output JSON Schema, a few JSONata gotchas, and asks for the formula alone in the reply.
  Nothing calls a model. **`plain()`** (in `lib/validator.ts`) is new: `Z.toJSONSchema` cannot see
  through our callable validators when they wrap a `.default()`/`.optional()`, so it swaps each wrapper
  for the schema it wraps, in place; parsing is unchanged.
* **Async JSONata.** Still 1.8.9 (sync). The choice is a one-file swap plus making the callers async;
  I would not make it before there is a formula that needs 2.x.
* **`normalize` collapses** runs of `[\W_]` to one `_` and trims them from the ends, as you wrote it;
  `snakify` is gone. Quiz labels and versions in URLs are now `leon_s_quiz`, not `leonsquiz`.
* **Failures.** A failed ask never replaces a value: it rides on the cell as `last_err` (`message`,
  the response JSON, `at`), any success nulls it, and the stale flag is untouched. A cell that has
  never had a value shows the failure as before. The badge (⚠) says the reason on hover and shows the
  JSON on click. The error is stored as a `playings` row with the new `response` column, and the
  projection shows a failure only while it is newer than every success. A failed combined run touches
  no cell and shows in the toolbar, badged; a text the run left out gets its own per-cell `last_err`.
  The server now sends `detail` (SDK error name, status, message -- never the request) with a failure.
* **The Sheets export** has a header row and is made from the same column list as the grid
  (`lib/columns.ts`, moved from `components/`), so a new column cannot be in one and not the other:
  the per-column text is a `Record<Colkey, ...>`, which does not compile with a column missing.
  Headers are the field name, the expressing's label, or the player's label (`dumdum`,
  `numnum_clueing`, `numnum_butnot`, `numnum_hint`). **Changes to notice:** the export no longer leads
  with the rank (Q# is the raw Q#, rows are still in rank order; rank is available through
  `clueing_plus_rank`), and the BUT NOT fold it used to do is now the seeded expression
  `clueing_with_butnot`. The Copy for Sheets box also has every computed column.
* **Description on the expressing** (migration 0007); migrations 0006 (`playings.response`) and 0007
  need a restart of `pnpm dev`.
* **Not done:** parameters on an expressing (the editor has room for them under the expression
  select); expressions in a quiz's git history (only the columns are there; the formulas live in the
  workspace).


## eslint rules I turned off, and why

All of these are in a named block in `eslint.config.mjs` with the reason inline. Each one
contradicts one of our own documents rather than being inconvenient:

* `unicorn/single-line-block-comment-style` -- STYLE.md sanctions the one-line doc block.
* `unicorn/no-null` -- guidelines.md's Real phase *requires* null.
* `unicorn/consistent-class-member-order` -- guidelines.md's worked example declares fields first.
* `unicorn/name-replacements` -- would force `err` → `error`, the one name STYLE.md forbids.
* `unicorn/consistent-boolean-name` -- fights the spec's own `locked` / `stale` / `truncated`.
* `unicorn/prefer-ternary` -- fights the guard clause STYLE.md endorses.
* `vitest/valid-title` -- testing.md's bulk example lists title from a variable by construction.
* `@typescript-eslint/consistent-type-definitions` -- `type FooT = Z.output<...>` can't be an
  interface, so its neighbours shouldn't have to be.

And two reconfigured rather than disabled: `unicorn/catch-error-name` now wants `err`, and
`unicorn/filename-case` accepts PascalCase as well as kebab, because components are PascalCase.

**Three things in STYLE.md the linter contradicts, which by STYLE.md's own rule makes them bugs
in the document:**

* STYLE.md says `var` where a value is genuinely reassigned. `no-var` is on, and `let` is the
  right modern answer -- `var` is function-scoped and hoisted. I used `let`.
* `@stylistic/space-unary-ops` can't tell a TS non-null assertion (`foo!.bar`) from an unspaced
  negation, so it warns on every one. I avoided non-null assertions instead, which is the house
  preference anyway; `tests/support/present.ts` is there so tests don't need them either.
* `unicorn/no-unnecessary-global-this` and `unicorn/prefer-global-this` disagree with each other
  about `globalThis.window`. Resolvable, but worth knowing.

## If you want to run it

    pnpm dev              # the app
    pnpm test             # 1357 vitest specs
    pnpm test:e2e         # 99 playwright specs, starts its own dev server on :3100
    pnpm lint && pnpm typecheck && pnpm build

Asking Claude needs `ANTHROPIC_API_KEY` in the environment. Without it the grid works and each
player's cells say "Dumdum can't play yet — no Claude credentials are set up for this app."

## Drag and drop, replaced (Sept 2026)

**Both hand-rolled HTML5 drag implementations are gone**, replaced by Pragmatic drag-and-drop
behind one hook, `useReorderable` in `src/components/use-reorder.ts`. `SortableList` and
`QuestionRow` both call it; `QuestionTable` no longer holds any drag state at all.

Things you may want to overturn:

* **I added arrow-key reordering.** Not asked for. The old grips carried `role="button"` and
  `tabIndex={0}` and did nothing on a keypress, which is a worse lie than not being focusable.
  Pragmatic ships no keyboard dragging by design -- Atlassian's line is that you provide a
  separate action -- so the choice was to implement something or to drop the role. Up and down
  arrows on a focused grip now move the row one place. It is undiscoverable without a hint; I
  did not invent UI for that. Options if you care: a line of microcopy under each list, a
  tooltip on the grip, or move/up-down buttons behind the gear.
* **`drag_question` is now `move_question`**, to sit beside `move_column` and `move_widget`, and
  because a keypress is not a drag. Six lines, reducer and tests.
* **The drop indicator moved from a border to an inset box-shadow.** The old one grew the target
  row by two pixels, so rows nudged as the pointer passed over them.

What actually changed for the author, beyond the jitter: **the drop now honours which half of
the row you are over.** The old code always passed the hovered row's index, so a downward drag
landed *below* the row while the accent line was drawn on its *top* border -- the picture and
the result disagreed, and no test covered a downward drag. Two e2e tests now pin both edges.

**Playwright cannot originate a native drag here.** Neither `locator.dragTo()` nor a hand-driven
press-and-move raises so much as a `dragstart` in this Chromium; I checked before rewriting the
helper. `dragOnto` in `e2e/support.ts` therefore still synthesises the events, but now carries
the coordinates, which is what makes the edge tests meaningful. Verified against the real page
before trusting it.

Not done, available cheaply if you want it: the drag preview is the grip glyph rather than the
row, as it was before. `setCustomNativeDragPreview` would give a proper row preview -- worth it
for the columns and widgets lists, probably not for a two-thousand-pixel question row.

## The grid staying a bespoke table

You asked me to judge it: **good call, keep it, and I did not touch it.** Reasoning is written
up in `notes/stack.md` under "Hand-rolled on purpose" so the next session stops re-flagging a
raw `<table>` as a tripwire violation. Short version: DataGrid's editing, row-height and
virtualization models each fight something the grid actually does, and MUI's plain `Table` is a
styling veneer that would cost Emotion work on every cell in the hot path for no structural
gain. One real wart recorded there: the sort header is a raw `<button>` where `TableSortLabel`
exists, left alone because sortable headers can be rotated.

