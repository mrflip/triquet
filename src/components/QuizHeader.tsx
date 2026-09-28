'use client'

import { IconButton, InputBase } from '@mui/material'
import clsx from 'clsx'
import { useDraft } from './use-draft'
import { AppNotices } from '../lib/notices'
import styles from './workbench.module.css'

export type QuizHeaderProps = {
  title:      string
  locked:     boolean
  saveNotice: string | null
  onRetitle:  (title: string) => void
  onManage:   () => void
}

/** The quiz's name, and the two pills that only appear when they have something to say */
export function QuizHeader({ title, locked, saveNotice, onRetitle, onManage }: Readonly<QuizHeaderProps>) {
  // The quiz name is the one field that updates live rather than on blur.
  const { draft, onChange, onBlur } = useDraft(title, onRetitle)

  return (
    <header style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', margin: '4px 0 16px' }}>
      <span className={clsx(styles.pill, styles.pillQuiet)}>Quiz</span>
      <InputBase
        value={draft}
        placeholder={AppNotices.untitledQuiz}
        readOnly={locked}
        inputProps={{ 'aria-label': 'Quiz name' }}
        onChange={(event) => {
          onChange(event.target.value)
          onRetitle(event.target.value)
        }}
        onBlur={onBlur}
        sx={{
          flex:          '1 1 320px',
          maxWidth:      640,
          px:            0.75,
          py:            0.25,
          fontFamily:    'var(--font-display)',
          fontSize:      30,
          fontWeight:    600,
          border:        '1px solid transparent',
          borderRadius:  'var(--radius-input)',
          '&:hover':        { borderColor: locked ? 'transparent' : 'var(--border)' },
          '&.Mui-focused':  { borderColor: 'var(--accent)', bgcolor: 'color-mix(in srgb, var(--accent-soft) 45%, transparent)' },
        }}
      />
      <IconButton size="small" aria-label="Manage quiz" onClick={onManage} sx={{ fontSize: 18 }}>⚙</IconButton>
      {locked ? <span className={clsx(styles.pill, styles.pillWarn)}>Locked</span> : null}
      {saveNotice ? <span className={clsx(styles.pill, styles.pillBad)} role="status">{saveNotice}</span> : null}
    </header>
  )
}
