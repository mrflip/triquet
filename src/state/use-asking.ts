'use client'

import { useCallback, useState, useSyncExternalStore } from 'react'
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

/**
 * The asks in flight on one screen, as a row reads them (`useAskingIn`): the same object for the
 * life of the screen, telling only the rows whose asks begin or end.
 */
export type AsksT = {
  /** Be told whenever an ask begins or ends; the function handed back stops it */
  watch:      (listener: () => void) => () => void
  /** The labels of the widgetings whose cells of the question are being asked now, in the order asked, one to a line */
  labelsFor:  (question_id: string) => string
}

export type AskingHandle = {
  /** The asks in flight, for the rows to read (`useAskingIn`) */
  asks: AsksT
  /** Start an ask, from the question's bag; a cell with nothing to ask about is not asked about at all */
  ask:  (question_id: string, step: AskedStep, bag: QuizBag) => void
}

/** An ask in flight: which cell it belongs to */
type AskingT = { question_id: string, widgeting_label: string }

/** A screen's asks in flight, and how to begin and end one */
type AsksHeldT = AsksT & {
  begin: (asking: AskingT) => void
  end:   (asking: AskingT) => void
}

/** What stops a watch of asks that never change */
function unwatched(): void { /* nothing was watched */ }

/** Asks for a screen that asks nothing, as a preview: none is ever in flight */
export const NoAsks: AsksT = Object.freeze({ watch: () => unwatched, labelsFor: () => '' })

/** Whether an ask is of the same cell as `asking` */
function isCellOf(asking: AskingT): (other: AskingT) => boolean {
  return (other) => other.question_id === asking.question_id && other.widgeting_label === asking.widgeting_label
}

/** A screen's asks, none in flight yet */
function asksHeld(): AsksHeldT {
  const inFlight: AskingT[] = []
  const listeners = new Set<() => void>()
  const told = () => { for (const listener of listeners) { listener() } }
  return {
    watch: (listener) => {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
    labelsFor: (question_id) => inFlight.filter((asking) => asking.question_id === question_id).map((asking) => asking.widgeting_label).join('\n'),
    begin: (asking) => {
      if (inFlight.some(isCellOf(asking))) { return }
      inFlight.push(asking)
      told()
    },
    end: (asking) => {
      const idx = inFlight.findIndex(isCellOf(asking))
      if (idx === -1) { return }
      inFlight.splice(idx, 1)
      told()
    },
  }
}

/**
 * The asks currently in flight, and how to start one.
 *
 * "Thinking..." is a property of this moment, not of the quiz, so it is held here rather than
 * stored: what a cell holds is `ok`, `errored` or `missing`, and a fourth state would have to be
 * cleaned up after every reload. It is held outside React's state, so an ask beginning or ending
 * draws again only the row it is in (`useAskingIn`), never the screen.
 *
 * Whatever an ask comes to is recorded as the newest row in its cell (`record_widgeted`). A
 * failure never replaces a value the cell already has: it rides along on it, and any later
 * success leaves it behind.
 *
 * @param dispatch - How a finished ask reaches the quiz.
 * @returns The asks in flight, and how to ask.
 */
export function useAsking(dispatch: (action: HuntActionDNA) => void): AskingHandle {
  const [asks] = useState(asksHeld)

  const ask = useCallback((question_id: string, { widgeting, widget }: AskedStep, bag: QuizBag) => {
    if (AibotFormulary.input(widget, bag).status !== 'ok') { return }
    const asking = { question_id, widgeting_label: widgeting.label }
    asks.begin(asking)
    const run = async () => {
      try {
        const asked = await AibotFormulary.run(widget, widgeting, bag)
        if (asked === null) { return }
        dispatch({ kind: 'record_widgeted', widgeted: { question_id, widgeting_label: widgeting.label, ...asked.widgeted } })
      } finally {
        asks.end(asking)
      }
    }
    void run()
  }, [asks, dispatch])

  return { asks, ask }
}

/**
 * Whether an ask of each of one question's cells is in flight, for that question's row: drawn
 * again only when one of its own asks begins or ends.
 *
 * @param asks - The screen's asks in flight (`useAsking`).
 * @param question_id - The row's question.
 * @returns Whether the cell of the widgeting labelled so is being asked now.
 *
 * @example const asking = useAskingIn(asks, question._id); asking('dumdum')  // => true, while it is asked
 */
export function useAskingIn(asks: AsksT, question_id: string): (widgeting_label: string) => boolean {
  const labelsFor = useCallback(() => asks.labelsFor(question_id), [asks, question_id])
  const labels = useSyncExternalStore(asks.watch, labelsFor, labelsFor)
  return useCallback((widgeting_label: string) => labels.split('\n').includes(widgeting_label), [labels])
}
