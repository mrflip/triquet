import type { ConvexReactClient } from 'convex/react'
import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'
import * as Postmortem from '../lib/postmortem'
import type { ReviewedT } from '../lib/rows'
import type { HuntAffirmsDNA, QuizAffirmsDNA } from '../models/actions'
import type { QuizT } from '../models/quiz'
import { SignalGrainMs, type SignalT } from '../models/signal'

/*
 * How the feed of a smith's record of a hunt (`hunt-feed.ts`) reads the quizzes not on screen:
 * not by a watch of each, which the server reruns and resends whole at every write to the quiz, in
 * every smith's tab, but by one small watch of every quiz's change signal (`quizzes.signals`), and
 * a fetch of a quiz (`quizzes.whole`, and its reviews, `reviews.forQuiz`) once its signal moves.
 *
 * * A quiz is fetched first as soon as its signal has been heard, then again only once its signal
 *   has moved, and at most once every `fetchEveryMs`: a burst of writes costs a fetch or two. A
 *   signal that keeps moving has its quiz fetched all the same, `fetchEveryMs` after it began.
 * * A write that does not move a signal lands within `SignalGrainMs` of the signal it leaves
 *   standing. So a fetch holds every change a signal stands for only once it begins `settleMs`
 *   after the signal was seen to move; one begun sooner (the first, or one waited on) is followed
 *   by another.
 * * Nothing is fetched while the tab is hidden. A tab shown again fetches what moved meanwhile at
 *   once, the batch window waived.
 * * Waiting on the feed (`fetchNow`) fetches every quiz whose signal has moved at once, once.
 *
 * Times here are this browser's own clock, measured from what it saw, so another clock's skew
 * does not enter, but at one place: a signal heard for the first time cannot be dated by when it
 * was seen to move, so it is dated by its own time, against this clock, allowing it
 * `clockSlackMs` of skew. A signal older than that by this clock is taken as settled long ago.
 */

/** What the fetching is paced by, in milliseconds */
export type PaceT = {
  /** The least time between two fetches of one quiz, waived once when the tab is shown again */
  fetchEveryMs: number
  /** How long after a signal is seen to move a fetch must begin to hold every change it stands for: the grain, and time for a write in flight to land */
  settleMs:     number
  /** How far this browser's clock may be ahead of the server's, in dating a signal heard for the first time */
  clockSlackMs: number
}

/** The pace a feed fetches at: a quiz at most every minute and a half, history lagging by that much at most beyond the edit */
export const Pace: PaceT = { fetchEveryMs: 90_000, settleMs: SignalGrainMs + 3000, clockSlackMs: 10 * 60_000 }

/** What the fetching tells time by: this browser's clock, and a timer */
export type ClockT = {
  now:   () => number
  /** Run `work` in `ms`; returns how to call it off */
  after: (ms: number, work: () => void) => () => void
}

/** The clock of the page: `Date.now`, and `setTimeout` */
export const PageClock: ClockT = {
  now:   () => Date.now(),
  after: (ms, work) => {
    const timer = setTimeout(work, ms)
    return () => { clearTimeout(timer) }
  },
}

/** What a quiz's signal has been seen to say: its time (null for a quiz with none), and from when a fetch holds every change it stands for */
export type SeenSignalT = { changed_at: number | null, settledBy: number }

/**
 * How far a quiz has been fetched: when its last fetch began, when its last fetch that answered
 * began, whether one is under way, and when its signal was first seen to move since its last fetch
 * began (null if it has not).
 */
export type FetchedT = { tried: number | null, covered: number | null, inFlight: boolean, movedSince: number | null }

/**
 * What a quiz's signal is seen to say, now that it says `changed_at` (null for none): unchanged
 * when it says what it said; settled `settleMs` from now when it has moved; and, heard for the
 * first time, settled already when it is older than `settleMs` and `clockSlackMs` by this clock
 * (or there is none), else as though it had moved now.
 *
 * @param was - What it was seen to say before; undefined when it has not been heard.
 * @param changed_at - What it says now.
 * @param now - This browser's clock.
 * @param pace - The fetching's pace.
 *
 * @example seenNow(undefined, null, 9000, Pace)                   // => { changed_at: null, settledBy: 0 }
 * @example seenNow({ changed_at: 1, settledBy: 0 }, 2, 9000, Pace)  // => { changed_at: 2, settledBy: 9000 + Pace.settleMs }
 */
export function seenNow(was: SeenSignalT | undefined, changed_at: number | null, now: number, pace: PaceT): SeenSignalT {
  if (was) { return was.changed_at === changed_at ? was : { changed_at, settledBy: now + pace.settleMs } }
  const isLongAgo = changed_at === null || changed_at < now - pace.settleMs - pace.clockSlackMs
  return { changed_at, settledBy: isLongAgo ? 0 : now + pace.settleMs }
}

/**
 * Whether a quiz wants fetching: it has never been fetched, or its last fetch to answer began
 * before what its signal says had settled.
 *
 * @example isStale({ tried: 5, covered: 5, inFlight: false, movedSince: null }, { changed_at: 1, settledBy: 9 })  // => true
 */
