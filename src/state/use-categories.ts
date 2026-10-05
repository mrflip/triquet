'use client'

import { useCallback, useState } from 'react'
import { useMutation } from 'convex/react'
import type { OptimisticLocalStore } from 'convex/browser'
import { api } from '../../convex/_generated/api'
import * as Alarms from '../lib/alarms'
import { AppNotices } from '../lib/notices'
import * as Postmortem from '../lib/postmortem'
import type { AccountActionDNA } from '../models/actions'
import type { WheelT } from '../models/category'
import { useRaiseAlarm } from './alarms'
import { useHuntOpening, type HuntOpeningHandle } from './use-hunt-opening'
import { useSession } from './use-session'

export type CategoriesHandle = HuntOpeningHandle & {
  /** Whether a rearrangement is still being written */
  unsaved:  boolean
  /** Arrange the hunt's categories as `wheel`, shown at once and written behind the screen; one not kept raises an alarm and is taken back */
  arrange:  (wheel: WheelT) => void
}

/**
 * Every watched opening of the hunt an arrangement names, shown with its new wheel while the
 * write is on its way: a wheel dragged into place stays there rather than jumping back for a
 * moment. The server's answer replaces it, or, when the write is refused, takes it back.
 *
 * @param store - The client's watched results, to patch.
 * @param args - What the mutation was called with; only an arrangement is shown early.
 *
 * @example useMutation(api.idents.performAccount).withOptimisticUpdate(showArranged)
 */
export function showArranged(store: OptimisticLocalStore, { action }: { action: AccountActionDNA }): void {
  if (action.kind !== 'arrange_categories') { return }
  for (const { args, value } of store.getAllQueries(api.hunts.open)) {
    if (value?.why !== null || value.hunt._id !== action.hunt_id) { continue }
    store.setQuery(api.hunts.open, args, { ...value, hunt: { ...value.hunt, wheel: action.wheel } })
  }
}

/**
 * The hunt labelled `hunt_label`, live, as its categories screen holds it: its wheel, who is on it
 * and this visitor's role, and a way for a smith to rearrange the wheel. Someone not on the hunt
 * is shown none of it, only who could add them.
 *
 * Each rearrangement shows at once and is written behind the screen; one the server refuses is
 * taken back, and says why in an alarm.
 *
 * @param hunt_label - The hunt the address names.
 * @returns The hunt, where finding it stands, and the arranger.
 */
export function useCategories(hunt_label: string): CategoriesHandle {
  const { ready } = useSession()
  const raise = useRaiseAlarm()
  const [writing, setWriting] = useState(0)
  const performAccount = useMutation(api.idents.performAccount).withOptimisticUpdate(showArranged)
  const opened = useHuntOpening(hunt_label)
  const hunt_id = opened.hunt?._id ?? null

  const arrange = useCallback((wheel: WheelT) => {
    if (hunt_id === null || ! ready) { return }
    const action = { kind: 'arrange_categories', hunt_id, wheel } as const
    const write = async () => {
      setWriting((was) => was + 1)
      try {
        await performAccount({ action })
      } catch (err) {
        Postmortem.report('arrange the categories', err, { hunt: hunt_label })
        raise(Alarms.of(AppNotices.changeNotKept, err))
      } finally {
        setWriting((was) => was - 1)
      }
    }
    void write()
  }, [hunt_id, ready, hunt_label, performAccount, raise])

  return { ...opened, unsaved: writing > 0, arrange }
}
