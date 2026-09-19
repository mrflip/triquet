# What's up

Braindump from the v1 delivery cycle: Features-v1's ten milestones, M1 through M10, each its own
commit. Everything below is either a decision I made that you might want to overturn, or a thing
I noticed and did not act on. Nothing here is load-bearing for the code.

## Things I'd most like you to look at

**The UI says "Clueing", not "Question".** You asked for the field to be `clueing`, and once the
sum columns are called Clueing Full Sum the column header may as well match. The footnote under
the grid explains the vocabulary. If you'd rather the author saw "Question" on screen while the
code says `clueing`, that's a one-line change in `src/components/columns.ts` -- but then the
eight sum headers need deciding too.

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

**Sorting by an ishes column sorts by how many spans were found.** §5 lists `q_ishes`/`bn_ishes`/
`h_ishes` as sortkeys but never says what they sort by, and a list has no other ordering. An
empty result sorts as nought; a cell nobody has asked about sinks to the bottom like every other
absence.

## Second delivery cycle

Renamed `short_answer` to `title` (now the leftmost column), swept "round" out in favour of
"quiz" everywhere, and restricted `ii`/`jj`/`kk` to a literal `for` loop's own bound variable --
`idx`, or a noun-qualified `fooIdx`, everywhere else. Added `unique-names-generator` and
`src/lib/labelmaker.ts` for a hand-editable local identifier (`label`/`forced_label` on both
Question and Quiz), and routed each quiz by it: `/` redirects to `/my/quiz/#<label>`, and a gear
icon opens a modal to rename the label (validated, checked unique) or jump to another quiz.

**A blank title is populated from the label, titleized, at creation.** I asked before touching
this rather than guessing: a fresh quiz or question is titled "Quiet Otter" rather than staying
empty, on purpose, so the author sees a starting point and understands the label/title
connection. This is one-directional and only at creation -- nothing regenerates a label from a
title an author later types, and nothing re-populates a title an author later clears. It broke 9
e2e specs that assumed a fresh row stayed blank; fixed by having those specs clear the rows they
actually need blank, rather than relying on that being the default.

**`normalize()` strips underscores from anything a person types**, same as every other symbol --
see the LabelMaker doc block for why. One consequence worth knowing: a hand-set label can never
collide with, or reproduce, an `adjective_animal` generated one, only another hand-set label.

**`titleize()` uses `_.startCase`, not `_.titleCase`.** es-toolkit/compat has no `titleCase`;
`startCase` is the lodash-family equivalent and reads the same ("Quiet Otter").

## Third cycle: every quiz is a git repository

One repository per quiz, at `/quizzes/{quiz.id}` in an IndexedDB-backed filesystem
(`@isomorphic-git/lightning-fs`), keyed by id so renaming never orphans a history. Edits are
committed in batches (see the debounce below). `lib/changes` diffs the quiz before and after a
batch into a data-free shorthand -- `quiz ~title; quiet_otter +clueing ~hint`, with `+` set, `~`
revised, `-` cleared, `@` reordered -- and that shorthand is the whole commit message. The quiz's
`version` field is the branch, defaulting to `main`. "Mark a milestone" tags, "Download as git"
hands back a zip that ordinary `git log` reads.

Each repository holds two files, at
`tq/hunt/{label}/{label}/puz/{label}/quiz/{label}.qq.tsv` and `.tq.json`. The `.qq.tsv` is a
Papa Parse TSV with a header (`title, clueing, hint, qnum, label, chains_to, full_answer,
alt_text, notes`), one row per question in the quiz's own order; the `.tq.json` is the whole quiz,
`UU.jsonify(quiz, { pretty: true })`.

**Commits are debounced, with a 30 second target.** `state/commit-scheduler.ts` starts a clock at
the first unrecorded edit to a quiz and does *not* restart it on later ones, then commits the
whole burst with one message describing before-versus-after. Restarting the clock on every edit
would never fire for someone who keeps typing; this way a quiz worked on continuously is still
committed about every 30s. It needed no new machinery beyond a `Map` and `setTimeout`, so 30s cost
nothing over 2s. The wait comes from `NEXT_PUBLIC_TRIQUET_COMMIT_DEBOUNCE_SECONDS`, validated to a
whole number from 2 to 600 (`models/mirror-settings.ts`); an invalid value stops the app at
startup on purpose. Playwright sets it to 2. Milestones and downloads flush pending edits first.

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

