import { describe, expect, it } from 'vitest'
import { api } from '../../convex/_generated/api'
import type { Doc, Id } from '../../convex/_generated/dataModel'
import {
  censusOf, cellRowsOf, huntForLabel, huntingFor, huntRowsOf, identFor, isWorked, layoutOf, layoutRowsOf, libraryOf, membersOf, quizRowsFor, quizRowsOf, realmsOf, reviewFor, usageOf,
  wholeHuntOf, wholeQuizOf, widgetForLabel, widgetingsOf,
} from '../../convex/reading'
import { Hunt, type HuntT } from '../../src/models/hunt'
import { Question } from '../../src/models/question'
import { Quiz, type QuizT } from '../../src/models/quiz'
import { SeedWidgets } from '../../src/models/seeds'
import { Widgeting } from '../../src/models/widgeting'
import { mintId } from '../../src/lib/ids'
import * as PA from '../../src/lib/vv/patterns'
import { present } from '../support/present'
import { huntHolding, identified, openTester, putOn, signedIn, type Tester } from '../support/convex'
import { seedHuntRows } from '../support/seed'

/** A fresh deployment holding `hunt`, and its first quiz's id */
async function holding(hunt: HuntT, tt: Tester = openTester()): Promise<{ tt: Tester, hunt_id: Id<'hunts'>, quiz_id: Id<'quizzes'> }> {
  const hunt_id = await tt.run(async (ctx) => await seedHuntRows(ctx.db, hunt))
  const [home] = await tt.run(async (ctx) => await realmsOf(ctx.db, hunt_id))
  return { tt, hunt_id, quiz_id: present(present(home).quizzes[0])._id }
}

/** One quiz's rows, as plain values, which must be there: what each question stored, by its id and then the widgeting's label */
async function rowsOf(tt: Tester, quiz_id: Id<'quizzes'>) {
  return await tt.run(async (ctx) => {
    const rows = present(await quizRowsOf(ctx.db, quiz_id))
    return { ...rows, stored: Object.fromEntries([...rows.stored].map(([question_id, cells]) => [question_id, Object.fromEntries(cells)])) }
  })
}

/** A quiz of `qty` blank questions, working `labels` as widgetings of the widgets of the same label, in that order */
function quizWorking(labels: readonly string[], qty = 1): QuizT {
  return { ...Quiz.blank(), questions: Array.from({ length: qty }, () => Question.blank()), widgetings: labels.map((label) => Widgeting.fill({ widget_label: 'numnum_clueing', label })) }
}

/** A widgeted of a numnum for `question`, reading as the row holds it: `ok` with one item of `text`, or `errored` saying `text` */
function numnum(question: Pick<Doc<'questions'>, '_id' | 'hunt_id' | 'quiz_id'>, widgeting_id: Id<'widgetings'>, status: 'ok' | 'errored', text: string) {
  const { _id: question_id, hunt_id, quiz_id } = question
  return status === 'ok'
    ? { hunt_id, quiz_id, question_id, widgeting_id, status, value: { items: [{ text, value: 1, kind: 'numeral' }] }, message: null, result_meta: {} }
    : { hunt_id, quiz_id, question_id, widgeting_id, status, value: null, message: text, result_meta: {} }
}

/** What a stored cell's row says: its message when it failed, else its one item's text */
function sayingOf(row: { value: unknown, message: string | null } | null): string | null {
  if (! row) { return null }
  return row.message ?? (row.value as { items: { text: string }[] }).items[0]?.text ?? null
}

describe("huntForLabel", () => {
  it("finds a hunt by its label", async () => {
    const { tt, hunt_id } = await holding(Hunt.blank('quiet_otter'))
    const found = await tt.run(async (ctx) => await huntForLabel(ctx.db, 'quiet_otter'))
    expect(found?._id).to.eq(hunt_id)
  })

  it("takes the earlier of two hunts made with one label", async () => {
    const first = await holding(Hunt.blank('twice_made'))
    await holding(Hunt.blank('twice_made'), first.tt)
    const found = await first.tt.run(async (ctx) => await huntForLabel(ctx.db, 'twice_made'))
    expect(found?._id).to.eq(first.hunt_id)
  })

  it("finds nothing for a label no hunt answers to", async () => {
    const { tt } = await holding(Hunt.blank('quiet_otter'))
    expect(await tt.run(async (ctx) => await huntForLabel(ctx.db, 'loud_heron'))).to.be.null
  })
})

