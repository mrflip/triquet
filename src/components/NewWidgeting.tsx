'use client'

import { useState } from 'react'
import { Button, Stack } from '@mui/material'
import { WidgetEditor } from './WidgetEditor'
import { WidgetPicker } from './WidgetPicker'
import { madeFoldkeys } from './layout-folds'
import type { WidgetingPanelContext } from './WidgetingPanel'
import { planWidgetingEdit } from '../lib/widgeting-edit'
import { Widgeting, type WidgetingTier } from '../models/widgeting'
import type { WidgetT } from '../models/widget'
import styles from './workbench.module.css'

/** What putting a widget to work is drawn with: the panel's context, less what a new one has no use for */
export type NewWidgetingContext = Omit<WidgetingPanelContext, 'sources' | 'revisable'>

/**
 * Puts `widget` to work in the quiz at `tier`, as a widgeting labelled as the widget is (growing
 * `_2`, `_3` while that is taken), with a column showing it for one run for each question: sent at
 * once, and its panels opened for the rest of its fields to be set (`madeFoldkeys`).
 *
 * @returns What is wrong, or null once it has been sent.
 */
function putToWork(widget: WidgetT, tier: WidgetingTier, known: readonly WidgetT[], { quiz, dispatch, folds }: NewWidgetingContext): string | null {
  const plan = planWidgetingEdit({ widgeting: null, label: '', description: '', widgetLabel: widget.label, tier }, known, quiz)
  if (! plan.ok) { return plan.issue }
  for (const action of plan.actions) { dispatch(action) }
  for (const foldkey of madeFoldkeys(plan.actions)) { folds.setOpen(foldkey, true) }
  return null
}

export type NewWidgetingPickerProps = NewWidgetingContext & {
  tier:        WidgetingTier
  /** Whether only entries are offered, for a new column to type into */
  entriesOnly: boolean
  /** What the picker is called */
  label:       string
  /** Told once the widgeting is made, or the picking given up */
  onDone:      () => void
}

/**
 * A row that puts a widget of the library to work: the catalogue, opened, offering the widgets
 * that can run at the tier (only the entries, when asked); for whoever may change the library, a
 * door to write a new widget to put to work instead. A pick makes the widgeting at once, and its
 * column with it for one run for each question.
 */
export function NewWidgetingPicker({ tier, entriesOnly, label, onDone, ...context }: Readonly<NewWidgetingPickerProps>) {
  const { library, changeable } = context
  const [issue, setIssue] = useState<string | null>(null)
  const [writing, setWriting] = useState(false)
  const offered = library.filter((widget) => Widgeting.runsAt(widget, tier) && (! entriesOnly || widget.formulary === 'entry'))
  const put = (widget: WidgetT, known: readonly WidgetT[]) => {
    const problem = putToWork(widget, tier, known, context)
    setIssue(problem)
    if (problem === null) { onDone() }
  }
  return (
    <Stack spacing={1}>
      <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-start', flexWrap: 'wrap', rowGap: 1 }}>
        <WidgetPicker
          library={offered} label={label}
          helperText={entriesOnly ? 'Pick what its cells take: a new entry and its column are made at once.' : 'Pick one to put to work in this quiz: it is made at once.'}
          onPick={(widget) => { put(widget, library) }}
        />
        {changeable && <Button size="small" variant="outlined" sx={{ mt: 0.5 }} onClick={() => { setWriting(true) }}>New widget…</Button>}
        <Button size="small" sx={{ mt: 0.5 }} onClick={onDone}>Cancel</Button>
      </Stack>
      {issue !== null && <p className={styles.microcopy} role="alert">{issue}</p>}
      {writing && <NewWidgetDoor tier={tier} {...context} onClose={() => { setWriting(false) }} onPut={(problem) => { setIssue(problem); if (problem === null) { onDone() } }} />}
    </Stack>
  )
}

export type NewWidgetDoorProps = NewWidgetingContext & {
  tier:    WidgetingTier
  onClose: () => void
  /** Told, once the new widget is written, what kept it from being put to work, or null once it has been */
  onPut:   (issue: string | null) => void
}

/**
 * The widget editor, opened to write a new widget, which is put to work in the quiz the moment it
 * is written: a widgeting of it, with its column for one run for each question. Opened only for
 * whoever may change the library. A widget that will not run at the tier is written to the
 * library and not put to work, and the opener is told why.
 */
export function NewWidgetDoor({ tier, onClose, onPut, ...context }: Readonly<NewWidgetDoorProps>) {
  const { hunt, quiz, library, changeLibrary } = context
  return (
    <WidgetEditor
      hunt={hunt} library={library} quiz={quiz} widget={null} dispatch={changeLibrary} onClose={onClose}
      onMade={(fresh) => { onPut(putToWork(fresh, tier, [...library, fresh], context)) }}
    />
  )
}
