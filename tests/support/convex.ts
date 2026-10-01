import { convexTest, type TestConvex } from 'convex-test'
import { ConvexError } from 'convex/values'
import { expect } from 'vitest'
import * as Z from 'zod'
import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'
import schema from '../../convex/schema'
import { identForLabel, libraryOf, realmsOf, wholeHuntOf } from '../../convex/reading'
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

/** A browser that has taken on an ident: its key, and the ident's id */
export type Browsing = { browser_key: string, ident_id: Id<'idents'> }

/** A deployment holding a hunt, where its smith has a quiz open, and how to act on it and read it back */
export type Seeded = {
  tt:    Tester
  open:  OpenQuizT
  /** The browser of the hunt's one smith, who acts unless a test says otherwise */
  smith: Browsing
  /** The hunt as its rows now make it up */
  read:  () => Promise<Seen>
  /**
   * Carry out `action` through `hunts.perform`, as the browser `browser_key`.
   *
   * @param browser_key - Who is acting; the hunt's smith unless given.
   */
  act:   (action: HuntActionDNA, browser_key?: string) => Promise<void>
  /**
   * A fresh browser, taking on the ident labelled `label` (made if it is new), put on the hunt as
   * `role`.
   */
  join:  (label: string, role: HuntRole) => Promise<Browsing>
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
 * Put the ident `ident_id` on the hunt `hunt_id` as `role`, as a smith would.
 *
 * @example await putOn(tt, open.hunt_id, alice.ident_id, 'reviewer')
 */
export async function putOn(tt: Tester, hunt_id: Id<'hunts'>, ident_id: Id<'idents'>, role: HuntRole): Promise<void> {
  await tt.run(async (ctx) => { await ctx.db.insert('huntings', { hunt_id, ident_id, role }) })
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
  const join = async (label: string, role: HuntRole): Promise<Browsing> => {
    const browsing = await identified(tt, label)
    await putOn(tt, hunt_id, browsing.ident_id, role)
    return browsing
  }
  const smith = await join(smithlabel, 'smith')
  const read = async (): Promise<Seen> => {
    const now = await wholeHunt(tt, hunt_id)
    const rows = await tt.run(async (ctx) => await libraryOf(ctx.db))
    const library = rows.map((row) => widgetFrom(row))
    return { hunt: now, quizzes: present(now.realms[0]).quizzes, library, open_quiz_id: open.quiz_id }
  }
  const act = async (action: HuntActionDNA, browser_key: string = smith.browser_key) => {
    await tt.mutation(api.hunts.perform, { open, action, browser_key })
  }
  return { tt, open, smith, read, act, join }
}

/** The quiz a seeded test has open, as `seen` has it */
export function openOf(seen: Seen): QuizT {
  return present(seen.quizzes.find((quiz) => quiz._id === seen.open_quiz_id), 'the open quiz')
}

/**
 * A fresh browser that has taken on the ident labelled `label`: its key, and the ident's id.
 *
 * @example const { browser_key } = await identified(tt, 'alice_reviews')
 */
export async function identified(tt: Tester, label: string): Promise<Browsing> {
  const browser_key = mintId()
  await tt.mutation(api.idents.performAccount, { action: { kind: 'assume_ident', label, title: '' }, browser_key })
  const ident = await tt.run(async (ctx) => await identForLabel(ctx.db, label))
  return { browser_key, ident_id: present(ident, 'the ident')._id }
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
