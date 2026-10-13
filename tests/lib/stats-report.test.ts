import { describe, expect, it } from 'vitest'
import * as BuildStamp from '../../src/lib/build-stamp'
import type { BackfillStatusT } from '../../src/lib/rows'
import * as StatsReport from '../../src/lib/stats-report'

const Stamp = BuildStamp.gather({}, () => null, new Date('2026-10-06T12:00:00Z'), 'v24.1.0')

const Env = { TRIQUET_ENV: { seen: 'dev' }, HOME: { standin: 'not shown' as const } }

const Browser = { react: '19.2.0', convex: '1.28.0', backend: 'http://127.0.0.1:3402', connected: true, connections: 2 }

const Backfill: BackfillStatusT = { fnname: 'migrations:backfillHuntStamps', defined: true, state: 'success', is_done: true, processed: 3, started_at: 1000, ended_at: 2000 }

describe("StatsReport.buildReport", () => {
  it("is the build's stamp, the version of Next it ran on and its environment, and nothing a browser would add", () => {
    expect(StatsReport.buildReport(Stamp, '16.0.1', Env)).to.deep.eq({ build: Stamp, next: '16.0.1', env: Env })
  })
})

describe("StatsReport.pageReport", () => {
  it("adds what this browser runs and the backfills to the build's report", () => {
    const report = StatsReport.pageReport(StatsReport.buildReport(Stamp, '16.0.1', Env), Browser, [Backfill])
    expect(report).to.deep.eq({ build: Stamp, next: '16.0.1', env: Env, browser: Browser, backfills: [Backfill] })
  })

  it("says null for the backfills until the deployment has answered, so the JSON never drops the key", () => {
    const report = StatsReport.pageReport(StatsReport.buildReport(Stamp, '16.0.1', Env), Browser, undefined)
    expect(report.backfills).to.be.null
    expect(structuredClone(report)).to.have.property('backfills', null)
  })

  it("says null, too, for a browser the deployment will not tell", () => {
    expect(StatsReport.pageReport(StatsReport.buildReport(Stamp, '16.0.1', Env), Browser, null).backfills).to.be.null
  })

  it("holds the build's report whole, so /stats.json is a prefix of what the page copies", () => {
    const build = StatsReport.buildReport(Stamp, '16.0.1', Env)
    expect(StatsReport.pageReport(build, Browser, [])).to.include(build)
  })
})
