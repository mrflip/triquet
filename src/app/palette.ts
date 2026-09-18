/**
 * The colour system: a desaturated green-grey ground with a single ochre accent -- deliberately
 * not a blue-grey SaaS palette, and warm enough to read as paper.
 *
 * Every colour is named here once for light and once for dark. The CSS custom properties the
 * grid uses and the MUI theme its buttons use are both generated from these, so a colour has
 * exactly one definition per theme and nothing is defined only inside a dark-mode branch.
 */
export const LightPalette = {
  page:        '#eef1ea',
  surface:     '#ffffff',
  surfaceSunk: '#e4e9e0',
  ink:         '#1b2b28',
  muted:       '#5b6b66',
  border:      '#d7ddd0',
  accent:      '#b8790f',
  accentInk:   '#6b4a0e',
  accentSoft:  '#f5e7c8',
  good:        '#2f6f4f',
  goodSoft:    '#dbeadf',
  bad:         '#ad3f2b',
  badSoft:     '#f6ded8',
} as const

export type Colorkey = keyof typeof LightPalette

export const DarkPalette: Record<Colorkey, string> = {
  page:        '#12201c',
  surface:     '#1b2b26',
  surfaceSunk: '#21322c',
  ink:         '#e9f0ec',
  muted:       '#93aba3',
  border:      '#2c3f38',
  accent:      '#e0a63a',
  accentInk:   '#f5e2b8',
  accentSoft:  '#33290f',
  good:        '#5fae83',
  goodSoft:    '#1d3a2c',
  bad:         '#e0846c',
  badSoft:     '#3a201a',
}

/**
 * The stylesheet defining every colour token, in all three viewer states: an explicit light
 * choice, an explicit dark choice, and the default where neither is stamped and the system
 * decides.
 *
 * @returns CSS ready to drop into a style element.
 *
 * @example paletteCss().startsWith(':root {')  // => true
 */
export function paletteCss(): string {
  const light = declarationsFor(LightPalette)
  const dark  = declarationsFor(DarkPalette)
  return [
    `:root {${light}}`,
    `@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) {${dark}} }`,
    `:root[data-theme="dark"] {${dark}}`,
  ].join('\n')
}

/** `--kebab-name: value;` for every colour in `palette` */
function declarationsFor(palette: Record<Colorkey, string>): string {
  return Object.entries(palette)
    .map(([colorkey, hex]) => `--${kebab(colorkey)}:${hex};`)
    .join('')
}

/** `surfaceSunk` as `surface-sunk`, the shape a CSS custom property wants */
function kebab(colorkey: string): string {
  return colorkey.replaceAll(/[A-Z]/g, (upper) => `-${upper.toLowerCase()}`)
}
