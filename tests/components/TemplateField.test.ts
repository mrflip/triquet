import { describe, expect, it } from 'vitest'
import { templateIssueOf } from '../../src/components/TemplateField'
import * as PA from '../../src/lib/vv/patterns'

describe('templateIssueOf', () => {
  it('is null for Liquid that reads', () => {
    expect(templateIssueOf('Template', '{{ value }}%')).to.be.null
    expect(templateIssueOf('Template', '{% if value %}**{{ value }}**{% endif %}')).to.be.null
  })

  it("names Liquid that does not read, in the field's own words", () => {
    expect(templateIssueOf('Template', '{% if value %}')).to.eq('Template does not read as Liquid: tag {% if value %} not closed, line:1, col:1')
    expect(templateIssueOf('Template', '{{ value | shout }}')).to.match(/^Template does not read as Liquid: undefined filter: shout/)
  })

  it('refuses a template past what a field holds', () => {
    expect(templateIssueOf('Template', 'x'.repeat(PA.Textish.max + 1))).to.eq(`Template should be at most ${String(PA.Textish.max)} characters.`)
  })
})
