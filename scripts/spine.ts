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
 *   node scripts/spine.ts e2e --touched                     the corner of the suite the branch's changes reach (SpecCorners), logged; a proof scoped to it
 *   node scripts/spine.ts e2e-log                           the e2e log, summarised
 *   node scripts/spine.ts proof [--skip-e2e <reason>]       where the branch's e2e proof stands, as a bid would take it
 *   node scripts/spine.ts land                              the bid: a proved branch caught up, typechecked and tested, folded in and pushed, under one hold
 *   node scripts/spine.ts sweep                             the main checkout's whiteboard/, human/ and notes/, committed onto the top
 *   node scripts/spine.ts restack                           the spine, replayed onto origin/main if origin has moved, and pushed
 *   node scripts/spine.ts top                               the top's branch
 *
 * package.json spells each `pnpm <command>`, `pnpm e2e:rerun` is `e2e --last-failed --workers=1`, and
 * `pnpm e2e:smoke` is `e2e --grep @smoke`, one test of each spec file: a quick signal, never a proof.
 * A full or touched run takes the container's e2e lock first, and waits its turn (`underE2eLock`).
 * Worktrees live under TQ_WORKTREES (`~/worktrees/triquet`). Each suite these run is a shell
 * command an environment variable may replace: TRIQUET_JUSTIFY (typecheck, lint and test through
 * `pnpm run --no-bail`, which runs them side by side and lets each finish), TRIQUET_E2E
 * (`pnpm test:e2e`) and TRIQUET_LAND_CHECKS (typecheck beside `pnpm test:bid`, the unit tests
 * patient of a loaded machine: what a bid runs under the hold).
 */
