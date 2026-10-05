import { describe, expect, it } from 'vitest'
import * as Z from 'zod'
import { Column, ColumnValidators, QuestionFieldVals, QuestionSourceTitles, QuestionViewVals, WidgetingPartTitles, WidgetingPartVals, columnLabelOf, namesFor, sortkeyOf, sourceOf, widgetingLabelOf, widgetingSourceOf } from '../../src/models/column'

const base = { label: 'clueing', title: 'Clueing', source: 'question.clueing', width_px: 330 }

describe('Column.fill', () => {
  it('holds a label, a title, what it shows and how wide it is', () => {
    expect(Column.fill(base)).to.deep.eq(base)
  })

  const Sources: [string, boolean, string][] = [
    ['question.title',        true,  'a question field'],
    ['question.full_answer',  true,  'a question field with an underscore'],
    ['question.butnot',       true,  'a view of a question'],
    ['question.butnot_ishes', false, 'the BUT NOT ishes as a view, which they no longer are'],
    ['butnot_ishes',          true,  'the BUT NOT ishes as the widgeting they now are'],
    ['dumdum',                true,  'a widgeting by its label'],
    ['clueing_plus_rank',     true,  'a widgeting with underscores'],
    ['question.nonsense',     false, 'a question field there is not'],
    ['question.',             false, 'a question with no field'],
    ['question',              false, 'the questions\' own source name, which has no value of its own'],
    ['Dumdum',                false, 'a label that is not one'],
    ['',                      false, 'nothing at all'],
    ['dumdum.value',          false, 'a field of a widgeting, which a column cannot name'],
    ['categories.masie',      true,  "a part of a widgeting: one persona's chance"],
    ['categories.estimates',  true,  'a part of a widgeting: its list of estimates'],
    ['categories.average',    true,  'a part of a widgeting: the personas\' average'],
    ['categories.bogus',      false, 'a part no widgeting offers'],
    ['categories.masie.more', false, 'a part of a part'],
    ['question.masie',        false, 'a part of the questions themselves'],
    ['.masie',                false, 'a part of no widgeting'],
    ['a'.repeat(41),          false, 'a widgeting by a label longer than any label may be'],
    [`${'a'.repeat(41)}.masie`, false, 'a part of a widgeting whose label is longer than any may be'],
    ['dum__dum',              false, 'a widgeting by a label with two underscores in a row'],
    ['dumdum_',               false, 'a widgeting by a label ending in an underscore'],
  ]
  for (const [source, ok, describes] of Sources) {
    it(`${ok ? 'takes' : 'refuses'} ${describes}`, () => {
      expect(ColumnValidators.column.safeParse({ ...base, source }).success).to.eq(ok)
    })
  }

  const Widths: [number, boolean][] = [[29, false], [30, true], [800, true], [801, false], [78.5, false]]
  for (const [width_px, ok] of Widths) {
    it(`${ok ? 'takes' : 'refuses'} a width of ${String(width_px)}px`, () => {
      expect(ColumnValidators.column.safeParse({ ...base, width_px }).success).to.eq(ok)
    })
  }

  it('refuses a title past 82 characters', () => {
    expect(() => Column.fill({ ...base, title: 'x'.repeat(83) })).to.throw(Z.ZodError)
  })

  const Aligns: [unknown, boolean, string][] = [
    ['left',    true,  'aligned left'],
    ['center',  true,  'centered'],
    ['right',   true,  'aligned right'],
    ['justify', false, 'justified, which a grid cell is never'],
    ['',        false, 'aligned nowhere'],
    [null,      false, 'an alignment of null, where absent is meant'],
  ]
  for (const [align, ok, describes] of Aligns) {
    it(`${ok ? 'takes' : 'refuses'} a column ${describes}`, () => {
      expect(ColumnValidators.column.safeParse({ ...base, align }).success).to.eq(ok)
    })
  }

  it('leaves an alignment never given absent, rather than filling one in', () => {
    expect(Column.fill(base)).to.not.have.property('align')
  })
})

describe('ColumnValidators.columnPatch', () => {
  it('leaves absent keys absent', () => {
    expect(ColumnValidators.columnPatch({ title: 'Renamed' })).to.deep.eq({ title: 'Renamed' })
  })

  it('takes an alignment alone', () => {
    expect(ColumnValidators.columnPatch({ align: 'center' })).to.deep.eq({ align: 'center' })
  })
})

describe('sourceOf', () => {
  it('reads a question field, a view, and a widgeting', () => {
    expect(sourceOf('question.clueing')).to.deep.eq({ kind: 'field', field: 'clueing' })
    expect(sourceOf('question.butnot')).to.deep.eq({ kind: 'view', view: 'butnot' })
    expect(sourceOf('dumdum')).to.deep.eq({ kind: 'widgeting', label: 'dumdum', part: null })
    expect(sourceOf('butnot_ishes')).to.deep.eq({ kind: 'widgeting', label: 'butnot_ishes', part: null })
  })

  it('reads one part of a widgeting', () => {
    expect(sourceOf('categories.masie')).to.deep.eq({ kind: 'widgeting', label: 'categories', part: 'masie' })
    expect(sourceOf('cats_2.estimates')).to.deep.eq({ kind: 'widgeting', label: 'cats_2', part: 'estimates' })
  })
})

