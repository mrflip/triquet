/**
 * Keeps Convex's preview deployments few and short-lived. A Vercel preview build makes one per
 * git branch (`convex deploy`, with the preview deploy key), and every one counts against the
 * team's deployment limit until it is deleted: by the plan's retention (five days) if nothing
 * sooner.
 *
 *   node scripts/convex-previews.ts [list]                   every preview, oldest first: made, expires, branch, label
 *   node scripts/convex-previews.ts drop-oldest [count]      the <count> (5) oldest previews are deleted now, then `list`
 *   node scripts/convex-previews.ts prune  <branch>          the branch's preview is deleted now
 *   node scripts/convex-previews.ts expire <branch> [hours]  the branch's preview is deleted <hours> (36) from now
 *   node scripts/convex-previews.ts after-vercel-build       on a Vercel preview build, `expire` for its branch; elsewhere, nothing
 *
 * CONVEX_DEPLOY_KEY must be a preview deploy key (`preview:<team>:<project>|...`), which reaches
 * the project's previews and never its production deployment. Locally, scripts/convex_preview
 * puts the janitor's in its place:
 *
 *   ./scripts/doppledo dev_aijanitor ./scripts/convex_preview node scripts/convex-previews.ts prune 20260929-failure_logging
 *
 * which `pnpm previews` spells shorter: `pnpm previews drop-oldest 3`.
 */
import { Console } from 'node:console'
import { z } from 'zod'

const ApiBase = 'https://api.convex.dev/v1'

/** Hours a preview lives past its latest build, unless told otherwise. */
export const DefaultLifetimeHours = 36

/** Previews `drop-oldest` deletes, unless told otherwise. */
export const DefaultDropCount = 5

/** A preview deploy key, and the team and project it names. */
export interface PreviewKey {
  deploykey:   string
  teamslug:    string
  projectslug: string
}

/** The fields of a Management API deployment row this script relies on. */
const DeploymentRow = z.object({
  name:              z.string(),
  deploymentType:    z.string(),
  previewIdentifier: z.string().nullish(),
  createTime:        z.number().optional(),
  expiresAt:         z.number().nullish(),
})
export type DeploymentRow = z.infer<typeof DeploymentRow>

const ProjectRow = z.object({ id: z.number() })

const LifetimeHours = z.coerce.number().positive()

const DropCount = z.coerce.number().int().positive()

/** One preview as `list` shows it: one line of its table. */
export interface PreviewLine {
  made:    string
  expires: string
  branch:  string
  label:   string
}

/** A process's environment, or as much of one as a caller cares to give. */
export type EnvBag = Record<string, string | undefined>

/**
 * The preview deploy key `deploykey` is, with the team and project it names.
 *
 * @param deploykey - A deploy key, as CONVEX_DEPLOY_KEY holds it.
 * @returns The key and its slugs; throws for a missing key or any other kind of key.
 *
 * @example previewKeyOf('preview:flip:triquet|eyJ...')  // => { deploykey: 'preview:flip:triquet|eyJ...', teamslug: 'flip', projectslug: 'triquet' }
 * @example previewKeyOf('prod:prestigious-coyote-542|eyJ...')  // throws: not a preview deploy key
 */
export function previewKeyOf(deploykey: string | undefined): PreviewKey {
  const [, teamslug, projectslug] = /^preview:([\w-]+):([\w-]+)\|./.exec(deploykey ?? '') ?? []
  if (! (deploykey && teamslug && projectslug)) {
    throw new Error("CONVEX_DEPLOY_KEY is not a preview deploy key ('preview:<team>:<project>|...'): refusing to touch any deployment.")
  }
  return { deploykey, teamslug, projectslug }
}

/**
 * The preview deployment made for `branch`, among a project's deployments.
 *
 * @param deployments - Every deployment the key can see.
 * @param branch      - A git branch name, as Vercel and the convex CLI name previews.
 * @returns That branch's preview, or `undefined` when it has none.
 *
 * @example previewFor(rows, '20260929-failure_logging')  // => { name: 'nautical-gazelle-285', deploymentType: 'preview', ... }
 */
