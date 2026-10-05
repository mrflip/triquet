'use client'

import _ from 'es-toolkit/compat'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useConvex, useMutation, useQuery } from 'convex/react'
import { api } from '../../convex/_generated/api'
import * as Actor from '../lib/actor'
import * as Alarms from '../lib/alarms'
import * as Approve from '../lib/approve'
import * as Labelmaker from '../lib/labelmaker'
import { AppNotices, RefusalNotices } from '../lib/notices'
import * as Postmortem from '../lib/postmortem'
import { noticeOf } from '../lib/refusals'
import type { QuizLabels } from '../lib/routes'
import { smithsOf, type ReviewedT, type HuntOpeningT, type ShallowHuntT, type ShallowRealmT, type SmithT } from '../lib/rows'
import { ValidatorKit } from '../lib/validator'
import { ActionValidators, type AffirmsDNA, type HuntActionDNA } from '../models/actions'
import type { QuizT } from '../models/quiz'
import type { WidgetT } from '../models/widget'
import { useRaiseAlarm } from './alarms'
import { useAffirms } from './use-affirms'
import { useIdent } from './use-ident'
import { holdThePage } from './page-hold'
import { useSession } from './use-session'
import * as HuntMirror from './hunt-mirror'
import { useHuntFeed } from './hunt-feed'
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
  /**
   * What this browser holds of itself on the hunt, as the server would verify it: who it is, the
   * hunt, its standing there, and the quiz on screen (null until it has arrived, or once it is
   * gone). What a view offers is decided from these, by the policies the server decides by
   * (`Approve`). Null until the hunt and who this browser is are both known.
   */
  claims:     Actor.QuizClaimsT | null
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
 * A quiz's label is unique across its hunt, and the realm only says where it was: a quiz since
 * moved to another realm is placed in that one, the realm the address names searched first
 * (`notes/decisions/urls.md`, rule 6). The quiz last found at this address is still placed when
 * it answers to another label now (relabelled, here or by someone else), with the label it
 * answers to, so the address can follow it rather than lose it.
 *
 * @param hunt - The hunt the labels name: undefined while it is on its way, null when there is none.
 * @param labels - The realm and quiz the address names.
 * @param shown - The quiz last found at this address; null for none.
 * @returns The realm and the quiz's row, or why there are none.
 *
 * @example placeIn(hunt, { realm: 'home', quiz: 'quiet_otter' }, null).quizRow?.title  // => 'Quiet Otter'
 * @example placeIn(hunt, { realm: 'home', quiz: 'princes' }, shown).movedTo  // => 'kings', after a relabel
 * @example placeIn(hunt, { realm: 'gone', quiz: 'quiet_otter' }, null).realm?.label  // => 'home'
 */
