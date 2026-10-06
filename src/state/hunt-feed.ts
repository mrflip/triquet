'use client'

import { useEffect, useRef } from 'react'
import { useConvex, type ConvexReactClient } from 'convex/react'
import type { FunctionArgs, FunctionReference, FunctionReturnType } from 'convex/server'
import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'
import * as Exporting from '../lib/exporting'
import * as Huntfiles from '../lib/huntfiles'
import * as Postmortem from '../lib/postmortem'
import { assembledQuiz, type ReviewedT, type ShallowHuntT, type ShallowRealmT } from '../lib/rows'
import type { HuntAffirmsDNA } from '../models/actions'
import { Question } from '../models/question'
import type { QuizT } from '../models/quiz'
import type { WidgetT } from '../models/widget'
import { useSession } from './use-session'

/*
 * The feed of a smith's record of a hunt: every file of the hunt's repository (`Huntfiles`), kept
 * current from watches at the grain of the files, whoever changed what and in whatever browser.
 *
 * * The hunt-level files (the hunt's own, its categories, its members) and the list of its quizzes
 *   come from the hunt (`hunts.open`); the widgets from the library (`widgets.library`), watched
 *   whole, since a widget's place is its place in the whole library.
 * * Each quiz is its own watches: the quiz whole (`quizzes.whole`, its file in one result) and its
 *   reviews (`reviews.forQuiz`). The quiz on screen is read instead as the screen reads it, its
 *   frame (`quizzes.open`) and a watch per question (`questions.open`), so the feed shares the
 *   screen's subscriptions and an author's edit sends one question, not the quiz.
 * * The watches follow the quiz list, opening a quiz's as it is listed and closing them as it goes.
 *   A quiz not on screen opens its watches only once the page has loaded and the browser is idle
 *   (`whenLoadedAndIdle`), so the screen's own reads come first.
 *
 * Every watch is sent the affirms the screen sends, so a watch the screen also holds is one
 * subscription. The Convex client applies every result of one moment together and tells each
 * watch in turn, so the feed reads once that moment's news is all in -- and not at once, but when
 * the browser is next idle, since making a hunt's files can take long enough (every quiz's, when
 * the library or the wheel changes) to hold up the screen showing the change that caused it.
 */

/** What the feed watches through: the Convex client, or anything that watches as it does */
export type WatcherT = Pick<ConvexReactClient, 'watchQuery'>

/** The key of the hunt-level part of a reading: the hunt's own file, its categories' and its members' */
export const HuntPartkey = 'hunt'

/** The key of the widgets' part of a reading: the library's widgets the quizzes work */
export const WidgetsPartkey = 'widgets'

/** The longest a reading is put off waiting for the browser to be idle, in milliseconds */
export const IdleWaitMs = 2000

/**
 * One part of a hunt's files, as one set of watches gives it: the hunt-level files; one quiz's
 * (its own, its questions alone, its shared reviews), with the quiz as read and the realm it sits
 * in; or the widgets the quizzes work.
 */
export type FedPartT =
  | { kind: 'hunt', files: Huntfiles.FilesT }
  | { kind: 'quiz', quiz: QuizT, realm: string, files: Huntfiles.FilesT }
  | { kind: 'widgets', files: Huntfiles.FilesT }

/** A quiz the hunt lists that could not be read, by where its files sit */
export type UnreadQuizT = { realm: string, label: string }

/**
 * The hunt's files as the feed last read them whole, by part and all together. A part whose files
 * are unchanged is the same object from one reading to the next.
 */
export type HuntReadingT = {
  /** The hunt as read: its id keys its repository, its branch the commits */
  hunt:  ShallowHuntT
  /** Each part's files: the hunt-level ones (`HuntPartkey`), each quiz's by its id, and the widgets' (`WidgetsPartkey`) */
  parts: ReadonlyMap<string, FedPartT>
  /** Every part's files together, by path: every file of the repository but its README */
  files: Huntfiles.FilesT
  /** True for the first reading the feed hands on: the hunt read whole for the first time, what a catch-up commit is made from */
  first: boolean
  /**
   * Each quiz the hunt lists that could not be read (its watch failed, or answered nothing), by
   * id, never read since the feed began: it has no part and no files here, which says nothing of
   * the files it has.
   */
  unread: ReadonlyMap<string, UnreadQuizT>
}

