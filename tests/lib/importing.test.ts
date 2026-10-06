import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import * as Importing from '../../src/lib/importing'
import { classicLayout } from '../support/layouts'
import { Question } from '../../src/models/question'
import { Quiz, type QuizT } from '../../src/models/quiz'
import type { ImportedQuestionT } from '../../src/models/import'
import { SeedWidgets } from '../../src/models/seeds'
import { Widget, type WidgetT } from '../../src/models/widget'
import { Widgeting } from '../../src/models/widgeting'
import { Column, type ColumnAlign } from '../../src/models/column'
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
  return present(Importing.importInto(quiz, JSON.stringify(pasted), SeedWidgets).questions)
}

const labelsOf   = (questions: readonly ImportedQuestionT[]) => questions.map((question) => question.label)
const patchFor   = (questions: readonly ImportedQuestionT[], label: string) => present(questions.find((question) => question.label === label), label).patch
const outcomesOf = (quiz: QuizT, pasted: unknown) => Importing.importInto(quiz, JSON.stringify(pasted), SeedWidgets).log.map((entry) => entry.outcome)

/** A quiz of one question, `leon`, working the default widgetings */
function widgetedQuiz(): QuizT {
  return { ...quizOf(['1', 'leon', 'Which region?']), widgetings: [...classicLayout().widgetings] }
}

/** What importing a quiz of one question and `widgetings` into `quiz` comes to */
const withWidgetings = (quiz: QuizT, widgetings: unknown[], library: readonly WidgetT[] = SeedWidgets) => (
  Importing.importInto(quiz, JSON.stringify({ questions: [{ label: 'leon' }], widgetings }), library)
)

/** The library, with the entries `remark` (text) and `points` (a number) */
const EntryLibrary = [
  ...SeedWidgets,
  Widget.fill({ label: 'remark', formulary: 'entry', config: { entry_kind: 'text' } }),
  Widget.fill({ label: 'points', formulary: 'entry', config: { entry_kind: 'number' } }),
]

/** A quiz of `leon` and `nantes` working the entries `remark` and `points`, and the formula `clueing_full` */
function enteredQuiz(): QuizT {
  return {
    ...quizOf(['1', 'leon', 'Which region?'], ['2', 'nantes', 'Which city?']),
    widgetings: ['remark', 'points', 'clueing_full'].map((label) => Widgeting.fill({ widget_label: label, label })),
  }
}

/** What importing `pasted` into `quiz` comes to, the library holding the entries */
function read(quiz: QuizT, pasted: unknown): Importing.ImportOutcome {
  return Importing.importInto(quiz, JSON.stringify(pasted), EntryLibrary)
}

