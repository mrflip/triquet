import { describe, expect, it } from 'vitest'
import * as Changes from '../../src/lib/changes'
import { Question, type QuestionT } from '../../src/models/question'
import { Quiz, type QuizT } from '../../src/models/quiz'
import { present } from '../support/present'

/** A blank question answering to `forced_label`, with any fields worth setting on top */
function questionOf(forced_label: string, fields: Partial<QuestionT> = {}): QuestionT {
  return { ...Question.blank(), forced_label, ...fields }
}

/** A quiz holding exactly `questions`, everything else left as a fresh quiz has it */
function quizOf(questions: QuestionT[], fields: Partial<QuizT> = {}): QuizT {
  return { ...Quiz.blank(), title: 'Ours', questions, ...fields }
}

const linesOf = (before: QuizT | null, after: QuizT | null) => Changes.shorthandLines(Changes.quizChanges(before, after))
const shortOf = (before: QuizT | null, after: QuizT | null) => Changes.shorthandFor(Changes.quizChanges(before, after))

describe('quizChanges', () => {
  it('reports a quiz coming into being as itself alone, not as five blank questions', () => {
    expect(Changes.quizChanges(null, Quiz.blank())).to.deep.eq([
      { scope: 'quiz', fieldkey: null, changekind: 'added' },
    ])
  })

  it('reports a quiz being deleted', () => {
    expect(Changes.quizChanges(Quiz.blank(), null)).to.deep.eq([
      { scope: 'quiz', fieldkey: null, changekind: 'dropped' },
    ])
  })

  it('finds nothing between a quiz and itself', () => {
    const quiz = quizOf([questionOf('quiet_otter')])
    expect(Changes.quizChanges(quiz, quiz)).to.deep.eq([])
  })

  it('finds nothing between two readings that merely differ by identity', () => {
    const quiz = quizOf([questionOf('quiet_otter')])
    expect(Changes.quizChanges(quiz, { ...quiz, questions: [...quiz.questions] })).to.deep.eq([])
  })

  it('names a question by the label it answers to now, not the one it had', () => {
    const before = quizOf([questionOf('quiet_otter', { clueing: 'Who?' })])
    const after = { ...before, questions: [{ ...present(before.questions[0]), forced_label: 'brave_ox', clueing: 'Who now?' }] }
    expect(linesOf(before, after)).to.deep.eq(['brave_ox ~clueing ~forced_label'])
  })

  it('reads a wholly separate quiz as one question leaving and another arriving', () => {
    const before = quizOf([questionOf('quiet_otter', { clueing: 'Who?' })])
    const after = quizOf([questionOf('brave_ox', { clueing: 'Who now?' })])
    expect(linesOf(before, after)).to.deep.eq(['quiz ~label', '-quiet_otter', '+brave_ox'])
  })

  it('reports both quizzes and questions in one pass', () => {
    const before = quizOf([questionOf('quiet_otter')])
    const after = { ...before, title: 'Renamed', questions: [{ ...present(before.questions[0]), hint: 'BUT NOT a stoat' }] }
    expect(linesOf(before, after)).to.deep.eq(['quiz ~title', 'quiet_otter +hint'])
  })
})

// How one field moving is classified, which is the whole vocabulary of the shorthand:
const TitleChangeCases: [string, string, string, string][] = [
  // regular usage:
  ['',          'Hamlet',     'quiz +title',  'blank to something: the field was set'],
  ['Hamlet',    'Macbeth',    'quiz ~title',  'something to something else: the field was revised'],
  ['Hamlet',    '',           'quiz -title',  'something back to blank: the field was cleared'],
  // trivial cases:
  ['Hamlet',    'Hamlet',     '',             'unchanged: nothing worth a commit'],
  ['',          '',           '',             'blank throughout: nothing worth a commit'],
  // not-quite-absurd cases:
  ['Hamlet',    ' Hamlet',    'quiz ~title',  'a leading space is a revision, since the tool never trims what an author typed'],
  ['Hamlet',    'hamlet',     'quiz ~title',  'case alone is a revision'],
  ['Hamlet',    ' '.repeat(3), 'quiz ~title',  'whitespace is not blankness -- only a truly empty string is'],
]

