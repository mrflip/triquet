/**
 * The spine: the one stack of landed branches, checked out in the main checkout at its top. Agents
 * cut their worktrees from the top and land onto it, and the Coach watches it and merges it
 * (`notes/git_hygiene.md`, *The spine*).
 *
 *   node scripts/spine.ts worktree <label> [--no-install]   a worktree for a new thread, cut from the top
 *   node scripts/spine.ts worktree --remove                 this worktree, removed and its lane freed: it must be clean
 *   node scripts/spine.ts land                              this worktree's branch, rebased onto the top, proved, folded in and pushed
 *   node scripts/spine.ts sweep                             the main checkout's whiteboard/, human/ and notes/, committed onto the top
 *   node scripts/spine.ts restack                           the spine, replayed onto origin/main if origin has moved, and pushed
 *   node scripts/spine.ts top                               the top's branch
 *
 * `pnpm worktree`, `pnpm land`, `pnpm sweep` and `pnpm restack` spell them shorter. Worktrees live under
 * TQ_WORKTREES (`~/worktrees/triquet`). Landing proves a branch with TRIQUET_LAND_CHECKS
 * (`pnpm typecheck && pnpm lint && pnpm test`) and then TRIQUET_LAND_E2E (`pnpm test:e2e`), each
 * a shell command.
 */
import { execFileSync, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

/** The main checkout's directories whose uncommitted files any sweep commits onto the top */
export const SweptDirs = ['whiteboard', 'human', 'notes'] as const

/** Times a landing goes back to its rebase because the top moved, before it gives up */
export const MaxAttempts = 5

/** How long to wait for another checkout's hold on the spine before giving up */
const LockWaitMs = 10 * 60 * 1000

const Usage = 'Usage: node scripts/spine.ts worktree <label> [--no-install] | worktree --remove | land | sweep | restack | top'

/** A stop that needs the agent or the Coach: its message says what happened and what to do */
export class SpineStop extends Error {}

/** The top of the spine: the branch the main checkout stands on, and its commit */
export interface Top {
  branch: string
  sha:    string
}

/** Runs git in `cwd` and hands back what it printed; a failure throws with what git said */
function git(cwd: string, ...args: string[]): string {
  // eslint-disable-next-line sonarjs/no-os-command-from-path -- the installed git, whichever it is, is the one keeping these checkouts
  const ran = spawnSync('git', args, { cwd, encoding: 'utf8' })
  if (ran.status !== 0) { throw new Error(`git ${args.join(' ')}: ${(ran.stderr || ran.stdout).trim()}`) }
  return ran.stdout.trim()
}

/** Whether git, run in `cwd`, succeeds */
function gitOk(cwd: string, ...args: string[]): boolean {
  // eslint-disable-next-line sonarjs/no-os-command-from-path -- as in git() above
  return spawnSync('git', args, { cwd, encoding: 'utf8' }).status === 0
}

/** git push, borrowing gh's login for the one push (`notes/git_hygiene.md`, *Filing the PR*) */
const PushArgs = ['-c', 'credential.helper=', '-c', 'credential.helper=!gh auth git-credential', 'push', '--quiet']

/**
 * The main checkout's root, from `git worktree list --porcelain`, which lists it first.
 *
 * @example mainCheckoutOf('worktree /workspace/triquet\nHEAD 1a2b\nbranch refs/heads/x\n\nworktree /home/node/worktrees/triquet/y\n')  // => '/workspace/triquet'
 */
export function mainCheckoutOf(porcelain: string): string {
  const line = porcelain.split('\n').find((row) => row.startsWith('worktree '))
  if (line === undefined) { throw new Error('git worktree list named no checkout') }
  return line.slice('worktree '.length)
}

/**
 * The paths `git status --porcelain -z` names: both of a rename's or a copy's.
 *
 * @example pathsOfStatus('?? whiteboard/a.md\0R  notes/new.md\0notes/old.md\0')  // => ['whiteboard/a.md', 'notes/new.md', 'notes/old.md']
 */
export function pathsOfStatus(porcelain: string): string[] {
  const entries = porcelain.split('\0').filter(Boolean)
  const paths: string[] = []
  for (let idx = 0; idx < entries.length; idx++) {
    const entry = entries[idx] ?? ''
    paths.push(entry.slice(3))
    if (!/^[RC]/.test(entry)) {
      continue
    }

    idx += 1
    paths.push(entries[idx] ?? '')
  }
  return paths
}

/**
 * Whether `label` may name a thread's branch: lowercase letters, digits and single underscores,
 * starting with a letter, as `scripts/newb` has it.
 *
 * @example isLabel('grid_fix')  // => true
 * @example isLabel('Grid-Fix')  // => false
 */
export function isLabel(label: string): boolean {
  return /^[a-z](_?[a-z0-9])+$/.test(label)
}

/** Today as `YYYYMMDD`, local time, as branch names lead */
function datestamp(): string {
  const now = new Date()
  return [now.getFullYear(), now.getMonth() + 1, now.getDate()].map((part) => String(part).padStart(2, '0')).join('')
}

/** Where agents' worktrees live */
function worktreesHome(): string {
  return process.env.TQ_WORKTREES ?? path.join(os.homedir(), 'worktrees', 'triquet')
}

/** Waits `ms`, blocking: the waits here are for another process, with nothing else to do meanwhile */
function pause(ms: number): void {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)
}

