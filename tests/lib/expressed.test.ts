import { describe, expect, it } from 'vitest'
import * as Expressed from '../../src/lib/expressed'
import { Expression, SeedExpressions, type ExpressionT } from '../../src/models/expression'
import { Expressing } from '../../src/models/widget'
import { defaultLayoutFor } from '../../src/models/layout'
import { Question, type QuestionT } from '../../src/models/question'
import { Quiz, type QuizT } from '../../src/models/quiz'
import type { IshItemT, IshesT } from '../../src/models/ish'
import { present } from '../support/present'
import { Here } from '../support/places'

/** A finished extraction holding the spans given */
function extracted(items: IshItemT[], stale = false): IshesT {
  return { status: 'done', items, truncated: false, stale, updated_at: 1, last_err: null }
}

const numeral = (text: string, value: number): IshItemT => ({ text, value, kind: 'numeral' })
const wordish = (text: string, value: number): IshItemT => ({ text, value, kind: 'wordish' })

/** One question with the extractions given */
function loneQuestion(patch: Partial<QuestionT>): QuestionT {
  return { ...Question.blank(), qnum: '1', ...patch }
}

/** A quiz of `questions` showing the eight standard sum columns */
function standardQuiz(questions: QuestionT[]): QuizT {
  return { ...Quiz.blank('Standard'), questions, ...defaultLayoutFor(SeedExpressions) }
}

/** What the standard column `label` came to for `question`, in a quiz of `questions` */
function sumOf(questions: QuestionT[], question: QuestionT, label: string): Expressed.Expressed {
  return Expressed.readingOf(Expressed.forQuiz(standardQuiz(questions), SeedExpressions, Here), label, question._id)
}

const valued = (val: number, stale = false): Expressed.Expressed => ({ status: 'value', val, stale })
const Nothing: Expressed.Expressed = { status: 'nothing' }
const byText = (aa: string, bb: string) => aa.localeCompare(bb)