**The mirror is a side-car and never the source of truth.** localStorage is still what holds a
quiz; a failed commit is swallowed, because losing a record must never cost an author an edit.
Deleting a quiz deliberately leaves its repository exactly as it stood.

**`workspace-store` takes an `onChanged` callback rather than importing the mirror itself.** The
store stays testable with a `MemoryStore` and knows nothing about git; only `TabWorkspaceStore`
wires the two together.

**The gear modal is now mounted only while open.** Its draft fields took their initial values once
and never resynced, so reopening showed what you typed last time rather than what was committed --
visible as soon as the Version field existed to catch it.

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

* **The in-app question shape did not change.** `QuestionT` still carries `guess`, `clueing_ishes`
  and `hint_ishes`; they are now *projections* of the newest playing in each cell, assembled on
  load and turned back into playing rows on save. That kept the grid, sums, sheets, import and
  the git mirror untouched. Renaming `guess` to something playing-shaped in the app model is the obvious
  next step, but it changes the export format, so I left it for you to call.
* **"answer" is `full_answer`**, and the question keeps every field it had (qnum, chains_to,
  alt_text, forced_label...) -- I read "just the basics" as "none of the AI stuff".
* **Staleness is derived, not stored.** A numnum playing records the text it was asked about;
  it reads as stale whenever that differs from the question's text now. One visible difference:
  edit a clueing and then edit it back, and after a reload the ishes are fresh again, where before
  they stayed stale. I think that is more honest. Dumdum answers are never marked stale, as before.
* **One workspace per browser, by an httpOnly cookie.** Each browser already had its own quizzes
  (localStorage), so nothing changes for you -- and it is what keeps 76 parallel Playwright specs
  from seeing each other's quizzes. Clearing cookies orphans a workspace in the database (the
  quizzes are still in the file, just unreachable from that browser). Accounts replace this.
  The workspace id is a bearer credential; fine for local mode, not for a shared deployment.
* **`/api/workspace` is a route handler, not a server action.** A field committed on blur as the
  tab closes has to be sent with `fetch(..., { keepalive: true })`, and server actions can't do
  that. (A test caught this: fill a field, reload, and the edit was gone.)
* **Saves are whole changed quizzes, diffed by identity**, sent one at a time. Each carries
  everything the database hasn't accepted yet, so a failed save is made good by the next edit.
  On `pagehide` the queue is skipped and whatever is unsaved goes at once. Leaving with a save
  still on its way now asks first (`beforeunload`).
* **The save notice is reworded** from "Couldn't save to this browser..." to "Couldn't save your
  latest changes -- they'll be tried again with your next edit", and there is a load-failure line
  where "Opening your quizzes..." used to hang forever.
* **Cross-tab sync is a `BroadcastChannel`** ("I saved; refetch") instead of `storage` events. A tab
  holding unsaved changes of its own ignores it rather than fetching over them.
* **A save naming another workspace's quiz or question is refused whole.** Nothing in the UI can
  do this today (import mints fresh ids); it guards against one browser's save stealing rows.
