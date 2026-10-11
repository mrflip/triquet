/**
 * Everything a test of a Convex function calls: a deployment of our schema and functions in this
 * process, a hunt seeded on it, and the sessions a test acts as.
 *
 * * `openTester()` -- a fresh, empty deployment; no test sees another's rows.
 * * `huntHolding(quizzes)`, `seedHunt(tt, hunt, { openIdx, smith })` -- a hunt written with one
 *   smith on it; the `Seeded` it hands back acts through `hunts.perform` as that smith (`act`),
 *   through `widgets.perform` (`actOnLibrary`), puts another user on the hunt (`join`), and reads
 *   the hunt as its rows make it up (`read`). `openOf(seen)` is the quiz the test has open.
 * * `wholeHunt`, `putOn` -- reads past authorization, and a role granted from outside.
 * * The sessions a test acts as, each named for the kind of user it is signed in as:
 *   `googleUser(tt, label)` -- a user signed in with Google (its account row seeded, never signed
 *   in) holding the userlabel `label`, on no hunt: a stranger; `anonymousUser(tt, label)` -- an
 *   anonymous user holding `label`, sealed in its sandbox; `anonymousSession(tt)` -- an anonymous
 *   user holding no userlabel; the bare `tt` -- no session at all. `callerOf` takes any of them.
 * * `signInWithGoogle(tt, by, sub)` -- a Google sign-in carried through Convex Auth's own `store`,
 *   started and finished by `by`; `googleCallback` and `exchangeCode`, its two steps, for a test
 *   that stops between them or finishes in another browser. Only in a test file that stubs
 *   Google's keys before `convex/auth.ts` loads (`vi.hoisted`).
 * * `refusedAs`, `expectRefusal` -- what a refused call said, and the assertion on it.
 */
import { convexTest, type TestConvex } from 'convex-test'
import { ConvexError } from 'convex/values'
import { expect } from 'vitest'
import * as Z from 'zod'
import { api, internal } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'
import schema from '../../convex/schema'
import { huntshipFor, libraryOf, realmsOf, wholeHuntOf } from '../../convex/reading'
import { triggers } from '../../convex/triggers'
import { userForSignIn } from '../../convex/writing/user_actions'
import * as Actor from '../../src/lib/actor'
import * as Runner from '../../src/lib/formulary/runner'
import * as Sortings from '../../src/lib/sortings'
import { mintId } from '../../src/lib/ids'
import { widgetFrom } from '../../src/lib/rows'
import { Hunt, type HuntT } from '../../src/models/hunt'
import type { WidgetT } from '../../src/models/widget'
import type { AffirmsT, HuntActionDNA, HuntAffirmsT, LibraryActionDNA, QuizAffirmsT } from '../../src/models/actions'
import type { HuntRole } from '../../src/models/huntship'
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

/** A session whose user holds a userlabel: how to call as it, its user, its userlabel, and the actor the server sees */
export type Labelled = Session & { label: string, actor: Actor.UserActorT }

/** Where a quiz sits: its hunt, its realm, and its id */
export type PlaceT = Pick<AffirmsT, 'hunt_id' | 'realm_id' | 'quiz_id'>