/** What an import types into the entry cells of the question labelled `label` */
function enteredFor(outcome: Importing.ImportOutcome, label: string): ImportedQuestionT['entered'] {
  return present(present(outcome.questions).find((question) => question.label === label), label).entered
}

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
      }), SeedWidgets)
      expect(patchFor(present(outcome.questions), 'leon').clueing).to.eq('Right one')
      expect(outcome.summary).to.include('Read as a hunt of 2 quiz(zes); matched this quiz by name')
    })

    it('matches the open quiz by label before name', () => {
      const quiz = quizOf(['1', 'leon', 'Which region?'])
      const outcome = Importing.importInto(quiz, JSON.stringify({
        label:  'quiet_otter',
        realms: [{ label: 'home', quizzes: [
          { label: 'other_quiz', title: 'Quiz one', questions: [{ label: 'leon', clueing: 'Wrong one' }] },
          { label: quiz.label, title: 'Renamed since', questions: [{ label: 'leon', clueing: 'Right one' }] },
        ] }],
      }), SeedWidgets)
      expect(patchFor(present(outcome.questions), 'leon').clueing).to.eq('Right one')
      expect(outcome.summary).to.include('matched this quiz by label')
    })

    it('matches the open quiz by the forced_label an older export carries, which it answered to then', () => {
      const quiz = quizOf(['1', 'leon', 'Which region?'])
      const outcome = Importing.importInto(quiz, JSON.stringify({
        label:  'quiet_otter',
        realms: [{ label: 'home', quizzes: [
          { label: 'other_quiz', forced_label: null, title: 'Quiz one', questions: [{ label: 'leon', clueing: 'Wrong one' }] },
          { label: 'minted_once', forced_label: quiz.label, title: 'Renamed since', questions: [{ label: 'leon', clueing: 'Right one' }] },
        ] }],
      }), SeedWidgets)
      expect(patchFor(present(outcome.questions), 'leon').clueing).to.eq('Right one')
      expect(outcome.summary).to.include('matched this quiz by label')
    })

    it("sends a whole hunt none of whose quizzes matches this one elsewhere: its first quiz, to the quiz of its label, reading nothing here", () => {
      const quiz = quizOf(['1', 'leon', 'Which region?'])
      const outcome = Importing.importInto(quiz, JSON.stringify({
        label:   'spring_hunt',
        quizzes: { home: { legends: { title: 'Legends', questions: { leon: { clueing: 'Theirs' } } }, princes: { title: 'Princes', questions: {} } } },
      }), SeedWidgets)
      expect(outcome.elsewhere).to.deep.eq({ label: 'legends', take: 0 })
      expect([outcome.questions, outcome.actions]).to.deep.eq([null, []])
      expect(outcome.summary).to.include('Read as a hunt of 2 quiz(zes); none matches this quiz, so its first, “legends”, goes to the quiz of its own label')
    })

    it("sends a Raw Export of a hunt of one quiz elsewhere too, as the hunt's own fields at its root say it is one", () => {
      const quiz = quizOf(['1', 'leon', 'Which region?'])
      const outcome = Importing.importInto(quiz, JSON.stringify({ label: 'spring_hunt', branch: 'main', quizzes: { home: { legends: { questions: { leon: {} } } } } }), SeedWidgets)
      expect(outcome.elsewhere).to.deep.eq({ label: 'legends', take: 0 })
    })

    it("reads one quiz's ball into this quiz, whatever it is called", () => {
      const quiz = quizOf(['1', 'leon', 'Which region?'])
      const outcome = Importing.importInto(quiz, JSON.stringify({ quizzes: { home: { legends: { title: 'Legends', questions: { leon: { clueing: 'Theirs' } } } } } }), SeedWidgets)
      expect(outcome.elsewhere).to.be.null
      expect(patchFor(present(outcome.questions), 'leon').clueing).to.eq('Theirs')
      expect(outcome.summary).to.include("Read as one quiz's ball of 1 question(s).")
    })

    it("reads the quiz it is told to take, sent from another quiz's Import, whatever this one is called", () => {
      const quiz = quizOf(['1', 'leon', 'Which region?'])
      const pasted = JSON.stringify({ label: 'spring_hunt', quizzes: { home: { legends: { questions: { leon: { clueing: 'Legends' } } }, princes: { questions: { leon: { clueing: 'Princes' } } } } } })
      const outcome = Importing.importInto(quiz, pasted, SeedWidgets, { take: 1 })
      expect(patchFor(present(outcome.questions), 'leon').clueing).to.eq('Princes')
      expect(outcome.summary).to.include("Read its quiz “princes”, sent here from another quiz's Import")
    })

    it('says which reading it took and how many questions it found', () => {
      const quiz = quizOf(['1', 'leon', 'Which region?'])
      const outcome = Importing.importInto(quiz, JSON.stringify([{ label: 'leon' }, { label: 'nantes' }]), SeedWidgets)
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

    it('matches a question an older export carries a forced_label for by that label, which it answered to then', () => {
      const quiz = quizOf(['1', 'chosen_one', 'Which region?'])
      const pasted = [{ label: 'generated_one', forced_label: 'chosen_one', clueing: 'Reworded' }]
      expect(labelsOf(imported(quiz, pasted))).to.deep.eq(['chosen_one'])
      expect(outcomesOf(quiz, pasted)).to.deep.eq(['merged'])
    })

    it('never revises a label: neither label is in the patch', () => {
      const quiz = quizOf(['1', 'leon', 'Which region?'])
      expect(patchFor(imported(quiz, [{ label: 'leon', clueing: 'Reworded' }]), 'leon')).to.deep.eq({ clueing: 'Reworded' })
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

    it('carries a question\'s recap, trimmed, and clears one set to null', () => {
      const quiz = quizOf(['1', 'leon', 'Which region?'])
      expect(patchFor(imported(quiz, [{ label: 'leon', recap: ' Leon was a pen name.\n' }]), 'leon')).to.deep.eq({ recap: 'Leon was a pen name.' })
      expect(patchFor(imported(quiz, [{ label: 'leon', recap: null }]), 'leon')).to.deep.eq({ recap: '' })
    })

    it("carries how a question is shown, null making it normal", () => {
      const quiz = quizOf(['1', 'leon', 'Which region?'], ['2', 'nantes', 'Another'])
      const questions = imported(quiz, [{ label: 'leon', viz: 'archived' }, { label: 'nantes', viz: null }])
      expect([patchFor(questions, 'leon'), patchFor(questions, 'nantes')]).to.deep.eq([{ viz: 'archived' }, { viz: 'normal' }])
    })

    it("skips a question shown in a way this tool does not know", () => {
      const quiz = quizOf(['1', 'leon', 'Which region?'])
      expect(outcomesOf(quiz, [{ label: 'leon', viz: 'hidden' }])).to.deep.eq(['skipped'])
    })

    it("passes over when a question was made and edited: it is stamped as the import writes it", () => {
      const quiz = quizOf(['1', 'leon', 'Which region?'])
      expect(patchFor(imported(quiz, [{ label: 'leon', created_at: '2001-01-01T00:00:00.000Z', updated_at: '2001-01-01T00:00:00.000Z' }]), 'leon')).to.deep.eq({})
    })

    it("passes over what a widgeting came to, which is worked out again or recorded by asking rather than pasted", () => {
      const quiz = quizOf(['1', 'leon', 'Which region?'])
      const dumdum = { status: 'ok', value: { guess: 'leon', explanation: 'a lion' } }
      const clueing_full = { status: 'ok', value: 12 }
      expect(patchFor(imported(quiz, [{ label: 'leon', dumdum, clueing_full, numnum_hint: null }]), 'leon')).to.deep.eq({})
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
      const outcome = Importing.importInto(quiz, JSON.stringify([{ label: 'leon', chains_to: 'nobody' }]), SeedWidgets)
      expect(patchFor(present(outcome.questions), 'leon')).to.deep.eq({ chains_to: null })
      expect(present(outcome.log[0]).issues[0]?.code).to.eq('chain_unresolved')
    })

    it('leaves a chain to the question itself unset, and says so', () => {
      const quiz = quizOf(['1', 'leon', 'Which region?'])
      const outcome = Importing.importInto(quiz, JSON.stringify([{ label: 'leon', chains_to: 'leon' }]), SeedWidgets)
      expect(patchFor(present(outcome.questions), 'leon')).to.deep.eq({ chains_to: null })
      expect(present(outcome.log[0]).issues).to.have.length(1)
    })

    it('clears a chain set explicitly to null, without complaint', () => {
      const quiz = quizOf(['1', 'leon', 'Which region?'], ['2', 'nantes', 'Another'])
      const outcome = Importing.importInto(quiz, JSON.stringify([{ label: 'leon', chains_to: null }]), SeedWidgets)
      expect(patchFor(present(outcome.questions), 'leon')).to.deep.eq({ chains_to: null })
      expect(present(outcome.log[0]).issues).to.deep.eq([])
    })
  })

  describe('the summary', () => {
    it('counts what was merged, added and skipped, and says the Q#s will be renumbered', () => {
      const quiz = quizOf(['1', 'leon', 'a'])
      expect(Importing.importInto(quiz, JSON.stringify([{ label: 'leon' }, { label: 'nantes' }]), SeedWidgets).summary)
        .to.include('1 merged, 1 added, 0 skipped')
        .and.to.include('Renumbered Q# by rank.')
    })
  })

  describe('validation', () => {
    it('skips a bad question entirely and names it', () => {
      const quiz = quizOf(['1', 'leon', 'Which region?'])
      const outcome = Importing.importInto(quiz, JSON.stringify([{ label: 'leon', qnum: 'three' }]), SeedWidgets)
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
      ]), SeedWidgets)
      expect(labelsOf(present(outcome.questions))).to.deep.eq(['nantes'])
      expect(outcome.summary).to.include('1 merged, 0 added, 1 skipped')
      expect(outcome.ok).to.be.false
    })

    it('drops unknown keys silently rather than treating them as an error', () => {
      const quiz = quizOf(['1', 'leon', 'a'])
      const outcome = Importing.importInto(quiz, JSON.stringify([{ label: 'leon', bookkeepingFromElsewhere: 42 }]), SeedWidgets)
      expect(outcome.ok).to.be.true
      expect(patchFor(present(outcome.questions), 'leon')).to.deep.eq({})
    })
  })

  describe('failure', () => {
    it('changes nothing on unparseable JSON, and says the text is still there', () => {
      const outcome = Importing.importInto(quizOf(['1', 'leon', 'a']), '{"quizzes":[', SeedWidgets)
      expect(outcome.questions).to.be.null
      expect(outcome.summary).to.include('still here')
    })

    it('changes nothing on a shape it does not recognise', () => {
      const outcome = Importing.importInto(quizOf(['1', 'leon', 'a']), '"just a string"', SeedWidgets)
      expect(outcome.questions).to.be.null
      expect(outcome.ok).to.be.false
    })

    it('changes nothing when the paste holds no questions', () => {
      const outcome = Importing.importInto(quizOf(['1', 'leon', 'a']), '[]', SeedWidgets)
      expect(outcome.questions).to.be.null
      expect(outcome.summary).to.include('nothing was changed')
    })
  })

  describe('widgetings', () => {
    it("adds one the quiz lacks when the library holds its widget", () => {
      const outcome = withWidgetings(widgetedQuiz(), [{ widget_label: 'answer_reversed', label: 'backwards', description: 'Read it in a mirror' }])
      expect(outcome.widgetingActions).to.deep.eq([
        { kind: 'add_widgeting', widgeting: { widget_label: 'answer_reversed', label: 'backwards', description: 'Read it in a mirror', params: {}, tier: 'question' } },
      ])
      expect(outcome.widgetingLog).to.deep.eq([{ label: 'backwards', outcome: 'added', reason: null }])
      expect(outcome.ok).to.be.true
    })

    it("revises the description and params of one the quiz holds", () => {
      const outcome = withWidgetings(widgetedQuiz(), [{ widget_label: 'dumdum', label: 'dumdum', description: 'First instinct', params: { strict: true } }])
      expect(outcome.widgetingActions).to.deep.eq([
        { kind: 'edit_widgeting', label: 'dumdum', patch: { description: 'First instinct', params: { strict: true } } },
      ])
      expect(outcome.widgetingLog).to.deep.eq([{ label: 'dumdum', outcome: 'revised', reason: null }])
    })

    it("revises one whose params alone differ", () => {
      const outcome = withWidgetings(widgetedQuiz(), [{ widget_label: 'dumdum', label: 'dumdum', params: { strict: true } }])
      expect(present(outcome.widgetingLog[0]).outcome).to.eq('revised')
      expect(outcome.widgetingActions).to.have.lengthOf(1)
    })

    it("keeps one that is the same as the quiz's, and sends nothing for it", () => {
      const outcome = withWidgetings(widgetedQuiz(), [Widgeting.fill({ widget_label: 'numnum_hint', label: 'numnum_hint' })])
      expect(outcome.widgetingActions).to.deep.eq([])
      expect(outcome.widgetingLog).to.deep.eq([{ label: 'numnum_hint', outcome: 'kept', reason: null }])
      expect(outcome.ok).to.be.true
    })

    it("skips and logs one whose widget the library lacks", () => {
      const outcome = withWidgetings(widgetedQuiz(), [{ widget_label: 'nowhere_widget', label: 'lost' }])
      expect(outcome.widgetingActions).to.deep.eq([])
      expect(outcome.widgetingLog).to.deep.eq([{ label: 'lost', outcome: 'skipped', reason: 'the library holds no widget called "nowhere_widget"' }])
      expect(outcome.ok).to.be.false
    })

    it("skips one the library would hold, when the library given lacks it", () => {
      const outcome = withWidgetings(widgetedQuiz(), [{ widget_label: 'answer_reversed', label: 'answer_reversed' }], [])
      expect(present(outcome.widgetingLog[0]).outcome).to.eq('skipped')
    })

    it("skips one whose label the quiz holds for another widget, rather than re-pointing it", () => {
      const outcome = withWidgetings(widgetedQuiz(), [{ widget_label: 'answer_reversed', label: 'dumdum' }])
      expect(outcome.widgetingActions).to.deep.eq([])
      expect(outcome.widgetingLog).to.deep.eq([{ label: 'dumdum', outcome: 'skipped', reason: 'it works "answer_reversed" here, and "dumdum" in this quiz' }])
    })

    it("skips one the quiz holds at another tier, rather than moving it", () => {
      const outcome = withWidgetings(widgetedQuiz(), [{ widget_label: 'dumdum', label: 'dumdum', tier: 'quiz' }])
      expect(outcome.widgetingActions).to.deep.eq([])
      expect(outcome.widgetingLog).to.deep.eq([{ label: 'dumdum', outcome: 'skipped', reason: 'it runs for each quiz here, and for each question in this quiz' }])
    })

    it("adds one that runs once per quiz at that tier", () => {
      const outcome = withWidgetings(widgetedQuiz(), [{ widget_label: 'answer_reversed', label: 'winners', tier: 'quiz' }])
      expect(outcome.widgetingActions).to.deep.eq([
        { kind: 'add_widgeting', widgeting: { widget_label: 'answer_reversed', label: 'winners', description: '', params: {}, tier: 'quiz' } },
      ])
    })

    it("skips one that does not validate, naming it by whatever label it carried", () => {
      const outcome = withWidgetings(widgetedQuiz(), [{ widget_label: 'answer_reversed', label: 'title' }, { label: 'no_widget' }, 'junk'])
      expect(outcome.widgetingLog.map((entry) => [entry.label, entry.outcome])).to.deep.eq([['title', 'skipped'], ['no_widget', 'skipped'], ['', 'skipped']])
      expect(outcome.widgetingLog.every((entry) => (entry.reason ?? '') !== '')).to.be.true
      expect(outcome.widgetingActions).to.deep.eq([])
    })

    it("removes none: a widgeting the paste leaves out is not in what is sent", () => {
      const outcome = withWidgetings(widgetedQuiz(), [{ widget_label: 'answer_reversed', label: 'answer_reversed' }])
      expect(outcome.widgetingActions.map((action) => action.kind)).to.deep.eq(['add_widgeting'])
    })

    it("counts the widgetings in the summary, and leaves them out of it when the paste carries none", () => {
      const outcome = withWidgetings(widgetedQuiz(), [
        { widget_label: 'answer_reversed', label: 'answer_reversed' },
        { widget_label: 'dumdum', label: 'dumdum', description: 'Changed' },
        { widget_label: 'nowhere_widget', label: 'lost' },
      ])
      expect(outcome.summary).to.include('1 merged, 0 added, 0 skipped; widgetings 1 added, 1 revised, 1 skipped')
      expect(withWidgetings(widgetedQuiz(), []).summary).to.not.include('widgetings')
    })

    it("reads the widgetings of the quiz it chose out of a whole hunt", () => {
      const quiz = widgetedQuiz()
      const outcome = Importing.importInto(quiz, JSON.stringify({ realms: [{ quizzes: [
        { title: 'Some other quiz', questions: [{ label: 'leon' }], widgetings: [{ widget_label: 'answer_reversed', label: 'wrong_one' }] },
        { title: 'Quiz one', questions: [{ label: 'leon' }], widgetings: [{ widget_label: 'answer_reversed', label: 'right_one' }] },
      ] }] }), SeedWidgets)
      expect(outcome.widgetingLog.map((entry) => entry.label)).to.deep.eq(['right_one'])
    })

    it("sends no widgetings for a bare list of questions", () => {
      const outcome = Importing.importInto(widgetedQuiz(), JSON.stringify([{ label: 'leon' }]), SeedWidgets)
      expect(outcome.widgetingLog).to.deep.eq([])
      expect(outcome.widgetingActions).to.deep.eq([])
    })
  })

  describe('entries', () => {

    it("types a value under an entry's label into its cell, read as the export writes it or bare", () => {
      const outcome = read(enteredQuiz(), [{ label: 'leon', remark: { status: 'ok', value: 'Ask Flip.' }, points: 3 }])
      expect(enteredFor(outcome, 'leon')).to.deep.eq({ remark: 'Ask Flip.', points: 3 })
    })

    it("empties a cell for nothing: null, an empty text, or a missing cell as the export writes it", () => {
      const outcome = read(enteredQuiz(), [{ label: 'leon', remark: null, points: { status: 'missing', value: null } }, { label: 'nantes', remark: '' }])
      expect(enteredFor(outcome, 'leon')).to.deep.eq({ remark: null, points: null })
      expect(enteredFor(outcome, 'nantes')).to.deep.eq({ remark: null })
    })

    it("leaves a cell the paste says nothing of as it was, and passes over what a formula came to", () => {
      const outcome = read(enteredQuiz(), [{ label: 'leon', clueing: 'Reworded', clueing_full: { status: 'ok', value: 12 } }])
      expect(enteredFor(outcome, 'leon')).to.deep.eq({})
      expect(patchFor(present(outcome.questions), 'leon')).to.deep.eq({ clueing: 'Reworded' })
    })

    it("reads a quiz's own export pasted straight back, each question merged with what its entries hold", () => {
      const pasted = { questions: [
        { label: 'leon', remark: { status: 'ok', value: 'Ask Flip.' }, points: { status: 'missing', value: null }, clueing_full: { status: 'missing', value: null } },
      ] }
      const outcome = read(enteredQuiz(), pasted)
      expect(outcome.log.map((entry) => entry.outcome)).to.deep.eq(['merged'])
      expect(enteredFor(outcome, 'leon')).to.deep.eq({ remark: 'Ask Flip.', points: null })
    })

    it("types into the entries of a widgeting the same import adds", () => {
      const outcome = read(quizOf(['1', 'leon', 'Which region?']), { questions: [{ label: 'leon', remark: 'Fresh.' }], widgetings: [{ widget_label: 'remark', label: 'remark' }] })
      expect(outcome.widgetingActions.map((action) => action.kind)).to.deep.eq(['add_widgeting'])
      expect(enteredFor(outcome, 'leon')).to.deep.eq({ remark: 'Fresh.' })
    })

    it("passes over a value under an entry's label when the paste says that label works another widget", () => {
      const outcome = read(enteredQuiz(), { questions: [{ label: 'leon', clueing: 'Reworded', remark: { status: 'errored', value: null } }], widgetings: [{ widget_label: 'dumdum', label: 'remark' }] })
      expect(outcome.log.map((entry) => entry.outcome)).to.deep.eq(['merged'])
      expect(enteredFor(outcome, 'leon')).to.deep.eq({})
    })

    it("folds two pasted questions naming one label into one, the later value winning", () => {
      const outcome = read(enteredQuiz(), [{ label: 'leon', remark: 'First.', points: 1 }, { label: 'leon', remark: 'Second.' }])
      expect(enteredFor(outcome, 'leon')).to.deep.eq({ remark: 'Second.', points: 1 })
    })

    it("types a question's category estimates into a category-estimate cell, as the export writes them, and refuses ones naming a category twice", () => {
      const quiz = { ...enteredQuiz(), widgetings: [...enteredQuiz().widgetings, Widgeting.fill({ widget_label: 'categories', label: 'cats' })] }
      const estimates = [{ category: 'tv', difficulty: 'hard' }, { category: 'art', difficulty: 'easy' }]
      const outcome = read(quiz, [{ label: 'leon', cats: { status: 'ok', value: estimates } }, { label: 'nantes', cats: [{ category: 'tv' }, { category: 'tv' }] }])
      expect(enteredFor(outcome, 'leon')).to.deep.eq({ cats: estimates })
      expect(outcome.log.map((entry) => [entry.outcome, entry.issues.map((issue) => issue.fieldpath)])).to.deep.eq([['merged', []], ['skipped', ['cats']]])
    })

    it("skips a question whose entry holds what its kind does not take, naming the entry", () => {
      const outcome = read(enteredQuiz(), [{ label: 'leon', clueing: 'Reworded', points: 'three' }, { label: 'nantes', remark: { status: 'errored', value: null } }])
      expect(outcome.log.map((entry) => [entry.outcome, entry.issues.map((issue) => issue.fieldpath)])).to.deep.eq([['skipped', ['points']], ['skipped', ['remark']]])
      expect(outcome.questions).to.deep.eq([])
      expect(outcome.ok).to.be.false
    })
  })
})