/** A running feed: which quiz the screen has open, how to have its news now, and how to stop */
export type HuntFeedT = {
  /** Read `quiz_id` as the screen reads it from now on, and every other quiz whole; null when no quiz is on screen */
  focus: (quiz_id: Id<'quizzes'> | null) => void
  /** Hand on, now, the reading put off for the browser's idle time, if there is one */
  settle: () => void
  /** Once every watch the feed holds has answered (a question just added among them), and the reading of it is handed on */
  whenRead: () => Promise<void>
  /** Close every watch; nothing more is handed on */
  stop:  () => void
}

/** What a feed is of: the hunt the screen opened, what the browser affirms of itself on it, and the quiz on screen */
export type FeedSetupT = {
  /** The org the address names; null for an old address, which names none (`hunts.open`) */
  orglabel:   string | null
  hunt_label: string
  affirms:    HuntAffirmsDNA
  focus:      Id<'quizzes'> | null
}

/** One watch as the feed holds it: its result, undefined until it arrives or while it fails; whether it fails; and how to close it */
type WatchedT<RT> = { result: () => RT | undefined, failed: () => boolean, stop: () => void }

/** One quiz read for its files: undefined until read whole, null when it is gone or not this browser's to read; whether a watch of it fails */
type QuizSourceT = { quiz: () => QuizT | null | undefined, failed: () => boolean, stop: () => void }

/** How a quiz is read: as the screen reads it (`live`), or whole in one result (`whole`) */
type Sourcekind = 'live' | 'whole'

/** A quiz's watches, and its part as last made, with what it was made from */
type QuizWatchesT = {
  sourcekind: Sourcekind
  source:     QuizSourceT
  reviews:    WatchedT<ReviewedT[]>
  held:       { inputs: readonly unknown[], part: FedPartT } | null
}

/**
 * The hunt-level part of the hunt's files: its own file, its categories' and its members', made
 * from the hunt alone.
 *
 * @example huntPartOf(hunt).files.keys().toArray()  // => ['hunt.tqh.json', 'hunt.tqh.tsv', 'categories.tqc.json', ...]
 */
export function huntPartOf(hunt: ShallowHuntT): FedPartT {
  return { kind: 'hunt', files: Huntfiles.filesOf(Exporting.huntLevelBalls({ hunt, wheel: hunt.wheel, members: hunt.members })) }
}

/**
 * One quiz's part of the hunt's files: its own file, its questions alone, and each shared
 * review's, the quiz run where it sits (over the library, in its realm, against the hunt's wheel).
 *
 * @param hunt - The hunt, as read.
 * @param library - The library, as read.
 * @param realm - The realm the quiz sits in.
 * @param quiz - The quiz, whole.
 * @param reviews - The quiz's reviews this browser reads; only the shared ones are written.
 *
 * @example quizPartOf(hunt, library, realm, quiz, reviews).files.keys().toArray()  // => ['quizzes/home/legends.tqq.json', ...]
 */
export function quizPartOf(hunt: ShallowHuntT, library: readonly WidgetT[], realm: ShallowRealmT, quiz: QuizT, reviews: readonly ReviewedT[]): FedPartT {
  const balls = Exporting.quizBallsIn({ hunt, wheel: hunt.wheel, members: hunt.members, library }, realm, quiz, reviews)
  return { kind: 'quiz', quiz, realm: realm.label, files: Huntfiles.filesOf(balls) }
}

/**
 * The widgets' part of the hunt's files: each widget of the library that any of `quizzes` works.
 *
 * @example widgetsPartOf(library, [quiz]).files.has('pub/widgets/dumdum.tqw.json')  // => true, for a quiz working dumdum
 */
export function widgetsPartOf(library: readonly WidgetT[], quizzes: readonly Pick<QuizT, 'widgetings'>[]): FedPartT {
  return { kind: 'widgets', files: Huntfiles.filesOf(Exporting.workedBalls(library, quizzes)) }
}

/** The feeds running in this tab */
const runningFeeds = new Set<HuntFeedT>()

