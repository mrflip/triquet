'use client'

import { useLayoutEffect, useRef, useState } from 'react'
import { Checkbox, FormControlLabel, NativeSelect, TextField } from '@mui/material'
import clsx from 'clsx'
import { NumericFormat, type NumberFormatValues, type SourceInfo } from 'react-number-format'
import { useDraft } from '../use-draft'
import { MarkdownFace, veiledIf } from './markdown'
import { useFace } from './use-face'
import type * as Templating from '../../lib/templating'
import styles from '../workbench.module.css'

export type FieldProps = {
  committed:   string
  onCommit:    (draft: string) => void
  locked:      boolean
  placeholder?: string
  label:       string
}

export type TemplatedFieldProps = {
  /** What the field's text is filled in over, when the quiz templates it; null or absent when it does not */
  bag?: Templating.TemplateBag | null
}

export type GrowingFieldProps = FieldProps & TemplatedFieldProps & {
  /** The height the row settled on, applied to this box whatever its own content wants */
  heightPx:  number
  /** Reports the height this box's own content would like, before the row decides */
  onNatural: (naturalPx: number) => void
  /** Re-measure when this changes: the window finished resizing */
  resizeToken: number
}

/**
 * Clueing or Hint: a borderless box that grows with its content and reports how tall it wants
 * to be, so the row can give both boxes the taller of the two. Until it is typed into it shows
 * its markdown rendered, and asks for room enough for whichever of the two is taller, so the row
 * keeps its height as the box is entered and left. A templated field's face is its text filled in.
 * An image in the face that loads (or fails) after the box measured itself has it measure again.
 */
export function GrowingField({ committed, onCommit, locked, placeholder, label, heightPx, onNatural, resizeToken, bag = null }: Readonly<GrowingFieldProps>) {
  const { draft, onChange, onBlur } = useDraft(committed, onCommit)
  const areaRef = useRef<HTMLTextAreaElement>(null)
  const faceRef = useRef<HTMLDivElement>(null)
  const face = useFace(draft, bag, label)
  const imageLoads = useImageLoads(faceRef, face.text)

  useLayoutEffect(() => {
    const area = areaRef.current
    if (! area) { return }
    area.style.height = 'auto'
    const naturalPx = Math.max(area.scrollHeight, faceRef.current?.scrollHeight ?? 0)
    area.style.height = `${String(heightPx)}px`
    onNatural(naturalPx)
  }, [draft, face.text, heightPx, onNatural, resizeToken, imageLoads])

  return (
    <div className={styles.veil}>
      <textarea
        ref={areaRef}
        className={clsx(styles.field, veiledIf(face.text))}
        aria-label={label}
        aria-invalid={face.issue !== null || undefined}
        placeholder={placeholder}
        readOnly={locked}
        value={draft}
        onChange={(event) => { onChange(event.target.value) }}
        onBlur={onBlur}
      />
      <MarkdownFace {...face} faceRef={faceRef} />
    </div>
  )
}

/**
 * How many images have settled in the face `faceRef` holds -- loaded, or failed and drawn as
 * their alt text -- since its text last changed to `text`: what a box that measures its face
 * watches, since an image settling may change the face's height after it was measured. Neither
 * event bubbles, so the face listens for them as they pass down to the image; it starts listening
 * as the face is laid out, before the box measures it, so no image settles unheard in between.
 */
function useImageLoads(faceRef: React.RefObject<HTMLDivElement | null>, text: string): number {
  const [loads, setLoads] = useState(0)
  useLayoutEffect(() => {
    const faceEl = faceRef.current
    if (! faceEl || text === '') { return }
    const onSettle = (event: Event) => { if (event.target instanceof HTMLImageElement) { setLoads((count) => count + 1) } }
    faceEl.addEventListener('load', onSettle, { capture: true })
    faceEl.addEventListener('error', onSettle, { capture: true })
    return () => {
      faceEl.removeEventListener('load', onSettle, { capture: true })
      faceEl.removeEventListener('error', onSettle, { capture: true })
    }
  }, [faceRef, text])
  return loads
}

