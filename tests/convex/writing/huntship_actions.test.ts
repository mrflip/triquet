import { describe, expect, it } from 'vitest'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { membersOf } from '../../../convex/reading'
import { triggers } from '../../../convex/triggers'
import { grantHuntship, smithOfSandbox } from '../../../convex/writing/huntship_actions'
import { failurekindOf, noticeOf } from '../../../src/lib/refusals'
import { RefusalNotices, userUnknownNotice } from '../../../src/lib/notices'
import * as PA from '../../../src/lib/vv/patterns'
import { Hunt } from '../../../src/models/hunt'
import { Quiz } from '../../../src/models/quiz'
import type { HuntRole } from '../../../src/models/huntship'
import { User } from '../../../src/models/user'
import { anonymousSession, anonymousUser, expectRefusal, googleUser, huntHolding, openTester, seedHunt, type Seeded } from '../../support/convex'
import { present } from '../../support/present'
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

describe('hunts.perform: add_huntship', () => {
  it('puts the user a userlabel names on the hunt, in the role given, its huntship copying its userlabel and title', async () => {
    const seeded = await smithed()
    await googleUser(seeded.tt, 'bob_reviews')
    await seeded.asAlice({ kind: 'add_huntship', userlabel: 'bob_reviews', role: 'reviewer' })
    expect(await membersIn(seeded)).to.deep.eq([['alice_smiths', 'smith'], ['bob_reviews', 'reviewer']])
    await expectSound(seeded.tt)
  })

  it('replaces the role of a user already on the hunt, rather than putting them on twice', async () => {
    const seeded = await smithed()
    await googleUser(seeded.tt, 'bob_reviews')
    await seeded.asAlice({ kind: 'add_huntship', userlabel: 'bob_reviews', role: 'reviewer' })
    await seeded.asAlice({ kind: 'add_huntship', userlabel: 'bob_reviews', role: 'smith' })
    await seeded.asAlice({ kind: 'add_huntship', userlabel: 'bob_reviews', role: 'smith' })
    expect(await membersIn(seeded)).to.deep.eq([['alice_smiths', 'smith'], ['bob_reviews', 'smith']])
  })

  it('refuses a userlabel nobody holds, naming it and saying what they must do', async () => {
    const seeded = await smithed()
    const err = await rejectionOf(seeded.asAlice({ kind: 'add_huntship', userlabel: 'nobody_yet', role: 'reviewer' }))
    expect([failurekindOf(err), noticeOf(err)]).to.deep.eq(['userUnknown', userUnknownNotice('nobody_yet')])
    expect(await membersIn(seeded)).to.deep.eq([['alice_smiths', 'smith']])
  })

  it('refuses a userlabel that is not one at the door', async () => {
    const seeded = await smithed()
    await expect(seeded.asAlice({ kind: 'add_huntship', userlabel: 'bob', role: 'reviewer' })).rejects.toThrow(/should have «6» or more/)
  })

  it('refuses a change to one\'s own role: another smith makes it', async () => {
    const seeded = await smithed()
    await expectRefusal(seeded.asAlice({ kind: 'add_huntship', userlabel: 'alice_smiths', role: 'reviewer' }), 'ownHuntship')
    expect(await membersIn(seeded)).to.deep.eq([['alice_smiths', 'smith']])
  })

  it('refuses one\'s own place even when asked for the role one has: nobody touches their own huntship', async () => {
    const seeded = await smithed()
    await expectRefusal(seeded.asAlice({ kind: 'add_huntship', userlabel: 'alice_smiths', role: 'smith' }), 'ownHuntship')
    expect(await membersIn(seeded)).to.deep.eq([['alice_smiths', 'smith']])
  })

  it('refuses a user holding no userlabel', async () => {
    const seeded = await smithed()
    await googleUser(seeded.tt, 'bob_reviews')
    await expectRefusal(seeded.act({ kind: 'add_huntship', userlabel: 'bob_reviews', role: 'reviewer' }, await anonymousSession(seeded.tt)), 'notIdentified')
  })

  it('works while the open quiz is locked: who is on the hunt is not the quiz\'s', async () => {
    const seeded = await smithed(true)
    await googleUser(seeded.tt, 'bob_reviews')
    await seeded.asAlice({ kind: 'add_huntship', userlabel: 'bob_reviews', role: 'reviewer' })
    expect(await membersIn(seeded)).to.have.lengthOf(2)
  })

  it('refuses an anonymous user, sealed in its sandbox, saying so, and puts nobody on', async () => {
    const seeded = await smithed()
    await anonymousUser(seeded.tt, 'anon_bob')
    await expectRefusal(seeded.asAlice({ kind: 'add_huntship', userlabel: 'anon_bob', role: 'reviewer' }), 'sealedJoin')
    expect(await membersIn(seeded)).to.deep.eq([['alice_smiths', 'smith']])
  })

  it('refuses a member more than a hunt may hold', async () => {
    const seeded = await smithed()
    await seeded.tt.run(async (ctx) => {
      const labels = Array.from({ length: PA.HuntshipsPerHunt.max - 1 }, (_unused, idx) => `member_${String(idx)}`)
      for (const label of labels) {
        const user_id = await ctx.db.insert('users', { userlabel: label, title: 'Member' })
        await ctx.db.insert('huntships', { hunt_id: seeded.open.hunt_id, user_id, userlabel: label, usertitle: 'Member', role: 'reviewer' })
      }
    })
    await googleUser(seeded.tt, 'one_member_more')
    await expectRefusal(seeded.asAlice({ kind: 'add_huntship', userlabel: 'one_member_more', role: 'reviewer' }), 'huntshipsFull')
    expect(await membersIn(seeded)).to.have.lengthOf(PA.HuntshipsPerHunt.max)
  })
})