/** Whether the process `pid` is still running */
function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch (err) {
    return (err as NodeJS.ErrnoException).code === 'EPERM'
  }
}

/**
 * Runs `act` holding the spine: one `mkdir` in the repository's shared git directory, so only one
 * checkout sweeps, restacks or folds in at a time. Waits while another holds it, and takes over a
 * hold whose process is gone.
 */
export function withSpineHeld<TT>(commondir: string, purpose: string, act: () => TT): TT {
  const lockdir = path.join(commondir, 'triquet-spine.lock')
  const deadline = Date.now() + LockWaitMs
  for (;;) {
    try {
      fs.mkdirSync(lockdir)
      fs.writeFileSync(path.join(lockdir, 'holder'), JSON.stringify({ pid: process.pid, purpose, since: new Date().toISOString() }))
      break
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'EEXIST') { throw err }
    }
    const holder = holderOf(lockdir)
    if (holder !== undefined && ! isAlive(holder.pid)) {
      fs.rmSync(lockdir, { recursive: true, force: true })
      continue
    }
    if (Date.now() > deadline) { throw new SpineStop(`The spine has been held for ten minutes (${lockdir}: ${holder?.purpose ?? 'by no one saying why'}).`) }
    pause(1000)
  }
  try {
    return act()
  } finally {
    fs.rmSync(lockdir, { recursive: true, force: true })
  }
}

/** Who holds the spine, or undefined while the holder is still writing its name */
function holderOf(lockdir: string): { pid: number, purpose: string } | undefined {
  try {
    return JSON.parse(fs.readFileSync(path.join(lockdir, 'holder'), 'utf8')) as { pid: number, purpose: string }
  } catch {
    return undefined
  }
}

/** The checkout at `cwd`: its root, the main checkout's, and the repository's shared git directory */
function checkoutAt(cwd: string): { root: string, main: string, commondir: string } {
  return {
    root:      git(cwd, 'rev-parse', '--show-toplevel'),
    main:      mainCheckoutOf(git(cwd, 'worktree', 'list', '--porcelain')),
    commondir: git(cwd, 'rev-parse', '--path-format=absolute', '--git-common-dir'),
  }
}

/** The top of the spine, where the main checkout stands */
export function topOf(main: string): Top {
  if (! gitOk(main, 'symbolic-ref', '--quiet', 'HEAD')) { throw new SpineStop(`The main checkout (${main}) is not on a branch: the spine has no top until it stands on one.`) }
  return { branch: git(main, 'symbolic-ref', '--short', 'HEAD'), sha: git(main, 'rev-parse', 'HEAD') }
}