import { execFileSync, spawn, spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { setTimeout as sleep } from 'node:timers/promises'
import { parseArgs } from 'node:util'
import type { JSONReport } from '@playwright/test/reporter'
import * as Lockfile from 'proper-lockfile'
import * as E2eLog from './e2e-log.ts'
import * as Lanes from './lanes.ts'

/** The main checkout's directories whose uncommitted files any sweep commits onto the top */
export const SweptDirs = ['whiteboard', 'human', 'notes'] as const

/** How long to wait for another checkout's hold on the spine before giving up: long enough for a few bids ahead, each running typecheck and the unit tests */
const LockWaitMs = 30 * 60 * 1000

/** How long a full or touched run waits for the e2e lock before giving up: long past the few runs that could be ahead of it, each three to five minutes */
const E2eLockWaitMs = 60 * 60 * 1000

/** How long the e2e lock outlives a holder that stopped keeping it fresh (proper-lockfile's `stale`): a run killed outright frees it this long after */
const E2eLockStaleMs = 30 * 1000

/** How often a run waiting for the e2e lock tries for it again */
const E2eLockPollMs = 2000

/**
 * Set by a run holding the e2e lock in the run it starts beneath it, to the whole seconds it waited
 * for the lock: the run beneath logs it, and takes no lock of its own.
 */
const WaitedEnv = 'TRIQUET_E2E_WAITED_S'

/** What `pnpm justify` runs: typecheck, lint and the unit tests, side by side, each run to its end however the others fare */
const JustifyCommand = 'pnpm run --no-bail "/^(typecheck|lint|test)$/"'

/**
 * What a bid runs under the hold: typecheck and the unit tests, side by side as justify runs its
 * steps, the tests (`pnpm test:bid`) each allowed a minute rather than vitest's five seconds. A
 * bid often runs beside other worktrees' e2e suites, under whose load tests that spawn processes
 * time out at five seconds; a test that truly hangs still fails, and CI keeps the five.
 */
const LandChecks = 'pnpm run --no-bail "/^(typecheck|test:bid)$/"'

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

/**
 * Where a branch's changes cannot reach what an e2e run does: the unit tests, the agents' and skills'
 * definitions, the lint configuration, and the scripts that are only the repository's housekeeping.
 * A path not named here and not a document is one the suite runs on or exercises, so a new kind of
 * path is watched until someone says it is not. The harness scripts (this one, `lanes.ts`,
 * `e2e-log.ts`, `convex_dev`, `convex_backend`, `doppledo`, `as_role`) are deliberately not here.
 */
const UnwatchedRules: readonly ((filepath: string) => boolean)[] = [
  (filepath) => filepath.startsWith('tests/'),
  (filepath) => filepath.startsWith('.claude/'),
  (filepath) => filepath === 'eslint.config.mjs',
  (filepath) => HousekeepingScripts.has(filepath),
]

/** Scripts that are tools for the person or agent at the keyboard, and run nowhere in an e2e run */
const HousekeepingScripts: ReadonlySet<string> = new Set([
  'scripts/automerge.ts',
  'scripts/convex-previews.ts',
  'scripts/convex_healthcheck',
  'scripts/convex_preview',
  'scripts/git-attic',
  'scripts/kilroy',
  'scripts/measure-latency.ts',
  'scripts/newb',
  'scripts/newb-label.ts',
  'scripts/session-branches.ts',
])

/** The spec files of the grid's corner: the specs that drive the questions' rows */
const GridSpecs = ['grid', 'chaining', 'ordering', 'archiving', 'ishes', 'estimates', 'entries'] as const

/** The spec files of the gear's corner: the specs about its dialogs (the heavy specs walk them in setup, and these cover every path they take) */
const GearSpecs = ['widgets', 'prompts', 'entries', 'quizzes', 'quiz-entries'] as const

/** The spec files of the panels below the grid */
const PanelSpecs = ['panels', 'sheets', 'importing', 'entries', 'recap', 'quiz-entries'] as const

/** The spec files of putting a question to a bot, and of the routes that do it */
const AskingSpecs = ['asking', 'bots', 'failures', 'prompts', 'ishes', 'client-first'] as const

/** The spec files of the way in, the addresses and the pages they open */
const RoutingSpecs = ['routing', 'brand', 'failing-pages'] as const

/** The spec files of the quiz history the browser keeps */
const HistorySpecs = ['quiz-history', 'panels'] as const

/** A corner of the e2e suite: the paths in it, each a file or a prefix the path starts with, and the spec files (by name, as under `e2e/`) that would notice a change there */
interface CornerRule {
  corner: string
  paths:  readonly string[]
  specs:  readonly string[]
}

/**
 * The path-to-spec map: which spec files would notice a change to a path, read from every spec and
 * checked against the imports. A path takes the first rule it matches, so the particular come
 * before the general; a path no rule names (`src/models/`, `convex/`, `src/lib/rows.ts`,
 * `e2e/support.ts`, the configuration, the harness scripts, and anything new) reaches the whole
 * suite, as do a few files every screen leans on (`use-draft`, `use-session`, `offers.ts`,
 * `postmortem`, `cells/fields` and `cells/markdown`) and those every quiz screen opens through (the
 * synced layout, the quiz's pages, `QuizRoute`, `SiteHeader`, `shown-hunt`, `use-address`,
 * `use-ident` and `routes.ts`, and the quiz history mirror `use-hunt` feeds and tracks every write
 * through: `hunt-mirror`, `hunt-feed`, `hunt-fetching`, `hunt-commits`, `commit-scheduler`,
 * `huntfiles` and `huntgit`, with the history download and its help, `FullHistoryDownload` and
 * `full-history.md`, which every quiz screen's Export tab mounts), and the widgeting planner
(`src/lib/widgeting-edit.ts`), which lays out the quiz of every spec that asks for its layout up
front (`testing:makeHunt`) as well as the gear's. A component used in two corners
 * names the spec files of both. A spec file named here need not exist yet: `pnpm e2e --touched`
 * skips one that is not there, and a corner left with none reaches the whole suite.
 */
export const SpecCorners: readonly CornerRule[] = [
  { corner: 'the error boundary', specs: ['failing-pages'], paths: ['src/app/(synced)/error.tsx', 'src/components/PageFailed.tsx'] },
  { corner: 'the stats page',     specs: ['stats'],         paths: ['src/app/(synced)/stats/', 'src/components/Stats.tsx', 'src/state/use-stats.ts', 'convex/stats.ts', 'src/lib/build-stamp.ts'] },
  { corner: 'the alarms',         specs: ['alarms'],        paths: ['src/components/AlarmSnackbar.tsx'] },
  // Reviews
  { corner: 'reviews',                   specs: ['reviews'],                                 paths: ['src/components/ReviewScreen.tsx', 'src/components/panels/ReviewsPanel.tsx', 'src/components/cells/answer-lock.tsx', 'convex/reviews.ts', 'convex/writing/review_actions.ts'] },
  { corner: 'reviews, as rows and files', specs: ['reviews', ...PanelSpecs, 'quiz-history'], paths: ['src/models/review.ts', 'src/models/reviewing.ts'] },
  // The quiz history
  { corner: 'the hunt histories listed', specs: ['quiz-history', 'routing'],                 paths: ['src/components/HuntRepoList.tsx', 'src/components/OrphanedRepos.tsx', 'src/state/use-hunt-repos.ts'] },
  { corner: 'the quiz history',          specs: HistorySpecs,                                paths: ['src/components/HuntBranch.tsx'] },
  // The categories
  { corner: 'the category wheel',        specs: ['categories'],                              paths: ['src/components/CategoryWheel.tsx', 'src/components/PersonaCard.tsx', 'src/components/wheel-geometry.ts', 'src/state/use-categories.ts'] },
  { corner: "the categories' page",      specs: ['categories', ...RoutingSpecs],             paths: ['src/components/CategoriesRoute.tsx', 'src/app/(synced)/[org]/[hunt]/categories/', 'src/app/(synced)/c/'] },
  { corner: 'the opening of a hunt',     specs: ['categories', ...RoutingSpecs, 'quiz-history'], paths: ['src/state/use-hunt-opening.ts'] },
  { corner: 'the category spread',       specs: ['estimates', 'panels'],                     paths: ['src/components/panels/SpreadPanel.tsx', 'src/components/panels/spread-', 'src/lib/spread.ts'] },
  // Asking
  { corner: 'asking',                    specs: AskingSpecs,                                 paths: ['src/lib/ask/', 'src/lib/bots/', 'src/app/api/', 'src/state/use-asking', 'src/state/use-bots', 'src/lib/formulary/aibot.ts'] },
  // The gear
  { corner: "the gear's quiz dialog",    specs: [...GearSpecs, 'archiving', 'categories', 'quiz-history'], paths: ['src/components/QuizManageModal.tsx'] },
  { corner: 'the gear and the Widgets panel', specs: [...GearSpecs, ...PanelSpecs],          paths: ['src/components/widget-words.ts', 'src/components/room.ts'] },
  { corner: 'the copy buttons',          specs: [...GearSpecs, ...PanelSpecs, 'routing'],    paths: ['src/components/CopyButton.tsx'] },
  { corner: 'the folded JSON',           specs: [...GearSpecs, 'ishes', 'failures'],         paths: ['src/components/JsonFold.tsx'] },
  { corner: 'the gear',                  specs: GearSpecs,                                   paths: ['src/components/WidgetEditor.tsx', 'src/components/WidgetingsEditor.tsx', 'src/components/ColumnsEditor.tsx', 'src/components/TemplatedEditor.tsx', 'src/components/LibraryModal.tsx', 'src/components/DangerZone.tsx', 'src/components/PreviewPicker.tsx', 'src/components/JsonataFields.tsx', 'src/components/AibotFields.tsx', 'src/components/EntryFields.tsx', 'src/components/SortableList.tsx', 'src/components/ConfirmRemove.tsx', 'src/components/use-preview-bag.ts', 'src/state/widget-edit.ts', 'src/state/use-widget-usage.ts', 'src/state/use-library-actions.ts', 'src/state/use-other-quiz.ts'] },
  // The panels
  { corner: 'the recap panel',           specs: ['recap'],                                   paths: ['src/components/panels/RecapPanel.tsx', 'src/lib/recap.ts'] },
  { corner: 'the members panel',         specs: ['routing'],                                 paths: ['src/components/panels/MembersPanel.tsx'] },
  { corner: 'the panels, as a whole',    specs: [...PanelSpecs, 'reviews', 'routing', 'estimates'], paths: ['src/components/panels/Panels.tsx'] },
  { corner: 'the panels',                specs: PanelSpecs,                                  paths: ['src/components/panels/ExportImportPanel.tsx', 'src/components/panels/ImportForm.tsx', 'src/components/panels/LeagueExport.tsx', 'src/components/panels/LibraryForm.tsx', 'src/components/panels/RawExport.tsx', 'src/components/panels/ReadonlyBox.tsx', 'src/components/panels/TabbedPanel.tsx', 'src/components/panels/WidgetsPanel.tsx', 'src/components/panels/QuizEntriesPanel.tsx', 'src/components/pending-imports.ts', 'src/state/use-whole-hunt.ts'] },
  // The grid
  { corner: 'the chain cell',            specs: [...GridSpecs, 'reviews'],                   paths: ['src/components/cells/chain.tsx'] },
  { corner: "the cells' readouts",       specs: [...GridSpecs, ...AskingSpecs, 'widgets'],   paths: ['src/components/cells/readouts.tsx'] },
  { corner: 'the error badge',           specs: ['failures'],                                paths: ['src/components/cells/ErrBadge.tsx'] },
  { corner: 'the entry cells',           specs: ['entries', 'estimates'],                    paths: ['src/components/cells/entry.tsx', 'src/components/cells/estimates.tsx', 'src/components/cells/use-pills.ts'] },
  { corner: 'the fold buttons',          specs: [...GridSpecs, 'quizzes', 'reviews'],        paths: ['src/components/FoldButton.tsx'] },
  { corner: 'dragging into order',       specs: ['ordering', 'categories', 'widgets'],       paths: ['src/components/use-reorder.ts'] },
  { corner: 'batch mode',                specs: ['archiving'],                               paths: ['src/components/ConfirmViz.tsx', 'src/components/use-checklist.ts'] },
  { corner: "a question's title",        specs: ['archiving', 'reviews'],                    paths: ['src/components/QuestionTitle.tsx'] },
  { corner: "the quiz's header",         specs: ['quizzes', 'grid'],                         paths: ['src/components/QuizHeader.tsx'] },
  { corner: 'the quiz switcher',         specs: ['quizzes', 'routing'],                      paths: ['src/components/QuizSwitcher.tsx'] },
  { corner: 'the grid',                  specs: GridSpecs,                                   paths: ['src/components/QuestionRow.tsx', 'src/components/QuestionTable.tsx', 'src/components/use-folds.ts', 'src/components/use-settled-resize.ts'] },
  // The way in, the addresses and the pages
  { corner: 'the brand',                 specs: ['brand'],                                   paths: ['src/components/Logo.tsx', 'src/components/About.tsx', 'src/app/about/', 'src/content/about.md', 'src/app/manifest.ts', 'src/app/apple-icon.png', 'src/app/favicon.ico', 'public/'] },
  { corner: 'the hunts',                 specs: [...RoutingSpecs, 'quiz-history'],           paths: ['src/components/HuntsList.tsx', 'src/components/HuntRoute.tsx', 'src/state/use-account-actions.ts', 'src/state/use-hunts-list.ts', 'src/app/(synced)/my/', 'src/app/(synced)/[org]/page.tsx', 'src/app/(synced)/[org]/[hunt]/page.tsx', 'src/app/(synced)/[org]/[hunt]/quizzes/page.tsx'] },
  { corner: 'the way in and the addresses', specs: RoutingSpecs,                             paths: ['src/app/(synced)/page.tsx', 'src/app/(synced)/h/', 'src/components/IdentGate.tsx', 'src/components/HuntEditModal.tsx', 'src/components/NotOnHunt.tsx', 'src/components/QuizNotFound.tsx'] },
]

const Usage = 'Usage: node scripts/spine.ts worktree <label> [--no-install] | worktree --remove | catchup | justify | e2e [--touched | <playwright args>] | e2e-log | proof [--skip-e2e <reason>] | land [--skip-e2e <reason>] | sweep | restack | top'

/** A stop that needs the agent or the Coach: its message says what happened and what to do */
export class SpineStop extends Error {}

/** A stop whose reason a process beneath this one has printed already, leaving nothing more to say */
class SaidStop extends SpineStop {
  constructor() {
    super('')
  }
}

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
  return [...notes, ...seeded, `Worktree: ${root}`, `Branch:   ${branch}, cut from ${top.branch} at ${top.sha.slice(0, 8)}`, `Lane:     ${lane}`, `Agent: at the end of your next chat response, offer the Coach this to copy and paste: /rename ${branch}`]
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
 * The paths among `filepaths` that an e2e run runs on or exercises: all but the documents and the
 * paths that cannot reach it (`UnwatchedRules`). A branch whose list is empty has nothing for e2e
 * to notice; one with paths here should run it, whatever it looks like.
 *
 * @example e2eWatched(['tests/scripts/spine.test.ts', 'scripts/git-attic', 'notes/stack.md'])  // => []
 * @example e2eWatched(['scripts/spine.ts', 'src/lib/useful.ts', 'tests/lib/useful.test.ts'])   // => ['scripts/spine.ts', 'src/lib/useful.ts']
 */
export function e2eWatched(filepaths: readonly string[]): string[] {
  return filepaths.filter((filepath) =>  DocsOnlyRules.every((rule) => !rule(filepath)) &&  UnwatchedRules.every((rule) => !rule(filepath)))
}

/** Where a changed path reaches in the e2e suite: a name for what it reached, as `pnpm e2e --touched` prints it, and the spec files that would notice it, or the whole suite */
export interface Reach {
  corner: string
  specs:  readonly string[] | 'all'
}

/** The spec file a spec's name names */
function specfileOf(specname: string): string {
  return `e2e/${specname}.spec.ts`
}

/**
 * Where a changed path reaches in the e2e suite: nothing, for a document or a path e2e cannot
 * notice; its own file, for a spec; the spec files of the first corner of `SpecCorners` it falls
 * in, those that exist; and otherwise, or when none of its corner's spec files exist yet, the
 * whole suite.
 *
 * @param exists - Whether a spec file (`e2e/<name>.spec.ts`) is there to run.
 *
 * @example reachOf('src/components/QuizSwitcher.tsx', () => true)  // => { corner: 'the quiz switcher', specs: ['e2e/quizzes.spec.ts', 'e2e/routing.spec.ts'] }
 * @example reachOf('convex/schema.ts', () => true)                  // => { corner: 'the whole suite', specs: 'all' }
 */
export function reachOf(filepath: string, exists: (specfile: string) => boolean): Reach {
  if (e2eWatched([filepath]).length === 0) { return { corner: 'nothing e2e notices', specs: [] } }
  if (/^e2e\/[^/]+\.spec\.ts$/.test(filepath)) {
    return exists(filepath) ? { corner: 'its own spec', specs: [filepath] } : { corner: 'the whole suite, for a spec removed', specs: 'all' }
  }
  const rule = SpecCorners.find(({ paths }) => paths.some((prefix) => filepath.startsWith(prefix)))
  if (rule === undefined) { return { corner: 'the whole suite', specs: 'all' } }
  const specs = [...new Set(rule.specs)].map((specname) => specfileOf(specname)).filter((specfile) => exists(specfile))
  return specs.length === 0 ? { corner: `the whole suite, as ${rule.corner} has no spec file yet`, specs: 'all' } : { corner: rule.corner, specs }
}

/**
 * The spec files the paths among `filepaths` that reach a corner would be noticed by, sorted: the
 * union of their reaches (`reachOf`), and none when no path is one e2e notices. A path reaching the
 * whole suite adds nothing here: `reachingWhole` names those.
 *
 * @example scopeOf(['src/components/QuizSwitcher.tsx', 'tests/lib/useful.test.ts'], () => true)  // => ['e2e/quizzes.spec.ts', 'e2e/routing.spec.ts']
 */
export function scopeOf(filepaths: readonly string[], exists: (specfile: string) => boolean): string[] {
  const specfiles = filepaths.flatMap((filepath) => {
    const { specs } = reachOf(filepath, exists)
    return specs === 'all' ? [] : specs
  })
  return [...new Set(specfiles)].toSorted((aa, bb) => aa.localeCompare(bb))
}

/**
 * The paths among `filepaths` that reach the whole suite (`reachOf`).
 *
 * @example reachingWhole(['src/components/QuizSwitcher.tsx', 'convex/schema.ts'], () => true)  // => ['convex/schema.ts']
 */
export function reachingWhole(filepaths: readonly string[], exists: (specfile: string) => boolean): string[] {
  return filepaths.filter((filepath) => reachOf(filepath, exists).specs === 'all')
}

/**
 * The paths among `filepaths` that reach outside `scope`, the spec files a touched run proved:
 * those reaching the whole suite, or any spec file it did not run.
 *
 * @example outsideScope(['src/components/QuizSwitcher.tsx', 'src/components/Logo.tsx'], ['e2e/quizzes.spec.ts', 'e2e/routing.spec.ts'], () => true)  // => ['src/components/Logo.tsx']
 */
export function outsideScope(filepaths: readonly string[], scope: readonly string[], exists: (specfile: string) => boolean): string[] {
  return filepaths.filter((filepath) => {
    const { specs } = reachOf(filepath, exists)
    return specs === 'all' || specs.some((specfile) => ! scope.includes(specfile))
  })
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

/** A run of the e2e suite, chosen: its kind, Playwright's arguments, and a touched run's spec files */
interface SuiteRun {
  kind:   E2eLog.RunKind
  args:   readonly string[]
  scope?: readonly string[]
}

/**
 * Runs the e2e suite on the checkout's lane, or the part of it `args` asks for, and writes a line
 * to the e2e log. `--touched` runs the corner of the suite the branch's changes reach
 * (`touchedPlan`), or the whole of it when any path reaches that. Over committed work alone, it
 * keeps the branch's tally: a full or touched run starts it afresh, and a rerun or chosen specs
 * clear what they pass. Once every spec of a full or touched run has passed, there or alone since,
 * the branch is proved: `branch.<b>.proved` holds the top it was proved on and its patch-id then,
 * and a touched run's tally holds the spec files its proof is scoped to. A full or touched run
 * comes here beneath `underE2eLock`, which holds the container's e2e lock for it.
 *
 * @param args - none for the whole suite, `--touched` for the branch's corner, or Playwright's: `--last-failed` for a rerun, specs, `--grep @smoke`.
 * @returns Lines saying how the run went and where the proof stands; a red run stops.
 */
export function e2e(cwd: string, args: readonly string[]): string[] {
  const { root, main } = checkoutAt(cwd)
  const { said, run } = args.includes('--touched') ? touchedPlan(root, main, args) : { said: [], run: { kind: runKindOf(args), args } }
  if (run === undefined) { return said }
  // Said before the suite starts, so a worker who disagrees with the corner chosen can stop it.
  if (said.length > 0) { process.stdout.write(`${said.join('\n')}\n`) }
  return runSuite(root, main, run)
}

/**
 * What `pnpm e2e --touched` runs: the spec files the paths the branch changes since its base
 * reach (`scopeOf`), as a touched run; the whole suite, as a full run, when any path reaches it;
 * nothing when no path is one e2e notices.
 *
 * @returns Lines saying which corner each path chose, and the run, if there is one.
 */
function touchedPlan(root: string, main: string, args: readonly string[]): { said: string[], run?: SuiteRun } {
  if (args.length > 1) { throw new SpineStop('`pnpm e2e --touched` takes nothing else: it chooses the spec files itself.') }
  const { branch, base } = standingOf(root, main)
  const changed = changedPaths(root, base, branch)
  const exists = specExistsIn(root)
  const width = Math.max(0, ...changed.map((filepath) => filepath.length))
  const said = [
    changed.length === 0 ? `${branch} changes nothing since its base.` : `Where each path ${branch} changes reaches in the e2e suite (SpecCorners, in scripts/spine.ts):`,
    ...changed.map((filepath) => `  ${filepath.padEnd(width)}  ${reachSaid(reachOf(filepath, exists))}`),
  ]
  const whole = reachingWhole(changed, exists)
  const reaching = whole.length === 1 ? 'A path reaches' : `${String(whole.length)} paths reach`
  if (whole.length > 0) { return { said: [...said, `${reaching} the whole suite, so the whole suite runs, as a full run.`], run: { kind: 'full', args: [] } } }
  const scope = scopeOf(changed, exists)
  if (scope.length === 0) {
    const advice = isDocsOnly(changed) ? 'It needs no e2e proof to land.' : 'If e2e cannot tell you anything here, `pnpm land --skip-e2e "<why>"` (notes/git_hygiene.md, *When e2e is not worth running*).'
    return { said: [...said, `No path is one e2e runs on or exercises, so no spec runs. ${advice}`] }
  }
  return { said: [...said, `Running its corner, ${String(scope.length)} spec files, for a proof scoped to them: ${specnamesOf(scope)}.`], run: { kind: 'touched', args: scope, scope } }
}

/** Whether a spec file is there to run in the checkout at `root` */
function specExistsIn(root: string): (specfile: string) => boolean {
  return (specfile) => fs.existsSync(path.join(root, specfile))
}

/** A path's reach, as `pnpm e2e --touched` prints it */
function reachSaid({ corner, specs }: Reach): string {
  return specs === 'all' || specs.length === 0 ? corner : `${corner}: ${specnamesOf(specs)}`
}

/** What a proof's scope adds to a line about it: nothing for a full proof, and for a scoped one its spec files' names between `before` and `after` */
function scopedSaid(scope: readonly string[] | undefined, before: string, after: string): string {
  return scope === undefined ? '' : before + specnamesOf(scope) + after
}

/** Spec files by their names, as under `e2e/` without `.spec.ts`: `grid, chaining` */
function specnamesOf(specfiles: readonly string[]): string {
  return specfiles.map((specfile) => path.basename(specfile, '.spec.ts')).join(', ')
}

/** Runs the suite as `run` says, logs it, and keeps the branch's tally and proof: the body of e2e() */
function runSuite(root: string, main: string, run: SuiteRun): string[] {
  const { kind, args, scope } = run
  const ante = standingOf(root, main)
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
  const report = fs.existsSync(reportfile) ? JSON.parse(fs.readFileSync(reportfile, 'utf8')) as Pick<JSONReport, 'suites'> : { suites: [] }
  const outcomes = E2eLog.outcomesOf(report)
  const testSeconds = E2eLog.testSecondsOf(report)
  const post = standingOf(root, main)
  const committed = ante.committed && post.committed && ante.head === post.head
  const tallyfile = tallyfileOf(root)
  const prior = readTally(tallyfile)
  const record = { kind, branch: ante.branch, top: ante.base, patchid: ante.patchid, status, outcomes, ...(scope !== undefined && { scope }) }
  const { tally, cleared } = committed ? E2eLog.tallied(prior, record) : { tally: prior, cleared: [] }
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
  const waited = process.env[WaitedEnv] === undefined ? undefined : Number(process.env[WaitedEnv])
  E2eLog.append(E2eLog.logfileOf(worktreesHome()), {
    at, branch: ante.branch, lane: Lanes.laneHere(process.env, root), kind, args: [...args], committed,
    load: { before: loadBefore, after: loadAfter }, cores: os.availableParallelism(), cache, seconds, test_seconds: testSeconds, status,
    counts, failures, cleared, still: tally?.outstanding ?? [], proved, ...(waited !== undefined && { waited_s: waited }),
  })
  const waitSaid = waited === undefined || waited === 0 ? '' : `; ${String(waited)} s waiting for the e2e lock`
  const lines = [
    `e2e, ${kind}: ${String(counts.passed + counts.flaky)} passed, ${String(counts.failed)} failed, ${String(counts.unrun)} not run, in ${String(seconds)} s, ${String(testSeconds)} test-seconds (load ${loadBefore.toFixed(1)} as it began; build cache ${cache}${waitSaid}).`,
    ...e2eNotes({ kind, committed, prior, tally, cleared, proved, branch: ante.branch }),
  ]
  if (status !== 0) { throw new SpineStop(lines.join('\n')) }
  return lines
}

/**
 * Whether a run of the e2e suite with `args` takes the e2e lock: a full or touched run does, a rerun
 * or chosen specs (the smoke tier among them) do not, and neither does anything in CI or a run
 * started by one holding the lock for it (`WaitedEnv`).
 *
 * @example takesE2eLock([], {})                  // => true
 * @example takesE2eLock(['--last-failed'], {})   // => false
 * @example takesE2eLock([], { CI: 'true' })      // => false
 */
export function takesE2eLock(args: readonly string[], env: Readonly<Record<string, string | undefined>>): boolean {
  if ((env.CI ?? '') !== '' || env[WaitedEnv] !== undefined) { return false }
  return args.length === 0 || args.includes('--touched')
}

/** Who holds the e2e lock, as its holder writes on taking it */
export interface E2eHolder {
  pid:    number
  lane:   number
  branch: string
  root:   string
  kind:   'full' | 'touched'
  /** When it took the lock, as an ISO timestamp */
  since:  string
}

/** The e2e lock beside the e2e log under `home`, one per container as the log is: proper-lockfile's directory, and the note naming its holder */
export function e2eLockOf(home: string): { lockdir: string, notefile: string } {
  return { lockdir: path.join(home, '.e2e-lock'), notefile: path.join(home, '.e2e-lock.json') }
}

/**
 * What a run finding the e2e lock held says, for a session that meets it cold: whose run holds it,
 * since when, and what this run will do once it has the lock.
 *
 * @param holder - The holder's note, undefined when it has not written one yet.
 * @param waiter - This run: its branch and kind, and whether it stands in the main checkout, which catches up with nothing.
 * @param alive - Whether the holder's process is still running.
 *
 * @example e2eWaitSaid(undefined, { branch: 'b', kind: 'full', inMain: false }, Date.now(), true)[0]  // => 'The e2e lock is held, by a run that has not yet said whose.'
 */
export function e2eWaitSaid(holder: E2eHolder | undefined, waiter: { branch: string, kind: 'full' | 'touched', inMain: boolean }, now: number, alive: boolean): string[] {
  const whose = holder === undefined ? 'The e2e lock is held, by a run that has not yet said whose.' : `The e2e lock is held by lane ${String(holder.lane)}'s ${holder.kind} run of ${holder.branch} (${holder.root}, pid ${String(holder.pid)}), since ${timeOfDay(holder.since)}, ${agoOf(Date.parse(holder.since), now)}.`
  const gone = holder !== undefined && ! alive ? [`Its process is gone, so the lock frees itself within ${String(E2eLockStaleMs / 1000)} s.`] : []
  const running = waiter.kind === 'full' ? 'runs the whole suite' : 'chooses its corner afresh and runs it'
  const then = waiter.inMain ? `this run, in the main checkout, ${running}` : `this run catches ${waiter.branch} up with the top first (\`pnpm catchup\`), since the holder has likely landed, and then ${running}`
  return [
    whose,
    ...gone,
    'Full and touched runs take turns in this container, since two at once time each other out.',
    `Waiting, for up to ${String(E2eLockWaitMs / 60_000)} minutes; once the lock is free, ${then}.`,
  ]
}

/** The local time of day of an ISO timestamp, to the second */
function timeOfDay(iso: string): string {
  return new Date(iso).toTimeString().slice(0, 8)
}

/** How long before `now` the moment `then` was, roughly, in words */
function agoOf(then: number, now: number): string {
  const seconds = Math.max(0, Math.round((now - then) / 1000))
  return seconds < 120 ? `${String(seconds)} s ago` : `${String(Math.round(seconds / 60))} min ago`
}

/** The note naming the e2e lock's holder, or undefined while there is none */
function e2eHolderOf(notefile: string): E2eHolder | undefined {
  try {
    return JSON.parse(fs.readFileSync(notefile, 'utf8')) as E2eHolder
  } catch {
    return undefined
  }
}

/**
 * Takes the e2e lock under `home` for `holder`, waiting while another run holds it and saying
 * whose it is each time the holder changes; refuses after E2eLockWaitMs. proper-lockfile keeps the
 * lock fresh while this process lives and frees it when it exits, and a lock its holder stopped
 * keeping fresh is taken over once stale.
 *
 * @returns How to let it go, and whether it had to wait.
 */
async function takeE2eLock(home: string, holder: Omit<E2eHolder, 'since'>, waiter: { branch: string, kind: 'full' | 'touched', inMain: boolean }): Promise<{ release: () => Promise<void>, waited: boolean }> {
  fs.mkdirSync(home, { recursive: true })
  const { lockdir, notefile } = e2eLockOf(home)
  const deadline = Date.now() + E2eLockWaitMs
  let seen: string | undefined
  for (;;) {
    try {
      const release = await Lockfile.lock(notefile, {
        lockfilePath: lockdir, realpath: false, stale: E2eLockStaleMs,
        onCompromised: (err) => { process.stderr.write(`The e2e lock was lost (${err.message}): another full run may overlap this one.\n`) },
      })
      fs.writeFileSync(notefile, `${JSON.stringify({ ...holder, since: new Date().toISOString() })}\n`)
      return { release, waited: seen !== undefined }
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'ELOCKED') { throw err }
    }
    const held = e2eHolderOf(notefile)
    const key = held === undefined ? 'unnamed' : `${String(held.pid)} ${held.since}`
    if (key !== seen) {
      seen = key
      process.stderr.write(`${e2eWaitSaid(held, waiter, Date.now(), held !== undefined && isAlive(held.pid)).join('\n')}\n`)
    }
    if (Date.now() > deadline) { throw new SpineStop(`The e2e lock has been held for ${String(E2eLockWaitMs / 60_000)} minutes (${lockdir}): see whose run it is, above, before you take it.`) }
    await sleep(E2eLockPollMs)
  }
}

/** Runs this script again in `root` with `args`, its output shown as it runs, and hands back its exit status */
function rerunHere(root: string, args: readonly string[], env: Record<string, string> = {}): Promise<number> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [...process.execArgv, import.meta.filename, ...args], { cwd: root, stdio: 'inherit', env: { ...process.env, ...env } })
    child.on('error', reject)
    child.on('close', (status) => { resolve(status ?? 1) })
  })
}

