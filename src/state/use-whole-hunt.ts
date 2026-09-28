'use client'

import { useEffect, useState } from 'react'
import { useConvex } from 'convex/react'
import { api } from '../../convex/_generated/api'
import type { ShallowHuntT } from '../lib/rows'
import type { HuntT } from '../models/hunt'
import type { QuizT } from '../models/quiz'

/**
 * `hunt`, every quiz whole, as the Export box emits it: asked for once, and again whenever the
 * hunt or the open quiz changes on screen, never subscribed to. A whole hunt is the largest thing
 * the app reads, and only the export needs it; asking again as the screen changes keeps the export
 * in step with what the author sees.
 *
 * @param hunt - The hunt, as the screen holds it.
 * @param openQuiz - The quiz on screen.
 * @returns The hunt, once the answer to the latest ask has arrived; until then the one before, or null.
 */
export function useWholeHunt(hunt: Pick<ShallowHuntT, '_id'>, openQuiz: QuizT): HuntT | null {
  const convex = useConvex()
  const [whole, setWhole] = useState<HuntT | null>(null)

  useEffect(() => {
    let current = true
    const ask = async () => {
      try {
        const read = await convex.query(api.hunts.whole, { hunt_id: hunt._id })
        if (current) { setWhole(read) }
      } catch (err) {
        console.error('Export: the hunt could not be read', err)
      }
    }
    void ask()
    return () => { current = false }
  }, [convex, hunt, openQuiz])

  return whole
}