export function placeIn(hunt: ShallowHuntT | null | undefined, labels: Pick<QuizLabels, 'realm' | 'quiz'>, shown: string | null): Placing {
  const none = { realm: null, quizRow: null, movedTo: null }
  if (hunt === undefined) { return { finding: 'waiting', ...none } }
  const realms = _.sortBy(hunt?.realms ?? [], (realm) => (realm.label === labels.realm ? 0 : 1))
  for (const realm of realms) {
    const quizRow = Labelmaker.entityForLabel(realm.quizzes, labels.quiz)
    if (quizRow) { return { finding: 'placed', realm, quizRow, movedTo: null } }
  }
  for (const realm of realms) {
    const moved = realm.quizzes.find((row) => row._id === shown)
    if (moved) { return { finding: 'placed', realm, quizRow: moved, movedTo: moved.label } }
  }
  return { finding: 'missing', ...none }
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

/**
 * What this browser holds of itself on `hunt`, as the server would verify it (`Actor.claimsOn`),
 * with the quiz on screen as far as a policy reads it.
 *
 * @param actor - Who this browser is; null until that is known.
 * @param hunt - The hunt, as its screen holds it; null when there is none to hold, or it has not arrived.
 * @param locked - Whether the quiz on screen is locked; null when none is.
 * @returns The claims; null until both who and which hunt are known.
 *
 * @example claimsOf(actor, hunt, false)  // => { ...actor, hunt_id: hunt._id, standing: hunt.role, quiz: { locked: false } }
 */
export function claimsOf(actor: Actor.ActorT | null, hunt: Pick<ShallowHuntT, '_id' | 'role'> | null, locked: boolean | null): Actor.QuizClaimsT | null {
  if (actor === null || hunt === null) { return null }
  return { ...Actor.claimsOn(actor, hunt._id, hunt), quiz: locked === null ? null : { locked } }
}

/**
 * Why the policies refuse `action` from the holder of `claims`, judged as the server will judge it
 * once it has read it (`ActionValidators.huntAction`); null when they allow it. An action that does
 * not read as one is left to the server, which refuses it saying what is wrong with it.
 *
 * @example denialOf(claims, { kind: 'add_question' })  // => 'quizLocked', for a smith of a locked quiz
 * @example denialOf(claims, { kind: 'open_review', quiz_id })  // => null, for a reviewer
 */
export function denialOf(claims: Actor.QuizClaimsT, action: HuntActionDNA): Approve.Denialkind | null {
  const read = ActionValidators.huntAction.safeParse(action)
  if (! read.success) { return null }
  const verdict = Approve.verdictOn(read.data.kind, claims, read.data)
  return verdict === Approve.Allow ? null : verdict
}

/** The library before it has arrived: one list, so a render that has none hands on the same one */
const NoWidgets: readonly WidgetT[] = []

/**
 * The quiz `labels` names, live: the hunt as its screen holds it, the quiz whole, and its reviews,
 * kept current as they change here, in another tab, on another device, or at someone else's
 * hands; and every change written the moment it is dispatched. Someone not on the hunt is shown
 * none of it, only who could add them, and nothing more is asked for them.
 *
 * There is no save button and no save queue: a change goes to the server as soon as it is
 * dispatched, and the screen shows it once the server has it. Leaving the page before then asks
 * first. A change the server refuses writes nothing, and says why in `saveNotice` and in an alarm
 * (`useRaiseAlarm`), which the author sees wherever they are on the page. One the policies refuse
 * of the browser's own claims (`denialOf`) is not sent at all, and is said the same way. For a smith, every
 * reading of the hunt, whoever changed it, goes into its history (`useHuntFeed`, `HuntMirror`).
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
  const { actor, ident } = useIdent()
  const quizSeen = useQuiz(huntAffirms, quiz_id)
  const reviewsSeen = useQuery(api.reviews.forQuiz, quizAffirms === null || ! ready ? 'skip' : { affirms: quizAffirms })
  const library = useQuery(api.widgets.library, ready ? {} : 'skip')
  useHuntFeed(askable ? labels.hunt : null, huntAffirms, quiz_id, HuntMirror.noteReading)

  const finding = findingOf(opening, placing, quizSeen, reviewsSeen, library)
  const found = finding === 'found' && quizSeen ? { realm: placing.realm, quiz: quizSeen, reviews: reviewsSeen ?? [] } : { realm: null, quiz: null, reviews: [] }
  const locked = found.quiz?.locked ?? null
  const claims = useMemo(() => claimsOf(ident === null ? null : actor, hunt, locked), [actor, ident, hunt, locked])

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
  const latest = useRef({ affirms, claims, labels })
  useLayoutEffect(() => { latest.current = { affirms, claims, labels } })
  const convex = useConvex()

  const carryOut = useCallback(async (action: HuntActionDNA, { quietly = false }: CarryOutOptions = {}): Promise<boolean> => {
    const { affirms: there, claims: held, labels: place } = latest.current
    const standing = held?.standing ?? null
    if (there === null || held === null) {
      console.warn('Triquet: a change was not sent — the quiz is not open here yet', { action, ...place, standing })
      setSaveNotice(AppNotices.changeNotSent)
      if (! quietly) { raise({ headline: AppNotices.changeNotKept, notice: AppNotices.changeNotSent, request_id: null }) }
      return false
    }
    // A view offers only what the policies allow, so one refused here is a view that offered what
    // it should not, or held a draft across a change that took it away (the quiz locked under a
    // field being typed into): said in the console as a bug, never sent, and the author told what
    // the server would have told them.
    const denial = denialOf(held, action)
    if (denial !== null) {
      Postmortem.report(`send a change (${action.kind})`, new Approve.NotApprovedError(denial, { policy: action.kind }), { action, ...place, standing })
      setSaveNotice(RefusalNotices[denial])
      if (! quietly) { raise({ headline: AppNotices.changeNotKept, notice: RefusalNotices[denial], request_id: null }) }
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
        Postmortem.report(`keep a change (${action.kind})`, err, { action, ...place, standing, connection: { isWebSocketConnected, connectionRetries, inflightMutations } })
        setSaveNotice(noticeOf(err))
        if (! quietly) { raise(Alarms.of(AppNotices.changeNotKept, err)) }
        return false
      } finally {
        setWriting((was) => was - 1)
        holdThePage(false)
      }
    }
    const work = write()
    HuntMirror.trackWrite(work)
    return await work
  }, [perform, convex, raise])

  const dispatch = useCallback((action: HuntActionDNA) => { void carryOut(action) }, [carryOut])

  return { finding, hunt, ...found, library: library ?? NoWidgets, claims, smiths: smithsFor(opening), unsaved: writing > 0, saveNotice, dispatch, carryOut, movedTo: finding === 'found' ? placing.movedTo : null }
}
