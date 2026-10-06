import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import * as E2eLog from '../../scripts/e2e-log'

/** A spec in a Playwright JSON report, with one test of the given statuses */
const specOf = (file: string, title: string, status: string, expectedStatus = 'passed') => ({
  title, file, tests: [{ status, expectedStatus }],
})

describe('E2eLog.outcomesOf', () => {
  it("names each spec by its file and titles, its file's own suite left out", () => {
    const report = { suites: [{
      title: 'grid.spec.ts', file: 'grid.spec.ts',
      specs:  [specOf('grid.spec.ts', 'loads', 'expected')],
      suites: [{ title: 'Folding', file: 'grid.spec.ts', specs: [specOf('grid.spec.ts', 'folds a row', 'unexpected')] }],
    }] }
    expect(E2eLog.outcomesOf(report as never)).to.deep.eq([
      { spec: 'grid.spec.ts › loads',             outcome: 'passed' },
      { spec: 'grid.spec.ts › Folding › folds a row', outcome: 'failed' },
    ])
  })

  it("reads the doc block's example", () => {
    const report = { suites: [{ title: 'grid.spec.ts', file: 'grid.spec.ts', specs: [specOf('grid.spec.ts', 'folds', 'unexpected')] }] }
    expect(E2eLog.outcomesOf(report as never)).to.deep.eq([{ spec: 'grid.spec.ts › folds', outcome: 'failed' }])
  })

  const OutcomeCases: [string, string, E2eLog.Outcome, string][] = [
    ['expected',   'passed',  'passed',  'a spec that passed as expected'],
    ['unexpected', 'passed',  'failed',  'a spec that failed'],
    ['flaky',      'passed',  'flaky',   'a spec that passed on a retry'],
    ['skipped',    'skipped', 'skipped', 'a spec skipped on purpose'],
    ['skipped',    'passed',  'unrun',   'a spec that never ran, its setup having failed'],
  ]
  for (const [status, expectedStatus, outcome, blurb] of OutcomeCases) {
    it(blurb, () => {
      const report = { suites: [{ title: 'a.spec.ts', file: 'a.spec.ts', specs: [specOf('a.spec.ts', 'works', status, expectedStatus)] }] }
      expect(E2eLog.outcomesOf(report as never)[0]?.outcome).to.eq(outcome)
    })
  }

  it("finds nothing in a report of no suites", () => {
    expect(E2eLog.outcomesOf({ suites: [] })).to.deep.eq([])
  })
})

describe('E2eLog.countsOf and failuresOf', () => {
  const outcomes: E2eLog.SpecOutcome[] = [
    { spec: 'a', outcome: 'passed' }, { spec: 'b', outcome: 'failed' }, { spec: 'c', outcome: 'unrun' }, { spec: 'd', outcome: 'skipped' },
  ]
  it("counts each outcome", () => {
    expect(E2eLog.countsOf(outcomes)).to.deep.eq({ passed: 1, failed: 1, flaky: 0, skipped: 1, unrun: 1 })
  })
  it("counts a spec that never ran among the failures, and a skipped one not", () => {
    expect(E2eLog.failuresOf(outcomes)).to.deep.eq(['b', 'c'])
  })
})

/** The tally a full run of branch `b`, on top `t`, starts */
const full = (status: number, outcomes: E2eLog.SpecOutcome[], patchid = 'p1') => (
  E2eLog.tallied(undefined, { kind: 'full', branch: 'b', top: 't', patchid, status, outcomes }).tally
)