describe('hunts.perform: remove_huntship', () => {
  it('takes a user off the hunt', async () => {
    const seeded = await smithed()
    const bob = await googleUser(seeded.tt, 'bob_reviews')
    await seeded.asAlice({ kind: 'add_huntship', userlabel: 'bob_reviews', role: 'reviewer' })
    await seeded.asAlice({ kind: 'remove_huntship', user_id: bob.user_id })
    expect(await membersIn(seeded)).to.deep.eq([['alice_smiths', 'smith']])
  })

  it('refuses to take the one acting off', async () => {
    const seeded = await smithed()
    await expectRefusal(seeded.asAlice({ kind: 'remove_huntship', user_id: seeded.alice.user_id }), 'ownHuntship')
    expect(await membersIn(seeded)).to.deep.eq([['alice_smiths', 'smith']])
  })

  it('leaves a user not on the hunt as it is', async () => {
    const seeded = await smithed()
    const bob = await googleUser(seeded.tt, 'bob_reviews')
    await seeded.asAlice({ kind: 'remove_huntship', user_id: bob.user_id })
    expect(await membersIn(seeded)).to.deep.eq([['alice_smiths', 'smith']])
  })

  it('refuses a user holding no userlabel', async () => {
    const seeded = await smithed()
    await expectRefusal(seeded.act({ kind: 'remove_huntship', user_id: seeded.alice.user_id }, await anonymousSession(seeded.tt)), 'notIdentified')
  })
})

/** An anonymous user's sandbox, its rows written as `new_hunt` writes them, and a user signed in with Google who might carry it on */
async function sandboxAndHeir() {
  const tt = openTester()
  const anon = await anonymousUser(tt, 'anon_alice')
  const heir = await googleUser(tt, 'alice_google')
  const sandbox_id = await anon.as.mutation(api.hunts.performOuter, { action: { kind: 'new_hunt', label: 'anon_alice' } })
  return { tt, anon, heir, sandbox_id }
}