export function previewFor(deployments: readonly DeploymentRow[], branch: string): DeploymentRow | undefined {
  return deployments.find((row) => row.deploymentType === 'preview' && row.previewIdentifier === branch)
}

/**
 * A project's preview deployments, the oldest made first.
 *
 * @param deployments - Every deployment the key can see.
 * @returns The previews alone; one whose making time is unknown sorts first, as oldest.
 *
 * @example previewsByAge(rows).map((row) => row.name)  // => ['utmost-dog-883', 'uncommon-lark-139', ...]
 */
export function previewsByAge(deployments: readonly DeploymentRow[]): DeploymentRow[] {
  return deployments.filter((row) => row.deploymentType === 'preview').toSorted((aa, bb) => (aa.createTime ?? 0) - (bb.createTime ?? 0))
}

/**
 * The line of `list`'s table for one preview: times to the minute, in UTC.
 *
 * @example previewLine({ name: 'utmost-dog-883', deploymentType: 'preview', previewIdentifier: '20260930-chai_in_vitest', createTime: Date.UTC(2026, 8, 30, 11, 44), expiresAt: null })
 *   // => { made: '2026-09-30 11:44', expires: '-', branch: '20260930-chai_in_vitest', label: 'utmost-dog-883' }
 */
export function previewLine(row: DeploymentRow): PreviewLine {
  return {
    made:    minuteOf(row.createTime),
    expires: minuteOf(row.expiresAt),
    branch:  row.previewIdentifier ?? '-',
    label:   row.name,
  }
}

/** A timestamp (ms) to the minute, in UTC, or a dash for none. */
function minuteOf(stamp: number | null | undefined): string {
  return stamp ? new Date(stamp).toISOString().slice(0, 16).replace('T', ' ') : '-'
}

/**
 * Timestamp (ms) `hours` after `now`.
 *
 * @example expiryAfter(Date.UTC(2026, 8, 30, 12), 36)  // => Date.UTC(2026, 9, 2, 0)
 */
export function expiryAfter(now: number, hours: number): number {
  return now + (hours * 60 * 60 * 1000)
}

/**
 * The branch a Vercel build is building, when it is building a preview.
 *
 * @param env - The build's environment.
 * @returns The branch, or `undefined` for a production build or one outside Vercel.
 *
 * @example vercelPreviewBranch({ VERCEL_ENV: 'preview', VERCEL_GIT_COMMIT_REF: '20260930-edit_hunt' })  // => '20260930-edit_hunt'
 * @example vercelPreviewBranch({ VERCEL_ENV: 'production', VERCEL_GIT_COMMIT_REF: 'main' })  // => undefined
 */
export function vercelPreviewBranch(env: EnvBag): string | undefined {
  return (env.VERCEL_ENV === 'preview' && env.VERCEL_GIT_COMMIT_REF) ? env.VERCEL_GIT_COMMIT_REF : undefined
}

/**
 * Deletes `branch`'s preview deployment, data and all.
 *
 * @returns The deleted deployment's name, or `undefined` when the branch had none (it never
 *   built, or its preview already expired).
 */
export async function prune(pkey: PreviewKey, branch: string): Promise<string | undefined> {
  const preview = previewFor(await deploymentsOf(pkey), branch)
  if (! preview) { return undefined }
  await callApi(pkey, 'POST', `/deployments/${preview.name}/delete`)
  return preview.name
}

/**
 * Sets `branch`'s preview deployment to be deleted `hours` from now, sooner or later than it was.
 *
 * @returns The deployment's name and new expiry, or `undefined` when the branch has no preview.
 */
export async function expire(pkey: PreviewKey, branch: string, hours: number): Promise<{ deployname: string, expiresAt: number } | undefined> {
  const preview = previewFor(await deploymentsOf(pkey), branch)
  if (! preview) { return undefined }
  const expiresAt = expiryAfter(Date.now(), hours)
  await callApi(pkey, 'PATCH', `/deployments/${preview.name}`, { expiresAt })
  return { deployname: preview.name, expiresAt }
}

