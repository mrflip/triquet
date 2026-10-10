import { describe, expect, it } from 'vitest'
import { assembledQuiz } from '../../src/lib/rows'
import { bigQuiz, bigReadingsOf } from './big-quiz'

describe('bigReadingsOf', () => {
  it('is what the screen assembles the big quiz from again', () => {
    const quiz = bigQuiz()
    const { frame, readings } = bigReadingsOf(quiz)
    const assembled = assembledQuiz(frame, (question_id) => readings.get(question_id))
    expect(assembled).to.deep.eq({ ...quiz, questions: quiz.questions.map((question) => ({ ...question, created_at: 1, updated_at: 1 })) })
  })
})
