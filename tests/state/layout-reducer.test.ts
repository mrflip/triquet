import { describe, expect, it } from 'vitest'
import * as Z from 'zod'
import { expressionUsage, openQuizOf, workspaceReducer } from '../../src/state/workspace-reducer'
import { Question } from '../../src/models/question'
import { Workspace, type WorkspaceT } from '../../src/models/workspace'
import { present } from '../support/present'
import { mintId } from '../../src/lib/ids'

/** A fresh workspace with the standard expressions and its quiz laid out as a new quiz's is */
function standard(locked = false): WorkspaceT {
  const workspace = Workspace.blank()
  return { ...workspace, quizzes: workspace.quizzes.map((quiz) => ({ ...quiz, locked })) }
}

const quizOf = (workspace: WorkspaceT) => present(openQuizOf(workspace))
const widgetsOf = (workspace: WorkspaceT) => quizOf(workspace).widgets.map((widget) => widget.label)
const columnsOf = (workspace: WorkspaceT) => quizOf(workspace).columns.map((column) => column.label)

const Widget = { kind: 'expressing' as const, label: 'backward', expression_label: 'answer_reversed' }
const withWidget = () => workspaceReducer(standard(), { kind: 'add_widget', widget: Widget })
const lockedOf = (workspace: WorkspaceT): WorkspaceT => ({ ...workspace, quizzes: workspace.quizzes.map((quiz) => ({ ...quiz, locked: true })) })

describe('add_widget', () => {
  it('adds a widget to the end of the open quiz\'s widgets, its description defaulted', () => {
    const after = withWidget()
    expect(quizOf(after).widgets.at(-1)).to.deep.eq({ ...Widget, description: '' })
  })

  it('adds no column: a widget is what has a value, and where it is shown is another matter', () => {
    expect(columnsOf(withWidget())).to.deep.eq(columnsOf(standard()))
  })

  it('refuses a label a widget already has, or the questions\' own, leaving the workspace as it was', () => {
    const ante = withWidget()
    expect(workspaceReducer(ante, { kind: 'add_widget', widget: { ...Widget, description: 'again' } })).to.eq(ante)
    expect(workspaceReducer(ante, { kind: 'add_widget', widget: { ...Widget, label: 'question' } })).to.eq(ante)
  })

  it('refuses a widget that is not one', () => {
    expect(() => workspaceReducer(standard(), { kind: 'add_widget', widget: { ...Widget, label: 'No Good' } })).to.throw(Z.ZodError)
  })

  it('refuses while the quiz is locked', () => {
    const ante = lockedOf(standard())
    expect(workspaceReducer(ante, { kind: 'add_widget', widget: Widget })).to.eq(ante)
  })
})

describe('edit_widget', () => {
  it('revises the fields named and no others', () => {
    const after = workspaceReducer(withWidget(), { kind: 'edit_widget', label: 'backward', patch: { description: 'Because.' } })
    expect(quizOf(after).widgets.at(-1)).to.deep.eq({ ...Widget, description: 'Because.' })
  })

  it('renames a widget, carrying the columns that show it along', () => {
    const shown = workspaceReducer(withWidget(), { kind: 'add_column', column: { label: 'back_col', title: 'Back', source: 'backward', width_px: 78 } })
    const after = workspaceReducer(shown, { kind: 'edit_widget', label: 'backward', patch: { label: 'reversed' } })
    expect(widgetsOf(after)).to.include('reversed')
    expect(quizOf(after).columns.find((column) => column.label === 'back_col')?.source).to.eq('reversed')
  })

  it('refuses a rename onto a sibling\'s label, or the questions\' own', () => {
    const ante = withWidget()
    expect(workspaceReducer(ante, { kind: 'edit_widget', label: 'backward', patch: { label: 'dumdum' } })).to.eq(ante)
    expect(workspaceReducer(ante, { kind: 'edit_widget', label: 'backward', patch: { label: 'question' } })).to.eq(ante)
  })

  it('validates the patch for the kind of widget it is', () => {
    expect(() => workspaceReducer(withWidget(), { kind: 'edit_widget', label: 'dumdum', patch: { player_label: 'smartypants' as never } })).to.throw(Z.ZodError)
    expect(() => workspaceReducer(withWidget(), { kind: 'edit_widget', label: 'dumdum', patch: { textkind: 'hint' } })).to.throw(Z.ZodError)
  })

  it('does nothing for a widget the quiz does not have', () => {
    const ante = standard()
    expect(workspaceReducer(ante, { kind: 'edit_widget', label: 'absent', patch: { description: 'x' } })).to.eq(ante)
  })

  it('refuses while the quiz is locked', () => {
    const ante = lockedOf(withWidget())
    expect(workspaceReducer(ante, { kind: 'edit_widget', label: 'backward', patch: { description: 'x' } })).to.eq(ante)
  })
})

