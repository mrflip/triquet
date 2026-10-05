# 2026-10-04: Sessions replace the browser key (dbpolicy thread 1, PR #79)

* **Before it deploys**, production (and the defaults for preview deployments) needs Convex Auth's
  `JWT_PRIVATE_KEY`, `JWKS` and `SITE_URL`, a key pair minted for it alone; then clear
  `identings` by hand, merge, and run `migrations:backfillIdentClaims`. The steps are in
  `notes/deploy.md`, *Sessions*. Without the keys nobody can sign in, so nobody can get past the
  username box.
* **A username now belongs to the browser that claimed it.** Existing idents are unclaimed, and
  the first browser to type one takes it: that is how people get theirs back, and how someone else
  could get there first. A browser that clears its site data loses its username until there is a
  sign-in. Another browser typing a held username is told to choose another, or to create an
  account on the device it was claimed from (which cannot be done yet).
* **Session lifetime is a choice I made**: ten years, or a year unvisited (`convex/auth.ts`).
  Convex Auth's default ends every session after thirty days, which would strand everyone's
  username monthly. Say if you want something else.
* **`CLAUDE.md`** still lists "the browser key" among `src/state/`'s contents; it should say "the
  session (`use-session`)". Left for you, since agents don't edit it on an agent's word.
* **Thread 10** should also tighten `idents.user_id`, which the plan's list leaves out.
