import { beforeEach, describe, expect, it } from 'vitest'
import * as Z from 'zod'
import { ConvexError } from 'convex/values'
import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'
import { reviewsOf } from '../../convex/reading'
import { noticeOf } from '../../src/lib/refusals'
import { RefusalNotices } from '../../src/lib/notices'
import { SeedExpressions } from '../../src/models/expression'
import { Hunt, type HuntT } from '../../src/models/hunt'
import { BlankQuestionQty, Quiz } from '../../src/models/quiz'
import { defaultLayoutFor } from '../../src/models/layout'
import { Question } from '../../src/models/question'
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

/** A hunt holding the quizzes titled `titles`, blank, the one at `locked_idx` locked */
function huntTitled(titles: string[], locked_idx = -1): HuntT {
  return huntHolding(titles.map((title, idx) => ({ ...Quiz.blank(title), locked: idx === locked_idx })))
}

/** `hunt` with every quiz locked */
function lockedAll(hunt: HuntT): HuntT {
  return { ...hunt, realms: hunt.realms.map((realm) => ({ ...realm, quizzes: realm.quizzes.map((quiz) => ({ ...quiz, locked: true })) })) }
}

const titlesOf  = (seen: Seen) => openOf(seen).questions.map((question) => question.title)
const qnumsOf   = (seen: Seen) => openOf(seen).questions.map((question) => question.qnum)
const firstOf   = (seen: Seen) => present(openOf(seen).questions[0])
const quizNamed = (seen: Seen, title: string) => present(seen.quizzes.find((quiz) => quiz.title === title), title)
const newestOf  = (seen: Seen) => present(seen.quizzes.at(-1), 'the newest quiz')

/** What a cell shows of a failure: when it happened is the row's own time */
function failureOf(cell: { last_err: unknown } | null) {
  return cell && Z.object({ message: Z.string(), response: Z.json() }).nullable().parse(cell.last_err)
}

