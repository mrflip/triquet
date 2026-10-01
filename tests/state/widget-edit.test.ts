import { describe, expect, it } from 'vitest'
import { NewColumnWidthPx, NewWidget, planWidgetingEdit, type WidgetingEdit } from '../../src/state/widget-edit'
import { Quiz, type QuizT } from '../../src/models/quiz'
import { Widget } from '../../src/models/widget'
import { defaultLayout } from '../../src/models/layout'
import { SeedWidgets } from '../../src/models/seeds'
import type { HuntActionDNA } from '../../src/models/actions'
import { present } from '../support/present'

const library = SeedWidgets
const quiz: QuizT = { ...Quiz.blank(), ...defaultLayout() }
const lockedQuiz = (): QuizT => ({ ...quiz, locked: true })
const altTextIdx = quiz.columns.findIndex((column) => column.source === 'question.alt_text')
const heldWidget = present(library.find((each) => each.label === 'hint_full'))
const heldWidgeting = present(quiz.widgetings.find((each) => each.label === 'hint_full'))

/** An edit of the standard Hint Full widgeting, as opened and untouched: its widget left as it is */
function untouched(patch: Partial<WidgetingEdit> = {}): WidgetingEdit {
  return { widgeting: heldWidgeting, label: heldWidgeting.label, description: heldWidgeting.description, widgetLabel: 'hint_full', widget: null, ...patch }
}

/** Its widget, opened for revision beside it */
function heldDraft(patch: Partial<WidgetingEdit['widget']> = {}): NonNullable<WidgetingEdit['widget']> {
  return { label: heldWidget.label, description: heldWidget.description, formula: heldWidget.formula, ...patch }
}

/** A new widgeting, of a `jsonata` widget written from scratch beside it */
function fresh(patch: Partial<WidgetingEdit> = {}): WidgetingEdit {
  return {
    widgeting: null, label: '', description: '', widgetLabel: NewWidget,
    widget: { label: 'title_length', description: '', formula: '$length(qn.title)' }, ...patch,
  }
}

/** A new widgeting of a widget the library already has */
function ofHeld(widgetLabel: string, patch: Partial<WidgetingEdit> = {}): WidgetingEdit {
  return { widgeting: null, label: '', description: '', widgetLabel, widget: null, ...patch }
}

function actionsOf(edit: WidgetingEdit, target: QuizT = quiz): HuntActionDNA[] {
  const plan = planWidgetingEdit(edit, library, target)
  if (! plan.ok) { throw new Error(`Expected a plan, got: ${plan.issue}`) }
  return plan.actions
}

/** The issue a plan refuses with; '' when it does not */
function issueOf(edit: WidgetingEdit, target: QuizT = quiz): string {
  const plan = planWidgetingEdit(edit, library, target)
  return plan.ok ? '' : plan.issue
}

describe('NewWidget', () => {
  it('is a label no widget can have, so the select can offer it beside them', () => {
    expect(NewWidget).to.eq('')
  })
})

describe('NewColumnWidthPx', () => {
  it("gives a number its narrow column and a model's answer a wide one", () => {
    expect(NewColumnWidthPx).to.deep.eq({ jsonata: 78, aibot: 170 })
  })
})

