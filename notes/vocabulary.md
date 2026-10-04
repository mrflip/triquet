# Vocabulary

The words this project uses for its own things. They are specific, several were chosen to stay
clear of a near neighbour, and none is guessable. Use them exactly: in code, in UI copy and in
chat. `STYLE.md` holds the general-purpose naming tags (`kind`, `label`, `bag`, `ckey`); this is
the domain.

## Widgets

Everything a quiz works out per question beyond the question's own fields. Settled in October
2026 by `notes/decisions/2026-10-widgets.md`, which replaced five words (bot, botting twice,
expression, expressing) with the three nouns below and a piece of code. *Retiring*, at the end of
this section, lists the words they replace while code still holds them.

* **formulary** -- the generic runner behind a widget: code, never a row. A class of statics in
  `src/lib/formulary/`, each answering one interface (`check`, `input`, `run`, `advice`) and
  reporting `defaultInput`, `refresh` and `store`. The formularies are `jsonata` (a JSONata
  formula worked out on render), `aibot` (a prompt put to a model when the author asks) and
  `entry` (a value a person types into the cell, with no formula, so no `run` and no `advice`). A
  word that meant nothing before, so it collides with nothing.
* **widget** -- a reusable definition: a formulary, a **formula**, an input formula and a config,
  under a label. Global: every hunt sees the same widgets, the **library**, whose one **scope**
  this sprint is `pub`. Outside the database a widget is named by its key, `pub/<label>`. It knows
  nothing of any quiz. (Until October 2026 a widget was what is now a widgeting.)
* **widgeting** -- one widget put to work in one quiz, under a label of its own (the widget's, by
  default, growing `_2`, `_3` while taken), at a place in the quiz's **run order**. The noun is
  deliberate, as *expressing* was: the widget is the recipe, the widgeting is it being worked here.
  Removing a widgeting takes its columns.
* **widgeted** -- what one widgeting came to for one question. Stored for the formularies that
  store (`aibot` appends, `entry` upserts) and worked out on render for `jsonata`. Everyone reads
  one as `{ status, value, err }`. Never called a "result".
* **input formula** -- a widget's second JSONata expression, which culls the bag to what the widget
  reads. `$`, the whole bag, by default for `jsonata`; for `aibot`, the small object the prompt
  template is rendered over (`{ 'clueing': qn.clueing }`). An input that comes to nothing means "do
  not run", and the cell stays `missing`.
* **formula** -- what a widget does with its input: a JSONata expression for `jsonata`, a prompt
  template with `{{placeholders}}` for `aibot`.
* **config** -- a widget's formulary-specific settings: `servicelabel`, `model_tier` and
  `max_tokens` for `aibot`; `entry_kind` for `entry`; nothing for `jsonata`.
* **entry kind** -- what an `entry` widget's cells take: `text`, `number`, `labelish` (a label) or
  `titleish` (one line). Fixed once the widget is made, as its formulary is; together they are its
  **flavor** (`Widget.flavorOf`: "a number entry", "an aibot widget"). An emptied entry cell holds
  no row and reads `missing`.
* **run order** -- a quiz's widgetings in `position` order. Each widgeting's bag holds the
  widgeteds of the widgetings before it, so the order is the dependency order.
* **ok**, **errored**, **missing** -- the three states of a widgeted, and the only ones. `ok` has a
  value; `errored` has only a failure; `missing` has neither, and is never stored: it is a cell with
  no row, or an input or formula that came to nothing (shown as a muted dash; never zero). An
  `ok` of null is shown, written and sorted as nothing too, but keeps its status.
* **err** -- a failure on a widgeted: on `errored` the failure itself, on `ok` a newer failure
  riding along on an older value, which it never replaces. Shown as one badge.
* **stale** -- derived, never discarded: a stored widgeted whose input is no longer what it was
  asked about, or is not known (a value carried in by an import), stays on screen, marked. Off
  until it returns by digest (the decision's *Deferred*); `whiteboard/20261003-widgets_todo.md`
  has what bringing it back, and the imported replies with it, takes.
* **refresh** -- how a formulary's widgeteds come to be: `live` (worked out on every render),
  `click` (asked from the cell), or neither (typed).
* **library** -- every widget there is. Its own export and import, apart from any hunt's.
* **catalogue** -- the library as the widgeting editor's picker offers it.
* **widgeting editor** -- the quiz's dialog for one widgeting: the widget it works, picked from the
  catalogue, and its own label and description. It never edits the widget.
* **widget editor** -- the library's dialog for one widget: its formulary (chosen once, when it is
  written), formula, input formula and config, how far it is put to work, and its removal.

