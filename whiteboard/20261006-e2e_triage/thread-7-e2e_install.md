# Thread 7: A checkout that moves onto a new dependency installs it (2026-10-07)

Branch `20261007-e2e_install`. PR filed at landing; see the report. Suites: `pnpm justify` green
(4855 unit tests); e2e at landing (see below).

* **Built** (`scripts/spine.ts`, `tests/scripts/spine.test.ts`, `notes/git_hygiene.md`)
  * **proper-lockfile is imported lazily**, by `await import('proper-lockfile')` at the top of
    `takeE2eLock`. Every other command (`top`, `sweep`, `worktree`, `catchup`, `justify`, `proof`,
    `land`, a rerun or chosen specs) now runs in a checkout with no packages at all.
  * **Install on move.** `installedSince(root, before)` compares git's hash of `pnpm-lock.yaml` at
    the commit a checkout stood on with the one it stands on now, and runs `pnpm install
    --frozen-lockfile --prefer-offline` there only when they differ, saying so in one line
    (`pnpm-lock.yaml changed when <root> moved onto <sha>: installed its packages there.`). It is
    called wherever the spine moves a checkout:
    * `restack()`, for the main checkout, so every replay is covered: `pnpm restack`, and the
      restack inside `worktree`, `catchup` and `land`;
    * `land`, for the main checkout after the fold-in, and for the worktree right after the bid's
      rebase, before the fresh proof read and the checks;
    * `catchUp`, for the worktree after its rebase (and so the catch-up after an e2e-lock wait).
  * **Failure.** In a worktree a failed install stops (the rebase stands; the message says to
    repair and `pnpm install`). In the main checkout the move stands whatever happens, so
    `mainInstalledSince` says the failure ("tell the Coach, whose checkout it is") and stops nothing:
    a landing still pushes.
  * **`TRIQUET_INSTALL`** replaces the install command, as `TRIQUET_JUSTIFY` and the others do; the
    new worktree's install in `cutWorktree` goes through it too (`installs(root)`).
  * **Tests**, under "installing on a move": a bid installing in the main checkout and a catch-up in
    a worktree; a bid installing in the worktree it rebased, before its checks (the checks pass only
    if it did), and not again in the main checkout; a restack's fast-forward installing; a move that
    leaves the lockfile alone installing nothing, though the branch changes its own; a failed install
    stopping a catch-up and not a landing; and the spine's three scripts copied where no package is,
    running six commands green while a full `e2e` fails naming proper-lockfile. That last test fails
    against the static import (checked).
  * **Note**: `notes/git_hygiene.md`, *The spine* (the main checkout's `node_modules` is derived
    state, installed under the hold as part of the move) and *Finishing* B.
* **Decisions taken**
  * **Compare commits, not the install.** "Changed" means the lockfile's blob differs between the
    commit before the move and the commit after. A checkout whose packages already lag, with no move,
    is not caught: `pnpm install` by hand. Reading pnpm's `node_modules/.pnpm/lock.yaml` would catch
    it, but that file is pnpm's internals, not a promise.
  * **The main checkout installs under the hold**, so two spine commands never install there at once,
    and its files and its packages move together.
* **Deviations**
  * **`sweep` installs nothing.** The plan listed it; it commits only `whiteboard/`, `human/` and
    `notes/` and switches branch only at the same commit, so it never moves a checkout onto another
    lockfile.
* **Review** (`clean`, no commits). Left open, minor:
  * After a failed install, the next catch-up or bid finds nothing to rebase, so it installs
    nothing and its checks run on the old packages. This follows from comparing commits; the
    failure's message says to `pnpm install` by hand.
  * A failed worktree install in `catchUp` drops the restack's lines, the autostash "tell the
    Coach" warning among them, as a rebase conflict there already does.
* **For the Coach**
  * **e2e is run, not skipped, at landing.** `scripts/spine.ts` is in git_hygiene's "a script the
    suite runs through" list, so *When e2e is not worth running* does not allow `--skip-e2e`, though
    no spec exercises these paths.
  * **An install in the main checkout swaps `node_modules` under a running `pnpm dev` there**, as the
    landing already swaps its files. If that bites, the remedy is restarting the server.
