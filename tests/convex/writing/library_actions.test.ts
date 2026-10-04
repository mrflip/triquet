import _ from 'es-toolkit/compat'
import { describe, expect, it } from 'vitest'
import * as PA from '../../../src/lib/vv/patterns'
import type { HuntT } from '../../../src/models/hunt'
import { Quiz } from '../../../src/models/quiz'
import { SeedWidgets } from '../../../src/models/seeds'
import { Widget, type JsonataWidgetT, type WidgetT } from '../../../src/models/widget'
import { Widgeting } from '../../../src/models/widgeting'
import type { LibraryActionDNA } from '../../../src/models/actions'
import { present } from '../../support/present'
import { huntHolding, openOf, openTester, refusedAs, seedHunt, type Seeded, type Seen, type Tester } from '../../support/convex'
import { classicHunt } from '../../support/layouts'

/** A hunt of one blank quiz, working no widget */
const bare = (): HuntT => huntHolding([Quiz.blank('Quiz one')])

const seed = async (hunt: HuntT = bare(), tt: Tester = openTester()) => await seedHunt(tt, hunt)

const labelsOf = (seen: Seen) => seen.library.map((widget) => widget.label)
const widgetOf = (seen: Seen, label: string) => present(seen.library.find((widget) => widget.label === label), label)
/** The library's formula labelled `label`, which a test revises as a formula */
const formulaOf = (seen: Seen, label: string): JsonataWidgetT => {
  const widget = widgetOf(seen, label)
  if (widget.formulary !== 'jsonata') { throw new Error(`${label} is not a formula`) }
  return widget
}
const SeedLabels = SeedWidgets.map((widget) => widget.label)

const Shout = Widget.fill({ label: 'shout', formulary: 'jsonata', formula: '$uppercase(qn.title)' })
const AskerConfig = { servicelabel: 'claude', model_tier: 'quick', max_tokens: 100 } as const
const Asker = Widget.fill({ label: 'asker', formulary: 'aibot', formula: 'Who wrote {{clueing}}?', config: AskerConfig })
const Remark = Widget.fill({ label: 'remark', formulary: 'entry', config: { entry_kind: 'text' } })

/** Each of `refusals` refused for its own reason, and whatever `seeded` holds unchanged by them */
async function expectRefused(seeded: Seeded, ...refusals: [LibraryActionDNA, string][]): Promise<void> {
  const ante = await seeded.read()
  for (const [action, failurekind] of refusals) { expect(await refusedAs(seeded.actOnLibrary(action))).to.eq(failurekind) }
  expect(await seeded.read()).to.deep.eq(ante)
}

/** Whether each of `actions` was refused, and whether whatever `seeded` holds is unchanged by them */
async function refusalsOf(seeded: Seeded, ...actions: LibraryActionDNA[]): Promise<{ refused: boolean[], unchanged: boolean }> {
  const ante = await seeded.read()
  const refused: boolean[] = []
  for (const action of actions) {
    try {
      await seeded.actOnLibrary(action)
      refused.push(false)
    } catch {
      refused.push(true)
    }
  }
  return { refused, unchanged: _.isEqual(await seeded.read(), ante) }
}