### Retiring

Words the October 2026 design replaces. Code still says them until the rewidgeting sprint's later
threads remove what they name (`whiteboard/20261001-rewidgeting/`); new code and new copy use the
words above.

* **expression** -- what a `jsonata` widget was, held by a hunt (`owner` `tq` for the seeded ones).
  Its `owner` became a widget's `scope`.
* **expressing** -- what a widgeting of a `jsonata` widget was.
* **expressed** -- what a widgeted of a `jsonata` widgeting was: a value, `nothing`, or an error.
  Now `ok`, `missing` or `errored`.
* **botting** -- as a widget, what a widgeting of an `aibot` widget was; as a row in `bottings`,
  what a stored widgeted was. Its `done`/`error` status became `ok`/`errored`.
* **slot** -- a (bot, textkind) pair and the question field that showed it (`BotSlots`). Gone with
  the fields: replies sit under widgeting labels.
* **last_err** -- a failed ask riding along on a cell. Now `err`.
* **job** -- which of the ask route's three fixed asks a request was (`guess`, `ishes`,
  `bulk_ishes`). The route now takes a rendered prompt.
* **textkind** -- which of a question's texts a bot was shown. Now the input formula's business.

## Who and where

* **session** -- a Convex Auth sign-in, anonymous for now: what a browser is to the server. It
  gives a `users` row id (`user_id`), and is kept in the browser's storage, so a browser is the
  same session visit after visit. A session says nothing of who someone is; its username does.
* **username** -- what the screen calls an ident's label: what a person types to become an ident.
* **ident** -- a persona in the app, named by a global label a person types to become it: 6 to
  24 characters of the label alphabet, normalised from what was typed. Held by the session that
  claimed it (`user_id`), and asserted by no other: no password, but no taking on another's
  either. One made before sessions held usernames is unclaimed (`user_id` null) until a session
  asserts it. Has a `title` for display. Never deleted, and its label never changes.
* **identing** -- one session asserting one ident, by the session's `user_id`. The session's
  newest identing is its current ident; that row, not browser storage, is what "logged in" means.
* **actor** -- who a request is from, as a tagged value built once per request and handed to
  every function as `ctx.actor` (`src/lib/actor.ts`): `{ kind: 'anonymous' }` when no username
  has been asserted (signed in or not), or `{ kind: 'ident', user_id, ident_id, ident_label }`.
  A tagged value rather than `null`, so that "anonymous" is a state with a name
  (`Actor.isAnonymous`). A variable, field or parameter named `actor` is the whole tagged value;
  one that holds an id or a label of the one acting is named for what it holds (`ident_id`,
  `user_id`, `ident_label`), and `acting_ident_id` where it must be told apart from another ident
  in the same scope.
* **standing** -- an actor's place on one hunt: `'smith'` or `'reviewer'` by its hunting, or
  `'stranger'` (`Actor.HuntStandingVals`). A named value rather than a null role, so that "not on
  the hunt" is a state with a name. An actor who has asserted no username is a stranger to every
  hunt.
* **affirms** -- what a browser says is true of itself on a hunt, sent with every request about
  it: `{ ident_id, hunt_id, standing }`, and where the request is about a quiz, its `quiz_id`, and
  for an action, the quiz's `realm_id` too (`ActionValidators.huntAffirms`, `quizAffirms`,
  `affirms`). Each is something the browser already holds from the hunt it opened
  (`useAffirms`). The server believes none of it until it has checked it (`affirmForHunt`): a
  stale or forged affirm is a denial. Named `affirms`, the whole object, never one of its fields.
* **claims** -- what the server has verified of an actor on one hunt, handed to a policy:
  `ActorT & { hunt_id, standing }` (`Actor.HuntClaimsT`, built by `Actor.claimsOn`), and with a
  quiz on screen, that quiz's row (`Actor.QuizClaimsT`). On the server, the affirms once checked,
  with the rows read to check them (`ClaimsOf` in `convex/authorize.ts`). Code handed claims
  trusts them. Named `claims`, the whole object, never one of its fields.
