import { describe, expect, it } from 'vitest'
import * as Z from 'zod'
import { BagWordVals, Column, ColumnValidators, QuestionFieldVals, QuestionKeyVals, QuestionViewVals, RefTitles, WidgetingPartTitles, WidgetingPartVals, beforeOctoberOf, columnLabelOf, namesFor, partFormulaOf, partOf, plainOf, refOf, sortkeyOf, widgetingLabelOf, widgetingSourceOf } from '../../src/models/column'

const base = { label: 'clueing', title: 'Clueing', source: 'clueing', width_px: 330 }

describe('Column.fill', () => {
  it('holds a label, a title, what it shows and how wide it is', () => {
    expect(Column.fill(base)).to.deep.eq(base)
  })

  const Sources: [string, boolean, string][] = [
    ['title',                 true,  'a question field'],
    ['full_answer',           true,  'a question field with an underscore'],
    ['recap',                 true,  "a question's recap, which the recap note sets below its answer"],
    ['butnot',                true,  'a view of a question'],
    ['rank',                  true,  'a key a question has in the bag'],
    ['label',                 true,  "a question's label"],
    ['quiz',                  true,  'the quiz, a word at the bag\'s top level'],
    ['categories',            true,  "the hunt's categories"],
    ['qns',                   true,  'every question'],
    ['qn',                    false, 'the question itself, which is no ref'],
    ['quiz.playtesters',      true,  'a widgeting run once for the whole quiz'],
    ['quiz.Playtesters',      false, 'a widgeting for the whole quiz by a label that is not one'],
    ['quiz.playtesters.value', false, 'a field of a widgeting for the whole quiz'],
    ['butnot_ishes',          true,  'the BUT NOT ishes as the widgeting they now are'],
    ['dumdum',                true,  'a widgeting by its label'],
    ['clueing_plus_rank',     true,  'a widgeting with underscores'],
    ['Dumdum',                false, 'a label that is not one'],
    ['',                      false, 'nothing at all'],
    ['dumdum.value',          false, 'a field of a widgeting, which a column cannot name'],
    ['a'.repeat(41),          false, 'a widgeting by a label longer than any label may be'],
    ['dum__dum',              false, 'a widgeting by a label with two underscores in a row'],
    ['dumdum_',               false, 'a widgeting by a label ending in an underscore'],
    // The grammar before October 2026, still read:
    ['question.title',        true,  'a question field, before October 2026'],
    ['question.butnot',       true,  'a view of a question, before October 2026'],
    ['question.butnot_ishes', false, 'the BUT NOT ishes as a view, which they no longer are'],
    ['question.nonsense',     false, 'a question field there is not'],
    ['question.',             false, 'a question with no field'],
    ['question',              false, 'the questions\' own source name, which has no value of its own'],
    ['question.rank',         false, 'a key of a question, which the old grammar never named'],
    ['categories.masie',      true,  "a part of a widgeting: one persona's chance"],
    ['categories.estimates',  true,  'a part of a widgeting: its list of estimates'],
    ['categories.average',    true,  'a part of a widgeting: the personas\' average'],
    ['categories.bogus',      false, 'a part no widgeting offers'],
    ['categories.masie.more', false, 'a part of a part'],
    ['question.masie',        false, 'a part of the questions themselves'],
    ['.masie',                false, 'a part of no widgeting'],
    [`${'a'.repeat(41)}.masie`, false, 'a part of a widgeting whose label is longer than any may be'],
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

  it('takes a formula, a template, a readout and a collapse, each optional and absent unless given', () => {
    const full = { ...base, source: 'category_data', formula: '$.masie', template: '{{ value }}%', readout: 'markdown', collapsed: true } as const
    expect(Column.fill(full)).to.deep.eq(full)
    expect(Column.fill(base)).to.not.have.any.keys('formula', 'template', 'readout', 'collapsed')
  })

  const Extras: [object, string][] = [
    [{ formula: '' },              'an empty formula, where absent is identity'],
    [{ formula: 'x'.repeat(1000) }, 'a formula past 999 characters'],
    [{ template: '' },             'an empty template'],
    [{ readout: 'html' },          'a readout there is not'],
    [{ collapsed: 'yes' },         'a collapse that is no yes-or-no'],
    [{ source: 'categories.masie', formula: '$.average' }, 'a formula beside a part, before October 2026, which already picks one'],
  ]
  for (const [overrides, describes] of Extras) {
    it(`refuses ${describes}`, () => {
      expect(ColumnValidators.column.safeParse({ ...base, ...overrides }).success).to.be.false
    })
  }
})

describe('ColumnValidators.columnPatch', () => {
  it('leaves absent keys absent', () => {
    expect(ColumnValidators.columnPatch({ title: 'Renamed' })).to.deep.eq({ title: 'Renamed' })
  })

  it('takes an alignment alone', () => {
    expect(ColumnValidators.columnPatch({ align: 'center' })).to.deep.eq({ align: 'center' })
  })

  it('takes a formula, a template and a readout of null, which take each off', () => {
    expect(ColumnValidators.columnPatch({ formula: null, template: null, readout: null })).to.deep.eq({ formula: null, template: null, readout: null })
  })
})

describe('refOf', () => {
  it('reads a question field, a view, a key, a word of the bag, and a widgeting at either tier', () => {
    expect(refOf('clueing')).to.deep.eq({ kind: 'field', field: 'clueing' })
    expect(refOf('butnot')).to.deep.eq({ kind: 'view', view: 'butnot' })
    expect(refOf('rank')).to.deep.eq({ kind: 'key', key: 'rank' })
    expect(refOf('categories')).to.deep.eq({ kind: 'word', word: 'categories' })
    expect(refOf('dumdum')).to.deep.eq({ kind: 'widgeting', label: 'dumdum', tier: 'question' })
    expect(refOf('quiz.playtesters')).to.deep.eq({ kind: 'widgeting', label: 'playtesters', tier: 'quiz' })
  })

  it('reads the grammar before October 2026 as it reads now, a part naming its widgeting', () => {
    expect(refOf('question.clueing')).to.deep.eq({ kind: 'field', field: 'clueing' })
    expect(refOf('question.butnot')).to.deep.eq({ kind: 'view', view: 'butnot' })
    expect(refOf('categories.masie')).to.deep.eq({ kind: 'widgeting', label: 'categories', tier: 'question' })
    expect(refOf('cats_2.estimates')).to.deep.eq({ kind: 'widgeting', label: 'cats_2', tier: 'question' })
  })
})

describe('beforeOctoberOf and plainOf', () => {
  it('read a source in the grammar before October 2026 as its plain ref and formula', () => {
    expect(beforeOctoberOf('question.clueing')).to.deep.eq({ source: 'clueing', formula: null })
    expect(beforeOctoberOf('categories.masie')).to.deep.eq({ source: 'categories', formula: '$.masie' })
  })

  it('read nothing out of a plain source', () => {
    expect(['dumdum', 'clueing', 'quiz.playtesters', 'quiz.masie', 'qns'].map((source) => beforeOctoberOf(source))).to.deep.eq([null, null, null, null, null])
  })

  it('write a column in the plain grammar, its formula kept', () => {
    expect(plainOf({ source: 'categories.average' })).to.deep.eq({ source: 'categories', formula: '$.average' })
    expect(plainOf({ source: 'question.title' })).to.deep.eq({ source: 'title' })
    expect(plainOf({ source: 'dumdum', formula: '$.value.guess' })).to.deep.eq({ source: 'dumdum', formula: '$.value.guess' })
  })
})

describe('partFormulaOf and partOf', () => {
  it('write the formula picking a part out of a category-estimate entry, and read it back', () => {
    expect(partFormulaOf('masie')).to.eq('$.masie')
    expect(WidgetingPartVals.map((part) => partOf(partFormulaOf(part)))).to.deep.eq([...WidgetingPartVals])
  })

  it('read no part out of any other formula, or none', () => {
    expect([partOf('$.average * 100'), partOf('$.value'), partOf(null), partOf(undefined)]).to.deep.eq([null, null, null, null])
  })
})

describe('widgetingSourceOf and widgetingLabelOf', () => {
  it('write the source of a widgeting, run for each question or for the whole quiz', () => {
    expect([widgetingSourceOf('dumdum', 'question'), widgetingSourceOf('playtesters', 'quiz')]).to.deep.eq(['dumdum', 'quiz.playtesters'])
  })

  it("read the widgeting's label back out of either grammar, and nothing out of a question's own field, view or key, or a word", () => {
    const sources = ['category_data', 'categories.average', 'quiz.playtesters', 'title', 'question.title', 'question.butnot', 'rank', 'categories']
    expect(sources.map((source) => widgetingLabelOf(source))).to.deep.eq(['category_data', 'categories', 'playtesters', null, null, null, null, null])
  })

  it('take every part as a column did before October 2026', () => {
    expect(WidgetingPartVals.every((part) => ColumnValidators.column.safeParse({ ...base, source: `cats.${part}` }).success)).to.be.true
  })
})

describe('namesFor', () => {
  const NamesCases: [string, string | null, { label: string, title: string }, string][] = [
    // the doc examples:
    ['chains_to',         null,      { label: 'chains_to',           title: 'Chains to' },    'a question field, under its own name and usual header'],
    ['clueing_full',      null,      { label: 'clueing_full',        title: 'Clueing Full' }, 'a widgeting, under its label titleized'],
    ['category_data',     '$.masie', { label: 'category_data_masie', title: 'Masie' },        "a part of a widgeting, under both their names and headed by the part's"],
    ['quiz.playtesters',  null,      { label: 'playtesters',         title: 'Playtesters' },  'a widgeting for the whole quiz, under its label'],
    // the rest:
    ['hint',              null,      { label: 'hint',                title: 'Hint' },         'the hint, opted into on a lean quiz'],
    ['alt_text',          null,      { label: 'alt_text',            title: 'Alt Text' },     'the alt text, its header as the grid always had it'],
    ['butnot',            null,      { label: 'butnot',              title: 'BUT NOT' },      'the view of the chained-to hint, in capitals as always'],
    ['rank',              null,      { label: 'rank',                title: 'Rank' },         'a key of the question'],
    ['qns',               null,      { label: 'qns',                 title: 'Questions' },    'a word of the bag'],
    ['cats',              '$.average', { label: 'cats_average',      title: 'Average' },      "the personas' average"],
    ['cats',              '$.value',  { label: 'cats',               title: 'Cats' },         'a widgeting worked by a formula that picks no part'],
    ['question.recap',    null,      { label: 'recap',               title: 'Recap' },        'a question field, before October 2026'],
    ['categories.masie',  null,      { label: 'categories_masie',    title: 'Masie' },        'a part of a widgeting, before October 2026'],
  ]
  for (const [source, formula, expected, describes] of NamesCases) {
    it(`names ${describes}`, () => {
      expect(namesFor(source, formula)).to.deep.eq(expected)
    })
  }

  it("titles every part of a widgeting", () => {
    expect(Object.keys(WidgetingPartTitles)).to.have.members([...WidgetingPartVals])
  })

  it("titles every question field, view and key, and every word", () => {
    expect(Object.keys(RefTitles)).to.have.members([...QuestionFieldVals, ...QuestionViewVals, ...QuestionKeyVals, ...BagWordVals])
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
  const Row = { hunt_id: '01a0dc10-c9be-7cb3-9d3a-25fc68cd12f8', quiz_id: '01a0dc10-c9be-7cb3-9d3a-25fc68cd12f9', label: 'clueing', title: 'Clueing', source: 'clueing', width_px: 330, position: 0 }

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
