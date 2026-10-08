import _ from 'es-toolkit/compat'
import { describe, expect, it } from 'vitest'
import { BlankJsonataDraft, draftOf, planNewWidget, planWidgetEdit, type JsonataDraft } from '../../../src/state/widget-edit'
import { planWidgetingEdit } from '../../../src/lib/widgeting-edit'
import * as Wheel from '../../../src/lib/wheel'
import { Question } from '../../../src/models/question'
import { Hunt, type HuntT } from '../../../src/models/hunt'
import type { HuntActionDNA } from '../../../src/models/actions'
import type { WidgetedRecordingDNA } from '../../../src/models/widgeted'
import { present } from '../../support/present'
import { huntHolding, openOf, openTester, refusedAs, seedHunt, type Seeded, type Seen } from '../../support/convex'
import { classicHunt } from '../../support/layouts'
import { expectSound } from '../../support/soundness'
import { noticeOf } from '../../../src/lib/refusals'

/** A fresh hunt with its quiz laid out as every new quiz was before they started lean */
function standard(locked = false): HuntT {
  const hunt = classicHunt()
  return { ...hunt, realms: hunt.realms.map((realm) => ({ ...realm, quizzes: realm.quizzes.map((quiz) => ({ ...quiz, locked })) })) }
}

/** The one quiz of a fresh classic hunt */
const standardQuiz = () => present(Hunt.quizzesOf(standard())[0])

/** A standard hunt whose one quiz holds `questions` */
const standardWith = (questions: ReturnType<typeof Question.blank>[]) => huntHolding([{ ...standardQuiz(), questions }])

const quizOf       = (seen: Seen) => openOf(seen)
const widgetingsOf = (seen: Seen) => quizOf(seen).widgetings.map((widgeting) => widgeting.label)
const columnsOf    = (seen: Seen) => quizOf(seen).columns.map((column) => column.label)
const StandardColumns    = standardQuiz().columns.map((column) => column.label)
const StandardWidgetings = standardQuiz().widgetings.map((widgeting) => widgeting.label)

const Backward = { widget_label: 'answer_reversed', label: 'backward' }

const seed = async (hunt: HuntT = standard()) => await seedHunt(openTester(), hunt)

/** A standard hunt with the `backward` widgeting added */
async function withWidgeting(): Promise<Seeded> {
  const seeded = await seed()
  await seeded.act({ kind: 'add_widgeting', widgeting: Backward })
  return seeded
}

/** Each of `refusals` refused for its own reason, and whatever `seeded` holds unchanged by them */
async function expectRefused(seeded: Seeded, ...refusals: [HuntActionDNA, string][]): Promise<void> {
  const ante = await seeded.read()
  for (const [action, failurekind] of refusals) { expect(await refusedAs(seeded.act(action))).to.eq(failurekind) }
  expect(await seeded.read()).to.deep.eq(ante)
}

/** Whether each of `actions` was refused for taking a label the questions already answer to, and whether whatever `seeded` holds is unchanged by them */
async function reservedRefusalsOf(seeded: Seeded, ...actions: HuntActionDNA[]): Promise<{ refused: boolean[], unchanged: boolean }> {
  const ante = await seeded.read()
  const refused: boolean[] = []
  for (const action of actions) {
    try {
      await seeded.act(action)
      refused.push(false)
    } catch (err) {
      refused.push(err instanceof Error && err.message.includes('already answer to'))
    }
  }
  return { refused, unchanged: _.isEqual(await seeded.read(), ante) }
}

/** A seeded standard hunt holding one question, with a value recorded for it by `dumdum` and by `numnum_clueing` */
async function withStored(): Promise<Seeded & { question_id: string }> {
  const seeded = await seed(standardWith([{ ...Question.blank(), clueing: 'Where?' }]))
  const question_id = present(quizOf(await seeded.read()).questions[0])._id
  const recordings: WidgetedRecordingDNA[] = [
    { question_id, widgeting_label: 'dumdum', status: 'ok', value: { guess: 'Lyon', explanation: '' } },
    { question_id, widgeting_label: 'numnum_clueing', status: 'ok', value: { items: [] } },
  ]
  for (const widgeted of recordings) { await seeded.act({ kind: 'record_widgeted', widgeted }) }
  return { ...seeded, question_id }
}

/** How many widgeteds the deployment holds, by the label of the widgeting each is of */
async function widgetedCounts({ tt }: Seeded): Promise<Record<string, number>> {
  return await tt.run(async (ctx) => {
    const rows = await ctx.db.query('widgeteds').collect()
    const widgetings = await Promise.all(rows.map(async (row) => await ctx.db.get('widgetings', row.widgeting_id)))
    return _.countBy(widgetings, (widgeting) => present(widgeting).label)
  })
}