/**
 * Hand on, now, every reading a running feed has put off for the browser's idle time: what the
 * history asks before it marks a moment, so the moment holds every change already seen.
 *
 * @example await writesLanded(); settleFeeds(); await scheduler.flush(hunt_id)
 */
export function settleFeeds(): void {
  for (const feed of runningFeeds) { feed.settle() }
}

/**
 * Once every running feed has heard from every watch it holds, and handed on its reading of that:
 * what the history waits for after a change of its own, whose news may need a watch it has only
 * just opened (a question the change added). Bounded by nothing, so a caller waits for it no
 * longer than it is willing to.
 *
 * @example await Promise.race([feedsRead(), delay(ReadWaitMs)])
 */
export async function feedsRead(): Promise<void> {
  await Promise.all(runningFeeds.values().map(async (feed) => { await feed.whenRead() }))
}

/**
 * Watch the hunt `setup` names, for a smith, and hand on its files whenever they change: first
 * once every quiz it lists has answered (`first`), then at each change from then on, whoever made
 * it. A quiz answers when it is read whole, or when it cannot be: its watch fails, or answers
 * nothing while still listed. A quiz that could not be read is handed on as `unread`, with no
 * files, so that one broken quiz never holds back the rest of the hunt. A quiz newly listed joins
 * the reading once it has been read; until then its files are neither written nor removed, and a
 * quiz read a moment ago stands as it was read while its watches change hands, or while its watch
 * fails. Nothing is handed on while the hunt does not show the browser as one sent every question
 * whole (`Question.isSentWhole`): gone, relabelled, or no longer a smith's.
 *
 * The quizzes not on screen are watched only once the page has loaded and the browser is idle (or
 * `IdleWaitMs` after the load at the latest), so the screen's own reads are not queued behind
 * them; until then nothing is handed on, since the first reading waits for every quiz. Waiting
 * for the feed to be read (`whenRead`) opens them at once. Each reading is made when the browser
 * is next idle (or `IdleWaitMs` at the latest), gathering whatever arrived meanwhile; `settle`
 * makes it at once.
 *
 * Fire-and-forget: a reading that fails is reported, never thrown, and the next change tries again.
 *
 * @param client - What to watch through: the Convex client.
 * @param setup - The hunt, what the browser affirms of itself on it, and the quiz on screen.
 * @param onReading - Handed each reading.
 * @returns The feed: to change the quiz on screen, to have its news now, and to stop.
 *
 * @example const feed = watchHunt(convex, { orglabel, hunt_label, affirms, focus: quiz_id }, (reading) => { scheduler.note(reading) })
 */
