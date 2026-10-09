import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import * as Recap from '../../src/lib/recap'
import { beforeOctoberColumn, beforeOctoberFormula, beforeOctoberOf, beforeOctoberParams, beforeOctoberQuizTexts, beforeOctoberRef, beforeOctoberTemplate, beforeOctoberTemplated, beforeOctoberWidgetTexts, categoryDataLabelsFor, categoryDataOf, plainOf, relabelledSource, templateableFrom } from '../../src/models/before-october'
import { SeedWidgets } from '../../src/models/seeds'
import { present } from '../support/present'

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

describe('beforeOctoberRef', () => {
  it('names the questions as the bag does now, and any other ref as it was', () => {
    expect(['qns', 'clueing', 'quiz.playtesters', 'questions'].map((ref) => beforeOctoberRef(ref))).to.deep.eq(['questions', 'clueing', 'quiz.playtesters', 'questions'])
  })
})

describe('beforeOctoberFormula', () => {
  const Cases: [string, string, string][] = [
    // the doc examples:
    ['$uppercase(qn.title)', '$uppercase(question.title)', 'the question being worked out'],
    ['(qns[label = $$.qn.chains_to]).hint', '(question.chains_to ? $lookup(questions, question.chains_to)).hint', 'the search for the question chained to, in parens, as a lookup'],
    ['$count(qns[archived = false])', '$count(questions.*[archived = false])', 'the questions, as their values'],
    ["{ 'qn': qn.clueing }", "{ 'qn': question.clueing }", 'a string, left as it is'],
    // the rest:
    ['qns[label=$$.qn.chains_to].numnum_hint', '(question.chains_to ? $lookup(questions, question.chains_to)).numnum_hint', 'the search bare, made a lookup in parens'],
    ['$f(qns[label = $$.qn.chains_to], 2)', '$f((question.chains_to ? $lookup(questions, question.chains_to)), 2)', 'the search as one argument of several'],
    ['qn_label & $$.qn.title & $.qn.hint', 'question_label & $$.question.title & $.question.hint', 'its label, and paths from the root'],
    ['($qn := qn; $qn.title)', '($qn := question; $qn.title)', 'a variable of the same name, left as it is'],
    ['qn.qnum & qns.title & qn.qns_count', 'question.qnum & questions.*.title & question.qns_count', 'only whole words, and only where a path begins'],
    ['categories[label = "art"].title', 'categories.*[label = "art"].title', "the hunt's categories, as their values"],
    ['qn.categories.masie', 'question.categories.masie', 'a widgeting labelled as the categories were, left to its question'],
    ['/* qn */ qn.title', '/* qn */ question.title', 'a comment, left as it is'],
    [String.raw`'it\'s qn' & qn.title`, String.raw`'it\'s qn' & question.title`, 'a string holding its own quote'],
    ['question.title & questions.*.label & categories.*', 'question.title & questions.*.label & categories.*', 'a formula of today, unchanged'],
  ]
  for (const [formula, expected, describes] of Cases) {
    it(`rewrites ${describes}`, () => {
      expect(beforeOctoberFormula(formula)).to.eq(expected)
    })
  }

  it('rewrites a formula once: what it makes, it leaves as it is', () => {
    for (const [formula] of Cases) {
      const once = beforeOctoberFormula(formula)
      expect(beforeOctoberFormula(once)).to.eq(once)
    }
  })
})

