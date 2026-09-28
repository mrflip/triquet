import { describe, expect, it } from 'vitest'
import { expressionUsageOf, realmsOf } from '../../../convex/reading'
import { NewExpression, planExpressingEdit } from '../../../src/state/widget-edit'
import { Question } from '../../../src/models/question'
import { Hunt, type HuntT } from '../../../src/models/hunt'
import { present } from '../../support/present'
import { huntHolding, openOf, openTester, refusedAs, seedHunt, type Seeded, type Seen } from '../../support/convex'

/** A fresh hunt with the standard expressions and its quiz laid out as a new quiz's is */
function standard(locked = false): HuntT {
  const hunt = Hunt.blank()
  return { ...hunt, realms: hunt.realms.map((realm) => ({ ...realm, quizzes: realm.quizzes.map((quiz) => ({ ...quiz, locked })) })) }
}

/** The one quiz of a fresh standard hunt */
const standardQuiz = () => present(Hunt.quizzesOf(standard())[0])

/** A standard hunt whose one quiz holds `questions` */
const standardWith = (questions: ReturnType<typeof Question.blank>[]) => {
  const blank = Hunt.blank()
  return huntHolding([{ ...present(Hunt.quizzesOf(blank)[0]), questions }], blank.expressions)
}

const quizOf    = (seen: Seen) => openOf(seen)
const widgetsOf = (seen: Seen) => quizOf(seen).widgets.map((widget) => widget.label)
const columnsOf = (seen: Seen) => quizOf(seen).columns.map((column) => column.label)
const StandardColumns = standardQuiz().columns.map((column) => column.label)
const StandardWidgets = standardQuiz().widgets.map((widget) => widget.label)

/** Every expression but `answer_reversed` */
const others = (seen: Seen) => seen.expressions.filter((expression) => expression.label !== 'answer_reversed')
/** The hunt's expressions' labels */
const labelsOf = (seen: Seen) => seen.expressions.map((expression) => expression.label)

const Widget = { kind: 'expressing' as const, label: 'backward', expression_label: 'answer_reversed' }

const seed = async (hunt: HuntT = standard()) => await seedHunt(openTester(), hunt)

/** How many widgets across the seeded hunt work each expression */
async function usageIn({ tt, open }: Seeded): Promise<Record<string, number>> {
  return await tt.run(async (ctx) => Object.fromEntries(await expressionUsageOf(ctx.db, await realmsOf(ctx.db, open.hunt_id))))
}

/** A standard hunt with the `backward` widget added */
async function withWidget(): Promise<Seeded> {
  const seeded = await seed()
  await seeded.act({ kind: 'add_widget', widget: Widget })
  return seeded
}

/** Each of `refusals` refused for its own reason, and whatever `seeded` holds unchanged by them */
async function expectRefused(seeded: Seeded, ...refusals: [Parameters<Seeded['act']>[0], string][]): Promise<void> {
  const ante = await seeded.read()
  for (const [action, failurekind] of refusals) { expect(await refusedAs(seeded.act(action))).to.eq(failurekind) }
  expect(await seeded.read()).to.deep.eq(ante)
}

describe('add_widget', () => {
  it('adds a widget to the end of the open quiz\'s widgets, its description defaulted', async () => {
    const { read } = await withWidget()
    expect(quizOf(await read()).widgets.at(-1)).to.deep.eq({ ...Widget, description: '' })
  })

  it('adds no column: a widget is what has a value, and where it is shown is another matter', async () => {
    const { read } = await withWidget()
    expect(columnsOf(await read())).to.deep.eq(StandardColumns)
  })

  it('refuses a label a widget already has, or the questions\' own, leaving the hunt as it was', async () => {
    await expectRefused(await withWidget(),
      [{ kind: 'add_widget', widget: { ...Widget, description: 'again' } }, 'labelTaken'],
      [{ kind: 'add_widget', widget: { ...Widget, label: 'question' } },    'labelTaken'])
  })

  it('refuses a widget that is not one', async () => {
    const { act } = await seed()
    await expect(act({ kind: 'add_widget', widget: { ...Widget, label: 'No Good' } })).rejects.toThrow()
  })

  it('refuses while the quiz is locked', async () => {
    await expectRefused(await seed(standard(true)), [{ kind: 'add_widget', widget: Widget }, 'quizLocked'])
  })
})

