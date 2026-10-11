# Thread 4: adopt_script (2026-10-11)

Branch `20261011-adopt_script`, PR filed at landing; see the report. Suites at `ready`: justify
green (typecheck, lint, 211 unit files, 6142 tests). No e2e yet: the thread touches `convex/` and
`src/models/`, so the landing's `--touched` reaches the whole suite.

* **Built**:
  - `convex/adopt.ts`: `adopt:plan` (an internal query: the dry run, which writes nothing) and
    `adopt:perform` (an internal mutation: the same plan, carried out in one transaction), both
    taking `AdoptionValidators.request` and answering `AdoptionValidators.outcome`
    (`src/models/adoption.ts`): the user as it stood, each change, and `kept` (how much was asked
    that it held already). The user is found by `user_id`, by `userlabel`, or by `email` through the
    `users.email` index; an email that no user, or more than one, has is refused, and the refusal
    names each user it found. Refusals are `ConvexError`s with words for the person at the command
    line.
  - Writes, beside thread 3's: `relabelUser` (`writing/user_actions.ts`: the userlabel and title,
    and the copies on every huntship of the user; no policy, no ghosting), and `grantHuntship`
    (`writing/huntship_actions.ts`: never lowers a role, refuses an anonymous user via
    `Approve.must('join_hunt')`, writes through thread 3's `placeOn`), over `Huntship.holdsAtLeast`
    (`src/models/huntship.ts`).
  - `scripts/adopt` (bash, which runs `tsx`) over `scripts/adopt.ts`, on `takeAim`: `--email` |
    `--holding <userlabel>` | `--id`; `--userlabel`, `--title`, `--admin` | `--no-admin`,
    `--smith`/`--reviewer <~org/hunt>` (repeatable), `--smith-all`, `--reviewer-all`. A dry run asks
    `adopt:plan`; with `--deployment` naming the deployment reached, it asks `adopt:perform`.
  - `convexRun`'s quiet failure now names what the function threw (`failureIn`,
    `scripts/convex-migrations.ts`): before, a refusal's words were lost after the CLI's first two
    lines.
  - Tests: `tests/convex/adopt.test.ts` (the Coach's step from a cleared production, idempotence,
    each finder and refusal, never lowering, the highest role asked, ghostings, relabels rewriting
    copies and leaving addresses), `tests/scripts/adopt.test.ts`, `tests/models/adoption.test.ts`,
    the new cases in `tests/convex/writing/{user,huntship}_actions.test.ts`, `tests/models/huntship.test.ts`
    and `tests/scripts/convex-migrations.test.ts`.
  - Notes: `notes/deploy.md`, *Adopting a user*, and step 5 of *Clearing production's people*
    with its two commands; `notes/security.md`; `notes/convex.md` (*Denormalized fields* names
    `relabelUser`); `notes/vocabulary.md` points at `scripts/adopt`.
* **Proved on lane 1's `agent` backend** (reset first): two users imported and a hunt made for each
  (`~mrflip/…`, `~pat_smith/…`), then `users` replaced so that `mrflip` was held by an address alone,
  with a Google user (`isAnonymous: false`, an email, no userlabel) in place of the Coach. The dry
  run named the user and four changes; `--deployment careful-otter-123` stopped with exit 1, having
  done nothing; the real run gave `mrflip`, admin, and smith of both hunts; a second run said
  "Nothing to change. Held already: 4 of what was asked."; an unknown email, an anonymous user
  made admin, a missing hunt, and a userlabel held by another user were each refused in words.
  The scratch script is outside the repo (`prove.sh` in the thread's scratchpad).
* **Decisions taken**:
  - **"Signed in with Google" reads `users.isAnonymous`** (`User.isAnonymous`), per the plan's YOLO
    decision 8. Thread 5 had not landed; at catch-up, switch to its predicate if it has one.
  - **The dry run is a query**, not the mutation with a flag: a query cannot write. Both share
    `planFor`, so they find and refuse the same way; `adopt:perform`'s answer equals `adopt:plan`'s
    (a test holds it to that).
  - **Clearing the flag needs no Google**, setting it does: `--no-admin` works on an anonymous user.
    A userlabel needs no Google either (the Coach's text asks Google only for the flag and grants).
  - **Relabelling a user that already holds a userlabel is allowed**: the pre-plan's step 4 lets
    the Coach sign in "with any handle or none". The old userlabel is not ghosted, since this is
    no merge: it becomes free unless a hunt's address holds it.
  - **`--title`** was added (the request's `title`), so a relabelled user is not stuck with the old
    userlabel's title; absent, the user's own title stands, or the userlabel titleized.
  - **`--smith-all` covers every hunt**, sandboxes of anonymous users included, as the text says.
    That puts the Coach on a stranger's sandbox, which sealing otherwise keeps empty of others.
    Production should hold none at adoption time, since the adoption follows the deploy at once.
  - **Grants to one hunt are merged**: several asked of one hunt give the highest role.
* **Deviations**:
  - **Pulled forward from thread 6**: `relabelUser` is the write (userlabel, title, huntship
    copies). Thread 6's settling mutation should call it and add its ghosting and choice, not
    write a second relabel.
  - **A shared helper changed**: `convexRun` (`scripts/convex-migrations.ts`), quiet mode only, now
    shows the `Uncaught …` line. `check_reserved` and `deploy.ts` get the clearer message too.
  - The test imports `../../scripts/adopt.ts` with its extension, because the bash wrapper
    `scripts/adopt` would otherwise be resolved first.
* **Discoveries**:
  - A plain `Error` thrown in a Convex function reaches `convex run` as "Server Error", with the
    words only on a later line. A `ConvexError`'s data reaches it on any deployment.
  - Iterator helpers (`map.values().map(…)`) run in the local backend's Convex runtime, and
    `unicorn` asks for them.
  - The guard's known gap stays (thread 2): pinning the deployment in `convexRun` would need the
    admin key, which the guard never sees. It matters only without a deploy key, which
    `prd_janitor` has.
  - `--smith-all` reads each hunt's huntships as it inserts (`placeOn`'s cap check). At the caps
    (999 hunts, 999 members each) that would pass a mutation's read limit and write nothing.
    Production is far from that.
* **For the Coach**:
  - **Who runs step 5.** The pre-plan says the orchestrator runs the adopt command on your word.
    The sprint plan says no agent touches production and running these commands is your step.
    `notes/deploy.md` is written for whoever runs it. Say which.
  - The email you signed in with must be on your `users` row, which thread 5's sign-in writes.
    Until thread 5 lands, `--email` finds nobody on a real deployment.