* **policy**, **verdict** -- a policy is a non-async `may…` function in `src/lib/approve.ts`
  (`mayReadReview`, `mayChangeMembership`) that decides from the evidence it is handed and reads
  nothing, so the browser and the server run the same one. Its verdict is `'allow'` or the refusal
  kind that says why not (`notIdentified`, `notPermitted`, `ownHunting`, `quizLocked`). `Approve.may(key, …)`
  answers yes or no, `Approve.must(key, …)` throws when no, and `Approve.verdictOn(key, …)` says
  which; the key is an action's kind or the name of a read (`read_hunt`).
* **scoped database** -- the `db` a hunt's function holds once its affirms are checked: it sees and
  writes only rows of that hunt, by one rule per table (`convex/policy_rules.ts`), whatever the
  handler asks for. Built by `zHuntQuery` and `zHuntMutation`; the functions that hold the whole
  database instead are named in `Unscoped` (`convex/authorize.ts`). Not a widget's `scope`.
* **census** -- what a write must know across every hunt, asked of the whole database and
  answered with an id or a yes, never a row: whose a hunt label is, whether a widget is worked
  anywhere (`CensusT` in `convex/reading.ts`). A hunt's mutation holds one beside its scoped
  database.
* **affirm…** -- an async function in `convex/authorize.ts` (`affirmPerform`,
  `affirmReadReviews`) that checks the affirms and gathers the evidence a policy needs in one
  parallel round (`affirmForHunt`), builds the claims, and hands them to `Approve`. It decides
  nothing itself. A denial is thrown: a mutation refuses with it, a query answers its empty value
  (`emptyIfDenied`).
* **hunt** -- the unit of URL scope and of membership: holds realms (and, until widgets replace
  them, expressions), and is exactly what Export emits. It holds no widgets: the library is
  global, and exports on its own. Its label is global; should two share one, the earlier-made wins.
* **realm** -- a division of a hunt, holding quizzes; the address's middle segment. Every hunt
  starts with one, `home`, and nothing yet makes another. Where the notes say *puzzle* for a
  scope, they mean realm; *puzzle* is kept for the not-soon idea of quizzes of other shapes.
* **act** -- the presentation an address asks for (`?act=`): `smith` (the Workbench) or `review`.
  The path names the resource, the act how to show it. See
  `notes/decisions/2026-09-resource-urls.md`.
* **smith** -- someone making a hunt's quizzes; **reviewer** -- someone playtesting them. Each
  is a **role** on a hunt, held by a hunting.
* **hunting** -- one ident's place on one hunt, with a role; a **member** of a hunt is an ident
  with a hunting on it. One per (hunt, ident): putting someone on again changes their role. A
  hunt's maker is its first smith, and nobody changes their own hunting: another smith does.
  The hunts list shows one's own hunts; an address naming no `act` is shown as one's role asks.
* **workspace** -- retired in September 2026: what one account held, before hunts held quizzes
  and addresses said which was open. Nothing reads one now.

## The things an author makes

* **quiz** -- an ordered list of questions, plus the widgetings and columns that say what else
  the grid shows. Each question's `position` *is* the display order; sorting and dragging
  rewrite it.
* **smith's note** (`smiths_note`) -- what the smiths say about a quiz as a whole: its theme, its
  meta, what is left to do. Beside the quiz's name, and a formula reads it as `quiz.smiths_note`.
* **question** -- one row. Its base fields are the constant of the whole tool: `title`, `clueing`,
  `hint`, `full_answer`, `qnum`, `chains_to`, `alt_text`, `notes`. Everything else a quiz shows
  is a widgeted.
* **clueing** -- the question as it will be asked. Never "question text" and never "question":
  that word is the row. (The prompts still say "question" to the model, because a player would.)
  Never rewritten by the tool, not even trimmed.
* **title** -- a brief name for the question, and what other questions' chain pickers call it.
  Not the answer.
* **full_answer** -- the answer, as it will be read out.
* **hint** -- this question's own "BUT NOT ..." misdirection: a clue for something that shares
  the answer's name but is not it. It belongs to the question whose answer it disguises, and is
  *shown* beside whichever other question chains to this one.