export function watchHunt(client: WatcherT, setup: FeedSetupT, onReading: (reading: HuntReadingT) => void): HuntFeedT {
  const { orglabel, hunt_label, affirms } = setup
  const state = { focused: setup.focus, stopped: false, cancel: null as (() => void) | null, last: null as HuntReadingT | null, opened: false, cancelOpen: null as (() => void) | null }
  const quizzes = new Map<Id<'quizzes'>, QuizWatchesT>()
  // Whoever waits for the feed to hear from every watch (`whenRead`).
  const waiters = new Set<() => void>()

  // Each watch's news is gathered, and read once the browser is idle after the moment it came in.
  const soon = () => {
    if (state.cancel !== null || state.stopped) { return }
    state.cancel = whenIdle(() => { note() })
  }
  const opening = watched(client, api.hunts.open, { orglabel, hunt_label }, soon, hunt_label)
  const library = watched(client, api.widgets.library, {}, soon, hunt_label)

  const sourceFor = (sourcekind: Sourcekind, quiz_id: Id<'quizzes'>): QuizSourceT => (sourcekind === 'live'
    ? liveSource(client, affirms, quiz_id, soon, hunt_label)
    : wholeSource(client, affirms, quiz_id, soon, hunt_label))

  // A quiz's watches for each quiz the hunt lists, read as `state.focused` says, and none for one it
  // does not, nor, until the page has loaded and gone idle (`state.opened`), for one not on screen.
  const follow = () => {
    const hunt = opening.result()?.hunt
    if (! hunt) { return }
    const listed = new Set(hunt.realms.flatMap((realm) => realm.quizzes.map((row) => row._id)))
    for (const [quiz_id, watches] of quizzes) {
      if (! listed.has(quiz_id)) { stopQuiz(quiz_id, watches) }
    }
    for (const quiz_id of listed) { followQuiz(quiz_id) }
  }

  // One listed quiz's watches, opened, moved between the two ways of reading it, or (for one not on
  // screen before the page has gone idle) closed.
  const followQuiz = (quiz_id: Id<'quizzes'>) => {
    const sourcekind: Sourcekind = quiz_id === state.focused ? 'live' : 'whole'
    const watches = quizzes.get(quiz_id)
    if (sourcekind === 'whole' && ! state.opened) {
      if (watches) { stopQuiz(quiz_id, watches) }
      return
    }
    if (! watches) {
      const reviews = watched(client, api.reviews.forQuiz, { affirms: { ...affirms, quiz_id } }, soon, hunt_label)
      quizzes.set(quiz_id, { sourcekind, source: sourceFor(sourcekind, quiz_id), reviews, held: null })
    } else if (watches.sourcekind !== sourcekind) {
      // The new watches open before the old close, and the quiz stands as last read meanwhile.
      const was = watches.source
      watches.source = sourceFor(sourcekind, quiz_id)
      watches.sourcekind = sourcekind
      was.stop()
    }
  }

  // Close a quiz's watches, and forget it.
  const stopQuiz = (quiz_id: Id<'quizzes'>, watches: QuizWatchesT) => {
    watches.source.stop()
    watches.reviews.stop()
    quizzes.delete(quiz_id)
  }

  // Open the watches of the quizzes not on screen, once, calling off the wait for the page if it is still waiting.
  const openAll = () => {
    if (state.opened || state.stopped) { return }
    state.opened = true
    state.cancelOpen?.()
    state.cancelOpen = null
    follow()
    soon()
  }

  // One quiz's part, made again only when what it is made from has changed.
  const quizPartFor = (hunt: ShallowHuntT, realm: ShallowRealmT, quiz_id: Id<'quizzes'>, widgets: readonly WidgetT[]): FedPartT | null => {
    const watches = quizzes.get(quiz_id)
    if (! watches) { return null }
    const quiz = watches.source.quiz()
    const reviews = watches.reviews.result()
    if (quiz && reviews) {
      const inputs = [quiz, reviews, widgets, placeKeyOf(hunt, realm)]
      if (! watches.held || ! isSameList(watches.held.inputs, inputs)) {
        watches.held = { inputs, part: keptIfSame(watches.held?.part, quizPartOf(hunt, widgets, realm, quiz, reviews)) }
      }
    }
    return watches.held?.part ?? null
  }

  // Whether a quiz with no part has answered that it cannot be read: a watch failing, or the quiz answering nothing.
  const isUnreadable = (quiz_id: Id<'quizzes'>): boolean => {
    const watches = quizzes.get(quiz_id)
    return watches !== undefined && (watches.source.failed() || watches.reviews.failed() || watches.source.quiz() === null)
  }

  // The hunt's files now, or null when there is nothing new to hand on.
  const readingNow = (): HuntReadingT | null => {
    const hunt = opening.result()?.hunt
    const widgets = library.result()
    if (! hunt || ! widgets || ! Question.isSentWhole(hunt.role)) { return null }
    const parts = new Map<string, FedPartT>([[HuntPartkey, keptIfSame(state.last?.parts.get(HuntPartkey), huntPartOf(hunt))]])
    const unread = new Map<string, UnreadQuizT>()
    const listed = hunt.realms.flatMap((realm) => realm.quizzes.map((row) => ({ realm, row })))
    for (const { realm, row } of listed) {
      const part = quizPartFor(hunt, realm, row._id, widgets)
      if (part) {
        parts.set(row._id, part)
      } else if (isUnreadable(row._id)) {
        unread.set(row._id, { realm: realm.label, label: row.label })
      }
    }
    const read = parts.values().flatMap((part) => (part.kind === 'quiz' ? [part.quiz] : [])).toArray()
    parts.set(WidgetsPartkey, keptIfSame(state.last?.parts.get(WidgetsPartkey), widgetsPartOf(widgets, read)))
    if (state.last ? isSameParts(state.last.parts, parts) : read.length + unread.size < listed.length) { return null }
    const files = new Map(parts.values().flatMap((part) => part.files))
    return { hunt, parts, files, first: state.last === null, unread }
  }

  // Whether a watch the feed holds has yet to answer: the hunt, the library, or any part of a listed quiz.
  const isAwaiting = (): boolean => {
    if (isQuiet(opening, opening.result()) || isQuiet(library, library.result())) { return true }
    const hunt = opening.result()?.hunt
    if (! hunt) { return false }
    return hunt.realms.some((realm) => realm.quizzes.some((row) => {
      const watches = quizzes.get(row._id)
      return ! watches || isQuiet(watches.source, watches.source.quiz()) || isQuiet(watches.reviews, watches.reviews.result())
    }))
  }

  // Let go of whoever waits, once there is nothing left to hear.
  const answerWaiters = (always: boolean) => {
    if (waiters.size === 0 || (! always && isAwaiting())) { return }
    for (const answer of waiters) { answer() }
    waiters.clear()
  }

  const note = () => {
    state.cancel = null
    if (state.stopped) { return }
    try {
      follow()
      const reading = readingNow()
      if (reading) {
        state.last = reading
        onReading(reading)
      }
      answerWaiters(false)
    } catch (err) {
      // A record that misses a reading is a smaller loss than a page that fails.
      Postmortem.report('note a reading of the hunt for its history', err, { hunt: hunt_label })
    }
  }

  const feed: HuntFeedT = {
    focus: (quiz_id) => {
      if (state.stopped || quiz_id === state.focused) { return }
      state.focused = quiz_id
      follow()
      soon()
    },
    settle: () => {
      if (state.cancel === null) { return }
      state.cancel()
      note()
    },
    whenRead: async () => {
      if (state.stopped) { return }
      openAll()
      const read = Promise.withResolvers<null>()
      waiters.add(() => { read.resolve(null) })
      state.cancel?.()
      note()
      await read.promise
    },
    stop: () => {
      answerWaiters(true)
      state.stopped = true
      state.cancel?.()
      state.cancel = null
      state.cancelOpen?.()
      state.cancelOpen = null
      runningFeeds.delete(feed)
      opening.stop()
      library.stop()
      for (const watches of quizzes.values()) {
        watches.source.stop()
        watches.reviews.stop()
      }
      quizzes.clear()
    },
  }
  runningFeeds.add(feed)
  follow()
  soon()
  state.cancelOpen = whenLoadedAndIdle(() => {
    state.cancelOpen = null
    openAll()
  })
  return feed
}

