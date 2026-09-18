import { JetBrains_Mono, Work_Sans, Zilla_Slab } from 'next/font/google'

/** Display: the round name and the panel headings. A printed quiz sheet, not a dashboard. */
export const zillaSlab = Zilla_Slab({
  subsets:  ['latin'],
  weight:   ['500', '600'],
  variable: '--font-zilla-slab',
  display:  'swap',
})

/** Interface: column headers, buttons, microcopy, the footnote, and the editing boxes */
export const workSans = Work_Sans({
  subsets:  ['latin'],
  weight:   ['400', '500', '600'],
  variable: '--font-work-sans',
  display:  'swap',
})

/** Data: titles, Q#, every sum, the ish lists, the guess, the export boxes */
export const jetbrainsMono = JetBrains_Mono({
  subsets:  ['latin'],
  weight:   ['400', '500'],
  variable: '--font-jetbrains-mono',
  display:  'swap',
})

/** The three font variables, ready for the html element's class list */
export const FontVariables = [zillaSlab.variable, workSans.variable, jetbrainsMono.variable].join(' ')