/** A quiz of `leon` laid out with `columns`, given as label, source, width (and alignment) */
function laidOut(...columns: [string, string, number, ColumnAlign?][]): QuizT {
  return { ...quizOf(['1', 'leon', 'Which region?']), widgetings: [Widgeting.fill({ widget_label: 'remark', label: 'remark' })], columns: columns.map(([label, source, width_px, align]) => Column.fill({ label, title: label, source, width_px, ...(align && { align }) })) }
}

/** What importing `leon` and `columns`, keyed as an export keys them, into `quiz` comes to */
function withColumns(quiz: QuizT, columns: Record<string, unknown>, widgetings: Record<string, unknown> = {}): Importing.ImportOutcome {
  return read(quiz, { questions: { leon: { position: 0 } }, widgetings, columns })
}

describe('importInto: columns', () => {
  it("makes the quiz's columns the paste's: adding, revising, reordering, and removing the one it lacks", () => {
    const quiz = laidOut(['title', 'question.title', 100], ['hint', 'question.hint', 330], ['notes', 'question.notes', 220])
    const outcome = withColumns(quiz, {
      clueing: { position: 0, title: 'Clueing', source: 'question.clueing', width_px: 330 },
      hint:    { position: 1, title: 'Hint!', source: 'question.hint', width_px: 200, align: 'right' },
      title:   { position: 2, title: 'title', source: 'question.title', width_px: 100 },
    })
    expect(outcome.ok).to.be.true
    expect(outcome.columnActions).to.deep.eq([
      { kind: 'delete_column', label: 'notes' },
      { kind: 'add_column', column: { label: 'clueing', title: 'Clueing', source: 'question.clueing', width_px: 330 }, onto_idx: 0 },
      { kind: 'edit_column', label: 'hint', patch: { title: 'Hint!', width_px: 200, align: 'right' } },
      { kind: 'move_column', label: 'hint', onto_idx: 1 },
    ])
    expect(outcome.columnLog.map((entry) => [entry.label, entry.outcome])).to.deep.eq([['notes', 'removed'], ['clueing', 'added'], ['hint', 'revised'], ['title', 'kept']])
  })

  it("sends nothing for columns the quiz already holds as pasted", () => {
    const quiz = laidOut(['title', 'question.title', 100, 'center'], ['remark', 'remark', 160])
    const outcome = withColumns(quiz, { title: { position: 0, title: 'title', source: 'question.title', width_px: 100, align: 'center' }, remark: { position: 1, title: 'remark', source: 'remark', width_px: 160 } })
    expect([outcome.columnActions, outcome.columnLog.map((entry) => entry.outcome)]).to.deep.eq([[], ['kept', 'kept']])
  })

  it("takes a column off and puts it back where the paste leaves its alignment unset, since nothing else unsets one", () => {
    const outcome = withColumns(laidOut(['title', 'question.title', 100, 'right']), { title: { position: 0, title: 'title', source: 'question.title', width_px: 100 } })
    expect(outcome.columnActions).to.deep.eq([
      { kind: 'delete_column', label: 'title' },
      { kind: 'add_column', column: { label: 'title', title: 'title', source: 'question.title', width_px: 100 }, onto_idx: 0 },
    ])
  })

  it("skips a column showing a widgeting the quiz will not have, and then removes none", () => {
    const quiz = laidOut(['title', 'question.title', 100], ['notes', 'question.notes', 220])
    const outcome = withColumns(quiz, { guess: { position: 0, title: 'Guess', source: 'nowhere', width_px: 160 }, title: { position: 1, title: 'title', source: 'question.title', width_px: 100 } })
    expect(outcome.ok).to.be.false
    expect(outcome.columnLog.map((entry) => [entry.label, entry.outcome])).to.deep.eq([['guess', 'skipped'], ['title', 'kept']])
    expect(outcome.columnActions).to.deep.eq([])
  })

  it("shows a widgeting the same import adds", () => {
    const outcome = withColumns(laidOut(), { points: { position: 0, title: 'Points', source: 'points', width_px: 80 } }, { points: { position: 0, widget_label: 'points' } })
    expect(outcome.columnActions.map((action) => action.kind)).to.deep.eq(['add_column'])
  })

  it("skips a column that does not validate, naming it", () => {
    const outcome = withColumns(laidOut(['title', 'question.title', 100]), { wide: { position: 0, title: 'Wide', source: 'question.notes', width_px: 9000 } })
    expect(outcome.columnLog.map((entry) => [entry.label, entry.outcome])).to.deep.eq([['wide', 'skipped']])
  })

  it("leaves the columns alone for a paste holding none: the questions alone, a bare list, an export from before columns were", () => {
    const quiz = laidOut(['title', 'question.title', 100])
    for (const pasted of [{ questions: { leon: {} } }, [{ label: 'leon' }], { questions: [{ label: 'leon' }], columns: [] }]) {
      const outcome = read(quiz, pasted)
      expect([outcome.columnActions, outcome.columnLog], JSON.stringify(pasted)).to.deep.eq([[], []])
    }
  })

  it("counts the columns in the summary", () => {
    const outcome = withColumns(laidOut(['notes', 'question.notes', 220]), { title: { position: 0, title: 'Title', source: 'question.title', width_px: 100 } })
    expect(outcome.summary).to.include('columns 1 added, 0 revised, 1 removed, 0 skipped')
  })
})