/**
 * Run `work` when the browser is next idle, or after `IdleWaitMs` at the latest; where there is no
 * idle callback, as soon as the tasks already queued have run. Returns how to call it off.
 */
function whenIdle(work: () => void): () => void {
  if (typeof requestIdleCallback === 'function') {
    const handle = requestIdleCallback(work, { timeout: IdleWaitMs })
    return () => { cancelIdleCallback(handle) }
  }
  const timer = setTimeout(work, 0)
  return () => { clearTimeout(timer) }
}

/**
 * Run `work` once the page has loaded and the browser is then idle (or `IdleWaitMs` after the load
 * at the latest); where there is no page, as `whenIdle` does. Returns how to call it off.
 */
function whenLoadedAndIdle(work: () => void): () => void {
  const held = { cancel: null as (() => void) | null }
  const idle = () => { held.cancel = whenIdle(work) }
  if (typeof document === 'undefined' || document.readyState === 'complete') {
    idle()
    return () => { held.cancel?.() }
  }
  window.addEventListener('load', idle, { once: true })
  return () => {
    window.removeEventListener('load', idle)
    held.cancel?.()
  }
}

/**
 * How long a feed is kept after the last screen of its hunt lets go of it, in milliseconds: long
 * enough for a move from one of the hunt's quizzes to another, which closes one screen as it opens
 * the next, to keep the feed rather than start it over.
 */
export const KeepMs = 10_000

/** A feed the screens of one hunt share: how many hold it, when it is let go once none does, and whom it hands its readings to */
type KeptFeedT = {
  feed:    HuntFeedT
  holders: number
  letGo:   ReturnType<typeof setTimeout> | null
  handler: { onReading: (reading: HuntReadingT) => void }
}

