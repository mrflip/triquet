import { cookies } from 'next/headers'
import { appDb } from '../../../db/client'
import * as Repo from '../../../db/workspaces'
import { AppNotices } from '../../../lib/notices'
import { ValidatorKit } from '../../../lib/validator'
import { WorkspaceChangeValidators, type SaveOutcome } from '../../../models/workspace-change'

/** The cookie a browser carries to find its own workspace again */
const WorkspaceCookie = 'triquet_workspace'

/** How long a browser keeps its workspace cookie: long enough that nobody is ever surprised by it lapsing */
const WorkspaceCookieSeconds = 60 * 60 * 24 * 400

/**
 * This browser's workspace, or a new one when it has none.
 *
 * A browser that has never been here, or whose workspace is gone, is given a fresh workspace and
 * the cookie to find it again. Answers `{ workspace, fresh }`, `fresh` saying it was made just now.
 */
export async function GET(): Promise<Response> {
  const db = await appDb()
  const known = await workspaceIdOf()
  const workspace = known ? await Repo.loadWorkspace(db, known) : null
  if (workspace) { return Response.json({ workspace, fresh: false }) }
  const created = await Repo.createWorkspace(db)
  const jar = await cookies()
  jar.set(WorkspaceCookie, created.workspace_id, {
    httpOnly: true,
    sameSite: 'lax',
    secure:   process.env.NODE_ENV === 'production',
    path:     '/',
    maxAge:   WorkspaceCookieSeconds,
  })
  return Response.json({ workspace: created.workspace, fresh: true })
}

/**
 * Save a change to this browser's workspace.
 *
 * Always answers with a `SaveOutcome`, never a stack trace: whatever goes wrong comes back as
 * the sentence the author sees.
 */
export async function POST(request: Request): Promise<Response> {
  const workspace_id = await workspaceIdOf()
  const parsed = WorkspaceChangeValidators.workspaceChange.safeParse(await bodyOf(request))
  if (! workspace_id || ! parsed.success) { return replied({ saved: false, message: AppNotices.saveFailed }, 400) }
  try {
    await Repo.saveChange(await appDb(), workspace_id, parsed.data)
    return replied({ saved: true })
  } catch (err) {
    console.error('Saving a workspace change failed', err)
    return replied({ saved: false, message: AppNotices.saveFailed }, 500)
  }
}

/** The workspace id this browser's cookie names, or null when it names nothing usable */
async function workspaceIdOf(): Promise<string | null> {
  const jar = await cookies()
  const parsed = ValidatorKit.ulid.safeParse(jar.get(WorkspaceCookie)?.value)
  return parsed.success ? parsed.data : null
}

/** The request's JSON body, or null when it is not JSON -- a save cut off as its page closed */
async function bodyOf(request: Request): Promise<unknown> {
  try {
    return await request.json()
  } catch {
    return null
  }
}

/** One outcome, as a response */
function replied(outcome: SaveOutcome, status = 200): Response {
  return Response.json(outcome, { status })
}
