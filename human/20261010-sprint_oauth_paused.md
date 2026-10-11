# 2026-10-10: Sprint oauth paused at the plan

The Coach asked for plan only. Nothing is built, and no worktree or branch is cut.

* **Where it stands.** `whiteboard/20261010-oauth/` holds three files, swept onto
  `20261010-swept_notes` (cut from `origin/main` at `a9a35002`; not pushed):
  - `google-oauth-keys.md`: the keys guide, the Coach's item 1;
  - `oauth-plan.md`: three threads;
  - `oauth-progress.md`.

  The same three files are mirrored at
  https://claude.ai/code/artifact/89643f81-3e20-48c4-9cde-ef9268d7a1c6.
* **The spine was restacked first.** The old spine (`20261009-stable_rows`, through #218) had
  merged under new SHAs. With the Coach's word, the main checkout went back on `main` at
  `origin/main`.
* **Client-first holds.** No server function, no Next middleware, no new Convex feature. New
  are two deployment env vars, and one table if thread 2 takes the hand-off. The only step toward
  the server is the keys guide's optional Vercel rewrite (path C), which no thread takes.
* **Open for the Coach.**
  1. Thread 2's mechanism: one-time hand-off, Google required for usernames, or a `pnpm patch`.
     Convex Auth, stable and v2 alpha alike, has no anonymous-to-OAuth upgrade; the evidence is
     in `oauth-progress.md`.
  2. Whether thread 3 (a privacy page) is wanted.
  3. Whether bring-your-own-key asking becomes a thread 4.