describe('delete_widget', () => {
  it('removes the widget, and the columns that showed it', () => {
    const after = workspaceReducer(standard(), { kind: 'delete_widget', label: 'hint_full' })
    expect(widgetsOf(after)).to.not.include('hint_full')
    expect(columnsOf(after)).to.not.include('hint_full')
  })

  it('leaves the columns that showed something else alone', () => {
    const after = workspaceReducer(standard(), { kind: 'delete_widget', label: 'hint_full' })
    expect(columnsOf(after)).to.have.length(columnsOf(standard()).length - 1)
  })

  it('forgets a sort memory that named a column it took with it', () => {
    const sorted = workspaceReducer(standard(), { kind: 'sort_questions', sortkey: 'column:hint_full', descending: false })
    expect(quizOf(workspaceReducer(sorted, { kind: 'delete_widget', label: 'hint_full' })).last_sortkey).to.eq(null)
  })

  it('keeps a sort memory that named some other column', () => {
    const sorted = workspaceReducer(standard(), { kind: 'sort_questions', sortkey: 'column:clueing_full', descending: false })
    expect(quizOf(workspaceReducer(sorted, { kind: 'delete_widget', label: 'hint_full' })).last_sortkey).to.eq('column:clueing_full')
  })

  it('keeps the answers a player gave, which are held on the questions and not on the widget', () => {
    const guess = { status: 'done' as const, text: 'Lyon', truncated: false, updated_at: 1, last_err: null }
    const quiz = { ...Workspace.blank().quizzes[0]!, questions: [{ ...Question.blank(), guess }] }
    const ante = Workspace.fill({ ...Workspace.blank(), quizzes: [quiz], active_quiz_id: quiz.id })
    const after = workspaceReducer(ante, { kind: 'delete_widget', label: 'dumdum' })
    expect(quizOf(after).questions[0]?.guess).to.deep.include({ status: 'done', text: 'Lyon' })
    expect(columnsOf(after)).to.not.include('guess')
  })
})

describe('move_widget', () => {
  it('reorders the widgets, and only them', () => {
    const after = workspaceReducer(standard(), { kind: 'move_widget', label: 'hint_full', onto_idx: 0 })
    expect(widgetsOf(after)[0]).to.eq('hint_full')
    expect(columnsOf(after)).to.deep.eq(columnsOf(standard()))
  })

  it('puts a widget at the end for an index past it, and leaves the list alone for a label it does not have', () => {
    const moved = workspaceReducer(standard(), { kind: 'move_widget', label: 'dumdum', onto_idx: 99 })
    expect(widgetsOf(moved).at(-1)).to.eq('dumdum')
    const unmoved = workspaceReducer(standard(), { kind: 'move_widget', label: 'absent', onto_idx: 0 })
    expect(widgetsOf(unmoved)).to.deep.eq(widgetsOf(standard()))
  })

  it('refuses while the quiz is locked', () => {
    const ante = lockedOf(standard())
    expect(workspaceReducer(ante, { kind: 'move_widget', label: 'hint_full', onto_idx: 0 })).to.eq(ante)
  })
})

describe('add_column', () => {
  const column = { label: 'notes_again', title: 'Notes again', source: 'question.notes', width_px: 200 }

  it('adds a column to the end', () => {
    const after = workspaceReducer(standard(), { kind: 'add_column', column })
    expect(columnsOf(after).at(-1)).to.eq('notes_again')
  })

  it('adds it at an index when given one', () => {
    const after = workspaceReducer(standard(), { kind: 'add_column', column, onto_idx: 1 })
    expect(columnsOf(after)[1]).to.eq('notes_again')
  })

  it('can show a widget, or a question field, or a view', () => {
    let after = standard()
    for (const [idx, source] of ['dumdum', 'question.title', 'question.butnot'].entries()) {
      after = workspaceReducer(after, { kind: 'add_column', column: { ...column, label: `again_${String(idx)}`, source } })
    }
    expect(columnsOf(after)).to.include.members(['again_0', 'again_1', 'again_2'])
  })

  it('refuses a label a column has, and a source the quiz cannot show', () => {
    const ante = standard()
    expect(workspaceReducer(ante, { kind: 'add_column', column: { ...column, label: 'title' } })).to.eq(ante)
    expect(workspaceReducer(ante, { kind: 'add_column', column: { ...column, source: 'nowhere' } })).to.eq(ante)
  })

  it('refuses a column that is not one', () => {
    expect(() => workspaceReducer(standard(), { kind: 'add_column', column: { ...column, width_px: 5 } })).to.throw(Z.ZodError)
  })

  it('refuses while the quiz is locked', () => {
    const ante = lockedOf(standard())
    expect(workspaceReducer(ante, { kind: 'add_column', column })).to.eq(ante)
  })
})

