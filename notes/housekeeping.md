# Housekeeping

Occasional chores, for when the clutter starts to annoy. None of this is part of a thread's
routine: that is `notes/git_hygiene.md`.

## Retiring stray branches

```
scripts/git-attic [--apply] [--against <ref>] [--retire <branch>]... [--no-prs]
```

Local branches pile up that `git branch --merged` cannot clear: a branch whose PR merged after a
rebase (its work reached `main` under other commits), a backup taken before a rebase, a draft of
a commit that landed reworded. `scripts/git-attic` finds them and retires each to a tag that says
what it was. It only reports what it would do until it is given `--apply`.

* `--apply` -- retire what the report lists.
* `--against <ref>` -- the history to judge by, `HEAD` unless given. Stand on (or name) a branch
  that holds `main`.
* `--retire <branch>` -- retire a branch whose work is not merged, once you have looked and
  decided to let it go. Repeat it for several.
* `--no-prs` -- don't ask GitHub which pull request each branch was. Otherwise `gh` is asked
  once, and its answer left out of the tags if it cannot be had.

Every local branch is one of:

* **In history** -- its tip is in the history it is judged by: on the line `HEAD` stands on, or
  in a pull request merged into it. Left alone.
* **Merged** -- off that history, but each of its commits is in it, either as the same change
  (`git cherry`) or under the same subject line. Retired.
* **Unmerged** -- a commit with no match. Reported with those commits, and left alone until you
  name it with `--retire`.

A branch checked out in any worktree is never retired, and the report says so.

**Retiring** makes an annotated tag `attic/<branch>` at the branch's tip, then deletes the
branch. The tag's message names the pull request (when `gh` knows it), the tip, and how many of
the branch's commits matched by change and how many by subject, listing those, and for a branch
let go with `--retire`, the commits that matched nothing. Read one with `git tag -n20
attic/<branch>`. If `attic/<branch>` already exists at the same commit (another checkout retired
the branch first, and its tag was fetched), the branch is just deleted; if that tag names another
commit, the new one is `attic/<branch>-<short hash>`.

It never touches a remote: nothing is pushed, and no remote branch is deleted.

**Publishing the attic.** The tags stay local until pushed:
`git push origin 'refs/tags/attic/*'`. In another checkout, `git fetch origin --tags` brings
them. A plain fetch does not: it follows only the tags that point at commits it is already
fetching, and an attic tag points at a commit no branch holds any more.

## Finding the session that owns a branch

```
pnpm sessions [<branch label | branch name | PR number>]... [--rename | --table | --json] [--projects <dir>] [--all-projects]
```

A branch or a pull request is left hanging, and the question is which session, among the ones in
the sidebar, was working on it. `pnpm sessions --table userlabel 116` reads the transcripts Claude
Code keeps (`~/.claude/projects/<project>/<session>.jsonl`, with a sprint's workers under
`<session>/subagents/`) and lists the sessions that bear on each, strongest first, under the title
the sidebar shows. A branch is given by its label (`userlabel`) or its whole name
(`20261005-userlabel`); a PR by its number (`116` or `#116`).

Three ways to print:

* `--rename`, the default, prints the `/rename` that names a session for what it did: the PRs it
  linked, then ` | `, the title it had, then ` | ` and the worktrees it cut, the PRs and the
  worktrees each in the order it first met them.

  ```
  /rename #93 #97 #149 | PR merge and deploy order | e2e_practices git_attic landing_flow session_branches
  ```

  The branches come last because they are the least certain part (below), and a name cut at 250
  characters loses them first. The title has nothing wrapped round it. A session that has no PR
  starts its name with the pipe, and one that has no worktree ends after its title.

  Run inside a session with nothing asked, it names that session (`$CLAUDE_CODE_SESSION_ID`), and
  the line is ready to paste. Run anywhere else, or asked a branch or PR, it names every session it
  finds, a line each. A session already named this way gives back only its title, the middle
  part, so naming it twice does not stack the names; a title in any other shape (an older format,
  a title with pipes of its own) is kept whole, for a person to tidy. No dates or times go in. A
  session that has cut no worktree and linked no PR has nothing to be named for and is left out.
* `--table` prints a table: asked nothing, every session newest first with its PRs and worktrees;
  asked a branch or PR, the evidence for each, below.
* `--json` prints all of it.

What counts as evidence, strongest first:

* `titled` -- the session's title names it. The one evidence a person gives on purpose: see
  *Naming a session*, below.
* `PR linked` -- the session opened or worked on that PR. Claude Code records the link.
* `worktree` -- it ran `pnpm worktree <label>`, or its commands or its workers' went into
  a worktree of that label.
* `checkout Nx` -- N lines of the transcript had its working directory on that branch. Weak: the
  main checkout is switched onto each branch that lands, so a session that never touched the
  branch can show it.
* `mentioned Nx` -- N lines name it. The weakest, and it counts the lines the other evidence
  is on too. The session you ask from always mentions what you asked.

A worktree here is any label the session's transcript names as one, including the ones `git
worktree list` printed for it: a session that only looked at another thread's worktree shows it
too. Trim the name before pasting it.

A sprint's workers are subagents of the orchestrator's session, so a thread's branch ties to the
session that ran the sprint, not to a session of its own. That is why a worker cannot rename
"its" session to its branch, and why the sprint's title is the one to look for.

**What it cannot see.** Only transcripts on the machine it runs on. A sandbox container has its
own `~/.claude`, and so does each checkout of yours: run it in each. A sidebar session that runs
on another machine has its transcript there, and nothing here finds it. `--projects <dir>` points
the script at a copy. It reads the projects whose directory names contain `triquet` (every
worktree's cwd gets a directory of its own); `--all-projects` reads them all. The eight characters
in the `session` column are the start of the session's id, which is not the short code the
sidebar's agent list shows in brackets: match on the title.

**Naming a session.** `pnpm worktree` and `pnpm newb` have the agent offer `/rename <branch>` when
a thread starts. A session that has done more than one thing wants more: run `pnpm sessions` in it
and paste what it prints. The script reads a new title the next time it runs, so
`pnpm sessions --table userlabel` then lists that session first. The title must hold the label or
the branch's whole name as a word of its own: a hyphen or an underscore in front of it hides it
(`my-userlabel`), and `userlabel` after a space or the datestamp is found. An agent cannot rename
its own session: no tool sets a session's title. It can say who it is, `echo
$CLAUDE_CODE_SESSION_ID`, which is the full id the `--json` output carries.

## Stale worktrees

`git worktree list` marks a worktree whose directory is gone as *prunable*, and its branch stays
checked out there, so nothing will retire or delete it. `git worktree prune` clears the stale
entries.

## Remotes you cannot reach

`feat`, `home` and `meta` point at `../../triquet-{feat,home,meta}/triquet`: checkouts in the
Coach's other containers, not visible from inside this one. A fetch from them fails here and
their remote-tracking refs look stale. They are not clutter: never remove or prune them.
