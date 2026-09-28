# Trivia Quiz Editing Tool

A working spec for rebuilding the single-file prototype as a modern web app. It describes what
the tool does and how it should look and feel, not how the prototype happens to be wired
together. Where an implementation detail is load-bearing for the *experience* — a specific CSS
mechanism, a data-shape compatibility promise — it is called out explicitly and marked as such.

---

## 1. What the tool is for

A quizmaster smithing a trivia quiz would like a pleasant, safe way to organize and refine the question text.

There are also several questions difficult to answer by re-reading one's own prose

**Is this question accidentally ambiguous?** The author knows what they meant. A player reading
fast, literally, and without the author's intent does not. The tool answers this by letting the
author ask a deliberately hasty model for its first-instinct answer to each question. When that
guess is not the intended short answer, the question has a second reading the author could not
see — which is sometimes a bug and sometimes exactly the misdirection they were going for.
Either way, they now know.

**How difficult is the question**? Again, careful prompting and model choice can give nuance --
show your human friends the answer once and they're unable to well judge a question after

**Is this question factually accurate**? You might not believe this, but many trivia enthusiasts
could, at times, be guilty of pedantry and nitpicking. We're not going to make them happy, but
it's essential that every fact in a question be defensible and researched.

We may, for special events, add "meta" questions -- where as the answers start to come in, more information is revealed; perhaps helping to solve others, perhaps revealing a new layer of questions. In this delivery cycle we will implement a meta feature: what is the "sum" of this question if we add the blatant numerals ("3"), spelled-out numbers, ordinals, magnitude phrases, even numbers in other scripts and languages and the question index itself. Finding every span a *reasonable player* might count, and totalling them, is tedious and error-prone; a casual rephrasing of "one might..." to "you might..." could render the meta puzzle unsolvable. The tool extracts those spans per question and per hint, shows them, and keeps a running set of sums so the author can tune a clue until its total lands where the meta-puzzle needs it.

Around those two jobs sits everything a drafting surface needs: a spreadsheet-shaped grid for the
round, question ordering that survives experimentation, the chaining machinery that makes a "BUT
NOT" round a round rather than a list, notes columns, and clean ways to get the work back out.

### Operating principles

These are commitments, not implementation notes, and every feature below is designed around them.

**Local and private by default.** In this first delivery cycle there is no account, no server, no sync, no telemetry. A round
lives in the browser it was typed in, survives reloads and quits, and never travels to another
browser, another device, or another person on its own. Getting work somewhere else is always an
explicit, visible act by the author: copy the export, paste it in elsewhere.

**Works with no network.** Every part of the tool — typing, sorting, chaining, numbering, summing
what has already been computed, exporting, importing — works with the network off. The single
exception is asking the model, which is opt-in per cell and degrades to a clear message rather
than a broken screen when it is unavailable.

**Never lose the draft.** Every change is saved the moment it happens; there is no save button
and no unsaved state to lose. A sort or a drag *commits* the new order into the round rather than
being a view that evaporates. An edit never silently discards a computed result — it marks it
stale and leaves it visible. Imports merge rather than replace. The one destructive action
(deleting a round) asks first, inline.

**The grid is a document, not a form.** Cells are borderless until you touch them. The author is reading their round most of the time and editing it some of the time, and the default state should be the readable one.

---

## => Caveats and Naming Changes <=

Some names chosen while prototyping must not be carried forward. Chiefly:
* Do not conflate "question" with "row". IMPORTANT: If you are adopting code from the prototype, each usage of the term "row" should become either `tableRow`, `question` or another variable name besides naked 'row'
* The field names below are that of the **old prototype**, not an internal choice. That is why `short_answer` and
`chains_to` are underbar_case while `hintNumbers`, `altText` and `fullAnswer` are camelCase, and why
the question list inside a quiz is called `rows` in the code. Rename these everywhere in the codebase to names consistent
with STYLE.md
* **use underbar_case** for all fieldnames and database column names
* the text in a question should be its `clueing`, not its question (as written now)

> **Delivered.** Every code block below has been converted to the names that shipped; the
> prose above and the Coach notes inline are left as written. The renames as built are
> `question`→`clueing`, `ai`→`guess`, `numbers`→`clueing_ishes`, `hintNumbers`→`hint_ishes`,
> `altText`→`alt_text`, `fullAnswer`→`full_answer`, `rows`→`questions`,
> `activeQuizId`→`active_quiz_id`, `BulkIshesRun.items`→`text_count`, and ModelTier's
> `'default'`→`'quick'` (its Zod schema default too). A later pass renamed `short_answer`→
> `title` (made the leftmost grid column) and dropped "round" everywhere in favour of "quiz" --
> the prose below still says "round" throughout, as written. Judgement calls and open questions
> are in `/HUMAN-whatsup.md`.

## 2. Domain model

These are the names the rest of the document uses.

**Workspace** — everything the tool holds for this person: their rounds, plus which one is
currently open. One workspace per browser.

**Quiz** (informally, a *round*) — one trivia round: a name, an ordered list of questions, a lock
flag, and a little bookkeeping about how it was last sorted and last batch-computed. A workspace
always holds at least one.

**Question** — one entry in a round. Carries the question text, the short
answer, its own BUT NOT hint, a question number, a chain link to another question, three freeform
notes fields, and up to three cached model results. (NOTE: do not refer to a question as a "row")

**Hint** — a question's own "BUT NOT …" misdirection: a clue for something that is *not* the
answer but shares its name. `Leon` (the historic region) carries the hint *"BUT NOT the titular
role in an internationally successful 1994 French film…"*, which describes **Léon**. A hint always
belongs to the question whose answer it disguises.

**Chain** — the link that turns a list into a round. A question *chains to* the question that
follows it. The BUT NOT text presented alongside a question is the **chained-to question's**
hint — so solving question A hands the player a misdirection clue pointing at question B's answer,
which sets up B. Chains are what "Sort by chain order" walks, and what the BUT NOT columns mirror.

**Ish** (an *ishes* cell; formally a *numberish extraction*) — the list of number-like spans found
in one piece of text, each with the span verbatim, the value a reasonable player would assign it,
and whether it was written in digits or in words. Questions and hints each get their own.

**Guess** — the quick model's first-instinct one-line answer to a question. The ambiguity signal.

**Rank** — a question's 1-based position when every question in the round is ordered by its Q#.
Distinct from the Q# itself, which may be gappy, decimal, duplicated, or blank. Rank is what the
exports use as the question number, what "Renumber Q#" writes back, and what the "Q + #" column
adds.

---

## 3. The screen