describe('edit_widget', () => {
  it('revises the fields named and no others', async () => {
    const { act, read } = await withWidget()
    await act({ kind: 'edit_widget', label: 'backward', patch: { description: 'Because.' } })
    expect(quizOf(await read()).widgets.at(-1)).to.deep.eq({ ...Widget, description: 'Because.' })
  })

  it('renames a widget, carrying the columns that show it along', async () => {
    const { act, read } = await withWidget()
    await act({ kind: 'add_column', column: { label: 'back_col', title: 'Back', source: 'backward', width_px: 78 } })
    await act({ kind: 'edit_widget', label: 'backward', patch: { label: 'reversed' } })
    const after = await read()
    expect(widgetsOf(after)).to.include('reversed')
    expect(quizOf(after).columns.find((column) => column.label === 'back_col')?.source).to.eq('reversed')
  })

  it('refuses a rename onto a sibling\'s label, or the questions\' own', async () => {
    await expectRefused(await withWidget(),
      [{ kind: 'edit_widget', label: 'backward', patch: { label: 'dumdum' } },   'labelTaken'],
      [{ kind: 'edit_widget', label: 'backward', patch: { label: 'question' } }, 'labelTaken'])
  })

  it('validates the patch for the kind of widget it is', async () => {
    const { act } = await withWidget()
    await expect(act({ kind: 'edit_widget', label: 'dumdum', patch: { bot_label: 'smartypants' as never } })).rejects.toThrow(/Validator error/)
    expect(await refusedAs(act({ kind: 'edit_widget', label: 'dumdum', patch: { textkind: 'hint' } }))).to.eq('invalid')
  })

  it('refuses a widget the quiz does not have', async () => {
    await expectRefused(await seed(), [{ kind: 'edit_widget', label: 'absent', patch: { description: 'x' } }, 'widgetGone'])
  })

  it('refuses while the quiz is locked', async () => {
    await expectRefused(await seed(standard(true)), [{ kind: 'edit_widget', label: 'dumdum', patch: { description: 'x' } }, 'quizLocked'])
  })
})

describe('delete_widget', () => {
  it('removes the widget, and the columns that showed it, and no others', async () => {
    const { act, read } = await seed()
    await act({ kind: 'delete_widget', label: 'hint_full' })
    const after = await read()
    expect(widgetsOf(after)).to.not.include('hint_full')
    expect(columnsOf(after)).to.deep.eq(StandardColumns.filter((label) => label !== 'hint_full'))
  })

  it('forgets a sort memory that named a column it took with it', async () => {
    const { act, read } = await seed()
    await act({ kind: 'sort_questions', sortkey: 'column:hint_full', descending: false })
    await act({ kind: 'delete_widget', label: 'hint_full' })
    expect(quizOf(await read()).last_sortkey).to.eq(null)
  })

  it('keeps a sort memory that named some other column', async () => {
    const { act, read } = await seed()
    await act({ kind: 'sort_questions', sortkey: 'column:clueing_full', descending: false })
    await act({ kind: 'delete_widget', label: 'hint_full' })
    expect(quizOf(await read()).last_sortkey).to.eq('column:clueing_full')
  })

  it('keeps the answers a bot gave, which are the question\'s history and not the widget\'s', async () => {
    const { act, read } = await seed(standardWith([{ ...Question.blank(), clueing: 'Where?' }]))
    const [question] = quizOf(await read()).questions
    await act({ kind: 'record_botting', botting: {
      question_id: present(question)._id, bot_label: 'dumdum', textkind: 'clueing', asked_text: 'Where?', status: 'done', reply_text: 'Lyon',
      items: [], message: null, response: null, truncated: false, model_tier_applied: 'quick', approx_tokens: null,
    } })
    await act({ kind: 'delete_widget', label: 'dumdum' })
    const after = await read()
    expect(quizOf(after).questions[0]?.guess).to.deep.include({ status: 'done', text: 'Lyon' })
    expect(columnsOf(after)).to.not.include('guess')
  })
})