export function isStale(fetched: FetchedT, seen: SeenSignalT): boolean {
  return fetched.covered === null || fetched.covered < seen.settledBy
}

/**
 * When a quiz is next to be fetched, or null when it is not: never, while a fetch of it is under
 * way or it holds what its signal says; at once (0) when it has never been tried; otherwise once
 * what its signal says has settled, but no later than `fetchEveryMs` after it was first seen to
 * move, so a signal that never stops moving still has its quiz fetched; and never sooner than
 * `fetchEveryMs` after its last try, unless the tab was shown (`shownAt`) since that try.
 *
 * @param fetched - How far it has been fetched.
 * @param seen - What its signal says.
 * @param shownAt - When the tab was last shown again; null if it has not been hidden.
 * @param pace - The fetching's pace.
 *
 * @example dueAt({ tried: null, covered: null, inFlight: false, movedSince: null }, { changed_at: 1, settledBy: 9 }, null, Pace)  // => 0
 * @example dueAt({ tried: 100, covered: 100, inFlight: false, movedSince: 150 }, { changed_at: 1, settledBy: 200 }, null, Pace)  // => 100 + Pace.fetchEveryMs
 */
export function dueAt(fetched: FetchedT, seen: SeenSignalT, shownAt: number | null, pace: PaceT): number | null {
  if (fetched.inFlight || ! isStale(fetched, seen)) { return null }
  if (fetched.tried === null) { return 0 }
  const waived = shownAt !== null && fetched.tried < shownAt
  const settled = fetched.movedSince === null ? seen.settledBy : Math.min(seen.settledBy, fetched.movedSince + pace.fetchEveryMs)
  return Math.max(settled, waived ? 0 : fetched.tried + pace.fetchEveryMs)
}

/** What a feed fetches through: the Convex client, or anything that fetches as it does */
export type FetcherT = Pick<ConvexReactClient, 'query'>

/** A quiz not on screen, read by fetching: as last fetched, whether its last fetch failed, whether one is awaited, and how to let it go */
export type FetchedQuizT = {
  /** The quiz whole as last fetched: undefined until one answers, null when it is gone or not this browser's to read */
  quiz:     () => QuizT | null | undefined
  /** Its reviews as last fetched; undefined until one answers */
  reviews:  () => ReviewedT[] | undefined
  /** Whether its last fetch failed */
  failed:   () => boolean
  /** Whether it has yet to answer: never fetched, or a fetch under way */
  awaiting: () => boolean
  /** Let it go: what a fetch under way brings is dropped */
  stop:     () => void
}

/** The fetching of a feed's quizzes not on screen */
export type HuntFetchingT = {
  /** Read `quiz_id` by fetching from now on, starting from `held` (what the screen last read of it, as of now) when there is that */
  source:   (quiz_id: Id<'quizzes'>, held: { quiz: QuizT, reviews: ReviewedT[] } | null) => FetchedQuizT
  /** Hear what the signals say now (undefined until they answer), and whether their watch fails */
  heard:    (signals: readonly SignalT[] | undefined, failing: boolean) => void
  /** Fetch every quiz that wants it and has not been tried since `since`, now, the batch window and the settling waived */
  fetchNow: (since: number) => void
  /** Stop: no more fetches, and nothing more handed on */
  stop:     () => void
}

/** What a fetching is set up with: who fetches, as whom, in which hunt, by what clock and pace, and what to tell of each fetch's answer */
export type FetchingSetupT = {
  client:    FetcherT
  affirms:   HuntAffirmsDNA
  hunt_label: string
  clock:     ClockT
  pace:      PaceT
  /** Told once a fetch has answered, or failed */
  onFetched: () => void
}

/** One quiz's fetching as held: how far it has been fetched, and what was fetched */
type HeldQuizT = FetchedT & {
  quiz:     QuizT | null | undefined
  reviews:  ReviewedT[] | undefined
  /** The JSON of what was last fetched, so an answer the same as the last keeps the same objects */
  json:     string | null
  failure:  string | null
  stopped:  boolean
}

/**
 * The fetching of a feed's quizzes not on screen (see above): each quiz the feed reads by
 * fetching is a `source`, fetched when its signal says, at the pace `setup.pace` sets.
 *
 * @example const fetching = huntFetching({ client, affirms, hunt_label, clock: PageClock, pace: Pace, onFetched: soon })
 */
