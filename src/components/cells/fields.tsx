'use client'

import { useCallback, useLayoutEffect, useRef } from 'react'
import clsx from 'clsx'
import { useDraft } from '../use-draft'
import styles from '../workbench.module.css'

export type FieldProps = {
  committed:   string
  onCommit:    (draft: string) => void
  locked:      boolean
  placeholder?: string
  label:       string
}

export type GrowingFieldProps = FieldProps & {
  /** The height the row settled on, applied to this box whatever its own content wants */
  heightPx:  number
  /** Reports the height this box's own content would like, before the row decides */
  onNatural: (naturalPx: number) => void
  /** Re-measure when this changes: the window finished resizing */
  resizeToken: number
}

/**
 * Clueing or Hint: a borderless box that grows with its content and reports how tall it wants
 * to be, so the row can give both boxes the taller of the two.
 */
export function GrowingField({ committed, onCommit, locked, placeholder, label, heightPx, onNatural, resizeToken }: Readonly<GrowingFieldProps>) {
  const { draft, onChange, onBlur } = useDraft(committed, onCommit)
  const areaRef = useRef<HTMLTextAreaElement>(null)

  useLayoutEffect(() => {
    const area = areaRef.current
    if (! area) { return }
    area.style.height = 'auto'
    const naturalPx = area.scrollHeight
    area.style.height = `${String(heightPx)}px`
    onNatural(naturalPx)
  }, [draft, heightPx, onNatural, resizeToken])

  return (
    <textarea
      ref={areaRef}
      className={styles.field}
      aria-label={label}
      placeholder={placeholder}
      readOnly={locked}
      value={draft}
      onChange={(event) => { onChange(event.target.value) }}
      onBlur={onBlur}
    />
  )
}

/**
 * A notes column: stretched to the height the row already settled on, for comfortable typing,
 * but never allowed to decide that height. Long notes must not stretch the row.
 */
export function StretchField({ committed, onCommit, locked, placeholder, label, heightPx }: Readonly<FieldProps & { heightPx: number }>) {
  const { draft, onChange, onBlur } = useDraft(committed, onCommit)
  return (
    <textarea
      className={styles.field}
      style={{ height: `${String(heightPx)}px` }}
      aria-label={label}
      placeholder={placeholder}
      readOnly={locked}
      value={draft}
      onChange={(event) => { onChange(event.target.value) }}
      onBlur={onBlur}
    />
  )
}

/** Title: one line, borderless until touched */
export function PlainField({ committed, onCommit, locked, placeholder, label }: Readonly<FieldProps>) {
  const { draft, onChange, onBlur } = useDraft(committed, onCommit)
  return (
    <input
      className={clsx(styles.field, styles.fieldData)}
      aria-label={label}
      placeholder={placeholder}
      readOnly={locked}
      value={draft}
      onChange={(event) => { onChange(event.target.value) }}
      onBlur={onBlur}
    />
  )
}

/** Q#: free text holding an optional number, centred, with the spinner arrows suppressed */
export function QnumField({ committed, onCommit, locked, label }: Readonly<FieldProps>) {
  // A trailing dot is legal on the way to `3.1` but is not a Q#, so it is tidied away on exit.
  const { draft, onChange, onBlur } = useDraft(committed, onCommit, (typed) => typed.replace(/\.$/, ''))
  const onlyNumberish = useCallback((next: string) => {
    if (/^(\d+(\.\d*)?)?$/.test(next)) { onChange(next) }
  }, [onChange])
  return (
    <input
      className={clsx(styles.field, styles.fieldQnum)}
      inputMode="decimal"
      aria-label={label}
      readOnly={locked}
      value={draft}
      onChange={(event) => { onlyNumberish(event.target.value) }}
      onBlur={onBlur}
    />
  )
}

export type NumberFieldProps = Omit<FieldProps, 'committed' | 'onCommit'> & {
  committed:  number | null
  /** Told the number typed, or null when the box was emptied */
  onCommit:   (num: number | null) => void
  /** Whether a fraction may be typed, as `2.5` */
  fractional: boolean
  /** The most that may be typed */
  max?:       number
}

/**
 * A count or a percentage: free text holding an optional non-negative number, centred, with the
 * spinner arrows suppressed. Keystrokes that would make it anything else, or more than `max`, are
 * not taken; an empty box commits null.
 */
export function NumberField({ committed, onCommit, locked, placeholder, label, fractional, max }: Readonly<NumberFieldProps>) {
  // What was typed is tidied on exit into the number it means, as the box will show it once
  // committed: `2.` on the way to `2.5` becomes `2`, and `2.50` becomes `2.5`.
  const { draft, onChange, onBlur } = useDraft(
    committed === null ? '' : String(committed),
    (typed) => { onCommit(typed === '' ? null : Number(typed)) },
    (typed) => (typed === '' ? '' : String(Number(typed))),
  )
  const shaped = fractional ? /^(\d+(\.\d*)?)?$/ : /^\d*$/
  const onlyNumberish = (next: string) => {
    const num = Number(next)
    if (shaped.test(next) && Number.isFinite(num) && (max === undefined || num <= max)) { onChange(next) }
  }
  return (
    <input
      className={clsx(styles.field, styles.fieldQnum)}
      inputMode={fractional ? 'decimal' : 'numeric'}
      aria-label={label}
      placeholder={placeholder}
      readOnly={locked}
      value={draft}
      onChange={(event) => { onlyNumberish(event.target.value) }}
      onBlur={onBlur}
    />
  )
}