/** The project's previews, the oldest made first. */
export async function listPreviews(pkey: PreviewKey): Promise<DeploymentRow[]> {
  return previewsByAge(await deploymentsOf(pkey))
}

/**
 * Deletes the `count` oldest previews, data and all, one at a time.
 *
 * @returns The previews deleted, oldest first: fewer than `count` when there are fewer.
 */
export async function dropOldest(pkey: PreviewKey, count: number): Promise<DeploymentRow[]> {
  const previews = await listPreviews(pkey)
  const doomed   = previews.slice(0, count)
  for (const preview of doomed) {
    await callApi(pkey, 'POST', `/deployments/${preview.name}/delete`)
    process.stdout.write(`Deleted ${preview.previewIdentifier ?? '(no branch)'}'s preview, ${preview.name}.\n`)
  }
  return doomed
}

/** Every deployment in the key's project that the key can see: its previews. */
async function deploymentsOf(pkey: PreviewKey): Promise<DeploymentRow[]> {
  const project = ProjectRow.parse(await callApi(pkey, 'GET', `/teams/${pkey.teamslug}/projects/${pkey.projectslug}`))
  return z.array(DeploymentRow).parse(await callApi(pkey, 'GET', `/projects/${String(project.id)}/list_deployments`))
}

/** The Management API's answer to one request, parsed; throws on any refusal. */
async function callApi(pkey: PreviewKey, method: string, path: string, body?: object): Promise<unknown> {
  const response = await fetch(`${ApiBase}${path}`, {
    method,
    headers: { Authorization: `Bearer ${pkey.deploykey}`, ...(body && { "Content-Type": 'application/json' }) },
    body:    body ? JSON.stringify(body) : undefined,
  })
  const text = await response.text()
  if (! response.ok) { throw new Error(`${method} ${path} refused (${String(response.status)}): ${text}`) }
  return text ? JSON.parse(text) : undefined
}

/** The command line: one of the commands in the module's doc block. */
async function main([command = 'list', subject, hoursArg]: string[], env: EnvBag): Promise<void> {
  if (command === 'after-vercel-build') {
    const building = vercelPreviewBranch(env)
    if (! building) { return }
    // A preview that keeps its default lifetime is no reason to fail the build that made it.
    try {
      await main(['expire', building], env)
    } catch (err) {
      console.warn(`Could not shorten the preview's lifetime; it keeps Convex's default. ${String(err)}`)
    }
    return
  }
  if (command === 'list' || command === 'drop-oldest') {
    const pkey = previewKeyOf(env.CONVEX_DEPLOY_KEY)
    if (command === 'drop-oldest') {
      await dropOldest(pkey, DropCount.parse(subject ?? DefaultDropCount))
    }
    const previews = await listPreviews(pkey)
    new Console(process.stdout).table(previews.map((row) => previewLine(row)))
    process.stdout.write(`${String(previews.length)} previews.\n`)
    return
  }
  const branch = subject
  if (! (branch && (command === 'prune' || command === 'expire'))) {
    throw new Error('Usage: node scripts/convex-previews.ts <[list] | drop-oldest [count] | prune <branch> | expire <branch> [hours] | after-vercel-build>')
  }
  const pkey = previewKeyOf(env.CONVEX_DEPLOY_KEY)
  if (command === 'prune') {
    const deployname = await prune(pkey, branch)
    process.stdout.write(deployname ? `Deleted ${branch}'s preview, ${deployname}.\n` : `${branch} has no preview: nothing to delete.\n`)
    return
  }
  const hours = LifetimeHours.parse(hoursArg ?? DefaultLifetimeHours)
  const expired = await expire(pkey, branch, hours)
  process.stdout.write(expired
    ? `${branch}'s preview, ${expired.deployname}, is deleted at ${new Date(expired.expiresAt).toISOString()}.\n`
    : `${branch} has no preview: nothing to expire.\n`)
}

if (import.meta.main) {
  try {
    await main(process.argv.slice(2), process.env)
  } catch (err) {
    console.error(err instanceof Error ? err.message : err)
    process.exitCode = 1
  }
}
