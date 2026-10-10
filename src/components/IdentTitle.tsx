'use client'

import { useCallback } from 'react'
import { InputBase } from '@mui/material'
import { useDraft } from './use-draft'
import type { IdentT } from '../models/ident'
import { useRaiseAlarm } from '../state/alarms'
import { useAccountActions } from '../state/use-account-actions'

export type IdentTitleProps = {
  /** Who the visitor is */
  ident:     IdentT
  /** Told the title they leave the field holding, once it differs from what it was */
  onRetitle: (title: string) => void
}

/**
 * What the visitor is called on screen, retitled in place: saved when it loses focus, and put
 * back as it was when left blank.
 */
export function IdentTitle({ ident, onRetitle }: Readonly<IdentTitleProps>) {
  const { draft, onChange, onBlur } = useDraft(ident.title, onRetitle, (typed) => typed.trim() || ident.title)
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
 * Retitling the visitor's ident, as `IdentTitle` wants it told: a retitle not kept raises an alarm.
 *
 * @returns What to tell the field.
 */
export function useRetitleIdent(): (title: string) => void {
  const { act } = useAccountActions()
  const raise = useRaiseAlarm()
  return useCallback((title: string) => {
    const retitle = async () => {
      const outcome = await act({ kind: 'retitle_ident', title })
      if (! outcome.kept) { raise(outcome.alarm) }
    }
    void retitle()
  }, [act, raise])
}
