'use client'

import { IconButton, type IconButtonProps } from '@mui/material'
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown'
import ArrowRightIcon from '@mui/icons-material/ArrowRight'

export type FoldButtonProps = Omit<IconButtonProps, 'children' | 'onClick' | 'size' | 'sx' | 'aria-label' | 'aria-expanded' | 'aria-controls'> & {
  /** Whether what it folds is showing in full */
  open:         boolean
  /** Called with the state asked for, which is always `! open` */
  onOpenChange: (open: boolean) => void
  /** Names what it folds, the same whichever way it points: `aria-expanded` carries which way that is */
  label:        string
  /** The id of the one region it folds, when it folds exactly one */
  controls?:    string
  /** `small` is compact enough for a grid's header corner; `medium` stands as tall as a small text field */
  size?:        'small' | 'medium'
}

/**
 * The fold triangle: a button pointing right while what it folds is folded, and down while it
 * is open. It holds no state of its own; the view that owns the fold says which way it points.
 * Everything else an `IconButton` takes passes through, so it can sit in a `Tooltip`.
 *
 * @example <FoldButton open={open} onOpenChange={setOpen} label="Show the note in full" controls={noteId} />
 */
export function FoldButton({ open, onOpenChange, label, controls, size = 'small', ...rest }: Readonly<FoldButtonProps>) {
  const Face = open ? ArrowDropDownIcon : ArrowRightIcon
  return (
    <IconButton
      {...rest}
      size={size}
      aria-label={label}
      aria-expanded={open}
      aria-controls={controls}
      onClick={() => { onOpenChange(! open) }}
      sx={size === 'small' ? { p: 0.25 } : undefined}
    >
      <Face fontSize={size} />
    </IconButton>
  )
}

/** Where entering a fold means to type: its text boxes, and not a checkbox or radio beside them */
const EntrySelector = 'textarea, input:not([type="checkbox"]):not([type="radio"])'

/**
 * A focus handler that opens a fold as the author clicks or tabs into one of its text boxes to
 * type. Focus landing on a button, checkbox or select within it leaves it as it is. Nothing here
 * folds it again: that is only ever its `FoldButton`'s doing.
 *
 * @param onOpen - Opens the fold.
 * @returns A handler for the `onFocus` of the fold's text box, or of an element holding several;
 *   React's focus events bubble.
 *
 * @example <TextField onFocus={openOnEntry(() => { setOpen(true) })} />
 */
export function openOnEntry(onOpen: () => void): (event: React.FocusEvent) => void {
  return (event) => {
    if (event.target.matches(EntrySelector)) { onOpen() }
  }
}
