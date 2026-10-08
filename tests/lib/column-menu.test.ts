import { describe, expect, it } from 'vitest'
import * as ColumnMenu from '../../src/lib/column-menu'
import { resolve } from '../../src/lib/columns'
import { Widget, type WidgetT } from '../../src/models/widget'
import { Widgeting } from '../../src/models/widgeting'
import { present } from '../support/present'

const categoryData = Widgeting.fill({ label: 'category_data', widget_label: 'estimating' })
const dumdum = Widgeting.fill({ label: 'dumdum', widget_label: 'guesser' })
const playtesters = Widgeting.fill({ label: 'playtesters', widget_label: 'jottings', tier: 'quiz' })
const estimating = Widget.fill({ label: 'estimating', formulary: 'entry', config: { entry_kind: 'estimates' } })
const guesser = Widget.fill({ label: 'guesser', formulary: 'jsonata', formula: '$.title' })
const library = [estimating, guesser]

/** What the ref `source` picks, among the widgetings above, as presets are offered for it */
function subjectFor(source: string, known: readonly WidgetT[] = library): ColumnMenu.PresetSubject {
  const shown = present(resolve(source, [categoryData, dumdum]))
  return ColumnMenu.subjectOf(shown, known)
}

/** The formulas offered beside the ref `source` */
function formulasFor(source: string): string[] {
  return ColumnMenu.presetsFor(subjectFor(source)).map(({ formula }) => formula)
}

/** A source offering what the hunt's fields already offer, a second time */
const twice: ColumnMenu.PresetSource = () => [{ formula: '$.label', title: 'again' }]

describe('refChoicesOf', () => {
  const choices = ColumnMenu.refChoicesOf({ widgetings: [categoryData, dumdum, playtesters] })
  const sources = choices.map(({ source }) => source)

  it("lists every word of the bag a ref may name, the question's own first and the words the same in every row last", () => {
    expect(sources.slice(0, 2)).to.deep.eq(['title', 'clueing'])
    expect(sources.slice(-5)).to.deep.eq(['quiz', 'hunt', 'realm', 'categories', 'qns'])
    expect(sources).to.include.members(['butnot', 'label', 'rank', 'archived', 'secondary'])
  })

  it('lists each widgeting for each question by its label, and each for the whole quiz as quiz.<label>', () => {
    expect(choices.filter(({ group }) => group === ColumnMenu.RefGroups.widgeting).map(({ source }) => source)).to.deep.eq(['category_data', 'dumdum'])
    expect(choices.filter(({ group }) => group === ColumnMenu.RefGroups.quizWide).map(({ source }) => source)).to.deep.eq(['quiz.playtesters'])
  })

  it('lists each once, and offers no parts: those are formulas now', () => {
    expect(new Set(sources).size).to.eq(sources.length)
    expect(sources.some((source) => source.includes('$'))).to.be.false
  })

  it('lists no widgetings for a quiz that has none', () => {
    expect(ColumnMenu.refChoicesOf({ widgetings: [] }).some(({ group }) => group === ColumnMenu.RefGroups.widgeting)).to.be.false
  })
})

describe('presetsFor and subjectOf', () => {
  it("offers a category-estimate entry's parts, each by the formula picking it", () => {
    expect(formulasFor('category_data')).to.deep.eq(['$.estimates', '$.masie', '$.artie', '$.poppy', '$.average'])
    const masie = ColumnMenu.presetsFor(subjectFor('category_data'))[1]
    expect(masie).to.deep.eq({ formula: '$.masie', title: 'Masie' })
  })

  it('offers the field names of a word whose schema is known: the quiz, the hunt, the realm, each category, each question', () => {
    expect(formulasFor('quiz')).to.include.members(['$.label', '$.title', '$.smiths_note'])
    expect(formulasFor('hunt')).to.deep.eq(['$.label', '$.title'])
    expect(formulasFor('realm')).to.deep.eq(['$.label', '$.title'])
    expect(formulasFor('categories')).to.deep.eq(['$.label', '$.title'])
    expect(formulasFor('qns')).to.include.members(['$.title', '$.clueing', '$.rank', '$.archived'])
  })

  it("titles a field name by whose it is", () => {
    const [first] = ColumnMenu.presetsFor(ColumnMenu.subjectOf({ kind: 'word', word: 'categories' }, []))
    expect(first).to.deep.eq({ formula: '$.label', title: "Each category's label" })
  })

  it("offers nothing where no schema is known: a field's text, a formula's result, a widget the library lacks", () => {
    expect(formulasFor('clueing')).to.deep.eq([])
    expect(formulasFor('dumdum')).to.deep.eq([])
    expect(ColumnMenu.presetsFor(subjectFor('category_data', []))).to.deep.eq([])
  })

  it("finds the library's widget for a widgeting, and none for anything else", () => {
    expect(subjectFor('category_data').widget).to.eq(estimating)
    expect(ColumnMenu.subjectOf({ kind: 'field', field: 'clueing' }, library).widget).to.be.null
  })

  it('offers each formula once, though two sources offer it', () => {
    const hunt: ColumnMenu.PresetSubject = { shown: { kind: 'word', word: 'hunt' }, widget: null }
    const offered = [...ColumnMenu.PresetSources, twice].flatMap((source) => source(hunt))
    const labels = (presets: readonly ColumnMenu.FormulaPreset[]) => presets.filter(({ formula }) => formula === '$.label')
    expect(labels(offered)).to.have.lengthOf(2)
    expect(labels(ColumnMenu.presetsFor(hunt))).to.have.lengthOf(1)
  })
})
