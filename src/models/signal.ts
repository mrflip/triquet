import type * as Z from 'zod'
import { Validator } from '../lib/validator'

/*
 * A quiz's **change signal**: one row per quiz, holding when its files last changed, as far as a
 * smith's history needs telling. Written only by the database's trigger (`convex/signalling.ts`),
 * read only by the signal's query function (`quizzes.signals`), so that a write moving it reruns
 * nothing else. A smith's browser watches the signals of every quiz of the hunt, and fetches a
 * quiz it does not have on screen only once its signal has moved (`src/state/hunt-fetching.ts`).
 */

/**
 * The grain of a change signal, in milliseconds: a write moves its quiz's signal only when the
 * signal last moved at least this long ago, so a burst of writes (a bot run) moves it once per
 * grain rather than once per write, and contends for its row as rarely. A write that does not move
 * it lands within this long of the signal it left standing, which is what a reader waits out
 * before it trusts a fetch to hold every change the signal stands for.
 */
export const SignalGrainMs = 5000

export const SignalValidators = Validator(({ obj, timestamp, zid }) => {
  const row = obj({
    hunt_id:    zid('hunts')
      .describe('The hunt the quiz belongs to: whose smiths are told of it.'),
    quiz_id:    zid('quizzes')
      .describe('The quiz: one signal each.'),
    changed_at: timestamp
      .describe('When the quiz\'s files last changed, in epoch milliseconds, to the grain of `SignalGrainMs`: a write landing within that long of it leaves it standing.'),
  })
    .describe('A quiz\'s change signal: when its files last changed, moved by every write that changes them, at most once per grain. Its own row, so that moving it reruns no reader of the quiz.')

  return { row }
})

export type SignalRowT = Z.output<typeof SignalValidators.row>

/** A quiz's signal as its query function sends it: which quiz, and when its files last changed */
export type SignalT = Pick<SignalRowT, 'quiz_id' | 'changed_at'>
