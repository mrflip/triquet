/**
 * The guard every command meant for `./scripts/doppledo prd_janitor ...` stands behind: it does
 * nothing but look unless it is told, by `--deployment <name>`, which deployment it is to act on,
 * and that name is checked against the deployment the environment's key actually reaches, by the
 * address that deployment reports for itself (its own `cloudUrl`, which `convex function-spec`
 * reads from it with the same admin key). A name typed on the command line never vouches for
 * itself, so the guard cannot be talked past by typing the wrong name twice.
 *
 * * Without `--deployment`: a dry run. The command says what it would do, and ends by naming the
 *   deployment it reached, so the person running it sees where it is aimed before it acts.
 * * With `--deployment <name>` naming the deployment reached: the command acts.
 * * With a name of any other deployment: it stops before doing anything at all.
 *
 * A deployment's name is the one Convex gives it (`careful-otter-123`, from
 * `https://careful-otter-123.convex.cloud`), or, for a local backend, its host and port
 * (`127.0.0.1:3431`), which a run against a lane's backend proves the command with:
 *
 *   ./scripts/doppledo prd_janitor scripts/<command>                                       a dry run
 *   ./scripts/doppledo prd_janitor scripts/<command> --deployment careful-otter-123        for real
 *   ./scripts/doppledo dev_claude scripts/convex_dev agent scripts/<command>              a lane's backend, dry
 *
 * A command takes aim first (`takeAim`), says where (`aim.said`), does its looking, and acts only
 * when `aim.acting`; a dry run ends with `dryRunCoda(aim)`. Its own `main` catches a `JanitorStop`
 * and prints its message alone (`stopOrThrow`).
 */
import { spawnSync } from 'node:child_process'
import { z } from 'zod'

/** The flag naming the deployment a command is to act on */
export const DeploymentFlag = '--deployment'

/** A stop with a reason for the person running the command, printed without a stack */
export class JanitorStop extends Error {}

/** The deployment the environment reaches: its name, and its address */
export type ReachedT = { deployment: string, url: string }

/** Where a command is aimed, and whether it is to act there or only look */
export type AimT = ReachedT & { acting: boolean, said: string }

/**
 * A deployment's name, from its address: the name Convex gives a cloud deployment, the first part
 * of its host; for any other (a local backend), its host and port.
 *
 * @example deploymentNameOf('https://careful-otter-123.convex.cloud')  // => 'careful-otter-123'
 * @example deploymentNameOf('http://127.0.0.1:3431')                   // => '127.0.0.1:3431'
 * @example deploymentNameOf('not an address')                          // throws
 */
export function deploymentNameOf(url: string): string {
  const { host, hostname } = new URL(url)
  if (hostname.endsWith('.convex.cloud')) { return hostname.slice(0, -'.convex.cloud'.length) }
  return host
}

/**
 * The deployment `--deployment` names, if any, and the rest of the command line, in order, for the
 * command's own flags.
 *
 * @example namedIn(['--deployment', 'careful-otter-123'])            // => { named: 'careful-otter-123', rest: [] }
 * @example namedIn(['--email', 'pat@example.com'])                   // => { named: undefined, rest: ['--email', 'pat@example.com'] }
 * @example namedIn(['--deployment'])                                 // throws: it needs a name
 * @example namedIn(['--deployment', 'one', '--deployment', 'two'])   // throws: one deployment at a time
 */
export function namedIn(argv: readonly string[]): { named: string | undefined, rest: string[] } {
  const at = argv.indexOf(DeploymentFlag)
  if (at === -1) { return { named: undefined, rest: [...argv] } }
  const named = argv[at + 1]
  if (named === undefined || named.startsWith('--')) { throw new JanitorStop(`${DeploymentFlag} needs the name of the deployment to act on: run without it first, to see the name.`) }
  const rest = [...argv.slice(0, at), ...argv.slice(at + 2)]
  if (rest.includes(DeploymentFlag)) { throw new JanitorStop(`${DeploymentFlag} is given twice: name one deployment.`) }
  return { named, rest }
}