describe("add_widget", () => {
  it("puts a widget at the end of the library, its scope, title, description and input formula defaulted", async () => {
    const { actOnLibrary, read } = await seed()
    await actOnLibrary({ kind: 'add_widget', widget: { label: 'shout', formulary: 'jsonata', formula: '$uppercase(qn.title)' } })
    await actOnLibrary({ kind: 'add_widget', widget: { label: 'asker', formulary: 'aibot', formula: 'Who wrote {{clueing}}?', config: AskerConfig } })
    const after = await read()
    expect(after.library.slice(-2)).to.deep.eq([Shout, Asker])
    expect([Shout.input_formula, Asker.input_formula]).to.deep.eq(['$', "{ 'clueing': qn.clueing }"])
  })


  it("refuses a label the library already holds, leaving it as it was", async () => {
    await expectRefused(await seed(), [{ kind: 'add_widget', widget: { ...Shout, label: 'dumdum' } }, 'labelTaken'])
  })

  it("refuses a config of another formulary's shape, or none where one is wanted, at the door", async () => {
    const refusals = await refusalsOf(await seed(),
      { kind: 'add_widget', widget: { ...Shout, config: AskerConfig } as never },
      { kind: 'add_widget', widget: { ...Asker, config: {} } as never },
      { kind: 'add_widget', widget: { ...Asker, config: { ...AskerConfig, max_tokens: 9000 } } as never })
    expect(refusals).to.deep.eq({ refused: [true, true, true], unchanged: true })
  })

  it("refuses a widget that is not one", async () => {
    const refusals = await refusalsOf(await seed(),
      { kind: 'add_widget', widget: { ...Shout, label: 'No Good' } },
      { kind: 'add_widget', widget: { ...Shout, formula: '' } },
      { kind: 'add_widget', widget: { ...Shout, formula: 'x'.repeat(PA.Formulaish.max + 1) } })
    expect(refusals).to.deep.eq({ refused: [true, true, true], unchanged: true })
  })
})

describe("edit_widget", () => {
  it("revises the fields named and no others", async () => {
    const { actOnLibrary, read } = await seed()
    const ante = await read()
    await actOnLibrary({ kind: 'edit_widget', label: 'answer_reversed', patch: { formula: '"x"', description: 'Changed.' } })
    const after = await read()
    expect(widgetOf(after, 'answer_reversed')).to.deep.eq({ ...widgetOf(ante, 'answer_reversed'), formula: '"x"', description: 'Changed.' })
    expect(after.library.filter((widget) => widget.label !== 'answer_reversed')).to.deep.eq(ante.library.filter((widget) => widget.label !== 'answer_reversed'))
  })

  it("revises an aibot widget's config whole", async () => {
    const { actOnLibrary, read } = await seed()
    const config = { servicelabel: 'claude' as const, model_tier: 'careful' as const, max_tokens: 1200 }
    await actOnLibrary({ kind: 'edit_widget', label: 'dumdum', patch: { config } })
    expect(widgetOf(await read(), 'dumdum').config).to.deep.eq(config)
  })

  it("changes what every quiz working it shows, the quiz itself left as it was", async () => {
    const { actOnLibrary, read } = await seed(classicHunt())
    const ante = await read()
    await actOnLibrary({ kind: 'edit_widget', label: 'clueing_full', patch: { formula: '42' } })
    const after = await read()
    expect(widgetOf(after, 'clueing_full').formula).to.eq('42')
    expect(openOf(after)).to.deep.eq(openOf(ante))
  })


  it("refuses a widget the library does not hold", async () => {
    await expectRefused(await seed(), [{ kind: 'edit_widget', label: 'absent', patch: { description: 'x' } }, 'widgetGone'])
  })

  it("refuses a config of another formulary's shape, and a formula past its own formulary's bound", async () => {
    const tooLong = 'x'.repeat(PA.Formulaish.max + 1)
    await expectRefused(await seed(),
      [{ kind: 'edit_widget', label: 'answer_reversed', patch: { config: AskerConfig } }, 'invalid'],
      [{ kind: 'edit_widget', label: 'dumdum', patch: { config: {} } },                    'invalid'],
      [{ kind: 'edit_widget', label: 'answer_reversed', patch: { formula: tooLong } },     'invalid'])
  })

  it("takes a formula past a jsonata widget's bound for an aibot widget, whose prompts run longer", async () => {
    const { actOnLibrary, read } = await seed()
    const prompt = `${'Read this carefully. '.repeat(60)}{{clueing}}`
    await actOnLibrary({ kind: 'edit_widget', label: 'dumdum', patch: { formula: prompt } })
    expect(widgetOf(await read(), 'dumdum').formula).to.eq(prompt)
  })
})

