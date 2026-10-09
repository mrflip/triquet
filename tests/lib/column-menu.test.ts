import { describe, expect, it } from 'vitest'
import * as ColumnMenu from '../../src/lib/column-menu'
import { resolve } from '../../src/lib/columns'
import { SeedPresets, SeedWidgets } from '../../src/models/seeds'
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
  it("offers a category-estimate entry's parts, each by the formula picking it, naming a column taking one after both", () => {
    expect(formulasFor('category_data')).to.deep.eq(['$.estimates', '$.masie', '$.artie', '$.poppy', '$.average'])
    const masie = ColumnMenu.presetsFor(subjectFor('category_data'))[1]
    expect(masie).to.deep.eq({ formula: '$.masie', title: 'Masie', names: { label: 'category_data_masie', title: 'Masie' } })
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

describe("the seeds' presets", () => {
  /** Widgetings of three seeds, the hint's number spotter under a label of its own */
  const spotters = [Widgeting.fill({ label: 'numnum_clueing', widget_label: 'numnum_clueing' }), Widgeting.fill({ label: 'hint_ishes', widget_label: 'numnum_hint' }), Widgeting.fill({ label: 'dumdum', widget_label: 'dumdum' })]

  /** What the ref `source` picks among the spotters above, with `known` for the library */
  function seededSubject(source: string, known: readonly WidgetT[] = SeedWidgets): ColumnMenu.PresetSubject {
    return ColumnMenu.subjectOf(present(resolve(source, spotters)), known)
  }

  /** What the seeds offer beside the ref `source`, among the spotters above, with the seeded library */
  function seededFor(source: string, known: readonly WidgetT[] = SeedWidgets): ColumnMenu.FormulaPreset[] {
    return ColumnMenu.presetsFor(seededSubject(source, known))
  }

  it("offers a number spotter's two sums, by its widget, whatever the widgeting is called", () => {
    expect(seededFor('numnum_clueing')).to.deep.eq(SeedPresets.get('numnum_clueing'))
    expect(seededFor('hint_ishes')).to.deep.eq(SeedPresets.get('numnum_hint'))
  })

  it('offers nothing beside a seeded widget no preset reshapes, nor beside a spotter the library lacks', () => {
    expect(seededFor('dumdum')).to.deep.eq([])
    expect(seededFor('numnum_clueing', [])).to.deep.eq([])
  })

  it("names a column taking a sum as the classic sum column, and any other column as namesFor does", () => {
    const offered = seededFor('hint_ishes')
    const [full, numeral] = offered.map(({ formula }) => formula)
    expect(ColumnMenu.namesOf('hint_ishes', present(full), offered)).to.deep.eq({ label: 'hint_full', title: 'Hint Full Sum' })
    expect(ColumnMenu.namesOf('hint_ishes', present(numeral), offered)).to.deep.eq({ label: 'hint_numeral', title: 'Hint Numeral Sum' })
    expect(ColumnMenu.namesOf('hint_ishes', '$.value.items', offered)).to.deep.eq({ label: 'hint_ishes', title: 'Hint Ishes' })
    expect(ColumnMenu.namesOf('hint_ishes', null, offered)).to.deep.eq({ label: 'hint_ishes', title: 'Hint Ishes' })
    const parts = ColumnMenu.presetsFor(subjectFor('category_data'))
    expect(ColumnMenu.namesOf('category_data', '$.masie', parts)).to.deep.eq({ label: 'category_data_masie', title: 'Masie' })
  })

  it('names a column of the quiz for what it shows, through the presets offered beside its ref', () => {
    const named = ColumnMenu.namerOf({ widgetings: spotters }, SeedWidgets)
    const [full] = seededFor('numnum_clueing').map(({ formula }) => formula)
    expect(named('numnum_clueing', present(full))).to.deep.eq({ label: 'clueing_full', title: 'Clueing Full Sum' })
    expect(named('numnum_clueing', null)).to.deep.eq({ label: 'numnum_clueing', title: 'Numnum Clueing' })
    expect(named('notes', '$uppercase($)')).to.deep.eq({ label: 'notes', title: 'Notes' })
  })
})
