import _ from 'es-toolkit/compat'
import { beforeEach, describe, expect, it } from 'vitest'
import * as Z from 'zod'
import { ConvexError } from 'convex/values'
import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'
import { quizzesOf, reviewsOf } from '../../convex/reading'
import * as PA from '../../src/lib/vv/patterns'
import { noticeOf } from '../../src/lib/refusals'
import { RefusalNotices } from '../../src/lib/notices'
import { SeedExpressions } from '../../src/models/expression'
import { Hunt, type HuntT } from '../../src/models/hunt'
import { BlankQuestionQty, Quiz } from '../../src/models/quiz'
import { defaultLayoutFor } from '../../src/models/layout'
import { Question } from '../../src/models/question'
import type { HuntRole } from '../../src/models/hunting'
import { mintId } from '../../src/lib/ids'
import type { HuntActionDNA } from '../../src/models/actions'
import type { BottingRowDNA } from '../../src/models/botting'
import { present } from '../support/present'
import { huntHolding, identified, openOf, openTester, expectRefusal, seedHunt, type Seen, type Tester } from '../support/convex'

/** A hunt holding one quiz built from `qnum, title` pairs, with the standard expressions and layout */
function huntOf(...pairs: [string, string][]): HuntT {
  const questions = pairs.map(([qnum, title]) => ({ ...Question.blank(), qnum, title }))
  const quiz = { ...Quiz.blank('Quiz one'), ...defaultLayoutFor(SeedExpressions), questions }
  return huntHolding([quiz], SeedExpressions)
}

/** A hunt holding one quiz of blank questions */
function openHunt(locked = false): HuntT {
  return huntHolding([{ ...Quiz.blank('Quiz one'), locked }])
}

/** A hunt holding the quizzes titled `titles`, blank, the one at `lockedIdx` locked */
function huntTitled(titles: string[], lockedIdx = -1): HuntT {
  return huntHolding(titles.map((title, idx) => ({ ...Quiz.blank(title), locked: idx === lockedIdx })))
}

/** `hunt` with every quiz locked */
function lockedAll(hunt: HuntT): HuntT {
  return { ...hunt, realms: hunt.realms.map((realm) => ({ ...realm, quizzes: realm.quizzes.map((quiz) => ({ ...quiz, locked: true })) })) }
}

/** For sorting ids into a stable order to compare */
const byId = (aa: string, bb: string) => aa.localeCompare(bb)

const titlesOf  = (seen: Seen) => openOf(seen).questions.map((question) => question.title)
const qnumsOf   = (seen: Seen) => openOf(seen).questions.map((question) => question.qnum)
const firstOf   = (seen: Seen) => present(openOf(seen).questions[0])
const quizNamed = (seen: Seen, title: string) => present(seen.quizzes.find((quiz) => quiz.title === title), title)
const newestOf  = (seen: Seen) => present(seen.quizzes.at(-1), 'the newest quiz')

/** What a cell shows of a failure: when it happened is the row's own time */
function failureOf(cell: { last_err: unknown } | null) {
  return cell && Z.object({ message: Z.string(), response: Z.json() }).nullable().parse(cell.last_err)
}

/** A botting of `question_id` as a browser sends one: numnum's extraction of a blank clueing, finding nothing, unless overridden */
function botted(question_id: string, overrides: Partial<BottingRowDNA> = {}): BottingRowDNA {
  return {
    question_id, bot_label: 'numnum', textkind: 'clueing', asked_text: '', status: 'done', reply_text: null, items: [],
    message: null, response: null, truncated: false, model_tier_applied: 'careful', approx_tokens: null, ...overrides,
  }
}

/** Numnum's extraction of `question_id`'s `textkind`, which found `value` once */
function found(question_id: string, value: number, textkind: 'clueing' | 'hint' = 'clueing'): BottingRowDNA {
  return botted(question_id, { textkind, items: [{ text: String(value), value, kind: 'numeral' }] })
}

/** Dumdum's guess `text` at `question_id`'s clueing */
function guessed(question_id: string, text: string): BottingRowDNA {
  return botted(question_id, { bot_label: 'dumdum', reply_text: text, model_tier_applied: 'quick' })
}

/** A failed ask of `question_id`'s `textkind` by `bot_label`: its message, and the reply as it came back */
function failed(question_id: string, bot_label: 'dumdum' | 'numnum', textkind: 'clueing' | 'hint', err: { message: string, response: unknown }): BottingRowDNA {
  return botted(question_id, { bot_label, textkind, status: 'error', message: err.message, response: err.response as BottingRowDNA['response'], model_tier_applied: null })
}

/** Whether an extraction is marked stale */
function staleOf(ishes: { status: string, stale?: boolean } | null): boolean {
  return ishes?.status === 'done' && ishes.stale === true
}

/** The first question's clueing extraction, as the hunt now holds it */
async function firstClueingIshes(read: () => Promise<Seen>) {
  return firstOf(await read()).clueing_ishes
}

/** What a refusal of an argument carries: each Zod issue, in our words */
const PathStep   = Z.union([Z.string(), Z.number()])
const ZodIssue   = Z.object({ path: Z.array(PathStep), message: Z.string() })
const ZodRefusal = Z.object({ ZodError: Z.array(ZodIssue) })

/** What `pending` was refused with; fails the test if it went through */
async function refusalOf(pending: Promise<unknown>): Promise<unknown> {
  try {
    await pending
  } catch (err) {
    return err
  }
  throw new Error('expected a refusal, and the call went through')
}

/** The reviews of `quiz_id`, oldest first, as the rows hold them */
async function reviewsIn(tt: Tester, quiz_id: string) {
  return await tt.run(async (ctx) => await reviewsOf(ctx.db, quiz_id as Id<'quizzes'>))
}

/** Every reviewing the rows hold, oldest first, as what was said about which question */
async function reviewingsIn(tt: Tester) {
  const rows = await tt.run(async (ctx) => await ctx.db.query('reviewings').collect())
  return rows.map((row) => _.omit(row, ['_id', '_creationTime', 'review_id']))
}

/** The ids of the open quiz's questions, in order */
const questionIdsOf = (seen: Seen) => openOf(seen).questions.map((question) => question._id as Id<'questions'>)

/** A reviewing with nothing said, and the answer not seen */
const Unsaid = { get_rate: null, guesses: '', comments: '', minutes: null, keep_it: false, needs_fact_check: false, elimination_candidate: false, peeked: false } as const

