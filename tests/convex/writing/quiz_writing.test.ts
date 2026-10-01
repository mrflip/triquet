import { describe, expect, it } from 'vitest'
import type { Id } from '../../../convex/_generated/dataModel'
import { libraryOf, quizRowsOf, realmsOf, reviewsOf } from '../../../convex/reading'
import {
  changedFields, deleteQuiz, deleteWidgeting, insertAbsentWidgets, insertHunt, insertQuiz, repositioned, updateQuestion, updateQuiz, updateReview, updateWidget,
} from '../../../convex/writing/quiz_writing'
import type { QuizRows } from '../../../src/lib/rows'
import { Hunt, type HuntT } from '../../../src/models/hunt'
import { defaultLayout } from '../../../src/models/layout'
import { DefaultWidgetings, SeedWidgets } from '../../../src/models/seeds'
import { Widget } from '../../../src/models/widget'
import { Question } from '../../../src/models/question'
import { BlankQuestionQty, Quiz } from '../../../src/models/quiz'
import { present } from '../../support/present'
import { huntHolding, identified, openTester, wholeHunt, type Tester } from '../../support/convex'
import { seedHuntRows } from '../../support/seed'

/** A fresh deployment holding `hunt`, and ways to read back its first quiz */
async function holding(hunt: HuntT) {
  const tt = openTester()
  const hunt_id = await tt.run(async (ctx) => await seedHuntRows(ctx.db, hunt))
  const [home] = await tt.run(async (ctx) => await realmsOf(ctx.db, hunt_id))
  const realm_id = present(home).realm._id
  const quiz_id = present(present(home).quizzes[0])._id
  /** Run `write` against the first quiz's rows as they stand, in one mutation */
  const revise = async (write: (db: Parameters<Parameters<Tester['run']>[0]>[0]['db'], rows: QuizRows) => Promise<unknown>) => {
    await tt.run(async (ctx) => { await write(ctx.db, present(await quizRowsOf(ctx.db, quiz_id))) })
  }
  /** The first quiz's rows, as plain values: its row, its questions, widgetings and columns */
  const rows = async () => await tt.run(async (ctx) => {
    const held = present(await quizRowsOf(ctx.db, quiz_id))
    return { quiz: held.quiz, questions: held.questions, widgetings: held.widgetings, columns: held.columns }
  })
  return { tt, hunt_id, realm_id, place: { hunt_id, realm_id }, quiz_id, revise, rows }
}

/** The library's rows, in order */
async function libraryIn(tt: Tester) {
  return await tt.run(async (ctx) => await libraryOf(ctx.db))
}

/** A hunt of one quiz whose questions are titled `titles` */
function titled(...titles: string[]): HuntT {
  return huntHolding([{ ...Quiz.blank('Princes'), questions: titles.map((title) => ({ ...Question.blank(), title })) }])
}

/** How many rows `tt` holds of the quiz `quiz_id` and of each table below it */
async function heldCounts(tt: Tester, quiz_id: Id<'quizzes'>): Promise<number[]> {
  return await tt.run(async (ctx) => {
    const quiz = await ctx.db.get('quizzes', quiz_id)
    const byQuiz = async (tablename: 'widgetings' | 'columns') => await ctx.db.query(tablename).withIndex('by_quiz_id_and_position', (cvx) => cvx.eq('quiz_id', quiz_id)).collect()
    const [questions, widgetings, columns] = await Promise.all([
      ctx.db.query('questions').withIndex('by_quiz_id', (cvx) => cvx.eq('quiz_id', quiz_id)).collect(), byQuiz('widgetings'), byQuiz('columns'),
    ])
    const widgeteds = await ctx.db.query('widgeteds').collect()
    const reviews = await reviewsOf(ctx.db, quiz_id)
    return [quiz ? 1 : 0, questions.length, widgetings.length, columns.length, widgeteds.length, reviews.length]
  })
}