describe('the standard sum columns', () => {
  it('add every ish in the clueing, and the digit-written ones on their own', () => {
    const question = loneQuestion({ clueing_ishes: extracted([numeral('300', 300), wordish('a dozen', 12)]) })
    expect(sumOf([question], question, 'clueing_full')).to.deep.eq(valued(312))
    expect(sumOf([question], question, 'clueing_numeral')).to.deep.eq(valued(300))
  })

  it('round a sum to a whole number, halves upward, while the items keep their fractions', () => {
    const cases: [number[], number][] = [[[0.25, 0.5], 1], [[0.5], 1], [[0.4], 0], [[2.5], 3], [[-0.5], 0]]
    const readings = cases.map(([values]) => {
      const question = loneQuestion({ clueing_ishes: extracted(values.map((val) => wordish('some', val))) })
      return sumOf([question], question, 'clueing_full')
    })
    expect(readings).to.deep.eq(cases.map(([, expected]) => valued(expected)))
  })

  it('read an empty extraction as nought, which is a real answer', () => {
    const question = loneQuestion({ clueing_ishes: extracted([]) })
    expect(sumOf([question], question, 'clueing_full')).to.deep.eq(valued(0))
  })

  it('read an extraction with no digit-written spans as nought for the numeral sum', () => {
    const question = loneQuestion({ clueing_ishes: extracted([wordish('a dozen', 12)]) })
    expect(sumOf([question], question, 'clueing_numeral')).to.deep.eq(valued(0))
  })

  it('read a never-asked cell as nothing at all, not as nought', () => {
    const question = loneQuestion({})
    expect(sumOf([question], question, 'clueing_full')).to.deep.eq(Nothing)
  })

  it('read a failed ask as nothing at all', () => {
    const question = loneQuestion({ clueing_ishes: { status: 'error', message: 'A connection hiccup — try again.', updated_at: 1, last_err: { message: 'A connection hiccup — try again.', response: { ok: false }, at: 1 } } })
    expect(sumOf([question], question, 'clueing_full')).to.deep.eq(Nothing)
  })

  it('add the rank, not the Q#, so the meta-puzzle survives gappy numbering', () => {
    const early = { ...Question.blank(), qnum: '3', clueing_ishes: extracted([numeral('300', 300)]) }
    const late  = { ...Question.blank(), qnum: '40' }
    expect(sumOf([early, late], early, 'clueing_plus_rank')).to.deep.eq(valued(301))
  })

  it('leave Clueing + Rank empty when the question is unranked', () => {
    const question = loneQuestion({ qnum: '', clueing_ishes: extracted([numeral('300', 300)]) })
    expect(sumOf([question], question, 'clueing_plus_rank')).to.deep.eq(Nothing)
  })

  it('borrow the chained-to question\'s hint for the BUT NOT columns', () => {
    const target = { ...Question.blank(), qnum: '2', hint_ishes: extracted([numeral('1994', 1994), wordish('twelve', 12)]) }
    const question = { ...Question.blank(), qnum: '1', chains_to: target._id }
    expect(sumOf([question, target], question, 'butnot_full')).to.deep.eq(valued(2006))
    expect(sumOf([question, target], question, 'butnot_numeral')).to.deep.eq(valued(1994))
  })

  it('read this question\'s own hint separately from the one it borrows', () => {
    const target = { ...Question.blank(), qnum: '2', hint_ishes: extracted([numeral('1994', 1994)]) }
    const question = { ...Question.blank(), qnum: '1', chains_to: target._id, hint_ishes: extracted([numeral('7', 7)]) }
    expect(sumOf([question, target], question, 'hint_full')).to.deep.eq(valued(7))
    expect(sumOf([question, target], question, 'hint_numeral')).to.deep.eq(valued(7))
    expect(sumOf([question, target], question, 'butnot_full')).to.deep.eq(valued(1994))
  })

  it('leave the BUT NOT columns empty when nothing is chained', () => {
    const question = loneQuestion({ clueing_ishes: extracted([numeral('300', 300)]) })
    expect(sumOf([question], question, 'butnot_full')).to.deep.eq(Nothing)
  })

  it('leave the BUT NOT columns empty when the chained-to question has no extraction', () => {
    const target = { ...Question.blank(), qnum: '2' }
    const question = { ...Question.blank(), qnum: '1', chains_to: target._id }
    expect(sumOf([question, target], question, 'butnot_full')).to.deep.eq(Nothing)
  })

  it('add the clueing and the borrowed hint for the widest reading', () => {
    const target = { ...Question.blank(), qnum: '2', hint_ishes: extracted([numeral('1994', 1994)]) }
    const question = { ...Question.blank(), qnum: '1', chains_to: target._id, clueing_ishes: extracted([numeral('6', 6)]) }
    expect(sumOf([question, target], question, 'clueing_plus_butnot_full')).to.deep.eq(valued(2000))
  })

  it('leave Clueing+BUT NOT empty unless both halves exist', () => {
    const question = loneQuestion({ clueing_ishes: extracted([numeral('6', 6)]) })
    expect(sumOf([question], question, 'clueing_plus_butnot_full')).to.deep.eq(Nothing)
  })

  it('follow a chain by the label in force, so an author\'s override still finds its target', () => {
    const target = { ...Question.blank(), qnum: '2', forced_label: 'the_film', hint_ishes: extracted([numeral('1994', 1994)]) }
    const question = { ...Question.blank(), qnum: '1', chains_to: target._id }
    expect(sumOf([question, target], question, 'butnot_full')).to.deep.eq(valued(1994))
  })

  describe('staleness', () => {
    it('marks a sum stale when its own extraction is stale, and keeps the out-of-date number', () => {
      const question = loneQuestion({ clueing_ishes: extracted([numeral('300', 300)], true) })
      expect(sumOf([question], question, 'clueing_full')).to.deep.eq(valued(300, true))
    })

    it('passes staleness on to a question borrowing a stale hint', () => {
      const target = { ...Question.blank(), qnum: '2', hint_ishes: extracted([numeral('1994', 1994)], true) }
      const question = { ...Question.blank(), qnum: '1', chains_to: target._id }
      expect(sumOf([question, target], question, 'butnot_full')).to.deep.eq(valued(1994, true))
    })

    it('marks a combined sum stale when either half is', () => {
      const target = { ...Question.blank(), qnum: '2', hint_ishes: extracted([numeral('1994', 1994)], true) }
      const question = { ...Question.blank(), qnum: '1', chains_to: target._id, clueing_ishes: extracted([numeral('6', 6)]) }
      expect(sumOf([question, target], question, 'clueing_plus_butnot_full')).to.deep.eq(valued(2000, true))
    })
  })
})