describe('move_widget', () => {
  it('reorders the widgets, and only them', async () => {
    const { act, read } = await seed()
    await act({ kind: 'move_widget', label: 'hint_full', onto_idx: 0 })
    const after = await read()
    expect(widgetsOf(after)).to.deep.eq(['hint_full', ...StandardWidgets.filter((label) => label !== 'hint_full')])
    expect(columnsOf(after)).to.deep.eq(StandardColumns)
  })

  it('puts a widget at the end for an index past it, and refuses a label it does not have', async () => {
    const { act, read } = await seed()
    await act({ kind: 'move_widget', label: 'dumdum', onto_idx: 99 })
    expect(widgetsOf(await read()).at(-1)).to.eq('dumdum')
    await expectRefused(await seed(), [{ kind: 'move_widget', label: 'absent', onto_idx: 0 }, 'widgetGone'])
  })

  it('refuses while the quiz is locked', async () => {
    await expectRefused(await seed(standard(true)), [{ kind: 'move_widget', label: 'hint_full', onto_idx: 0 }, 'quizLocked'])
  })
})

describe('add_column', () => {
  const column = { label: 'notes_again', title: 'Notes again', source: 'question.notes', width_px: 200 }

  it('adds a column to the end', async () => {
    const { act, read } = await seed()
    await act({ kind: 'add_column', column })
    expect(columnsOf(await read())).to.deep.eq([...StandardColumns, 'notes_again'])
  })

  it('adds it at an index when given one, the rest keeping their order', async () => {
    const { act, read } = await seed()
    await act({ kind: 'add_column', column, onto_idx: 1 })
    expect(columnsOf(await read())).to.deep.eq([StandardColumns[0], 'notes_again', ...StandardColumns.slice(1)])
  })

  it('can show a widget, or a question field, or a view', async () => {
    const { act, read } = await seed()
    for (const [idx, source] of ['dumdum', 'question.title', 'question.butnot'].entries()) {
      await act({ kind: 'add_column', column: { ...column, label: `again_${String(idx)}`, source } })
    }
    expect(columnsOf(await read())).to.include.members(['again_0', 'again_1', 'again_2'])
  })

  it('refuses a label a column has, and a source the quiz cannot show', async () => {
    await expectRefused(await seed(),
      [{ kind: 'add_column', column: { ...column, label: 'title' } },    'labelTaken'],
      [{ kind: 'add_column', column: { ...column, source: 'nowhere' } }, 'sourceUnshowable'])
  })

  it('refuses a column that is not one', async () => {
    const { act } = await seed()
    await expect(act({ kind: 'add_column', column: { ...column, width_px: 5 } })).rejects.toThrow()
  })

  it('refuses while the quiz is locked', async () => {
    await expectRefused(await seed(standard(true)), [{ kind: 'add_column', column }, 'quizLocked'])
  })
})

describe('edit_column', () => {
  it('revises only what is named', async () => {
    const { act, read } = await seed()
    await act({ kind: 'edit_column', label: 'notes', patch: { title: 'My notes', width_px: 300 } })
    expect(quizOf(await read()).columns.find((column) => column.label === 'notes')).to.deep.eq({ label: 'notes', title: 'My notes', source: 'question.notes', width_px: 300 })
  })

  it('renames a column, carrying the quiz\'s sort memory with it', async () => {
    const { act, read } = await seed()
    await act({ kind: 'sort_questions', sortkey: 'column:title', descending: false })
    await act({ kind: 'edit_column', label: 'title', patch: { label: 'name' } })
    expect(quizOf(await read()).last_sortkey).to.eq('column:name')
  })

  it('points a column at another thing to show', async () => {
    const { act, read } = await seed()
    await act({ kind: 'edit_column', label: 'notes', patch: { source: 'question.alt_text' } })
    expect(quizOf(await read()).columns.find((column) => column.label === 'notes')?.source).to.eq('question.alt_text')
  })

  it('refuses a rename onto a sibling\'s label, a source nothing can show, and a column that is not there', async () => {
    await expectRefused(await seed(),
      [{ kind: 'edit_column', label: 'notes', patch: { label: 'hint' } },      'labelTaken'],
      [{ kind: 'edit_column', label: 'notes', patch: { source: 'nowhere' } },  'sourceUnshowable'],
      [{ kind: 'edit_column', label: 'absent', patch: { title: 'x' } },        'columnGone'])
  })

  it('refuses while the quiz is locked', async () => {
    await expectRefused(await seed(standard(true)), [{ kind: 'edit_column', label: 'notes', patch: { title: 'x' } }, 'quizLocked'])
  })
})

