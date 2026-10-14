# Thread 7: Five more top-level reserved words (2026-10-13)

Branch `20261013-more_reserved`, PR filed at landing; see the report. Suites: justify green
(typecheck, lint, 6494 unit tests); `pnpm e2e --touched` at landing. Review: clean.

* **Built**:
  - `bots`, `test`, `demo`, `sync` and `meta` join `PA.ReservedToplevelGroups`
    (`src/lib/vv/patterns.ts`): `sync` in `app` (the app's own corners: a sync of the quiz's
    repository is one it may serve), `bots` in `voices` (beside `claude` and `anthropic`: the bot
    reviewers speaking), and two new groups, each with its why: `trials` (`test`, `demo`: what the
    app's own trial runs and showpieces are called) and `craft` (`meta`: the craft's word for a
    quiz's second layer, a corner the app may one day serve). Whole words only, no prefixes:
    `test_kitchen`, `meta_hunt` and `bot_fan` stay free.
  - Pinned: `tests/lib/labelmaker.test.ts` keeps the five from a hunt's label or a userlabel, and
    from no other label (a question may still be labelled `test`); `tests/lib/vv/patterns.test.ts`
    has a case for each word and three near misses.
  - Notes: `notes/vocabulary.md` (the label paragraph names the trials and `meta`) and
    `notes/security.md` (the 2026-10-11 thread 8 entry says the guard's run against production was
    waived once, for these five).

* **Decisions taken**:
  - **The guard against production is waived by the Coach** ("the db is mostly empty right now",
    2026-10-13). `scripts/check_reserved` ran against this lane's own agent backend instead
    (`./scripts/doppledo dev_claude scripts/convex_dev agent --seed scripts/check_reserved`): a fresh
    backend, 0 users, 0 ghostings, 0 hunts, nothing named. That proves only that the script runs over
    the grown list; it says nothing of production.
  - **Only the five named.** Not added: `bot` (three letters, so a hunt label only), and the
    other numbers (`tests`, `demos`, `metas`). The Coach's call if wanted.
  - New groups rather than stretching `app` or `pages`: neither `test`/`demo` nor `meta` is a page
    a site calls itself, and each group's doc comment is its reason.

* **Discoveries**:
  - No test data, fixture or seed holds any of the five as a handle or hunt label (`e2e/`, `tests/`,
    `fixtures/`, `convex/seeding.ts` searched, prefixed forms too): nothing to change. Specs mint
    their labels (`adjective_animal`) or type longer handles.
  - `fixtures/exports/hunt-2026-09-27.json` holds a hunt labelled `home`, already a top-level word:
    harmless, since a hunt's own label is checked only when made (an older export, by design).

* **For the Coach**: if production holds a user or org named `bots`, `test`, `demo`, `sync` or
  `meta` after all, deploying this locks it out (thread 2's rule); `./scripts/doppledo prd_janitor
  scripts/check_reserved` from this branch before deploying settles it in a second.