describe("add_widgeting", () => {
  it("adds a widgeting to the end of the open quiz's run order, its description and params defaulted", async () => {
    const { read } = await withWidgeting()
    expect(quizOf(await read()).widgetings.at(-1)).to.deep.eq({ ...Backward, description: '', params: {}, tier: 'question' })
  })

  it("adds one that runs once per quiz at that tier", async () => {
    const { act, read } = await seed()
    await act({ kind: 'add_widgeting', widgeting: { ...Backward, tier: 'quiz' } })
    expect(quizOf(await read()).widgetings.at(-1)?.tier).to.eq('quiz')
  })

  it("adds no column: a widgeting is what has a value, and where it is shown is another matter", async () => {
    const { read } = await withWidgeting()
    expect(columnsOf(await read())).to.deep.eq(StandardColumns)
  })

  it("can work one widget twice, under two labels", async () => {
    const { tt, act, read } = await withWidgeting()
    await act({ kind: 'add_widgeting', widgeting: { ...Backward, label: 'backward_again' } })
    expect(quizOf(await read()).widgetings.slice(-2).map((widgeting) => [widgeting.widget_label, widgeting.label])).to.deep.eq([['answer_reversed', 'backward'], ['answer_reversed', 'backward_again']])
    await expectSound(tt)
  })

  it("refuses a label a sibling has, and a widget the library does not hold, leaving the hunt as it was", async () => {
    await expectRefused(await withWidgeting(),
      [{ kind: 'add_widgeting', widgeting: { ...Backward, description: 'again' } },           'labelTaken'],
      [{ kind: 'add_widgeting', widgeting: { widget_label: 'no_such_widget', label: 'gone' } }, 'widgetGone'])
  })

  it("refuses a label the questions already answer to, at the door", async () => {
    const refusals = await reservedRefusalsOf(await seed(),
      { kind: 'add_widgeting', widgeting: { ...Backward, label: 'title' } },
      { kind: 'add_widgeting', widgeting: { ...Backward, label: 'rank' } },
      { kind: 'add_widgeting', widgeting: { ...Backward, label: 'question' } },
      { kind: 'add_widgeting', widgeting: { ...Backward, label: 'butnot' } })
    expect(refusals).to.deep.eq({ refused: [true, true, true, true], unchanged: true })
  })

  it("refuses a widgeting that is not one", async () => {
    const { act } = await seed()
    await expect(act({ kind: 'add_widgeting', widgeting: { ...Backward, label: 'No Good' } })).rejects.toThrow()
  })

  it("refuses while the quiz is locked", async () => {
    await expectRefused(await seed(standard(true)), [{ kind: 'add_widgeting', widgeting: Backward }, 'quizLocked'])
  })
})

describe("edit_widgeting", () => {
  it("revises the fields named and no others", async () => {
    const { act, read } = await withWidgeting()
    await act({ kind: 'edit_widgeting', label: 'backward', patch: { description: 'Because.', params: { strict: true } } })
    expect(quizOf(await read()).widgetings.at(-1)).to.deep.eq({ ...Backward, description: 'Because.', params: { strict: true }, tier: 'question' })
  })

  it("renames a widgeting, carrying the columns that show it along, and leaving the rest", async () => {
    const { act, read } = await seed()
    await act({ kind: 'edit_widgeting', label: 'hint_full', patch: { label: 'hint_sum' } })
    const after = await read()
    expect(widgetingsOf(after)).to.deep.eq(StandardWidgetings.map((label) => (label === 'hint_full' ? 'hint_sum' : label)))
    expect(quizOf(after).columns.map((column) => [column.label, column.source]).filter(([label]) => label?.startsWith('hint'))).to.deep.eq([
      ['hint', 'hint'], ['hint_full', 'hint_sum'], ['hint_numeral', 'hint_numeral'], ['hint_ishes', 'numnum_hint'],
    ])
  })

  it("keeps what a renamed widgeting stored, under its new label", async () => {
    const { act, read } = await withStored()
    await act({ kind: 'edit_widgeting', label: 'dumdum', patch: { label: 'quick_guess' } })
    const { stored } = present(quizOf(await read()).questions[0])
    expect(Object.keys(stored)).to.have.members(['quick_guess', 'numnum_clueing'])
    expect(stored.quick_guess?.ok?.value).to.deep.eq({ guess: 'Lyon', explanation: '' })
  })

  it("refuses a rename onto a sibling's label, and a widgeting the quiz does not have", async () => {
    await expectRefused(await withWidgeting(),
      [{ kind: 'edit_widgeting', label: 'backward', patch: { label: 'dumdum' } },  'labelTaken'],
      [{ kind: 'edit_widgeting', label: 'absent', patch: { description: 'x' } },  'widgetingGone'])
  })

  it("refuses a rename onto a label the questions already answer to, at the door", async () => {
    const refusals = await reservedRefusalsOf(await withWidgeting(),
      { kind: 'edit_widgeting', label: 'backward', patch: { label: 'title' } },
      { kind: 'edit_widgeting', label: 'backward', patch: { label: 'rank' } })
    expect(refusals).to.deep.eq({ refused: [true, true], unchanged: true })
  })

  it("refuses while the quiz is locked", async () => {
    await expectRefused(await seed(standard(true)), [{ kind: 'edit_widgeting', label: 'dumdum', patch: { description: 'x' } }, 'quizLocked'])
  })
})

