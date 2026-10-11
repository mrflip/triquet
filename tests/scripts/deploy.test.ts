import { describe, expect, it } from 'vitest'
import * as Deploy from '../../scripts/deploy'

const ShaA = '84de1bb0c2a1f5e6d7b8a9c0d1e2f3a4b5c6d7e8'
const ShaB = '9e8d7c6b5a4f3e2d1c0b9a8f7e6d5c4b3a2f1e0d'
const ShaC = '1111111111111111111111111111111111111111'
const StepA = { sha: ShaA, subject: 'model: hunts remember their branch (widen)' }
const StepB = { sha: ShaB, subject: 'model: a hunt\'s branch is required (tighten)' }
const Head  = { sha: ShaC, subject: 'ui: the rows line up' }

describe('argsOf', () => {
  it("reads the flags, with the wait defaulting to the runner's limit", () => {
    expect(Deploy.argsOf(['--dry-run', '--to', 'origin/main'])).to.deep.equal({ dryRun: true, to: 'origin/main', from: undefined, wait: 300, snapshot: undefined, role: undefined, rehearse: undefined })
  })
  it("takes a role and a snapshot to rehearse", () => {
    expect(Deploy.argsOf(['--role', 'agent', '--rehearse', 'prd.zip', '--wait', '30'])).to.include({ role: 'agent', rehearse: 'prd.zip', wait: 30 })
  })
  it("takes a full sha for --from", () => {
    expect(Deploy.argsOf(['--from', ShaA]).from).to.equal(ShaA)
  })
  const RefusedCases: [string[], RegExp, string][] = [
    [['--rehearse', 'prd.zip'],      /needs --role/,        'a rehearsal with no role'],
    [['--from', '84de1bb'],          /forty/,               'an abbreviated sha'],
    [['--role', 'prod'],             /one of dev, agent/,   'a role that is not one'],
    [['--to'],                       /needs a value/,       'a flag with no value'],
    [['--to', '--dry-run'],          /needs a value/,       'a flag whose value is another flag'],
    [['--yolo'],                     /Usage.*what is --yolo/, 'a flag nobody knows'],
  ]
  for (const [argv, refusal, blurb] of RefusedCases) {
    it(`refuses ${blurb}`, () => {
      expect(() => Deploy.argsOf(argv)).to.throw(refusal)
    })
  }
})

describe('stepsOf', () => {
  it("reads the steps git lists, oldest first, skipping the commit lines", () => {
    const printed = `commit ${ShaA}\n${ShaA}\t${StepA.subject}\ncommit ${ShaB}\n${ShaB}\t${StepB.subject}\n`
    expect(Deploy.stepsOf(printed)).to.deep.equal([StepA, StepB])
  })
  it("reads nothing from nothing", () => {
    expect(Deploy.stepsOf('')).to.deep.equal([])
  })
  it("keeps a tab in a subject", () => {
    expect(Deploy.stepsOf(`commit ${ShaA}\n${ShaA}\tone\ttwo\n`)).to.deep.equal([{ sha: ShaA, subject: 'one\ttwo' }])
  })
})

describe('planOf', () => {
  it("has nothing to do when the head is recorded and backfilled", () => {
    expect(Deploy.planOf({ sha: ShaC, backfilled_at: 1 }, [], Head)).to.deep.equal({ kind: 'nothing', why: '11111111 is recorded, pushed and backfilled: nothing to do.' })
  })
  it("finishes a head recorded as pushed whose backfills never finished", () => {
    expect(Deploy.planOf({ sha: ShaC, backfilled_at: null }, [], Head)).to.deep.equal({ kind: 'finish', head: Head })
  })
  it("walks the steps after the mark, then lands the head", () => {
    expect(Deploy.planOf({ sha: 'f'.repeat(40), backfilled_at: 1 }, [StepA, StepB], Head)).to.deep.equal({ kind: 'walk', steps: [StepA, StepB], head: Head, landsHead: true })
  })
  it("does not land the head twice when it is the last step", () => {
    expect(Deploy.planOf({ sha: ShaA, backfilled_at: 1 }, [StepB], StepB)).to.deep.equal({ kind: 'walk', steps: [StepB], head: StepB, landsHead: false })
  })
  it("lands the head alone when no schema step lies between", () => {
    expect(Deploy.planOf({ sha: ShaA, backfilled_at: 1 }, [], Head)).to.deep.equal({ kind: 'walk', steps: [], head: Head, landsHead: true })
  })
  it("walks from a target with no mark, once told where it stands", () => {
    expect(Deploy.planOf(null, [StepA], Head).kind).to.equal('walk')
  })
})

describe('describePlan', () => {
  it("numbers the steps and names the head", () => {
    expect(Deploy.describePlan({ kind: 'walk', steps: [StepA, StepB], head: Head, landsHead: true })).to.deep.equal([
      `Step 1 of 2: 84de1bb0 ${StepA.subject}`,
      `Step 2 of 2: 9e8d7c6b ${StepB.subject}`,
      'Then the head: 11111111 ui: the rows line up',
    ])
  })
  it("says when the head is the last step", () => {
    expect(Deploy.describePlan({ kind: 'walk', steps: [StepB], head: StepB, landsHead: false })).to.have.lengthOf(1)
  })
  it("says what finishing and nothing mean", () => {
    expect(Deploy.describePlan({ kind: 'finish', head: Head })[0]).to.match(/never finished/)
    expect(Deploy.describePlan({ kind: 'nothing', why: 'all good' })).to.deep.equal(['all good'])
  })
})

describe('newestExported', () => {
  it("picks the step pushed last from an export's rows", () => {
    const jsonl = `${JSON.stringify({ sha: ShaA, subject: 'a', pushed_at: 1, backfilled_at: 1 })}\n${JSON.stringify({ sha: ShaB, subject: 'b', pushed_at: 2, backfilled_at: null })}\n`
    expect(Deploy.newestExported(jsonl)?.sha).to.equal(ShaB)
  })
  it("is null for an empty table", () => {
    expect(Deploy.newestExported('')).to.be.null
  })
})
