import { describe, expect, it } from 'vitest'
import { api } from '../../convex/_generated/api'
import { huntForLabel, identForLabel, realmsOf } from '../../convex/reading'
import { Hunt } from '../../src/models/hunt'
import { HomeRealmLabel } from '../../src/models/realm'
import { BlankQuestionQty } from '../../src/models/quiz'
import { mintId } from '../../src/lib/ids'
import * as PA from '../../src/lib/vv/patterns'
import { present } from '../support/present'
import { identified, openTester, refusedAs, seedHunt, wholeHunt, type Tester } from '../support/convex'

/** Take on the ident labelled `label` as the browser `browser_key`, through the public function */
async function assume(tt: Tester, browser_key: string, label: string, title = '') {
  return await tt.mutation(api.idents.performAccount, { action: { kind: 'assume_ident', label, title }, browser_key })
}

/** Retitle the ident the browser `browser_key` is now, through the public function */
async function retitle(tt: Tester, browser_key: string, title: string) {
  return await tt.mutation(api.idents.performAccount, { action: { kind: 'retitle_ident', title }, browser_key })
}

/** Make a hunt labelled `label` through the public function, as the browser `browser_key`, or as a fresh ident's browser */
async function makeHunt(tt: Tester, label: string, browser_key?: string) {
  const maker = browser_key === undefined ? await identified(tt, `maker_${mintId().slice(-8)}`) : { browser_key }
  return await tt.mutation(api.idents.performAccount, { action: { kind: 'new_hunt', label }, browser_key: maker.browser_key })
}

/** Every row of a table, for the tests that count them */
async function allOf<TN extends 'idents' | 'identings' | 'hunts' | 'huntings'>(tt: Tester, tablename: TN) {
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
    expect(await tt.query(api.idents.current, { browser_key: mintId() })).to.be.null
  })

  it('finds an ident this browser never made, since the server holds every one', async () => {
    const tt = openTester()
    await assume(tt, mintId(), 'flip_kromer', 'Flip on a laptop')
    const phone = mintId()
    await assume(tt, phone, 'flip_kromer', 'Flip on a phone')
    expect(await tt.query(api.idents.current, { browser_key: phone })).to.deep.include({ title: 'Flip on a laptop' })
  })
})

