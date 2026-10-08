import { afterEach, describe, expect, it, vi } from 'vitest'
import { api } from '../../convex/_generated/api'
import { askerOf, emptyIfDenied } from '../../convex/functions'
import * as Actor from '../../src/lib/actor'
import * as Approve from '../../src/lib/approve'
import { refuse } from '../../src/lib/refusals'
import { identified, openTester, signedIn } from '../support/convex'

describe("askerOf", () => {
  afterEach(() => { vi.unstubAllEnvs() })

  it("is nobody, with no session, for a request that carries no token", async () => {
    const tt = openTester()
    expect(await tt.run(async (ctx) => await askerOf(ctx))).to.deep.eq({ actor: Actor.anonymous, user_id: null })
  })

  it("is the session's user, anonymous, for a session that has asserted no username", async () => {
    const tt = openTester()
    const session = await signedIn(tt)
    expect(await session.as.run(async (ctx) => await askerOf(ctx))).to.deep.eq({ actor: Actor.anonymous, user_id: session.user_id })
  })

  it("is the ident the session asserted, once it has", async () => {
    const tt = openTester()
    const flip = await identified(tt, 'flip_kromer')
    expect(await flip.as.run(async (ctx) => await askerOf(ctx))).to.deep.eq({ actor: flip.actor, user_id: flip.user_id })
  })

  it("is an admin only where the deployment's TRIQUET_ADMINS names its username, and the browser is told so", async () => {
    const tt = openTester()
    const [flip, ada] = [await identified(tt, 'mrflip'), await identified(tt, 'ada_lovelace')]
    vi.stubEnv('TRIQUET_ADMINS', 'mrflip')
    const askers = await Promise.all([flip, ada].map(async (each) => await each.as.run(async (ctx) => await askerOf(ctx))))
    expect(askers.map(({ actor }) => Actor.isAnonymous(actor) ? null : actor.admin)).to.deep.eq([true, false])
    expect(await flip.as.query(api.idents.current, {})).to.deep.include({ actor: { ...flip.actor, admin: true } })
    vi.stubEnv('TRIQUET_ADMINS', '')
    expect(await flip.as.query(api.idents.current, {})).to.deep.include({ actor: { ...flip.actor, admin: false } })
  })

  it("is the session's user, anonymous, once the ident it asserted is held by another session", async () => {
    const tt = openTester()
    const [flip, bob] = [await identified(tt, 'flip_kromer'), await signedIn(tt)]
    await tt.run(async (ctx) => { await ctx.db.patch('idents', flip.ident_id, { user_id: bob.user_id }) })
    expect(await flip.as.run(async (ctx) => await askerOf(ctx))).to.deep.eq({ actor: Actor.anonymous, user_id: flip.user_id })
  })

  it("is nobody, with no session, for a token whose session Convex Auth no longer holds", async () => {
    const tt = openTester()
    const flip = await identified(tt, 'flip_kromer')
    await tt.run(async (ctx) => {
      const sessions = await ctx.db.query('authSessions').collect()
      for (const held of sessions) { await ctx.db.delete('authSessions', held._id) }
    })
    expect(await flip.as.run(async (ctx) => await askerOf(ctx))).to.deep.eq({ actor: Actor.anonymous, user_id: null })
  })
})

/** A read that finds `found` */
async function finding(found: string): Promise<string> {
  await Promise.resolve()
  return found
}

/** A read that is turned away with `denial` */
async function deniedWith(denial: Approve.Denialkind): Promise<string> {
  await Promise.resolve()
  throw new Approve.NotApprovedError(denial)
}

describe("emptyIfDenied", () => {
  it("hands back what the read returns", async () => {
    expect(await emptyIfDenied(null, async () => await finding('the frame'))).to.eq('the frame')
  })

  it("answers a denial with the empty value it is given, whichever denial it is", async () => {
    const seen = [await emptyIfDenied([], async () => await deniedWith('notIdentified')), await emptyIfDenied([], async () => await deniedWith('notPermitted'))]
    expect(seen).to.deep.eq([[], []])
  })

  it("throws on anything that is not a denial: a refusal, or a failure", async () => {
    await expect(emptyIfDenied(null, async () => {
      await finding('the frame')
      refuse('quizGone')
    })).rejects.toThrow(/quizGone/)
    await expect(emptyIfDenied(null, async () => {
      await finding('the frame')
      throw new Error('the database fell over')
    })).rejects.toThrow('the database fell over')
  })
})
