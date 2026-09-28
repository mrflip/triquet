import { describe, expect, it } from 'vitest'
import * as Exporting from '../../src/lib/exporting'
import * as Importing from '../../src/lib/importing'
import { Hunt } from '../../src/models/hunt'
import { Question } from '../../src/models/question'
import { Quiz, type QuizT } from '../../src/models/quiz'
import { present } from '../support/present'

/** A quiz whose first question, `leon`, chains to its second, `nantes`, held under a forced label */
function chainedQuiz(): QuizT {
  const nantes = { ...Question.blank(), label: 'nantes_gen', forced_label: 'nantes', title: 'Nantes' }
  const leon = { ...Question.blank(), label: 'leon', title: 'Leon', chains_to: nantes._id }
  return { ...Quiz.blank('Princes', 'princes'), questions: [leon, nantes] }
}

/** Every key named `id` anywhere inside `val`, by its path */
function idPaths(val: unknown, path = ''): string[] {
  if (Array.isArray(val)) { return val.flatMap((each, idx) => idPaths(each, `${path}[${String(idx)}]`)) }
  if (val === null || typeof val !== 'object') { return [] }
  const own = Object.hasOwn(val, 'id') ? [`${path}.id`] : []
  const inner = Object.entries(val).flatMap(([key, each]) => idPaths(each, `${path}.${key}`))
  return [...own, ...inner]
}

describe('quizExported', () => {
  it('carries no id at any depth', () => {
    const exported = Exporting.quizExported(chainedQuiz())
    expect(idPaths(exported)).to.deep.eq([])
  })

  it('names a chain by the label in force of the question it points at', () => {
    const [leon, nantes] = Exporting.quizExported(chainedQuiz()).questions
    expect([leon?.chains_to, nantes?.chains_to]).to.deep.eq(['nantes', null])
  })

  it('names a chain to a question the quiz does not hold as none', () => {
    const quiz = chainedQuiz()
    const dangling = { ...quiz, questions: quiz.questions.map((question) => ({ ...question, chains_to: 'long-gone' })) }
    expect(Exporting.quizExported(dangling).questions.map((question) => question.chains_to)).to.deep.eq([null, null])
  })

  it('keeps everything else the quiz holds', () => {
    const quiz = { ...chainedQuiz(), version: 'draft_two', locked: true }
    const exported = Exporting.quizExported(quiz)
    expect(exported).to.deep.include({ title: 'Princes', label: 'princes', version: 'draft_two', locked: true })
    expect(present(exported.questions[1])).to.deep.include({ label: 'nantes_gen', forced_label: 'nantes', title: 'Nantes' })
  })

  it('reads back through Import onto a quiz with the same labels, chains and all', () => {
    const quiz = chainedQuiz()
    const unchained = { ...quiz, questions: quiz.questions.map((question) => ({ ...question, chains_to: null })) }
    const outcome = Importing.importInto(unchained, JSON.stringify(Exporting.quizExported(quiz)))
    const [leon, nantes] = present(outcome.quiz).questions
    expect(leon?.chains_to).to.eq(nantes?._id)
    expect(outcome.log.flatMap((entry) => entry.issues)).to.deep.eq([])
  })
})

describe('huntExported', () => {
  it('is the hunt by label, realm by realm, with its expressions, and carries no id at any depth', () => {
    const hunt = Hunt.blank('deep_lake')
    const exported = Exporting.huntExported(hunt)
    expect(idPaths(exported)).to.deep.eq([])
    expect(exported.label).to.eq('deep_lake')
    expect(exported.realms.map((realm) => [realm.label, realm.quizzes.map((quiz) => quiz.label)])).to.deep.eq([['home', ['deep_lake']]])
    expect(exported.expressions).to.deep.eq(hunt.expressions)
  })
})
