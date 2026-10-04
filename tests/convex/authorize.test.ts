import { describe, expect, it } from 'vitest'
import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'
import { affirmAccountAction, affirmCountUsage, affirmPerform, affirmReadHunt, affirmReadReviews, claimsFor } from '../../convex/authorize'
import { identForLabel, reviewsOf } from '../../convex/reading'
import * as Actor from '../../src/lib/actor'
import * as Approve from '../../src/lib/approve'
import { ActionValidators, type HuntActionDNA } from '../../src/models/actions'
import type { HuntRole } from '../../src/models/hunting'
import { Hunt } from '../../src/models/hunt'
import { present } from '../support/present'
import { callerOf, expectRefusal, identified, openOf, openTester, refusedAs, seedHunt, signedIn, type Session, type Tester } from '../support/convex'

const modules = import.meta.glob('../../convex/**/*.ts')

/** Whether `val` is a function any caller on the internet may run */
function isPublicFunction(val: unknown): boolean {
  return typeof val === 'function' && 'isPublic' in val && val.isPublic === true
}

/** Every public function the deployment offers, as `module:name`, in order */
async function publicFunctions(): Promise<string[]> {
  const sources = Object.entries(modules).filter(([path]) => ! path.includes('/_generated/') && ! path.endsWith('/convex.config.ts'))
  const found = await Promise.all(sources.map(async ([path, load]) => {
    const exported = await load() as Record<string, unknown>
    const modulename = path.replace('../../convex/', '').replace(/\.ts$/, '')
    return Object.entries(exported).filter(([, val]) => isPublicFunction(val)).map(([fnname]) => `${modulename}:${fnname}`)
  }))
  return found.flat().toSorted((aa, bb) => aa.localeCompare(bb))
}

/** One hunt with a smith, a reviewer and a stranger (an ident on no hunt), and a second hunt the smith alone is on */
async function peopled() {
  const tt = openTester()
  const seeded = await seedHunt(tt, Hunt.blank('quiet_otter'), { smith: 'alice_smiths' })
  const other = await seedHunt(tt, Hunt.blank('loud_heron'), { smith: 'alice_smiths' })
  const bob = await seeded.join('bob_reviews', 'reviewer')
  const carol = await identified(tt, 'carol_strays')
  return { ...seeded, other, alice: seeded.smith, bob, carol }
}

describe("claimsFor and affirmReadHunt", () => {
  it("give a smith and a reviewer their role as their standing, and anyone else a stranger's, who may not read the hunt", async () => {
    const { tt, open, alice, bob, carol } = await peopled()
    const seen = await tt.run(async (ctx) => await Promise.all([alice.actor, bob.actor, carol.actor, Actor.anonymous].map(async (actor) => {
      const claims = await claimsFor(ctx.db, open.hunt_id, actor)
      return [claims.standing, await affirmReadHunt(ctx.db, open.hunt_id, actor)]
    })))
    expect(seen).to.deep.eq([
      ['smith',    true],
      ['reviewer', true],
      ['stranger', false],
      ['stranger', false],
    ])
  })
})

/** Which of the quiz's reviews each of `actors` may read, by their writers' labels */
async function readersOf(tt: Tester, quiz_id: Id<'quizzes'>, actors: Actor.ActorT[], labelFor: Record<string, string>): Promise<string[][]> {
  return await tt.run(async (ctx) => {
    const reviews = await reviewsOf(ctx.db, quiz_id)
    return await Promise.all(actors.map(async (actor) => {
      const readable = await affirmReadReviews(ctx.db, reviews, actor)
      return readable.map((review) => labelFor[review.ident_id] ?? '?')
    }))
  })
}