/** What one session affirms of itself on a hunt, in each shape a function takes it */
export type AffirmsBag = {
  /** Its user, the hunt, and its standing there */
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
  smith: Labelled
  /** The hunt as its rows now make it up */
  read:  () => Promise<Seen>
  /**
   * Carry out `action` through `hunts.perform`, as the session `by`, affirming what a browser that
   * has read the hunt would: its user, its standing as its huntship says, and the open quiz.
   *
   * @param by - Who is acting; the hunt's smith unless given. A session with no userlabel, or the bare tester (no session at all), are anonymous, and affirm as the smith.
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
   * A fresh session, asserting the userlabel `label` (made if it is new), put on the hunt as
   * `role`.
   */
  join:  (label: string, role: HuntRole) => Promise<Labelled>
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
 * Put the user `user_id` on the hunt `hunt_id` as `role`, as a smith would, past every policy:
 * its huntship carries the user's userlabel and title.
 *
 * @example await putOn(tt, open.hunt_id, alice.user_id, 'reviewer')
 */
export async function putOn(tt: Tester, hunt_id: Id<'hunts'>, user_id: Id<'users'>, role: HuntRole): Promise<void> {
  await tt.run(async (ctx) => {
    const user = present(await ctx.db.get('users', user_id), 'the user to put on the hunt')
    await ctx.db.insert('huntships', { hunt_id, user_id, userlabel: present(user.userlabel), usertitle: present(user.title), role })
  })
}

/**
 * `hunt`, written into rows in `tt`, with one smith on it (a user signed in with Google, holding
 * the userlabel `opts.smith`, `seed_smith` by default), who made it and so names its org, and the
 * quiz at `opts.openIdx` of its first realm open. The smith takes their userlabel before the hunt
 * is written, as a maker does: once a hunt's address carries it, it is no longer free. The library
 * is given whichever seed widgets it lacks, so a fixture's widgetings of them work.
 *
 * @example const { act, read } = await seedHunt(openTester(), Hunt.blank())
 */
export async function seedHunt(tt: Tester, hunt: HuntT, { openIdx = 0, smith: smithlabel = 'seed_smith' }: SeedOpts = {}): Promise<Seeded> {
  const maker = await googleUser(tt, smithlabel)
  const hunt_id = await tt.run(async (ctx) => await seedHuntRows(ctx.db, hunt, smithlabel))
  const [home] = await tt.run(async (ctx) => await realmsOf(ctx.db, hunt_id))
  const realm = present(home, 'the seeded realm')
  const open = { hunt_id, realm_id: realm.realm._id, quiz_id: present(realm.quizzes[openIdx], 'the quiz to open')._id }
  const join = async (label: string, role: HuntRole): Promise<Labelled> => {
    const member = await googleUser(tt, label)
    await putOn(tt, hunt_id, member.user_id, role)
    return member
  }
  const smith = await join(maker.label, 'smith')
  const read = async (): Promise<Seen> => {
    const now = await wholeHunt(tt, hunt_id)
    const rows = await tt.run(async (ctx) => await libraryOf(ctx.db))
    const library = rows.map((row) => widgetFrom(row))
    const huntRow = await tt.run(async (ctx) => await ctx.db.get('hunts', hunt_id))
    const wheel = huntRow?.wheel
    return { hunt: now, ...(wheel && { wheel }), quizzes: present(now.realms[0]).quizzes, library, open_quiz_id: open.quiz_id }
  }
  const act = async (action: HuntActionDNA, by: Session | Tester = smith) => {
    const { action: affirms } = await affirmsOf(tt, isLabelled(by) ? by : smith, open)
    await callerOf(by).mutation(api.hunts.perform, { affirms, action })
  }
  const actOnLibrary = async (action: LibraryActionDNA, by: Session | Tester = smith) => {
    await callerOf(by).mutation(api.widgets.perform, { action })
  }
  return { tt, open, smith, read, act, actOnLibrary, join }
}

/**
 * What `by` affirms of itself on the hunt `place` names, as a browser that has read the hunt
 * would: its user, and its standing there as its huntship says (a stranger with none), with the
 * place's quiz and realm, in each shape a function takes.
 *
 * @example await alice.as.query(api.quizzes.open, { affirms: (await affirmsOf(tt, alice, open)).quiz })
 */
export async function affirmsOf(tt: Tester, by: Pick<Labelled, 'user_id'>, place: PlaceT): Promise<AffirmsBag> {
  const { user_id } = by
  const { hunt_id, realm_id, quiz_id } = place
  const hunting = await tt.run(async (ctx) => await huntshipFor(ctx.db, hunt_id, user_id))
  const hunt = { user_id, hunt_id, standing: hunting?.role ?? 'stranger' } as const
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

/** A session signed in as the user `user_id`, as Convex Auth signs one in: an `authSessions` row */
async function sessionOf(tt: Tester, user_id: Id<'users'>): Promise<Session> {
  const session_id = await tt.run(async (ctx) => await ctx.db.insert('authSessions', { userId: user_id, expirationTime: Date.now() + SessionMs }))
  return { as: tt.withIdentity({ subject: `${user_id}|${session_id}` }), user_id }
}

/**
 * A fresh browser's session, signed in anonymously as Convex Auth signs one in, its user made as
 * our `createOrUpdateUser` makes one (`userForSignIn`): anonymous, holding no userlabel, but able
 * to take one.
 *
 * @example const { as } = await anonymousSession(tt); await as.mutation(api.users.perform, { action })
 */
export async function anonymousSession(tt: Tester): Promise<Session> {
  const user_id = await tt.run(async (ctx) => await userForSignIn(triggers.wrapDB(ctx).db, { existingUserId: null, provider: { id: 'anonymous' } }))
  return await sessionOf(tt, user_id)
}

/** The sessions `googleUser` and `anonymousUser` have signed in, by the userlabel each holds, for each deployment */
const HoldersIn = new WeakMap<Tester, Map<string, Labelled>>()

/** The kinds of user a test signs in as, holding a userlabel */
type UserkindT = 'google' | 'anonymous'

/**
 * The session holding the userlabel `label`, of the kind `userkind`: the one already signed in for
 * it in `tt`, or else a fresh browser's, whose user takes it through `users.perform`. A Google
 * user's account row is seeded, never signed in to, and its user is no longer anonymous, as signing
 * in with Google leaves it. A userlabel has one holder, so asking twice is asking for the same user;
 * asking for it as the other kind is a mistake in the test.
 */
async function labelledUser(tt: Tester, label: string, userkind: UserkindT): Promise<Labelled> {
  const holders = HoldersIn.get(tt) ?? new Map<string, Labelled>()
  HoldersIn.set(tt, holders)
  const held = holders.get(label)
  if (held) {
    if (held.actor.anonymous !== (userkind === 'anonymous')) { throw new Error(`${label} is held by a user of the other kind`) }
    return held
  }
  const session = await anonymousSession(tt)
  if (userkind === 'google') {
    await tt.run(async (ctx) => {
      await ctx.db.patch('users', session.user_id, { isAnonymous: false, email: `${label}@example.com`, emailVerificationTime: Date.now() })
      await ctx.db.insert('authAccounts', { userId: session.user_id, provider: 'google', providerAccountId: `google-sub-${label}` })
    })
  }
  await session.as.mutation(api.users.perform, { action: { kind: 'assume_userlabel', userlabel: label, title: '' } })
  const current = present(await session.as.query(api.users.current, {}), 'the user, labelled')
  const holder = { ...session, label, actor: current.actor }
  holders.set(label, holder)
  return holder
}

/**
 * The session of a user signed in with Google, holding the userlabel `label`, on no hunt: a
 * stranger to every hunt, but free of sealing. Its account row is seeded (`provider: 'google'`),
 * never signed in to: nothing automated signs in to Google. How to call as it, its user, and the
 * actor the server builds for it, for a test that asks a rule directly.
 *
 * @example const alice = await googleUser(tt, 'alice_reviews'); await alice.as.query(api.hunts.list, {})
 */
export async function googleUser(tt: Tester, label: string): Promise<Labelled> {
  return await labelledUser(tt, label, 'google')
}

/**
 * The session of an anonymous user holding the userlabel `label`: sealed in its sandbox (no other
 * hunt, nobody added to its own, no reviews). As `googleUser`, of the other kind.
 *
 * @example const anon = await anonymousUser(tt, 'anon_alice'); await anon.as.mutation(api.hunts.performOuter, { action })
 */
export async function anonymousUser(tt: Tester, label: string): Promise<Labelled> {
  return await labelledUser(tt, label, 'anonymous')
}

/** Whether `by` is a session whose user holds a userlabel */
function isLabelled(by: Session | Tester): by is Labelled {
  return 'label' in by
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

/** What Google sends of one person in a test's Google sign-in, unless it says otherwise */
export const GoogleProfile = { email: 'flip@example.com', name: 'Flip Kromer', image: 'https://lh3.googleusercontent.com/a/flip' }

/** What the code's exchange answers: the user and session it signed the browser in as, or null */
const Exchanged = Z.object({ userId: Z.string() }).nullable()

/** A Google sign-in as far as Google's callback: the starting browser's verifier, and the code the callback made for the browser it sent back */
export type GoogleCallbackT = { verifier: string, code: string }

/**
 * A Google sign-in carried through Convex Auth's own `store` as far as Google's callback, as its
 * routes would carry it, past the part only Google can do, nothing reaching Google. The browser
 * `by` starts it (a verifier, holding its session, if it has one); the sign-in route signs that
 * verifier; the callback, once Google has said who the person is (`sub`), hands the account and
 * profile to `userOAuth`, which asks our `createOrUpdateUser` the first time and makes a code. The
 * test file must stub Google's keys before `convex/auth.ts` loads.
 *
 * @param by - The browser starting the sign-in: a session, or the bare tester (no session).
 * @param sub - Google's account id for the person.
 * @param profile - What Google sends.
 *
 * @example const { verifier, code } = await googleCallback(tt, anon, 'google-sub-flip')
 */
export async function googleCallback(tt: Tester, by: Session | Tester, sub: string, profile: Record<string, unknown> = GoogleProfile): Promise<GoogleCallbackT> {
  const verifier = Z.string().parse(await callerOf(by).mutation(internal.auth.store, { args: { type: 'verifier' } }))
  const signature = `signature-of-${verifier}`
  await tt.mutation(internal.auth.store, { args: { type: 'verifierSignature', verifier, signature } })
  const code = Z.string().parse(await tt.mutation(internal.auth.store, { args: { type: 'userOAuth', provider: 'google', providerAccountId: sub, profile, signature } }))
  return { verifier, code }
}

/**
 * A browser exchanging `code` for a session, as Convex Auth's provider does when it comes back
 * from Google (`verifyCodeAndSignIn`), presenting `verifier`: the one it kept, if it started the
 * sign-in, or none. This asks our `createOrUpdateUser` the second time.
 *
 * @returns The user the browser is signed in as; null when the exchange is refused.
 *
 * @example await exchangeCode(tt, code, verifier)  // => the user's id
 */
export async function exchangeCode(tt: Tester, code: string, verifier: string | undefined): Promise<Id<'users'> | null> {
  const exchanged = Exchanged.parse(await tt.mutation(internal.auth.store, { args: { type: 'verifyCodeAndSignIn', params: { code }, verifier, generateTokens: false, allowExtraProviders: false } }))
  return exchanged === null ? null : exchanged.userId as Id<'users'>
}

/**
 * A whole Google sign-in, started and finished by the browser `by` (`googleCallback`, then
 * `exchangeCode` with the verifier it kept).
 *
 * @returns The user the browser is signed in as; null when the exchange is refused.
 *
 * @example const user_id = await signInWithGoogle(tt, anon, 'google-sub-flip')
 */
export async function signInWithGoogle(tt: Tester, by: Session | Tester, sub: string, profile: Record<string, unknown> = GoogleProfile): Promise<Id<'users'> | null> {
  const { verifier, code } = await googleCallback(tt, by, sub, profile)
  return await exchangeCode(tt, code, verifier)
}
