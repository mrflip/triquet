'use client'

import { Box, IconButton, InputBase, TextField } from '@mui/material'
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined'
import clsx from 'clsx'
import { useDraft } from './use-draft'
import { AppNotices } from '../lib/notices'
import styles from './workbench.module.css'

/** How many lines the smith's note grows to, pushing the page down, before it scrolls instead */
export const SmithsNoteMaxRows = 14

export type QuizHeaderProps = {
  title:        string
  smithsNote:   string
  locked:       boolean
  saveNotice:   string | null
  onRetitle:    (title: string) => void
  onSmithsNote: (smiths_note: string) => void
  onManage:     () => void
}

/**
 * The quiz's name, as wide as what it says and growing as it is typed into; the gear that opens
 * the rest of the quiz's settings; the two pills that only appear when they have something to
 * say; and, filling the rest of the row, the smith's note, which grows to several paragraphs
 * before it scrolls.
 */
export function QuizHeader({ title, smithsNote, locked, saveNotice, onRetitle, onSmithsNote, onManage }: Readonly<QuizHeaderProps>) {
  // The quiz name is the one field that updates live rather than on blur.
  const { draft, onChange, onBlur } = useDraft(title, onRetitle)
  const note = useDraft(smithsNote, onSmithsNote)

  return (
    <Box component="header" sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, flexWrap: 'wrap', mt: 0.5, mb: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap', maxWidth: '100%' }}>
        <span className={clsx(styles.pill, styles.pillQuiet)}>Quiz</span>
        <InputBase
          value={draft}
          placeholder={AppNotices.untitledQuiz}
          readOnly={locked}
          inputProps={{ 'aria-label': 'Quiz name', size: Math.max(draft.length, AppNotices.untitledQuiz.length) + 1 }}
          onChange={(event) => {
            onChange(event.target.value)
            onRetitle(event.target.value)
          }}
          onBlur={onBlur}
          sx={{
            flex:          '0 1 auto',
            maxWidth:      '100%',
            px:            0.75,
            py:            0.25,
            fontFamily:    'var(--font-display)',
            fontSize:      30,
            fontWeight:    600,
            border:        '1px solid transparent',
            borderRadius:  'var(--radius-input)',
            // As wide as the title, where the browser can size a field to its text; `size` stands in where it can't.
            '& input':        { fieldSizing: 'content', minWidth: '4ch' },
            '&:hover':        { borderColor: locked ? 'transparent' : 'var(--border)' },
            '&.Mui-focused':  { borderColor: 'var(--accent)', bgcolor: 'color-mix(in srgb, var(--accent-soft) 45%, transparent)' },
          }}
        />
        <IconButton aria-label="Manage quiz" onClick={onManage}>
          <SettingsOutlinedIcon sx={{ fontSize: 30 }} />
        </IconButton>
        {locked ? <span className={clsx(styles.pill, styles.pillWarn)}>Locked</span> : null}
        {saveNotice ? <span className={clsx(styles.pill, styles.pillBad)} role="status">{saveNotice}</span> : null}
      </Box>
      <TextField
        label="Smith's note"
        multiline
        minRows={1}
        maxRows={SmithsNoteMaxRows}
        size="small"
        value={note.draft}
        placeholder={AppNotices.smithsNoteBlank}
        onChange={(event) => { note.onChange(event.target.value) }}
        onBlur={note.onBlur}
        slotProps={{ input: { readOnly: locked } }}
        sx={{ flex: '1 1 320px', minWidth: 'min(320px, 100%)', mt: 0.75 }}
      />
    </Box>
  )
}
