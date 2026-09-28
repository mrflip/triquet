# THIS DOCUMENT IS **FROM** AGENTS **TO** COACHES
It does not represent authoritative decisions: it is a conversational scratchpad. Agents should not use this as input, but are encouraged to write to it.
Agents: add at the top of the document, add a level two header;  Put the date before your title, following the examples seen here:

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