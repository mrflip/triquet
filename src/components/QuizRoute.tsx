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
import { useCanonical } from './use-address'
import { Workbench } from './Workbench'

export type QuizRouteProps = {
  /** The org the address names; null for an old address, which names none */
  org:    string | null
  /** The hunt, realm and quiz the address names */
  labels: Routes.QuizLabels
  /** The mode the address opens the quiz in; null when it names the quiz alone */
  mode:   Routes.Mode | null
}

/**
 * What an address naming a quiz shows: the quiz, opened in its `mode`.
 *
 * A visitor who has not said who they are is sent to say so, and brought back here. An address
 * naming the quiz alone moves to the mode the visitor's role works in (`Hunting.modeFor`): a
 * smith's `!edit`, a reviewer's `!playtest` (`notes/decisions/urls.md`, rule 4). A visitor not on
 * the hunt, or one asking for a mode the policies would not let them use (`Hunting.mayOpen`: a
 * reviewer asking to work on it), is told which smiths to ask and what for, with the address left
 * as it is: the server shows them nothing more. An address naming no quiz says so, once the
 * server has had its say.
 *
 * Once the hunt says its org, the address moves to the form the quiz has now (`useCanonical`):
 * from an old address, another org, a stale realm, or the label the quiz had before it was
 * relabelled, here or elsewhere.
 */
export function QuizRoute({ org, labels, mode }: Readonly<QuizRouteProps>) {
  const router = useRouter()
  const { ident, loaded } = useIdent()
  const { finding, hunt, realm, quiz, library, claims, smiths, reviews, dispatch, carryOut, movedTo, saveNotice } = useHunt(org, labels)
  useShowHunt(hunt)

  useEffect(() => {
    if (loaded && ! ident) { router.replace(Routes.rootPath(`${location.pathname}${location.search}`)) }
  }, [loaded, ident, router])

  // The quiz's labels as they stand, once the hunt has arrived to say its org.
  const now = hunt && { org: hunt.org, hunt: hunt.label, realm: realm?.label ?? labels.realm, quiz: movedTo ?? labels.quiz }
  const opensIn = hunt && (mode ?? Hunting.modeFor(hunt.role))
  useCanonical(org === null ? null : Routes.quizPath({ org, ...labels }, mode ?? undefined), now && opensIn && Routes.quizPath(now, opensIn))

  if (! loaded || ! ident) { return <OpeningNotice notice={saveNotice} /> }
  // Said as soon as the hunt arrives, without waiting on a quiz this visitor will not be shown.
  if (finding === 'refused' || (claims !== null && mode !== null && ! Hunting.mayOpen(claims, mode))) {
    return <NotOnHunt playtestPath={now && Routes.quizPath(now, 'playtest')} ident={ident} claims={claims} smiths={smiths} />
  }
  if (finding === 'waiting') { return <OpeningNotice notice={saveNotice} /> }
  if (! hunt || ! realm || ! quiz || ! claims) { return <QuizNotFound org={org} labels={labels} hunt={hunt} /> }
  // On its way to the mode the visitor's role works in, or from an old address to the quiz's own.
  if (mode === null || org === null) { return <OpeningNotice notice={saveNotice} /> }
  if (mode === 'playtest') {
    return <ReviewScreen quiz={quiz} ident={ident} reviews={reviews} dispatch={dispatch} />
  }
  return <Workbench hunt={hunt} realm={realm} quiz={quiz} library={library} claims={claims} reviews={reviews} dispatch={dispatch} carryOut={carryOut} saveNotice={saveNotice} />
}
