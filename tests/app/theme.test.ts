import { getContrastRatio } from '@mui/material/styles'
import { describe, expect, it } from 'vitest'
import { theme } from '../../src/app/theme'

/** The MUI colours the app fills a button or chip with, whose label must read on them */
const FilledColors = ['primary', 'secondary', 'success', 'error'] as const

describe.each(['light', 'dark'] as const)('the %s scheme', (mode) => {
  const { palette } = theme.colorSchemes[mode]!

  it.each(FilledColors)('writes on %s at 4.5:1 or better', (colorname) => {
    const { main, contrastText } = palette[colorname]
    expect(getContrastRatio(contrastText, main)).to.be.at.least(4.5)
  })

  it('writes body text on its paper at 4.5:1 or better', () => {
    expect(getContrastRatio(palette.text.primary, palette.background.paper)).to.be.at.least(4.5)
    expect(getContrastRatio(palette.text.secondary, palette.background.paper)).to.be.at.least(4.5)
  })
})
