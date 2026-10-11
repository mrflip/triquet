import { describe, expect, it } from 'vitest'
import { internal } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'
import { membersOf } from '../../convex/reading'
import type { AdoptionDNA } from '../../src/models/adoption'
import { Hunt } from '../../src/models/hunt'
import { anonymousSession, anonymousUser, googleUser, openTester, seedHunt, type Session, type Tester } from '../support/convex'
import { present } from '../support/present'
import { expectSound, heldIn } from '../support/soundness'

/** The Coach's email, as Google sends it */
const CoachEmail = 'flip@example.com'

/**
 * Production as the clear leaves it: hunts at their addresses and nobody on them. `~mrflip/quiet_otter`
 * is an old hunt of the Coach's, its smiths cleared, so `mrflip` is held by an address alone; and
 * `~pat_smith/loud_heron` is someone else's, with its smith on it.
 */
async function clearedProduction(): Promise<{ tt: Tester, quiet_otter: Id<'hunts'>, loud_heron: Id<'hunts'> }> {
  const tt = openTester()
  const old = await seedHunt(tt, Hunt.blank('quiet_otter'), { smith: 'old_smith' })
  const quiet_otter = old.open.hunt_id
  await tt.run(async (ctx) => {
    await ctx.db.patch('hunts', quiet_otter, { orglabel: 'mrflip' })
    const huntships = await ctx.db.query('huntships').collect()
    for (const huntship of huntships) { await ctx.db.delete('huntships', huntship._id) }
  })
  const pats = await seedHunt(tt, Hunt.blank('loud_heron'), { smith: 'pat_smith' })
  return { tt, quiet_otter, loud_heron: pats.open.hunt_id }
}

/** A browser signed in with Google, as the Coach's will be, holding no userlabel: its account seeded, never signed in to */
async function googleUnlabelled(tt: Tester, email = CoachEmail): Promise<Session> {
  const session = await anonymousSession(tt)
  await tt.run(async (ctx) => {
    await ctx.db.patch('users', session.user_id, { isAnonymous: false, email, emailVerificationTime: Date.now() })
    await ctx.db.insert('authAccounts', { userId: session.user_id, provider: 'google', providerAccountId: `google-sub-${session.user_id}` })
  })
  return session
}

/** What adopting as `request` would change, written nowhere */
async function planned(tt: Tester, request: AdoptionDNA) {
  return await tt.query(internal.adopt.plan, request)
}

/** Adopt as `request`, and what it changed */
async function adopted(tt: Tester, request: AdoptionDNA) {
  return await tt.mutation(internal.adopt.perform, request)
}

/** What adopting as `request` changed */
async function changed(tt: Tester, request: AdoptionDNA) {
  const { changes } = await adopted(tt, request)
  return changes
}

/** The user `user_id`'s row, which must be there */
async function userRow(tt: Tester, user_id: Id<'users'>) {
  return present(await tt.run(async (ctx) => await ctx.db.get('users', user_id)), 'the user')
}

/** Who is on the hunt `hunt_id`, as label and role, in the order they were put on it */
async function membersIn(tt: Tester, hunt_id: Id<'hunts'>): Promise<[string, string][]> {
  const members = await tt.run(async (ctx) => await membersOf(ctx.db, hunt_id))
  return members.map((member) => [member.label, member.role])
}

/** The Coach's command: `--email <the Coach's> --userlabel mrflip --admin --smith-all` */
const CoachAdoption: AdoptionDNA = { find: { email: CoachEmail }, userlabel: 'mrflip', admin: true, grants: [{ role: 'smith', hunts: 'every' }] }

