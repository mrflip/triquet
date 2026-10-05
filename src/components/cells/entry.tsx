'use client'

import * as Labelmaker from '../../lib/labelmaker'
import * as PA from '../../lib/vv/patterns'
import { NumberField, PlainField, StretchField } from './fields'
import { EstimatesCell } from './estimates'
import { Widgeted, type WidgetedT } from '../../models/widgeted'
import type { EntryKind, EntryValueT } from '../../models/widget'

export type EntryCellProps = {
  /** What the cell takes: prose, a number, a label, a title, or a question's category estimates */
  entry_kind: EntryKind
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
 * An entry widgeting's cell: the grid's own field editor for its kind, committing on blur. Text
 * is a notes box (markdown, stretched to the row); a number is the Q# box, signed and fractional;
 * a label and a title are the Title box, a label tidied into one (and cut to a label's length) as
 * the box is left. An emptied box is sent as null, which leaves the cell `missing`. Category
 * estimates are pills, each change sent as it is made. It never asks anything of anyone.
 */
export function EntryCell({ entry_kind, widgeted, label, locked, heightPx, onEnter }: Readonly<EntryCellProps>) {
  const text = Widgeted.textOf(widgeted)
  const enterText = (typed: string) => { onEnter(typed.trim() === '' ? null : typed) }
  switch (entry_kind) {
  case 'text': {
    return <StretchField label={label} committed={text} locked={locked} onCommit={enterText} heightPx={heightPx} />
  }
  case 'number': {
    const committed = widgeted.status === 'ok' && typeof widgeted.value === 'number' ? widgeted.value : null
    return <NumberField bare fractional signed label={label} locked={locked} committed={committed} onCommit={onEnter} />
  }
  case 'labelish': {
    return <PlainField label={label} committed={text} locked={locked} onCommit={enterText} tidy={(typed) => Labelmaker.normalize(typed)} />
  }
  case 'titleish': {
    return <PlainField label={label} committed={text} locked={locked} onCommit={enterText} tidy={(typed) => typed.trim()} maxLength={PA.Titleish.max} />
  }
  case 'estimates': {
    return <EstimatesCell widgeted={widgeted} label={label} locked={locked} heightPx={heightPx} onEnter={onEnter} />
  }
  }
}
