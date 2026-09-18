'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useWorkspace } from '../state/use-workspace'
import { effectiveLabelOf } from '../lib/label-maker'

/** Sends the author straight to their first quiz -- minting one if this workspace somehow has none */
export default function HomePage() {
  const router = useRouter()
  const { workspace, loaded, dispatch } = useWorkspace()

  useEffect(() => {
    if (! loaded) { return }
    const first = workspace.quizzes[0]
    if (! first) { dispatch({ kind: 'new_quiz' }); return }
    router.replace(`/my/quiz/#${effectiveLabelOf(first)}`)
  }, [loaded, workspace, dispatch, router])

  return null
}
