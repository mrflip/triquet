'use client'

import { useCallback, useState } from 'react'
import { AibotFormulary } from '../lib/formulary/aibot'
import type { QuizBag } from '../lib/formulary/runner'
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
}

/** Which cell an ask belongs to, for the in-flight set */
function askCellkey(question_id: string, widgeting_label: string): string {
  return `${question_id}:${widgeting_label}`
}

/**
 * The asks currently in flight, and how to start one.
 *
 * "Thinking..." is a property of this moment, not of the quiz, so it is held here rather than
 * stored: what a cell holds is `ok`, `errored` or `missing`, and a fourth state would have to be
 * cleaned up after every reload.
 *
 * Whatever an ask comes to is recorded as the newest row in its cell (`record_widgeted`). A
 * failure never replaces a value the cell already has: it rides along on it, and any later
 * success leaves it behind.
 *
 * @param dispatch - How a finished ask reaches the quiz.
 * @returns Whether each cell is busy, and how to ask.
 */
export function useAsking(dispatch: (action: HuntActionDNA) => void): AskingHandle {
  const [inFlight, setInFlight] = useState<ReadonlySet<string>>(new Set())

  const ask = useCallback((question_id: string, { widgeting, widget }: AskedStep, bag: QuizBag) => {
    if (AibotFormulary.input(widget, bag).status !== 'ok') { return }
    const cellkey = askCellkey(question_id, widgeting.label)
    setInFlight((was) => new Set([...was, cellkey]))
    const run = async () => {
      try {
        const asked = await AibotFormulary.run(widget, widgeting, bag)
        if (asked === null) { return }
        dispatch({ kind: 'record_widgeted', widgeted: { question_id, widgeting_label: widgeting.label, ...asked.widgeted } })
      } finally {
        setInFlight((was) => new Set([...was].filter((held) => held !== cellkey)))
      }
    }
    void run()
  }, [dispatch])

  return {
    asking: useCallback((question_id, widgeting_label) => inFlight.has(askCellkey(question_id, widgeting_label)), [inFlight]),
    ask,
  }
}