/** The feeds kept for screens, by the hunt and the affirms they were started with */
const keptFeeds = new Map<string, KeptFeedT>()

/**
 * The feed of the hunt of the org `orglabel` labelled `hunt_label`, for a smith of it (`watchHunt`): `onReading` is handed the
 * hunt's files once it has been read whole, and again at every change, whoever made it. Runs only
 * for a browser whose standing is sent every question whole; for anyone else, and until the
 * session and the affirms are known, it watches nothing. The quiz on screen is read through the
 * screen's own watches.
 *
 * One feed serves every screen of the hunt, and outlives a screen by `KeepMs`, so moving from one
 * of its quizzes to another moves the feed's focus rather than starting it over (which would read
 * the hunt whole again, and hand on another first reading).
 *
 * @param orglabel - The org the screen's address names; null for an old address, which names none.
 * @param hunt_label - The hunt the screen opened; null for none.
 * @param affirms - What this browser affirms of itself on the hunt (`useAffirms`); null until known.
 * @param open_quiz_id - The quiz on screen; null for none.
 * @param onReading - Handed each reading; the latest one given is the one called.
 */
export function useHuntFeed(orglabel: string | null, hunt_label: string | null, affirms: HuntAffirmsDNA | null, open_quiz_id: Id<'quizzes'> | null, onReading: (reading: HuntReadingT) => void): void {
  const convex = useConvex()
  const { ready } = useSession()
  const latest = useRef({ onReading, open_quiz_id })
  const feed = useRef<HuntFeedT | null>(null)
  useEffect(() => { latest.current = { onReading, open_quiz_id } })

  useEffect(() => {
    if (hunt_label === null || affirms === null || ! ready || ! Question.isSentWhole(affirms.standing)) { return }
    const feedkey = JSON.stringify([orglabel, hunt_label, affirms.ident_id, affirms.hunt_id, affirms.standing])
    const kept = keptFeeds.get(feedkey) ?? keepFeed(feedkey, convex, { orglabel, hunt_label, affirms, focus: latest.current.open_quiz_id })
    if (kept.letGo !== null) { clearTimeout(kept.letGo) }
    kept.letGo = null
    kept.holders += 1
    kept.handler.onReading = (reading) => { latest.current.onReading(reading) }
    kept.feed.focus(latest.current.open_quiz_id)
    feed.current = kept.feed
    return () => {
      feed.current = null
      kept.holders -= 1
      if (kept.holders > 0) { return }
      kept.letGo = setTimeout(() => {
        kept.feed.stop()
        keptFeeds.delete(feedkey)
      }, KeepMs)
    }
  }, [convex, orglabel, hunt_label, affirms, ready])

  useEffect(() => { feed.current?.focus(open_quiz_id) }, [open_quiz_id])
}

/** Start a feed for screens to share, held by none yet */
function keepFeed(feedkey: string, client: WatcherT, setup: FeedSetupT): KeptFeedT {
  const handler = { onReading: (_reading: HuntReadingT) => { /* Handed to the screen that holds it. */ } }
  const kept = { feed: watchHunt(client, setup, (reading) => { handler.onReading(reading) }), holders: 0, letGo: null, handler }
  keptFeeds.set(feedkey, kept)
  return kept
}

/**
 * A watch on `query` with `args`, telling `onUpdate` of each new result. A result the query threw
 * is reported and read as not yet arrived, so one failing watch holds its part as last read rather
 * than stopping the feed. A failure is reported once, until it says something else or the watch
 * reads cleanly again.
 */
function watched<QT extends FunctionReference<'query'>>(client: WatcherT, query: QT, args: FunctionArgs<QT>, onUpdate: () => void, hunt_label: string): WatchedT<FunctionReturnType<QT>> {
  const watch = client.watchQuery(query, args)
  const seen = { failure: null as string | null }
  const result = (): FunctionReturnType<QT> | undefined => {
    try {
      const read = watch.localQueryResult()
      seen.failure = null
      return read
    } catch (err) {
      // The client throws a new error at every read of one failed result, so a failure is known by what it says.
      const failure = String(err)
      if (failure !== seen.failure) { Postmortem.report('read a watch for the hunt\'s history', err, { hunt: hunt_label }) }
      seen.failure = failure
      return
    }
  }
  // Whether the last read failed: read again, so a watch read for the first time here is judged by its result now.
  const failed = () => {
    result()
    return seen.failure !== null
  }
  return { result, failed, stop: watch.onUpdate(onUpdate) }
}

