import _ from 'es-toolkit/compat'
import { describe, expect, it } from 'vitest'
import { BlankJsonataDraft, draftOf, planNewWidget, planWidgetEdit } from '../../../src/state/widget-edit'
import { planWidgetingEdit } from '../../../src/state/widgeting-edit'
import { Question } from '../../../src/models/question'
import { Hunt, type HuntT } from '../../../src/models/hunt'
import type { HuntActionDNA } from '../../../src/models/actions'
import type { WidgetedRecordingDNA } from '../../../src/models/widgeted'
import { present } from '../../support/present'
import { huntHolding, openOf, openTester, refusedAs, seedHunt, type Seeded, type Seen } from '../../support/convex'
import { classicHunt } from '../../support/layouts'

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
      refused.push(err instanceof Error && err.message.includes('should not be any of'))
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
    expect(quizOf(await read()).widgetings.at(-1)).to.deep.eq({ ...Backward, description: '', params: {} })
  })

  it("adds no column: a widgeting is what has a value, and where it is shown is another matter", async () => {
    const { read } = await withWidgeting()
    expect(columnsOf(await read())).to.deep.eq(StandardColumns)
  })

  it("can work one widget twice, under two labels", async () => {
    const { act, read } = await withWidgeting()
    await act({ kind: 'add_widgeting', widgeting: { ...Backward, label: 'backward_again' } })
    expect(quizOf(await read()).widgetings.slice(-2).map((widgeting) => [widgeting.widget_label, widgeting.label])).to.deep.eq([['answer_reversed', 'backward'], ['answer_reversed', 'backward_again']])
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
    expect(quizOf(await read()).widgetings.at(-1)).to.deep.eq({ ...Backward, description: 'Because.', params: { strict: true } })
  })

  it("renames a widgeting, carrying the columns that show it along, and leaving the rest", async () => {
    const { act, read } = await seed()
    await act({ kind: 'edit_widgeting', label: 'hint_full', patch: { label: 'hint_sum' } })
    const after = await read()
    expect(widgetingsOf(after)).to.deep.eq(StandardWidgetings.map((label) => (label === 'hint_full' ? 'hint_sum' : label)))
    expect(quizOf(after).columns.map((column) => [column.label, column.source]).filter(([label]) => label?.startsWith('hint'))).to.deep.eq([
      ['hint', 'question.hint'], ['hint_full', 'hint_sum'], ['hint_numeral', 'hint_numeral'], ['hint_ishes', 'numnum_hint'],
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

describe("delete_widgeting", () => {
  it("removes the widgeting, and the columns that showed it, and no others", async () => {
    const { act, read } = await seed()
    await act({ kind: 'delete_widgeting', label: 'hint_full' })
    const after = await read()
    expect(widgetingsOf(after)).to.deep.eq(StandardWidgetings.filter((label) => label !== 'hint_full'))
    expect(columnsOf(after)).to.deep.eq(StandardColumns.filter((label) => label !== 'hint_full'))
  })

  it("takes what it stored with it, and leaves what its siblings stored", async () => {
    const seeded = await withStored()
    expect(await widgetedCounts(seeded)).to.deep.eq({ dumdum: 1, numnum_clueing: 1 })
    await seeded.act({ kind: 'delete_widgeting', label: 'dumdum' })
    expect(await widgetedCounts(seeded)).to.deep.eq({ numnum_clueing: 1 })
    expect(columnsOf(await seeded.read())).to.not.include('guess')
  })

  it("leaves the widget it worked in the library", async () => {
    const { act, read } = await seed()
    const ante = await read()
    await act({ kind: 'delete_widgeting', label: 'dumdum' })
    const { library } = await read()
    expect(library).to.deep.eq(ante.library)
  })

  it("forgets a sort memory that named a column it took with it", async () => {
    const { act, read } = await seed()
    await act({ kind: 'sort_questions', sortkey: 'column:hint_full', descending: false })
    await act({ kind: 'delete_widgeting', label: 'hint_full' })
    expect(quizOf(await read()).last_sortkey).to.be.null
  })

  it("keeps a sort memory that named some other column", async () => {
    const { act, read } = await seed()
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
  const column = { label: 'notes_again', title: 'Notes again', source: 'question.notes', width_px: 200 }

  it("adds a column to the end", async () => {
    const { act, read } = await seed()
    await act({ kind: 'add_column', column })
    expect(columnsOf(await read())).to.deep.eq([...StandardColumns, 'notes_again'])
  })

  it("adds it at an index when given one, the rest keeping their order", async () => {
    const { act, read } = await seed()
    await act({ kind: 'add_column', column, onto_idx: 1 })
    expect(columnsOf(await read())).to.deep.eq([StandardColumns[0], 'notes_again', ...StandardColumns.slice(1)])
  })

  it("can show a widgeting, or a question field, or a view", async () => {
    const { act, read } = await seed()
    for (const [idx, source] of ['dumdum', 'question.title', 'question.butnot'].entries()) {
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
    expect(quizOf(await read()).columns.find((column) => column.label === 'notes')).to.deep.eq({ label: 'notes', title: 'My notes', source: 'question.notes', width_px: 300 })
  })

  it("renames a column, carrying the quiz's sort memory with it", async () => {
    const { act, read } = await seed()
    await act({ kind: 'sort_questions', sortkey: 'column:title', descending: false })
    await act({ kind: 'edit_column', label: 'title', patch: { label: 'name' } })
    expect(quizOf(await read()).last_sortkey).to.eq('column:name')
  })

  it("points a column at another thing to show", async () => {
    const { act, read } = await seed()
    await act({ kind: 'edit_column', label: 'notes', patch: { source: 'question.alt_text' } })
    expect(quizOf(await read()).columns.find((column) => column.label === 'notes')?.source).to.eq('question.alt_text')
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
    const { act, read } = await seed({ ...hunt, title: 'Lakeside' })
    await act({ kind: 'add_widget', widget: { label: 'placed', formulary: 'jsonata', formula: 'qn.full_answer = hunt.title ? 0 : qn.full_answer = realm.title ? 1 : 2' } })
    await act({ kind: 'add_widgeting', widgeting: { widget_label: 'placed', label: 'placed' } })
    await act({ kind: 'add_column', column: { label: 'placed', title: 'Placed', source: 'placed', width_px: 78 } })
    await act({ kind: 'sort_questions', sortkey: 'column:placed', descending: false })
    expect(quizOf(await read()).questions.map((question) => question.full_answer)).to.deep.eq(['Lakeside', 'Home', 'x'])
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
    const { act, read } = await seed()
    const ante = await read()
    const made = planNewWidget({ ...BlankJsonataDraft, label: 'title_length', formula: '$length(qn.title)' }, ante.library)
    if (! made.ok) { throw new Error(made.issue) }
    const plan = planWidgetingEdit({ widgeting: null, label: '', description: '', widgetLabel: made.widget.label }, [...ante.library, made.widget], quizOf(ante))
    if (! plan.ok) { throw new Error(plan.issue) }
    for (const action of [...made.actions, ...plan.actions]) { await act(action) }
    const after = await read()
    expect(after.library.at(-1)?.label).to.eq('title_length')
    expect(widgetingsOf(after).at(-1)).to.eq('title_length')
    const columns = columnsOf(after)
    expect(columns[columns.indexOf('alt_text') - 1]).to.eq('title_length')
  })

  it("revises a widget from a locked quiz, which the lock does not hold, and leaves its widgetings alone", async () => {
    const { act, read } = await seed(standard(true))
    const ante = await read()
    const held = present(quizOf(ante).widgetings.find((widgeting) => widgeting.label === 'clueing_full'))
    const widget = present(ante.library.find((each) => each.label === 'clueing_full'))
    const widgetPlan = planWidgetEdit({ ...draftOf(widget), description: 'Revised.', formula: '1' }, ante.library)
    const widgetingPlan = planWidgetingEdit({ widgeting: held, label: held.label, description: 'Renamed?', widgetLabel: 'clueing_full' }, ante.library, quizOf(ante))
    if (! widgetPlan.ok || ! widgetingPlan.ok) { throw new Error('Expected both plans') }
    for (const action of [...widgetPlan.actions, ...widgetingPlan.actions]) { await act(action) }
    const after = await read()
    expect(after.library.find((each) => each.label === 'clueing_full')).to.deep.include({ formula: '1', description: 'Revised.' })
    expect(quizOf(after)).to.deep.eq(quizOf(ante))
  })
})
