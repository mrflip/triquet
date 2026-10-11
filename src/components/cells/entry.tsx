'use client'

import { EntryFormulary } from '../../lib/formulary/entry'
import { ChoiceField, NumberField, PlainField, StretchField, TruthField, type TemplatedFieldProps } from './fields'
import { EstimatesCell } from './estimates'
import { useEntering } from './use-entering'
import { Widgeted, type WidgetedT } from '../../models/widgeted'
import { EntrySuffixes, type EntryValueT, type EntryWidgetT } from '../../models/widget'
import type { WidgetingT } from '../../models/widgeting'

export type EntryCellProps = TemplatedFieldProps & {
  /** The entry widget the cell types into: its kind, and the params its widgetings start from */
  widget:     Pick<EntryWidgetT, 'config'>
  /** The widgeting working it, whose params overlay the widget's */
  widgeting:  Pick<WidgetingT, 'params'>
  /** What the cell holds now: `ok` with the value typed, or `missing` */
  widgeted:   WidgetedT
  /** The column's title, which names the box */
  label:      string
  locked:     boolean
  /** The height the row settled on, which a text entry stretches to without having a say in it */
  heightPx:   number
  /** Told what the cell now holds once the box loses focus: the value typed, or null when it was emptied */
  onEnter:    (value: EntryValueT | null) => void
}

/**
 * An entry widgeting's cell: the grid's own field editor for its family, drawn from the params in
 * force (`EntryFormulary.inForce`), committing on blur or as it is clicked. Text is a notes box
 * (markdown, stretched to the row), or the Title box when it takes one line, a label tidied into
 * one as it is left; a number is the Q# box, signed unless its least is nought or more, whole when
 * it says so, and never typed past its most, a percent's with `%` after it; a yes or no is a checkbox; a choice is a select of its
 * options. An emptied box is sent as null, which leaves the cell `missing`; a value the params
 * refuse is not sent, and the author is told why (`useEntering`). Category estimates are pills,
 * each change sent as it is made. It never asks anything of anyone. Text the quiz templates shows
 * filled in over `bag`.
 */
export function EntryCell({ widget, widgeting, widgeted, label, locked, heightPx, onEnter, bag = null }: Readonly<EntryCellProps>) {
  const { cell, enter } = useEntering(widget, widgeting, label, onEnter)
  switch (cell.family) {
  case 'text': {
    const text = Widgeted.textOf(widgeted)
    const enterText = (typed: string) => { enter(typed.trim() === '' ? null : typed) }
    const maxLength = EntryFormulary.lengthMaxOf(cell.params)
    if (! EntryFormulary.isOneLine(cell.params)) {
      return <StretchField label={label} committed={text} locked={locked} onCommit={enterText} heightPx={heightPx} maxLength={maxLength} bag={bag} />
    }
    return <PlainField label={label} committed={text} locked={locked} onCommit={enterText} tidy={EntryFormulary.tidyFor(cell.params)} maxLength={maxLength} />
  }
  case 'number': {
    const committed = widgeted.status === 'ok' && typeof widgeted.value === 'number' ? widgeted.value : null
    const { signed, fractional } = EntryFormulary.numberBoxOf(cell.params, committed)
    return <NumberField bare fractional={fractional} signed={signed} max={cell.params.max} suffix={EntrySuffixes[widget.config.entry_kind]} label={label} locked={locked} committed={committed} onCommit={enter} />
  }
  case 'boolean': {
    const committed = widgeted.status === 'ok' && typeof widgeted.value === 'boolean' ? widgeted.value : null
    return <TruthField bare label={label} locked={locked} committed={committed} onCommit={enter} />
  }
  case 'enum': {
    const committed = widgeted.status === 'ok' && typeof widgeted.value === 'string' ? widgeted.value : null
    return <ChoiceField bare label={label} locked={locked} committed={committed} options={cell.params.options ?? []} onCommit={enter} />
  }
  case 'estimates': {
    return <EstimatesCell widgeted={widgeted} label={label} locked={locked} heightPx={heightPx} onEnter={enter} />
  }
  }
}