/** `seeded` with each of its quiz's columns labelled `columnLabels` removed, so none holds back what it showed */
async function unshown(seeded: Seeded, ...columnLabels: string[]): Promise<Seeded> {
  for (const label of columnLabels) { await seeded.act({ kind: 'delete_column', label }) }
  return seeded
}

/** The sentence `pending` was refused with; fails the test when it went through */
async function refusalSaid(pending: Promise<unknown>): Promise<string> {
  try {
    await pending
  } catch (err) {
    return noticeOf(err)
  }
  throw new Error('expected a refusal, and the call went through')
}

describe("delete_widgeting", () => {
  it("refuses while a column shows it, naming the column, and leaves the quiz as it was", async () => {
    const seeded = await seed()
    await expectRefused(seeded, [{ kind: 'delete_widgeting', label: 'hint_full' }, 'widgetingShown'])
    expect(await refusalSaid(seeded.act({ kind: 'delete_widgeting', label: 'hint_full' }))).to.eq('The column “Hint Full Sum” still shows that widgeting — remove the column first.')
  })

  it("removes the widgeting once no column shows it, and no other, leaving the columns as they are", async () => {
    const { tt, act, read } = await unshown(await seed(), 'hint_full')
    await act({ kind: 'delete_widgeting', label: 'hint_full' })
    const after = await read()
    expect(widgetingsOf(after)).to.deep.eq(StandardWidgetings.filter((label) => label !== 'hint_full'))
    expect(columnsOf(after)).to.deep.eq(StandardColumns.filter((label) => label !== 'hint_full'))
    await expectSound(tt)
  })

  it("is not held back by a formula that reads it, which reads nothing afterwards", async () => {
    const { act, actOnLibrary, read } = await withWidgeting()
    await actOnLibrary({ kind: 'add_widget', widget: { label: 'echo', formulary: 'jsonata', formula: 'qn.backward' } })
    await act({ kind: 'add_widgeting', widgeting: { widget_label: 'echo', label: 'echo' } })
    await act({ kind: 'delete_widgeting', label: 'backward' })
    expect(widgetingsOf(await read())).to.include('echo').and.not.include('backward')
  })

  it("takes what it stored with it, and leaves what its siblings stored", async () => {
    const seeded = await withStored()
    expect(await widgetedCounts(seeded)).to.deep.eq({ dumdum: 1, numnum_clueing: 1 })
    await unshown(seeded, 'guess')
    await seeded.act({ kind: 'delete_widgeting', label: 'dumdum' })
    expect(await widgetedCounts(seeded)).to.deep.eq({ numnum_clueing: 1 })
    await expectSound(seeded.tt)
  })

  it("leaves the widget it worked in the library", async () => {
    const { act, read } = await unshown(await seed(), 'guess')
    const ante = await read()
    await act({ kind: 'delete_widgeting', label: 'dumdum' })
    const { library } = await read()
    expect(library).to.deep.eq(ante.library)
  })

  it("keeps the quiz's sort memory, which names a column", async () => {
    const { act, read } = await unshown(await seed(), 'hint_full')
    await act({ kind: 'sort_questions', sortkey: 'column:clueing_full', descending: false })
    await act({ kind: 'delete_widgeting', label: 'hint_full' })
    expect(quizOf(await read()).last_sortkey).to.eq('column:clueing_full')
  })

  it("does nothing for a widgeting already gone", async () => {
    const seeded = await seed()
    const ante = await seeded.read()
    await seeded.act({ kind: 'delete_widgeting', label: 'absent' })
    expect(await seeded.read()).to.deep.eq(ante)
  })

  it("refuses while the quiz is locked", async () => {
    await expectRefused(await seed(standard(true)), [{ kind: 'delete_widgeting', label: 'hint_full' }, 'quizLocked'])
  })
})

describe("move_widgeting", () => {
  it("reorders the widgetings, and only them", async () => {
    const { act, read } = await seed()
    await act({ kind: 'move_widgeting', label: 'hint_full', onto_idx: 0 })
    const after = await read()
    expect(widgetingsOf(after)).to.deep.eq(['hint_full', ...StandardWidgetings.filter((label) => label !== 'hint_full')])
    expect(columnsOf(after)).to.deep.eq(StandardColumns)
  })

  it("puts a widgeting at the end for an index past it, and refuses a label it does not have", async () => {
    const { act, read } = await seed()
    await act({ kind: 'move_widgeting', label: 'dumdum', onto_idx: 99 })
    expect(widgetingsOf(await read()).at(-1)).to.eq('dumdum')
    await expectRefused(await seed(), [{ kind: 'move_widgeting', label: 'absent', onto_idx: 0 }, 'widgetingGone'])
  })

  it("refuses while the quiz is locked", async () => {
    await expectRefused(await seed(standard(true)), [{ kind: 'move_widgeting', label: 'hint_full', onto_idx: 0 }, 'quizLocked'])
  })
})

