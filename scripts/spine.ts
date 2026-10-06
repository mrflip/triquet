/**
 * The spine: the one stack of landed branches, checked out in the main checkout at its top. Agents
 * cut their worktrees from the top, prove their branches there, and bid to land them on it; the
 * Coach watches it and merges it (`notes/git_hygiene.md`, *The spine* and *Finishing*).
 *
 *   node scripts/spine.ts worktree <label> [--no-install]   a worktree for a new thread, cut from the top, its e2e build cache seeded
 *   node scripts/spine.ts worktree --remove                 this worktree, removed and its lane freed: it must be clean
 *   node scripts/spine.ts catchup                           this worktree's branch, rebased onto the top
 *   node scripts/spine.ts justify                           typecheck, lint and the unit tests, side by side; green, the branch's patch-id recorded
 *   node scripts/spine.ts e2e [<playwright args>]           the e2e suite, logged; the branch's proof recorded once every spec of a full run has passed
 *   node scripts/spine.ts e2e-log                           the e2e log, summarised
 *   node scripts/spine.ts land                              the bid: a proved branch caught up, tested, folded in and pushed, under one hold
 *   node scripts/spine.ts sweep                             the main checkout's whiteboard/, human/ and notes/, committed onto the top
 *   node scripts/spine.ts restack                           the spine, replayed onto origin/main if origin has moved, and pushed
 *   node scripts/spine.ts top                               the top's branch
 *
 * package.json spells each `pnpm <command>`, and `pnpm e2e:rerun` is `e2e --last-failed --workers=1`.
 * Worktrees live under TQ_WORKTREES (`~/worktrees/triquet`). Each suite these run is a shell
 * command an environment variable may replace: TRIQUET_JUSTIFY (typecheck, lint and test through
 * `pnpm run --no-bail`, which runs them side by side and lets each finish), TRIQUET_E2E
 * (`pnpm test:e2e`) and TRIQUET_LAND_CHECKS (`pnpm test`, patient of a loaded machine: what a bid
 * runs under the hold).
 */
