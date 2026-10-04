import { describe, expect, it } from 'vitest'
import { Question } from '../../src/models/question'
import { Quiz } from '../../src/models/quiz'
import { classicLayout } from './layouts'
import { present } from './present'
import { huntHolding, openTester, seedHunt, type Seeded } from './convex'
import { expectSound, faultsIn, heldIn } from './soundness'

/** A deployment holding a hunt of two quizzes, `one` laid out with `leon` chained to `nantes`, and `two` blank */
async function seeded(): Promise<Seeded> {
  const [leon, nantes] = [{ ...Question.blank(), label: 'leon' }, { ...Question.blank(), label: 'nantes' }]
  const one = { ...Quiz.blank('One', 'one'), ...classicLayout(), questions: [{ ...leon, chains_to: nantes._id }, nantes] }
  return await seedHunt(openTester(), huntHolding([one, Quiz.blank('Two', 'two')]))
}

// Each breaks a sound deployment one way, writing past the functions as no function would.

async function realmGone({ tt, open }: Seeded) {
  await tt.run(async (ctx) => { await ctx.db.delete('realms', open.realm_id) })
}

async function questionUnlisted({ tt, open }: Seeded) {
  await tt.run(async (ctx) => { await ctx.db.insert('questions', Question.blankRow({ hunt_id: open.hunt_id, quiz_id: open.quiz_id }, 'stray')) })
}

async function noneListed({ tt, open }: Seeded) {
  await tt.run(async (ctx) => { await ctx.db.patch('quizzes', open.quiz_id, { row_ordering: [] }) })
}

async function listedTwice({ tt, open }: Seeded) {
  await tt.run(async (ctx) => {
    const { row_ordering } = present(await ctx.db.get('quizzes', open.quiz_id))
    await ctx.db.patch('quizzes', open.quiz_id, { row_ordering: [...row_ordering, present(row_ordering[0])] })
  })
}

async function chainDangling({ tt, open }: Seeded) {
  await tt.run(async (ctx) => {
    const { row_ordering } = present(await ctx.db.get('quizzes', open.quiz_id))
    await ctx.db.patch('questions', present(row_ordering[0]), { chains_to: 'nobody' })
  })
}

async function columnOfNoWidgeting({ tt, open }: Seeded) {
  await tt.run(async (ctx) => { await ctx.db.insert('columns', { hunt_id: open.hunt_id, quiz_id: open.quiz_id, label: 'ghost', title: 'Ghost', source: 'ghost', width_px: 100, position: 99 }) })
}

async function columnOfNoField({ tt, open }: Seeded) {
  await tt.run(async (ctx) => { await ctx.db.insert('columns', { hunt_id: open.hunt_id, quiz_id: open.quiz_id, label: 'askew', title: 'Askew', source: 'question.askew', width_px: 100, position: 99 }) })
}

async function quizLabelShared({ tt, open }: Seeded) {
  await tt.run(async (ctx) => {
    const quizzes = await ctx.db.query('quizzes').collect()
    const two = present(quizzes.find((quiz) => quiz.label === 'two'))
    await ctx.db.patch('quizzes', two._id, { label: 'one' })
    await ctx.db.patch('quizzes', open.quiz_id, { label: 'one' })
  })
}

async function huntLabelShared({ tt, open }: Seeded) {
  const other = await seedHunt(tt, huntHolding([Quiz.blank('Three')]))
  await tt.run(async (ctx) => {
    const { label } = present(await ctx.db.get('hunts', open.hunt_id))
    await ctx.db.patch('hunts', other.open.hunt_id, { label })
  })
}

async function quizOfAnotherHunt({ tt, open }: Seeded) {
  const other = await seedHunt(tt, huntHolding([Quiz.blank('Three')]))
  await tt.run(async (ctx) => { await ctx.db.patch('quizzes', open.quiz_id, { hunt_id: other.open.hunt_id }) })
}

async function widgetingOfAnotherHunt({ tt, open }: Seeded) {
  const other = await seedHunt(tt, huntHolding([Quiz.blank('Three')]))
  await tt.run(async (ctx) => {
    const widgeting = present(await ctx.db.query('widgetings').first())
    await ctx.db.patch('widgetings', widgeting._id, { hunt_id: other.open.hunt_id })
  })
  expect(open.hunt_id).to.not.eq(other.open.hunt_id)
}

