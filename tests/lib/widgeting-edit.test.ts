import { describe, expect, it } from 'vitest'
import { EstimatesColumnWidthPx, NewColumnWidthPx, newColumnShowing, planWidgetingEdit, runOrderIdxOf, type WidgetingEdit } from '../../src/lib/widgeting-edit'
import { Quiz, type QuizT } from '../../src/models/quiz'
import { Widget } from '../../src/models/widget'
import { Widgeting, type WidgetingT } from '../../src/models/widgeting'
import { AddedColumnWidthPx, defaultLayout } from '../../src/models/layout'
import { classicLayout } from '../support/layouts'
import { SeedWidgets } from '../../src/models/seeds'
import type { HuntActionDNA } from '../../src/models/actions'
import { present } from '../support/present'

const library = SeedWidgets
const quiz: QuizT = { ...Quiz.blank(), ...classicLayout() }
const lockedQuiz = (): QuizT => ({ ...quiz, locked: true })
const altTextIdx = quiz.columns.findIndex((column) => column.source === 'alt_text')
const heldWidgeting = present(quiz.widgetings.find((each) => each.label === 'hint_full'))

/** An edit of the standard Hint Full widgeting, as opened and untouched */
function untouched(patch: Partial<WidgetingEdit> = {}): WidgetingEdit {
  return { widgeting: heldWidgeting, label: heldWidgeting.label, description: heldWidgeting.description, widgetLabel: 'hint_full', ...patch }
}

/** A new widgeting of a widget the library holds */
function ofHeld(widgetLabel: string, patch: Partial<WidgetingEdit> = {}): WidgetingEdit {
  return { widgeting: null, label: '', description: '', widgetLabel, ...patch }
}

function actionsOf(edit: WidgetingEdit, target: QuizT = quiz, held = library): HuntActionDNA[] {
  const plan = planWidgetingEdit(edit, held, target)
  if (! plan.ok) { throw new Error(`Expected a plan, got: ${plan.issue}`) }
  return plan.actions
}

describe("NewColumnWidthPx", () => {
  it("gives a number its narrow column, and a model's answer and an entry a wide one", () => {
    expect(NewColumnWidthPx).to.deep.eq({ jsonata: 78, aibot: 170, entry: 170 })
  })
})

describe("EstimatesColumnWidthPx", () => {
  it("is the width of the column a new category-estimate widgeting brings, wider than any other entry's", () => {
    const actions = actionsOf(ofHeld('category_data'))
    expect(actions[1]?.kind === 'add_column' && [actions[1].column.source, actions[1].column.width_px]).to.deep.eq(['category_data', EstimatesColumnWidthPx])
    expect(EstimatesColumnWidthPx).to.be.above(NewColumnWidthPx.entry)
  })
})

describe("planWidgetingEdit, editing a widgeting", () => {
  it("comes to nothing when nothing was changed", () => {
    expect(actionsOf(untouched())).to.deep.eq([])
  })

  it("revises only the widgeting fields that changed", () => {
    expect(actionsOf(untouched({ description: 'Why.' }))).to.deep.eq([{ kind: 'edit_widgeting', label: 'hint_full', patch: { description: 'Why.' } }])
  })

  it("relabels a widgeting, which the reducer carries to its columns", () => {
    expect(actionsOf(untouched({ label: 'Hint Total!' }))).to.deep.eq([{ kind: 'edit_widgeting', label: 'hint_full', patch: { label: 'hint_total' } }])
  })

  it("heads a column still headed after the widgeting's old label after its new one, as a new column is", () => {
    const plain = { ...quiz, columns: quiz.columns.map((column) => (column.source === 'hint_full' ? { ...column, title: 'Hint Full' } : column)) }
    const actions = actionsOf(untouched({ label: 'hint_total' }), plain)
    const column = present(plain.columns.find((each) => each.source === 'hint_full'))
    expect(actions).to.deep.eq([
      { kind: 'edit_widgeting', label: 'hint_full', patch: { label: 'hint_total' } },
      { kind: 'edit_column',    label: column.label, patch: { title: 'Hint Total' } },
    ])
  })

  it("leaves a column the author has headed otherwise as it is headed", () => {
    expect(actionsOf(untouched({ label: 'hint_total' })).map((action) => action.kind)).to.deep.eq(['edit_widgeting'])
  })

  it("reads a cleared label as its widget's, which it already has", () => {
    expect(actionsOf(untouched({ label: '' }))).to.deep.eq([])
  })

  it("still revises a widgeting whose widget the library no longer holds", () => {
    const without = library.filter((widget) => widget.label !== 'hint_full')
    expect(actionsOf(untouched({ description: 'Orphaned.' }), quiz, without)).to.deep.eq([{ kind: 'edit_widgeting', label: 'hint_full', patch: { description: 'Orphaned.' } }])
  })

  it("refuses a label a sibling widgeting already has, beside the label", () => {
    expect(planWidgetingEdit(untouched({ label: 'clueing_full' }), library, quiz)).to.deep.eq({
      ok: false, issue: 'Another widgeting in this quiz already has that label.', labelIssue: 'Another widgeting in this quiz already has that label.',
    })
  })

  for (const label of ['question', 'title', 'rank', 'butnot']) {
    it(`refuses ${label}, which a question already answers to, beside the label`, () => {
      const plan = planWidgetingEdit(untouched({ label }), library, quiz)
      expect(plan.ok).to.be.false
      expect(plan.ok ? null : plan.labelIssue).to.be.a('string')
    })
  }

  it("refuses a description too long, and not beside the label", () => {
    const plan = planWidgetingEdit(untouched({ description: 'x'.repeat(3601) }), library, quiz)
    expect(plan).to.deep.include({ ok: false, labelIssue: null })
  })
})

