# Recap: markdown to board BBCode, the recap note, field templates, quiz-level widgetings

Sprint plan, 2026-10-06. Mode: **YOLO**. Review level: **medium**. At most **3** threads at once.
Issued by the Coach (Flip): `whiteboard/20261005-recap/20261005-recap_preplan.md` (the threads,
verbatim below) and `20261005-recap_bbjank.md` (the board format's spec), beside this file.
**Status: paused at the Coach's word after thread 6. Threads 1-6 merged to main with #167 (2026-10-07); ad-hoc #168 open; 13, 11, 10, 12, 7, 8, 9 to run. See `human/20261006-sprint_recap_paused.md`.** `recap-progress.md`, beside this file, is newer than this plan wherever the
two disagree.

**What the Coach needs by the end** (their words): "an export of simple markdown into bbjank; I can
copy paste whatever." Threads 1, 2, 4 and 5 deliver that. Thread 6 is the stretch: it is a
general quiz-authoring feature, and is built small. Where a thread is tempted toward the grand
general tool, build the small thing and write the rest to `whiteboard/TODO.md`.

## Read first

Beyond CLAUDE.md and its auto-loads (`notes/stack.md`, `notes/testing.md`, `notes/convex.md`,
`notes/views.md`):

* `20261005-recap_preplan.md` and `20261005-recap_bbjank.md`, beside this file: the Coach's own
  words. The bbjank spec's closing block ("as tried on the boards") wins over its bullets.
* `notes/vocabulary.md`, *Widgets* and *The things an author makes*, and `STYLE.md`, before naming
  anything. **bbjank** is the Coach's word for the league's *message-board* BBCode, as opposed to
  the BBCode its quiz import and smith's note take (`src/lib/ll-bbcode.ts`, `ll-smith-export.ts`).
* `notes/deploy.md`, *Schema pushes* and *Serial Deploy*, before thread 1 or thread 9, or any
  thread that finds it must change a row's shape.
* The code as it stands: `src/lib/markdown.ts` (the one sanitize allowlist) and
  `src/components/cells/markdown.tsx`; `src/lib/ll-bbcode.ts` (the existing mdast splicer);
  `src/lib/ask/prompts.ts` (mustache, escaping off); `src/lib/formulary/runner.ts` (`runQuiz`, the
  run order) and `src/models/quiz-bag.ts` (the bag); `src/components/panels/` (`Panel.tsx`,
  `Panels.tsx`, `LeagueExport.tsx`, `SpreadPanel.tsx`'s expand toggle); `QuizHeader.tsx` (the
  smith's note editor); `QuizManageModal.tsx`, `WidgetingsEditor.tsx`, `SortableList.tsx`.
* Commits `774d2ae` (a quiz field widened in, with a backfill) and `1e7d000` (its tightening): the
  pattern threads 1 and 9 follow.

## Ground rules

`notes/git_hygiene.md` (*The spine*, *A thread, start to finish*, *Sprints*) and
`.claude/agents/thread-worker.md`. Particular to this sprint:

* **One migration chain, `recap`.** Thread 1 widens every field the sprint needs, with backfills,
  and its PR title ends `(Serial Deploy: recap)`. Thread 9 tightens them. No other thread changes a
  row's shape if it can help it; one that must (thread 6 is the likely one) widens the same way,
  in commits of their own that touch only the schema, the row validator, the backfill and the
  schema test, titled for the same chain, and says so in its report. The orchestrator folds such
  commits into thread 1's branch at the end (*History at the end*, below).
* **Sanitizer always goes last.** Nothing is escaped or cleaned before mustache fills it, and
  nothing before the markdown parser reads it. On screen: mustache (escaping off) -> react-markdown
  (raw HTML is text) -> `rehype-sanitize`, last. In bbjank: mustache -> mdast -> the bbjank writer,
  which writes only the node types it knows and drops raw HTML nodes (as their text, never as
  markup). No HTML is ever let through; images only where the one allowlist in
  `src/lib/markdown.ts` says, `https` only. Err on the side of strictness.
* **Library first, still.** The AST does the parsing; regexes are for the few spots the bbjank spec
  names (the `{AS: ...}` annotation, the four-space indent rule, a YouTube id). Do not write a
  parser.
* **Hard things go to `whiteboard/TODO.md`**, under a section headed for the sprint and thread
  (`## From recap sprint, thread N: ...`), and into the report. "Do not be a hero."
* Mustache gets a second importer (thread 4): `notes/stack.md`'s *mustache* entry names it.
* **Targeted e2e, for a fast turnaround (the Coach, 2026-10-07).** Prove with `pnpm e2e --touched`
  (only the spec files the branch's paths reach; a path the map does not name runs the whole suite);
  use `pnpm e2e:smoke` for a quick signal while building, `pnpm e2e <spec>` and `pnpm e2e:rerun` to
  repair. A spec asks for its layout up front with `test.use({ layout: ... })` (#160). A new spec
  file needs one `@smoke` test and a `SpecCorners` entry in `scripts/spine.ts`.

## Decisions taken in YOLO

1. **Threads are renumbered into running order** (thread 10, added later, runs before 9). The Coach's order was templating, bbjank,
   widening, recap panel, quiz widgetings, panel folds, security review; each thread below names
   which of theirs it is.
2. **"widen-seed-tighten" is read as `notes/deploy.md`'s three steps**: widen (thread 1, with its
   backfills), the backfill the deploy runs ("seed"), tighten (thread 9, last). Vercel runs the
   backfills on deploy; the Coach still merges up to thread 1's PR and waits for its deploy.
3. **The fields, predicted now** (thread 1 widens them all):
   - quiz `recap_head`, `recap_tail`: noteish strings, default `''`, like `smiths_note`.
   - quiz `templated`: the fields the quiz nominates for templating, a list of field or column
     source keys (`clueing`, `recap`, a widgeting label), default `[]`. Nominated per quiz and per
     field, not per column: the recap and every export then know which text to template without
     asking the grid.
   - question `recap`: a noteish string, default `''`: what the recap says about the question.
   - widgeting `tier`: `'question' | 'quiz'`, default `'question'`: which level a widgeting runs
     at (thread 6).
   Thread 1 may rename any of these after reading the vocabulary; it records the names it chose.
4. **A template sees the bag a formula sees** (`QuizBag`: `hunt`, `realm`, `quiz`, `qns`, `qn`,
   ...), so an author learns one vocabulary: `{{qn.clueing}}`, `{{qn.my_column}}`. The Coach's
   sketch says `question.` and `questions`; the bag's own names win, and the recap template is
   written in them. Categories join the bag only if thread 4 finds it cheap.
5. **recap_head and recap_tail are always templated**; question fields and columns only when
   nominated.
6. **The recap's shape lives in code** as a markdown template (the Coach's sketch, made real), run
   through templating and then bbjank. The editable parts are recap_head, recap_tail and each
   question's recap. A stored, editable recap template is a later change, to TODO.
7. **Thread 6 is built small**: quiz-level `entry` widgetings (and `jsonata` if it falls out), the
   questions pivot in the run order, and one panel. No other formularies at quiz level.
8. **Security review is two threads**: 7 reviews and fixes what the sprint built and writes the
   rest to TODO; 8, at the end, fixes the out-of-sprint findings it is certain of.
9. **Thread 5's frame is written in bbjank around each converted text** (the worker's deviation,
   accepted): no lazy continuation between question blocks.
10. **Thread 5 landed with its flagged finding open**: author BBCode (`[/quote]`, `[/spoiler]`) can
    break the recap's frame. Two-way door; thread 7 and the Coach decide the escape.
11. **`mdast-util-definitions` not added**: a reviewer's attempt was refused by the session's
    permission check, so it waits on the Coach rather than being routed to another agent.
12. **Thread 6's pivot stays unstored; placement amended instead**: a quiz's first question
    widgeting goes just above its first quiz formula, so a delete-then-add cannot leave a quiz
    formula running before the questions. Storing the pivot would have been a widening.

## Threads

Wave one, side by side: 1, 2 and 3. Then 4 (after 1); 5 (after 1, 2, 3, 4) beside 6 (after 1 and
4); 7 after 1-6; 8 after 7; 10 after 8; 9 after 10. Then *History at the end*. Resuming: 13 and 11 and 10 side by side; 12 after 11; 7 after 10, 11, 12; then 8, 9.

### 1. Widen the recap fields (Coach's 3rd)

*Coach's text:* "thread: sprint runner -- prediict what fields you'll add (recap head, recap
tail, recap field on question, others?); have the worker write the widening expression. (sprint
runner -- at the end, rewrite history in the sprint to give a clean widen-seed-tighten series of
prs. note that vercel now runs migrations as a matter of course, but stiill inform coach in the
progress and final summary) Follow the rules for PR titles of widening prs."

Gloss: the fields of Decision 3, end to end as `774d2ae` did `q1_preamble`: model validators and
row validators (strict, with defaults), `convex/schema.ts` optional by hand, a backfill each in
`convex/migrations.ts` joined to `Backfills`, `tests/convex/schema.test.ts`'s `Backfilling`, the
projection in `src/lib/rows.ts`, readers that cope with absence, jsonball export and import
(old exports still import), and the set-actions with their policy (`set_recap_head`,
`set_recap_tail`, `set_templated`, and `recap` through `edit_question`) so later threads only
build views. Widgeting `tier` needs no action yet (thread 6 writes it). `convex/_generated/`
regenerated, in a commit of its own if large. PR title ends `(Serial Deploy: recap)`. Rehearse the
backfill against a local role (`scripts/convex_dev agent`), never production. Depends on:
nothing. **Look-ahead:** threads 4-6 read and write every one of these; thread 9 tightens
exactly this list, so record it in the thread file as a checklist.

### 2. Markdown to bbjank (Coach's 2nd)

*Coach's text:* "Look in 20261005-recap_bbjank. Do your best to make a markdown -> bbjank
converter. Do not be a hero: if sometthing is hard, write it to TODO and let me know. Do not bang
rocks together, much: the md-AST tool should cover this; I highlighted where a regex might be, and
you might find a couple similar regexes needed, but don't decide "ok ast isn't working I'll just
write my own parser""

Gloss: a pure module, `src/lib/bbjank.ts` (one entrypoint, `toBbjank(markdown)`), with a
thorough table-driven test from the spec's examples. Parse with `mdast-util-from-markdown`
(already here); `~~strikeout~~` and bare-URL autolinks are GFM extensions, so add
`micromark-extension-gfm-strikethrough` + `mdast-util-gfm-strikethrough` (with `singleTilde:
false`: trivia is full of `~50 years`, which is why `remark-gfm` is refused) and
`micromark-extension-gfm-autolink-literal` + `mdast-util-gfm-autolink-literal`, listed in
`notes/stack.md`. Then a writer walking the tree, node type by node type: strikeout -> `[spoiler]`
(`{AS: ...}` inside -> `[spoiler=...]`); blockquote opening `{AS: name}` -> `[quote="name"]`,
otherwise `[list]` per level; four leading spaces -> a quote level, pre-AST (`ll-bbcode.ts`'s
`indentsAsQuotes`-style rule; reuse, don't copy); lists, code, bold/italic/underline, links,
images, YouTube embeds and captions as the spec shows. Underline has no markdown of its own (and
`<u>` is HTML, refused): leave it out unless a convention falls out of the parser, and record
what you chose. Raw
HTML nodes are written as their text. No `[br]`. Depends on: nothing. **Look-ahead:** thread 5
feeds it whole recap documents, assembled as markdown: `> {AS: Q1}...` quotes and
`~~**ANSWER**~~` spoilers are how the recap's question blocks will be spelled, so make those two
paths solid. Keep `ll-bbcode.ts` as it is (a different format).

### 3. Panels fold and expand (Coach's 6th)

*Coach's text:* "thread: all panels have collapse triangles (turning them small), and (similar to
the radar plot) expand arrow (making them bix). Don't overinvest in making this good or pretty"

Gloss: `Panel.tsx` grows both affordances for every panel: the fold triangle (`FoldButton`,
already the row fold's) collapsing the panel to its title bar, and the expand arrow
(`OpenInFullIcon`/`CloseFullscreenIcon`, as `SpreadPanel` does it) toggling `wide`. Lift
`SpreadPanel`'s local toggle into `Panel` rather than keep two. State in React; no persistence.
Small e2e coverage. Depends on: nothing. **Look-ahead:** threads 5 and 6 each add a panel, and
get both affordances by using `Panel`.

### 4. Field templates (Coach's 1st)

*Coach's text:* "Add the ability to nominate a field to be templated with handlebars (or other npm
for mustacha). It gets basically what the expressions do, { hunt, realm, categories, quiz,
questions } -- take your best guess. Users are with this enabled to add images, etc. Don't go
nuts, right now all we need is to substitute in custom columns. We are not letting people write
html code: just basic clean markdown. err on the side of strictness. Make sure our sanitization
is on lock. Sanitizer Must Always Go Last: Do not try to sanitize the variables before putting
them into Mustache, or sanitize the text before running the markdown parser."

Gloss: **mustache** (already here, not handlebars: logic-less is the strict choice). A pure
`src/lib/templating.ts`: `render(template, bag)` with escaping off (as `prompts.ts`; non-strings
as JSON, or a widgeted's `value`), and a template check that refuses what does not parse (shown
as the cell's error, never thrown into a render). The nomination UI in the gear dialog
(`QuizManageModal`): which fields and columns are templated (`set_templated`, thread 1). A
nominated field shows rendered (`MarkdownFace`) as mustache over the row's bag, then markdown,
then sanitize; editing shows the source. Images: widen the one allowlist in `src/lib/markdown.ts`
to `img` with `src` (https only) and `alt`, for templated output at least; decide whether
untemplated fields get images too, and record it. Tests that prove the order (a variable holding
`<script>` or `javascript:` renders inert; a variable holding markdown is rendered as markdown,
since it was filled before the parser). Depends on: 1. **Look-ahead:** thread 5 renders
recap_head, recap_tail and each nominated field through this module and then thread 2's
converter, so expose a function that returns templated markdown (not React) as well as the
screen face; thread 6 adds quiz-level widgeteds to the bag, so build the template's bag through
one function it can extend.

### 5. The recap panel (Coach's 4th)

*Coach's text:* "thread: add another export doodad! this one is going to add a panel at the bottom
for creating a recap note. It will have a recap_head and recap_tail -- both similar to the smith's
note. in between is a five-line or so scrollable concatenation of the bbjank rendered head, the
tail individual questions and their recap fields, as shown below." (*Below* is the template sketch
and bbjank sample at the end of `20261005-recap_preplan.md`.)

Gloss: a `RecapPanel` under `components/panels/`, added to `Panels.tsx`: recap_head and
recap_tail editors shaped like the smith's note's (`useDraft`, `MarkdownFace`), and between them a
read-only, five-line, scrolling box (`ReadonlyBox`) with a copy button, holding the whole recap in
bbjank. Assembly (pure, in `src/lib/`, tested): the recap template of Decision 6 in markdown --
head; per question `> {AS: Q<n>}<n>. <clueing> ...BUT NOT... <hint>`, `Answer: ~~**<full
answer>**~~`, `Correct Answer %:` (blank, or a column's value if one is obviously it), the
question's recap; tail -- templated (thread 4), then `toBbjank` (thread 2). The question's
`recap` gets a cell editor so a column can show it (the field list in `QuestionRow`/`columns.ts`).
Depends on: 1, 2, 3, 4. **Look-ahead:** thread 6 puts quiz entries (playtesters, winners) in the
bag, so `{{quiz.<label>}}` in recap_head should work once it lands; write the head's placeholder
copy with that in mind, without depending on it.

### 6. Quiz-level widgetings and entries (Coach's 5th)

*Coach's text:* "thread: add quiz expressions and entries; I can (in the quiz gearbox) define
columns on the *quiz*, and custom entries (no other widgets next, unless it's easy). those actual
entries, and their columns, will appear in a new panel. In the quiz widgetings editor, just like
in the questions one, I can drag the order of widgetings: each one gets everything calculated
before it. One of them is special: the questions widgeting: calculate quiz widgetings up to that,
then calculate question widgetings, then the rest of the quiz widgetings."

Gloss: the "gearbox" is the quiz's gear dialog (`QuizManageModal`). Widgetings with `tier: 'quiz'`
(thread 1) run once per quiz; the dialog gets a quiz widgetings list (`SortableList`, as the
question one) holding one fixed item, **questions**, the pivot: `runQuiz` runs quiz widgetings
above it, then the question run order, then the quiz widgetings below it, each seeing all
before it. How the pivot is stored (a reserved row, or a position on the quiz) and where a quiz
widgeted is stored (a new table needs no widening; a reshaped `widgeteds` row would) are the
worker's to design and record; any widening follows the ground rules. Quiz widgeteds join the
bag as `quiz.<label>`, so formulas and templates read them. A `QuizEntriesPanel` shows and edits
the quiz's entries and their columns. `entry` first; `jsonata` only if it falls out of the runner.
Depends on: 1, 4. **Look-ahead:** thread 5's recap head reads `{{quiz.playtesters}}`-style
values from here; thread 7 reviews it.

### 7. Security review (Coach's 7th)

*Coach's text:* "thread: Do a strong security review. Fix anything that's part of the sprint,
make a note in the final report AND in the todo of other things to fix. At the end of the sprint,
fix what you're certain of."

Gloss: a worker-led review at `high` depth (by hand and with the `convex-authz`/`security-review`
skills, never `--fix` into the main checkout) of everything threads 1-6 built -- templating and
sanitization order above all, the bbjank writer's handling of raw HTML and URLs (`javascript:`),
the new actions' policy in `src/lib/approve.ts` and `convex/authorize.ts` -- then the app at
large. Fix what the sprint built; write every other finding to `whiteboard/TODO.md` (*From recap
sprint, thread 7*) and to `security-findings.md` in this directory, each marked *certain* or
*uncertain*, with its fix sketched. Known lead: `src/app/api/ask/route.ts` checks no session or
identity, and nothing rate-limits it. Depends on: 1-6.

### 8. Security fixes, certain ones (from the Coach's 7th)

*Coach's text:* as thread 7's: "At the end of the sprint, fix what you're certain of."

Gloss: the findings thread 7 marked *certain* and left, fixed, each in its own commit; anything
that turns out to need a design call goes back to TODO and the Coach. Depends on: 7.

### 9. Tighten the recap fields (from the Coach's 3rd)

*Coach's text:* as thread 1's: "a clean widen-seed-tighten series of prs."

Gloss: deploy.md's step 3 for every field thread 1 (and thread 6, if it widened) recorded:
required again in `convex/schema.ts`, fallbacks and backfills dropped (keep `Backfills`
non-empty), `Backfilling` emptied, the migration added to deploy.md's ledger. Its body says
`Tightens Serial Deploy: recap`; it merges only after thread 1's deploy has finished its
backfills. Depends on: 10 (last, so it is the top of the series).

### 10. The markdown dialect, settled (the Coach's clarifications, 2026-10-06)

*Coach's text:* "Is it true that our markdown AST tool returns whether strong (i.e bold) came from
`**foo**` or `__foo__` ? If so, we could (in the post-everything thread) do this: `{"type":
"strong", "marker": "__", ...}` turning only `__underlined__` into bbcode `[u]`. Much more
important: `**foo**` = bold, `_foo_` = italics, `*foo*` = italics. Also: the hinky stuff where we
build our own markdown format: * treat as real the "leading spaces become quotes" before the
rendering -- * the special underline treatment is only for LL bbcode * the conversion of quote in
markdown ast is different between smiths note (respects leading spaces) and message board bbjank
(does not)"

Gloss: mdast keeps no marker field, but a node's `position.start.offset` points into the source,
so the marker is the source's characters there (`**` or `__`, `*` or `_`; probed 2026-10-06);
`ll-bbcode.ts` already splices by those offsets. So:
* **`__text__` writes `[u]`** in both LL outputs, bbjank (`src/lib/bbjank.ts`) and the LL
  import/smith's-note BBCode (`src/lib/ll-bbcode.ts`); `**text**` stays `[b]`, `*text*` and
  `_text_` stay `[i]`. On screen (react-markdown) `__text__` stays bold: underline is an LL
  output's treatment only.
* **Leading spaces become quotes is part of our dialect**, applied before any rendering: on
  screen, in bbjank, in the LL export. Name it once (`Markdown.forScreen` or its successor) and
  document it as the dialect's rule, not a workaround.
* **Quotes convert differently per output, on purpose**: the smith's-note/LL BBCode respects
  leading spaces (a quoted line keeps every space it had); bbjank does not rescue them (the
  spec's "don't rescue the remainder leading spaces"). Each module's doc block says so, and a
  test in each pins it.
* Write the dialect down in one place (a short section of `notes/vocabulary.md` or a
  `notes/markdown.md`), so later work stops re-deriving it.

Depends on: 8 (post-everything, per the Coach). **Look-ahead:** thread 9 follows it.

### 11. Let quiz and question widgetings interleave (the Coach, 2026-10-06, while paused)

*Coach's text:* "I hadn't thought about having them mixed, and there's no seeming reason not to --
can we just let them interleave? the only reason I spec'ed "quiz pre-block, question widgetings,
quis post" waas that in my head they went in different places"

Gloss: drop the questions pivot (#166's derived *The questions* row and sprint decision 12's
placement rule). One run order, in `position` order, tiers mixed: a quiz widgeting runs once over
the questions as they stand at its place; a question widgeting runs per question, seeing every
quiz widgeting before it. The gear may keep two lists or show one with a tier mark: the worker's
call, recorded. No schema change. Depends on: 6. Runs before 7, so the security review sees it.

### 12. The Coach's follow-ups on templates and the recap (2026-10-06, while paused)

Gloss: the *Coach's answers* below marked thread 12 (`correct_pct` moved to thread 14): images everywhere held small in cells, categories in the bag, `quiz.questions` (all) beside
`qns` (visible only). Depends on: 11 (both touch the bag). Runs before 7.

### 13. Reviews that cannot touch the main checkout (2026-10-06, while paused)

Gloss: `/code-review` takes no working directory and runs in the session's main checkout, where it
once checked out a commit to try code. Make `.claude/agents/thread-reviewer.md` forbid it any
checkout, switch, stash or reset there, and probe only in the thread's worktree; and record in the
definition that a review run from inside the worktree (if the skill ever takes a directory) is
preferred. A reviewer that could not do its job because of these restrictions says so in its
report (what it could not check, and why), rather than working round them. Documents only.
Depends on: nothing.

### 14. An editable recap template, in pure mustache over markdown (fast-tracked, 2026-10-07)

*Coach's text:* "fast-track the editable recap bodies. I will want to do the below in pure mustache.
In my hopes, the recap template is more like `{{ each question }} >- {AS: Q{{question.number}}}
{{question.number}}. {{question.clueing}} ...` (that is probably not good mustache -- i'm only
communicating flavor not intent). The flow should be markdown as far as possible, unless I'm
missing something. We don't want to inject transformed code into a transformer. Is there any reason
to not have the flow be `{0 to many mustaches to produce a markdown file} { render markdown } {maybe
jank it or html it} { sanitize it }`"

Gloss: replace thread 5's code-written frame (`blockOf` in `src/lib/recap.ts`) with a stored,
editable **recap template**: markdown with mustache, filled once into one markdown document, then
`Bbjank.toBbjank` (the writer is the sanitizer). The order: fill recap_head and recap_tail (each a
template over the bag), then fill the recap template over a **recap bag** holding them, then convert
the whole once.
* **The recap bag**: the template bag (`Templating.bagOf`) plus `recap_head`, `recap_tail` (filled)
  and `played`, the questions the recap covers (thread 5's rule: go-live, no archived or alternates,
  no never-written blanks), in rank order, each with `number` and everything a question shows, plus
  **pre-shaped values** for the places markdown structure is fragile, so the template stays pure
  mustache: e.g. `quoted_body` (clueing and BUT NOT, every line prefixed `> `), `answer_line` (the
  answer safe after `Answer: `, as `answerOf` makes it today), and `pct` (from a column labelled
  `correct_pct` only, the Coach's answer; blank otherwise). Name them in the vocabulary.
* **The default template** reproduces today's note exactly (a test pins it against thread 5's
  output for the same quiz), roughly `{{recap_head}}` / rule / `{{#played}}> {AS: Q{{number}}}...
  Answer: ~~**...**~~ ... {{/played}}` / `{{recap_tail}}`.
* **Storage: a quiz field `recap_template`, Absentable** (`notes/deploy.md`: absence means the
  default template), so no backfill and no tightening: optional in its row validator for good,
  listed under `Absentable` in `tests/convex/schema.test.ts`, every reader saying what absence means.
  A `set_recap_template` action under the same policy as `set_recap_head`. Exported and imported with
  the quiz; old exports import.
* **The Recap panel** gets a *Recap template* editor (folded or below the note, with a "reset to
  default" that clears the field), shown like the head and tail (a broken template says why).
* Takes over thread 12's "`correct_pct` only". Depends on: #168's panel changes landed (it is on
  the spine). Proved with `pnpm e2e --touched`.

### 15. The recap template reads the question's own fields, and says OR ELSE (2026-10-07)

*Coach's text:* "would you make the recap template less dependent on internals; have it do quoted
body accessing the question fields. Instead of BUT NOT, use OR ELSE and insert the hint, not the
chained but not"

Gloss: thread 14's `quoted_body` is a composite the code builds (clueing, then `...BUT NOT...` and
the hint of the question it chains to). Replace composites with **per-field shaped values**, so the
template names the fields it uses: e.g. `quoted.clueing`, `quoted.hint` (each line after the first
prefixed `> `), and the same idea for the answer and recap (`oneline.full_answer`,
`below.recap`, or names the worker finds clearer), dropping `quoted_body`, `answer_line` and
`recap_below`. The default template then spells the question's line itself, with this question's
**own hint** after `...OR ELSE...`, only when it has one:
`> {AS: Q{{number}}}{{number}}. {{quoted.clueing}}{{#hint}} ...OR ELSE... {{quoted.hint}}{{/hint}}`.
A quiz with its own template saved under thread 14's names: none exist in production yet beyond
the Coach's own; keep the old names working only if it is free, else note it. The LL Export keeps
its BUT NOT (the league's format); only the recap changes. Depends on: 14 (#171).

### 16. The default recap template stands on the app's basic tools (2026-10-07, reviews paused)

*Coach's text:* "can we pause the reviews for a bit and iterate on the code. I would like the
template to basically stand on its own, not dependent on the app doing uneditable things that can
be done with expressions and mustache. I have a custom expression that I want to use instead of the
correct answer line, but we are looping on something called player, and there's things called
oneline and quoted that I don't know where they come from. I'm guessing quoted is meant to reapply
quote characters to the multiline sentence? Don't rip the other stuff out yet, but make the
template do everything using the basic tools of the app and we'll see how to close the gap"

Gloss: rewrite `Recap.DefaultTemplate` to use only what every template already sees: the bag's
ordinary question loop (`{{#qns}}`, whose items carry each question's fields and its columns by
label), the question's own fields, columns (widgeted values, the Coach's custom expressions among
them), and plain mustache. No `played`, `quoted`, `oneline`, `below`, `pct` or `number` in the
default. **Keep them in the bag** (not ripped out). The pinned default-note test follows the new
output; add a test showing a custom column (a `jsonata` widgeting) used in place of the Correct
Answer line. Write a **gap list** into the thread file and the `human/` how-to: each thing the old
shaped values did that the basic template now gets wrong (archived/alternate/blank questions in
the loop, numbering by rank, a multi-line field leaving its quote, a list-like answer, a `---`
recap), with a JSONata recipe for a column that closes it where one can (e.g. a quoting formula),
so the Coach can decide what the app should still do. **No review** for this thread, at the Coach's
word: prove with `pnpm e2e --touched` and land. Depends on: 15 (#172).

### 17. Mustache helpers for the recap's conveniences (queued after 16, 2026-10-07)

*Coach's text:* "can the custom conveniences (quoted) be done with a mustache helper?" Then: "land
the new template first".

Gloss: a small fixed set of app-defined mustache lambdas, callable only as sections and only from
app code (`quote`: fill the section, then prefix every line after the first with `> `; `oneline`:
join onto one line; `apart`: set a leading `---` apart), so `{{#quote}}{{clueing}}{{/quote}}` works
on any field or column. `BagContext` still calls nothing from the bag: database values can never
be functions. Helper output is markdown and goes through the bbjank writer last. Switch the default
template to them where thread 16's gap list says they close a gap. Depends on: 16.

### Coach's answers while paused (2026-10-06)

* **Author BBCode breaking the recap's frame: wontfix.** It may be on purpose, and the smith
  previews before posting.
* **A clueing opening `1984. ...`:** send the number through (whatever it is, not just 1), so the
  copy-paster knows how to correct it. Goes to thread 10.
* ~~**`mdast-util-definitions`: yes** (thread 10).~~ *Pulled forward into thread 14.* **Underline: bbjank only** (thread 10; `ll-bbcode.ts`
  keeps `__text__` as bold). **Fix the dangling client-first pointer** in `CLAUDE.md` and
  `notes/stack.md` (thread 10).
* **Recap placeholder: leave it as landed** (a blank question recap writes nothing). The Coach's
  "start it with a default, following the example" meant the league export's template, which the
  recap already follows.
* **Correct Answer %: only a column labelled `correct_pct`** (thread 12).
* **Images everywhere, not only templated fields**, https only, held small by CSS in the grid's
  cells (a max height, re-measuring the row on load); no size syntax extension for now (thread 12).
* **Panels uniform:** already so; every panel folds, and the widen arrow appears only where widening
  changes anything. No work.
* **Categories join the bag** (thread 12).
* **Archived questions:** `quiz.questions` holds every question; the questions bag (`qns`) holds only
  the visible ones (alternates included). Each question carries `archived`, so a template can still
  skip with `{{#quiz.questions}}{{^archived}}..{{/archived}}{{/quiz.questions}}`. Thread 12 checks
  whether any seeded formula reads archived questions through `qns` before changing it for formulas
  as well as templates, and records what it found.
* **`/code-review` and the main checkout:** the Coach asks for a workspace of the reviewer's own.
  Thread 13.
* **Strikeout on screen** (thread 10): `~~text~~` shows its tildes on screen today, since only the
  bbjank converter was taught GFM strikethrough. Teach react-markdown the same extension
  (`singleTilde: false`, never `remark-gfm` whole), widen the one allowlist for `del`. Plain
  strikethrough for now; spoiler-like strikeout on screen is in the Coach's TODO (2026-10-07).
* **Old addresses** (2026-10-07): fixed outside the sprint as #167, stacked on #166: addresses
  refuse what the server would, so `/~undefined/...` is not found. Better not-found pages are in TODO.
* **Fixtures:** `fixtures/bbjank-verifier.md` and `fixtures/bbjank-verifier.bbjank.txt`, with a
  smoke test that the one converts to the other, covering every question this sprint raised
  (thread 10).

## History at the end

After thread 9 lands, the orchestrator makes the series clean: if any thread other than 1 carries
widening commits, it rebuilds the sprint's stretch of the spine so they sit in thread 1's branch
(tag every branch first; `--force-with-lease` per branch; every PR's body updated), leaving
widen -> features -> tighten. Nothing on `main` is touched; the PRs stay the Coach's to merge.

## For the Coach

* **Merge order:** thread 1's PR (`Serial Deploy: recap`), wait for its production deploy to say
  `Backfills: every one has finished.`, then the rest; thread 9's tightening last. Vercel runs the
  backfills on deploy now, but that wait is still yours.
* Underline: settled by the Coach, thread 10 (`__text__` -> `[u]` in LL outputs only).
* "Correct Answer %" has no source in the app yet; the recap leaves it blank unless a column
  obviously is it.