describe("affirmReadReviews", () => {
  it("let a reviewer read their own review whatever its phase; once shared, a smith, and another reviewer only while theirs is shared too", async () => {
    const { tt, open, act, join, alice, bob, carol } = await peopled()
    const dave = await join('dave_reviews', 'reviewer')
    const labelFor = { [bob.ident_id]: 'bob', [dave.ident_id]: 'dave' }
    const readers = [bob.actor, alice.actor, dave.actor, carol.actor, Actor.anonymous]
    await act({ kind: 'open_review', quiz_id: open.quiz_id }, bob)
    await act({ kind: 'open_review', quiz_id: open.quiz_id }, dave)
    expect(await readersOf(tt, open.quiz_id, readers, labelFor)).to.deep.eq([['bob'], [], ['dave'], [], []])
    await act({ kind: 'set_review_phase', quiz_id: open.quiz_id, phase: 'shared' }, bob)
    expect(await readersOf(tt, open.quiz_id, readers, labelFor)).to.deep.eq([['bob'], ['bob'], ['dave'], [], []])
    await act({ kind: 'set_review_phase', quiz_id: open.quiz_id, phase: 'shared' }, dave)
    expect(await readersOf(tt, open.quiz_id, readers, labelFor)).to.deep.eq([['bob', 'dave'], ['bob', 'dave'], ['bob', 'dave'], [], []])
    await act({ kind: 'set_review_phase', quiz_id: open.quiz_id, phase: 'draft' }, dave)
    expect(await readersOf(tt, open.quiz_id, readers, labelFor)).to.deep.eq([['bob'], ['bob'], ['dave'], [], []])
  })

  it("let a reviewer taken off the hunt read nothing of it, not even their own review", async () => {
    const { tt, open, act, bob } = await peopled()
    await act({ kind: 'open_review', quiz_id: open.quiz_id }, bob)
    await act({ kind: 'set_review_phase', quiz_id: open.quiz_id, phase: 'shared' }, bob)
    await act({ kind: 'remove_hunting', ident_id: bob.ident_id })
    expect(await readersOf(tt, open.quiz_id, [bob.actor], { [bob.ident_id]: 'bob' })).to.deep.eq([[]])
  })

  it("read nothing of a quiz with no reviews", async () => {
    const { tt, alice } = await peopled()
    expect(await tt.run(async (ctx) => await affirmReadReviews(ctx.db, [], alice.actor))).to.deep.eq([])
  })
})

describe("affirmCountUsage", () => {
  it("lets a smith of any hunt count how far a widget is put to work, and nobody else", async () => {
    const { tt, alice, bob, carol } = await peopled()
    const verdicts = await tt.run(async (ctx) => await Promise.all([alice.actor, bob.actor, carol.actor, Actor.anonymous].map(async (actor) => await affirmCountUsage(ctx.db, actor))))
    expect(verdicts).to.deep.eq([true, false, false, false])
  })
})

describe("affirmAccountAction", () => {
  it("lets only a smith retitle or relabel a hunt, anyone with a username retitle themselves or make a hunt, and anyone at all assert a username", async () => {
    const { tt, open, alice, bob, carol } = await peopled()
    const actions = [
      { kind: 'retitle_hunt',  hunt_id: open.hunt_id, title: 'Mine now' },
      { kind: 'relabel_hunt',  hunt_id: open.hunt_id, label: 'mine_now' },
      { kind: 'new_hunt',      label: 'loud_heron' },
      { kind: 'retitle_ident', title: 'Me' },
      { kind: 'assume_ident',  label: 'someone_else', title: 'Someone' },
    ] as const
    const verdicts = await tt.run(async (ctx) => await Promise.all([alice.actor, bob.actor, carol.actor, Actor.anonymous].map(async (actor) => (
      await Promise.all(actions.map(async (action) => await affirmAccountAction(ctx.db, actor, action)))
    ))))
    expect(verdicts).to.deep.eq([
      ['allow',         'allow',         'allow',         'allow',         'allow'],
      ['notPermitted',  'notPermitted',  'allow',         'allow',         'allow'],
      ['notPermitted',  'notPermitted',  'allow',         'allow',         'allow'],
      ['notIdentified', 'notIdentified', 'notIdentified', 'notIdentified', 'allow'],
    ])
  })
})

