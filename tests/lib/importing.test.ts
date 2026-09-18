import { describe, expect, it } from 'vitest'
import { importInto, matchkeyOf } from '../../src/lib/importing'
import { Question } from '../../src/models/question'
import { Quiz, type QuizT } from '../../src/models/quiz'
import { present } from '../support/present'

/** A round from `qnum, short_answer, clueing` triples */
function roundOf(...triples: [string, string, string][]): QuizT {
  return {
    ...Quiz.blank('Round one'),
    questions: triples.map(([qnum, short_answer, clueing]) => ({ ...Question.blank(), qnum, short_answer, clueing })),
  }
}

/** The round after importing `pasted`, which the test expects to have succeeded */
function importedInto(quiz: QuizT, pasted: unknown): QuizT {
  return present(importInto(quiz, JSON.stringify(pasted)).quiz)
}

const answersOf = (quiz: QuizT) => quiz.questions.map((question) => question.short_answer)
const findByAnswer = (quiz: QuizT, short_answer: string) =>
  present(quiz.questions.find((question) => question.short_answer === short_answer), short_answer)

describe('matchkeyOf', () => {
  it('ignores case and surrounding whitespace', () => {
    expect(matchkeyOf('  LéOn  ')).to.eq('léon')
  })
})

describe('importInto', () => {
  describe('what it accepts', () => {
    it('takes a bare list of questions', () => {
      const quiz = roundOf(['1', 'Leon', 'Which region?'])
      const after = importedInto(quiz, [{ short_answer: 'Leon', clueing: 'Reworded' }])
      expect(findByAnswer(after, 'Leon').clueing).to.eq('Reworded')
    })

    it('takes a single round', () => {
      const quiz = roundOf(['1', 'Leon', 'Which region?'])
      const after = importedInto(quiz, { title: 'Theirs', questions: [{ short_answer: 'Leon', clueing: 'Reworded' }] })
      expect(findByAnswer(after, 'Leon').clueing).to.eq('Reworded')
    })

    it('takes a whole workspace, matching the open round by name', () => {
      const quiz = roundOf(['1', 'Leon', 'Which region?'])
      const outcome = importInto(quiz, JSON.stringify({
        quizzes: [
          { title: 'Some other round', questions: [{ short_answer: 'Leon', clueing: 'Wrong one' }] },
          { title: 'Round one', questions: [{ short_answer: 'Leon', clueing: 'Right one' }] },
        ],
        active_quiz_id: 'whatever',
      }))
      expect(findByAnswer(present(outcome.quiz), 'Leon').clueing).to.eq('Right one')
      expect(outcome.summary).to.include('matched this round by name')
    })

    it('says which reading it took and how many questions it found', () => {
      const quiz = roundOf(['1', 'Leon', 'Which region?'])
      const outcome = importInto(quiz, JSON.stringify([{ short_answer: 'Leon' }, { short_answer: 'Nantes' }]))
      expect(outcome.summary).to.include('bare list of 2 question(s)')
    })
  })

  describe('how it merges', () => {
    it('matches on short answer, ignoring case and whitespace', () => {
      const quiz = roundOf(['1', 'Leon', 'Which region?'])
      const after = importedInto(quiz, [{ short_answer: '  leon ', clueing: 'Reworded' }])
      expect(after.questions).to.have.length(1)
      expect(present(after.questions[0]).clueing).to.eq('Reworded')
    })

    it('takes the pasted short answer verbatim, even when it only differs in case', () => {
      const quiz = roundOf(['1', 'Leon', 'Which region?'])
      const after = importedInto(quiz, [{ short_answer: 'LEON' }])
      expect(answersOf(after)).to.deep.eq(['LEON'])
    })

    it('leaves a field absent from the paste exactly as it was', () => {
      const quiz = roundOf(['1', 'Leon', 'Which region?'])
      const after = importedInto(quiz, [{ short_answer: 'Leon', notes: 'a note' }])
      expect(findByAnswer(after, 'Leon').clueing).to.eq('Which region?')
      expect(findByAnswer(after, 'Leon').notes).to.eq('a note')
    })

    it('clears a field set explicitly to null', () => {
      const quiz = roundOf(['1', 'Leon', 'Which region?'])
      const after = importedInto(quiz, [{ short_answer: 'Leon', clueing: null }])
      expect(findByAnswer(after, 'Leon').clueing).to.eq('')
    })

    it('clears a cached model result set to null', () => {
      const base = roundOf(['1', 'Leon', 'Which region?'])
      const quiz = {
        ...base,
        questions: base.questions.map((question) => ({
          ...question,
          guess: { status: 'done' as const, text: 'Leon', truncated: false, updated_at: 1 },
        })),
      }
      const after = importedInto(quiz, [{ short_answer: 'Leon', guess: null }])
      expect(findByAnswer(after, 'Leon').guess).to.eq(null)
    })

    it('keeps an extraction the paste does not mention, which is what makes a partial import useful', () => {
      const base = roundOf(['1', 'Leon', 'Which region?'])
      const quiz = {
        ...base,
        questions: base.questions.map((question) => ({
          ...question,
          clueing_ishes: { status: 'done' as const, items: [{ text: '300', value: 300, kind: 'numeral' as const }], truncated: false, stale: false, updated_at: 1 },
        })),
      }
      const after = importedInto(quiz, [{ short_answer: 'Leon', clueing: 'Reworded' }])
      expect(findByAnswer(after, 'Leon').clueing_ishes?.status).to.eq('done')
    })

    it('appends a short answer nothing here holds', () => {
      const quiz = roundOf(['1', 'Leon', 'Which region?'])
      const after = importedInto(quiz, [{ short_answer: 'Nantes', clueing: 'A new one' }])
      expect(answersOf(after)).to.deep.eq(['Leon', 'Nantes'])
    })

    it('appends a question with no short answer rather than merging it onto a blank', () => {
      const quiz = roundOf(['1', '', 'A blank one'])
      const after = importedInto(quiz, [{ clueing: 'Pasted' }])
      expect(after.questions).to.have.length(2)
      expect(present(after.questions[0]).clueing).to.eq('A blank one')
    })

    it('never deletes anything', () => {
      const quiz = roundOf(['1', 'Leon', 'Which region?'], ['2', 'Nantes', 'Another'])
      const after = importedInto(quiz, [{ short_answer: 'Leon' }])
      expect(answersOf(after)).to.deep.eq(['Leon', 'Nantes'])
    })
  })

  describe('chains', () => {
    it('remaps a chain through the pasted data\'s own ids', () => {
      const quiz = roundOf(['1', 'Leon', 'Which region?'], ['2', 'Nantes', 'Another'])
      const after = importedInto(quiz, [
        { id: 'theirs-1', short_answer: 'Leon', chains_to: 'theirs-2' },
        { id: 'theirs-2', short_answer: 'Nantes' },
      ])
      expect(findByAnswer(after, 'Leon').chains_to).to.eq(findByAnswer(after, 'Nantes').id)
    })

    it('leaves a chain it cannot resolve unset, and says so in the log', () => {
      const quiz = roundOf(['1', 'Leon', 'Which region?'])
      const outcome = importInto(quiz, JSON.stringify([{ id: 'theirs-1', short_answer: 'Leon', chains_to: 'nobody' }]))
      expect(findByAnswer(present(outcome.quiz), 'Leon').chains_to).to.eq(null)
      expect(present(outcome.log[0]).issues[0]?.code).to.eq('chain_unresolved')
    })

    it('clears a chain set explicitly to null', () => {
      const base = roundOf(['1', 'Leon', 'Which region?'], ['2', 'Nantes', 'Another'])
      const [leon, nantes] = base.questions
      const quiz = { ...base, questions: [{ ...present(leon), chains_to: present(nantes).id }, present(nantes)] }
      const after = importedInto(quiz, [{ short_answer: 'Leon', chains_to: null }])
      expect(findByAnswer(after, 'Leon').chains_to).to.eq(null)
    })

    it('sweeps a dangling chain the import did not touch', () => {
      const base = roundOf(['1', 'Leon', 'Which region?'])
      const quiz = { ...base, questions: base.questions.map((question) => ({ ...question, chains_to: 'long-gone' })) }
      const after = importedInto(quiz, [{ short_answer: 'Nantes' }])
      expect(findByAnswer(after, 'Leon').chains_to).to.eq(null)
    })

    it('resolves a chain onto a question the same import appended', () => {
      const quiz = roundOf(['1', 'Leon', 'Which region?'])
      const after = importedInto(quiz, [
        { id: 'theirs-1', short_answer: 'Leon', chains_to: 'theirs-2' },
        { id: 'theirs-2', short_answer: 'Nantes' },
      ])
      expect(findByAnswer(after, 'Leon').chains_to).to.eq(findByAnswer(after, 'Nantes').id)
    })
  })

  describe('afterwards', () => {
    it('renumbers the round by rank', () => {
      const quiz = roundOf(['4', 'Leon', 'a'], ['3.3', 'Nantes', 'b'], ['1', 'Rennes', 'c'])
      const after = importedInto(quiz, [{ short_answer: 'Leon' }])
      expect(after.questions.map((question) => question.qnum)).to.deep.eq(['3', '2', '1'])
    })

    it('says so in the summary', () => {
      const quiz = roundOf(['1', 'Leon', 'a'])
      expect(importInto(quiz, JSON.stringify([{ short_answer: 'Leon' }])).summary)
        .to.include('Renumbered Q# by rank.')
    })
  })

  describe('validation', () => {
    it('skips a bad question entirely and names it', () => {
      const quiz = roundOf(['1', 'Leon', 'Which region?'])
      const outcome = importInto(quiz, JSON.stringify([{ short_answer: 'Leon', qnum: 'three' }]))
      expect(findByAnswer(present(outcome.quiz), 'Leon').clueing).to.eq('Which region?')
      expect(present(outcome.log[0]).outcome).to.eq('skipped')
      expect(present(outcome.log[0]).short_answer).to.eq('Leon')
      expect(present(outcome.log[0]).issues[0]?.fieldpath).to.eq('qnum')
    })

    it('lets one bad question through without blocking the rest', () => {
      const quiz = roundOf(['1', 'Leon', 'a'], ['2', 'Nantes', 'b'])
      const outcome = importInto(quiz, JSON.stringify([
        { short_answer: 'Leon', qnum: 'three' },
        { short_answer: 'Nantes', clueing: 'Reworded' },
      ]))
      expect(findByAnswer(present(outcome.quiz), 'Nantes').clueing).to.eq('Reworded')
      expect(outcome.summary).to.include('1 merged, 0 added, 1 skipped')
      expect(outcome.ok).to.eq(false)
    })

    it('drops unknown keys silently rather than treating them as an error', () => {
      const quiz = roundOf(['1', 'Leon', 'a'])
      const outcome = importInto(quiz, JSON.stringify([{ short_answer: 'Leon', bookkeepingFromElsewhere: 42 }]))
      expect(outcome.ok).to.eq(true)
      expect(findByAnswer(present(outcome.quiz), 'Leon')).to.not.have.property('bookkeepingFromElsewhere')
    })
  })

  describe('failure', () => {
    it('changes nothing on unparseable JSON, and says the text is still there', () => {
      const outcome = importInto(roundOf(['1', 'Leon', 'a']), '{"quizzes":[')
      expect(outcome.quiz).to.eq(null)
      expect(outcome.summary).to.include('still here')
    })

    it('changes nothing on a shape it does not recognise', () => {
      const outcome = importInto(roundOf(['1', 'Leon', 'a']), '"just a string"')
      expect(outcome.quiz).to.eq(null)
      expect(outcome.ok).to.eq(false)
    })

    it('changes nothing when the paste holds no questions', () => {
      const outcome = importInto(roundOf(['1', 'Leon', 'a']), '[]')
      expect(outcome.quiz).to.eq(null)
      expect(outcome.summary).to.include('nothing was changed')
    })
  })
})
