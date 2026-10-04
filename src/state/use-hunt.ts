'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useConvex, useMutation, useQuery } from 'convex/react'
import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'
import * as Alarms from '../lib/alarms'
import * as Runner from '../lib/formulary/runner'
import * as Labelmaker from '../lib/labelmaker'
import { AppNotices } from '../lib/notices'
import * as Postmortem from '../lib/postmortem'
import { noticeOf } from '../lib/refusals'
import type { QuizLabels } from '../lib/routes'
import { assembledQuiz, smithsOf, type ReviewedT, type SeenQuestionT, type HuntOpeningT, type ShallowHuntT, type ShallowRealmT, type SmithT } from '../lib/rows'
import { ValidatorKit } from '../lib/validator'
import type { AffirmsDNA, HuntActionDNA, QuizAffirmsDNA } from '../models/actions'
import type { HuntRole } from '../models/hunting'
import type { QuizT } from '../models/quiz'
import type { WidgetT } from '../models/widget'
import type { MirrorSnapshot } from './commit-scheduler'
import { useRaiseAlarm } from './alarms'
import { useAffirms } from './use-affirms'
import { useSession } from './use-session'
import { mirrorQuiz, trackWrite } from './quiz-mirror'
import { useQuiz } from './use-quiz'

/**
 * Where finding the quiz an address names stands: still looking, looked and it is not there,
 * there but not this visitor's to see (they are not on its hunt), or found
 */
export type Finding = 'waiting' | 'missing' | 'refused' | 'found'

export type HuntHandle = {
  /** Whether the quiz the labels name has been found, is not there to find, or is not this visitor's to see */
  finding:    Finding
  /** The hunt the labels name, as a quiz's screen holds it; null when there is none, it is not this visitor's to see, or it has not arrived */
  hunt:       ShallowHuntT | null
  /** The realm the labels name; null when the hunt has no such realm, or has not arrived */
  realm:      ShallowRealmT | null
  /** The quiz the labels name, whole; null when the realm has no such quiz, or it has not arrived */
  quiz:       QuizT | null
  /** The library: every widget a quiz can put to work; empty until it has arrived */
  library:    readonly WidgetT[]
  /** The quiz's reviews this browser's ident may read (its own, and the shared ones), oldest first; empty until the quiz is found */
  reviews:    readonly ReviewedT[]
  /** What this browser's ident does on the hunt; null when it is not on it, or the hunt has not arrived */
  role:       HuntRole | null
  /** Who could put this visitor on the hunt, or make them a smith of it; empty until the hunt has arrived */
  smiths:     readonly SmithT[]
  /** Whether a change dispatched here is still being written */
  unsaved:    boolean
  /** Why the last change could not be kept; null while all is well */
  saveNotice: string | null
  /** Carry out what the author did, on the quiz on screen; a change not kept raises an alarm */
  dispatch:   (action: HuntActionDNA) => void
  /** As `dispatch`, for a caller that goes on once the change has been written: whether it was kept */
  carryOut:   (action: HuntActionDNA, options?: CarryOutOptions) => Promise<boolean>
  /**
   * The label the open quiz answers to now, when that is no longer the one the address names
   * (it was relabelled, here or elsewhere): the address should follow it. Null otherwise.
   */
  movedTo:    string | null
}

export type CarryOutOptions = {
  /** The caller says why a change was not kept itself, beside the field it came from (`saveNotice`): raise no alarm for it */
  quietly?: boolean
}

/** A quiz's row, as its realm lists it */
type QuizRow = ShallowRealmT['quizzes'][number]

/** Where a quiz an address names stands in its hunt: the realm and quiz row, once found */
export type Placing =
  | { finding: 'waiting' | 'missing', realm: null, quizRow: null, movedTo: null }
  | { finding: 'placed', realm: ShallowRealmT, quizRow: QuizRow, movedTo: string | null }