describe("huntRowsOf", () => {
  it("reads the hunt's own row, and its realms in order with their quizzes' rows", async () => {
    const hunt = Hunt.fill({
      _id:    mintId(),
      label:  'two_realms',
      realms: [
        { _id: mintId(), label: 'home', quizzes: [Quiz.blank('At home')] },
        { _id: mintId(), label: 'away', quizzes: [Quiz.blank('Away one'), Quiz.blank('Away two')] },
      ],
    })
    const { tt, hunt_id } = await holding(hunt)
    const rows = present(await tt.run(async (ctx) => await huntRowsOf(ctx.db, hunt_id)))
    expect(rows.realms.map(({ realm, quizzes }) => [realm.label, quizzes.map((quiz) => quiz.title)])).to.deep.eq([
      ['home', ['At home']],
      ['away', ['Away one', 'Away two']],
    ])
    expect(rows).to.have.all.keys('hunt', 'realms')
  })

  it("reads null for a hunt that is not there", async () => {
    const { tt, hunt_id } = await holding(Hunt.blank())
    await tt.run(async (ctx) => { await ctx.db.delete('hunts', hunt_id) })
    expect(await tt.run(async (ctx) => await huntRowsOf(ctx.db, hunt_id))).to.be.null
  })
})

describe("quizRowsFor and wholeQuizOf", () => {
  it("read a quiz whose row is in hand as quizRowsOf reads it by id", async () => {
    const quiz = { ...Quiz.blank('Princes'), questions: ['b', 'a'].map((title) => ({ ...Question.blank(), title })) }
    const { tt, quiz_id } = await holding(huntHolding([quiz]))
    const [byId, inHand] = await tt.run(async (ctx) => {
      const row = present(await ctx.db.get('quizzes', quiz_id))
      return [await quizRowsOf(ctx.db, quiz_id), await quizRowsFor(ctx.db, row)].map((rows) => ({ ...rows, stored: present(rows).stored.keys().toArray() }))
    })
    expect(inHand).to.deep.eq(byId)
  })

  it("read a quiz whole as the whole hunt holds it", async () => {
    const quiz = { ...Quiz.blank('Princes'), questions: ['b', 'a'].map((title) => ({ ...Question.blank(), title })) }
    const { tt, hunt_id, quiz_id } = await holding(huntHolding([quiz, Quiz.blank('Paris')]))
    const [whole, hunt] = await tt.run(async (ctx) => [await wholeQuizOf(ctx.db, present(await ctx.db.get('quizzes', quiz_id))), present(await wholeHuntOf(ctx.db, hunt_id))] as const)
    expect(whole).to.deep.eq(present(hunt.realms[0]).quizzes[0])
    expect(whole.questions.map((question) => question.title)).to.deep.eq(['b', 'a'])
  })
})