* **`esbuild` build scripts are declined** in `pnpm-workspace.yaml` (drizzle-kit pulled it in; its
  binary comes from a platform package, so the postinstall isn't needed).

**Regressions and rough edges I know of:**

* The very last edit before a tab closes is now a network request rather than a synchronous
  write. `keepalive` makes it very likely to land, not certain.
* e2e specs about surviving a reload now wait for `main[data-unsaved="false"]` before reloading
  (`e2e/support.ts`), as a person pausing a moment would. The one spec about committing on the way
  out still reloads straight away, and passes.
* The git mirror is unchanged and still lives in the browser, so history and database can drift
  apart if one browser's cookie changes. Worth deciding whether history moves server-side too.

## Validators, reconciled

The models' `ValidatorKit` now hands out the vv checks rather than its own look-alikes, so there is
one definition of each shape, and the table columns take their lengths from the same pattern bags
(`text({ length: PA.Noteish.max })` and so on; SQLite ignores the length, drizzle-zod does not).

* `textish` -- no control characters but tab and newlines, at most 3600, **never trimmed**:
  `clueing`, `hint`, and the text sent to `/api/ask`.
* `noteish` -- the same, **trimmed** (was vv's `notestr`): `notes`, `alt_text`, `full_answer`,
  an ask's error message, a player's blurb and prompts.
* `titleish` -- one line, at most 82: question, quiz and player titles. The kit's old `title`
  (max 200, any characters) is gone. A question's title is now described as "a brief name for the
  question, which can optionally be added to its text"; the answer is `full_answer`.
* `label` -- letter first, letter or digit last, 2 to 40 characters. vv's pattern was letter-first
  only, capped at 25, which would have refused generated labels (adjective_animal runs to 29).
  `normalize` now never returns more than 40, and `appendFallback` uses an 8-character random tail
  and cuts the label short so the whole still fits.
* `ulid` -- vv's, which also insists on a leading 0-7 (every ulid minted before the year 10889).
* Import reuses the question's own field schemas instead of restating them.

**Left alone, on purpose:** an ish span's `text` is still a bare non-empty string. That schema is
also the structured-output format sent to Claude, and a `\p{Cc}` regex in it risks every
extraction failing. `qnum` keeps its own regex, which has no length to share.

**Model replies** (dumdum's text, each ish span) are taken as any string, cut to 3600 by
`lib/ask/replies.ts`, then held to `textish` -- never trimmed, never cleaned. A control character
makes the ask an unreadable failure with a server-side warning. The structured-output format sent
to Claude uses its own loose `ishItemReply`; the stored `ishItem` is strict.

`localBlankLabel` now normalizes its fallback (a raw ulid starts with a digit). The generated
`adjective_animal` labels are left as they were -- normalizing those would strip the underscore.
The localStorage carry-in is gone.

## Routing findings

**Why `/my/quiz#asdf` did nothing.** The hash was read once, on first load; nothing listened for
`hashchange`, so editing the address of an open page was ignored. And on first load a hash naming
no quiz was silently overwritten with the open quiz's label, by design, which is why the console
was quiet. Now: the hash is read through `useSyncExternalStore` (`state/use-quiz-route.ts`), a
hash naming a quiz opens it whenever it changes, and one naming nothing shows the "No such quiz"
page (make it / your quizzes / every history repository, including deleted quizzes'). A hash the
app wrote itself never counts as a request -- after a rename it names a label nothing answers to
for one render, and treating that as "no such quiz" ate the rename until the routing specs caught it.

**`/my/quiz/<label>` instead of `#<label>`: not attempted, and my estimate is "moderate, not big".**
Roughly an optional catch-all (`app/my/quiz/[[...label]]/page.tsx`), the hook reading the pathname
instead of the hash, `/` redirecting to a path, and about ten e2e assertions on `url.hash` moving
to `url.pathname`. Next.js syncs `history.replaceState` into its router, so the same-page rewrite
should work, but that is exactly the seam where scroll restoration and dev-server quirks live, and
I have not tried it. The hash design was chosen so a label change never involves the router at all;
that is the thing you would be giving up.

## Credentials

`src/lib/credentials.ts`: `Credentials.get(servicelabel)` returns the service's environment
variable, `Credentials.has(servicelabel)` says whether it is set (blank counts as unset). Today the
only service is `claude`, read from `ANTHROPIC_API_KEY`; adding one is a line in `ServicelabelVals`
and a line in the variable table. Both throw on a label we do not know rather than answering "no",
so a typo cannot pass for a missing key, and `get` throws (naming the variable, never its value)
when there is nothing to return -- ask `has` first. Both throw in a browser.

Players carry a `servicelabel` (both seeded as `claude`). `/api/ask` looks up the player a job is
put to and gates on `Credentials.has(player.servicelabel)`; `GET /api/players` tells the browser
which players can play (a boolean, never the credential), so a cell says "Dumdum can't play yet —
..." and is disabled instead of failing on double-click. Not knowing (route unreachable, still
loading) presumes able: an ask the server can't serve still answers "unavailable" in its own words.
"Recalculate all ishes" is not gated in the browser; with no key it fails with that older notice.

* **The `servicelabel` column has a default of `'claude'`** -- SQLite cannot add a NOT NULL column
  to a table that has rows without one, and `players` always has rows. It is the one default in the
  schema that no validator shares; say if you would rather the migration seeded it by hand.
* **Playwright's server is given a fake key** (`sk-ant-not-a-real-key`) so the players read as able
  to play and the specs stub what they ask. It also means an unstubbed call in a spec cannot spend
  real usage. `reuseExistingServer` means a `dev:agent` already running keeps its own environment.
* **A running `pnpm dev` must be restarted** to pick up migration 0004: the connection, and so the
  migration, is per process.

## Expressions

The eight sum columns are now expressings: a formula in an expression, put to work by a quiz's
column. `src/lib/formulas.ts` wraps JSONata; `src/lib/expressed.ts` builds each question's bag and
works a quiz's columns out; `models/expression.ts` and `models/expressing.ts` hold the shapes, and
the seeds live beside the former. The columns cost nothing to store: they are computed on render
and in the sorter, from the questions as they stand, as the sums always were. I ported every old
sum test to run against the seed formulas, and the old e2e specs (dashes, stale greying, rank,
BUT NOT borrowing, the double-click shortcut) pass unchanged, so the seeds behave as the code did.

**Decisions you may want to overturn**

* **JSONata 1.8.9, not 2.x.** 2.x evaluates asynchronously, which would turn every column into
  something that arrives a tick after render and make the reducer's sort wait on it. 1.8.9 is
  synchronous, still published (`latest-v1`), and everything here works with it. If a formula ever
  wants something only 2.x has, the change is `Formulas.evaluate` going async and the callers with it.
* **A formula that never ends is stopped, not trusted.** JSONata does tail-call optimisation, so
  `( $f := function(){ $f() }; $f() )` really does spin forever, and a saved formula would then
  hang the page on every load with no way back in. `evaluate` uses JSONata's own entry/exit hooks to
  stop a formula after 100ms or 500 levels deep; the rest of that column then reads the same failure
  instead of waiting again. The cell shows a warning with the reason on hover. (JSONata 1.x offers no
  sandbox beyond that; formulas are run on your own browser and your own data.)
* **No `rel` field.** An expressing hangs off its quiz by `quiz_id` (cascade delete) and sits in the
  quiz's `expressings` array, in column order. A quiz's label can be renamed, so a reference by
  label would go stale; the quiz already contains its expressings, so there is nothing to look up.
* **Expressions belong to a workspace, not to the database.** Each workspace has its own copy, so
  editing one never changes another person's columns. `owner` is `tq` for all of them, and
  (owner, label) is unique. An expressing names its expression by label alone. An expression's label
  cannot be changed, and it cannot be deleted while any column of any quiz works it.
* **The bag is the input document**, so a formula says `qn.clueing_ishes`, not `$qn`: `quiz` (without
  its questions and expressings), `qns`, `qn`, `qn_label`, `quiz_label`. Ids are gone; a question's
  `label` is the one in force (a forced label wins) and `chains_to` is the *label* of the question it
  chains to, so `qns[label = $$.qn.chains_to]` finds it. **I added `rank`** to every question in `qns`
  (1-based place in Q# order, null when it has no Q#), because rank breaks ties by title and I did not
  want to re-derive that in JSONata.
* **A formula answers with a value, or `{ 'value': ..., 'stale': ... }`.** The second form is how the
  sums keep their greyed-italic look when the text they came from was edited. Nothing (undefined,
  null, an empty string) shows as the muted dash; lists and objects show as their JSON.
* **Rounding is half-up (`$floor(x + 0.5)`), not `$round`**, which rounds halves to even; the old sums
  used `Math.round`, and 0.5 has to stay 1.
* **Existing workspaces.** `Workspace.revive` gives a workspace holding no expressions at all -- one
  saved before there were any -- the standard expressions and every empty quiz the standard columns.
  That is in memory: nothing is written until something saves. The cost: an author who deletes every
  expression (after removing every column that uses one) will see the standard ones again on reload.
* **Migration 0005 has one hand-written statement**: it rewrites a quiz's remembered sort from
  `clueing_full` (etc.) to `expressing:clueing_full`, because the labels of the seeded columns are
  exactly the old column names. Tried on a copy of your `data/triquet.db`; the original is untouched.
  **Restart `pnpm dev`** to pick it up.
* **The Sheets export computes its Clueing total itself** rather than reading a column, so the export
  means the same thing whatever someone has done to their columns.
* **`Labelmaker.snakify`** is new: `normalize` strips underscores, which would have turned
  `clueing_full` into `clueingfull` in the label fields.

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

## Stack decisions I made without asking

* **localStorage, not Turso** -- overturned in the fourth cycle, above.
* **`ulid` for ids**, per your Coach note. Minted through `monotonicFactory` so a burst of
  records keeps its creation order rather than shuffling within the millisecond.
* **`clsx`** for class joining -- `noUncheckedIndexedAccess` makes every CSS-module member
  `string | undefined`, so template literals were producing `"cell undefined"`.
* **`@playwright/test`**, which stack.md already lists. Kept to the thin layer it describes: 62
  specs, all of them a milestone's "done when" rather than coverage for its own sake. They earned
  their place immediately -- see "bugs the tests caught" below.
* **`@anthropic-ai/sdk`** and one route handler at `/api/ask`. A key must never reach a page, so
  the asking half needs a server; everything else works with the network off. The key comes from
  `ANTHROPIC_API_KEY` in the environment (Doppler), never a file in the repo. With no key
  configured the route answers `unavailable` and the tool keeps working without its asking half.
* **Two real model tiers**: `claude-haiku-4-5` for the hasty guess, `claude-opus-5` for
  extraction. §M4/M5 ask for this explicitly and it is not a cost dodge -- a careful answer to
  the ambiguity question would answer the wrong question.
* **Structured outputs** (`zodOutputFormat` over the model's own `ishItem` schema) for the
  extractions, rather than parsing JSON out of prose. The schema the app stores and the schema
  the model is held to are then literally the same object.

## Bugs the tests caught

Worth recording because two of them were silent data loss.

1. **`QuestionPatch` was `question.partial()`** -- and Zod applies a field's `.default()` through
   `.partial()`. Committing one field therefore carried every other field's default along and
   wiped what the author had: typing a title erased the clueing next to it. Found by the
   very first Playwright run. The patch schema is now built from defaultless field schemas. This
   is the same caveat §5 flags for the import path, met a milestone early.
2. **Sortable ish headers collided with askable cells** -- both became buttons named "Clueing
   ishes". Askable cells are now labelled "Ask <column>".
3. **The sort arrow was inside the header button's text**, so the button renamed itself from
   "Q#" to "Q# ↑" on the first click. It's decorative now; `aria-sort` on the header carries the
   direction.

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

## Deliberately not done

* **No question deletion.** §7 names it as the first gap worth filling, and it is.
* **No undo.** §7.
* The **Prompts used** panel shows the templates but there's no way to edit them. Right for v1.
* The bulk run sends the whole quiz in one request with no chunking. A 200-question quiz would
  want splitting; nothing in v1 gets near it.
* The `/api/ask` route has no unit tests -- it would need the SDK mocked, and the interesting
  logic (prompts, contract, failure mapping, bulk landings) is all in tested modules either side
  of it. The e2e specs stub the route rather than the SDK.

## If you want to run it

    pnpm dev              # the app
    pnpm test             # 1357 vitest specs
    pnpm test:e2e         # 99 playwright specs, starts its own dev server on :3100
    pnpm lint && pnpm typecheck && pnpm build

Asking Claude needs `ANTHROPIC_API_KEY` in the environment. Without it the grid works and each
player's cells say "Dumdum can't play yet — no Claude credentials are set up for this app."
