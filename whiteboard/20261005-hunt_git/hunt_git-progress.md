# Hunt git: progress

Newer than `hunt_git-plan.md` wherever the two disagree. Each worker writes its own section to
`thread-<N>-<label>.md` beside this file.

## Status

| Thread | | Status |
|---|---|---|
| 0 | One address model | landed #121 |
| 1 | The URL scheme | landed #125 |
| 2 | Jsonballs, and Import and Export through them | in review (lane 2) |
| 3 | A hunt's files | pending (after 2) |
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
