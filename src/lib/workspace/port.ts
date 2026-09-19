import { AppNotices } from '../notices'
import { ValidatorKit } from '../validator'
import { Workspace, type WorkspaceDNA, type WorkspaceT } from '../../models/workspace'
import { WorkspaceChangeValidators, type SaveOutcome, type WorkspaceChangeDNA } from '../../models/workspace-change'

/** Where the browser fetches and saves its workspace */
export const WorkspaceRoutepath = '/api/workspace'

/**
 * This browser's workspace, from the server.
 *
 * @returns The workspace, and whether it was made just now.
 * @throws When the server cannot be reached, or answers with something that is not a workspace.
 */
export async function fetchWorkspace(): Promise<{ workspace: WorkspaceT, fresh: boolean }> {
  const answer = await fetch(WorkspaceRoutepath, { cache: 'no-store' })
  const body = await answer.json() as { workspace: WorkspaceDNA, fresh: unknown }
  return { workspace: Workspace.revive(body.workspace), fresh: ValidatorKit.bool.parse(body.fresh) }
}

/**
 * Save a change to this browser's workspace.
 *
 * Sent so that it outlives the page: a field committed as the tab closes or reloads is still
 * saved. A browser caps how much such a request may carry, so a change too big for that goes
 * the ordinary way instead. Never throws.
 *
 * @param change - What changed since the last save that landed.
 * @returns Whether it landed, and what to tell the author when it did not.
 *
 * @example await saveWorkspaceChange({ active_quiz_id: quiz.id, quizzes: [quiz] })
 */
export async function saveWorkspaceChange(change: WorkspaceChangeDNA): Promise<SaveOutcome> {
  try {
    const answer = await postOutlivingPage(JSON.stringify(change))
    const outcome = WorkspaceChangeValidators.saveOutcome.safeParse(await answer.json())
    return outcome.success ? outcome.data : { saved: false, message: AppNotices.saveFailed }
  } catch {
    return { saved: false, message: AppNotices.saveFailed }
  }
}

/** One save, sent to outlive the page when it is small enough to be allowed to */
async function postOutlivingPage(body: string): Promise<Response> {
  try {
    return await post(body, true)
  } catch {
    return await post(body, false)
  }
}

/** One save, sent to outlive the page or not */
function post(body: string, keepalive: boolean): Promise<Response> {
  return fetch(WorkspaceRoutepath, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive })
}
