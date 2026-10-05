'use client'

import { useRef } from 'react'
import { Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, List, ListItem, ListItemText } from '@mui/material'
import ArchiveOutlinedIcon from '@mui/icons-material/ArchiveOutlined'
import LowPriorityIcon from '@mui/icons-material/LowPriority'
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined'
import { QuestionTitle } from './QuestionTitle'
import { AppNotices } from '../lib/notices'
import type { QuestionT, QuestionViz } from '../models/question'

/** How many of the questions are named before the rest are only counted */
const NamedQty = 8

/** Each viz a question can be given, as its button says it: its words, its icon and its colour */
export const VizChoices = {
  archived:  { actname: 'Archive',        Icon: ArchiveOutlinedIcon,    color: 'warning' },
  secondary: { actname: 'Make secondary', Icon: LowPriorityIcon,        color: 'secondary' },
  normal:    { actname: 'Make normal',    Icon: VisibilityOutlinedIcon, color: 'primary' },
} as const satisfies Record<QuestionViz, { actname: string, Icon: typeof ArchiveOutlinedIcon, color: 'warning' | 'secondary' | 'primary' }>

export type ConfirmVizProps = {
  /** The questions to change, in the grid's order; at least one */
  questions: readonly QuestionT[]
  /** The vizzes offered, each a button: every one, from a row; archiving alone, from the toolbar */
  offered:   readonly QuestionViz[]
  onChoose:  (viz: QuestionViz) => void
  onClose:   () => void
}

/**
 * Asks how questions are to be shown -- archived, an alternate (secondary), or normal -- naming
 * them, and saying where an archived one goes and how it comes back (the gear's Archived section).
 * Leaving them as they are is what the dialog opens on, so a stray Enter changes nothing.
 *
 * @param questions - What would change.
 * @param offered - The choices, in the order their buttons stand.
 * @param onChoose - Called with the choice.
 * @param onClose - Called on keeping them as they are, Escape, or a click away.
 */
export function ConfirmViz({ questions, offered, onChoose, onClose }: Readonly<ConfirmVizProps>) {
  const keepRef = useRef<HTMLButtonElement>(null)
  const single = questions.length === 1
  const unnamed = questions.length - NamedQty
  const archiving = offered.length === 1 && offered[0] === 'archived'
  const qty = String(questions.length)
  const counted = (one: string, many: string) => (single ? one : many)
  const heading = archiving ? counted('Archive this question?', `Archive ${qty} questions?`) : counted('How should this question be shown?', `How should ${qty} questions be shown?`)
  return (
    <Dialog
      open onClose={onClose} aria-labelledby="viz-questions-title" aria-describedby="viz-questions-consequence"
      slotProps={{ transition: { onEntering: () => { keepRef.current?.focus() } } }}
    >
      <DialogTitle id="viz-questions-title">{heading}</DialogTitle>
      <DialogContent>
        <List dense disablePadding>
          {questions.slice(0, NamedQty).map((question) => (
            <ListItem key={question._id} disableGutters>
              <ListItemText primary={<QuestionTitle question={question} untitled={question.label} />} secondary={question.qnum === '' ? null : `Q# ${question.qnum}`} />
            </ListItem>
          ))}
          {unnamed > 0 && <ListItem disableGutters><ListItemText secondary={`and ${String(unnamed)} more`} /></ListItem>}
        </List>
        <DialogContentText id="viz-questions-consequence">
          {archiving ? AppNotices.archivingQuestions : AppNotices.showingQuestions}
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button ref={keepRef} onClick={onClose}>{archiving ? counted('Keep it', 'Keep them') : 'Cancel'}</Button>
        {offered.map((viz) => {
          const { actname, Icon, color } = VizChoices[viz]
          return <Button key={viz} color={color} variant={viz === 'archived' ? 'contained' : 'outlined'} startIcon={<Icon />} onClick={() => { onChoose(viz) }}>{actname}</Button>
        })}
      </DialogActions>
    </Dialog>
  )
}
