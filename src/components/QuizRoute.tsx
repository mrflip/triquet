'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import * as Routes from '../lib/routes'
import { Hunting } from '../models/hunting'
import { useHunt } from '../state/use-hunt'
import { useIdent } from '../state/use-ident'
import { useShowHunt } from '../state/shown-hunt'
import { NotOnHunt } from './NotOnHunt'
import { OpeningNotice } from './SyncNotices'
import { QuizNotFound } from './QuizNotFound'
import { ReviewScreen } from './ReviewScreen'
import { Workbench } from './Workbench'

export type QuizRouteProps = {
  /** The hunt, realm and quiz the address names */
  labels: Routes.QuizLabels
  /** The presentation the address asks for; null when it asks for none */
  act:    Routes.Act | null
}

/**
 * What an address naming a quiz shows: the quiz, presented as its `act` asks.
 *
 * A visitor who has not said who they are is sent to say so, and brought back here. An address
 * that names no presentation is given the one the visitor's role on the hunt is shown: a smith
 * works the quiz, a reviewer reviews it. A visitor not on the hunt, or one asking for a
 * presentation the policies would not let them use (`Hunting.mayAct`: a reviewer asking to work
 * on it), is told which smiths to ask and what for, with the address left as it is: the server
 * shows them nothing more. An address naming no quiz says so, once the server has had its say;
 * one whose quiz is relabelled follows it.
 */
export function QuizRoute({ labels, act }: Readonly<QuizRouteProps>) {
  const router = useRouter()
  const { ident, loaded } = useIdent()
  const { finding, hunt, realm, quiz, library, claims, smiths, reviews, dispatch, carryOut, movedTo, unsaved, saveNotice } = useHunt(labels)
  useShowHunt(hunt)

  useEffect(() => {
    if (loaded && ! ident) { router.replace(Routes.rootPath(`${location.pathname}${location.search}`)) }
  }, [loaded, ident, router])

  useEffect(() => {
    if (act === null && hunt !== null) { router.replace(Routes.quizPath(labels, Hunting.actFor(hunt.role))) }
  }, [act, hunt, labels, router])

  // A quiz relabelled while it is open, here or elsewhere, takes its address with it.
  useEffect(() => {
    if (movedTo !== null) { router.replace(Routes.quizPath({ ...labels, quiz: movedTo }, act ?? undefined)) }
  }, [movedTo, labels, act, router])

  if (! loaded || ! ident) { return <OpeningNotice notice={saveNotice} /> }
  // Said as soon as the hunt arrives, without waiting on a quiz this visitor will not be shown.
  if (finding === 'refused' || (claims !== null && act !== null && ! Hunting.mayAct(claims, act))) {
    return <NotOnHunt labels={labels} ident={ident} claims={claims} smiths={smiths} />
  }
  if (finding === 'waiting') { return <OpeningNotice notice={saveNotice} /> }
  if (! hunt || ! realm || ! quiz || ! claims) { return <QuizNotFound labels={labels} hunt={hunt} /> }
  // On its way to the presentation the visitor's role is shown.
  if (act === null) { return <OpeningNotice notice={saveNotice} /> }
  if (act === 'review') {
    return <ReviewScreen quiz={quiz} ident={ident} reviews={reviews} dispatch={dispatch} unsaved={unsaved} />
  }
  return <Workbench hunt={hunt} realm={realm} quiz={quiz} library={library} claims={claims} reviews={reviews} dispatch={dispatch} carryOut={carryOut} unsaved={unsaved} saveNotice={saveNotice} />
}
