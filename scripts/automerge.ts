/**
 * The Coach's merge loop, its trivial case: brings one pull request up to date with `main` and
 * sets GitHub to merge it once its required checks pass (`notes/git_hygiene-coach.md`, *Merging*).
 *
 *   pnpm automerge <PR#> [--dry-run]     (tsx scripts/automerge.ts)
 *
 * The PR's line -- the open PRs beneath it and above it, one
 * stack -- is replayed onto `origin/main` together, so the PRs above it stay stacked on it and
 * merging it marks those beneath it merged. A line on the spine is replayed by `restack`, under
 * the spine's hold; any other line, in a scratch worktree, and every one of its branches is pushed
 * in one atomic push, each with an explicit lease. Then `gh pr merge --auto --merge`, pinned to
 * the head just pushed.
 *
 * Anything past the trivial case stops, with nothing pushed and nothing set, and says why: a
 * conflict; a PR that changes the schema, adds a backfill, is titled `(Serial Deploy ...)` or asks
 * for something before merging; a draft, a fork, a base other than `main`; two stacks on one PR;
 * a line partly on the spine; and a `main` that requires no checks, where auto-merge would merge
 * before CI had run. `--dry-run` does the replay and says what it would push and set, and does
 * neither.
 *
 * Agents never run it: merging is the Coach's (CLAUDE.md, *Git*).
 */
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { SpineStop, PushArgs, checkoutAt, git, gitOk, refuseBusy, restack, topOf, withSpineHeld } from './spine'

const Usage = 'Usage: pnpm automerge <PR#> [--dry-run]'

/** Files whose change makes a deploy a schema push, merged by hand (`notes/deploy.md`, *Schema pushes*) */
export const SchemaPaths = ['convex/schema.ts'] as const

/** What a PR's description says when something must be done before it merges */
const BeforeMerging = /\bbefore merging\b/i