/**
 * Where the realm and quiz `labels` name sit in `hunt`: placed, missing, or not known until the
 * hunt arrives. A quiz answers to its label; should two, the earlier made.
 *
 * The quiz last found at this address is still placed when it answers to another label now
 * (relabelled, here or by someone else), with the label it answers to, so the address can follow
 * it rather than lose it.
 *
 * @param hunt - The hunt the labels name: undefined while it is on its way, null when there is none.
 * @param labels - The realm and quiz the address names.
 * @param shown - The quiz last found at this address; null for none.
 * @returns The realm and the quiz's row, or why there are none.
 *
 * @example placeIn(hunt, { realm: 'home', quiz: 'quiet_otter' }, null).quizRow?.title  // => 'Quiet Otter'
 * @example placeIn(hunt, { realm: 'home', quiz: 'princes' }, shown).movedTo  // => 'kings', after a relabel
 */
export function placeIn(hunt: ShallowHuntT | null | undefined, labels: Pick<QuizLabels, 'realm' | 'quiz'>, shown: string | null): Placing {
  const none = { realm: null, quizRow: null, movedTo: null }
  if (hunt === undefined) { return { finding: 'waiting', ...none } }
  const realm = hunt?.realms.find((each) => each.label === labels.realm)
  if (! realm) { return { finding: 'missing', ...none } }
  const quizRow = Labelmaker.entityForLabel(realm.quizzes, labels.quiz)
  if (quizRow) { return { finding: 'placed', realm, quizRow, movedTo: null } }
  const moved = realm.quizzes.find((row) => row._id === shown)
  return moved ? { finding: 'placed', realm, quizRow: moved, movedTo: moved.label } : { finding: 'missing', ...none }
}

/**
 * Where finding the quiz stands: refused when the server says the visitor is not on its hunt;
 * else, once its place in the hunt is known, found once the quiz, its reviews and the library have
 * arrived, missing when the quiz is not there after all (deleted a moment ago).
 */
function findingOf(opening: HuntOpeningT | undefined, placing: Placing, quiz: QuizT | null | undefined, reviews: readonly ReviewedT[] | undefined, library: readonly WidgetT[] | undefined): Finding {
  if (opening?.why === 'notOnHunt') { return 'refused' }
  if (placing.finding !== 'placed') { return placing.finding }
  if (quiz === undefined || reviews === undefined || library === undefined) { return 'waiting' }
  return quiz ? 'found' : 'missing'
}

/** Who could put the visitor on the hunt, or make them a smith of it: its smiths, as the server said them */
function smithsFor(opening: HuntOpeningT | undefined): readonly SmithT[] {
  if (opening?.why === 'notOnHunt') { return opening.smiths }
  return smithsOf(opening?.hunt?.members ?? [])
}

/** The library before it has arrived: one list, so a render that has none hands on the same one */
const NoWidgets: readonly WidgetT[] = []

/** How many changes this page is writing */
const Writing = { count: 0 }

/** Asks before the page is left, which would lose a change still being written */
function askBeforeLeaving(event: BeforeUnloadEvent): void {
  event.preventDefault()
}

/**
 * Hold the page while a change is written, and let it go once none is. Done at once rather than
 * after the next render, because a change is only a moment in the writing and the author may
 * leave in that moment.
 */
function holdThePage(holding: boolean): void {
  Writing.count += holding ? 1 : -1
  if (holding && Writing.count === 1) { addEventListener('beforeunload', askBeforeLeaving) }
  if (! holding && Writing.count === 0) { removeEventListener('beforeunload', askBeforeLeaving) }
}

/** A watch on one question of the open quiz, and how to stop listening to it */
type QuestionWatch = { reading: () => SeenQuestionT | null | undefined, stop: () => void }

/**
 * Feed the open quiz's history from every reading of it, whoever made the change. Read through
 * watches rather than renders: the client tells a watch of a change before the change's own
 * mutation resolves, so a change is noted for the history by the time its writer hears it landed.
 * The quiz is its frame and a watch per question it orders, followed as the order changes, with
 * the library its widgetings work; a reading with a question still on its way is not noted. Each
 * is the same watch the screen holds, sent the same affirms, so none is opened twice.
 */
