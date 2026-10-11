/**
 * Deploys `convex/` to a Convex deployment one schema step at a time: the migrations program
 * (`notes/deploy.md`, *Yeet mode*). A schema step is a first-parent commit of the target ref that
 * changes `convex/schema.ts` or `convex/migrations.ts`; the deployment's migrations table
 * (`schema_steps`, `convex/deploying.ts`) says which it has taken. For each step newer than the
 * newest recorded, oldest first, in a scratch worktree at that commit: push its functions and
 * schema, record it pushed, run its backfills to the end, seed, record it backfilled. Then the same
 * for the ref's head. A refused push, or a backfill that stops, stops the program with Convex's
 * words; the deployment is left serving the last step whole.
 *
 *   node scripts/deploy.ts [--dry-run] [--to <ref>] [--from <sha>] [--wait <seconds>] [--snapshot <path>] [--verify <role>]
 *   node scripts/deploy.ts --role <role> [...]                 a local role's backend, from data/convex-<role>/cli.env
 *   node scripts/deploy.ts --role <role> --rehearse <zip> [...] import a snapshot into the role at the step it was taken at, then walk it
 *
 * With no `--role`, the target is the deployment the convex CLI's environment names, so production
 * is reached only through its janitor config, and `--to` defaults to `origin/main` (fetched first):
 *
 *   ./scripts/doppledo prd_janitor pnpm deploy --dry-run
 *   ./scripts/doppledo prd_janitor pnpm deploy
 *
 * With `--role`, `--to` defaults to `HEAD`, the checkout as committed (what is uncommitted comes
 * with the next `pnpm dev`). Stop the role's dev server first: its watch would push the head over
 * every step. `--from <sha>` names the step the target's rows stand at when its table is empty or
 * says something this history does not hold (the first run on production). A target already
 * serving the head whose backfills never finished has them finished and recorded, not re-walked.
 * `--verify <role>` checks the table's word before anything is pushed: the step it names is pushed
 * to that local role (emptied if its rows refuse the step), and the role's function spec (`convex
 * function-spec`: every function's path, kind, visibility and argument shape) must equal the
 * target's, or the program stops; a disposable role (`e2e`) is the one to name. Before walking a cloud deployment the program takes a snapshot (`convex export`, to `--snapshot`
 * or data/snapshots/), which also leaves one to restore from in the dashboard. When it has landed
 * the head and `TRIQUET_DEPLOY_HOOK_URL` is set, it posts to it: Vercel's deploy hook, so the
 * pages are built once the functions they talk to are in place.
 */