/** What a PR's title ends with when its deploy must finish before anything above it merges */
const SerialDeploy = /\(Serial Deploy\b/

/** An added line that defines a backfill */
const DefinesBackfill = /^\+.*\bmigrations\.define\(/m

/** A pull request, as `gh pr view --json` and `gh pr list --json` describe it */
export interface PrT {
  number:            number
  title:             string
  body:              string
  state:             string
  isDraft:           boolean
  isCrossRepository: boolean
  baseRefName:       string
  headRefName:       string
  headRefOid:        string
}

/** The fields of PrT, as `gh --json` asks for them */
const PrFields = 'number,title,body,state,isDraft,isCrossRepository,baseRefName,headRefName,headRefOid'

/** A branch the replay moved: its PR's branch, its head before and its head after */
export interface MoveT {
  branch: string
  from:   string
  to:     string
}

/** A PR as a person names it: `#141` */
export function numbered(pr: Pick<PrT, 'number'>): string {
  return `#${String(pr.number)}`
}

/** Runs gh in `cwd` and hands back what it printed; a failure stops, with what gh said */
function gh(cwd: string, ...args: string[]): string {
  // eslint-disable-next-line sonarjs/no-os-command-from-path -- the gh the Coach is logged in with
  const ran = spawnSync('gh', args, { cwd, encoding: 'utf8' })
  if (ran.status !== 0) { throw new SpineStop(`gh ${args.join(' ')}: ${(ran.stderr || ran.stdout).trim()}`) }
  return ran.stdout.trim()
}

/**
 * The line `target` stands in, bottom first: the open PRs beneath it, it, and those above it.
 * Branches hold no merge commits, so everything beneath one head is one line; above it, two PRs
 * neither of which holds the other are two stacks, and stop.
 *
 * @param holds - Whether the first commit has the second among its ancestors (or is it).
 */
export function lineOf(target: PrT, open: readonly PrT[], holds: (upper: string, lower: string) => boolean): PrT[] {
  const others = open.filter((pr) => pr.number !== target.number)
  const beneath = others.filter((pr) => holds(target.headRefOid, pr.headRefOid))
  const above = others.filter((pr) => ! beneath.includes(pr) && holds(pr.headRefOid, target.headRefOid))
  const sorted = [...beneath, target, ...above].toSorted((one, two) => (holds(two.headRefOid, one.headRefOid) ? -1 : 1))
  const forked = sorted.slice(1).find((pr, idx) => ! holds(pr.headRefOid, sorted[idx]!.headRefOid))
  if (forked !== undefined) {
    const tops = above.filter((pr) => above.every((other) => other === pr || ! holds(other.headRefOid, pr.headRefOid))).map((pr) => numbered(pr))
    throw new SpineStop(`${numbered(target)} carries two stacks (${tops.join(', ')}): replay them by hand.`)
  }
  return sorted
}

/**
 * Where each PR's branch in `line` went: a replay keeps the commits in order, so a head's place
 * in the old commits is its place in the new. A replay that dropped or added a commit stops.
 *
 * @param before - The line's commits, oldest first, before the replay.
 * @param after - The same commits, oldest first, replayed.
 */
export function movedHeads(line: readonly PrT[], before: readonly string[], after: readonly string[]): MoveT[] {
  if (before.length !== after.length) {
    throw new SpineStop(`The replay made ${String(after.length)} commits of ${String(before.length)}: some of the line is in main already, under other SHAs. Replay it by hand.`)
  }
  return line.map((pr) => {
    const idx = before.indexOf(pr.headRefOid)
    if (idx === -1) { throw new SpineStop(`${numbered(pr)}'s head ${pr.headRefOid.slice(0, 8)} is not among the line's commits.`) }
    return { branch: pr.headRefName, from: pr.headRefOid, to: after[idx]! }
  })
}

/**
 * Why `prs` (a PR and those beneath it, which merge with it) are not the trivial case: one reason
 * per hold-up, empty when there is none.
 *
 * @param changed - The paths the PRs change, against main.
 * @param diff - The PRs' diff of `convex/` against main, with no context lines.
 */
export function holdupsOf(prs: readonly PrT[], changed: readonly string[], diff: string): string[] {
  return [
    ...changed.filter((file) => (SchemaPaths as readonly string[]).includes(file)).map((file) => `it changes ${file}: a schema push`),
    ...(DefinesBackfill.test(diff) ? ['it defines a backfill'] : []),
    ...prs.filter((pr) => SerialDeploy.test(pr.title)).map((pr) => `${numbered(pr)} is a Serial Deploy`),
    ...prs.filter((pr) => BeforeMerging.test(pr.body)).map((pr) => `${numbered(pr)} asks for something before merging`),
    ...prs.filter((pr) => pr.isDraft).map((pr) => `${numbered(pr)} is a draft`),
    ...prs.filter((pr) => pr.isCrossRepository).map((pr) => `${numbered(pr)} comes from a fork`),
    ...prs.filter((pr) => pr.baseRefName !== 'main').map((pr) => `${numbered(pr)} is based on ${pr.baseRefName}, not main`),
  ]
}

/**
 * The checks `main`'s rulesets require, from `gh api repos/{owner}/{repo}/rules/branches/main`.
 *
 * @example requiredChecksOf('[{"type":"required_status_checks","parameters":{"required_status_checks":[{"context":"lint-typecheck"}]}}]')  // => ['lint-typecheck']
 */
export function requiredChecksOf(rules: string): string[] {
  const parsed = JSON.parse(rules) as { type: string, parameters?: { required_status_checks?: { context: string }[] } | null }[]
  return parsed.filter((rule) => rule.type === 'required_status_checks').flatMap((rule) => rule.parameters?.required_status_checks ?? []).map((check) => check.context)
}

/** The local branches on the spine: beneath its top, and not yet in `origin/main` */
function spineBranches(main: string): string[] {
  return git(main, 'for-each-ref', '--format=%(refname:short)', '--merged', topOf(main).sha, '--no-merged', 'origin/main', 'refs/heads/').split('\n').filter(Boolean)
}

/** The branches checked out in any of the repository's checkouts */
function checkedOut(main: string): string[] {
  return git(main, 'worktree', 'list', '--porcelain').split('\n').filter((line) => line.startsWith('branch refs/heads/')).map((line) => line.slice('branch refs/heads/'.length))
}

/** The commits from `origin/main` to `head`, oldest first, in the checkout at `cwd` */
function commitsTo(cwd: string, head: string): string[] {
  return git(cwd, 'rev-list', '--reverse', `origin/main..${head}`).split('\n').filter(Boolean)
}

/**
 * Replays `line` onto `origin/main` in a scratch worktree, with no hooks and no other branch
 * moved, and hands back where each PR's branch went. A conflict is undone and stops.
 */
function replayed(main: string, line: readonly PrT[]): MoveT[] {
  const top = line.at(-1)!
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'triquet-automerge-'))
  const quiet = ['-c', 'core.hooksPath=/dev/null']
  try {
    git(main, ...quiet, 'worktree', 'add', '--quiet', '--detach', scratch, top.headRefOid)
    const before = commitsTo(scratch, 'HEAD')
    try {
      git(scratch, ...quiet, 'rebase', '--quiet', '--no-update-refs', '--onto', 'origin/main', git(scratch, 'merge-base', 'origin/main', 'HEAD'))
    } catch (err) {
      const conflicted = git(scratch, 'diff', '--name-only', '--diff-filter=U').replaceAll('\n', ', ')
      const within = conflicted === '' ? '' : ` (${conflicted})`
      gitOk(scratch, 'rebase', '--abort')
      throw new SpineStop(`Replaying ${numbered(top)}'s line onto origin/main conflicted${within}: not the trivial case. Nothing was pushed.\n${(err as Error).message}`)
    }
    return movedHeads(line, before, commitsTo(scratch, 'HEAD'))
  } finally {
    gitOk(main, 'worktree', 'remove', '--force', scratch)
    fs.rmSync(scratch, { recursive: true, force: true })
  }
}