describe("add_column", () => {
  const column = { label: 'notes_again', title: 'Notes again', source: 'notes', width_px: 200 }

  it("adds a column to the end", async () => {
    const { tt, act, read } = await seed()
    await act({ kind: 'add_column', column })
    expect(columnsOf(await read())).to.deep.eq([...StandardColumns, 'notes_again'])
    await expectSound(tt)
  })

  it("adds it at an index when given one, the rest keeping their order", async () => {
    const { act, read } = await seed()
    await act({ kind: 'add_column', column, onto_idx: 1 })
    expect(columnsOf(await read())).to.deep.eq([StandardColumns[0], 'notes_again', ...StandardColumns.slice(1)])
  })

  it("can show a widgeting, or a question field, or a view", async () => {
    const { act, read } = await seed()
    for (const [idx, source] of ['dumdum', 'title', 'butnot'].entries()) {
      await act({ kind: 'add_column', column: { ...column, label: `again_${String(idx)}`, source } })
    }
    expect(columnsOf(await read())).to.include.members(['again_0', 'again_1', 'again_2'])
  })

  it("refuses a label a column has, and a source the quiz cannot show", async () => {
    await expectRefused(await seed(),
      [{ kind: 'add_column', column: { ...column, label: 'title' } },    'labelTaken'],
      [{ kind: 'add_column', column: { ...column, source: 'nowhere' } }, 'sourceUnshowable'])
  })

  it("refuses a column that is not one", async () => {
    const { act } = await seed()
    await expect(act({ kind: 'add_column', column: { ...column, width_px: 5 } })).rejects.toThrow()
  })

  it("refuses while the quiz is locked", async () => {
    await expectRefused(await seed(standard(true)), [{ kind: 'add_column', column }, 'quizLocked'])
  })
})

describe("edit_column", () => {
  it("revises only what is named", async () => {
    const { act, read } = await seed()
    await act({ kind: 'edit_column', label: 'notes', patch: { title: 'My notes', width_px: 300 } })
    expect(quizOf(await read()).columns.find((column) => column.label === 'notes')).to.deep.eq({ label: 'notes', title: 'My notes', source: 'notes', width_px: 300 })
  })

  it("aligns a column, which the quiz then reads back; a column never aligned reads as having no alignment", async () => {
    const { tt, act, read } = await seed()
    await act({ kind: 'edit_column', label: 'notes', patch: { align: 'center' } })
    const { columns } = quizOf(await read())
    expect(columns.find((column) => column.label === 'notes')?.align).to.eq('center')
    expect(columns.find((column) => column.label === 'title')).to.not.have.property('align')
    await expectSound(tt)
  })

  it("refuses an alignment there is not", async () => {
    const { act } = await seed()
    await expect(act({ kind: 'edit_column', label: 'notes', patch: { align: 'middle' as never } })).rejects.toThrow()
  })

  it("renames a column, carrying the quiz's sort memory with it", async () => {
    const { act, read } = await seed()
    await act({ kind: 'sort_questions', sortkey: 'column:title', descending: false })
    await act({ kind: 'edit_column', label: 'title', patch: { label: 'nickname' } })
    expect(quizOf(await read()).last_sortkey).to.eq('column:nickname')
  })

  it("points a column at another thing to show", async () => {
    const { act, read } = await seed()
    await act({ kind: 'edit_column', label: 'notes', patch: { source: 'alt_text' } })
    expect(quizOf(await read()).columns.find((column) => column.label === 'notes')?.source).to.eq('alt_text')
  })

  it("refuses a rename onto a sibling's label, a source nothing can show, and a column that is not there", async () => {
    await expectRefused(await seed(),
      [{ kind: 'edit_column', label: 'notes', patch: { label: 'hint' } },      'labelTaken'],
      [{ kind: 'edit_column', label: 'notes', patch: { source: 'nowhere' } },  'sourceUnshowable'],
      [{ kind: 'edit_column', label: 'absent', patch: { title: 'x' } },        'columnGone'])
  })

  it("refuses while the quiz is locked", async () => {
    await expectRefused(await seed(standard(true)), [{ kind: 'edit_column', label: 'notes', patch: { title: 'x' } }, 'quizLocked'])
  })
})

describe("delete_column", () => {
  it("removes the column and keeps the widgeting it showed", async () => {
    const { act, read } = await seed()
    await act({ kind: 'delete_column', label: 'hint_full' })
    const after = await read()
    expect(columnsOf(after)).to.not.include('hint_full')
    expect(widgetingsOf(after)).to.include('hint_full')
  })

  it("forgets a sort memory that named it", async () => {
    const { act, read } = await seed()
    await act({ kind: 'sort_questions', sortkey: 'column:hint_full', descending: false })
    await act({ kind: 'delete_column', label: 'hint_full' })
    expect(quizOf(await read()).last_sortkey).to.be.null
  })

  it("can remove a fixed column too, since it is a column like any other", async () => {
    const { act, read } = await seed()
    await act({ kind: 'delete_column', label: 'clueing' })
    expect(columnsOf(await read())).to.not.include('clueing')
  })
})

describe("move_column", () => {
  it("reorders the columns, and only them", async () => {
    const { act, read } = await seed()
    await act({ kind: 'move_column', label: 'notes', onto_idx: 0 })
    const after = await read()
    expect(columnsOf(after)).to.deep.eq(['notes', ...StandardColumns.filter((label) => label !== 'notes')])
    expect(widgetingsOf(after)).to.deep.eq(StandardWidgetings)
  })

  it("does not touch the questions", async () => {
    const { act, read } = await seed()
    const ante = await read()
    await act({ kind: 'move_column', label: 'notes', onto_idx: 0 })
    expect(quizOf(await read()).questions).to.deep.eq(quizOf(ante).questions)
  })
})

