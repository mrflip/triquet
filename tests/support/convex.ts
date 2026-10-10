/**
 * Everything a test of a Convex function calls: a deployment of our schema and functions in this
 * process, a hunt seeded on it, and the sessions a test acts as.
 *
 * * `openTester()` -- a fresh, empty deployment; no test sees another's rows.
 * * `huntHolding(quizzes)`, `seedHunt(tt, hunt, { openIdx, smith })` -- a hunt written with one
 *   smith on it; the `Seeded` it hands back acts through `hunts.perform` as that smith (`act`),
 *   through `widgets.perform` (`actOnLibrary`), puts another ident on the hunt (`join`), and reads
 *   the hunt as its rows make it up (`read`). `openOf(seen)` is the quiz the test has open.
 * * `wholeHunt`, `putOn` -- reads past authorization, and a role granted from outside.
 * * `identified(tt, label)` -- a session holding the username `label`, on no hunt: a stranger;
 *   `signedIn(tt)` -- a session that has asserted no username; the bare `tt` -- no session at
 *   all. `callerOf` takes any of them.
 * * `refusedAs`, `expectRefusal` -- what a refused call said, and the assertion on it.
 */
import { convexTest, type TestConvex } from 'convex-test'
import { ConvexError } from 'convex/values'
import { expect } from 'vitest'
import * as Z from 'zod'
import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'
import schema from '../../convex/schema'
import { huntingFor, libraryOf, realmsOf, wholeHuntOf } from '../../convex/reading'
import * as Actor from '../../src/lib/actor'
import * as Runner from '../../src/lib/formulary/runner'
import * as Sortings from '../../src/lib/sortings'
import { mintId } from '../../src/lib/ids'
import { widgetFrom } from '../../src/lib/rows'
import { Hunt, type HuntT } from '../../src/models/hunt'
import type { WidgetT } from '../../src/models/widget'
import type { AffirmsT, HuntActionDNA, HuntAffirmsT, LibraryActionDNA, QuizAffirmsT } from '../../src/models/actions'
import type { HuntRole } from '../../src/models/hunting'
import type { QuizT, Sortkey } from '../../src/models/quiz'
import type { WheelT } from '../../src/models/category'
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
  /** How the hunt arranges its categories, as its row holds it: absent for the default wheel */
  wheel?:       WheelT
  quizzes:      QuizT[]
  library:      WidgetT[]
  open_quiz_id: string
}

/** A browser's session, signed in and nothing more: how to call as it, and its Convex Auth user */
export type Session = { as: SessionTester, user_id: Id<'users'> }

/** A session that has asserted a username: how to call as it, its user, the ident it took on, and the actor the server sees */
export type Identified = Session & { ident_id: Id<'idents'>, label: string, actor: Actor.IdentActorT }

/** Where a quiz sits: its hunt, its realm, and its id */
export type PlaceT = Pick<AffirmsT, 'hunt_id' | 'realm_id' | 'quiz_id'>

/** What one session affirms of itself on a hunt, in each shape a function takes it */
export type AffirmsBag = {
  /** Its ident, the hunt, and its standing there */
  hunt:   HuntAffirmsT
  /** ...and the quiz it is reading */
  quiz:   QuizAffirmsT
  /** ...and that quiz's realm: what an action is sent with */
  action: AffirmsT
}

/** A deployment holding a hunt, where its smith has a quiz open, and how to act on it and read it back */
export type Seeded = {
  tt:    Tester
  open:  PlaceT
  /** The session of the hunt's one smith, who acts unless a test says otherwise */
  smith: Identified
  /** The hunt as its rows now make it up */
  read:  () => Promise<Seen>
  /**
   * Carry out `action` through `hunts.perform`, as the session `by`, affirming what a browser that
   * has read the hunt would: its ident, its standing as its hunting says, and the open quiz.
   *
   * @param by - Who is acting; the hunt's smith unless given. A session with no username, or the bare tester (no session at all), are anonymous, and affirm as the smith.
   */
  act:   (action: HuntActionDNA, by?: Session | Tester) => Promise<void>
  /**
   * Carry out `action` on the library through `widgets.perform`, as the session `by`, which
   * affirms nothing: the library belongs to no hunt.
   *
   * @param by - Who is acting; the hunt's smith unless given.
   */
  actOnLibrary: (action: LibraryActionDNA, by?: Session | Tester) => Promise<void>
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
 * `seed_smith` by default), who made it and so names its org, and the quiz at `opts.openIdx` of its first realm open. The library is
 * given whichever seed widgets it lacks, so a fixture's widgetings of them work.
 *
 * @example const { act, read } = await seedHunt(openTester(), Hunt.blank())
 */
