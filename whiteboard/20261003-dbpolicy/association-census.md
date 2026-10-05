# Association census

As of `25aeb7a` (2026-10-03). Read from `convex/schema.ts`, the row validators in `src/models/`,
`convex/reading.ts`, `convex/authorize.ts` and `convex/writing/`.

**Convex has no foreign keys.** A `zid('quizzes')` field only says "an id of the quizzes table";
nothing in the database stops it dangling, and a label reference is just a string. Every policy
below (cascade, restrict, nullify, fixed) is code in `convex/writing/`, and every uniqueness is a
read-then-insert inside one mutation, which Convex's OCC serializes. Readers take the earliest row
(`.first()`) if a duplicate ever turns up.

**Legend.**
*Kind*: `id` is a Convex id; `label` is a string matched against the target's (effective) label;
`id[]` is an array of ids.
*A→B* is how many B each A has; *B→A* is how many A each B has. Caps come from `src/lib/vv/patterns.ts`.
*On delete* is what happens to A when B is deleted. *On update* covers both whether A's field can be
repointed and whether B's key can change underneath it.

## 1. Direct associations: the ownership tree

| A (holds field) | B | Field | Kind | Null | A→B | B→A | Notes | On delete of B | On update |
|---|---|---|---|---|---|---|---|---|---|
| realms | hunts | `hunt_id` | id | no | 1 | 1-N (1–99) | Ordered by `position`. Only `home` is ever made. | **Cascade**, via `deleteHunt` | **Fixed.** No write path touches a realm at all (label, title, position). |
| quizzes | realms | `realm_id` | id | no | 1 | 1-N (1–999) | In made order. Effective label unique within realm, **checked only in the browser** (§5.1) | **Cascade** (realm only goes with its hunt) | **Fixed**: no move. Relabel (`forced_label`) changes the quiz's URL; no row refers to a quiz by label. |
| quizzes | questions | `row_ordering` | id[] | no (may be `[]`) | 0-N (≤999) | 1 | Owns question order; mirrors `questions.quiz_id`. Cascades walk it (§5.3) | Question delete → id dropped from the array | Rewritten by add, delete, sort, move, renumber, import |
| questions | quizzes | `quiz_id` | id | no | 1 | 0-N (≤999; a new quiz gets 5) | `by_quiz_id` index exists but nothing reads it | **Cascade**: question, its widgeteds, its reviewings | **Fixed** |
| questions | hunts | `hunt_id` | id | no | 1 | 0-N | Denormalized: always the quiz's realm's hunt. Used for read auth in `questions.open` | **Cascade** (through quiz) | **Fixed**; can't drift, since quizzes never move |
| questions | questions | `chains_to` | label | **yes** | 0-1 | 0-N incoming | Same quiz, never self. The browser sends an id; it's written as the target's effective label | Target deleted → **nullify** (`deleteQuestions`) | Editable (`set_chain`, `edit_question`, import). The target's label can never change (no patch or import path revises `label`/`forced_label`), so a rename can't break a chain |
| widgetings | quizzes | `quiz_id` | id | no | 1 | 0-N (≤99) | `position` is run order | **Cascade** | **Fixed** |
| widgetings | widgets | `widget_label` | label (scope `pub` implied) | no | 1 | 0-N, across all hunts | Same widget may be worked twice in one quiz | **Restrict**: `delete_widget` refused while worked (`widgetInUse`) | **Fixed** both ways: absent from `widgetingPatch`, and a widget's label is fixed. Widget edits flow to every quiz working it; its formulary and entry kind are fixed (`entryKindFixed`) |
| columns | quizzes | `quiz_id` | id | no | 1 | 0-N (≤99) | `position` is display order | **Cascade** | **Fixed** |
| columns | widgetings | `source` | label, *or* `question.<field\|view>` | no, but may name no widgeting | 0-1 | 0-N | Same quiz; must be showable at write (`sourceUnshowable`) | **Cascade**: columns showing it are deleted; a `last_sortkey` naming one is nullified | Source editable (to anything showable). Widgeting rename **carries** its columns' `source` |
| quizzes | columns | `last_sortkey` | label (`column:<label>`), or `chain_order` | **yes** | 0-1 | 0-1 | Display memory only; never re-sorts | Column deleted → **nullify** | Set by sort and drag. Column rename **carries** it |

