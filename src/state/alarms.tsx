'use client'

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import type { AlarmT } from '../lib/alarms'

/** Raise an alarm: it replaces any still showing */
type RaiseAlarm = (alarm: AlarmT) => void

export type AlarmHandle = {
  /** The alarm showing; null when there is none, or it was dismissed */
  alarm:   AlarmT | null
  /** Take the alarm down: the author has seen it */
  dismiss: () => void
}

// Two contexts, so a hook that only raises is not drawn again each time an alarm comes and goes.
const RaiseContext = createContext<RaiseAlarm | null>(null)
const AlarmContext = createContext<AlarmHandle | null>(null)

/**
 * The page's one alarm: a failure raised anywhere below, held until the author dismisses it.
 * One at a time, the latest in front, since the latest is what the author just did; an alarm
 * raised while one shows replaces it. Wraps the whole app, so every screen has it.
 */
export function AlarmsProvider({ children }: Readonly<{ children: ReactNode }>) {
  const [alarm, setAlarm] = useState<AlarmT | null>(null)
  const dismiss = useCallback(() => { setAlarm(null) }, [])
  const handle = useMemo(() => ({ alarm, dismiss }), [alarm, dismiss])
  return (
    <RaiseContext value={setAlarm}>
      <AlarmContext value={handle}>
        {children}
      </AlarmContext>
    </RaiseContext>
  )
}

/**
 * How a failure the author must see, wherever they are on the page, reaches them: raise it, and
 * the page's alarm shows it until dismissed. For a failure with nothing on screen beside it to
 * say so -- a change written behind the screen, a navigation that did not happen. A refusal the
 * screen already shows beside the field it was about needs none.
 *
 * @returns The function that raises an alarm.
 *
 * @example const raise = useRaiseAlarm()
 *   raise(Alarms.of(AppNotices.changeNotKept, err))
 */
export function useRaiseAlarm(): RaiseAlarm {
  const raise = useContext(RaiseContext)
  if (raise === null) { throw new Error('useRaiseAlarm wants an AlarmsProvider above it') }
  return raise
}

/**
 * The alarm showing, and how to take it down: for the view that shows it.
 *
 * @returns The alarm, and its dismissal.
 */
export function useAlarm(): AlarmHandle {
  const handle = useContext(AlarmContext)
  if (handle === null) { throw new Error('useAlarm wants an AlarmsProvider above it') }
  return handle
}