describe('edit_column', () => {
  it('revises only what is named', () => {
    const after = workspaceReducer(standard(), { kind: 'edit_column', label: 'notes', patch: { title: 'My notes', width_px: 300 } })
    expect(quizOf(after).columns.find((column) => column.label === 'notes')).to.deep.eq({ label: 'notes', title: 'My notes', source: 'question.notes', width_px: 300 })
  })

  it('renames a column, carrying the quiz\'s sort memory with it', () => {
    const sorted = workspaceReducer(standard(), { kind: 'sort_questions', sortkey: 'column:title', descending: false })
    const after = workspaceReducer(sorted, { kind: 'edit_column', label: 'title', patch: { label: 'name' } })
    expect(quizOf(after).last_sortkey).to.eq('column:name')
  })

  it('points a column at another thing to show', () => {
    const after = workspaceReducer(standard(), { kind: 'edit_column', label: 'notes', patch: { source: 'question.alt_text' } })
    expect(quizOf(after).columns.find((column) => column.label === 'notes')?.source).to.eq('question.alt_text')
  })

  it('refuses a rename onto a sibling\'s label, a source nothing can show, and a column that is not there', () => {
    const ante = standard()
    expect(workspaceReducer(ante, { kind: 'edit_column', label: 'notes', patch: { label: 'hint' } })).to.eq(ante)
    expect(workspaceReducer(ante, { kind: 'edit_column', label: 'notes', patch: { source: 'nowhere' } })).to.eq(ante)
    expect(workspaceReducer(ante, { kind: 'edit_column', label: 'absent', patch: { title: 'x' } })).to.eq(ante)
  })

  it('refuses while the quiz is locked', () => {
    const ante = lockedOf(standard())
    expect(workspaceReducer(ante, { kind: 'edit_column', label: 'notes', patch: { title: 'x' } })).to.eq(ante)
  })
})

describe('delete_column', () => {
  it('removes the column and keeps the widget it showed', () => {
    const after = workspaceReducer(standard(), { kind: 'delete_column', label: 'hint_full' })
    expect(columnsOf(after)).to.not.include('hint_full')
    expect(widgetsOf(after)).to.include('hint_full')
  })

  it('forgets a sort memory that named it', () => {
    const sorted = workspaceReducer(standard(), { kind: 'sort_questions', sortkey: 'column:hint_full', descending: false })
    expect(quizOf(workspaceReducer(sorted, { kind: 'delete_column', label: 'hint_full' })).last_sortkey).to.eq(null)
  })

  it('can remove a fixed column too, since it is a column like any other', () => {
    const after = workspaceReducer(standard(), { kind: 'delete_column', label: 'clueing' })
    expect(columnsOf(after)).to.not.include('clueing')
  })
})

describe('move_column', () => {
  it('reorders the columns, and only them', () => {
    const after = workspaceReducer(standard(), { kind: 'move_column', label: 'notes', onto_idx: 0 })
    expect(columnsOf(after)[0]).to.eq('notes')
    expect(widgetsOf(after)).to.deep.eq(widgetsOf(standard()))
  })

  it('leaves the grid in Q# order alone when a column moves, and does not touch the questions', () => {
    const before = standard()
    const after = workspaceReducer(before, { kind: 'move_column', label: 'notes', onto_idx: 0 })
    expect(quizOf(after).questions).to.eq(quizOf(before).questions)
  })
})

describe('sort_questions by a column that shows an expressing', () => {
  it('orders the questions by what the widget came to, and remembers the column', () => {
    const quiz = { ...Workspace.blank().quizzes[0]!, questions: ['ccc', 'a', 'bb'].map((full_answer) => ({ ...Question.blank(), full_answer })) }
    const base = Workspace.fill({ ...Workspace.blank(), quizzes: [quiz], active_quiz_id: quiz.id })
    const widgeted = workspaceReducer(base, { kind: 'add_widget', widget: { kind: 'expressing', label: 'letters', expression_label: 'answer_letter_count' } })
    const shown = workspaceReducer(widgeted, { kind: 'add_column', column: { label: 'letters', title: 'Letters', source: 'letters', width_px: 78 } })
    const after = workspaceReducer(shown, { kind: 'sort_questions', sortkey: 'column:letters', descending: false })
    expect(quizOf(after).questions.map((question) => question.full_answer)).to.deep.eq(['a', 'bb', 'ccc'])
    expect(quizOf(after).last_sortkey).to.eq('column:letters')
  })
})