describe("importInto: the quiz's own fields", () => {
  it("carries the title, smith's note and Q1 preamble the paste holds, and says so", () => {
    const outcome = read(laidOut(), { title: 'Legends', smiths_note: 'Lions.', q1_preamble: 'Read on.', questions: { leon: {} } })
    expect(outcome.fieldActions).to.deep.eq([
      { kind: 'retitle_quiz', title: 'Legends' },
      { kind: 'set_smiths_note', smiths_note: 'Lions.' },
      { kind: 'set_q1_preamble', q1_preamble: 'Read on.' },
    ])
    expect(outcome.summary).to.include("carried its title, smith's note, Q1 preamble")
  })

  it("leaves a field the paste lacks as it is, keeps one it holds as the quiz has it, and clears a note set to null", () => {
    const quiz = { ...laidOut(), title: 'Legends', smiths_note: 'Lions.' }
    const outcome = read(quiz, { title: 'Legends', smiths_note: null, questions: { leon: {} } })
    expect(outcome.fieldActions).to.deep.eq([{ kind: 'set_smiths_note', smiths_note: '' }])
    expect(outcome.fieldLog.map((entry) => [entry.fieldname, entry.outcome])).to.deep.eq([['title', 'kept'], ['smiths_note', 'carried']])
  })

  it("carries the recap's head and tail and what the quiz templates, after its widgetings and columns, and says so", () => {
    const outcome = read(laidOut(), { recap_head: 'Thanks!', recap_tail: 'Bye.', templated: ['question.recap', 'remark'], questions: { leon: {} } })
    expect(outcome.fieldActions).to.deep.eq([
      { kind: 'set_recap_head', recap_head: 'Thanks!' },
      { kind: 'set_recap_tail', recap_tail: 'Bye.' },
      { kind: 'set_templated', templated: ['question.recap', 'remark'] },
    ])
    expect(outcome.actions.map((action) => action.kind)).to.deep.eq(['set_recap_head', 'set_recap_tail', 'set_templated', 'import_questions'])
    expect(outcome.summary).to.include('carried its recap head, recap tail, templated sources')
  })

  it("templates a widgeting the same import adds, once it is added", () => {
    const outcome = read(laidOut(), { templated: ['points'], widgetings: { points: { position: 0, widget_label: 'points' } }, questions: { leon: {} } })
    expect(outcome.actions.map((action) => action.kind)).to.deep.eq(['add_widgeting', 'set_templated', 'import_questions'])
  })

  it("leaves out a widgeting the quiz will not have from what it templates, and names it", () => {
    const outcome = read(laidOut(), { templated: ['question.clueing', 'nowhere'], questions: { leon: {} } })
    expect(outcome.fieldActions).to.deep.eq([{ kind: 'set_templated', templated: ['question.clueing'] }])
    expect(outcome.fieldLog).to.deep.eq([{ fieldname: 'templated', outcome: 'carried', reason: 'without nowhere, which this quiz will not have' }])
  })

  it("keeps what the quiz templates when the paste templates the same, clears it for a null, and skips one that will not read", () => {
    const quiz = { ...laidOut(), templated: ['remark'] }
    expect(read(quiz, { templated: ['remark'], questions: { leon: {} } }).fieldLog.map((entry) => entry.outcome)).to.deep.eq(['kept'])
    expect(read(quiz, { templated: null, questions: { leon: {} } }).fieldActions).to.deep.eq([{ kind: 'set_templated', templated: [] }])
    const unread = read(quiz, { templated: ['question.qnum'], questions: { leon: {} } })
    expect([unread.ok, unread.fieldLog.map((entry) => entry.outcome), unread.fieldActions]).to.deep.eq([false, ['skipped'], []])
  })

  it("skips a note that will not read", () => {
    const outcome = read(laidOut(), { smiths_note: 12, questions: { leon: {} } })
    expect([outcome.ok, outcome.fieldLog.map((entry) => entry.outcome), outcome.fieldActions]).to.deep.eq([false, ['skipped'], []])
  })

  it("never carries the lock", () => {
    const outcome = read(laidOut(), { locked: true, questions: { leon: {} } })
    expect(outcome.actions.map((action) => action.kind)).to.deep.eq(['import_questions'])
  })

  it("hands the sort memory on with the questions for a quiz that holds none, and keeps a quiz's own that holds some", () => {
    const pasted = { last_sortkey: 'column:clueing', questions: { leon: {} } }
    const into = read({ ...laidOut(), questions: [] }, pasted)
    const kept = read(laidOut(), pasted)
    expect(into.actions.at(-1)).to.deep.include({ kind: 'import_questions', last_sortkey: 'column:clueing' })
    expect(kept.actions.at(-1)).to.not.have.property('last_sortkey')
    expect(kept.fieldLog.map((entry) => entry.outcome)).to.deep.eq(['kept'])
  })
})