import { execFileSync, spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import type { JSONReport } from '@playwright/test/reporter'
import * as E2eLog from './e2e-log.ts'
import * as Lanes from './lanes.ts'

/** The main checkout's directories whose uncommitted files any sweep commits onto the top */
export const SweptDirs = ['whiteboard', 'human', 'notes'] as const

/** How long to wait for another checkout's hold on the spine before giving up: long enough for a few bids ahead, each running the unit tests */
const LockWaitMs = 30 * 60 * 1000

/** What `pnpm justify` runs: typecheck, lint and the unit tests, side by side, each run to its end however the others fare */
const JustifyCommand = 'pnpm run --no-bail "/^(typecheck|lint|test)$/"'

/**
 * What a bid runs under the hold: the unit tests, each allowed a minute rather than vitest's five
 * seconds. A bid often runs beside other worktrees' e2e suites, under whose load tests that spawn
 * processes time out at five seconds; a test that truly hangs still fails, and CI keeps the five.
 */
const LandChecks = 'pnpm test --testTimeout=60000'

/** The build directory `pnpm test:e2e` builds into, as package.json names it: the cache a new worktree is seeded with */
export const E2eDistDir = '.next-e2e'

/** The file in a worktree's e2e build directory saying its cache was seeded and no run has used it yet */
const SeedMarker = '.triquet-seeded'

/**
 * Where a branch's changes need no e2e proof to land: documents and notes. A `.md` under `src/`
 * is app content, which the build compiles, and is not exempt.
 */
const DocsOnlyRules: readonly ((filepath: string) => boolean)[] = [
  (filepath) => filepath.endsWith('.md') && ! filepath.startsWith('src/'),
  (filepath) => filepath.startsWith('whiteboard/'),
  (filepath) => filepath.startsWith('human/'),
]

const Usage = 'Usage: node scripts/spine.ts worktree <label> [--no-install] | worktree --remove | catchup | justify | e2e [<playwright args>] | e2e-log | land | sweep | restack | top'

/** A stop that needs the agent or the Coach: its message says what happened and what to do */
export class SpineStop extends Error {}

/** The top of the spine: the branch the main checkout stands on, and its commit */
export interface Top {
  branch: string
  sha:    string
}

/** Runs git in `cwd` and hands back what it printed; a failure throws with what git said */
export function git(cwd: string, ...args: string[]): string {
  return gitExactly(cwd, ...args).trim()
}

/** What git, run in `cwd`, prints, as printed: for output whose leading space means something, as a status line's does */
function gitExactly(cwd: string, ...args: string[]): string {
  // eslint-disable-next-line sonarjs/no-os-command-from-path -- the installed git, whichever it is, is the one keeping these checkouts
  const ran = spawnSync('git', args, { cwd, encoding: 'utf8' })
  if (ran.status !== 0) { throw new Error(`git ${args.join(' ')}: ${(ran.stderr || ran.stdout).trim()}`) }
  return ran.stdout
}

/** Whether git, run in `cwd`, succeeds */
export function gitOk(cwd: string, ...args: string[]): boolean {
  // eslint-disable-next-line sonarjs/no-os-command-from-path -- as in git() above
  return spawnSync('git', args, { cwd, encoding: 'utf8' }).status === 0
}

/** git push, borrowing gh's login for the one push (`notes/git_hygiene.md`, *Filing the PR*) */
export const PushArgs = ['-c', 'credential.helper=', '-c', 'credential.helper=!gh auth git-credential', 'push', '--quiet']

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
  let waitingOn: string | undefined
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
    if (holder !== undefined && holder.purpose !== waitingOn) {
      waitingOn = holder.purpose
      process.stderr.write(`Waiting for the spine: ${holder.purpose}.\n`)
    }
    if (Date.now() > deadline) { throw new SpineStop(`The spine has been held for ${String(LockWaitMs / 60_000)} minutes (${lockdir}: ${holder?.purpose ?? 'by no one saying why'}).`) }
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
export function checkoutAt(cwd: string): { root: string, main: string, commondir: string } {
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
export function refuseBusy(main: string): void {
  const busy = busyIn(main)
  if (busy !== undefined) { throw new SpineStop(`The main checkout is in the middle of something (${busy}): the Coach's to finish before anything lands.`) }
}

/**
 * Replays the spine onto `origin/main` when origin has moved past it, as it does once the Coach
 * merges, and pushes every spine branch origin still has and the replay left holding commits of
 * its own, each with an explicit lease. The Coach's uncommitted edits are autostashed; a conflict
 * undoes the replay and stops. Once the whole spine has merged, the main checkout goes back to
 * `main`, and the next landing starts the spine afresh.
 *
 * @returns Lines saying what was done, empty when the spine was already on `origin/main`.
 */
export function restack(main: string): string[] {
  git(main, 'fetch', '--quiet', '--prune', 'origin')
  const top = topOf(main)
  const replayed = gitOk(main, 'merge-base', '--is-ancestor', 'origin/main', top.sha) ? [] : replay(main, top)
  return [...replayed, ...backOnMain(main)]
}

/** Replays the spine, which origin/main has moved past, onto it: the body of restack() */
function replay(main: string, top: Top): string[] {
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
  // A branch whose every commit main already had is empty now: pushing it would only point its PR at main.
  const pushing = leases.filter(([branch]) => ! gitOk(main, 'merge-base', '--is-ancestor', branch, 'origin/main'))
  for (const [branch, sha] of pushing) {
    git(main, ...PushArgs, `--force-with-lease=${branch}:${sha}`, 'origin', branch)
  }
  return [
    `Replayed the spine (${spine.join(', ')}) onto origin/main.`,
    ...(stashed ? ['The Coach\'s uncommitted edits did not go back cleanly after the replay: they are kept in `git stash list`. Tell the Coach.'] : []),
    ...(pushing.length > 0 ? [`Pushed ${pushing.map(([branch]) => branch).join(', ')}.`] : []),
  ]
}

/**
 * Puts the main checkout back on `main`, fast-forwarded, when the whole spine has merged: it
 * stands exactly on `origin/main`, on a spine branch origin has since deleted, as it does on
 * merging that branch's PR. Any other branch there is the Coach's, and stays: one they cut by
 * hand tracks no branch of its own name on origin. Switching between two names for one commit
 * changes no file, so the Coach's uncommitted edits stay put. A local `main` holding commits
 * origin lacks is left alone, and says so.
 */
function backOnMain(main: string): string[] {
  const top = topOf(main)
  if (top.branch === 'main' || top.sha !== git(main, 'rev-parse', 'origin/main') || ! isGoneFromOrigin(main, top.branch)) { return [] }
  if (gitOk(main, 'rev-parse', '--verify', '--quiet', 'refs/heads/main') && ! gitOk(main, 'merge-base', '--is-ancestor', 'main', 'origin/main')) {
    return [`The whole spine has merged, but local main holds commits origin/main lacks: the main checkout stays on ${top.branch}. Tell the Coach.`]
  }
  git(main, 'switch', '--quiet', '--force-create', 'main', 'origin/main')
  return [`The whole spine has merged: the main checkout stands on main again, and ${top.branch} is done.`]
}

/** Whether `branch` tracks a branch of its own name on origin, as a landed one does, that origin no longer has (after a pruning fetch) */
function isGoneFromOrigin(main: string, branch: string): boolean {
  const tracks = gitOk(main, 'config', `branch.${branch}.merge`) && git(main, 'config', `branch.${branch}.merge`) === `refs/heads/${branch}`
  return tracks && ! gitOk(main, 'rev-parse', '--verify', '--quiet', `refs/remotes/origin/${branch}`)
}

/**
 * Commits whatever is uncommitted in the main checkout's swept directories onto the top, so a
 * stray file there comes along rather than stalling anyone. Standing on `main`, it cuts a branch
 * for the commit first: the spine's top is never `main` itself.
 *
 * @returns The paths committed, empty when there was nothing to sweep.
 */
export function sweep(main: string): string[] {
  const paths = pathsOfStatus(gitExactly(main, 'status', '--porcelain', '-z', '--untracked-files=all', '--', ...SweptDirs))
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
 * swept first), with a lane of its own, its e2e build cache seeded from the main checkout's, and
 * its packages installed.
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
  const seeded = seedCache(main, root)
  if (opts.install) {
    // eslint-disable-next-line sonarjs/no-os-command-from-path -- the pnpm this checkout already runs
    const installed = spawnSync('pnpm', ['install', '--frozen-lockfile', '--prefer-offline'], { cwd: root, stdio: 'inherit' })
    if (installed.status !== 0) { throw new SpineStop(`pnpm install failed in ${root}; the worktree stands, on lane ${lane}.`) }
  }
  return [...notes, ...seeded, `Worktree: ${root}`, `Branch:   ${branch}, cut from ${top.branch} at ${top.sha.slice(0, 8)}`, `Lane:     ${lane}`]
}

/**
 * Seeds the e2e build cache of the new worktree at `root` with a copy of the main checkout's (a
 * reflink where the filesystem allows one), marked as seeded until its first run, so the e2e log
 * can tell whether seeding pays. A copy, never shared: two servers writing one cache can corrupt
 * it. Nothing to copy, or a copy that fails, leaves the worktree to build its cache cold.
 *
 * @returns A line saying what was seeded, if anything.
 */
function seedCache(main: string, root: string): string[] {
  const from = path.join(main, E2eDistDir, 'dev', 'cache')
  if (! fs.existsSync(from)) { return [] }
  const onto = path.join(root, E2eDistDir, 'dev', 'cache')
  const began = Date.now()
  try {
    fs.cpSync(from, onto, { recursive: true, mode: fs.constants.COPYFILE_FICLONE })
  } catch (err) {
    fs.rmSync(path.join(root, E2eDistDir), { recursive: true, force: true })
    return [`Seeding the e2e build cache failed, so its first run builds it cold: ${(err as Error).message}`]
  }
  fs.writeFileSync(path.join(root, E2eDistDir, SeedMarker), `${JSON.stringify({ from, at: new Date().toISOString() })}\n`)
  return [`Seeded the e2e build cache from the main checkout's, in ${secondsSince(began)} s.`]
}

/** The e2e build cache at `root` as a run finds it: absent, seeded and not yet used, or left by an earlier run */
function cacheStateOf(root: string): E2eLog.CacheState {
  const cachedir = path.join(root, E2eDistDir, 'dev', 'cache')
  if (! fs.existsSync(cachedir) || fs.readdirSync(cachedir).length === 0) { return 'cold' }
  return fs.existsSync(path.join(root, E2eDistDir, SeedMarker)) ? 'seeded' : 'warm'
}

/** Whole seconds since `began`, a `Date.now()` */
function secondsSince(began: number): string {
  return String(Math.round((Date.now() - began) / 1000))
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
  const dirty = pathsOfStatus(gitExactly(root, 'status', '--porcelain', '-z', '--untracked-files=all'))
  if (dirty.length > 0) { throw new SpineStop(`This worktree holds uncommitted files, which removing it would lose: ${dirty.join(', ')}. Commit them, or move them, first.`) }
  // eslint-disable-next-line sonarjs/no-os-command-from-path -- the node running this script, whichever it is
  const freed = execFileSync('node', [path.join(root, 'scripts', 'lanes.ts'), 'release'], { cwd: root, encoding: 'utf8' }).trim()
  git(main, 'worktree', 'remove', '--force', root)
  return [`Removed ${root}. ${freed}`]
}

/**
 * Settles a rebase a catch-up started: once `branch` holds the commit it was being rebased onto,
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
  return configOf(root, `branch.${branch}.spinebase`) ?? git(root, 'merge-base', branch, top.sha)
}

/** A git config value, or undefined when it is unset */
function configOf(root: string, key: string): string | undefined {
  return gitOk(root, 'config', key) ? git(root, 'config', key) : undefined
}

/** Whether the checkout at `root` holds nothing uncommitted */
function isClean(root: string): boolean {
  return git(root, 'status', '--porcelain', '--untracked-files=all') === ''
}

/** The exit status of the shell command `command`, given `args`, run in `root` with `env` over the process's own, its output shown as it runs */
function statusOf(root: string, command: string, args: readonly string[] = [], env: Record<string, string> = {}): number {
  // eslint-disable-next-line sonarjs/no-os-command-from-path -- the system shell runs the checks as a person would
  const ran = spawnSync('sh', ['-c', `${command} "$@"`, 'sh', ...args], { cwd: root, stdio: 'inherit', env: { ...process.env, ...env } })
  return ran.status ?? 1
}

/** Whether the shell command `command` succeeds in `root`, its output shown as it runs */
function passes(root: string, command: string): boolean {
  return statusOf(root, command) === 0
}

/**
 * The branch of the worktree at `root`, refusing what a catch-up or a bid cannot start from: the
 * main checkout, no branch, git in the middle of something, uncommitted changes.
 */
function worktreeBranch(root: string, main: string, doing: string): string {
  if (root === main) { throw new SpineStop(`${doing} happens from a worktree; the main checkout is the spine itself.`) }
  if (! gitOk(root, 'symbolic-ref', '--quiet', 'HEAD')) { throw new SpineStop('This worktree is not on a branch: switch to your thread\'s branch first.') }
  const busy = busyIn(root)
  if (busy !== undefined) { throw new SpineStop(`This worktree is in the middle of something (${busy}): finish it (git rebase --continue) or abort it, then try again.`) }
  if (! isClean(root)) { throw new SpineStop('This worktree holds uncommitted changes: commit them first.') }
  return git(root, 'symbolic-ref', '--short', 'HEAD')
}

/** Where the checkout at `root` stands: its branch, that branch's base and patch-id, its commit, and whether everything there is committed */
function standingOf(root: string, main: string): { branch: string, base: string, patchid: string, head: string, committed: boolean } {
  if (! gitOk(root, 'symbolic-ref', '--quiet', 'HEAD')) { throw new SpineStop('This checkout is not on a branch: switch to your thread\'s branch first.') }
  const branch = git(root, 'symbolic-ref', '--short', 'HEAD')
  const base = spinebaseOf(root, branch, topOf(main))
  return { branch, base, patchid: patchIdOf(root, base, branch), head: git(root, 'rev-parse', 'HEAD'), committed: isClean(root) }
}

/**
 * The patch-id of everything `branch` changes since `base`: one hash, blind to line numbers, so a
 * rebase that carries the changes across unaltered keeps it, and any change to them does not.
 */
function patchIdOf(root: string, base: string, branch: string): string {
  // eslint-disable-next-line sonarjs/no-os-command-from-path -- as in git() above
  const diff = spawnSync('git', ['diff', '--binary', '--no-color', '--no-ext-diff', base, branch], { cwd: root, encoding: 'utf8', maxBuffer: 2 ** 30 })
  if (diff.status !== 0) { throw new Error(`git diff ${base} ${branch}: ${diff.stderr.trim()}`) }
  if (diff.stdout === '') { return 'empty' }
  // eslint-disable-next-line sonarjs/no-os-command-from-path -- as in git() above
  const hashed = spawnSync('git', ['patch-id', '--stable'], { cwd: root, encoding: 'utf8', input: diff.stdout, maxBuffer: 2 ** 20 })
  const [hash = ''] = hashed.stdout.split(' ', 1)
  // A diff of modes alone gives patch-id nothing to hash; its own hash will do.
  return hash === '' ? createHash('sha256').update(diff.stdout).digest('hex') : hash
}

/** The paths `branch` changes since `base`, a rename as both of its sides */
function changedPaths(root: string, base: string, branch: string): string[] {
  return gitExactly(root, 'diff', '--name-only', '--no-renames', '-z', base, branch).split('\0').filter(Boolean)
}

/**
 * Whether every path a branch changes is a document or a note, so that it lands with no e2e
 * proof: a `.md` outside `src/`, or anything under `whiteboard/` or `human/`.
 *
 * @example isDocsOnly(['notes/stack.md', 'whiteboard/20261006-x/shot.png'])  // => true
 * @example isDocsOnly(['src/content/about.md'])                             // => false
 */
export function isDocsOnly(filepaths: readonly string[]): boolean {
  return filepaths.every((filepath) => DocsOnlyRules.some((rule) => rule(filepath)))
}

/**
 * Rebases `branch` onto `top` unless it stands there already, recording its new base. A conflict
 * stops with the rebase in progress in the worktree, the agent's to repair or abort; the spine is
 * untouched.
 *
 * @returns Whether it rebased.
 */
function caughtUp(root: string, branch: string, top: Top): boolean {
  const base = spinebaseOf(root, branch, top)
  if (base === top.sha) { return false }
  git(root, 'config', `branch.${branch}.spinebase-pending`, top.sha)
  try {
    git(root, 'rebase', '--quiet', '--onto', top.sha, base, branch)
  } catch (err) {
    throw new SpineStop([
      `Rebasing ${branch} onto ${top.branch} conflicted; the spine is untouched.`,
      'Repair what notes/git_hygiene.md calls straightforward, `git rebase --continue`, and justify again;',
      'otherwise `git rebase --abort` and report.',
      (err as Error).message,
    ].join('\n'))
  }
  settleRebase(root, branch)
  return true
}

/**
 * Catches the worktree's branch up with the top. Under the hold, replays the spine onto
 * `origin/main` if origin has moved and sweeps the main checkout; then, released, rebases the
 * branch onto the top if it stands anywhere else.
 *
 * @returns Lines saying what moved.
 */
export function catchUp(cwd: string): string[] {
  const { root, main, commondir } = checkoutAt(cwd)
  const branch = worktreeBranch(root, main, 'Catching up')
  const { top, notes } = withSpineHeld(commondir, `catching ${branch} up`, () => {
    refuseBusy(main)
    const said = [...restack(main), ...sweptNotes(sweep(main))]
    return { top: topOf(main), notes: said }
  })
  const where = `${top.branch} at ${top.sha.slice(0, 8)}`
  return [...notes, caughtUp(root, branch, top) ? `Rebased ${branch} onto ${where}: justify it again (\`pnpm justify\`).` : `${branch} stands on the top already: ${where}.`]
}

/**
 * Justifies the checkout's branch: typecheck, lint and the unit tests, side by side, each run to
 * its end however the others fare. Green, over committed work alone, it records the branch's
 * patch-id, which a bid checks.
 *
 * @returns Lines saying how it went; red stops.
 */
export function justify(cwd: string): string[] {
  const { root, main } = checkoutAt(cwd)
  const ante = standingOf(root, main)
  const began = Date.now()
  const green = passes(root, process.env.TRIQUET_JUSTIFY ?? JustifyCommand)
  const took = `${secondsSince(began)} s`
  if (! green) { throw new SpineStop(`Justify failed, in ${took}: repair, commit, and justify again.`) }
  const post = standingOf(root, main)
  if (! (ante.committed && post.committed && ante.head === post.head)) {
    return [`Justified in ${took}, but over uncommitted changes, so nothing is recorded: commit, and justify again before you bid.`]
  }
  git(root, 'config', `branch.${ante.branch}.justified`, ante.patchid)
  return [`Justified ${ante.branch}, in ${took}.`]
}

/** Where the checkout at `root` keeps its branch's e2e tally */
function tallyfileOf(root: string): string {
  return path.join(git(root, 'rev-parse', '--absolute-git-dir'), 'triquet-e2e.json')
}

/** The e2e tally kept in `tallyfile`, if any */
function readTally(tallyfile: string): E2eLog.Tally | undefined {
  return fs.existsSync(tallyfile) ? JSON.parse(fs.readFileSync(tallyfile, 'utf8')) as E2eLog.Tally : undefined
}

/**
 * Runs the e2e suite on the checkout's lane, or the part of it `args` asks Playwright for, and
 * writes a line to the e2e log. Over committed work alone, it keeps the branch's tally: a full run
 * starts it afresh, and a rerun or chosen specs clear what they pass. Once every spec of a full
 * run has passed, there or alone since, the branch is proved: `branch.<b>.proved` holds the top it
 * was proved on and its patch-id then.
 *
 * @param args - Playwright's arguments: none for the whole suite, `--last-failed` for a rerun, or specs.
 * @returns Lines saying how the run went and where the proof stands; a red run stops.
 */
export function e2e(cwd: string, args: readonly string[]): string[] {
  const { root, main } = checkoutAt(cwd)
  const ante = standingOf(root, main)
  const kind = runKindOf(args)
  const reportfile = path.join(git(root, 'rev-parse', '--absolute-git-dir'), 'triquet-e2e-report.json')
  fs.rmSync(reportfile, { force: true })
  const cache = cacheStateOf(root)
  const [loadBefore = 0] = os.loadavg()
  const at = new Date().toISOString()
  const began = Date.now()
  const status = statusOf(root, process.env.TRIQUET_E2E ?? 'pnpm test:e2e', args, { PLAYWRIGHT_JSON_OUTPUT_FILE: reportfile })
  const seconds = Math.round((Date.now() - began) / 1000)
  const [, loadAfter = 0] = os.loadavg()
  fs.rmSync(path.join(root, E2eDistDir, SeedMarker), { force: true })
  const outcomes = fs.existsSync(reportfile) ? E2eLog.outcomesOf(JSON.parse(fs.readFileSync(reportfile, 'utf8')) as Pick<JSONReport, 'suites'>) : []
  const post = standingOf(root, main)
  const committed = ante.committed && post.committed && ante.head === post.head
  const tallyfile = tallyfileOf(root)
  const prior = readTally(tallyfile)
  const run = { kind, branch: ante.branch, top: ante.base, patchid: ante.patchid, status, outcomes }
  const { tally, cleared } = committed ? E2eLog.tallied(prior, run) : { tally: prior, cleared: [] }
  const proved = committed && E2eLog.isProved(tally)
  if (committed && tally !== undefined) {
    fs.writeFileSync(tallyfile, `${JSON.stringify(tally)}\n`)
    if (proved) {
      git(root, 'config', `branch.${ante.branch}.proved`, `${tally.top} ${ante.patchid}`)
    } else {
      gitOk(root, 'config', '--unset', `branch.${ante.branch}.proved`)
    }
  }
  const counts = E2eLog.countsOf(outcomes)
  const failures = E2eLog.failuresOf(outcomes)
  E2eLog.append(E2eLog.logfileOf(worktreesHome()), {
    at, branch: ante.branch, lane: Lanes.laneHere(process.env, root), kind, args: [...args], committed,
    load: { before: loadBefore, after: loadAfter }, cores: os.availableParallelism(), cache, seconds, status,
    counts, failures, cleared, still: tally?.outstanding ?? [], proved,
  })
  const lines = [
    `e2e, ${kind}: ${String(counts.passed + counts.flaky)} passed, ${String(counts.failed)} failed, ${String(counts.unrun)} not run, in ${String(seconds)} s (load ${loadBefore.toFixed(1)} as it began; build cache ${cache}).`,
    ...e2eNotes({ kind, committed, prior, tally, cleared, proved, branch: ante.branch }),
  ]
  if (status !== 0) { throw new SpineStop(lines.join('\n')) }
  return lines
}

/** What a run of the e2e suite with Playwright's `args` is: the whole suite, a rerun of what failed, or specs chosen */
function runKindOf(args: readonly string[]): E2eLog.RunKind {
  if (args.length === 0) { return 'full' }
  return args.includes('--last-failed') ? 'rerun' : 'chosen'
}

/** Lines saying where a branch's e2e proof stands after a run */
function e2eNotes(said: { kind: E2eLog.RunKind, committed: boolean, prior: E2eLog.Tally | undefined, tally: E2eLog.Tally | undefined, cleared: readonly E2eLog.Cleared[], proved: boolean, branch: string }): string[] {
  const { kind, committed, prior, tally, cleared, proved, branch } = said
  if (! committed) { return ['The worktree held uncommitted changes, so this run counts toward no proof: commit, then run again.'] }
  const building = kind === 'full' || (prior?.branch === branch && prior.complete)
  if (! building) { return [`No finished full run of ${branch} to build on: \`pnpm e2e\` first.`] }
  const flakes = E2eLog.flakesOf(tally)
  return [
    ...cleared.map(({ spec, how }) => (how === 'flake' ? `A flake: ${spec} failed in the full run and passed alone, unchanged.` : `Repaired: ${spec}.`)),
    ...(tally?.complete === false ? ['The run broke before its specs could finish, so it proves nothing: see its output, and run it again.'] : []),
    ...(proved ? [`Proved ${branch} on ${(tally?.top ?? '').slice(0, 8)}.`] : []),
    ...(proved && flakes.length > 0 ? [`Name these flakes in the PR's Tests: line: ${flakes.join('; ')}.`] : []),
    ...(! proved && tally?.complete ? ['Outstanding, to repair alone (`pnpm e2e:rerun`, or `pnpm e2e <spec file>`):', ...tally.outstanding.map((spec) => `  ${spec}`)] : []),
  ]
}

/**
 * What a bid needs of the branch before it takes the hold: a justify at its present patch-id,
 * and an e2e proof unless it changes only documents and notes. Refuses without them.
 *
 * @returns Lines for the bid to pass on, naming the flakes the PR's Tests: line names.
 */
function proofOf(root: string, main: string, branch: string): string[] {
  const { base, patchid } = standingOf(root, main)
  const justified = configOf(root, `branch.${branch}.justified`)
  if (justified === undefined) { throw new SpineStop(`${branch} has not been justified: \`pnpm justify\`, then bid again.`) }
  if (justified !== patchid) { throw new SpineStop(`${branch} has changed since it was justified: \`pnpm justify\`, then bid again.`) }
  if (isDocsOnly(changedPaths(root, base, branch))) { return ['Documents and notes only: no e2e proof needed.'] }
  const proved = configOf(root, `branch.${branch}.proved`)
  if (proved === undefined) { throw new SpineStop(`${branch} has no e2e proof: \`pnpm e2e\`, then repair each failure alone (\`pnpm e2e:rerun\`) until every spec has passed.`) }
  const [provedOn = '', provedAt = ''] = proved.split(' ', 2)
  const flakes = E2eLog.flakesOf(readTally(tallyfileOf(root)))
  return [
    `e2e proved on ${provedOn.slice(0, 8)}${provedAt === patchid ? '' : ", before the branch's latest changes"}.`,
    flakes.length === 0 ? 'No flakes to report.' : `Flakes, for the PR's Tests: line: ${flakes.join('; ')}.`,
  ]
}

/**
 * Bids to land the worktree's branch on the spine. It must be justified at its present patch-id,
 * and proved by the e2e suite unless it changes only documents and notes. Then, under one hold:
 * replays the spine onto `origin/main` if origin has moved, sweeps the main checkout, rebases the
 * branch onto the top if the top has moved, runs the unit tests, and switches the main checkout
 * onto the branch. The hold released, it pushes the branch. Any stop leaves the spine as it was.
 *
 * @returns Lines saying what landed, on what.
 */
export function land(cwd: string): string[] {
  const { root, main, commondir } = checkoutAt(cwd)
  const branch = worktreeBranch(root, main, 'Landing')
  const proof = proofOf(root, main, branch)
  const checks = process.env.TRIQUET_LAND_CHECKS ?? LandChecks
  const { top, notes } = withSpineHeld(commondir, `landing ${branch}`, () => {
    refuseBusy(main)
    const said = [...restack(main), ...sweptNotes(sweep(main))]
    const stood = topOf(main)
    if (caughtUp(root, branch, stood)) { said.push(`The top had moved: rebased onto ${stood.branch} at ${stood.sha.slice(0, 8)}.`) }
    if (! passes(root, checks)) { throw new SpineStop(`The tests failed on ${branch}, on ${stood.branch}: repair, commit, justify, and bid again. The spine is untouched.`) }
    refuseBusy(main)
    foldIn(root, main, branch)
    return { top: stood, notes: said }
  })
  return [...notes, ...pushed(main, branch), ...proof, `Landed ${branch} on ${top.branch}: the main checkout stands on it now. File its PR (${stackingOn(top)}), then remove this worktree.`]
}

/** What a branch landed on `top` says its PR is stacked on */
function stackingOn(top: Top): string {
  return top.branch === 'main' ? 'stacked on nothing: it starts the spine' : `stacked on ${top.branch}'s`
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
  case 'catchup': {
    return catchUp(cwd)
  }
  case 'justify': {
    return justify(cwd)
  }
  case 'e2e': {
    return e2e(cwd, rest)
  }
  case 'e2e-log': {
    const logfile = E2eLog.logfileOf(worktreesHome())
    return E2eLog.summarise(E2eLog.read(logfile))
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