describe("set_templateable", () => {
  it("nominates the sources the open quiz templates, replacing those it did", async () => {
    const { act, read } = await withWidgeting()
    await act({ kind: 'set_templateable', templateable: ['clueing', 'backward'] })
    await act({ kind: 'set_templateable', templateable: ['recap', 'backward'] })
    expect(quizOf(await read()).templateable).to.deep.eq(['recap', 'backward'])
  })

  it("templates nothing once emptied", async () => {
    const { act, read } = await withWidgeting()
    await act({ kind: 'set_templateable', templateable: ['backward'] })
    await act({ kind: 'set_templateable', templateable: [] })
    expect(quizOf(await read()).templateable).to.deep.eq([])
  })

  it("refuses a widgeting the quiz does not have, and refuses while the quiz is locked, leaving the hunt as it was", async () => {
    await expectRefused(await withWidgeting(), [{ kind: 'set_templateable', templateable: ['clueing', 'nowhere'] }, 'untemplatable'])
    await expectRefused(await seed(standard(true)), [{ kind: 'set_templateable', templateable: ['recap'] }, 'quizLocked'])
  })

  it("carries a templated widgeting along when it is renamed, and drops it when it is deleted", async () => {
    const { tt, act, read } = await withWidgeting()
    await act({ kind: 'set_templateable', templateable: ['backward', 'recap'] })
    await act({ kind: 'edit_widgeting', label: 'backward', patch: { label: 'mirror' } })
    expect(quizOf(await read()).templateable).to.deep.eq(['mirror', 'recap'])
    await act({ kind: 'delete_widgeting', label: 'mirror' })
    expect(quizOf(await read()).templateable).to.deep.eq(['recap'])
    await expectSound(tt)
  })
})

describe("sort_questions by a column that shows a jsonata widgeting", () => {
  it("orders the questions by what the widgeting came to, and remembers the column", async () => {
    const { act, read } = await seed(standardWith(['ccc', 'a', 'bb'].map((full_answer) => ({ ...Question.blank(), full_answer }))))
    await act({ kind: 'add_widgeting', widgeting: { widget_label: 'answer_letter_count', label: 'letters' } })
    await act({ kind: 'add_column', column: { label: 'letters', title: 'Letters', source: 'letters', width_px: 78 } })
    await act({ kind: 'sort_questions', sortkey: 'column:letters', descending: false })
    const after = quizOf(await read())
    expect(after.questions.map((question) => question.full_answer)).to.deep.eq(['a', 'bb', 'ccc'])
    expect(after.last_sortkey).to.eq('column:letters')
  })

  it("works the formula out with the hunt and the realm the quiz sits in, as the grid does", async () => {
    const hunt = standardWith(['x', 'Home', 'Lakeside'].map((full_answer) => ({ ...Question.blank(), full_answer })))
    const { act, actOnLibrary, read } = await seed({ ...hunt, title: 'Lakeside' })
    await actOnLibrary({ kind: 'add_widget', widget: { label: 'placed', formulary: 'jsonata', formula: 'qn.full_answer = hunt.title ? 0 : qn.full_answer = realm.title ? 1 : 2' } })
    await act({ kind: 'add_widgeting', widgeting: { widget_label: 'placed', label: 'placed' } })
    await act({ kind: 'add_column', column: { label: 'placed', title: 'Placed', source: 'placed', width_px: 78 } })
    await act({ kind: 'sort_questions', sortkey: 'column:placed', descending: false })
    expect(quizOf(await read()).questions.map((question) => question.full_answer)).to.deep.eq(['Lakeside', 'Home', 'x'])
  })
})

/** A column labelled and titled `label`, showing `source` */
const columnFor = (label: string, source: string) => ({ label, title: label, source, width_px: 80 })

/** The two columns of `cats` that `withParts` adds, as `[column label, source, formula]`, while the quiz has them */
const partColumnsOf = (seen: Seen) => quizOf(seen).columns.filter((column) => ['cats', 'masie'].includes(column.label)).map((column) => [column.label, column.source, column.formula])

