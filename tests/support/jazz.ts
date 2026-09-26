import { randomUUID } from 'node:crypto'
import { expect } from 'vitest'
import type { Db } from 'jazz-tools'
import { createPolicyTestApp, type PolicyTestApp } from 'jazz-tools/testing'
import { app } from '../../src/db/schema'
import permissions from '../../src/db/permissions'
import { perform, type OpenQuiz } from '../../src/state/perform'
import { loadAccountRows, loadWorkspace } from '../../src/state/quiz-rows'
import { writeWorkspace } from '../../src/state/quiz-writing'
import type { WorkspaceAction } from '../../src/state/actions'
import type { WorkspaceT } from '../../src/models/workspace'
import { present } from './present'

/** One account's session, as a local-first browser presents it; Jazz does not export the type */
export type Session = Parameters<PolicyTestApp['as']>[0]

/** A local-first session for the account `user_id` */
export function sessionFor(user_id: string): Session {
  return { user_id, issuer: 'local-first', claims: {}, authMode: 'local-first' }
}

/**
 * A real Jazz server in this process, holding our schema and enforcing our permissions. Shut it
 * down when the suite is done.
 *
 * @example const testApp = await openTestApp(); const db = testApp.as(sessionFor('alice'))
 */
export async function openTestApp(): Promise<PolicyTestApp> {
  return await createPolicyTestApp(app, permissions, expect)
}

/** One account's database holding a workspace, where it has its quiz open, and how to read it back */
export type Seeded = {
  db:   Db
  open: OpenQuiz
  /** The workspace as its rows now make it up */
  read: () => Promise<WorkspaceT>
  /** Carry out `action` on the rows as they stand, then let a millisecond pass, so the next write is newer by `$createdAt` */
  act:  (action: WorkspaceAction) => Promise<void>
}

/** A fresh account's database, one no other test shares */
export function freshDb(testApp: PolicyTestApp): Db {
  return testApp.as(sessionFor(`author_${randomUUID()}`))
}

/**
 * A fresh account holding `workspace`, written into rows, with its active quiz open.
 *
 * @example const { act, read } = await seedWorkspace(testApp, Workspace.blank())
 */
export async function seedWorkspace(testApp: PolicyTestApp, workspace: WorkspaceT): Promise<Seeded> {
  const db = freshDb(testApp)
  const { value: workspace_id } = await db.transaction((tx) => writeWorkspace(tx, workspace, null))
  const read = async () => present(await loadWorkspace(db, workspace_id), 'the seeded workspace')
  const { active_quiz_id: quiz_id } = await read()
  const open = { workspace_id, quiz_id }
  const act = async (action: WorkspaceAction) => {
    await perform(db, await loadAccountRows(db), open, action)
    await new Promise((resolve) => { setTimeout(resolve, 2) })
  }
  return { db, open, read, act }
}
