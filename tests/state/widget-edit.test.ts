import { describe, expect, it } from 'vitest'
import { NewExpression, planExpressingEdit, planBottingEdit, type ExpressingEdit, type BottingEdit } from '../../src/state/widget-edit'
import { Hunt } from '../../src/models/hunt'
import type { ExpressingT, BottingWidgetT } from '../../src/models/widget'
import type { QuizT } from '../../src/models/quiz'
import { present } from '../support/present'

const hunt = Hunt.blank()
const quiz = present(Hunt.quizzesOf(hunt)[0])
const held = present(quiz.widgets.find((each): each is ExpressingT => each.label === 'hint_full'))
const heldExpression = present(hunt.expressions.find((each) => each.label === 'hint_full'))
const dumdum = present(quiz.widgets.find((each): each is BottingWidgetT => each.label === 'dumdum'))
const lockedQuiz = (): QuizT => ({ ...quiz, locked: true })

/** An edit of the standard Hint Full Sum widget, as opened and untouched */
function untouched(): ExpressingEdit {
  return { widget: held, label: held.label, description: held.description, expressionLabel: held.expression_label, expression: heldExpression }
}

/** A new widget, written from scratch with a new expression */
function fresh(patch: Partial<ExpressingEdit> = {}): ExpressingEdit {
  return {
    widget: null, label: '', description: '', expressionLabel: NewExpression,
    expression: { label: 'title_length', description: '', formula: '$length(qn.title)' }, ...patch,
  }
}

function actionsOf(edit: ExpressingEdit, target: QuizT = quiz) {
  const plan = planExpressingEdit(edit, hunt, target)
  if (! plan.ok) { throw new Error(`Expected a plan, got: ${plan.issue}`) }
  return plan.actions
}

describe('planExpressingEdit, editing a widget', () => {
  it('comes to nothing when nothing was changed', () => {
    expect(actionsOf(untouched())).to.deep.eq([])
  })

  it('revises only the widget fields that changed', () => {
    expect(actionsOf({ ...untouched(), description: 'Why.' })).to.deep.eq([{ kind: 'edit_widget', label: 'hint_full', patch: { description: 'Why.' } }])
  })

  it('renames a widget, which the reducer carries to its columns', () => {
    expect(actionsOf({ ...untouched(), label: 'Hint Total!' })).to.deep.eq([{ kind: 'edit_widget', label: 'hint_full', patch: { label: 'hint_total' } }])
  })

  it('revises the expression when its formula changed, first', () => {
    const actions = actionsOf({ ...untouched(), description: 'Why.', expression: { ...heldExpression, formula: '1' } })
    expect(actions.map((action) => action.kind)).to.deep.eq(['edit_expression', 'edit_widget'])
  })

  it('points the widget at another expression', () => {
    const other = present(hunt.expressions.find((each) => each.label === 'answer_reversed'))
    const actions = actionsOf({ ...untouched(), expressionLabel: 'answer_reversed', expression: other })
    expect(actions).to.deep.eq([{ kind: 'edit_widget', label: 'hint_full', patch: { expression_label: 'answer_reversed' } }])
  })

  it('refuses a label a sibling widget already has, or the questions\' own', () => {
    for (const label of ['clueing_full', 'question']) {
      expect(planExpressingEdit({ ...untouched(), label }, hunt, quiz)).to.deep.include({ ok: false, issue: 'Another widget in this quiz already has that label.' })
    }
  })

  it('refuses an empty formula, and a description too long', () => {
    expect(planExpressingEdit({ ...untouched(), expression: { ...heldExpression, formula: '' } }, hunt, quiz).ok).to.eq(false)
    expect(planExpressingEdit({ ...untouched(), description: 'x'.repeat(3601) }, hunt, quiz).ok).to.eq(false)
  })
})

