import type * as Z from 'zod'
import { Validator } from '../lib/validator'
import { AskValidators, ModelTierVals, askError, type LastErrT } from './ask'
import type { GuessDoneT, GuessT } from './guess'
import { IshValidators, IshesPerTextMax, type IshesDoneT, type IshesT, type IshItemT } from './ish'
import { BotLabelVals, type BotLabel } from './bot-label'
import type { QuestionT } from './question'
import { TextkindVals, type Textkind } from '../lib/ask/contract'

/** How an ask came out: with a reply, or with a failure */
export const BottingStatusVals = ['done', 'error'] as const
export type BottingStatus = typeof BottingStatusVals[number]

export const BottingValidators = Validator(({ obj, arr, oneof, bool, textish, noteish, zid }) => {
  const items = arr(IshValidators.ishItem).max(IshesPerTextMax)
    .describe('A numnum reply: every number-like span it found, in the order they appear in the text asked. Empty for any other botting.')
  const { response } = AskValidators.lastErr.shape

  const row = obj({
    question_id:        zid('questions')
      .describe('The question whose text was put to the bot.'),
    bot_label:       oneof(BotLabelVals)
      .describe('Which bot was asked.'),
    textkind:           oneof(TextkindVals)
      .describe('Which of the question\'s texts was put to the bot.'),
    asked_text:         textish.nullable()
      .describe('That text, trimmed, exactly as put; null when it is not known.'),
    status:             oneof(BottingStatusVals)
      .describe('Whether the ask came back with a reply or with a failure.'),
    reply_text:         textish.nullable()
      .describe('A dumdum reply, verbatim and untrimmed.'),
    items,
    message:            noteish.nullable()
      .describe('Why the ask failed, in the author\'s words.'),
    response:           response.nullable(),
    truncated:          bool
      .describe('True when the reply was cut short before it finished.'),
    model_tier_applied: oneof(ModelTierVals).nullable()
      .describe('Which tier answered, when one did.'),
    approx_tokens:      AskValidators.approxTokens.nullable(),
  })
    .describe('One time a bot was put one of a question\'s texts, and what came back, as the database holds it. When it was asked is the row\'s own `_creationTime`.')

  return { items, response, row }
})

/**
 * One time a bot was put one of a question's texts, and what came back, as a row's fields. It
 * names its question by the question's id in the tree.
 */
export type BottingT = Omit<Z.output<typeof BottingValidators.row>, 'question_id'> & { question_id: string }

/** A botting the database holds: its fields, and when it was written, in epoch milliseconds (with a fraction) */
export type RecordedBottingT = BottingT & { _creationTime: number }

/** One of a question's played cells: which bot, shown which of its texts, and the field it shows in */
export type BotSlot = {
  bot_label: BotLabel
  textkind:     Textkind
  field:        'guess' | 'clueing_ishes' | 'hint_ishes'
}

/** Every played cell a question has, in the order the grid shows them */
export const BotSlots = [
  { bot_label: 'dumdum', textkind: 'clueing', field: 'guess' },
  { bot_label: 'numnum', textkind: 'clueing', field: 'clueing_ishes' },
  { bot_label: 'numnum', textkind: 'hint',    field: 'hint_ishes' },
] as const satisfies readonly BotSlot[]

/**
 * Which cell a botting belongs to, as one string.
 *
 * @example slotkeyOf({ question_id: 'q1', bot_label: 'dumdum', textkind: 'clueing' })  // => 'q1:dumdum:clueing'
 */
export function slotkeyOf(botting: Pick<BottingT, 'question_id' | 'bot_label' | 'textkind'>): string {
  return `${botting.question_id}:${botting.bot_label}:${botting.textkind}`
}

/** What the grid needs to know about one cell's history: its newest result, and any failure since */
export type SlotLatest = {
  /** The newest successful botting, if there ever was one */
  done:   RecordedBottingT | null
  /** The newest failed botting, only when it is newer than every success */
  failed: RecordedBottingT | null
}

/**
 * The results a question shows in its played cells, from each cell's history.
 *
 * A number-spotting result is stale when the text it was asked about is no longer the text the
 * question holds. A failure since the newest result rides along as its `last_err`; a cell that
 * has only ever failed shows the failure; a cell with no botting is null.
 *
 * @param question - The question's own fields, as stored.
 * @param latest - Each cell's history, by `slotkeyOf`.
 * @returns The `guess`, `clueing_ishes` and `hint_ishes` fields for that question.
 */
export function resultsFor(
  question: Pick<QuestionT, '_id' | 'clueing' | 'hint'>,
  latest: ReadonlyMap<string, SlotLatest>,
): Pick<QuestionT, 'guess' | 'clueing_ishes' | 'hint_ishes'> {
  const historyOf = (slot: BotSlot) => latest.get(slotkeyOf({ question_id: question._id, ...slot }))
  return {
    guess:         guessFrom(historyOf(BotSlots[0])),
    clueing_ishes: ishesFrom(historyOf(BotSlots[1]), question.clueing),
    hint_ishes:    ishesFrom(historyOf(BotSlots[2]), question.hint),
  }
}