describe('importInto: what it sends', () => {
  it("sends the quiz's fields, then its widgetings, then its columns, then its questions", () => {
    const outcome = read(laidOut(['title', 'question.title', 100]), {
      title:      'Legends',
      questions:  { leon: { position: 0 } },
      widgetings: { points: { position: 0, widget_label: 'points' } },
      columns:    { points: { position: 0, title: 'Points', source: 'points', width_px: 80 } },
    })
    expect(outcome.actions.map((action) => action.kind)).to.deep.eq(['retitle_quiz', 'add_widgeting', 'delete_column', 'add_column', 'import_questions'])
  })

  it("sends nothing when it reads nothing", () => {
    expect(read(laidOut(), 'not json at all').actions).to.deep.eq([])
  })
})

/** The text of the older export `filename`, as someone kept it */
function olderExport(filename: string): string {
  return fs.readFileSync(path.join(import.meta.dirname, '../../fixtures/exports', filename), 'utf8')
}

/** The quiz `princes` as it stands now: `leon`, chaining nowhere yet, and `nantes`, working the entry `remark` */
function princesNow(): QuizT {
  return { ...quizOf(['1', 'leon', 'Old clueing'], ['2', 'nantes', 'Old clueing']), title: 'Princes', label: 'princes', widgetings: [Widgeting.fill({ widget_label: 'remark', label: 'remark' })] }
}

