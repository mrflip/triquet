'use client'

import { useMemo } from 'react'
import { EntryFormulary, type EntryInForceT } from '../../lib/formulary/entry'
import { AppNotices } from '../../lib/notices'
import * as Reporting from '../../lib/vv/reporting'
import { useRaiseAlarm } from '../../state/alarms'
import type { EntryValueT, EntryWidgetT } from '../../models/widget'
import type { WidgetingT } from '../../models/widgeting'

export type EnteringHandle = {
  /** The entry's family, and the params in force, which its box is drawn from */
  cell:  EntryInForceT
  /** Commit what the box now holds: a value held to the params in force, or null for a box emptied */
  enter: (value: EntryValueT | null) => void
}

/**
 * An entry box's way of committing what was typed: held to what its widget and widgeting say a
 * cell may hold (`EntryFormulary.valueOf`) before it is sent, so a value they refuse is never
 * sent, and the author is told why in the field's own sentence, by the page's alarm, since a cell
 * has no room to say it beside itself. An emptied box is sent as null, as ever.
 *
 * @param widget - The entry widget the box types into.
 * @param widgeting - The widgeting working it, whose params overlay the widget's.
 * @param label - What the box is called, which the sentence is said of.
 * @param onEnter - Told what the cell now holds, once it holds something it may.
 * @returns The family and params in force, and the commit.
 *
 * @example const { cell, enter } = useEntering(widget, widgeting, 'Grade', onEnter)
 */
export function useEntering(widget: Pick<EntryWidgetT, 'config'>, widgeting: Pick<WidgetingT, 'params'>, label: string, onEnter: (value: EntryValueT | null) => void): EnteringHandle {
  const raise = useRaiseAlarm()
  const cell = useMemo(() => EntryFormulary.inForce(widget, widgeting), [widget, widgeting])
  const validator = useMemo(() => EntryFormulary.valueOf(widget, widgeting), [widget, widgeting])
  const enter = (value: EntryValueT | null) => {
    if (value === null) { onEnter(null); return }
    // The browser installs no error map, so the parse says its sentences in the words the server would.
    const checked = validator.safeParse(value, { error: Reporting.customError })
    if (checked.success) { onEnter(checked.data); return }
    raise({ headline: AppNotices.changeNotKept, notice: `${label}: ${Reporting.explain(checked.error)}`, request_id: null })
  }
  return { cell, enter }
}
