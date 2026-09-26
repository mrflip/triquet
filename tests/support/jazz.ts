import { expect } from 'vitest'
import { createPolicyTestApp, type PolicyTestApp } from 'jazz-tools/testing'
import { app } from '../../src/db/schema'
import permissions from '../../src/db/permissions'

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
