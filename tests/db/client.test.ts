import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import * as Z from 'zod'
import { DefaultDatabaseUrl, databaseUrlFrom, openDb } from '../../src/db/client'
import { players } from '../../src/db/schema'
import { SeedPlayers } from '../../src/models/player'

describe('openDb', () => {
  it('opens a migrated database holding the seeded players', async () => {
    const db = await openDb(':memory:')
    const held = await db.select().from(players)
    expect(held).to.deep.eq([...SeedPlayers])
  })

  it('writes the players back to match this build, whatever the database held', async () => {
    const scratch = await mkdtemp(path.join(tmpdir(), 'triquet-'))
    const url = `file:${path.join(scratch, 'test.db')}`
    const first = await openDb(url)
    await first.update(players).set({ title: 'Somebody else' })
    const reopened = await openDb(url)
    expect(await reopened.select().from(players)).to.deep.eq([...SeedPlayers])
  })

  const Refused: [string, string][] = [
    ['libsql://triquet.turso.io',  'a remote database, which needs credentials this build does not take'],
    ['data/triquet.db',            'a bare path with no scheme'],
    ['',                           'nothing at all'],
  ]
  for (const [url, describes] of Refused) {
    it(`refuses ${describes}`, async () => {
      await expect(openDb(url)).rejects.toThrow(Z.ZodError)
    })
  }
})

describe('databaseUrlFrom', () => {
  const Cases: [string | undefined, string, string][] = [
    [undefined,            DefaultDatabaseUrl,    'unset: the default local file'],
    ['',                   DefaultDatabaseUrl,    'blank: the same as unset'],
    [' '.repeat(3),        DefaultDatabaseUrl,    'whitespace: the same as unset'],
    ['file:data/agent.db', 'file:data/agent.db',  'set: taken as given'],
  ]
  for (const [raw, expected, describes] of Cases) {
    it(describes, () => {
      expect(databaseUrlFrom(raw)).to.eq(expected)
    })
  }
})
