'use client'

import { useCallback, useState } from 'react'
import { askModel } from '../lib/ask/port'
import * as Bulk from '../lib/ask/bulk'
import * as Errs from '../lib/ask/errs'
import { AibotFormulary, SeededAsks } from '../lib/formulary/aibot'
import * as Standins from '../lib/formulary/standins'
import { AppNotices } from '../lib/notices'
import type { AskFailedT, AskReplyT } from '../lib/ask/contract'
import type { Askjob } from '../lib/ask/errs'
import type { QuizBag, RunStep } from '../lib/formulary/runner'
import type { LastErrT } from '../models/ask'
import type { QuestionT } from '../models/question'
import type { HuntActionDNA } from '../models/actions'
import type { AibotWidgetT } from '../models/widget'
import type { WidgetingT } from '../models/widgeting'

/** A widgeting asked from the cell, and the `aibot` widget it works */
export type AskedStep = {
  widgeting: WidgetingT
  widget:    AibotWidgetT
}

export type AskingHandle = {
  /** Whether an ask for this widgeting's cell of this question is in flight */
  asking: (question_id: string, widgeting_label: string) => boolean
  /** Start an ask, from the question's bag; a cell with nothing to ask about is not asked about at all */
  ask:    (question_id: string, step: AskedStep, bag: QuizBag) => void
  /** Recalculate every clueing and hint in the quiz in one combined request, holding busy the cells of `steps` it fills */
  recalculateAll: (questions: readonly QuestionT[], steps: readonly RunStep[]) => void
  /** Whether a combined run is in flight; the toolbar button disables while it is */
  running:        boolean
  /** The one-off line the toolbar shows when there was nothing to run */
  runNotice:      string | null
  /** Why the last combined run did not land, for the toolbar and not for any cell */
  runFailure:     LastErrT | null
}

/** Which cell an ask belongs to, for the in-flight set */
function askCellkey(question_id: string, widgeting_label: string): string {
  return `${question_id}:${widgeting_label}`
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

  const ask = useCallback((question_id: string, { widgeting, widget }: AskedStep, bag: QuizBag) => {
    if (AibotFormulary.input(widget, bag).status !== 'ok') { return }
    void hold([askCellkey(question_id, widgeting.label)], async () => {
      const asked = await AibotFormulary.run(widget, widgeting, bag)
      if (asked === null) { return }
      dispatch({ kind: 'record_botting', botting: Standins.bottingOf(widget, question_id, asked) })
    })
  }, [dispatch, hold])

  const recalculateAll = useCallback((questions: readonly QuestionT[], steps: readonly RunStep[]) => {
    const targets = Bulk.bulkTargetsOf(questions)
    if (targets.length === 0) {
      setRunNotice(AppNotices.nothingToRecalculate)
      return
    }
    setRunNotice(null)
    setRunFailure(null)
    setRunning(true)
    // The run fills the number spotter's cells, whichever widgetings of the quiz show them.
    const labelsFor = (textkind: string) => steps
      .filter((step) => step.widget?.formulary === 'aibot' && SeededAsks[step.widget.label]?.job === 'ishes' && SeededAsks[step.widget.label]?.textkind === textkind)
      .map((step) => step.widgeting.label)
    const cellkeys = targets.flatMap((target) => labelsFor(target.textkind).map((label) => askCellkey(target.question_id, label)))
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
    asking: useCallback((question_id, widgeting_label) => inFlight.has(askCellkey(question_id, widgeting_label)), [inFlight]),
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