async function titleStale({ tt, smith }: Seeded) {
  await tt.run(async (ctx) => { await ctx.db.patch('idents', smith.ident_id, { title: 'Renamed Behind Its Back' }) })
}

async function cellAcrossQuizzes({ tt, open }: Seeded) {
  await tt.run(async (ctx) => {
    const widgeting = present(await ctx.db.query('widgetings').first())
    const questions = await ctx.db.query('questions').collect()
    const stray = present(questions.find((question) => question.quiz_id !== widgeting.quiz_id))
    await ctx.db.insert('widgeteds', { hunt_id: open.hunt_id, quiz_id: stray.quiz_id, question_id: stray._id, widgeting_id: widgeting._id, status: 'ok', value: 1, message: null, result_meta: {} })
  })
}

const Breakages: [(seeded: Seeded) => Promise<void>, string, string][] = [
  [realmGone,           'every id names a row: quizzes.realm_id',                                               'a quiz whose realm is gone'],
  [questionUnlisted,    "every quiz's row_ordering is its questions: quiz one lists [",                         'a question its quiz does not list'],
  [noneListed,          "every quiz's row_ordering is its questions: quiz one lists [",                         'a quiz listing none of its questions'],
  [listedTwice,         "every quiz's row_ordering is its questions: quiz one lists",                           'a quiz listing one question twice'],
  [chainDangling,       'every chain names a sibling: question leon chains to nobody',                          'a chain to no question of the quiz'],
  [columnOfNoWidgeting, "every column's source names something showable: column ghost",                         'a column showing a widgeting its quiz lacks'],
  [columnOfNoField,     "every column's source names something showable: column askew",                         'a column showing a field questions lack'],
  [quizLabelShared,     'no two hunts, nor two quizzes of a realm, share a label: two quizzes of one realm',     'two quizzes of a realm under one label'],
  [huntLabelShared,     'no two hunts, nor two quizzes of a realm, share a label: two hunts',                   'two hunts under one label'],
  [quizOfAnotherHunt,   "quizzes.hunt_id is its realm_id's hunt_id: quizzes",                                    "a quiz whose hunt is not its realm's"],
  [widgetingOfAnotherHunt, "widgetings.hunt_id is its quiz_id's hunt_id: widgetings",                           "a widgeting whose hunt is not its quiz's"],
  [titleStale,          "huntings.ident_title is its ident_id's title: huntings",                               "a hunting still holding its ident's old title"],
  [cellAcrossQuizzes,   "widgeteds.quiz_id is its widgeting_id's quiz_id: widgeteds",                           "a cell whose widgeting is of another quiz"],
]

describe("faultsIn", () => {
  it("finds nothing wrong with a deployment that holds together", async () => {
    const { tt } = await seeded()
    expect(await faultsIn(tt)).to.deep.eq([])
  })

  for (const [breakage, fault, describes] of Breakages) {
    it(`finds ${describes}`, async () => {
      const subject = await seeded()
      await breakage(subject)
      const faults = await faultsIn(subject.tt)
      expect(faults.filter((each) => each.startsWith(fault))).to.not.be.empty
    })
  }

  it("lets a null id be: an ident nobody has claimed", async () => {
    const { tt } = await seeded()
    await tt.run(async (ctx) => { await ctx.db.insert('idents', { label: 'nobody_yet', title: '', user_id: null }) })
    expect(await faultsIn(tt)).to.deep.eq([])
  })
})

describe("expectSound", () => {
  it("passes a deployment that holds together, and fails one that does not", async () => {
    const subject = await seeded()
    await expectSound(subject.tt)
    await chainDangling(subject)
    await expect(expectSound(subject.tt)).rejects.toThrow(/leon chains to nobody/)
  })
})

describe("heldIn", () => {
  it("reads every one of our tables back whole, and Convex Auth's users", async () => {
    const { tt } = await seeded()
    const held = await heldIn(tt)
    expect([held.hunts.length, held.quizzes.length, held.users.length > 0]).to.deep.eq([1, 2, true])
  })
})