describe('the standard text columns', () => {
  const textQuiz = (patch: Partial<QuestionT>, label: string): Expressed.Expressed => {
    const question = { ...Question.blank(), ...patch }
    const quiz = { ...Quiz.blank('Words'), questions: [question], widgets: [Expressing.fill({ kind: 'expressing', label, expression_label: label })] }
    return Expressed.readingOf(Expressed.forQuiz(quiz, SeedExpressions, Here), label, question._id)
  }

  const Cases: [string, Partial<QuestionT>, Expressed.Expressed, string][] = [
    // label                  patch                                 expected                                            blurb
    ['clueing_word_count',    { clueing: 'Who wrote  this, then?' }, { status: 'value', val: 4, stale: false },        'words are counted across any run of spaces'],
    ['clueing_word_count',    { clueing: '' },                       { status: 'value', val: 0, stale: false },        'an empty clueing has no words'],
    ['clueing_word_count',    { clueing: '  padded\n' },             { status: 'value', val: 1, stale: false },        'surrounding space is not a word'],
    ['answer_letter_count',   { full_answer: 'Don\'t Stop!' },       { status: 'value', val: 8, stale: false },        'only letters are counted'],
    ['answer_letter_count',   { full_answer: '' },                   { status: 'value', val: 0, stale: false },        'an empty answer has no letters'],
    ['answer_reversed',       { full_answer: 'stressed' },           { status: 'value', val: 'desserts', stale: false }, 'the answer is written backward'],
    ['answer_reversed',       { full_answer: '' },                   { status: 'nothing' },                            'an empty answer reverses to nothing'],
    ['answer_alphabetized',   { full_answer: 'Hello, World' },       { status: 'value', val: 'dehllloorw', stale: false }, 'letters sorted, case and punctuation ignored'],
  ]
  for (const [label, patch, expected, blurb] of Cases) {
    it(`${label}: ${blurb}`, () => {
      expect(textQuiz(patch, label)).to.deep.eq(expected)
    })
  }
})

/** A quiz of `questions` with one computed column, `col`, working a formula of its own */
function columnQuiz(formula: string, questions: QuestionT[] = [loneQuestion({})]): { quiz: QuizT, expressions: ExpressionT[] } {
  return {
    quiz:        { ...Quiz.blank('Custom'), questions, widgets: [Expressing.fill({ kind: 'expressing', label: 'col', expression_label: 'custom' })] },
    expressions: [Expression.fill({ label: 'custom', formula })],
  }
}

describe('clueing_with_butnot', () => {
  const foldedFor = (clueing: string, hint: string | null): Expressed.Expressed => {
    const target = { ...Question.blank(), qnum: '2', hint: hint ?? '' }
    const question = { ...Question.blank(), qnum: '1', clueing, chains_to: hint === null ? null : target._id }
    const quiz = { ...Quiz.blank('Fold'), questions: [question, target], widgets: [Expressing.fill({ kind: 'expressing', label: 'folded', expression_label: 'clueing_with_butnot' })] }
    return Expressed.readingOf(Expressed.forQuiz(quiz, SeedExpressions, Here), 'folded', question._id)
  }
  const said = (val: string): Expressed.Expressed => ({ status: 'value', val, stale: false })

  const Cases: [string, string | null, Expressed.Expressed, string][] = [
    // clueing          hint                   expected                                        blurb
    ['Which region?',   'BUT NOT the film',    said('Which region? ... BUT NOT the film'),     'joins a clueing to a hint that already says BUT NOT'],
    ['Which region?',   'the film',            said('Which region? ... BUT NOT ... the film'), 'supplies the phrase when the hint does not carry it'],
    ['Which region?',   'but not the film',    said('Which region? ... but not the film'),     'does not care how the hint is capitalised'],
    ['Which region?',   '',                    said('Which region?'),                           'leaves the clueing alone when the chained-to question has no hint'],
    ['Which region?',   ' '.repeat(3),               said('Which region?'),                           'leaves the clueing alone when the hint is only space'],
    ['Which region?',   null,                  said('Which region?'),                           'leaves the clueing alone when nothing is chained'],
    ['',                null,                  { status: 'nothing' },                           'reads an empty clueing with nothing to fold as nothing'],
  ]
  for (const [clueing, hint, expected, blurb] of Cases) {
    it(blurb, () => {
      expect(foldedFor(clueing, hint)).to.deep.eq(expected)
    })
  }
})