/** The quiz `quiz_id` as its rows make it up: how many questions, widgetings and columns, and its questions' order */
async function shapeOf(tt: Tester, quiz_id: Id<'quizzes'>) {
  return await tt.run(async (ctx) => {
    const held = present(await quizRowsOf(ctx.db, quiz_id))
    return { counts: [held.questions.length, held.widgetings.length, held.columns.length], ordered: held.quiz.row_ordering, questions: held.questions.map((row) => row._id), title: held.quiz.title }
  })
}

describe("changedFields", () => {
  it("keeps only the fields that differ, comparing structured values by what they hold", () => {
    const held = { title: 'Princes', locked: false, run: { approx_tokens: 1 } }
    expect(changedFields(held, { title: 'Princes', locked: true, run: { approx_tokens: 1 } })).to.deep.eq({ locked: true })
    expect(changedFields(held, { run: { approx_tokens: 2 } })).to.deep.eq({ run: { approx_tokens: 2 } })
    expect(changedFields(held, {})).to.deep.eq({})
  })
})

describe("repositioned", () => {
  it("hands over only the rows whose position is not their place in the list", async () => {
    const moved: [string, number][] = []
    await repositioned([{ label: 'cc', position: 2 }, { label: 'aa', position: 0 }, { label: 'bb', position: 1 }], (row, position) => {
      moved.push([row.label, position])
      return Promise.resolve()
    })
    expect(moved).to.deep.eq([['cc', 0], ['aa', 1], ['bb', 2]])
    const unmoved: string[] = []
    await repositioned([{ label: 'aa', position: 0 }], (row) => {
      unmoved.push(row.label)
      return Promise.resolve()
    })
    expect(unmoved).to.deep.eq([])
  })
})

describe("a mutation", () => {
  it("keeps none of what it wrote when it throws", async () => {
    const { tt, hunt_id, revise } = await holding(titled('aa'))
    const writing = revise(async (db, rows) => {
      await updateQuiz(db, rows.quiz, { title: 'Kings' })
      throw new Error('changed my mind')
    })
    await expect(writing).rejects.toThrow('changed my mind')
    expect(Hunt.quizzesOf(await wholeHunt(tt, hunt_id)).map((quiz) => quiz.title)).to.deep.eq(['Princes'])
  })
})

describe("the update helpers", () => {
  it("write the fields that change", async () => {
    const { revise, rows } = await holding(titled('aa'))
    await revise(async (db, held) => { await updateQuestion(db, present(held.questions[0]), { clueing: 'Who?' }) })
    const { questions } = await rows()
    expect(questions[0]?.clueing).to.eq('Who?')
  })

  it("hold the row as it would stand afterwards to its validator, and write nothing when it fails", async () => {
    const { revise, rows } = await holding(titled('aa'))
    await expect(revise(async (db, held) => { await updateQuiz(db, held.quiz, { title: 'x'.repeat(83) }) })).rejects.toThrow(/is too long/)
    const { quiz } = await rows()
    expect(quiz.title).to.eq('Princes')
  })

  it("updateReview writes the fields that change, and leaves the rest", async () => {
    const { tt, hunt_id, quiz_id } = await holding(titled('aa'))
    const { ident_id } = await identified(tt, 'alice_reviews')
    await tt.run(async (ctx) => {
      const review_id = await ctx.db.insert('reviews', { hunt_id, quiz_id, ident_id, overall: '', phase: 'empty' })
      await updateReview(ctx.db, present(await ctx.db.get('reviews', review_id)), { overall: 'Went well.', phase: 'draft' })
    })
    const [after] = await tt.run(async (ctx) => await reviewsOf(ctx.db, quiz_id))
    expect([after?.overall, after?.phase, after?.ident_id]).to.deep.eq(['Went well.', 'draft', ident_id])
  })
})

