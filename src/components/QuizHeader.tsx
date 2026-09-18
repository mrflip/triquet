'use client'

import clsx from 'clsx'
import { useDraft } from './use-draft'
import { AppNotices } from '../lib/notices'
import styles from './workbench.module.css'

export type QuizHeaderProps = {
  title:      string
  locked:     boolean
  saveNotice: string | null
  onRetitle:  (title: string) => void
}

/** The round's name, and the two pills that only appear when they have something to say */
export function QuizHeader({ title, locked, saveNotice, onRetitle }: Readonly<QuizHeaderProps>) {
  // The round name is the one field that updates live rather than on blur.
  const { draft, onChange, onBlur } = useDraft(title, onRetitle)

  return (
    <header style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', margin: '4px 0 16px' }}>
      <span className={clsx(styles.pill, styles.pillQuiet)}>Trivia round</span>
      <input
        className={styles.titleField}
        aria-label="Round name"
        placeholder={AppNotices.untitledQuiz}
        readOnly={locked}
        value={draft}
        onChange={(event) => {
          onChange(event.target.value)
          onRetitle(event.target.value)
        }}
        onBlur={onBlur}
      />
      {locked ? <span className={clsx(styles.pill, styles.pillWarn)}>Locked</span> : null}
      {saveNotice ? <span className={clsx(styles.pill, styles.pillBad)} role="status">{saveNotice}</span> : null}
    </header>
  )
}