import { execFileSync, spawn, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { isDeepStrictEqual } from 'node:util'
import { setTimeout as sleep } from 'node:timers/promises'
import { z } from 'zod'
import { convexRun, DefaultLimitSeconds, runBackfills, subjectOf, type StepT } from './convex-migrations.ts'

/** The files whose change makes a commit a schema step */
export const StepPaths = ['convex/schema.ts', 'convex/migrations.ts'] as const

/** The local roles, as scripts/convex_backend names them */
const Roles = ['dev', 'agent', 'e2e', 'e2e-agent', 'e2e-built'] as const
type Role = typeof Roles[number]

const FullSha = z.string().regex(/^[0-9a-f]{40}$/)

/** What the command line asks for */
export interface Asked {
  dryRun:   boolean
  to:       string | undefined
  from:     string | undefined
  wait:     number
  snapshot: string | undefined
  role:     Role | undefined
  rehearse: string | undefined
  verify:   Role | undefined
}

/** The migrations table's newest row, as `deploying:newest` answers */
const Mark = z.object({ sha: FullSha, subject: z.string(), pushed_at: z.number(), backfilled_at: z.number().nullable() }).nullable()
export type MarkT = z.infer<typeof Mark>

/** One row of an export's `schema_steps/documents.jsonl` */
const ExportedStep = z.object({ sha: FullSha, subject: z.string(), pushed_at: z.number(), backfilled_at: z.number().nullable() })

/** A stop with a reason for the person running the program, printed without a stack */
export class DeployStop extends Error {}

const Usage = 'Usage: node scripts/deploy.ts [--dry-run] [--to <ref>] [--from <sha>] [--wait <seconds>] [--snapshot <path>] [--verify <role>] [--role <role> [--rehearse <zip>]]'

/**
 * The command line, parsed.
 *
 * @example argsOf(['--dry-run', '--to', 'origin/main'])  // => { dryRun: true, to: 'origin/main', from: undefined, wait: 300, snapshot: undefined, role: undefined, rehearse: undefined, verify: undefined }
 * @example argsOf(['--role', 'agent', '--rehearse', 'prd.zip'])  // => { ..., role: 'agent', rehearse: 'prd.zip' }
 * @example argsOf(['--rehearse', 'prd.zip'])  // throws: --rehearse needs --role
 * @example argsOf(['--role', 'agent', '--verify', 'agent'])  // throws: --verify wants a role other than the target
 */
export function argsOf(argv: readonly string[]): Asked {
  const asked: Asked = { dryRun: false, to: undefined, from: undefined, wait: DefaultLimitSeconds, snapshot: undefined, role: undefined, rehearse: undefined, verify: undefined }
  const rest = [...argv]
  const taking = (flag: string) => {
    const given = rest.shift()
    if (given === undefined || given.startsWith('--')) { throw new DeployStop(`${flag} needs a value.`) }
    return given
  }
  const flags: Record<string, () => void> = {
    '--dry-run':  () => { asked.dryRun = true },
    '--to':       () => { asked.to = taking('--to') },
    '--from':     () => { asked.from = FullSha.parse(taking('--from'), { error: () => '--from wants a full forty-digit sha' }) },
    '--wait':     () => { asked.wait = z.coerce.number().positive().parse(taking('--wait')) },
    '--snapshot': () => { asked.snapshot = taking('--snapshot') },
    '--role':     () => { asked.role = roleOf('--role', taking('--role')) },
    '--rehearse': () => { asked.rehearse = taking('--rehearse') },
    '--verify':   () => { asked.verify = roleOf('--verify', taking('--verify')) },
  }
  while (rest.length > 0) {
    const flag = rest.shift() ?? ''
    const take = Object.hasOwn(flags, flag) ? flags[flag] : undefined
    if (take === undefined) { throw new DeployStop(`${Usage} (what is ${flag}?)`) }
    take()
  }
  if (asked.rehearse !== undefined && asked.role === undefined) { throw new DeployStop('--rehearse needs --role: a snapshot is only ever imported into a local role.') }
  if (asked.verify !== undefined && asked.verify === asked.role) { throw new DeployStop('--verify wants a role other than the target: it is pushed to, and emptied if need be.') }
  return asked
}

/** The role `given` names for `flag`, or a stop naming the roles there are */
function roleOf(flag: string, given: string): Role {
  if (! (Roles as readonly string[]).includes(given)) { throw new DeployStop(`${flag} wants one of ${Roles.join(', ')}, not ${given}.`) }
  return given as Role
}

/**
 * The steps between `from` and `to`, oldest first, from `git rev-list --first-parent --reverse
 * --format=%H%x09%s from..to -- <StepPaths>` as git prints it: a `commit` line, then the formatted one.
 *
 * @example stepsOf('commit 84de…\n84de1bb0c2a1f5e6d7b8a9c0d1e2f3a4b5c6d7e8\tmodel: hunts remember their branch\n')  // => [{ sha: '84de1bb0…', subject: 'model: hunts remember their branch' }]
 * @example stepsOf('')  // => []
 */
export function stepsOf(printed: string): StepT[] {
  return printed.split('\n').filter((line) => line !== '' && ! line.startsWith('commit ')).map((line) => {
    const [sha, ...subject] = line.split('\t')
    return { sha: FullSha.parse(sha), subject: subjectOf(subject.join('\t')) }
  })
}

/** What the program will do, in order */
export type Plan =
  | { kind: 'nothing', why: string }
  | { kind: 'finish', head: StepT }
  | { kind: 'walk', steps: StepT[], head: StepT, landsHead: boolean }

/**
 * The plan: nothing when the head is recorded and backfilled; finishing the head's backfills when
 * it is recorded but they are not; else the steps after the mark, and the head after them unless
 * it is the last step.
 *
 * @param mark  - The target's newest recorded step, or null for a target with none.
 * @param steps - The schema steps after the mark, oldest first.
 * @param head  - The ref's head.
 *
 * @example planOf({ sha: head.sha, backfilled_at: 1 }, [], head)  // => { kind: 'nothing', why: '…' }
 * @example planOf({ sha: head.sha, backfilled_at: null }, [], head)  // => { kind: 'finish', head }
 * @example planOf(older, [stepA, stepB], head)  // => { kind: 'walk', steps: [stepA, stepB], head, landsHead: true }
 */
export function planOf(mark: Pick<NonNullable<MarkT>, 'sha' | 'backfilled_at'> | null, steps: readonly StepT[], head: StepT): Plan {
  if (mark?.sha === head.sha) {
    return mark.backfilled_at === null ? { kind: 'finish', head } : { kind: 'nothing', why: `${short(head.sha)} is recorded, pushed and backfilled: nothing to do.` }
  }
  return { kind: 'walk', steps: [...steps], head, landsHead: steps.at(-1)?.sha !== head.sha }
}

/**
 * The newest step an export's `schema_steps` table holds, from its `documents.jsonl`: the one
 * pushed last.
 *
 * @example newestExported('{"sha":"84de…","subject":"a","pushed_at":1,"backfilled_at":1}\n{"sha":"9e8d…","subject":"b","pushed_at":2,"backfilled_at":null}\n')  // => { sha: '9e8d…', … }
 * @example newestExported('')  // => null
 */
export function newestExported(jsonl: string): z.infer<typeof ExportedStep> | null {
  const rows = jsonl.split('\n').filter((line) => line.trim() !== '').map((line) => ExportedStep.parse(JSON.parse(line)))
  return rows.toSorted((aa, bb) => bb.pushed_at - aa.pushed_at)[0] ?? null
}

/** One function of a deployment's spec, as `convex function-spec` lists it: a function by identifier, or an HTTP action by method and path */
const SpecFunction = z.looseObject({ identifier: z.string().optional(), method: z.string().optional(), path: z.string().optional() })
const Spec = z.object({ functions: z.array(SpecFunction) })
export type SpecT = z.infer<typeof Spec>

/** What one entry of a spec is known by: its identifier, or `METHOD /path` for an HTTP action */
const specKeyOf = (fn: z.infer<typeof SpecFunction>) => fn.identifier ?? `${fn.method ?? ''} ${fn.path ?? ''}`

/**
 * The functions on which two deployments' specs differ: present in one alone, or shaped
 * differently (its kind, visibility, arguments or returns), by identifier (an HTTP action by its
 * method and path), sorted. Empty when the two deployments hold the same functions.
 *
 * @example specDiff({ functions: [fnA] }, { functions: [fnA] })  // => []
 * @example specDiff({ functions: [fnA, fnB] }, { functions: [fnA] })  // => ['b.js:two']
 * @example specDiff({ functions: [jwks] }, { functions: [] })  // => ['GET /.well-known/jwks.json']
 */
export function specDiff(one: SpecT, two: SpecT): string[] {
  const byId = (spec: SpecT) => new Map(spec.functions.map((fn) => [specKeyOf(fn), fn]))
  const [ones, twos] = [byId(one), byId(two)]
  const identifiers = new Set([...ones.keys(), ...twos.keys()])
  return [...identifiers].filter((identifier) => ! isDeepStrictEqual(ones.get(identifier), twos.get(identifier))).toSorted(alphabetically)
}

/** A sha as the program prints it */
const short = (sha: string) => sha.slice(0, 8)

/** For sorting names into a stable order */
const alphabetically = (aa: string, bb: string) => aa.localeCompare(bb)

/** Lines describing a plan, for a dry run and for the start of a real one */
export function describePlan(plan: Plan): string[] {
  if (plan.kind === 'nothing') { return [plan.why] }
  if (plan.kind === 'finish') { return [`${short(plan.head.sha)} is pushed but its backfills never finished: finish them, seed, and record it.`] }
  const count = String(plan.steps.length)
  const steps = plan.steps.map((step, idx) => `Step ${String(idx + 1)} of ${count}: ${short(step.sha)} ${step.subject}`)
  return plan.landsHead ? [...steps, `Then the head: ${short(plan.head.sha)} ${plan.head.subject}`] : steps
}

// ---- The real thing: git, the convex CLI, worktrees ----

/** Runs git in `cwd` and hands back what it printed; a failure throws with what git said */
function git(cwd: string, ...args: string[]): string {
  // eslint-disable-next-line sonarjs/no-os-command-from-path -- the installed git, whichever it is
  const ran = spawnSync('git', args, { cwd, encoding: 'utf8' })
  if (ran.status !== 0) { throw new DeployStop(`git ${args.join(' ')}: ${(ran.stderr || ran.stdout).trim()}`) }
  return ran.stdout.trim()
}

/** Whether git, run in `cwd`, succeeds */
function gitOk(cwd: string, ...args: string[]): boolean {
  // eslint-disable-next-line sonarjs/no-os-command-from-path -- as git() above
  return spawnSync('git', args, { cwd, encoding: 'utf8' }).status === 0
}

/** Runs `pnpm exec convex <args>` in `cwd` with `env`, its output to the terminal; whether it succeeded */
function convexCliOk(cwd: string, env: Record<string, string | undefined>, ...args: string[]): boolean {
  // eslint-disable-next-line sonarjs/no-os-command-from-path -- the pnpm this checkout already runs
  return spawnSync('pnpm', ['exec', 'convex', ...args], { cwd, env: { ...process.env, ...env }, encoding: 'utf8', stdio: 'inherit' }).status === 0
}

/** As `convexCliOk`, but a failure throws */
function convexCli(cwd: string, env: Record<string, string | undefined>, ...args: string[]): void {
  if (! convexCliOk(cwd, env, ...args)) { throw new DeployStop(`convex ${args.join(' ')} failed: see above.`) }
}

/** A target deployment: how the convex CLI is pointed at it, and how its code is pushed */
interface Target {
  label:  string
  env:    Record<string, string | undefined>
  push:   string[]
  isRole: boolean
}

/** The deployment the environment names: a deploy key, or a self-hosted URL */
function cloudTarget(env: NodeJS.ProcessEnv): Target {
  const key = env.CONVEX_DEPLOY_KEY
  const selfHosted = env.CONVEX_SELF_HOSTED_URL
  if (! key && ! selfHosted) { throw new DeployStop('No CONVEX_DEPLOY_KEY (or CONVEX_SELF_HOSTED_URL) in the environment: name the deployment, or a local role with --role.') }
  const keyname = key?.split('|', 1)[0] ?? ''
  const label = key ? `the deployment of key ${keyname}` : `the self-hosted deployment at ${selfHosted ?? ''}`
  return { label, env: {}, push: ['deploy', '--typecheck', 'disable', '--codegen', 'disable'], isRole: false }
}

/** A local role's backend, from its cli.env, started if it is not answering (and made, on its first start) */
async function roleTarget(root: string, role: Role, cleanup: (() => void)[]): Promise<Target> {
  const clienv = path.join(root, 'data', `convex-${role}`, 'cli.env')
  if (! fs.existsSync(clienv)) {
    process.stdout.write(`The ${role} role has no backend yet: starting one.\n`)
    startBackend(root, role, cleanup)
    await until(() => Promise.resolve(fs.existsSync(clienv)), `the ${role} backend to write ${path.relative(root, clienv)}`)
  }
  const env = envOf(clienv)
  const url = env.CONVEX_SELF_HOSTED_URL ?? ''
  if (! /^http:\/\/127\.0\.0\.1:\d+$/.test(url)) { throw new DeployStop(`${path.relative(root, clienv)} names ${url || 'no backend'}, not a local one: refusing.`) }
  if (! await answering(url)) {
    startBackend(root, role, cleanup)
    await until(() => answering(url), `the ${role} backend to answer at ${url}`)
  }
  return { label: `the ${role} role's backend at ${url}`, env, push: ['dev', '--once', '--typecheck', 'disable', '--codegen', 'disable', '--tail-logs', 'disable'], isRole: true }
}

/** The CLI's environment for a role's backend, from its cli.env (read line by line, never sourced: the admin key holds a `|`), with no cloud deployment named */
function envOf(clienv: string): Record<string, string | undefined> {
  const env: Record<string, string | undefined> = { CONVEX_DEPLOY_KEY: undefined, CONVEX_DEPLOYMENT: undefined }
  for (const line of fs.readFileSync(clienv, 'utf8').split('\n')) {
    const eq = line.indexOf('=')
    const envname = line.slice(0, Math.max(eq, 0))
    if (envname === 'CONVEX_SELF_HOSTED_URL' || envname === 'CONVEX_SELF_HOSTED_ADMIN_KEY') { env[envname] = line.slice(eq + 1) }
  }
  return env
}

/** Waits up to a minute, a second at a time, for `ready`; a stop names `what` was waited for */
async function until(ready: () => Promise<boolean>, what: string): Promise<void> {
  for (let tries = 0; tries < 60; tries += 1) {
    if (await ready()) { return }
    await sleep(1000)
  }
  throw new DeployStop(`Gave up waiting for ${what}.`)
}

/** Starts the role's backend (scripts/convex_backend), to be stopped on the way out */
function startBackend(root: string, role: Role, cleanup: (() => void)[]): void {
  const child = spawn(path.join(root, 'scripts', 'convex_backend'), [role], { cwd: root, stdio: 'ignore' })
  cleanup.push(() => { child.kill() })
}

/** Whether a backend answers at `url` */
async function answering(url: string): Promise<boolean> {
  try {
    const answer = await fetch(`${url}/version`, { signal: AbortSignal.timeout(2000) })
    return answer.ok
  } catch {
    return false
  }
}

/** The target's mark, or null for a target whose table is empty or whose code predates the table */
function markOf(root: string, target: Target): { mark: MarkT, said: string } {
  let mark: MarkT
  try {
    mark = Mark.parse(convexRun('deploying:newest', undefined, { cwd: root, env: target.env, quiet: true }))
  } catch {
    return { mark: null, said: `${target.label} has no migrations table yet (its code predates it).` }
  }
  if (mark === null) { return { mark, said: `${target.label} records no step yet.` } }
  const backfilled = mark.backfilled_at === null ? 'backfills unfinished' : 'backfilled'
  return { mark, said: `${target.label} records ${short(mark.sha)} (${mark.subject}), ${backfilled}.` }
}

/** The step `sha` is, as the table records it: the sha in full, and the commit's subject */
function stepAt(root: string, ref: string): StepT {
  const sha = git(root, 'rev-parse', '--verify', [ref, '^{commit}'].join(''))
  return { sha, subject: subjectOf(git(root, 'log', '-1', '--format=%s', sha)) }
}

/** The schema steps between `from` and `to`, oldest first (`stepsOf`) */
function stepsBetween(root: string, from: string, to: string): StepT[] {
  return stepsOf(git(root, 'rev-list', '--first-parent', '--reverse', '--format=%H%x09%s', `${from}..${to}`, '--', ...StepPaths))
}

/** A scratch worktree at `sha`, with the checkout's node_modules unless its lockfile differs, in which case it installs its own */
function worktreeAt(root: string, sha: string, cleanup: (() => void)[]): string {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'triquet-deploy-'))
  cleanup.push(() => {
    if (gitOk(root, 'worktree', 'remove', '--force', scratch)) { return }
    fs.rmSync(scratch, { recursive: true, force: true })
    gitOk(root, 'worktree', 'prune')
  })
  git(root, '-c', 'core.hooksPath=/dev/null', 'worktree', 'add', '--quiet', '--detach', scratch, sha)
  const sameLock = fs.readFileSync(path.join(root, 'pnpm-lock.yaml'), 'utf8') === fs.readFileSync(path.join(scratch, 'pnpm-lock.yaml'), 'utf8')
  if (sameLock) {
    fs.symlinkSync(path.join(root, 'node_modules'), path.join(scratch, 'node_modules'))
  } else {
    process.stdout.write(`  ${short(sha)}'s lockfile differs from the checkout's: installing its packages.\n`)
    // eslint-disable-next-line sonarjs/no-os-command-from-path -- the pnpm this checkout already runs
    execFileSync('pnpm', ['install', '--frozen-lockfile', '--prefer-offline'], { cwd: scratch, stdio: 'inherit' })
  }
  return scratch
}

