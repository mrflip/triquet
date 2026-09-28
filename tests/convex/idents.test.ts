import { describe, expect, it } from 'vitest'
import { api } from '../../convex/_generated/api'
import { huntForLabel, identForLabel, realmsOf } from '../../convex/reading'
import { HomeRealmLabel } from '../../src/models/realm'
import { BlankQuestionQty } from '../../src/models/quiz'
import { mintId } from '../../src/lib/ids'
import * as PA from '../../src/lib/vv/patterns'
import { present } from '../support/present'
import { openTester, wholeHunt, type Tester } from '../support/convex'

/** Take on the ident labelled `label` as the browser `browser_key`, through the public function */
async function assume(tt: Tester, browser_key: string, label: string, title = '') {
  return await tt.mutation(api.idents.performAccount, { action: { kind: 'assume_ident', label, title }, browser_key })
}

/** Make a hunt labelled `label`, through the public function */
async function makeHunt(tt: Tester, label: string) {
  return await tt.mutation(api.idents.performAccount, { action: { kind: 'new_hunt', label }, browser_key: mintId() })
}

/** Every row of a table, for the tests that count them */
async function allOf<TN extends 'idents' | 'identings' | 'hunts'>(tt: Tester, tablename: TN) {
  return await tt.run(async (ctx) => await ctx.db.query(tablename).collect())
}

describe('idents.performAccount: assume_ident', () => {
  it('makes an ident nobody goes by yet, titled as asked, and records this browser taking it on', async () => {
    const tt = openTester()
    const browser_key = mintId()
    const ident_id = await assume(tt, browser_key, 'flip_kromer', 'Flip')
    const ident = present(await tt.run(async (ctx) => await identForLabel(ctx.db, 'flip_kromer')))
    const identings = await allOf(tt, 'identings')
    expect([ident._id, ident.title]).to.deep.eq([ident_id, 'Flip'])
    expect(identings.map((row) => [row.browser_key, row.ident_id])).to.deep.eq([[browser_key, ident_id]])
  })

  it('titles a new ident after its label when no title is given', async () => {
    const tt = openTester()
    await assume(tt, mintId(), 'quiet_otter', '  ')
    const ident = present(await tt.run(async (ctx) => await identForLabel(ctx.db, 'quiet_otter')))
    expect(ident.title).to.eq('Quiet Otter')
  })

  it('becomes the ident someone else already made, rather than making a second', async () => {
    const tt = openTester()
    const first = await assume(tt, mintId(), 'shared_ident', 'First')
    const again = await assume(tt, mintId(), 'shared_ident', 'Second')
    const idents = await allOf(tt, 'idents')
    expect([again, idents.map((row) => row.title)]).to.deep.eq([first, ['First']])
  })

  it('refuses a label too short to be an ident\'s, writing nothing', async () => {
    const tt = openTester()
    await expect(assume(tt, mintId(), 'flip', 'Flip')).rejects.toThrow(/should have «6» or more/)
    expect(await allOf(tt, 'identings')).to.deep.eq([])
  })

  it('refuses a browser key that is not one', async () => {
    const tt = openTester()
    await expect(assume(tt, 'my_laptop', 'flip_kromer')).rejects.toThrow(/uuid|UUID/)
    expect(await allOf(tt, 'identings')).to.deep.eq([])
  })
})

describe('idents.current', () => {
  it('is the ident the browser took on last', async () => {
    const tt = openTester()
    const browser_key = mintId()
    await assume(tt, browser_key, 'flip_kromer', 'Flip')
    await assume(tt, browser_key, 'quiet_otter', 'Otter')
    expect(await tt.query(api.idents.current, { browser_key })).to.deep.include({ label: 'quiet_otter', title: 'Otter' })
  })

  it('is null for a browser that has never said who it is', async () => {
    const tt = openTester()
    await assume(tt, mintId(), 'flip_kromer')
    expect(await tt.query(api.idents.current, { browser_key: mintId() })).to.eq(null)
  })

  it('finds an ident this browser never made, since the server holds every one', async () => {
    const tt = openTester()
    await assume(tt, mintId(), 'flip_kromer', 'Flip on a laptop')
    const phone = mintId()
    await assume(tt, phone, 'flip_kromer', 'Flip on a phone')
    expect(await tt.query(api.idents.current, { browser_key: phone })).to.deep.include({ title: 'Flip on a laptop' })
  })
})

describe('idents.performAccount: new_hunt', () => {
  it('makes a hunt with one realm, home, holding one blank quiz under the hunt\'s own label and title', async () => {
    const tt = openTester()
    const hunt_id = present(await makeHunt(tt, 'loud_heron'))
    const hunt = await wholeHunt(tt, present(await tt.run(async (ctx) => await huntForLabel(ctx.db, 'loud_heron')))._id)
    const [realm] = hunt.realms
    const [quiz] = present(realm).quizzes
    expect(hunt._id).to.eq(hunt_id)
    expect([hunt.label, present(realm).label, present(quiz).label, present(quiz).title, present(quiz).questions.length])
      .to.deep.eq(['loud_heron', HomeRealmLabel, 'loud_heron', hunt.title, BlankQuestionQty])
  })

  it('refuses a label some hunt already answers to', async () => {
    const tt = openTester()
    await makeHunt(tt, 'taken_label')
    expect(await makeHunt(tt, 'taken_label')).to.eq(null)
    expect(await allOf(tt, 'hunts')).to.have.lengthOf(1)
  })

  it('refuses one hunt more than the app may hold', async () => {
    const tt = openTester()
    await tt.run(async (ctx) => {
      const labels = Array.from({ length: PA.HuntsInApp.max }, (_unused, idx) => `hunt_${String(idx)}`)
      for (const label of labels) {
        await ctx.db.insert('hunts', { label, forced_label: null, title: '' })
      }
    })
    expect(await makeHunt(tt, 'one_too_many')).to.eq(null)
  })

  it('writes the whole hunt in one go: a realm for it, and its quiz in the realm', async () => {
    const tt = openTester()
    await makeHunt(tt, 'loud_heron')
    const realms = await tt.run(async (ctx) => await realmsOf(ctx.db, present(await huntForLabel(ctx.db, 'loud_heron'))._id))
    expect(realms.map(({ realm, quizzes }) => [realm.label, quizzes.length])).to.deep.eq([[HomeRealmLabel, 1]])
  })
})
