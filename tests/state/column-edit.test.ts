import { describe, expect, it } from 'vitest'
import { NewExpression, planColumnEdit, type ColumnEdit } from '../../src/state/column-edit'
import { Workspace } from '../../src/models/workspace'
import type { ExpressingT } from '../../src/models/expressing'
import type { QuizT } from '../../src/models/quiz'
import { present } from '../support/present'

const workspace = Workspace.blank()
const quiz = present(workspace.quizzes[0])
const held = present(quiz.expressings.find((each) => each.label === 'hint_full'))
const heldExpression = present(workspace.expressions.find((each) => each.label === 'hint_full'))

/** An edit of the standard Hint Full Sum column, as opened and untouched */
function untouched(): ColumnEdit {
  return {
    expressing: held, title: held.title, label: held.label, description: held.description, shape: held.shape,
    expressionLabel: held.expression_label, expression: heldExpression,
  }
}

/** A new column, written from scratch */
function fresh(patch: Partial<ColumnEdit> = {}): ColumnEdit {
  return {
    expressing: null, title: '', label: '', description: '', shape: 'skinny',
    expressionLabel: NewExpression, expression: { label: 'title_length', description: '', formula: '$length(qn.title)' },
    ...patch,
  }
}

const lockedQuiz = (): QuizT => ({ ...quiz, locked: true })

function actionsOf(edit: ColumnEdit, target: QuizT = quiz) {
  const plan = planColumnEdit(edit, workspace, target)
  if (! plan.ok) { throw new Error(`Expected a plan, got: ${plan.issue}`) }
  return plan.actions
}

describe('planColumnEdit, editing a column', () => {
  it('comes to nothing when nothing was changed', () => {
    expect(actionsOf(untouched())).to.deep.eq([])
  })

  it('revises only the column fields that changed', () => {
    const actions = actionsOf({ ...untouched(), title: 'Hint total', shape: 'medium' })
    expect(actions).to.deep.eq([{ kind: 'edit_expressing', label: 'hint_full', patch: { title: 'Hint total', shape: 'medium' } }])
  })

  it('revises the expression when its formula changed, and says nothing of the column', () => {
    const actions = actionsOf({ ...untouched(), expression: { ...heldExpression, formula: '1' } })
    expect(actions).to.deep.eq([{ kind: 'edit_expression', label: 'hint_full', patch: { formula: '1', description: heldExpression.description } }])
  })

  it('does both, the expression first', () => {
    const actions = actionsOf({ ...untouched(), title: 'Renamed', expression: { ...heldExpression, description: 'New words.' } })
    expect(actions.map((action) => action.kind)).to.deep.eq(['edit_expression', 'edit_expressing'])
  })

  it('points the column at another expression, carrying that expression\'s edits with it', () => {
    const other = present(workspace.expressions.find((each) => each.label === 'answer_reversed'))
    const actions = actionsOf({ ...untouched(), expressionLabel: 'answer_reversed', expression: { ...other, formula: '"x"' } })
    expect(actions.map((action) => action.kind)).to.deep.eq(['edit_expression', 'edit_expressing'])
    expect(actions[1]).to.deep.include({ patch: { expression_label: 'answer_reversed' } })
  })

  it('refuses a label a sibling column already has', () => {
    const plan = planColumnEdit({ ...untouched(), label: 'clueing_full' }, workspace, quiz)
    expect(plan).to.deep.include({ ok: false, issue: 'Another column in this quiz already has that label.' })
  })

  it('takes a label as typed, tidied', () => {
    const actions = actionsOf({ ...untouched(), label: 'Hint Total!' })
    expect(actions).to.deep.eq([{ kind: 'edit_expressing', label: 'hint_full', patch: { label: 'hint_total' } }])
  })

  it('refuses an empty formula, saying so', () => {
    const plan = planColumnEdit({ ...untouched(), expression: { ...heldExpression, formula: '' } }, workspace, quiz)
    expect(plan.ok).to.eq(false)
  })

  it('refuses a title too long for a header', () => {
    expect(planColumnEdit({ ...untouched(), title: 'x'.repeat(83) }, workspace, quiz).ok).to.eq(false)
  })
})

