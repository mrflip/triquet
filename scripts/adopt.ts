/**
 * Gives one user what only the command line may: a userlabel, though a hunt's address holds it;
 * the admin flag; a role on one hunt or on every hunt. Through `adopt:plan`, which says what would
 * change and writes nothing, and `adopt:perform`, which changes it. Behind the janitor's guard
 * (`scripts/janitor.ts`): a dry run unless `--deployment` names the deployment reached. Running it
 * again changes nothing more: a role is never lowered, and what the user holds already is kept.
 *
 *   ./scripts/doppledo prd_janitor scripts/adopt --email <the Coach's> --userlabel mrflip --admin --smith-all
 *   ./scripts/doppledo dev_claude scripts/convex_dev agent scripts/adopt --holding flippy_kromer --admin
 *
 * Exits 0 when it has said what it would do, or done it; 1 when it stops.
 */
import { parseArgs } from 'node:util'
import * as Addresses from '../src/lib/addresses'
import * as Stamps from '../src/lib/stamps'
import { AdoptionValidators, type AdoptChangeT, type AdoptedT, type AdoptionDNA } from '../src/models/adoption'
import { HuntRoleTitles, type HuntRole } from '../src/models/huntship'
import { convexRun } from './convex-migrations.ts'
import { dryRunCoda, JanitorStop, stopOrThrow, takeAim } from './janitor.ts'

/** How a function on the deployment is run: its path and arguments, and what it answered */
export type RunT = (fnpath: string, args: Record<string, unknown>) => unknown

/** How the command is called, for a person who called it otherwise */
export const Usage = [
  'Usage: scripts/adopt (--email <address> | --holding <userlabel> | --id <user id>)',
  '         [--userlabel <userlabel>] [--title <title>] [--admin | --no-admin]',
  '         [--smith <~org/hunt>]... [--reviewer <~org/hunt>]... [--smith-all] [--reviewer-all]',
  '         [--deployment <name>]',
].join('\n')

/** The command's own flags, beside the guard's `--deployment` */
const Flags = {
  'email':        { type: 'string' },
  'holding':      { type: 'string' },
  'id':           { type: 'string' },
  'userlabel':    { type: 'string' },
  'title':        { type: 'string' },
  'admin':        { type: 'boolean' },
  'no-admin':     { type: 'boolean' },
  'smith':        { type: 'string', multiple: true },
  'reviewer':     { type: 'string', multiple: true },
  'smith-all':    { type: 'boolean' },
  'reviewer-all': { type: 'boolean' },
} as const

/**
 * The hunt a command line's `~org/hunt` names, as an adoption grants a role on it; a leading `/`
 * may be there or not.
 *
 * @example huntAt('~pat_smith/quiet_otter')   // => { org: 'pat_smith', hunt: 'quiet_otter' }
 * @example huntAt('/~pat_smith/quiet_otter')  // => { org: 'pat_smith', hunt: 'quiet_otter' }
 * @example huntAt('~pat_smith')               // throws: an org, not a hunt
 */
export function huntAt(raw: string): Addresses.InHuntT {
  const location = Addresses.locationFrom(raw.startsWith('/') ? raw : `/${raw}`)
  if (location?.address.kind !== 'hunt') { throw new JanitorStop(`${raw} is not a hunt's address: write it ~<org>/<hunt>.`) }
  const { org, hunt } = location.address
  return { org, hunt }
}

/**
 * What the command line asks, as `adopt:plan` and `adopt:perform` take it: the one way it finds
 * the user, and what to give it.
 *
 * @param rest - The command line, the guard's flag taken out.
 * @throws A `JanitorStop`, with the usage, for a flag it does not take, no way or two ways to find the user, or both `--admin` and `--no-admin`.
 *
 * @example requestFrom(['--email', 'flip@example.com', '--userlabel', 'mrflip', '--admin', '--smith-all'])
 *   // => { find: { email: 'flip@example.com' }, userlabel: 'mrflip', admin: true, grants: [{ role: 'smith', hunts: 'every' }] }
 */
