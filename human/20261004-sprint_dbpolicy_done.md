# 2026-10-04: Sprint dbpolicy done -- ten threads, ten PRs open, a deploy in order

* **The sprint.** A browser is a Convex Auth anonymous session that asserts a username; who is
  asking reaches every function as `ctx.actor`. Policy is pure functions in `src/lib/approve.ts`,
  dispatched by action kind and shared by server and browser; `convex/authorize.ts` gathers
  evidence in one parallel round from what the browser affirms, and a hunt's functions hold a
  database scoped to that hunt. Rows carry their `hunt_id` (and a few more copies); one `label`
  per row; reviewers are sent what a review needs (the answer included, shielded only in the view,
  as you ruled); the library is an admin's, on a mutation of its own. Plan, handoff and the
  finished threads' sections: `whiteboard/20261003-dbpolicy/`. Live mirror: the *Sprint dbpolicy*
  Claude Doc.
* **The PRs, each stacked on the one before** (land the top, #93, to take them all, or one at a
  time): #79 sessions and the actor (also carries the planning branch's five commits) <- #81
  `Approve` <- #82 one label and integrity repairs <- #83 denormalize <- #86 affirmations <- #88
  the scoped database <- #89 reads shaped by role <- #90 views ask `Approve` <- #92 the library
  behind an admin <- #93 tighten. **Deploying takes steps on production, in order**: the entry
  below this one.
* **Reviews**: every thread reviewed at medium; 2 `fix:` commits kept (#79 a sign-in retry, #82 a
  relabel the backfill would have undone), nothing flagged. Normal mode: no YOLO decisions.
* **Read a production export.** Thread 10 found `data/triquet-prod-20261004.zip` on disk and
  read it by script to check the tightened schema would take production's rows (no orphans; eight
  `forced_label` overrides fold without a clash). Nothing was imported and its extract was
  deleted. No rule forbade it, but say if agents should leave such files alone.
* **Open questions, gathered** (numbers are the plan's *For the Coach*; none blocks a merge):
  - **Deploy prerequisites** (1, 6): Convex Auth keys and clearing `identings` before #79;
    `migrations:runAll` after #83 and before #86; #93 last.
  - **Usernames** (2, 3): the first session to assert an existing username claims it; a session
    may hold more than one. **Session lifetime**: ten years, or a year unvisited (#79), so an
    anonymous session doesn't strand its username monthly. Clearing site data loses a username
    until there is a real sign-in. Each anonymous sign-in mints a `users` row: rate limiting is
    nearer than *Later*.
  - **The admin** (4): `Actor.isAdmin` approves every username, so anyone may change the library
    and see usage counts (#92). Give it a rule when ready; nothing else changes.
  - **What a reviewer is sent** (5): beyond the answer, the proposal as built; it lives in
    `Question.sentTo.reviewer`. **A widgeteds backstop** (9): a smith-only read rule in queries,
    one rule and a test.
  - **Import's `forced_label` key** (7): import still prefers a pasted one; drop it, or reserve
    the label for widgetings again.
  - **Idents through a hunt's scoped database** (8): readable, never writable, because
    `add_hunting` and `reviews.forQuiz` need them; the alternative is a copy on reviews.
    `reviews.forQuiz` still reads each reviewer's ident (not policy; a copy would end it).
  - **The browser dispatcher's refusal** (11): tells the author, as well as reporting a bug,
    because of the lock-under-a-draft race (#90). **`idents.current` sends a session its own
    `user_id`** (12).
  - **The e2e role** (10): threads 1 to 6 ran `pnpm test:e2e` on the shared `e2e` role; it may
    want a reset.
  - **`unicorn/prefer-combined-guards`** contradicts `notes/policy_approve.md`: disabled with a
    reason file-wide in `src/lib/approve.ts`, in `Review.isActiveOwner`, and on two lines of
    `convex/authorize.ts`. Switch it off for policy code in `eslint.config.mjs`?
  - **A smith re-adding themselves at their current role** is now refused `ownHunting` (was a
    silent no-op, #81).
  - **`CLAUDE.md`** still lists "the browser key" under `src/state/`; it is now the session
    (`use-session`).
  - **Polish not taken**: a change of standing re-asks the quiz's watches and shows *Opening…*
    for a round trip (#86, #90).