/**
 * Runs a full or touched run of the e2e suite (`e2e`) holding the container's e2e lock, beside the
 * e2e log: one such run at a time on the machine, since two at once load it until each times the
 * other's specs out. A run that finds the lock held says whose run holds it and since when, and
 * waits. Having waited, it catches the branch up first (`pnpm catchup`), since the holder has likely
 * landed and moved the top; a catch-up that conflicts stops, freeing the lock. Then it runs the
 * suite in a process of its own, told how long it waited, so the run is the caught-up checkout's
 * own and chooses a touched run's corner from the top as it now stands, while this process, idle
 * meanwhile, keeps the lock fresh. The lock goes with this process however it ends.
 *
 * @returns Nothing more to say: the run beneath says it all; its stop stops this.
 */
export async function underE2eLock(cwd: string, args: readonly string[]): Promise<string[]> {
  const { root, main } = checkoutAt(cwd)
  const branch = gitOk(root, 'symbolic-ref', '--quiet', 'HEAD') ? git(root, 'symbolic-ref', '--short', 'HEAD') : 'no branch'
  const kind = args.includes('--touched') ? 'touched' : 'full'
  const lane = Lanes.laneHere(process.env, root)
  const { notefile } = e2eLockOf(worktreesHome())
  const began = Date.now()
  const { release, waited } = await takeE2eLock(worktreesHome(), { pid: process.pid, lane, branch, root, kind }, { branch, kind, inMain: root === main })
  try {
    const waitedS = Math.round((Date.now() - began) / 1000)
    if (waited) {
      process.stdout.write(`Took the e2e lock, after ${String(waitedS)} s.\n`)
      await catchUpAfterWait(root, main)
    }
    if (await rerunHere(root, ['e2e', ...args], { [WaitedEnv]: String(waitedS) }) !== 0) { throw new SaidStop() }
    return []
  } finally {
    if (e2eHolderOf(notefile)?.pid === process.pid) { fs.rmSync(notefile, { force: true }) }
    await release()
  }
}