One page, no routing, no modals. Top to bottom:

**Round switcher row** — a dropdown of every round (each labelled by name, with a padlock if
locked), a "+ New quiz" button, a "Delete quiz" button, and, pushed to the right, the lock toggle.

**Title row** — a small uppercase "Trivia round" pill, then the round's name as a large,
borderless, serif text field. Alongside it, when locked, an amber lock banner; and a save-status
pill that stays invisible unless saving fails.

**The table** — the main event, described in detail below. It scrolls horizontally inside a
bordered, rounded container; the page itself never scrolls sideways.

**Toolbar** — "+ Add question", "Sort by chain order", "Renumber Q#", then, right-aligned, "Recalculate
all ishes" with its last-run token badge and any one-off notice.

**Footnote** — a dense paragraph explaining the round's mechanics and the grid's less obvious
behaviours, for the author's own recall.

**Four panels**, each a titled section with explanatory microcopy: *Copy for Sheets*, *Export*,
*Import*, and *Prompts used*.

### The columns, left to right

| #   | Column               | What it holds                                                            |
| --- | -------------------- | ------------------------------------------------------------------------ |
| 1   | *(drag handle)*      | Grip for reordering; only occupies space while the round is in Q# order  |
| 2   | Question             | The question text. Multi-line, grows with content                        |
| 3   | Hint                 | This question's own BUT NOT misdirection. Multi-line, grows with content |
| 4   | Short answer         | The intended answer, in as few words as possible                         |
| 5   | Chains to            | Dropdown naming the question that follows this one                       |
| 6   | BUT NOT              | Preview of the chained-to question's hint                                |
| 7   | Q#                   | Free-typed question number; may be decimal or blank                      |
| 8   | Q + #                | Question Full Sum + this question's rank                                 |
| 9   | Question Full Sum    | Every ish in the question, added                                         |
| 10  | Question Numeral Sum | Only the digit-written ishes in the question, added                      |
| 11  | BUT NOT Full Sum     | Every ish in the chained-to hint, added                                  |
| 12  | BUT NOT Numeral sum  | Only the digit-written ishes in the chained-to hint, added               |
| 13  | Hint Full Sum        | Every ish in this question's own hint, added                             |
| 14  | Hint Numeral sum     | Only the digit-written ishes in this question's own hint, added          |
| 15  | Q+B Full             | Question Full Sum + BUT NOT Full Sum                                     |
| 16  | Alt Text             | Freeform notes column                                                    |
| 17  | notes                | Freeform notes column                                                    |
| 18  | Full Answer          | The long-form answer as it will be read out                              |
| 19  | Question ishes       | The extracted spans for the question. Askable                            |
| 20  | BUT NOT ishes        | The chained-to question's hint spans, mirrored here. Read-only           |
| 21  | Hint Ishes           | The extracted spans for this question's own hint. Askable                |
| 22  | Quick-model guess    | The hasty model's answer. Askable                                        |

The four sum columns that mirror a *chained* question (11, 12, and the BUT NOT parts of 15 and 20)
are always derived from the chained-to question's own Hint data. Nothing about a hint is ever
computed twice: it is extracted once on the question that owns it and borrowed everywhere else.

---

## 4. Visual system

The prototype's look should carry over; this section is the brief for reproducing it.

### Type

Three families, each with one job:

- **Zilla Slab** (500/600) — display. The round-name field and the four panel headings. Gives the
  page a printed-quiz-sheet feel rather than a dashboard feel.
- **Work Sans** (400/500/600) — all interface text: column headers, buttons, microcopy, the
  footnote, placeholders, and the Question/Hint editing boxes.
- **JetBrains Mono** (400/500) — everything that is *data*: short answers, Q#, every sum, the ish
  lists, the model's guess text, the BUT NOT preview, and the export/import boxes.

Column headers are small, uppercase, letter-spaced, and muted. Running microcopy is capped around
62 characters per line. Every family needs a real fallback stack.

### Colour and theming

A desaturated green-grey ground with a single ochre accent — deliberately not a blue-grey SaaS
palette, and deliberately warm enough to read as paper.

Light: page `#eef1ea`, surfaces `#ffffff` and `#e4e9e0`, ink `#1b2b28`, muted `#5b6b66`, borders
`#d7ddd0`, accent `#b8790f` with `#6b4a0e` ink and `#f5e7c8` soft fill, good `#2f6f4f`, bad
`#ad3f2b`, each "good"/"bad" with a soft companion for pill backgrounds.

Dark: page `#12201c`, surfaces `#1b2b26` / `#21322c`, ink `#e9f0ec`, muted `#93aba3`, borders
`#2c3f38`, accent `#e0a63a` with `#f5e2b8` ink and `#33290f` soft fill.

Corner radius is 10px on containers, 6px on inputs, and fully round on pills and buttons.

Both themes are first-class and must handle three viewer states: an explicit light choice, an
explicit dark choice, and the default "follow the system" state where neither is stamped. Every
colour is a token defined in the light palette and re-defined for dark; nothing gets its only
definition inside a dark-mode branch.

### The table

*Implementation detail that matters:* the table uses a **fixed layout with an explicit column
width for every column**. Cell contents — a 300-word question, a 40-item ish list — must never be
able to widen a column. Approximate widths: Question and Hint 330px each, the three notes columns
220px each, the three ishes columns 170px, the guess column 160px, Chains to 120px, BUT NOT 180px,
Short answer 100px, the eight sum columns 78px, Q# 60px, drag handle 32px. Total minimum width is
about 2260px, so the table always scrolls horizontally inside its container. That is intentional:
this is a wide workbench, and the page has no max-width.

**Vertical headers.** The eight numeric columns (8–15) carry labels far longer than their 78px
columns — "BUT NOT Numeral sum", "Question Full Sum". Those headers are rotated with
`writing-mode: vertical-lr`, bottom-aligned, so the full label reads without wrapping and without
widening the column. The three ishes headers stay horizontal but are centre-aligned and allowed to
wrap. Everything else is a normal left-aligned header.

**The drag column collapses rather than disappears.** When the round is not in Q# order the drag
column is still present, at zero width with zero padding and hidden overflow. It is never removed
from the row, because removing a cell would shift every later cell one column left of the width it
was written for.

**Inputs look like text until touched.** Question, Hint, Short answer, Q#, and the three notes
fields are borderless and transparent at rest, gain a hairline border on hover, and gain an accent
border plus a subtly tinted fill on focus. Q# is numeric with the spinner arrows suppressed and its
value centred.