describe('idents.performAccount: retitle_ident', () => {
  it('retitles the ident this browser is, keeping its label', async () => {
    const tt = openTester()
    const browser_key = mintId()
    const ident_id = await assume(tt, browser_key, 'quiet_otter')
    expect(await retitle(tt, browser_key, 'Otto')).to.eq(ident_id)
    const idents = await allOf(tt, 'idents')
    expect(idents.map((row) => [row.label, row.title])).to.deep.eq([['quiet_otter', 'Otto']])
  })

  it('is seen by every browser that is that ident', async () => {
    const tt = openTester()
    const [mine, theirs] = [mintId(), mintId()]
    await assume(tt, mine, 'quiet_otter')
    await assume(tt, theirs, 'quiet_otter')
    await retitle(tt, theirs, 'Otto')
    const ident = await tt.query(api.idents.current, { browser_key: mine })
    expect(ident?.title).to.eq('Otto')
  })

  it('refuses a browser that has not said who it is, writing nothing', async () => {
    const tt = openTester()
    const pending = retitle(tt, mintId(), 'Otto')
    expect(await refusedAs(pending)).to.eq('notIdentified')
    expect(await allOf(tt, 'idents')).to.deep.eq([])
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

  it('puts the ident the browser is now on the hunt it made, as its smith', async () => {
    const tt = openTester()
    const alice = await identified(tt, 'alice_smiths')
    const hunt_id = await makeHunt(tt, 'loud_heron', alice.browser_key)
    const huntings = await allOf(tt, 'huntings')
    expect(huntings.map((row) => [row.hunt_id, row.ident_id, row.role])).to.deep.eq([[hunt_id, alice.ident_id, 'smith']])
  })

  it('refuses a browser that has not said who it is, writing nothing', async () => {
    const tt = openTester()
    const pending = makeHunt(tt, 'loud_heron', mintId())
    expect(await refusedAs(pending)).to.eq('notIdentified')
    expect([await allOf(tt, 'hunts'), await allOf(tt, 'huntings')]).to.deep.eq([[], []])
  })

  it('refuses a label some hunt already answers to', async () => {
    const tt = openTester()
    await makeHunt(tt, 'taken_label')
    expect(await refusedAs(makeHunt(tt, 'taken_label'))).to.eq('labelTaken')
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
    expect(await refusedAs(makeHunt(tt, 'one_too_many'))).to.eq('huntsFull')
  })

  it('writes the whole hunt in one go: a realm for it, and its quiz in the realm', async () => {
    const tt = openTester()
    await makeHunt(tt, 'loud_heron')
    const realms = await tt.run(async (ctx) => await realmsOf(ctx.db, present(await huntForLabel(ctx.db, 'loud_heron'))._id))
    expect(realms.map(({ realm, quizzes }) => [realm.label, quizzes.length])).to.deep.eq([[HomeRealmLabel, 1]])
  })
})

/** What a smith does to a hunt from the hunts list, less the hunt it names */
type HuntEdit = { kind: 'retitle_hunt', title: string } | { kind: 'relabel_hunt', label: string }

/** A hunt with its smith and a reviewer on it, as the hunts list would find it, and how to edit it from there */
async function smithed() {
  const tt = openTester()
  const { open: { hunt_id }, smith, join } = await seedHunt(tt, Hunt.blank('quiet_otter'), { smith: 'alice_smiths' })
  const bob = await join('bob_reviews', 'reviewer')
  const perform = async (edit: HuntEdit, browser_key = smith.browser_key) => await tt.mutation(api.idents.performAccount, { action: { ...edit, hunt_id }, browser_key })
  const held = async () => present(await tt.run(async (ctx) => await ctx.db.get('hunts', hunt_id)))
  return { tt, hunt_id, bob, perform, held }
}

describe('idents.performAccount: retitle_hunt and relabel_hunt', () => {
  it("lets the hunt's smith retitle it and relabel it, with no quiz open", async () => {
    const { hunt_id, perform, held } = await smithed()
    expect(await perform({ kind: 'retitle_hunt', title: 'The Autumn Hunt' })).to.eq(hunt_id)
    expect(await perform({ kind: 'relabel_hunt', label: 'autumn_hunt' })).to.eq(hunt_id)
    const hunt = await held()
    expect([hunt.title, hunt.forced_label]).to.deep.eq(['The Autumn Hunt', 'autumn_hunt'])
  })

  it('refuses a reviewer on the hunt, and a stranger, writing nothing', async () => {
    const { tt, bob, perform, held } = await smithed()
    const carol = await identified(tt, 'carol_strays')
    const ante = await held()
    const refusals = [
      await refusedAs(perform({ kind: 'retitle_hunt', title: 'Mine now' }, bob.browser_key)),
      await refusedAs(perform({ kind: 'relabel_hunt', label: 'mine_now' }, carol.browser_key)),
    ]
    expect(refusals).to.deep.eq(['notPermitted', 'notPermitted'])
    expect(await held()).to.deep.eq(ante)
  })

  it('refuses a browser that has not said who it is', async () => {
    const { perform } = await smithed()
    const pending = perform({ kind: 'retitle_hunt', title: 'Mine now' }, mintId())
    expect(await refusedAs(pending)).to.eq('notIdentified')
  })

  it('refuses a label another hunt answers to, writing nothing', async () => {
    const { tt, perform, held } = await smithed()
    await makeHunt(tt, 'taken_label')
    expect(await refusedAs(perform({ kind: 'relabel_hunt', label: 'taken_label' }))).to.eq('labelTaken')
    const hunt = await held()
    expect(hunt.forced_label).to.be.null
  })
})