describe('hunts.perform', () => {
  const Deployment: { tt: Tester } = { tt: openTester() }
  beforeEach(() => { Deployment.tt = openTester() })

  const seed = async (hunt: HuntT, openIdx = 0) => await seedHunt(Deployment.tt, hunt, { openIdx })

  /**
   * `hunt` seeded, its open quiz's review opened by alice, its first two questions' ids, and how
   * to act as alice.
   */
  const reviewed = async (hunt: HuntT = huntOf(['1', 'a'], ['2', 'b'])) => {
    const seeded = await seed(hunt)
    const { browser_key } = await seeded.join('alice_reviews', 'reviewer')
    const quiz = openOf(await seeded.read())
    const [first, second] = quiz.questions.map((question) => question._id as Id<'questions'>)
    const asAlice = async (action: HuntActionDNA) => { await seeded.act(action, browser_key) }
    await asAlice({ kind: 'open_review', quiz_id: quiz._id })
    return { ...seeded, asAlice, browser_key, quiz_id: quiz._id, first: present(first), second: present(second) }
  }

  describe('retitle_quiz', () => {
    it('renames the open quiz', async () => {
      const { act, read } = await seed(openHunt())
      await act({ kind: 'retitle_quiz', title: 'Quiz two' })
      expect(openOf(await read()).title).to.eq('Quiz two')
    })

    it('accepts an empty title without rewriting it', async () => {
      const { act, read } = await seed(openHunt())
      await act({ kind: 'retitle_quiz', title: '' })
      expect(openOf(await read()).title).to.eq('')
    })

    it('refuses while the quiz is locked', async () => {
      const { act, read } = await seed(openHunt(true))
      const ante = await read()
      await expectRefusal(act({ kind: 'retitle_quiz', title: 'Quiz two' }), 'quizLocked')
      expect(await read()).to.deep.eq(ante)
    })
  })

  describe('relabel_quiz', () => {
    it('overrides the generated label of the open quiz, and leaves the generated one alone', async () => {
      const { act, read } = await seed(openHunt())
      const generated = openOf(await read()).label
      await act({ kind: 'relabel_quiz', label: 'leon' })
      expect([openOf(await read()).forced_label, openOf(await read()).label]).to.deep.eq(['leon', generated])
    })

    it('refuses while the quiz is locked', async () => {
      const { act, read } = await seed(openHunt(true))
      const ante = await read()
      await expectRefusal(act({ kind: 'relabel_quiz', label: 'leon' }), 'quizLocked')
      expect(await read()).to.deep.eq(ante)
    })
  })

  describe('reversion_quiz', () => {
    it('puts the open quiz on another version', async () => {
      const { act, read } = await seed(openHunt())
      await act({ kind: 'reversion_quiz', version: 'playtest' })
      expect(openOf(await read()).version).to.eq('playtest')
    })
  })

  describe('set_smiths_note', () => {
    it('rewrites the open quiz\'s smith\'s note, trimmed, keeping its paragraphs', async () => {
      const { act, read } = await seed(openHunt())
      await act({ kind: 'set_smiths_note', smiths_note: '  Theme: princes.\n\nMeta: their initials.\n' })
      expect(openOf(await read()).smiths_note).to.eq('Theme: princes.\n\nMeta: their initials.')
    })

    it('refuses while the quiz is locked', async () => {
      const { act, read } = await seed(openHunt(true))
      const ante = await read()
      await expectRefusal(act({ kind: 'set_smiths_note', smiths_note: 'Theme: kings.' }), 'quizLocked')
      expect(await read()).to.deep.eq(ante)
    })
  })

  describe('add_question', () => {
    it('appends a blank question to the end', async () => {
      const { act, read } = await seed(huntOf(['1', 'a'], ['2', 'b']))
      await act({ kind: 'add_question' })
      const after = openOf(await read())
      expect(after.questions.slice(0, 2).map((question) => question.title)).to.deep.eq(['a', 'b'])
      expect(after.questions).to.have.length(3)
      expect(present(after.questions[2]).clueing).to.eq('')
    })

    it('refuses while the quiz is locked', async () => {
      const { act, read } = await seed(openHunt(true))
      await expectRefusal(act({ kind: 'add_question' }), 'quizLocked')
      expect(openOf(await read()).questions).to.have.length(BlankQuestionQty)
    })
  })

  describe('edit_question', () => {
    it('rewrites only the named question, and only the named fields', async () => {
      const { act, read } = await seed(openHunt())
      const target = present(openOf(await read()).questions[1])
      await act({ kind: 'edit_question', question_id: target._id, patch: { clueing: 'Which région?' } })
      const after = openOf(await read())
      expect([after.questions[1]?.clueing, after.questions[1]?.hint, after.questions[0]?.clueing]).to.deep.eq(['Which région?', '', ''])
    })

    it('refuses a question that is not in the quiz, leaving the quiz alone', async () => {
      const { act, read } = await seed(openHunt())
      const elsewhere = await seed(openHunt())
      const ante = await read()
      const stranger = firstOf(await elsewhere.read())
      await expectRefusal(act({ kind: 'edit_question', question_id: stranger._id, patch: { clueing: 'x' } }), 'questionGone')
      expect(await read()).to.deep.eq(ante)
      expect(firstOf(await elsewhere.read()).clueing).to.eq('')
    })

    it('ignores fields the patch does not mention', async () => {
      const { act, read } = await seed(openHunt())
      const ante = await read()
      await act({ kind: 'edit_question', question_id: firstOf(ante)._id, patch: {} })
      expect(await read()).to.deep.eq(ante)
    })

    it('refuses text the model rejects rather than storing it, saying why in our words', async () => {
      const { act, read } = await seed(openHunt())
      const ante = await read()
      const err = await refusalOf(act({ kind: 'edit_question', question_id: firstOf(ante)._id, patch: { title: 'x'.repeat(201) } }))
      expect(err).to.be.instanceOf(ConvexError)
      const [issue] = ZodRefusal.parse(err instanceof ConvexError ? err.data : null).ZodError
      expect(issue).to.deep.include({ path: ['action', 'patch', 'title'], message: 'is too long: «201» characters vs «82» available' })
      expect(await read()).to.deep.eq(ante)
    })

    it('chains to another question, held by that question\'s label', async () => {
      const { act, read } = await seed(huntOf(['1', 'a'], ['2', 'b']))
      const [first, second] = openOf(await read()).questions
      await act({ kind: 'edit_question', question_id: present(first)._id, patch: { chains_to: present(second)._id } })
      expect(firstOf(await read()).chains_to).to.eq(present(second)._id)
    })

    it('refuses while the quiz is locked', async () => {
      const { act, read } = await seed(openHunt(true))
      const ante = await read()
      await expectRefusal(act({ kind: 'edit_question', question_id: firstOf(ante)._id, patch: { clueing: 'x' } }), 'quizLocked')
      expect(await read()).to.deep.eq(ante)
    })
  })

  describe('sort_questions', () => {
    it('commits the new order into the quiz rather than draping it over the top', async () => {
      const { act, read } = await seed(huntOf(['3', 'cherry'], ['1', 'apple'], ['2', 'banana']))
      await act({ kind: 'sort_questions', sortkey: 'column:title', descending: false })
      expect(titlesOf(await read())).to.deep.eq(['apple', 'banana', 'cherry'])
    })

    it('remembers which column put the quiz in this order', async () => {
      const { act, read } = await seed(huntOf(['1', 'a']))
      await act({ kind: 'sort_questions', sortkey: 'column:qnum', descending: false })
      expect(openOf(await read()).last_sortkey).to.eq('column:qnum')
    })

    it('reverses when asked', async () => {
      const { act, read } = await seed(huntOf(['3', 'cherry'], ['1', 'apple'], ['2', 'banana']))
      await act({ kind: 'sort_questions', sortkey: 'column:title', descending: true })
      expect(titlesOf(await read())).to.deep.eq(['cherry', 'banana', 'apple'])
    })

    it('sorts by what an expressing works out, with the expressions the hunt holds', async () => {
      const { act, read } = await seed(huntOf(['1', 'a'], ['2', 'b'], ['3', 'c']))
      const [first, second, third] = openOf(await read()).questions
      const clueings: [string, string][] = [[present(first)._id, 'one two three'], [present(second)._id, 'one'], [present(third)._id, 'one two']]
      for (const [question_id, clueing] of clueings) { await act({ kind: 'edit_question', question_id, patch: { clueing } }) }
      await act({ kind: 'add_widget', widget: { kind: 'expressing', label: 'words', expression_label: 'clueing_word_count' } })
      await act({ kind: 'add_column', column: { label: 'words', title: 'Words', source: 'words', width_px: 60 } })
      await act({ kind: 'sort_questions', sortkey: 'column:words', descending: false })
      expect(titlesOf(await read())).to.deep.eq(['b', 'c', 'a'])
    })

    it('refuses while the quiz is locked', async () => {
      const { act, read } = await seed(lockedAll(huntOf(['3', 'cherry'], ['1', 'apple'])))
      await expectRefusal(act({ kind: 'sort_questions', sortkey: 'column:title', descending: false }), 'quizLocked')
      expect(titlesOf(await read())).to.deep.eq(['cherry', 'apple'])
    })
  })

  describe('renumber_qnums', () => {
    it('tidies the numbers with no question moving', async () => {
      const { act, read } = await seed(huntOf(['4', 'd'], ['3.3', 'c'], ['6', 'f'], ['1', 'a']))
      await act({ kind: 'renumber_qnums' })
      const after = await read()
      expect(qnumsOf(after)).to.deep.eq(['3', '2', '4', '1'])
      expect(titlesOf(after)).to.deep.eq(['d', 'c', 'f', 'a'])
    })

    it('does not claim the quiz is now in Q# order, which would immediately re-sort it', async () => {
      const { act, read } = await seed(huntOf(['4', 'd'], ['1', 'a']))
      await act({ kind: 'sort_questions', sortkey: 'column:title', descending: false })
      await act({ kind: 'renumber_qnums' })
      expect(openOf(await read()).last_sortkey).to.eq('column:title')
    })

    it('refuses while the quiz is locked', async () => {
      const { act, read } = await seed(lockedAll(huntOf(['4', 'd'])))
      await expectRefusal(act({ kind: 'renumber_qnums' }), 'quizLocked')
      expect(qnumsOf(await read())).to.deep.eq(['4'])
    })
  })

  describe('move_question', () => {
    it('moves the question and renumbers everything by its new position', async () => {
      const { act, read } = await seed(huntOf(['1', 'a'], ['2', 'b'], ['3', 'c']))
      const dragged = present(openOf(await read()).questions[2])
      await act({ kind: 'move_question', question_id: dragged._id, onto_idx: 0 })
      const after = await read()
      expect(titlesOf(after)).to.deep.eq(['c', 'a', 'b'])
      expect(qnumsOf(after)).to.deep.eq(['1', '2', '3'])
    })

    it('adopts a question that had no Q# into the sequence', async () => {
      const { act, read } = await seed(huntOf(['1', 'a'], ['', 'b']))
      const dragged = present(openOf(await read()).questions[1])
      await act({ kind: 'move_question', question_id: dragged._id, onto_idx: 0 })
      expect(qnumsOf(await read())).to.deep.eq(['1', '2'])
    })

    it('leaves the quiz in Q# order, which is the only order a drag is offered in', async () => {
      const { act, read } = await seed(huntOf(['1', 'a'], ['2', 'b']))
      await act({ kind: 'move_question', question_id: firstOf(await read())._id, onto_idx: 1 })
      expect(openOf(await read()).last_sortkey).to.eq('column:qnum')
    })
  })

  describe('the quiz\'s order of its questions', () => {
    it('names every question of the quiz exactly once, whatever adds, moves, sorts, deletes or replaces them', async () => {
      const { act, read, tt, open } = await seed(huntOf(['1', 'a'], ['2', 'b'], ['3', 'c']))
      /** The order and the quiz's questions found by their index are the same ids, none twice */
      const expectOrderHolds = async () => {
        const [ordered, held] = await tt.run(async (ctx) => {
          const quiz = present(await ctx.db.get('quizzes', open.quiz_id))
          const rows = await ctx.db.query('questions').withIndex('by_quiz_id', (cvx) => cvx.eq('quiz_id', open.quiz_id)).collect()
          return [quiz.row_ordering.toSorted(byId), rows.map((row) => row._id).toSorted(byId)]
        })
        expect(ordered).to.deep.eq(held)
      }
      await act({ kind: 'add_question' })
      await expectOrderHolds()
      await act({ kind: 'move_question', question_id: firstOf(await read())._id, onto_idx: 2 })
      await expectOrderHolds()
      await act({ kind: 'sort_questions', sortkey: 'column:title', descending: true })
      await expectOrderHolds()
      await act({ kind: 'delete_questions', question_ids: [firstOf(await read())._id] })
      await expectOrderHolds()
      await act({ kind: 'import_questions', questions: [{ label: 'fresh_one', patch: {} }] })
      await expectOrderHolds()
      expect(titlesOf(await read())).to.have.length(4)
    })
  })

  describe('delete_questions', () => {
    it('deletes the named questions, and the rest close ranks keeping their Q#s', async () => {
      const { act, read } = await seed(huntOf(['1', 'a'], ['2', 'b'], ['3', 'c'], ['4', 'd']))
      const [, second, , fourth] = openOf(await read()).questions
      await act({ kind: 'delete_questions', question_ids: [present(second)._id, present(fourth)._id] })
      const after = await read()
      expect(titlesOf(after)).to.deep.eq(['a', 'c'])
      expect(qnumsOf(after)).to.deep.eq(['1', '3'])
    })

    it('takes each deleted question\'s replies with it, and leaves the others\' alone', async () => {
      const { act, read, tt } = await seed(huntOf(['1', 'a'], ['2', 'b']))
      const [first, second] = openOf(await read()).questions
      await act({ kind: 'record_botting', botting: found(present(first)._id, 1) })
      await act({ kind: 'record_botting', botting: found(present(second)._id, 2) })
      await act({ kind: 'delete_questions', question_ids: [present(first)._id] })
      const bottings = await tt.run(async (ctx) => await ctx.db.query('bottings').collect())
      expect(bottings.map((botting) => botting.question_id)).to.deep.eq([present(second)._id])
    })

    it('takes each deleted question\'s reviewings with it, and leaves the others\' alone', async () => {
      const { tt, act, asAlice, quiz_id, first, second } = await reviewed()
      await asAlice({ kind: 'set_reviewing', quiz_id, question_id: first, patch: { get_rate: 10 } })
      await asAlice({ kind: 'set_reviewing', quiz_id, question_id: second, patch: { get_rate: 20 } })
      await act({ kind: 'delete_questions', question_ids: [first] })
      expect(await reviewingsIn(tt)).to.deep.eq([{ ...Unsaid, question_id: second, get_rate: 20 }])
    })

    it('clears a chain to a deleted question, so a later question answering to its label does not inherit it', async () => {
      const { act, read } = await seed(huntOf(['1', 'a'], ['2', 'b']))
      const [first, second] = openOf(await read()).questions
      await act({ kind: 'set_chain', question_id: present(first)._id, chains_to: present(second)._id })
      await act({ kind: 'delete_questions', question_ids: [present(second)._id] })
      expect(firstOf(await read()).chains_to).to.eq(null)
    })

    it('passes over an id that names no question of the quiz', async () => {
      const { act, read } = await seed(huntOf(['1', 'a'], ['2', 'b']))
      const elsewhere = await seed(huntOf(['1', 'z']))
      await act({ kind: 'delete_questions', question_ids: [firstOf(await elsewhere.read())._id] })
      expect(titlesOf(await read())).to.deep.eq(['a', 'b'])
      expect(titlesOf(await elsewhere.read())).to.deep.eq(['z'])
    })

    it('can empty the quiz', async () => {
      const { act, read } = await seed(huntOf(['1', 'a'], ['2', 'b']))
      await act({ kind: 'delete_questions', question_ids: openOf(await read()).questions.map((question) => question._id) })
      expect(titlesOf(await read())).to.deep.eq([])
    })

    it('refuses while the quiz is locked', async () => {
      const { act, read } = await seed(openHunt(true))
      const doomed = firstOf(await read())
      await expectRefusal(act({ kind: 'delete_questions', question_ids: [doomed._id] }), 'quizLocked')
      expect(openOf(await read()).questions).to.have.length(BlankQuestionQty)
    })
  })

  describe('set_chain', () => {
    it('chains one question to another, which the quiz then shows', async () => {
      const { act, read } = await seed(huntOf(['1', 'a'], ['2', 'b']))
      const [first, second] = openOf(await read()).questions
      await act({ kind: 'set_chain', question_id: present(first)._id, chains_to: present(second)._id })
      expect(firstOf(await read()).chains_to).to.eq(present(second)._id)
    })

    it('unchains with null', async () => {
      const { act, read } = await seed(huntOf(['1', 'a'], ['2', 'b']))
      const [first, second] = openOf(await read()).questions
      await act({ kind: 'set_chain', question_id: present(first)._id, chains_to: present(second)._id })
      await act({ kind: 'set_chain', question_id: present(first)._id, chains_to: null })
      expect(firstOf(await read()).chains_to).to.eq(null)
    })

    it('clears a chain to itself, or to no question of the quiz, rather than keeping it', async () => {
      const { act, read } = await seed(huntOf(['1', 'a'], ['2', 'b']))
      const first = firstOf(await read())
      await act({ kind: 'set_chain', question_id: first._id, chains_to: first._id })
      expect(firstOf(await read()).chains_to).to.eq(null)
      const elsewhere = await seed(huntOf(['1', 'z']))
      await act({ kind: 'set_chain', question_id: first._id, chains_to: firstOf(await elsewhere.read())._id })
      expect(firstOf(await read()).chains_to).to.eq(null)
    })
  })

  describe('sort_by_chain_order', () => {
    it('walks the chains from the lowest Q#, and remembers doing so', async () => {
      const { act, read } = await seed(huntOf(['1', 'a'], ['2', 'b'], ['3', 'c']))
      const [first, , third] = openOf(await read()).questions
      await act({ kind: 'set_chain', question_id: present(first)._id, chains_to: present(third)._id })
      await act({ kind: 'sort_by_chain_order', descending: false })
      const after = await read()
      expect(titlesOf(after)).to.deep.eq(['a', 'c', 'b'])
      expect(openOf(after).last_sortkey).to.eq('chain_order')
    })
  })

  describe('record_botting', () => {
    it('stores an extraction against the text it came from, in its own cell', async () => {
      const { act, read } = await seed(huntOf(['1', 'a']))
      const { _id: id } = firstOf(await read())
      await act({ kind: 'record_botting', botting: found(id, 1994, 'hint') })
      const question = firstOf(await read())
      expect(question.hint_ishes).to.deep.include({ status: 'done', items: [{ text: '1994', value: 1994, kind: 'numeral' }], stale: false })
      expect(question.clueing_ishes).to.eq(null)
    })

    it('stores a guess, with what it cost', async () => {
      const { act, read } = await seed(huntOf(['1', 'a']))
      const { _id: id } = firstOf(await read())
      await act({ kind: 'record_botting', botting: { ...guessed(id, 'Leon'), approx_tokens: 12 } })
      expect(firstOf(await read()).guess).to.deep.include({ status: 'done', text: 'Leon', model_tier_applied: 'quick', approx_tokens: 12 })
    })

    it('marks an extraction stale when the text it was asked about is not the question\'s', async () => {
      const { act, read } = await seed(huntOf(['1', 'a']))
      const { _id: id } = firstOf(await read())
      await act({ kind: 'record_botting', botting: { ...found(id, 1), asked_text: 'An earlier clueing' } })
      expect(staleOf(await firstClueingIshes(read))).to.eq(true)
    })

    it('refuses while the quiz is locked', async () => {
      const { act, read } = await seed(lockedAll(huntOf(['1', 'a'])))
      const asked = firstOf(await read())
      await expectRefusal(act({ kind: 'record_botting', botting: found(asked._id, 1) }), 'quizLocked')
      expect(firstOf(await read()).clueing_ishes).to.eq(null)
    })

    it('refuses a question of another quiz', async () => {
      const { act, read } = await seed(huntTitled(['one', 'two']))
      const other = present(quizNamed(await read(), 'two').questions[0])
      await expectRefusal(act({ kind: 'record_botting', botting: found(other._id, 1) }), 'questionGone')
    })
  })

  describe('a failed ask', () => {
    const err = { message: 'A connection hiccup — try again.', response: { ok: false, failurekind: 'connection' } }
    const items = [{ text: '300', value: 300, kind: 'numeral' as const }]

    /** A question already holding a guess and a clueing extraction */
    const withHeld = async () => {
      const seeded = await seed(huntOf(['1', 'a']))
      const { _id: id } = firstOf(await seeded.read())
      await seeded.act({ kind: 'record_botting', botting: guessed(id, 'Leon') })
      await seeded.act({ kind: 'record_botting', botting: botted(id, { items }) })
      return { ...seeded, id }
    }

    it('leaves a guess as it was and rides along on it as its last_err', async () => {
      const { act, read, id } = await withHeld()
      await act({ kind: 'record_botting', botting: failed(id, 'dumdum', 'clueing', err) })
      const { guess } = firstOf(await read())
      expect(guess).to.deep.include({ status: 'done', text: 'Leon', truncated: false })
      expect(failureOf(guess)).to.deep.eq({ message: err.message, response: err.response })
    })

    it('leaves an extraction\'s items and stale flag exactly as they were', async () => {
      const { act, read, id } = await withHeld()
      await act({ kind: 'record_botting', botting: failed(id, 'numnum', 'clueing', err) })
      const { clueing_ishes } = firstOf(await read())
      expect(clueing_ishes).to.deep.include({ status: 'done', items, stale: false })
      expect(failureOf(clueing_ishes)).to.deep.eq({ message: err.message, response: err.response })
    })

    it('becomes the cell\'s only content when it never had a value', async () => {
      const { act, read } = await seed(huntOf(['1', 'a']))
      const { _id: id } = firstOf(await read())
      await act({ kind: 'record_botting', botting: failed(id, 'dumdum', 'clueing', err) })
      const { guess } = firstOf(await read())
      expect(guess).to.deep.include({ status: 'error', message: err.message })
      expect(failureOf(guess)).to.deep.eq({ message: err.message, response: err.response })
    })

    it('is replaced by a newer failure, not stacked', async () => {
      const { act, read, id } = await withHeld()
      await act({ kind: 'record_botting', botting: failed(id, 'dumdum', 'clueing', err) })
      await act({ kind: 'record_botting', botting: failed(id, 'dumdum', 'clueing', { ...err, message: 'Still no connection.' }) })
      const { guess } = firstOf(await read())
      expect(guess).to.deep.include({ text: 'Leon' })
      expect(failureOf(guess)?.message).to.eq('Still no connection.')
    })

    it('is cleared by any success', async () => {
      const { act, read, id } = await withHeld()
      await act({ kind: 'record_botting', botting: failed(id, 'dumdum', 'clueing', err) })
      await act({ kind: 'record_botting', botting: guessed(id, 'Lyon') })
      expect(firstOf(await read()).guess).to.deep.include({ text: 'Lyon', last_err: null })
    })

    it('survives the text being edited, which only marks the extraction stale', async () => {
      const { act, read, id } = await withHeld()
      await act({ kind: 'record_botting', botting: failed(id, 'numnum', 'clueing', err) })
      await act({ kind: 'edit_question', question_id: id, patch: { clueing: 'Reworded' } })
      const { clueing_ishes } = firstOf(await read())
      expect(clueing_ishes).to.deep.include({ stale: true })
      expect(failureOf(clueing_ishes)?.message).to.eq(err.message)
    })

    it('is refused while the quiz is locked', async () => {
      const { act, read } = await seed(lockedAll(huntOf(['1', 'a'])))
      const asked = firstOf(await read())
      await expectRefusal(act({ kind: 'record_botting', botting: failed(asked._id, 'dumdum', 'clueing', err) }), 'quizLocked')
      expect(firstOf(await read()).guess).to.eq(null)
    })

    it('is what a combined run leaves on a text it left out, beside the value that cell had', async () => {
      const { act, read, id } = await withHeld()
      await act({
        kind: 'apply_bulk_ishes', run: { approx_tokens: 1, text_count: 1, updated_at: 9 },
        bottings: [failed(id, 'numnum', 'clueing', err)],
      })
      const { clueing_ishes } = firstOf(await read())
      expect(clueing_ishes).to.deep.include({ status: 'done', items })
      expect(failureOf(clueing_ishes)?.message).to.eq(err.message)
    })
  })

  describe('apply_bulk_ishes', () => {
    it('lands each text\'s extraction in its cell, and keeps what the run cost', async () => {
      const { act, read } = await seed(huntOf(['1', 'a'], ['2', 'b']))
      const [first, second] = openOf(await read()).questions
      const run = { approx_tokens: 4200, text_count: 2, updated_at: 9 }
      await act({
        kind: 'apply_bulk_ishes', run,
        bottings: [found(present(first)._id, 1), found(present(second)._id, 2, 'hint')],
      })
      const after = openOf(await read())
      expect(after.questions.map((question) => [question.clueing_ishes?.status ?? null, question.hint_ishes?.status ?? null])).to.deep.eq([['done', null], [null, 'done']])
      expect(after.bulk_ishes_last).to.deep.eq(run)
    })
  })

  /** A question with an extraction for each text named */
  const extractedFrom = async (...textkinds: ('clueing' | 'hint')[]) => {
    const seeded = await seed(huntOf(['1', 'a']))
    const { _id: id } = firstOf(await seeded.read())
    for (const textkind of textkinds) { await seeded.act({ kind: 'record_botting', botting: botted(id, { textkind }) }) }
    return { ...seeded, id }
  }

  describe('staleness', () => {
    it('marks the clueing extraction stale when the clueing is edited', async () => {
      const { act, read, id } = await extractedFrom('clueing')
      await act({ kind: 'edit_question', question_id: id, patch: { clueing: 'Reworded' } })
      expect(staleOf(await firstClueingIshes(read))).to.eq(true)
    })

    it('leaves the extraction visible rather than throwing it away', async () => {
      const { act, read } = await seed(huntOf(['1', 'a']))
      const { _id: id } = firstOf(await read())
      await act({ kind: 'record_botting', botting: found(id, 300) })
      await act({ kind: 'edit_question', question_id: id, patch: { clueing: 'Reworded' } })
      const { clueing_ishes } = firstOf(await read())
      expect(clueing_ishes?.status === 'done' && clueing_ishes.items).to.have.length(1)
    })

    it('marks only the hint extraction when only the hint is edited', async () => {
      const { act, read, id } = await extractedFrom('clueing', 'hint')
      await act({ kind: 'edit_question', question_id: id, patch: { hint: 'Rewritten' } })
      const question = firstOf(await read())
      expect([staleOf(question.hint_ishes), staleOf(question.clueing_ishes)]).to.deep.eq([true, false])
    })

    it('leaves an extraction alone when the edit did not change the text', async () => {
      const { act, read, id } = await extractedFrom('clueing')
      await act({ kind: 'edit_question', question_id: id, patch: { clueing: '' } })
      expect(staleOf(await firstClueingIshes(read))).to.eq(false)
    })

    it('leaves an extraction alone when some other field is edited', async () => {
      const { act, read, id } = await extractedFrom('clueing')
      await act({ kind: 'edit_question', question_id: id, patch: { notes: 'later' } })
      expect(staleOf(await firstClueingIshes(read))).to.eq(false)
    })

    it('comes back fresh when the text is edited back to what was asked', async () => {
      const { act, read, id } = await extractedFrom('clueing')
      await act({ kind: 'edit_question', question_id: id, patch: { clueing: 'Reworded' } })
      await act({ kind: 'edit_question', question_id: id, patch: { clueing: '' } })
      expect(staleOf(await firstClueingIshes(read))).to.eq(false)
    })
  })

  describe('new_quiz', () => {
    it('adds a quiz to the open quiz\'s realm, leaving the open quiz as it was', async () => {
      const { act, read } = await seed(huntOf(['1', 'a']))
      const ante = await read()
      await act({ kind: 'new_quiz' })
      const after = await read()
      expect(after.quizzes).to.have.length(2)
      expect(openOf(after)).to.deep.eq(openOf(ante))
    })

    it('starts the new quiz with the same blank questions a fresh hunt has', async () => {
      const { act, read } = await seed(huntOf(['1', 'a']))
      await act({ kind: 'new_quiz' })
      expect(newestOf(await read()).questions).to.have.length(BlankQuestionQty)
    })

    it('works from a locked quiz', async () => {
      const { act, read } = await seed(huntTitled(['one'], 0))
      await act({ kind: 'new_quiz' })
      const { quizzes } = await read()
      expect(quizzes).to.have.length(2)
    })

    it('starts the new quiz with the standard columns, for the expressions the hunt still has', async () => {
      const whole = await seed(Hunt.blank())
      await whole.act({ kind: 'new_quiz' })
      expect([newestOf(await whole.read()).widgets.length, newestOf(await whole.read()).columns.length]).to.deep.eq([11, 21])
      const blank = Hunt.blank()
      const fewer = await seed({ ...blank, expressions: blank.expressions.filter((expression) => expression.label !== 'hint_full') })
      await fewer.act({ kind: 'new_quiz' })
      expect([newestOf(await fewer.read()).widgets.length, newestOf(await fewer.read()).columns.length]).to.deep.eq([10, 20])
    })

    it('keeps the hunt\'s expressions', async () => {
      const { act, read } = await seed(Hunt.blank())
      const ante = await read()
      await act({ kind: 'new_quiz' })
      const { expressions } = await read()
      expect(expressions).to.deep.eq(ante.expressions)
    })

    it('starts the new quiz under the label it is given', async () => {
      const { act, read } = await seed(huntOf(['1', 'a']))
      await act({ kind: 'new_quiz', label: 'princes' })
      expect(newestOf(await read()).label).to.eq('princes')
    })

    it('refuses a label a quiz already answers to, rather than making a second quiz at one address', async () => {
      const { act, read } = await seed(huntOf(['1', 'a']))
      await act({ kind: 'new_quiz', label: 'princes' })
      const ante = await read()
      await expectRefusal(act({ kind: 'new_quiz', label: 'princes' }), 'labelTaken')
      expect(await read()).to.deep.eq(ante)
    })

    it('counts an overriding label as taken', async () => {
      const { act, read } = await seed(huntOf(['1', 'a']))
      await act({ kind: 'relabel_quiz', label: 'leon' })
      const ante = await read()
      await expectRefusal(act({ kind: 'new_quiz', label: 'leon' }), 'labelTaken')
      expect(await read()).to.deep.eq(ante)
    })
  })

  describe('delete_quiz', () => {
    it('removes the quiz and everything it held', async () => {
      const { tt, act, read } = await seed(huntTitled(['one', 'two', 'three']), 1)
      const doomed = quizNamed(await read(), 'two')._id
      const asked = present(quizNamed(await read(), 'two').questions[0])
      await act({ kind: 'record_botting', botting: guessed(asked._id, 'gone') })
      await act({ kind: 'delete_quiz', quiz_id: doomed })
      const after = await read()
      expect(after.quizzes.map((quiz) => quiz.title)).to.deep.eq(['one', 'three'])
      const [questions, bottings] = await tt.run(async (ctx) => [await ctx.db.query('questions').collect(), await ctx.db.query('bottings').collect()])
      expect(questions.filter((question) => question.quiz_id === doomed)).to.have.length(0)
      expect(bottings).to.have.length(0)
    })

    it('takes the quiz\'s reviews and their reviewings with it', async () => {
      const { tt, act, asAlice, quiz_id, first } = await reviewed(huntTitled(['one', 'two']))
      await asAlice({ kind: 'set_reviewing', quiz_id, question_id: first, patch: { get_rate: 10 } })
      await act({ kind: 'delete_quiz', quiz_id })
      const [reviews, reviewings] = await tt.run(async (ctx) => [await ctx.db.query('reviews').collect(), await ctx.db.query('reviewings').collect()])
      expect([reviews, reviewings]).to.deep.eq([[], []])
    })

    it('refuses to delete the realm\'s last quiz', async () => {
      const { act, read } = await seed(huntOf(['1', 'a']))
      const ante = await read()
      await expectRefusal(act({ kind: 'delete_quiz', quiz_id: openOf(ante)._id }), 'lastQuiz')
      expect(await read()).to.deep.eq(ante)
    })

    it('leaves the open quiz alone when some other quiz goes', async () => {
      const { act, read } = await seed(huntTitled(['one', 'two']), 0)
      await act({ kind: 'delete_quiz', quiz_id: quizNamed(await read(), 'two')._id })
      expect(openOf(await read()).title).to.eq('one')
    })

    it("refuses a quiz of another hunt, as not the actor's to change", async () => {
      const mine = await seed(huntTitled(['one', 'two']), 0)
      const theirs = await seed(huntTitled(['three', 'four']), 0)
      const ante = await theirs.read()
      await expectRefusal(mine.act({ kind: 'delete_quiz', quiz_id: quizNamed(ante, 'four')._id }), 'notPermitted')
      expect(await theirs.read()).to.deep.eq(ante)
    })

    it("refuses a quiz of another realm of the hunt", async () => {
      const { act, tt, open } = await seed(huntTitled(['one', 'two']), 0)
      const elsewhere = await tt.run(async (ctx) => {
        const realm_id = await ctx.db.insert('realms', { hunt_id: open.hunt_id, label: 'away', title: '', position: 1 })
        return await ctx.db.insert('quizzes', { realm_id, title: '', label: 'far_quiz', forced_label: null, smiths_note: '', version: 'main', locked: false, last_sortkey: null, bulk_ishes_last: null, row_ordering: [] })
      })
      await expectRefusal(act({ kind: 'delete_quiz', quiz_id: elsewhere }), 'notInRealm')
      expect(await tt.run(async (ctx) => await ctx.db.get('quizzes', elsewhere))).to.not.eq(null)
    })
  })

  describe('set_lock', () => {
    it('freezes a quiz', async () => {
      const { act, read } = await seed(huntOf(['1', 'a']))
      await act({ kind: 'set_lock', quiz_id: openOf(await read())._id, locked: true })
      expect(openOf(await read()).locked).to.eq(true)
    })

    it('unfreezes one, from inside the lock', async () => {
      const { act, read } = await seed(huntOf(['1', 'a']))
      const quiz_id = openOf(await read())._id
      await act({ kind: 'set_lock', quiz_id, locked: true })
      await act({ kind: 'set_lock', quiz_id, locked: false })
      expect(openOf(await read()).locked).to.eq(false)
    })

    it('leaves the quiz exactly as it was', async () => {
      const { act, read } = await seed(huntOf(['1', 'a'], ['2', 'b']))
      const ante = await read()
      await act({ kind: 'set_lock', quiz_id: openOf(ante)._id, locked: true })
      await act({ kind: 'set_lock', quiz_id: openOf(ante)._id, locked: false })
      expect(openOf(await read()).questions).to.deep.eq(openOf(ante).questions)
    })
  })

  describe('open_review', () => {
    it('opens an empty review for the acting ident', async () => {
      const { act, read, tt, join } = await seed(huntOf(['1', 'a']))
      const { browser_key, ident_id } = await join('alice_reviews', 'reviewer')
      const quiz_id = openOf(await read())._id
      await act({ kind: 'open_review', quiz_id }, browser_key)
      const reviews = await reviewsIn(tt, quiz_id)
      expect(reviews.map((review) => [review.ident_id, review.overall, review.phase])).to.deep.eq([[ident_id, '', 'empty']])
    })

    it('is idempotent: opening it again writes nothing new', async () => {
      const { act, read, tt, join } = await seed(huntOf(['1', 'a']))
      const { browser_key } = await join('alice_reviews', 'reviewer')
      const quiz_id = openOf(await read())._id
      await act({ kind: 'open_review', quiz_id }, browser_key)
      await act({ kind: 'open_review', quiz_id }, browser_key)
      expect(await reviewsIn(tt, quiz_id)).to.have.length(1)
    })

    it('gives each ident its own review of the same quiz', async () => {
      const { act, read, tt, join } = await seed(huntOf(['1', 'a']))
      const quiz_id = openOf(await read())._id
      const [alice, bob] = [await join('alice_reviews', 'reviewer'), await join('bob_reviews', 'reviewer')]
      await act({ kind: 'open_review', quiz_id }, alice.browser_key)
      await act({ kind: 'open_review', quiz_id }, bob.browser_key)
      const reviews = await reviewsIn(tt, quiz_id)
      expect(reviews.map((review) => review.ident_id)).to.deep.eq([alice.ident_id, bob.ident_id])
    })

    it('works on a locked quiz, since reviewing one is the point', async () => {
      const { act, read, tt, join } = await seed(openHunt(true))
      const { browser_key } = await join('alice_reviews', 'reviewer')
      const quiz_id = openOf(await read())._id
      await act({ kind: 'open_review', quiz_id }, browser_key)
      expect(await reviewsIn(tt, quiz_id)).to.have.length(1)
    })

    it('refuses a browser that has not said who it is, writing nothing', async () => {
      const { act, read, tt } = await seed(huntOf(['1', 'a']))
      const quiz_id = openOf(await read())._id
      await expectRefusal(act({ kind: 'open_review', quiz_id }, mintId()), 'notIdentified')
      expect(await reviewsIn(tt, quiz_id)).to.deep.eq([])
    })

    it('reviews as the ident the browser took on last', async () => {
      const { act, read, tt, join } = await seed(huntOf(['1', 'a']))
      const { browser_key } = await join('alice_reviews', 'reviewer')
      const bob = await join('bob_reviews', 'reviewer')
      await tt.mutation(api.idents.performAccount, { action: { kind: 'assume_ident', label: 'bob_reviews', title: '' }, browser_key })
      const quiz_id = openOf(await read())._id
      await act({ kind: 'open_review', quiz_id }, browser_key)
      const reviews = await reviewsIn(tt, quiz_id)
      expect(reviews.map((review) => review.ident_id)).to.deep.eq([bob.ident_id])
    })
  })

  describe('set_overall', () => {
    it('writes the note and moves an empty review to draft', async () => {
      const { act, read, tt, join } = await seed(huntOf(['1', 'a']))
      const { browser_key } = await join('alice_reviews', 'reviewer')
      const quiz_id = openOf(await read())._id
      await act({ kind: 'open_review', quiz_id }, browser_key)
      await act({ kind: 'set_overall', quiz_id, overall: 'Went well.' }, browser_key)
      const [review] = await reviewsIn(tt, quiz_id)
      expect([review?.overall, review?.phase]).to.deep.eq(['Went well.', 'draft'])
    })

    it('leaves a shared review shared', async () => {
      const { act, read, tt, join } = await seed(huntOf(['1', 'a']))
      const { browser_key } = await join('alice_reviews', 'reviewer')
      const quiz_id = openOf(await read())._id
      await act({ kind: 'open_review', quiz_id }, browser_key)
      await act({ kind: 'set_review_phase', quiz_id, phase: 'shared' }, browser_key)
      await act({ kind: 'set_overall', quiz_id, overall: 'One more thought.' }, browser_key)
      const [review] = await reviewsIn(tt, quiz_id)
      expect([review?.overall, review?.phase]).to.deep.eq(['One more thought.', 'shared'])
    })

    it('refuses when the review has not been opened', async () => {
      const { act, read, tt, join } = await seed(huntOf(['1', 'a']))
      const { browser_key } = await join('alice_reviews', 'reviewer')
      const quiz_id = openOf(await read())._id
      await expectRefusal(act({ kind: 'set_overall', quiz_id, overall: 'Too soon.' }, browser_key), 'reviewNotOpened')
      expect(await reviewsIn(tt, quiz_id)).to.deep.eq([])
    })
  })

  describe('set_review_phase', () => {
    it('moves a review between draft and shared, both ways', async () => {
      const { act, read, tt, join } = await seed(huntOf(['1', 'a']))
      const { browser_key } = await join('alice_reviews', 'reviewer')
      const quiz_id = openOf(await read())._id
      await act({ kind: 'open_review', quiz_id }, browser_key)
      await act({ kind: 'set_review_phase', quiz_id, phase: 'shared' }, browser_key)
      const [shared] = await reviewsIn(tt, quiz_id)
      expect(shared?.phase).to.eq('shared')
      await act({ kind: 'set_review_phase', quiz_id, phase: 'draft' }, browser_key)
      const [withdrawn] = await reviewsIn(tt, quiz_id)
      expect(withdrawn?.phase).to.eq('draft')
    })

    it('refuses when the review has not been opened', async () => {
      const { act, read, tt, join } = await seed(huntOf(['1', 'a']))
      const { browser_key } = await join('alice_reviews', 'reviewer')
      const quiz_id = openOf(await read())._id
      await expectRefusal(act({ kind: 'set_review_phase', quiz_id, phase: 'shared' }, browser_key), 'reviewNotOpened')
      expect(await reviewsIn(tt, quiz_id)).to.deep.eq([])
    })
  })

  describe('set_reviewing', () => {
    it('makes the reviewing the first time, holding only what the patch says', async () => {
      const { tt, asAlice, quiz_id, first } = await reviewed()
      await asAlice({ kind: 'set_reviewing', quiz_id, question_id: first, patch: { get_rate: 40 } })
      expect(await reviewingsIn(tt)).to.deep.eq([{ ...Unsaid, question_id: first, get_rate: 40 }])
    })

    it('revises it after, leaving alone what a patch leaves out', async () => {
      const { tt, asAlice, quiz_id, first } = await reviewed()
      await asAlice({ kind: 'set_reviewing', quiz_id, question_id: first, patch: { get_rate: 40, guesses: 'Hamlet?' } })
      await asAlice({ kind: 'set_reviewing', quiz_id, question_id: first, patch: { comments: 'Fair.', keep_it: true } })
      expect(await reviewingsIn(tt)).to.deep.eq([{ ...Unsaid, question_id: first, get_rate: 40, guesses: 'Hamlet?', comments: 'Fair.', keep_it: true }])
    })

    it('clears a get rate or minutes given null', async () => {
      const { tt, asAlice, quiz_id, first } = await reviewed()
      await asAlice({ kind: 'set_reviewing', quiz_id, question_id: first, patch: { get_rate: 40, minutes: 2.5 } })
      await asAlice({ kind: 'set_reviewing', quiz_id, question_id: first, patch: { get_rate: null, minutes: null } })
      expect(await reviewingsIn(tt)).to.deep.eq([{ ...Unsaid, question_id: first }])
    })

    it('keeps one reviewing per question', async () => {
      const { tt, asAlice, quiz_id, first, second } = await reviewed()
      await asAlice({ kind: 'set_reviewing', quiz_id, question_id: second, patch: { minutes: 3 } })
      await asAlice({ kind: 'set_reviewing', quiz_id, question_id: first, patch: { minutes: 1 } })
      await asAlice({ kind: 'set_reviewing', quiz_id, question_id: second, patch: { minutes: 4 } })
      expect(await reviewingsIn(tt)).to.deep.eq([{ ...Unsaid, question_id: second, minutes: 4 }, { ...Unsaid, question_id: first, minutes: 1 }])
    })

    it('keeps each reviewer\'s verdicts apart', async () => {
      const { tt, asAlice, act, quiz_id, first, join } = await reviewed()
      const bob = await join('bob_reviews', 'reviewer')
      await act({ kind: 'open_review', quiz_id }, bob.browser_key)
      await asAlice({ kind: 'set_reviewing', quiz_id, question_id: first, patch: { get_rate: 10 } })
      await act({ kind: 'set_reviewing', quiz_id, question_id: first, patch: { get_rate: 90 } }, bob.browser_key)
      const reviewings = await tt.run(async (ctx) => await ctx.db.query('reviewings').collect())
      const reviews = await reviewsIn(tt, quiz_id)
      const rateBy = new Map(reviewings.map((reviewing) => [reviews.find((review) => review._id === reviewing.review_id)?.ident_id, reviewing.get_rate]))
      expect([rateBy.get(reviews[0]?.ident_id), rateBy.get(reviews[1]?.ident_id)]).to.deep.eq([10, 90])
    })

    it('moves an empty review to draft', async () => {
      const { tt, asAlice, quiz_id, first } = await reviewed()
      await asAlice({ kind: 'set_reviewing', quiz_id, question_id: first, patch: { keep_it: true } })
      const [review] = await reviewsIn(tt, quiz_id)
      expect(review?.phase).to.eq('draft')
    })

    it('leaves a shared review shared', async () => {
      const { tt, asAlice, quiz_id, first } = await reviewed()
      await asAlice({ kind: 'set_review_phase', quiz_id, phase: 'shared' })
      await asAlice({ kind: 'set_reviewing', quiz_id, question_id: first, patch: { keep_it: true } })
      const [review] = await reviewsIn(tt, quiz_id)
      expect(review?.phase).to.eq('shared')
    })

    it('works on a locked quiz, since reviewing one is the point', async () => {
      const { tt, asAlice, quiz_id, first } = await reviewed(openHunt(true))
      await asAlice({ kind: 'set_reviewing', quiz_id, question_id: first, patch: { needs_fact_check: true } })
      expect(await reviewingsIn(tt)).to.deep.eq([{ ...Unsaid, question_id: first, needs_fact_check: true }])
    })

    it('lowers a meh when the question is picked top, and a top when it is picked meh', async () => {
      const { tt, asAlice, quiz_id, first } = await reviewed()
      await asAlice({ kind: 'set_reviewing', quiz_id, question_id: first, patch: { elimination_candidate: true } })
      await asAlice({ kind: 'set_reviewing', quiz_id, question_id: first, patch: { keep_it: true } })
      expect(await reviewingsIn(tt)).to.deep.eq([{ ...Unsaid, question_id: first, keep_it: true }])
      await asAlice({ kind: 'set_reviewing', quiz_id, question_id: first, patch: { elimination_candidate: true } })
      expect(await reviewingsIn(tt)).to.deep.eq([{ ...Unsaid, question_id: first, elimination_candidate: true }])
    })

    const Picks = [
      ['keep_it',               'topsFull', 'a fourth top pick'],
      ['elimination_candidate', 'mehsFull', 'a fourth meh pick'],
    ] as const
    for (const [flag, failurekind, describes] of Picks) {
      it(`refuses ${describes}, writing nothing`, async () => {
        const hunt = huntOf(['1', 'a'], ['2', 'b'], ['3', 'c'], ['4', 'd'])
        const { tt, asAlice, quiz_id, read } = await reviewed(hunt)
        const question_ids = questionIdsOf(await read())
        for (const question_id of question_ids.slice(0, PA.PicksPerReview.max)) {
          await asAlice({ kind: 'set_reviewing', quiz_id, question_id, patch: { [flag]: true } })
        }
        const [ante, last] = [await reviewingsIn(tt), present(question_ids.at(-1))]
        await expectRefusal(asAlice({ kind: 'set_reviewing', quiz_id, question_id: last, patch: { [flag]: true } }), failurekind)
        expect(await reviewingsIn(tt)).to.deep.eq(ante)
      })

      it(`takes ${describes} once another is lowered, and a re-raise of one already picked`, async () => {
        const hunt = huntOf(['1', 'a'], ['2', 'b'], ['3', 'c'], ['4', 'd'])
        const { tt, asAlice, quiz_id, read } = await reviewed(hunt)
        const question_ids = questionIdsOf(await read())
        const [picked, last] = [question_ids.slice(0, PA.PicksPerReview.max), present(question_ids.at(-1))]
        for (const question_id of picked) {
          await asAlice({ kind: 'set_reviewing', quiz_id, question_id, patch: { [flag]: true } })
        }
        await asAlice({ kind: 'set_reviewing', quiz_id, question_id: present(picked[0]), patch: { [flag]: true } })
        await asAlice({ kind: 'set_reviewing', quiz_id, question_id: present(picked[0]), patch: { [flag]: false } })
        await asAlice({ kind: 'set_reviewing', quiz_id, question_id: last, patch: { [flag]: true } })
        const reviewings = await reviewingsIn(tt)
        const raised = reviewings.filter((reviewing) => reviewing[flag]).map((reviewing) => reviewing.question_id)
        expect(raised).to.deep.eq([...picked.slice(1), last])
      })
    }

    it('counts each reviewer\'s picks apart', async () => {
      const hunt = huntOf(['1', 'a'], ['2', 'b'], ['3', 'c'], ['4', 'd'])
      const { tt, asAlice, act, quiz_id, read, join } = await reviewed(hunt)
      const bob = await join('bob_reviews', 'reviewer')
      await act({ kind: 'open_review', quiz_id }, bob.browser_key)
      const question_ids = questionIdsOf(await read())
      for (const question_id of question_ids.slice(0, PA.PicksPerReview.max)) {
        await asAlice({ kind: 'set_reviewing', quiz_id, question_id, patch: { keep_it: true } })
      }
      await act({ kind: 'set_reviewing', quiz_id, question_id: present(question_ids.at(-1)), patch: { keep_it: true } }, bob.browser_key)
      const reviewings = await reviewingsIn(tt)
      expect(reviewings.filter((reviewing) => reviewing.keep_it)).to.have.lengthOf(PA.PicksPerReview.max + 1)
    })

    it('refuses a patch picking a question both ways', async () => {
      const { tt, asAlice, quiz_id, first } = await reviewed()
      const refusal = await refusalOf(asAlice({ kind: 'set_reviewing', quiz_id, question_id: first, patch: { keep_it: true, elimination_candidate: true } }))
      expect(refusal).to.be.instanceOf(ConvexError)
      expect(await reviewingsIn(tt)).to.deep.eq([])
    })

    it('refuses when the review has not been opened, writing nothing', async () => {
      const { act, read, tt, join } = await seed(huntOf(['1', 'a']))
      const { browser_key } = await join('bob_reviews', 'reviewer')
      const seen = await read()
      const [quiz_id, question_id] = [openOf(seen)._id, firstOf(seen)._id]
      await expectRefusal(act({ kind: 'set_reviewing', quiz_id, question_id, patch: { get_rate: 40 } }, browser_key), 'reviewNotOpened')
      expect(await reviewingsIn(tt)).to.deep.eq([])
    })

    it('refuses a question that is not the quiz\'s, writing nothing', async () => {
      const { tt, asAlice, quiz_id } = await reviewed()
      const elsewhere = await seed(huntOf(['1', 'z']))
      const question_id = firstOf(await elsewhere.read())._id
      await expectRefusal(asAlice({ kind: 'set_reviewing', quiz_id, question_id, patch: { get_rate: 40 } }), 'questionGone')
      expect(await reviewingsIn(tt)).to.deep.eq([])
      const [review] = await reviewsIn(tt, quiz_id)
      expect(review?.phase).to.eq('empty')
    })

    it('refuses a get rate past certain at the door, writing nothing', async () => {
      const { tt, asAlice, quiz_id, first } = await reviewed()
      await expect(asAlice({ kind: 'set_reviewing', quiz_id, question_id: first, patch: { get_rate: 101 } })).rejects.toThrow()
      expect(await reviewingsIn(tt)).to.deep.eq([])
    })

    it('refuses a browser that has not said who it is', async () => {
      const { tt, act, quiz_id, first } = await reviewed()
      await expectRefusal(act({ kind: 'set_reviewing', quiz_id, question_id: first, patch: { get_rate: 40 } }, mintId()), 'notIdentified')
      expect(await reviewingsIn(tt)).to.deep.eq([])
    })
  })

  describe('peek_answer', () => {
    it('records that the answer was seen, making the reviewing if need be, and leaves the review\'s phase alone', async () => {
      const { tt, asAlice, quiz_id, first } = await reviewed()
      await asAlice({ kind: 'peek_answer', quiz_id, question_id: first })
      expect(await reviewingsIn(tt)).to.deep.eq([{ ...Unsaid, question_id: first, peeked: true }])
      const [review] = await reviewsIn(tt, quiz_id)
      expect(review?.phase).to.eq('empty')
    })

    it('marks a reviewing already made, keeping what it says', async () => {
      const { tt, asAlice, quiz_id, first } = await reviewed()
      await asAlice({ kind: 'set_reviewing', quiz_id, question_id: first, patch: { get_rate: 40 } })
      await asAlice({ kind: 'peek_answer', quiz_id, question_id: first })
      expect(await reviewingsIn(tt)).to.deep.eq([{ ...Unsaid, question_id: first, get_rate: 40, peeked: true }])
    })

    it('sets it once: a verdict after keeps it, and peeking again changes nothing', async () => {
      const { tt, asAlice, quiz_id, first } = await reviewed()
      await asAlice({ kind: 'peek_answer', quiz_id, question_id: first })
      await asAlice({ kind: 'set_reviewing', quiz_id, question_id: first, patch: { get_rate: 90 } })
      const ante = await tt.run(async (ctx) => await ctx.db.query('reviewings').collect())
      await asAlice({ kind: 'peek_answer', quiz_id, question_id: first })
      expect(await tt.run(async (ctx) => await ctx.db.query('reviewings').collect())).to.deep.eq(ante)
      expect(await reviewingsIn(tt)).to.deep.eq([{ ...Unsaid, question_id: first, get_rate: 90, peeked: true }])
    })

    it('refuses when the review has not been opened, writing nothing', async () => {
      const { act, read, tt, join } = await seed(huntOf(['1', 'a']))
      const { browser_key } = await join('bob_reviews', 'reviewer')
      const seen = await read()
      const [quiz_id, question_id] = [openOf(seen)._id, firstOf(seen)._id]
      await expectRefusal(act({ kind: 'peek_answer', quiz_id, question_id }, browser_key), 'reviewNotOpened')
      expect(await reviewingsIn(tt)).to.deep.eq([])
    })

    it('refuses a question that is not the quiz\'s', async () => {
      const { tt, asAlice, quiz_id } = await reviewed()
      const elsewhere = await seed(huntOf(['1', 'z']))
      const question_id = firstOf(await elsewhere.read())._id
      await expectRefusal(asAlice({ kind: 'peek_answer', quiz_id, question_id }), 'questionGone')
      expect(await reviewingsIn(tt)).to.deep.eq([])
    })
  })

  describe('import_questions', () => {
    it('revises the question answering to each label, adds one under a label none answers to, and deletes nothing', async () => {
      const { act, read } = await seed(huntOf(['1', 'a'], ['2', 'b']))
      const first = firstOf(await read())
      await act({ kind: 'import_questions', questions: [{ label: first.label, patch: { clueing: 'Imported' } }, { label: 'fresh_one', patch: { title: 'fresh' } }] })
      const after = openOf(await read())
      expect(after.questions.map((question) => [question.title, question.clueing])).to.deep.eq([['a', 'Imported'], ['b', ''], ['fresh', '']])
      expect(after.questions[0]?._id).to.eq(first._id)
    })

    it("adds each question as the open quiz's hunt's", async () => {
      const { act, tt, open } = await seed(huntOf(['1', 'a']))
      await act({ kind: 'import_questions', questions: [{ label: 'fresh_one', patch: {} }] })
      const rows = await tt.run(async (ctx) => await ctx.db.query('questions').collect())
      expect(rows.map((row) => row.hunt_id)).to.deep.eq([open.hunt_id, open.hunt_id])
    })

    it('titles a question it adds from its label, unless the paste says otherwise', async () => {
      const { act, read } = await seed(huntOf(['1', 'a']))
      await act({ kind: 'import_questions', questions: [{ label: 'fresh_one', patch: {} }] })
      expect(titlesOf(await read())).to.deep.eq(['a', 'Fresh One'])
    })

    it('writes a chain by label, to a question of the quiz or one the same import adds, and none to anything else', async () => {
      const { act, read } = await seed(huntOf(['1', 'a'], ['2', 'b']))
      const [aa, bb] = openOf(await read()).questions
      await act({ kind: 'import_questions', questions: [
        { label: present(aa).label, patch: { chains_to: 'fresh_one' } },
        { label: present(bb).label, patch: { chains_to: 'nobody' } },
        { label: 'fresh_one', patch: { chains_to: present(aa).label } },
      ] })
      const after = openOf(await read()).questions
      expect(after.map((question) => question.chains_to)).to.deep.eq([after[2]?._id, null, after[0]?._id])
    })

    it('renumbers Q# by rank afterwards, moving nothing', async () => {
      const { act, read } = await seed(huntOf(['4', 'a'], ['3.3', 'b'], ['1', 'c']))
      const first = firstOf(await read())
      await act({ kind: 'import_questions', questions: [{ label: first.label, patch: { notes: 'touched' } }] })
      expect(qnumsOf(await read())).to.deep.eq(['3', '2', '1'])
      expect(titlesOf(await read())).to.deep.eq(['a', 'b', 'c'])
    })

    it('refuses while the quiz is locked', async () => {
      const { act, read } = await seed(openHunt(true))
      const ante = await read()
      await expectRefusal(act({ kind: 'import_questions', questions: [{ label: 'fresh_one', patch: {} }] }), 'quizLocked')
      expect(await read()).to.deep.eq(ante)
    })
  })
})

