import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import * as Z from 'zod'
import type { PolicyTestApp } from 'jazz-tools/testing'
import { app } from '../../src/db/schema'
import { LocalFirst, loadWorkspace } from '../../src/state/quiz-rows'
import { ServerLookupMillis, ensureWorkspace } from '../../src/state/quiz-actions'
import { SeedExpressions } from '../../src/models/expression'
import { Workspace, openQuizOf, type WorkspaceT } from '../../src/models/workspace'
import { BlankQuestionQty, Quiz } from '../../src/models/quiz'
import { defaultLayoutFor } from '../../src/models/layout'
import { Question } from '../../src/models/question'
import { present } from '../support/present'
import { freshAccount, openTestApp, seedWorkspace, sessionFor } from '../support/jazz'

/** A workspace holding one quiz built from `qnum, title` pairs, open */
function workspaceOf(...pairs: [string, string][]): WorkspaceT {
  const questions = pairs.map(([qnum, title]) => ({ ...Question.blank(), qnum, title }))
  const quiz = { ...Quiz.blank('Quiz one'), ...defaultLayoutFor(SeedExpressions), questions }
  return Workspace.fill({ quizzes: [quiz], active_quiz_id: quiz.id, expressions: [...SeedExpressions] })
}

/** A workspace holding one quiz of blank questions, open */
function openWorkspace(locked = false): WorkspaceT {
  const quiz = { ...Quiz.blank('Quiz one'), locked }
  return Workspace.fill({ quizzes: [quiz], active_quiz_id: quiz.id })
}

/** A workspace holding the quizzes titled `titles`, blank, with the one at `open_idx` open */
function workspaceTitled(titles: string[], open_idx: number, locked_idx = -1): WorkspaceT {
  const quizzes = titles.map((title, idx) => ({ ...Quiz.blank(title), locked: idx === locked_idx }))
  return Workspace.fill({ quizzes, active_quiz_id: present(quizzes[open_idx]).id })
}

const openOf    = (workspace: WorkspaceT) => present(openQuizOf(workspace), 'the open quiz')
const titlesOf  = (workspace: WorkspaceT) => openOf(workspace).questions.map((question) => question.title)
const qnumsOf   = (workspace: WorkspaceT) => openOf(workspace).questions.map((question) => question.qnum)
const firstOf   = (workspace: WorkspaceT) => present(openOf(workspace).questions[0])
const quizNamed = (workspace: WorkspaceT, title: string) => present(workspace.quizzes.find((quiz) => quiz.title === title), title)

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

/** The first question's clueing extraction, as the workspace now holds it */
async function firstClueingIshes(read: () => Promise<WorkspaceT>) {
  return firstOf(await read()).clueing_ishes
}

