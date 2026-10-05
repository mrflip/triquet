import { convexTest, type TestConvex } from 'convex-test'
import { ConvexError } from 'convex/values'
import { expect } from 'vitest'
import * as Z from 'zod'
import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'
import schema from '../../convex/schema'
import { libraryOf, realmsOf, wholeHuntOf } from '../../convex/reading'
import * as Actor from '../../src/lib/actor'
import { mintId } from '../../src/lib/ids'
import { widgetFrom } from '../../src/lib/rows'
import { Hunt, type HuntT } from '../../src/models/hunt'
import type { WidgetT } from '../../src/models/widget'
import type { HuntActionDNA, OpenQuizT } from '../../src/models/actions'
import type { HuntRole } from '../../src/models/hunting'
import type { QuizT } from '../../src/models/quiz'
import { present } from './present'
import { seedHuntRows } from './seed'

const modules = import.meta.glob('../../convex/**/*.*s')

/** A Convex deployment of our schema and functions, in this process, empty until a test writes to it */
export type Tester = TestConvex<typeof schema>

/** The same deployment, called as one session: what a browser signed in as it would call */
export type SessionTester = ReturnType<Tester['withIdentity']>

/**
 * A fresh, empty deployment, holding no other test's rows.
 *
 * @example const tt = openTester(); await tt.query(api.hunts.list, {})
 */
export function openTester(): Tester {
  return convexTest(schema, modules)
}

/**
 * A hunt whose one realm holds `quizzes`, in that order; its label is minted.
 *
 * @example huntHolding([Quiz.blank('Quiz one')])
 */
export function huntHolding(quizzes: readonly QuizT[]): HuntT {
  return Hunt.fill({ _id: mintId(), label: `hunt_${mintId().slice(-8)}`, realms: [{ _id: mintId(), label: 'home', quizzes: [...quizzes] }] })
}

/** A seeded hunt as a test reads it back: the hunt, its home realm's quizzes, the library, and which quiz the test has open */
export type Seen = {
  hunt:         HuntT
  quizzes:      QuizT[]
  library:      WidgetT[]
  open_quiz_id: string
}

/** A browser's session, signed in and nothing more: how to call as it, and its Convex Auth user */
export type Session = { as: SessionTester, user_id: Id<'users'> }

/** A session that has asserted a username: how to call as it, its user, the ident it took on, and the actor the server sees */
export type Identified = Session & { ident_id: Id<'idents'>, label: string, actor: Actor.IdentActorT }

/** A deployment holding a hunt, where its smith has a quiz open, and how to act on it and read it back */
export type Seeded = {
  tt:    Tester
  open:  OpenQuizT
  /** The session of the hunt's one smith, who acts unless a test says otherwise */
  smith: Identified
  /** The hunt as its rows now make it up */
  read:  () => Promise<Seen>
  /**
   * Carry out `action` through `hunts.perform`, as the session `by`.
   *
   * @param by - Who is acting; the hunt's smith unless given. A session with no username, or the bare tester (no session at all), are anonymous.
   */
  act:   (action: HuntActionDNA, by?: Session | Tester) => Promise<void>
  /**
   * A fresh session, asserting the username `label` (made if it is new), put on the hunt as
   * `role`.
   */
  join:  (label: string, role: HuntRole) => Promise<Identified>
}

/** How a hunt is seeded: which quiz of its first realm is open, and the label of its smith */
export type SeedOpts = { openIdx?: number, smith?: string }

/**
 * The hunt `hunt_id`, every quiz whole, as its rows now make it up, whoever may read it.
 *
 * @example const hunt = await wholeHunt(tt, hunt_id)
 */
export async function wholeHunt(tt: Tester, hunt_id: Id<'hunts'>): Promise<HuntT> {
  return present(await tt.run(async (ctx) => await wholeHuntOf(ctx.db, hunt_id)), 'the hunt')
}

/**
 * Put the ident `ident_id` on the hunt `hunt_id` as `role`, as a smith would: its hunting carries
 * the ident's label and title.
 *
 * @example await putOn(tt, open.hunt_id, alice.ident_id, 'reviewer')
 */
export async function putOn(tt: Tester, hunt_id: Id<'hunts'>, ident_id: Id<'idents'>, role: HuntRole): Promise<void> {
  await tt.run(async (ctx) => {
    const ident = present(await ctx.db.get('idents', ident_id), 'the ident to put on the hunt')
    await ctx.db.insert('huntings', { hunt_id, ident_id, ident_label: ident.label, ident_title: ident.title, role })
  })
}

/**
 * `hunt`, written into rows in `tt`, with one smith on it (the ident labelled `opts.smith`,
 * `seed_smith` by default) and the quiz at `opts.openIdx` of its first realm open. The library is
 * given whichever seed widgets it lacks, so a fixture's widgetings of them work.
 *
 * @example const { act, read } = await seedHunt(openTester(), Hunt.blank())
 */
