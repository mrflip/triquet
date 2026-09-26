import * as Z from 'zod'
import { Validator } from '../lib/validator'

/** Fewest seconds a quiz's history may wait before being committed: short enough to test with */
export const CommitDebounceSecondsMin = 2

/** Most seconds it may wait: ten minutes, beyond which "the history follows my work" stops being true */
export const CommitDebounceSecondsMax = 600

/** How long it waits unless told otherwise */
export const CommitDebounceSecondsDefault = 30

export const MirrorSettingsValidators = Validator(({ obj, int }) => {
  const commit_debounce_seconds = int.min(CommitDebounceSecondsMin).max(CommitDebounceSecondsMax)
    .describe('The target wait, in seconds, between an edit and the commit that records it. A target rather than a guarantee: a burst of edits shares one commit, and the clock starts at the first of them, so a quiz being worked on continuously is still committed about this often.')

  const mirrorSettings = obj({
    commit_debounce_seconds: commit_debounce_seconds.default(CommitDebounceSecondsDefault),
  })
    .describe('How the quiz-history mirror behaves. Not stored anywhere: it comes from the environment, so a test can shorten the wait without touching a quiz.')

  return { mirrorSettings }
})

export type MirrorSettingsDNA = Z.input<typeof MirrorSettingsValidators.mirrorSettings>
export type MirrorSettingsT   = Z.output<typeof MirrorSettingsValidators.mirrorSettings>

/** How the quiz-history mirror behaves: how long it waits before committing */
export class MirrorSettings implements MirrorSettingsT {
  declare commit_debounce_seconds: number

  /**
   * Validated settings, with anything omitted defaulted.
   *
   * @param dna - Any or none of the settings.
   * @returns A complete set.
   * @throws When the wait is not a whole number of seconds from 2 to 600.
   *
   * @example MirrorSettings.fill({}).commit_debounce_seconds  // => 30
   */
  static fill(dna: MirrorSettingsDNA): MirrorSettingsT {
    return MirrorSettingsValidators.mirrorSettings(dna)
  }

  /**
   * Settings from the raw text of an environment variable, as a developer or a test would set it.
   *
   * @param raw - The variable's text, or undefined when it is not set.
   * @returns A complete set; the defaults when `raw` is undefined or blank.
   * @throws When `raw` is set to something that is not a whole number from 2 to 600.
   *
   * @example MirrorSettings.fromEnv('2').commit_debounce_seconds  // => 2
   */
  static fromEnv(raw: string | undefined): MirrorSettingsT {
    if (raw === undefined || raw.trim() === '') { return this.fill({}) }
    return this.fill({ commit_debounce_seconds: Number(raw) })
  }
}