/** `tree` with every id blanked, for comparing a tree with the one its rows make up */
function sansIds(tree: HuntT) {
  return {
    ...tree,
    _id:    '',
    realms: tree.realms.map((realm) => ({
      ...realm,
      _id:     '',
      quizzes: realm.quizzes.map((quiz) => ({ ...quiz, _id: '', questions: quiz.questions.map((question) => ({ ...question, _id: '' })) })),
    })),
  }
}

/** A seeded hunt whose open quiz already holds `qty` more rows of `tablename`, inserted straight */
async function crowded(tablename: 'questions' | 'widgets' | 'columns', qty: number) {
  const seeded = await seedHunt(openTester(), huntHolding([Quiz.blank('Quiz one')]))
  const { quiz_id } = seeded.open
  const positions = Array.from({ length: qty }, (_unused, idx) => idx + BlankQuestionQty)
  await seeded.tt.run(async (ctx) => {
    for (const position of positions) {
      if (tablename === 'questions') {
        const question_id = await ctx.db.insert('questions', { hunt_id: seeded.open.hunt_id, quiz_id, label: `q_${String(position)}`, forced_label: null, title: '', qnum: '', clueing: '', hint: '', chains_to: null, full_answer: '', alt_text: '', notes: '' })
        const quiz = present(await ctx.db.get('quizzes', quiz_id))
        await ctx.db.patch('quizzes', quiz_id, { row_ordering: [...quiz.row_ordering, question_id] })
      } else if (tablename === 'widgets') {
        await ctx.db.insert('widgets', { quiz_id, position, label: `w_${String(position)}`, kind: 'expressing', expression_label: 'x', description: '' })
      } else {
        await ctx.db.insert('columns', { quiz_id, position, label: `c_${String(position)}`, title: '', source: 'question.title', width_px: 80 })
      }
    }
  })
  return seeded
}