function useHistoryFeed(hunt_label: string, ready: boolean, affirms: QuizAffirmsDNA | null): void {
  const convex = useConvex()
  useEffect(() => {
    if (affirms === null || ! ready) { return }
    const { quiz_id, ...huntAffirms } = affirms
    const huntWatch = convex.watchQuery(api.hunts.open, { hunt_label })
    const frameWatch = convex.watchQuery(api.quizzes.open, { affirms })
    const libraryWatch = convex.watchQuery(api.widgets.library, {})
    const questionWatches = new Map<Id<'questions'>, QuestionWatch>()
    const last: { snapshot: MirrorSnapshot | null } = { snapshot: null }
    const note = () => {
      try {
        const hunt = huntWatch.localQueryResult()?.hunt
        const frame = frameWatch.localQueryResult()
        const library = libraryWatch.localQueryResult()
        const quiz = frame && assembledQuiz(frame, (question_id) => questionWatches.get(question_id)?.reading())
        const realm = hunt?.realms.find((each) => each.quizzes.some((row) => row._id === quiz_id))
        if (! hunt || ! quiz || ! realm || ! library) { return }
        const snapshot = { quiz, library, place: Runner.placeOf(hunt, realm) }
        mirrorQuiz(last.snapshot, snapshot)
        last.snapshot = snapshot
      } catch (err) {
        // A record that misses a reading is a smaller loss than a page that fails.
        Postmortem.report('note a reading of the quiz for its history', err, { hunt: hunt_label, quiz_id })
      }
    }
    // A watch for each question the frame orders, and none for one it no longer does.
    const follow = () => {
      const ordered = new Set(frameWatch.localQueryResult()?.row_ordering)
      for (const [question_id, watch] of questionWatches) {
        if (ordered.has(question_id)) { continue }
        watch.stop()
        questionWatches.delete(question_id)
      }
      for (const question_id of ordered) {
        if (questionWatches.has(question_id)) { continue }
        const watch = convex.watchQuery(api.questions.open, { question_id, affirms: huntAffirms })
        questionWatches.set(question_id, { reading: () => watch.localQueryResult(), stop: watch.onUpdate(note) })
      }
    }
    const stops = [huntWatch.onUpdate(note), libraryWatch.onUpdate(note), frameWatch.onUpdate(() => { follow(); note() })]
    follow()
    note()
    return () => {
      for (const stop of stops) { stop() }
      for (const watch of questionWatches.values()) { watch.stop() }
    }
  }, [convex, hunt_label, ready, affirms])
}

/**
 * The quiz `labels` names, live: the hunt as its screen holds it, the quiz whole, and its reviews,
 * kept current as they change here, in another tab, on another device, or at someone else's
 * hands; and every change written the moment it is dispatched. Someone not on the hunt is shown
 * none of it, only who could add them, and nothing more is asked for them.
 *
 * There is no save button and no save queue: a change goes to the server as soon as it is
 * dispatched, and the screen shows it once the server has it. Leaving the page before then asks
 * first. A change the server refuses writes nothing, and says why in `saveNotice` and in an alarm
 * (`useRaiseAlarm`), which the author sees wherever they are on the page. Every reading
 * of the open quiz, whoever changed it, goes into its history.
 *
 * @param labels - The hunt, realm and quiz the address names.
 * @returns The hunt, realm and quiz, a dispatcher, and why anything went wrong.
 */