/** Pushes every move in one atomic push, each leased on the head GitHub showed; then moves any local branch still on its old head and checked out nowhere */
function pushedMoves(main: string, moves: readonly MoveT[]): string[] {
  git(main, ...PushArgs, '--atomic', ...moves.map((move) => `--force-with-lease=${move.branch}:${move.from}`), 'origin', ...moves.map((move) => `${move.to}:refs/heads/${move.branch}`))
  const busy = checkedOut(main)
  const followed = moves.filter((move) => ! busy.includes(move.branch) && gitOk(main, 'update-ref', `refs/heads/${move.branch}`, move.to, move.from))
  const pushed = moves.map((move) => `${move.branch} (${move.from.slice(0, 8)} → ${move.to.slice(0, 8)})`)
  return [
    `Pushed ${pushed.join(', ')}.`,
    ...(followed.length > 0 ? [`Moved the local ${followed.map((move) => move.branch).join(', ')} along.`] : []),
  ]
}

/** What `automerge` found before touching anything: the PR, its line, and what merging it would take with it */
interface SurveyT {
  target:   PrT
  line:     PrT[]
  merging:  PrT[]
  required: string[]
}

/** Reads PR `number` and its line from GitHub, and stops on anything past the trivial case */
function surveyed(main: string, number: number, opts: { dryRun: boolean }): SurveyT {
  const target = JSON.parse(gh(main, 'pr', 'view', String(number), '--json', PrFields)) as PrT
  if (target.state !== 'OPEN') { throw new SpineStop(`${numbered(target)} is ${target.state.toLowerCase()}.`) }
  const tracked = `refs/remotes/origin/${target.headRefName}`
  if (! gitOk(main, 'rev-parse', '--verify', '--quiet', tracked) || git(main, 'rev-parse', tracked) !== target.headRefOid) {
    throw new SpineStop(`origin/${target.headRefName} is not at ${numbered(target)}'s head (${target.headRefOid.slice(0, 8)}): someone pushed during the fetch. Run it again.`)
  }
  const holds = (upper: string, lower: string) => gitOk(main, 'merge-base', '--is-ancestor', lower, upper)
  const open = (JSON.parse(gh(main, 'pr', 'list', '--state', 'open', '--base', 'main', '--limit', '200', '--json', PrFields)) as PrT[])
    .filter((pr) => gitOk(main, 'cat-file', '-e', pr.headRefOid) && ! holds('origin/main', pr.headRefOid))
  const line = lineOf(target, open, holds)
  const merging = line.filter((pr) => holds(target.headRefOid, pr.headRefOid))
  const changed = git(main, 'diff', '--name-only', `origin/main...${target.headRefOid}`).split('\n').filter(Boolean)
  const holdups = holdupsOf(merging, changed, git(main, 'diff', '--unified=0', `origin/main...${target.headRefOid}`, '--', 'convex'))
  if (holdups.length > 0) { throw new SpineStop(`${numbered(target)} is not the trivial case, so merge it by hand: ${holdups.join('; ')}.`) }
  const required = requiredChecksOf(gh(main, 'api', 'repos/{owner}/{repo}/rules/branches/main'))
  if (required.length === 0 && ! opts.dryRun) {
    throw new SpineStop('main requires no status checks, so auto-merge would merge before CI has run. Require the CI jobs in main\'s ruleset first (notes/git_hygiene-coach.md, *Merging*).')
  }
  return { target, line, merging, required }
}

