import { vi } from 'vitest'
import type { ClockT } from '../../src/state/hunt-fetching'

/** A clock the test moves on (`advance`), running each timer that comes due, in order, as it passes */
export type TestClockT = ClockT & { advance: (ms: number) => void }

/**
 * A clock that tells the faked time (`vi.useFakeTimers({ toFake: ['Date'] })`) and moves only when
 * told, running each timer set on it as its time comes.
 *
 * @example const clock = testClock(); watchHunt(watcher, { ...setup, clock }, onReading); clock.advance(Pace.fetchEveryMs)
 */
export function testClock(): TestClockT {
  const timers = new Set<{ at: number, work: () => void }>()
  return {
    now:     () => Date.now(),
    after:   (ms, work) => {
      const timer = { at: Date.now() + ms, work }
      timers.add(timer)
      return () => { timers.delete(timer) }
    },
    advance: (ms) => {
      vi.setSystemTime(Date.now() + ms)
      const due = [...timers].filter((timer) => timer.at <= Date.now()).toSorted((aa, bb) => aa.at - bb.at)
      for (const timer of due) {
        timers.delete(timer)
        timer.work()
      }
    },
  }
}
