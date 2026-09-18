'use client'

import { useCallback, useState } from 'react'
import { askModel } from '../lib/ask/port'
import type { AskReplyT } from '../lib/ask/contract'
import { AskFailureNotices } from '../lib/notices'
import { askError } from '../models/ask'
import type { GuessT } from '../models/guess'
import type { QuestionT } from '../models/question'
import type { WorkspaceAction } from './workspace-reducer'

/** Which of a question's askable cells an ask is for */
export const AskkindVals = ['guess'] as const
export type Askkind = typeof AskkindVals[number]

export type AskingHandle = {
  /** Whether an ask for this cell is in flight */
  asking: (question_id: string, askkind: Askkind) => boolean
  /** Start an ask; a question with nothing to ask about is not asked about at all */
  ask:    (question: QuestionT, askkind: Askkind) => void
}

/** A reply read as the guess it becomes: an answer, or the author's sentence for the failure */
function guessFrom(reply: AskReplyT): GuessT {
  if (! reply.ok) { return askError(AskFailureNotices[reply.failurekind]) }
  if (reply.job !== 'guess') { return askError(AskFailureNotices.unreadable) }
  return {
    status:             'done',
    text:               reply.text,
    truncated:          reply.truncated,
    model_tier_applied: reply.model_tier_applied,
    approx_tokens:      reply.approx_tokens,
    updated_at:         Date.now(),
  }
}

/**
 * The asks currently in flight, and how to start one.
 *
 * "Thinking..." is a property of this moment, not of the round, so it is held here rather than
 * in the question -- null, a result and an error are the three states a question can be saved
 * in, and a fourth would have to be cleaned up after every reload.
 *
 * @param dispatch - How a finished ask reaches the round.
 * @returns Whether each cell is busy, and how to ask.
 */
export function useAsking(dispatch: (action: WorkspaceAction) => void): AskingHandle {
  const [inFlight, setInFlight] = useState<ReadonlySet<string>>(new Set())

  const ask = useCallback((question: QuestionT, askkind: Askkind) => {
    const cellkey = `${question.id}:${askkind}`
    const clueing = question.clueing.trim()
    if (clueing === '') { return }

    setInFlight((was) => new Set(was).add(cellkey))
    void askModel({ job: 'guess', clueing })
      .then((reply) => {
        dispatch({ kind: 'set_guess', question_id: question.id, guess: guessFrom(reply) })
      })
      .finally(() => {
        setInFlight((was) => {
          const without = new Set(was)
          without.delete(cellkey)
          return without
        })
      })
  }, [dispatch])

  return {
    asking: useCallback((question_id: string, askkind: Askkind) => inFlight.has(`${question_id}:${askkind}`), [inFlight]),
    ask,
  }
}
