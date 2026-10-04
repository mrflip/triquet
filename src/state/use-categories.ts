'use client'

import { useCallback, useState } from 'react'
import { useMutation, useQuery } from 'convex/react'
import type { OptimisticLocalStore } from 'convex/browser'
import { api } from '../../convex/_generated/api'
import * as Alarms from '../lib/alarms'
import { AppNotices } from '../lib/notices'
import * as Postmortem from '../lib/postmortem'
import { smithsOf, type HuntOpeningT, type ShallowHuntT, type SmithT } from '../lib/rows'
import { ValidatorKit } from '../lib/validator'
import type { AccountActionDNA } from '../models/actions'
import type { WheelT } from '../models/category'
import type { HuntRole } from '../models/hunting'
import { useRaiseAlarm } from './alarms'
import { useBrowserKey } from './browser-key'

/**
 * Where finding the hunt an address names stands: still looking, looked and it is not there,
 * there but not this visitor's to see, or found
 */
export type HuntFinding = 'waiting' | 'missing' | 'refused' | 'found'

export type CategoriesHandle = {
  /** Whether the hunt has been found, is not there to find, or is not this visitor's to see */
  finding:  HuntFinding
  /** The hunt, with its wheel; null until it is found */
  hunt:     ShallowHuntT | null
  /** What this browser's ident does on the hunt; null when it is not on it, or the hunt has not arrived */
  role:     HuntRole | null
  /** Who could put this visitor on the hunt; empty until the hunt has arrived */
  smiths:   readonly SmithT[]
  /** Whether a rearrangement is still being written */
  unsaved:  boolean
  /** Arrange the hunt's categories as `wheel`, shown at once and written behind the screen; one not kept raises an alarm and is taken back */
  arrange:  (wheel: WheelT) => void
}

/**
 * Where finding the hunt stands, from what the server said of it.
 *
 * @param askable - Whether the address's label could name a hunt at all.
 * @param opening - What the server said of the hunt; undefined until it has.
 *
 * @example findingOf(true, { why: 'notOnHunt', hunt: null, smiths: [] })  // => 'refused'
 */
export function findingOf(askable: boolean, opening: HuntOpeningT | undefined): HuntFinding {
  if (! askable) { return 'missing' }
  if (opening === undefined) { return 'waiting' }
  if (opening.why === 'notOnHunt') { return 'refused' }
  return opening.why === 'noSuchHunt' ? 'missing' : 'found'
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
  const browser_key = useBrowserKey()
  const raise = useRaiseAlarm()
  const [writing, setWriting] = useState(0)
  const performAccount = useMutation(api.idents.performAccount).withOptimisticUpdate(showArranged)

  // A label that cannot be one names no hunt, and is not asked about.
  const askable = ValidatorKit.label.safeParse(hunt_label).success
  const opening = useQuery(api.hunts.open, askable && browser_key !== null ? { hunt_label, browser_key } : 'skip')
  const hunt = opening?.hunt ?? null
  const hunt_id = hunt?._id ?? null

  const arrange = useCallback((wheel: WheelT) => {
    if (hunt_id === null || browser_key === null) { return }
    const action = { kind: 'arrange_categories', hunt_id, wheel } as const
    const write = async () => {
      setWriting((was) => was + 1)
      try {
        await performAccount({ action, browser_key })
      } catch (err) {
        Postmortem.report('arrange the categories', err, { hunt: hunt_label })
        raise(Alarms.of(AppNotices.changeNotKept, err))
      } finally {
        setWriting((was) => was - 1)
      }
    }
    void write()
  }, [hunt_id, browser_key, hunt_label, performAccount, raise])

  const smiths = opening?.why === 'notOnHunt' ? opening.smiths : smithsOf(hunt?.members ?? [])
  return { finding: findingOf(askable, opening), hunt, role: hunt?.role ?? null, smiths, unsaved: writing > 0, arrange }
}
