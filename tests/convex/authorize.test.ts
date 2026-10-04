import { describe, expect, it } from 'vitest'
import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'
import { affirmAccountAction, affirmCountUsage, affirmForHunt, affirmPerform, affirmReadHunt, affirmReadQuestion, affirmReadReviews, claimsFor, Unscoped } from '../../convex/authorize'
import { isHuntScoped } from '../../convex/functions'
import { scopedReader } from '../../convex/policy_rules'
import { huntingFor, identForLabel, reviewsOf } from '../../convex/reading'
import * as Actor from '../../src/lib/actor'
import * as Approve from '../../src/lib/approve'
import { failurekindOf } from '../../src/lib/refusals'
import { ActionValidators, type HuntActionDNA, type HuntActionT } from '../../src/models/actions'
import type { HuntRole } from '../../src/models/hunting'
import { Hunt } from '../../src/models/hunt'
import { present } from '../support/present'
import { affirmsOf, callerOf, expectRefusal, identified, openOf, openTester, refusedAs, seedHunt, signedIn, type Identified, type PlaceT, type Session, type Tester } from '../support/convex'

const modules = import.meta.glob('../../convex/**/*.ts')

/** Whether `val` is a function any caller on the internet may run */
function isPublicFunction(val: unknown): boolean {
  return typeof val === 'function' && 'isPublic' in val && val.isPublic === true
}

/** Every public function the deployment offers, by `module:name`, in order */
async function publicFunctionsFor(): Promise<[string, unknown][]> {
  const sources = Object.entries(modules).filter(([path]) => ! path.includes('/_generated/') && ! path.endsWith('/convex.config.ts'))
  const found = await Promise.all(sources.map(async ([path, load]) => {
    const exported = await load() as Record<string, unknown>
    const modulename = path.replace('../../convex/', '').replace(/\.ts$/, '')
    return Object.entries(exported).filter(([, val]) => isPublicFunction(val)).map(([fnname, val]): [string, unknown] => [`${modulename}:${fnname}`, val])
  }))
  return found.flat().toSorted(([aa], [bb]) => aa.localeCompare(bb))
}

