import { describe, expect, it } from 'vitest'
import * as Z from 'zod'
import { Column, ColumnValidators, columnLabelOf, sortkeyOf, sourceOf } from '../../src/models/column'

const base = { label: 'clueing', title: 'Clueing', source: 'question.clueing', width_px: 330 }

describe('Column.fill', () => {
  it('holds a label, a title, what it shows and how wide it is', () => {
    expect(Column.fill(base)).to.deep.eq(base)
  })

  const Sources: [string, boolean, string][] = [
    ['question.title',        true,  'a question field'],
    ['question.full_answer',  true,  'a question field with an underscore'],
    ['question.butnot',       true,  'a view of a question'],
    ['question.butnot_ishes', true,  'the other view'],
    ['dumdum',                true,  'a widget by its label'],
    ['clueing_plus_rank',     true,  'a widget with underscores'],
    ['question.nonsense',     false, 'a question field there is not'],
    ['question.',             false, 'a question with no field'],
    ['question',              false, 'the questions\' own widget, which has no value of its own'],
    ['Dumdum',                false, 'a label that is not one'],
    ['',                      false, 'nothing at all'],
    ['dumdum.text',           false, 'a field of some other widget, which a column cannot name'],
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
})

describe('ColumnValidators.columnPatch', () => {
  it('leaves absent keys absent', () => {
    expect(ColumnValidators.columnPatch({ title: 'Renamed' })).to.deep.eq({ title: 'Renamed' })
  })
})

describe('sourceOf', () => {
  it('reads a question field, a view, and a widget', () => {
    expect(sourceOf('question.clueing')).to.deep.eq({ kind: 'field', field: 'clueing' })
    expect(sourceOf('question.butnot')).to.deep.eq({ kind: 'view', view: 'butnot' })
    expect(sourceOf('dumdum')).to.deep.eq({ kind: 'widget', label: 'dumdum' })
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