describe('forQuiz', () => {
  const readingFor = (formula: string): Expressed.Expressed => {
    const { quiz, expressions } = columnQuiz(formula)
    return Expressed.readingOf(Expressed.forQuiz(quiz, expressions, Here), 'col', present(quiz.questions[0])._id)
  }

  const Cases: [string, Expressed.Expressed, string][] = [
    // formula                              expected                                                    blurb
    ["6 * 7",                               { status: 'value', val: 42, stale: false },                 'a number is shown as a number'],
    ["'hello'",                             { status: 'value', val: 'hello', stale: false },            'text is shown as text'],
    ["1 = 1",                               { status: 'value', val: true, stale: false },               'a boolean is shown as one'],
    ["[1, 2, 3]",                           { status: 'value', val: '[1,2,3]', stale: false },          'a list is shown as its JSON'],
    ["{ 'b': 2, 'a': 1 }",                  { status: 'value', val: '{"a":1,"b":2}', stale: false },    'an object is shown as its JSON, keys in order'],
    ["{ 'value': 5, 'stale': true }",       { status: 'value', val: 5, stale: true },                    'a value with a stale mark is shown greyed'],
    ["{ 'value': 5 }",                      { status: 'value', val: 5, stale: false },                  'a value marked with nothing is not stale'],
    ["{ 'value': nothing, 'stale': true }", { status: 'nothing' },                                       'a stale mark with no value behind it is nothing'],
    ["nothing.at.all",                      { status: 'nothing' },                                       'a path that leads nowhere is nothing'],
    ["''",                                  { status: 'nothing' },                                       'an empty string is nothing'],
    ["$exists(nothing) ? 1",                { status: 'nothing' },                                       'a condition with no else is nothing'],
    ["$sum",                                { status: 'error', message: 'The formula came to a function rather than a value' }, 'a function is not a value'],
  ]
  for (const [formula, expected, blurb] of Cases) {
    it(blurb, () => {
      expect(readingFor(formula)).to.deep.eq(expected)
    })
  }

  it('reports a formula that does not parse as an error in its own cells, and no others', () => {
    const [aa, bb] = [loneQuestion({}), loneQuestion({})]
    const quiz = {
      ...Quiz.blank('Two columns'),
      questions:   [aa, bb],
      widgets: [
        Expressing.fill({ kind: 'expressing', label: 'bad', expression_label: 'broken' }),
        Expressing.fill({ kind: 'expressing', label: 'fine', expression_label: 'steady' }),
      ],
    }
    const expressed = Expressed.forQuiz(quiz, [Expression.fill({ label: 'broken', formula: '$sum(' }), Expression.fill({ label: 'steady', formula: '3' })], Here)
    expect(Expressed.readingOf(expressed, 'bad', aa._id).status).to.eq('error')
    expect(Expressed.readingOf(expressed, 'fine', aa._id)).to.deep.eq(valued(3))
    expect(Expressed.readingOf(expressed, 'fine', bb._id)).to.deep.eq(valued(3))
  })

  it('reports an expression that has been deleted as an error, naming it', () => {
    const { quiz } = columnQuiz('1')
    const reading = Expressed.readingOf(Expressed.forQuiz(quiz, [], Here), 'col', present(quiz.questions[0])._id)
    expect(reading).to.deep.eq({ status: 'error', message: 'There is no expression called "custom" any more' })
  })

  it('stops a formula that will not end, and does not wait on it again for the rest of the column', () => {
    const questions = Array.from({ length: 30 }, () => loneQuestion({}))
    const { quiz, expressions } = columnQuiz('( $spin := function() { $spin() }; $spin() )', questions)
    const beganAt = Date.now()
    const expressed = Expressed.forQuiz(quiz, expressions, Here)
    expect(Date.now() - beganAt).to.be.lessThan(1500)
    const readings = questions.map((question) => Expressed.readingOf(expressed, 'col', question._id))
    expect(new Set(readings.map((reading) => reading.status))).to.deep.eq(new Set(['error']))
  })

  it('has no columns for a quiz that shows none', () => {
    expect(Expressed.forQuiz(Quiz.blank(), SeedExpressions, Here).size).to.eq(0)
  })

  it('reads nothing where the column or the question is not there', () => {
    const { quiz, expressions } = columnQuiz('1')
    const expressed = Expressed.forQuiz(quiz, expressions, Here)
    expect(Expressed.readingOf(expressed, 'absent', 'nobody')).to.deep.eq(Nothing)
    expect(Expressed.readingOf(expressed, 'col', 'nobody')).to.deep.eq(Nothing)
  })
})