* **qnum** (Q#) -- the author's own question number, kept as text. Blank, gappy, duplicated and
  decimal are all legal; `3.1` means "between 3 and 4" without renumbering anything.
* **rank** -- a question's 1-based place once the quiz is put in Q# order; null without a Q#.
  Rank is derived and dense where Q# is typed and loose. Exports are always in rank order.

## Chains

* **chain**, `chains_to` -- the question that follows this one. Solving this one hands the player
  a pointer to the next. Stored as the target's id; shown to formulas as its label. A chain that
  dangles or points at itself is cleared, never kept.
* **butnot** -- the BUT NOT text presented with a question: the *chained-to* question's hint. A
  **view** (`question.butnot`, `question.butnot_ishes`), worked out and stored nowhere.
* **chain order** -- walking the chains from the lowest Q#; the one sort that is not a column's.

## Identity

* **id** -- Convex's own row id, `_id`, whatever it wants it to be; fixed for life, never shown: not on
  screen, not in the Export box, not in a quiz's history (`lib/exporting.ts`). An
  internal detail: where a label relationship is reasonable and equally powerful, refer by label
  instead, scoped where it must be (`quizlabel-questionlabel` as a selector id).
* **label** -- a freeform-string-derived identifier a person can read, type and paste back:
  lowercase letters, digits, underscore; letter first. Unique among siblings, not globally;
  idents and hunts have no parent, so theirs are global.
  Labels are what URLs, formulas, exports, git paths and column sources use, because people
  export, edit and re-import -- so many things refer by label where an id would be easier.
  A label is minted when its row is made (`quiet_otter`), and is the row's one label: relabelling
  a hunt or a quiz replaces it, and a question's stays as minted. `Labelmaker` is the facility for
  all of this. (Until October 2026 a row could also hold a `forced_label` overriding the minted
  one, "the effective label"; that pair is retired, and only an import of an older export still
  reads a `forced_label`.)
* **version** -- which line of work a quiz is on; also its git branch. A **milestone** is a tag.

## Columns and the bag

* **column** -- what the grid shows: a `label`, a `title`, a `width_px` and a `source`. Kept apart
  from widgetings on purpose: a widgeting *has* a value, a column *shows* one. Removing a column
  keeps its widgeting; removing a widgeting takes its columns. Columns have a label space of their
  own per quiz, and the TSV's headers are column labels.
* **source** -- what a column shows: `question.<field>`, `question.<view>`, or a widgeting's
  label. `question` names the questions' own fields here, and no widgeting may be labelled it.
* **bag** (the quiz bag) -- the document a formula reads: `hunt`, `realm`, `quiz`, `qns`, `qn`,
  `qn_label`, `quiz_label`, and the running widgeting's `params` and `widgeting_label`. No ids;
  everything by label. It is **flat**: each earlier widgeting's widgeted sits at `qn.<label>`,
  beside the question's own fields, and likewise on every question of `qns`. `hunt` and `realm`
  are where the quiz sits, its **place** (`Runner.placeOf`), which the quiz's history also
  files it under.
* **reserved** -- the labels no widgeting may take, so the flat bag never shadows a question's
  own field: every key a question has in the bag (its exposed fields, and `rank`), its views, and
  `question`. Derived from those lists in one place, never written out twice.
* **exposed** -- the class-level list of fields a thing shows the outside world. The bag, its
  JSON Schema and the git table are all built from these lists, so hiding a field is one edit. A
  widgeting exposes `status` and `value`; never its `err` or how it ran.

## Bots

*Player* means a human taking the quiz, and is kept for that. The prompts have always used it
that way; the model bots were called players until September 2026.

* **bot** -- something that can be put a question and reply; a model with a brief. The brief is
  now a row: an `aibot` widget, its prompt the formula. Seeded as three: **dumdum**, the hasty
  guesser, put the clueing; and **numnum**, the number spotter, as `numnum_clueing` and
  `numnum_hint`. Their names live on as those widgets' labels and titles.
* **ask** -- the act of putting a rendered prompt to a model through the ask route, and the
  request that does it: what clicking an `aibot` cell does.
* **guess** -- dumdum's reply to a clueing: its value's `guess`, beside an `explanation`. The
  ambiguity signal: a guess that differs from the answer means a second reading the author could
  not see from inside.
* **ish**, **ishes** -- a number-like span numnum found in a text ("300 million", "third", "千"),
  with the value a player would total for it. `kind` is `numeral` (digits) or `wordish`. A numnum
  widget's value is `{ items }`, a list of them. The **sums** over them are seeded `jsonata`
  widgets; they exist for quizzes whose meta is numeric.
* **model tier** -- `quick` or `careful`: a feature of the widget, set in its config, not a cost
  dodge.
* **servicelabel** -- which outside service serves an `aibot` widget (`claude`), and so whose
  credentials it needs. **unavailable** is a service with none.

## Playtesting

* **review** -- one ident's review of one quiz: an overall note and a **phase**. One per (quiz,
  ident); opened the moment a reviewer first sees the review screen, upserted from there.