describe('adopt:perform, the Coach taking back mrflip', () => {
  it("gives the user an email finds mrflip, which only a hunt's address held, admin, and smith of every hunt", async () => {
    const { tt, quiet_otter, loud_heron } = await clearedProduction()
    const coach = await googleUnlabelled(tt)
    expect(await adopted(tt, CoachAdoption)).to.deep.eq({
      user:    { user_id: coach.user_id, userlabel: null, title: null, anonymous: false, admin: false },
      changes: [
        { kind: 'userlabel', from: null, to: 'mrflip', title: 'Mrflip', huntships: 0 },
        { kind: 'admin', to: true },
        { kind: 'huntship', org: 'mrflip', hunt: 'quiet_otter', role: 'smith', from: null },
        { kind: 'huntship', org: 'pat_smith', hunt: 'loud_heron', role: 'smith', from: null },
      ],
      kept: 0,
    })
    const user = await userRow(tt, coach.user_id)
    expect([user.userlabel, user.title, user.admin, user.isAnonymous]).to.deep.eq(['mrflip', 'Mrflip', true, false])
    expect(await membersIn(tt, quiet_otter)).to.deep.eq([['mrflip', 'smith']])
    expect(await membersIn(tt, loud_heron)).to.deep.eq([['pat_smith', 'smith'], ['mrflip', 'smith']])
    await expectSound(tt)
  })

  it('changes nothing run again, counting all it asked for as kept', async () => {
    const { tt } = await clearedProduction()
    const coach = await googleUnlabelled(tt)
    await adopted(tt, CoachAdoption)
    const ante = await heldIn(tt)
    expect(await adopted(tt, CoachAdoption)).to.deep.eq({
      user:    { user_id: coach.user_id, userlabel: 'mrflip', title: 'Mrflip', anonymous: false, admin: true },
      changes: [],
      kept:    4,
    })
    expect(await heldIn(tt)).to.deep.eq(ante)
  })

  it('reads the doc block\'s example: an admin flag for the user holding a userlabel', async () => {
    const tt = openTester()
    const flippy = await googleUser(tt, 'flippy_kromer')
    expect(await changed(tt, { find: { userlabel: 'flippy_kromer' }, admin: true })).to.deep.eq([{ kind: 'admin', to: true }])
    const { admin } = await userRow(tt, flippy.user_id)
    expect(admin).to.be.true
  })
})

describe('adopt:plan', () => {
  it('says what perform would change, and writes nothing', async () => {
    const { tt } = await clearedProduction()
    await googleUnlabelled(tt)
    const ante = await heldIn(tt)
    const plan = await planned(tt, CoachAdoption)
    expect(await heldIn(tt)).to.deep.eq(ante)
    expect(await adopted(tt, CoachAdoption)).to.deep.eq(plan)
  })

  it('counts the huntships whose copies a relabel would rewrite', async () => {
    const tt = openTester()
    await seedHunt(tt, Hunt.blank('quiet_otter'), { smith: 'flippy_kromer' })
    const plan = await planned(tt, { find: { userlabel: 'flippy_kromer' }, userlabel: 'mrflip' })
    expect(plan.changes).to.deep.eq([{ kind: 'userlabel', from: 'flippy_kromer', to: 'mrflip', title: 'Flippy Kromer', huntships: 1 }])
  })
})

describe('adopt:perform, finding the user', () => {
  it('finds a user by its id, by its userlabel, or by its email', async () => {
    const tt = openTester()
    const flippy = await googleUser(tt, 'flippy_kromer')
    const finds = [{ user_id: flippy.user_id }, { userlabel: 'flippy_kromer' }, { email: 'flippy_kromer@example.com' }]
    for (const find of finds) {
      const { user } = await planned(tt, { find })
      expect(user.user_id).to.eq(flippy.user_id)
    }
  })

  it('refuses an id, userlabel or email that finds nobody', async () => {
    const tt = openTester()
    const gone = await anonymousSession(tt)
    await tt.run(async (ctx) => { await ctx.db.delete('users', gone.user_id) })
    await expect(planned(tt, { find: { user_id: gone.user_id } })).rejects.toThrow(/No user has the id/)
    await expect(planned(tt, { find: { userlabel: 'nobody_here' } })).rejects.toThrow(/No user holds the userlabel nobody_here/)
    await expect(planned(tt, { find: { email: 'nobody@example.com' } })).rejects.toThrow(/No user has the email nobody@example\.com/)
  })

  it('refuses an email more than one user has, naming each, rather than guess; nothing is written', async () => {
    const tt = openTester()
    const one = await googleUnlabelled(tt)
    const two = await googleUnlabelled(tt)
    const ante = await heldIn(tt)
    const pending = adopted(tt, { find: { email: CoachEmail }, admin: true })
    await expect(pending).rejects.toThrow(new RegExp(String.raw`More than one user has the email flip@example\.com.*${one.user_id} \(no userlabel\), ${two.user_id} \(no userlabel\)`))
    expect(await heldIn(tt)).to.deep.eq(ante)
  })

  it('refuses what is not an email, at the door', async () => {
    const tt = openTester()
    await expect(planned(tt, { find: { email: 'flip at example' } })).rejects.toThrow()
  })
})