/** What git is in the middle of in the checkout at `root`, or undefined */
function busyIn(root: string): string | undefined {
  const gitdir = git(root, 'rev-parse', '--absolute-git-dir')
  const markers = ['rebase-merge', 'rebase-apply', 'MERGE_HEAD', 'CHERRY_PICK_HEAD', 'REVERT_HEAD', 'BISECT_LOG']
  return markers.find((marker) => fs.existsSync(path.join(gitdir, marker)))
}

/** Stops if the main checkout is in the middle of something: that is the Coach's, to finish */
function refuseBusy(main: string): void {
  const busy = busyIn(main)
  if (busy !== undefined) { throw new SpineStop(`The main checkout is in the middle of something (${busy}): the Coach's to finish before anything lands.`) }
}

/**
 * Replays the spine onto `origin/main` when origin has moved past it, as it does once the Coach
 * merges, and pushes every spine branch origin has, each with an explicit lease. The Coach's
 * uncommitted edits are autostashed; a conflict undoes the replay and stops.
 *
 * @returns Lines saying what was done, empty when the spine was already on `origin/main`.
 */
export function restack(main: string): string[] {
  git(main, 'fetch', '--quiet', 'origin')
  const top = topOf(main)
  if (gitOk(main, 'merge-base', '--is-ancestor', 'origin/main', top.sha)) { return [] }
  if (top.branch === 'main') {
    git(main, 'merge', '--quiet', '--ff-only', '--autostash', 'origin/main')
    return ['The main checkout stood on main: fast-forwarded it to origin/main.']
  }
  const spine = git(main, 'for-each-ref', '--format=%(refname:short)', '--merged', top.sha, '--no-merged', 'origin/main', 'refs/heads/').split('\n').filter(Boolean)
  const leases = spine.filter((branch) => gitOk(main, 'rev-parse', '--verify', '--quiet', `refs/remotes/origin/${branch}`))
    .map((branch) => [branch, git(main, 'rev-parse', `refs/remotes/origin/${branch}`)] as const)
  const stashesBefore = git(main, 'stash', 'list').split('\n').filter(Boolean).length
  try {
    git(main, 'rebase', '--quiet', '--update-refs', '--autostash', 'origin/main')
  } catch (err) {
    gitOk(main, 'rebase', '--abort')
    throw new SpineStop(`Replaying the spine onto origin/main conflicted, and was undone: the Coach's call.\n${(err as Error).message}`)
  }
  const stashed = git(main, 'stash', 'list').split('\n').filter(Boolean).length > stashesBefore
  for (const [branch, sha] of leases) {
    git(main, ...PushArgs, `--force-with-lease=${branch}:${sha}`, 'origin', branch)
  }
  return [
    `Replayed the spine (${spine.join(', ')}) onto origin/main.`,
    ...(stashed ? ['The Coach\'s uncommitted edits did not go back cleanly after the replay: they are kept in `git stash list`. Tell the Coach.'] : []),
    ...(leases.length > 0 ? [`Pushed ${leases.map(([branch]) => branch).join(', ')}.`] : []),
  ]
}

/**
 * Commits whatever is uncommitted in the main checkout's swept directories onto the top, so a
 * stray file there comes along rather than stalling anyone. Standing on `main`, it cuts a branch
 * for the commit first: the spine's top is never `main` itself.
 *
 * @returns The paths committed, empty when there was nothing to sweep.
 */
export function sweep(main: string): string[] {
  const paths = pathsOfStatus(git(main, 'status', '--porcelain', '-z', '--untracked-files=all', '--', ...SweptDirs))
  if (paths.length === 0) { return [] }
  if (topOf(main).branch === 'main') {
    const taken = (branch: string) => gitOk(main, 'rev-parse', '--verify', '--quiet', `refs/heads/${branch}`)
    const base = `${datestamp()}-swept_notes`
    const branch = [base, ...[2, 3, 4, 5, 6, 7, 8, 9].map((idx) => `${base}${String(idx)}`)].find((name) => ! taken(name)) ?? `${base}_${String(Date.now())}`
    git(main, 'switch', '--quiet', '--create', branch)
  }
  git(main, 'add', '--all', '--', ...paths)
  git(main, 'commit', '--quiet', '--message', 'docs: swept from the main checkout', '--', ...paths)
  return paths
}

