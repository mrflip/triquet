import { describe, expect, it } from 'vitest'
import type { Doc, Id } from '../../convex/_generated/dataModel'
import {
  censusOf, cellRowsOf, googleAccountOf, huntForLabel, huntInOrg, huntshipFor, huntsCountedInOrg, huntRowsOf, ghostingFor, holderOfUserlabel, isWorked, layoutOf, layoutRowsOf, libraryOf, membersOf, nameChoiceFor, quizRowsFor, quizRowsOf, realmsOf, reviewFor, storedFor, storedOf,
  usageOf, userForUserlabel, wholeHuntOf, wholeQuizOf, widgetForLabel, widgetingsOf,
} from '../../convex/reading'
import type { CellRows } from '../../src/lib/rows'
import { Hunt, type HuntT } from '../../src/models/hunt'
import { Question } from '../../src/models/question'
import { Quiz, type QuizT } from '../../src/models/quiz'
import { SeedWidgets } from '../../src/models/seeds'
import { Widgeting } from '../../src/models/widgeting'
import { mintId } from '../../src/lib/ids'
import * as PA from '../../src/lib/vv/patterns'
import { counting, plainReads } from '../support/counting'
import { present } from '../support/present'
import { anonymousSession, anonymousUser, googleUser, huntHolding, openTester, putOn, type Tester } from '../support/convex'
import { seedHuntRows, seedQuizRows } from '../support/seed'

/** A fresh deployment holding `hunt`, and its first quiz's id */
async function holding(hunt: HuntT, tt: Tester = openTester(), orglabel?: string): Promise<{ tt: Tester, hunt_id: Id<'hunts'>, quiz_id: Id<'quizzes'> }> {
  const hunt_id = await tt.run(async (ctx) => await seedHuntRows(ctx.db, hunt, orglabel))
  const [home] = await tt.run(async (ctx) => await realmsOf(ctx.db, hunt_id))
  return { tt, hunt_id, quiz_id: present(present(home).quizzes[0])._id }
}