/**
 * Catches the checkout at `root` up with the top after waiting for the e2e lock, in a process of its
 * own (`catchup`), so this one stays free to keep the lock fresh. The main checkout is the spine
 * itself, and a worktree holding uncommitted changes cannot be rebased (its run counts toward no
 * proof anyway): each is said and left. A catch-up that stops stops the run.
 */
async function catchUpAfterWait(root: string, main: string): Promise<void> {
  if (root === main) { return }
  if (! isClean(root)) {
    process.stdout.write('This worktree holds uncommitted changes, so it is not caught up with the top before the run.\n')
    return
  }
  if (await rerunHere(root, ['catchup']) !== 0) { throw new SpineStop('Catching up after the wait stopped, as above, so the suite has not run; the e2e lock is free again.') }
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
  const building = kind === 'full' || kind === 'touched' || (prior?.branch === branch && prior.complete)
  if (! building) { return [`No finished full or touched run of ${branch} to build on: \`pnpm e2e\` (or \`pnpm e2e --touched\`) first.`] }
  const flakes = E2eLog.flakesOf(tally)
  return [
    ...cleared.map(({ spec, how }) => (how === 'flake' ? `A flake: ${spec} failed in the full run and passed alone, unchanged.` : `Repaired: ${spec}.`)),
    ...(tally?.complete === false ? ['The run broke before its specs could finish, so it proves nothing: see its output, and run it again.'] : []),
    ...(proved ? [`Proved ${branch} on ${(tally?.top ?? '').slice(0, 8)}${scopedSaid(tally?.scope, ', over its corner alone (', '): a bid takes it while every path the branch changes stays inside')}.`] : []),
    ...(proved && flakes.length > 0 ? [`Name these flakes in the PR's Tests: line: ${flakes.join('; ')}.`] : []),
    ...(! proved && tally?.complete ? ['Outstanding, to repair alone (`pnpm e2e:rerun`, or `pnpm e2e <spec file>`):', ...tally.outstanding.map((spec) => `  ${spec}`)] : []),
  ]
}

