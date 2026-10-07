import { describe, expect, it } from 'vitest'
import { issueGistOf, issueReportOf } from '../../../src/components/cells/use-face'

describe('issueReportOf', () => {
  it("writes the doc block's examples: a text of the quiz's own, and a question's field", () => {
    expect(issueReportOf('Unclosed section "played" at 21', { field: 'Recap template', quiz: 'princes', question: null }))
      .to.eq('Triquet: could not fill in the template in Recap template of quiz princes — Unclosed section "played" at 21')
    expect(issueReportOf('Unclosed tag at 14', { field: 'Clueing', quiz: 'princes', question: 'leon' }))
      .to.eq('Triquet: could not fill in the template in Clueing of question leon in quiz princes — Unclosed tag at 14')
  })

  it('says when it knows no quiz', () => {
    expect(issueReportOf('Unclosed tag at 1', { field: 'Notes', quiz: null, question: null })).to.eq('Triquet: could not fill in the template in Notes of quiz (none) — Unclosed tag at 1')
  })
})

describe('issueGistOf', () => {
  it('drops the place mustache stopped reading at, which moves as a half-typed section grows', () => {
    expect(issueGistOf('Unclosed section "played" at 21')).to.eq('Unclosed section "played"')
    expect(issueGistOf('Unclosed section "played" at 22')).to.eq(issueGistOf('Unclosed section "played" at 21'))
    expect(issueGistOf('Unclosed tag at 14')).to.eq('Unclosed tag')
  })

  it('leaves an issue that names no place as it is', () => {
    const refused = '{{> footer}} includes another template, and there are none to include'
    expect(issueGistOf(refused)).to.eq(refused)
  })
})