export type StretchFieldProps = FieldProps & TemplatedFieldProps & {
  heightPx: number
  /** Always shown as typed, never rendered: Alt Text is read aloud as written */
  plain?:   boolean
  /** The most characters that may be typed */
  maxLength?: number
}

/**
 * A notes column: stretched to the height the row already settled on, for comfortable typing,
 * but never allowed to decide that height. Long notes must not stretch the row. Until it is
 * typed into it shows its markdown rendered (filled in first, when templated), unless it is `plain`.
 */
export function StretchField({ committed, onCommit, locked, placeholder, label, heightPx, plain = false, maxLength, bag = null }: Readonly<StretchFieldProps>) {
  const { draft, onChange, onBlur } = useDraft(committed, onCommit)
  const face = useFace(plain ? '' : draft, bag, label)
  return (
    <div className={styles.veil}>
      <textarea
        className={clsx(styles.field, veiledIf(face.text))}
        style={{ height: `${String(heightPx)}px` }}
        aria-label={label}
        aria-invalid={face.issue !== null || undefined}
        placeholder={placeholder}
        readOnly={locked}
        maxLength={maxLength}
        value={draft}
        onChange={(event) => { onChange(event.target.value) }}
        onBlur={onBlur}
      />
      <MarkdownFace {...face} />
    </div>
  )
}

export type PlainFieldProps = FieldProps & {
  /** Cleans what was typed up on the way out, as `useDraft` does: a label made a label, say */
  tidy?:      (draft: string) => string
  /** The most characters that may be typed */
  maxLength?: number
}

/** Title: one line, borderless until touched */
export function PlainField({ committed, onCommit, locked, placeholder, label, tidy, maxLength }: Readonly<PlainFieldProps>) {
  const { draft, onChange, onBlur } = useDraft(committed, onCommit, tidy)
  return (
    <input
      className={styles.field}
      aria-label={label}
      placeholder={placeholder}
      readOnly={locked}
      maxLength={maxLength}
      value={draft}
      onChange={(event) => { onChange(event.target.value) }}
      onBlur={onBlur}
    />
  )
}

/**
 * Q#: an optional number, in the grid's borderless box, held as the text the quiz keeps. A
 * decimal places a question between two others (`3.1` after 3) until the quiz is renumbered.
 */
export function QnumField({ committed, onCommit, locked, label }: Readonly<FieldProps>) {
  return (
    <NumberField
      bare fractional label={label} locked={locked}
      committed={committed === '' ? null : Number(committed)}
      onCommit={(num) => { onCommit(num === null ? '' : String(num)) }}
    />
  )
}

export type NumberFieldProps = Omit<FieldProps, 'committed' | 'onCommit'> & {
  committed:  number | null
  /** Told the number typed, or null when the box was emptied */
  onCommit:   (num: number | null) => void
  /** Whether a fraction may be typed, as `2.5` */
  fractional: boolean
  /** Whether a number below nought may be typed */
  signed?:    boolean
  /** The most that may be typed */
  max?:       number
  /** What the box shows after the number, as a percent's `%`; never part of what is committed */
  suffix?:    string
  /** The grid's own borderless box, rather than a labelled MUI text field */
  bare?:      boolean
  /** What a labelled box says beneath itself: what it is for, or what is wrong with it */
  helperText?: string
  /** Whether what a labelled box holds is refused, as its helper text says */
  error?:     boolean
}

/**
 * An optional number, non-negative unless `signed`, committed when the box loses focus: as a
 * number, or null when it was emptied. Keystrokes that would make it anything else, or more than `max`, are not
 * taken, and what was typed is tidied on exit into the number it means (`2.50` becomes `2.5`, and
 * a lone `.` nothing).
 */