describe("quizRowsOf", () => {
  it("reads every row of one quiz, each list in its committed order", async () => {
    const quiz = { ...Quiz.blank('Princes'), questions: ['b', 'a', 'c'].map((title) => ({ ...Question.blank(), title })) }
    const { tt, quiz_id } = await holding(huntHolding([quiz]))
    const rows = await rowsOf(tt, quiz_id)
    expect(rows.quiz.title).to.eq('Princes')
    expect(rows.questions.map((row) => row.title)).to.deep.eq(['b', 'a', 'c'])
    expect(rows.questions.map((row) => row._id)).to.deep.eq(rows.quiz.row_ordering)
    expect([rows.widgetings, rows.columns]).to.deep.eq([[], []])
    expect(rows.stored).to.deep.eq(Object.fromEntries(rows.quiz.row_ordering.map((question_id) => [question_id, {}])))
  })

  it("reads null for a quiz that is not there", async () => {
    const { tt, quiz_id } = await holding(Hunt.blank())
    await tt.run(async (ctx) => { await ctx.db.delete('quizzes', quiz_id) })
    expect(await tt.run(async (ctx) => await quizRowsOf(ctx.db, quiz_id))).to.be.null
  })

  it("reads each stored cell's newest row, and the newest ok one", async () => {
    const { tt, quiz_id } = await holding(huntHolding([quizWorking(['numnum_clueing'], 2)]))
    const { questions, widgetings } = await rowsOf(tt, quiz_id)
    const [first, second] = questions
    const widgeting_id = present(widgetings[0])._id
    await tt.run(async (ctx) => {
      for (const row of [
        numnum(present(first), widgeting_id, 'ok', 'oldest'), numnum(present(first), widgeting_id, 'ok', 'answered'),
        numnum(present(first), widgeting_id, 'errored', 'failed once'), numnum(present(first), widgeting_id, 'errored', 'failed twice'),
        numnum(present(second), widgeting_id, 'errored', 'never answered'),
      ]) { await ctx.db.insert('widgeteds', row) }
    })
    const { stored } = await rowsOf(tt, quiz_id)
    const cells = Object.values(stored).map((cells) => present(cells.numnum_clueing)).map((cell) => [sayingOf(cell.newest), sayingOf(cell.ok)])
    expect(cells).to.have.deep.members([['failed twice', 'answered'], ['never answered', null]])
  })

  it("keeps cells apart: another widgeting of the same widget is another cell", async () => {
    const { tt, quiz_id } = await holding(huntHolding([quizWorking(['numnum_clueing', 'numnum_again'])]))
    const { questions, widgetings } = await rowsOf(tt, quiz_id)
    const question = present(questions[0])
    const question_id = question._id
    await tt.run(async (ctx) => {
      await ctx.db.insert('widgeteds', numnum(question, present(widgetings[0])._id, 'ok', 'first'))
      await ctx.db.insert('widgeteds', numnum(question, present(widgetings[1])._id, 'errored', 'second'))
    })
    const { stored } = await rowsOf(tt, quiz_id)
    const cells = present(stored[question_id])
    expect(Object.keys(cells)).to.have.members(['numnum_clueing', 'numnum_again'])
    expect([sayingOf(present(cells.numnum_clueing).newest), sayingOf(present(cells.numnum_again).newest)]).to.deep.eq(['first', 'second'])
  })
})

describe("cellRowsOf", () => {
  it("reads null for a cell with nothing recorded", async () => {
    const { tt, quiz_id } = await holding(huntHolding([quizWorking(['numnum_clueing'])]))
    const { questions, widgetings } = await rowsOf(tt, quiz_id)
    expect(await tt.run(async (ctx) => await cellRowsOf(ctx.db, present(questions[0])._id, present(widgetings[0])._id))).to.be.null
  })
})

describe("layoutRowsOf, layoutOf and widgetingsOf", () => {
  it("read a quiz's widgetings in run order, and its columns, without its questions", async () => {
    const { tt, quiz_id } = await holding(huntHolding([quizWorking(['cc', 'aa', 'bb'])]))
    const layout = present(await tt.run(async (ctx) => await layoutRowsOf(ctx.db, quiz_id)))
    expect(layout.widgetings.map((row) => [row.label, row.position])).to.deep.eq([['cc', 0], ['aa', 1], ['bb', 2]])
    expect(layout).to.have.all.keys('quiz', 'widgetings', 'columns')
    const widgetings = await tt.run(async (ctx) => await widgetingsOf(ctx.db, quiz_id))
    expect(widgetings.map((row) => row.label)).to.deep.eq(['cc', 'aa', 'bb'])
  })

  it("reads null for a quiz that is not there", async () => {
    const { tt, quiz_id } = await holding(Hunt.blank())
    await tt.run(async (ctx) => { await ctx.db.delete('quizzes', quiz_id) })
    expect(await tt.run(async (ctx) => await layoutRowsOf(ctx.db, quiz_id))).to.be.null
  })

  it("read the same layout from a quiz row already in hand, which is handed back as it was", async () => {
    const { tt, quiz_id } = await holding(huntHolding([quizWorking(['cc', 'aa', 'bb'])]))
    const [byId, byRow, held] = await tt.run(async (ctx) => {
      const quiz = present(await ctx.db.get('quizzes', quiz_id))
      return [await layoutRowsOf(ctx.db, quiz_id), await layoutOf(ctx.db, quiz), quiz]
    })
    expect(byRow).to.deep.eq(byId)
    expect(byRow.quiz).to.deep.eq(held)
  })
})

