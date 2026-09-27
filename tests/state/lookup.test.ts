import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Db } from 'jazz-tools'
import type { PolicyTestApp } from 'jazz-tools/testing'
import { app } from '../../src/db/schema'
import { Ident } from '../../src/models/ident'
import { ServerLookupMillis, askServer, lookUp } from '../../src/state/lookup'
import { freshDb, openTestApp } from '../support/jazz'

/** `db`, but a read that asks the server does `remote` instead; everything else works */
function withServer(db: Db, remote: () => Promise<unknown>): Db {
  return new Proxy(db, {
    get(target, key) {
      const member: unknown = Reflect.get(target, key)
      if (key !== 'all' || typeof member !== 'function') { return typeof member === 'function' ? member.bind(target) as unknown : member }
      return async (...args: unknown[]) => {
        const [, options] = args as [unknown, { tier?: string } | undefined]
        if (options?.tier === 'remote-if-possible') { return await remote() }
        return await (member as (...rest: unknown[]) => Promise<unknown>).apply(target, args)
      }
    },
  })
}

describe('lookUp', () => {
  let testApp: PolicyTestApp
  beforeAll(async () => { testApp = await openTestApp() })
  afterAll(async () => { await testApp.shutdown() })

  it('finds what this browser holds without asking the server', async () => {
    const db = freshDb(testApp)
    await db.insert(app.idents, Ident.fill('local_only', '')).wait({ tier: 'edge' })
    const asked = { count: 0 }
    const counting = withServer(db, () => { asked.count += 1; return Promise.resolve([]) })
    const found = await lookUp(counting, app.idents.where({ label: 'local_only' }))
    expect([found.map((row) => row.label), asked.count]).to.deep.eq([['local_only'], 0])
  })

  it('asks the server when this browser holds nothing, and takes its answer', async () => {
    const db = freshDb(testApp)
    const remote = [{ id: 'elsewhere', label: 'from_the_server', title: 'From The Server' }]
    const found = await lookUp(withServer(db, () => Promise.resolve(remote)), app.idents.where({ label: 'from_the_server' }))
    expect(found).to.deep.eq(remote)
  })

  it('finds nothing, rather than failing, when the server cannot be reached', async () => {
    const db = freshDb(testApp)
    const found = await lookUp(withServer(db, () => Promise.reject(new Error('[object Event]'))), app.idents.where({ label: 'nowhere_at_all' }))
    expect(found).to.deep.eq([])
  })
})

describe('askServer, when the server never answers', () => {
  let testApp: PolicyTestApp
  beforeAll(async () => { testApp = await openTestApp() })
  afterAll(async () => { await testApp.shutdown() })

  it('stops waiting, and says it heard nothing', { timeout: ServerLookupMillis + 5000 }, async () => {
    const db = freshDb(testApp)
    // A server that will not serve this app leaves a read that asks it hanging for good.
    const silent = withServer(db, () => new Promise(() => { /* never answered */ }))
    expect(await askServer(silent, app.idents)).to.eq(null)
  })
})