describe("affirmPerform", () => {
  it("asks the policy of the action's kind, of the hunt the place names, and holds the place to that hunt", async () => {
    const { tt, open, other, alice, bob } = await peopled()
    const retitle = { kind: 'retitle_quiz', title: 'Kings' } as const
    const review = { kind: 'open_review', quiz_id: open.quiz_id } as const
    const verdicts = await tt.run(async (ctx) => [
      await affirmPerform(ctx.db, open, alice.actor, retitle),
      await affirmPerform(ctx.db, open, bob.actor, retitle),
      await affirmPerform(ctx.db, open, bob.actor, review),
      await affirmPerform(ctx.db, { ...open, quiz_id: other.open.quiz_id }, alice.actor, retitle),
      await affirmPerform(ctx.db, { ...open, realm_id: other.open.realm_id }, alice.actor, retitle),
      await affirmPerform(ctx.db, open, alice.actor, { kind: 'set_lock', quiz_id: other.open.quiz_id, locked: true }),
    ])
    expect(verdicts).to.deep.eq(['allow', 'notPermitted', 'allow', 'notPermitted', 'notPermitted', 'notPermitted'])
  })

  it("refuses a quiz whose realm is gone, since nothing then says whose it is", async () => {
    const { tt, open, alice } = await peopled()
    const verdict = await tt.run(async (ctx) => {
      await ctx.db.delete('realms', open.realm_id)
      return await affirmPerform(ctx.db, open, alice.actor, { kind: 'retitle_quiz', title: 'Kings' })
    })
    expect(verdict).to.eq('notPermitted')
  })
})

describe("hunts.perform, authorized", () => {
  it("lets a smith change the hunt, and refuses a reviewer and a stranger, writing nothing", async () => {
    const { act, read, bob, carol } = await peopled()
    await act({ kind: 'retitle_quiz', title: 'Princes' })
    await expectRefusal(act({ kind: 'retitle_quiz', title: 'Kings' }, bob), 'notPermitted')
    await expectRefusal(act({ kind: 'retitle_quiz', title: 'Kings' }, carol), 'notPermitted')
    await expectRefusal(act({ kind: 'add_hunting', ident_label: 'carol_strays', role: 'smith' }, bob), 'notPermitted')
    await expectRefusal(act({ kind: 'import_questions', questions: [{ label: 'smuggled', patch: {} }] }, bob), 'notPermitted')
    expect(openOf(await read()).title).to.eq('Princes')
  })

  it("lets a reviewer, or a smith, write their own review, and refuses a stranger", async () => {
    const { act, open, bob, carol, alice } = await peopled()
    await act({ kind: 'open_review', quiz_id: open.quiz_id }, bob)
    await act({ kind: 'open_review', quiz_id: open.quiz_id }, alice)
    await expectRefusal(act({ kind: 'open_review', quiz_id: open.quiz_id }, carol), 'notPermitted')
  })

  it("refuses a session that has asserted no username, or a request with no session, before anything else", async () => {
    const { tt, act } = await peopled()
    await expectRefusal(act({ kind: 'retitle_quiz', title: 'Kings' }, await signedIn(tt)), 'notIdentified')
    await expectRefusal(act({ kind: 'retitle_quiz', title: 'Kings' }, tt), 'notIdentified')
  })

  it("refuses a place whose realm or quiz is another hunt's, or an action naming a quiz of another hunt", async () => {
    const tt = openTester()
    const mine = await seedHunt(tt, Hunt.blank('quiet_otter'), { smith: 'alice_smiths' })
    const theirs = await seedHunt(tt, Hunt.blank('loud_heron'), { smith: 'bob_smiths' })
    const before = openOf(await theirs.read())
    const forgeries = [{ ...mine.open, quiz_id: theirs.open.quiz_id }, { ...theirs.open, hunt_id: mine.open.hunt_id }]
    for (const open of forgeries) {
      await expectRefusal(mine.smith.as.mutation(api.hunts.perform, { open, action: { kind: 'retitle_quiz', title: 'Mine now' } }), 'notPermitted')
    }
    await expectRefusal(mine.act({ kind: 'set_lock', quiz_id: theirs.open.quiz_id, locked: true }), 'notPermitted')
    await expectRefusal(mine.act({ kind: 'open_review', quiz_id: theirs.open.quiz_id }), 'notPermitted')
    expect(openOf(await theirs.read())).to.deep.eq(before)
  })
})