/**
 * What a bid needs of the branch before it takes the hold: a justify at its present patch-id, and
 * an e2e proof as `e2eProofOf` takes it.
 *
 * @returns Lines for the bid to pass on, naming the flakes the PR's Tests: line names.
 */
function proofOf(root: string, main: string, branch: string, skipE2e?: string): string[] {
  const standing = standingOf(root, main)
  const justified = configOf(root, `branch.${branch}.justified`)
  if (justified === undefined) { throw new SpineStop(`${branch} has not been justified: \`pnpm justify\`, then bid again.`) }
  if (justified !== standing.patchid) { throw new SpineStop(`${branch} has changed since it was justified: \`pnpm justify\`, then bid again.`) }
  return e2eProofOf(root, standing, skipE2e)
}

/**
 * Where the branch's e2e proof stands, as a bid takes it, and what `node scripts/spine.ts proof`
 * says: needed unless the branch changes only documents and notes. A proof scoped to a corner
 * (`pnpm e2e --touched`) stands while every path the branch changes still reaches inside it; a path
 * that reaches further leaves the branch as unproved as no proof would. Refuses without a proof,
 * and says, when it does, whether e2e could notice any path the branch changes. A bid may say why
 * e2e has nothing to tell it (`skipE2e`) and go without a proof; a proof it has stands over the
 * reason.
 *
 * @param standing - The branch, its base and its patch-id, as `standingOf` finds them.
 * @returns Lines for the bid to pass on, naming the flakes the PR's Tests: line names.
 */
