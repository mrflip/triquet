# Thread 7: The Coach's follow-ups (2026-10-05)

Branch `20261005-orglabel`, PR pending. Suites: typecheck, lint, vitest (134 files, 3908 tests, 1
skipped: thread 4's measurement) green; e2e green in lane 1 (252). One commit per item, 1 to 8.

* **Built**:
  1. **`orglabel` on the hunt (widen)**, as #115 did it. Row validator requires it (identlabel
     bounds); `convex/schema.ts` makes it optional by hand, with index `by_orglabel_and_label`;
     `tests/convex/schema.test.ts` lists it under `Backfilling`; `migrations:backfillHuntOrglabels`
     (earliest hunting's `ident_label`; a hunt nobody is on is skipped and logged) and `runAll`;
     a ledger row in `notes/deploy.md`; `tests/convex/migrations.test.ts` is back. `newHunt`
     writes the maker's ident label (`insertHunt(db, label, orglabel)`). Reading:
     `huntInOrg(db, orglabel, label)` and `orglabelOf(db, hunt)` (`convex/reading.ts`);
     `huntForLabel` stays for old `/h/...` addresses only. `hunts.open` takes
     `{ orglabel: identlabel | null, hunt_label }`; null is an old address. The census answers
     `huntIdInOrg`. New hunts and relabels are refused only within the org. `updateHunt` stores
     the org of an unbackfilled hunt at its next edit. `orgFor(hunt, members)` (`rows.ts`) is the
     one widen-period fallback: stored, else earliest **member** (whatever their role, so the
     address does not move at the backfill). `Addresses.orgOf` is gone. Client: `useHunt`,
     `useHuntOpening`, `useCategories`, `useHuntFeed` and `watchHunt` take the org;
     `HuntsList.onNew` mints a label unique among the visitor's own org's hunts.
     `HuntSnapshotT.hunt` carries `org`, so `Exporting.placeOf` reads it.
  2. **A bare quiz address by role**: `QuizRoute` moves a smith to `!edit`, a reviewer to
     `!playtest`; anyone not on the hunt stays and sees `NotOnHunt`, reworded
     (`notOnHuntNotice`: "To be invited, contact its smith, …"). urls.md rule 4 records it.
  3. **Quiz lists by label**: `huntListingOf` sorts each realm's quizzes by `Tsv.byCode` of the
     label, so every list that reads the listing follows (hunts page, hunt page, quizzes page,
     switcher, gear's All quizzes, not-found page). One e2e (`quizzes.spec.ts`, the switcher) had
     assumed creation order; it now reads the order off the labels.
  4. **Import carries the whole quiz**: the ball gains `last_sortkey` (alignment was already
     there whenever set). `Importing.importInto` returns `actions`, everything to dispatch in
     order (`fieldActions`, `widgetingActions`, `columnActions`, then `import_questions`), with
     `columnLog` and `fieldLog`. `import_questions` takes an optional `last_sortkey`. The rules
     for a quiz already holding things are in `notes/hunt_git.md`, *Reading a ball back in*
     (below too). The defining round trip (`tests/convex/hunts.test.ts`) now compares the whole
     body, columns and own fields included; a second test covers a non-empty target.
  5. **TSVs per `notes/decisions/tsv-formats.md`**: `Tsv.textOf(records, wholes)` takes key-path
     patterns (`*` any key) for values written as one JSON cell; `Huntfiles`' `WholesFor` names
     them (`['*', 'value']` in the questions, `['widgetings', '*', 'params']` in a quiz,
     `['config']` in a widget). Strings are JSON-escaped less quotes and less `\"`; JSON cells
     are not escaped again. README's *The tables*, `notes/hunt_git.md` rules 3-4 updated.
  6. **Widgets at `/pub/widgets/<label>`**: `keypathOf` is `[scope, 'widgets', label]` with no
     root, so the file is `pub/widgets/<label>.tqw.json` and the ball `{ pub: { widgets: … } }`.
     `Addresses.recordUrlOf` and `LocationT.raw` write and read `.json` raw records for any keyed
     address; `useAddressed` treats a raw address as not found. `Jsonball.widgetsIn` reads the new
     shape, the `{ widgets: { pub: … } }` shape of earlier today (fixture
     `fixtures/exports/library-2026-10-05.json`), and the old lists.
  7. **Off-screen quizzes open once the page has loaded and gone idle**: `watchHunt` opens a
     non-focused quiz's watches (`quizzes.whole` and its `reviews.forQuiz`) only after
     `whenLoadedAndIdle` (`load`, then `requestIdleCallback` with `IdleWaitMs`). `whenRead`
     opens them at once. Tests: `tests/state/hunt-feed.test.ts`, *watchHunt, as the page loads*.
  8. **Notes**: `notes/vocabulary.md` (**org**, **orglabel**, **hunt**, **mode**),
     `notes/decisions/urls.md` (header, rule 4, Orgs, Hunt labels, Widgets, Raw record),
     `notes/hunt_git.md`, `notes/queries_hooks_and_subscriptions.md`.
* **Decisions taken**:
  - **A wrong org finds no hunt** (and says so: `noSuchHuntNotice`, "… in ~org."), rather than
    moving to the hunt's own: the org is now a namespace. During the widen period a hunt with no
    stored org still answers to its label under any org and moves to the org it is shown under,
    as before; so it also holds its label against every org for new hunts and relabels
    (conservative; ends at the backfill).
  - **Import, into a quiz already holding things**: questions merge as ever; widgetings add and
    revise, never remove (cells hold asked and typed values), run order stands; **columns are
    replaced** by the paste's (added, revised, reordered, missing ones removed) unless some pasted
    column would not read, and an empty or absent column list leaves the grid alone (older
    exports carry `columns: []`); title, smith's note, Q1 preamble replace where the paste holds
    one (null clears a note); sort memory only into a quiz that held no questions; **the lock is
    never read**. A column whose alignment the paste unsets is deleted and re-added, since no
    action unsets alignment.
  - **Deferred watches include the off-screen quiz's `reviews.forQuiz`**, not only
    `quizzes.whole`: same reason, and simpler.
  - **`.json` raw records are general in the address model** (any keyed kind), served by no page.
* **Deviations**: none of substance. `Addresses.orgOf` was removed outright rather than kept: the
  one fallback is `rows.orgFor`, marked in its doc block to go at the tighten.
* **Discoveries**:
  - `/convex-reviewer` (applied by hand to the diff): no critical or important findings. Notes:
    `hunts.open` stays `Unscoped`, now by org and label; `huntInOrg` queries the optional field
    with `eq('orglabel', undefined)`, which Convex and convex-test both support; the new index on
    `hunts` is small enough not to need `staged`.
  - A new quiz opens with five blank questions, so importing an export into it appends after them
    and does not carry the sort memory. Pre-existing; "nothing is ever deleted by an import".
* **For the Coach**:
  - **After merging, on production**: `migrations:runAll` (dry run first), then a tighten PR:
    `orglabel` required, `orgFor`'s fallback and `huntInOrg`'s unfiled branch dropped,
    `Backfilling` emptied. A hunt nobody is on is left unbackfilled and the tighten's push names
    it. `human/20261005-orglabel.md` has the steps.
  - Old links whose org was a hunt's earliest *smith* where that differs from its earliest
    *member* (a maker demoted or departed) now name the wrong org; after the backfill they find
    no hunt. Rare; say if you'd rather such links redirect.