/**
 * A worktree for a new thread, cut from the top of the spine (replayed onto `origin/main` and
 * swept first), with a lane of its own and its packages installed.
 *
 * @returns Lines saying where it is and what it holds.
 */
export function cutWorktree(cwd: string, label: string, opts: { install: boolean }): string[] {
  if (! isLabel(label)) { throw new SpineStop(`"${label}" is not a label: lowercase letters, digits and single underscores, starting with a letter.`) }
  const { main, commondir } = checkoutAt(cwd)
  const branch = `${datestamp()}-${label}`
  if (gitOk(main, 'rev-parse', '--verify', '--quiet', `refs/heads/${branch}`)) { throw new SpineStop(`The branch ${branch} exists already: choose another label.`) }
  const root = path.join(worktreesHome(), label)
  if (fs.existsSync(root)) { throw new SpineStop(`${root} exists already: choose another label, or remove that worktree.`) }
  const { top, notes } = withSpineHeld(commondir, `cutting ${branch}`, () => {
    refuseBusy(main)
    const said = [...restack(main), ...sweptNotes(sweep(main))]
    const stood = topOf(main)
    fs.mkdirSync(path.dirname(root), { recursive: true })
    git(main, 'worktree', 'add', '--quiet', '-b', branch, root, stood.sha)
    return { top: stood, notes: said }
  })
  git(root, 'config', `branch.${branch}.spinebase`, top.sha)
  git(root, 'config', `branch.${branch}.remote`, 'origin')
  git(root, 'config', `branch.${branch}.merge`, `refs/heads/${branch}`)
  // eslint-disable-next-line sonarjs/no-os-command-from-path -- the node running this script, whichever it is
  const lane = execFileSync('node', [path.join(root, 'scripts', 'lanes.ts'), 'lane'], { cwd: root, encoding: 'utf8' }).trim()
  if (opts.install) {
    // eslint-disable-next-line sonarjs/no-os-command-from-path -- the pnpm this checkout already runs
    const installed = spawnSync('pnpm', ['install', '--frozen-lockfile', '--prefer-offline'], { cwd: root, stdio: 'inherit' })
    if (installed.status !== 0) { throw new SpineStop(`pnpm install failed in ${root}; the worktree stands, on lane ${lane}.`) }
  }
  return [...notes, `Worktree: ${root}`, `Branch:   ${branch}, cut from ${top.branch} at ${top.sha.slice(0, 8)}`, `Lane:     ${lane}`]
}

/** Lines saying what a sweep committed */
function sweptNotes(paths: readonly string[]): string[] {
  return paths.length === 0 ? [] : [`Swept from the main checkout: ${paths.join(', ')}.`]
}

/**
 * Removes the worktree at `cwd` and frees its lane. Refuses while it holds anything uncommitted:
 * that would be lost.
 */
export function removeWorktree(cwd: string): string[] {
  const { root, main } = checkoutAt(cwd)
  if (root === main) { throw new SpineStop('This is the main checkout, not a worktree.') }
  const busy = busyIn(root)
  if (busy !== undefined) { throw new SpineStop(`This worktree is in the middle of something (${busy}): finish or abort it first.`) }
  const dirty = pathsOfStatus(git(root, 'status', '--porcelain', '-z', '--untracked-files=all'))
  if (dirty.length > 0) { throw new SpineStop(`This worktree holds uncommitted files, which removing it would lose: ${dirty.join(', ')}. Commit them, or move them, first.`) }
  // eslint-disable-next-line sonarjs/no-os-command-from-path -- the node running this script, whichever it is
  const freed = execFileSync('node', [path.join(root, 'scripts', 'lanes.ts'), 'release'], { cwd: root, encoding: 'utf8' }).trim()
  git(main, 'worktree', 'remove', '--force', root)
  return [`Removed ${root}. ${freed}`]
}