**Row-height choreography.** Within a row, the Question and Hint boxes grow with their own content,
and the taller of the two sets the height for both, up to a cap of about 480px (~30 lines); past
that cap they scroll internally rather than growing the row further. The three notes columns are
then stretched to that same height for comfortable typing, but never participate in deciding it —
long notes must not stretch the row. The three ishes columns are capped at the height the row
already settled on and scroll internally. Heights re-measure as you type and after a window resize
settles.

**Numbers.** Sum cells are right-aligned monospace with tabular figures. A sum that has not been
computed shows a muted en-dash rather than a zero. A stale sum or ish list goes muted and italic
and gains a "· stale" note in its metadata line. Long numbers get soft break opportunities *after
each thousands comma only*, so `3,000,000` can wrap between groups but never mid-group, and adds no
width when it does not need to wrap.

**Askable cells look askable.** The guess cell and the two ishes cells take a pointer cursor, tint
on hover, carry a minimum height so they never collapse to a sliver, and are keyboard-reachable
with a button role and an explanatory label.

**Locked rounds** keep every cell readable and selectable — fields go read-only, never disabled, so
the author can still copy out of a frozen round. The chain dropdown is disabled, the drag handle
stops being draggable and dims, the askable cells lose their hover tint and dim to about 70%, the
toolbar buttons disable, and an amber "Locked" banner sits in the header.

**Mobile.** Below about 640px the table restructures into stacked cards: one bordered, rounded
block per question, headers hidden, and every cell prefixed with its own column label. The 16px
side gutter holds at every width.

**Motion and focus.** Hover/colour transitions only when the viewer has not asked for reduced
motion. Every interactive control has a visible focus ring in the accent colour.

---

## 5. Data schema

Written for **Zod 4**. Every field carries a `.describe()` because these descriptions are the
contract — they say what a field means, not what type it is.

### Cleanliness >> Compatibility (for now)

The field names below are that of the **old prototype**, not an internal choice. That is why `short_answer` and
`chains_to` are underbar_case while `hintNumbers`, `altText` and `fullAnswer` are camelCase, and why
the question list inside a quiz is called `rows` in the code. Rename these everywhere in the codebase to names consistent
with STYLE.md. In particular, **make all data model fields underbar_case**

