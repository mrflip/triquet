import { randomUUID } from 'node:crypto'
import { expect } from 'vitest'
import type { Db } from 'jazz-tools'
import { createPolicyTestApp, type PolicyTestApp } from 'jazz-tools/testing'
import { app } from '../../src/db/schema'
import permissions from '../../src/db/permissions'
import { mintId } from '../../src/lib/ids'
import { perform, type OpenQuiz } from '../../src/state/perform'
import { loadHeldRows, loadHunt } from '../../src/state/quiz-rows'
import { writeHunt } from '../../src/state/quiz-writing'
import type { HuntAction } from '../../src/state/actions'
import { Hunt, type HuntT } from '../../src/models/hunt'
import type { ExpressionT } from '../../src/models/expression'
import type { QuizT } from '../../src/models/quiz'
import { present } from './present'

/** One account's session, as a local-first browser presents it; Jazz does not export the type */
export type Session = Parameters<PolicyTestApp['as']>[0]

/** A local-first session for `user_id`, under the account `account_id` when one is named */
export function sessionFor(user_id: string, account_id?: string): Session {
  return { user_id, ...(account_id !== undefined && { account_id }), issuer: 'local-first', claims: {}, authMode: 'local-first' }
}

/** A fresh account no other test shares: its database, and its id */
export function freshAccount(testApp: PolicyTestApp): { db: Db, account: string } {
  const account = randomUUID()
  return { db: testApp.as(sessionFor(`author_${account}`, account)), account }
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

/**
 * A hunt whose one realm holds `quizzes`, in that order, with `expressions`; its label is minted.
 *
 * @example huntHolding([Quiz.blank('Quiz one')])
 */
export function huntHolding(quizzes: readonly QuizT[], expressions: readonly ExpressionT[] = []): HuntT {
  return Hunt.fill({ id: mintId(), label: `hunt_${mintId().slice(-8)}`, realms: [{ id: mintId(), label: 'home', quizzes: [...quizzes] }], expressions: [...expressions] })
}

/** A seeded hunt as a test reads it back: the hunt, its home realm's quizzes, its expressions, and which quiz the test has open */
export type Seen = {
  hunt:         HuntT
  quizzes:      QuizT[]
  expressions:  ExpressionT[]
  open_quiz_id: string
}

/** One account's database holding a hunt, where it has a quiz open, and how to read it back */
export type Seeded = {
  db:   Db
  open: OpenQuiz
  /** The hunt as its rows now make it up */
  read: () => Promise<Seen>
  /** Carry out `action` on the rows as they stand, then let a millisecond pass, so the next write is newer by `$createdAt` */
  act:  (action: HuntAction) => Promise<void>
}

/** A fresh account's database, one no other test shares */
export function freshDb(testApp: PolicyTestApp): Db {
  return freshAccount(testApp).db
}

/**
 * A fresh account holding `hunt`, written into rows, with the quiz at `open_idx` of its first
 * realm open.
 *
 * @example const { act, read } = await seedHunt(testApp, Hunt.blank())
 */
export async function seedHunt(testApp: PolicyTestApp, hunt: HuntT, open_idx = 0): Promise<Seeded> {
  const db = freshDb(testApp)
  const { value: hunt_id } = await db.transaction((tx) => writeHunt(tx, hunt))
  const loaded = present(await loadHunt(db, hunt_id), 'the seeded hunt')
  const realm = present(loaded.realms[0], 'the seeded realm')
  const open = { hunt_id, realm_id: realm.id, quiz_id: present(realm.quizzes[open_idx], 'the quiz to open').id }
  const read = async (): Promise<Seen> => {
    const now = present(await loadHunt(db, hunt_id), 'the seeded hunt')
    return { hunt: now, quizzes: present(now.realms[0]).quizzes, expressions: now.expressions, open_quiz_id: open.quiz_id }
  }
  const act = async (action: HuntAction) => {
    await perform(db, await loadHeldRows(db, hunt_id), open, action)
    await new Promise((resolve) => { setTimeout(resolve, 2) })
  }
  return { db, open, read, act }
}

/** The quiz a seeded test has open, as `seen` has it */
export function openOf(seen: Seen): QuizT {
  return present(seen.quizzes.find((quiz) => quiz.id === seen.open_quiz_id), 'the open quiz')
}
