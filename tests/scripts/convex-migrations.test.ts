import { describe, expect, it } from 'vitest'
import * as ConvexMigrations from '../../scripts/convex-migrations'

const Running: ConvexMigrations.Outstanding = { name: 'migrations:backfillQ1Preambles', state: 'inProgress', processed: 100 }
const Unstarted: ConvexMigrations.Outstanding = { name: 'migrations:backfillSmithsNotes', state: 'unknown', processed: 0 }
const Failed: ConvexMigrations.Outstanding = { name: 'migrations:backfillQ1Preambles', state: 'failed', processed: 100, error: 'Boom' }
const Canceled: ConvexMigrations.Outstanding = { name: 'migrations:backfillQ1Preambles', state: 'canceled', processed: 0 }

describe('standingOf', () => {
  const StandingCases: [ConvexMigrations.Outstanding[], string, string][] = [
    [[],                   'done',    'nothing outstanding is done'],
    [[Running, Unstarted], 'waiting', 'one running and one yet to start is waiting'],
    [[Unstarted],          'waiting', 'one yet to start is waiting: the series may be about to reach it'],
    [[Failed, Unstarted],  'stuck',   'a failure is stuck, whatever follows it'],
    [[Canceled],           'stuck',   'a cancelation is stuck'],
  ]
  for (const [outstanding, standing, blurb] of StandingCases) {
    it(blurb, () => {
      expect(ConvexMigrations.standingOf(outstanding)).to.equal(standing)
    })
  }
})

describe('lineFor', () => {
  it("names the backfill, its state and how far it got", () => {
    expect(ConvexMigrations.lineFor(Running)).to.equal('migrations:backfillQ1Preambles: inProgress, 100 rows done')
  })
  it("adds the error of one that failed", () => {
    expect(ConvexMigrations.lineFor(Failed)).to.equal('migrations:backfillQ1Preambles: failed, 100 rows done: Boom')
  })
})

describe('isProductionBuild', () => {
  it("is true for Vercel's production build alone", () => {
    expect([{ VERCEL_ENV: 'production' }, { VERCEL_ENV: 'preview' }, {}].map((env) => ConvexMigrations.isProductionBuild(env))).to.deep.equal([true, false, false])
  })
})

/** A waiter answering each look with the next of `looks` (the last one again once they run out), on a clock that moves only when it pauses */
function scripted(looks: ConvexMigrations.Outstanding[][]) {
  let clock = 0
  let seen  = 0
  const pauses: number[] = []
  const waiter: ConvexMigrations.Waiter = {
    look:  () => Promise.resolve(looks[Math.min(seen++, looks.length - 1)] ?? []),
    pause: (ms) => {
      pauses.push(ms)
      clock += ms
      return Promise.resolve()
    },
    now: () => clock,
  }
  return { waiter, pauses, looked: () => seen }
}

describe('awaitBackfills', () => {
  it("answers at once when nothing is outstanding", async () => {
    const { waiter, pauses } = scripted([[]])
    expect(await ConvexMigrations.awaitBackfills(waiter, 60)).to.deep.equal({ standing: 'done', outstanding: [] })
    expect(pauses).to.deep.equal([])
  })

  it("looks again every few seconds until the backfills finish", async () => {
    const { waiter, pauses } = scripted([[Running, Unstarted], [Unstarted], []])
    expect(await ConvexMigrations.awaitBackfills(waiter, 60)).to.deep.equal({ standing: 'done', outstanding: [] })
    expect(pauses).to.deep.equal([5000, 5000])
  })

  it("stops waiting as soon as one is stuck", async () => {
    const { waiter, looked } = scripted([[Running], [Failed, Unstarted], []])
    expect(await ConvexMigrations.awaitBackfills(waiter, 60)).to.deep.equal({ standing: 'stuck', outstanding: [Failed, Unstarted] })
    expect(looked()).to.equal(2)
  })

  it("gives up at its limit, saying what is still running", async () => {
    const { waiter, looked } = scripted([[Running]])
    expect(await ConvexMigrations.awaitBackfills(waiter, 12)).to.deep.equal({ standing: 'waiting', outstanding: [Running] })
    expect(looked()).to.equal(4)
  })
})