describe('widgetingSourceOf and widgetingLabelOf', () => {
  it('write the source of a widgeting, whole or one part of it', () => {
    expect([widgetingSourceOf('categories', null), widgetingSourceOf('categories', 'poppy')]).to.deep.eq(['categories', 'categories.poppy'])
  })

  it("read the widgeting's label back out of either, and nothing out of a question's own field or view", () => {
    const sources = ['categories', 'categories.average', 'question.title', 'question.butnot']
    expect(sources.map((source) => widgetingLabelOf(source))).to.deep.eq(['categories', 'categories', null, null])
  })

  it('write every part as a column takes it', () => {
    expect(WidgetingPartVals.every((part) => ColumnValidators.column.safeParse({ ...base, source: widgetingSourceOf('cats', part) }).success)).to.be.true
  })
})

describe('namesFor', () => {
  const NamesCases: [string, { label: string, title: string }, string][] = [
    // the doc examples:
    ["question.chains_to", { label: "chains_to",    title: "Chains to" },    'a question field, under its own name and usual header'],
    ["clueing_full",       { label: "clueing_full", title: "Clueing Full" }, 'a widgeting, under its label titleized'],
    // the rest:
    ["question.hint",      { label: "hint",         title: "Hint" },         'the hint, opted into on a lean quiz'],
    ["question.alt_text",  { label: "alt_text",     title: "Alt Text" },     'the alt text, its header as the grid always had it'],
    ["question.butnot",    { label: "butnot",       title: "BUT NOT" },      'the view of the chained-to hint, in capitals as always'],
    ["categories.masie",   { label: "categories_masie", title: "Masie" },    "a part of a widgeting, under both their names and headed by the part's"],
    ["cats.average",       { label: "cats_average", title: "Average" },      "the personas' average"],
  ]
  for (const [source, expected, describes] of NamesCases) {
    it(`names ${describes}`, () => {
      expect(namesFor(source)).to.deep.eq(expected)
    })
  }

  it("titles every part of a widgeting", () => {
    expect(Object.keys(WidgetingPartTitles)).to.have.members([...WidgetingPartVals])
  })

  it("titles every question field and view", () => {
    expect(Object.keys(QuestionSourceTitles)).to.have.members([...QuestionFieldVals, ...QuestionViewVals])
    expect(Object.keys(QuestionSourceTitles)).to.have.lengthOf(QuestionFieldVals.length + QuestionViewVals.length)
  })
})

describe('sortkeyOf and columnLabelOf', () => {
  it('make and read a sort memory for a column', () => {
    expect(sortkeyOf({ label: 'clueing_full' })).to.eq('column:clueing_full')
    expect(columnLabelOf('column:clueing_full')).to.eq('clueing_full')
  })

  it('read the chain order, and anything else, as no column at all', () => {
    expect(['chain_order', 'qnum', ''].map((sortkey) => columnLabelOf(sortkey))).to.deep.eq([null, null, null])
  })
})

describe('ColumnValidators.row', () => {
  const Row = { hunt_id: '01a0dc10-c9be-7cb3-9d3a-25fc68cd12f8', quiz_id: '01a0dc10-c9be-7cb3-9d3a-25fc68cd12f9', label: 'clueing', title: 'Clueing', source: 'question.clueing', width_px: 330, position: 0 }

  it('takes a column as the database holds it', () => {
    expect(ColumnValidators.row(Row)).to.deep.eq(Row)
  })

  it('takes a column with an alignment, and one without', () => {
    expect(ColumnValidators.row({ ...Row, align: 'right' })).to.deep.eq({ ...Row, align: 'right' })
    expect(ColumnValidators.row(Row)).to.not.have.property('align')
  })

  const Refused: [object, string][] = [
    [{ quiz_id: 'clueing' },         'a quiz that is not a row id'],
    [{ hunt_id: undefined },         'no hunt'],
    [{ width_px: 29 },               'a width narrower than any column may be'],
    [{ source: 'question' },         'the questions\' own widget, which has no value'],
    [{ position: -1 },               'a place before the first'],
    [{ position: 100 },              'a place past as many columns as a quiz may hold'],
    [{ align: 'middle' },            'an alignment there is not'],
  ]
  for (const [overrides, describes] of Refused) {
    it(`refuses ${describes}`, () => {
      expect(() => ColumnValidators.row({ ...Row, ...overrides })).to.throw(Z.ZodError)
    })
  }
})