export async function seedHunt(tt: Tester, hunt: HuntT, { openIdx = 0, smith: smithlabel = 'seed_smith' }: SeedOpts = {}): Promise<Seeded> {
  const hunt_id = await tt.run(async (ctx) => await seedHuntRows(ctx.db, hunt, smithlabel))
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
    const huntRow = await tt.run(async (ctx) => await ctx.db.get('hunts', hunt_id))
    const wheel = huntRow?.wheel
    return { hunt: now, ...(wheel && { wheel }), quizzes: present(now.realms[0]).quizzes, library, open_quiz_id: open.quiz_id }
  }
  const act = async (action: HuntActionDNA, by: Session | Tester = smith) => {
    const { action: affirms } = await affirmsOf(tt, isIdentified(by) ? by : smith, open)
    await callerOf(by).mutation(api.hunts.perform, { affirms, action })
  }
  const actOnLibrary = async (action: LibraryActionDNA, by: Session | Tester = smith) => {
    await callerOf(by).mutation(api.widgets.perform, { action })
  }
  return { tt, open, smith, read, act, actOnLibrary, join }
}

/**
 * What `by` affirms of itself on the hunt `place` names, as a browser that has read the hunt
 * would: its ident, and its standing there as its hunting says (a stranger with none), with the
 * place's quiz and realm, in each shape a function takes.
 *
 * @example await alice.as.query(api.quizzes.open, { affirms: (await affirmsOf(tt, alice, open)).quiz })
 */
export async function affirmsOf(tt: Tester, by: Pick<Identified, 'ident_id'>, place: PlaceT): Promise<AffirmsBag> {
  const { ident_id } = by
  const { hunt_id, realm_id, quiz_id } = place
  const hunting = await tt.run(async (ctx) => await huntingFor(ctx.db, hunt_id, ident_id))
  const hunt = { ident_id, hunt_id, standing: hunting?.role ?? 'stranger' } as const
  return { hunt, quiz: { ...hunt, quiz_id }, action: { ...hunt, quiz_id, realm_id } }
}

/** The quiz a seeded test has open, as `seen` has it */
export function openOf(seen: Seen): QuizT {
  return present(seen.quizzes.find((quiz) => quiz._id === seen.open_quiz_id), 'the open quiz')
}

/**
 * The `sort_questions` action a browser sends for `seen`'s open quiz: its questions in the order
 * a sort by `sortkey` puts them, worked out over the browser's run of the quiz, as `Workbench` does.
 *
 * @example await act(sortAction(await read(), 'column:title', false))
 */
export function sortAction(seen: Seen, sortkey: Sortkey, descending: boolean): HuntActionDNA {
  const quiz = openOf(seen)
  const realm = present(seen.hunt.realms.find((each) => each.quizzes.some((held) => held._id === quiz._id)), 'the open quiz\'s realm')
  const run = Runner.runQuiz(Runner.sourceOf(quiz, seen.library, Runner.placeOf({ ...seen.hunt, ...(seen.wheel && { wheel: seen.wheel }) }, realm)))
  return { kind: 'sort_questions', sortkey, descending, question_ids: Sortings.sortedIdsOf(sortkey, quiz, run, descending) }
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
  const holder = { ...session, ident_id, label, actor: Actor.asIdent(session.user_id, { _id: ident_id, label }, Actor.namesAdmin(process.env.TRIQUET_ADMINS, label)) }
  holders.set(label, holder)
  return holder
}

/** Whether `by` is a session that has asserted a username */
function isIdentified(by: Session | Tester): by is Identified {
  return 'ident_id' in by
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