describe('older exports', () => {
  const OlderExports = [
    ['hunt-2026-10-04.json',          'Read as a hunt of 2 quiz(zes); matched this quiz by label, with 2 question(s).', 'a hunt of realms in a list, its questions beside what each widgeting came to'],
    ['quiz-2026-10-04.json',          'Read as one quiz of 2 question(s).',                                             "one quiz, as a quiz's own history kept it"],
    ['hunt-2026-09-27.json',          'Read as a hunt of 1 quiz(zes); matched this quiz by label, with 2 question(s).', 'a hunt whose labels could be overridden'],
    ['hunt-with-ids-2026-09-27.json', 'Read as a hunt of 1 quiz(zes); matched this quiz by label, with 2 question(s).', 'a hunt carrying ids, chains naming them'],
    ['workspace-2026-09-26.json',     'Read as a hunt of 1 quiz(zes); matched this quiz by label, with 2 question(s).', 'a workspace of quizzes, chains naming ids'],
  ] as const

  for (const [filename, reading, story] of OlderExports) {
    it(`still imports ${story}`, () => {
      const outcome = Importing.importInto(princesNow(), olderExport(filename), EntryLibrary)
      expect(outcome.summary).to.include(reading)
      expect(outcome.log.map((entry) => [entry.label, entry.outcome])).to.deep.eq([['leon', 'merged'], ['nantes', 'merged']])
      expect(patchFor(present(outcome.questions), 'leon')).to.deep.include({ clueing: 'Which region has 300 lions and twelve kings?', full_answer: 'León', notes: 'keep me' })
      expect(patchFor(present(outcome.questions), 'nantes')).to.deep.include({ hint: 'BUT NOT the edict', chains_to: null })
    })
  }

  it("keeps each chain, by label, from an export that named its target by label or by id", () => {
    for (const [filename] of OlderExports) {
      const outcome = Importing.importInto(princesNow(), olderExport(filename), EntryLibrary)
      expect(patchFor(present(outcome.questions), 'leon').chains_to, filename).to.eq('nantes')
    }
  })

  it("loses a chain whose id names no question the export holds, rather than the question", () => {
    const pasted = { quizzes: [{ label: 'princes', questions: [{ id: 'aaa', label: 'leon', chains_to: 'long-gone' }] }] }
    const outcome = Importing.importInto(princesNow(), JSON.stringify(pasted), EntryLibrary)
    expect(outcome.log.map((entry) => entry.outcome)).to.deep.eq(['merged'])
    expect(patchFor(present(outcome.questions), 'leon').chains_to).to.be.null
  })

  it("types what an entry held back into its cell, from the export that carried it", () => {
    const outcome = Importing.importInto(princesNow(), olderExport('hunt-2026-10-04.json'), EntryLibrary)
    expect(enteredFor(outcome, 'leon')).to.deep.eq({ remark: 'Ask Flip.' })
  })

  it("reads the oldest export of all for its labels and its question text, sending its first quiz, which matches none here, to a quiz of its own", () => {
    const oldest = fs.readFileSync(path.join(import.meta.dirname, '../../fixtures/sample-import.json'), 'utf8')
    const sent = Importing.importInto(quizOf(['1', 'sheep', 'Old']), oldest, SeedWidgets)
    expect(sent.summary).to.include('Read as a hunt of 2 quiz(zes); none matches this quiz')
    expect(sent.elsewhere).to.deep.eq({ label: null, take: 0 })
    const outcome = Importing.importInto(quizOf(['1', 'sheep', 'Old']), oldest, SeedWidgets, { take: 0 })
    expect(patchFor(present(outcome.questions), 'sheep').clueing).to.include('At a glance, the lines below are gibberish')
  })

  it("still imports the library's export of widgets in a list, and of widgets keyed by scope under `widgets`", () => {
    for (const filename of ['library-2026-10-04.json', 'library-2026-10-05.json']) {
      const outcome = Importing.libraryImported(SeedWidgets, olderExport(filename))
      expect(outcome.log.map((entry) => entry.outcome), filename).to.deep.eq([...SeedWidgets.map(() => 'kept'), 'added'])
      expect(outcome.widgets?.map((widget) => widget.label), filename).to.deep.eq(['remark'])
    }
  })
})

