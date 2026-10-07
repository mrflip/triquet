import { describe, expect, it } from 'vitest'
import { issueReportOf } from '../../../src/components/cells/use-face'

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
