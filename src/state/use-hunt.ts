'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import _ from 'es-toolkit/compat'
import { useConvex, useMutation, useQuery } from 'convex/react'
import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'
import * as Labelmaker from '../lib/labelmaker'
import { noticeOf } from '../lib/refusals'
import type { QuizLabels } from '../lib/routes'
import { assembledQuiz, type CountedExpressionT, type ReviewedT, type SeenQuestionT, type ShallowHuntT, type ShallowRealmT } from '../lib/rows'
import { ValidatorKit } from '../lib/validator'
import type { HuntActionDNA, OpenQuizT } from '../models/actions'
import type { HuntRole } from '../models/hunting'
import type { QuizT } from '../models/quiz'
import type { MirrorSnapshot } from './commit-scheduler'
import { useBrowserKey } from './browser-key'
import { mirrorQuiz, trackWrite } from './quiz-mirror'
import { useQuiz } from './use-quiz'

/** Where finding the quiz an address names stands: still looking, looked and it is not there, or found */
export type Finding = 'waiting' | 'missing' | 'found'

export type HuntHandle = {
  /** Whether the quiz the labels name has been found, or is not there to find */
  finding:    Finding
  /** The hunt the labels name, as a quiz's screen holds it; null when there is none, or it has not arrived */
  hunt:       ShallowHuntT | null
  /** The realm the labels name; null when the hunt has no such realm, or has not arrived */
  realm:      ShallowRealmT | null
  /** The quiz the labels name, whole; null when the realm has no such quiz, or it has not arrived */
  quiz:       QuizT | null
  /** The quiz's reviews, every ident's, oldest first; empty until the quiz is found */
  reviews:    readonly ReviewedT[]
  /** What this browser's ident does on the hunt; null when it is not on it, or the hunt has not arrived */
  role:       HuntRole | null
  /** Whether a change dispatched here is still being written */
  unsaved:    boolean
  /** Why the last change could not be kept; null while all is well */
  saveNotice: string | null
  /** Carry out what the author did, on the quiz on screen */
  dispatch:   (action: HuntActionDNA) => void
  /** As `dispatch`, for a caller that goes on once the change has been written: whether it was kept */
  carryOut:   (action: HuntActionDNA) => Promise<boolean>
  /**
   * The label the open quiz answers to now, when that is no longer the one the address names
   * (it was relabelled, here or elsewhere): the address should follow it. Null otherwise.
   */
  movedTo:    string | null
}

/** A quiz's row, as its realm lists it */
type QuizRow = ShallowRealmT['quizzes'][number]

/** Where a quiz an address names stands in its hunt: the realm and quiz row, once found */
export type Placing =
  | { finding: 'waiting' | 'missing', realm: null, quizRow: null, movedTo: null }
  | { finding: 'placed', realm: ShallowRealmT, quizRow: QuizRow, movedTo: string | null }

/**
 * Where the realm and quiz `labels` name sit in `hunt`: placed, missing, or not known until the
 * hunt arrives. A quiz answers to the label in force for it; should two, the earlier made.
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
  return moved ? { finding: 'placed', realm, quizRow: moved, movedTo: Labelmaker.effectiveLabelOf(moved) } : { finding: 'missing', ...none }
}

/**
 * Where finding the quiz stands, once its place in the hunt is known: found once the quiz and its
 * reviews have arrived, missing when the quiz is not there after all (deleted a moment ago).
 */
function findingOf(placing: Placing, quiz: QuizT | null | undefined, reviews: readonly ReviewedT[] | undefined): Finding {
  if (placing.finding !== 'placed') { return placing.finding }
  if (quiz === undefined || reviews === undefined) { return 'waiting' }
  return quiz ? 'found' : 'missing'
}

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

/** An expression as a quiz's history holds it: without the usage count the screen shows beside it */
function uncounted(expressions: readonly CountedExpressionT[]): MirrorSnapshot['expressions'] {
  return expressions.map((expression) => _.omit(expression, ['usage']))
}

/** A watch on one question of the open quiz, and how to stop listening to it */
type QuestionWatch = { reading: () => SeenQuestionT | null | undefined, stop: () => void }

/**
 * Feed the open quiz's history from every reading of it, whoever made the change. Read through
 * watches rather than renders: the client tells a watch of a change before the change's own
 * mutation resolves, so a change is noted for the history by the time its writer hears it landed.
 * The quiz is its frame and a watch per question it orders, followed as the order changes; a
 * reading with a question still on its way is not noted.
 */