describe('delete_column', () => {
  it('removes the column and keeps the widget it showed', async () => {
    const { act, read } = await seed()
    await act({ kind: 'delete_column', label: 'hint_full' })
    const after = await read()
    expect(columnsOf(after)).to.not.include('hint_full')
    expect(widgetsOf(after)).to.include('hint_full')
  })

  it('forgets a sort memory that named it', async () => {
    const { act, read } = await seed()
    await act({ kind: 'sort_questions', sortkey: 'column:hint_full', descending: false })
    await act({ kind: 'delete_column', label: 'hint_full' })
    expect(quizOf(await read()).last_sortkey).to.eq(null)
  })

  it('can remove a fixed column too, since it is a column like any other', async () => {
    const { act, read } = await seed()
    await act({ kind: 'delete_column', label: 'clueing' })
    expect(columnsOf(await read())).to.not.include('clueing')
  })
})

describe('move_column', () => {
  it('reorders the columns, and only them', async () => {
    const { act, read } = await seed()
    await act({ kind: 'move_column', label: 'notes', onto_idx: 0 })
    const after = await read()
    expect(columnsOf(after)).to.deep.eq(['notes', ...StandardColumns.filter((label) => label !== 'notes')])
    expect(widgetsOf(after)).to.deep.eq(StandardWidgets)
  })

  it('does not touch the questions', async () => {
    const { act, read } = await seed()
    const ante = await read()
    await act({ kind: 'move_column', label: 'notes', onto_idx: 0 })
    expect(quizOf(await read()).questions).to.deep.eq(quizOf(ante).questions)
  })
})

describe('sort_questions by a column that shows an expressing', () => {
  it('orders the questions by what the widget came to, and remembers the column', async () => {
    const { act, read } = await seed(standardWith(['ccc', 'a', 'bb'].map((full_answer) => ({ ...Question.blank(), full_answer }))))
    await act({ kind: 'add_widget', widget: { kind: 'expressing', label: 'letters', expression_label: 'answer_letter_count' } })
    await act({ kind: 'add_column', column: { label: 'letters', title: 'Letters', source: 'letters', width_px: 78 } })
    await act({ kind: 'sort_questions', sortkey: 'column:letters', descending: false })
    const after = quizOf(await read())
    expect(after.questions.map((question) => question.full_answer)).to.deep.eq(['a', 'bb', 'ccc'])
    expect(after.last_sortkey).to.eq('column:letters')
  })
})

describe('add_expression', () => {
  const shout = { label: 'shout', formula: '$uppercase(qn.title)' }

  it('adds an expression to the end of the hunt\'s, owned by tq', async () => {
    const { act, read } = await seed()
    await act({ kind: 'add_expression', expression: shout })
    const { expressions } = await read()
    expect(expressions.at(-1)).to.deep.eq({ owner: 'tq', description: '', ...shout })
  })

  it('refuses a label already taken, leaving the hunt as it was', async () => {
    const seeded = await seed()
    await seeded.act({ kind: 'add_expression', expression: shout })
    await expectRefused(seeded, [{ kind: 'add_expression', expression: { ...shout, formula: '1' } }, 'labelTaken'])
  })

  it('works from a locked quiz, because the expressions belong to the hunt', async () => {
    const { act, read } = await seed(standard(true))
    await act({ kind: 'add_expression', expression: shout })
    const { expressions } = await read()
    expect(expressions).to.have.length(standard().expressions.length + 1)
  })

  it('refuses an expression that is not one', async () => {
    const { act } = await seed()
    await expect(act({ kind: 'add_expression', expression: { label: 'shout', formula: '' } })).rejects.toThrow()
  })
})