export async function seedHunt(tt: Tester, hunt: HuntT, { openIdx = 0, smith: smithlabel = 'seed_smith' }: SeedOpts = {}): Promise<Seeded> {
  const hunt_id = await tt.run(async (ctx) => await seedHuntRows(ctx.db, hunt))
  const [home] = await tt.run(async (ctx) => await realmsOf(ctx.db, hunt_id))
  const realm = present(home, 'the seeded realm')
  const open = { hunt_id, realm_id: realm.realm._id, quiz_id: present(realm.quizzes[openIdx], 'the quiz to open')._id }
  const join = async (label: string, role: HuntRole): Promise<Identified> => {
    const member = await identified(tt, label)
    await putOn(tt, hunt_id, member.ident_id, role)
    return member
  }
  const smith = await join(smithlabel, 'smith')
  const read = async (): Promise<Seen> => {
    const now = await wholeHunt(tt, hunt_id)
    const rows = await tt.run(async (ctx) => await libraryOf(ctx.db))
    const library = rows.map((row) => widgetFrom(row))
    return { hunt: now, quizzes: present(now.realms[0]).quizzes, library, open_quiz_id: open.quiz_id }
  }
  const act = async (action: HuntActionDNA, by: Session | Tester = smith) => {
    await callerOf(by).mutation(api.hunts.perform, { open, action })
  }
  return { tt, open, smith, read, act, join }
}

/** The quiz a seeded test has open, as `seen` has it */
export function openOf(seen: Seen): QuizT {
  return present(seen.quizzes.find((quiz) => quiz._id === seen.open_quiz_id), 'the open quiz')
}

/** How long a test's session lasts: longer than any test */
const SessionMs = 24 * 60 * 60 * 1000

/**
 * A fresh browser's session, signed in anonymously as Convex Auth would sign it in (a `users` row
 * and an `authSessions` row), having asserted no username: anonymous, but able to assert one.
 *
 * @example const { as } = await signedIn(tt); await as.mutation(api.idents.performAccount, { action })
 */
export async function signedIn(tt: Tester): Promise<Session> {
  const { user_id, session_id } = await tt.run(async (ctx) => {
    const user_id = await ctx.db.insert('users', { isAnonymous: true })
    const session_id = await ctx.db.insert('authSessions', { userId: user_id, expirationTime: Date.now() + SessionMs })
    return { user_id, session_id }
  })
  return { as: tt.withIdentity({ subject: `${user_id}|${session_id}` }), user_id }
}

/** The sessions `identified` has signed in, by the username each holds, for each deployment */
const HoldersIn = new WeakMap<Tester, Map<string, Identified>>()

/**
 * The session holding the username `label`: the one `identified` already signed in for it in
 * `tt`, or else a fresh browser's, asserting it (made, and claimed, if it is new) through
 * `idents.performAccount`. How to call as it, the ident's id, and the actor the server builds for
 * it, for a test that asks a rule directly. A username has one holder, so asking twice is asking
 * for the same person; a test of a second session asserting a held username uses `signedIn`.
 *
 * @example const alice = await identified(tt, 'alice_reviews'); await alice.as.query(api.hunts.list, {})
 */
export async function identified(tt: Tester, label: string): Promise<Identified> {
  const holders = HoldersIn.get(tt) ?? new Map<string, Identified>()
  HoldersIn.set(tt, holders)
  const held = holders.get(label)
  if (held) { return held }
  const session = await signedIn(tt)
  const ident_id = await session.as.mutation(api.idents.performAccount, { action: { kind: 'assume_ident', label, title: '' } }) as Id<'idents'>
  const holder = { ...session, ident_id, label, actor: Actor.asIdent(session.user_id, { _id: ident_id, label }) }
  holders.set(label, holder)
  return holder
}

/**
 * What to call functions through as `by`: a session's own tester, or the bare tester, which has no
 * session at all.
 *
 * @example await callerOf(bob).query(api.hunts.list, {})
 */
export function callerOf(by: Session | Tester): SessionTester | Tester {
  return 'as' in by ? by.as : by
}

/** A refusal's data, as far as a test needs it */
const RefusalShape = Z.object({ failurekind: Z.string() })

/**
 * Why `pending` was refused: the `failurekind` of the refusal it threw. Fails the test when it
 * went through, or failed some other way.
 *
 * @example expect(await refusedAs(act({ kind: 'add_question' }))).to.eq('quizLocked')
 */
export async function refusedAs(pending: Promise<unknown>): Promise<string> {
  try {
    await pending
  } catch (err) {
    const refusal = RefusalShape.safeParse(err instanceof ConvexError ? err.data : null)
    if (refusal.success) { return refusal.data.failurekind }
    throw err
  }
  throw new Error('expected a refusal, and the call went through')
}

/**
 * `pending` refused, for the reason `failurekind`.
 *
 * @example await expectRefusal(act({ kind: 'add_question' }), 'quizLocked')
 */
export async function expectRefusal(pending: Promise<unknown>, failurekind: string): Promise<void> {
  expect(await refusedAs(pending)).to.eq(failurekind)
}