function e2eProofOf(root: string, standing: { branch: string, base: string, patchid: string }, skipE2e?: string): string[] {
  const { branch, base, patchid } = standing
  const changed = changedPaths(root, base, branch)
  if (isDocsOnly(changed)) { return ['Documents and notes only: no e2e proof needed.'] }
  const proved = configOf(root, `branch.${branch}.proved`)
  if (proved === undefined) { return skippingE2e(branch, changed, skipE2e) }
  const [provedOn = '', provedAt = ''] = proved.split(' ', 2)
  const tally = readTally(tallyfileOf(root))
  const flakes = E2eLog.flakesOf(tally)
  const scope = tally?.scope
  if (scope !== undefined) {
    const outside = outsideScope(changed, scope, specExistsIn(root))
    const beyond = `${branch}'s e2e proof is scoped to its corner (${specnamesOf(scope)}), and ${outside.join(', ')} ${outside.length === 1 ? 'reaches' : 'reach'} beyond it`
    if (skipE2e === undefined && outside.length > 0) { throw new SpineStop(`${beyond}: \`pnpm e2e --touched\` again, or \`pnpm e2e\`, then bid again.`) }
    if (outside.length > 0) { return [`${beyond}.`, ...skippingE2e(branch, changed, skipE2e)] }
  }
  return [
    `e2e proved on ${provedOn.slice(0, 8)}${scopedSaid(scope, ', over its corner (', '), which still holds every path the branch changes')}${provedAt === patchid ? '' : ", before the branch's latest changes"}.`,
    flakes.length === 0 ? 'No flakes to report.' : `Flakes, for the PR's Tests: line: ${flakes.join('; ')}.`,
  ]
}