describe("a category-estimate widgeting's parts", () => {
  const Cats = { widget_label: 'category_data', label: 'cats' }

  /** A standard hunt working the category-estimate entry as `cats`, with a column of it whole and one of Masie's chance */
  async function withParts(hunt: HuntT = standard()): Promise<Seeded> {
    const seeded = await seed(hunt)
    await seeded.act({ kind: 'add_widgeting', widgeting: Cats })
    await seeded.act({ kind: 'add_column', column: columnFor('cats', 'cats') })
    await seeded.act({ kind: 'add_column', column: columnFor('masie', 'cats.masie') })
    return seeded
  }

  it("can be shown in columns, each part beside the widgeting whole, by the formula that picks it", async () => {
    const { read } = await withParts()
    expect(partColumnsOf(await read())).to.deep.eq([['cats', 'cats', undefined], ['masie', 'cats', '$.masie']])
  })

  it("are written in the plain grammar however a browser names them, one from before October 2026 included", async () => {
    const { act, read } = await withParts()
    await act({ kind: 'edit_column', label: 'cats', patch: { source: 'cats.average' } })
    await act({ kind: 'edit_column', label: 'masie', patch: { source: 'cats', formula: null } })
    expect(partColumnsOf(await read())).to.deep.eq([['cats', 'cats', '$.average'], ['masie', 'cats', undefined]])
  })

  it("are refused of a widgeting the quiz does not have", async () => {
    await expectRefused(await withParts(),
      [{ kind: 'add_column', column: columnFor('gone_masie', 'gone.masie') }, 'sourceUnshowable'],
      [{ kind: 'edit_column', label: 'masie', patch: { source: 'gone' } }, 'sourceUnshowable'])
  })

  it("follow the widgeting when it is renamed, their formulas kept, and hold it back from removal as the whole does", async () => {
    const seeded = await withParts()
    await seeded.act({ kind: 'edit_widgeting', label: 'cats', patch: { label: 'topics' } })
    expect(partColumnsOf(await seeded.read())).to.deep.eq([['cats', 'topics', undefined], ['masie', 'topics', '$.masie']])
    await seeded.act({ kind: 'delete_column', label: 'cats' })
    await expectRefused(seeded, [{ kind: 'delete_widgeting', label: 'topics' }, 'widgetingShown'])
    await seeded.act({ kind: 'delete_column', label: 'masie' })
    await seeded.act({ kind: 'delete_widgeting', label: 'topics' })
    expect(widgetingsOf(await seeded.read())).to.not.include('topics')
  })

  it("sort the questions by a persona's chance, read against the hunt's own wheel", async () => {
    const seeded = await withParts(standardWith(['art', 'tv', 'none'].map((title) => ({ ...Question.blank(), title }))))
    const [art, tv] = quizOf(await seeded.read()).questions.map((question) => question._id)
    await seeded.act({ kind: 'enter_widgeted', entered: { question_id: present(art), widgeting_label: 'cats', value: [{ category: 'art', difficulty: 'easy' }] } })
    await seeded.act({ kind: 'enter_widgeted', entered: { question_id: present(tv), widgeting_label: 'cats', value: [{ category: 'tv', difficulty: 'easy' }] } })
    await seeded.act({ kind: 'sort_questions', sortkey: 'column:masie', descending: true })
    expect(quizOf(await seeded.read()).questions.map((question) => question.title)).to.deep.eq(['art', 'tv', 'none'])
    // Masie keeps slot 0; put TV there, and she knows it best.
    await seeded.tt.run(async (ctx) => {
      const hunt = present(await ctx.db.query('hunts').first())
      await ctx.db.patch('hunts', hunt._id, { wheel: Wheel.placed(Wheel.defaultWheel(), 'tv', 0) })
    })
    await seeded.act({ kind: 'sort_questions', sortkey: 'column:masie', descending: true })
    expect(quizOf(await seeded.read()).questions.map((question) => question.title)).to.deep.eq(['tv', 'art', 'none'])
  })
})

describe("the widgetings and columns of a new quiz", () => {
  it("are those a fresh hunt's quiz starts with, whatever the open quiz works", async () => {
    const { act, read } = await seed()
    await act({ kind: 'new_quiz' })
    const { quizzes } = await read()
    const fresh = present(Hunt.quizzesOf(Hunt.blank())[0])
    expect([present(quizzes.at(-1)).widgetings, present(quizzes.at(-1)).columns]).to.deep.eq([fresh.widgetings, fresh.columns])
  })
})

describe("the editors' plans, carried out", () => {
  it("adds a new widget to the library, then a widgeting working it before the library's watch has brought it back, and a column showing it just before Alt Text", async () => {
    const { act, actOnLibrary, read } = await seed()
    const ante = await read()
    const made = planNewWidget({ ...BlankJsonataDraft, label: 'title_length', formula: '$length(qn.title)' }, ante.library)
    if (! made.ok) { throw new Error(made.issue) }
    const plan = planWidgetingEdit({ widgeting: null, label: '', description: '', widgetLabel: made.widget.label }, [...ante.library, made.widget], quizOf(ante))
    if (! plan.ok) { throw new Error(plan.issue) }
    for (const action of made.actions) { await actOnLibrary(action) }
    for (const action of plan.actions) { await act(action) }
    const after = await read()
    expect(after.library.at(-1)?.label).to.eq('title_length')
    expect(widgetingsOf(after).at(-1)).to.eq('title_length')
    const columns = columnsOf(after)
    expect(columns[columns.indexOf('alt_text') - 1]).to.eq('title_length')
  })

  it("revises a widget from a locked quiz, which the lock does not hold, and refuses to revise its widgetings", async () => {
    const { act, actOnLibrary, read } = await seed(standard(true))
    const ante = await read()
    const held = present(quizOf(ante).widgetings.find((widgeting) => widgeting.label === 'clueing_full'))
    const widget = present(ante.library.find((each) => each.label === 'clueing_full'))
    const widgetPlan = planWidgetEdit({ ...(draftOf(widget) as JsonataDraft), description: 'Revised.', formula: '1' }, ante.library)
    const widgetingPlan = planWidgetingEdit({ widgeting: held, label: held.label, description: 'Renamed?', widgetLabel: 'clueing_full' }, ante.library, quizOf(ante))
    if (! widgetPlan.ok || ! widgetingPlan.ok) { throw new Error('Expected both plans') }
    for (const action of widgetPlan.actions) { await actOnLibrary(action) }
    for (const action of widgetingPlan.actions) { expect(await refusedAs(act(action))).to.eq('quizLocked') }
    const after = await read()
    expect(after.library.find((each) => each.label === 'clueing_full')).to.deep.include({ formula: '1', description: 'Revised.' })
    expect(quizOf(after)).to.deep.eq(quizOf(ante))
  })
})

