import nextPackage from 'next/package.json'
import { describe, expect, it } from 'vitest'
import { dynamic, GET } from '../../../src/app/stats.json/route'

describe("GET /stats.json", () => {
  it("says what the build says of itself, with the version of Next it ran on, as JSON", async () => {
    const answer = await GET().json() as { build: { built_at: string, node_version: string }, next: string }
    expect(answer.next).to.eq(nextPackage.version)
    expect(answer.build.node_version).to.eq(process.version)
    expect(new Date(answer.build.built_at).toISOString()).to.eq(answer.build.built_at)
  })

  it("answers with a JSON content type", () => {
    expect(GET().headers.get('content-type')).to.contain('application/json')
  })

  it("is made as the app is built and served as a file, so it adds no server function", () => {
    expect(dynamic).to.eq('force-static')
  })

  it("leaves out what only a browser could say", async () => {
    expect(Object.keys(await GET().json() as object)).to.have.members(['build', 'next'])
  })
})
