import { describe, expect, it } from 'vitest'
import { beforeOctoberOf, categoryDataLabelsFor, categoryDataOf, plainOf, relabelledSource, templateableFrom } from '../../src/models/before-october'

describe('categoryDataOf', () => {
  const Cases: [string, string | null, string][] = [
    // the doc examples:
    ['categories',    'category_data',    'the seeded entry, and the widgeting first named after it'],
    ['categories_2',  'category_data_2',  'a second widgeting of it'],
    ['dumdum',        null,               'any other label, unchanged'],
    // the rest:
    ['categories_12', 'category_data_12', 'a twelfth'],
    ['categories_0',  null,               'a numbering no widgeting was given'],
    ['categories_x',  null,               'a label that only begins alike'],
    ['category_data', null,               'the label it goes by now'],
  ]
  for (const [label, expected, describes] of Cases) {
    it(`reads ${describes}`, () => {
      expect(categoryDataOf(label)).to.eq(expected)
    })
  }
})

describe('categoryDataLabelsFor', () => {
  it('relabels each widgeting `categoryDataOf` does, under its label there where it is free', () => {
    expect([...categoryDataLabelsFor(['categories', 'dumdum', 'categories_2'])]).to.deep.eq([['categories', 'category_data'], ['categories_2', 'category_data_2']])
  })

  it('gives the first free label after it where the quiz holds that already, or another is to take it', () => {
    expect([...categoryDataLabelsFor(['categories', 'category_data'])]).to.deep.eq([['categories', 'category_data_2']])
    expect([...categoryDataLabelsFor(['categories', 'categories_2', 'category_data'])]).to.deep.eq([['categories', 'category_data_3'], ['categories_2', 'category_data_2']])
  })

  it('relabels nothing in a quiz with none of them', () => {
    expect(categoryDataLabelsFor(['dumdum', 'category_data']).size).to.eq(0)
  })
})

describe('relabelledSource', () => {
  const labelFor = new Map([['categories', 'category_data'], ['categories_2', 'category_data_2']])

  it('relabels the widgeting a source names, in either grammar and at either tier', () => {
    expect(relabelledSource('categories.masie', labelFor)).to.eq('category_data.masie')
    expect(relabelledSource('categories', labelFor)).to.eq('category_data')
    expect(relabelledSource('quiz.categories_2', new Map([['categories_2', 'category_data_2']]))).to.eq('quiz.category_data_2')
  })

  it('leaves any other source as it was', () => {
    expect(['question.title', 'dumdum', 'quiz.playtesters', 'categories_3'].map((source) => relabelledSource(source, labelFor))).to.deep.eq(['question.title', 'dumdum', 'quiz.playtesters', 'categories_3'])
  })
})

describe('beforeOctoberOf', () => {
  const Cases: [string, { source: string, formula: string | null } | null, string][] = [
    // the doc examples:
    ['question.clueing',      { source: 'clueing', formula: null },          'a question field by its prefix'],
    ['categories.masie',      { source: 'categories', formula: '$.masie' },  "a part of a widgeting: one persona's chance"],
    ['dumdum',                null,                                         'a plain source, which is no source of that grammar'],
    // the rest:
    ['question.butnot',       { source: 'butnot', formula: null },           'a view of a question'],
    ['cats_2.estimates',      { source: 'cats_2', formula: '$.estimates' },  'a part of a widgeting: its list of estimates'],
    ['categories.average',    { source: 'categories', formula: '$.average' }, "a part of a widgeting: the personas' average"],
    ['question.butnot_ishes', null,                                         'the BUT NOT ishes as a view, which they no longer are'],
    ['question.nonsense',     null,                                         'a question field there is not'],
    ['question.rank',         null,                                         'a key of a question, which that grammar never named'],
    ['question.masie',        null,                                         'a part of the questions themselves'],
    ['categories.bogus',      null,                                         'a part no widgeting offers'],
    ['categories.masie.more', null,                                         'a part of a part'],
    ['quiz.playtesters',      null,                                         'a widgeting for the whole quiz, which is plain'],
    ['quiz.masie',            null,                                         'a widgeting for the whole quiz labelled as a part'],
    ['clueing',               null,                                         'a plain question field'],
  ]
  for (const [source, expected, describes] of Cases) {
    it(`reads ${describes}`, () => {
      expect(beforeOctoberOf(source)).to.deep.eq(expected)
    })
  }
})

describe('plainOf', () => {
  it('writes a column in the plain grammar, its formula kept', () => {
    expect(plainOf({ source: 'categories.average' })).to.deep.eq({ source: 'categories', formula: '$.average' })
    expect(plainOf({ source: 'question.title' })).to.deep.eq({ source: 'title' })
    expect(plainOf({ source: 'dumdum', formula: '$.value.guess' })).to.deep.eq({ source: 'dumdum', formula: '$.value.guess' })
  })
})

describe('templateableFrom', () => {
  it("reads a nomination in the grammar before October 2026 as it reads now: a field by its name, a widgeting's label as it is", () => {
    expect(templateableFrom(['question.clueing', 'author'])).to.deep.eq(['clueing', 'author'])
    expect(templateableFrom([])).to.deep.eq([])
  })
})