describe("insertQuiz", () => {
  it("writes a blank quiz: its row, its blank questions in its order, and the default layout", async () => {
    const { tt, place } = await holding(titled('aa'))
    const quiz_id = await tt.run(async (ctx) => await insertQuiz(ctx.db, place, 'Kings', 'kings'))
    const shape = await shapeOf(tt, quiz_id)
    expect(shape.counts).to.deep.eq([BlankQuestionQty, DefaultWidgetings.length, defaultLayout().columns.length])
    expect(shape.ordered).to.deep.eq(shape.questions)
    expect(shape.title).to.eq('Kings')
  })

  it("writes each blank question as its hunt's", async () => {
    const { tt, hunt_id, place } = await holding(titled('aa'))
    const quiz_id = await tt.run(async (ctx) => await insertQuiz(ctx.db, place, '', 'kings'))
    const hunts = await tt.run(async (ctx) => present(await quizRowsOf(ctx.db, quiz_id)).questions.map((row) => row.hunt_id))
    expect(hunts).to.deep.eq(Array.from({ length: BlankQuestionQty }, () => hunt_id))
  })

  it("titles a quiz from its label when the title is blank, and mints a label when none is given", async () => {
    const { tt, place } = await holding(titled('aa'))
    const named = await tt.run(async (ctx) => await insertQuiz(ctx.db, place, '', 'princes'))
    const namedShape = await shapeOf(tt, named)
    expect(namedShape.title).to.eq('Princes')
    const minted = await tt.run(async (ctx) => await insertQuiz(ctx.db, place, '', undefined))
    const quiz = await tt.run(async (ctx) => await ctx.db.get('quizzes', minted))
    const mintedShape = await shapeOf(tt, minted)
    expect(quiz?.label).to.match(/^[a-z][a-z0-9_]+$/)
    expect(mintedShape.counts).to.deep.eq([BlankQuestionQty, 12, 21])
  })

  it("gives the library the default widgetings' widgets it lacks, and no other seed", async () => {
    const { tt, place } = await holding(titled('aa'))
    await tt.run(async (ctx) => {
      const held = await libraryOf(ctx.db)
      for (const row of held) { await ctx.db.delete('widgets', row._id) }
    })
    await tt.run(async (ctx) => await insertQuiz(ctx.db, place, '', 'kings'))
    const library = await libraryIn(tt)
    expect(library.map((row) => [row.label, row.position])).to.deep.eq(SeedWidgets.filter((widget) => DefaultWidgetings.some((widgeting) => widgeting.widget_label === widget.label)).map((widget, idx) => [widget.label, idx]))
  })
})

describe("deleteQuiz", () => {
  it("deletes the quiz and every row that hangs from it", async () => {
    const blank = Hunt.blank()
    const quiz = { ...present(Hunt.quizzesOf(blank)[0]), questions: [{ ...Question.blank(), clueing: 'Who?' }] }
    const { tt, hunt_id, quiz_id, revise } = await holding(huntHolding([quiz]))
    const { ident_id } = await identified(tt, 'alice_reviews')
    await tt.run(async (ctx) => {
      const { questions, widgetings } = present(await quizRowsOf(ctx.db, quiz_id))
      await ctx.db.insert('widgeteds', { question_id: present(questions[0])._id, widgeting_id: present(widgetings[0])._id, status: 'ok', value: { guess: 'Leon', explanation: '' }, message: null, result_meta: {} })
      await ctx.db.insert('reviews', { hunt_id, quiz_id, ident_id, overall: '', phase: 'empty' })
    })
    expect(await heldCounts(tt, quiz_id)).to.deep.eq([1, 1, 12, 21, 1, 1])
    const library = await libraryIn(tt)
    await revise(async (db, rows) => { await deleteQuiz(db, rows) })
    expect(await heldCounts(tt, quiz_id)).to.deep.eq([0, 0, 0, 0, 0, 0])
    expect(await libraryIn(tt)).to.deep.eq(library)
  })
})