/**
 * Settles a rebase landing started: once `branch` holds the commit it was being rebased onto,
 * that commit is its base from now on, and an abandoned rebase leaves the old base standing.
 */
function settleRebase(root: string, branch: string): void {
  if (! gitOk(root, 'config', `branch.${branch}.spinebase-pending`)) { return }
  const pending = git(root, 'config', `branch.${branch}.spinebase-pending`)
  if (gitOk(root, 'merge-base', '--is-ancestor', pending, branch)) { git(root, 'config', `branch.${branch}.spinebase`, pending) }
  git(root, 'config', '--unset', `branch.${branch}.spinebase-pending`)
}

/** The commit `branch` was last rebased onto, as recorded at its cut and after each rebase; else where it meets the top */
function spinebaseOf(root: string, branch: string, top: Top): string {
  settleRebase(root, branch)
  if (gitOk(root, 'config', `branch.${branch}.spinebase`)) { return git(root, 'config', `branch.${branch}.spinebase`) }
  return git(root, 'merge-base', branch, top.sha)
}

/** Whether the shell command `command` succeeds in `root`, its output shown as it runs */
function passes(root: string, command: string): boolean {
  // eslint-disable-next-line sonarjs/no-os-command-from-path -- the system shell runs the checks as a person would
  return spawnSync('sh', ['-c', command], { cwd: root, stdio: 'inherit' }).status === 0
}

/** Whether the top has moved since `top` */
function hasMoved(main: string, top: Top): boolean {
  const now = topOf(main)
  return now.branch !== top.branch || now.sha !== top.sha
}

/**
 * Lands the worktree's branch on the spine. Under the hold, replays the spine onto `origin/main`
 * if it has moved and sweeps the main checkout; then rebases the branch onto the top, runs the
 * checks, and goes back to the rebase if the top has moved meanwhile; then e2e. Last, under the
 * hold again and only if the top is still where it was, switches the main checkout onto the
 * branch and pushes it. Any stop leaves the spine as it was.
 *
 * @returns Lines saying what landed, on what.
 */
export function land(cwd: string): string[] {
  const { root, main, commondir } = checkoutAt(cwd)
  if (root === main) { throw new SpineStop('Landing happens from a worktree; the main checkout is the spine itself.') }
  if (! gitOk(root, 'symbolic-ref', '--quiet', 'HEAD')) { throw new SpineStop('This worktree is not on a branch: switch to your thread\'s branch first.') }
  const branch = git(root, 'symbolic-ref', '--short', 'HEAD')
  const busy = busyIn(root)
  if (busy !== undefined) { throw new SpineStop(`This worktree is in the middle of something (${busy}): finish it (git rebase --continue) or abort it, then land again.`) }
  if (git(root, 'status', '--porcelain', '--untracked-files=all') !== '') { throw new SpineStop('This worktree holds uncommitted changes: commit them, then land.') }
  const checks = process.env.TRIQUET_LAND_CHECKS ?? 'pnpm typecheck && pnpm lint && pnpm test'
  const e2e = process.env.TRIQUET_LAND_E2E ?? 'pnpm test:e2e'
  const notes: string[] = []
  for (let attempt = 1; attempt <= MaxAttempts; attempt++) {
    const top = withSpineHeld(commondir, `landing ${branch}`, () => {
      refuseBusy(main)
      notes.push(...restack(main), ...sweptNotes(sweep(main)))
      return topOf(main)
    })
    const base = spinebaseOf(root, branch, top)
    git(root, 'config', `branch.${branch}.spinebase-pending`, top.sha)
    try {
      git(root, 'rebase', '--quiet', '--onto', top.sha, base, branch)
    } catch (err) {
      throw new SpineStop([
        `Rebasing ${branch} onto ${top.branch} conflicted; the spine is untouched.`,
        'Repair what notes/git_hygiene.md calls straightforward, `git rebase --continue`, and land again;',
        'otherwise `git rebase --abort` and report.',
        (err as Error).message,
      ].join('\n'))
    }
    settleRebase(root, branch)
    if (! passes(root, checks)) { throw new SpineStop(`The checks failed on ${branch}, rebased onto ${top.branch}: fix, commit, and land again. The spine is untouched.`) }
    if (hasMoved(main, top)) {
      notes.push(`The top moved during the checks: rebasing again (attempt ${String(attempt + 1)}).`)
      continue
    }
    if (! passes(root, e2e)) { throw new SpineStop(`The e2e suite failed on ${branch}, rebased onto ${top.branch}: fix, commit, and land again. The spine is untouched.`) }
    const folded = withSpineHeld(commondir, `folding in ${branch}`, () => {
      if (hasMoved(main, top)) { return false }
      refuseBusy(main)
      foldIn(root, main, branch)
      return true
    })
    if (folded) {
      return [...notes, ...pushed(main, branch), `Landed ${branch} on ${top.branch}: the main checkout stands on it now. File its PR (stacked on ${top.branch}'s), then remove this worktree.`]
    }
    notes.push(`The top moved during e2e: rebasing again (attempt ${String(attempt + 1)}).`)
  }
  throw new SpineStop(`The top moved ${String(MaxAttempts)} times while ${branch} was landing: the spine is too busy. Land again shortly, or report.`)
}

