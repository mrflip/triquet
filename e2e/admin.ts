/**
 * The spec process's own line to the suite's Convex backend, as its admin: how the way in makes a
 * hunt without walking the hunts list (`testing:makeHunt`).
 *
 * The admin key is the one `scripts/convex_backend` wrote beside the role's data when it started
 * the backend (`data/convex-<role>/cli.env`), which `scripts/convex_dev` and `scripts/convex_reset`
 * read the same way, in every lane and in CI. With it, a call reaches the backend's internal
 * functions; without it, they are not there to call. The calls go to Convex's HTTP API
 * (`/api/run/<module>/<function>`, the key in an `Authorization: Convex` header), since the HTTP
 * client's admin auth is not a public part of the `convex` package.
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { parseEnv } from 'node:util'
import * as Z from 'zod'
import * as Environment from './environment'

/** Where the suite's backend answers, and the key that makes a call an admin's */
type AdminT = { url: string, key: string }

/** What Convex's HTTP API answers a call with: what the function returned, or why it threw */
const RunReply = Z.discriminatedUnion('status', [
  Z.object({ status: Z.literal('success'), value: Z.unknown() }),
  Z.object({ status: Z.literal('error'), errorMessage: Z.string() }),
])

/** The backend's admin, read once per spec process */
const Held: { admin: AdminT | null } = { admin: null }

/**
 * Run the backend's function `fnpath` (`testing:makeHunt`) as its admin, and hand back what it
 * returned.
 *
 * @param fnpath - The function, as `<module>:<function>`.
 * @param args - Its arguments, as JSON.
 * @returns What it returned.
 * @throws When the backend is not the suite's own, answers with anything but a reply, or the function throws; with what it said.
 *
 * @example await runAsAdmin('testing:makeHunt', { ident: 'tester_0123abcd' })  // => '/~tester_0123abcd/quiet_otter/quizzes/home/quiet_otter/!edit', say
 */
export async function runAsAdmin(fnpath: string, args: Record<string, unknown>): Promise<unknown> {
  const { url, key } = adminOf()
  const response = await fetch(`${url}/api/run/${fnpath.replace(':', '/')}`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Convex ${key}` },
    body:    JSON.stringify({ args, format: 'json' }),
  })
  const body = await response.text()
  const reply = RunReply.safeParse(parsedOrNull(body))
  if (! reply.success) { throw new Error(`${fnpath} was answered ${String(response.status)}, ${body}`) }
  if (reply.data.status === 'error') { throw new Error(`${fnpath} refused: ${reply.data.errorMessage}`) }
  return reply.data.value
}

/** `body` read as JSON; null when it is not */
function parsedOrNull(body: string): unknown {
  try {
    return JSON.parse(body) as unknown
  } catch {
    return null
  }
}

/**
 * The suite's backend and its admin key, from the role's `cli.env`, once it is known to name the
 * very backend the web server was started against: a local one, which the suite empties.
 */
function adminOf(): AdminT {
  if (Held.admin) { return Held.admin }
  const clienv = path.join(import.meta.dirname, '..', 'data', `convex-${Environment.roleOf(process.env)}`, 'cli.env')
  const { CONVEX_SELF_HOSTED_URL: url, CONVEX_SELF_HOSTED_ADMIN_KEY: key } = parseEnv(readFileSync(clienv, 'utf8'))
  if (! url || ! key) { throw new Error(`${clienv} names no backend and key: scripts/convex_backend writes both`) }
  if (url !== process.env.NEXT_PUBLIC_CONVEX_URL) { throw new Error(`${clienv} names ${url}, not the suite's backend, ${String(process.env.NEXT_PUBLIC_CONVEX_URL)}`) }
  Held.admin = { url, key }
  return Held.admin
}
