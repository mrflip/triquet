import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { PolicyTestApp } from 'jazz-tools/testing'
import { app } from '../../src/db/schema'
import { HomeRealmLabel } from '../../src/models/realm'
import { assumeIdent, newHunt, performAccount } from '../../src/state/account-actions'
import { LocalFirst, huntFrom, huntRowFor, loadDirectory, loadHeldRows } from '../../src/state/quiz-rows'
import { BlankQuestionQty } from '../../src/models/quiz'
import { mintId } from '../../src/lib/ids'
import { present } from '../support/present'
import { freshAccount, openTestApp, sessionFor } from '../support/jazz'

/** A label no other test uses */
function freshLabel(stem: string): string {
  return `${stem}_${mintId().replaceAll('-', '').slice(-8)}`
}

describe('assumeIdent', () => {
  let testApp: PolicyTestApp
  beforeAll(async () => { testApp = await openTestApp() })
  afterAll(async () => { await testApp.shutdown() })

  it('makes an ident nobody goes by yet, titled as asked, and records this account taking it on', async () => {
    const { db } = freshAccount(testApp)
    const label = freshLabel('flip')
    const ident_id = await assumeIdent(db, label, 'Flip')
    const [ident] = await db.all(app.idents.where({ id: ident_id }), LocalFirst)
    const identings = await db.all(app.identings, LocalFirst)
    expect([ident?.label, ident?.title, identings.map((row) => row.ident_id)]).to.deep.eq([label, 'Flip', [ident_id]])
  })

  it('titles a new ident after its label when no title is given', async () => {
    const { db } = freshAccount(testApp)
    const ident_id = await assumeIdent(db, freshLabel('quiet_otter'), '  ')
    const [ident] = await db.all(app.idents.where({ id: ident_id }), LocalFirst)
    expect(present(ident).title).to.match(/^Quiet Otter /)
  })

  it('becomes the ident someone else already made, rather than making a second', async () => {
    const label = freshLabel('shared')
    const first = await assumeIdent(freshAccount(testApp).db, label, 'First')
    const { db } = freshAccount(testApp)
    const again = await assumeIdent(db, label, 'Second')
    const idents = await db.all(app.idents.where({ label }), LocalFirst)
    expect([again, idents.map((row) => row.title)]).to.deep.eq([first, ['First']])
  })

  it('refuses a label too short to be an ident\'s, writing nothing', async () => {
    const { db } = freshAccount(testApp)
    await expect(assumeIdent(db, 'flip', 'Flip')).rejects.toThrow()
    expect(await db.all(app.identings, LocalFirst)).to.deep.eq([])
  })

  it('keeps each account\'s identings to itself', async () => {
    const alice = freshAccount(testApp)
    await assumeIdent(alice.db, freshLabel('alice'), '')
    const bob = testApp.as(sessionFor('bob, elsewhere', freshAccount(testApp).account))
    expect(await bob.all(app.identings, LocalFirst)).to.deep.eq([])
  })
})

describe('newHunt', () => {
  let testApp: PolicyTestApp
  beforeAll(async () => { testApp = await openTestApp() })
  afterAll(async () => { await testApp.shutdown() })

  it('makes a hunt with one realm, home, holding one blank quiz under the hunt\'s own label and title', async () => {
    const { db } = freshAccount(testApp)
    const label = freshLabel('loud_heron')
    const hunt_id = present(await newHunt(db, await loadDirectory(db), label))
    const hunt = present(huntFrom(await loadHeldRows(db, hunt_id), hunt_id))
    const [realm] = hunt.realms
    const [quiz] = present(realm).quizzes
    expect([hunt.label, present(realm).label, present(quiz).label, present(quiz).title, present(quiz).questions.length])
      .to.deep.eq([label, HomeRealmLabel, label, hunt.title, BlankQuestionQty])
  })

  it('refuses a label some hunt already answers to', async () => {
    const { db } = freshAccount(testApp)
    const label = freshLabel('taken')
    await newHunt(db, await loadDirectory(db), label)
    expect(await newHunt(db, await loadDirectory(db), label)).to.eq(null)
  })

  it('is what performAccount does for new_hunt', async () => {
    const { db } = freshAccount(testApp)
    const label = freshLabel('performed')
    await performAccount(db, await loadDirectory(db), { kind: 'new_hunt', label })
    expect(huntRowFor(await loadDirectory(db), label)).to.not.eq(undefined)
  })

  it('is seen by every other account, for the trial', async () => {
    const label = freshLabel('open_door')
    const mine = freshAccount(testApp).db
    await newHunt(mine, await loadDirectory(mine), label)
    await mine.all(app.hunts, { tier: 'edge' })
    const theirs = freshAccount(testApp).db
    expect(huntRowFor(await loadDirectory(theirs), label)).to.not.eq(undefined)
  })
})