describe("planWidgetingEdit, making a new widgeting", () => {
  it("adds the widgeting, then a column showing it just before Alt Text", () => {
    expect(actionsOf(ofHeld('answer_reversed'))).to.deep.eq([
      { kind: 'add_widgeting', widgeting: { widget_label: 'answer_reversed', label: 'answer_reversed', description: '', params: {}, tier: 'question' } },
      {
        kind:     'add_column',
        column:   { label: 'answer_reversed', title: 'Answer Reversed', source: 'answer_reversed', width_px: 78 },
        onto_idx: altTextIdx,
      },
    ])
  })

  it("takes the widgeting label and description it is given", () => {
    const actions = actionsOf(ofHeld('answer_reversed', { label: 'Backward', description: 'For the palindrome round.' }))
    expect(actions[0]).to.deep.eq({ kind: 'add_widgeting', widgeting: { widget_label: 'answer_reversed', label: 'backward', description: 'For the palindrome round.', params: {}, tier: 'question' } })
    expect(actions[1]?.kind === 'add_column' && [actions[1].column.label, actions[1].column.source]).to.deep.eq(['backward', 'backward'])
  })

  it("works a widget written a moment ago, which the caller hands it beside the library", () => {
    const fresh = Widget.fill({ label: 'title_length', formulary: 'jsonata', formula: '$length(qn.title)' })
    const actions = actionsOf(ofHeld('title_length'), quiz, [...library, fresh])
    expect(actions.map((action) => action.kind)).to.deep.eq(['add_widgeting', 'add_column'])
  })

  it("suffixes the label of a second widgeting of one widget, so both can stand, and its column's too", () => {
    const actions = actionsOf(ofHeld('hint_full'))
    expect(actions[0]?.kind === 'add_widgeting' && actions[0].widgeting.label).to.eq('hint_full_2')
    expect(actions[1]?.kind === 'add_column' && actions[1].column.label).to.eq('hint_full_2')
  })

  it("suffixes the label of a widgeting whose widget shares a question field's name", () => {
    const withNotes = [...library, Widget.fill({ label: 'notes', formulary: 'jsonata', formula: '1' })]
    const [added] = actionsOf(ofHeld('notes'), quiz, withNotes)
    expect(added?.kind === 'add_widgeting' && added.widgeting.label).to.eq('notes_2')
  })

  it("suffixes a column's label that another column already has, though no widgeting does", () => {
    const actions = actionsOf(ofHeld('answer_reversed', { label: 'guess_cell' }), { ...quiz, columns: [...quiz.columns, { ...present(quiz.columns[0]), label: 'guess_cell' }] })
    expect(actions[1]?.kind === 'add_column' && [actions[1].column.label, actions[1].column.source]).to.deep.eq(['guess_cell_2', 'guess_cell'])
  })

  it("gives a model's answer a wide column", () => {
    const actions = actionsOf(ofHeld('dumdum'))
    expect(actions[1]?.kind === 'add_column' && actions[1].column.width_px).to.eq(NewColumnWidthPx.aibot)
  })

  it("puts its column at the end for a quiz that has no Alt Text column", () => {
    const noAlt = { ...quiz, columns: quiz.columns.filter((column) => column.source !== 'alt_text') }
    const column = actionsOf(ofHeld('answer_reversed'), noAlt).at(-1)
    expect(column).to.deep.include({ kind: 'add_column' })
    expect(column).to.not.have.property('onto_idx')
  })

  it("works the same for a quiz that puts nothing to work yet", () => {
    const lean = { ...quiz, ...defaultLayout() }
    expect(actionsOf(ofHeld('dumdum'), lean)[0]).to.deep.eq({ kind: 'add_widgeting', widgeting: { widget_label: 'dumdum', label: 'dumdum', description: '', params: {}, tier: 'question' } })
  })

  const Refused: [Partial<WidgetingEdit>, string, string | null, string][] = [
    [{ widgetLabel: '' },              "Pick a widget for it to work.",                         null,                                                    'a widgeting of no widget at all'],
    [{ widgetLabel: 'no_such_widget' }, "Pick a widget for it to work.",                         null,                                                    'a widgeting of a widget the library lacks'],
    [{ label: 'clueing_full' },        "Another widgeting in this quiz already has that label.", "Another widgeting in this quiz already has that label.", 'a widgeting label a sibling has'],
  ]
  for (const [patch, issue, labelIssue, describes] of Refused) {
    it(`refuses ${describes}`, () => {
      expect(planWidgetingEdit(ofHeld('answer_reversed', patch), library, quiz)).to.deep.eq({ ok: false, issue, labelIssue })
    })
  }
})