function useHistoryFeed(hunt_label: string, browser_key: string | null, quiz_id: Id<'quizzes'> | null): void {
  const convex = useConvex()
  useEffect(() => {
    if (quiz_id === null || browser_key === null) { return }
    const huntWatch = convex.watchQuery(api.hunts.open, { hunt_label, browser_key })
    const frameWatch = convex.watchQuery(api.quizzes.open, { quiz_id })
    const questionWatches = new Map<Id<'questions'>, QuestionWatch>()
    const last: { snapshot: MirrorSnapshot | null, counted: readonly CountedExpressionT[] | null } = { snapshot: null, counted: null }
    const note = () => {
      try {
        const hunt = huntWatch.localQueryResult()
        const frame = frameWatch.localQueryResult()
        const quiz = frame && assembledQuiz(frame, (question_id) => questionWatches.get(question_id)?.reading())
        const realm = hunt?.realms.find((each) => each.quizzes.some((row) => row._id === quiz_id))
        if (! hunt || ! quiz || ! realm) { return }
        const expressions = last.snapshot && hunt.expressions === last.counted ? last.snapshot.expressions : uncounted(hunt.expressions)
        const snapshot = { quiz, expressions, place: { hunt: Labelmaker.effectiveLabelOf(hunt), realm: realm.label } }
        mirrorQuiz(last.snapshot, snapshot)
        last.snapshot = snapshot
        last.counted = hunt.expressions
      } catch (err) {
        // A record that misses a reading is a smaller loss than a page that fails.
        console.error('Hunt: the quiz history missed a reading', err)
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
        const watch = convex.watchQuery(api.questions.open, { question_id })
        questionWatches.set(question_id, { reading: () => watch.localQueryResult(), stop: watch.onUpdate(note) })
      }
    }
    const stops = [huntWatch.onUpdate(note), frameWatch.onUpdate(() => { follow(); note() })]
    follow()
    note()
    return () => {
      for (const stop of stops) { stop() }
      for (const watch of questionWatches.values()) { watch.stop() }
    }
  }, [convex, hunt_label, browser_key, quiz_id])
}

/**
 * The quiz `labels` names, live: the hunt as its screen holds it, the quiz whole, and its reviews,
 * kept current as they change here, in another tab, on another device, or at someone else's
 * hands; and every change written the moment it is dispatched. For someone not on the hunt, the
 * hunt alone: its quiz is not read for them.
 *
 * There is no save button and no save queue: a change goes to the server as soon as it is
 * dispatched, and the screen shows it once the server has it. Leaving the page before then asks
 * first. A change the server refuses writes nothing, and says why in `saveNotice`. Every reading
 * of the open quiz, whoever changed it, goes into its history.
 *
 * @param labels - The hunt, realm and quiz the address names.
 * @returns The hunt, realm and quiz, a dispatcher, and why anything went wrong.
 */
export function useHunt(labels: QuizLabels): HuntHandle {
  const browser_key = useBrowserKey()
  const perform = useMutation(api.hunts.perform)
  const [saveNotice, setSaveNotice] = useState<string | null>(null)
  const [writing, setWriting] = useState(0)

  // A label that cannot be one names no hunt, and is not asked about.
  const askable = ValidatorKit.label.safeParse(labels.hunt).success
  const huntSeen = useQuery(api.hunts.open, askable && browser_key !== null ? { hunt_label: labels.hunt, browser_key } : 'skip')
  // The quiz last found at this address, so a relabel does not lose it: see `placeIn`.
  const address = `${labels.hunt}/${labels.realm}/${labels.quiz}`
  const [shown, setShown] = useState<{ address: string, quiz_id: string } | null>(null)
  const placing = placeIn(askable ? huntSeen : null, labels, shown?.address === address ? shown.quiz_id : null)
  // Someone not on the hunt is shown none of its quizzes, so none is read, or kept in their history.
  const quiz_id = huntSeen?.role ? placing.quizRow?._id ?? null : null
  const quizSeen = useQuiz(quiz_id)
  const reviewsSeen = useQuery(api.reviews.forQuiz, quiz_id === null ? 'skip' : { quiz_id })
  useHistoryFeed(labels.hunt, browser_key, askable ? quiz_id : null)

  const hunt = huntSeen ?? null
  const finding = findingOf(placing, quizSeen, reviewsSeen)
  const found = finding === 'found' && quizSeen ? { realm: placing.realm, quiz: quizSeen, reviews: reviewsSeen ?? [] } : { realm: null, quiz: null, reviews: [] }

  // Kept as React keeps state derived from a render: set during the render, which React redoes.
  const foundId = found.quiz?._id ?? null
  if (foundId !== null && (shown?.address !== address || shown.quiz_id !== foundId)) { setShown({ address, quiz_id: foundId }) }

  useEffect(() => {
    document.title = found.quiz?.title ? `${found.quiz.title} — Triquet` : 'Triquet'
  }, [found.quiz?.title])

  // Read by the dispatcher when it runs rather than when it was made, so it never goes stale.
  const open: OpenQuizT | null = hunt && found.realm && placing.quizRow ? { hunt_id: hunt._id, realm_id: found.realm._id, quiz_id: placing.quizRow._id } : null
  const latest = useRef({ open, browser_key })
  useEffect(() => { latest.current = { open, browser_key } })

  const carryOut = useCallback(async (action: HuntActionDNA): Promise<boolean> => {
    const { open: there, browser_key: key } = latest.current
    if (there === null || key === null) { return false }
    const write = async (): Promise<boolean> => {
      setWriting((was) => was + 1)
      holdThePage(true)
      try {
        // The client sends one browser's changes in the order they were made, and the server
        // carries each out against the rows as they then stand.
        await perform({ open: there, action, browser_key: key })
        setSaveNotice(null)
        return true
      } catch (err) {
        console.error('Hunt: a change could not be kept', action, err)
        setSaveNotice(noticeOf(err))
        return false
      } finally {
        setWriting((was) => was - 1)
        holdThePage(false)
      }
    }
    const work = write()
    trackWrite(work)
    return await work
  }, [perform])

  const dispatch = useCallback((action: HuntActionDNA) => { void carryOut(action) }, [carryOut])

  return { finding, hunt, ...found, role: hunt?.role ?? null, unsaved: writing > 0, saveNotice, dispatch, carryOut, movedTo: finding === 'found' ? placing.movedTo : null }
}