export function huntFetching(setup: FetchingSetupT): HuntFetchingT {
  const { client, affirms, hunt_label, clock, pace, onFetched } = setup
  const seen = new Map<Id<'quizzes'>, SeenSignalT>()
  const held = new Map<Id<'quizzes'>, HeldQuizT>()
  const state = { heard: false, shownAt: null as number | null, cancel: null as (() => void) | null, stopped: false }

  const seenOf = (quiz_id: Id<'quizzes'>): SeenSignalT => seen.get(quiz_id) ?? { changed_at: null, settledBy: 0 }

  const fetchQuiz = async (quiz_id: Id<'quizzes'>, quiz: HeldQuizT): Promise<void> => {
    const began = clock.now()
    quiz.tried = began
    quiz.inFlight = true
    quiz.movedSince = null
    const answered = await fetchedWhole(client, { ...affirms, quiz_id })
    quiz.inFlight = false
    if (state.stopped || quiz.stopped) { return }
    if (answered.ok) {
      const json = JSON.stringify([answered.whole, answered.reviews])
      if (json !== quiz.json) {
        quiz.quiz = answered.whole
        quiz.reviews = answered.reviews
        quiz.json = json
      }
      quiz.covered = began
      quiz.failure = null
    } else {
      // A failure is reported once, until it says something else or a fetch answers again.
      const failure = answered.err instanceof Error ? answered.err.message : 'failed'
      if (failure !== quiz.failure) { Postmortem.report('fetch a quiz for the hunt\'s history', answered.err, { hunt: hunt_label, quiz_id }) }
      quiz.failure = failure
    }
    onFetched()
    plan()
  }

  // Fetch each quiz due by now, and set the timer for the next; nothing while the tab is hidden, or before the signals are heard.
  const plan = () => {
    state.cancel?.()
    state.cancel = null
    if (state.stopped || ! state.heard || ! isShown()) { return }
    const now = clock.now()
    const dues = held.entries().flatMap(([quiz_id, quiz]) => {
      const due = dueAt(quiz, seenOf(quiz_id), state.shownAt, pace)
      return due === null ? [] : [{ quiz_id, quiz, due }]
    }).toArray()
    for (const { quiz_id, quiz, due } of dues) {
      if (due <= now) { void fetchQuiz(quiz_id, quiz) }
    }
    const next = Math.min(...dues.filter(({ due }) => due > now).map(({ due }) => due))
    if (Number.isFinite(next)) { state.cancel = clock.after(next - now, plan) }
  }

  const onShown = () => {
    if (! isShown()) { return }
    state.shownAt = clock.now()
    plan()
  }
  if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') { document.addEventListener('visibilitychange', onShown) }

  return {
    source: (quiz_id, from) => {
      const now = clock.now()
      const quiz: HeldQuizT = from
        ? { tried: now, covered: now, inFlight: false, movedSince: null, quiz: from.quiz, reviews: from.reviews, json: JSON.stringify([from.quiz, from.reviews]), failure: null, stopped: false }
        : { tried: null, covered: null, inFlight: false, movedSince: null, quiz: undefined, reviews: undefined, json: null, failure: null, stopped: false }
      held.set(quiz_id, quiz)
      plan()
      return {
        quiz:     () => quiz.quiz,
        reviews:  () => quiz.reviews,
        failed:   () => quiz.failure !== null,
        awaiting: () => quiz.inFlight || (quiz.json === null && quiz.failure === null),
        stop:     () => {
          quiz.stopped = true
          if (held.get(quiz_id) === quiz) { held.delete(quiz_id) }
        },
      }
    },
    heard: (signals, failing) => {
      if (signals === undefined && ! failing) { return }
      // Signals that fail say nothing: each quiz stands as last seen, and one never seen is fetched once.
      if (signals !== undefined) {
        const now = clock.now()
        const told = new Map(signals.map((signal) => [signal.quiz_id, signal.changed_at]))
        const quiz_ids = new Set([...seen.keys(), ...told.keys()])
        for (const quiz_id of quiz_ids) {
          const was = seen.get(quiz_id)
          const next = seenNow(was, told.get(quiz_id) ?? null, now, pace)
          seen.set(quiz_id, next)
          const quiz = held.get(quiz_id)
          if (was && next !== was && quiz?.movedSince === null) { quiz.movedSince = now }
        }
      }
      state.heard = true
      plan()
    },
    fetchNow: (since) => {
      if (state.stopped) { return }
      for (const [quiz_id, quiz] of held) {
        const isTried = quiz.tried !== null && quiz.tried >= since
        if (! isTried && ! quiz.inFlight && isStale(quiz, seenOf(quiz_id))) { void fetchQuiz(quiz_id, quiz) }
      }
    },
    stop: () => {
      state.stopped = true
      state.cancel?.()
      state.cancel = null
      for (const quiz of held.values()) { quiz.stopped = true }
      held.clear()
      if (typeof document !== 'undefined' && typeof document.removeEventListener === 'function') { document.removeEventListener('visibilitychange', onShown) }
    },
  }
}

/** A quiz whole and its reviews, as fetched; or why they could not be */
type AnsweredT = { ok: true, whole: QuizT | null, reviews: ReviewedT[] } | { ok: false, err: unknown }

/** Fetch the quiz the affirms name, whole (`quizzes.whole`), and its reviews (`reviews.forQuiz`), together */
async function fetchedWhole(client: FetcherT, affirms: QuizAffirmsDNA): Promise<AnsweredT> {
  try {
    const [whole, reviews] = await Promise.all([client.query(api.quizzes.whole, { affirms }), client.query(api.reviews.forQuiz, { affirms })])
    return { ok: true, whole, reviews }
  } catch (err) {
    return { ok: false, err }
  }
}

/** Whether the page is shown: true where there is no page to hide */
function isShown(): boolean {
  return typeof document === 'undefined' || document.visibilityState !== 'hidden'
}