/**
 * The bottings a question is holding that are newer than anything already recorded.
 *
 * A cell whose result, or whose failure, is no newer than what was recorded yields nothing, so
 * offering the same question twice records nothing the second time; an empty cell yields
 * nothing either. A result and a failure riding on it are recorded as two bottings.
 *
 * @param question - The question as the author now has it.
 * @param recordedAt - When each cell's newest recorded botting was made, by `slotkeyOf`; a cell absent has none.
 * @returns The new bottings, one per result and one per failure.
 */
export function unrecordedBottings(question: QuestionT, recordedAt: ReadonlyMap<string, number>): BottingT[] {
  return BotSlots.flatMap((slot) => {
    const result = question[slot.field]
    if (result === null) { return [] }
    const recorded = recordedAt.get(slotkeyOf({ question_id: question._id, ...slot })) ?? 0
    const err = result.last_err
    return [
      ...(result.status === 'done' && result.updated_at > recorded ? [doneFrom(question, slot, result)] : []),
      ...(err && err.at > recorded ? [failedFrom(question, slot, err)] : []),
    ]
  })
}

/** A row with nothing filled in yet, for `slot` of `question` */
function blankBotting(question: QuestionT, slot: BotSlot): BottingT {
  return {
    question_id:        question._id,
    bot_label:       slot.bot_label,
    textkind:           slot.textkind,
    asked_text:         question[slot.textkind].trim(),
    status:             'done',
    reply_text:         null,
    items:              [],
    message:            null,
    response:           null,
    truncated:          false,
    model_tier_applied: null,
    approx_tokens:      null,
  }
}

/** A successful result found in one of `question`'s cells, as a botting */
function doneFrom(question: QuestionT, slot: BotSlot, result: GuessDoneT | IshesDoneT): BottingT {
  const botting: BottingT = {
    ...blankBotting(question, slot),
    truncated:          result.truncated,
    model_tier_applied: result.model_tier_applied ?? null,
    approx_tokens:      result.approx_tokens ?? null,
  }
  if ('text' in result) { return { ...botting, reply_text: result.text } }
  // A result already marked stale was asked about some earlier text, which is no longer known.
  return { ...botting, items: result.items, asked_text: result.stale ? null : botting.asked_text }
}

/** A failed ask, as a botting */
function failedFrom(question: QuestionT, slot: BotSlot, err: LastErrT): BottingT {
  return { ...blankBotting(question, slot), status: 'error', message: err.message, response: err.response }
}

/** When a botting was asked, in whole epoch milliseconds, as the tree's timestamps are */
function askedAt(botting: RecordedBottingT): number {
  return Math.floor(botting._creationTime)
}

/** The guess a cell's history comes to */
function guessFrom(history: SlotLatest | undefined): GuessT {
  if (! history) { return null }
  const { done, failed } = history
  if (! done) { return failed ? askError(lastErrOf(failed)) : null }
  return {
    status:             'done',
    text:               done.reply_text ?? '',
    truncated:          done.truncated,
    model_tier_applied: done.model_tier_applied ?? undefined,
    approx_tokens:      done.approx_tokens ?? undefined,
    updated_at:         askedAt(done),
    last_err:           failed ? lastErrOf(failed) : null,
  }
}

/** The extraction a cell's history comes to for `currentText` */
function ishesFrom(history: SlotLatest | undefined, currentText: string): IshesT {
  if (! history) { return null }
  const { done, failed } = history
  if (! done) { return failed ? askError(lastErrOf(failed)) : null }
  return {
    status:             'done',
    items:              done.items,
    truncated:          done.truncated,
    stale:              done.asked_text !== currentText.trim(),
    model_tier_applied: done.model_tier_applied ?? undefined,
    approx_tokens:      done.approx_tokens ?? undefined,
    updated_at:         askedAt(done),
    last_err:           failed ? lastErrOf(failed) : null,
  }
}

/** A failed botting, as the `last_err` its cell keeps */
function lastErrOf(botting: RecordedBottingT): LastErrT {
  return { message: botting.message ?? '', response: botting.response ?? null, at: askedAt(botting) }
}

/** What of a guess is shown to the outside world: whether there is an answer, and the answer */
export type ExposedGuess = { status: 'done', text: string } | { status: 'error' } | null

/** What of an extraction is shown to the outside world: whether there is one, its spans, and whether it is out of date */
export type ExposedIshes = { status: 'done', items: IshItemT[], stale: boolean } | { status: 'error' } | null

/**
 * A guess as the outside world sees it: the answer, and nothing about what it cost, which model
 * made it, when, or how a refresh of it failed.
 *
 * @param guess - What a question holds.
 * @returns Its exposed fields; null when never asked.
 *
 * @example exposeGuess({ status: 'done', text: 'Leon', ... })  // => { status: 'done', text: 'Leon' }
 */
export function exposeGuess(guess: GuessT): ExposedGuess {
  if (guess === null) { return null }
  return guess.status === 'done' ? { status: 'done', text: guess.text } : { status: 'error' }
}

/**
 * An extraction as the outside world sees it: the spans and whether they are stale, and nothing
 * about tokens, tiers, times or failures.
 *
 * @param ishes - What a question holds.
 * @returns Its exposed fields; null when never asked.
 */
export function exposeIshes(ishes: IshesT): ExposedIshes {
  if (ishes === null) { return null }
  return ishes.status === 'done' ? { status: 'done', items: ishes.items, stale: ishes.stale } : { status: 'error' }
}