describe('adopt:perform, the userlabel', () => {
  it('refuses a userlabel another user holds, writing nothing', async () => {
    const tt = openTester()
    await googleUser(tt, 'mrflip_taken')
    const coach = await googleUnlabelled(tt)
    await expect(adopted(tt, { find: { user_id: coach.user_id }, userlabel: 'mrflip_taken', admin: true })).rejects.toThrow(/Another user holds the userlabel mrflip_taken/)
    const user = await userRow(tt, coach.user_id)
    expect([user.userlabel, user.admin]).to.deep.eq([undefined, undefined])
  })

  it('refuses a userlabel a ghosting holds', async () => {
    const tt = openTester()
    const coach = await googleUnlabelled(tt)
    const ghost = await googleUser(tt, 'ghost_host')
    await tt.run(async (ctx) => {
      const account = present(await ctx.db.query('authAccounts').first())
      await ctx.db.insert('ghostings', { userlabel: 'retired_one', user_id: ghost.user_id, into_user_id: coach.user_id, account_id: account._id })
    })
    await expect(adopted(tt, { find: { user_id: coach.user_id }, userlabel: 'retired_one' })).rejects.toThrow(/retired by a merge/)
  })

  it('refuses a userlabel that is not one, or a reserved word, at the door', async () => {
    const tt = openTester()
    const coach = await googleUnlabelled(tt)
    await expect(adopted(tt, { find: { user_id: coach.user_id }, userlabel: 'Mr Flip' })).rejects.toThrow()
    await expect(adopted(tt, { find: { user_id: coach.user_id }, userlabel: 'support' })).rejects.toThrow()
    const { userlabel } = await userRow(tt, coach.user_id)
    expect(userlabel).to.be.undefined
  })

  it("relabels a user holding one, rewriting its huntships' copies, and moves no address", async () => {
    const tt = openTester()
    const { open, smith } = await seedHunt(tt, Hunt.blank('quiet_otter'), { smith: 'flippy_kromer' })
    const outcome = await adopted(tt, { find: { user_id: smith.user_id }, userlabel: 'mrflip', title: 'Flip' })
    expect(outcome.changes).to.deep.eq([{ kind: 'userlabel', from: 'flippy_kromer', to: 'mrflip', title: 'Flip', huntships: 1 }])
    expect(await membersIn(tt, open.hunt_id)).to.deep.eq([['mrflip', 'smith']])
    expect(present(await tt.run(async (ctx) => await ctx.db.get('hunts', open.hunt_id))).orglabel).to.eq('flippy_kromer')
    await expectSound(tt)
  })

  it('retitles a user alone, keeping its userlabel', async () => {
    const tt = openTester()
    const flippy = await googleUser(tt, 'flippy_kromer')
    expect(await changed(tt, { find: { user_id: flippy.user_id }, title: 'Flip' })).to.deep.eq([{ kind: 'userlabel', from: 'flippy_kromer', to: 'flippy_kromer', title: 'Flip', huntships: 0 }])
  })

  it('retitles a user whose userlabel a word reserved since would refuse, plan and perform agreeing, its userlabel kept', async () => {
    const tt = openTester()
    const { open, smith } = await seedHunt(tt, Hunt.blank('quiet_otter'), { smith: 'handy_smith' })
    await tt.run(async (ctx) => {
      await ctx.db.patch('users', smith.user_id, { userlabel: 'handles' })
      const huntships = await ctx.db.query('huntships').collect()
      for (const huntship of huntships) { await ctx.db.patch('huntships', huntship._id, { userlabel: 'handles' }) }
    })
    const request: AdoptionDNA = { find: { userlabel: 'handles' }, title: 'Handy' }
    const plan = await planned(tt, request)
    expect(plan.changes).to.deep.eq([{ kind: 'userlabel', from: 'handles', to: 'handles', title: 'Handy', huntships: 1 }])
    expect(await adopted(tt, request)).to.deep.eq(plan)
    const { userlabel, title } = await userRow(tt, smith.user_id)
    expect([userlabel, title]).to.deep.eq(['handles', 'Handy'])
    expect(await membersIn(tt, open.hunt_id)).to.deep.eq([['handles', 'smith']])
    await expectSound(tt)
  })

  it('gives an anonymous user a userlabel, as nothing but admin and grants needs Google', async () => {
    const tt = openTester()
    const { user_id } = await anonymousSession(tt)
    await adopted(tt, { find: { user_id }, userlabel: 'mrflip' })
    const { userlabel } = await userRow(tt, user_id)
    expect(userlabel).to.eq('mrflip')
  })

  it('refuses a title for a user holding no userlabel, given none', async () => {
    const tt = openTester()
    const coach = await googleUnlabelled(tt)
    await expect(adopted(tt, { find: { user_id: coach.user_id }, title: 'Flip' })).rejects.toThrow(/holds no userlabel to title/)
  })
})