/** Every public function the deployment offers, as `module:name`, in order */
async function publicFunctions(): Promise<string[]> {
  const found = await publicFunctionsFor()
  return found.map(([fnname]) => fnname)
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

/** What became of `pending`: `'allow'` when it went through, or the kind of the denial or refusal it threw */
async function outcomeOf(pending: Promise<unknown>): Promise<string> {
  try {
    await pending
  } catch (err) {
    if (err instanceof Approve.NotApprovedError) { return err.denial }
    const failurekind = failurekindOf(err)
    if (failurekind === null) { throw err }
    return failurekind
  }
  return Approve.Allow
}

/** The keys of `obj`, in alphabetical order */
function keysOf(obj: object): string[] {
  return Object.keys(obj).toSorted((aa, bb) => aa.localeCompare(bb))
}

describe("affirmForHunt", () => {
  it("hands on the claims: the actor, every affirm, and the quiz and realm read when affirmed, with what the caller asked read beside them", async () => {
    const { tt, open, alice } = await peopled()
    const { hunt, quiz, action } = await affirmsOf(tt, alice, open)
    const seen = await tt.run(async (ctx) => {
      const onHunt = await affirmForHunt(ctx.db, hunt, alice.actor, {})
      const onQuiz = await affirmForHunt(ctx.db, quiz, alice.actor, { hunting: huntingFor(ctx.db, open.hunt_id, alice.ident_id), held: Promise.resolve(7) })
      const onAction = await affirmForHunt(ctx.db, action, alice.actor, {})
      return [keysOf(onHunt), keysOf(onQuiz), keysOf(onAction), onQuiz.quiz?._id, onAction.realm?._id, onQuiz.held, onQuiz.hunting?.role]
    })
    expect(seen).to.deep.eq([
      ['hunt_id', 'ident_id', 'ident_label', 'kind', 'standing', 'user_id'],
      ['held', 'hunt_id', 'hunting', 'ident_id', 'ident_label', 'kind', 'quiz', 'quiz_id', 'standing', 'user_id'],
      ['hunt_id', 'ident_id', 'ident_label', 'kind', 'quiz', 'quiz_id', 'realm', 'realm_id', 'standing', 'user_id'],
      open.quiz_id, open.realm_id, 7, 'smith',
    ])
  })

  it("turns away each affirm that is not so, one guard at a time, and an actor who has asserted no username first", async () => {
    const { tt, open, other, alice, bob, carol } = await peopled()
    const { action: affirms } = await affirmsOf(tt, alice, open)
    const second_realm_id = await tt.run(async (ctx) => await ctx.db.insert('realms', { hunt_id: open.hunt_id, position: 1, label: 'away', title: 'Away' }))
    const Cases: [Actor.ActorT, typeof affirms, string, string][] = [
      // one case per guard, in order:
      [Actor.anonymous, affirms,                                         'notIdentified', 'nobody who has asserted no username'],
      [bob.actor,       affirms,                                         'notPermitted',  'the browser is the ident it says'],
      [alice.actor,     { ...affirms, standing: 'reviewer' },            'notPermitted',  '...and stands on the hunt as it says'],
      [alice.actor,     { ...affirms, quiz_id: other.open.quiz_id },     'notPermitted',  'the quiz it names is of the hunt'],
      [alice.actor,     { ...affirms, realm_id: second_realm_id },       'notPermitted',  '...and of the realm, where it names one'],
      [alice.actor,     { ...affirms, realm_id: other.open.realm_id, quiz_id: other.open.quiz_id, hunt_id: open.hunt_id }, 'notPermitted', 'the realm it names is of the hunt'],
      [alice.actor,     affirms,                                         'allow',         'every affirm so'],
      // a stranger who says so:
      [carol.actor,     { ...affirms, ident_id: carol.ident_id, standing: 'stranger' }, 'allow', 'a stranger who says they are one: what they may do is the policy\'s to say'],
    ]
    for (const [actor, affirmed, expected, describes] of Cases) {
      const outcome = await outcomeOf(tt.run(async (ctx) => { await affirmForHunt(ctx.db, affirmed, actor, {}) }))
      expect([describes, outcome]).to.deep.eq([describes, expected])
    }
  })

  it("passes a quiz or a realm that is gone, for the write that comes to it to refuse", async () => {
    const { tt, open, alice, act } = await peopled()
    const { action: affirms } = await affirmsOf(tt, alice, open)
    await tt.run(async (ctx) => { await ctx.db.delete('quizzes', open.quiz_id) })
    const claims = await tt.run(async (ctx) => await affirmForHunt(ctx.db, affirms, alice.actor, {}))
    expect([claims.quiz, claims.realm?._id]).to.deep.eq([null, open.realm_id])
    await expectRefusal(act({ kind: 'retitle_quiz', title: 'Kings' }), 'quizGone')
  })
})

describe("claimsFor", () => {
  it("gives a smith and a reviewer their role as their standing, and anyone else a stranger's", async () => {
    const { tt, open, alice, bob, carol } = await peopled()
    const seen = await tt.run(async (ctx) => await Promise.all([alice.actor, bob.actor, carol.actor, Actor.anonymous].map(async (actor) => {
      const { standing } = await claimsFor(ctx.db, open.hunt_id, actor)
      return standing
    })))
    expect(seen).to.deep.eq(['smith', 'reviewer', 'stranger', 'stranger'])
  })
})

describe("affirmReadHunt and affirmReadQuestion", () => {
  it("let anyone on the hunt read it, and turn away a stranger and anyone who has asserted no username", async () => {
    const { tt, open, alice, bob, carol } = await peopled()
    const outcomes = []
    for (const [actor, by] of [[alice.actor, alice], [bob.actor, bob], [carol.actor, carol], [Actor.anonymous, alice]] as const) {
      const { quiz: affirms } = await affirmsOf(tt, by, open)
      outcomes.push(await outcomeOf(tt.run(async (ctx) => { await affirmReadHunt(ctx.db, affirms, actor) })))
    }
    expect(outcomes).to.deep.eq(['allow', 'allow', 'notPermitted', 'notIdentified'])
  })

  it("read a question only of the affirmed hunt, and pass one that is gone", async () => {
    const { tt, open, other, alice, read } = await peopled()
    const { hunt: affirms } = await affirmsOf(tt, alice, open)
    const question_id = present(openOf(await read()).questions[0])._id as Id<'questions'>
    const theirs = present(openOf(await other.read()).questions[0])._id as Id<'questions'>
    const { question } = await tt.run(async (ctx) => await affirmReadQuestion(ctx.db, affirms, alice.actor, question_id))
    expect(question?._id).to.eq(question_id)
    expect(await outcomeOf(tt.run(async (ctx) => { await affirmReadQuestion(ctx.db, affirms, alice.actor, theirs) }))).to.eq('notPermitted')
    await tt.run(async (ctx) => { await ctx.db.delete('questions', question_id) })
    const { question: gone } = await tt.run(async (ctx) => await affirmReadQuestion(ctx.db, affirms, alice.actor, question_id))
    expect(gone).to.be.null
  })
})

/**
 * Which of the quiz's reviews each of `readers` is shown, by their writers' labels, each affirming
 * as a browser that has read the hunt would and reading through a database scoped to the claims.
 */
async function readersOf(tt: Tester, open: PlaceT, readers: Identified[], labelFor: Record<string, string>): Promise<string[][]> {
  const seen: string[][] = []
  for (const reader of readers) {
    const { quiz: affirms } = await affirmsOf(tt, reader, open)
    const readable = await tt.run(async (ctx) => await reviewsOf(scopedReader(ctx.db, await affirmReadReviews(ctx.db, affirms, reader.actor)), open.quiz_id))
    seen.push(readable.map((review) => labelFor[review.ident_id] ?? '?'))
  }
  return seen
}

describe("affirmReadReviews, and the reviews a database scoped to its claims shows", () => {
  it("let a reviewer read their own review whatever its phase; once shared, a smith, and another reviewer only while theirs is shared too", async () => {
    const { tt, open, act, join, alice, bob, carol } = await peopled()
    const dave = await join('dave_reviews', 'reviewer')
    const labelFor = { [bob.ident_id]: 'bob', [dave.ident_id]: 'dave' }
    const readers = [bob, alice, dave, carol]
    await act({ kind: 'open_review', quiz_id: open.quiz_id }, bob)
    await act({ kind: 'open_review', quiz_id: open.quiz_id }, dave)
    expect(await readersOf(tt, open, readers, labelFor)).to.deep.eq([['bob'], [], ['dave'], []])
    await act({ kind: 'set_review_phase', quiz_id: open.quiz_id, phase: 'shared' }, bob)
    expect(await readersOf(tt, open, readers, labelFor)).to.deep.eq([['bob'], ['bob'], ['dave'], []])
    await act({ kind: 'set_review_phase', quiz_id: open.quiz_id, phase: 'shared' }, dave)
    expect(await readersOf(tt, open, readers, labelFor)).to.deep.eq([['bob', 'dave'], ['bob', 'dave'], ['bob', 'dave'], []])
    await act({ kind: 'set_review_phase', quiz_id: open.quiz_id, phase: 'draft' }, dave)
    expect(await readersOf(tt, open, readers, labelFor)).to.deep.eq([['bob'], ['bob'], ['dave'], []])
  })

  it("let a reviewer taken off the hunt read nothing of it, not even their own review", async () => {
    const { tt, open, act, bob } = await peopled()
    await act({ kind: 'open_review', quiz_id: open.quiz_id }, bob)
    await act({ kind: 'set_review_phase', quiz_id: open.quiz_id, phase: 'shared' }, bob)
    await act({ kind: 'remove_hunting', ident_id: bob.ident_id })
    expect(await readersOf(tt, open, [bob], { [bob.ident_id]: 'bob' })).to.deep.eq([[]])
  })

  it("read nothing of a quiz with no reviews, and turn away anyone who has asserted no username", async () => {
    const { tt, open, alice } = await peopled()
    const { quiz: affirms } = await affirmsOf(tt, alice, open)
    expect(await readersOf(tt, open, [alice], {})).to.deep.eq([[]])
    expect(await outcomeOf(tt.run(async (ctx) => await affirmReadReviews(ctx.db, affirms, Actor.anonymous)))).to.eq('notIdentified')
  })
})

describe("affirmCountUsage", () => {
  it("lets a smith of any hunt count how far a widget is put to work, and nobody else", async () => {
    const { tt, alice, bob, carol } = await peopled()
    const outcomes = []
    for (const actor of [alice.actor, bob.actor, carol.actor, Actor.anonymous]) {
      outcomes.push(await outcomeOf(tt.run(async (ctx) => { await affirmCountUsage(ctx.db, actor) })))
    }
    expect(outcomes).to.deep.eq(['allow', 'notPermitted', 'notPermitted', 'notIdentified'])
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
    const outcomes: string[][] = []
    for (const actor of [alice.actor, bob.actor, carol.actor, Actor.anonymous]) {
      const row: string[] = []
      for (const action of actions) { row.push(await outcomeOf(tt.run(async (ctx) => { await affirmAccountAction(ctx.db, actor, action) }))) }
      outcomes.push(row)
    }
    expect(outcomes).to.deep.eq([
      ['allow',         'allow',         'allow',         'allow',         'allow'],
      ['notPermitted',  'notPermitted',  'allow',         'allow',         'allow'],
      ['notPermitted',  'notPermitted',  'allow',         'allow',         'allow'],
      ['notIdentified', 'notIdentified', 'notIdentified', 'notIdentified', 'allow'],
    ])
  })
})

describe("affirmPerform", () => {
  it("asks the policy of the action's kind of the affirmed hunt, holds the affirms to it, and the quiz the action names too", async () => {
    const { tt, open, other, alice, bob } = await peopled()
    const [{ action: alices }, { action: bobs }] = [await affirmsOf(tt, alice, open), await affirmsOf(tt, bob, open)]
    const retitle = { kind: 'retitle_quiz', title: 'Kings' } as const
    const review = { kind: 'open_review', quiz_id: open.quiz_id } as const
    const Cases: [Actor.ActorT, typeof alices, HuntActionT, string][] = [
      [alice.actor, alices,                                       retitle, 'allow'],
      [bob.actor,   bobs,                                         retitle, 'notPermitted'],
      [bob.actor,   bobs,                                         review,  'allow'],
      [alice.actor, { ...alices, quiz_id: other.open.quiz_id },   retitle, 'notPermitted'],
      [alice.actor, { ...alices, realm_id: other.open.realm_id }, retitle, 'notPermitted'],
      [alice.actor, alices, { kind: 'set_lock', quiz_id: other.open.quiz_id, locked: true }, 'notPermitted'],
    ]
    const outcomes = []
    for (const [actor, affirms, action] of Cases) {
      outcomes.push(await outcomeOf(tt.run(async (ctx) => { await affirmPerform(ctx.db, affirms, actor, action) })))
    }
    expect(outcomes).to.deep.eq(Cases.map((each) => each[3]))
  })

  it("hands on the quiz the action names, read in the same round", async () => {
    const { tt, open, alice, read } = await peopled()
    const { action: affirms } = await affirmsOf(tt, alice, open)
    const sibling = present(openOf(await read()).questions[0])
    const named = await tt.run(async (ctx) => {
      const locking = await affirmPerform(ctx.db, affirms, alice.actor, { kind: 'set_lock', quiz_id: open.quiz_id, locked: true })
      const editing = await affirmPerform(ctx.db, affirms, alice.actor, { kind: 'edit_question', question_id: sibling._id as Id<'questions'>, patch: {} })
      return [locking.named?._id, editing.named]
    })
    expect(named).to.deep.eq([open.quiz_id, null])
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

  it("refuses a smith's change to a locked quiz with the lock's own refusal, and a reviewer's as any other", async () => {
    const { act, open, bob } = await peopled()
    await act({ kind: 'set_lock', quiz_id: open.quiz_id, locked: true })
    await expectRefusal(act({ kind: 'add_question' }), 'quizLocked')
    await expectRefusal(act({ kind: 'add_question' }, bob), 'notPermitted')
    await act({ kind: 'open_review', quiz_id: open.quiz_id }, bob)
    await act({ kind: 'new_quiz' })
    await act({ kind: 'set_lock', quiz_id: open.quiz_id, locked: false })
    await act({ kind: 'add_question' })
  })

  it("turns away a stale or forged affirm before anything is written: a standing not held, another's ident, a quiz or realm of another hunt, or an action naming a quiz of another hunt", async () => {
    const tt = openTester()
    const mine = await seedHunt(tt, Hunt.blank('quiet_otter'), { smith: 'alice_smiths' })
    const theirs = await seedHunt(tt, Hunt.blank('loud_heron'), { smith: 'bob_smiths' })
    const reviewer = await mine.join('dave_reviews', 'reviewer')
    const before = [openOf(await mine.read()), openOf(await theirs.read())]
    const [{ action: alices }, { action: daves }] = [await affirmsOf(tt, mine.smith, mine.open), await affirmsOf(tt, reviewer, mine.open)]
    const retitle = { kind: 'retitle_quiz', title: 'Mine now' } as const
    const Forgeries: [Session, typeof alices, HuntActionDNA, string][] = [
      [reviewer,   { ...daves, standing: 'smith' },                         retitle, 'a reviewer saying they are a smith'],
      [mine.smith, { ...alices, standing: 'reviewer' },                     retitle, 'a smith saying they are a reviewer: stale, as after a change of role'],
      [reviewer,   { ...alices },                                           retitle, "a reviewer sending a smith's ident"],
      [mine.smith, { ...alices, quiz_id: theirs.open.quiz_id },             retitle, 'a quiz of another hunt'],
      [mine.smith, { ...alices, realm_id: theirs.open.realm_id },           retitle, 'a realm of another hunt'],
      [mine.smith, { ...theirs.open, ident_id: alices.ident_id, standing: 'smith' }, retitle, "another hunt's quiz and realm, as a smith of this one"],
      [mine.smith, alices, { kind: 'set_lock', quiz_id: theirs.open.quiz_id, locked: true }, 'a lock on a quiz of another hunt'],
      [mine.smith, alices, { kind: 'open_review', quiz_id: theirs.open.quiz_id },           'a review of a quiz of another hunt'],
    ]
    for (const [by, affirms, action, describes] of Forgeries) {
      const outcome = await refusedAs(by.as.mutation(api.hunts.perform, { affirms, action }))
      expect([describes, outcome]).to.deep.eq([describes, 'notPermitted'])
    }
    expect([openOf(await mine.read()), openOf(await theirs.read())]).to.deep.eq(before)
  })
})

/** One action decided by each policy a hunt action is: the quiz's, one's own review's, and the membership's */
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
      /** Who calls, whose affirms they send, the actor the server sees, and their role on the hunt */
      type CallerT = { by: Session | Tester, affirming: Identified, actor: Actor.ActorT, role: HuntRole | null }
      const callers: CallerT[] = [
        { by: alice,              affirming: alice, actor: alice.actor,     role: 'smith' },
        { by: bob,                affirming: bob,   actor: bob.actor,       role: 'reviewer' },
        { by: carol,              affirming: carol, actor: carol.actor,     role: null },
        { by: await signedIn(tt), affirming: alice, actor: Actor.anonymous, role: null },
        { by: tt,                 affirming: alice, actor: Actor.anonymous, role: null },
      ]
      const expected = callers.map(({ actor, role }) => Approve.verdictOn(action.kind, { ...Actor.claimsOn(actor, open.hunt_id, role && { role }), quiz: { locked: false } }, action))
      const seen: string[] = []
      for (const { by, affirming } of callers) {
        const { action: affirms } = await affirmsOf(tt, affirming, open)
        seen.push(await outcomeOf(callerOf(by).mutation(api.hunts.perform, { affirms, action: dna })))
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

describe("the database a public function holds", () => {
  it("is scoped to one hunt, by a hunt's builder, for every public function but those named unscoped, each with why", async () => {
    const found = await publicFunctionsFor()
    const scoped = found.filter(([, val]) => isHuntScoped(val)).map(([fnname]) => fnname)
    const unscoped = found.filter(([, val]) => ! isHuntScoped(val)).map(([fnname]) => fnname)
    expect(scoped).to.deep.eq(['hunts:perform', 'hunts:whole', 'questions:open', 'quizzes:open', 'reviews:forQuiz'])
    expect(unscoped).to.deep.eq(keysOf(Unscoped))
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
