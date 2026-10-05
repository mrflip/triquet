---
name: git-prep
description: Cut a worktree for a new thread from the spine's top. Use when the Coach invokes /git-prep <label>.
argument-hint: <branchlabel, or loose words>
---

Cut the ground for a thread labelled `$ARGUMENTS`. If no label was given, stop and say one is
needed; do not invent one.

1. Make the words a label: `node_modules/.bin/tsx scripts/newb-label.ts $ARGUMENTS` prints it
   (`20260928-Fix the  Grid.` gives `fix_the_grid`).
2. `pnpm worktree <label>`. It replays the spine onto `origin/main` if origin has moved, sweeps
   the Coach's notes, cuts `YYYYMMDD-<label>` from the top into a worktree with a lane of its
   own, and installs its packages (`notes/git_hygiene.md`, *Starting*).
3. Report what it printed: anything it replayed or swept, the worktree's root, the branch and
   what it was cut from, and the lane. Work on the thread happens from that root, with every
   absolute path built from it (CLAUDE.md, *Global resources*).

If it stops, report its message as it stands: a stop means the Coach's call, or a label to
change.
