import { describe, expect, it } from 'vitest'
import { categoryDataLabelsFor, categoryDataOf, relabelledSource } from '../../src/models/before-october'

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