export function NumberField({ committed, onCommit, locked, placeholder, label, fractional, signed = false, max, suffix, bare = false, helperText, error = false }: Readonly<NumberFieldProps>) {
  const { draft, onChange, onBlur } = useDraft(
    committed === null ? '' : String(committed),
    (typed) => { onCommit(typed === '' ? null : Number(typed)) },
    // A lone point, or a lone minus sign, means no number at all.
    (typed) => (typed === '' || Number.isNaN(Number(typed)) ? '' : String(Number(typed))),
  )
  const inputMode = fractional ? 'decimal' : 'numeric'
  const numeric = {
    value:                draft,
    valueIsNumericString: true,
    allowNegative:        signed,
    decimalScale:         fractional ? undefined : 0,
    suffix,
    placeholder,
    onBlur,
    isAllowed:            ({ floatValue }: NumberFormatValues) => max === undefined || floatValue === undefined || floatValue <= max,
    // The box is told of the committed value as well as of keystrokes; only a keystroke is a draft.
    onValueChange:        ({ value: typed }: NumberFormatValues, { event }: SourceInfo) => { if (event) { onChange(typed) } },
  }
  if (bare) {
    return <NumericFormat {...numeric} className={clsx(styles.field, styles.fieldNumber)} inputMode={inputMode} aria-label={label} readOnly={locked} />
  }
  // The label stays up in the outline, so an empty box reads as a box and not as a prompt inside one.
  return <NumericFormat {...numeric} customInput={TextField} label={label} size="small" fullWidth helperText={helperText} error={error} slotProps={{ htmlInput: { inputMode, readOnly: locked }, inputLabel: { shrink: true } }} />
}

export type TruthFieldProps = {
  /** Yes, no, or null while nothing has been said */
  committed: boolean | null
  /** Told what a click made it: yes, no, or null again */
  onCommit:  (truth: boolean | null) => void
  locked:    boolean
  label:     string
  /** The grid's own checkbox, named for a screen reader alone, rather than one with its words beside it */
  bare?:     boolean
}

/** What a click on a yes-or-no box makes of what it held: not yet said, then yes, then no, then not yet said again */
const NextTruth: ReadonlyMap<boolean | null, boolean | null> = new Map([[null, true], [true, false], [false, null]])

/**
 * A yes or no, as a checkbox committed as it is clicked: ticked for yes, empty for no, and a dash
 * while nothing has been said, which a click past no comes back to, so a box can be emptied.
 */
export function TruthField({ committed, onCommit, locked, label, bare = false }: Readonly<TruthFieldProps>) {
  const box = (
    <Checkbox
      size="small" sx={bare ? { p: 0.25 } : undefined} checked={committed === true} indeterminate={committed === null} disabled={locked}
      slotProps={{ input: { 'aria-label': label, 'aria-checked': committed ?? 'mixed' } }}
      onChange={() => { onCommit(NextTruth.get(committed) ?? null) }}
    />
  )
  return bare ? box : <FormControlLabel control={box} label={label} />
}

export type ChoiceFieldProps = {
  /** The option held, or null while none is */
  committed: string | null
  /** What may be picked, in the order offered */
  options:   readonly string[]
  /** Told the option picked, or null when the blank was */
  onCommit:  (choice: string | null) => void
  locked:    boolean
  label:     string
  /** The grid's own borderless select, rather than a labelled MUI text field */
  bare?:     boolean
}

/** What a choice's blank is shown as: nothing picked yet */
const NoChoice = '—'

/**
 * One of a list of options, as the browser's own select, committed as it is picked; its blank
 * empties it. An option held that the list no longer offers is still shown, as itself, until
 * another is picked, so nothing typed is lost to a revised list.
 */
export function ChoiceField({ committed, options, onCommit, locked, label, bare = false }: Readonly<ChoiceFieldProps>) {
  const offered = committed === null || options.includes(committed) ? options : [...options, committed]
  const choices = [<option key="" value="">{NoChoice}</option>, ...offered.map((option) => <option key={option} value={option}>{option}</option>)]
  const onChange = (event: React.ChangeEvent<{ value: string }>) => { onCommit(event.target.value === '' ? null : event.target.value) }
  if (bare) {
    return (
      <NativeSelect disableUnderline value={committed ?? ''} disabled={locked} onChange={onChange} sx={{ width: '100%', font: 'inherit' }} inputProps={{ 'aria-label': label, className: styles.field }}>
        {choices}
      </NativeSelect>
    )
  }
  return (
    <TextField
      select label={label} size="small" fullWidth value={committed ?? ''} disabled={locked} onChange={onChange}
      slotProps={{ select: { native: true }, inputLabel: { shrink: true } }}
    >
      {choices}
    </TextField>
  )
}