/** One quiz's rows, as plain values, which must be there: what each question stored, by its id and then the widgeting's label (the rows hold it by the widgeting's id) */
async function rowsOf(tt: Tester, quiz_id: Id<'quizzes'>) {
  return await tt.run(async (ctx) => {
    const rows = present(await quizRowsOf(ctx.db, quiz_id))
    const labelFor = new Map<string, string>(rows.widgetings.map((widgeting) => [widgeting._id, widgeting.label]))
    const labelled = (cells: ReadonlyMap<string, CellRows>) => Object.fromEntries([...cells].map(([widgeting_id, cell]) => [labelFor.get(widgeting_id) ?? widgeting_id, cell]))
    return { ...rows, stored: Object.fromEntries([...rows.stored].map(([question_id, cells]) => [question_id, labelled(cells)])), quizStored: Object.fromEntries(rows.quizStored) }
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

  it("finds the earliest answering to the label, whatever its org", async () => {
    const first = await holding(Hunt.blank('twice_made'), openTester(), 'lee_jones')
    await holding(Hunt.blank('twice_made'), first.tt, 'pat_smith')
    const found = await first.tt.run(async (ctx) => await huntForLabel(ctx.db, 'twice_made'))
    expect(found?._id).to.eq(first.hunt_id)
  })
})

describe("huntsCountedInOrg", () => {
  it("counts the org's hunts, and none of another org's", async () => {
    const { tt } = await holding(Hunt.blank('quiet_otter'), openTester(), 'pat_smith')
    await holding(Hunt.blank('loud_heron'), tt, 'pat_smith')
    await holding(Hunt.blank('loud_heron'), tt, 'lee_jones')
    const counts = await tt.run(async (ctx) => [await huntsCountedInOrg(ctx.db, 'pat_smith'), await huntsCountedInOrg(ctx.db, 'lee_jones'), await huntsCountedInOrg(ctx.db, 'nobody_yet')])
    expect(counts).to.deep.eq([2, 1, 0])
  })

  it("counts no further than the most one org may make", async () => {
    const tt = openTester()
    await tt.run(async (ctx) => {
      const labels = Array.from({ length: PA.HuntsPerOrg.max + 1 }, (_unused, idx) => `hunt_${String(idx)}`)
      for (const label of labels) {
        await ctx.db.insert('hunts', { label, orglabel: 'pat_smith', title: '', branch: 'main' })
      }
    })
    expect(await tt.run(async (ctx) => await huntsCountedInOrg(ctx.db, 'pat_smith'))).to.eq(PA.HuntsPerOrg.max)
  })
})

describe("huntInOrg", () => {
  it("finds a hunt by its org and its label, apart from another org's of the same label", async () => {
    const lees = await holding(Hunt.blank('spring_hunt'), openTester(), 'lee_jones')
    const pats = await holding(Hunt.blank('spring_hunt'), lees.tt, 'pat_smith')
    const found = await lees.tt.run(async (ctx) => [await huntInOrg(ctx.db, 'lee_jones', 'spring_hunt'), await huntInOrg(ctx.db, 'pat_smith', 'spring_hunt')])
    expect(found.map((hunt) => hunt?._id)).to.deep.eq([lees.hunt_id, pats.hunt_id])
  })

  it("finds nothing in an org with no hunt of that label", async () => {
    const { tt } = await holding(Hunt.blank('spring_hunt'), openTester(), 'lee_jones')
    expect(await tt.run(async (ctx) => await huntInOrg(ctx.db, 'pat_smith', 'spring_hunt'))).to.be.null
  })
})

describe("huntRowsOf", () => {
  it("reads the hunt's own row, and its realms in order with their quizzes' rows", async () => {
    const { tt, hunt_id } = await holding(Hunt.fill({ _id: mintId(), label: 'two_realms', realms: [{ _id: mintId(), quizzes: [Quiz.blank('At home')] }] }))
    // A second realm, which no write makes for now (every realm is home), but which the reads can hold.
    await tt.run(async (ctx) => {
      const realm_id = await ctx.db.insert('realms', { hunt_id, label: 'away', title: '', position: 1 })
      for (const title of ['Away one', 'Away two']) { await seedQuizRows(ctx.db, { hunt_id, realm_id }, Quiz.blank(title)) }
    })
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
      return [await quizRowsOf(ctx.db, quiz_id), await quizRowsFor(ctx.db, row)].map((rows) => ({ ...rows, stored: present(rows).stored.keys().toArray(), quizStored: present(rows).quizStored.keys().toArray() }))
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

/**
 * A fresh deployment holding one quiz of two questions working ten numnums (`nn_0` to `nn_9`);
 * the first question's history recorded for three of them, oldest first, and one more row for
 * the second question in the first of them.
 */
async function recorded() {
  const labels = Array.from({ length: 10 }, (_unused, idx) => `nn_${String(idx)}`)
  const { tt, quiz_id } = await holding(huntHolding([quizWorking(labels, 2)]))
  const { questions, widgetings } = await rowsOf(tt, quiz_id)
  const [first, second] = [present(questions[0]), present(questions[1])]
  const idOf = (label: string) => present(widgetings.find((widgeting) => widgeting.label === label))._id
  await tt.run(async (ctx) => {
    for (const row of [
      numnum(first, idOf('nn_0'), 'ok', 'oldest'), numnum(first, idOf('nn_0'), 'ok', 'answered'), numnum(first, idOf('nn_0'), 'errored', 'failed since'),
      numnum(first, idOf('nn_4'), 'errored', 'failed once'), numnum(first, idOf('nn_4'), 'errored', 'failed twice'),
      numnum(first, idOf('nn_7'), 'ok', 'answered at once'),
      numnum(second, idOf('nn_0'), 'ok', 'the other question'),
    ]) { await ctx.db.insert('widgeteds', row) }
  })
  return { tt, quiz_id, first, second, idOf }
}

describe("storedFor", () => {
  it("reads each cell the question has, by its widgeting's id: its newest row, and its newest ok one", async () => {
    const { tt, first, idOf } = await recorded()
    const stored = await tt.run(async (ctx) => Object.fromEntries(await storedFor(ctx.db, first._id)))
    const said = Object.fromEntries(Object.entries(stored).map(([widgeting_id, cell]) => [widgeting_id, [sayingOf(cell.newest), sayingOf(cell.ok)]]))
    expect(said).to.deep.eq({
      [idOf('nn_0')]: ['failed since', 'answered'],
      [idOf('nn_4')]: ['failed twice', null],
      [idOf('nn_7')]: ['answered at once', 'answered at once'],
    })
  })

  it("reads what reading each of the quiz's widgetings' cells would, and nothing of another question's", async () => {
    const { tt, quiz_id, first, second, idOf } = await recorded()
    const [walked, celled, others] = await tt.run(async (ctx) => {
      const widgetings = await widgetingsOf(ctx.db, quiz_id)
      return [
        Object.fromEntries(await storedFor(ctx.db, first._id)),
        Object.fromEntries(await storedOf(ctx.db, first._id, widgetings)),
        Object.fromEntries(await storedFor(ctx.db, second._id)),
      ]
    })
    expect(walked).to.deep.eq(celled)
    const shared = idOf('nn_0')
    expect(Object.keys(others)).to.deep.eq([shared])
    expect(sayingOf(present(others[shared]).newest)).to.eq('the other question')
  })

  it("reads nothing for a question with nothing recorded", async () => {
    const { tt, quiz_id } = await holding(huntHolding([quizWorking(['nn_0', 'nn_1'])]))
    const { questions } = await rowsOf(tt, quiz_id)
    const question_id = present(questions[0])._id
    const stored = await tt.run(async (ctx) => Object.fromEntries(await storedFor(ctx.db, question_id)))
    expect(stored).to.deep.eq({})
  })

  it("reads only widgeteds, and of each cell only as far as its newest ok row: one range per cell with one, and one to find the end", async () => {
    const { tt, quiz_id, first } = await recorded()
    const [walked, celled] = await tt.run(async (ctx) => {
      const walking = counting(ctx.db)
      await storedFor(walking.db, first._id)
      const celling = counting(ctx.db)
      await storedOf(celling.db, first._id, await widgetingsOf(celling.db, quiz_id))
      return [plainReads(walking.reads), plainReads(celling.reads)]
    })
    // nn_0 reads its failure and the answer before it, not the oldest; nn_4 its two failures; nn_7 its one answer.
    // Two cells end in an ok row, so two ranges, and one more finds nothing below the last.
    expect(walked).to.deep.eq({ docs: 5, ranges: 3, tables: ['widgeteds'] })
    // As `questions.open` read before: the quiz's ten widgetings, then one range for each
    expect(celled).to.deep.eq({ docs: 15, ranges: 11, tables: ['widgeteds', 'widgetings'] })
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
  it("answers whose a hunt label is in an org, and whether a widget is worked, across every hunt, with an id or a yes", async () => {
    const tt = openTester()
    const { hunt_id } = await holding({ ...huntHolding([working('dumdum', ['guess'])]), label: 'quiet_otter' }, tt, 'pat_smith')
    await holding({ ...huntHolding([Quiz.blank()]), label: 'loud_heron' }, tt)
    const answers = await tt.run(async (ctx) => {
      const census = censusOf(ctx.db)
      return [
        await census.huntIdInOrg('pat_smith', 'quiet_otter'), await census.huntIdInOrg('lee_jones', 'quiet_otter'), await census.huntIdInOrg('pat_smith', 'no_such_hunt'),
        await census.isWorked('dumdum'), await census.isWorked('numnum_hint'),
      ]
    })
    expect(answers).to.deep.eq([hunt_id, null, null, true, false])
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
        await ctx.db.insert('widgetings', { hunt_id, quiz_id, widget_label: 'dumdum', label: `guess_${String(ii)}`, description: '', params: {}, tier: 'question', position: ii })
      }
    })
    const usage = await tt.run(async (ctx) => await usageOf(ctx.db, 'dumdum'))
    expect(usage).to.deep.eq({ widgetings: PA.WidgetingsCounted.max, quizzes: 1, hunts: 1, at_least: true })
  })
})

describe("userForUserlabel", () => {
  it("is the user holding a userlabel, and null for one nobody holds", async () => {
    const tt = openTester()
    const flip = await googleUser(tt, 'flip_kromer')
    await anonymousSession(tt)
    const found = await tt.run(async (ctx) => [await userForUserlabel(ctx.db, 'flip_kromer'), await userForUserlabel(ctx.db, 'quiet_otter')])
    expect(found.map((user) => user?._id ?? null)).to.deep.eq([flip.user_id, null])
  })
})

/** Mark `gone` merged into `into`, by the Google account `account_id`, as a merge leaves it */
async function merge(tt: Tester, gone: Id<'users'>, into: Id<'users'>, account_id: Id<'authAccounts'>): Promise<void> {
  await tt.run(async (ctx) => { await ctx.db.patch('users', gone, { merged: { into_user_id: into, account_id } }) })
}

describe("nameChoiceFor", () => {
  it("is the earliest user merged into this one still holding its userlabel, and null once none does", async () => {
    const tt = openTester()
    const alice = await googleUser(tt, 'alice_google')
    const account = present(await tt.run(async (ctx) => await googleAccountOf(ctx.db, alice.user_id)))
    const [first, second, unlabelled] = [await anonymousUser(tt, 'anon_first'), await anonymousUser(tt, 'anon_second'), await anonymousSession(tt)]
    const choiceNow = async () => {
      const choice = await tt.run(async (ctx) => await nameChoiceFor(ctx.db, alice.user_id))
      return choice?.userlabel ?? null
    }
    expect(await choiceNow()).to.be.null
    await merge(tt, unlabelled.user_id, alice.user_id, account._id)
    expect(await choiceNow()).to.be.null
    await merge(tt, first.user_id, alice.user_id, account._id)
    await merge(tt, second.user_id, alice.user_id, account._id)
    expect(await choiceNow()).to.eq('anon_first')
    await tt.run(async (ctx) => { await ctx.db.patch('users', first.user_id, { userlabel: undefined }) })
    expect(await choiceNow()).to.eq('anon_second')
    await tt.run(async (ctx) => { await ctx.db.patch('users', second.user_id, { userlabel: undefined }) })
    expect(await choiceNow()).to.be.null
  })

  it("is null for a user nothing was merged into, whatever was merged into another", async () => {
    const tt = openTester()
    const [alice, bob] = [await googleUser(tt, 'alice_google'), await googleUser(tt, 'bob_google')]
    const account = present(await tt.run(async (ctx) => await googleAccountOf(ctx.db, alice.user_id)))
    const anon = await anonymousUser(tt, 'anon_first')
    await merge(tt, anon.user_id, alice.user_id, account._id)
    expect(await tt.run(async (ctx) => await nameChoiceFor(ctx.db, bob.user_id))).to.be.null
  })
})

describe("googleAccountOf", () => {
  it("is a Google user's Google account, and null for an anonymous user", async () => {
    const tt = openTester()
    const [alice, anon] = [await googleUser(tt, 'alice_google'), await anonymousUser(tt, 'anon_alice')]
    const account = present(await tt.run(async (ctx) => await googleAccountOf(ctx.db, alice.user_id)))
    expect([account.userId, account.provider, account.providerAccountId]).to.deep.eq([alice.user_id, 'google', 'google-sub-alice_google'])
    expect(await tt.run(async (ctx) => await googleAccountOf(ctx.db, anon.user_id))).to.be.null
  })
})

describe("holderOfUserlabel", () => {
  it("says what holds a userlabel: a user, a ghosting, or a hunt's address; null when it is free", async () => {
    const tt = openTester()
    const flip = await googleUser(tt, 'flip_kromer')
    await tt.run(async (ctx) => {
      const account = present(await ctx.db.query('authAccounts').first())
      await ctx.db.insert('ghostings', { userlabel: 'old_flip', user_id: flip.user_id, into_user_id: flip.user_id, account_id: account._id })
      await ctx.db.insert('hunts', { label: 'spring_hunt', orglabel: 'pat_smiths', title: '', branch: 'main' })
    })
    const held = await tt.run(async (ctx) => await Promise.all(['flip_kromer', 'old_flip', 'pat_smiths', 'quiet_otter'].map(async (userlabel) => await holderOfUserlabel(ctx.db, userlabel))))
    expect(held).to.deep.eq(['user', 'ghosting', 'address', null])
  })

  it("finds a ghosting by its userlabel, and nothing for one none holds", async () => {
    const tt = openTester()
    const flip = await googleUser(tt, 'flip_kromer')
    await tt.run(async (ctx) => {
      const account = present(await ctx.db.query('authAccounts').first())
      await ctx.db.insert('ghostings', { userlabel: 'old_flip', user_id: flip.user_id, into_user_id: flip.user_id, account_id: account._id })
    })
    const found = await tt.run(async (ctx) => [await ghostingFor(ctx.db, 'old_flip'), await ghostingFor(ctx.db, 'flip_kromer')])
    expect(found.map((ghosting) => ghosting?.userlabel ?? null)).to.deep.eq(['old_flip', null])
  })
})

describe("censusOf: who a user is", () => {
  it("tells of a user, by userlabel or by id, its face alone: userlabel, title, anonymous or not, and never its email", async () => {
    const tt = openTester()
    const [flip, anon] = [await googleUser(tt, 'flip_kromer'), await anonymousUser(tt, 'anon_otter')]
    const faces = await tt.run(async (ctx) => {
      const census = censusOf(ctx.db)
      return [await census.userByLabel('flip_kromer'), await census.userById(anon.user_id), await census.userByLabel('nobody_here')]
    })
    expect(faces).to.deep.eq([
      { _id: flip.user_id, userlabel: 'flip_kromer', title: 'Flip Kromer', anonymous: false },
      { _id: anon.user_id, userlabel: 'anon_otter', title: 'Anon Otter', anonymous: true },
      null,
    ])
  })

  it("tells nothing of a user holding no userlabel", async () => {
    const tt = openTester()
    const session = await anonymousSession(tt)
    expect(await tt.run(async (ctx) => await censusOf(ctx.db).userById(session.user_id))).to.be.null
  })
})

describe("reviewFor", () => {
  it("finds the user's review of a quiz, and nothing for a user with none", async () => {
    const { tt, hunt_id, quiz_id } = await holding(Hunt.blank())
    const [alice, bob] = [await googleUser(tt, 'alice_reviews'), await googleUser(tt, 'bob_reviews')]
    await tt.run(async (ctx) => { await ctx.db.insert('reviews', { hunt_id, quiz_id, user_id: alice.user_id, overall: 'Mine', phase: 'draft' }) })
    const found = await tt.run(async (ctx) => [await reviewFor(ctx.db, quiz_id, alice.user_id), await reviewFor(ctx.db, quiz_id, bob.user_id)])
    expect(found.map((review) => review?.overall ?? null)).to.deep.eq(['Mine', null])
  })

  it("takes the earlier when two reviews answer to one user", async () => {
    const { tt, hunt_id, quiz_id } = await holding(Hunt.blank())
    const { user_id } = await googleUser(tt, 'alice_reviews')
    await tt.run(async (ctx) => {
      await ctx.db.insert('reviews', { hunt_id, quiz_id, user_id, overall: 'First', phase: 'empty' })
      await ctx.db.insert('reviews', { hunt_id, quiz_id, user_id, overall: 'Second', phase: 'empty' })
    })
    const found = await tt.run(async (ctx) => await reviewFor(ctx.db, quiz_id, user_id))
    expect(found?.overall).to.eq('First')
  })
})

describe("membersOf", () => {
  it("reads each member's userlabel and title off their huntship, not their user", async () => {
    const { tt, hunt_id } = await holding(Hunt.blank())
    const alice = await googleUser(tt, 'alice_reviews')
    await putOn(tt, hunt_id, alice.user_id, 'reviewer')
    await tt.run(async (ctx) => {
      const huntship = present(await huntshipFor(ctx.db, hunt_id, alice.user_id))
      await ctx.db.patch('huntships', huntship._id, { usertitle: 'As The Huntship Holds It' })
    })
    const members = await tt.run(async (ctx) => await membersOf(ctx.db, hunt_id))
    expect(members.map(({ label, title, role }) => [label, title, role])).to.deep.eq([['alice_reviews', 'As The Huntship Holds It', 'reviewer']])
  })
})