```ts
import { z } from 'zod'

// Coach note: please use a lower-case ULID in place of a UUIDv4
const Id = ZZ.string().min(1)
  .describe('Opaque stable identifier for a quiz or a question. Newly created records mint a lowercase ULID. Ids arriving from an import are accepted as-is provided they are non-empty, because a hand-written quiz file has no reason to know about ULIDs.')

const Timestamp = ZZ.int().positive()
  .describe('Epoch milliseconds at which a model result was written. Set only by the app, never typed by a person. Surfaced to the author as a hover tooltip, never as a visible column.')

const ModelTier = ZZ.enum(['quick', 'careful'])
  .describe('Which tier answered: "quick" for the deliberately hasty first-instinct guess, "careful" for the more thorough ish extraction. Stored per result so an older result stays honestly labelled even after the app changes which tier it asks for a given job.')

const ApproxTokens = ZZ.int().nonnegative()
  .describe('Rough size of one ask plus its answer, estimated from character count because the page cannot observe real usage. Displayed as "~N tok" so the author can see what a habit of refreshing costs them. Never presented as exact.')

const Sortkey = ZZ.enum([
  'qnum', 'short_answer', 'chains_to', 'clueing_plus_rank',
  'clueing_full', 'clueing_numeral', 'butnot_full', 'butnot_numeral',
  'hint_full', 'hint_numeral', 'clueing_plus_butnot_full',
  'clueing_ishes', 'butnot_ishes', 'hint_ishes',
  'chain_order',
])
  .describe('Which column or ordering last committed the round to its current order. Purely a label: it is remembered so that header can stay bold as a reminder of how the questions came to be in this order, and it never re-sorts anything on load.')

// ---------- number extraction ----------

const NumberishItem = ZZ.object({
  text:  ZZ.string().min(1)
    .describe('The span exactly as it appears in the source text, preserving punctuation, currency, and script: "#17-19", "9,000+", "千", "douzaine", "Feb 27". Shown verbatim so the author can see precisely what the model latched onto and judge whether a player would too.'),
  value: ZZ.number()
    .describe('What a reasonable player would add up for that span. Magnitude phrases carry their whole value ("300 million" is 300000000, not 300), and fractions stay fractional ("quarter" is 0.25). Zod 4 rejects NaN and Infinity here without further checks.'),
  kind:  ZZ.enum(['numeral', 'wordish'])
    .describe('"numeral" when the span is written in digits, "wordish" when it reads as a number in words, as an ordinal, or as a magnitude phrase. The two are totalled separately so the author can compare the strict digits-only reading of a clue against the generous reading.'),
})
  .describe('One number-like span found in a question or a hint.')

const AskError = ZZ.object({
  status:    ZZ.literal('error'),
  message:   ZZ.string().min(1)
    .describe('Plain-language reason the ask failed, written for the author rather than copied from an error code. Displayed in place of the result, with an invitation to try again.'),
  updated_at: Timestamp,
})
  .describe('A failed ask, kept in place of whatever was there before so the failure is visible rather than leaving a silently empty cell.')

const NumberishDone = ZZ.object({
  status:           ZZ.literal('done'),
  items:            ZZ.array(NumberishItem).max(200).default([])
    .describe('Every span found, in the order it appears in the source text. An empty array is a real answer meaning "nothing here reads as a number", and is displayed as "None found" rather than as a blank cell.'),
  model_tier_applied: ModelTier.optional(),
  truncated:        ZZ.boolean().default(false)
    .describe('True when the answer was cut short before it finished. Shown as "· cut short" so a suspiciously small list is never mistaken for a complete one.'),
  approx_tokens:    ApproxTokens.optional()
    .describe('Present for a single-cell ask. Deliberately absent for a result that came from one batched request covering many cells, because attributing a share of that cost to one cell would be a made-up number.'),
  stale:            ZZ.boolean().default(false)
    .describe('True when the text this was extracted from has been edited since. The result stays on screen, greyed and italic, rather than vanishing — a slightly-out-of-date total is more useful to the author than an empty cell, as long as it is honestly marked.'),
  updated_at:        Timestamp,
})

const Numberish = ZZ.discriminatedUnion('status', [NumberishDone, AskError]).nullable()
  .describe('The extraction for one piece of text, or null when it has never been asked for. Null, an error, and a successful empty list are three genuinely different states and each reads differently on screen.')

// ---------- the ambiguity check ----------

const GuessDone = ZZ.object({
  status:           ZZ.literal('done'),
  text:             ZZ.string()
    .describe('The model\'s answer, as one line, verbatim and untrimmed of its own wording. The author compares this against the intended short answer by eye; the tool never scores the comparison for them.'),
  model_tier_applied: ModelTier.optional(),
  truncated:        ZZ.boolean().default(false),
  approx_tokens:    ApproxTokens.optional(),
  updated_at:        Timestamp,
})

const Guess = ZZ.discriminatedUnion('status', [GuessDone, AskError]).nullable()
  .describe('What a fast, not-especially-careful reader answered, or null when never asked. This is the ambiguity signal the tool is named for: a guess that differs from the intended short answer means the question has a second reading the author could not see from the inside.')

// ---------- a question ----------

const Question = ZZ.object({
  id:           Id,
  qnum:         ZZ.string().regex(/^(\d+(\.\d+)?)?$/).default('')
    .describe('The author\'s own question number, kept as text on purpose. Blank means unranked and sorts last. Decimals are a feature, not an accident: typing 3.1 means "put this between whatever is 3 and 4 right now" without renumbering anything else. Duplicates and gaps are both legal.'),
  clueing:       ZZ.string().max(10000).default('')
    .describe('The question as it will be asked. Markdown-ish emphasis, quoted verse, and non-Latin scripts all appear in real rounds and must survive untouched; the tool never rewrites this text.'),
  hint:         ZZ.string().max(10000).default('')
    .describe('This question\'s own "BUT NOT …" misdirection: a clue for something that is NOT this answer but shares its name. It belongs to the question whose answer it disguises, and is displayed alongside whichever OTHER question chains to this one.'),
  short_answer: ZZ.string().max(200).default('')
    .describe('The intended answer in as few words as possible. Does triple duty: the thing a guess is compared against, the label this question shows under other questions\' chain dropdowns, and the key an import matches questions on.'),
  chains_to:    Id.nullable().default(null)
    .describe('The question that follows this one in the round, or null when unchained. The BUT NOT text presented with THIS question is the chained-to question\'s hint, so solving this one hands the player a pointer to the next answer. Must name a different question in the same round; anything dangling or self-referential is cleared rather than kept.'),
  guess:        Guess.default(null),
  clueing_ishes: Numberish.default(null)
    .describe('Extraction over this question\'s text. Feeds Question Full Sum, Question Numeral Sum, Q + #, and Q+B Full.'),
  hint_ishes:    Numberish.default(null)
    .describe('Extraction over this question\'s own hint. Feeds this question\'s Hint sums, and is borrowed by whichever question chains to this one for its BUT NOT sums and BUT NOT ishes.'),
  alt_text:     ZZ.string().max(10000).default('')
    .describe('Freeform notes column, carried through to the spreadsheet export. The tool ascribes no meaning to it.'),
  notes:        ZZ.string().max(10000).default('')
    .describe('Second freeform notes column, carried through to the spreadsheet export.'),
  full_answer:  ZZ.string().max(10000).default('')
    .describe('The long-form answer as it will actually be read out, as opposed to the terse short answer used for matching and chaining.'),
})
  .describe('One question in a round. Every field is optional on the way in and defaulted, so a partially-filled question is always a legal question — the author is drafting, not filling in a form.')

// ---------- a round ----------

const BulkIshesRun = ZZ.object({
  approx_tokens: ApproxTokens,
  text_count:   ZZ.int().nonnegative()
    .describe('How many texts went into that one batched request, so "~4,200 tok last time (28 texts)" reads as a cost per run rather than a mystery number.'),
  updated_at:   Timestamp,
}).nullable()
  .describe('What the last "Recalculate all ishes" run cost, kept per round. Never cleared by, and never clears, an individual cell\'s own token figure.')

const Quiz = ZZ.object({
  id:            Id,
  title:         ZZ.string().max(200).default('')
    .describe('What the author calls this round. Shown in the switcher, in the browser tab title, and as the heading; an empty title displays as "Untitled quiz" without ever being rewritten to that on disk.'),
  questions:     ZZ.array(Question).default([])
    .describe('The questions, in their committed display order. This array IS the order: sorting and dragging rewrite it, so the arrangement survives a reload exactly as it was left.'),
  locked:        ZZ.boolean().default(false)
    .describe('When true this round accepts no edits at all — a finished draft sent out for playtesting, kept readable and copyable but frozen against accidental change.'),
  last_sortkey:    Sortkey.nullable().default(null),
  bulk_ishes_last: BulkIshesRun.default(null),
})
  .check((ctx) => {
    const quiz = ctx.value
    const idsSeen = new Set()
    quiz.questions.forEach((question, ii) => {
      if (idsSeen.has(question.id)) {
        ctx.issues.push({ code: 'custom', input: question.id, path: ['questions', ii, 'id'], message: 'Two questions in one round share an id' })
      }
      idsSeen.add(question.id)
    })
    quiz.questions.forEach((question, ii) => {
      if (! question.chains_to) { return }
      if (question.chains_to === question.id) {
        ctx.issues.push({ code: 'custom', input: question.chains_to, path: ['questions', ii, 'chains_to'], message: 'A question cannot chain to itself' })
      } else if (! idsSeen.has(question.chains_to)) {
        ctx.issues.push({ code: 'custom', input: question.chains_to, path: ['questions', ii, 'chains_to'], message: 'Chain target is not a question in this round' })
      }
    })
  })
  .describe('One trivia round. Chain integrity is checked here rather than on the question, because a chain is only meaningful relative to its siblings.')

const Workspace = ZZ.object({
  quizzes:      ZZ.array(Quiz).min(1)
    .describe('Every round this browser holds. Never empty — deleting the last round is refused rather than leaving the author staring at nothing.'),
  active_quiz_id: Id
    .describe('Which round is on screen. A value that names no existing round is repaired to the first round rather than treated as fatal.'),
})
  .check((ctx) => {
    const found = ctx.value.quizzes.some((quiz) => quiz.id === ctx.value.active_quiz_id)
    if (! found) {
      ctx.issues.push({ code: 'custom', input: ctx.value.active_quiz_id, path: ['active_quiz_id'], message: 'active_quiz_id names no quiz in this workspace' })
    }
  })
  .describe('Everything the tool holds for one person in one browser. This is also exactly what the Export panel emits and what Import accepts.')
```

### The permissive import shapes

Import needs a *different* schema from the one above, for one specific reason: in an import,
`null` is a meaningful instruction — "clear this field" — and must validate, whereas the app's own
stored questions never hold a null where a string belongs.