describe('bagsFor', () => {
  const target = { ...Question.blank(), qnum: '2', title: 'The film', forced_label: 'the_film' }
  const question = { ...Question.blank(), qnum: '1', title: 'The book', chains_to: target._id }
  const quiz = { ...Quiz.blank('Bag'), forced_label: 'my_quiz', questions: [question, target] }
  const bags = Expressed.bagsFor(quiz, Here)
  const bag = present(bags.get(question._id))

  it('gives each question its own bag, in the quiz\'s order', () => {
    expect(bags.keys().toArray()).to.deep.eq([question._id, target._id])
  })

  it('holds the question being worked out as `qn`, the very object also found in `qns`', () => {
    expect(bag.qn).to.eq(present(bag.qns[0]))
    expect(bag.qns).to.have.length(2)
  })

  it('names the question and the quiz by the label in force', () => {
    expect(bag.qn_label).to.eq(question.label)
    expect(bag.quiz_label).to.eq('my_quiz')
    expect(present(bag.qns[1]).label).to.eq('the_film')
  })

  it('strips ids everywhere, and names a chain by the target\'s label', () => {
    expect(bag.qn).to.not.have.property('id')
    expect(bag.quiz).to.not.have.property('id')
    expect(bag.qn.chains_to).to.eq('the_film')
  })

  it('leaves the quiz\'s own questions and columns out of `quiz`', () => {
    expect(bag.quiz).to.not.have.any.keys('questions', 'widgets', 'columns')
    expect(bag.quiz).to.include({ title: 'Bag', label: 'my_quiz' })
  })

  it('gives each question its rank, and null to one with no Q#', () => {
    const unranked = { ...Question.blank(), qnum: '' }
    const ranked = Expressed.bagsFor({ ...quiz, questions: [target, question, unranked] }, Here)
    expect(ranked.values().map((each) => each.qn.rank).toArray()).to.deep.eq([2, 1, null])
  })

  it('names an unchained question\'s chain as null', () => {
    expect(present(bags.get(target._id)).qn.chains_to).to.eq(null)
  })
})

describe('sortValueOf', () => {
  const Cases: [Expressed.Expressed, Expressed.ExpressedSortValue, string][] = [
    [{ status: 'value', val: 7, stale: false },     7,    'a number sorts as itself'],
    [{ status: 'value', val: 'abc', stale: true },  'abc', 'text sorts as itself, stale or not'],
    [{ status: 'value', val: true, stale: false },  1,    'a boolean sorts as 1'],
    [{ status: 'value', val: false, stale: false }, 0,    'a boolean sorts as 0'],
    [{ status: 'nothing' },                         null, 'nothing has no value to sort by'],
    [{ status: 'error', message: 'no' },            null, 'a failure has no value to sort by'],
  ]
  for (const [reading, expected, blurb] of Cases) {
    it(blurb, () => {
      expect(Expressed.sortValueOf(reading)).to.eq(expected)
    })
  }
})

describe('what a bag exposes', () => {
  const answered = {
    ...Question.blank(), qnum: '1', title: 'Leon', forced_label: 'leon_q',
    guess: { status: 'done' as const, text: 'Lyon', truncated: true, model_tier_applied: 'quick' as const, approx_tokens: 84, updated_at: 5, last_err: { message: 'no', response: { ok: false }, at: 9 } },
    clueing_ishes: { status: 'done' as const, items: [numeral('3', 3)], truncated: true, stale: true, model_tier_applied: 'careful' as const, approx_tokens: 10, updated_at: 5, last_err: null },
    hint_ishes: { status: 'error' as const, message: 'Too many requests.', updated_at: 5, last_err: { message: 'Too many requests.', response: { ok: false }, at: 5 } },
  }
  const quiz = { ...Quiz.blank('Bag'), forced_label: 'my_quiz', locked: true, questions: [answered] }
  const { qn, quiz: quizBag } = present(Expressed.bagsFor(quiz, Here).get(answered._id))

  it('gives a question only its exposed fields, with the label in force and the rank', () => {
    expect(Object.keys(qn).toSorted(byText)).to.deep.eq([...Question.exposed, 'clueing_ishes', 'guess', 'hint_ishes', 'rank'].toSorted(byText))
  })

  it('shows a guess as its status and its text, and nothing about cost, model, time, truncation or failure', () => {
    expect(qn.guess).to.deep.eq({ status: 'done', text: 'Lyon' })
  })

  it('shows an extraction as its status, spans and staleness only', () => {
    expect(qn.clueing_ishes).to.deep.eq({ status: 'done', items: [numeral('3', 3)], stale: true })
  })

  it('shows a cell that only ever failed as just that, with no message', () => {
    expect(qn.hint_ishes).to.deep.eq({ status: 'error' })
  })

  it('shows a question never asked as null', () => {
    const bare = present(Expressed.bagsFor({ ...quiz, questions: [Question.blank()] }, Here).values().next().value)
    expect([bare.qn.guess, bare.qn.clueing_ishes]).to.deep.eq([null, null])
  })

  it("gives the quiz only its label, smith's note and title, not its lock, version, remembered sort or cost", () => {
    expect(quizBag).to.deep.eq({ label: 'my_quiz', smiths_note: '', title: 'Bag' })
  })

  it('gives the hunt and the realm only their labels and titles', () => {
    const bag = present(Expressed.bagsFor(quiz, Here).get(answered._id))
    expect([bag.hunt, bag.realm]).to.deep.eq([{ label: 'deep_lake', title: 'Deep Lake' }, { label: 'home', title: 'Home' }])
  })
})

