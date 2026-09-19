import { mintId } from '../lib/ids'
import type { PlayingRow } from '../db/schema'
import type { GuessDNA, GuessT } from './guess'
import type { IshesDNA, IshesT } from './ish'
import type { PlayerLabel } from './player'
import type { QuestionDNA, QuestionT } from './question'
import type { Textkind } from '../lib/ask/contract'

/** One time a player was put one of a question's texts, and what came back */
export type PlayingT = PlayingRow

/** One of a question's played cells: which player, shown which of its texts, and the field it shows in */
export type PlaySlot = {
  player_label: PlayerLabel
  textkind:     Textkind
  field:        'guess' | 'clueing_ishes' | 'hint_ishes'
}

/** Every played cell a question has, in the order the grid shows them */
export const PlaySlots = [
  { player_label: 'dumdum', textkind: 'clueing', field: 'guess' },
  { player_label: 'numnum', textkind: 'clueing', field: 'clueing_ishes' },
  { player_label: 'numnum', textkind: 'hint',    field: 'hint_ishes' },
] as const satisfies readonly PlaySlot[]

/**
 * Which cell an playing belongs to, as one string.
 *
 * @example slotkeyOf({ question_id: 'q1', player_label: 'dumdum', textkind: 'clueing' })  // => 'q1:dumdum:clueing'
 */
export function slotkeyOf(playing: Pick<PlayingT, 'question_id' | 'player_label' | 'textkind'>): string {
  return `${playing.question_id}:${playing.player_label}:${playing.textkind}`
}

/**
 * The newest playing for each cell, from any pile of them.
 *
 * @param playings - Playings for any number of questions, in any order.
 * @returns Each cell's newest playing, by `slotkeyOf`.
 */
export function latestBySlot(playings: readonly PlayingT[]): Map<string, PlayingT> {
  const latest = new Map<string, PlayingT>()
  for (const playing of playings) {
    const slotkey = slotkeyOf(playing)
    const held = latest.get(slotkey)
    if (! held || playing.created_at > held.created_at) { latest.set(slotkey, playing) }
  }
  return latest
}

/**
 * The results a question shows in its played cells, from the newest playing for each.
 *
 * A number-spotting result is stale when the text it was asked about is no longer the text the
 * question holds; a cell with no playing is null.
 *
 * @param question - The question's own fields, as stored.
 * @param latest - The newest playing for each cell, as `latestBySlot` gives them.
 * @returns The `guess`, `clueing_ishes` and `hint_ishes` fields for that question.
 */
export function resultsFor(
  question: Pick<QuestionT, 'id' | 'clueing' | 'hint'>,
  latest: ReadonlyMap<string, PlayingT>,
): Pick<QuestionDNA, 'guess' | 'clueing_ishes' | 'hint_ishes'> {
  const playingIn = (slot: PlaySlot) => latest.get(slotkeyOf({ question_id: question.id, ...slot }))
  const guess   = playingIn(PlaySlots[0])
  const clueing = playingIn(PlaySlots[1])
  const hint    = playingIn(PlaySlots[2])
  return {
    guess:         guess ? guessFrom(guess) : null,
    clueing_ishes: clueing ? ishesFrom(clueing, question.clueing) : null,
    hint_ishes:    hint ? ishesFrom(hint, question.hint) : null,
  }
}

/**
 * The playings a question is holding that are newer than anything already recorded.
 *
 * A cell whose result is no newer than what was recorded yields nothing, so offering the same
 * question twice records nothing the second time; an empty cell yields nothing either.
 *
 * @param question - The question as the author now has it.
 * @param recordedAt - When each cell's newest recorded playing was made, by `slotkeyOf`; a cell absent has none.
 * @param mint - Supplies each new playing's id.
 * @returns One playing per cell holding something new.
 */
export function unrecordedPlayings(
  question: QuestionT,
  recordedAt: ReadonlyMap<string, number>,
  mint: () => string = mintId,
): PlayingT[] {
  return PlaySlots.flatMap((slot) => {
    const result = question[slot.field]
    if (result === null) { return [] }
    const recorded = recordedAt.get(slotkeyOf({ question_id: question.id, ...slot }))
    if (recorded !== undefined && result.updated_at <= recorded) { return [] }
    return [playingFrom(question, slot, result, mint())]
  })
}

/** `result`, found in one of `question`'s cells, as an playing */
function playingFrom(question: QuestionT, slot: PlaySlot, result: NonNullable<GuessT | IshesT>, id: string): PlayingT {
  const askedText = question[slot.textkind].trim()
  const playing: PlayingT = {
    id,
    question_id:        question.id,
    player_label:       slot.player_label,
    textkind:           slot.textkind,
    asked_text:         askedText,
    status:             result.status,
    reply_text:        null,
    items:              null,
    message:            null,
    truncated:          false,
    model_tier_applied: null,
    approx_tokens:      null,
    created_at:         result.updated_at,
  }
  if (result.status === 'error') { return { ...playing, message: result.message } }
  const done = {
    ...playing,
    truncated:          result.truncated,
    model_tier_applied: result.model_tier_applied ?? null,
    approx_tokens:      result.approx_tokens ?? null,
  }
  if ('text' in result) { return { ...done, reply_text: result.text } }
  // A result already marked stale was asked about some earlier text, which is no longer known.
  return { ...done, items: result.items, asked_text: result.stale ? null : askedText }
}

/** A dumdum playing, as the guess it shows */
function guessFrom(playing: PlayingT): GuessDNA {
  if (playing.status === 'error') { return errorFrom(playing) }
  return {
    status:             'done',
    text:               playing.reply_text ?? '',
    truncated:          playing.truncated,
    model_tier_applied: playing.model_tier_applied ?? undefined,
    approx_tokens:      playing.approx_tokens ?? undefined,
    updated_at:         playing.created_at,
  }
}

/** A numnum playing, as the extraction it shows for `currentText` */
function ishesFrom(playing: PlayingT, currentText: string): IshesDNA {
  if (playing.status === 'error') { return errorFrom(playing) }
  return {
    status:             'done',
    items:              playing.items ?? [],
    truncated:          playing.truncated,
    stale:              playing.asked_text !== currentText.trim(),
    model_tier_applied: playing.model_tier_applied ?? undefined,
    approx_tokens:      playing.approx_tokens ?? undefined,
    updated_at:         playing.created_at,
  }
}

/** A failed playing, as the error its cell shows */
function errorFrom(playing: PlayingT) {
  return { status: 'error' as const, message: playing.message ?? '', updated_at: playing.created_at }
}
