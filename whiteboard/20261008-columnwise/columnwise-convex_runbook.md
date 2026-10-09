# Columnwise: updating Convex in production

For the Coach: what to run, and in what order, for the columnwise sprint's changes to production's
Convex. Every command runs from the main checkout's root (`cd /workspace/triquet`), and reaches
production only through `./scripts/doppledo prd_janitor`. Background is in `notes/deploy.md`.

## Where things stand (2026-10-09, 02:30 UTC)

* **Merged and deployed: #191 through #201.** Production built `ec3184a` (#201) at 01:21 UTC.
  #193 (`Serial Deploy: columnwise`, the widening) built alone at 19:34 UTC on 10-08, and every
  build since has succeeded.
* **So the checks below come after the fact.** The reserved-word check (#196) and the `regex` check
  (#198) were meant for before those deploys. Run them now to find any row that is already stuck.
* **Still to come:** thread 5b's PR and thread 9's PR, which have no migration but need one check
  first (step 4), then thread 3c's PR, the tightening, which goes last (step 5). #195 is unrelated
  spine tooling.

## 1. Check that 3a's backfills finished

```sh
./scripts/doppledo prd_janitor npx convex run migrations:outstanding
```

Expect `[]`. Anything else names a backfill that is still running or that stopped. Start them
again, wait a minute, and check once more:

```sh
./scripts/doppledo prd_janitor npx convex run migrations:runAll
./scripts/doppledo prd_janitor npx convex run migrations:outstanding
```

`/stats`, viewed as an admin, shows the same thing.

## 2. Seed the widget library

This is why you see no entry widgets yet:

```sh
./scripts/doppledo prd_janitor npx convex run seeding:seedWidgets
```

It adds `memo`, `figure`, `yes_no` and `choice` (the entry families, #196) and `blurb` (the
`liquidize` formulary, #201), and lists what it added. It inserts only what is absent, so running
it again adds nothing.

## 3. Export production and run the checks

Keep the export outside the repo, since it is production's data:

```sh
mkdir -p ~/prd-exports
./scripts/doppledo prd_janitor npx convex export --path ~/prd-exports/20261009.zip
unzip -q ~/prd-exports/20261009.zip -d ~/prd-exports/20261009
npx tsx whiteboard/20261008-columnwise/prd_checks.mts ~/prd-exports/20261009
```

The export only reads production; it also leaves a snapshot in the dashboard that you can restore
from. `prd_checks.mts` (beside this file) reads the unzipped export and writes nothing. It takes the
reserved words from the code itself (`src/lib/vv/patterns.ts`, `ReservedWidgetingLabels`), so it
checks the current list. It prints five sections, each `none` or a list of
`table _id label: what`.

| Section | What to do with a hit |
| --- | --- |
| **1. Reserved labels and usernames** | Relabel it. You can relabel a question, column, widget or widgeting in the app. A hunt, realm or quiz under a reserved word **cannot be opened**, and a reserved username cannot sign in again. **Don't hand-edit those in the dashboard**, because copies of a label live in other rows (`hunts.orglabel`, `huntings.ident_label`). Tell me which rows, and I'll have a proper fix written. |
| **2. `regex` params or config** | Expect none. A hit was written before recheck checked patterns: open that widgeting or widget in the app and save it again, which runs the check, or remove the pattern. |
| **3. Formulas or templates naming `categories`** | Look at each one. #193 renamed the `categories` entry to `category_data` but rewrote no formulas, so a formula reading `qn.categories` now reads nothing: change it to `qn.category_data`. A hit that only mentions the word in passing can stay. |
| **4. `*_exp` Liquid filters** | Rewrite each one **before merging thread 9's PR**, or its template stops filling in. Use the twin filter: `qns \| where_exp: "qn", "qn.recap != blank"` becomes `qns \| where: "recap"`. This check covers every table, including templateable question text. |
| **5. Rows 3a's backfills have not rewritten** | Must be none before 3c merges. If there are any, go back to step 1, then export and check again. |

## 4. Merge 5b and 9 (when their PRs are filed)

* **Thread 5b** (run order and preview): an ordinary PR with no migration. Merge it whenever.
* **Thread 9** (compute budgets): no migration, but section 4 above must be empty first. If the
  export is more than a few hours old, export and check again just before merging. See
  `human/20261009-cw_budgets.md` for the full list of places a stored template lives.

## 5. Merge 3c, the tightening, last

Its PR body says `Tightens Serial Deploy: columnwise`. Merge it only when:

1. step 1 shows `[]` (`migrations:outstanding`), and
2. section 5 of a fresh export is `none`.

Its push checks every row against the tightened schema. If a row doesn't fit, the build fails and
production keeps serving the widened version, safely. In that case, run step 1 again, then redeploy
`main` from Vercel; the push lands once every row fits. Step 5 here and the PR body will list
anything else 3c needs, such as a seed run if it adds widgets.

## Also

* **Local servers:** the kill incident (`human/20261009-sprint_columnwise_kill_incident.md`) took
  down any `pnpm dev` or e2e servers you had running in the main checkout. Restart them as usual.
* **Rehearsing on a copy** (optional, before 3c): `notes/deploy.md`, *Rehearse a backfill on a
  copy first*, explains how to import this export into a local role and push the tightening to it.