/** Runs `fn` on the target, saying so if the target's code lacks it (a step from before the function existed) */
function tryRun(root: string, target: Target, fn: string, args?: Record<string, unknown>): void {
  try {
    convexRun(fn, args, { cwd: root, env: target.env, quiet: true })
  } catch (err) {
    const why = err instanceof Error ? err.message.split('\n', 1)[0] ?? '' : String(err)
    process.stdout.write(`  ${fn} could not be run on this step (its code may predate it): ${why}\n`)
  }
}

/** Pushes `step`'s code to the target from a worktree at it, records it pushed, runs its backfills to the end, seeds, and records it backfilled */
async function takeStep(root: string, target: Target, step: StepT, wait: number, cleanup: (() => void)[]): Promise<void> {
  const began = Date.now()
  const scratch = worktreeAt(root, step.sha, cleanup)
  convexCli(scratch, target.env, ...target.push)
  process.stdout.write(`  pushed in ${seconds(began)}s.\n`)
  tryRun(root, target, 'deploying:recordPushed', step)
  const ran = await runBackfills(wait, { cwd: root, env: target.env })
  sayIndented(ran.lines)
  if (ran.standing !== 'done') { throw new DeployStop(`Stopped at ${short(step.sha)}: its backfills did not finish. The deployment serves it, whole; fix the backfill in a new commit and run this again.`) }
  tryRun(root, target, 'seeding:seedWidgets')
  tryRun(root, target, 'deploying:recordBackfilled', step)
  cleanup.pop()?.()
  process.stdout.write(`  done in ${seconds(began)}s.\n`)
}