/** A quiz read whole in one result (`quizzes.whole`) */
function wholeSource(client: WatcherT, affirms: HuntAffirmsDNA, quiz_id: Id<'quizzes'>, onUpdate: () => void, hunt_label: string): QuizSourceT {
  const whole = watched(client, api.quizzes.whole, { affirms: { ...affirms, quiz_id } }, onUpdate, hunt_label)
  return { quiz: whole.result, failed: whole.failed, stop: whole.stop }
}

/**
 * A quiz read as the screen reads it: its frame (`quizzes.open`), and a watch for each question
 * the frame orders (`questions.open`), followed as the order changes. Assembled again only when
 * the frame or a question's reading has changed, so an unchanged quiz is the same object.
 */
function liveSource(client: WatcherT, affirms: HuntAffirmsDNA, quiz_id: Id<'quizzes'>, onUpdate: () => void, hunt_label: string): QuizSourceT {
  const questions = new Map<Id<'questions'>, WatchedT<FunctionReturnType<typeof api.questions.open>>>()
  const follow = () => {
    const ordered = new Set(frame.result()?.row_ordering)
    for (const [question_id, watch] of questions) {
      if (ordered.has(question_id)) { continue }
      watch.stop()
      questions.delete(question_id)
    }
    for (const question_id of ordered) {
      if (questions.has(question_id)) { continue }
      questions.set(question_id, watched(client, api.questions.open, { question_id, affirms }, onUpdate, hunt_label))
    }
  }
  const frame = watched(client, api.quizzes.open, { affirms: { ...affirms, quiz_id } }, () => { follow(); onUpdate() }, hunt_label)
  follow()

  const held = { inputs: [] as readonly unknown[], quiz: undefined as QuizT | undefined }
  const quiz = () => {
    const read = frame.result()
    if (! read) { return read }
    const readings = read.row_ordering.map((question_id) => questions.get(question_id)?.result())
    const inputs = [read, ...readings]
    if (! isSameList(held.inputs, inputs)) {
      const readingFor = new Map(read.row_ordering.map((question_id, idx) => [question_id, readings[idx]]))
      held.inputs = inputs
      held.quiz = assembledQuiz(read, (question_id) => readingFor.get(question_id))
    }
    return held.quiz
  }
  const stop = () => {
    frame.stop()
    for (const watch of questions.values()) { watch.stop() }
    questions.clear()
  }
  const failed = () => frame.failed() || questions.values().some((watch) => watch.failed())
  return { quiz, failed, stop }
}

/** Whether a watch has yet to answer: nothing read from it, and no failure either */
function isQuiet(watch: Readonly<{ failed: () => boolean }>, read: unknown): boolean {
  return read === undefined && ! watch.failed()
}

/** What a quiz's run and its place among the files depend on of its hunt and realm, as one value to compare */
function placeKeyOf(hunt: ShallowHuntT, realm: ShallowRealmT): string {
  return JSON.stringify([hunt.org, hunt.label, hunt.title, hunt.wheel, realm.label, realm.title])
}

/** `next`, unless `prev` is a part of the same kind holding the same files: then `prev`, so an unchanged part keeps its identity */
function keptIfSame(prev: FedPartT | undefined, next: FedPartT): FedPartT {
  return prev?.kind === next.kind && Huntfiles.isSameFiles(prev.files, next.files) ? prev : next
}

/** Whether two lists hold the very same members, in order */
function isSameList(aa: readonly unknown[], bb: readonly unknown[]): boolean {
  return aa.length === bb.length && aa.every((each, idx) => each === bb[idx])
}

/** Whether two readings' parts are the very same, part for part */
function isSameParts(aa: ReadonlyMap<string, FedPartT>, bb: ReadonlyMap<string, FedPartT>): boolean {
  return aa.size === bb.size && bb.entries().every(([partkey, part]) => aa.get(partkey) === part)
}