/**
 * What a bid with no e2e proof does: refuses, saying whether e2e could notice what the branch
 * changes, or, given a reason, goes without and says to name it in the PR's Tests: line.
 *
 * @throws SpineStop with no reason, or an empty one.
 * @returns Lines for the bid to pass on.
 */
export function skippingE2e(branch: string, changed: readonly string[], reason: string | undefined): string[] {
  const watched = e2eWatched(changed)
  const more = watched.length > 4 ? `, and ${String(watched.length - 4)} more` : ''
  const seen = watched.slice(0, 4).join(', ') + more
  if (reason === undefined) {
    const advice = watched.length === 0
      ? `None of the paths it changes is one the e2e suite runs on or exercises. If e2e cannot tell you anything here, \`pnpm land --skip-e2e "<why>"\` (notes/git_hygiene.md, *When e2e is not worth running*).`
      : `The e2e suite runs on or exercises ${String(watched.length)} of the paths it changes (${seen}): run it.`
    throw new SpineStop(`${branch} has no e2e proof: \`pnpm e2e\`, then repair each failure alone (\`pnpm e2e:rerun\`) until every spec has passed.\n${advice}`)
  }
  if (reason.trim() === '') { throw new SpineStop('--skip-e2e takes the reason e2e has nothing to tell you here: say it in a sentence.') }
  return [
    `e2e skipped: ${reason.trim()}. Say so in the PR's Tests: line; CI runs the suite on the PR.`,
    ...(watched.length === 0 ? [] : [`Careful: e2e runs on or exercises ${seen}. A red CI e2e is yours to repair.`]),
  ]
}