/** Finishes the backfills of a head already pushed, seeds, and records it */
async function finishHead(root: string, target: Target, head: StepT, wait: number): Promise<void> {
  const ran = await runBackfills(wait, { cwd: root, env: target.env })
  sayIndented(ran.lines)
  if (ran.standing !== 'done') { throw new DeployStop(`${short(head.sha)}'s backfills did not finish; fix the backfill in a new commit and run this again.`) }
  convexRun('seeding:seedWidgets', undefined, { cwd: root, env: target.env })
  convexRun('deploying:recordBackfilled', head, { cwd: root, env: target.env })
}

/** Takes a snapshot of a cloud target to `snapshot`, or data/snapshots/<time>.zip */
function snapshotOf(root: string, target: Target, snapshot: string | undefined): string {
  const file = snapshot ?? path.join(root, 'data', 'snapshots', `${new Date().toISOString().replaceAll(/[:.]/g, '-')}.zip`)
  fs.mkdirSync(path.dirname(file), { recursive: true })
  convexCli(root, target.env, 'export', '--path', file)
  return file
}

/** Brings a role to the step a snapshot was taken at, imports the snapshot over everything it holds, and hands back that step */
async function rehearseFrom(root: string, target: Target, zip: string, from: string | undefined, cleanup: (() => void)[]): Promise<string> {
  // eslint-disable-next-line sonarjs/no-os-command-from-path -- the system's unzip, reading one member of the snapshot
  const listed = spawnSync('unzip', ['-p', zip, 'schema_steps/documents.jsonl'], { encoding: 'utf8' })
  const exported = listed.status === 0 ? newestExported(listed.stdout) : null
  const at = exported?.sha ?? from
  if (at === undefined) { throw new DeployStop(`${zip} holds no schema_steps table (it was taken before the table existed): say which step its rows stand at with --from <sha>.`) }
  const named = exported ? ` (${exported.subject})` : ' (--from)'
  process.stdout.write(`Rehearsal: the snapshot stands at ${short(at)}${named}. Pushing that step to the role, then importing over everything it holds.\n`)
  const scratch = worktreeAt(root, at, cleanup)
  convexCli(scratch, target.env, ...target.push)
  cleanup.pop()?.()
  convexCli(root, target.env, 'import', '--replace-all', '-y', zip)
  await sleep(0)
  return at
}

