'use client'

import { useCallback, useState } from 'react'
import { askModel } from '../lib/ask/port'
import * as Bottings from '../lib/ask/bottings'
import * as Bulk from '../lib/ask/bulk'
import * as Errs from '../lib/ask/errs'
import { BotForJob } from '../lib/ask/models'
import { AppNotices } from '../lib/notices'
import type { AskFailedT, AskReplyT, Textkind } from '../lib/ask/contract'
import type { Askjob } from '../lib/ask/errs'
import type { LastErrT } from '../models/ask'
import type { QuestionT } from '../models/question'
import type { HuntActionDNA } from '../models/actions'

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
  /** The one-off line the toolbar shows when there was nothing to run */
  runNotice:      string | null
  /** Why the last combined run did not land, for the toolbar and not for any cell */
  runFailure:     LastErrT | null
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
 * A failed ask never replaces a result the cell already has: it is recorded on the cell as its
 * `last_err`, and any later success clears it. A failed combined run touches no cell at all.
 *
 * @param dispatch - How a finished ask reaches the quiz.
 * @returns Whether each cell is busy, how to ask, and how to hold a batch of cells busy.
 */
export function useAsking(dispatch: (action: HuntActionDNA) => void): AskingHandle {
  const [inFlight, setInFlight] = useState<ReadonlySet<string>>(new Set())
  const [running, setRunning] = useState(false)
  const [runNotice, setRunNotice] = useState<string | null>(null)
  const [runFailure, setRunFailure] = useState<LastErrT | null>(null)

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
    void hold([askCellkey(question._id, askkind)], async () => {
      const job = askkind === 'guess' ? 'guess' : 'ishes'
      const textkind: Textkind = askkind === 'guess' ? 'clueing' : askkind
      const cell = { question_id: question._id, bot_label: BotForJob[job], textkind, asked_text: text }
      const reply = await askModel(job === 'guess' ? { job, clueing: text } : { job, textkind, text })
      const failed = Errs.failureOf(reply, job)
      const botting = failed === null && reply.ok && reply.job !== 'bulk_ishes' ? Bottings.bottingFor(cell, reply) : Bottings.failedBottingFor(cell, failed ?? Unreadable)
      dispatch({ kind: 'record_botting', botting })
    })
  }, [dispatch, hold])

  const recalculateAll = useCallback((questions: readonly QuestionT[]) => {
    const targets = Bulk.bulkTargetsOf(questions)
    if (targets.length === 0) {
      setRunNotice(AppNotices.nothingToRecalculate)
      return
    }
    setRunNotice(null)
    setRunFailure(null)
    setRunning(true)
    const cellkeys = targets.map((target) => askCellkey(target.question_id, target.textkind))
    void hold(cellkeys, async () => {
      const reply = await askModel({ job: 'bulk_ishes', items: targets.map(({ key, text }) => ({ key, text })) })
      if (! reply.ok || reply.job !== 'bulk_ishes') {
        // Failure changes nothing: no cell is touched, and the toolbar says so.
        setRunFailure(errFor(reply, 'bulk_ishes'))
        return
      }
      dispatch({
        kind:     'apply_bulk_ishes',
        bottings: Bulk.bulkBottingsFor(targets, reply),
        run:      { approx_tokens: reply.approx_tokens, text_count: reply.text_count, updated_at: Date.now() },
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
    runFailure,
  }
}

/** What a reply that could not be read amounts to */
const Unreadable: AskFailedT = { ok: false, failurekind: 'unreadable' }

/** The failure a reply amounts to, as the toolbar keeps it for a combined run */
function errFor(reply: AskReplyT, job: Askjob): LastErrT {
  return Errs.lastErrFor(Errs.failureOf(reply, job) ?? Unreadable)
}
