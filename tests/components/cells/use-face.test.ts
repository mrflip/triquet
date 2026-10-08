import { describe, expect, it } from 'vitest'
import { issueGistOf, issueReportOf } from '../../../src/components/cells/use-face'

describe('issueReportOf', () => {
  it("writes the doc block's examples: a text of the quiz's own, and a question's field", () => {
    expect(issueReportOf('tag {% for qn in qns %} not closed', { field: 'Recap template', quiz: 'princes', question: null }))
      .to.eq('Triquet: could not fill in the template in Recap template of quiz princes — tag {% for qn in qns %} not closed')
    expect(issueReportOf('undefined filter: shout', { field: 'Clueing', quiz: 'princes', question: 'leon' }))
      .to.eq('Triquet: could not fill in the template in Clueing of question leon in quiz princes — undefined filter: shout')
  })

  it('says when it knows no quiz', () => {
    expect(issueReportOf('undefined filter: shout', { field: 'Notes', quiz: null, question: null })).to.eq('Triquet: could not fill in the template in Notes of quiz (none) — undefined filter: shout')
  })
})

describe('issueGistOf', () => {
  it('drops the place Liquid stopped reading at, which moves as a half-typed tag grows', () => {
    expect(issueGistOf('invalid value expression: "", line:2, col:6')).to.eq('invalid value expression: ""')
    expect(issueGistOf('invalid value expression: "", line:2, col:7')).to.eq(issueGistOf('invalid value expression: "", line:2, col:6'))
    expect(issueGistOf('tag {% for qn in qns %} not closed, line:1, col:1')).to.eq('tag {% for qn in qns %} not closed')
  })

  it('leaves an issue that names no place as it is', () => {
    const refused = 'This template comes to far too much text to show.'
    expect(issueGistOf(refused)).to.eq(refused)
  })
})