/** A numnum extraction that found `value`, once */
function found(value: number) {
  return { status: 'done' as const, items: [{ text: String(value), value, kind: 'numeral' as const }], truncated: false, stale: false, updated_at: 9, last_err: null }
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

describe('hunts.perform', () => {
  const Deployment: { tt: Tester } = { tt: openTester() }
  beforeEach(() => { Deployment.tt = openTester() })

  const seed = async (hunt: HuntT, open_idx = 0) => await seedHunt(Deployment.tt, hunt, open_idx)

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
      await act({ kind: 'set_ishes', question_id: present(first)._id, textkind: 'clueing', ishes: found(1) })
      await act({ kind: 'set_ishes', question_id: present(second)._id, textkind: 'clueing', ishes: found(2) })
      await act({ kind: 'delete_questions', question_ids: [present(first)._id] })
      const bottings = await tt.run(async (ctx) => await ctx.db.query('bottings').collect())
      expect(bottings.map((botting) => botting.question_id)).to.deep.eq([present(second)._id])
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

  describe('set_ishes', () => {
    it('stores an extraction against the text it came from', async () => {
      const { act, read } = await seed(huntOf(['1', 'a']))
      await act({
        kind: 'set_ishes', question_id: firstOf(await read())._id, textkind: 'hint',
        ishes: { status: 'done', items: [{ text: '1994', value: 1994, kind: 'numeral' }], truncated: false, stale: false, updated_at: 1, last_err: null },
      })
      const question = firstOf(await read())
      expect(question.hint_ishes).to.deep.include({ status: 'done', items: [{ text: '1994', value: 1994, kind: 'numeral' }], stale: false })
      expect(question.clueing_ishes).to.eq(null)
    })

    it('refuses while the quiz is locked', async () => {
      const { act, read } = await seed(lockedAll(huntOf(['1', 'a'])))
      const asked = firstOf(await read())
      await expectRefusal(act({
        kind: 'set_ishes', question_id: asked._id, textkind: 'clueing',
        ishes: { status: 'done', items: [], truncated: false, stale: false, updated_at: 1, last_err: null },
      }), 'quizLocked')
      expect(firstOf(await read()).clueing_ishes).to.eq(null)
    })
  })

  describe('a failed ask', () => {
    const err = { message: 'A connection hiccup — try again.', response: { ok: false, failurekind: 'connection' }, at: 9 }
    const held = { status: 'done' as const, text: 'Leon', truncated: false, updated_at: 3, last_err: null }
    const items = [{ text: '300', value: 300, kind: 'numeral' as const }]
    const ishesHeld = { status: 'done' as const, items, truncated: false, stale: false, updated_at: 3, last_err: null }

    /** A question already holding a guess and a clueing extraction */
    const withHeld = async () => {
      const seeded = await seed(huntOf(['1', 'a']))
      const { _id: id } = firstOf(await seeded.read())
      await seeded.act({ kind: 'set_guess', question_id: id, guess: held })
      await seeded.act({ kind: 'set_ishes', question_id: id, textkind: 'clueing', ishes: ishesHeld })
      return { ...seeded, id }
    }


    it('leaves a guess as it was and rides along on it as its last_err', async () => {
      const { act, read, id } = await withHeld()
      await act({ kind: 'fail_guess', question_id: id, err })
      const { guess } = firstOf(await read())
      expect(guess).to.deep.include({ status: 'done', text: 'Leon', truncated: false })
      expect(failureOf(guess)).to.deep.eq({ message: err.message, response: err.response })
    })

    it('leaves an extraction\'s items and stale flag exactly as they were', async () => {
      const { act, read, id } = await withHeld()
      await act({ kind: 'fail_ishes', question_id: id, textkind: 'clueing', err })
      const { clueing_ishes } = firstOf(await read())
      expect(clueing_ishes).to.deep.include({ status: 'done', items, stale: false })
      expect(failureOf(clueing_ishes)).to.deep.eq({ message: err.message, response: err.response })
    })

    it('becomes the cell\'s only content when it never had a value', async () => {
      const { act, read } = await seed(huntOf(['1', 'a']))
      await act({ kind: 'fail_guess', question_id: firstOf(await read())._id, err })
      const { guess } = firstOf(await read())
      expect(guess).to.deep.include({ status: 'error', message: err.message })
      expect(failureOf(guess)).to.deep.eq({ message: err.message, response: err.response })
    })

    it('is replaced by a newer failure, not stacked', async () => {
      const { act, read, id } = await withHeld()
      await act({ kind: 'fail_guess', question_id: id, err })
      await act({ kind: 'fail_guess', question_id: id, err: { ...err, message: 'Still no connection.' } })
      const { guess } = firstOf(await read())
      expect(guess).to.deep.include({ text: 'Leon' })
      expect(failureOf(guess)?.message).to.eq('Still no connection.')
    })

    it('is cleared by any success', async () => {
      const { act, read, id } = await withHeld()
      await act({ kind: 'fail_guess', question_id: id, err })
      await act({ kind: 'set_guess', question_id: id, guess: { ...held, text: 'Lyon' } })
      expect(firstOf(await read()).guess).to.deep.include({ text: 'Lyon', last_err: null })
    })

    it('survives the text being edited, which only marks the extraction stale', async () => {
      const { act, read, id } = await withHeld()
      await act({ kind: 'fail_ishes', question_id: id, textkind: 'clueing', err })
      await act({ kind: 'edit_question', question_id: id, patch: { clueing: 'Reworded' } })
      const { clueing_ishes } = firstOf(await read())
      expect(clueing_ishes).to.deep.include({ stale: true })
      expect(failureOf(clueing_ishes)?.message).to.eq(err.message)
    })

    it('is refused while the quiz is locked', async () => {
      const { act, read } = await seed(lockedAll(huntOf(['1', 'a'])))
      const asked = firstOf(await read())
      await expectRefusal(act({ kind: 'fail_guess', question_id: asked._id, err }), 'quizLocked')
      expect(firstOf(await read()).guess).to.eq(null)
    })

    it('is what a combined run leaves on a text it left out, beside the value that cell had', async () => {
      const { act, read, id } = await withHeld()
      await act({
        kind: 'apply_bulk_ishes', run: { approx_tokens: 1, text_count: 1, updated_at: 9 },
        landings: [{ question_id: id, textkind: 'clueing', ishes: null, err }],
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
        landings: [
          { question_id: present(first)._id, textkind: 'clueing', ishes: found(1), err: null },
          { question_id: present(second)._id, textkind: 'hint', ishes: found(2), err: null },
        ],
      })
      const after = openOf(await read())
      expect(after.questions.map((question) => [question.clueing_ishes?.status ?? null, question.hint_ishes?.status ?? null])).to.deep.eq([['done', null], [null, 'done']])
      expect(after.bulk_ishes_last).to.deep.eq(run)
    })
  })

  describe('staleness', () => {
    const extracted = { status: 'done' as const, items: [], truncated: false, stale: false, updated_at: 1, last_err: null }

    /** A question with an extraction for each text named */
    const extractedFrom = async (...textkinds: ('clueing' | 'hint')[]) => {
      const seeded = await seed(huntOf(['1', 'a']))
      const { _id: id } = firstOf(await seeded.read())
      for (const textkind of textkinds) { await seeded.act({ kind: 'set_ishes', question_id: id, textkind, ishes: extracted }) }
      return { ...seeded, id }
    }

    it('marks the clueing extraction stale when the clueing is edited', async () => {
      const { act, read, id } = await extractedFrom('clueing')
      await act({ kind: 'edit_question', question_id: id, patch: { clueing: 'Reworded' } })
      expect(staleOf(await firstClueingIshes(read))).to.eq(true)
    })

    it('leaves the extraction visible rather than throwing it away', async () => {
      const { act, read } = await seed(huntOf(['1', 'a']))
      const { _id: id } = firstOf(await read())
      await act({ kind: 'set_ishes', question_id: id, textkind: 'clueing', ishes: { ...extracted, items: [{ text: '300', value: 300, kind: 'numeral' }] } })
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
      await act({ kind: 'set_guess', question_id: asked._id, guess: { status: 'done', text: 'gone', updated_at: 5 } })
      await act({ kind: 'delete_quiz', quiz_id: doomed })
      const after = await read()
      expect(after.quizzes.map((quiz) => quiz.title)).to.deep.eq(['one', 'three'])
      const [questions, bottings] = await tt.run(async (ctx) => [await ctx.db.query('questions').collect(), await ctx.db.query('bottings').collect()])
      expect(questions.filter((question) => question.quiz_id === doomed)).to.have.length(0)
      expect(bottings).to.have.length(0)
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

    it('refuses a quiz of another realm', async () => {
      const mine = await seed(huntTitled(['one', 'two']), 0)
      const theirs = await seed(huntTitled(['three', 'four']), 0)
      const ante = await theirs.read()
      await expectRefusal(mine.act({ kind: 'delete_quiz', quiz_id: quizNamed(ante, 'four')._id }), 'notInRealm')
      expect(await theirs.read()).to.deep.eq(ante)
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
      const { act, read, tt } = await seed(huntOf(['1', 'a']))
      const { browser_key, ident_id } = await identified(tt, 'alice_reviews')
      const quiz_id = openOf(await read())._id
      await act({ kind: 'open_review', quiz_id }, browser_key)
      const reviews = await reviewsIn(tt, quiz_id)
      expect(reviews.map((review) => [review.ident_id, review.overall, review.phase])).to.deep.eq([[ident_id, '', 'empty']])
    })

    it('is idempotent: opening it again writes nothing new', async () => {
      const { act, read, tt } = await seed(huntOf(['1', 'a']))
      const { browser_key } = await identified(tt, 'alice_reviews')
      const quiz_id = openOf(await read())._id
      await act({ kind: 'open_review', quiz_id }, browser_key)
      await act({ kind: 'open_review', quiz_id }, browser_key)
      expect(await reviewsIn(tt, quiz_id)).to.have.length(1)
    })

    it('gives each ident its own review of the same quiz', async () => {
      const { act, read, tt } = await seed(huntOf(['1', 'a']))
      const quiz_id = openOf(await read())._id
      const [alice, bob] = [await identified(tt, 'alice_reviews'), await identified(tt, 'bob_reviews')]
      await act({ kind: 'open_review', quiz_id }, alice.browser_key)
      await act({ kind: 'open_review', quiz_id }, bob.browser_key)
      const reviews = await reviewsIn(tt, quiz_id)
      expect(reviews.map((review) => review.ident_id)).to.deep.eq([alice.ident_id, bob.ident_id])
    })

    it('works on a locked quiz, since reviewing one is the point', async () => {
      const { act, read, tt } = await seed(openHunt(true))
      const { browser_key } = await identified(tt, 'alice_reviews')
      const quiz_id = openOf(await read())._id
      await act({ kind: 'open_review', quiz_id }, browser_key)
      expect(await reviewsIn(tt, quiz_id)).to.have.length(1)
    })

    it('refuses a browser that has not said who it is, writing nothing', async () => {
      const { act, read, tt } = await seed(huntOf(['1', 'a']))
      const quiz_id = openOf(await read())._id
      await expectRefusal(act({ kind: 'open_review', quiz_id }), 'notIdentified')
      expect(await reviewsIn(tt, quiz_id)).to.deep.eq([])
    })

    it('reviews as the ident the browser took on last', async () => {
      const { act, read, tt } = await seed(huntOf(['1', 'a']))
      const { browser_key } = await identified(tt, 'alice_reviews')
      const bob = await identified(tt, 'bob_reviews')
      await tt.mutation(api.idents.performAccount, { action: { kind: 'assume_ident', label: 'bob_reviews', title: '' }, browser_key })
      const quiz_id = openOf(await read())._id
      await act({ kind: 'open_review', quiz_id }, browser_key)
      const reviews = await reviewsIn(tt, quiz_id)
      expect(reviews.map((review) => review.ident_id)).to.deep.eq([bob.ident_id])
    })
  })

  describe('set_overall', () => {
    it('writes the note and moves an empty review to draft', async () => {
      const { act, read, tt } = await seed(huntOf(['1', 'a']))
      const { browser_key } = await identified(tt, 'alice_reviews')
      const quiz_id = openOf(await read())._id
      await act({ kind: 'open_review', quiz_id }, browser_key)
      await act({ kind: 'set_overall', quiz_id, overall: 'Went well.' }, browser_key)
      const [review] = await reviewsIn(tt, quiz_id)
      expect([review?.overall, review?.phase]).to.deep.eq(['Went well.', 'draft'])
    })

    it('leaves a shared review shared', async () => {
      const { act, read, tt } = await seed(huntOf(['1', 'a']))
      const { browser_key } = await identified(tt, 'alice_reviews')
      const quiz_id = openOf(await read())._id
      await act({ kind: 'open_review', quiz_id }, browser_key)
      await act({ kind: 'set_review_phase', quiz_id, phase: 'shared' }, browser_key)
      await act({ kind: 'set_overall', quiz_id, overall: 'One more thought.' }, browser_key)
      const [review] = await reviewsIn(tt, quiz_id)
      expect([review?.overall, review?.phase]).to.deep.eq(['One more thought.', 'shared'])
    })

    it('refuses when the review has not been opened', async () => {
      const { act, read, tt } = await seed(huntOf(['1', 'a']))
      const { browser_key } = await identified(tt, 'alice_reviews')
      const quiz_id = openOf(await read())._id
      await expectRefusal(act({ kind: 'set_overall', quiz_id, overall: 'Too soon.' }, browser_key), 'reviewNotOpened')
      expect(await reviewsIn(tt, quiz_id)).to.deep.eq([])
    })
  })

  describe('set_review_phase', () => {
    it('moves a review between draft and shared, both ways', async () => {
      const { act, read, tt } = await seed(huntOf(['1', 'a']))
      const { browser_key } = await identified(tt, 'alice_reviews')
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
      const { act, read, tt } = await seed(huntOf(['1', 'a']))
      const { browser_key } = await identified(tt, 'alice_reviews')
      const quiz_id = openOf(await read())._id
      await expectRefusal(act({ kind: 'set_review_phase', quiz_id, phase: 'shared' }, browser_key), 'reviewNotOpened')
      expect(await reviewsIn(tt, quiz_id)).to.deep.eq([])
    })
  })

  describe('replace_open_quiz', () => {
    it('takes a merged quiz whole: fields revised, questions matched by id, new ones added, missing ones gone', async () => {
      const { act, read } = await seed(huntOf(['1', 'a'], ['2', 'b']))
      const quiz = openOf(await read())
      const [first] = quiz.questions
      const merged = { ...quiz, title: 'Merged', questions: [{ ...present(first), clueing: 'Imported' }, { ...Question.blank(), title: 'fresh' }] }
      await act({ kind: 'replace_open_quiz', quiz: merged })
      const after = openOf(await read())
      expect([after.title, ...after.questions.map((question) => [question.title, question.clueing])]).to.deep.eq(['Merged', ['a', 'Imported'], ['fresh', '']])
      expect(after.questions[0]?._id).to.eq(present(first)._id)
    })

    it('records the replies a merged quiz brings, once', async () => {
      const { act, read } = await seed(huntOf(['1', 'a']))
      const quiz = openOf(await read())
      const guess = { status: 'done' as const, text: 'Leon', truncated: false, updated_at: Date.now(), last_err: null }
      const merged = { ...quiz, questions: quiz.questions.map((question) => ({ ...question, guess })) }
      await act({ kind: 'replace_open_quiz', quiz: merged })
      await act({ kind: 'replace_open_quiz', quiz: openOf(await read()) })
      expect(firstOf(await read()).guess).to.deep.include({ text: 'Leon' })
    })

    it('refuses while the quiz is locked', async () => {
      const { act, read } = await seed(openHunt(true))
      const ante = await read()
      await expectRefusal(act({ kind: 'replace_open_quiz', quiz: { ...openOf(ante), title: 'Merged' } }), 'quizLocked')
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
        await ctx.db.insert('questions', { quiz_id, position, label: `q_${String(position)}`, forced_label: null, title: '', qnum: '', clueing: '', hint: '', chains_to: null, full_answer: '', alt_text: '', notes: '' })
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

  it('refuses a widget more than a quiz may hold', async () => {
    const { act, tt, open } = await crowded('widgets', 99)
    await expectRefusal(act({ kind: 'add_widget', widget: { kind: 'botting', label: 'dumdum', bot_label: 'dumdum', textkind: 'clueing' } }), 'widgetsFull')
    const widgets = await tt.run(async (ctx) => await ctx.db.query('widgets').withIndex('by_quiz_id_and_position', (qq) => qq.eq('quiz_id', open.quiz_id)).collect())
    expect(widgets).to.have.lengthOf(99)
  })

  it('refuses a column more than a quiz may hold', async () => {
    const { act, tt, open } = await crowded('columns', 99)
    await expectRefusal(act({ kind: 'add_column', column: { label: 'one_more', title: 'One more', source: 'question.qnum', width_px: 80 } }), 'columnsFull')
    const columns = await tt.run(async (ctx) => await ctx.db.query('columns').withIndex('by_quiz_id_and_position', (qq) => qq.eq('quiz_id', open.quiz_id)).collect())
    expect(columns).to.have.lengthOf(99)
  })

  it('refuses an expression more than a hunt may hold', async () => {
    const expressions = Array.from({ length: 99 }, (_unused, idx) => ({ label: `expression_${String(idx)}`, formula: '1' }))
    const { act, read } = await seedHunt(openTester(), huntHolding([Quiz.blank()], expressions.map((dna) => ({ ...dna, owner: 'tq' as const, description: '' }))))
    await expectRefusal(act({ kind: 'add_expression', expression: { label: 'one_more', formula: '2' } }), 'expressionsFull')
    const { expressions: after } = await read()
    expect(after).to.have.lengthOf(99)
  })

  it('refuses a quiz more than a realm may hold', async () => {
    const { act, read } = await seedHunt(openTester(), huntHolding(Array.from({ length: 99 }, () => Quiz.blank())))
    await expectRefusal(act({ kind: 'new_quiz', label: 'one_more' }), 'quizzesFull')
    const { quizzes } = await read()
    expect(quizzes).to.have.lengthOf(99)
  })

  it('refuses a review more than a quiz may hold', async () => {
    const { act, tt, open } = await seedHunt(openTester(), openHunt())
    await tt.run(async (ctx) => {
      const reviewers = Array.from({ length: 999 }, (_unused, idx) => `reviewer_${String(idx)}`)
      for (const label of reviewers) {
        const ident_id = await ctx.db.insert('idents', { label, title: 'Reviewer' })
        await ctx.db.insert('reviews', { quiz_id: open.quiz_id, ident_id, overall: '', phase: 'empty' })
      }
    })
    const { browser_key } = await identified(tt, 'one_more_reviewer')
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

describe('hunts.list', () => {
  it('lists every hunt, titled, in the order they were made, with its realms\' quizzes in the order they were made', async () => {
    const tt = openTester()
    await seedHunt(tt, { ...huntHolding([Quiz.blank('First'), Quiz.blank('Second')]), label: 'quiet_otter', title: '' })
    await seedHunt(tt, { ...huntHolding([Quiz.blank('Only')]), label: 'loud_heron', title: 'The Heron Hunt' })
    const hunts = await tt.query(api.hunts.list, {})
    expect(hunts.map((hunt) => [hunt.label, hunt.title, hunt.realms.map((realm) => [realm.label, realm.quizzes.map((quiz) => quiz.title)])])).to.deep.eq([
      ['quiet_otter', 'Quiet Otter', [['home', ['First', 'Second']]]],
      ['loud_heron', 'The Heron Hunt', [['home', ['Only']]]],
    ])
  })
})

describe('hunts.open', () => {
  it('is the hunt answering to a label: its realms\' quizzes as rows, and its expressions with how many widgets work each', async () => {
    const tt = openTester()
    const { act } = await seedHunt(tt, { ...Hunt.blank('quiet_otter'), title: '' })
    await act({ kind: 'new_quiz' })
    const hunt = present(await tt.query(api.hunts.open, { hunt_label: 'quiet_otter' }))
    expect([hunt.title, hunt.realms.map((realm) => [realm.title, realm.quizzes.length])]).to.deep.eq(['Quiet Otter', [['Home', 2]]])
    expect(hunt.expressions.find((expression) => expression.label === 'clueing_full')?.usage).to.eq(2)
    expect(hunt.expressions.map((expression) => expression.label)).to.deep.eq(SeedExpressions.map((expression) => expression.label))
  })

  it('counts nought for an expression no widget works', async () => {
    const tt = openTester()
    const { act } = await seedHunt(tt, Hunt.blank('quiet_otter'))
    await act({ kind: 'add_expression', expression: { label: 'shout', formula: '$uppercase(qn.title)' } })
    const hunt = present(await tt.query(api.hunts.open, { hunt_label: 'quiet_otter' }))
    expect(hunt.expressions.at(-1)).to.deep.include({ label: 'shout', usage: 0 })
  })

  it('is null for a label no hunt answers to', async () => {
    const tt = openTester()
    await seedHunt(tt, Hunt.blank('quiet_otter'))
    expect(await tt.query(api.hunts.open, { hunt_label: 'loud_heron' })).to.eq(null)
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
    const { tt, open } = await seedHunt(openTester(), openHunt())
    await tt.run(async (ctx) => { await ctx.db.delete('hunts', open.hunt_id) })
    expect(await tt.query(api.hunts.whole, { hunt_id: open.hunt_id })).to.eq(null)
  })
})