/** The quiz's widgetings in run order, each with its tier */
const tiersOf = (seen: Seen) => quizOf(seen).widgetings.map((widgeting) => `${widgeting.label}:${widgeting.tier}`)

/** A standard hunt (or the one given) whose library holds a text entry, `name_list` */
async function withNames(hunt: HuntT = standard()): Promise<Seeded> {
  const seeded = await seed(hunt)
  await seeded.actOnLibrary({ kind: 'add_widget', widget: { label: 'name_list', formulary: 'entry', config: { entry_kind: 'text' } } })
  return seeded
}

/** A standard hunt working `playtesters` (an entry) and `grand_total` (a formula) for the whole quiz */
async function withQuizWide(): Promise<Seeded> {
  const seeded = await withNames()
  await seeded.act({ kind: 'add_widgeting', widgeting: { widget_label: 'name_list', label: 'playtesters', tier: 'quiz' } })
  await seeded.act({ kind: 'add_widgeting', widgeting: { widget_label: 'clueing_full', label: 'grand_total', tier: 'quiz' } })
  return seeded
}

/** A standard hunt whose library holds a number entry, `grade`, of 1 to 10 */
async function withGrade(): Promise<Seeded> {
  const seeded = await seed()
  await seeded.actOnLibrary({ kind: 'add_widget', widget: { label: 'grade', formulary: 'entry', config: { entry_kind: 'number', min: 1, max: 10 } } })
  return seeded
}

/** The params of the open quiz's widgeting labelled `label` */
const paramsOf = (seen: Seen, label: string) => quizOf(seen).widgetings.find((widgeting) => widgeting.label === label)?.params

describe("a widgeting's params", () => {
  it("are kept when they fit the family of the widget it works, and the widget's defaults beneath them", async () => {
    const { act, read } = await withGrade()
    await act({ kind: 'add_widgeting', widgeting: { widget_label: 'grade', label: 'grade', params: { max: 5, integer: true } } })
    expect(paramsOf(await read(), 'grade')).to.deep.eq({ max: 5, integer: true })
    await act({ kind: 'edit_widgeting', label: 'grade', patch: { params: { min: 2 } } })
    expect(paramsOf(await read(), 'grade')).to.deep.eq({ min: 2 })
  })

  it("are refused, writing nothing, when the family does not take them, or they do not fit the widget's defaults", async () => {
    const seeded = await withGrade()
    const ante = await seeded.read()
    await expect(seeded.act({ kind: 'add_widgeting', widgeting: { widget_label: 'grade', label: 'grade', params: { options: ['a'] } } })).rejects.toThrow()
    await expect(seeded.act({ kind: 'add_widgeting', widgeting: { widget_label: 'grade', label: 'grade', params: { max: 0 } } })).rejects.toThrow(/no less than the least/)
    expect(await seeded.read()).to.deep.eq(ante)
    await seeded.act({ kind: 'add_widgeting', widgeting: { widget_label: 'grade', label: 'grade' } })
    const held = await seeded.read()
    await expect(seeded.act({ kind: 'edit_widgeting', label: 'grade', patch: { params: { integer: 'yes' } } })).rejects.toThrow()
    expect(await seeded.read()).to.deep.eq(held)
  })

  it("are any few settings for a formula's widgeting, as ever", async () => {
    const { act, read } = await seed()
    await act({ kind: 'add_widgeting', widgeting: { ...Backward, params: { size: 3 } } })
    expect(paramsOf(await read(), 'backward')).to.deep.eq({ size: 3 })
  })
})