describe('hunts.perform, at the caps', () => {
  it('refuses a question more than a quiz may hold', async () => {
    const { act, read } = await crowded('questions', 999 - BlankQuestionQty)
    await expectRefusal(act({ kind: 'add_question' }), 'questionsFull')
    expect(openOf(await read()).questions).to.have.lengthOf(999)
  })

  it('refuses an import that would leave a quiz holding more questions than it may', async () => {
    const { act, read } = await crowded('questions', 999 - BlankQuestionQty)
    await expectRefusal(act({ kind: 'import_questions', questions: [{ label: 'one_more', patch: {} }] }), 'questionsFull')
    expect(openOf(await read()).questions).to.have.lengthOf(999)
  })

  it('refuses a widget more than a quiz may hold', async () => {
    const { act, tt, open } = await crowded('widgets', 99)
    await expectRefusal(act({ kind: 'add_widget', widget: { kind: 'botting', label: 'dumdum', bot_label: 'dumdum', textkind: 'clueing' } }), 'widgetsFull')
    const widgets = await tt.run(async (ctx) => await ctx.db.query('widgets').withIndex('by_quiz_id_and_position', (cvx) => cvx.eq('quiz_id', open.quiz_id)).collect())
    expect(widgets).to.have.lengthOf(99)
  })

  it('refuses a column more than a quiz may hold', async () => {
    const { act, tt, open } = await crowded('columns', 99)
    await expectRefusal(act({ kind: 'add_column', column: { label: 'one_more', title: 'One more', source: 'question.qnum', width_px: 80 } }), 'columnsFull')
    const columns = await tt.run(async (ctx) => await ctx.db.query('columns').withIndex('by_quiz_id_and_position', (cvx) => cvx.eq('quiz_id', open.quiz_id)).collect())
    expect(columns).to.have.lengthOf(99)
  })

  it('refuses an expression more than a hunt may hold', async () => {
    const expressions = Array.from({ length: PA.ExpressionsPerHunt.max }, (_unused, idx) => ({ label: `expression_${String(idx)}`, formula: '1' }))
    const { act, read } = await seedHunt(openTester(), huntHolding([Quiz.blank()], expressions.map((dna) => ({ ...dna, owner: 'tq' as const, description: '' }))))
    await expectRefusal(act({ kind: 'add_expression', expression: { label: 'one_more', formula: '2' } }), 'expressionsFull')
    const { expressions: after } = await read()
    expect(after).to.have.lengthOf(PA.ExpressionsPerHunt.max)
  })

  it('refuses a quiz more than a realm may hold', async () => {
    const { act, tt, open } = await seedHunt(openTester(), openHunt())
    await tt.run(async (ctx) => {
      const labels = Array.from({ length: PA.QuizzesPerRealm.max - 1 }, (_unused, idx) => `quiz_${String(idx)}`)
      for (const label of labels) {
        await ctx.db.insert('quizzes', { realm_id: open.realm_id, title: '', label, forced_label: null, smiths_note: '', version: 'main', locked: false, last_sortkey: null, bulk_ishes_last: null, row_ordering: [] })
      }
    })
    await expectRefusal(act({ kind: 'new_quiz', label: 'one_more' }), 'quizzesFull')
    const quizzes = await tt.run(async (ctx) => await quizzesOf(ctx.db, open.realm_id))
    expect(quizzes).to.have.lengthOf(PA.QuizzesPerRealm.max)
  })

  it('refuses a review more than a quiz may hold', async () => {
    const { act, tt, open, join } = await seedHunt(openTester(), openHunt())
    await tt.run(async (ctx) => {
      const reviewers = Array.from({ length: 999 }, (_unused, idx) => `reviewer_${String(idx)}`)
      for (const label of reviewers) {
        const ident_id = await ctx.db.insert('idents', { label, title: 'Reviewer' })
        await ctx.db.insert('reviews', { hunt_id: open.hunt_id, quiz_id: open.quiz_id, ident_id, overall: '', phase: 'empty' })
      }
    })
    const { browser_key } = await join('one_more_reviewer', 'reviewer')
    await expectRefusal(act({ kind: 'open_review', quiz_id: open.quiz_id }, browser_key), 'reviewsFull')
    expect(await reviewsIn(tt, open.quiz_id)).to.have.lengthOf(999)
  })
})