export function requestFrom(rest: readonly string[]): AdoptionDNA {
  const flags = parsedFlags(rest)
  const finds = [
    ...(flags.email   === undefined ? [] : [{ email: flags.email }]),
    ...(flags.holding === undefined ? [] : [{ userlabel: flags.holding }]),
    ...(flags.id      === undefined ? [] : [{ user_id: flags.id }]),
  ]
  const [find, ...others] = finds
  if (! find || others.length > 0) { throw new JanitorStop(`Name the user one way: --email, --holding or --id.\n${Usage}`) }
  if (flags.admin && flags['no-admin']) { throw new JanitorStop(`--admin or --no-admin: not both.\n${Usage}`) }
  return {
    find,
    ...(flags.userlabel !== undefined && { userlabel: flags.userlabel }),
    ...(flags.title     !== undefined && { title: flags.title }),
    ...(flags.admin               && { admin: true }),
    ...(flags['no-admin']         && { admin: false }),
    grants: [...grantsOf('smith', flags.smith, flags['smith-all']), ...grantsOf('reviewer', flags.reviewer, flags['reviewer-all'])],
  }
}

/** The grants of `role` a command line asks: on every hunt, if `all`, and on each hunt `addresses` names */
function grantsOf(role: HuntRole, addresses: readonly string[] = [], all = false): NonNullable<AdoptionDNA['grants']> {
  return [
    ...(all ? [{ role, hunts: 'every' as const }] : []),
    ...addresses.map((raw) => ({ role, hunts: huntAt(raw) })),
  ]
}

/** The command line's flags, refused with the usage for one it does not take */
function parsedFlags(rest: readonly string[]) {
  try {
    return parseArgs({ args: [...rest], options: Flags, strict: true, allowPositionals: false }).values
  } catch (err) {
    throw new JanitorStop(`${err instanceof Error ? err.message : String(err)}\n${Usage}`)
  }
}

/**
 * The user an adoption found, as a line for a person: its id, userlabel and title, how it stood,
 * and, so the person knows it for theirs before it acts, the name Google sent and when its row was
 * made.
 *
 * @example userLine({ user_id, userlabel: 'flippy_kromer', title: 'Flip', anonymous: false, admin: false, name: 'Flip Kromer', created_at: 1791813787000 })
 *   // => 'The user <id>: @flippy_kromer (Flip), signed in with Google as "Flip Kromer", not an admin; made 2026-10-12T14:03:07.000Z.'
 * @example userLine({ user_id, userlabel: null, title: null, anonymous: true, admin: false, name: null, created_at: 1791813787000 })
 *   // => 'The user <id>: no userlabel, anonymous, not an admin; made 2026-10-12T14:03:07.000Z.'
 */
export function userLine(user: AdoptedT['user']): string {
  const held = user.userlabel === null ? 'no userlabel' : `@${user.userlabel} (${user.title ?? user.userlabel})`
  const named = user.name === null ? 'with no name sent' : `as "${user.name}"`
  const how = user.anonymous ? 'anonymous' : `signed in with Google ${named}`
  return `The user ${user.user_id}: ${held}, ${how}, ${user.admin ? 'an admin' : 'not an admin'}; made ${String(Stamps.isoOf(user.created_at))}.`
}

/**
 * One change an adoption made, or would make, as a line for a person.
 *
 * @example changeLine({ kind: 'userlabel', from: null, to: 'mrflip', title: 'Mrflip', huntships: 0, leaves: null })                // => '  userlabel mrflip, titled "Mrflip" (it held none)'
 * @example changeLine({ kind: 'userlabel', from: 'flippy_kromer', to: 'mrflip', title: 'Flip', huntships: 2, leaves: 'free' })     // => '  userlabel mrflip, titled "Flip" (it held flippy_kromer), and the copies on its 2 huntships; flippy_kromer is left free for anyone to claim'
 * @example changeLine({ kind: 'userlabel', from: 'flippy_kromer', to: 'mrflip', title: 'Flip', huntships: 2, leaves: 'address' })  // => '  userlabel mrflip, titled "Flip" (it held flippy_kromer), and the copies on its 2 huntships; flippy_kromer stays held by its hunts' address, ~flippy_kromer/…, so only this command gives it out'
 * @example changeLine({ kind: 'admin', to: true })                                                                                  // => '  an admin'
 * @example changeLine({ kind: 'huntship', org: 'pat_smith', hunt: 'quiet_otter', role: 'smith', from: 'reviewer' })                // => '  Smith of ~pat_smith/quiet_otter (a Reviewer there until now)'
 */
