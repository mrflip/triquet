import { describe, expect, it } from 'vitest'
import * as Importing from '../../src/lib/importing'
import * as Labelmaker from '../../src/lib/labelmaker'
import { Question } from '../../src/models/question'
import { Quiz, type QuizT } from '../../src/models/quiz'
import type { ImportedQuestionT } from '../../src/models/import'
import { present } from '../support/present'

/** A quiz from `qnum, label, clueing` triples */
function quizOf(...triples: [string, string, string][]): QuizT {
  return {
    ...Quiz.blank('Quiz one'),
    questions: triples.map(([qnum, label, clueing]) => ({ ...Question.blank(), qnum, label, clueing })),
  }
}

/** What importing `pasted` into `quiz` sends, which the test expects to have been read */
function imported(quiz: QuizT, pasted: unknown): ImportedQuestionT[] {
  return present(Importing.importInto(quiz, JSON.stringify(pasted)).questions)
}

const labelsOf   = (questions: readonly ImportedQuestionT[]) => questions.map((question) => question.label)
const patchFor   = (questions: readonly ImportedQuestionT[], label: string) => present(questions.find((question) => question.label === label), label).patch
const outcomesOf = (quiz: QuizT, pasted: unknown) => Importing.importInto(quiz, JSON.stringify(pasted)).log.map((entry) => entry.outcome)