describe('hunts.perform, refusing', () => {
  it('reaches the caller as a refusal the browser reads as its sentence', async () => {
    const { act } = await seedHunt(openTester(), openHunt(true))
    const err = await refusalOf(act({ kind: 'add_question' }))
    expect(noticeOf(err)).to.eq(RefusalNotices.quizLocked)
  })

  it('refuses a row its validator will not take, saying where and why', async () => {
    const { act } = await seedHunt(openTester(), huntOf(['1', 'a']))
    const err = await refusalOf(act({ kind: 'edit_widget', label: 'dumdum', patch: { textkind: 'hint' } }))
    expect(noticeOf(err)).to.include('dumdum is not put a hint')
  })
})

describe('hunts.perform, at the door', () => {
  it('refuses a browser key that is not one, writing nothing', async () => {
    const { tt, open, read } = await seedHunt(openTester(), openHunt())
    const ante = await read()
    await expect(tt.mutation(api.hunts.perform, { open, action: { kind: 'add_question' }, browser_key: 'my_laptop' })).rejects.toThrow(/uuid|UUID/)
    expect(await read()).to.deep.eq(ante)
  })

  it('refuses an action it does not know', async () => {
    const { tt, open } = await seedHunt(openTester(), openHunt())
    const action = { kind: 'burn_it_all' } as never
    await expect(tt.mutation(api.hunts.perform, { open, action, browser_key: crypto.randomUUID() })).rejects.toThrow(/Validator error/)
  })
})

