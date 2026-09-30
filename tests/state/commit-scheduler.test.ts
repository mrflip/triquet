import * as Z from 'zod'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createCommitScheduler, type MirrorSnapshot } from '../../src/state/commit-scheduler'
import { Quiz, type QuizT } from '../../src/models/quiz'
import { Here } from '../support/places'

/** What each commit was handed, in order: the quiz's title as it stood, and as it had become */
type Landed = { was: string | null, now: string }

/** A commit that notes what it was handed, having done nothing else */
function recordInto(landed: Landed[]) {
  return async (was: MirrorSnapshot | null, now: MirrorSnapshot) => {
    await Promise.resolve()
    landed.push({ was: was?.quiz.title ?? null, now: now.quiz.title })
  }
}

/** A scheduler that records what it commits, with `seconds` as its wait */
function schedulerOf(seconds: number, landed: Landed[], commit?: (was: MirrorSnapshot | null, now: MirrorSnapshot) => Promise<unknown>) {
  const scheduler = createCommitScheduler({
    seconds,
    commit: commit ?? recordInto(landed),
  })
  // These tests are about quizzes; the expressions that ride along are none, and every quiz sits in one place.
  return { ...scheduler, note: (before: QuizT | null, after: QuizT) => { scheduler.note(before && { quiz: before, expressions: [], place: Here }, { quiz: after, expressions: [], place: Here }) } }
}

const titled = (quiz: QuizT, title: string): QuizT => ({ ...quiz, title })
const sec = async (seconds: number) => { await vi.advanceTimersByTimeAsync(seconds * 1000) }

beforeEach(() => { vi.useFakeTimers() })
afterEach(() => { vi.useRealTimers() })

describe('createCommitScheduler, at the customer-facing 30 seconds', () => {
  it('commits once, thirty seconds after the first edit and not a moment before', async () => {
    const landed: Landed[] = []
    const scheduler = schedulerOf(30, landed)
    const quiz = Quiz.blank('One')
    scheduler.note(quiz, titled(quiz, 'Two'))

    await vi.advanceTimersByTimeAsync(29_999)
    expect(landed).to.deep.eq([])
    await vi.advanceTimersByTimeAsync(1)
    expect(landed).to.deep.eq([{ was: 'One', now: 'Two' }])
  })
})