export function useHunt(labels: QuizLabels): HuntHandle {
  const { ready } = useSession()
  const perform = useMutation(api.hunts.perform)
  const raise = useRaiseAlarm()
  const [saveNotice, setSaveNotice] = useState<string | null>(null)
  const [writing, setWriting] = useState(0)

  // A label that cannot be one names no hunt, and is not asked about.
  const askable = ValidatorKit.label.safeParse(labels.hunt).success
  const opening = useQuery(api.hunts.open, askable && ready ? { hunt_label: labels.hunt } : 'skip')
  const hunt = opening?.hunt ?? null
  // The quiz last found at this address, so a relabel does not lose it: see `placeIn`.
  const address = `${labels.hunt}/${labels.realm}/${labels.quiz}`
  const [shown, setShown] = useState<{ address: string, quiz_id: string } | null>(null)
  const placing = placeIn(askable && opening === undefined ? undefined : hunt, labels, shown?.address === address ? shown.quiz_id : null)
  const quiz_id = placing.quizRow?._id ?? null
  // What this browser affirms of itself with every request about the quiz: see `useAffirms`.
  const { huntAffirms, quizAffirms } = useAffirms(hunt, quiz_id)
  const quizSeen = useQuiz(huntAffirms, quiz_id)
  const reviewsSeen = useQuery(api.reviews.forQuiz, quizAffirms === null || ! ready ? 'skip' : { affirms: quizAffirms })
  const library = useQuery(api.widgets.library, ready ? {} : 'skip')
  useHistoryFeed(labels.hunt, ready, askable ? quizAffirms : null)

  const finding = findingOf(opening, placing, quizSeen, reviewsSeen, library)
  const found = finding === 'found' && quizSeen ? { realm: placing.realm, quiz: quizSeen, reviews: reviewsSeen ?? [] } : { realm: null, quiz: null, reviews: [] }

  // Kept as React keeps state derived from a render: set during the render, which React redoes.
  const foundId = found.quiz?._id ?? null
  if (foundId !== null && (shown?.address !== address || shown.quiz_id !== foundId)) { setShown({ address, quiz_id: foundId }) }

  useEffect(() => {
    document.title = found.quiz?.title ? `${found.quiz.title} — Triquet` : 'Triquet'
  }, [found.quiz?.title])

  // Read by the dispatcher when it runs rather than when it was made, so it never goes stale.
  // Kept in a layout effect: every layout effect in the tree runs before any passive one, so a
  // screen that dispatches as it mounts (the review, opening itself) finds the quiz it is on.
  const affirms: AffirmsDNA | null = quizAffirms && found.realm ? { ...quizAffirms, realm_id: found.realm._id } : null
  const latest = useRef({ affirms, labels, role: hunt?.role ?? null })
  useLayoutEffect(() => { latest.current = { affirms, labels, role: hunt?.role ?? null } })
  const convex = useConvex()

  const carryOut = useCallback(async (action: HuntActionDNA, { quietly = false }: CarryOutOptions = {}): Promise<boolean> => {
    const { affirms: there, labels: place, role } = latest.current
    if (there === null) {
      console.warn('Triquet: a change was not sent — the quiz is not open here yet', { action, ...place, role })
      setSaveNotice(AppNotices.changeNotSent)
      if (! quietly) { raise({ headline: AppNotices.changeNotKept, notice: AppNotices.changeNotSent, request_id: null }) }
      return false
    }
    const write = async (): Promise<boolean> => {
      setWriting((was) => was + 1)
      holdThePage(true)
      try {
        // The client sends one browser's changes in the order they were made, and the server
        // carries each out against the rows as they then stand.
        await perform({ affirms: there, action })
        setSaveNotice(null)
        return true
      } catch (err) {
        const { isWebSocketConnected, connectionRetries, inflightMutations } = convex.connectionState()
        Postmortem.report(`keep a change (${action.kind})`, err, { action, ...place, role, connection: { isWebSocketConnected, connectionRetries, inflightMutations } })
        setSaveNotice(noticeOf(err))
        if (! quietly) { raise(Alarms.of(AppNotices.changeNotKept, err)) }
        return false
      } finally {
        setWriting((was) => was - 1)
        holdThePage(false)
      }
    }
    const work = write()
    trackWrite(work)
    return await work
  }, [perform, convex, raise])

  const dispatch = useCallback((action: HuntActionDNA) => { void carryOut(action) }, [carryOut])

  return { finding, hunt, ...found, library: library ?? NoWidgets, role: hunt?.role ?? null, smiths: smithsFor(opening), unsaved: writing > 0, saveNotice, dispatch, carryOut, movedTo: finding === 'found' ? placing.movedTo : null }
}