describe("planWidgetingEdit, on a locked quiz", () => {
  it("plans as for any other: whether the quiz may be changed is the editor's to offer, not the plan's", () => {
    expect(actionsOf(untouched({ description: 'Revised' }), lockedQuiz())).to.deep.eq(actionsOf(untouched({ description: 'Revised' })))
    expect(actionsOf(ofHeld('answer_reversed'), lockedQuiz())).to.deep.eq(actionsOf(ofHeld('answer_reversed')))
  })
})

describe("planWidgetingEdit, a new widgeting run once for the whole quiz", () => {
  const withNames = [...library, Widget.fill({ label: 'name_list', formulary: 'entry', config: { entry_kind: 'text' } })]

  it("adds it at its tier, and brings no column: it has no cell for any question", () => {
    expect(actionsOf(ofHeld('name_list', { label: 'playtesters', tier: 'quiz' }), quiz, withNames)).to.deep.eq([
      { kind: 'add_widgeting', widgeting: { widget_label: 'name_list', label: 'playtesters', description: '', params: {}, tier: 'quiz' } },
    ])
  })

  it("refuses a widget that cannot run at the quiz's level: a model, or a question's category estimates", () => {
    for (const widgetLabel of ['dumdum', 'category_data']) {
      expect(planWidgetingEdit(ofHeld(widgetLabel, { tier: 'quiz' }), library, quiz)).to.deep.eq({ ok: false, issue: 'Only a formula or an entry of one value can run once for the whole quiz.', labelIssue: null })
    }
  })

  it("refuses a name the quiz itself answers to, and steps a defaulted label past one", () => {
    expect(planWidgetingEdit(ofHeld('name_list', { label: 'smiths_note', tier: 'quiz' }), withNames, quiz)).to.deep.include({ ok: false, labelIssue: 'The quiz itself already answers to that name in a formula.' })
    const smithsNote = [...library, Widget.fill({ label: 'smiths_note', formulary: 'entry', config: { entry_kind: 'text' } })]
    expect(actionsOf(ofHeld('smiths_note', { tier: 'quiz' }), quiz, smithsNote)[0]).to.deep.include({ widgeting: { widget_label: 'smiths_note', label: 'smiths_note_2', description: '', params: {}, tier: 'quiz' } })
  })

  it("keeps an existing widgeting's own tier, whatever the editor was opened for", () => {
    const quizWide = { ...quiz, widgetings: [{ widget_label: 'name_list', label: 'playtesters', description: '', params: {}, tier: 'quiz' as const }, ...quiz.widgetings] }
    const held = present(quizWide.widgetings[0])
    expect(actionsOf({ widgeting: held, label: 'testers', description: '', widgetLabel: 'name_list', tier: 'question' }, quizWide, withNames)).to.deep.eq([{ kind: 'edit_widgeting', label: 'playtesters', patch: { label: 'testers' } }])
  })
})