/** Put `ident_id` on the hunt `hunt_id` as `role`, as a smith adding them would */
async function joinHunt(tt: Tester, hunt_id: Id<'hunts'>, ident_id: Id<'idents'>, role: HuntRole) {
  await tt.run(async (ctx) => { await ctx.db.insert('huntings', { hunt_id, ident_id, role }) })
}

describe('hunts.list', () => {
  it('lists the hunts one is on, titled, in the order they were made, with its realms\' quizzes in the order they were made', async () => {
    const tt = openTester()
    const alice = await identified(tt, 'alice_smiths')
    const otter = await seedHunt(tt, { ...huntHolding([Quiz.blank('First'), Quiz.blank('Second')]), label: 'quiet_otter', title: '' })
    const heron = await seedHunt(tt, { ...huntHolding([Quiz.blank('Only')]), label: 'loud_heron', title: 'The Heron Hunt' })
    await joinHunt(tt, heron.open.hunt_id, alice.ident_id, 'smith')
    await joinHunt(tt, otter.open.hunt_id, alice.ident_id, 'reviewer')
    const hunts = await tt.query(api.hunts.list, { browser_key: alice.browser_key })
    expect(hunts.map((hunt) => [hunt.label, hunt.title, hunt.role, hunt.realms.map((realm) => [realm.label, realm.quizzes.map((quiz) => quiz.title)])])).to.deep.eq([
      ['quiet_otter', 'Quiet Otter', 'reviewer', [['home', ['First', 'Second']]]],
      ['loud_heron', 'The Heron Hunt', 'smith', [['home', ['Only']]]],
    ])
  })

  it('leaves out the hunts one is not on', async () => {
    const tt = openTester()
    const alice = await identified(tt, 'alice_smiths')
    const bob = await identified(tt, 'bob_reviews')
    const otter = await seedHunt(tt, { ...huntHolding([Quiz.blank('Mine')]), label: 'quiet_otter' })
    await seedHunt(tt, { ...huntHolding([Quiz.blank('Nobody\'s')]), label: 'loud_heron' })
    await joinHunt(tt, otter.open.hunt_id, alice.ident_id, 'smith')
    const listed = await tt.query(api.hunts.list, { browser_key: alice.browser_key })
    expect(listed.map((hunt) => hunt.label)).to.deep.eq(['quiet_otter'])
    expect(await tt.query(api.hunts.list, { browser_key: bob.browser_key })).to.deep.eq([])
  })

  it('lists the hunts of the ident the browser took on last', async () => {
    const tt = openTester()
    const { browser_key } = await identified(tt, 'alice_smiths')
    const bob = await identified(tt, 'bob_reviews')
    const otter = await seedHunt(tt, { ...huntHolding([Quiz.blank('Bob\'s')]), label: 'quiet_otter' })
    await joinHunt(tt, otter.open.hunt_id, bob.ident_id, 'reviewer')
    await tt.mutation(api.idents.performAccount, { action: { kind: 'assume_ident', label: 'bob_reviews', title: '' }, browser_key })
    const listed = await tt.query(api.hunts.list, { browser_key })
    expect(listed.map((hunt) => hunt.label)).to.deep.eq(['quiet_otter'])
  })

  it('lists nothing for a browser that has not said who it is', async () => {
    const tt = openTester()
    await seedHunt(tt, Hunt.blank('quiet_otter'))
    expect(await tt.query(api.hunts.list, { browser_key: mintId() })).to.deep.eq([])
  })
})

