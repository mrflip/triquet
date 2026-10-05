/**
 * Lanes: ports of its own for every checkout in the container, so a worktree's servers and Convex
 * backends never meet another checkout's. The main checkout is lane 0, on the ports the project has
 * always used; a worktree claims a lane from 1 to 9 the first time anything asks for one, and each
 * role's ports move up by ten per lane. Databases and build directories need no lane: they live
 * inside each checkout (`data/convex-<role>/`, `.next-*`).
 *
 *   node scripts/lanes.ts lane            this checkout's lane, claimed if it has none
 *   node scripts/lanes.ts ports <role>    the role's web, backend and HTTP-action ports, space-separated
 *   node scripts/lanes.ts env <role>      NAME=value lines for scripts/as_role: PORT, NEXT_PUBLIC_CONVEX_URL, CONVEX_ROLE, TRIQUET_LANE
 *   node scripts/lanes.ts release         this worktree's lane, freed
 *
 * TRIQUET_LANE, when set, names the lane outright and nothing is claimed (CI, and tests).
 */
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

/** The highest lane a worktree may claim; lane 0 is the main checkout's */
export const MaxLane = 9

/**
 * Each role's place within a lane: its web port is 3000 plus this, its Convex backend 3400 plus
 * this, and the backend's HTTP actions 3500 plus this, each moved up by ten per lane. `dev` is
 * the Coach's; `agent-built` is `pnpm start:agent`'s server, which talks to the agent backend.
 */
export const RoleDigits = {
  "dev":         0,
  "agent":       1,
  "e2e":         2,
  "e2e-agent":   3,
  "agent-built": 4,
  "e2e-built":   5,
} as const

export type Role = keyof typeof RoleDigits

/** The roles whose servers talk to another role's backend rather than one of their own */
const BackendRoleFor: Partial<Record<Role, Role>> = { "agent-built": 'agent' }

/** A role's three ports in one lane */
export interface Ports {
  web:     number
  backend: number
  site:    number
}

/** Whether `val` names a role */
export function isRole(val: string): val is Role {
  return Object.hasOwn(RoleDigits, val)
}

/**
 * The ports `role` uses in `lane`.
 *
 * @param role - Whose ports.
 * @param lane - The checkout's lane, 0 to `MaxLane`.
 * @returns Its web server's port, and its Convex backend's and that backend's HTTP actions'.
 *
 * @example portsOf('agent', 0)        // => { web: 3001, backend: 3401, site: 3501 }
 * @example portsOf('e2e-agent', 1)    // => { web: 3013, backend: 3413, site: 3513 }
 * @example portsOf('agent-built', 2)  // => { web: 3024, backend: 3421, site: 3521 }
 */
export function portsOf(role: Role, lane: number): Ports {
  const offset = 10 * lane
  const backendDigit = RoleDigits[BackendRoleFor[role] ?? role]
  return { web: 3000 + offset + RoleDigits[role], backend: 3400 + offset + backendDigit, site: 3500 + offset + backendDigit }
}

/**
 * The variables `scripts/as_role` sets for `role` in `lane`, over whatever Doppler gave.
 *
 * @example envFor('e2e', 1)  // => { PORT: '3012', NEXT_PUBLIC_CONVEX_URL: 'http://127.0.0.1:3412', CONVEX_ROLE: 'e2e', TRIQUET_LANE: '1' }
 */
export function envFor(role: Role, lane: number): Record<string, string> {
  const ports = portsOf(role, lane)
  return {
    PORT:                   String(ports.web),
    NEXT_PUBLIC_CONVEX_URL: `http://127.0.0.1:${String(ports.backend)}`,
    CONVEX_ROLE:            role,
    TRIQUET_LANE:           String(lane),
  }
}

/**
 * The lane `TRIQUET_LANE` names, or undefined when it names none.
 *
 * @example givenLaneOf({ TRIQUET_LANE: '3' })  // => 3
 * @example givenLaneOf({})                     // => undefined
 * @example givenLaneOf({ TRIQUET_LANE: '10' }) // throws: not a lane
 */
export function givenLaneOf(env: Readonly<Record<string, string | undefined>>): number | undefined {
  const val = env.TRIQUET_LANE
  if (val === undefined || val === '') { return undefined }
  if (! /^\d$/.test(val)) { throw new Error(`TRIQUET_LANE=${val} is not a lane: 0 to ${String(MaxLane)}`) }
  return Number(val)
}

/**
 * The lane held for the worktree at `root`, claiming the lowest free one when it holds none. A
 * claim is a directory `<claimsdir>/<lane>` holding the root of the worktree it belongs to, made
 * with one `mkdir`, so two checkouts claiming at once never get the same lane. A claim whose
 * worktree no longer exists is free again.
 *
 * @param claimsdir - Where the repository's claims are kept, shared by all its worktrees.
 * @param root - The claiming worktree's root.
 * @returns A lane from 1 to `MaxLane`.
 *
 * @example claimLane('/repo/.git/triquet-lanes', '/home/node/worktrees/triquet/grid_fix')  // => 1
 */
