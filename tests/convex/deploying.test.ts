import { describe, expect, it } from 'vitest'
import { internal } from '../../convex/_generated/api'
import { openTester } from '../support/convex'

const Sha1 = '84de1bb0c2a1f5e6d7b8a9c0d1e2f3a4b5c6d7e8'
const Sha2 = '9e8d7c6b5a4f3e2d1c0b9a8f7e6d5c4b3a2f1e0d'

describe("deploying.recordPushed", () => {
  it("records a step as pushed and not yet backfilled", async () => {
    const tt = openTester()
    await tt.mutation(internal.deploying.recordPushed, { sha: Sha1, subject: 'model: hunts remember their branch' })
    const newest = await tt.query(internal.deploying.newest, {})
    expect(newest).to.include({ sha: Sha1, subject: 'model: hunts remember their branch', backfilled_at: null })
    expect(newest?.pushed_at).to.be.a('number')
  })

  it("leaves a step recorded already as it stands", async () => {
    const tt = openTester()
    await tt.mutation(internal.deploying.recordPushed, { sha: Sha1, subject: 'first' })
    const first = await tt.query(internal.deploying.newest, {})
    await tt.mutation(internal.deploying.recordPushed, { sha: Sha1, subject: 'again' })
    expect(await tt.query(internal.deploying.recent, {})).to.deep.eq([first])
  })

  it("refuses a sha that is not forty hex digits", async () => {
    const tt = openTester()
    await expect(tt.mutation(internal.deploying.recordPushed, { sha: '84de1bb', subject: 'short' })).rejects.toThrow(/forty/)
  })
})

describe("deploying.recordBackfilled", () => {
  it("marks a pushed step backfilled", async () => {
    const tt = openTester()
    await tt.mutation(internal.deploying.recordPushed, { sha: Sha1, subject: 'first' })
    await tt.mutation(internal.deploying.recordBackfilled, { sha: Sha1, subject: 'first' })
    const newest = await tt.query(internal.deploying.newest, {})
    expect(newest?.backfilled_at).to.be.a('number')
  })

  it("records a step nobody recorded as pushed, pushed and backfilled at once", async () => {
    const tt = openTester()
    await tt.mutation(internal.deploying.recordBackfilled, { sha: Sha1, subject: 'first' })
    const newest = await tt.query(internal.deploying.newest, {})
    expect(newest?.pushed_at).to.eq(newest?.backfilled_at)
  })

  it("leaves a step backfilled already as it stands", async () => {
    const tt = openTester()
    await tt.mutation(internal.deploying.recordBackfilled, { sha: Sha1, subject: 'first' })
    const first = await tt.query(internal.deploying.newest, {})
    await tt.mutation(internal.deploying.recordBackfilled, { sha: Sha1, subject: 'first' })
    expect(await tt.query(internal.deploying.newest, {})).to.deep.eq(first)
  })
})

describe("deploying.newest and recent", () => {
  it("answer null and nothing on a backend that has recorded no step", async () => {
    const tt = openTester()
    expect(await tt.query(internal.deploying.newest, {})).to.be.null
    expect(await tt.query(internal.deploying.recent, {})).to.deep.eq([])
  })

  it("give the step recorded last as the newest, and the rest newest first", async () => {
    const tt = openTester()
    await tt.mutation(internal.deploying.recordPushed, { sha: Sha1, subject: 'first' })
    await tt.mutation(internal.deploying.recordPushed, { sha: Sha2, subject: 'second' })
    const newest = await tt.query(internal.deploying.newest, {})
    const one = await tt.query(internal.deploying.recent, { limit: 1 })
    const all = await tt.query(internal.deploying.recent, {})
    expect(newest?.sha).to.eq(Sha2)
    expect(one.map((step) => step.sha)).to.deep.eq([Sha2])
    expect(all.map((step) => step.sha)).to.deep.eq([Sha2, Sha1])
  })
})