* **phase** -- how far a review has come: `empty` (nothing written), `draft` (the reviewer is
  still working), or `shared` (the smiths can see it). Nothing moves a review back to `empty`;
  sharing and withdrawing move it between `draft` and `shared` only, and sharing is live, not a
  snapshot -- an edit after sharing stays visible.
* **reviewing** -- one review's verdict on one question: get rate, guesses, comments, minutes,
  three flags (`keep_it`, `needs_fact_check`, `elimination_candidate`), and whether the reviewer
  **peeked**. One per (review, question), made the first time the reviewer writes to it.
* **get rate** -- a reviewer's own estimate of how likely they would have been to get a question,
  0 to 100. Theirs to give however they like; nothing asks when or how they arrived at it.
* **peeked** -- the reviewer revealed the answer; set the first time, never cleared. It says that
  they looked, not when, and it is the reviewer's own: their lock says "Seen before", and the
  smiths are not shown it.
* **the lock** -- the answer, hidden behind a confirmation until a reviewer chooses to see it.
  Neither the confirmation nor the reveal is stored, apart from the reviewing's `peeked`.

## Reading from Convex

How the browser gets rows; `notes/queries_hooks_and_subscriptions.md` says where to draw the
lines between them, and these are here so they are findable beside the rest.

* **query function** -- server code under `convex/` that reads rows and returns what a screen
  shows. It knows nothing of how it is called.
* **watch** -- calling a query function and staying subscribed: `useQuery`, `useQueries`,
  `watchQuery`. Redelivers the moment anything it read changes.
* **fetch** -- calling a query function once, with no subscription: `client.query`. For what
  is large and asked for, such as the export.
* **facet** -- what one watch covers: a set of rows that change together and are shown
  together. One watch per facet.
* **screen hook** -- the one hook that owns a screen's watches and hands props down (`useHunt`,
  `useQuiz`, `useHuntsList`, `useIdent`). Components never watch.

## Around the edges

* **locked** -- a quiz frozen against edits. Never a trap: switching, unlocking, exporting and
  editing the widget library all stay available.
* **sort memory** (`last_sortkey`) -- which column last committed the quiz to its order. A
  label, not a live sort.
* **notice** -- a sentence shown to the author in place of a result. Failures reach the author
  as sentences, never codes; they live together in `lib/notices.ts`.
* **alarm** -- a failure raised for the whole page: a headline, a notice, and the request to send
  us when the server kept its reason to itself. One at a time, the latest in front, shown at the
  foot of the window until dismissed. For a failure with nothing on screen beside it to say so,
  such as a change not kept; a refusal about a field is said beside the field. Raised with
  `useRaiseAlarm` (`src/state/alarms.tsx`), shown by `AlarmSnackbar`.
* **mirror** -- the quiz's git history in the browser. A past-versions view and an exit door,
  not a source of truth. `.qq.tsv` is the diffable table; `.tq.json` is the whole quiz; both sit
  at `tq/hunt/<hunt>/realm/<realm>/quiz/`, and each widget the quiz works at
  `tq/widget/pub/<label>.tqwidget.json` (until widgets replace them, the hunt's expressions at
  `tq/hunt/<hunt>/<hunt>.tqexpressions.json`). The history follows the quiz: a relabel is a new
  label on the same thing, an edit new content for it.
* **meta** -- the second-layer puzzle a quiz can hide. The reason widgets exist.
* **Coach**, **agent** -- the humans and the AI on this project. See `CLAUDE.md`.