/** What became of `pending`: `'allow'` when it went through, or the kind of the refusal */
async function outcomeOf(pending: Promise<unknown>): Promise<string> {
  try {
    await pending
  } catch {
    return await refusedAs(pending) // settled already: says why it was refused
  }
  return Approve.Allow
}

/** One action decided by each policy a hunt action is: the hunt's, one's own review's, and the membership's */
function actionsOn(quiz_id: Id<'quizzes'>): HuntActionDNA[] {
  return [
    { kind: 'retitle_quiz', title: 'Kings' },
    { kind: 'open_review', quiz_id },
    { kind: 'add_hunting', ident_label: 'erin_reviews', role: 'reviewer' },
  ]
}

describe("hunts.perform agrees with Approve, as each standing", () => {
  for (const kind of ['retitle_quiz', 'open_review', 'add_hunting'] as const) {
    it(`${kind}: as a smith, a reviewer, a stranger, a session with no username, and no session`, async () => {
      const { tt, open, alice, bob, carol } = await peopled()
      await identified(tt, 'erin_reviews')
      const dna = present(actionsOn(open.quiz_id).find((each) => each.kind === kind))
      const action = ActionValidators.huntAction(dna)
      const callers: [Session | Tester, Actor.ActorT, HuntRole | null][] = [
        [alice,            alice.actor,     'smith'],
        [bob,              bob.actor,       'reviewer'],
        [carol,            carol.actor,     null],
        [await signedIn(tt), Actor.anonymous, null],
        [tt,               Actor.anonymous, null],
      ]
      const expected = callers.map(([, actor, role]) => Approve.verdictOn(action.kind, Actor.claimsOn(actor, open.hunt_id, role && { role }), action))
      const seen: string[] = []
      for (const [by] of callers) {
        seen.push(await outcomeOf(callerOf(by).mutation(api.hunts.perform, { open, action: dna })))
      }
      expect(seen).to.deep.eq(expected)
    })
  }
})

describe("identings, each session's own", () => {
  it("are read only through the session's own token: another session, or none, learns nothing of them", async () => {
    const tt = openTester()
    await identified(tt, 'alice_reviews')
    const other = await signedIn(tt)
    expect([await other.as.query(api.idents.current, {}), await tt.query(api.idents.current, {})]).to.deep.eq([null, null])
  })

  it("are listed by no function, nor are idents changed or removed by one; Convex Auth's own functions are the rest", async () => {
    expect(await publicFunctions()).to.deep.eq([
      'auth:isAuthenticated', 'auth:signIn', 'auth:signOut',
      'hunts:list', 'hunts:open', 'hunts:perform', 'hunts:whole',
      'idents:current', 'idents:performAccount',
      'questions:open',
      'quizzes:open',
      'reviews:forQuiz',
      'widgets:library', 'widgets:usage',
    ])
  })
})

describe("idents", () => {
  it("are made by any session, and are never changed by another asserting the username", async () => {
    const tt = openTester()
    const [first, second] = [await signedIn(tt), await signedIn(tt)]
    await first.as.mutation(api.idents.performAccount, { action: { kind: 'assume_ident', label: 'flip_kromer', title: 'Flip' } })
    await expectRefusal(second.as.mutation(api.idents.performAccount, { action: { kind: 'assume_ident', label: 'flip_kromer', title: 'Impostor' } }), 'usernameClaimed')
    const ident = await tt.run(async (ctx) => await identForLabel(ctx.db, 'flip_kromer'))
    expect([ident?.title, ident?.user_id]).to.deep.eq(['Flip', first.user_id])
  })
})
