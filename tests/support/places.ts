import * as Runner from '../../src/lib/formulary/runner'

/**
 * The place of a hunt labelled `huntlabel` and its realm labelled `realmlabel`, neither titled,
 * so each title reads as its label titleized.
 *
 * @example placeAt('high_tarn', 'finals').hunt.title  // => 'High Tarn'
 */
export function placeAt(huntlabel: string, realmlabel: string): Runner.QuizPlace {
  return Runner.placeOf({ label: huntlabel, forced_label: null, title: '' }, { label: realmlabel, title: '' })
}

/** Where a quiz sits in a test that needs it to sit somewhere: the hunt `deep_lake`, its realm `home` */
export const Here = placeAt('deep_lake', 'home')