describe('E2eLog.tallied', () => {
  const failedOne = full(1, [{ spec: 'a', outcome: 'failed' }, { spec: 'b', outcome: 'passed' }])

  it("reads the doc block's example", () => {
    expect(E2eLog.tallied(undefined, { kind: 'full', branch: 'b', top: 't', patchid: 'p', status: 1, outcomes: [{ spec: 'a', outcome: 'failed' }] }).tally?.outstanding).to.deep.eq(['a'])
  })

  it("starts afresh at a full run, proving a green one", () => {
    const tally = full(0, [{ spec: 'a', outcome: 'passed' }])
    expect(tally).to.deep.eq({ branch: 'b', top: 't', patchid: 'p1', complete: true, outstanding: [], cleared: [] })
    expect(E2eLog.isProved(tally)).to.be.true
  })

  it("calls a full run that exits red naming no failure broken, and proves nothing by it", () => {
    expect(full(1, [])?.complete).to.be.false
    expect(full(1, [{ spec: 'a', outcome: 'passed' }])?.complete).to.be.false
    expect(E2eLog.isProved(full(1, []))).to.be.false
  })

  it("clears a spec passed alone with the code unchanged as a flake", () => {
    const { tally, cleared } = E2eLog.tallied(failedOne, { kind: 'rerun', branch: 'b', top: 't2', patchid: 'p1', status: 0, outcomes: [{ spec: 'a', outcome: 'passed' }] })
    expect(cleared).to.deep.eq([{ spec: 'a', how: 'flake' }])
    expect(tally?.top).to.eq('t')
    expect(E2eLog.isProved(tally)).to.be.true
    expect(E2eLog.flakesOf(tally)).to.deep.eq(['a'])
  })

  it("clears a spec passed after a change as repaired, which is no flake", () => {
    const { tally, cleared } = E2eLog.tallied(failedOne, { kind: 'chosen', branch: 'b', top: 't', patchid: 'p2', status: 0, outcomes: [{ spec: 'a', outcome: 'passed' }] })
    expect(cleared).to.deep.eq([{ spec: 'a', how: 'repaired' }])
    expect(E2eLog.flakesOf(tally)).to.deep.eq([])
  })

  it("keeps a spec that fails again, and adds one newly failed", () => {
    const { tally } = E2eLog.tallied(failedOne, { kind: 'chosen', branch: 'b', top: 't', patchid: 'p1', status: 1, outcomes: [{ spec: 'a', outcome: 'failed' }, { spec: 'c', outcome: 'unrun' }] })
    expect(tally?.outstanding).to.deep.eq(['a', 'c'])
  })

  it("changes nothing without a finished full run of the same branch to build on", () => {
    const rerun = { kind: 'rerun', branch: 'b', top: 't', patchid: 'p1', status: 0, outcomes: [{ spec: 'a', outcome: 'passed' }] } as const
    expect(E2eLog.tallied(undefined, rerun)).to.deep.eq({ tally: undefined, cleared: [] })
    expect(E2eLog.tallied(failedOne, { ...rerun, branch: 'other' }).tally).to.eq(failedOne)
    const broken = full(1, [])
    expect(E2eLog.tallied(broken, rerun).tally).to.eq(broken)
  })
})

describe('E2eLog.loadBandOf', () => {
  const BandCases: [number, string, string][] = [
    [0,     'under 8',   'an idle machine'],
    [7.9,   'under 8',   'just under the old threshold'],
    [8,     '8 to 16',   'the old threshold itself'],
    [16,    '16 to 32',  'a load the size of the cores'],
    [50,    '32 and up', 'two suites at once, as sprint little_fixes saw'],
  ]
  for (const [load, band, blurb] of BandCases) {
    it(blurb, () => {
      expect(E2eLog.loadBandOf(load)).to.eq(band)
    })
  }
})

/** A line of the log: a green full run on a quiet machine, but for `overrides` */
const entryOf = (overrides: Partial<E2eLog.Entry>): E2eLog.Entry => ({
  at: '2026-10-06T10:00:00.000Z', branch: 'b', lane: 1, kind: 'full', args: [], committed: true,
  load: { before: 4, after: 5 }, cores: 16, cache: 'warm', seconds: 120, status: 0,
  counts: { passed: 2, failed: 0, flaky: 0, skipped: 0, unrun: 0 }, failures: [], cleared: [], still: [], proved: true,
  ...overrides,
})

describe('E2eLog.summarise', () => {

  it("says so when the log is empty", () => {
    expect(E2eLog.summarise([])).to.deep.eq(['The e2e log is empty: `pnpm e2e` writes a line for every run.'])
  })

  it("splits full runs by load and by build cache, and counts the flakes", () => {
    const said = E2eLog.summarise([
      entryOf({}),
      entryOf({ at: '2026-10-07T10:00:00.000Z', load: { before: 20, after: 24 }, cache: 'cold', seconds: 600, status: 1, failures: ['a'], proved: false }),
      entryOf({ at: '2026-10-07T10:10:00.000Z', kind: 'rerun', cleared: [{ spec: 'a', how: 'flake' }] }),
    ])
    expect(said[0]).to.eq('3 runs logged, 2026-10-06 to 2026-10-07: 2 full, 1 reruns or chosen specs.')
    expect(said).to.include('  under 8       1 runs     0 red (  0%)  mean 2.0 min')
    expect(said).to.include('  16 to 32      1 runs     1 red (100%)  mean 10.0 min')
    expect(said).to.include('  cold          1 runs     1 red (100%)  mean 10.0 min')
    expect(said).to.include('Specs failed in full runs: 1. Passed alone since, code unchanged (flakes): 1; after a change: 0.')
    expect(said.at(-1)).to.eq('    1  a')
  })
})

describe('E2eLog.append and read', () => {
  let scratch: string
  beforeEach(() => {
    scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'triquet-e2e-log-'))
  })
  afterEach(() => {
    fs.rmSync(scratch, { recursive: true, force: true })
  })

  it("keeps a line per run beside the worktrees, skipping a line that does not parse", () => {
    const logfile = E2eLog.logfileOf(path.join(scratch, 'worktrees'))
    expect(E2eLog.read(logfile)).to.deep.eq([])
    const entry = { branch: 'b', kind: 'full' } as E2eLog.Entry
    E2eLog.append(logfile, entry)
    fs.appendFileSync(logfile, 'half a line\n')
    E2eLog.append(logfile, entry)
    expect(E2eLog.read(logfile)).to.deep.eq([entry, entry])
    expect(logfile).to.eq(path.join(scratch, 'worktrees', '.e2e-log.jsonl'))
  })
})
