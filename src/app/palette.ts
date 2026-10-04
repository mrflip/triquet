/**
 * The Triquet brand's six colours, as `public/brand/tokens.css` names them. The themes below
 * take their grounds, ink and accents from here; the tints between them are derived.
 */
export const Brand = {
  bonjour:    '#e3dee0', // light ground
  bermuda:    '#7488a1', // light accent
  smoky:      '#433363', // main brand
  martinique: '#16111b', // dark ground
  comet:      '#5f6283', // dark accent
  verdigris:  '#2f8480', // bell / highlight accent, both modes
} as const

/**
 * The colour system: the brand's warm grey ground, its purple and blue-grey accents, and
 * verdigris for the one highlight both modes share.
 *
 * Every colour is named here once for light and once for dark. The CSS custom properties the
 * grid uses and the MUI theme its buttons use are both generated from these, so a colour has
 * exactly one definition per theme and nothing is defined only inside a dark-mode branch.
 *
 * Legibility comes before fidelity to the swatches. A brand accent too faint to carry text on
 * its own ground (bermuda on bonjour, comet on martinique) is that mode's soft fill instead, and
 * `accent` takes a brand colour that reads. Verdigris is deepened for light and lifted for dark,
 * so the focus ring shows on every surface and a label written on it reads.
 *
 * A chart's two series are `seriesA` and `seriesB`: the brand's purple and verdigris, each made
 * vivid enough to read as a colour rather than a grey, stepped for the mode's surface, and far
 * enough apart to be told from each other with any colour vision.
 */
export const LightPalette = {
  page:        Brand.bonjour,
  surface:     '#f4f1f2',
  surfaceSunk: '#d8d2d5',
  ink:         Brand.martinique,
  muted:       '#4e5175',
  border:      '#c8c0c5',
  accent:      Brand.smoky,
  accentInk:   Brand.martinique,
  accentSoft:  Brand.bermuda,
  highlight:   '#2a7773',
  good:        '#2f6f4f',
  goodSoft:    '#dbeadf',
  bad:         '#a63c29',
  badSoft:     '#f6ded8',
  seriesA:     '#614092',
  seriesB:     '#008c7a',
} as const

export type Colorkey = keyof typeof LightPalette

export const DarkPalette: Record<Colorkey, string> = {
  page:        Brand.martinique,
  surface:     '#1f1926',
  surfaceSunk: '#272030',
  ink:         Brand.bonjour,
  muted:       '#a7a0ae',
  border:      '#362d40',
  accent:      Brand.bermuda,
  accentInk:   '#f4f1f2',
  accentSoft:  Brand.comet,
  highlight:   '#3f9d97',
  good:        '#5fae83',
  goodSoft:    '#1d3a2c',
  bad:         '#e0846c',
  badSoft:     '#3a201a',
  seriesA:     '#9274c3',
  seriesB:     '#37a69a',
}

/**
 * The stylesheet defining every colour token, in all three viewer states: an explicit light
 * choice, an explicit dark choice, and the default where neither is stamped and the system
 * decides. The brand's own colours come along as `--brand-*`, the same in every state, for
 * whatever must show a brand colour whatever the theme.
 *
 * @returns CSS ready to drop into a style element.
 *
 * @example paletteCss().startsWith(':root {')  // => true
 */
export function paletteCss(): string {
  const brand = declarationsFor(Brand, 'brand-')
  const light = declarationsFor(LightPalette)
  const dark  = declarationsFor(DarkPalette)
  return [
    `:root {${brand}${light}}`,
    `@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) {${dark}} }`,
    `:root[data-theme="dark"] {${dark}}`,
  ].join('\n')
}

/** `--prefix-kebab-name: value;` for every colour in `palette` */
function declarationsFor(palette: Readonly<Record<string, string>>, prefix = ''): string {
  return Object.entries(palette)
    .map(([colorkey, hex]) => `--${prefix}${kebab(colorkey)}:${hex};`)
    .join('')
}

/** `surfaceSunk` as `surface-sunk`, the shape a CSS custom property wants */
function kebab(colorkey: string): string {
  return colorkey.replaceAll(/[A-Z]/g, (upper) => `-${upper.toLowerCase()}`)
}
