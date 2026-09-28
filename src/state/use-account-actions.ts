'use client'

import { useCallback, useState } from 'react'
import { useMutation } from 'convex/react'
import { api } from '../../convex/_generated/api'
import { failurekindOf, noticeOf } from '../lib/refusals'
import type { AccountActionDNA } from '../models/actions'
import { useBrowserKey } from './browser-key'

/** How an account action came out: kept, or not and why */
export type AccountOutcome = { kept: true } | { kept: false, failurekind: string | null }

export type AccountActionsHandle = {
  /** Carry out `action`; resolves once it is written, or once it could not be, saying which and why */
  act:     (action: AccountActionDNA) => Promise<AccountOutcome>
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
 * needs what it wrote, and it resolves only once the screen's own reads have it.
 */
export function useAccountActions(): AccountActionsHandle {
  const browser_key = useBrowserKey()
  const performAccount = useMutation(api.idents.performAccount)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  const act = useCallback(async (action: AccountActionDNA): Promise<AccountOutcome> => {
    if (browser_key === null) { return { kept: false, failurekind: null } }
    setBusy(true)
    try {
      await performAccount({ action, browser_key })
      setNotice(null)
      return { kept: true }
    } catch (err) {
      console.error('Account: an action could not be carried out', action, err)
      setNotice(noticeOf(err))
      return { kept: false, failurekind: failurekindOf(err) }
    } finally {
      setBusy(false)
    }
  }, [browser_key, performAccount])

  return { act, busy, notice }
}
