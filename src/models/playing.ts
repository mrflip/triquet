import { mintId } from '../lib/ids'
import type { PlayingRow } from '../db/schema'
import { askError, type LastErrT } from './ask'
import type { GuessDNA, GuessDoneT } from './guess'
import type { IshesDNA, IshesDoneT } from './ish'
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

/** What the grid needs to know about one cell's history: its newest result, and any failure since */
export type SlotLatest = {
  /** The newest successful playing, if there ever was one */
  done:   PlayingT | null
  /** The newest failed playing, only when it is newer than every success */
  failed: PlayingT | null
}

/**
 * The newest result and the newest failure since it, for each cell, from any pile of playings.
 *
 * A failure older than the newest success is history and no longer says anything about the cell.
 *
 * @param playings - Playings for any number of questions, in any order.
 * @returns Each cell's `SlotLatest`, by `slotkeyOf`.
 */
export function latestBySlot(playings: readonly PlayingT[]): Map<string, SlotLatest> {
  const done = new Map<string, PlayingT>()
  const failed = new Map<string, PlayingT>()
  for (const playing of playings) {
    const held = playing.status === 'done' ? done : failed
    const slotkey = slotkeyOf(playing)
    const newest = held.get(slotkey)
    if (! newest || playing.created_at > newest.created_at) { held.set(slotkey, playing) }
  }
  const latest = new Map<string, SlotLatest>()
  const slotkeys = new Set([...done.keys(), ...failed.keys()])
  for (const slotkey of slotkeys) {
    const newestDone = done.get(slotkey) ?? null
    const newestFailed = failed.get(slotkey) ?? null
    const since = newestFailed && (! newestDone || newestFailed.created_at > newestDone.created_at) ? newestFailed : null
    latest.set(slotkey, { done: newestDone, failed: since })
  }
  return latest
}

/**
 * The results a question shows in its played cells, from each cell's history.
 *
 * A number-spotting result is stale when the text it was asked about is no longer the text the
 * question holds. A failure since the newest result rides along as its `last_err`; a cell that
 * has only ever failed shows the failure; a cell with no playing is null.
 *
 * @param question - The question's own fields, as stored.
 * @param latest - Each cell's history, as `latestBySlot` gives it.
 * @returns The `guess`, `clueing_ishes` and `hint_ishes` fields for that question.
 */
export function resultsFor(
  question: Pick<QuestionT, 'id' | 'clueing' | 'hint'>,
  latest: ReadonlyMap<string, SlotLatest>,
): Pick<QuestionDNA, 'guess' | 'clueing_ishes' | 'hint_ishes'> {
  const historyOf = (slot: PlaySlot) => latest.get(slotkeyOf({ question_id: question.id, ...slot }))
  return {
    guess:         guessFrom(historyOf(PlaySlots[0])),
    clueing_ishes: ishesFrom(historyOf(PlaySlots[1]), question.clueing),
    hint_ishes:    ishesFrom(historyOf(PlaySlots[2]), question.hint),
  }
}

/**
 * The playings a question is holding that are newer than anything already recorded.
 *
 * A cell whose result, or whose failure, is no newer than what was recorded yields nothing, so
 * offering the same question twice records nothing the second time; an empty cell yields
 * nothing either. A result and a failure riding on it are recorded as two playings.
 *
 * @param question - The question as the author now has it.
 * @param recordedAt - When each cell's newest recorded playing was made, by `slotkeyOf`; a cell absent has none.
 * @param mint - Supplies each new playing's id.
 * @returns The new playings, one per result and one per failure.
 */
export function unrecordedPlayings(
  question: QuestionT,
  recordedAt: ReadonlyMap<string, number>,
  mint: () => string = mintId,
): PlayingT[] {
  return PlaySlots.flatMap((slot) => {
    const result = question[slot.field]
    if (result === null) { return [] }
    const recorded = recordedAt.get(slotkeyOf({ question_id: question.id, ...slot })) ?? 0
    const err = result.last_err
    return [
      ...(result.status === 'done' && result.updated_at > recorded ? [doneFrom(question, slot, result, mint())] : []),
      ...(err && err.at > recorded ? [failedFrom(question, slot, err, mint())] : []),
    ]
  })
}

/** A row with nothing filled in yet, for `slot` of `question` */
function blankPlaying(question: QuestionT, slot: PlaySlot, id: string, created_at: number): PlayingT {
  return {
    id,
    question_id:        question.id,
    player_label:       slot.player_label,
    textkind:           slot.textkind,
    asked_text:         question[slot.textkind].trim(),
    status:             'done',
    reply_text:         null,
    items:              null,
    message:            null,
    response:           null,
    truncated:          false,
    model_tier_applied: null,
    approx_tokens:      null,
    created_at,
  }
}

/** A successful result found in one of `question`'s cells, as a playing */
function doneFrom(question: QuestionT, slot: PlaySlot, result: GuessDoneT | IshesDoneT, id: string): PlayingT {
  const playing: PlayingT = {
    ...blankPlaying(question, slot, id, result.updated_at),
    truncated:          result.truncated,
    model_tier_applied: result.model_tier_applied ?? null,
    approx_tokens:      result.approx_tokens ?? null,
  }
  if ('text' in result) { return { ...playing, reply_text: result.text } }
  // A result already marked stale was asked about some earlier text, which is no longer known.
  return { ...playing, items: result.items, asked_text: result.stale ? null : playing.asked_text }
}

/** A failed ask, as a playing */
function failedFrom(question: QuestionT, slot: PlaySlot, err: LastErrT, id: string): PlayingT {
  return { ...blankPlaying(question, slot, id, err.at), status: 'error', message: err.message, response: err.response }
}

/** The guess a cell's history comes to */
function guessFrom(history: SlotLatest | undefined): GuessDNA {
  if (! history) { return null }
  const { done, failed } = history
  if (! done) { return failed ? askError(lastErrOf(failed)) : null }
  return {
    status:             'done',
    text:               done.reply_text ?? '',
    truncated:          done.truncated,
    model_tier_applied: done.model_tier_applied ?? undefined,
    approx_tokens:      done.approx_tokens ?? undefined,
    updated_at:         done.created_at,
    last_err:           failed ? lastErrOf(failed) : null,
  }
}

/** The extraction a cell's history comes to for `currentText` */
function ishesFrom(history: SlotLatest | undefined, currentText: string): IshesDNA {
  if (! history) { return null }
  const { done, failed } = history
  if (! done) { return failed ? askError(lastErrOf(failed)) : null }
  return {
    status:             'done',
    items:              done.items ?? [],
    truncated:          done.truncated,
    stale:              done.asked_text !== currentText.trim(),
    model_tier_applied: done.model_tier_applied ?? undefined,
    approx_tokens:      done.approx_tokens ?? undefined,
    updated_at:         done.created_at,
    last_err:           failed ? lastErrOf(failed) : null,
  }
}

/** A failed playing, as the `last_err` its cell keeps */
function lastErrOf(playing: PlayingT): LastErrT {
  return { message: playing.message ?? '', response: playing.response ?? null, at: playing.created_at }
}