/**
 * Replays the survey's line onto `origin/main` and pushes it, unless it is up to date already or
 * this is a dry run: by `restack` when the line is the spine's, in a scratch worktree otherwise.
 *
 * @returns What was done, and the target's head afterwards.
 */
function broughtUp(main: string, commondir: string, survey: SurveyT, opts: { dryRun: boolean }): { notes: string[], head: string } {
  const { target, line } = survey
  const top = line.at(-1)!
  if (gitOk(main, 'merge-base', '--is-ancestor', 'origin/main', top.headRefOid)) {
    return { notes: [`${numbered(target)}'s line is up to date with main.`], head: target.headRefOid }
  }
  const spine = spineBranches(main)
  const onSpine = line.filter((pr) => spine.includes(pr.headRefName))
  if (onSpine.length > 0 && onSpine.length < line.length) {
    throw new SpineStop(`${numbered(target)}'s line is partly on the spine (${onSpine.map((pr) => numbered(pr)).join(', ')}): replay it by hand.`)
  }
  if (onSpine.length > 0) {
    if (opts.dryRun) { return { notes: [`${numbered(target)} is on the spine: pnpm restack would replay it.`], head: target.headRefOid } }
    const notes = withSpineHeld(commondir, `automerging ${numbered(target)}`, () => {
      refuseBusy(main)
      return restack(main)
    })
    return { notes, head: git(main, 'rev-parse', `refs/remotes/origin/${target.headRefName}`) }
  }
  const moves = replayed(main, line)
  const head = moves.find((move) => move.branch === target.headRefName)!.to
  if (opts.dryRun) { return { notes: [`Would push ${moves.map((move) => move.branch).join(', ')}, replayed onto origin/main cleanly.`], head } }
  return { notes: pushedMoves(main, moves), head }
}

/** Brings PR `number`'s line up to date with main, and sets the PR to merge once its checks pass: the lines to print */
export function automerge(cwd: string, number: number, opts: { dryRun: boolean }): string[] {
  const { main, commondir } = checkoutAt(cwd)
  git(main, 'fetch', '--quiet', '--prune', 'origin')
  const survey = surveyed(main, number, opts)
  const { target, merging, required } = survey
  const { notes, head } = broughtUp(main, commondir, survey, opts)
  const checks = required.length === 0 ? 'its checks (main requires none yet)' : required.join(', ')
  if (opts.dryRun) { return [...notes, `Would set ${numbered(target)} to merge at ${head.slice(0, 8)} once ${checks} pass.`] }
  gh(main, 'pr', 'merge', String(number), '--auto', '--merge', '--match-head-commit', head)
  const beneath = merging.filter((pr) => pr !== target).map((pr) => numbered(pr))
  const along = beneath.length === 0 ? '' : `, and ${beneath.join(', ')} with it`
  return [...notes, `${numbered(target)} will merge at ${head.slice(0, 8)} once ${checks} pass${along}.`]
}

/** What the command line asks for, done, as the lines to print */
function main(args: readonly string[]): string[] {
  const number = Number(args.find((arg) => ! arg.startsWith('--')))
  if (! Number.isSafeInteger(number) || number <= 0) { throw new SpineStop(Usage) }
  return automerge(process.cwd(), number, { dryRun: args.includes('--dry-run') })
}

// Run by tsx, which sets no import.meta.main: run as a script, not imported.
if (process.argv[1] !== undefined && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    process.stdout.write(`${main(process.argv.slice(2)).join('\n')}\n`)
  } catch (err) {
    console.error(err instanceof Error ? err.message : err)
    process.exitCode = 1
  }
}