/**
 * Where a command is aimed: a dry run unless `named` is given, and acting when it names the
 * deployment `reached`.
 *
 * @param named - The deployment the command line names, if it names one.
 * @param reached - The deployment the environment reaches.
 * @returns The deployment, whether to act on it, and a line saying so.
 * @throws When `named` is some other deployment than the one reached.
 *
 * @example aimFor(undefined, { deployment: 'careful-otter-123', url })             // => { ..., acting: false, said: 'Aimed at careful-otter-123 (https://…): a dry run, which changes nothing.' }
 * @example aimFor('careful-otter-123', { deployment: 'careful-otter-123', url })   // => { ..., acting: true, said: 'Aimed at careful-otter-123 (https://…), as --deployment names it: acting.' }
 * @example aimFor('happy-heron-456', { deployment: 'careful-otter-123', url })     // throws: not the deployment reached
 */
export function aimFor(named: string | undefined, reached: ReachedT): AimT {
  const { deployment, url } = reached
  if (named === undefined) { return { ...reached, acting: false, said: `Aimed at ${deployment} (${url}): a dry run, which changes nothing.` } }
  if (named !== deployment) {
    throw new JanitorStop(`${DeploymentFlag} names ${named}, but this environment reaches ${deployment} (${url}). Nothing was done. Check which Doppler config you ran under.`)
  }
  return { ...reached, acting: true, said: `Aimed at ${deployment} (${url}), as ${DeploymentFlag} names it: acting.` }
}

/**
 * The line a dry run ends with: what to add to act, on the deployment it reached.
 *
 * @example dryRunCoda(aim)  // => 'A dry run: nothing was changed. To act on careful-otter-123, run again with --deployment careful-otter-123.'
 */
export function dryRunCoda(aim: Pick<AimT, 'deployment'>): string {
  return `A dry run: nothing was changed. To act on ${aim.deployment}, run again with ${DeploymentFlag} ${aim.deployment}.`
}

/** What `convex function-spec` says of the deployment it reached: the address that deployment reports for itself, at least */
const SpecAddress = z.looseObject({ url: z.url() })

/** How many bytes of function spec are read at most: the whole app's, several times over */
const SpecBytesMax = 64 * 1024 * 1024

/**
 * The deployment the convex CLI reaches from this environment (a deploy key, or a local backend's
 * address and admin key), by the address that deployment reports for itself: its `cloudUrl`,
 * which `convex function-spec` reads from it with the same admin key, and which is not the address
 * the CLI connected to. Run from `cwd`, the checkout. Reads, and writes nothing.
 *
 * @throws When the CLI reaches no deployment.
 */
export function reachedDeployment(cwd?: string): ReachedT {
  // eslint-disable-next-line sonarjs/no-os-command-from-path -- the pnpm this checkout already runs
  const ran = spawnSync('pnpm', ['exec', 'convex', 'function-spec'], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: SpecBytesMax })
  if (ran.status !== 0) {
    const said = (ran.stderr || ran.stdout || String(ran.error ?? '')).trim().split('\n', 2).join(' ')
    throw new JanitorStop(`This environment reaches no Convex deployment (convex function-spec: ${said}). Run under a janitor's Doppler config, or against a local backend (scripts/convex_dev <role> ...).`)
  }
  const { url } = SpecAddress.parse(JSON.parse(ran.stdout))
  return { deployment: deploymentNameOf(url), url }
}

/**
 * Where the command is aimed, from its command line and the deployment the environment reaches,
 * and the rest of the command line for the command's own flags. A command takes aim before it
 * does anything else.
 *
 * @param argv - The command line, `--deployment <name>` among the command's own flags, if given.
 * @param reach - How the deployment reached is learned: `reachedDeployment`, but in a test.
 * @throws As `namedIn` and `aimFor` do, before anything is reached or done.
 *
 * @example const { aim, rest } = takeAim(process.argv.slice(2)); console.log(aim.said)
 */
export function takeAim(argv: readonly string[], reach: () => ReachedT = reachedDeployment): { aim: AimT, rest: string[] } {
  const { named, rest } = namedIn(argv)
  return { aim: aimFor(named, reach()), rest }
}

/**
 * A command's way out on a failure: a `JanitorStop`'s message alone, for the person running it;
 * anything else whole, stack and all. Either way the process exits 1.
 *
 * @example try { await main() } catch (err) { stopOrThrow(err) }
 */
export function stopOrThrow(err: unknown): void {
  console.error(err instanceof JanitorStop ? err.message : err)
  process.exitCode = 1
}