describe("an entry widget", () => {
  it("is added with no formula and no input formula, and its kind", async () => {
    const { actOnLibrary, read } = await seed()
    await actOnLibrary({ kind: 'add_widget', widget: Remark })
    expect(widgetOf(await read(), 'remark')).to.deep.eq(Remark)
  })

  it("has its description revised, and its kind left as it was", async () => {
    const { actOnLibrary, read } = await seed()
    await actOnLibrary({ kind: 'add_widget', widget: Remark })
    await actOnLibrary({ kind: 'edit_widget', label: 'remark', patch: { description: 'What the editor thinks.', config: { entry_kind: 'text' } } })
    expect(widgetOf(await read(), 'remark')).to.deep.eq({ ...Remark, description: 'What the editor thinks.' })
  })

  it("refuses another kind, which the values typed hang on, and a formula", async () => {
    const seeded = await seed()
    await seeded.actOnLibrary({ kind: 'add_widget', widget: Remark })
    await expectRefused(seeded, [{ kind: 'edit_widget', label: 'remark', patch: { config: { entry_kind: 'number' } } }, 'entryKindFixed'])
    const refusals = await refusalsOf(seeded, { kind: 'edit_widget', label: 'remark', patch: { formula: 'qn.notes' } })
    expect(refusals).to.deep.eq({ refused: [true], unchanged: true })
  })

  it("is passed over by an import naming it as another kind, rather than half-merged", async () => {
    const { actOnLibrary, read } = await seed()
    await actOnLibrary({ kind: 'add_widget', widget: Remark })
    await actOnLibrary({ kind: 'import_widgets', widgets: [{ ...Remark, description: 'Counted.', config: { entry_kind: 'number' } }, Shout] })
    const after = await read()
    expect(widgetOf(after, 'remark')).to.deep.eq(Remark)
    expect(labelsOf(after).at(-1)).to.eq('shout')
  })

  it("is revised by an import naming it as the same kind", async () => {
    const { actOnLibrary, read } = await seed()
    await actOnLibrary({ kind: 'add_widget', widget: Remark })
    await actOnLibrary({ kind: 'import_widgets', widgets: [{ ...Remark, description: 'Revised.' }] })
    expect(widgetOf(await read(), 'remark').description).to.eq('Revised.')
  })
})

describe("move_widget", () => {
  it("reorders the library, and only it", async () => {
    const { actOnLibrary, read } = await seed(classicHunt())
    const ante = await read()
    await actOnLibrary({ kind: 'move_widget', label: 'answer_reversed', onto_idx: 0 })
    const after = await read()
    expect(labelsOf(after)).to.deep.eq(['answer_reversed', ...SeedLabels.filter((label) => label !== 'answer_reversed')])
    expect(after.hunt).to.deep.eq(ante.hunt)
  })

  it("puts a widget at the end for an index past it, and refuses a label it does not hold", async () => {
    const seeded = await seed()
    await seeded.actOnLibrary({ kind: 'move_widget', label: 'dumdum', onto_idx: 999 })
    expect(labelsOf(await seeded.read()).at(-1)).to.eq('dumdum')
    await expectRefused(seeded, [{ kind: 'move_widget', label: 'absent', onto_idx: 0 }, 'widgetGone'])
  })

})

