'use client'

import { useCallback, useState } from 'react'
import { useMutation } from 'convex/react'
import { useAuthActions } from '@convex-dev/auth/react'
import { api } from '../../convex/_generated/api'
import * as Alarms from '../lib/alarms'
import { AppNotices, RefusalNotices } from '../lib/notices'
import * as Postmortem from '../lib/postmortem'
import { failurekindOf, noticeOf } from '../lib/refusals'
import type { AccountActionDNA } from '../models/actions'
import { useSession } from './use-session'

/**
 * How an account action came out: kept, or not, why, and the alarm to raise for it, for a caller
 * with nowhere beside the action to say so
 */
export type AccountOutcome = { kept: true } | { kept: false, failurekind: string | null, alarm: Alarms.AlarmT }

export type AccountActionsHandle = {
  /** Carry out `action`; resolves once it is written, or once it could not be, saying which and why */
  act:     (action: AccountActionDNA) => Promise<AccountOutcome>
  /** Whether an action is being written */
  busy:    boolean
  /** Why the last action could not be carried out; null while all is well */
  notice:  string | null
}

/**
 * What a visitor can do before any quiz is open -- assert a username, make a hunt -- carried out
 * one at a time, with a sentence rather than a code when one fails.
 *
 * Unlike a change to a quiz, the caller waits on these: each is followed by a navigation that
 * needs what it wrote, and it resolves only once the screen's own reads have it. A session the
 * server no longer holds (`notSignedIn`) is let go, so that a fresh one is signed in for the next
 * try.
 */
export function useAccountActions(): AccountActionsHandle {
  const { ready } = useSession()
  const { signOut } = useAuthActions()
  const performAccount = useMutation(api.idents.performAccount)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  const act = useCallback(async (action: AccountActionDNA): Promise<AccountOutcome> => {
    if (! ready) {
      setNotice(RefusalNotices.notSignedIn)
      return { kept: false, failurekind: 'notSignedIn', alarm: { headline: AppNotices.changeNotKept, notice: RefusalNotices.notSignedIn, request_id: null } }
    }
    setBusy(true)
    try {
      await performAccount({ action })
      setNotice(null)
      return { kept: true }
    } catch (err) {
      Postmortem.report(`carry out an account action (${action.kind})`, err, { action })
      setNotice(noticeOf(err))
      const failurekind = failurekindOf(err)
      if (failurekind === 'notSignedIn') { void signOut() }
      return { kept: false, failurekind, alarm: Alarms.of(AppNotices.changeNotKept, err) }
    } finally {
      setBusy(false)
    }
  }, [ready, performAccount, signOut])

  return { act, busy, notice }
}