describe("the library", () => {
  it("libraryOf reads every widget in the order the library lists them", async () => {
    const { tt } = await holding(Hunt.blank())
    const library = await tt.run(async (ctx) => await libraryOf(ctx.db))
    expect(library.map((row) => row.label)).to.deep.eq(SeedWidgets.map((widget) => widget.label))
    expect(library.map((row) => row.position)).to.deep.eq(SeedWidgets.map((_widget, idx) => idx))
  })

  it("widgetForLabel finds a widget by its label, and nothing for a label it lacks", async () => {
    const { tt } = await holding(Hunt.blank())
    const found = await tt.run(async (ctx) => [await widgetForLabel(ctx.db, 'numnum_hint'), await widgetForLabel(ctx.db, 'no_such_widget')])
    expect(found.map((row) => row?.formulary ?? null)).to.deep.eq(['aibot', null])
  })

  it("isWorked says whether any widgeting of any quiz works a widget", async () => {
    const tt = openTester()
    await holding(huntHolding([quizWorking(['clueing_ishes'])]), tt)
    await holding(huntHolding([{ ...Quiz.blank(), widgetings: [Widgeting.fill({ widget_label: 'dumdum', label: 'guess' })] }]), tt)
    const worked = await tt.run(async (ctx) => await Promise.all(['numnum_clueing', 'dumdum', 'numnum_hint'].map(async (label) => await isWorked(ctx.db, label))))
    expect(worked).to.deep.eq([true, true, false])
  })
})

/** A quiz working the widget `widget_label` under each of `labels` */
function working(widget_label: string, labels: readonly string[]): QuizT {
  return { ...Quiz.blank(), widgetings: labels.map((label) => Widgeting.fill({ widget_label, label })) }
}

describe("censusOf", () => {
  it("answers whose a hunt label is, and whether a widget is worked, across every hunt, with an id or a yes", async () => {
    const tt = openTester()
    const { hunt_id } = await holding({ ...huntHolding([working('dumdum', ['guess'])]), label: 'quiet_otter' }, tt)
    await holding({ ...huntHolding([Quiz.blank()]), label: 'loud_heron' }, tt)
    const answers = await tt.run(async (ctx) => {
      const census = censusOf(ctx.db)
      return [await census.huntIdForLabel('quiet_otter'), await census.huntIdForLabel('no_such_hunt'), await census.isWorked('dumdum'), await census.isWorked('numnum_hint')]
    })
    expect(answers).to.deep.eq([hunt_id, null, true, false])
  })
})

