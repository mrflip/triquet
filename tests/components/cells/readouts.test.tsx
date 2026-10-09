import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { DrawnReadout, WidgetedAskCell, WidgetedReadout } from '../../../src/components/cells/readouts'
import { CellNotices } from '../../../src/lib/notices'
import { Widgeted, type JsonT } from '../../../src/models/widgeted'
import type { ColumnReadout } from '../../../src/models/column'
import { renderedText } from '../../support/rendering'

describe('WidgetedReadout', () => {
  const ReadoutCases = [
    [Widgeted.missing,  CellNotices.nothingExpressed, 'reads an uncomputed sum as the dash, never as a zero'],
    [Widgeted.ok(null), CellNotices.nothingExpressed, 'reads a value of nothing as the dash'],
    [Widgeted.ok(''),   CellNotices.nothingExpressed, 'reads empty text as the dash'],
    [Widgeted.ok(0),    "0",                          'reads a sum that came to zero as zero, not as the dash'],
  ] as const
  for (const [widgeted, expected, describes] of ReadoutCases) {
    it(describes, () => {
      expect(renderedText(<WidgetedReadout widgeted={widgeted} label="Sum" wide={false} heightPx={40} />)).to.eq(expected)
    })
  }
})

/** What a column drew, `ok`, as `text` */
function okDrawn(text: string, issue: string | null = null) {
  return { widgeted: Widgeted.ok(text), text, issue }
}

/** The markup `drawn` makes, drawn by `readout` */
function drawnAs(drawn: ReturnType<typeof okDrawn>, readout: ColumnReadout): string {
  return renderToStaticMarkup(<DrawnReadout drawn={drawn} readout={readout} wide heightPx={100} />)
}

/** The markup a cell holding `text`, `ok`, draws by `readout` */
function drawAs(text: string, readout: ColumnReadout): string {
  return drawnAs(okDrawn(text), readout)
}

describe('DrawnReadout', () => {

  it('draws markdown as markdown, and plain text as the characters typed', () => {
    expect(drawAs('**bold**', 'markdown')).to.include('<strong>bold</strong>')
    expect(drawAs('**bold**', 'plain')).to.include('**bold**')
  })

  it('draws code verbatim, in a code box, and a label as the Title cell draws one', () => {
    expect(drawAs('$.masie', 'code')).to.match(/<code[^>]*data-readout="code"[^>]*>\$\.masie<\/code>/)
    expect(drawAs('leon', 'label')).to.match(/data-readout="label"[^>]*>leon</)
  })

  it('makes no image of a link written as one, as a value worked out is drawn', () => {
    expect(drawAs('&#33;[map](https://host/m.png)', 'markdown')).to.not.include('<img')
  })

  it('says why a template could not be filled in, above its text', () => {
    expect(drawnAs(okDrawn('{% if value %}', 'tag not closed'), 'plain')).to.match(/data-template-issue[^>]*>tag not closed<\/p>/)
  })

  it('draws nothing, a failure, or empty text as a worked-out cell does', () => {
    expect(renderedText(<DrawnReadout drawn={{ widgeted: Widgeted.missing, text: '', issue: null }} readout="markdown" wide heightPx={100} />)).to.eq(CellNotices.nothingExpressed)
    expect(renderedText(<DrawnReadout drawn={okDrawn('')} readout="code" wide heightPx={100} />)).to.eq(CellNotices.nothingExpressed)
    const failed = { widgeted: Widgeted.errored({ message: 'no', at: null, response: null }), text: '', issue: null }
    expect(renderedText(<DrawnReadout drawn={failed} readout="plain" wide heightPx={100} />)).to.include('no')
  })
})

/** The text an asked cell holding `value`, `ok`, draws, its row's `result_meta` being `meta` */
function askedText(value: string, meta: Record<string, JsonT>): string {
  return renderedText(<WidgetedAskCell widgeted={Widgeted.ok(value)} meta={meta} label="Dumdum" asking={false} askable locked={false} notice={null} heightPx={100} onAsk={vi.fn()} />)
}

describe('WidgetedAskCell', () => {
  it("says beneath a value how it was come by: its tier, whether it was cut short, and about how many tokens", () => {
    expect(askedText('Leon', { model_tier_applied: 'quick', approx_tokens: 84, truncated: true })).to.eq(`Leonquick ${CellNotices.truncated} · ~84 tok`)
  })

  it("says a reply carried in by an import was imported, rather than asked here", () => {
    expect(askedText('Leon', { imported: true })).to.eq(`Leon${CellNotices.imported}`)
  })
})
