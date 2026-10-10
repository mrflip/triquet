import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { ConfirmRemove } from '../../src/components/ConfirmRemove'
import { renderedText } from '../support/rendering'

const question = "Remove this column from the quiz? What it showed is kept."

describe('ConfirmRemove', () => {
  it("is a text button naming the act and the thing, asking nothing until it is pressed", () => {
    const element = <ConfirmRemove noun="column" question={question} onConfirm={vi.fn()} />
    expect(renderedText(element)).to.eq('Remove column')
    expect(renderToStaticMarkup(element)).not.to.contain('alertdialog')
  })

  it("says why in place of the text button when the thing cannot be removed", () => {
    expect(renderedText(<ConfirmRemove noun="widgeting" question={question} refusal="A column still shows it." onConfirm={vi.fn()} />)).to.eq('A column still shows it.')
  })

  it("is a bin named for the act and the thing in its icon form", () => {
    const markup = renderToStaticMarkup(<ConfirmRemove form="icon" act="Delete" noun="Pluto" question="Delete “Pluto” for good?" onConfirm={vi.fn()} />)
    expect(markup).to.contain('aria-label="Delete Pluto"')
    expect(markup).not.to.contain('disabled=""')
  })

  it("disables the bin when it is refused, or not to be pressed", () => {
    expect(renderToStaticMarkup(<ConfirmRemove form="icon" noun="alice" question={question} refusal="Not yours to remove." onConfirm={vi.fn()} />)).to.contain('disabled=""')
    expect(renderToStaticMarkup(<ConfirmRemove form="icon" noun="alice" question={question} disabled onConfirm={vi.fn()} />)).to.contain('disabled=""')
  })
})