describe('planWidgetingEdit, editing a widgeting', () => {
  it('comes to nothing when nothing was changed', () => {
    expect(actionsOf(untouched())).to.deep.eq([])
  })

  it('revises only the widgeting fields that changed', () => {
    expect(actionsOf(untouched({ description: 'Why.' }))).to.deep.eq([{ kind: 'edit_widgeting', label: 'hint_full', patch: { description: 'Why.' } }])
  })

  it('relabels a widgeting, which the reducer carries to its columns', () => {
    expect(actionsOf(untouched({ label: 'Hint Total!' }))).to.deep.eq([{ kind: 'edit_widgeting', label: 'hint_full', patch: { label: 'hint_total' } }])
  })

  it('reads a cleared label as its widget\'s, which it already has', () => {
    expect(actionsOf(untouched({ label: '' }))).to.deep.eq([])
  })

  it('leaves the widget alone when it was opened and not changed', () => {
    const opened = untouched({ widget: heldDraft() })
    expect(actionsOf(opened)).to.deep.eq([])
  })

  it('revises the widget when its formula changed, first', () => {
    const actions = actionsOf(untouched({ description: 'Why.', widget: heldDraft({ formula: '1' }) }))
    expect(actions).to.deep.eq([
      { kind: 'edit_widget',    label: 'hint_full', patch: { formula: '1', description: heldWidget.description } },
      { kind: 'edit_widgeting', label: 'hint_full', patch: { description: 'Why.' } },
    ])
  })

  it('refuses a label a sibling widgeting already has', () => {
    expect(issueOf(untouched({ label: 'clueing_full' }))).to.eq('Another widgeting in this quiz already has that label.')
  })

  for (const label of ['question', 'title', 'rank', 'butnot']) {
    it(`refuses ${label}, which a question already answers to`, () => {
      expect(planWidgetingEdit(untouched({ label }), library, quiz).ok).to.be.false
    })
  }

  it('refuses an empty formula, and a description too long', () => {
    const emptied = untouched({ widget: heldDraft({ formula: '' }) })
    const rambling = untouched({ description: 'x'.repeat(3601) })
    expect(issueOf(emptied)).to.not.eq('')
    expect(issueOf(rambling)).to.not.eq('')
  })
})