describe('beforeOctoberTemplate', () => {
  const Cases: [string, string, string][] = [
    // the doc examples:
    ['By {{ qn.author }}, qn', 'By {{ question.author }}, qn', 'an output, and not the prose around it'],
    ['{%- for qn in qns %}{{ qn.title }}{% endfor %}', '{%- assign shown_questions = questions | values | reject: "archived" %}{% for question in shown_questions %}{{ question.title }}{% endfor %}', 'a loop over the questions shown, made a list first'],
    ['{% assign played = qns | in_order %}', '{% assign played = questions | in_order %}', 'the questions put in order, which takes them as they are'],
    // the rest:
    ['{% for each in quiz.questions limit: 2 -%}{{ each.label }}{%- endfor %}', '{% assign every_question = questions | values %}{% for each in every_question limit: 2 -%}{{ each.label }}{%- endfor %}', 'a loop over every question, its trim marks and limit kept'],
    ['{% for cat in categories %}{{ cat.title }}{% endfor %}', '{% assign every_category = categories | values %}{% for cat in every_category %}{{ cat.title }}{% endfor %}', "a loop over the hunt's categories"],
    ['{{ qns | where: "secondary", true | size }}', '{{ questions | values | reject: "archived" | where: "secondary", true | size }}', 'the questions shown, piped into a filter'],
    ['{{ quiz.questions | map: "title" | join: ", " }}', '{{ questions | values | map: "title" | join: ", " }}', 'every question, piped into a filter'],
    ['{{ qns.size }} of {{ quiz.questions.size }}', '{{ questions.size }} of {{ questions.size }}', 'the questions read otherwise, as the collection'],
    ['{{ qn_label }}: {{ qn.hint | quote }}', '{{ question_label }}: {{ question.hint | quote }}', 'its label, and a field shaped by a filter'],
    ['{% if qn.hint == "qn" %}yes{% endif %}', '{% if question.hint == "qn" %}yes{% endif %}', 'a string in a tag, left as it is'],
    ['{% raw %}{{ qn.title }}{% endraw %} {{ qn.title }}', '{% raw %}{{ qn.title }}{% endraw %} {{ question.title }}', 'a raw block, left whole'],
    ['{{ qn.title', '{{ qn.title', 'an output never closed, left as it is'],
    ['{{ question.title }} {% assign list = questions | values %}', '{{ question.title }} {% assign list = questions | values %}', 'a template of today, unchanged'],
  ]
  for (const [template, expected, describes] of Cases) {
    it(`rewrites ${describes}`, () => {
      expect(beforeOctoberTemplate(template)).to.eq(expected)
    })
  }

  it('rewrites a template once: what it makes, it leaves as it is', () => {
    for (const [template] of Cases) {
      const once = beforeOctoberTemplate(template)
      expect(beforeOctoberTemplate(once)).to.eq(once)
    }
  })
})

describe("the rewrite, over the seeds as they read the bag before it took the export's shape", () => {
  const Before = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, '../../fixtures/seeds-2026-10-09.json'), 'utf8')) as {
    widgets:        Record<string, { formulary: string, formula?: string, input_formula: string }>
    recap_template: string
  }

  it("comes to each seeded widget's texts as the seeds read now, as the backfill makes a library seeded before", () => {
    for (const [label, before] of Object.entries(Before.widgets)) {
      const seed = present(SeedWidgets.find((widget) => widget.label === label), label)
      const rewritten = beforeOctoberWidgetTexts(before)
      expect(rewritten.input_formula, `${label}'s input formula`).to.eq(seed.input_formula)
      // An aibot's prompt reads its input, not the bag, so the fixture leaves it out, and the seed's stands.
      expect(rewritten.formula ?? seed.formula, `${label}'s formula`).to.eq(seed.formula)
    }
  })

  it('comes to the default recap template as it reads now', () => {
    expect(beforeOctoberTemplate(Before.recap_template)).to.eq(Recap.DefaultTemplate)
  })
})