describe("deleteWidgeting", () => {
  it("deletes a widgeting and everything it stored, and leaves another widgeting's alone", async () => {
    const { tt, quiz_id } = await holding(Hunt.blank())
    const ids = await tt.run(async (ctx) => {
      const { questions, widgetings } = present(await quizRowsOf(ctx.db, quiz_id))
      const [doomed, kept] = [present(widgetings[0]), present(widgetings[1])]
      for (const widgeting of [doomed, kept]) {
        await ctx.db.insert('widgeteds', { question_id: present(questions[0])._id, widgeting_id: widgeting._id, status: 'ok', value: 1, message: null, result_meta: {} })
      }
      await deleteWidgeting(ctx.db, doomed._id)
      return { kept: kept._id }
    })
    const left = await tt.run(async (ctx) => await ctx.db.query('widgeteds').collect())
    expect(left.map((row) => row.widgeting_id)).to.deep.eq([ids.kept])
    const { counts } = await shapeOf(tt, quiz_id)
    expect(counts[1]).to.eq(DefaultWidgetings.length - 1)
  })
})

describe("insertAbsentWidgets", () => {
  it("puts each widget the library lacks at its end, leaves those it holds as they are, and says which it added", async () => {
    const { tt } = await holding(titled('aa'))
    const shout = Widget.fill({ label: 'shout', formulary: 'jsonata', formula: '$uppercase(qn.title)' })
    const changed = Widget.fill({ label: 'dumdum', formulary: 'jsonata', formula: '1' })
    const added = await tt.run(async (ctx) => await insertAbsentWidgets(ctx.db, [changed, shout]))
    const library = await tt.run(async (ctx) => await libraryOf(ctx.db))
    expect(added).to.deep.eq(['shout'])
    expect(library.map((row) => [row.label, row.formulary, row.position]).slice(-1)).to.deep.eq([['shout', 'jsonata', SeedWidgets.length]])
    expect(library.find((row) => row.label === 'dumdum')?.formulary).to.eq('aibot')
  })
})

describe("updateWidget", () => {
  it("holds the patch to the widget's own formulary, writing nothing when it does not fit", async () => {
    const { tt } = await holding(titled('aa'))
    const revised = tt.run(async (ctx) => {
      const library = await libraryOf(ctx.db)
      const held = present(library.find((row) => row.label === 'clueing_full'))
      await updateWidget(ctx.db, held, { config: { servicelabel: 'claude', model_tier: 'quick', max_tokens: 10 } })
    })
    await expect(revised).rejects.toThrow()
    const library = await libraryIn(tt)
    expect(library.find((row) => row.label === 'clueing_full')?.config).to.deep.eq({})
  })
})

describe("insertHunt", () => {
  it("writes a fresh hunt: its row titled from its label, a home realm, and one blank quiz under the hunt's label, laid out by default", async () => {
    const tt = openTester()
    const hunt_id = await tt.run(async (ctx) => await insertHunt(ctx.db, 'loud_heron'))
    const back = await wholeHunt(tt, hunt_id)
    const [realm] = back.realms
    const [quiz] = present(realm).quizzes
    expect([back.label, back.title, present(realm).label, present(realm).title])
      .to.deep.eq(['loud_heron', 'Loud Heron', 'home', 'Home'])
    expect([present(quiz).label, present(quiz).title, present(quiz).questions.length, present(quiz).widgetings, present(quiz).columns])
      .to.deep.eq(['loud_heron', 'Loud Heron', BlankQuestionQty, defaultLayout().widgetings, defaultLayout().columns])
  })

  it("seeds the library with no more than the default widgetings work", async () => {
    const tt = openTester()
    await tt.run(async (ctx) => await insertHunt(ctx.db, 'loud_heron'))
    const library = await libraryIn(tt)
    expect(library.map((row) => row.label)).to.have.members(DefaultWidgetings.map((widgeting) => widgeting.widget_label))
    expect(library).to.have.lengthOf(DefaultWidgetings.length)
  })
})