describe("delete_widget", () => {
  it("removes a widget no widgeting works, the rest closing ranks", async () => {
    const { actOnLibrary, read, tt } = await seed()
    await actOnLibrary({ kind: 'delete_widget', label: 'answer_reversed' })
    expect(labelsOf(await read())).to.deep.eq(SeedLabels.filter((label) => label !== 'answer_reversed'))
    const rows = await tt.run(async (ctx) => await ctx.db.query('widgets').collect())
    const positions = rows.map((row) => row.position).toSorted((aa, bb) => aa - bb)
    expect(positions).to.deep.eq(SeedLabels.slice(1).map((_label, idx) => idx))
  })

  it("refuses to remove one a widgeting of the open quiz works, saying why", async () => {
    await expectRefused(await seed(classicHunt()), [{ kind: 'delete_widget', label: 'clueing_full' }, 'widgetInUse'])
  })

  it("refuses to remove one a widgeting works in a quiz of another hunt", async () => {
    const tt = openTester()
    const mine = await seed(bare(), tt)
    await seed(huntHolding([{ ...Quiz.blank('Theirs'), widgetings: [Widgeting.fill({ widget_label: 'answer_reversed', label: 'backward' })] }]), tt)
    await expectRefused(mine, [{ kind: 'delete_widget', label: 'answer_reversed' }, 'widgetInUse'])
  })

  it("removes it once no widgeting works it", async () => {
    const { act, actOnLibrary, read } = await seed(classicHunt())
    await act({ kind: 'delete_widgeting', label: 'clueing_full' })
    await actOnLibrary({ kind: 'delete_widget', label: 'clueing_full' })
    expect(labelsOf(await read())).to.not.include('clueing_full')
  })

  it("does nothing for a widget already gone", async () => {
    const seeded = await seed()
    const ante = await seeded.read()
    await seeded.actOnLibrary({ kind: 'delete_widget', label: 'absent' })
    expect(await seeded.read()).to.deep.eq(ante)
  })

})

describe("import_widgets", () => {
  it("adds a widget the library lacks at its end, and revises one it holds, removing none", async () => {
    const { actOnLibrary, read } = await seed()
    const ante = await read()
    const revised: WidgetT = { ...formulaOf(ante, 'answer_reversed'), title: 'Backward', description: 'Reversed.', formula: '"x"', input_formula: 'qn' }
    await actOnLibrary({ kind: 'import_widgets', widgets: [Shout, revised] })
    const after = await read()
    expect(labelsOf(after)).to.deep.eq([...SeedLabels, 'shout'])
    expect(widgetOf(after, 'answer_reversed')).to.deep.eq(revised)
    expect(widgetOf(after, 'shout')).to.deep.eq(Shout)
  })

  it("revises an aibot widget's config", async () => {
    const { actOnLibrary, read } = await seed()
    const held = widgetOf(await read(), 'dumdum')
    const revised = held.formulary === 'aibot' ? { ...held, config: { ...held.config, model_tier: 'careful' as const, max_tokens: 64 } } : held
    await actOnLibrary({ kind: 'import_widgets', widgets: [revised] })
    expect(widgetOf(await read(), 'dumdum')).to.deep.eq(revised)
  })

  it("passes over a widget whose formulary differs from the one held, rather than half-merging it", async () => {
    const { actOnLibrary, read } = await seed()
    const ante = await read()
    const changed = Widget.fill({ label: 'dumdum', formulary: 'jsonata', formula: '"no bot"' })
    await actOnLibrary({ kind: 'import_widgets', widgets: [changed, Shout] })
    const after = await read()
    expect(widgetOf(after, 'dumdum')).to.deep.eq(widgetOf(ante, 'dumdum'))
    expect(labelsOf(after).at(-1)).to.eq('shout')
  })

  it("leaves the library as it was for an import of what it already holds", async () => {
    const seeded = await seed()
    const ante = await seeded.read()
    await seeded.actOnLibrary({ kind: 'import_widgets', widgets: ante.library })
    expect(await seeded.read()).to.deep.eq(ante)
  })

  it("adds a label the import names twice once, never two widgets under one label", async () => {
    const { actOnLibrary, read } = await seed()
    await actOnLibrary({ kind: 'import_widgets', widgets: [Shout, { ...Shout, formula: '"again"' }] })
    const { library } = await read()
    expect(library.filter((widget) => widget.label === 'shout')).to.have.lengthOf(1)
  })


  it("refuses widgets that would pass what the library may hold, adding and revising nothing", async () => {
    const seeded = await seed()
    const room = PA.WidgetsInLibrary.max - SeedWidgets.length
    const widgets = Array.from({ length: room + 1 }, (_unused, idx) => ({ ...Shout, label: `shout_${String(idx)}` }))
    await expectRefused(seeded, [{ kind: 'import_widgets', widgets: [{ ...formulaOf(await seeded.read(), 'answer_reversed'), formula: '"x"' }, ...widgets] }, 'libraryFull'])
  })
})
