import { describe, expect, it } from 'vitest'
import * as Importing from '../../src/lib/importing'
import * as Labelmaker from '../../src/lib/labelmaker'
import { Question } from '../../src/models/question'
import { Quiz, type QuizT } from '../../src/models/quiz'
import { present } from '../support/present'

/** A quiz from `qnum, label, clueing` triples */
function quizOf(...triples: [string, string, string][]): QuizT {
  return {
    ...Quiz.blank('Quiz one'),
    questions: triples.map(([qnum, label, clueing]) => ({ ...Question.blank(), qnum, label, clueing })),
  }
}

/** The quiz after importing `pasted`, which the test expects to have succeeded */
function importedInto(quiz: QuizT, pasted: unknown): QuizT {
  return present(Importing.importInto(quiz, JSON.stringify(pasted)).quiz)
}

const labelsOf = (quiz: QuizT) => quiz.questions.map((question) => Labelmaker.effectiveLabelOf(question))
const findByLabel = (quiz: QuizT, label: string) =>
  present(quiz.questions.find((question) => Labelmaker.effectiveLabelOf(question) === label), label)

describe('importInto', () => {
  describe('what it accepts', () => {
    it('takes a bare list of questions', () => {
      const quiz = quizOf(['1', 'leon', 'Which region?'])
      const after = importedInto(quiz, [{ label: 'leon', clueing: 'Reworded' }])
      expect(findByLabel(after, 'leon').clueing).to.eq('Reworded')
    })

    it('takes a single quiz', () => {
      const quiz = quizOf(['1', 'leon', 'Which region?'])
      const after = importedInto(quiz, { title: 'Theirs', questions: [{ label: 'leon', clueing: 'Reworded' }] })
      expect(findByLabel(after, 'leon').clueing).to.eq('Reworded')
    })

    it('takes a whole hunt, matching the open quiz by name across its realms', () => {
      const quiz = quizOf(['1', 'leon', 'Which region?'])
      const outcome = Importing.importInto(quiz, JSON.stringify({
        label:  'quiet_otter',
        realms: [
          { label: 'home', quizzes: [{ title: 'Some other quiz', questions: [{ label: 'leon', clueing: 'Wrong one' }] }] },
          { label: 'away', quizzes: [{ title: 'Quiz one', questions: [{ label: 'leon', clueing: 'Right one' }] }] },
        ],
        expressions: [],
      }))
      expect(findByLabel(present(outcome.quiz), 'leon').clueing).to.eq('Right one')
      expect(outcome.summary).to.include('whole hunt of 2 quiz(zes); matched this quiz by name')
    })

    it('matches the open quiz by label before name', () => {
      const quiz = quizOf(['1', 'leon', 'Which region?'])
      const outcome = Importing.importInto(quiz, JSON.stringify({
        label:  'quiet_otter',
        realms: [{ label: 'home', quizzes: [
          { label: 'other_quiz', title: 'Quiz one', questions: [{ label: 'leon', clueing: 'Wrong one' }] },
          { label: Labelmaker.effectiveLabelOf(quiz), title: 'Renamed since', questions: [{ label: 'leon', clueing: 'Right one' }] },
        ] }],
        expressions: [],
      }))
      expect(findByLabel(present(outcome.quiz), 'leon').clueing).to.eq('Right one')
      expect(outcome.summary).to.include('matched this quiz by label')
    })
    it('takes a whole workspace exported before hunts, matching the open quiz by name', () => {
      const quiz = quizOf(['1', 'leon', 'Which region?'])
      const outcome = Importing.importInto(quiz, JSON.stringify({
        quizzes: [
          { title: 'Some other quiz', questions: [{ label: 'leon', clueing: 'Wrong one' }] },
          { title: 'Quiz one', questions: [{ label: 'leon', clueing: 'Right one' }] },
        ],
        active_quiz_id: 'whatever',
      }))
      expect(findByLabel(present(outcome.quiz), 'leon').clueing).to.eq('Right one')
      expect(outcome.summary).to.include('matched this quiz by name')
    })

    it('says which reading it took and how many questions it found', () => {
      const quiz = quizOf(['1', 'leon', 'Which region?'])
      const outcome = Importing.importInto(quiz, JSON.stringify([{ label: 'leon' }, { label: 'nantes' }]))
      expect(outcome.summary).to.include('bare list of 2 question(s)')
    })
  })

  describe('how it merges', () => {
    it('matches on label, whatever the two titles are', () => {
      const quiz = quizOf(['1', 'leon', 'Which region?'])
      const after = importedInto(quiz, [{ label: 'leon', title: 'Something else entirely', clueing: 'Reworded' }])
      expect(after.questions).to.have.length(1)
      expect(present(after.questions[0]).clueing).to.eq('Reworded')
      expect(present(after.questions[0]).title).to.eq('Something else entirely')
    })

    it('does not match on title, even a title identical to an existing one', () => {
      const base = quizOf(['1', 'leon', 'Which region?'])
      const quiz = { ...base, questions: base.questions.map((question) => ({ ...question, title: 'Leon' })) }
      const after = importedInto(quiz, [{ label: 'other_one', title: 'Leon', clueing: 'A different question' }])
      expect(labelsOf(after)).to.deep.eq(['leon', 'other_one'])
      expect(findByLabel(after, 'leon').clueing).to.eq('Which region?')
    })

    it('matches on the label in force, which is the forced label where there is one', () => {
      const base = quizOf(['1', 'generated_one', 'Which region?'])
      const quiz = { ...base, questions: base.questions.map((question) => ({ ...question, forced_label: 'chosen_one' })) }
      const after = importedInto(quiz, [{ label: 'generated_one', forced_label: 'chosen_one', clueing: 'Reworded' }])
      expect(after.questions).to.have.length(1)
      expect(present(after.questions[0]).clueing).to.eq('Reworded')
    })

    it('leaves the label of a matched question alone', () => {
      const quiz = quizOf(['1', 'leon', 'Which region?'])
      const after = importedInto(quiz, [{ label: 'leon', forced_label: null, clueing: 'Reworded' }])
      expect(labelsOf(after)).to.deep.eq(['leon'])
      expect(present(after.questions[0]).forced_label).to.eq(null)
    })

    it('is idempotent when a quiz\'s own export is pasted straight back', () => {
      const quiz = quizOf(['1', 'leon', 'Which region?'], ['2', 'nantes', 'Another'])
      const after = importedInto(quiz, quiz.questions)
      expect(labelsOf(after)).to.deep.eq(['leon', 'nantes'])
    })

    it('leaves a field absent from the paste exactly as it was', () => {
      const quiz = quizOf(['1', 'leon', 'Which region?'])
      const after = importedInto(quiz, [{ label: 'leon', notes: 'a note' }])
      expect(findByLabel(after, 'leon').clueing).to.eq('Which region?')
      expect(findByLabel(after, 'leon').notes).to.eq('a note')
    })

    it('clears a field set explicitly to null', () => {
      const quiz = quizOf(['1', 'leon', 'Which region?'])
      const after = importedInto(quiz, [{ label: 'leon', clueing: null }])
      expect(findByLabel(after, 'leon').clueing).to.eq('')
    })

    it('clears a cached model result set to null', () => {
      const base = quizOf(['1', 'leon', 'Which region?'])
      const quiz = {
        ...base,
        questions: base.questions.map((question) => ({
          ...question,
          guess: { status: 'done' as const, text: 'leon', truncated: false, updated_at: 1, last_err: null },
        })),
      }
      const after = importedInto(quiz, [{ label: 'leon', guess: null }])
      expect(findByLabel(after, 'leon').guess).to.eq(null)
    })

    it('keeps an extraction the paste does not mention, which is what makes a partial import useful', () => {
      const base = quizOf(['1', 'leon', 'Which region?'])
      const quiz = {
        ...base,
        questions: base.questions.map((question) => ({
          ...question,
          clueing_ishes: { status: 'done' as const, items: [{ text: '300', value: 300, kind: 'numeral' as const }], truncated: false, stale: false, updated_at: 1, last_err: null },
        })),
      }
      const after = importedInto(quiz, [{ label: 'leon', clueing: 'Reworded' }])
      expect(findByLabel(after, 'leon').clueing_ishes?.status).to.eq('done')
    })

    it('appends a title nothing here holds', () => {
      const quiz = quizOf(['1', 'leon', 'Which region?'])
      const after = importedInto(quiz, [{ label: 'nantes', clueing: 'A new one' }])
      expect(labelsOf(after)).to.deep.eq(['leon', 'nantes'])
    })

    it('appends a question with no label under a fresh one, rather than merging it onto anything', () => {
      const quiz = quizOf(['1', 'leon', 'A first one'])
      const after = importedInto(quiz, [{ title: 'Leon', clueing: 'Pasted' }])
      expect(after.questions).to.have.length(2)
      expect(present(after.questions[0]).clueing).to.eq('A first one')
      expect(present(after.questions[1]).label).to.not.eq('leon')
    })

    it('never deletes anything', () => {
      const quiz = quizOf(['1', 'leon', 'Which region?'], ['2', 'nantes', 'Another'])
      const after = importedInto(quiz, [{ label: 'leon' }])
      expect(labelsOf(after)).to.deep.eq(['leon', 'nantes'])
    })
  })

  describe('chains', () => {
    it('resolves a chain named by label onto the question here holding that label', () => {
      const quiz = quizOf(['1', 'leon', 'Which region?'], ['2', 'nantes', 'Another'])
      const after = importedInto(quiz, [{ label: 'leon', chains_to: 'nantes' }])
      expect(findByLabel(after, 'leon').chains_to).to.eq(findByLabel(after, 'nantes')._id)
    })

    it('resolves a chain named by label onto a question the same import appended', () => {
      const quiz = quizOf(['1', 'leon', 'Which region?'])
      const after = importedInto(quiz, [{ label: 'leon', chains_to: 'nantes' }, { label: 'nantes' }])
      expect(findByLabel(after, 'leon').chains_to).to.eq(findByLabel(after, 'nantes')._id)
    })

    it('remaps a chain through an older backup\'s own ids', () => {
      const quiz = quizOf(['1', 'leon', 'Which region?'], ['2', 'nantes', 'Another'])
      const after = importedInto(quiz, [
        { id: 'theirs-1', label: 'leon', chains_to: 'theirs-2' },
        { id: 'theirs-2', label: 'nantes' },
      ])
      expect(findByLabel(after, 'leon').chains_to).to.eq(findByLabel(after, 'nantes')._id)
    })

    it('leaves a chain it cannot resolve unset, and says so in the log', () => {
      const quiz = quizOf(['1', 'leon', 'Which region?'])
      const outcome = Importing.importInto(quiz, JSON.stringify([{ id: 'theirs-1', label: 'leon', chains_to: 'nobody' }]))
      expect(findByLabel(present(outcome.quiz), 'leon').chains_to).to.eq(null)
      expect(present(outcome.log[0]).issues[0]?.code).to.eq('chain_unresolved')
    })

    it('clears a chain set explicitly to null', () => {
      const base = quizOf(['1', 'leon', 'Which region?'], ['2', 'nantes', 'Another'])
      const [leon, nantes] = base.questions
      const quiz = { ...base, questions: [{ ...present(leon), chains_to: present(nantes)._id }, present(nantes)] }
      const after = importedInto(quiz, [{ label: 'leon', chains_to: null }])
      expect(findByLabel(after, 'leon').chains_to).to.eq(null)
    })

    it('sweeps a dangling chain the import did not touch', () => {
      const base = quizOf(['1', 'leon', 'Which region?'])
      const quiz = { ...base, questions: base.questions.map((question) => ({ ...question, chains_to: 'long-gone' })) }
      const after = importedInto(quiz, [{ label: 'nantes' }])
      expect(findByLabel(after, 'leon').chains_to).to.eq(null)
    })

    it('resolves a chain onto a question the same import appended', () => {
      const quiz = quizOf(['1', 'leon', 'Which region?'])
      const after = importedInto(quiz, [
        { id: 'theirs-1', label: 'leon', chains_to: 'theirs-2' },
        { id: 'theirs-2', label: 'nantes' },
      ])
      expect(findByLabel(after, 'leon').chains_to).to.eq(findByLabel(after, 'nantes')._id)
    })
  })

  describe('afterwards', () => {
    it('renumbers the quiz by rank', () => {
      const quiz = quizOf(['4', 'leon', 'a'], ['3.3', 'nantes', 'b'], ['1', 'rennes', 'c'])
      const after = importedInto(quiz, [{ label: 'leon' }])
      expect(after.questions.map((question) => question.qnum)).to.deep.eq(['3', '2', '1'])
    })

    it('says so in the summary', () => {
      const quiz = quizOf(['1', 'leon', 'a'])
      expect(Importing.importInto(quiz, JSON.stringify([{ label: 'leon' }])).summary)
        .to.include('Renumbered Q# by rank.')
    })
  })

  describe('validation', () => {
    it('skips a bad question entirely and names it', () => {
      const quiz = quizOf(['1', 'leon', 'Which region?'])
      const outcome = Importing.importInto(quiz, JSON.stringify([{ label: 'leon', qnum: 'three' }]))
      expect(findByLabel(present(outcome.quiz), 'leon').clueing).to.eq('Which region?')
      expect(present(outcome.log[0]).outcome).to.eq('skipped')
      expect(present(outcome.log[0]).label).to.eq('leon')
      expect(present(outcome.log[0]).issues[0]?.fieldpath).to.eq('qnum')
    })

    it('lets one bad question through without blocking the rest', () => {
      const quiz = quizOf(['1', 'leon', 'a'], ['2', 'nantes', 'b'])
      const outcome = Importing.importInto(quiz, JSON.stringify([
        { label: 'leon', qnum: 'three' },
        { label: 'nantes', clueing: 'Reworded' },
      ]))
      expect(findByLabel(present(outcome.quiz), 'nantes').clueing).to.eq('Reworded')
      expect(outcome.summary).to.include('1 merged, 0 added, 1 skipped')
      expect(outcome.ok).to.eq(false)
    })

    it('drops unknown keys silently rather than treating them as an error', () => {
      const quiz = quizOf(['1', 'leon', 'a'])
      const outcome = Importing.importInto(quiz, JSON.stringify([{ label: 'leon', bookkeepingFromElsewhere: 42 }]))
      expect(outcome.ok).to.eq(true)
      expect(findByLabel(present(outcome.quiz), 'leon')).to.not.have.property('bookkeepingFromElsewhere')
    })
  })

  describe('failure', () => {
    it('changes nothing on unparseable JSON, and says the text is still there', () => {
      const outcome = Importing.importInto(quizOf(['1', 'leon', 'a']), '{"quizzes":[')
      expect(outcome.quiz).to.eq(null)
      expect(outcome.summary).to.include('still here')
    })

    it('changes nothing on a shape it does not recognise', () => {
      const outcome = Importing.importInto(quizOf(['1', 'leon', 'a']), '"just a string"')
      expect(outcome.quiz).to.eq(null)
      expect(outcome.ok).to.eq(false)
    })

    it('changes nothing when the paste holds no questions', () => {
      const outcome = Importing.importInto(quizOf(['1', 'leon', 'a']), '[]')
      expect(outcome.quiz).to.eq(null)
      expect(outcome.summary).to.include('nothing was changed')
    })
  })
})
