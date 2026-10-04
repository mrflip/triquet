import { describe, expect, it } from 'vitest'
import { askerOf } from '../../convex/functions'
import * as Actor from '../../src/lib/actor'
import { identified, openTester, signedIn } from '../support/convex'

describe("askerOf", () => {
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
