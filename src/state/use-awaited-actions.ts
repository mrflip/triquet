'use client'

import { useCallback, useState } from 'react'
import { useAuthActions } from '@convex-dev/auth/react'
import * as Alarms from '../lib/alarms'
import { AppNotices, RefusalNotices } from '../lib/notices'
import * as Postmortem from '../lib/postmortem'
import { failurekindOf, noticeOf } from '../lib/refusals'
import { useSession } from './use-session'

/**
 * How an awaited action came out: kept, or not, why, and the alarm to raise for it, for a caller
 * with nowhere beside the action to say so
 */
export type AwaitedOutcome = { kept: true } | { kept: false, failurekind: string | null, alarm: Alarms.AlarmT }

export type AwaitedActionsHandle<DNA> = {
  /** Carry out `action`; resolves once it is written, or once it could not be, saying which and why */
  act:     (action: DNA) => Promise<AwaitedOutcome>
  /** Whether an action is being written */
  busy:    boolean
  /** Why the last action could not be carried out; null while all is well */
  notice:  string | null
}

/** A public mutation carrying out one action, as `idents.perform` and `hunts.performOuter` do, made by `useMutation` */
export type PerformingT<DNA> = (args: { action: DNA }) => Promise<unknown>

/**
 * What a visitor can do outside any quiz, by `perform` -- assert a userlabel, make a hunt --
 * carried out one at a time, with a sentence rather than a code when one fails. The hooks for each
 * noun (`useUserActions`, `useOuterHuntActions`) make their mutation and hand it here.
 *
 * Unlike a change to a quiz, the caller waits on these: each is followed by a navigation that
 * needs what it wrote, and it resolves only once the screen's own reads have it. A session the
 * server no longer holds (`notSignedIn`) is let go, so that a fresh one is signed in for the next
 * try.
 *
 * @param perform - The mutation that carries the actions out, as `useMutation` makes it.
 * @param what - What the actions are, as a postmortem names them: `'a user action'`.
 */
export function useAwaitedActions<DNA extends { kind: string }>(perform: PerformingT<DNA>, what: string): AwaitedActionsHandle<DNA> {
  const { ready } = useSession()
  const { signOut } = useAuthActions()
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  const act = useCallback(async (action: DNA): Promise<AwaitedOutcome> => {
    if (! ready) {
      setNotice(RefusalNotices.notSignedIn)
      return { kept: false, failurekind: 'notSignedIn', alarm: { headline: AppNotices.changeNotKept, notice: RefusalNotices.notSignedIn, request_id: null } }
    }
    setBusy(true)
    try {
      await perform({ action })
      setNotice(null)
      return { kept: true }
    } catch (err) {
      Postmortem.report(`carry out ${what} (${action.kind})`, err, { action })
      setNotice(noticeOf(err))
      const failurekind = failurekindOf(err)
      if (failurekind === 'notSignedIn') { void signOut() }
      return { kept: false, failurekind, alarm: Alarms.of(AppNotices.changeNotKept, err) }
    } finally {
      setBusy(false)
    }
  }, [ready, perform, signOut, what])

  return { act, busy, notice }
}
