/**
 * The spec process's own line to the suite's Convex backend, as its admin: how the way in makes a
 * hunt without walking the hunts list (`testing:makeHunt`), and how a spec puts a second visitor on
 * it without walking the Members panel (`putOnHunt`).
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
import type * as Routes from '../src/lib/routes'
import type { HuntRole } from '../src/models/hunting'
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

/**
 * Put the ident labelled `label` on `hunt` as `role`, as a smith would from the Members panel, but
 * through the backend (`testing:putOnHunt`): for a spec whose second visitor is not what it is
 * about. The panel's own way stays with the specs about the panel (`addMember` in support).
 *
 * @param hunt - The hunt, by its org and label: `huntOf(page)` for the one a page has open.
 * @param label - The ident to put on it, which must have been chosen at the front door.
 * @param role - What they are to do on it.
 * @throws When the hunt or the ident is not there; with what the backend said.
 *
 * @example await putOnHunt(huntOf(page), friendLabel, 'reviewer')
 */
export async function putOnHunt(hunt: Routes.HuntLabels, label: string, role: HuntRole): Promise<void> {
  await runAsAdmin('testing:putOnHunt', { org: hunt.org, hunt: hunt.hunt, ident: label, role })
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
