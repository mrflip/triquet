# Thread 8: Three more reserved forms, and a guard over every label (2026-10-14)

Branch `20261014-reserved_guard`, PR filed at landing; see the report. Suites: justify green
(typecheck, lint, 6539 unit tests); `pnpm e2e:smoke` 32/32 while building; `pnpm e2e --touched` at
landing. The review's two findings, both decided by the Coach, are built in the commits after
`f50bc7d6`: a user's email and phone left out of every page, and the deploy order written down.
Thread 8b (branch `20261014-guard_fields`, landed into this PR) leaves out the rest of Google's
profile and the verification times too, at the Coach's word.

This closes open questions 6 and 7 of `human/20261014-sprint_auth_todos_done.md` (the guard covered
the top-level list only; `bot`, `tests`, `demos` stayed free). That file is left as written.

* **Built**:
  - `bot` (in *voices*, beside `bots`), `tests` and `demos` (in *trials*, beside `test` and `demo`)
    join `PA.ReservedToplevelGroups`. Whole words only. Pinned in `tests/lib/vv/patterns.test.ts`
    (each word, and the near misses `bot_fan`, `tester_ann` and `metas`, all free) and
    `tests/lib/labelmaker.test.ts` (kept from a hunt's label or a userlabel, from no other label).
  - **The guard reads every row.** `check_reserved:held` is replaced by `check_reserved:page`
    (`convex/check_reserved.ts`). It is an internal query that answers one page (100 rows) of any table
    of ours, and null for Convex Auth's tables or a table the deployment lacks. The script
    (`scripts/check-reserved.ts`) loops over every table and every page. It judges each row with
    the checkout's own row validator (`RowValidators[table].safeParse(row, { reportInput: true })`),
    and names each refused value by the hunt or quiz address its row sits under, the table, the
    row (label, userlabel or id), the field path, the value and the validator's message. Hunts
    whose own label the top-level list keeps from new ones are still listed apart, as standing
    (once: a hunt already refused, by its org say, is not listed again).
  - `RowValidators` is now exported by `convex/schema.ts`, typed `satisfies Record<keyof typeof
    ourTables, RowValidator>`. A table added without a row validator fails the typecheck.
    `tests/convex/schema.test.ts` uses this export instead of keeping its own copy.
  - `convexRun` (`scripts/convex-migrations.ts`) now keeps up to 64 MiB of a run's output. A
    spawn's default is 1 MiB, and one page of rows could pass that.
  - Docs: `PA.ReservedLabelGroups` and `PA.ReservedToplevelGroups` doc blocks, the
    `scripts/check_reserved` header, `notes/deploy.md` (*Checking the reserved list against
    production*, rewritten for both lists), `notes/security.md` (the 2026-10-11 thread 8 entry:
    the second waiver, and what the new query hands out), `notes/vocabulary.md` (the label entry).
  - Tests: `tests/scripts/check-reserved.test.ts` (paging, a short page, placing, judging, the
    lines, aiming) and `tests/convex/check_reserved.test.ts`. The convex tests seed a hunt with a
    classic-layout quiz, a recorded cell, a reviewer, a ghosting and the library, and check that
    the guard refuses **no row the app wrote**. Then they patch in base and top-level words across
    hunts, widgetings (label and a param's name), questions and ghostings, and check that each is
    named in the right place.

* **Decisions taken**:
  - **Judge whole rows, not a list of fields.** The plan asked to find the labelled fields from the
    validators. Labels sit in shapes no walker over schemas would find reliably: a column's
    `source` is a `str.refine` that calls `CK.label` inside; a widgeting's params are a record
    keyed by `labelAllowing(FormularyParamnames)`; a widgeting's label has its own namespace
    refinement. So the guard parses each row whole with its row validator and lets Zod report the
    path. That judges each label exactly as it is judged when written, with no field list kept by
    hand. The table list comes from `RowValidators`, which the typecheck holds to the schema.
  - It therefore reports **any** refusal, not only reserved words: a branch that tightens any row
    validator gets the same warning. The doc blocks and `deploy.md` say so. To check that this
    adds no noise, I ran it over a backend filled by the e2e smoke run (671 rows across all 16
    tables, from real app flows): nothing refused.
  - **Whole rows travel to the machine running it**, in memory only, but for how to reach the
    person behind a user and what Google says of them, which the query leaves out (`Unsent` in
    `convex/check_reserved.ts`): `email`, `phone`, `emailVerificationTime`,
    `phoneVerificationTime`, `name`, `image`, `locale` and `hosted_domain`. The Coach's calls after review, defence in depth: "Strip them"
    (email and phone), then "Yes leave those fields out too" (the rest, 2026-10-14, thread 8b).
    Each is optional in `UserValidators.row`, and none is held to a label's words, so no verdict
    on a label is lost; a test checks both, and that a page's user rows carry none of them while
    a reserved userlabel is still named. (The reviewer's third field, the Google profile's
    `email`, is no row field: it is the sign-in's, written to `users.email`.) Projecting out only
    the labelled fields would need the field walker above, run on the deployment's older code.
    The query refuses Convex Auth's tables, so no token or secret leaves. Written into
    `notes/security.md` and `notes/deploy.md`.
  - *Thread 8b*: `title` stays. The worker first stripped it too, under the handoff's "any other
    users field no validator label-checks"; on review the orchestrator put it back. It is the one
    such field with a real check (`titleish`, shared by every title in the app), so stripping it
    would cost the guard its warning on a tightened `titleish`, and it is shown to other users
    already (`UserFaceT`). What a user's row still sends: `userlabel`, `title`, `isAnonymous`,
    `admin`, `provisional`, `merged` (two ids) and the stamps. No other table holds a person's
    contact or profile.
  - **No byte limit on a page.** `paginate`'s `maximumBytesRead` can hand back a page that is
    short of rows (`SplitRequired`), which is exactly the silent truncation the plan warns against.
    So pages are 100 rows. A page that reads past Convex's own limit fails loudly, and the script
    also stops on a `SplitRequired` page.
  - Considered and set aside: `npx convex data <table> --limit` (no cursor, so it truncates) and
    `npx convex export` (the whole database written to a zip on disk). The query and loop are
    about 40 lines.
  - The query decides the page size; the caller only passes `table` and `cursor`. The paginated
    query does not take a `paginationOpts` argument.

* **Deviations**: the report's shape and wording changed. Lines are now `<address>  <table> <row>
  <field> <value>: <reason>`, and the old split between "holders" and "hunts" is gone. Nothing but
  the tests read it.

* **Discoveries**:
  - Running the guard (from this branch) against this lane's own backends, with the Coach's waiver
    covering production: on the `agent` role (`--seed`), 24 library widgets and nothing refused. On
    the `e2e` role after `pnpm e2e:smoke`, 671 rows and nothing refused. As a demonstration I
    briefly added `home` and `clueing` to the base list (not committed). The guard named all 38
    `home` realms and 38 `clueing` columns, each at its quiz's address. It left the 38 columns
    whose *source* is `clueing` alone, correctly, because a source resolves `clueing` as a
    question's field, not as a label.
  - No handle, hunt label or fixture in `e2e/`, `tests/`, `fixtures/` or `convex/seeding.ts` is
    `bot`, `tests` or `demos`. `bot` is three letters, so it only ever affects hunt labels.
  - For the TODO's *Figure out reserved words vs our own use of them* (`categories`, `title`): the
    guard can now say what reserving one of those would lock. Every widgeting of the library's
    category-estimate widget is labelled `categories`, so the guard would name all of them.
  - A question's label never changes, and neither does a hunt's org. A base-list word that either
    one holds therefore stays off the list (or needs a migration). Hunts, quizzes, columns and
    widgetings can be relabelled in the app first. `deploy.md` says so.

* **For the Coach**: this release cannot be checked by the guard before it deploys. The guard
  reads through `check_reserved:page`, which production gets only with this stack (main has only
  `refused`), so running it against production first fails with "Could not find function". Your
  thread-7 waiver ("the db is mostly empty right now") covers this one deploy, and with it `bot`,
  `tests` and `demos` (your decision after review). Once deployed,
  `./scripts/doppledo prd_janitor scripts/check_reserved` checks production as it stands and
  guards every later release. If it names a user, org or label among the new words, that row is
  locked until it moves (thread 2's rule). `notes/deploy.md` records this bootstrap.