describe("usageOf", () => {
  it("counts the widgetings working a widget, the quizzes they are in, and the hunts those are in", async () => {
    const tt = openTester()
    await holding(huntHolding([working('dumdum', ['guess', 'guess_again']), working('dumdum', ['guess'])]), tt)
    await holding(huntHolding([working('dumdum', ['guess']), working('answer_reversed', ['backward'])]), tt)
    const usage = await tt.run(async (ctx) => await usageOf(ctx.db, 'dumdum'))
    expect(usage).to.deep.eq({ widgetings: 4, quizzes: 3, hunts: 2, at_least: false })
  })

  it("counts nothing for a widget nobody works, and for a label the library lacks", async () => {
    const tt = openTester()
    await holding(huntHolding([working('dumdum', ['guess'])]), tt)
    const usages = await tt.run(async (ctx) => [await usageOf(ctx.db, 'numnum_hint'), await usageOf(ctx.db, 'no_such_widget')])
    expect(usages).to.deep.eq([
      { widgetings: 0, quizzes: 0, hunts: 0, at_least: false },
      { widgetings: 0, quizzes: 0, hunts: 0, at_least: false },
    ])
  })

  it("reads no further than it may, and says its counts are a floor past that", async () => {
    const tt = openTester()
    const { hunt_id, quiz_id } = await holding(huntHolding([Quiz.blank()]), tt)
    await tt.run(async (ctx) => {
      for (let ii = 0; ii <= PA.WidgetingsCounted.max; ii++) {
        await ctx.db.insert('widgetings', { hunt_id, quiz_id, widget_label: 'dumdum', label: `guess_${String(ii)}`, description: '', params: {}, position: ii })
      }
    })
    const usage = await tt.run(async (ctx) => await usageOf(ctx.db, 'dumdum'))
    expect(usage).to.deep.eq({ widgetings: PA.WidgetingsCounted.max, quizzes: 1, hunts: 1, at_least: true })
  })
})

describe("identFor", () => {
  it("is the ident a session asserted last, and null for one that never has", async () => {
    const tt = openTester()
    const flip = await identified(tt, 'flip_kromer')
    await flip.as.mutation(api.idents.performAccount, { action: { kind: 'assume_ident', label: 'quiet_otter', title: '' } })
    const { user_id } = await signedIn(tt)
    const found = await tt.run(async (ctx) => [await identFor(ctx.db, flip.user_id), await identFor(ctx.db, user_id)])
    expect(found.map((ident) => ident?.label ?? null)).to.deep.eq(['quiet_otter', null])
  })
})

describe("reviewFor", () => {
  it("finds the ident's review of a quiz, and nothing for an ident with none", async () => {
    const { tt, hunt_id, quiz_id } = await holding(Hunt.blank())
    const [alice, bob] = [await identified(tt, 'alice_reviews'), await identified(tt, 'bob_reviews')]
    await tt.run(async (ctx) => { await ctx.db.insert('reviews', { hunt_id, quiz_id, ident_id: alice.ident_id, overall: 'Mine', phase: 'draft' }) })
    const found = await tt.run(async (ctx) => [await reviewFor(ctx.db, quiz_id, alice.ident_id), await reviewFor(ctx.db, quiz_id, bob.ident_id)])
    expect(found.map((review) => review?.overall ?? null)).to.deep.eq(['Mine', null])
  })

  it("takes the earlier when two reviews answer to one ident", async () => {
    const { tt, hunt_id, quiz_id } = await holding(Hunt.blank())
    const { ident_id } = await identified(tt, 'alice_reviews')
    await tt.run(async (ctx) => {
      await ctx.db.insert('reviews', { hunt_id, quiz_id, ident_id, overall: 'First', phase: 'empty' })
      await ctx.db.insert('reviews', { hunt_id, quiz_id, ident_id, overall: 'Second', phase: 'empty' })
    })
    const found = await tt.run(async (ctx) => await reviewFor(ctx.db, quiz_id, ident_id))
    expect(found?.overall).to.eq('First')
  })
})

describe("membersOf", () => {
  it("reads each member's label and title off their hunting, not their ident", async () => {
    const { tt, hunt_id } = await holding(Hunt.blank())
    const alice = await identified(tt, 'alice_reviews')
    await putOn(tt, hunt_id, alice.ident_id, 'reviewer')
    await tt.run(async (ctx) => {
      const hunting = present(await huntingFor(ctx.db, hunt_id, alice.ident_id))
      await ctx.db.patch('huntings', hunting._id, { ident_title: 'As The Hunting Holds It' })
    })
    const members = await tt.run(async (ctx) => await membersOf(ctx.db, hunt_id))
    expect(members.map(({ label, title, role }) => [label, title, role])).to.deep.eq([['alice_reviews', 'As The Hunting Holds It', 'reviewer']])
  })
})

