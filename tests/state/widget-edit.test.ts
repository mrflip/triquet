import { describe, expect, it } from 'vitest'
import { BlankAibotDraft, BlankEntryDraft, BlankJsonataDraft, blankDraftOf, draftOf, planNewWidget, planWidgetEdit, type AibotDraft, type EntryDraft, type JsonataDraft, type WidgetDraft } from '../../src/state/widget-edit'
import { Widget } from '../../src/models/widget'
import { SeedWidgets } from '../../src/models/seeds'
import { present } from '../support/present'

const library = SeedWidgets
const heldWidget = present(library.find((each) => each.label === 'hint_full'))
const dumdum = present(library.find((each) => each.label === 'dumdum'))

/** A new formula, as written */
const titleLength: WidgetDraft = { ...BlankJsonataDraft, label: 'title_length', formula: '$length(qn.title)' }

/** A new entry, of numbers */
const points: EntryDraft = { ...BlankEntryDraft, label: 'points', config: { entry_kind: 'number' } }
const Points = Widget.fill({ label: 'points', formulary: 'entry', config: { entry_kind: 'number' } })

/** A new prompt, as pasted in */
const pasted: AibotDraft = { ...BlankAibotDraft, label: 'riddler', formula: 'Riddle: {{clueing}}. Reply as {"answer": string}.' }

describe("blankDraftOf", () => {
  it("starts a formula on nothing, keeping what was typed", () => {
    expect(blankDraftOf('jsonata', { label: 'shout', description: 'Loudly.' })).to.deep.eq({ formulary: 'jsonata', label: 'shout', description: 'Loudly.', formula: '' })
  })

  it("starts a prompt on the clueing, the quick tier and room for a short object", () => {
    expect(blankDraftOf('aibot', { label: 'riddler', description: '' })).to.deep.eq({ ...BlankAibotDraft, label: 'riddler' })
    expect((blankDraftOf('aibot', { label: 'riddler', description: '' }) as AibotDraft).input_formula).to.eq("{ 'clueing': qn.clueing }")
  })

  it("starts an entry as text, as a note is", () => {
    expect(blankDraftOf('entry', { label: 'remark', description: 'Said aside.' })).to.deep.eq({ formulary: 'entry', label: 'remark', description: 'Said aside.', config: { entry_kind: 'text' } })
  })
})


describe("planNewWidget", () => {
  it("adds a new formula to the library, and hands back the widget it adds", () => {
    const widget = Widget.fill({ label: 'title_length', formulary: 'jsonata', formula: '$length(qn.title)' })
    expect(planNewWidget(titleLength, library)).to.deep.eq({ ok: true, actions: [{ kind: 'add_widget', widget }], widget })
  })

  it("adds a pasted prompt with its input formula and config", () => {
    const plan = planNewWidget(pasted, library)
    expect(plan.ok && plan.actions).to.deep.eq([{ kind: 'add_widget', widget: Widget.fill({ ...pasted }) }])
  })

  it("adds an entry with its kind, and no formula", () => {
    expect(planNewWidget(points, library)).to.deep.eq({ ok: true, actions: [{ kind: 'add_widget', widget: Points }], widget: Points })
  })

  it("normalizes the new widget's label", () => {
    const plan = planNewWidget({ ...titleLength, label: 'Title Length!' }, library)
    expect(plan.ok && plan.widget.label).to.eq('title_length')
  })

  const Refused: [WidgetDraft, RegExp, boolean, string][] = [
    [{ ...titleLength, label: '' },                                      /^Give the new widget a label\.$/,                          true,  'a new widget with no label'],
    [{ ...titleLength, label: 'clueing_full' },                          /^Another widget in the library already has that label\.$/, true,  'a label the library already has'],
    [{ ...titleLength, formula: '' },                                    /./,                                                        false, 'a formula left empty'],
    [{ ...titleLength, formula: 'x'.repeat(1000) },                      /./,                                                        false, 'a formula past 999 characters'],
    [{ ...pasted, config: { ...pasted.config, max_tokens: 0 } },         /./,                                                        false, 'a prompt with no room to answer in'],
  ]
  for (const [draft, issue, onLabel, describes] of Refused) {
    it(`refuses ${describes}`, () => {
      const plan = planNewWidget(draft, library)
      expect(plan.ok).to.be.false
      expect(plan.ok ? '' : plan.issue).to.match(issue)
      expect(plan.ok ? null : plan.labelIssue !== null).to.eq(onLabel)
    })
  }
})

