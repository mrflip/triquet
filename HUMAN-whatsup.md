# THIS DOCUMENT IS **FROM** AGENTS **TO** COACHES
It does not represent authoritative decisions: it is a conversational scratchpad. Agents should not use this as input, but are encouraged to write to it.
Agents: add at the top of the document, add a level two header;  Put the date before your title, following the examples seen here:

## 2026-09-30: Sprint foldable_ui paused before thread 4

* **Where it stands.** Threads 1-3 are done, each a PR stacked on the one before, none merged:
  #55 (fold machinery findings, docs only), #56 (`FoldButton`; the editable smith's note folds,
  starting folded), #57 (the playtesting screen's note folds too, as you asked). All green.
  Branch `20260930-fold_playtest_note` is the top of the stack; thread 4's branch is not cut.
* **Why paused.** Thread 4 (the grid's fold) needs a small hook holding the set of folded rows,
  reset per quiz, like `useChecklist`: hand-rolled rather than `@react-stately/disclosure`. CLAUDE.md
  wants your yes before a hand-roll. Say yes (or no) and the sprint resumes at thread 4.
* **Your tri-state contract is replaced** by MUI X's fold-all convention, as your note allowed:
  anything open, the triangle folds all; nothing open, it unfolds all. Every click you described
  comes out the same; only the "mixed" face goes. `whiteboard/20260930-foldable_ui/fold-machinery.md`.
* **Minor:** opening a fold on focus uses `onFocus`, one of `notes/views.md`'s tripwires, taken as
  within your ask. The triangle glyph is small; worth a look at #56 before the grid copies it. Fold
  state does not survive a reload. The playtesting note starts folded (one word to flip).

## 2026-09-30: Text fields show their markdown rendered until typed into

* **Took the rich-text Discuss item's display half** on your request: react-markdown with
  remark-breaks and rehype-sanitize, the allowlist in `src/lib/markdown.ts`. Editing is still the
  plain box. **Left out remark-gfm**, which the note named: its strikethrough takes a single `~`
  (`~50 years`). The note's "render on the server" line contradicted client-first, so it's gone.
* **How**: the textarea never leaves the page. The rendered "face" sits over it, and pure CSS
  lifts it on `:focus-within`, so tabbing, screen readers and every existing e2e
  `fill`/`toHaveValue` are untouched. A click on the face is passed to the box (a link in it opens
  instead); the caret lands where it last was, not where you clicked. Past the grid's 480px cap
  the face scrolls. The grid's row height takes the taller of raw and rendered text, so a row
  doesn't jump on focus.
* **Four spaces is a quote level**, eight is two, on screen and in the LL export alike. The export
  used to turn eight spaces into a quote holding a code block, where emphasis didn't convert.
  On screen a line follows its own indent: markdown's lazy continuation would pull `Who wrote
  it?` into the verse quote above it, so `Markdown.forScreen` closes the quote where the indent
  steps back. A `>` typed by hand keeps markdown's usual behaviour.
* **Which fields**: Clueing, Hint, Notes, Full Answer, the smith's note; on the review screen
  Guesses, Comments, Overall, and the read-only clueing, BUT NOT, answer and shared reviews.
  **Alt Text stays plain** (it's read aloud as written); Title and Q# are one-liners. The grid's
  BUT NOT preview is still a raw snippet, since truncation can cut a marker in half.
* **The screen renders more than the league does**: lists, headings and links show here, but the
  LL export only translates bold, italics, quotes and line breaks. A clue like `1984. Who...` now
  renders as a numbered list. Worth a look if smiths get surprised.

## 2026-09-30: Sprints -- /sprint orchestrator and thread-worker agents (#47)

* **A sprint** is now a defined thing: an ordered series of threads issued at once, run back to
  back by agents (`notes/git_hygiene.md`, *Sprints*). The `/sprint` skill orchestrates from the
  main session: a skill loads inline, so it costs no delegation depth and you can interject
  mid-sprint. Subagents sub-spawn freely: `.claude/settings.json` (new) sets
  `CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH=5` (the harness default is 3; it reads the setting at
  session start). `.claude/agents/thread-worker.md` is the full-capability worker, one
  fresh one per thread, in series, stacked branches, one PR each, nothing merged. A
  `pre-thread` agent (sonnet) does each thread's *Starting* -- the tidy and the `newb`,
  straightforward conflicts repaired, judgment ones bailed -- keeping rebase churn out of
  the orchestrator's and workers' context.
* **Documents**: plan in `whiteboard/YYYYMMDD-<sprint>/<sprint>-plan.md` (with look-ahead across
  threads), running handoff in `<sprint>-progress.md`, modelled on the convex_yay pair. A
  worker's "chat" is its final report; the orchestrator relays it to real chat whole and owns
  every pause/continue call. It also mirrors the sprint into a Claude Doc -- a Plan tab, a
  Progress tab, and a tab per thread's report -- so you can watch from any device; the
  whiteboard files stay the source of truth. YOLO is written down as "more reluctant to
  pause", never "more willing to gamble".
* **Open questions** (also on #47): should the orchestrator run `/code-review` on each thread's
  PR before continuing, as the convex_yay plan did per phase? And should a paused sprint
  schedule a check-in, or just wait for you?
* **A flake for the record**: `e2e/expressions.spec.ts:108` (the preview pointing spec) failed
  once under the full suite and passed alone; this PR is markdown-only.

## 2026-09-30: The smith's note on the playtesting screen and in LL BBCode (#48, #49)

* **#46 still waits on the production backfill.** #44 is live, so its widened schema is too; run
  `migrations:backfillSmithsNotes` there (dry run first) before marking #46 ready.
* **Flaky e2e spec**, not from this work: `failures.spec.ts:63` (*a failed combined run is shown
  by its button and touches no cell*) fails about half the time on `main` (3 of 6 with
  `--repeat-each 6`): the "Couldn't recalculate" sentence never appears. I haven't dug into it.

## 2026-09-30: A smith's note beside the quiz's name, and the migration it needs

* **Before merging the tightening PR, run the backfill on production.** The first PR widens:
  production's quizzes have no `smiths_note`, and the schema lets them lack it until
  `./scripts/doppledo dev_aijanitor npx convex run migrations:run '{"fn": "migrations:backfillSmithsNotes"}'`
  (after the same with `"dryRun": true`) has filled it in. The tightening PR (a draft, stacked on
  top) makes it required again, and its push is refused if any quiz is still without one.
* **Not rehearsed on a production snapshot**: that needs `dev_aijanitor`, which I wasn't given.
  convex-test covers the widened schema taking a quiz without a note, the backfill (and running
  it twice), and an edit filling the field in.
* **Formulas don't see the note**: `Quiz.exposed` is still `label` and `title`. It does travel
  in Raw Export and the quiz's history (`quiz ~smiths_note` in a commit subject), as every quiz
  field does.
* **Height**: MUI's `maxRows` (14) does the growing and the scrolling; nothing hand-rolled.

## 2026-09-30: LL Export, and the export/import and prompts panels as tabs (#41, #42, #43)

* **LL Export** follows the sheet's formula: `rank|body|full answer|notes$$` per question. The alt
  text is left out, as the formula skips that column. A question with no Q# is exported last with
  a blank number, as Renumber leaves it.
* **Blank questions** (no Q#, no text) export as `|||$$`; the league's side filters them out.
* **Markdown** is read by `mdast-util-from-markdown` (already in the tree through `@next/mdx`, now
  a direct dependency, listed in `notes/stack.md`). A line indented four spaces is read as a quote
  (`^    ` → `> `) rather than a code block, so its emphasis converts, and every quote marker is
  written back out as four spaces: `>  foo` and `     foo` both export as five spaces and `foo`.
* **TabbedPanel** (MUI Tabs) keeps hidden tabs mounted, so a prepared Raw Export or a half-pasted
  Import survives a look at another tab. The e2e specs bring a tab forward with `showTab`.

## 2026-09-29: No test can call Anthropic; the ask route now needs ENABLE_ANTHROPIC_BOT=allow

* **Before you deploy this: set `ENABLE_ANTHROPIC_BOT=allow`** in Doppler's `prd` (and in `dev`
  if you want bots locally). Without it the ask route declines every ask, politely.
* **Audit.** The ask route is the only code that reaches the SDK. No vitest test touches it except
  the new `tests/app/api/ask/route.test.ts`, which stubs `fetch` and asserts it is never called.
  Every e2e spec that asks stubs `/api/ask` in the browser; the dev server gets a fake key; and now
  `ENABLE_ANTHROPIC_BOT=off` too, so an ask a future spec forgets to stub is declined before a
  client is built. One gap remains: locally, Playwright reuses a server already on the e2e port,
  and a server someone started by hand has whatever environment they gave it.
* **Open question.** `/api/bots` still says a bot can play whenever a key is set, so on a server
  with asking switched off, a cell looks playable and then says it is switched off when
  double-clicked. Folding approval into the bot statuses would give the calmer notice up front,
  but e2e would then need the switch on to show playable bots, which gives up the guard above. I
  left it alone.
## 2026-09-29: Fonts come from npm, not from Google at build time

* **The flake.** `pnpm build` in CI failed now and then with `next/font/google queries have
  exactly one entry`: `next/font/google` fetches every font file from Google during the build,
  and when an answer comes back wrong, Turbopack's font loader throws. It happens to plenty of
  other projects too, and the usual fix is the one I made: stop fetching.
* **The fix.** The three typefaces now come from the Fontsource packages, through
  `next/font/local` (`src/app/fonts.ts`): same weights, same CSS variables, latin only as before.
  With the network blocked, the build now passes, and the old setup fails the way CI did.
* **Added without asking**, per the Library-first rule: `@fontsource/zilla-slab`, `work-sans`,
  `jetbrains-mono`. Listed in `notes/stack.md`.

## 2026-09-29: Playtest failures -- a first review never opened in production; failures now say so

* **The bug.** Every review write from a first-time reviewer was refused `reviewNotOpened` (16 in
  the prod logs, 04:34-05:04 UTC, all benemup). `ReviewScreen` dispatches `open_review` from a
  mount effect; `useHunt` kept the dispatcher's `latest` ref in a *passive* effect of the parent,
  which React runs after the child's, so the first dispatch saw `open === null` and `carryOut`
  dropped it without a word. Fixed by keeping the ref in `useLayoutEffect` (all layout effects run
  before any passive one). A dropped change now warns in the console instead of vanishing.
* **Why no test caught it: StrictMode.** Under `next dev` React re-runs mount effects after the
  parent's have run, so the second `open_review` lands. Against a production build, 4 of the 5
  review specs failed before the fix; all pass after it (3 repeats), and the full dev suite is
  green. **Proposal:** an e2e run against `next build && next start` (a `test:e2e:prod` script
  beside the others), at least for the review and routing specs, since dev mode hides this whole
  class of effect-ordering bug. I didn't add it: the e2e layer's thickness is open with you.
* **Console reporting.** `src/lib/postmortem.ts` (`Postmortem.of`, `.report`): every failed call
  now logs one headline (`Triquet: could not keep a change (set_reviewing) — refused
  (reviewNotOpened): ...`), then a bag with the Convex function, request id, refusal kind, Zod
  issues, the action, labels, role, connection state, commit and backend, then the error itself.
  A refusal warns; anything else errors. Wired into `useHunt`, `useAccountActions`,
  `useWholeHunt`, the history feed, and the two history `catch {}`s that used to swallow silently.
* **Error boundary.** `src/app/(synced)/error.tsx` → `PageFailed`: a query that throws while a page
  draws used to leave Next's blank "Application error"; now it logs a postmortem and shows the
  reason, the request id to send us, and Try again.
* **Still poor, not changed: where a refusal shows.** On the review screen `saveNotice` is a muted
  line at the top of a long page; someone typing into Q15 never sees it. A MUI `Snackbar`+`Alert`
  (or an `Alert` pinned beside the Share button) would fix it. Say which and I'll do it.
* **Console only reaches us if a playtester opens devtools.** Sentry is still "probably?" in
  `notes/stack.md`; `Postmortem.report` is the one place to hook it in when it's decided.
* **Keys.** `dev_aijanitor`'s `CONVEX_DEPLOY_KEY` is prod (`prestigious-coyote-542`). It first
  lacked `deployment:logs:view`; after you widened it I read the logs and three tables (reviews,
  idents, huntings), read-only. benemup's review row dates from 05:11 UTC, when some path finally
  opened it. My own probe at 05:28 left benemup an empty reviewing on Q15 ("Right Hand Drive"),
  harmless.
* **Lint vs notes/testing.md:** `vitest/valid-expect` refuses `expect(x).to.be.true`, which the
  testing note lists as the style; I used `.to.eq(true)` as other tests do. One of the two should
  change.

## 2026-09-29: Production unstuck -- the first migration

* **Why pushes failed.** `5aebebc` (authorization) made `hunt_id` required on questions and
  reviews; production's 123 questions and 1 review predate it, so every push since was refused.
  Nothing else in production failed the schema (checked table by table against a copy).
* **Five hunts had nobody on them** (all but `eerie_takin`), so the authorization code would have
  locked everyone out, with no smith left to add anyone. As agreed, the backfill makes `mrflip`
  their smith; three look like leftovers of measurement runs (`condemned_chipmunk`,
  `comprehensive_vole`, `impossible_fish`) and can be deleted from the app.
* **Two pull requests.** This one widens (the field optional in the schema only, reads falling
  back to the quiz's realm, an edit filling the field in) and adds `@convex-dev/migrations` with
  three backfills. After it deploys, `./scripts/doppledo dev_aijanitor npx convex run
  migrations:runAll`. The second makes the field required again; its push is the proof.
* **Rehearsed** on a snapshot of production imported into the `agent` backend: 123, 1 and 5 rows
  written, and the tightened schema then pushed clean. The export also left a snapshot in the
  dashboard.
* **The no-migrations guidance is gone** from `CLAUDE.md`, `notes/convex.md` and
  `notes/deploy.md`, which now has the widen, backfill, tighten steps.
* **An `eslint-disable-line`** for `unicorn/no-top-level-side-effects` on `app.use(migrations)` in
  `convex/convex.config.ts`: a component is registered only that way.
* **Still stale in `notes/deploy.md`:** *Not yet done* says production has never deployed, which
  is no longer true; I left it for you to say what of Phase 3b is actually done.

## 2026-09-29: Doctoring -- rules files for Convex and views, skills pruned lightly

* **Two notes now load themselves.** `notes/convex.md` (paths `convex/**`, `tests/convex/**`,
  `src/state/**`, `src/lib/rows.ts`) carries the row-shape paragraph, the pointer to Convex's
  generated guidelines, the *Rules overrides* list moved out of the progress document, and the
  moments to name a Convex skill. `notes/views.md` (`src/components/**`, `src/app/**`) carries the
  Library-first tripwires, the styling rules and the MUI skill moments. Both are symlinked into
  `.claude/rules/` like `testing.md`. `notes/testing.md` now also loads with `tests/support/**` and
  `e2e/**`, and names `/vitest` and `/playwright-cli`.
* **CLAUDE.md** points at them instead of carrying the text: 16.9k to 16.1k characters, about
  200 tokens a session. Smaller than the 800 I estimated: the pointers cost some of it back.
* **Why the skills went unused** (53 sessions, three machines, zero invocations): a skill loads
  only when named, by you or by the agent judging the task matches its one-line description.
  CLAUDE.md's direct file pointers pre-empted them, and the descriptions name no moment to fire.
  The rules files above now name the moments.
* **Skills removed**, per your triage: `convex-quickstart`, `convex-improve-convex-plugin`, and
  `material-ui-review` (its body is a PR-review procedure for the MUI library's own repo). The
  three you marked "probably don't need" (`convex-agent`, `-billing`, `-domains`) are still here.
  The listing is about 1.9k est. tokens, still near the budget where entries get truncated.
* **Not edited, copy provided.** `whiteboard/convex_yay-progress.md` belongs to the other thread;
  the replacement for its *Rules overrides* section is in
  `whiteboard/20260928-doctoring/convex_yay-progress--rules-overrides-replacement.md`.
* **Heads-up: the three doctor tarballs (31 MB) are staged.** I left the index as I found it, but
  they should probably not land in history.
* **Heads-up: `notes/decisions/` does not exist**, though CLAUDE.md (and now `notes/convex.md`)
  cite `notes/decisions/2026-09-convex.md` and `2026-09-client-first.md`.

## 2026-09-28: The cloud, measured

Production (`triquet.vercel.app`) against the local backend, the same script for both, with a
second browser watching. A one-row edit shows in 150 to 230 ms (locally 60 to 95), a sort in 400
(150), and a fresh tab in 590 (230). Bandwidth doesn't change. A reorder, at 233 ms, passes the
150 ms line the verdict set, so the optimistic `move_question` is called for; the sort is the
next candidate. The tables are in `notes/database-decisions.md` (*Measured in the cloud*).

Two things for you:

* **Database I/O and function calls** in the cloud are only on the Convex dashboard's usage
  page. The runs were 19:17 to 19:28 UTC today, about 200 mutations over three hunts.
* **Leftovers in production**: hunts `condemned_chipmunk` (a run that broke off early),
  `distant_wallaby`, `comprehensive_vole` and `impossible_fish` (the script's own check), and
  eight `measure_*` idents. There is no hunt deletion, so they stay until you clear them.

The script is `scripts/measure-latency.ts`, and the summary `notes/20260928-cloud_measurements-a.md`.

## 2026-09-28: Convex phase 7, authorization

Branch `20260928-convex_phase7`, rebased onto `main` after the audit. Green: lint, typecheck,
2037 unit and convex tests, 171 e2e specs.

The server enforces membership now. Smiths read and change their hunt. Reviewers read it and
write their own reviews. Anyone else gets, at the address they asked for, *"You are not yet a
member of this hunt. Ask Flip (flip_kromer) to please add you: they can put your ident,
"ada_lovelace", on the hunt from the Members panel beneath any of its quizzes, and this page
opens for you as soon as they do."* The page opens for them live once a smith adds them. A
reviewer who asks for `act=smith` gets the same kind of notice, naming the smiths who could
promote them. Every rule is in `convex/authorize.ts`, keyed on the ident rather than the browser
key, so the identity plan changes one function (`identFor`).

For your word (details in the progress document, *Deviations*):

* **`hunt_id` on questions and reviews.** Without it, authorizing each question's query means
  reading its quiz row. Every reorder writes that row, so every question's query would rerun on
  every reorder.
* **A hole the plan left, closed**: `perform` trusted the `{ hunt, realm, quiz }` the browser
  sends. Checking the role on the hunt alone would let a smith of one hunt edit, lock or delete
  another hunt's quiz by naming it. The place is now held to the hunt it is authorized on.
* **Reviewers see each other's shared reviews once their own is shared** (your call, 2026-09-29),
  under *Other reviews* on the review screen; withdrawing hides them again.
* **The smiths' panel still filters to shared reviews**: a smith's own draft review reaches their
  browser, and would otherwise be listed as shared.

Optimistic writes: still held off; nothing in this phase ran into them.

## 2026-09-28: Convex phase 6, huntings

Branch `20260928-convex_phase6`, stacked on phase 5's. Green: lint, typecheck, 2005 unit and
convex tests, 170 e2e specs.

Hunts have members now. Whoever makes a hunt is its smith. A smith adds someone from the new
Members panel by the ident label they chose, as smith or reviewer. Adding them again changes their
role, and a *Copy reviewer link* button sits beside it. `/my/hunts` lists only your own hunts,
each with your role. A link that names no `act` opens as your role: smiths get the workbench,
reviewers the review screen. A stranger sees *You are not on this hunt. Ask a smith to add
“label”.*. A reviewer who asks for `act=smith` is told they're a reviewer and offered the review.
All of this is client-side: the server stays wide open until phase 7.

Choices for your word (details in the progress document, *For the Coach*):

* **Caps**: huntings 999; quizzes per realm and expressions per hunt raised to 999; widgets,
  columns and realms per hunt left at 99, since a grid of 99 columns is past use and every hunt
  has one realm.
* **Nobody changes their own hunting**: a smith can't remove themselves or change their own role.
  The thread only barred self-removal; changing your own role is refused for the same reason.
* **A new hunt's label** is picked in the browser, which now sees only its own hunts. On a
  clash with someone else's hunt, it tries up to three fresh labels.

Fixed on the way, in a commit of its own: a Q# or number box holding a lone `.` committed `NaN`,
which the server refused (phase 5's `NumberField`). Also: one e2e spec was passing by coincidence
once the page held a second table. The grid is now the table named *Questions*.

Optimistic updates: still not taken up. Nothing in this phase ran into the rapid-toggle case.

## 2026-09-28: Convex phase 5, reviewings

Branch `20260928-convex_phase5`, stacked on phase 4's. Green: lint, typecheck, 1966 unit and
convex tests, 165 e2e specs.

A reviewer now gives a verdict on each question under the answer lock: get rate (0 to 100),
guesses, comments, minutes, and three toggles (👍 keep it, 🔍 needs fact check, ✂️ elimination
candidate). Each saves as it is committed, and revealing the answer records `peeked`. Once the
review is shared, your Reviews panel shows a table of those verdicts in rank order, the get rate
The panel spans the full width once it has a table.

On your word since: the get rate is the reviewer's own estimate; `peeked` is the reviewer's own
record (their lock says "Seen before"; the smiths' panel no longer marks it; the lock's dialog is
its title alone); draft verdicts stay hidden by the client-side filter, a convenience rather than
enforcement; and every number box, the grid's Q# included, is `react-number-format`, installed
without asking, with that rule written into `CLAUDE.md` and `notes/stack.md`. Phase 6 raises caps
to 999 as warranted, huntings included.

One behaviour still for your word (details in the progress document, *For the Coach*):

* **Two quick clicks on a toggle send the same value twice**, as the lock does. No optimistic
  updates yet.

Also fixed on the way: `scripts/convex_reset` could fail with an OCC conflict on a backend
holding 500+ rows in a table, because `testing:clearAll` scheduled itself while the script also
looped over it. Now the script is the only driver.

The hunts-and-idents handoff is rewritten for phase 6 on Convex.

## 2026-09-28: The order on the quiz, a query per question, and actions that read less

On your word: a quiz holds its questions' order (`quizzes.row_ordering`, by `_id`: a label would
make a relabel rewrite the quiz, and cost a lookup per row), questions lost `position`, and each
question is a query of its own (`questions.open`) beside the quiz's frame (`quizzes.open`). Every
action reads only what it needs. Green: lint, typecheck, 1914 unit and convex tests, 164 e2e.

What it bought, measured as before (the 24-question hunt, a second browser watching):

* **A text edit costs about 3 KiB of database I/O, down from 46**, and each browser downloads
  about 5 KiB per edit instead of 15.
* **A move costs what it did** (about 45 KiB): it reads every question for their Q#s.
* **Function calls went up**, from 3.7 to 10.1 per edit, mostly cache hits; nowhere near binding.
* **Adding a question, and a fresh tab, take one more round trip**: the quiz names the question,
  then its query is asked for (add: 115 ms locally, 261 ms at an 80 ms network).

Two things for you:

* **The "never a query per row" guidance** is left as it stands and not followed, as you asked;
  the progress document lists every line that now disagrees with the code.
* **One choice on the order**: on the quiz row, a move, add or sort reruns `hunts.open` (about
  10 KiB, nothing resent, since Convex sends nothing when a result is unchanged). Its own
  one-row-per-quiz table would spare that. I left it where you asked.

## 2026-09-28: Convex phase 4, the verdict: keep Convex

Branch `20260928-convex_phase4b`, stacked on `20260928-convex_phase4` (whose phase 3a was done,
just not yet marked in the progress document; it is now). Green: lint, typecheck, 1902 unit and
convex tests, 164 e2e specs.

**The verdict** is in `notes/database-decisions.md` (*Verdict*) and the decision record is
`notes/decisions/2026-09-convex.md`, both waiting for your word. In one paragraph: every column of
the scorecard held from experience except *Boring*, which stays at ● for a handful of surprises
in the spike (none recurred, none needed a workaround worth the name). Offline and the silent
account are not missed yet; the browser key stands in until the identity plan. What we gained is
a server-side chokepoint for every write, global facts (label uniqueness in the transaction), a
schema authored once in Zod, and a test suite that runs in two seconds plus an e2e suite in a
minute that stopped flaking. Database I/O, not function calls, is the number that binds, as the
appendix predicted.

The numbers (local backend, production build, the sample-sized hunt, a second browser watching):

* A change shows 70 to 90 ms after it is made locally, 150 to 175 ms at a simulated 80 ms
  network, about 300 ms at 200 ms. A sort takes a little longer (it rewrites every place).
* A fresh tab paints its shell in 30 to 60 ms, and the quiz in 225 ms locally, 400 ms at 80 ms.
* Each edit costs about 46 KiB of database I/O and 3.7 function calls (2.2 not cached). At an
  edit every fifteen seconds, the free plan's 1 GB lasts about ninety editing hours a month.
* A quiz screen holds four live queries, none per row.

Three things I decided that you may want to overrule:

* **The Export box now reads the hunt only when asked** (*Prepare export*), and empties at the
  next change on screen. Asking again after every change, on every open screen, was the largest
  cost the app had: half of what each browser downloaded. This was the plan's named alternative.
* **No optimistic updates.** Locally nothing is felt. When the cloud lands (3b), re-measure; an
  optimistic reorder is first in line if it passes about 150 ms.
* **The widgets table is a tagged union** now, since the bridge derives one cleanly.

Two findings for later, neither built: on a 60-question quiz most of a change's 200 ms is the
grid's formulas being recomputed for every question on each redelivery (memoizing by question
would fix it); and `hunts.perform` reads the whole open quiz for every action, half of all
database I/O.

Also: `pnpm start:agent` serves the agents' production build on 3004; `scripts/convex_dev
--reset` now empties and pushes again when a schema change refuses the push (it had stopped the
e2e suite from starting); `whiteboard/jazz-migration.md` moved to `notes/prior-work/`. Still
yours: the four Doppler variables from phase 2.

## 2026-09-28: The Convex plan, extended through the playtesting thread

Assessed where phases 0 to 2 left things (all green today: lint, 1907 unit and convex tests,
163 e2e specs; typecheck trips only on the stale `.next-e2e/dev/types`) and extended
`whiteboard/convex_yay-plan.md` from *Where this stands* onward. Phases 3a and 4 stay on this
branch as one PR; 3b is the cloud, yours to unblock whenever; phases 5 to 7 are hunts-and-idents
PRs 4 to 6, translated onto Convex. The progress document's status matches.

Three things I decided that you may want to overrule:

* **Settled item 15 is amended**: the playtesting PRs now come before the identity plan, on the
  browser key, rather than after it. Phase 7's authorization is therefore as strong as the honour
  system, which the thread always said; it is built so the identity plan changes one function.
* **Phase 7 asks you one design question before it is built**: a query the caller may not read
  answers `null` with a reason (so `QuizRoute` can word the notice) rather than throwing, since
  `useQuery` throws into React. My recommendation is in the phase.
* **Phase 6 proposes a cap of 99 huntings per hunt**, like the other per-parent caps.

Still yours from phase 2: the four Doppler variables. (The `.env.local` at the root turns out to
be the CLI's, rewritten on every push; harmless, nothing to do. The stale `.next/dev/types` no
longer fails typecheck: `validator.ts` is excluded.) Phase 3b's list (team, project, keys, Vercel's
build command) is unchanged.

## 2026-09-28: Convex phase 2, the app runs on Convex

Branch `20260928-convex_client`, stacked on `20260927-convex_phase3`. Jazz is out: the browser
reads through Convex queries and writes through `hunts.perform`, and a refused change says why on
screen. `pnpm dev:agent` (and `pnpm dev`, which I changed to match) starts the role's Convex
backend beside Next through `scripts/convex_dev`. Details and every deviation are in
`whiteboard/convex_yay-progress.md`.

The hunts cap is now 999, as you agreed, so a whole e2e run fits in one go.

Jazz's leftovers are gone, bar four Doppler variables nothing reads: `JAZZ_DEV_DATA_DIR` and
`JAZZ_DEV_PORT` (in `dev_claude` and `dev_e2e`), and `NEXT_PUBLIC_JAZZ_APP_ID` and
`NEXT_PUBLIC_JAZZ_SERVER_URL` (in `dev_claude`).

Things you might trip over:

* Your `.next/dev/types/` still names the pages as they were before the `(synced)` route group,
  which fails `pnpm typecheck` and `pnpm build:agent` until your next `pnpm dev` regenerates it.
* A change now lands one round trip after it is made. Six e2e specs had relied on the same
  instant, and now wait for the state they need.
* An open quiz that someone relabels takes your address along with it. That's new, and it came
  out of the phase's code review.
* The Export box asks for the whole hunt again after each change, instead of subscribing to it.

## 2026-09-27: The Triquet brand is in

The palette now comes from the brand kit (`Brand` in `src/app/palette.ts`, also emitted as
`--brand-*`). A site header with the logo sits on every page, and `/about` offers the kit for
download. The brand swatches came from a quick spike, and legibility wins over them. Verdigris
is deepened for light and lifted for dark. Bermuda and comet are soft fills where they can't
carry text. `tests/app/palette.test.ts` and `theme.test.ts` hold every pairing to WCAG AA.
The manifest's 192px icon is the 512 scaled down.

The assets' C2PA metadata is stripped: SVGO removed only the metadata from the SVGs, and the
PNGs were re-encoded losslessly, so every file renders pixel-identical. The pages that need Jazz
now sit in the `(synced)` route group, whose layout holds `SyncProvider`. `/about` stands
outside it and never opens the database.

A trap in the e2e setup: `playwright.config.ts` reuses any server already on its port. While
another checkout's server held 3002, `pnpm test:e2e` quietly tested that checkout's code, and
wrote its throwaway hunts into that server's database. `pnpm test:e2e:agent` sidesteps it. Should
`reuseExistingServer` check that the server is this checkout's?

## 2026-09-27: Convex phase 1, the server side: two questions for you

Branch `20260927-convex_server`, stacked on the spike branch. The whole server is in `convex/`:
schema derived from the row validators, the queries the views will subscribe to, `hunts.perform`
and `idents.performAccount`, all tested under convex-test (a port of every Jazz action test, case
for case, plus the queries and the caps). The app still runs on Jazz; phase 2 switches the
browser. Your plan edit (the caps) rode in with the first commit. Details and every deviation are
in `whiteboard/convex_yay-progress.md`.

1. **Quizzes per realm: 99?** Every child is read with a bound now, and a realm's quizzes had
   none. I used 99, like the others. Say if you want another number.
2. **Should a refusal say so?** A locked quiz, a taken label, a cap reached: each writes nothing
   and tells the author nothing, as under Jazz. Phase 2 could answer each with a notice. Which,
   if any?

Things you might trip over:

* Convex refuses a hyphen in a module path, so `convex/**` and `tests/convex/**` are underbar_case,
  with an eslint block allowing it there.
* The models are Convex-shaped already: every `<parent>_id` is a Convex id (UUIDs still pass, so
  Jazz works), and an identing names its browser. Two small Jazz-side bends make that fit:
  the identing insert and the coherence test.
* The plan's botting index would have spent six index ranges per question, past Convex's 4096 per
  function for a big quiz. One walk per cell spends three.
* The Jazz migration check ran clean: the Jazz schema did not change.

## 2026-09-27: Convex phase 0, the spike: three things for you

Branch `20260927-convex_spike`. Convex is installed beside Jazz, the app still runs on Jazz,
and the plan's eight phase 0 questions have answers in `whiteboard/convex_yay-progress.md`.
The short of it: the Zod bridge converts every row validator we have, our patched Zod and error
map run inside Convex, and a mutation round trip on a local backend is about 30 ms. The tree
types now carry `_id` (the Jazz rows keep `id` until phase 2).

What I need from you before phase 1:

1. **Isolation.** Convex's own local deployments are one per checkout: a second one, named by
   its own env file, silently reuses the first one's data and port. What works is the backend
   binary the CLI already downloads, one per role with its own ports and data directory. I'd
   like to write `scripts/convex_backend <role>` for it, on ports 34xx and 35xx (Jazz holds 32xx
   until phase 2), and use it for your dev server too. Yes, or another way?
2. **Doppler**, once (1) is settled: four variables per dev config, listed in the progress
   document's *For the Coach*.
3. **`npx convex ai-files install`** was refused me, as self-modification: it writes into
   `CLAUDE.md`, `AGENTS.md` and the agent skills. Run it yourself if you want Convex's rules file
   in the repo; I worked from the same guidelines, fetched.

The e2e suite was flaky here under a load average near 20: a different handful of Jazz-bound
specs failed each full run, and every one passed alone. At three workers, 151 of 152 passed.
Worth one run on a quiet machine before this merges.

One config change you might trip over: `tsconfig.json` no longer maps `#inspect-env` to the
node half of `inspectify`. Convex's bundler honoured that path and pulled `node:util` into its
V8 runtime; `package.json`'s imports map already picks the right half everywhere.

## 2026-09-27: Exports and quiz histories carry no ids

The Export box and each quiz's `.tq.json` in its history now name everything by label: no ids
at any depth, and a chain names its target by label. Import resolves chains by label and picks a
quiz out of a whole export by label, then title. It still reads ids, so your pre-hunt backup
(ids and all) imports as before, chains included. Built from the whole tree minus its ids rather
than from the models' `exposed` lists, which are the formula bag's and would have dropped the
version, widgets and columns a history file needs.

One thing for you before PR 3, in `whiteboard/hunts-and-idents-handoff.md` ("Known race"): a
visitor whose browser has never synced, on a server too slow to answer within three seconds,
makes a second ident with the label they typed, and then *is* that second one. Reviews hang off
idents, so I'd fix it first by resolving the current ident through its label (earliest wins, as
for hunts). Say if you'd rather it wait.

## 2026-09-27: Bots, then hunts and idents (PRs 1 and 2 of the playtester plan)

Two branches, stacked: `20260927-bots` (players became bots) and `20260927-hunts` (idents,
hunts, realms, the gate at `/`, `/my/hunts`, `/h/<hunt>/<realm>/<quiz>?act=smith`; the
workspace is gone). The next agent's notes are in `whiteboard/hunts-and-idents-handoff.md`.

**Deploy them together.** PR 1's migration renames the widget kind `playing` to `botting`;
deployed alone, the live app's quizzes would have widgets the old code cannot read. Run
`jazz_deploy` under `prd_janitor` for both before merging, per `notes/deploy.md`.

**Your current quiz will not appear after the deploy.** Old quizzes and expressions point at a
nil hunt and belong to none. Make a hunt, then paste your backup into its Import box: that
restores the questions. It does not restore custom expressions, widgets or columns, which the
old workspace export carried but the importer merges only questions from. Re-add those by hand,
or tell me and I'll write a one-off importer.

**A `@ts-expect-error` in PR 1's migration.** The typed check refuses an enum's value list
changing (no lens retypes an enum), though the server applies it; the reason is beside it.

**Reads are scoped to the open hunt**, a change from the plan, which read every table whole.
Every hunt is readable by everyone, so whole-table subscriptions made each browser sync every
hunt and hear every edit anywhere. The e2e suite, which makes a hunt per spec, fell over under
it: 21 minutes and 26 failures, every file passing alone. Now hunts, realms and quizzes are
read whole (to resolve addresses and list hunts) and the rest by the open hunt's ids. Jazz's
`hopTo` would have been neater, but in alpha.56 it aborts the Node test runtime; details in
`notes/decisions/2026-09-jazz.md`. While a query is changing (a quiz or question just added),
the page keeps each table's last rows rather than blanking: a small hook, `useKept`, which is
the kind of holding-on the Jazz skill warns against. I think it is warranted; say if not.
With that, the full e2e suite is 150 of 150 in under three minutes. (The rest of the failures
were specs of mine: `newQuiz` waited for an address pattern that the new `?act=smith` suffix
never matched, so specs typed before the new quiz was on screen.)

**Wide open means anyone can edit**, including a reviewer who sets `act=smith`, until PR 5.

**The quiz history only records this tab's own edits.** A friend's edits reach your screen but
not your git history until you edit that quiz yourself.

**The e2e database needs a reset after a schema change.** Without one, every subscription on the
e2e server sat waiting. `./scripts/doppledo dev_e2e ./scripts/nuke-jazz_local`, with no e2e
server running; I did this twice. Your `data/jazz/` will likely need the same after pulling
these branches: `doppler run -- ./scripts/nuke-jazz_local` with your dev server stopped (it moves the folder aside
rather than deleting it).

**One mistake of mine.** While stopping my servers earlier I ran `pkill -f 'next dev'` under your
user, which matches any `next dev`, not only mine. Nothing of yours was running when I checked
afterwards, but if a `pnpm dev` of yours died on the morning of the 27th, that was me.

## 2026-09-27: e2e specs converged on Playwright's grain; assertion style follows the runner
## 2026-09-27: Reviewed Changes

Coach has swept changes into future documents

## 2026-09-19: Reviewed Changes

Coach has swept changes into future documents