describe('planColumnEdit, making a new column', () => {
  it('adds the new expression, then a column for it labelled and titled after it', () => {
    const actions = actionsOf(fresh())
    expect(actions.map((action) => action.kind)).to.deep.eq(['add_expression', 'add_expressing'])
    expect(actions[1]).to.deep.include({ expressing: { label: 'title_length', expression_label: 'title_length', title: 'Title Length', description: '', shape: 'skinny' } })
  })

  it('takes the title, label, description and width it is given', () => {
    const actions = actionsOf(fresh({ title: 'How long', label: 'howlong', description: 'For the trailer round.', shape: 'medium' }))
    expect(actions[1]).to.deep.include({ expressing: { label: 'howlong', expression_label: 'title_length', title: 'How long', description: 'For the trailer round.', shape: 'medium' } })
  })

  it('can work an existing expression without adding one', () => {
    const reversed = present(workspace.expressions.find((each) => each.label === 'answer_reversed'))
    const actions = actionsOf(fresh({ expressionLabel: 'answer_reversed', expression: reversed }))
    expect(actions.map((action) => action.kind)).to.deep.eq(['add_expressing'])
  })

  it('suffixes the label of a second column for one expression, so both can stand', () => {
    const actions = actionsOf(fresh({ expressionLabel: 'hint_full', expression: heldExpression }))
    const column = actions.find((action) => action.kind === 'add_expressing')
    const label = column?.kind === 'add_expressing' ? column.expressing.label : ''
    expect(label).to.match(/^hint_full_[a-z0-9]{8}$/)
  })

  const Refused: [Partial<ColumnEdit>, RegExp, string][] = [
    [{ expression: { label: '', description: '', formula: '1' } },                       /label/,  'a new expression with no label'],
    [{ expression: { label: 'clueing_full', description: '', formula: '1' } },           /already has that label/, 'a new expression whose label is taken'],
    [{ expression: { label: 'fine_one', description: '', formula: '' } },                /./,      'a new expression with no formula'],
    [{ expression: { label: 'fine_one', description: '', formula: 'x'.repeat(1000) } },  /./,      'a new expression with a formula past 999 characters'],
  ]
  for (const [patch, issue, describes] of Refused) {
    it(`refuses ${describes}`, () => {
      const plan = planColumnEdit(fresh(patch), workspace, quiz)
      expect(plan.ok).to.eq(false)
      expect(plan.ok ? '' : plan.issue).to.match(issue)
    })
  }

  it('points a taken-label refusal at the label field', () => {
    const plan = planColumnEdit(fresh({ expression: { label: 'clueing_full', description: '', formula: '1' } }), workspace, quiz)
    expect(plan).to.deep.include({ ok: false, labelIssue: 'Another expression already has that label.' })
  })
})

describe('planColumnEdit, on a locked quiz', () => {
  it('leaves the column alone and revises only the expression, which belongs to the workspace', () => {
    const actions = actionsOf({ ...untouched(), title: 'Ignored', expression: { ...heldExpression, formula: '1' } }, lockedQuiz())
    expect(actions.map((action) => action.kind)).to.deep.eq(['edit_expression'])
  })

  it('comes to nothing when only the column was touched', () => {
    expect(actionsOf({ ...untouched(), title: 'Ignored' }, lockedQuiz())).to.deep.eq([])
  })
})

describe('the column being edited', () => {
  it('is untouched by planning, which only describes what to do', () => {
    const before: ExpressingT = { ...held }
    actionsOf({ ...untouched(), title: 'Changed' })
    expect(held).to.deep.eq(before)
  })
})