/** The hunt `hunt_label` as the browser `browser_key` is shown it, which must be shown */
async function shown(tt: Tester, hunt_label: string, browser_key: string) {
  const opening = await tt.query(api.hunts.open, { hunt_label, browser_key })
  return present(opening.hunt)
}

describe('hunts.open', () => {
  it('is the hunt answering to a label: its realms\' quizzes as rows, and its expressions with how many widgets work each', async () => {
    const tt = openTester()
    const { act, smith } = await seedHunt(tt, { ...Hunt.blank('quiet_otter'), title: '' })
    await act({ kind: 'new_quiz' })
    const hunt = await shown(tt, 'quiet_otter', smith.browser_key)
    expect([hunt.title, hunt.realms.map((realm) => [realm.title, realm.quizzes.length])]).to.deep.eq(['Quiet Otter', [['Home', 2]]])
    expect(hunt.expressions.find((expression) => expression.label === 'clueing_full')?.usage).to.eq(2)
    expect(hunt.expressions.map((expression) => expression.label)).to.deep.eq(SeedExpressions.map((expression) => expression.label))
  })

  it('counts nought for an expression no widget works', async () => {
    const tt = openTester()
    const { act, smith } = await seedHunt(tt, Hunt.blank('quiet_otter'))
    await act({ kind: 'add_expression', expression: { label: 'shout', formula: '$uppercase(qn.title)' } })
    const hunt = await shown(tt, 'quiet_otter', smith.browser_key)
    expect(hunt.expressions.at(-1)).to.deep.include({ label: 'shout', usage: 0 })
  })

  it('says who is on it, titled, in the order they were put on it', async () => {
    const tt = openTester()
    const { open, smith } = await seedHunt(tt, Hunt.blank('quiet_otter'))
    const bob = await identified(tt, 'bob_reviews')
    const alice = await identified(tt, 'alice_smiths')
    await joinHunt(tt, open.hunt_id, alice.ident_id, 'smith')
    await joinHunt(tt, open.hunt_id, bob.ident_id, 'reviewer')
    const hunt = await shown(tt, 'quiet_otter', bob.browser_key)
    expect(hunt.members.map((member) => [member.label, member.title, member.role, member.ident_id])).to.deep.eq([
      ['seed_smith', 'Seed Smith', 'smith', smith.ident_id],
      ['alice_smiths', 'Alice Smiths', 'smith', alice.ident_id],
      ['bob_reviews', 'Bob Reviews', 'reviewer', bob.ident_id],
    ])
  })

  it("says the role on it of whoever is looking", async () => {
    const tt = openTester()
    const { join } = await seedHunt(tt, Hunt.blank('quiet_otter'))
    const [alice, bob] = [await join('alice_smiths', 'smith'), await join('bob_reviews', 'reviewer')]
    const [aliceSees, bobSees] = [await shown(tt, 'quiet_otter', alice.browser_key), await shown(tt, 'quiet_otter', bob.browser_key)]
    expect([aliceSees.role, bobSees.role]).to.deep.eq(['smith', 'reviewer'])
  })

  it("shows someone not on it only that they are not, and its smiths, who could add them", async () => {
    const tt = openTester()
    const { join } = await seedHunt(tt, Hunt.blank('quiet_otter'))
    await join('alice_smiths', 'smith')
    await join('bob_reviews', 'reviewer')
    const carol = await identified(tt, 'carol_strays')
    const refused = { why: 'notOnHunt', hunt: null, smiths: [{ label: 'seed_smith', title: 'Seed Smith' }, { label: 'alice_smiths', title: 'Alice Smiths' }] }
    expect(await tt.query(api.hunts.open, { hunt_label: 'quiet_otter', browser_key: carol.browser_key })).to.deep.eq(refused)
    expect(await tt.query(api.hunts.open, { hunt_label: 'quiet_otter', browser_key: mintId() })).to.deep.eq(refused)
  })

  it("says so for a label no hunt answers to", async () => {
    const tt = openTester()
    const { smith } = await seedHunt(tt, Hunt.blank('quiet_otter'))
    expect(await tt.query(api.hunts.open, { hunt_label: 'loud_heron', browser_key: smith.browser_key })).to.deep.eq({ why: 'noSuchHunt', hunt: null })
  })
})