export function changeLine(change: AdoptChangeT): string {
  switch (change.kind) {
  case 'userlabel': {
    const copies = change.huntships === 0 ? '' : `, and the copies on its ${String(change.huntships)} huntships`
    return `  userlabel ${change.to}, titled "${change.title}" (it held ${change.from ?? 'none'})${copies}${leftLine(change)}`
  }
  case 'admin':     { return change.to ? '  an admin' : '  no longer an admin' }
  case 'huntship':  {
    const was = change.from === null ? '' : ` (a ${HuntRoleTitles[change.from]} there until now)`
    return `  ${HuntRoleTitles[change.role]} of ~${change.org}/${change.hunt}${was}`
  }
  }
}

/** What becomes of the userlabel a relabel leaves, as the end of its line: nothing, when it moves none */
function leftLine({ from, leaves }: Extract<AdoptChangeT, { kind: 'userlabel' }>): string {
  if (from === null || leaves === null) { return '' }
  return leaves === 'free' ? `; ${from} is left free for anyone to claim` : `; ${from} stays held by its hunts' address, ~${from}/…, so only this command gives it out`
}

/** How many anonymous users' sandboxes a grant on every hunt passed over, as a line for a person */
function skippedLine(skipped: number): string {
  if (skipped === 1) { return "Passed over 1 anonymous user's sandbox, which sealing keeps its own." }
  return `Passed over ${String(skipped)} anonymous users' sandboxes, which sealing keeps their own.`
}

/**
 * What an adoption came to, as lines for a person: the user, each change, how much it held
 * already, and the anonymous users' sandboxes a grant on every hunt passed over.
 *
 * @param outcome - What `adopt:plan` or `adopt:perform` answered.
 * @param acting - Whether the changes were made, or only would be.
 */
export function outcomeLines(outcome: AdoptedT, acting: boolean): string[] {
  const kept = outcome.kept === 0 ? [] : [`Held already: ${String(outcome.kept)} of what was asked.`]
  const skipped = outcome.skipped === 0 ? [] : [skippedLine(outcome.skipped)]
  const after = [...kept, ...skipped]
  if (outcome.changes.length === 0) { return [userLine(outcome.user), 'Nothing to change.', ...after] }
  return [userLine(outcome.user), acting ? 'Changed it to:' : 'Would change it to:', ...outcome.changes.map((change) => changeLine(change)), ...after]
}

/**
 * The command, carried out: aim, read what the command line asks, and say what would change, or
 * change it and say what did.
 *
 * @param argv - The command line, `--deployment <name>` among its flags when it is to act.
 * @param run - How a function on the deployment is run.
 * @param say - Where a line for the person running it goes.
 * @param reach - As `takeAim` takes it, for a test.
 * @returns What the deployment answered.
 */
export function adopt(argv: readonly string[], run: RunT, say: (line: string) => void, reach?: Parameters<typeof takeAim>[1]): AdoptedT {
  const { aim, rest } = takeAim(argv, reach)
  const request = requestFrom(rest)
  say(aim.said)
  const outcome = AdoptionValidators.outcome.parse(answerOf(run, aim.acting ? 'adopt:perform' : 'adopt:plan', request))
  for (const line of outcomeLines(outcome, aim.acting)) { say(line) }
  if (! aim.acting) { say(dryRunCoda(aim)) }
  return outcome
}

/** What the deployment answers `fnpath` with; a refusal, or a failure to reach it, stops the command with what it said */
function answerOf(run: RunT, fnpath: string, request: AdoptionDNA): unknown {
  try {
    return run(fnpath, request)
  } catch (err) {
    throw new JanitorStop(err instanceof Error ? err.message : String(err))
  }
}

if (import.meta.main) {
  try {
    const run: RunT = (fnpath, args) => convexRun(fnpath, args, { quiet: true })
    adopt(process.argv.slice(2), run, (line) => { process.stdout.write(`${line}\n`) })
  } catch (err) {
    stopOrThrow(err)
  }
}