describe('beforeOctoberWidgetTexts', () => {
  it("rewrites a formula's input and formula, a bot's input and never its prompt, and a template's where it reads the whole bag", () => {
    expect(beforeOctoberWidgetTexts({ formulary: 'jsonata', input_formula: '$', formula: 'qn.title' })).to.deep.eq({ formulary: 'jsonata', input_formula: '$', formula: 'question.title' })
    expect(beforeOctoberWidgetTexts({ formulary: 'aibot', input_formula: "{ 'clueing': qn.clueing }", formula: '{{ qn }}' })).to.deep.eq({ formulary: 'aibot', input_formula: "{ 'clueing': question.clueing }", formula: '{{ qn }}' })
    expect(beforeOctoberWidgetTexts({ formulary: 'liquidize', formula: '{{ qn.title }}' })).to.deep.eq({ formulary: 'liquidize', formula: '{{ question.title }}' })
  })

  it("leaves a formula or template that reads an input of its own, and an entry, as they were", () => {
    expect(beforeOctoberWidgetTexts({ formulary: 'liquidize', input_formula: "{ 'qn': qn }", formula: '{{ qn.title }}' }).formula).to.eq('{{ qn.title }}')
    expect(beforeOctoberWidgetTexts({ formulary: 'jsonata', input_formula: 'qn', formula: 'qn.title' }).formula).to.eq('qn.title')
    expect(beforeOctoberWidgetTexts({ formulary: 'entry', formula: 'qn', input_formula: 'qn' })).to.deep.eq({ formulary: 'entry', formula: 'qn', input_formula: 'qn' })
  })
})

describe('beforeOctoberParams', () => {
  it("rewrites a template widgeting's own template where its widget reads the whole bag, and its template_from's ref", () => {
    expect(beforeOctoberParams({ template: '{{ qn.hint }}' }, '$')).to.deep.eq({ template: '{{ question.hint }}' })
    expect(beforeOctoberParams({ template: '{{ qn.hint }}' }, undefined)).to.deep.eq({ template: '{{ question.hint }}' })
    expect(beforeOctoberParams({ template_from: { ref: 'qns', formula: '$count($)' } }, '$')).to.deep.eq({ template_from: { ref: 'questions', formula: '$count($)' } })
  })

  it("leaves a template over an input of its own, and any other param, as they were", () => {
    expect(beforeOctoberParams({ template: '{{ qn.hint }}', size: 3 }, "{ 'qn': qn }")).to.deep.eq({ template: '{{ qn.hint }}', size: 3 })
  })
})

describe('beforeOctoberColumn', () => {
  it('rewrites its ref and its template, and leaves its formula, which reads what its ref picks', () => {
    expect(beforeOctoberColumn({ source: 'qns', formula: '$count($)', template: '{{ value }} of {{ qns.size }}' })).to.deep.eq({ source: 'questions', formula: '$count($)', template: '{{ value }} of {{ questions.size }}' })
    expect(beforeOctoberColumn({ source: 'clueing' })).to.deep.eq({ source: 'clueing' })
  })
})

describe('beforeOctoberQuizTexts', () => {
  it("rewrites the recap's head, tail and template, and leaves the rest", () => {
    const quiz = { title: 'qn', recap_head: '{{ qn_label }}', recap_tail: 'Bye', recap_template: '{% assign played = qns | in_order %}' }
    expect(beforeOctoberQuizTexts(quiz)).to.deep.eq({ title: 'qn', recap_head: '{{ question_label }}', recap_tail: 'Bye', recap_template: '{% assign played = questions | in_order %}' })
    expect(beforeOctoberQuizTexts({ recap_head: 'Hi' })).to.deep.eq({ recap_head: 'Hi' })
  })
})

describe('beforeOctoberTemplated', () => {
  it("rewrites a text, or a cell's value carried as its widgeted, and leaves anything else", () => {
    expect(beforeOctoberTemplated('By {{qn.author}}')).to.eq('By {{question.author}}')
    expect(beforeOctoberTemplated({ status: 'ok', value: '{{ qn.title }}!' })).to.deep.eq({ status: 'ok', value: '{{ question.title }}!' })
    expect([beforeOctoberTemplated(3), beforeOctoberTemplated(null), beforeOctoberTemplated({ status: 'ok', value: 3 })]).to.deep.eq([3, null, { status: 'ok', value: 3 }])
  })
})
