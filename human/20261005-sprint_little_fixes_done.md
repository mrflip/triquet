# 2026-10-05: Sprint little_fixes done -- two PRs open on top of #99

* **The sprint.** The ident gate says who you will log in as and offers to keep being who you
  are; the hunts page lines up in a table with a 🤔 on every quiz still being worked on; the quiz
  grid sets values by type (only JSON monospace), lines its text up, folds a row to one line, and
  its widgets panel lines up with a plain status sentence (`5 current • 1 errored • 11 blank`)
  that gives way as the panel narrows. Plan, handoff and screenshots before and after every
  change: `whiteboard/20261004-little_fixes/`. Live mirror: the *Sprint little_fixes* Claude Doc.
* **Landed already**: threads 1 and 2, which you merged as #99 (#96 closed with it).
* **Open, in order** -- land #108 to take both, or one at a time:
  1. **#105** -- thread 1b, your follow-up on the gate: own name becomes "Keep being"; too short
     waits for blur, a bad character is red at once. Follows #99.
  2. **#108** -- thread 3, quiz mode. Stacked on #105.
* **Reviews**: thread 1 kept one fix (the cancel now waits while a log-in is in flight);
  threads 2, 1b and 3 came back clean. Thread 2 was reviewed after it merged; its comment is on
  #105.
* **Open questions** (none blocking; each also in its PR and the progress document):
  - Should apostrophes and dots in a typed username turn red (now) or pass quietly as
    underscores (before)? One character in `PA.Identtyped`. (#105)
  - Q# is now right-aligned like every number, under a left "Q#" header; blank dashes in number
    columns still sit left. Keep, or centre Q#? (#108)
  - The hunts page folds its Quizzes column under 720px, and the sigil sits inside the quiz's
    link: both taste calls. Narrow, a hunt with no quizzes gets an empty padded row. (#99)
  - Small leftovers: `usernameLength` says "6 letters and numbers" though underscores count;
    `MembersPanel` could use `Ident.flawIn`; `statusLine` is tested but no view calls it.
* **Housekeeping**: the sprint ran in the worktree `.claude/worktrees/little_fixes`, whose
  `data/convex-{agent,e2e,e2e-agent}` are symlinks to the main checkout's; the main checkout was
  left detached at f1faad6. The agent backend was emptied once (main's `q1_preamble` refused
  its old rows) and now holds demo idents `hunt_shooter` and `grid_shooter_*`.