describe('createCommitScheduler, at 2 seconds', () => {
  it('commits nothing while nothing has moved', async () => {
    const landed: Landed[] = []
    const scheduler = schedulerOf(2, landed)
    await sec(60)
    expect(landed).to.deep.eq([])
    expect(scheduler.pendingCount()).to.eq(0)
  })

  it('rejects a wait outside 2 to 600', () => {
    // By type, not by wording -- see tests/models/mirror-settings.test.ts.
    expect(() => schedulerOf(1, [])).to.throw(Z.ZodError)
    expect(() => schedulerOf(601, [])).to.throw(Z.ZodError)
  })

  it('shares one commit among a burst of edits, describing the whole burst', async () => {
    const landed: Landed[] = []
    const scheduler = schedulerOf(2, landed)
    const one = Quiz.blank('One')
    const two = titled(one, 'Two')
    const three = titled(one, 'Three')
    scheduler.note(one, two)
    scheduler.note(two, three)
    await sec(2)
    expect(landed).to.deep.eq([{ was: 'One', now: 'Three' }])
  })

  it('does not restart the clock on later edits, so continuous work is still committed on time', async () => {
    const landed: Landed[] = []
    const scheduler = schedulerOf(2, landed)
    const one = Quiz.blank('One')
    scheduler.note(one, titled(one, 'Two'))
    await vi.advanceTimersByTimeAsync(1500)
    scheduler.note(titled(one, 'Two'), titled(one, 'Three'))
    await vi.advanceTimersByTimeAsync(500)
    expect(landed).to.deep.eq([{ was: 'One', now: 'Three' }])
  })

  it('starts a fresh wait for edits that come after a commit', async () => {
    const landed: Landed[] = []
    const scheduler = schedulerOf(2, landed)
    const one = Quiz.blank('One')
    scheduler.note(one, titled(one, 'Two'))
    await sec(2)
    scheduler.note(titled(one, 'Two'), titled(one, 'Three'))
    await sec(2)
    expect(landed).to.deep.eq([{ was: 'One', now: 'Two' }, { was: 'Two', now: 'Three' }])
  })

  it('keeps separate quizzes on separate clocks and in separate commits', async () => {
    const landed: Landed[] = []
    const scheduler = schedulerOf(2, landed)
    const alpha = Quiz.blank('Alpha')
    const beta = Quiz.blank('Beta')
    scheduler.note(alpha, titled(alpha, 'Alpha!'))
    scheduler.note(beta, titled(beta, 'Beta!'))
    expect(scheduler.pendingCount()).to.eq(2)
    await sec(2)
    expect(landed.map((each) => each.now).toSorted((one, other) => one.localeCompare(other))).to.deep.eq(['Alpha!', 'Beta!'])
    expect(scheduler.pendingCount()).to.eq(0)
  })

  it('remembers a quiz that had no earlier state as having none', async () => {
    const landed: Landed[] = []
    const scheduler = schedulerOf(2, landed)
    scheduler.note(null, Quiz.blank('Brand new'))
    await sec(2)
    expect(landed).to.deep.eq([{ was: null, now: 'Brand new' }])
  })

  it('flush commits at once, resolves when the commit is done, and cancels the wait', async () => {
    const landed: Landed[] = []
    const scheduler = schedulerOf(2, landed)
    const one = Quiz.blank('One')
    scheduler.note(one, titled(one, 'Two'))
    await scheduler.flush(one._id)
    expect(landed).to.deep.eq([{ was: 'One', now: 'Two' }])
    await sec(60)
    expect(landed).to.have.lengthOf(1)
  })

  it('flush of a quiz with nothing waiting does nothing', async () => {
    const landed: Landed[] = []
    const scheduler = schedulerOf(2, landed)
    await scheduler.flush('nobody')
    expect(landed).to.deep.eq([])
  })

  it('flushAll commits every quiz that is waiting', async () => {
    const landed: Landed[] = []
    const scheduler = schedulerOf(2, landed)
    const alpha = Quiz.blank('Alpha')
    const beta = Quiz.blank('Beta')
    scheduler.note(alpha, titled(alpha, 'Alpha!'))
    scheduler.note(beta, titled(beta, 'Beta!'))
    await scheduler.flushAll()
    expect(landed).to.have.lengthOf(2)
    expect(scheduler.pendingCount()).to.eq(0)
  })

  it('carries on committing after a commit fails', async () => {
    const landed: Landed[] = []
    let attempts = 0
    const recording = recordInto(landed)
    const scheduler = schedulerOf(2, landed, async (was, now) => {
      attempts += 1
      if (attempts === 1) { throw new Error('the disk is full') }
      await recording(was, now)
    })
    const one = Quiz.blank('One')
    scheduler.note(one, titled(one, 'Two'))
    await sec(2)
    scheduler.note(titled(one, 'Two'), titled(one, 'Three'))
    await sec(2)
    expect(attempts).to.eq(2)
    expect(landed).to.deep.eq([{ was: 'Two', now: 'Three' }])
  })
})

describe('createCommitScheduler, carrying the expressions', () => {
  it('hands the commit the expressions as they were when the wait began and as they are now', async () => {
    const seen: [number, number][] = []
    const scheduler = createCommitScheduler({
      seconds: 2,
      commit: async (was, now) => { await Promise.resolve(); seen.push([was?.expressions.length ?? -1, now.expressions.length]) },
    })
    const quiz = Quiz.blank('One')
    const expression = { owner: 'tq' as const, label: 'shout', formula: '1', description: '' }
    scheduler.note({ quiz, expressions: [], place: Here }, { quiz, expressions: [expression], place: Here })
    scheduler.note({ quiz, expressions: [expression], place: Here }, { quiz, expressions: [expression, { ...expression, label: 'whisper' }], place: Here })
    await sec(2)
    expect(seen).to.deep.eq([[0, 2]])
  })
})