/** Switches the main checkout onto `branch`, freeing it from the worktree first; a refusal puts the worktree back and stops */
function foldIn(root: string, main: string, branch: string): void {
  git(root, 'switch', '--quiet', '--detach')
  try {
    git(main, 'switch', '--quiet', branch)
  } catch (err) {
    git(root, 'switch', '--quiet', branch)
    throw new SpineStop(`The main checkout would not switch onto ${branch}, so nothing landed: the Coach's uncommitted edits stand in the way. Tell them which.\n${(err as Error).message}`)
  }
}

/** Pushes `branch`, which origin has never had or has only as this branch's earlier push; a failure is reported, the landing stands */
function pushed(main: string, branch: string): string[] {
  const remote = `refs/remotes/origin/${branch}`
  const leased = gitOk(main, 'rev-parse', '--verify', '--quiet', remote) ? git(main, 'rev-parse', remote) : ''
  try {
    git(main, ...PushArgs, '--set-upstream', `--force-with-lease=${branch}:${leased}`, 'origin', branch)
    return [`Pushed ${branch}.`]
  } catch (err) {
    return [`Pushing ${branch} failed, though it has landed: push it by hand. ${(err as Error).message}`]
  }
}

/** What the command line asks for, done, as the lines to print */
function main(args: readonly string[]): string[] {
  const [command, ...rest] = args
  const cwd = process.cwd()
  switch (command) {
  case 'worktree': {
    if (rest[0] === '--remove') { return removeWorktree(cwd) }
    const label = rest.find((arg) => ! arg.startsWith('--'))
    if (label === undefined) { throw new SpineStop(Usage) }
    return cutWorktree(cwd, label, { install: ! rest.includes('--no-install') })
  }
  case 'land': {
    return land(cwd)
  }
  case 'sweep': {
    const { main: mainroot, commondir } = checkoutAt(cwd)
    const paths = withSpineHeld(commondir, 'sweeping', () => sweep(mainroot))
    return paths.length === 0 ? ['Nothing to sweep.'] : sweptNotes(paths)
  }
  case 'restack': {
    const { main: mainroot, commondir } = checkoutAt(cwd)
    const notes = withSpineHeld(commondir, 'restacking', () => {
      refuseBusy(mainroot)
      return restack(mainroot)
    })
    return notes.length === 0 ? ['The spine already stands on origin/main.'] : notes
  }
  case 'top': {
    return [topOf(checkoutAt(cwd).main).branch]
  }
  default: {
    throw new SpineStop(Usage)
  }
  }
}

if (import.meta.main) {
  try {
    process.stdout.write(`${main(process.argv.slice(2)).join('\n')}\n`)
  } catch (err) {
    console.error(err instanceof Error ? err.message : err)
    process.exitCode = 1
  }
}