describe('planExpressingEdit, making a new widget', () => {
  it('adds the expression, then the widget, then a column showing it just before Alt Text', () => {
    const actions = actionsOf(fresh())
    expect(actions.map((action) => action.kind)).to.deep.eq(['add_expression', 'add_widget', 'add_column'])
    expect(actions[1]).to.deep.include({ widget: { kind: 'expressing', label: 'title_length', expression_label: 'title_length', description: '' } })
    expect(actions[2]).to.deep.include({
      column: { label: 'title_length', title: 'Title Length', source: 'title_length', width_px: 78 },
      onto_idx: quiz.columns.findIndex((column) => column.source === 'question.alt_text'),
    })
  })

  it('takes the label and description it is given', () => {
    const actions = actionsOf(fresh({ label: 'howlong', description: 'For the trailer round.' }))
    expect(actions[1]).to.deep.include({ widget: { kind: 'expressing', label: 'howlong', expression_label: 'title_length', description: 'For the trailer round.' } })
  })

  it('can work an existing expression without adding one', () => {
    const reversed = present(hunt.expressions.find((each) => each.label === 'answer_reversed'))
    const actions = actionsOf(fresh({ expressionLabel: 'answer_reversed', expression: reversed }))
    expect(actions.map((action) => action.kind)).to.deep.eq(['add_widget', 'add_column'])
  })

  it('suffixes the label of a second widget for one expression, so both can stand', () => {
    const actions = actionsOf(fresh({ expressionLabel: 'hint_full', expression: heldExpression }))
    const widget = actions.find((action) => action.kind === 'add_widget')
    expect(widget?.kind === 'add_widget' ? widget.widget.label : '').to.match(/^hint_full_[a-z0-9]{8}$/)
  })

  it('puts its column at the end for a quiz that has no Alt Text column', () => {
    const noAlt = { ...quiz, columns: quiz.columns.filter((column) => column.source !== 'question.alt_text') }
    const column = actionsOf(fresh(), noAlt).at(-1)
    expect(column).to.deep.include({ kind: 'add_column' })
    expect(column).to.not.have.property('onto_idx')
  })

  const Refused: [Partial<ExpressingEdit>, RegExp, string][] = [
    [{ expression: { label: '', description: '', formula: '1' } },                       /label/,                  'a new expression with no label'],
    [{ expression: { label: 'clueing_full', description: '', formula: '1' } },           /already has that label/, 'a new expression whose label is taken'],
    [{ expression: { label: 'fine_one', description: '', formula: '' } },                /./,                      'a new expression with no formula'],
    [{ expression: { label: 'fine_one', description: '', formula: 'x'.repeat(1000) } },  /./,                      'a new expression with a formula past 999 characters'],
  ]
  for (const [patch, issue, describes] of Refused) {
    it(`refuses ${describes}`, () => {
      const plan = planExpressingEdit(fresh(patch), hunt, quiz)
      expect(plan.ok).to.eq(false)
      expect(plan.ok ? '' : plan.issue).to.match(issue)
    })
  }

  it('points a taken-label refusal at the label field', () => {
    const plan = planExpressingEdit(fresh({ expression: { label: 'clueing_full', description: '', formula: '1' } }), hunt, quiz)
    expect(plan).to.deep.include({ ok: false, labelIssue: 'Another expression already has that label.' })
  })
})

describe('planExpressingEdit, on a locked quiz', () => {
  it('leaves the widget alone and revises only the expression, which belongs to the hunt', () => {
    const actions = actionsOf({ ...untouched(), description: 'Ignored', expression: { ...heldExpression, formula: '1' } }, lockedQuiz())
    expect(actions.map((action) => action.kind)).to.deep.eq(['edit_expression'])
  })

  it('comes to nothing when only the widget was touched', () => {
    expect(actionsOf({ ...untouched(), description: 'Ignored' }, lockedQuiz())).to.deep.eq([])
  })
})

/** A botting edit as opened and untouched */
function botting(patch: Partial<BottingEdit> = {}): BottingEdit {
  return { widget: dumdum, label: 'dumdum', bot_label: 'dumdum', textkind: 'clueing', description: '', ...patch }
}

describe('planBottingEdit', () => {
  it('comes to nothing when nothing was changed', () => {
    const plan = planBottingEdit(botting(), quiz)
    expect(plan).to.deep.eq({ ok: true, actions: [] })
  })

  it('revises only what changed', () => {
    const plan = planBottingEdit(botting({ description: 'The quick one.' }), quiz)
    expect(plan).to.deep.eq({ ok: true, actions: [{ kind: 'edit_widget', label: 'dumdum', patch: { description: 'The quick one.' } }] })
  })

  it('adds a new widget with a column to show it, just before Alt Text', () => {
    const plan = planBottingEdit(botting({ widget: null, label: 'numnum_again', bot_label: 'numnum' }), quiz)
    expect(plan.ok && plan.actions.map((action) => action.kind)).to.deep.eq(['add_widget', 'add_column'])
  })

  it('refuses a bot that is not put that text, naming the trouble', () => {
    const plan = planBottingEdit(botting({ textkind: 'hint' }), quiz)
    expect(plan.ok ? '' : plan.issue).to.match(/dumdum is not put a hint/)
  })

  it('refuses a label a sibling has, or no label', () => {
    expect(planBottingEdit(botting({ label: 'numnum_hint' }), quiz).ok).to.eq(false)
    expect(planBottingEdit(botting({ label: '' }), quiz)).to.deep.include({ ok: false, labelIssue: 'Give the widget a label.' })
  })

  it('comes to nothing on a locked quiz', () => {
    expect(planBottingEdit(botting({ description: 'x' }), lockedQuiz())).to.deep.eq({ ok: true, actions: [] })
  })
})
