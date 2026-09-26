'use client'

import { useEffect, useEffectEvent, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useWorkspace } from '../state/use-workspace'
import * as Labelmaker from '../lib/labelmaker'
import * as Routes from '../lib/routes'
import styles from './workbench.module.css'

/**
 * Sends the author to the quiz they were last on, minting one when this workspace has none,
 * saying "Opening your quizzes…" meanwhile, or why they could not be opened.
 *
 * What the bare addresses -- `/` and `/my/quiz` -- do instead of showing anything. Each of them
 * sends once and never again: the workspace is a fresh object after every save and every
 * refetch, so an effect watching it would fire on each of those, and the page it lands on
 * dispatches as it opens, which announces another workspace. That is a redirect loop rather
 * than a redirect, so the body is an effect event and the guards are refs.
 *
 * A `#label` left over from when quizzes were addressed by hash is honoured on the way past, so
 * a window or bookmark from then still lands where it meant to.
 */
export function OpenQuizRedirect() {
  const router = useRouter()
  const { workspace, quiz, loaded, saveNotice, dispatch } = useWorkspace()
  // A string, so the effect below compares it by value rather than by the workspace's identity.
  const openLabel = quiz === null ? null : Labelmaker.effectiveLabelOf(quiz)
  const sent = useRef(false)
  const minted = useRef(false)

  const send = useEffectEvent(() => {
    if (sent.current) { return }
    if (openLabel === null) {
      // Nowhere to go yet. Minting announces a workspace that has somewhere, which brings us back.
      if (minted.current) { return }
      minted.current = true
      dispatch({ kind: 'new_quiz', label: Labelmaker.freshLabelFor(workspace.quizzes) })
      return
    }
    const legacy = location.hash.slice(1)
    const asked = legacy !== '' && Labelmaker.entityForLabel(workspace.quizzes, legacy) ? legacy : openLabel
    sent.current = true
    router.replace(Routes.quizPath(asked))
  })

  useEffect(() => {
    if (loaded) { send() }
  }, [loaded, openLabel])

  // On the way past, say what is happening, or why it stopped, rather than show nothing.
  return <main className={styles.page}><p className={styles.microcopy}>{saveNotice ?? 'Opening your quizzes…'}</p></main>
}