describe('placeOf', () => {
  const Cases: [Parameters<typeof Expressed.placeOf>, Expressed.QuizPlace, string][] = [
    [[{ label: 'deep_lake', forced_label: null,    title: '' },          { label: 'home',   title: '' }],
      { hunt: { label: 'deep_lake', title: 'Deep Lake' },  realm: { label: 'home',   title: 'Home' } },          'blank titles read as the labels titleized'],
    [[{ label: 'deep_lake', forced_label: 'tarn',  title: '' },          { label: 'home',   title: '' }],
      { hunt: { label: 'tarn',      title: 'Tarn' },       realm: { label: 'home',   title: 'Home' } },          "the hunt's forced label is the one in force, and titles a blank title"],
    [[{ label: 'deep_lake', forced_label: 'tarn',  title: 'Lakeside' },  { label: 'finals', title: 'The Finals' }],
      { hunt: { label: 'tarn',      title: 'Lakeside' },   realm: { label: 'finals', title: 'The Finals' } },    'titles of their own are kept as they are'],
  ]
  for (const [[hunt, realm], expected, blurb] of Cases) {
    it(blurb, () => {
      expect(Expressed.placeOf(hunt, realm)).to.deep.eq(expected)
    })
  }

  it('leaves out everything a hunt or realm holds besides its exposed fields', () => {
    const hunt = { _id: 'hunt_id', label: 'deep_lake', forced_label: null, title: 'Deep Lake', realms: [], expressions: [] }
    const realm = { _id: 'realm_id', label: 'home', title: 'Home', quizzes: [] }
    expect(Expressed.placeOf(hunt, realm)).to.deep.eq({ hunt: { label: 'deep_lake', title: 'Deep Lake' }, realm: { label: 'home', title: 'Home' } })
  })
})

describe('what a formula can read of where its quiz sits', () => {
  const question = loneQuestion({ full_answer: 'Leon' })
  const quiz = { ...Quiz.blank('Princes'), smiths_note: 'Meta: their initials.', questions: [question] }
  const place = Expressed.placeOf({ label: 'deep_lake', forced_label: null, title: 'The Deep Lake Hunt' }, { label: 'finals', title: '' })
  const bag = Expressed.bagsFor(quiz, place).get(question._id)
  const Cases: [string, Expressed.Expressed, string][] = [
    ["hunt.title",                          { status: 'value', val: 'The Deep Lake Hunt', stale: false },  "the hunt's title"],
    ["hunt.label & '/' & realm.label",      { status: 'value', val: 'deep_lake/finals', stale: false },    "the hunt's and the realm's labels"],
    ["realm.title",                         { status: 'value', val: 'Finals', stale: false },              "the realm's title, as shown"],
    ["quiz.smiths_note",                    { status: 'value', val: 'Meta: their initials.', stale: false }, "the smith's note"],
    ["hunt._id",                            { status: 'nothing' },                                         'no id'],
  ]
  for (const [formula, expected, blurb] of Cases) {
    it(blurb, () => {
      expect(Expressed.previewOf(formula, bag)).to.deep.eq(expected)
    })
  }
})
