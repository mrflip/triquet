import { describe, expect, it } from 'vitest'
import { membersOf } from '../../../convex/reading'
import { failurekindOf, noticeOf } from '../../../src/lib/refusals'
import { identUnknownNotice } from '../../../src/lib/notices'
import * as PA from '../../../src/lib/vv/patterns'
import { Hunt } from '../../../src/models/hunt'
import { Quiz } from '../../../src/models/quiz'
import { expectRefusal, huntHolding, identified, openTester, seedHunt, signedIn, type Seeded } from '../../support/convex'
import { expectSound } from '../../support/soundness'

/**
 * A fresh hunt with alice on it as its smith, and how to act as her: what every case begins
 * from, as a hunt made through `new_hunt` would.
 */
async function smithed(locked = false) {
  const seeded = await seedHunt(openTester(), locked ? huntHolding([{ ...Quiz.blank('Quiz one'), locked }]) : Hunt.blank(), { smith: 'alice_smiths' })
  const alice = seeded.smith
  const asAlice = async (action: Parameters<Seeded['act']>[0]) => { await seeded.act(action, alice) }
  return { ...seeded, alice, asAlice }
}

/** What `pending` rejected with; fails the test when it went through */
async function rejectionOf(pending: Promise<unknown>): Promise<unknown> {
  try {
    await pending
  } catch (err) {
    return err
  }
  throw new Error('expected a refusal, and the call went through')
}

/** Who is on the seeded hunt, as label and role, in the order they were put on it */
async function membersIn({ tt, open }: Pick<Seeded, 'tt' | 'open'>): Promise<[string, string][]> {
  const members = await tt.run(async (ctx) => await membersOf(ctx.db, open.hunt_id))
  return members.map((member) => [member.label, member.role])
}

describe('hunts.perform: add_hunting', () => {
  it('puts the ident a label names on the hunt, in the role given', async () => {
    const seeded = await smithed()
    await identified(seeded.tt, 'bob_reviews')
    await seeded.asAlice({ kind: 'add_hunting', ident_label: 'bob_reviews', role: 'reviewer' })
    expect(await membersIn(seeded)).to.deep.eq([['alice_smiths', 'smith'], ['bob_reviews', 'reviewer']])
    await expectSound(seeded.tt)
  })

  it('replaces the role of an ident already on the hunt, rather than putting them on twice', async () => {
    const seeded = await smithed()
    await identified(seeded.tt, 'bob_reviews')
    await seeded.asAlice({ kind: 'add_hunting', ident_label: 'bob_reviews', role: 'reviewer' })
    await seeded.asAlice({ kind: 'add_hunting', ident_label: 'bob_reviews', role: 'smith' })
    await seeded.asAlice({ kind: 'add_hunting', ident_label: 'bob_reviews', role: 'smith' })
    expect(await membersIn(seeded)).to.deep.eq([['alice_smiths', 'smith'], ['bob_reviews', 'smith']])
  })

  it('refuses a label no ident answers to, naming it and saying what they must do', async () => {
    const seeded = await smithed()
    const err = await rejectionOf(seeded.asAlice({ kind: 'add_hunting', ident_label: 'nobody_yet', role: 'reviewer' }))
    expect([failurekindOf(err), noticeOf(err)]).to.deep.eq(['identUnknown', identUnknownNotice('nobody_yet')])
    expect(await membersIn(seeded)).to.deep.eq([['alice_smiths', 'smith']])
  })

  it('refuses a label that is not an ident\'s at the door', async () => {
    const seeded = await smithed()
    await expect(seeded.asAlice({ kind: 'add_hunting', ident_label: 'bob', role: 'reviewer' })).rejects.toThrow(/should have «6» or more/)
  })

  it('refuses a change to one\'s own role: another smith makes it', async () => {
    const seeded = await smithed()
    await expectRefusal(seeded.asAlice({ kind: 'add_hunting', ident_label: 'alice_smiths', role: 'reviewer' }), 'ownHunting')
    expect(await membersIn(seeded)).to.deep.eq([['alice_smiths', 'smith']])
  })

  it('refuses one\'s own place even when asked for the role one has: nobody touches their own hunting', async () => {
    const seeded = await smithed()
    await expectRefusal(seeded.asAlice({ kind: 'add_hunting', ident_label: 'alice_smiths', role: 'smith' }), 'ownHunting')
    expect(await membersIn(seeded)).to.deep.eq([['alice_smiths', 'smith']])
  })

  it('refuses a session that has asserted no username', async () => {
    const seeded = await smithed()
    await identified(seeded.tt, 'bob_reviews')
    await expectRefusal(seeded.act({ kind: 'add_hunting', ident_label: 'bob_reviews', role: 'reviewer' }, await signedIn(seeded.tt)), 'notIdentified')
  })

  it('works while the open quiz is locked: who is on the hunt is not the quiz\'s', async () => {
    const seeded = await smithed(true)
    await identified(seeded.tt, 'bob_reviews')
    await seeded.asAlice({ kind: 'add_hunting', ident_label: 'bob_reviews', role: 'reviewer' })
    expect(await membersIn(seeded)).to.have.lengthOf(2)
  })

  it('refuses a member more than a hunt may hold', async () => {
    const seeded = await smithed()
    await seeded.tt.run(async (ctx) => {
      const labels = Array.from({ length: PA.HuntingsPerHunt.max - 1 }, (_unused, idx) => `member_${String(idx)}`)
      for (const label of labels) {
        const ident_id = await ctx.db.insert('idents', { label, title: 'Member' })
        await ctx.db.insert('huntings', { hunt_id: seeded.open.hunt_id, ident_id, role: 'reviewer' })
      }
    })
    await identified(seeded.tt, 'one_member_more')
    await expectRefusal(seeded.asAlice({ kind: 'add_hunting', ident_label: 'one_member_more', role: 'reviewer' }), 'huntingsFull')
    expect(await membersIn(seeded)).to.have.lengthOf(PA.HuntingsPerHunt.max)
  })
})

describe('hunts.perform: remove_hunting', () => {
  it('takes an ident off the hunt', async () => {
    const seeded = await smithed()
    const bob = await identified(seeded.tt, 'bob_reviews')
    await seeded.asAlice({ kind: 'add_hunting', ident_label: 'bob_reviews', role: 'reviewer' })
    await seeded.asAlice({ kind: 'remove_hunting', ident_id: bob.ident_id })
    expect(await membersIn(seeded)).to.deep.eq([['alice_smiths', 'smith']])
  })

  it('refuses to take the one acting off', async () => {
    const seeded = await smithed()
    await expectRefusal(seeded.asAlice({ kind: 'remove_hunting', ident_id: seeded.alice.ident_id }), 'ownHunting')
    expect(await membersIn(seeded)).to.deep.eq([['alice_smiths', 'smith']])
  })

  it('leaves an ident not on the hunt as it is', async () => {
    const seeded = await smithed()
    const bob = await identified(seeded.tt, 'bob_reviews')
    await seeded.asAlice({ kind: 'remove_hunting', ident_id: bob.ident_id })
    expect(await membersIn(seeded)).to.deep.eq([['alice_smiths', 'smith']])
  })

  it('refuses a session that has asserted no username', async () => {
    const seeded = await smithed()
    await expectRefusal(seeded.act({ kind: 'remove_hunting', ident_id: seeded.alice.ident_id }, await signedIn(seeded.tt)), 'notIdentified')
  })
})
