'use client'

import { useCallback } from 'react'
import { InputBase } from '@mui/material'
import { useDraft } from './use-draft'
import type { UserT } from '../models/user'
import { useRaiseAlarm } from '../state/alarms'
import { useUserActions } from '../state/use-user-actions'

export type UserTitleProps = {
  /** Who the visitor is */
  user:      UserT
  /** Told the title they leave the field holding, once it differs from what it was */
  onRetitle: (title: string) => void
}

/**
 * What the visitor is called on screen, retitled in place: saved when it loses focus, and put
 * back as it was when left blank.
 */
export function UserTitle({ user, onRetitle }: Readonly<UserTitleProps>) {
  const { draft, onChange, onBlur } = useDraft(user.title, onRetitle, (typed) => typed.trim() || user.title)
  return (
    <InputBase
      value={draft}
      inputProps={{ 'aria-label': 'Your name', size: Math.max(draft.length, 4) }}
      onChange={(event) => { onChange(event.target.value) }}
      onBlur={onBlur}
      sx={{
        fontWeight:    700,
        px:            0.5,
        '& input':     { fieldSizing: 'content', minWidth: '4ch' },
        border:        '1px solid transparent',
        borderRadius:  'var(--radius-input)',
        '&:hover':       { borderColor: 'var(--border)' },
        '&.Mui-focused': { borderColor: 'var(--accent)' },
      }}
    />
  )
}

/**
 * Retitling the visitor's user, as `UserTitle` wants it told: a retitle not kept raises an alarm.
 *
 * @returns What to tell the field.
 */
export function useRetitleUser(): (title: string) => void {
  const { act } = useUserActions()
  const raise = useRaiseAlarm()
  return useCallback((title: string) => {
    const retitle = async () => {
      const outcome = await act({ kind: 'retitle_user', title })
      if (! outcome.kept) { raise(outcome.alarm) }
    }
    void retitle()
  }, [act, raise])
}