/**
 * Bids to land the worktree's branch on the spine. It must be justified at its present patch-id,
 * and proved by the e2e suite unless it changes only documents and notes, or the bid says why e2e
 * has nothing to tell it (`skipE2e`). Then, under one hold:
 * replays the spine onto `origin/main` if origin has moved, sweeps the main checkout, rebases the
 * branch onto the top if the top has moved, and then reads its e2e proof afresh (`proofAfresh`), runs
 * typecheck and the unit tests, and switches the main checkout onto the branch. The hold released,
 * it pushes the branch. Any stop leaves the spine as it was.
 *
 * @returns Lines saying what landed, on what.
 */
export function land(cwd: string, skipE2e?: string): string[] {
  const { root, main, commondir } = checkoutAt(cwd)
  const branch = worktreeBranch(root, main, 'Landing')
  // Read before the hold too, so a bid with no proof is refused without queueing for it.
  const proofBefore = proofOf(root, main, branch, skipE2e)
  const checks = process.env.TRIQUET_LAND_CHECKS ?? LandChecks
  const { top, notes, proof } = withSpineHeld(commondir, `landing ${branch}`, () => {
    refuseBusy(main)
    const said = [...restack(main), ...sweptNotes(sweep(main))]
    const stood = topOf(main)
    const rebased = caughtUp(root, branch, stood)
    if (rebased) { said.push(`The top had moved: rebased onto ${stood.branch} at ${stood.sha.slice(0, 8)}.`) }
    const proven = rebased ? proofAfresh(root, branch, stood, skipE2e) : proofBefore
    if (! passes(root, checks)) { throw new SpineStop(`Typecheck or the tests failed on ${branch}, on ${stood.branch}: repair, commit, justify, and bid again. The spine is untouched.`) }
    refuseBusy(main)
    foldIn(root, main, branch)
    return { top: stood, notes: said, proof: proven }
  })
  return [...notes, ...pushed(main, branch), ...proof, `Landed ${branch} on ${top.branch}: the main checkout stands on it now. File its PR (${stackingOn(top)}), then remove this worktree.`]
}

/**
 * The e2e proof of a branch the bid has just rebased onto `top`, read afresh by this script as the
 * rebase left it (`proof`, in a process of its own): a corner the branch proved may have gained a
 * spec file on the top, or the top may have changed the map itself, and the bid must see both. A
 * proof that no longer holds stops the bid, the branch left rebased.
 *
 * @returns Lines for the bid to pass on, as `e2eProofOf` says them.
 */
function proofAfresh(root: string, branch: string, top: Top, skipE2e?: string): string[] {
  const reason = skipE2e === undefined ? [] : ['--skip-e2e', skipE2e]
  const ran = spawnSync(process.execPath, [...process.execArgv, import.meta.filename, 'proof', ...reason], { cwd: root, encoding: 'utf8' })
  if (ran.status !== 0) {
    throw new SpineStop(`${branch} is rebased onto ${top.branch} at ${top.sha.slice(0, 8)}, where its e2e proof no longer holds, so nothing landed; the spine is untouched.\n${ran.stderr.trim()}`)
  }
  return ran.stdout.split('\n').filter(Boolean)
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

/** The reason `land` was given for going without an e2e proof: what follows `--skip-e2e`, or undefined when it is not there */
export function skipE2eOf(args: readonly string[]): string | undefined {
  try {
    return parseArgs({ args: [...args], options: { 'skip-e2e': { type: 'string' } }, allowPositionals: false }).values['skip-e2e']
  } catch {
    throw new SpineStop(Usage)
  }
}

/** What the command line asks for, done, as the lines to print */
async function main(args: readonly string[]): Promise<string[]> {
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
    return takesE2eLock(rest, process.env) ? underE2eLock(cwd, rest) : e2e(cwd, rest)
  }
  case 'e2e-log': {
    const logfile = E2eLog.logfileOf(worktreesHome())
    return E2eLog.summarise(E2eLog.read(logfile))
  }
  case 'proof': {
    const { root, main: mainroot } = checkoutAt(cwd)
    return e2eProofOf(root, standingOf(root, mainroot), skipE2eOf(rest))
  }
  case 'land': {
    return land(cwd, skipE2eOf(rest))
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
    const lines = await main(process.argv.slice(2))
    if (lines.length > 0) { process.stdout.write(`${lines.join('\n')}\n`) }
  } catch (err) {
    if (! (err instanceof SaidStop)) { console.error(err instanceof Error ? err.message : err) }
    process.exitCode = 1
  }
}
