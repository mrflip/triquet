'use client'

import { useCallback, useState } from 'react'
import { useConvex } from 'convex/react'
import { api } from '../../convex/_generated/api'
import * as Postmortem from '../lib/postmortem'
import type { ShallowHuntT } from '../lib/rows'
import type { HuntT } from '../models/hunt'
import type { QuizT } from '../models/quiz'
import { useAffirms } from './use-affirms'
import { useSession } from './use-session'

/** The Export box's hunt: what was read, whether a read is on its way, and how to ask for one */
export type WholeHuntAsk = {
  /** The hunt, every quiz whole, as read for the screen as it now stands; null until asked, and again once the screen changes */
  whole:   HuntT | null
  /** True while a read is on its way */
  asking:  boolean
  /** True when the last read, for the screen as it now stands, failed or found no such hunt */
  failed:  boolean
  /** Read the hunt now */
  prepare: () => void
}

/** The screen a read was asked for: the hunt and the open quiz, as the screen held them */
type Screen = { hunt: Pick<ShallowHuntT, '_id' | 'role'>, openQuiz: QuizT }

/** How the last read came out, and the screen it was for */
type Outcome = Screen & { whole: HuntT | null }

/**
 * `hunt`, every quiz whole, as the Export box emits it: read only when the author asks, never
 * subscribed to. A whole hunt is the largest thing the app reads, and only the export needs it.
 * A read holds only while the screen is the one it was read for: once the hunt or the open quiz
 * on screen changes, anyone's edit included, it is withdrawn, so the box never holds an export
 * behind what the author sees. An edit to another quiz of the hunt, which the screen does not
 * show, leaves it standing.
 *
 * @param hunt - The hunt, as the screen holds it.
 * @param openQuiz - The quiz on screen.
 * @returns The read, and a way to ask for one.
 */
export function useWholeHunt(hunt: Pick<ShallowHuntT, '_id' | 'role'>, openQuiz: QuizT): WholeHuntAsk {
  const convex = useConvex()
  const { ready } = useSession()
  const { huntAffirms: affirms } = useAffirms(hunt, null)
  const [outcome, setOutcome] = useState<Outcome | null>(null)
  const [asking, setAsking] = useState(false)

  const prepare = useCallback(() => {
    const ask = async () => {
      setAsking(true)
      try {
        const whole = ready && affirms !== null ? await convex.query(api.hunts.whole, { affirms }) : null
        setOutcome({ hunt, openQuiz, whole })
      } catch (err) {
        Postmortem.report('read the whole hunt for the export', err, { hunt_id: hunt._id })
        setOutcome({ hunt, openQuiz, whole: null })
      } finally {
        setAsking(false)
      }
    }
    void ask()
  }, [convex, ready, affirms, hunt, openQuiz])

  const current = outcome?.hunt === hunt && outcome.openQuiz === openQuiz ? outcome : null
  return { whole: current?.whole ?? null, asking, failed: current !== null && current.whole === null, prepare }
}
