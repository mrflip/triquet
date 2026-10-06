import { describe, expect, it } from 'vitest'
import { WidgetedReadout } from '../../../src/components/cells/readouts'
import { CellNotices } from '../../../src/lib/notices'
import { Widgeted } from '../../../src/models/widgeted'
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