describe("planWidgetEdit", () => {
  it("comes to nothing for a widget left as it was", () => {
    expect(planWidgetEdit(draftOf(heldWidget), library)).to.deep.eq({ ok: true, actions: [] })
  })

  it("revises what changed, in one edit", () => {
    expect(planWidgetEdit({ ...(draftOf(heldWidget) as JsonataDraft), formula: '1' }, library)).to.deep.eq({
      ok: true, actions: [{ kind: 'edit_widget', label: 'hint_full', patch: { formula: '1', description: heldWidget.description } }],
    })
  })

  it("revises a held prompt with its input formula and config as well as its text", () => {
    const draft = { ...(draftOf(dumdum) as AibotDraft), config: { servicelabel: 'claude' as const, model_tier: 'careful' as const, max_tokens: 512 } }
    expect(planWidgetEdit(draft, library)).to.deep.eq({
      ok: true, actions: [{ kind: 'edit_widget', label: 'dumdum', patch: { formula: dumdum.formula, description: dumdum.description, input_formula: dumdum.input_formula, config: draft.config } }],
    })
  })

  it("revises an entry's description, its config going as it was", () => {
    expect(planWidgetEdit({ ...draftOf(Points), description: 'Out of ten.' }, [...library, Points])).to.deep.eq({
      ok: true, actions: [{ kind: 'edit_widget', label: 'points', patch: { description: 'Out of ten.', config: { entry_kind: 'number' } } }],
    })
  })

  it("revises the params an entry's widgetings start from, its kind kept", () => {
    expect(planWidgetEdit({ ...points, config: { entry_kind: 'number', min: 1, max: 10 } }, [...library, Points])).to.deep.eq({
      ok: true, actions: [{ kind: 'edit_widget', label: 'points', patch: { description: '', config: { entry_kind: 'number', min: 1, max: 10 } } }],
    })
  })

  it("refuses default params its family does not take, or that do not agree", () => {
    expect(planWidgetEdit({ ...points, config: { entry_kind: 'number', min: 10, max: 1 } }, [...library, Points]).ok).to.be.false
    expect(planWidgetEdit({ ...points, config: { entry_kind: 'number', options: ['a'] } as never }, [...library, Points]).ok).to.be.false
  })

  it("sends nothing for an entry unchanged", () => {
    expect(planWidgetEdit(draftOf(Points), [...library, Points])).to.deep.eq({ ok: true, actions: [] })
  })

  it("refuses another kind for an entry the library holds, saying it is fixed", () => {
    const plan = planWidgetEdit({ ...points, config: { entry_kind: 'text' } }, [...library, Points])
    expect(plan.ok ? '' : plan.issue).to.eq('It is a number entry, which is fixed once it is made.')
  })

  it("refuses what the widget validator refuses", () => {
    expect(planWidgetEdit({ ...(draftOf(heldWidget) as JsonataDraft), formula: '' }, library).ok).to.be.false
  })
})

describe("draftOf", () => {
  it("is a formula's label, description and formula", () => {
    expect(draftOf(heldWidget)).to.deep.eq({ formulary: 'jsonata', label: 'hint_full', description: heldWidget.description, formula: heldWidget.formula })
  })

  it("is a prompt's, with its input formula and config", () => {
    expect(draftOf(dumdum)).to.deep.include({ formulary: 'aibot', label: 'dumdum', input_formula: dumdum.input_formula })
  })

  it("is an entry's label, description and kind, and nothing it does not have", () => {
    expect(draftOf(Points)).to.deep.eq({ formulary: 'entry', label: 'points', description: '', config: { entry_kind: 'number' } })
  })
})