describe('quizChanges, over one field', () => {
  for (const [was, now, expected, describes] of TitleChangeCases) {
    it(describes, () => {
      const before = quizOf([], { title: was })
      expect(linesOf(before, { ...before, title: now }).join('; ')).to.eq(expected)
    })
  }
})

describe('quizChanges, over the questions', () => {
  it('reports an arriving question as itself, with none of its fields', () => {
    const before = quizOf([questionOf('quiet_otter')])
    const after = { ...before, questions: [...before.questions, questionOf('brave_ox', { clueing: 'Who?' })] }
    expect(linesOf(before, after)).to.deep.eq(['+brave_ox'])
  })

  it('reports a departing question as itself', () => {
    const before = quizOf([questionOf('quiet_otter'), questionOf('old_mole')])
    const after = { ...before, questions: [present(before.questions[0])] }
    expect(linesOf(before, after)).to.deep.eq(['-old_mole'])
  })

  it('reports a reordering without claiming any question changed', () => {
    const before = quizOf([questionOf('quiet_otter'), questionOf('brave_ox')])
    const after = { ...before, questions: [present(before.questions[1]), present(before.questions[0])] }
    expect(linesOf(before, after)).to.deep.eq(['quiz @order'])
  })

  it('does not call it a reordering when a question was merely removed from the middle', () => {
    const before = quizOf([questionOf('one_a'), questionOf('two_b'), questionOf('three_c')])
    const after = { ...before, questions: [present(before.questions[0]), present(before.questions[2])] }
    expect(linesOf(before, after)).to.deep.eq(['-two_b'])
  })

  it('gathers every field one question moved onto a single line', () => {
    const before = quizOf([questionOf('quiet_otter', { hint: 'BUT NOT a stoat', notes: 'check this' })])
    const after = {
      ...before,
      questions: [{ ...present(before.questions[0]), clueing: 'Who?', hint: 'BUT NOT a weasel', notes: '' }],
    }
    expect(linesOf(before, after)).to.deep.eq(['quiet_otter +clueing ~hint -notes'])
  })
})

describe('shorthandFor', () => {
  it('says nothing at all when nothing changed, so nothing gets committed', () => {
    expect(Changes.shorthandFor([])).to.eq(null)
  })

  it('is the one line when one entity moved', () => {
    expect(shortOf(null, Quiz.blank())).to.eq('+quiz')
  })

  it('joins the entities that moved onto one line', () => {
    const before = quizOf([questionOf('quiet_otter')])
    const after = { ...before, title: 'Renamed', questions: [{ ...present(before.questions[0]), hint: 'BUT NOT a stoat' }] }
    expect(shortOf(before, after)).to.eq('quiz ~title; quiet_otter +hint')
  })

  it('cuts itself down to a count rather than outrunning a commit subject', () => {
    const questions = Array.from({ length: 9 }, (_unused, idx) => questionOf(`question_number_${'abcdefghi'[idx] ?? 'z'}`))
    const before = quizOf(questions)
    const after = { ...before, questions: questions.map((question) => ({ ...question, clueing: 'Who?' })) }
    const subject = shortOf(before, after) ?? ''
    expect(subject).to.eq('question_number_a +clueing; +8 more')
    expect(subject.length).to.be.at.most(Changes.SubjectMax)
  })

  it('never repeats the data itself -- only the body and the tree hold an author\'s words', () => {
    const secret = 'Which Danish prince dithers?'
    const before = quizOf([questionOf('quiet_otter')])
    const after = {
      ...before,
      title:     secret,
      questions: [{ ...present(before.questions[0]), clueing: secret, hint: secret, notes: secret }],
    }
    const subject = shortOf(before, after) ?? ''
    expect(subject).to.not.include(secret)
    expect(subject).to.not.include('Danish')
    expect(subject).to.eq('quiz ~title; quiet_otter +clueing +hint +notes')
  })
})
