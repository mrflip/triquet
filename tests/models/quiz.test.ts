import { describe, expect, it } from 'vitest'
import * as Z from 'zod'
import { BlankQuestionQty, Quiz, QuizValidators } from '../../src/models/quiz'
import { Question } from '../../src/models/question'
import { mintId } from '../../src/lib/ids'
import * as Labelmaker from '../../src/lib/labelmaker'

const quizId = mintId()

describe('Quiz.fill', () => {
  it('defaults every field but the id', () => {
    const quiz = Quiz.fill({ id: quizId })
    expect(quiz).to.deep.include({
      id:              quizId,
      questions:       [],
      locked:          false,
      last_sortkey:    null,
      bulk_ishes_last: null,
      forced_label:    null,
    })
    expect(quiz.label).to.match(/^[a-z]+_[a-z]+$/)
    expect(quiz.title).to.eq(Labelmaker.titleize(quiz.label))
  })

  it('keeps the questions in the order given, because that array IS the order', () => {
    const [one, two, three] = [Question.blank(), Question.blank(), Question.blank()]
    const quiz = Quiz.fill({ id: quizId, questions: [one, two, three].toReversed() })
    expect(quiz.questions.map((question) => question.id)).to.deep.eq([three.id, two.id, one.id])
  })

  it('accepts a chain between two questions in the quiz', () => {
    const [ante, post] = [Question.blank(), Question.blank()]
    const quiz = Quiz.fill({ id: quizId, questions: [{ ...ante, chains_to: post.id }, post] })
    expect(quiz.questions[0]?.chains_to).to.eq(post.id)
  })

  it('refuses a chain pointing at a question in no quiz', () => {
    const question = Question.blank()
    expect(() => Quiz.fill({ id: quizId, questions: [{ ...question, chains_to: mintId() }] })).to.throw(Z.ZodError)
  })

  it('refuses a question chained to itself', () => {
    const question = Question.blank()
    expect(() => Quiz.fill({ id: quizId, questions: [{ ...question, chains_to: question.id }] })).to.throw(Z.ZodError)
  })

  it('refuses two questions sharing one id', () => {
    const question = Question.blank()
    expect(() => Quiz.fill({ id: quizId, questions: [question, { ...question }] })).to.throw(Z.ZodError)
  })

  it('names the offending field when a chain dangles', () => {
    const question = Question.blank()
    const outcome = QuizValidators.quiz.safeParse({ id: quizId, questions: [{ ...question, chains_to: mintId() }] })
    expect(outcome.success).to.eq(false)
    expect(outcome.error?.issues[0]?.path).to.deep.eq(['questions', 0, 'chains_to'])
  })

  it('rejects a sort memory naming no column we have', () => {
    expect(() => Quiz.fill({ id: quizId, last_sortkey: 'q_full' as never })).to.throw(Z.ZodError)
  })

  it('remembers what the last batch run cost', () => {
    const quiz = Quiz.fill({ id: quizId, bulk_ishes_last: { approx_tokens: 4200, text_count: 28, updated_at: 1 } })
    expect(quiz.bulk_ishes_last).to.deep.eq({ approx_tokens: 4200, text_count: 28, updated_at: 1 })
  })

  it('rejects a title past 200 characters', () => {
    expect(() => Quiz.fill({ id: quizId, title: 'x'.repeat(201) })).to.throw(Z.ZodError)
  })
})

describe('Quiz.blank', () => {
  it('opens with blank questions rather than an empty void', () => {
    expect(Quiz.blank().questions).to.have.length(BlankQuestionQty)
  })

  it('gives every question its own id', () => {
    const ids = new Set(Quiz.blank().questions.map((question) => question.id))
    expect(ids.size).to.eq(BlankQuestionQty)
  })

  it('takes a title when one is offered', () => {
    expect(Quiz.blank('Quiz two').title).to.eq('Quiz two')
  })

  it('takes a label when one is offered, and titles itself from it', () => {
    const quiz = Quiz.blank('', 'danishprinces')
    expect(quiz.label).to.eq('danishprinces')
    expect(quiz.title).to.eq('Danishprinces')
  })

  it('refuses a label that is not one', () => {
    expect(() => Quiz.blank('', 'Not A Label')).to.throw(Z.ZodError)
  })
})