## 2. Direct associations: the legs of the association tables

| A (holds field) | B | Field | Kind | Null | A→B | B→A | Notes | On delete of B | On update |
|---|---|---|---|---|---|---|---|---|---|
| huntings | hunts | `hunt_id` | id | no | 1 | 1-N (≤999); ≥1 smith (§3) | | **Cascade** (`deleteHunt`) | **Fixed** |
| huntings | idents | `ident_id` | id | no | 1 | 0-N (≤999 hunts) | | n/a: idents are never deleted | **Fixed** |
| reviews | quizzes | `quiz_id` | id | no | 1 | 0-N (≤999) | | **Cascade** (`deleteQuiz`) | **Fixed** |
| reviews | idents | `ident_id` | id | no | 1 | 0-N | | n/a: idents are never deleted. Removing the hunting **leaves the review** (§5.2) | **Fixed** |
| reviews | hunts | `hunt_id` | id | no | 1 | 0-N | Denormalized from the open quiz's hunt (`mayPerform` checks the quiz is the hunt's). Drives `mayReadReview` | **Cascade** (through quiz) | **Fixed** |
| reviewings | reviews | `review_id` | id | no | 1 | 0-N (≤ the quiz's questions) | | No review is deleted alone. With a quiz, reviewings go via their questions | **Fixed** |
| reviewings | questions | `question_id` | id | no | 1 | 0-N (one per review) | Same quiz as the review (`questionOf`) | **Cascade** (`deleteQuestion`) | **Fixed** |
| widgeteds | questions | `question_id` | id | no | 1 | 0-N | Same quiz as the widgeting | **Cascade** (`deleteQuestion`) | **Fixed** |
| widgeteds | widgetings | `widgeting_id` | id | no | 1 | 0-N | Keyed by widgeting, not widget | **Cascade** (`delete_widgeting`) | **Fixed**. A widgeting rename keeps what it stored |
| identings | idents | `ident_id` | id | no | 1 | 0-N | Other side is `browser_key`, not a table | n/a: idents are never deleted | **Fixed**; append-only |

## 3. The association tables on their own

| Table | Joins | Unique on | Payload | Made by | Deleted by | Updated |
|---|---|---|---|---|---|---|
| **huntings** | idents ↔ hunts | (hunt, ident). A second add patches the role | `role`: smith \| reviewer | `new_hunt` (creator as smith), `add_hunting` | `remove_hunting`, never one's own; `deleteHunt` | Only `role`, and never your own. That is why a hunt keeps ≥1 smith: its creator holds one, and only a different smith (who stays) can demote or remove a smith |
| **reviews** | idents ↔ quizzes (+ hunt) | (quiz, ident), via `reviewFor` | `overall`, `phase` | `open_review`, by any member, even on a locked quiz | Only with its quiz. There's no withdraw-and-delete | `overall`, `phase`: empty→draft once written; draft⇄shared; never back to empty |
| **reviewings** | reviews ↔ questions | (review, question), via `reviewingFor` | get_rate, guesses, comments, minutes, 3 flags, `peeked` | First `set_reviewing` or `peek_answer` | With its question (and so with its quiz). No delete of its own | Patch fields. `peeked` is one-way. keep/eliminate are mutually exclusive, ≤3 each per review |
| **widgetings** | quizzes ↔ widgets | (quiz, `label`). **Not** (quiz, widget): one widget can be worked twice | `label`, description, params, position | `add_widgeting`, seeding. A new quiz gets none | `delete_widgeting` (cascades widgeteds and columns), with its quiz | label (carries columns), description, params, position. `widget_label`/`quiz_id` are fixed |
| **widgeteds** | questions ↔ widgetings | `entry`: 0-1 per pair (upsert). `aibot`: 0-N, appended. `jsonata`: never stored | status, value, message, result_meta. Time is `_creationTime` | `record_widgeted` (aibot), `enter_widgeted`/import (entry) | With its question or widgeting. An entry emptied to null deletes its row | `entry`: replaced in place. `aibot`: never revised; history kept |
| **identings** | browser_key ↔ idents | none: append-only log | — | `assume_ident` | Never (only `testing:clearAll`) | Never. The newest per browser is "who I am" |

## 4. Has-X-through

*Empty?* says whether the association can come up empty (has_many) or null (has_one).

| Model A | Association | Model B | Cardinality | Empty? |
|---|---|---|---|---|
| hunts | quizzes through realms | quizzes | 1-N | never: a realm keeps ≥1 quiz, and a hunt is deletable only at exactly 1 |
| hunts | questions through realms → quizzes (also direct, `hunt_id`) | questions | 0-N | may be empty |
| hunts | members through huntings | idents | 1-N | never: ≥1 smith |
| hunts | smiths through huntings[role=smith] | idents | 1-N | never |
| idents | hunts through huntings | hunts | 0-N | may be empty |
| quizzes | hunt through realm (`huntIdOf`) | hunts | 1 | never null in a sound db |
| quizzes | widgets through widgetings | widgets | 0-N, repeats allowed | may be empty |
| widgets | quizzes through widgetings | quizzes | 0-N | may be empty, and only then deletable |
| widgets | hunts through widgetings → quizzes → realms (`usageOf`) | hunts | 0-N | may be empty |
| quizzes | reviewers through reviews | idents | 0-N | may be empty |
| idents | reviewed quizzes through reviews | quizzes | 0-N | may be empty |
| reviews | questions through reviewings | questions | 0-N (only those written to) | may be empty |
| questions | reviews through reviewings | reviews | 0-N | may be empty |
| questions | reviewers through reviewings → reviews | idents | 0-N | may be empty |
| reviewings | quiz through review (or through question) | quizzes | 1 | never null |
| questions | stored widgetings through widgeteds | widgetings | 0-N | may be empty |
| widgetings | questions through widgeteds | questions | 0-N | may be empty |
| widgeteds | widget through widgeting (`widget_label`) | widgets | 1 | never null: restricted |
| columns | widgeteds through `source` → widgeting | widgeteds | 0-N | may be empty; none when the source is `question.*` |
| questions | shown BUT NOT hint through `chains_to` | questions | 0-1 | may be null |
| browser (`browser_key`) | current ident through identings, newest | idents | 0-1 | null until it assumes one |
| idents | browsers through identings | browser keys | 0-N | may be empty |

## 5. Security policy today, by model

What the server enforces as of `25aeb7a`, read from `convex/authorize.ts`, the public functions
and `convex/writing/`. *Member* means smith or reviewer of the hunt. *Identified* means the
browser's newest identing names an ident. Anything not listed under "Reviewer may" or "Anyone
may" is smith-only. §6 of `authz-review.md` says where this falls short of the intended model.

| Model(s) | Read | Write | Reviewer may | Anyone identified may | Notes |
|---|---|---|---|---|---|
| **idents, identings** | Own ident only (`idents.current`, by `browser_key`); a member's label and title through `hunts.open`, a reviewer's through `reviews.forQuiz` | `assume_ident` makes or takes any ident; `retitle_ident` own only | — | Take on **any** ident, no secret. Make idents | Never deleted; never relabelled. Identings are read only by own key |
| **hunts, realms** | Members, whole (`hunts.open`, `hunts.list`). A non-member sees it exists plus its smiths (`notOnHunt`) | Smith: retitle, relabel, delete (when down to one quiz) | Read | `new_hunt` (becomes its smith) | Existence and smiths are deliberately disclosed, so one can ask to join. No realm write exists |
| **huntings** | Members see all members with roles | Smith: add (or re-role) and remove anyone **but themselves** | Read | — | ≥1 smith invariant follows from "never your own" |
| **quizzes** (frame) | Members, whole frame: title, labels, `smiths_note`, version, lock, sort memory, `row_ordering`, widgetings, columns (`quizzes.open`) | Smith, and the quiz unlocked, for contents and layout. Smith regardless of lock: `new_quiz`, `delete_quiz`, `set_lock`, hunt-level actions | Read everything | — | Lock is enforced server-side in `revisable()` |
| **questions** | Members, **every field**: `full_answer`, `hint`, `notes`, `alt_text` included (`questions.open`, `hunts.whole`) | Smith, unlocked | Read everything. The answer is hidden only by `AnswerLock` in the browser | — | `peeked` is an honor-system record: the answer was already sent |
| **widgetings, columns** | Members (in the frame) | Smith, unlocked | Read | — | Label uniqueness and showability are server checks |
| **widgeteds** | Members, every stored row the cell needs, including `aibot` replies (`questions.open`) | Smith, unlocked: `record_widgeted`, `enter_widgeted`, import | Read, including bot guesses at the answer | — | |
| **widgets** (library, scope `pub`) | Any identified browser (`widgets.library`). Usage counts: a smith of any hunt | **A smith of whatever hunt is open on screen** may add, edit, move, delete and import library widgets, which every hunt shares | Read | Read | A cross-tenant write with no admin gate. Delete restricted while worked |
| **reviews** | Own, always. Others': only `shared`, and then by a smith of the hunt, or by a reviewer whose own review is `shared` | Own only: open, overall, phase | Everything about their own | — | Own-review read does **not** check hunt membership: a removed member keeps reading theirs |
| **reviewings** | Travel with their review | Own review only; the question must be the quiz's | Own | — | Picks capped at 3 per kind, server-side |
| **`/api/ask`** (Next route) | n/a | Anyone who can reach the URL may spend the server's model credits, when `ENABLE_ANTHROPIC_BOT=allow` | — | Everyone, identified or not | No identity reaches the route; `Approval.need(null, …)` is an environment switch, not authorization |

## 6. Things the census turned up

1. **Quiz label uniqueness within a realm is browser-only.** `relabelQuiz` says uniqueness "is the
   caller's to check", and `perform` doesn't check it. Only `QuizManageModal` does. A raw mutation
   (or two browsers racing) can give two quizzes of a realm one effective label, and the address
   then resolves to whichever is found first. `newQuiz` and hunt relabels *do* check on the server.
   `relabelQuiz` also writes `forced_label` even when it equals the minted label; `relabelHunt`
   clears it to null in that case.
2. **Removing a hunting leaves that ident's reviews and reviewings.** Smiths keep seeing a removed
   reviewer's shared review. The removed ident can still read their own review through
   `reviews.forQuiz`, which checks `mayReadReview` (own review is always true) and never checks
   hunt membership. Whether that's wanted is a policy question.
3. **The quiz cascade walks `row_ordering`, not the `by_quiz_id` index.** `deleteQuiz` deletes the
   questions `questionsOf` finds, which reads them by `row_ordering`. A question row missing from
   the array would outlive its quiz, along with its widgeteds and reviewings, and those would then
   point at deleted widgetings and reviews. Today every write keeps the two in step inside one
   transaction, so this is a hardening note rather than a live bug. `by_quiz_id` is otherwise
   unread.
4. **`deleteQuiz` deletes widgetings with a bare `db.delete`**, not `deleteWidgeting`. That's safe
   only because their widgeteds already went out through the questions, so it rests on the same
   caveat as (3).
5. **Every "unique on" in §3, plus ident labels and widget labels, is read-then-insert.** OCC
   makes it hold in practice; there's no index constraint behind it. Readers already tolerate a
   duplicate by taking the earliest.
6. **Editing an `aibot` widget's prompt or tier leaves its stored widgeteds as recorded.** Nothing
   in `convex/` or `src/lib` marks answers stale against the prompt that produced them.
7. **Idents and identings have no delete path** (by design: `authorize.ts`), so every "on delete
   of an ident" above is n/a.
