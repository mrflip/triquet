'use client'

import { useState } from 'react'
import { Accordion, AccordionDetails, AccordionSummary, Button, Dialog, DialogActions, DialogContent, IconButton, Stack } from '@mui/material'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import { ClosableTitle } from './ClosableTitle'
import { WidgetEditor } from './WidgetEditor'
import { LibraryForm } from './panels/LibraryForm'
import { FormularyMark } from './FormularyMark'
import { Widget, type WidgetT } from '../models/widget'
import type { ShallowHuntT } from '../lib/rows'
import type { QuizT } from '../models/quiz'
import type { LibraryActionDNA } from '../models/actions'
import styles from './workbench.module.css'

export type LibraryModalProps = {
  onClose:   () => void
  hunt:      ShallowHuntT
  /** The library's widgets, in its order */
  library:   readonly WidgetT[]
  /** The quiz on screen, which the preview starts on */
  quiz:      QuizT
  /** Whether the library may be written to here (`change_library`): listed to read, with no editor, when not */
  changeable: boolean
  /** Carry out a change to the library (`useLibraryActions`) */
  dispatch:  (action: LibraryActionDNA) => void
}

/** Which widget's editor is open: one of the library's, by its label, or a new one */
type Editing = { kind: 'held', label: string } | { kind: 'new' } | null

/**
 * The library -- the widgets every hunt's quizzes can put to work -- listed, each with a gear that
 * opens it in the widget editor, and a door to write a new one, for whoever may change it; and,
 * folded beneath, the library to copy out and a box to paste one back (`LibraryForm`). An edit
 * here changes every quiz that works the widget, in every hunt; which quizzes work it is each
 * quiz's own business, in its widgetings.
 */
export function LibraryModal({ onClose, hunt, library, quiz, changeable, dispatch }: Readonly<LibraryModalProps>) {
  const [editing, setEditing] = useState<Editing>(null)
  const edited = editing?.kind === 'held' ? library.find((widget) => widget.label === editing.label) : undefined

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="md" aria-labelledby="library-title">
      <ClosableTitle id="library-title" onClose={onClose}>Widget library</ClosableTitle>
      <DialogContent>
        <p className={styles.microcopy}>
          Every hunt shares these. A formula is a <a href="https://docs.jsonata.org" target="_blank" rel="noreferrer">JSONata</a> expression
          worked out for every question; a prompt is put to a model when you ask from the cell. A quiz puts one to work
          in its widgetings, under the gear.
        </p>
        <Stack spacing={1}>
          {library.map((widget) => (
            <Stack key={Widget.keyOf(widget)} direction="row" spacing={1} role="group" aria-label={`Widget ${widget.label}`} sx={{ alignItems: 'center' }}>
              <FormularyMark formulary={widget.formulary} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <strong>{widget.label}</strong>
                <div className={styles.microcopy}>{widget.description}</div>
              </div>
              {changeable && <IconButton size="small" aria-label={`Edit widget ${widget.label}`} onClick={() => { setEditing({ kind: 'held', label: widget.label }) }}>⚙</IconButton>}
            </Stack>
          ))}
        </Stack>
        <Accordion disableGutters variant="outlined" sx={{ mt: 2 }}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>Export or import the library</AccordionSummary>
          <AccordionDetails>
            <LibraryForm library={library} changeable={changeable} dispatch={dispatch} />
          </AccordionDetails>
        </Accordion>
      </DialogContent>
      <DialogActions sx={{ justifyContent: 'space-between' }}>
        {changeable ? <Button size="small" variant="outlined" onClick={() => { setEditing({ kind: 'new' }) }}>+ New widget…</Button> : <span />}
        <Button onClick={onClose}>Done</Button>
      </DialogActions>
      {changeable && (edited !== undefined || editing?.kind === 'new') && (
        <WidgetEditor
          key={edited?.label ?? 'new'}
          hunt={hunt}
          library={library}
          quiz={quiz}
          widget={edited ?? null}
          dispatch={dispatch}
          onClose={() => { setEditing(null) }}
        />
      )}
    </Dialog>
  )
}