describe('add_expression', () => {
  const shout = { label: 'shout', formula: '$uppercase(qn.title)' }

  it('adds an expression to the workspace, owned by tq', () => {
    const after = workspaceReducer(standard(), { kind: 'add_expression', expression: shout })
    expect(after.expressions.at(-1)).to.deep.eq({ owner: 'tq', description: '', ...shout })
  })

  it('refuses a label already taken, leaving the workspace as it was', () => {
    const ante = workspaceReducer(standard(), { kind: 'add_expression', expression: shout })
    expect(workspaceReducer(ante, { kind: 'add_expression', expression: { ...shout, formula: '1' } })).to.eq(ante)
  })

  it('works from a locked quiz, because the expressions belong to the workspace', () => {
    const after = workspaceReducer(lockedOf(standard()), { kind: 'add_expression', expression: shout })
    expect(after.expressions).to.have.length(standard().expressions.length + 1)
  })

  it('refuses an expression that is not one', () => {
    expect(() => workspaceReducer(standard(), { kind: 'add_expression', expression: { label: 'shout', formula: '' } })).to.throw(Z.ZodError)
  })
})

describe('edit_expression', () => {
  it('revises the formula and the description, and no other expression', () => {
    const ante = standard()
    const after = workspaceReducer(ante, { kind: 'edit_expression', label: 'answer_reversed', patch: { formula: '"x"', description: 'Changed.' } })
    expect(after.expressions.find((expression) => expression.label === 'answer_reversed')).to.include({ formula: '"x"', description: 'Changed.' })
    expect(after.expressions.filter((expression) => expression.label !== 'answer_reversed')).to.deep.eq(ante.expressions.filter((expression) => expression.label !== 'answer_reversed'))
  })

  it('works from a locked quiz', () => {
    const after = workspaceReducer(lockedOf(standard()), { kind: 'edit_expression', label: 'answer_reversed', patch: { formula: '"x"' } })
    expect(after.expressions.find((expression) => expression.label === 'answer_reversed')?.formula).to.eq('"x"')
  })

  it('refuses an empty formula', () => {
    expect(() => workspaceReducer(standard(), { kind: 'edit_expression', label: 'answer_reversed', patch: { formula: '' } })).to.throw(Z.ZodError)
  })
})

describe('delete_expression', () => {
  it('removes an expression no widget works', () => {
    const after = workspaceReducer(standard(), { kind: 'delete_expression', label: 'answer_reversed' })
    expect(after.expressions.map((expression) => expression.label)).to.not.include('answer_reversed')
  })

  it('refuses to remove one a widget works, and says nothing changed', () => {
    const ante = standard()
    expect(workspaceReducer(ante, { kind: 'delete_expression', label: 'clueing_full' })).to.eq(ante)
  })

  it('removes it once the widget is gone', () => {
    const ante = workspaceReducer(standard(), { kind: 'delete_widget', label: 'clueing_full' })
    const after = workspaceReducer(ante, { kind: 'delete_expression', label: 'clueing_full' })
    expect(after.expressions.map((expression) => expression.label)).to.not.include('clueing_full')
  })
})

describe('expressionUsage', () => {
  it('counts the widgets, across every quiz, that work an expression', () => {
    const [ante, post] = [standard(), standard()]
    const both = { ...ante, quizzes: [...ante.quizzes, ...post.quizzes.map((quiz) => ({ ...quiz, id: mintId() }))] }
    expect(expressionUsage(both, 'clueing_full')).to.eq(2)
  })

  it('counts nought for an expression nobody works, or that does not exist', () => {
    expect(expressionUsage(standard(), 'answer_reversed')).to.eq(0)
    expect(expressionUsage(standard(), 'absent')).to.eq(0)
  })
})

describe('the widgets and columns of a new quiz', () => {
  it('are the standard ones, and a new quiz takes them from the workspace\'s expressions', () => {
    const after = workspaceReducer(standard(), { kind: 'new_quiz' })
    expect(quizOf(after).widgets).to.deep.eq(present(Workspace.blank().quizzes[0]).widgets)
  })
})
