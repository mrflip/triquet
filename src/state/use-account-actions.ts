'use client'

import { useCallback, useState } from 'react'
import type { Db } from 'jazz-tools'
import { useDb } from 'jazz-tools/react'
import { AppNotices } from '../lib/notices'
import { performAccount } from './account-actions'
import { loadDirectory } from './quiz-rows'
import type { AccountAction } from './actions'

export type AccountActionsHandle = {
  /** Carry out `action`; resolves true once it is written, false when it could not be */
  act:     (action: AccountAction) => Promise<boolean>
  /** Whether an action is being written */
  busy:    boolean
  /** Why the last action could not be carried out; null while all is well */
  notice:  string | null
}

/**
 * What a visitor can do before any quiz is open -- become an ident, make a hunt -- carried out
 * one at a time, with a sentence rather than a code when one fails.
 *
 * Unlike a change to a quiz, the caller waits on these: each is followed by a navigation that
 * needs what it wrote.
 */
export function useAccountActions(): AccountActionsHandle {
  const db: Db = useDb()
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  const act = useCallback(async (action: AccountAction): Promise<boolean> => {
    setBusy(true)
    try {
      await performAccount(db, await loadDirectory(db), action)
      setNotice(null)
      return true
    } catch (err) {
      console.error('Account: an action could not be carried out', action, err)
      setNotice(AppNotices.changeFailed)
      return false
    } finally {
      setBusy(false)
    }
  }, [db])

  return { act, busy, notice }
}