describe('hunts.whole', () => {
  it('reads back a hunt exactly as it was written, apart from its ids', async () => {
    const hunt = Hunt.blank()
    const { read } = await seedHunt(openTester(), hunt)
    const { hunt: back } = await read()
    expect(sansIds(back)).to.deep.eq(sansIds(hunt))
  })

  it('is null for a hunt that is not there', async () => {
    const { tt, open, smith } = await seedHunt(openTester(), openHunt())
    await tt.run(async (ctx) => { await ctx.db.delete('hunts', open.hunt_id) })
    expect(await tt.query(api.hunts.whole, { hunt_id: open.hunt_id, browser_key: smith.browser_key })).to.eq(null)
  })

  it("is read whole by anyone on the hunt, and is null, as for one not there, for anyone else", async () => {
    const tt = openTester()
    const { open, join } = await seedHunt(tt, Hunt.blank('quiet_otter'))
    const bob = await join('bob_reviews', 'reviewer')
    const carol = await identified(tt, 'carol_strays')
    const read = await tt.query(api.hunts.whole, { hunt_id: open.hunt_id, browser_key: bob.browser_key })
    expect(read?.label).to.eq('quiet_otter')
    expect(await tt.query(api.hunts.whole, { hunt_id: open.hunt_id, browser_key: carol.browser_key })).to.eq(null)
  })
})