describe("planWidgetingEdit, an entry's params", () => {
  const Grade = Widget.fill({ label: 'grade', formulary: 'entry', config: { entry_kind: 'number', min: 1, max: 10 } })
  const withGrade = [...library, Grade]
  const graded = Widgeting.fill({ widget_label: 'grade', label: 'grade', params: { max: 5 } })
  const gradedQuiz: QuizT = { ...quiz, widgetings: [...quiz.widgetings, graded] }

  it("hands a new widgeting the params given, held to its widget's family", () => {
    const [added] = actionsOf(ofHeld('grade', { params: { integer: true } }), quiz, withGrade)
    expect(added).to.deep.include({ kind: 'add_widgeting' })
    expect(added?.kind === 'add_widgeting' ? added.widgeting.params : null).to.deep.eq({ integer: true })
  })

  it("revises an existing one's params alone, when only they changed", () => {
    const edit = { widgeting: graded, label: 'grade', description: '', widgetLabel: 'grade', params: { max: 7 } }
    expect(actionsOf(edit, gradedQuiz, withGrade)).to.deep.eq([{ kind: 'edit_widgeting', label: 'grade', patch: { params: { max: 7 } } }])
  })

  it("refuses params the family does not take, or that do not fit the widget's defaults, saying which", () => {
    const foreign = planWidgetingEdit(ofHeld('grade', { params: { options: ['a'] } }), withGrade, quiz)
    expect(foreign).to.deep.include({ ok: false, labelIssue: null })
    const clashing = planWidgetingEdit(ofHeld('grade', { params: { max: 0 } }), withGrade, quiz)
    expect(clashing.ok ? null : clashing.issue).to.eq("Its params will not do: max «0» should be no less than the least, «1»")
  })

  it("leaves an existing one's params alone when they are not what changed, whatever was written before", () => {
    const old = { ...graded, params: { strict: true } }
    const edit = { widgeting: old, label: 'graded_2', description: '', widgetLabel: 'grade' }
    expect(actionsOf(edit, { ...quiz, widgetings: [...quiz.widgetings, old] }, withGrade)).to.deep.eq([{ kind: 'edit_widgeting', label: 'grade', patch: { label: 'graded_2' } }])
  })
})

/** Whether a widgeting is one of the entries the run-order tests name */
const isEntry = (widgeting: WidgetingT) => ['remark', 'tally'].includes(widgeting.label)

/** Widgetings labelled `labels`, each working the widget of its label */
const listOf = (...labels: string[]) => labels.map((label) => Widgeting.fill({ widget_label: label, label }))

describe("runOrderIdxOf", () => {
  const remark = listOf('remark')
  const Cases: [string[], string, number, number, string][] = [
    // regular usage:
    [['remark', 'guess', 'shout'],                 'shout', 0,  1, 'a drop at the head of the rest lands just after the entries, per the doc example'],
    [['guess', 'remark', 'shout', 'echo'],         'echo',  1,  2, 'a drop lands just before the one now there, an entry placed among them passed over'],
    [['guess', 'remark', 'shout', 'echo'],         'guess', 2,  3, 'a drop past the last of the rest lands just after it'],
    [['guess', 'shout', 'remark'],                 'guess', 1,  1, 'a drop at the end lands after the last of the rest, before an entry placed after it'],
    // trivial cases:
    [['guess'],                                    'guess', 0,  0, 'the one widgeting of the rest lands where it was'],
    [['remark', 'tally', 'guess'],                 'guess', 5,  2, 'a drop past the end lands at the end'],
  ]
  for (const [labels, label, onto_idx, expected, describes] of Cases) {
    it(describes, () => {
      expect(runOrderIdxOf(listOf(...labels), isEntry, label, onto_idx)).to.eq(expected)
    })
  }

  it("lands among the entries' rest wherever they are, the entries themselves never counted", () => {
    expect(runOrderIdxOf([...remark, ...listOf('guess')], isEntry, 'guess', 0)).to.eq(1)
  })
})

describe("newColumnShowing", () => {
  it("adds a column at the end, titled and labelled after what it shows, as wide as a new column is", () => {
    const action = newColumnShowing({ columns: [] }, 'notes')
    expect(action).to.deep.eq({ kind: 'add_column', column: { label: 'notes', title: 'Notes', source: 'notes', width_px: AddedColumnWidthPx } })
  })

  it("grows the label while another column has it", () => {
    const held = newColumnShowing({ columns: [] }, 'notes').column
    expect(newColumnShowing({ columns: [held] }, 'notes').column.label).to.eq('notes_2')
  })

  it("names a widgeting's column after the widgeting", () => {
    const { column } = newColumnShowing(quiz, 'hint_full')
    expect([column.label, column.title, column.source]).to.deep.eq(['hint_full_2', 'Hint Full', 'hint_full'])
  })
})