describe('adopt:perform, the admin flag', () => {
  it('clears the flag, leaving it absent', async () => {
    const tt = openTester()
    const flippy = await googleUser(tt, 'flippy_kromer')
    await adopted(tt, { find: { user_id: flippy.user_id }, admin: true })
    expect(await changed(tt, { find: { user_id: flippy.user_id }, admin: false })).to.deep.eq([{ kind: 'admin', to: false }])
    const { admin } = await userRow(tt, flippy.user_id)
    expect(admin).to.be.undefined
  })

  it('makes no anonymous user an admin, writing nothing', async () => {
    const tt = openTester()
    const anon = await anonymousUser(tt, 'anon_alice')
    await expect(adopted(tt, { find: { user_id: anon.user_id }, userlabel: 'mrflip', admin: true })).rejects.toThrow(/is anonymous: only a user signed in with Google is made an admin/)
    const user = await userRow(tt, anon.user_id)
    expect([user.userlabel, user.admin]).to.deep.eq(['anon_alice', undefined])
  })

  it("clears an anonymous user's flag all the same", async () => {
    const tt = openTester()
    const anon = await anonymousUser(tt, 'anon_alice')
    await tt.run(async (ctx) => { await ctx.db.patch('users', anon.user_id, { admin: true }) })
    expect(await changed(tt, { find: { user_id: anon.user_id }, admin: false })).to.deep.eq([{ kind: 'admin', to: false }])
  })
})

describe('adopt:perform, roles on hunts', () => {
  it('never lowers a role: a smith asked to review everywhere keeps smithing where it smiths', async () => {
    const { tt, loud_heron, quiet_otter } = await clearedProduction()
    const pat = await googleUser(tt, 'pat_smith')
    const outcome = await adopted(tt, { find: { userlabel: 'pat_smith' }, grants: [{ role: 'reviewer', hunts: 'every' }] })
    expect([outcome.changes, outcome.kept]).to.deep.eq([[{ kind: 'huntship', org: 'mrflip', hunt: 'quiet_otter', role: 'reviewer', from: null }], 1])
    expect(await membersIn(tt, loud_heron)).to.deep.eq([['pat_smith', 'smith']])
    expect(await membersIn(tt, quiet_otter)).to.deep.eq([['pat_smith', 'reviewer']])
    expect(pat.user_id).to.eq(outcome.user.user_id)
  })

  it('gives the highest role asked of a hunt, whatever the order asked, and raises a reviewer', async () => {
    const { tt, quiet_otter, loud_heron } = await clearedProduction()
    const bob = await googleUser(tt, 'bob_reviews')
    await adopted(tt, { find: { user_id: bob.user_id }, grants: [{ role: 'reviewer', hunts: 'every' }] })
    const outcome = await adopted(tt, { find: { user_id: bob.user_id }, grants: [{ role: 'smith', hunts: { org: 'mrflip', hunt: 'quiet_otter' } }, { role: 'reviewer', hunts: 'every' }] })
    expect([outcome.changes, outcome.kept]).to.deep.eq([[{ kind: 'huntship', org: 'mrflip', hunt: 'quiet_otter', role: 'smith', from: 'reviewer' }], 1])
    expect(await membersIn(tt, quiet_otter)).to.deep.eq([['bob_reviews', 'smith']])
    expect(await membersIn(tt, loud_heron)).to.deep.eq([['pat_smith', 'smith'], ['bob_reviews', 'reviewer']])
  })

  it('refuses an anonymous user any role, writing nothing', async () => {
    const { tt, quiet_otter } = await clearedProduction()
    const anon = await anonymousUser(tt, 'anon_alice')
    await expect(adopted(tt, { find: { user_id: anon.user_id }, grants: [{ role: 'smith', hunts: 'every' }] })).rejects.toThrow(/is anonymous: only a user signed in with Google is put on a hunt/)
    expect(await membersIn(tt, quiet_otter)).to.deep.eq([])
  })

  it('refuses a role to a user holding no userlabel, given none', async () => {
    const { tt } = await clearedProduction()
    const coach = await googleUnlabelled(tt)
    await expect(adopted(tt, { find: { user_id: coach.user_id }, grants: [{ role: 'smith', hunts: 'every' }] })).rejects.toThrow(/holds no userlabel, so it cannot be put on a hunt/)
  })

  it('refuses a hunt that is not at the address named, writing nothing', async () => {
    const { tt } = await clearedProduction()
    const coach = await googleUnlabelled(tt)
    const ante = await heldIn(tt)
    await expect(adopted(tt, { find: { user_id: coach.user_id }, userlabel: 'mrflip', grants: [{ role: 'smith', hunts: { org: 'mrflip', hunt: 'loud_heron' } }] })).rejects.toThrow(/There is no hunt at ~mrflip\/loud_heron/)
    expect(await heldIn(tt)).to.deep.eq(ante)
  })
})
