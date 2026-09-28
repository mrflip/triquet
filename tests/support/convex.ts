import { convexTest, type TestConvex } from 'convex-test'
import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'
import schema from '../../convex/schema'
import { identForLabel, realmsOf } from '../../convex/reading'
import { writeHunt } from '../../convex/writing/quiz_writing'
import { mintId } from '../../src/lib/ids'
import { Hunt, type HuntT } from '../../src/models/hunt'
import type { ExpressionT } from '../../src/models/expression'
import type { HuntActionDNA, OpenQuizT } from '../../src/models/actions'
import type { QuizT } from '../../src/models/quiz'
import { present } from './present'

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
 * A hunt whose one realm holds `quizzes`, in that order, with `expressions`; its label is minted.
 *
 * @example huntHolding([Quiz.blank('Quiz one')])
 */
export function huntHolding(quizzes: readonly QuizT[], expressions: readonly ExpressionT[] = []): HuntT {
  return Hunt.fill({ _id: mintId(), label: `hunt_${mintId().slice(-8)}`, realms: [{ _id: mintId(), label: 'home', quizzes: [...quizzes] }], expressions: [...expressions] })
}

/** A seeded hunt as a test reads it back: the hunt, its home realm's quizzes, its expressions, and which quiz the test has open */
export type Seen = {
  hunt:         HuntT
  quizzes:      QuizT[]
  expressions:  ExpressionT[]
  open_quiz_id: string
}

/** A deployment holding a hunt, where a browser has a quiz open, and how to act on it and read it back */
export type Seeded = {
  tt:   Tester
  open: OpenQuizT
  /** The hunt as its rows now make it up */
  read: () => Promise<Seen>
  /**
   * Carry out `action` through `hunts.perform`, as the browser `browser_key`.
   *
   * @param browser_key - Who is acting; only a review action cares, so most callers omit it.
   */
  act:  (action: HuntActionDNA, browser_key?: string) => Promise<void>
}

/**
 * The hunt `hunt_id`, every quiz whole, as its rows now make it up.
 *
 * @example const hunt = await wholeHunt(tt, hunt_id)
 */
export async function wholeHunt(tt: Tester, hunt_id: Id<'hunts'>): Promise<HuntT> {
  return present(await tt.query(api.hunts.whole, { hunt_id }), 'the hunt')
}

/**
 * `hunt`, written into rows in `tt`, with the quiz at `open_idx` of its first realm open.
 *
 * @example const { act, read } = await seedHunt(openTester(), Hunt.blank())
 */
export async function seedHunt(tt: Tester, hunt: HuntT, open_idx = 0): Promise<Seeded> {
  const hunt_id = await tt.run(async (ctx) => await writeHunt(ctx.db, hunt))
  const [home] = await tt.run(async (ctx) => await realmsOf(ctx.db, hunt_id))
  const realm = present(home, 'the seeded realm')
  const open = { hunt_id, realm_id: realm.realm._id, quiz_id: present(realm.quizzes[open_idx], 'the quiz to open')._id }
  const read = async (): Promise<Seen> => {
    const now = await wholeHunt(tt, hunt_id)
    return { hunt: now, quizzes: present(now.realms[0]).quizzes, expressions: now.expressions, open_quiz_id: open.quiz_id }
  }
  const act = async (action: HuntActionDNA, browser_key: string = mintId()) => {
    await tt.mutation(api.hunts.perform, { open, action, browser_key })
  }
  return { tt, open, read, act }
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
export async function identified(tt: Tester, label: string): Promise<{ browser_key: string, ident_id: Id<'idents'> }> {
  const browser_key = mintId()
  await tt.mutation(api.idents.performAccount, { action: { kind: 'assume_ident', label, title: '' }, browser_key })
  const ident = await tt.run(async (ctx) => await identForLabel(ctx.db, label))
  return { browser_key, ident_id: present(ident, 'the ident')._id }
}