describe('planWidgetingEdit, making a new widgeting', () => {
  it('adds the widget, then the widgeting, then a column showing it just before Alt Text', () => {
    expect(actionsOf(fresh())).to.deep.eq([
      { kind: 'add_widget',    widget: Widget.fill({ label: 'title_length', formulary: 'jsonata', formula: '$length(qn.title)' }) },
      { kind: 'add_widgeting', widgeting: { widget_label: 'title_length', label: 'title_length', description: '', params: {} } },
      {
        kind:     'add_column',
        column:   { label: 'title_length', title: 'Title Length', source: 'title_length', width_px: 78 },
        onto_idx: altTextIdx,
      },
    ])
  })

  it('normalizes the new widget\'s label', () => {
    const widget = actionsOf(fresh({ widget: { label: 'Title Length!', description: '', formula: '1' } }))[0]
    expect(widget?.kind === 'add_widget' && widget.widget.label).to.eq('title_length')
  })

  it('takes the widgeting label and description it is given', () => {
    const actions = actionsOf(fresh({ label: 'Howlong', description: 'For the trailer round.' }))
    expect(actions[1]).to.deep.eq({ kind: 'add_widgeting', widgeting: { widget_label: 'title_length', label: 'howlong', description: 'For the trailer round.', params: {} } })
    expect(actions[2]).to.deep.include({ kind: 'add_column' })
    expect(actions[2]?.kind === 'add_column' && [actions[2].column.label, actions[2].column.source]).to.deep.eq(['howlong', 'howlong'])
  })

  it('can work a widget of the library without adding one', () => {
    const actions = actionsOf(ofHeld('answer_reversed'))
    expect(actions.map((action) => action.kind)).to.deep.eq(['add_widgeting', 'add_column'])
    expect(actions[0]).to.deep.eq({ kind: 'add_widgeting', widgeting: { widget_label: 'answer_reversed', label: 'answer_reversed', description: '', params: {} } })
  })

  it('suffixes the label of a second widgeting of one widget, so both can stand, and its column\'s too', () => {
    const actions = actionsOf(ofHeld('hint_full'))
    expect(actions[0]?.kind === 'add_widgeting' && actions[0].widgeting.label).to.eq('hint_full_2')
    expect(actions[1]?.kind === 'add_column' && actions[1].column.label).to.eq('hint_full_2')
  })

  it("suffixes the label of a widgeting whose widget shares a question field's name", () => {
    const withNotes = [...library, Widget.fill({ label: 'notes', formulary: 'jsonata', formula: '1' })]
    const plan = planWidgetingEdit(ofHeld('notes'), withNotes, quiz)
    expect(plan.ok && plan.actions[0]?.kind === 'add_widgeting' && plan.actions[0].widgeting.label).to.eq('notes_2')
  })

  it("suffixes a column's label that another column already has, though no widgeting does", () => {
    const actions = actionsOf(ofHeld('answer_reversed', { label: 'guess_cell' }), { ...quiz, columns: [...quiz.columns, { ...present(quiz.columns[0]), label: 'guess_cell' }] })
    expect(actions[1]?.kind === 'add_column' && [actions[1].column.label, actions[1].column.source]).to.deep.eq(['guess_cell_2', 'guess_cell'])
  })

  it("gives a model's answer a wide column", () => {
    const actions = actionsOf(ofHeld('dumdum'))
    expect(actions[0]?.kind === 'add_widgeting' && actions[0].widgeting.label).to.eq('dumdum_2')
    expect(actions[1]?.kind === 'add_column' && actions[1].column.width_px).to.eq(NewColumnWidthPx.aibot)
  })

  it('puts its column at the end for a quiz that has no Alt Text column', () => {
    const noAlt = { ...quiz, columns: quiz.columns.filter((column) => column.source !== 'question.alt_text') }
    const column = actionsOf(fresh(), noAlt).at(-1)
    expect(column).to.deep.include({ kind: 'add_column' })
    expect(column).to.not.have.property('onto_idx')
  })

  const Refused: [Partial<WidgetingEdit>, RegExp, string | null, string][] = [
    [{ widget: { label: '', description: '', formula: '1' } },                       /^Give the new widget a label\.$/,                           'Give the new widget a label.',                          'a new widget with no label'],
    [{ widget: { label: 'clueing_full', description: '', formula: '1' } },           /^Another widget in the library already has that label\.$/,  'Another widget in the library already has that label.', 'a new widget whose label the library has'],
    [{ widget: { label: 'fine_one', description: '', formula: '' } },                /./,                                                         null,                                                    'a new widget with no formula'],
    [{ widget: { label: 'fine_one', description: '', formula: 'x'.repeat(1000) } },  /./,                                                         null,                                                    'a new widget with a formula past 999 characters'],
    [{ widgetLabel: '', widget: null },                                              /^Pick a widget for it to work\.$/,                          null,                                                    'a widgeting of no widget at all'],
    [{ label: 'clueing_full' },                                                      /^Another widgeting in this quiz already has that label\.$/, null,                                                    'a widgeting label a sibling has'],
  ]
  for (const [patch, issue, labelIssue, describes] of Refused) {
    it(`refuses ${describes}`, () => {
      const plan = planWidgetingEdit(fresh(patch), library, quiz)
      expect(plan).to.deep.include({ ok: false, labelIssue })
      expect(plan.ok ? '' : plan.issue).to.match(issue)
    })
  }
})

describe('planWidgetingEdit, on a locked quiz', () => {
  it('leaves the widgeting alone and revises only the widget, which belongs to the library', () => {
    const actions = actionsOf(untouched({ description: 'Ignored', widget: heldDraft({ formula: '1' }) }), lockedQuiz())
    expect(actions.map((action) => action.kind)).to.deep.eq(['edit_widget'])
  })

  it('comes to nothing when only the widgeting was touched', () => {
    expect(actionsOf(untouched({ description: 'Ignored' }), lockedQuiz())).to.deep.eq([])
  })

  it('adds a new widget to the library, and no widgeting or column', () => {
    expect(actionsOf(fresh(), lockedQuiz()).map((action) => action.kind)).to.deep.eq(['add_widget'])
  })
})
