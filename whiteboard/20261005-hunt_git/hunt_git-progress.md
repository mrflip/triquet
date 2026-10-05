# Hunt git: progress

Newer than `hunt_git-plan.md` wherever the two disagree. Each worker writes its own section to
`thread-<N>-<label>.md` beside this file.

## Status

| Thread | | Status |
|---|---|---|
| 0 | One address model | landed #121 |
| 1 | The URL scheme | landed #125 |
| 2 | Jsonballs, and Import and Export through them | landed #126 |
| 3 | A hunt's files | landing (lane 1) |
| 4 | Watches at the grain of the files | pending (after 3) |
| 5 | One repository per hunt | pending (after 4) |
| 6 | Downloads and the hunts page | pending (after 5 and 1) |

## What the threads have taught

*Orchestrator:* the PR numbers live in the status table above; a thread file's own "PR" line
can't be landed (it's known only after `pnpm land` pushes), so it may still say "pending".

### Thread 0: the address model (landed #121)

`src/lib/addresses.ts` (`Addresses`): `keypathOf` is the one source, and `urlOf`, `filepathOf`
and `locationFrom` follow from it. Its table of URLs, files and key paths is in
`thread-0-addresses.md`, *The table*: read it before naming a path or a key. Settled there:
`.tqh .tqq .tqc .tqm .tqr .tqw` pre-extensions; the hunt's own fields at the merged root
(`hunt.tqh.json`); the questions alone at `quizzes/<realm>/<quiz>/questions.qq.json`, outside
the `*.tq?.json` merge; reviews keyed by the reviewer's ident label; modes `edit` and `playtest`
only; a widget's URL keeps its scope (`/lib/widgets/pub/<label>`).

For thread 1:
* The org is `orgOf(members)`. `ShallowHuntT.members` has what it needs; `ListedHuntT` has no
  members, so the hunts list needs an `org` on `HuntListingT`, computed server-side in
  `hunts.list` from `membersOf`. That's a projection, not a schema change.
* **Open with the Coach:** whether the org is the earliest current smith (as built) or the
  earliest member whatever their role (the orchestrator's recommendation: a demotion would never
  move the address). Build on `orgOf` as it stands; it's one line to change.
* `hunting.ts` imports `Act` from `routes`: `smith` becomes `edit`, `review` becomes `playtest`.
* Review findings: `isLabel` checks no length, so the org slot may want `Identlabel`'s bounds;
  `orgFrom`/`modeFrom` don't decode, so confirm Next hands params unescaped.

For thread 2:
* A realm's own `title` and `position` can't sit under `quizzes.<realm>` beside quiz labels (a
  quiz could be labelled `title`). If realms get written at all, add a kind
  (`realms.<realm>`, say) to `Addresses`.
* The questions-alone file's exact shape (keyed with `position`, or a bare list the Import box
  takes) is thread 2's to settle.
* Review finding: `isMerged` is true for a widget, which merges into the library, not the hunt;
  fix the doc block's wording or the predicate.

For thread 3: `notes/decisions/urls.md` still writes the realm as `a` (Decision 1 says `home`).

*Review:* clean at medium, no fixes. Four minor findings, each handed on above.

### Thread 1: the URL scheme (landed #125)

Pages live under `src/app/(synced)/[org]/...`: `/~org`, `/~org/hunt`, `/~org/hunt/quizzes`,
`/~org/hunt/categories`, and `/~org/hunt/quizzes/<realm>/<quiz>[/!edit|/!playtest]`. A page reads
its address with `useAddressed` (`src/components/use-address.ts`, from `usePathname()`, never
Next's params); `useCanonical` moves every stale form (old `/h/`, `/c/`, `?act=`, a wrong org, a
stale realm, a relabelled quiz) to the current one. `/my/hunts` stays the landing page.

For thread 6 and anyone writing a link:
* **Write addresses only with `Routes.huntPath({ org, hunt })` and
  `Routes.quizPath({ org, hunt, realm, quiz }, mode)`.** Every hunt listing carries `org`
  (`HuntListingT.org`, made server-side by `orgFor(members)` in `rows.ts`).
* Modes replace acts: `Hunting.modeFor` (smith to `edit`, reviewer to `playtest`) and
  `Hunting.mayOpen` replace `actFor`/`mayAct`.
* e2e: `huntOf(page)` gives what `Routes.*Path` wants; `huntLabelOf(page)` alone no longer does.
* A bare quiz address moves everyone to `!playtest` (urls.md rule 4).

**Open with the Coach:** the org's derivation (earliest current smith, or earliest member); and
the bare address, which for a smith opens an empty, unshared `reviews` row on mount (one per
smith per quiz; never reaches the repo). If unwanted, the fix is `ReviewScreen` opening the
review on first write: a small change after this sprint.

*Review:* clean at medium, no fixes, no findings left.

### Thread 2: jsonballs, and Import and Export through them (landed #126)

`src/lib/jsonball.ts` owns the shapes, the placing at key paths, the merge (es-toolkit `merge`)
and the reading of anything pasted (`quizzesIn`, `widgetsIn`). `src/lib/exporting.ts` builds each
resource's ball as `{ address, ball }` (`PlacedBallT`), with `HuntSnapshotT`, `ballsOf`,
`wholeOf`, `libraryBall`, `snapshotOf`, `placeOf`. Raw Export is every ball merged; the Library
tab exports `{ widgets: { pub: { <label>: … } } }`. Import reads any ball or merge of balls, the
questions alone, a bare list, and every older export (fixtures in `fixtures/exports/`). **The
shapes as built are in `thread-2-jsonballs.md`, *The shapes*: they, not `notes/hunt_git.md`, are
what thread 3 writes.**

* Questions alone: `{ questions: { <label>: … } }`, the quiz's own value, pasting into any quiz.
* Realms are not written (every hunt holds only `home`); no `realms` kind in `Addresses`.
* A question's widget values sit beside its fields (`"dumdum": { status, value }`), so
  **`position` is now a reserved widgeting label** (`src/models/widgeting.ts`). The Coach decided
  to keep it and check production for a widgeting so labelled before #126 merges. `forced_label`
  and `id` still clash on re-import, as they always did.
* Import still ignores a pasted quiz's columns, title, note and lock (open with the Coach).

For thread 3:
* `Exporting.ballsOf(snapshot)` is `huntFiles` less the writing: each `PlacedBallT`'s address
  gives `Addresses.filepathOf`, the ball is the JSON. A TSV falls out of each ball's leaf: a keyed
  collection is a row per key (a `label` column from the key), a single record one row.
* `Exporting.placeOf` names the org `Addresses.orgOf(members) ?? ''`; #125's `orgFor`
  (`src/lib/rows.ts`) falls back on the earliest member. *Orchestrator:* use `orgFor`, so the
  files and the URLs never disagree.

For thread 4: `HuntSnapshotT` (with `ReviewSourceT`, `MemberSourceT`) is what the balls are made
from; a review's verdicts need the quiz's question ids to name questions by label.

*Review:* flagged at medium. Fixed: a fixture for the 2026-09-27 hunt-with-ids export shape.
Decided by the Coach: keep the `position` reservation, check production before merging. Left:
the `forced_label` re-import clash (pre-existing).