describe('importInto', () => {
  describe('what it accepts', () => {
    it('takes a bare list of questions', () => {
      const quiz = quizOf(['1', 'leon', 'Which region?'])
      expect(patchFor(imported(quiz, [{ label: 'leon', clueing: 'Reworded' }]), 'leon')).to.deep.eq({ clueing: 'Reworded' })
    })

    it('takes a single quiz', () => {
      const quiz = quizOf(['1', 'leon', 'Which region?'])
      expect(patchFor(imported(quiz, { title: 'Theirs', questions: [{ label: 'leon', clueing: 'Reworded' }] }), 'leon')).to.deep.eq({ clueing: 'Reworded' })
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
      expect(patchFor(present(outcome.questions), 'leon').clueing).to.eq('Right one')
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
      expect(patchFor(present(outcome.questions), 'leon').clueing).to.eq('Right one')
      expect(outcome.summary).to.include('matched this quiz by label')
    })

    it('says which reading it took and how many questions it found', () => {
      const quiz = quizOf(['1', 'leon', 'Which region?'])
      const outcome = Importing.importInto(quiz, JSON.stringify([{ label: 'leon' }, { label: 'nantes' }]))
      expect(outcome.summary).to.include('bare list of 2 question(s)')
    })
  })

  describe('how it reads', () => {
    it('sends a patch for the label it names, whatever the two titles are', () => {
      const quiz = quizOf(['1', 'leon', 'Which region?'])
      const sent = imported(quiz, [{ label: 'leon', title: 'Something else entirely', clueing: 'Reworded' }])
      expect(labelsOf(sent)).to.deep.eq(['leon'])
      expect(patchFor(sent, 'leon')).to.deep.eq({ title: 'Something else entirely', clueing: 'Reworded' })
      expect(outcomesOf(quiz, [{ label: 'leon', clueing: 'Reworded' }])).to.deep.eq(['merged'])
    })

    it('does not match on title, even a title identical to an existing one', () => {
      const base = quizOf(['1', 'leon', 'Which region?'])
      const quiz = { ...base, questions: base.questions.map((question) => ({ ...question, title: 'Leon' })) }
      expect(labelsOf(imported(quiz, [{ label: 'other_one', title: 'Leon' }]))).to.deep.eq(['other_one'])
      expect(outcomesOf(quiz, [{ label: 'other_one', title: 'Leon' }])).to.deep.eq(['added'])
    })

    it('matches on the label in force, which is the forced label where there is one', () => {
      const base = quizOf(['1', 'generated_one', 'Which region?'])
      const quiz = { ...base, questions: base.questions.map((question) => ({ ...question, forced_label: 'chosen_one' })) }
      const pasted = [{ label: 'generated_one', forced_label: 'chosen_one', clueing: 'Reworded' }]
      expect(labelsOf(imported(quiz, pasted))).to.deep.eq(['chosen_one'])
      expect(outcomesOf(quiz, pasted)).to.deep.eq(['merged'])
    })

    it('never revises a label: neither label is in the patch', () => {
      const quiz = quizOf(['1', 'leon', 'Which region?'])
      expect(patchFor(imported(quiz, [{ label: 'leon', forced_label: null, clueing: 'Reworded' }]), 'leon')).to.deep.eq({ clueing: 'Reworded' })
    })

    it('reads a quiz\'s own export pasted straight back as one merge per question', () => {
      const quiz = quizOf(['1', 'leon', 'Which region?'], ['2', 'nantes', 'Another'])
      expect(labelsOf(imported(quiz, quiz.questions))).to.deep.eq(['leon', 'nantes'])
      expect(outcomesOf(quiz, quiz.questions)).to.deep.eq(['merged', 'merged'])
    })

    it('leaves a field absent from the paste out of the patch, so it is left as it was', () => {
      const quiz = quizOf(['1', 'leon', 'Which region?'])
      expect(patchFor(imported(quiz, [{ label: 'leon', notes: 'a note' }]), 'leon')).to.deep.eq({ notes: 'a note' })
    })

    it('clears a field set explicitly to null', () => {
      const quiz = quizOf(['1', 'leon', 'Which region?'])
      expect(patchFor(imported(quiz, [{ label: 'leon', clueing: null }]), 'leon')).to.deep.eq({ clueing: '' })
    })

    it('passes over what a bot replied, which is recorded by asking rather than pasted', () => {
      const quiz = quizOf(['1', 'leon', 'Which region?'])
      const guess = { status: 'done', text: 'leon', truncated: false, updated_at: 1, last_err: null }
      expect(patchFor(imported(quiz, [{ label: 'leon', guess, clueing_ishes: null }]), 'leon')).to.deep.eq({})
    })

    it('adds a label nothing here holds', () => {
      const quiz = quizOf(['1', 'leon', 'Which region?'])
      expect(labelsOf(imported(quiz, [{ label: 'nantes', clueing: 'A new one' }]))).to.deep.eq(['nantes'])
      expect(outcomesOf(quiz, [{ label: 'nantes', clueing: 'A new one' }])).to.deep.eq(['added'])
    })

    it('adds a question with no label under a fresh one, rather than merging it onto anything', () => {
      const quiz = quizOf(['1', 'leon', 'A first one'])
      const [sent] = imported(quiz, [{ title: 'Leon', clueing: 'Pasted' }])
      expect(present(sent).label).to.not.eq('leon')
      expect(outcomesOf(quiz, [{ title: 'Leon', clueing: 'Pasted' }])).to.deep.eq(['added'])
    })

    it('folds two pasted questions naming one label into one entry, the later fields winning', () => {
      const quiz = quizOf(['1', 'leon', 'Which region?'])
      const pasted = [{ label: 'leon', clueing: 'First', notes: 'kept' }, { label: 'leon', clueing: 'Second' }]
      const sent = imported(quiz, pasted)
      expect(sent).to.have.length(1)
      expect(patchFor(sent, 'leon')).to.deep.eq({ clueing: 'Second', notes: 'kept' })
      expect(outcomesOf(quiz, pasted)).to.deep.eq(['merged', 'merged'])
    })

    it('names nothing to delete: a question the paste leaves out is not in what is sent', () => {
      const quiz = quizOf(['1', 'leon', 'Which region?'], ['2', 'nantes', 'Another'])
      expect(labelsOf(imported(quiz, [{ label: 'leon' }]))).to.deep.eq(['leon'])
    })
  })

  describe('chains', () => {
    it('names a chain target by the label of a question here', () => {
      const quiz = quizOf(['1', 'leon', 'Which region?'], ['2', 'nantes', 'Another'])
      expect(patchFor(imported(quiz, [{ label: 'leon', chains_to: 'nantes' }]), 'leon')).to.deep.eq({ chains_to: 'nantes' })
    })

    it('names a chain target by the label of a question the same import adds', () => {
      const quiz = quizOf(['1', 'leon', 'Which region?'])
      expect(patchFor(imported(quiz, [{ label: 'leon', chains_to: 'nantes' }, { label: 'nantes' }]), 'leon')).to.deep.eq({ chains_to: 'nantes' })
    })

    it('leaves a chain it cannot resolve unset, and says so in the log', () => {
      const quiz = quizOf(['1', 'leon', 'Which region?'])
      const outcome = Importing.importInto(quiz, JSON.stringify([{ label: 'leon', chains_to: 'nobody' }]))
      expect(patchFor(present(outcome.questions), 'leon')).to.deep.eq({ chains_to: null })
      expect(present(outcome.log[0]).issues[0]?.code).to.eq('chain_unresolved')
    })

    it('leaves a chain to the question itself unset, and says so', () => {
      const quiz = quizOf(['1', 'leon', 'Which region?'])
      const outcome = Importing.importInto(quiz, JSON.stringify([{ label: 'leon', chains_to: 'leon' }]))
      expect(patchFor(present(outcome.questions), 'leon')).to.deep.eq({ chains_to: null })
      expect(present(outcome.log[0]).issues).to.have.length(1)
    })

    it('clears a chain set explicitly to null, without complaint', () => {
      const quiz = quizOf(['1', 'leon', 'Which region?'], ['2', 'nantes', 'Another'])
      const outcome = Importing.importInto(quiz, JSON.stringify([{ label: 'leon', chains_to: null }]))
      expect(patchFor(present(outcome.questions), 'leon')).to.deep.eq({ chains_to: null })
      expect(present(outcome.log[0]).issues).to.deep.eq([])
    })
  })

  describe('the summary', () => {
    it('counts what was merged, added and skipped, and says the Q#s will be renumbered', () => {
      const quiz = quizOf(['1', 'leon', 'a'])
      expect(Importing.importInto(quiz, JSON.stringify([{ label: 'leon' }, { label: 'nantes' }])).summary)
        .to.include('1 merged, 1 added, 0 skipped')
        .and.to.include('Renumbered Q# by rank.')
    })
  })

  describe('validation', () => {
    it('skips a bad question entirely and names it', () => {
      const quiz = quizOf(['1', 'leon', 'Which region?'])
      const outcome = Importing.importInto(quiz, JSON.stringify([{ label: 'leon', qnum: 'three' }]))
      expect(outcome.questions).to.deep.eq([])
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
      expect(labelsOf(present(outcome.questions))).to.deep.eq(['nantes'])
      expect(outcome.summary).to.include('1 merged, 0 added, 1 skipped')
      expect(outcome.ok).to.be.false
    })

    it('drops unknown keys silently rather than treating them as an error', () => {
      const quiz = quizOf(['1', 'leon', 'a'])
      const outcome = Importing.importInto(quiz, JSON.stringify([{ label: 'leon', bookkeepingFromElsewhere: 42 }]))
      expect(outcome.ok).to.be.true
      expect(patchFor(present(outcome.questions), 'leon')).to.deep.eq({})
    })
  })

  describe('failure', () => {
    it('changes nothing on unparseable JSON, and says the text is still there', () => {
      const outcome = Importing.importInto(quizOf(['1', 'leon', 'a']), '{"quizzes":[')
      expect(outcome.questions).to.be.null
      expect(outcome.summary).to.include('still here')
    })

    it('changes nothing on a shape it does not recognise', () => {
      const outcome = Importing.importInto(quizOf(['1', 'leon', 'a']), '"just a string"')
      expect(outcome.questions).to.be.null
      expect(outcome.ok).to.be.false
    })

    it('changes nothing when the paste holds no questions', () => {
      const outcome = Importing.importInto(quizOf(['1', 'leon', 'a']), '[]')
      expect(outcome.questions).to.be.null
      expect(outcome.summary).to.include('nothing was changed')
    })
  })
})
