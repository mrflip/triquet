import { getContrastRatio } from '@mui/material/styles'
import { describe, expect, it } from 'vitest'
import { Brand, DarkPalette, LightPalette, paletteCss } from '../../src/app/palette'

describe('paletteCss', () => {
  const css = paletteCss()

  it('opens with the root rule', () => {
    expect(css.startsWith(':root {')).to.eq(true)
  })

  it('declares every brand colour once, outside any theme', () => {
    const [rootRule] = css.split('\n', 1)
    expect(rootRule).to.include('--brand-bonjour:#e3dee0;')
    expect(rootRule).to.include('--brand-verdigris:#2f8480;')
    expect(css.match(/--brand-/g)).to.have.lengthOf(Object.keys(Brand).length)
  })

  it('kebabs camel-cased colour keys', () => {
    expect(css).to.include(`--surface-sunk:${LightPalette.surfaceSunk};`)
  })

  it('declares the dark palette both for the system choice and for an explicit one', () => {
    const [, systemDark, stampedDark] = css.split('\n', 3)
    expect(systemDark).to.match(/^@media \(prefers-color-scheme: dark\) \{ :root:not\(\[data-theme="light"\]\)/)
    expect(stampedDark).to.match(/^:root\[data-theme="dark"\]/)
    expect(systemDark).to.include(`--page:${DarkPalette.page};`)
    expect(stampedDark).to.include(`--page:${DarkPalette.page};`)
  })
})

describe('the palettes', () => {
  it('ground each theme in its brand colour', () => {
    expect(LightPalette.page).to.eq(Brand.bonjour)
    expect(DarkPalette.page).to.eq(Brand.martinique)
    expect(LightPalette.ink).to.eq(Brand.martinique)
    expect(DarkPalette.ink).to.eq(Brand.bonjour)
  })


  it('carry the same colour keys', () => {
    expect(Object.keys(DarkPalette)).to.deep.equal(Object.keys(LightPalette))
  })
})

/**
 * Every pairing of colours the app draws, with the WCAG contrast it owes: 4.5 for text (AA), 3
 * for what only needs to be seen, like the focus ring (non-text contrast).
 */
const ContrastCases = [
  // text on the grounds:
  [["ink",       "page"],        4.5, 'body text on the page'],
  [["ink",       "surface"],     4.5, 'body text on a panel or the grid'],
  [["ink",       "surfaceSunk"], 4.5, 'body text on a sunk surface'],
  [["muted",     "page"],        4.5, 'microcopy on the page'],
  [["muted",     "surface"],     4.5, 'microcopy on a panel'],
  [["muted",     "surfaceSunk"], 4.5, 'column headers and quiet pills'],
  [["accent",    "page"],        4.5, 'an outlined button or link on the page'],
  [["accent",    "surface"],     4.5, 'an outlined button or link on a panel'],
  // text on the tints:
  [["accentInk", "accentSoft"],  4.5, 'the Locked pill'],
  [["bad",       "page"],        4.5, 'an error message on the page'],
  [["bad",       "surface"],     4.5, 'an error in the grid'],
  [["bad",       "badSoft"],     4.5, 'a bad pill or failed cell'],
  [["good",      "page"],        4.5, 'a good word on the page'],
  [["good",      "surface"],     4.5, 'a good word in the grid'],
  [["good",      "goodSoft"],    4.5, 'a good pill'],
  // what only needs to be seen:
  [["highlight", "page"],        3,   'the focus ring on the page'],
  [["highlight", "surface"],     3,   'the focus ring on a panel'],
  [["highlight", "surfaceSunk"], 3,   'the focus ring on a sunk surface'],
  [["accent",    "surface"],     3,   'a drop line or active border in the grid'],
] as const

describe.each([['light', LightPalette], ['dark', DarkPalette]] as const)('the %s palette', (_mode, palette) => {
  it.each(ContrastCases)('%j reaches %d:1 for %s', ([fore, back], least) => {
    expect(getContrastRatio(palette[fore], palette[back])).to.be.at.least(least)
  })
})