describe("widgetings run once for the whole quiz", () => {
  it("puts a new one at the end of the run order, where it reads every widgeting before it", async () => {
    const { tt, read } = await withQuizWide()
    expect(tiersOf(await read())).to.deep.eq([...StandardWidgetings.map((label) => `${label}:question`), 'playtesters:quiz', 'grand_total:quiz'])
    await expectSound(tt)
  })

  it("brings no column", async () => {
    const { read } = await withQuizWide()
    expect(columnsOf(await read())).to.deep.eq(StandardColumns)
  })

  it("puts a new widgeting for each question at the end of the run order too, after those of the whole quiz", async () => {
    const { act, read } = await withQuizWide()
    await act({ kind: 'add_widgeting', widgeting: Backward })
    expect(widgetingsOf(await read()).slice(-3)).to.deep.eq(['playtesters', 'grand_total', 'backward'])
  })

  it("refuses a model asked from a cell, a question's category estimates, and a name the quiz itself answers to", async () => {
    const refusals: [HuntActionDNA, string][] = [
      [{ kind: 'add_widgeting', widgeting: { widget_label: 'dumdum', label: 'quiz_guess', tier: 'quiz' } }, 'tierUnoffered'],
      [{ kind: 'add_widgeting', widgeting: { widget_label: 'category_data', label: 'quiz_cats', tier: 'quiz' } }, 'tierUnoffered'],
      [{ kind: 'add_widgeting', widgeting: { widget_label: 'name_list', label: 'smiths_note', tier: 'quiz' } }, 'labelTaken'],
    ]
    await expectRefused(await withNames(), ...refusals)
  })

  it("refuses a rename onto a name the quiz itself answers to, but not for a widgeting for each question", async () => {
    const seeded = await withQuizWide()
    await expectRefused(seeded, [{ kind: 'edit_widgeting', label: 'playtesters', patch: { label: 'smiths_note' } }, 'labelTaken'])
    await seeded.act({ kind: 'edit_widgeting', label: 'dumdum', patch: { label: 'smiths_note' } })
    expect(widgetingsOf(await seeded.read())).to.include('smiths_note')
  })

  it("refuses a column naming one as a widgeting for each question, or a template of one: it has no cell for any question", async () => {
    const refusals: [HuntActionDNA, string][] = [
      [{ kind: 'add_column', column: { label: 'thanks', title: 'Thanks', source: 'playtesters', width_px: 90 } }, 'wrongTier'],
      [{ kind: 'edit_column', label: 'clueing', patch: { source: 'grand_total' } }, 'wrongTier'],
      [{ kind: 'add_column', column: { label: 'guessed', title: 'Guessed', source: 'quiz.dumdum', width_px: 90 } }, 'wrongTier'],
      [{ kind: 'add_column', column: { label: 'gone', title: 'Gone', source: 'quiz.nowhere', width_px: 90 } }, 'sourceUnshowable'],
      [{ kind: 'set_templateable', templateable: ['playtesters'] }, 'wrongTier'],
    ]
    await expectRefused(await withQuizWide(), ...refusals)
  })

  it("is shown in a column by its ref, `quiz.<label>`, which follows it when it is renamed", async () => {
    const { tt, act, read } = await withQuizWide()
    await act({ kind: 'add_column', column: { label: 'thanks', title: 'Thanks', source: 'quiz.playtesters', width_px: 90 } })
    await act({ kind: 'edit_widgeting', label: 'playtesters', patch: { label: 'testers' } })
    expect(quizOf(await read()).columns.find((column) => column.label === 'thanks')?.source).to.eq('quiz.testers')
    await expectSound(tt)
  })

  it("moves one in the one run order, both tiers counted, and leaves them mixed where it was dropped", async () => {
    const { tt, act, read } = await withQuizWide()
    await act({ kind: 'move_widgeting', label: 'playtesters', onto_idx: 0 })
    expect(widgetingsOf(await read())[0]).to.eq('playtesters')
    await act({ kind: 'move_widgeting', label: 'grand_total', onto_idx: 2 })
    const asQuestions = StandardWidgetings.map((label) => `${label}:question`)
    expect(tiersOf(await read()).slice(0, 4)).to.deep.eq(['playtesters:quiz', ...asQuestions.slice(0, 1), 'grand_total:quiz', ...asQuestions.slice(1, 2)])
    await act({ kind: 'move_widgeting', label: 'hint_full', onto_idx: 99 })
    expect(widgetingsOf(await read()).at(-1)).to.eq('hint_full')
    await expectSound(tt)
  })

  it("keeps the tiers mixed as placed when another is added or one removed", async () => {
    const { act, read } = await withNames(Hunt.blank())
    await act({ kind: 'add_widgeting', widgeting: { widget_label: 'name_list', label: 'playtesters', tier: 'quiz' } })
    await act({ kind: 'add_widgeting', widgeting: { widget_label: 'clueing_full', label: 'subtotal', tier: 'question' } })
    await act({ kind: 'add_widgeting', widgeting: { widget_label: 'clueing_full', label: 'grand_total', tier: 'quiz' } })
    await act({ kind: 'add_widgeting', widgeting: { widget_label: 'clueing_full', label: 'late', tier: 'question' } })
    expect(tiersOf(await read())).to.deep.eq(['playtesters:quiz', 'subtotal:question', 'grand_total:quiz', 'late:question'])
    await act({ kind: 'delete_widgeting', label: 'subtotal' })
    expect(tiersOf(await read())).to.deep.eq(['playtesters:quiz', 'grand_total:quiz', 'late:question'])
  })

  it("keeps the run order whole when one is removed", async () => {
    const { tt, act, read } = await withQuizWide()
    await act({ kind: 'delete_widgeting', label: 'playtesters' })
    expect(tiersOf(await read())).to.deep.eq([...StandardWidgetings.map((label) => `${label}:question`), 'grand_total:quiz'])
    await expectSound(tt)
  })
})
