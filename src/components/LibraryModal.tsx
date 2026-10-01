'use client'

import { useState } from 'react'
import { Button, Dialog, DialogActions, DialogContent, IconButton, Stack } from '@mui/material'
import { ClosableTitle, ignoringBackdrop } from './ClosableTitle'
import { ConfirmRemove } from './ConfirmRemove'
import { JsonataFields } from './JsonataFields'
import { WidgetValidators, Widget, type JsonataWidgetT, type WidgetT } from '../models/widget'
import type { ShallowHuntT } from '../lib/rows'
import type { QuizT } from '../models/quiz'
import type { HuntActionDNA } from '../models/actions'
import type { WidgetDraft } from '../state/widget-edit'
import styles from './workbench.module.css'

export type LibraryModalProps = {
  onClose:   () => void
  hunt:      ShallowHuntT
  /** The library's widgets, in its order */
  library:   readonly WidgetT[]
  /** The quiz on screen, which the preview starts on */
  quiz:      QuizT
  dispatch:  (action: HuntActionDNA) => void
}

/**
 * The library -- the widgets every hunt's quizzes can put to work -- listed, each with what works
 * it and, for a formula, a gear that opens it for editing and removing.
 *
 * New formulas are written from a quiz's widgetings, where they can be tried against real
 * questions and put to work at once; this list is for revisiting and tidying them. An edit here
 * changes every quiz that works the widget, in every hunt.
 */
export function LibraryModal({ onClose, hunt, library, quiz, dispatch }: Readonly<LibraryModalProps>) {
  const [editing, setEditing] = useState<string | null>(null)
  const edited = library.find((widget): widget is JsonataWidgetT => widget.formulary === 'jsonata' && widget.label === editing)

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="md" aria-labelledby="library-title">
      <ClosableTitle id="library-title" onClose={onClose}>Widget library</ClosableTitle>
      <DialogContent>
        <p className={styles.microcopy}>
          Every hunt shares these. A formula is a <a href="https://docs.jsonata.org" target="_blank" rel="noreferrer">JSONata</a> expression
          worked out for every question; a prompt is put to a model when you ask from the cell. To write a new
          formula, add a widgeting to a quiz and choose &ldquo;New widget&rdquo;.
        </p>
        <Stack spacing={1}>
          {library.map((widget) => (
            <Stack key={Widget.keyOf(widget)} direction="row" spacing={1} role="group" aria-label={`Widget ${widget.label}`} sx={{ alignItems: 'center' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <strong>{widget.label}</strong> <span className={styles.microcopy}>{widget.formulary === 'jsonata' ? 'formula' : 'prompt'}</span>
                <div className={styles.microcopy}>{widget.description}</div>
              </div>
              {widget.formulary === 'jsonata' && (
                <IconButton size="small" aria-label={`Edit widget ${widget.label}`} onClick={() => { setEditing(widget.label) }}>⚙</IconButton>
              )}
            </Stack>
          ))}
        </Stack>
      </DialogContent>
      <DialogActions><Button onClick={onClose}>Done</Button></DialogActions>
      {edited && (
        <WidgetEditor
          key={edited.label}
          hunt={hunt}
          library={library}
          quiz={quiz}
          widget={edited}
          dispatch={dispatch}
          onClose={() => { setEditing(null) }}
        />
      )}
    </Dialog>
  )
}

type WidgetEditorProps = {
  hunt:     ShallowHuntT
  library:  readonly WidgetT[]
  quiz:     QuizT
  widget:   JsonataWidgetT
  dispatch: (action: HuntActionDNA) => void
  onClose:  () => void
}

/**
 * One formula on its own: formula and description to revise with a live preview, and a removal
 * that asks first. The server refuses a removal while any widgeting, in any hunt, works it.
 */
function WidgetEditor({ hunt, library, quiz, widget, dispatch, onClose }: Readonly<WidgetEditorProps>) {
  const [draft, setDraft] = useState<WidgetDraft>({ label: widget.label, description: widget.description, formula: widget.formula })
  const [issue, setIssue] = useState<string | null>(null)

  const onApply = () => {
    const checked = WidgetValidators.widget.safeParse({ ...widget, ...draft })
    if (! checked.success) { setIssue(checked.error.issues[0]?.message ?? 'That will not do.'); return }
    dispatch({ kind: 'edit_widget', label: widget.label, patch: { formula: draft.formula, description: draft.description } })
    onClose()
  }

  return (
    <Dialog open onClose={ignoringBackdrop(onClose)} fullWidth maxWidth="md" aria-labelledby="widget-editor-title">
      <ClosableTitle id="widget-editor-title" onClose={onClose}>Widget: {widget.label}</ClosableTitle>
      <DialogContent>
        <Stack spacing={1} sx={{ mt: 1 }}>
          <JsonataFields
            hunt={hunt}
            library={library}
            openQuiz={quiz}
            draft={draft}
            onChange={(patch) => { setDraft((was) => ({ ...was, ...patch })); setIssue(null) }}
            labelEditable={false}
            labelIssue={null}
            widgeting={null}
          />
          {issue !== null && <p className={styles.microcopy} role="alert">{issue}</p>}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ justifyContent: 'space-between' }}>
        <ConfirmRemove
          noun="widget"
          question="Remove this widget from the library for good? It cannot be removed while any quiz works it."
          refusal={null}
          onConfirm={() => { dispatch({ kind: 'delete_widget', label: widget.label }); onClose() }}
        />
        <Stack direction="row" spacing={1}>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="contained" onClick={onApply}>Apply</Button>
        </Stack>
      </DialogActions>
    </Dialog>
  )
}
