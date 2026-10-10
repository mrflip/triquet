# Columnwise: updating Convex in production

For the Coach: what to run, and in what order, for the columnwise sprint's changes to production's
Convex. Every command runs from the main checkout's root (`cd /workspace/triquet`), and reaches
production only through `./scripts/doppledo prd_janitor`. Background is in `notes/deploy.md`.

## Where things stand (2026-10-09, end of the sprint)

* **Merged and deployed: #191 through #201.** #193 (`Serial Deploy: columnwise`, the widening)
  built alone at 19:34 UTC on 10-08, and every build since has succeeded.
* **So some checks below come after the fact.** The reserved-word check (#196) and the `regex`
  check (#198) were meant for before those deploys. Run them now to find any row already stuck.
* **Open, in merge order: #202, #206, #209, #211, #215.** Steps 4 to 7 take them in turn. #215 is
  a second serial deploy (`bagshape`). #195 and #210 are not this sprint's; #210 interacts with
  #211 (step 6).

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
checks the current list. Run it from the main checkout as it stands (the spine's top), so it
knows every word this sprint reserved. It prints six sections, each `none` or a list of
`table _id label: what`.

| Section | What to do with a hit |
| --- | --- |
| **1. Reserved labels and usernames** | Relabel it. You can relabel a question, column, widget or widgeting in the app. A hunt, realm or quiz under a reserved word **cannot be opened**, and a reserved username cannot sign in again. **Don't hand-edit those in the dashboard**, because copies of a label live in other rows (`hunts.orglabel`, `huntings.ident_label`). Tell me which rows, and I'll have a proper fix written. |
| **2. `regex` params or config** | Expect none. A hit was written before recheck checked patterns: open that widgeting or widget in the app and save it again, which runs the check, or remove the pattern. |
| **3. Formulas or templates naming `categories`** | Look at each one. #193 renamed the `categories` entry to `category_data` but rewrote no formulas, so a formula reading `qn.categories` now reads nothing: change it to `qn.category_data`. A hit that only mentions the word in passing can stay. |
| **4. `*_exp` Liquid filters** | Rewrite each one **before merging thread 9's PR**, or its template stops filling in. Use the twin filter: `qns \| where_exp: "qn", "qn.recap != blank"` becomes `qns \| where: "recap"`. This check covers every table, including templateable question text. |
| **5. Rows 3a's backfills have not rewritten** | Must be none before 3c merges. If there are any, go back to step 1, then export and check again. Covers widgets and widgetings still labelled `categories` or `category`. |
| **6. Quiz-tier widgetings labelled as a quiz field** (`locked`, `templateable`, `recap_head` and the rest) | Must be none before #215 merges: relabel each in the app. Section 1 covers #215's other new words (`hunt_label`, `realm_label`, `question_label`, `question`, `questions`). |

## 4. Merge 5b (#202) and 9 (#206)

* **#202, thread 5b** (run order and preview): an ordinary PR with no migration. Merge it
  whenever.
* **#206, thread 9** (compute budgets): no migration, but section 4 above must be empty first. If
  the export is more than a few hours old, export and check again just before merging. See
  `human/20261009-cw_budgets.md` for the full list of places a stored template lives. After it
  deploys, a tab opened before the deploy can't sort until it's reloaded.

## 5. Merge 3c (#209), the tightening

Its PR body says `Tightens Serial Deploy: columnwise`. Merge it only when:

1. step 1 shows `[]` (`migrations:outstanding`), and
2. section 5 of a fresh export is `none`.

**The schema push will not catch a missed column.** Convex stores a column's `source` as a plain
string, so an old-grammar source passes the push. That row then refuses every later edit. Section
5 is the real gate. If the push does fail on some other row, production keeps serving the widened
version safely: run step 1 again, then redeploy `main` from Vercel. No seed run is needed.

## 6. Merge #211 (optimistic updates)

No migration. **Mind #210** (`20261009-convex_reads`, your thread): it sends `questions.open`'s
cells keyed by widgeting id rather than label. Whichever of #210 and #211 merges second needs
`src/state/optimistic-quiz.ts` re-keyed to ids (`enteredInto`, and a widgeting relabel's
re-keying). Until then, `tests/state/optimistic-quiz.test.ts` fails, which CI will show.

## 7. Merge #215 (one bag shape, `Serial Deploy: bagshape`)

Before merging: run section 6 and section 1 over a fresh export, from the main checkout as it
stands. Expect none in either.

After merging, **wait for its production build log to say `Backfills: every one has finished.`**
before merging anything stacked above it. Its six `bagshape` backfills rewrite production's
stored formulas and templates (`qn` becomes `question`, `qns` becomes `questions`, keyed by label),
including the seeded butnot and ish widgets, so nothing needs pasting by hand. There is no schema
change, so no tightening follows. To check by hand:

```sh
./scripts/doppledo prd_janitor npx convex run migrations:outstanding
```

Then:
* Every hunt's git files change once, on its first write after the deploy.
* What the rewrite cannot reach is listed in `human/20261009-cw_bag.md`: `.err` reads, positional
  reads like `qns.first`, `{% tablerow %}` and `{% liquid %}` loops over `qns`, and a `qn` inside
  a JSONata regex literal.
* Production's seeded `category_data` and `blurb` widgets keep `qn.` in their descriptions. Edit
  them in the widget editor if you like.

## Also

* **Local servers:** the kill incident (`human/20261009-sprint_columnwise_kill_incident.md`) took
  down any `pnpm dev` or e2e servers you had running in the main checkout. Restart them as usual.
* **Rehearsing on a copy** (optional, before 3c): `notes/deploy.md`, *Rehearse a backfill on a
  copy first*, explains how to import this export into a local role and push the tightening to it.
