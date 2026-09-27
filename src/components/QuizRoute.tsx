'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { AppNotices } from '../lib/notices'
import * as Routes from '../lib/routes'
import { useHunt } from '../state/use-hunt'
import { useIdent } from '../state/use-ident'
import { OpeningNotice } from './SyncNotices'
import { QuizNotFound } from './QuizNotFound'
import { Workbench } from './Workbench'
import styles from './workbench.module.css'

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
 * that names no presentation is given one: for now everyone is a smith. An address naming no
 * quiz says so, once the server has had its say.
 */
export function QuizRoute({ labels, act }: Readonly<QuizRouteProps>) {
  const router = useRouter()
  const { ident, loaded } = useIdent()
  const { finding, hunt, realm, quiz, dispatch, unsaved, saveNotice } = useHunt(labels)

  useEffect(() => {
    if (loaded && ! ident) { router.replace(Routes.rootPath(`${location.pathname}${location.search}`)) }
  }, [loaded, ident, router])

  useEffect(() => {
    if (act === null) { router.replace(Routes.quizPath(labels, 'smith')) }
  }, [act, labels, router])

  if (! loaded || ! ident || act === null || finding === 'waiting') {
    return <OpeningNotice notice={saveNotice} />
  }
  if (! hunt || ! realm || ! quiz) { return <QuizNotFound labels={labels} hunt={hunt} /> }
  if (act === 'review') {
    return <main className={styles.page}><p className={styles.microcopy}>{AppNotices.reviewComingSoon}</p></main>
  }
  return <Workbench hunt={hunt} realm={realm} quiz={quiz} dispatch={dispatch} unsaved={unsaved} saveNotice={saveNotice} />
}