describe('libraryImported', () => {
  const shout = { label: 'shout', formulary: 'jsonata', formula: '$uppercase(qn.title)' }
  const dumdum = present(SeedWidgets.find((widget) => widget.label === 'dumdum'))
  const answerReversed = present(SeedWidgets.find((widget) => widget.label === 'answer_reversed'))

  it("adds a label the library lacks", () => {
    const outcome = Importing.libraryImported(SeedWidgets, JSON.stringify({ widgets: [shout] }))
    expect(present(outcome.log[0]).outcome).to.eq('added')
    expect(outcome.widgets).to.deep.eq([Widget.fill({ label: 'shout', formulary: 'jsonata', formula: '$uppercase(qn.title)' })])
    expect(outcome.ok).to.be.true
  })

  it("reads the doc block's example", () => {
    expect(Importing.libraryImported(SeedWidgets, '{"widgets":[{"label":"shout","formulary":"jsonata","formula":"$uppercase(qn.title)"}]}').log[0]?.outcome).to.eq('added')
  })

  it("takes a bare list of widgets too", () => {
    expect(Importing.libraryImported([], JSON.stringify([shout])).log).to.deep.eq([{ label: 'shout', outcome: 'added', reason: null }])
  })

  it("sends new widgets in the order pasted, for the library to put at its end", () => {
    const outcome = Importing.libraryImported(SeedWidgets, JSON.stringify([{ ...shout, label: 'zebra' }, shout]))
    expect(present(outcome.widgets).map((widget) => widget.label)).to.deep.eq(['zebra', 'shout'])
  })

  it("revises a label it holds", () => {
    const revised = { ...Widget.exported(dumdum), title: 'Dumdum, again', config: { ...dumdum.config, max_tokens: 512 } }
    const outcome = Importing.libraryImported(SeedWidgets, JSON.stringify({ widgets: [revised] }))
    expect(outcome.log).to.deep.eq([{ label: 'dumdum', outcome: 'revised', reason: null }])
    expect(outcome.widgets).to.deep.eq([revised])
  })

  it("keeps a label it holds unchanged, and sends nothing for it", () => {
    const outcome = Importing.libraryImported(SeedWidgets, JSON.stringify({ widgets: [answerReversed] }))
    expect(outcome.log).to.deep.eq([{ label: 'answer_reversed', outcome: 'kept', reason: null }])
    expect(outcome.widgets).to.deep.eq([])
    expect(outcome.ok).to.be.true
  })

  it("keeps every widget of its own export pasted straight back", () => {
    const outcome = Importing.libraryImported(SeedWidgets, JSON.stringify({ widgets: SeedWidgets.map((widget) => Widget.exported(widget)) }))
    expect(outcome.log.every((entry) => entry.outcome === 'kept')).to.be.true
    expect(outcome.summary).to.eq(`Read ${String(SeedWidgets.length)} widget(s): 0 added, 0 revised, ${String(SeedWidgets.length)} unchanged, 0 skipped.`)
  })

  it("skips and logs a widget whose formulary differs from the one held", () => {
    const outcome = Importing.libraryImported(SeedWidgets, JSON.stringify([{ label: 'dumdum', formulary: 'jsonata', formula: 'qn.title' }]))
    expect(outcome.log).to.deep.eq([{ label: 'dumdum', outcome: 'skipped', reason: 'it is a jsonata widget here, and an aibot widget in the library' }])
    expect(outcome.widgets).to.deep.eq([])
    expect(outcome.ok).to.be.false
  })

  it("skips and logs a widget that does not validate, without blocking the rest", () => {
    const outcome = Importing.libraryImported(SeedWidgets, JSON.stringify([{ label: 'broken', formulary: 'aibot', formula: 'Hi' }, 'junk', shout]))
    expect(outcome.log.map((entry) => [entry.label, entry.outcome])).to.deep.eq([['broken', 'skipped'], ['', 'skipped'], ['shout', 'added']])
    expect(present(outcome.widgets).map((widget) => widget.label)).to.deep.eq(['shout'])
    expect(outcome.summary).to.eq('Read 3 widget(s): 1 added, 0 revised, 0 unchanged, 2 skipped.')
  })

  it("changes nothing on unparseable JSON, and says the text is still there", () => {
    const outcome = Importing.libraryImported(SeedWidgets, '{"widgets":[')
    expect(outcome.widgets).to.be.null
    expect(outcome.summary).to.include('still here')
  })

  it("changes nothing on a shape that is not a library export", () => {
    for (const pasted of ['{"widgetings":[]}', 'null', '"shout"']) {
      const outcome = Importing.libraryImported(SeedWidgets, pasted)
      expect(outcome.widgets, pasted).to.be.null
      expect(outcome.ok, pasted).to.be.false
    }
  })
})