```ts
const ImportQuestion = ZZ.object({
  id:           Id.optional(),
  qnum:         ZZ.string().regex(/^(\d+(\.\d+)?)?$/).nullable().optional(),
  clueing:      ZZ.string().nullable().optional(),
  hint:         ZZ.string().nullable().optional(),
  short_answer: ZZ.string().nullable().optional(),
  chains_to:    ZZ.string().nullable().optional(),
  guess:        Guess.optional(),
  clueing_ishes: Numberish.optional(),
  hint_ishes:   Numberish.optional(),
  alt_text:     ZZ.string().nullable().optional(),
  notes:        ZZ.string().nullable().optional(),
  full_answer:  ZZ.string().nullable().optional(),
})
  .describe('One question as it arrives from an import. Every field is nullable and nothing is required, because the three states carry three different instructions: a field ABSENT means "leave whatever is already there", a field set to NULL means "clear it", and a field with a value means "take this". Unknown keys are dropped rather than rejected, so a file carrying extra bookkeeping from somewhere else still imports cleanly.')

const ImportQuiz = ZZ.object({
  id:    Id.optional(),
  title: ZZ.string().max(200).nullable().optional(),
  questions: ZZ.array(ImportQuestion).default([]),
})
  .describe('One round as it arrives from an import. Only the questions are merged; a pasted round\'s own lock state, sort memory and batch-run record are ignored, because those describe how someone ELSE was working, not what this round contains.')

const ImportPayload = ZZ.union([
  ZZ.object({ quizzes: ZZ.array(ImportQuiz).min(1), active_quiz_id: Id.optional() }),
  ImportQuiz,
  ZZ.array(ImportQuestion),
])
  .describe('What the Import box accepts: a whole exported workspace, a single round, or a bare list of questions. The author should be able to paste back anything the Export box ever handed them, or a fragment they trimmed by hand, without first having to reshape it.')
```

**A Zod 4 caveat worth naming.** `.default()` fires only when a value is `undefined`. An explicit
`null` passes straight through a nullable field untouched. That means the absent-vs-null
distinction the import depends on **cannot** be expressed with schema defaults — it has to be read
off the raw parsed object, before defaults are applied, by asking whether the key is present at
all. The schema's job in the import path is to validate and scrub; the merge rules are the merge's
own.

---

## 6. Milestones

Each section is a shippable increment that leaves the tool usable. They are ordered for building,
not in the order the prototype grew.

---

### M1 — The round and its grid

The smallest genuinely useful version: a spreadsheet for one round that never loses what you type.

