'use client'

import { useCallback, useState } from 'react'
import { askModel } from '../lib/ask/port'
import { bulkLandingsFor, bulkTargetsOf } from '../lib/ask/bulk'
import { AppNotices, AskFailureNotices, bulkRunFailedNotice } from '../lib/notices'
import { askError } from '../models/ask'
import type { AskReplyT, Textkind } from '../lib/ask/contract'
import type { GuessT } from '../models/guess'
import type { IshesT } from '../models/ish'
import type { QuestionT } from '../models/question'
import type { WorkspaceAction } from './workspace-reducer'

/** Which of a question's askable cells an ask is for */
export const AskkindVals = ['guess', 'clueing', 'hint'] as const
export type Askkind = typeof AskkindVals[number]

export type AskingHandle = {
  /** Whether an ask for this cell is in flight */
  asking: (question_id: string, askkind: Askkind) => boolean
  /** Start an ask; a cell with nothing to ask about is not asked about at all */
  ask:    (question: QuestionT, askkind: Askkind) => void
  /** Recalculate every clueing and hint in the quiz in one combined request */
  recalculateAll: (questions: readonly QuestionT[]) => void
  /** Whether a combined run is in flight; the toolbar button disables while it is */
  running:        boolean
  /** The one-off line the toolbar shows after a run that did not land */
  runNotice:      string | null
}

/** The text an ask is about, or '' when there is nothing to ask about */
export function askableTextOf(question: QuestionT, askkind: Askkind): string {
  if (askkind === 'hint') { return question.hint.trim() }
  return question.clueing.trim()
}

/** Which cell an ask belongs to, for the in-flight set */
export function askCellkey(question_id: string, askkind: Askkind): string {
  return `${question_id}:${askkind}`
}

/**
 * The asks currently in flight, and how to start one.
 *
 * "Thinking..." is a property of this moment, not of the quiz, so it is held here rather than
 * in the question -- null, a result and an error are the three states a question can be saved
 * in, and a fourth would have to be cleaned up after every reload.
 *
 * @param dispatch - How a finished ask reaches the quiz.
 * @returns Whether each cell is busy, how to ask, and how to hold a batch of cells busy.
 */
export function useAsking(dispatch: (action: WorkspaceAction) => void): AskingHandle {
  const [inFlight, setInFlight] = useState<ReadonlySet<string>>(new Set())
  const [running, setRunning] = useState(false)
  const [runNotice, setRunNotice] = useState<string | null>(null)

  const release = useCallback((cellkeys: readonly string[]) => {
    setInFlight((was) => {
      const without = new Set(was)
      for (const cellkey of cellkeys) { without.delete(cellkey) }
      return without
    })
  }, [])

  const hold = useCallback(async (cellkeys: readonly string[], run: () => Promise<void>): Promise<void> => {
    setInFlight((was) => new Set([...was, ...cellkeys]))
    try {
      await run()
    } finally {
      release(cellkeys)
    }
  }, [release])

  const ask = useCallback((question: QuestionT, askkind: Askkind) => {
    const text = askableTextOf(question, askkind)
    if (text === '') { return }
    void hold([askCellkey(question.id, askkind)], async () => {
      if (askkind === 'guess') {
        const reply = await askModel({ job: 'guess', clueing: text })
        dispatch({ kind: 'set_guess', question_id: question.id, guess: guessFrom(reply) })
        return
      }
      const textkind: Textkind = askkind
      const reply = await askModel({ job: 'ishes', textkind, text })
      dispatch({ kind: 'set_ishes', question_id: question.id, textkind, ishes: ishesFrom(reply) })
    })
  }, [dispatch, hold])

  const recalculateAll = useCallback((questions: readonly QuestionT[]) => {
    const targets = bulkTargetsOf(questions)
    if (targets.length === 0) {
      setRunNotice(AppNotices.nothingToRecalculate)
      return
    }
    setRunNotice(null)
    setRunning(true)
    const cellkeys = targets.map((target) => askCellkey(target.question_id, target.textkind))
    void hold(cellkeys, async () => {
      const reply = await askModel({ job: 'bulk_ishes', items: targets.map(({ key, text }) => ({ key, text })) })
      if (! reply.ok || reply.job !== 'bulk_ishes') {
        // Failure changes nothing: no cell is touched, and the notice says so.
        setRunNotice(bulkRunFailedNotice(AskFailureNotices[reply.ok ? 'unreadable' : reply.failurekind]))
        return
      }
      const updated_at = Date.now()
      dispatch({
        kind:     'apply_bulk_ishes',
        landings: bulkLandingsFor(targets, reply, updated_at),
        run:      { approx_tokens: reply.approx_tokens, text_count: reply.text_count, updated_at },
      })
    })
      .finally(() => { setRunning(false) })
  }, [dispatch, hold])

  return {
    asking: useCallback((question_id, askkind) => inFlight.has(askCellkey(question_id, askkind)), [inFlight]),
    ask,
    recalculateAll,
    running,
    runNotice,
  }
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

/** A reply read as the extraction it becomes */
function ishesFrom(reply: AskReplyT): IshesT {
  if (! reply.ok) { return askError(AskFailureNotices[reply.failurekind]) }
  if (reply.job !== 'ishes') { return askError(AskFailureNotices.unreadable) }
  return {
    status:             'done',
    items:              reply.items,
    truncated:          reply.truncated,
    stale:              false,
    model_tier_applied: reply.model_tier_applied,
    approx_tokens:      reply.approx_tokens,
    updated_at:         Date.now(),
  }
}
