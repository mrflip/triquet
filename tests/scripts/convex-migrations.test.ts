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

describe('stepOfBuild', () => {
  it("takes the commit and the first line of its message from Vercel's variables", () => {
    expect(ConvexMigrations.stepOfBuild({ VERCEL_GIT_COMMIT_SHA: '84de1bb0c2a1f5e6d7b8a9c0d1e2f3a4b5c6d7e8', VERCEL_GIT_COMMIT_MESSAGE: 'Jsonballs (#126)\n\nEvery resource…' }))
      .to.deep.equal({ sha: '84de1bb0c2a1f5e6d7b8a9c0d1e2f3a4b5c6d7e8', subject: 'Jsonballs (#126)' })
  })
  it("is null where Vercel names no commit", () => {
    expect(ConvexMigrations.stepOfBuild({})).to.be.null
  })
})

describe('subjectOf', () => {
  const SubjectCases: [string, string, string][] = [
    ['Jsonballs (#126)\n\nEvery resource…', 'Jsonballs (#126)', 'the first line of a message with a body'],
    ['  feat: one line  ',                     'feat: one line',   'a one-line message, trimmed'],
    ['',                                       '(no subject)',     'an empty message'],
    ['\n\nbody only',                          '(no subject)',     'a message whose first line is blank'],
  ]
  for (const [message, subject, blurb] of SubjectCases) {
    it(blurb, () => {
      expect(ConvexMigrations.subjectOf(message)).to.equal(subject)
    })
  }
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

describe('failureIn', () => {
  it("names what the function threw, after the CLI's first line, past the request id and the stack", () => {
    const stderr = '✖ Failed to run function "adopt:plan":\nConvexError: [Request ID: 4b30] Server Error\nUncaught ConvexError: No user has the email pat@example.com.\n    at userFound (../convex/adopt.ts:111:13)\n'
    expect(ConvexMigrations.failureIn(stderr)).to.eq('✖ Failed to run function "adopt:plan": Uncaught ConvexError: No user has the email pat@example.com.')
  })

  it('takes the first two lines when nothing names what was thrown', () => {
    expect(ConvexMigrations.failureIn('✖ Could not reach the deployment\nIs it running?\nTried three times')).to.eq('✖ Could not reach the deployment Is it running?')
  })

  it('takes what there is of a short or empty stderr', () => {
    expect([ConvexMigrations.failureIn('✖ Boom\n'), ConvexMigrations.failureIn('')]).to.deep.eq(['✖ Boom', ''])
  })
})