describe('perform', () => {
  let testApp: PolicyTestApp
  beforeAll(async () => { testApp = await openTestApp() })
  afterAll(async () => { await testApp.shutdown() })

  const seed = async (workspace: WorkspaceT) => await seedWorkspace(testApp, workspace)

  describe('retitle_quiz', () => {
    it('renames the open quiz', async () => {
      const { act, read } = await seed(openWorkspace())
      await act({ kind: 'retitle_quiz', title: 'Quiz two' })
      expect(openOf(await read()).title).to.eq('Quiz two')
    })

    it('accepts an empty title without rewriting it', async () => {
      const { act, read } = await seed(openWorkspace())
      await act({ kind: 'retitle_quiz', title: '' })
      expect(openOf(await read()).title).to.eq('')
    })

    it('refuses while the quiz is locked', async () => {
      const { act, read } = await seed(openWorkspace(true))
      const ante = await read()
      await act({ kind: 'retitle_quiz', title: 'Quiz two' })
      expect(await read()).to.deep.eq(ante)
    })
  })

  describe('relabel_quiz', () => {
    it('overrides the generated label of the open quiz, and leaves the generated one alone', async () => {
      const { act, read } = await seed(openWorkspace())
      const generated = openOf(await read()).label
      await act({ kind: 'relabel_quiz', label: 'leon' })
      expect([openOf(await read()).forced_label, openOf(await read()).label]).to.deep.eq(['leon', generated])
    })

    it('refuses while the quiz is locked', async () => {
      const { act, read } = await seed(openWorkspace(true))
      const ante = await read()
      await act({ kind: 'relabel_quiz', label: 'leon' })
      expect(await read()).to.deep.eq(ante)
    })
  })

  describe('reversion_quiz', () => {
    it('puts the open quiz on another version', async () => {
      const { act, read } = await seed(openWorkspace())
      await act({ kind: 'reversion_quiz', version: 'playtest' })
      expect(openOf(await read()).version).to.eq('playtest')
    })
  })

  describe('add_question', () => {
    it('appends a blank question to the end', async () => {
      const { act, read } = await seed(workspaceOf(['1', 'a'], ['2', 'b']))
      await act({ kind: 'add_question' })
      const after = openOf(await read())
      expect(after.questions.slice(0, 2).map((question) => question.title)).to.deep.eq(['a', 'b'])
      expect(after.questions).to.have.length(3)
      expect(present(after.questions[2]).clueing).to.eq('')
    })

    it('refuses while the quiz is locked', async () => {
      const { act, read } = await seed(openWorkspace(true))
      await act({ kind: 'add_question' })
      expect(openOf(await read()).questions).to.have.length(BlankQuestionQty)
    })
  })

  describe('edit_question', () => {
    it('rewrites only the named question, and only the named fields', async () => {
      const { act, read } = await seed(openWorkspace())
      const target = present(openOf(await read()).questions[1])
      await act({ kind: 'edit_question', question_id: target.id, patch: { clueing: 'Which région?' } })
      const after = openOf(await read())
      expect([after.questions[1]?.clueing, after.questions[1]?.hint, after.questions[0]?.clueing]).to.deep.eq(['Which région?', '', ''])
    })

    it('leaves the quiz alone when the question is not in it', async () => {
      const { act, read } = await seed(openWorkspace())
      const ante = await read()
      await act({ kind: 'edit_question', question_id: 'nobody', patch: { clueing: 'x' } })
      expect(await read()).to.deep.eq(ante)
    })

    it('ignores fields the patch does not mention', async () => {
      const { act, read } = await seed(openWorkspace())
      const ante = await read()
      await act({ kind: 'edit_question', question_id: firstOf(ante).id, patch: {} })
      expect(await read()).to.deep.eq(ante)
    })

    it('refuses text the model rejects rather than storing it', async () => {
      const { act, read } = await seed(openWorkspace())
      const { id } = firstOf(await read())
      await expect(act({ kind: 'edit_question', question_id: id, patch: { title: 'x'.repeat(201) } })).rejects.toThrow(Z.ZodError)
    })

    it('chains to another question, held by that question\'s label', async () => {
      const { act, read } = await seed(workspaceOf(['1', 'a'], ['2', 'b']))
      const [first, second] = openOf(await read()).questions
      await act({ kind: 'edit_question', question_id: present(first).id, patch: { chains_to: present(second).id } })
      expect(firstOf(await read()).chains_to).to.eq(present(second).id)
    })

    it('refuses while the quiz is locked', async () => {
      const { act, read } = await seed(openWorkspace(true))
      const ante = await read()
      await act({ kind: 'edit_question', question_id: firstOf(ante).id, patch: { clueing: 'x' } })
      expect(await read()).to.deep.eq(ante)
    })
  })

  describe('sort_questions', () => {
    it('commits the new order into the quiz rather than draping it over the top', async () => {
      const { act, read } = await seed(workspaceOf(['3', 'cherry'], ['1', 'apple'], ['2', 'banana']))
      await act({ kind: 'sort_questions', sortkey: 'column:title', descending: false })
      expect(titlesOf(await read())).to.deep.eq(['apple', 'banana', 'cherry'])
    })

    it('remembers which column put the quiz in this order', async () => {
      const { act, read } = await seed(workspaceOf(['1', 'a']))
      await act({ kind: 'sort_questions', sortkey: 'column:qnum', descending: false })
      expect(openOf(await read()).last_sortkey).to.eq('column:qnum')
    })

    it('reverses when asked', async () => {
      const { act, read } = await seed(workspaceOf(['3', 'cherry'], ['1', 'apple'], ['2', 'banana']))
      await act({ kind: 'sort_questions', sortkey: 'column:title', descending: true })
      expect(titlesOf(await read())).to.deep.eq(['cherry', 'banana', 'apple'])
    })

    it('sorts by what an expressing works out, with the expressions the workspace holds', async () => {
      const { act, read } = await seed(workspaceOf(['1', 'a'], ['2', 'b'], ['3', 'c']))
      const [first, second, third] = openOf(await read()).questions
      const clueings: [string, string][] = [[present(first).id, 'one two three'], [present(second).id, 'one'], [present(third).id, 'one two']]
      for (const [question_id, clueing] of clueings) { await act({ kind: 'edit_question', question_id, patch: { clueing } }) }
      await act({ kind: 'add_widget', widget: { kind: 'expressing', label: 'words', expression_label: 'clueing_word_count' } })
      await act({ kind: 'add_column', column: { label: 'words', title: 'Words', source: 'words', width_px: 60 } })
      await act({ kind: 'sort_questions', sortkey: 'column:words', descending: false })
      expect(titlesOf(await read())).to.deep.eq(['b', 'c', 'a'])
    })

    it('refuses while the quiz is locked', async () => {
      const locked = workspaceOf(['3', 'cherry'], ['1', 'apple'])
      const { act, read } = await seed({ ...locked, quizzes: locked.quizzes.map((quiz) => ({ ...quiz, locked: true })) })
      await act({ kind: 'sort_questions', sortkey: 'column:title', descending: false })
      expect(titlesOf(await read())).to.deep.eq(['cherry', 'apple'])
    })
  })

  describe('renumber_qnums', () => {
    it('tidies the numbers with no question moving', async () => {
      const { act, read } = await seed(workspaceOf(['4', 'd'], ['3.3', 'c'], ['6', 'f'], ['1', 'a']))
      await act({ kind: 'renumber_qnums' })
      const after = await read()
      expect(qnumsOf(after)).to.deep.eq(['3', '2', '4', '1'])
      expect(titlesOf(after)).to.deep.eq(['d', 'c', 'f', 'a'])
    })

    it('does not claim the quiz is now in Q# order, which would immediately re-sort it', async () => {
      const { act, read } = await seed(workspaceOf(['4', 'd'], ['1', 'a']))
      await act({ kind: 'sort_questions', sortkey: 'column:title', descending: false })
      await act({ kind: 'renumber_qnums' })
      expect(openOf(await read()).last_sortkey).to.eq('column:title')
    })

    it('refuses while the quiz is locked', async () => {
      const locked = workspaceOf(['4', 'd'])
      const { act, read } = await seed({ ...locked, quizzes: locked.quizzes.map((quiz) => ({ ...quiz, locked: true })) })
      await act({ kind: 'renumber_qnums' })
      expect(qnumsOf(await read())).to.deep.eq(['4'])
    })
  })

  describe('move_question', () => {
    it('moves the question and renumbers everything by its new position', async () => {
      const { act, read } = await seed(workspaceOf(['1', 'a'], ['2', 'b'], ['3', 'c']))
      const dragged = present(openOf(await read()).questions[2])
      await act({ kind: 'move_question', question_id: dragged.id, onto_idx: 0 })
      const after = await read()
      expect(titlesOf(after)).to.deep.eq(['c', 'a', 'b'])
      expect(qnumsOf(after)).to.deep.eq(['1', '2', '3'])
    })

    it('adopts a question that had no Q# into the sequence', async () => {
      const { act, read } = await seed(workspaceOf(['1', 'a'], ['', 'b']))
      const dragged = present(openOf(await read()).questions[1])
      await act({ kind: 'move_question', question_id: dragged.id, onto_idx: 0 })
      expect(qnumsOf(await read())).to.deep.eq(['1', '2'])
    })

    it('leaves the quiz in Q# order, which is the only order a drag is offered in', async () => {
      const { act, read } = await seed(workspaceOf(['1', 'a'], ['2', 'b']))
      await act({ kind: 'move_question', question_id: firstOf(await read()).id, onto_idx: 1 })
      expect(openOf(await read()).last_sortkey).to.eq('column:qnum')
    })
  })

  describe('set_chain', () => {
    it('chains one question to another, which the quiz then shows', async () => {
      const { act, read } = await seed(workspaceOf(['1', 'a'], ['2', 'b']))
      const [first, second] = openOf(await read()).questions
      await act({ kind: 'set_chain', question_id: present(first).id, chains_to: present(second).id })
      expect(firstOf(await read()).chains_to).to.eq(present(second).id)
    })

    it('unchains with null', async () => {
      const { act, read } = await seed(workspaceOf(['1', 'a'], ['2', 'b']))
      const [first, second] = openOf(await read()).questions
      await act({ kind: 'set_chain', question_id: present(first).id, chains_to: present(second).id })
      await act({ kind: 'set_chain', question_id: present(first).id, chains_to: null })
      expect(firstOf(await read()).chains_to).to.eq(null)
    })

    it('clears a chain to itself, or to no question of the quiz, rather than keeping it', async () => {
      const { act, read } = await seed(workspaceOf(['1', 'a'], ['2', 'b']))
      const first = firstOf(await read())
      await act({ kind: 'set_chain', question_id: first.id, chains_to: first.id })
      expect(firstOf(await read()).chains_to).to.eq(null)
      await act({ kind: 'set_chain', question_id: first.id, chains_to: 'nowhere' })
      expect(firstOf(await read()).chains_to).to.eq(null)
    })
  })

  describe('sort_by_chain_order', () => {
    it('walks the chains from the lowest Q#, and remembers doing so', async () => {
      const { act, read } = await seed(workspaceOf(['1', 'a'], ['2', 'b'], ['3', 'c']))
      const [first, , third] = openOf(await read()).questions
      await act({ kind: 'set_chain', question_id: present(first).id, chains_to: present(third).id })
      await act({ kind: 'sort_by_chain_order', descending: false })
      const after = await read()
      expect(titlesOf(after)).to.deep.eq(['a', 'c', 'b'])
      expect(openOf(after).last_sortkey).to.eq('chain_order')
    })
  })

  describe('set_ishes', () => {
    it('stores an extraction against the text it came from', async () => {
      const { act, read } = await seed(workspaceOf(['1', 'a']))
      await act({
        kind: 'set_ishes', question_id: firstOf(await read()).id, textkind: 'hint',
        ishes: { status: 'done', items: [{ text: '1994', value: 1994, kind: 'numeral' }], truncated: false, stale: false, updated_at: 1, last_err: null },
      })
      const question = firstOf(await read())
      expect(question.hint_ishes).to.deep.include({ status: 'done', items: [{ text: '1994', value: 1994, kind: 'numeral' }], stale: false })
      expect(question.clueing_ishes).to.eq(null)
    })

    it('refuses while the quiz is locked', async () => {
      const locked = workspaceOf(['1', 'a'])
      const { act, read } = await seed({ ...locked, quizzes: locked.quizzes.map((quiz) => ({ ...quiz, locked: true })) })
      await act({
        kind: 'set_ishes', question_id: firstOf(await read()).id, textkind: 'clueing',
        ishes: { status: 'done', items: [], truncated: false, stale: false, updated_at: 1, last_err: null },
      })
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
      const seeded = await seed(workspaceOf(['1', 'a']))
      const { id } = firstOf(await seeded.read())
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
      const { act, read } = await seed(workspaceOf(['1', 'a']))
      await act({ kind: 'fail_guess', question_id: firstOf(await read()).id, err })
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
      const locked = workspaceOf(['1', 'a'])
      const { act, read } = await seed({ ...locked, quizzes: locked.quizzes.map((quiz) => ({ ...quiz, locked: true })) })
      await act({ kind: 'fail_guess', question_id: firstOf(await read()).id, err })
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
      const { act, read } = await seed(workspaceOf(['1', 'a'], ['2', 'b']))
      const [first, second] = openOf(await read()).questions
      const run = { approx_tokens: 4200, text_count: 2, updated_at: 9 }
      await act({
        kind: 'apply_bulk_ishes', run,
        landings: [
          { question_id: present(first).id, textkind: 'clueing', ishes: found(1), err: null },
          { question_id: present(second).id, textkind: 'hint', ishes: found(2), err: null },
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
      const seeded = await seed(workspaceOf(['1', 'a']))
      const { id } = firstOf(await seeded.read())
      for (const textkind of textkinds) { await seeded.act({ kind: 'set_ishes', question_id: id, textkind, ishes: extracted }) }
      return { ...seeded, id }
    }

    it('marks the clueing extraction stale when the clueing is edited', async () => {
      const { act, read, id } = await extractedFrom('clueing')
      await act({ kind: 'edit_question', question_id: id, patch: { clueing: 'Reworded' } })
      expect(staleOf(await firstClueingIshes(read))).to.eq(true)
    })

    it('leaves the extraction visible rather than throwing it away', async () => {
      const { act, read } = await seed(workspaceOf(['1', 'a']))
      const { id } = firstOf(await read())
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

  describe('open_quiz', () => {
    it('switches to a quiz the workspace holds', async () => {
      const { act, read } = await seed(workspaceTitled(['one', 'two'], 0))
      await act({ kind: 'open_quiz', quiz_id: quizNamed(await read(), 'two').id })
      expect(openOf(await read()).title).to.eq('two')
    })

    it('ignores a quiz the workspace does not hold', async () => {
      const { act, read } = await seed(workspaceOf(['1', 'a']))
      const ante = await read()
      await act({ kind: 'open_quiz', quiz_id: 'gone' })
      expect(await read()).to.deep.eq(ante)
    })

    it('switches away from a locked quiz, because locking must never be a trap', async () => {
      const { act, read } = await seed(workspaceTitled(['one', 'two'], 0, 0))
      await act({ kind: 'open_quiz', quiz_id: quizNamed(await read(), 'two').id })
      expect(openOf(await read()).title).to.eq('two')
    })
  })

  describe('new_quiz', () => {
    it('adds a quiz and opens it', async () => {
      const { act, read } = await seed(workspaceOf(['1', 'a']))
      await act({ kind: 'new_quiz' })
      const after = await read()
      expect(after.quizzes).to.have.length(2)
      expect(after.active_quiz_id).to.eq(after.quizzes[1]?.id)
    })

    it('starts the new quiz with the same blank questions a fresh workspace has', async () => {
      const { act, read } = await seed(workspaceOf(['1', 'a']))
      await act({ kind: 'new_quiz' })
      expect(openOf(await read()).questions).to.have.length(BlankQuestionQty)
    })

    it('works from a locked quiz', async () => {
      const { act, read } = await seed(workspaceTitled(['one'], 0, 0))
      await act({ kind: 'new_quiz' })
      const { quizzes } = await read()
      expect(quizzes).to.have.length(2)
    })

    it('starts the new quiz with the standard columns, for the expressions the workspace still has', async () => {
      const whole = await seed(Workspace.blank())
      await whole.act({ kind: 'new_quiz' })
      expect([openOf(await whole.read()).widgets.length, openOf(await whole.read()).columns.length]).to.deep.eq([11, 21])
      const blank = Workspace.blank()
      const fewer = await seed({ ...blank, expressions: blank.expressions.filter((expression) => expression.label !== 'hint_full') })
      await fewer.act({ kind: 'new_quiz' })
      expect([openOf(await fewer.read()).widgets.length, openOf(await fewer.read()).columns.length]).to.deep.eq([10, 20])
    })

    it('keeps the workspace\'s expressions', async () => {
      const { act, read } = await seed(Workspace.blank())
      const ante = await read()
      await act({ kind: 'new_quiz' })
      const { expressions } = await read()
      expect(expressions).to.deep.eq(ante.expressions)
    })

    it('starts the new quiz under the label it is given', async () => {
      const { act, read } = await seed(workspaceOf(['1', 'a']))
      await act({ kind: 'new_quiz', label: 'princes' })
      expect(openOf(await read()).label).to.eq('princes')
    })

    it('refuses a label a quiz already answers to, rather than making a second quiz at one address', async () => {
      const { act, read } = await seed(workspaceOf(['1', 'a']))
      await act({ kind: 'new_quiz', label: 'princes' })
      const ante = await read()
      await act({ kind: 'new_quiz', label: 'princes' })
      expect(await read()).to.deep.eq(ante)
    })

    it('counts an overriding label as taken', async () => {
      const { act, read } = await seed(workspaceOf(['1', 'a']))
      await act({ kind: 'relabel_quiz', label: 'leon' })
      const ante = await read()
      await act({ kind: 'new_quiz', label: 'leon' })
      expect(await read()).to.deep.eq(ante)
    })
  })

  describe('delete_quiz', () => {
    it('removes the quiz, everything it held, and opens its neighbour', async () => {
      const { db, act, read } = await seed(workspaceTitled(['one', 'two', 'three'], 1))
      await act({ kind: 'delete_quiz', quiz_id: quizNamed(await read(), 'two').id })
      const after = await read()
      expect(after.quizzes.map((quiz) => quiz.title)).to.deep.eq(['one', 'three'])
      expect(openOf(after).title).to.eq('three')
      expect(await db.all(app.questions, LocalFirst)).to.have.length(2 * BlankQuestionQty)
    })

    it('opens the quiz before it when the last one goes', async () => {
      const { act, read } = await seed(workspaceTitled(['one', 'two'], 1))
      await act({ kind: 'delete_quiz', quiz_id: quizNamed(await read(), 'two').id })
      expect(openOf(await read()).title).to.eq('one')
    })

    it('refuses to delete the last remaining quiz', async () => {
      const { act, read } = await seed(workspaceOf(['1', 'a']))
      const ante = await read()
      await act({ kind: 'delete_quiz', quiz_id: openOf(ante).id })
      expect(await read()).to.deep.eq(ante)
    })

    it('leaves the open quiz alone when some other quiz goes', async () => {
      const { act, read } = await seed(workspaceTitled(['one', 'two'], 0))
      await act({ kind: 'delete_quiz', quiz_id: quizNamed(await read(), 'two').id })
      expect(openOf(await read()).title).to.eq('one')
    })
  })

  describe('set_lock', () => {
    it('freezes a quiz', async () => {
      const { act, read } = await seed(workspaceOf(['1', 'a']))
      await act({ kind: 'set_lock', quiz_id: openOf(await read()).id, locked: true })
      expect(openOf(await read()).locked).to.eq(true)
    })

    it('unfreezes one, from inside the lock', async () => {
      const { act, read } = await seed(workspaceOf(['1', 'a']))
      const quiz_id = openOf(await read()).id
      await act({ kind: 'set_lock', quiz_id, locked: true })
      await act({ kind: 'set_lock', quiz_id, locked: false })
      expect(openOf(await read()).locked).to.eq(false)
    })

    it('leaves the quiz exactly as it was', async () => {
      const { act, read } = await seed(workspaceOf(['1', 'a'], ['2', 'b']))
      const ante = await read()
      await act({ kind: 'set_lock', quiz_id: openOf(ante).id, locked: true })
      await act({ kind: 'set_lock', quiz_id: openOf(ante).id, locked: false })
      expect(openOf(await read()).questions).to.deep.eq(openOf(ante).questions)
    })
  })

  describe('replace_open_quiz', () => {
    it('takes a merged quiz whole: fields revised, questions matched by id, new ones added, missing ones gone', async () => {
      const { act, read } = await seed(workspaceOf(['1', 'a'], ['2', 'b']))
      const quiz = openOf(await read())
      const [first] = quiz.questions
      const merged = { ...quiz, title: 'Merged', questions: [{ ...present(first), clueing: 'Imported' }, { ...Question.blank(), title: 'fresh' }] }
      await act({ kind: 'replace_open_quiz', quiz: merged })
      const after = openOf(await read())
      expect([after.title, ...after.questions.map((question) => [question.title, question.clueing])]).to.deep.eq(['Merged', ['a', 'Imported'], ['fresh', '']])
      expect(after.questions[0]?.id).to.eq(present(first).id)
    })

    it('records the replies a merged quiz brings, once', async () => {
      const { act, read } = await seed(workspaceOf(['1', 'a']))
      const quiz = openOf(await read())
      const guess = { status: 'done' as const, text: 'Leon', truncated: false, updated_at: Date.now(), last_err: null }
      const merged = { ...quiz, questions: quiz.questions.map((question) => ({ ...question, guess })) }
      await act({ kind: 'replace_open_quiz', quiz: merged })
      await act({ kind: 'replace_open_quiz', quiz: openOf(await read()) })
      expect(firstOf(await read()).guess).to.deep.include({ text: 'Leon' })
    })

    it('refuses while the quiz is locked', async () => {
      const { act, read } = await seed(openWorkspace(true))
      const ante = await read()
      await act({ kind: 'replace_open_quiz', quiz: { ...openOf(ante), title: 'Merged' } })
      expect(await read()).to.deep.eq(ante)
    })
  })

  describe('replace_workspace', () => {
    it('takes a workspace wholesale, lock and all', async () => {
      const { act, read } = await seed(openWorkspace())
      const other = openWorkspace(true)
      await act({ kind: 'replace_workspace', workspace: other })
      const after = await read()
      expect(after.quizzes).to.have.length(1)
      expect([openOf(after).title, openOf(after).locked]).to.deep.eq(['Quiz one', true])
    })
  })
})

describe('ensureWorkspace', () => {
  let testApp: PolicyTestApp
  beforeAll(async () => { testApp = await openTestApp() })
  afterAll(async () => { await testApp.shutdown() })

  it('makes a fresh account its workspace: one blank quiz, open, with the standard layout', async () => {
    const { db, account } = freshAccount(testApp)
    const workspace = present(await loadWorkspace(db, await ensureWorkspace(db, account)))
    const blank = Workspace.blank()
    expect([workspace.quizzes.length, openOf(workspace).questions.length, openOf(workspace).columns.length, workspace.expressions.length])
      .to.deep.eq([1, BlankQuestionQty, present(blank.quizzes[0]).columns.length, blank.expressions.length])
  })

  it('finds the workspace an account already has, from any identity of it, rather than making another', async () => {
    const { db, account } = freshAccount(testApp)
    const first = await ensureWorkspace(db, account)
    const elsewhere = testApp.as(sessionFor('the same account, another device', account))
    expect(await ensureWorkspace(elsewhere, account)).to.eq(first)
    expect(await db.all(app.workspaces, LocalFirst)).to.have.length(1)
  })
})

describe('ensureWorkspace, when the server never answers', () => {
  let testApp: PolicyTestApp
  beforeAll(async () => { testApp = await openTestApp() })
  afterAll(async () => { await testApp.shutdown() })

  it('stops waiting, and makes the workspace in this browser', { timeout: ServerLookupMillis + 5000 }, async () => {
    const { db, account } = freshAccount(testApp)
    // A server that cannot be reached, or will not serve this app, leaves a read that asks it
    // hanging for good; everything else about the database works.
    const unanswered = new Proxy(db, {
      get(target, key) {
        const member: unknown = Reflect.get(target, key)
        if (key !== 'all' || typeof member !== 'function') { return typeof member === 'function' ? member.bind(target) as unknown : member }
        return async (...args: unknown[]) => {
          const [, options] = args as [unknown, { tier?: string } | undefined]
          if (options?.tier === 'remote-if-possible') { return await new Promise(() => { /* never answered */ }) }
          return await (member as (...rest: unknown[]) => Promise<unknown>).apply(target, args)
        }
      },
    })
    const workspace_id = await ensureWorkspace(unanswered, account)
    expect(await loadWorkspace(db, workspace_id)).to.not.eq(null)
  })

  it('makes the workspace in this browser when the server cannot be reached at all', async () => {
    const { db, account } = freshAccount(testApp)
    const unreachable = new Proxy(db, {
      get(target, key) {
        const member: unknown = Reflect.get(target, key)
        if (key !== 'all' || typeof member !== 'function') { return typeof member === 'function' ? member.bind(target) as unknown : member }
        return async (...args: unknown[]) => {
          const [, options] = args as [unknown, { tier?: string } | undefined]
          if (options?.tier === 'remote-if-possible') { throw new Error('[object Event]') }
          return await (member as (...rest: unknown[]) => Promise<unknown>).apply(target, args)
        }
      },
    })
    const workspace_id = await ensureWorkspace(unreachable, account)
    expect(await loadWorkspace(db, workspace_id)).to.not.eq(null)
  })
})

describe('ensureWorkspace, asked by several views at once', () => {
  let testApp: PolicyTestApp
  beforeAll(async () => { testApp = await openTestApp() })
  afterAll(async () => { await testApp.shutdown() })

  it('makes one workspace, and hands every one of them its id', async () => {
    const { db, account } = freshAccount(testApp)
    const found = await Promise.all([ensureWorkspace(db, account), ensureWorkspace(db, account), ensureWorkspace(db, account)])
    expect(new Set(found).size).to.eq(1)
    expect(await db.all(app.workspaces, LocalFirst)).to.have.length(1)
  })
})