describe('smithOfSandbox', () => {
  it("makes a user signed in with Google smith of an anonymous user's sandbox, past sealing, the sandbox keeping its address", async () => {
    const { tt, heir, sandbox_id } = await sandboxAndHeir()
    await tt.run(async (ctx) => {
      const [user, sandbox] = [present(await ctx.db.get('users', heir.user_id)), present(await ctx.db.get('hunts', sandbox_id))]
      await smithOfSandbox(triggers.wrapDB(ctx).db, user, sandbox)
    })
    const members = await tt.run(async (ctx) => await membersOf(ctx.db, sandbox_id))
    const hunt = present(await tt.run(async (ctx) => await ctx.db.get('hunts', sandbox_id)))
    expect(members.map((member) => [member.label, member.role])).to.deep.eq([['anon_alice', 'smith'], ['alice_google', 'smith']])
    expect([hunt.orglabel, hunt.label]).to.deep.eq(['anon_alice', 'anon_alice'])
    await expectSound(tt)
  })

  it('refuses an anonymous user, as sealing refuses one anywhere, writing nothing', async () => {
    const { tt, sandbox_id } = await sandboxAndHeir()
    const other = await anonymousUser(tt, 'anon_carol')
    await expect(tt.run(async (ctx) => {
      const [user, sandbox] = [present(await ctx.db.get('users', other.user_id)), present(await ctx.db.get('hunts', sandbox_id))]
      await smithOfSandbox(triggers.wrapDB(ctx).db, user, sandbox)
    })).rejects.toThrow(RefusalNotices.sealedJoin)
    expect(await tt.run(async (ctx) => await membersOf(ctx.db, sandbox_id))).to.have.lengthOf(1)
  })

  it('refuses a hunt that is no sandbox, as a mistake of its caller', async () => {
    const { tt, heir } = await sandboxAndHeir()
    const seeded = await seedHunt(tt, Hunt.blank('quiet_otter'))
    await expect(tt.run(async (ctx) => {
      const [user, hunt] = [present(await ctx.db.get('users', heir.user_id)), present(await ctx.db.get('hunts', seeded.open.hunt_id))]
      await smithOfSandbox(triggers.wrapDB(ctx).db, user, hunt)
    })).rejects.toThrow(/is no sandbox/)
  })
})

/** Give the user `user_id` the role `role` on the seeded hunt, as `adopt:perform` does, and what it answered */
async function granted({ tt, open }: Pick<Seeded, 'tt' | 'open'>, user_id: Id<'users'>, role: HuntRole) {
  return await tt.run(async (ctx) => {
    const user = present(await ctx.db.get('users', user_id))
    const face = present(User.faceOf(user))
    return await grantHuntship(triggers.wrapDB(ctx).db, open.hunt_id, face, role)
  })
}

describe('grantHuntship', () => {
  it('puts a user signed in with Google on the hunt in the role given, its huntship copying its userlabel and title', async () => {
    const seeded = await smithed()
    const bob = await googleUser(seeded.tt, 'bob_reviews')
    expect(await granted(seeded, bob.user_id, 'reviewer')).to.deep.eq({ written: true, from: null })
    expect(await membersIn(seeded)).to.deep.eq([['alice_smiths', 'smith'], ['bob_reviews', 'reviewer']])
    await expectSound(seeded.tt)
  })

  it('makes a reviewer a smith, in the huntship it has', async () => {
    const seeded = await smithed()
    const bob = await seeded.join('bob_reviews', 'reviewer')
    expect(await granted(seeded, bob.user_id, 'smith')).to.deep.eq({ written: true, from: 'reviewer' })
    expect(await membersIn(seeded)).to.deep.eq([['alice_smiths', 'smith'], ['bob_reviews', 'smith']])
  })

  it('never lowers a role: a smith asked to review keeps smithing, and nothing is written', async () => {
    const seeded = await smithed()
    const ante = await seeded.tt.run(async (ctx) => await ctx.db.query('huntships').collect())
    expect(await granted(seeded, seeded.alice.user_id, 'reviewer')).to.deep.eq({ written: false, from: 'smith' })
    expect(await seeded.tt.run(async (ctx) => await ctx.db.query('huntships').collect())).to.deep.eq(ante)
  })

  it('grants twice as once', async () => {
    const seeded = await smithed()
    const bob = await googleUser(seeded.tt, 'bob_reviews')
    await granted(seeded, bob.user_id, 'smith')
    expect(await granted(seeded, bob.user_id, 'smith')).to.deep.eq({ written: false, from: 'smith' })
    expect(await membersIn(seeded)).to.deep.eq([['alice_smiths', 'smith'], ['bob_reviews', 'smith']])
  })

  it('refuses an anonymous user, as sealing refuses one anywhere, writing nothing', async () => {
    const seeded = await smithed()
    const anon = await anonymousUser(seeded.tt, 'anon_carol')
    await expect(granted(seeded, anon.user_id, 'smith')).rejects.toThrow(RefusalNotices.sealedJoin)
    expect(await membersIn(seeded)).to.deep.eq([['alice_smiths', 'smith']])
  })
})
