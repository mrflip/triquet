# Thread 11: oauth_tidy (2026-10-13)

Branch `20261013-oauth_tidy`, PR filed at landing; see the report. Cut from the spine's top
(`d957d1e3`, over thread 10's #242). Suites at `ready`: justify green (typecheck, lint, 220 unit
files, 6405 tests). No e2e yet: the thread touches `convex/`, `src/models/` and a dependency
patch, so the landing's `--touched` reaches the whole suite. Pushed once to lane 1's `agent`
backend: it took the functions and the patched bundle, and `convex/_generated/` did not change.

* **Built** (each struck from `whiteboard/TODO.md`, *From oauth sprint, thread 9*, in its commit):
  - **One row to test for an address.** `anyHuntInOrg(db, orglabel)` in `convex/reading.ts`
    (`.first()` on `by_orglabel_and_label`). `holderOfUserlabel` asks it in place of
    `huntsCountedInOrg` (up to `HuntsPerOrg.max` rows), and so does thread 10's `leftBehind` in
    `convex/adopt.ts`. `huntsCountedInOrg` stays for `newHunt`'s count against `HuntsPerOrg` (`hunt_actions.ts`).
  - **One copy loop, one stale rule.** `Huntship.isStale(huntship, { userlabel, title })` in
    `src/models/huntship.ts`; `recopyOntoHuntships(db, user_id, labelled)` in
    `convex/writing/user_actions.ts`, which `retitleUser` and `rewriteUserlabel` both call;
    `adopt`'s `relabelFor` counts its stale huntships by `Huntship.isStale`.
  - **`auth:offered` asks nobody who is asking.** `zPlainQuery` in `convex/functions.ts`: a public
    query on `InOurWords` (the error map, no `actor` or `user_id`), for a read of the deployment
    alone. `notes/convex.md`, *Who is asking*, names it. No such wrapper existed before, though the
    plan's text supposed one did; `auth:offered` stays in `Unscoped`.
  - **`UserlabelGate`'s `name` is `title`** (and `nameDraft` is `titleDraft`): the user's title,
    as typed into "Your name".
  - **The patch deletes a dying code's verifier in one function.** `verifyCodeAndSignIn.js`
    exports `deleteVerifierOf` (whose `keep` argument no caller used: it was there for this), and
    `userOAuth.js` imports it in place of its own copy, passing its own verifier as `keep`. No
    change in behaviour: `user_actions.test.ts`'s replaced-code test (the first verifier deleted,
    the later one kept, `[1, 1]` verifiers and codes after the second callback) passes unchanged.
    `notes/stack.md`, item 3 of the patch, says so. The lockfile's patch hash changes with it.
  - **From thread 10's review:** `relabelFor` refuses an anonymous user a userlabel that only a
    hunt's address holds (any address, `~X/X` among them), as the front door's
    `assumeUserlabel` already does. Cheap: `holderOfUserlabel` already says `'address'` there.
    One test (an old hunt's address, and a sandbox-shaped one); `notes/deploy.md` (*What it keeps
    to*) and `notes/security.md` (thread 10's struck item) say so.
* **Decisions taken**:
  - **The new reader returns the row (`Doc<'hunts'> | null`), not a boolean**, like its
    neighbours (`huntInOrg`, `huntForLabel`); both callers test it for presence.
  - **A retitle now rewrites any stale copy**, not only a stale title: the shared loop writes
    both fields where either differs. Only a copy whose userlabel drifted from its user's would
    see the difference, and nothing writes one (`expectSound` would fail on it).
  - **`retitleUser` still patches its user only when the title changes**, rather than calling
    `rewriteUserlabel` whole, which patches the user always (and the triggers would stamp it).
  - **The refusal is wider than the reviewer's case**: any address-held userlabel, not only one
    whose `~X/X` exists. An anonymous user can be put on no hunt (`adopt` refuses grants to one),
    so such a userlabel could only make it seem to own hunts it is not on.
* **Deviations**: none from the plan's list. The commit for `UserlabelGate` is `fix:`, as the log
  has no `refactor:`.
* **Discoveries**:
  - `notes/convex.md` named no plain query wrapper, so this thread made one rather than build on
    Convex's raw `query`, which nothing outside `functions.ts` imports.
  - `pnpm patch --edit-dir <scratch>` then `pnpm patch-commit <scratch>` re-cuts the patch and
    reinstalls; the per-worktree `node_modules` takes the new copy, other worktrees keep theirs.
