import { describe, expect, it } from 'vitest'
import { importInto, matchkeyOf } from '../../src/lib/importing'
import { Question } from '../../src/models/question'
import { Quiz, type QuizT } from '../../src/models/quiz'
import { present } from '../support/present'

/** A quiz from `qnum, title, clueing` triples */
function quizOf(...triples: [string, string, string][]): QuizT {
  return {
    ...Quiz.blank('Quiz one'),
    questions: triples.map(([qnum, title, clueing]) => ({ ...Question.blank(), qnum, title, clueing })),
  }
}

/** The quiz after importing `pasted`, which the test expects to have succeeded */
function importedInto(quiz: QuizT, pasted: unknown): QuizT {
  return present(importInto(quiz, JSON.stringify(pasted)).quiz)
}

const answersOf = (quiz: QuizT) => quiz.questions.map((question) => question.title)
const findByAnswer = (quiz: QuizT, title: string) =>
  present(quiz.questions.find((question) => question.title === title), title)

describe('matchkeyOf', () => {
  it('ignores case and surrounding whitespace', () => {
    expect(matchkeyOf('  LéOn  ')).to.eq('léon')
  })
})

describe('importInto', () => {
  describe('what it accepts', () => {
    it('takes a bare list of questions', () => {
      const quiz = quizOf(['1', 'Leon', 'Which region?'])
      const after = importedInto(quiz, [{ title: 'Leon', clueing: 'Reworded' }])
      expect(findByAnswer(after, 'Leon').clueing).to.eq('Reworded')
    })

    it('takes a single quiz', () => {
      const quiz = quizOf(['1', 'Leon', 'Which region?'])
      const after = importedInto(quiz, { title: 'Theirs', questions: [{ title: 'Leon', clueing: 'Reworded' }] })
      expect(findByAnswer(after, 'Leon').clueing).to.eq('Reworded')
    })

    it('takes a whole workspace, matching the open quiz by name', () => {
      const quiz = quizOf(['1', 'Leon', 'Which region?'])
      const outcome = importInto(quiz, JSON.stringify({
        quizzes: [
          { title: 'Some other quiz', questions: [{ title: 'Leon', clueing: 'Wrong one' }] },
          { title: 'Quiz one', questions: [{ title: 'Leon', clueing: 'Right one' }] },
        ],
        active_quiz_id: 'whatever',
      }))
      expect(findByAnswer(present(outcome.quiz), 'Leon').clueing).to.eq('Right one')
      expect(outcome.summary).to.include('matched this quiz by name')
    })

    it('says which reading it took and how many questions it found', () => {
      const quiz = quizOf(['1', 'Leon', 'Which region?'])
      const outcome = importInto(quiz, JSON.stringify([{ title: 'Leon' }, { title: 'Nantes' }]))
      expect(outcome.summary).to.include('bare list of 2 question(s)')
    })
  })

  describe('how it merges', () => {
    it('matches on title, ignoring case and whitespace', () => {
      const quiz = quizOf(['1', 'Leon', 'Which region?'])
      const after = importedInto(quiz, [{ title: '  leon ', clueing: 'Reworded' }])
      expect(after.questions).to.have.length(1)
      expect(present(after.questions[0]).clueing).to.eq('Reworded')
    })

    it('takes the pasted title verbatim, even when it only differs in case', () => {
      const quiz = quizOf(['1', 'Leon', 'Which region?'])
      const after = importedInto(quiz, [{ title: 'LEON' }])
      expect(answersOf(after)).to.deep.eq(['LEON'])
    })

    it('leaves a field absent from the paste exactly as it was', () => {
      const quiz = quizOf(['1', 'Leon', 'Which region?'])
      const after = importedInto(quiz, [{ title: 'Leon', notes: 'a note' }])
      expect(findByAnswer(after, 'Leon').clueing).to.eq('Which region?')
      expect(findByAnswer(after, 'Leon').notes).to.eq('a note')
    })

    it('clears a field set explicitly to null', () => {
      const quiz = quizOf(['1', 'Leon', 'Which region?'])
      const after = importedInto(quiz, [{ title: 'Leon', clueing: null }])
      expect(findByAnswer(after, 'Leon').clueing).to.eq('')
    })

    it('clears a cached model result set to null', () => {
      const base = quizOf(['1', 'Leon', 'Which region?'])
      const quiz = {
        ...base,
        questions: base.questions.map((question) => ({
          ...question,
          guess: { status: 'done' as const, text: 'Leon', truncated: false, updated_at: 1 },
        })),
      }
      const after = importedInto(quiz, [{ title: 'Leon', guess: null }])
      expect(findByAnswer(after, 'Leon').guess).to.eq(null)
    })

    it('keeps an extraction the paste does not mention, which is what makes a partial import useful', () => {
      const base = quizOf(['1', 'Leon', 'Which region?'])
      const quiz = {
        ...base,
        questions: base.questions.map((question) => ({
          ...question,
          clueing_ishes: { status: 'done' as const, items: [{ text: '300', value: 300, kind: 'numeral' as const }], truncated: false, stale: false, updated_at: 1 },
        })),
      }
      const after = importedInto(quiz, [{ title: 'Leon', clueing: 'Reworded' }])
      expect(findByAnswer(after, 'Leon').clueing_ishes?.status).to.eq('done')
    })

    it('appends a title nothing here holds', () => {
      const quiz = quizOf(['1', 'Leon', 'Which region?'])
      const after = importedInto(quiz, [{ title: 'Nantes', clueing: 'A new one' }])
      expect(answersOf(after)).to.deep.eq(['Leon', 'Nantes'])
    })

    it('appends a question with no title rather than merging it onto a blank', () => {
      const quiz = quizOf(['1', '', 'A blank one'])
      const after = importedInto(quiz, [{ clueing: 'Pasted' }])
      expect(after.questions).to.have.length(2)
      expect(present(after.questions[0]).clueing).to.eq('A blank one')
    })

    it('never deletes anything', () => {
      const quiz = quizOf(['1', 'Leon', 'Which region?'], ['2', 'Nantes', 'Another'])
      const after = importedInto(quiz, [{ title: 'Leon' }])
      expect(answersOf(after)).to.deep.eq(['Leon', 'Nantes'])
    })
  })

  describe('chains', () => {
    it('remaps a chain through the pasted data\'s own ids', () => {
      const quiz = quizOf(['1', 'Leon', 'Which region?'], ['2', 'Nantes', 'Another'])
      const after = importedInto(quiz, [
        { id: 'theirs-1', title: 'Leon', chains_to: 'theirs-2' },
        { id: 'theirs-2', title: 'Nantes' },
      ])
      expect(findByAnswer(after, 'Leon').chains_to).to.eq(findByAnswer(after, 'Nantes').id)
    })

    it('leaves a chain it cannot resolve unset, and says so in the log', () => {
      const quiz = quizOf(['1', 'Leon', 'Which region?'])
      const outcome = importInto(quiz, JSON.stringify([{ id: 'theirs-1', title: 'Leon', chains_to: 'nobody' }]))
      expect(findByAnswer(present(outcome.quiz), 'Leon').chains_to).to.eq(null)
      expect(present(outcome.log[0]).issues[0]?.code).to.eq('chain_unresolved')
    })

    it('clears a chain set explicitly to null', () => {
      const base = quizOf(['1', 'Leon', 'Which region?'], ['2', 'Nantes', 'Another'])
      const [leon, nantes] = base.questions
      const quiz = { ...base, questions: [{ ...present(leon), chains_to: present(nantes).id }, present(nantes)] }
      const after = importedInto(quiz, [{ title: 'Leon', chains_to: null }])
      expect(findByAnswer(after, 'Leon').chains_to).to.eq(null)
    })

    it('sweeps a dangling chain the import did not touch', () => {
      const base = quizOf(['1', 'Leon', 'Which region?'])
      const quiz = { ...base, questions: base.questions.map((question) => ({ ...question, chains_to: 'long-gone' })) }
      const after = importedInto(quiz, [{ title: 'Nantes' }])
      expect(findByAnswer(after, 'Leon').chains_to).to.eq(null)
    })

    it('resolves a chain onto a question the same import appended', () => {
      const quiz = quizOf(['1', 'Leon', 'Which region?'])
      const after = importedInto(quiz, [
        { id: 'theirs-1', title: 'Leon', chains_to: 'theirs-2' },
        { id: 'theirs-2', title: 'Nantes' },
      ])
      expect(findByAnswer(after, 'Leon').chains_to).to.eq(findByAnswer(after, 'Nantes').id)
    })
  })

  describe('afterwards', () => {
    it('renumbers the quiz by rank', () => {
      const quiz = quizOf(['4', 'Leon', 'a'], ['3.3', 'Nantes', 'b'], ['1', 'Rennes', 'c'])
      const after = importedInto(quiz, [{ title: 'Leon' }])
      expect(after.questions.map((question) => question.qnum)).to.deep.eq(['3', '2', '1'])
    })

    it('says so in the summary', () => {
      const quiz = quizOf(['1', 'Leon', 'a'])
      expect(importInto(quiz, JSON.stringify([{ title: 'Leon' }])).summary)
        .to.include('Renumbered Q# by rank.')
    })
  })

  describe('validation', () => {
    it('skips a bad question entirely and names it', () => {
      const quiz = quizOf(['1', 'Leon', 'Which region?'])
      const outcome = importInto(quiz, JSON.stringify([{ title: 'Leon', qnum: 'three' }]))
      expect(findByAnswer(present(outcome.quiz), 'Leon').clueing).to.eq('Which region?')
      expect(present(outcome.log[0]).outcome).to.eq('skipped')
      expect(present(outcome.log[0]).title).to.eq('Leon')
      expect(present(outcome.log[0]).issues[0]?.fieldpath).to.eq('qnum')
    })

    it('lets one bad question through without blocking the rest', () => {
      const quiz = quizOf(['1', 'Leon', 'a'], ['2', 'Nantes', 'b'])
      const outcome = importInto(quiz, JSON.stringify([
        { title: 'Leon', qnum: 'three' },
        { title: 'Nantes', clueing: 'Reworded' },
      ]))
      expect(findByAnswer(present(outcome.quiz), 'Nantes').clueing).to.eq('Reworded')
      expect(outcome.summary).to.include('1 merged, 0 added, 1 skipped')
      expect(outcome.ok).to.eq(false)
    })

    it('drops unknown keys silently rather than treating them as an error', () => {
      const quiz = quizOf(['1', 'Leon', 'a'])
      const outcome = importInto(quiz, JSON.stringify([{ title: 'Leon', bookkeepingFromElsewhere: 42 }]))
      expect(outcome.ok).to.eq(true)
      expect(findByAnswer(present(outcome.quiz), 'Leon')).to.not.have.property('bookkeepingFromElsewhere')
    })
  })

  describe('failure', () => {
    it('changes nothing on unparseable JSON, and says the text is still there', () => {
      const outcome = importInto(quizOf(['1', 'Leon', 'a']), '{"quizzes":[')
      expect(outcome.quiz).to.eq(null)
      expect(outcome.summary).to.include('still here')
    })

    it('changes nothing on a shape it does not recognise', () => {
      const outcome = importInto(quizOf(['1', 'Leon', 'a']), '"just a string"')
      expect(outcome.quiz).to.eq(null)
      expect(outcome.ok).to.eq(false)
    })

    it('changes nothing when the paste holds no questions', () => {
      const outcome = importInto(quizOf(['1', 'Leon', 'a']), '[]')
      expect(outcome.quiz).to.eq(null)
      expect(outcome.summary).to.include('nothing was changed')
    })
  })
})
