# 2026-10-05: Sprint little_fixes done -- two rounds; one PR open, #116

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

## Round two (your answers to round one, then two more asks)

* **Merged** (you merged #113, which carried #110 and #111 beneath it; close #110 and #111, whose
  SHAs your rebase changed):
  - **Thread 5, column alignment (#110):** an alignment mark per column in the column editor,
    cycling left/center/right; an optional `align` on the column row (a widen, no migration);
    unset, Q# is centered and the rest keep thread 3's rules.
  - **Thread 4, name and username (#111):** the name takes anything and becomes the title; the
    username beside it follows `Ident.labelFor(name)` until typed in, follows again once cleared,
    and is red when it can't become a username; `MembersPanel` uses the same check; "6 characters".
  - **Thread 6, reviews in worktrees (#113):** the reviewer never runs `/code-review --fix` (the
    skill stands in the main checkout), reviews explicit SHAs or by hand; *stage before you
    sweep*; `restack` prunes (you resolved it against your `c9f204b`).
* **Open:** **#116**, thread 7 -- `PA.Userlabel` (renamed from `PA.Identlabel`, no alias), and
  `Labelmaker.normalize` takes a pattern's bag (uses `max`; drops `re`, `min`, `msg`), so a long
  digit-first name makes 24 characters, not 25. Follows #113; carries the sprint's docs sweep.
* **Ruled:** Enter in a cleared username field: wontfix (recorded on #111).
* **Open questions** (none blocking):
  - Thread 5: an unset column's mark shows its header's side, not its values'; no way back to
    unset once clicked (#110).
  - Thread 4: the members field is strict now ("Flip Kromer" is red, not `flip_kromer`); a short
    name turns the username red once the name field is left (#111).
  - Thread 6: `restack` silently skips a spine branch origin deleted unmerged; the reviewer
    guidance says the main checkout is on the thread's base, which a parallel sprint may not be
    (#113). Still open: the sweep's trim bug (`human/20261005-spine_sweep_trims_status.md`), and
    a working-directory option for `/code-review`, worth asking upstream.
* **Process lessons, for the next sprint:** land one thread at a time (two e2e suites at once
  drove the load to 50 and timed specs out; every red landing passed unchanged once it fell);
  set a worker's thread-file PR line before `pnpm land` (a landed worktree goes detached).