**Ships.** A single round with an editable name. The table with its entry columns — Question,
Hint, Short answer, Q#, Alt Text, notes, Full Answer — plus the empty shells of the columns that
later milestones fill in, so the layout does not shift around underneath the author later. An
"+ Add question" button. Automatic saving. The browser tab title tracks the round name ("*Round name* —
Trivia Ambiguity Audit", or just the tool name when unnamed).

**Behaviour.** A fresh workspace opens with five blank questions, so the grid never presents itself
as an empty void. Field edits commit when the field loses focus, which keeps the grid from
re-rendering under a half-typed word; the round name is the exception and updates live as you type.
Every committed change is written immediately — there is no save button, no dirty indicator, and no
debounce the author could outrun by closing the tab. Saving is per-browser and needs no network.

Row heights follow the choreography in §4: Question and Hint grow together to the taller of the
two, capped, with the notes columns matched to that height but never driving it. They re-measure
live as you type and after a resize settles.

If the browser refuses to save — private browsing, disabled storage, a full quota — a red status
pill appears in the header saying so in plain words. It is the only time that pill is visible.

**Also worth building in now.** If the same person has the tool open in two tabs of the same
browser, a change saved in one should be picked up by the other.

**Done when.** Type into several cells, reload the page, and find every keystroke intact. Do the
same with the network disconnected. Resize the window and watch a long question settle
without clipping.

---

### M2 — Question numbers and ordering

Makes the grid a *round* rather than a pile, and makes experimenting with order safe.

**Ships.** The Q# column. Clickable sortable headers on Short answer, Chains to, and Q#. The
"Renumber Q#" button. Drag-to-reorder.

**Q# semantics.** Q# is free text holding an optional number. Blank means unranked. Decimals are
the point: typing `3.1` slots a question between 3 and 4 without touching another row. Duplicates
and gaps are legal and expected mid-draft.

**Rank** is what actually orders things: sort every question by Q# ascending, blanks last and
rankless, ties broken alphabetically by short answer, and number what remains from 1. Rank is
recomputed on demand and never stored.

**Sorting commits.** Clicking a header re-orders the questions *and writes that order into the
round*, so it survives a reload exactly as left. Clicking the same header again reverses it. questions
with no value for the sorted column always sink to the bottom, in both directions — "no Hint Full
Sum yet" is not a small number, it is an absence, and it belongs at the end either way. Ties are
settled by where the questions already sit. Text sorts case-insensitively and locale-aware. An arrow marks
the column sorted this session; the last-sorted column stays bold across reloads as a reminder of
how the current order came about — but it never re-sorts anything on load, because the order is
already baked into the round.

**Two different renumbering verbs**, and the distinction matters:

- **Dragging a question** physically moves it, then renumbers *by position* — every question gets a
  fresh sequential Q# from its final place, top is 1. Including questions that had no Q# at all,
  which is how a blank question gets adopted into the sequence.
- **"Renumber Q#"** moves nothing. It replaces each Q# with its *rank* among the current values, so
  `4, 3.3, 6, 1` becomes `3, 2, 4, 1` in place. This is what makes the decimal trick work: slot with
  `3.1`, then tidy the numbers back to integers without disturbing a single question. Questions with no
  Q# are left alone. Critically, it must not flip the round into Q#-sorted mode, which would
  immediately re-sort and undo the promise that nothing moved.

**Drag affordance.** The grip column only takes up space when the round is in Q# order — dragging
questions around while they are sorted by, say, Hint Full Sum would produce an order that contradicts
its own header. The dragged question goes translucent and the drop target takes an accent line along its
top edge.

**Done when.** Type `3.1` into a Q#, watch the question stay put; click Renumber and watch the
numbers tidy with no question moving. Sort by short answer, reload, and find the sorted order intact
with the header still bold.

---

### M3 — Chaining and BUT NOT

Turns a list of questions into a chained round.

**Ships.** The Chains to dropdown, the BUT NOT preview column, and the "Sort by chain order"
button.

**Chaining.** Each question picks the question that follows it. The dropdown lists every *other*
question in the round by its short answer (a question with no short answer yet shows as "(no short
answer yet)"), plus an unset option. A question can never chain to itself.

**The BUT NOT column** shows the chained-to question's hint, trimmed to a snippet of about 50
characters cut at a word boundary with an ellipsis, with the full text on hover. Before a chain is
picked it reads "Pick a chain target"; with a chain whose target has no hint yet, "No hint entered
yet".

**Sort by chain order** is not a column sort — it is a walk of the graph the chains form. Ascending
walks forward: start at the unplaced question with the lowest Q#, follow its chain, follow that
question's chain, and so on. Descending walks the same graph backward, stepping to whatever chains
*into* the current question. Whenever there is a choice — several questions merging into one when
walking backward, or simply several untouched chains still waiting — the lowest Q# among the
options goes next. When a path runs out, the walk restarts at the next-lowest-Q# question still
unplaced. Rooting every restart at the lowest Q# is what guarantees question 1 leads, rather than
waiting behind whatever happens to chain into it. Clicking the button again flips direction. Like a
column sort, the result is committed into the round.

**Dangling chains.** A chain pointing at a question that no longer exists is cleared rather than
kept. Clearing happens whenever the round's membership changes underneath a chain.

**Done when.** Build a four-question chain out of order, hit Sort by chain order, and read the
round top to bottom in presentation order. Flip it and read it backward.

---

### M4 — Asking the quick model

The ambiguity check. This is the first feature that needs anything outside the browser, and the
whole rest of the tool must keep working when it is unavailable.

**Ships.** The Quick-model guess column.

**Behaviour.** Double-click the cell — or focus it and press Enter or Space — to ask. The cell
shows "Thinking…" while in flight, then the model's one-line answer in monospace, under a metadata
line reading which tier answered, whether it was cut short, an approximate token figure, and a
Refresh button. Asking again replaces the previous answer. A question with no text is not asked
about at all.

The prompt is deliberately engineered for a *hasty* reader, not a careful one — see Appendix A. A
careful expert answer would be useless here: the author already knows the careful answer. The point
is what a fast literal reading produces.

**Failure is a first-class state.** A failed ask replaces the cell's contents with a plain-language
message and "Double-click to try again", rather than leaving an empty cell or a raw error code. The
full set of messages is in Appendix B. When the ask capability is not available in this view at all,
the message says so directly.

**Cost visibility.** Each answered cell carries a "~N tok" badge, with a tooltip stating plainly
that it is estimated from character count and not a real usage figure. The author is spending their
own model usage here, and refreshing a column of twenty questions is not free.

**Done when.** Ask a deliberately ambiguous question and get back an answer that differs from your
intended one. Turn off the network and confirm the rest of the page still sorts, edits, and saves.

---

### M5 — Ishes and the sum columns

The numeric layer: the tool's second reason to exist.

**Ships.** The Question ishes and Hint Ishes cells (both askable), the read-only BUT NOT ishes
mirror, and all eight numeric columns.

**Extraction.** Double-click, or keyboard-activate, an ishes cell to have the model list every span
in that text a reasonable person might read as a number, in order of appearance, each with its
value and whether it was written in digits or words. Extraction asks the more careful tier, not the
quick one: catching a spelled-out numeral in French or a magnitude phrase is worth the extra cost,
where the ambiguity guess only needs a fast instinct. Results are sanitised on arrival — anything
without text or without a usable numeric value is dropped rather than shown as a broken question. What can be retained, is. An
empty result is a real answer and reads "None found".

**The BUT NOT ishes column** is a mirror, never its own computation. It shows the chained-to
question's Hint Ishes. Before a chain exists it says so; when the chained-to question's hint has
never been extracted, it points the author at the right cell to double-click ("Not computed yet —
double-click that question's Hint Ishes"). Extract a hint once, and every column that borrows it updates.

**The sums**, all derived and none stored:

- *Question Full Sum* — every ish in the question, added.
- *Question Numeral Sum* — only the digit-written ishes, added.
- *Hint Full Sum* / *Hint Numeral sum* — the same two readings over this question's own hint.
- *BUT NOT Full Sum* / *BUT NOT Numeral sum* — the same two readings over the chained-to hint.
- *Q+B Full* — Question Full Sum plus BUT NOT Full Sum: the widest "add up the numbers" reading of
  the complete unit a player is actually handed. Blank unless both halves exist.
- *Q + #* — Question Full Sum plus this question's *rank*. Not its Q# value: the rank, so the
  meta-puzzle is stable against gappy or decimal numbering. Blank when the question is unranked.

Every sum rounds to a whole number; the individual ishes keep their fractions (a "quarter" stays
0.25 in the list, even though the total it feeds is rounded). A sum with nothing behind it yet shows
a muted dash, never a zero.

**Staleness.** Editing a question marks its question extraction stale; editing a hint marks its hint
extraction stale. A stale result stays visible, greyed and italic, with "· stale" in its metadata,
and every sum derived from it inherits the same treatment — including sums on *other* questions borrowing
a stale hint. The author gets an out-of-date-but-honest number rather than an empty cell. Re-asking
clears it.

**A quiet shortcut.** Double-clicking any of the three "Full Sum" cells re-extracts the numbers
behind it, same as double-clicking the ishes cell it summarises. Undocumented on screen, on purpose —
it is muscle memory for someone iterating hard on one clue's total.

**Done when.** Extract a question containing "#17-19", "douzaine", and "300 million" and see all
three listed with sensible values and kinds. Edit the question and watch the sums grey out without
disappearing.

---

### M6 — Recalculate all ishes

Turns a tedious twenty-cell chore into one action, and one bill.

**Ships.** The "Recalculate all ishes" toolbar button, its per-run token badge, and its notice line.

**Behaviour.** One combined request covering every question and every hint in the round that has any
text — not one request per cell. The rules and instructions that dominate an extraction prompt are
identical every time, so folding everything into a single ask pays for them once instead of once per
text. Every affected cell shows "Thinking…" simultaneously, and the button disables while the run is
in flight.

Results replace whatever was in those cells. Any item the combined response omits becomes a
per-cell error inviting the author to refresh that one on its own, rather than silently leaving a
stale value that looks fresh. Cells filled by a batch run deliberately carry **no** per-cell token
figure, because splitting one shared cost across many cells would be an invented number; the real
figure lives on the run.

**Cost reporting.** After a successful run the toolbar shows "~N tok last time (M texts)", with the
run's timestamp on hover. That badge is per-round, is kept across reloads, and neither clears nor is
cleared by individual cells' own figures.

**Failure changes nothing.** If the combined ask fails, no cell is modified and a notice appears
saying why, ending with "Nothing was changed." A round with no text at all gets its own notice
rather than an empty request.

**Done when.** Fill six questions and six hints, run it once, and see twelve cells populate from one
ask with a single cost figure for the lot.

---

### M7 — Copy for Sheets

Getting the round into a spreadsheet, which is where these rounds get finished and shared.

**Ships.** The "Copy for Sheets" panel: a read-only box of tab-separated questions, click-to-select-all.

**The export is order-independent.** questions always go out in **rank order**, whatever the table is
currently sorted or dragged into, and the first field is the **rank** — not the raw Q#, which may be
gappy, decimal, or duplicated mid-draft. A quizmaster pasting into a spreadsheet wants 1, 2, 3, and
wants the same result whether they last sorted by chain order or by Hint Numeral sum.

**One line per question, seven tab-separated fields:**

1. Rank (blank if unranked)
2. The question with its BUT NOT text folded in: the question, then `... BUT NOT ....`, then the
   chained-to hint — the complete unit as a player receives it
3. Full Answer
4. Alt Text
5. notes
6. Question Full Sum (blank if not computed)
7. The question's ish spans, verbatim, joined with `/`

**Paste safety.** A field's own line breaks would otherwise look like the start of a new
spreadsheet row and a stray tab like an extra column, so line breaks become a literal `<br/>` (which
also survives usefully into a rich-text cell) and tabs become spaces. The paste never silently
corrupts.

**Done when.** Paste the box straight into Google Sheets and get seven clean columns, in rank order,
regardless of how the table on screen is sorted.

---

### M8 — Backup, copying, and prompt transparency

**Ships.** The Export panel, a Copy button on every read-only box, and the Prompts used panel.

**Export** emits the entire workspace — every round, not just the open one — as a single compact
JSON blob. Compact, not pretty-printed, and rendered in a smaller dense monospace than the other
boxes: this is backup material to be copied out wholesale, not prose to be read, and indentation
would only make less of it visible at once. Its microcopy tells the author exactly what it is for:
back up your progress, or paste part of it back through Import.

**Copy buttons** sit on every read-only box: the spreadsheet export, the JSON export, and each of
the four prompt templates. Clicking copies and shows a brief inline confirmation next to the button.
When the browser refuses to write to the clipboard, the tool falls back to *selecting the box's text
for the author* and telling them plainly to press Ctrl/Cmd+C — a slightly worse outcome, never a
silent nothing.

**Prompts used** shows all four prompt templates, read-only, exactly as sent, with the
`{{question}}` / `{{hint}}` placeholders visible. The author is spending their own usage on these
asks and interpreting the answers as evidence about their questions; they are entitled to see what
was actually asked. The full text is in Appendix A.

**Done when.** Copy the JSON, clear the browser's data, paste it back through Import (M10), and get
your rounds back.

---

### M9 — Multiple rounds and locking

**Ships.** The round switcher, "+ New quiz", "Delete quiz" with inline confirmation, and the lock
toggle.

**Multiple rounds.** Each round is wholly independent: its own questions, name, chains, sort
memory, and batch-run record. The switcher lists every round by name — "Untitled quiz" when unnamed
— with a padlock on the locked ones. Switching is instant and resets only the transient sort arrow,
never the committed order. New rounds start with the same five blank questions a fresh workspace
does.

**Deleting asks inline.** The Delete button turns into "Delete "*Round name*"?" with Yes/Cancel
buttons in the header itself — never a browser dialog, which can be suppressed or ignored in
embedded contexts and is the wrong texture for this page anyway. The last remaining round cannot be
deleted; the button disables and explains why on hover. After a delete the neighbouring round opens.

**Locking** is for the moment a draft goes out for playtesting: freeze this version, keep working on
the next. A locked round accepts no edits at all — no typing, no chain changes, no sorting, no
dragging, no renumbering, no asking the model, no importing into it. Every text field goes read-only
rather than disabled, so its content stays selectable and copyable; the chain dropdown disables, the
drag handle stops dragging, the ask cells dim and lose their hover tint, and the toolbar buttons
disable. An amber banner in the header states the round is locked.

The lock must be enforced by the *behaviour*, not merely by the disabled attributes on the controls —
greying a button out is a hint to the person, and a frozen round should stay frozen regardless of
how an action is triggered.

What locking does *not* block: switching rounds, creating a round, deleting a round, unlocking,
reading, copying, and exporting. Locking a round must never be a trap.

**Done when.** Lock a round, fail to change anything in it, still copy its export out, unlock it,
and find it exactly as it was.

---

### M10 — Import and merge

The counterpart to Export, and the feature that lets an author move a round between browsers,
recover a backup, or fold a collaborator's edits back into their own copy.

**Ships.** The Import panel: a paste box, an Import button, a result summary, and a detailed log.

**What it accepts.** A whole exported workspace, a single round, or a bare list of questions —
anything Export ever produced, or a fragment trimmed by hand. Given a whole workspace it uses the
round matching the open one by id, failing that by name, failing that the first one. The log says
which reading it took and how many questions it found, so the author is never guessing.

**How it merges.** Questions are matched to existing ones **by short answer**, compared
case-insensitively and ignoring surrounding whitespace. Short answer is the right key because it is
the one field that stays stable while an author rewrites a question around it, and because ids
minted in another browser are meaningless here.

For a matched question, each field carries one of three instructions, and the distinction is the
whole design:

- **Absent from the paste** — leave whatever is already there. This is what makes a partial import
  useful: paste in just the questions and short answers you rewrote, and every extraction, note, and
  chain you already had survives untouched.
- **Explicitly `null`** — clear that field. Text fields reset to empty, the chain and the three
  cached model results reset to unset.
- **Any other value** — take it, after validation.

A short answer with no match becomes a new question appended to the round. Nothing is ever deleted
by an import.

**Validation is thorough and loud.** Every incoming question is validated whole. Unknown keys are
dropped silently — a file carrying extra bookkeeping from elsewhere is not an error. A question that
fails validation is skipped *entirely* rather than half-merged, and the log names it, by position
and short answer, with one line per issue giving the field path, what was wrong, and the validation
code. One bad question never blocks the rest of the import.

**Chains are remapped, not copied.** A chain in the pasted data points at an id from wherever it
came from, which means nothing here. So the import reads the pasted data's *own* id-to-short-answer
map, resolves what the chain was pointing at over there, and re-points it at the question holding
that short answer here. Anything that cannot be resolved that way is left unset rather than guessed
at, and the log says so.

**Afterwards, two cleanups.** A sweep over the whole round — not just the questions the import
touched — clears any chain pointing at a question that does not exist or at itself. Then the round is
renumbered by rank, exactly as the Renumber Q# button does, so an import cannot leave the numbering
in a strange state.

**Results are reported twice.** A one-line summary next to the button ("3 merged, 1 added, 1 skipped
— see log below. Renumbered Q# by rank."), green when everything validated and red when anything did
not; and a scrollable, monospaced log below it with a line per question and a nested line per
validation issue. The same detail goes to the browser console for anyone who wants to dig.

**The paste box behaves sensibly on failure.** Unparseable JSON or an unrecognisable shape leaves
the pasted text exactly where it is, so the author can fix it and retry rather than re-pasting a
large blob. A run that actually merged something clears the box.

**Done when.** Export a round, change three questions in the JSON by hand, set one field to `null`,
add a question with a chain, paste it back, and watch exactly those changes land with everything
else untouched — and a clear log for the question you deliberately broke.

---

## 7. Deliberate non-goals and known gaps in v1

Named so they are choices rather than oversights.

**No question deletion.** v1 can add questions but not remove them. This is a genuine gap rather than a
principle, and is the first thing worth adding.

**No undo.** There is no history stack. The mitigations are that destructive actions are rare and
confirmed, imports merge rather than replace, and export makes manual snapshots cheap.

**No sync, no sharing, no collaboration.** Deliberate. Moving a round is a copy-paste through
Export and Import, on purpose.

**No scoring of the ambiguity check.** The tool shows the quick model's guess next to the intended
answer and lets the author judge. It never declares a question ambiguous.

**Token figures are estimates.** Always presented as such, never as billing.

**The model's extraction is evidence, not truth.** Every ish list is editable by re-asking and
readable at a glance precisely because the author is expected to disagree with it sometimes.

---

## Appendix A — Prompt templates, verbatim

These are content, not implementation, and should ship unchanged. All four are shown to the author
in the Prompts used panel.

### A.1 Quick-model guess

```
You are answering a trivia question the way a fast, not-especially-careful player would — a literal, first-instinct read, not a careful expert analysis.

Question: {{question}}

Reply with only your best short answer, one line, no explanation and no hedging.
```

### A.2 Question numbers

```
A trivia question sometimes hides a second, numeric puzzle: adding together every number-like element in its text.

List every text span in the question below that a reasonable person might read as a number, in the order it appears.

Question: {{question}}

Rules:
- A span written in digits ("300", "1990") is kind "numeral".
- A span that reads as a number in words counts too: spelled-out numbers ("one", "twenty-three"), ordinals ("third"), and magnitude phrases ("300 million", "a dozen", "千", "douzaine") — kind "wordish". Give a magnitude phrase as one item with its full numeric value ("300 million" is one item worth 300000000), not split into pieces.
- Do not include the indefinite article "a"/"an" on its own, and do not include Roman numerals ("IV", "LIV").
- If nothing in the question reads as a number, return an empty array.

Reply with only a JSON array of objects {"text": string, "value": number, "kind": "numeral" | "wordish"}, no other text.
```

### A.3 Hint numbers

Identical to A.2 with "question" replaced by "hint" throughout and the placeholder `{{hint}}`, opening:

```
A puzzle hint can hide a numeric puzzle of its own: adding together every number-like element in its text.

List every text span in the hint below that a reasonable person might read as a number, in the order it appears.

Hint: {{hint}}
```

### A.4 Batched numbers (Recalculate all ishes)

```
Below are several trivia questions and hints, each tagged with a [key]. Some hide a second, numeric puzzle: adding together every number-like element in their text.

For each one, list every text span in it that a reasonable person might read as a number, in the order it appears.

{{items}}

Rules:
- A span written in digits ("300", "1990") is kind "numeral".
- A span that reads as a number in words counts too: spelled-out numbers ("one", "twenty-three"), ordinals ("third"), and magnitude phrases ("300 million", "a dozen", "千", "douzaine") — kind "wordish". Give a magnitude phrase as one item with its full numeric value ("300 million" is one item worth 300000000), not split into pieces.
- Do not include the indefinite article "a"/"an" on its own, and do not include Roman numerals ("IV", "LIV").
- If nothing in an item's text reads as a number, give it an empty array.

Reply with only a JSON array with one entry per item above, in the same order, each shaped {"key": string (copied exactly from its [key] tag), "items": [{"text": string, "value": number, "kind": "numeral" | "wordish"}]}. No other text.
```

`{{items}}` is the list of texts, each as `[key] text`, separated by blank lines, where a key is
`q:<question id>` for a question and `h:<question id>` for a hint.

---

## Appendix B — Failure messages

Shown in place of a result, in the author's language, never as a code.

| Situation | Message |
|---|---|
| Permission never granted | You haven't allowed this page to ask Claude. |
| Rate limited | Too many requests right now — try again shortly. |
| Model declined | Claude declined to answer this one. |
| Empty answer | Got an empty answer — try again. |
| Unreadable structured answer | Couldn't read that as structured data — try again. |
| Asking disabled for the account | Asking Claude is off for this account. |
| Session expired | Sign in again to keep asking Claude. |
| Connection problem | A connection hiccup — try again. |
| Anything else | Something went wrong asking the model. |
| Asking unavailable in this view | Asking Claude isn't available in this view. |
| Missing from a batched answer | The combined response didn't include this one — try refreshing it on its own. |
| Batched run failed | Couldn't recalculate: *&lt;message&gt;* Nothing was changed. |
| Nothing to recalculate | No questions or hints have any text yet — nothing to recalculate. |
| Save failed | Couldn't save to this browser — storage may be full, disabled, or private-browsing |

---

## Appendix C — Empty and intermediate states

Worth getting right; they are most of what a half-drafted round actually looks like.

| Cell | State | Reads |
|---|---|---|
| Quick-model guess | never asked | Double-click to ask |
| Quick-model guess | in flight | Thinking… |
| Quick-model guess | failed | *&lt;message&gt;* / Double-click to try again |
| Question ishes, Hint Ishes | never asked | Double-click to ask |
| Question ishes, Hint Ishes | asked, nothing found | None found |
| BUT NOT ishes | no chain picked | Pick a chain target |
| BUT NOT ishes | chained, hint never extracted | Not computed yet — double-click that question's Hint Ishes |
| BUT NOT | no chain picked | Pick a chain target |
| BUT NOT | chain points nowhere | Target question not found |
| BUT NOT | chained, target has no hint | No hint entered yet |
| Any sum | not computable yet | – |
| Chains to | unset | — pick — |
| Chains to option | target has no short answer | (no short answer yet) |
| Round name | unset | placeholder: Name this round… / listed as "Untitled quiz" |