/** Whole seconds since `began` */
const seconds = (began: number) => String(Math.round((Date.now() - began) / 1000))

/** Prints `lines`, each indented two spaces */
function sayIndented(lines: readonly string[]): void {
  const indented = lines.map((line) => `  ${line}`).join('\n')
  process.stdout.write(`${indented}\n`)
}

/** The target's function spec, as the CLI prints it */
function specOf(root: string, env: Record<string, string | undefined>): SpecT {
  // eslint-disable-next-line sonarjs/no-os-command-from-path -- the pnpm this checkout already runs
  const ran = spawnSync('pnpm', ['exec', 'convex', 'function-spec'], { cwd: root, env: { ...process.env, ...env }, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
  if (ran.status !== 0) { throw new DeployStop(`convex function-spec failed: ${ran.stderr.trim().split('\n', 1)[0] ?? ''}`) }
  return Spec.parse(JSON.parse(ran.stdout))
}

/**
 * Checks the target holds the functions of the step its table says it stands at: that step is
 * pushed to the `verify` role, emptied first, and the two function specs must agree.
 *
 * @throws When they differ, naming the functions that do.
 */
async function verified(root: string, target: Target, standsAt: string, verify: Role, cleanup: (() => void)[]): Promise<void> {
  process.stdout.write(`Verifying: pushing ${short(standsAt)} to the ${verify} role and comparing its functions with the target's.\n`)
  const role = await roleTarget(root, verify, cleanup)
  const scratch = worktreeAt(root, standsAt, cleanup)
  if (! convexCliOk(scratch, role.env, ...role.push)) {
    // Its rows refuse the step's schema: empty it (which its own functions do), and push again.
    process.stdout.write(`  The ${verify} role's rows do not fit ${short(standsAt)}: emptying it and pushing again.\n`)
    convexCli(root, role.env, 'env', 'set', 'TRIQUET_CLEARABLE', 'yes')
    const emptied = spawnSync(path.join(root, 'scripts', 'convex_reset'), [verify], { cwd: root, env: { ...process.env, ...role.env }, stdio: 'inherit' })
    if (emptied.status !== 0) { throw new DeployStop(`Could not empty the ${verify} role to verify against.`) }
    convexCli(scratch, role.env, ...role.push)
  }
  cleanup.pop()?.()
  const differing = specDiff(specOf(root, role.env), specOf(root, target.env))
  if (differing.length > 0) {
    throw new DeployStop(`${target.label} does not hold the functions of ${short(standsAt)}, which its table says it stands at. Differing: ${differing.join(', ')}. Say where it really stands with --from <sha>, or look before walking.`)
  }
  process.stdout.write(`Verified: ${target.label} holds ${short(standsAt)}'s functions.\n`)
}

/** Where the target stands, and what the program will do about it */
async function surveyed(root: string, target: Target, asked: Asked, cleanup: (() => void)[]): Promise<{ to: string, head: StepT, plan: Plan }> {
  const to = asked.to ?? (asked.role === undefined ? 'origin/main' : 'HEAD')
  if (to.startsWith('origin/')) { git(root, 'fetch', '--quiet', 'origin', to.slice('origin/'.length)) }
  const head = stepAt(root, to)
  let {from} = asked
  if (asked.rehearse !== undefined && ! asked.dryRun) { from = await rehearseFrom(root, target, asked.rehearse, asked.from, cleanup) }
  const { mark, said } = markOf(root, target)
  process.stdout.write(`${said}\n`)
  const standsAt = from ?? mark?.sha
  if (standsAt === undefined) { throw new DeployStop('Nothing says which step the target\'s rows stand at: say so with --from <sha> (production\'s /stats names the commit it serves).') }
  if (! gitOk(root, 'merge-base', '--is-ancestor', standsAt, head.sha)) {
    throw new DeployStop(`The target stands at ${short(standsAt)}, which is not in ${to}'s history: this checkout cannot walk it forward. If you know better, say so with --from <sha>.`)
  }
  if (asked.verify !== undefined) { await verified(root, target, standsAt, asked.verify, cleanup) }
  const standing = from === undefined ? mark : { sha: from, backfilled_at: from === mark?.sha ? mark.backfilled_at : null }
  return { to, head, plan: planOf(standing, stepsBetween(root, standsAt, head.sha), head) }
}

/** Carries a plan out against the target */
async function carriedOut(root: string, target: Target, plan: Plan, asked: Asked, cleanup: (() => void)[]): Promise<void> {
  if (plan.kind === 'nothing') { return }
  if (plan.kind === 'finish') {
    await finishHead(root, target, plan.head, asked.wait)
    return
  }
  if (! target.isRole) { process.stdout.write(`Snapshot: ${snapshotOf(root, target, asked.snapshot)}\n`) }
  const all = plan.landsHead ? [...plan.steps, plan.head] : plan.steps
  for (const [idx, step] of all.entries()) {
    process.stdout.write(`\n[${String(idx + 1)}/${String(all.length)}] ${short(step.sha)} ${step.subject}\n`)
    await takeStep(root, target, step, asked.wait, cleanup)
  }
}

/** The command line, carried out */
async function main(argv: readonly string[], env: NodeJS.ProcessEnv): Promise<void> {
  const asked = argsOf(argv)
  const root = git(process.cwd(), 'rev-parse', '--show-toplevel')
  const cleanup: (() => void)[] = []
  try {
    const target = asked.role === undefined ? cloudTarget(env) : await roleTarget(root, asked.role, cleanup)
    const { to, head, plan } = await surveyed(root, target, asked, cleanup)
    process.stdout.write(`Target: ${target.label}. Head: ${to} at ${short(head.sha)}.\n${describePlan(plan).join('\n')}\n`)
    if (asked.dryRun || plan.kind === 'nothing') { return }
    await carriedOut(root, target, plan, asked, cleanup)
    const { TRIQUET_DEPLOY_HOOK_URL: hook } = env
    if (hook && ! target.isRole) {
      const posted = await fetch(hook, { method: 'POST' })
      process.stdout.write(`Deploy hook posted: ${String(posted.status)}.\n`)
    }
    process.stdout.write(`\n${target.label} is at ${short(head.sha)}, backfilled.\n`)
  } finally {
    for (const undo of cleanup.toReversed()) { undo() }
  }
}

if (import.meta.main) {
  try {
    await main(process.argv.slice(2), process.env)
  } catch (err) {
    console.error(err instanceof DeployStop ? err.message : err)
    process.exitCode = 1
  }
}
