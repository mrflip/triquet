import { describe, expect, it } from 'vitest'
import * as Z from 'zod'
import { BagWordVals, Column, ColumnValidators, QuestionFieldVals, QuestionKeyVals, QuestionViewVals, RefTitles, columnLabelOf, namesFor, refOf, retitledPatch, sortkeyOf, widgetingLabelOf, widgetingSourceOf, type ColumnPatch, type ColumnT } from '../../src/models/column'

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
    ['questions',                   true,  'every question'],
    ['question',                    false, 'the question itself, which is no ref'],
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
    ['question',              false, 'the questions themselves, which is no ref'],
    // The grammar before October 2026, which only the importer reads (`before-october.ts`):
    ['question.title',        false, 'a question field, before October 2026'],
    ['question.butnot',       false, 'a view of a question, before October 2026'],
    ['categories.masie',      false, "a part of a widgeting, before October 2026: one persona's chance"],
    ['category_data.average', false, 'a part of a widgeting, before October 2026, under its label now'],
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

  it('takes a formula, a template, a readout and a collapse of null, which take each off', () => {
    expect(ColumnValidators.columnPatch({ formula: null, template: null, readout: null, collapsed: null })).to.deep.eq({ formula: null, template: null, readout: null, collapsed: null })
  })

  it('takes a collapse, the double-click on the head', () => {
    expect(ColumnValidators.columnPatch({ collapsed: true })).to.deep.eq({ collapsed: true })
  })
})

describe('ColumnValidators.ref', () => {
  const Cases: [string, boolean, string][] = [
    ["clueing",           true,  'a question\'s field'],
    ["butnot",            true,  'the view butnot'],
    ["rank",              true,  'a key a question has'],
    ["dumdum",            true,  'a widgeting\'s label'],
    ["questions",               true,  'a word of the bag'],
    ["quiz.playtesters",  true,  'a widgeting for the whole quiz'],
    ["question.clueing",  false, 'a field in the grammar before October 2026'],
    ["category_data.masie", false, 'a part in the grammar before October 2026'],
    ["Not a ref",         false, 'something that names nothing'],
    ["",                  false, 'nothing at all'],
  ]
  for (const [ref, passes, describes] of Cases) {
    it(`${passes ? 'takes' : 'refuses'} ${describes}`, () => {
      expect(ColumnValidators.ref.safeParse(ref).success).to.eq(passes)
    })
  }
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

  it('reads a source that names nothing as the title', () => {
    expect(refOf('question.clueing')).to.deep.eq({ kind: 'field', field: 'title' })
  })
})

describe('widgetingSourceOf and widgetingLabelOf', () => {
  it('write the source of a widgeting, run for each question or for the whole quiz', () => {
    expect([widgetingSourceOf('dumdum', 'question'), widgetingSourceOf('playtesters', 'quiz')]).to.deep.eq(['dumdum', 'quiz.playtesters'])
  })

  it("read the widgeting's label back, and nothing out of a question's own field, view or key, or a word", () => {
    const sources = ['category_data', 'quiz.playtesters', 'title', 'butnot', 'rank', 'categories']
    expect(sources.map((source) => widgetingLabelOf(source))).to.deep.eq(['category_data', 'playtesters', null, null, null, null])
  })
})

/** A namer knowing two presets' names, `$.sum` heading its column *Summed* and `$.masie` *Masie*, and naming the rest as `namesFor` does */
function namedWithSum(source: string, formula: string | null): { label: string, title: string } {
  if (formula === '$.sum') { return { label: 'summed', title: 'Summed' } }
  if (formula === '$.masie') { return { label: `${source}_masie`, title: 'Masie' } }
  return namesFor(source)
}

describe('retitledPatch', () => {
  const RetitledCases: [Pick<ColumnT, 'title' | 'source' | 'formula'>, ColumnPatch, ColumnPatch, string][] = [
    // the doc examples:
    [{ title: 'Notes',         source: 'notes' },          { source: 'hint' },     { source: 'hint', title: 'Hint' },      'what it shows changed: headed after the new'],
    [{ title: 'Remarks',       source: 'notes' },          { source: 'hint' },     { source: 'hint' },                     'headed otherwise by the author: left as it is'],
    // the rest:
    [{ title: 'Category Data', source: 'category_data' },  { formula: '$.masie' }, { formula: '$.masie' },                 'a part picked, which `namesFor` does not name: the header stays'],
    [{ title: 'Notes',         source: 'notes' },          { formula: '$uppercase($)' }, { formula: '$uppercase($)' },    'a formula: the header stays'],
    [{ title: 'Notes',         source: 'notes' },          { source: 'hint', title: 'Mine' }, { source: 'hint', title: 'Mine' }, 'a patch heading it itself'],
    [{ title: 'Notes',         source: 'notes' },          { width_px: 90 },       { width_px: 90 },                       'a patch that changes neither'],
  ]
  it.each(RetitledCases)('%j patched %j => %j: %s', (column, patch, expected) => {
    expect(retitledPatch(column, patch)).to.deep.eq(expected)
  })

  it('heads a column by the namer it is given, so a preset carrying names is followed to them and back', () => {
    const column = { title: 'Numnum Hint', source: 'numnum_hint' }
    expect(retitledPatch(column, { formula: '$.sum' }, namedWithSum)).to.deep.eq({ formula: '$.sum', title: 'Summed' })
    expect(retitledPatch({ ...column, title: 'Summed', formula: '$.sum' }, { formula: null }, namedWithSum)).to.deep.eq({ formula: null, title: 'Numnum Hint' })
    expect(retitledPatch({ ...column, title: 'Summed', formula: '$.sum' }, { formula: null })).to.deep.eq({ formula: null })
  })

  it('heads a column taking a part after the part, and after the whole once the formula is taken off, by a namer knowing the parts', () => {
    expect(retitledPatch({ title: 'Category Data', source: 'category_data' }, { formula: '$.masie' }, namedWithSum)).to.deep.eq({ formula: '$.masie', title: 'Masie' })
    expect(retitledPatch({ title: 'Masie', source: 'category_data', formula: '$.masie' }, { formula: null }, namedWithSum)).to.deep.eq({ formula: null, title: 'Category Data' })
  })
})

describe('namesFor', () => {
  const NamesCases: [string, { label: string, title: string }, string][] = [
    // the doc examples:
    ['chains_to',         { label: 'chains_to',           title: 'Chains to' },    'a question field, under its own name and usual header'],
    ['clueing_full',      { label: 'clueing_full',        title: 'Clueing Full' }, 'a widgeting, under its label titleized'],
    ['quiz.playtesters',  { label: 'playtesters',         title: 'Playtesters' },  'a widgeting for the whole quiz, under its label'],
    // the rest:
    ['hint',              { label: 'hint',                title: 'Hint' },         'the hint, opted into on a lean quiz'],
    ['alt_text',          { label: 'alt_text',            title: 'Alt Text' },     'the alt text, its header as the grid always had it'],
    ['butnot',            { label: 'butnot',              title: 'BUT NOT' },      'the view of the chained-to hint, in capitals as always'],
    ['rank',              { label: 'rank',                title: 'Rank' },         'a key of the question'],
    ['questions',         { label: 'questions',           title: 'Questions' },    'a word of the bag'],
  ]
  for (const [source, expected, describes] of NamesCases) {
    it(`names ${describes}`, () => {
      expect(namesFor(source)).to.deep.eq(expected)
    })
  }

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
