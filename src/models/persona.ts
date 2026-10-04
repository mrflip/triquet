import type { Difficulty } from './estimate'

/**
 * Every category persona's label: the three imagined players who sit at the corners of the
 * wheel's triangle, each knowing best the categories beside their slot.
 */
export const PersonaLabelVals = ['masie', 'artie', 'poppy'] as const
export type PersonaLabel = typeof PersonaLabelVals[number]

/** Each persona as the screen names them */
export const PersonaTitles = {
  masie: 'Masie',
  artie: 'Artie',
  poppy: 'Poppy',
} as const satisfies Record<PersonaLabel, string>

/**
 * The slot of the wheel each persona sits beside: the triangle's corners, which hold Math & Econ,
 * Art and Pop Music on the default wheel. A persona keeps their slot, whatever is put in it.
 */
export const PersonaSlots = {
  masie: 0,
  artie: 8,
  poppy: 16,
} as const satisfies Record<PersonaLabel, number>

/**
 * How likely a persona is to get a question, 0 to 1, by its difficulty: `best` for a category in
 * their slot or either side of it, `worst` for one in the opposite slot or either side of that.
 */
export const PersonaChanceBounds = {
  easy:   { best: 0.9,  worst: 0.6 },
  medium: { best: 0.75, worst: 0.3 },
  hard:   { best: 0.6,  worst: 0   },
} as const satisfies Record<Difficulty, { best: number, worst: number }>

/** An imagined player who knows best the categories beside one slot of the wheel, and least those opposite */
export class Persona {
  declare label:   PersonaLabel
  declare title:   string
  declare slotIdx: number

  /**
   * The name `label` is shown by.
   *
   * @example Persona.titleOf('masie')  // => 'Masie'
   */
  static titleOf(label: PersonaLabel): string {
    return PersonaTitles[label]
  }

  /**
   * The slot `label` sits beside.
   *
   * @example Persona.slotIdxOf('artie')  // => 8
   */
  static slotIdxOf(label: PersonaLabel): number {
    return PersonaSlots[label]
  }
}
