'use client'

import { useCallback, useLayoutEffect, useMemo, useRef } from 'react'
import { useConvex, useMutation } from 'convex/react'
import { api } from '../../convex/_generated/api'
import type * as Actor from '../lib/actor'
import * as Alarms from '../lib/alarms'
import * as Approve from '../lib/approve'
import { AppNotices, RefusalNotices } from '../lib/notices'
import * as Postmortem from '../lib/postmortem'
import { ActionValidators, type LibraryActionDNA } from '../models/actions'
import { useRaiseAlarm } from './alarms'
import { useIdent } from './use-ident'
import { holdThePage } from './page-hold'
import * as HuntMirror from './hunt-mirror'
import { showLibraryChanged } from './optimistic-library'

export type LibraryActionsHandle = {
  /** Carry out what an admin did to the library; a change not kept raises an alarm */
  dispatch: (action: LibraryActionDNA) => void
}

/**
 * Why the policies refuse `action` on the library from `actor`, judged as the server will judge
 * it once it has read it (`ActionValidators.libraryAction`); null when they allow it. An action
 * that does not read as one is left to the server, which refuses it saying what is wrong with it.
 *
 * @example libraryDenialOf(Actor.anonymous, { kind: 'delete_widget', label: 'dumdum' })  // => 'notIdentified'
 * @example libraryDenialOf(actor, { kind: 'move_widget', label: 'dumdum', onto_idx: 0 })  // => null, for an admin
 */
export function libraryDenialOf(actor: Actor.ActorT, action: LibraryActionDNA): Approve.Denialkind | null {
  const read = ActionValidators.libraryAction.safeParse(action)
  if (! read.success) { return null }
  const verdict = Approve.verdictOn(read.data.kind, actor, read.data)
  return verdict === Approve.Allow ? null : verdict
}

/**
 * Changes to the library of widgets every hunt shares, written the moment each is dispatched, on
 * the library's own mutation (`widgets.perform`): no hunt or quiz need be open, since the library
 * belongs to none and only the actor is asked of. As with a quiz's changes (`useHunt`), there is
 * no save button: leaving the page while one is written asks first, the quiz's history waits on
 * it (a quiz's history holds the widgets it works), and one the server refuses writes nothing and
 * raises an alarm saying why. One the policies refuse of the actor this browser is
 * (`libraryDenialOf`) is not sent at all: a view offers the library's doors only to whoever may
 * change it (`change_library`), so that is said in the console as a bug, and to the author as the
 * server would have said it.
 *
 * Changes from one browser are carried out in the order they were made, whichever mutation each
 * rides: a widget made here is in the library before a widgeting dispatched after it works it. A
 * widget written or revised is shown at once (`showLibraryChanged`), so an ask made straight after
 * reads it as written; anything else once the server has it.
 *
 * @returns The dispatcher. Whether a change is still being written is the page's (`usePageWriting`).
 */
export function useLibraryActions(): LibraryActionsHandle {
  const { actor } = useIdent()
  const performBare = useMutation(api.widgets.perform)
  // Made once: `withOptimisticUpdate` makes a new mutation each time it is asked.
  const perform = useMemo(() => performBare.withOptimisticUpdate(showLibraryChanged), [performBare])
  const convex = useConvex()
  const raise = useRaiseAlarm()

  // Read by the dispatcher when it runs rather than when it was made, so it never goes stale.
  const latest = useRef(actor)
  useLayoutEffect(() => { latest.current = actor })

  const carryOut = useCallback(async (action: LibraryActionDNA): Promise<void> => {
    const denial = libraryDenialOf(latest.current, action)
    if (denial !== null) {
      Postmortem.report(`send a change to the library (${action.kind})`, new Approve.NotApprovedError(denial, { policy: action.kind }), { action })
      raise({ headline: AppNotices.changeNotKept, notice: RefusalNotices[denial], request_id: null })
      return
    }
    holdThePage(true)
    try {
      await perform({ action })
    } catch (err) {
      const { isWebSocketConnected, connectionRetries, inflightMutations } = convex.connectionState()
      Postmortem.report(`keep a change to the library (${action.kind})`, err, { action, connection: { isWebSocketConnected, connectionRetries, inflightMutations } })
      raise(Alarms.of(AppNotices.changeNotKept, err))
    } finally {
      holdThePage(false)
    }
  }, [perform, convex, raise])

  const dispatch = useCallback((action: LibraryActionDNA) => { HuntMirror.trackWrite(carryOut(action)) }, [carryOut])

  return { dispatch }
}