describe('edit_expression', () => {
  it('revises the formula and the description, and no other expression', async () => {
    const { act, read } = await seed()
    const ante = await read()
    await act({ kind: 'edit_expression', label: 'answer_reversed', patch: { formula: '"x"', description: 'Changed.' } })
    const after = await read()
    expect(after.expressions.find((expression) => expression.label === 'answer_reversed')).to.include({ formula: '"x"', description: 'Changed.' })
    expect(others(after)).to.deep.eq(others(ante))
  })

  it('works from a locked quiz', async () => {
    const { act, read } = await seed(standard(true))
    await act({ kind: 'edit_expression', label: 'answer_reversed', patch: { formula: '"x"' } })
    const { expressions } = await read()
    expect(expressions.find((expression) => expression.label === 'answer_reversed')?.formula).to.eq('"x"')
  })

  it('refuses an empty formula', async () => {
    const { act } = await seed()
    await expect(act({ kind: 'edit_expression', label: 'answer_reversed', patch: { formula: '' } })).rejects.toThrow()
  })
})

describe('delete_expression', () => {

  it('removes an expression no widget works', async () => {
    const { act, read } = await seed()
    await act({ kind: 'delete_expression', label: 'answer_reversed' })
    expect(labelsOf(await read())).to.not.include('answer_reversed')
  })

  it('refuses to remove one a widget works, saying why', async () => {
    await expectRefused(await seed(), [{ kind: 'delete_expression', label: 'clueing_full' }, 'expressionInUse'])
  })

  it('removes it once the widget is gone', async () => {
    const { act, read } = await seed()
    await act({ kind: 'delete_widget', label: 'clueing_full' })
    await act({ kind: 'delete_expression', label: 'clueing_full' })
    expect(labelsOf(await read())).to.not.include('clueing_full')
  })
})

describe('expressionUsageOf', () => {
  it('counts the widgets, across every quiz, that work an expression', async () => {
    const seeded = await seed()
    await seeded.act({ kind: 'new_quiz' })
    const usage = await usageIn(seeded)
    expect(usage.clueing_full).to.eq(2)
  })

  it('counts nothing for an expression nobody works, or that does not exist', async () => {
    const usage = await usageIn(await seed())
    expect(Object.keys(usage)).not.to.include.members(['answer_reversed', 'absent'])
  })
})

describe('the widgets and columns of a new quiz', () => {
  it('are the standard ones, and a new quiz takes them from the hunt\'s expressions', async () => {
    const { act, read } = await seed()
    await act({ kind: 'new_quiz' })
    const { quizzes } = await read()
    expect(present(quizzes.at(-1)).widgets).to.deep.eq(standardQuiz().widgets)
  })
})

describe('a widget editor\'s plan, carried out', () => {
  it('adds the new expression, the widget that works it, and a column showing it just before Alt Text', async () => {
    const { act, read } = await seed()
    const ante = await read()
    const edit = {
      widget: null, label: '', description: '', expressionLabel: NewExpression,
      expression: { label: 'title_length', description: '', formula: '$length(qn.title)' },
    }
    const plan = planExpressingEdit(edit, ante, quizOf(ante))
    if (! plan.ok) { throw new Error(plan.issue) }
    for (const action of plan.actions) { await act(action) }
    const after = await read()
    expect(labelsOf(after).at(-1)).to.eq('title_length')
    expect(widgetsOf(after).at(-1)).to.eq('title_length')
    const columns = columnsOf(after)
    expect(columns[columns.indexOf('alt_text') - 1]).to.eq('title_length')
  })
})
