import type * as Z from 'zod'
import { Validator } from '../lib/validator'

/**
 * Every subject category's label, in the default order: clockwise round the wheel from the top.
 * Fixed in code for now; rows name a category only by its label, so its title can change
 * without touching one.
 */
export const CategoryLabelVals = [
  'math_econ', 'gen_sci', 'chem_bio', 'geography', 'euro_hist', 'us_hist', 'world_hist', 'language',
  'art', 'classical_music', 'classic_lit', 'classic_film', 'theater', 'recent_lit', 'recent_film', 'tv',
  'pop_music', 'sports', 'games', 'food_drink', 'lifestyle', 'current_events', 'biz_tech', 'physics_eng',
] as const
export type CategoryLabel = typeof CategoryLabelVals[number]

/** Each category as its tile names it on screen */
export const CategoryTitles = {
  math_econ:       'Math & Econ',
  gen_sci:         'Gen Sci',
  chem_bio:        'Chem & Bio',
  geography:       'Geogr',
  euro_hist:       'Euro Hist',
  us_hist:         'US Hist',
  world_hist:      'World Hist',
  language:        'Lang',
  art:             'Art',
  classical_music: 'Classical Music',
  classic_lit:     'Classic Lit',
  classic_film:    'Classic Film',
  theater:         'Theater',
  recent_lit:      'Recent Lit',
  recent_film:     'Recent Film',
  tv:              'TV',
  pop_music:       'Pop Music',
  sports:          'Sports',
  games:           'Games',
  food_drink:      'Food & Drink',
  lifestyle:       'Lifestyle',
  current_events:  'Curr Events',
  biz_tech:        'Biz & Tech',
  physics_eng:     'Physics & Eng',
} as const satisfies Record<CategoryLabel, string>

/** How many slots a wheel has: one for each category */
export const WheelSlotCount = CategoryLabelVals.length

export const CategoryValidators = Validator(({ arr, oneof }) => {
  const categoryLabel = oneof(CategoryLabelVals)
    .describe('A subject category, by its label.')

  const wheel = arr(categoryLabel.nullable()).length(WheelSlotCount)
    .check((context) => {
      for (const [idx, label] of context.value.entries()) {
        if (label !== null && context.value.indexOf(label) < idx) {
          context.issues.push({ code: 'custom', input: label, path: [idx], message: 'A category may sit in only one slot of the wheel' })
        }
      }
    })
    .describe(`A hunt's categories arranged round a wheel: ${String(WheelSlotCount)} slots, clockwise from the top, each holding a category or empty. The categories no slot holds are the pool, and each empty slot takes one of them in the total order.`)

  return { categoryLabel, wheel }
})

/** A hunt's wheel: a category's label, or null for an empty slot, for each slot clockwise from the top */
export type WheelT = Z.output<typeof CategoryValidators.wheel>

/** One subject category a question draws on: Math & Econ, TV, Classic Lit and the rest */
export class Category {
  declare label: CategoryLabel
  declare title: string

  /**
   * The title `label`'s tile shows.
   *
   * @example Category.titleOf('tv')  // => 'TV'
   */
  static titleOf(label: CategoryLabel): string {
    return CategoryTitles[label]
  }

  /**
   * Where `label` comes in the default order, counting from zero: the slot it holds on a wheel
   * nobody has rearranged, and its rank when the pool fills an empty slot.
   *
   * @example Category.defaultIdxOf('math_econ')  // => 0
   * @example Category.defaultIdxOf('physics_eng')  // => 23
   */
  static defaultIdxOf(label: CategoryLabel): number {
    return CategoryLabelVals.indexOf(label)
  }
}
