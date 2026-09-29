import localFont from 'next/font/local'

// The woff2 files come from the Fontsource packages, never from Google at build time: that fetch
// fails a build now and then. The paths are relative to this file, as next/font/local requires.

/** Display: the quiz name and the panel headings. A printed quiz sheet, not a dashboard. */
export const zillaSlab = localFont({
  src: [
    { path: '../../node_modules/@fontsource/zilla-slab/files/zilla-slab-latin-500-normal.woff2', weight: '500', style: 'normal' },
    { path: '../../node_modules/@fontsource/zilla-slab/files/zilla-slab-latin-600-normal.woff2', weight: '600', style: 'normal' },
  ],
  variable: '--font-zilla-slab',
  display:  'swap',
})

/** Interface: column headers, buttons, microcopy, the footnote, and the editing boxes */
export const workSans = localFont({
  src: [
    { path: '../../node_modules/@fontsource/work-sans/files/work-sans-latin-400-normal.woff2', weight: '400', style: 'normal' },
    { path: '../../node_modules/@fontsource/work-sans/files/work-sans-latin-500-normal.woff2', weight: '500', style: 'normal' },
    { path: '../../node_modules/@fontsource/work-sans/files/work-sans-latin-600-normal.woff2', weight: '600', style: 'normal' },
  ],
  variable: '--font-work-sans',
  display:  'swap',
})

/** Data: titles, Q#, every sum, the ish lists, the guess, the export boxes */
export const jetbrainsMono = localFont({
  src: [
    { path: '../../node_modules/@fontsource/jetbrains-mono/files/jetbrains-mono-latin-400-normal.woff2', weight: '400', style: 'normal' },
    { path: '../../node_modules/@fontsource/jetbrains-mono/files/jetbrains-mono-latin-500-normal.woff2', weight: '500', style: 'normal' },
  ],
  variable: '--font-jetbrains-mono',
  display:  'swap',
})

/** The three font variables, ready for the html element's class list */
export const FontVariables = [zillaSlab.variable, workSans.variable, jetbrainsMono.variable].join(' ')