export function claimLane(claimsdir: string, root: string): number {
  fs.mkdirSync(claimsdir, { recursive: true })
  const lanes = Array.from({ length: MaxLane }, (_unused, idx) => idx + 1)
  const held = lanes.find((lane) => claimantOf(claimsdir, lane) === root)
  if (held !== undefined) { return held }
  for (const lane of lanes) {
    const claimant = claimantOf(claimsdir, lane)
    if (claimant !== undefined && ! fs.existsSync(claimant)) { fs.rmSync(path.join(claimsdir, String(lane)), { recursive: true, force: true }) }
    if (tryClaim(claimsdir, lane, root)) { return lane }
  }
  throw new Error(`Every lane from 1 to ${String(MaxLane)} is held (${claimsdir}): remove a worktree you are done with first.`)
}

/**
 * Frees the lane held for the worktree at `root`, if it holds one.
 *
 * @returns The lane freed, or undefined.
 */
export function releaseLane(claimsdir: string, root: string): number | undefined {
  const lanes = Array.from({ length: MaxLane }, (_unused, idx) => idx + 1)
  const held = lanes.find((lane) => claimantOf(claimsdir, lane) === root)
  if (held !== undefined) { fs.rmSync(path.join(claimsdir, String(held)), { recursive: true, force: true }) }
  return held
}

/** The root of the worktree holding `lane`, or undefined when it is free (or being claimed this instant) */
function claimantOf(claimsdir: string, lane: number): string | undefined {
  try {
    return fs.readFileSync(path.join(claimsdir, String(lane), 'root'), 'utf8').trim() || undefined
  } catch {
    return undefined
  }
}

/** Whether `lane` was free and is now `root`'s */
function tryClaim(claimsdir: string, lane: number, root: string): boolean {
  try {
    fs.mkdirSync(path.join(claimsdir, String(lane)))
  } catch {
    return false
  }
  fs.writeFileSync(path.join(claimsdir, String(lane), 'root'), `${root}\n`)
  return true
}

/** Where the git checkout at `cwd` stands: its root, whether it is the main checkout, and where its repository keeps lane claims */
export function checkoutAt(cwd: string): { root: string, isMain: boolean, claimsdir: string } {
  const args = ['rev-parse', '--path-format=absolute', '--git-dir', '--git-common-dir', '--show-toplevel']
  // eslint-disable-next-line sonarjs/no-os-command-from-path -- the installed git, whichever it is, is the one keeping this checkout
  const said = execFileSync('git', args, { cwd, encoding: 'utf8' })
  const [gitdir = '', commondir = '', root = ''] = said.trim().split('\n', 3)
  return { root, isMain: gitdir === commondir, claimsdir: path.join(commondir, 'triquet-lanes') }
}

/** The lane of the checkout at `cwd`: `TRIQUET_LANE` if set, 0 for the main checkout, else the worktree's claim */
export function laneHere(env: Readonly<Record<string, string | undefined>>, cwd: string): number {
  const given = givenLaneOf(env)
  if (given !== undefined) { return given }
  const checkout = checkoutAt(cwd)
  return checkout.isMain ? 0 : claimLane(checkout.claimsdir, checkout.root)
}

const Usage = `Usage: node scripts/lanes.ts lane | ports <role> | env <role> | release, with <role> one of ${Object.keys(RoleDigits).join(', ')}`

/** The role named on the command line */
function roleArg(val: string | undefined): Role {
  if (val !== undefined && isRole(val)) { return val }
  throw new Error(Usage)
}

/** What the command line asks for, as the lines to print */
function main(args: readonly string[]): string {
  const [command, rolename] = args
  const cwd = process.cwd()
  switch (command) {
  case 'lane': {
    return String(laneHere(process.env, cwd))
  }
  case 'ports': {
    const ports = portsOf(roleArg(rolename), laneHere(process.env, cwd))
    return [ports.web, ports.backend, ports.site].join(' ')
  }
  case 'env': {
    const assignments = envFor(roleArg(rolename), laneHere(process.env, cwd))
    return Object.entries(assignments).map(([envname, val]) => `${envname}=${val}`).join('\n')
  }
  case 'release': {
    const checkout = checkoutAt(cwd)
    const freed = checkout.isMain ? undefined : releaseLane(checkout.claimsdir, checkout.root)
    return freed === undefined ? 'No lane held here.' : `Lane ${String(freed)} is free.`
  }
  default: {
    throw new Error(Usage)
  }
  }
}

if (import.meta.main) {
  try {
    process.stdout.write(`${main(process.argv.slice(2))}\n`)
  } catch (err) {
    console.error(err instanceof Error ? err.message : err)
    process.exitCode = 1
  }
}
