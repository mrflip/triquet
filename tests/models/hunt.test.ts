import { describe, expect, it } from 'vitest'
import * as Z from 'zod'
import { Hunt, HuntValidators } from '../../src/models/hunt'
import { Expression, SeedExpressions } from '../../src/models/expression'
import { defaultLayoutFor } from '../../src/models/layout'
import { Quiz, type QuizDNA } from '../../src/models/quiz'
import { mintId } from '../../src/lib/ids'
import { present } from '../support/present'

/** A hunt of one realm, `home`, holding `quizzes` */
function homeHolding(quizzes: QuizDNA[], extra: object = {}) {
  return { _id: mintId(), label: 'quiet_otter', realms: [{ _id: mintId(), label: 'home', quizzes }], ...extra }
}

describe('Hunt.fill', () => {
  it('holds the realms and quizzes it is given, titled after its label when untitled', () => {
    const hunt = Hunt.fill(homeHolding([Quiz.blank('Quiz one')]))
    expect([hunt.title, hunt.realms.map((realm) => [realm.label, realm.title]), Hunt.quizzesOf(hunt).map((quiz) => quiz.title)])
      .to.deep.eq(['Quiet Otter', [['home', 'Home']], ['Quiz one']])
  })

  it('keeps a title it is given', () => {
    const hunt = Hunt.fill(homeHolding([Quiz.blank()], { title: 'Autumn Hunt' }))
    expect(hunt.title).to.eq('Autumn Hunt')
  })

  it('titles itself after its override when it has one', () => {
    const hunt = Hunt.fill(homeHolding([Quiz.blank()], { forced_label: 'loud_heron' }))
    expect(hunt.title).to.eq('Loud Heron')
  })

  const Refused: [object, string][] = [
    [homeHolding([]),                                                                                              'a realm holding no quiz'],
    [{ _id: mintId(), label: 'quiet_otter', realms: [] },                                                         'a hunt holding no realm'],
    [{ _id: mintId(), label: 'Quiet Otter', realms: [{ _id: mintId(), quizzes: [Quiz.blank()] }] },                 'a label that is not one'],
    [{ _id: mintId(), label: 'quiet_otter', realms: [{ _id: mintId(), quizzes: [Quiz.blank()] }, { _id: mintId(), quizzes: [Quiz.blank()] }] }, 'two realms sharing a label'],
    [homeHolding([Quiz.blank('', 'princes'), Quiz.blank('', 'princes')]),                                         'two quizzes of a realm sharing a label'],
  ]
  for (const [dna, describes] of Refused) {
    it(`refuses ${describes}`, () => {
      expect(() => Hunt.fill(dna as never)).to.throw(Z.ZodError)
    })
  }

  it('lets two realms each hold a quiz of one label', () => {
    const hunt = Hunt.fill({
      _id:    mintId(),
      label:  'quiet_otter',
      realms: [{ _id: mintId(), label: 'home', quizzes: [Quiz.blank('', 'princes')] }, { _id: mintId(), label: 'away', quizzes: [Quiz.blank('', 'princes')] }],
    })
    expect(Hunt.quizzesOf(hunt).map((quiz) => quiz.label)).to.deep.eq(['princes', 'princes'])
  })
})

describe('Hunt.blank', () => {
  it('holds one realm, home, holding one blank quiz sharing the hunt\'s label and so its title', () => {
    const hunt = Hunt.blank('quiet_otter')
    const [realm] = hunt.realms
    const [quiz] = present(realm).quizzes
    expect([hunt.label, hunt.title, present(realm).label, present(quiz).label, present(quiz).title]).to.deep.eq(['quiet_otter', 'Quiet Otter', 'home', 'quiet_otter', 'Quiet Otter'])
  })

  it('starts with the standard expressions, its quiz showing the standard columns', () => {
    const hunt = Hunt.blank()
    const layout = defaultLayoutFor(SeedExpressions)
    expect(hunt.expressions).to.deep.eq([...SeedExpressions])
    expect([Hunt.quizzesOf(hunt)[0]?.widgets, Hunt.quizzesOf(hunt)[0]?.columns]).to.deep.eq([layout.widgets, layout.columns])
  })

  it('mints a label when it is given none', () => {
    expect(Hunt.blank().label).to.match(/^[a-z]+_[a-z]+/)
  })
})

describe('Hunt.fill with expressions', () => {
  const quiz = Quiz.blank('Quiz one')
  const widget = { kind: 'expressing' as const, label: 'lettered', expression_label: 'answer_letter_count' }
  const expression = Expression.fill({ label: 'answer_letter_count', formula: '$length(qn.full_answer)' })

  it('accepts a widget naming an expression the hunt holds', () => {
    const hunt = Hunt.fill(homeHolding([{ ...quiz, widgets: [widget] }], { expressions: [expression] }))
    expect(Hunt.quizzesOf(hunt)[0]?.widgets).to.have.length(1)
  })

  it('refuses a widget naming an expression the hunt does not hold, saying which widget', () => {
    const outcome = HuntValidators.hunt.safeParse(homeHolding([{ ...quiz, widgets: [widget] }]))
    expect(outcome.success).to.eq(false)
    expect(outcome.error?.issues[0]?.path).to.deep.eq(['realms', 0, 'quizzes', 0, 'widgets', 0, 'expression_label'])
  })

  it('refuses two expressions sharing an owner and a label', () => {
    expect(() => Hunt.fill(homeHolding([quiz], { expressions: [expression, { ...expression, formula: '1' }] }))).to.throw(Z.ZodError)
  })

  it('defaults to holding no expressions', () => {
    expect(Hunt.fill(homeHolding([quiz])).expressions).to.deep.eq([])
  })
})

describe('Hunt.realmFor', () => {
  it('finds a realm by label, or nothing', () => {
    const hunt = Hunt.blank()
    expect([Hunt.realmFor(hunt, 'home')?.label, Hunt.realmFor(hunt, 'away')]).to.deep.eq(['home', undefined])
  })
})

describe('Hunt.expressionUsage', () => {
  it('counts the widgets, across every quiz of every realm, that work an expression', () => {
    const blank = Hunt.blank()
    const [first] = Hunt.quizzesOf(blank)
    const hunt = Hunt.fill({ ...blank, realms: [...blank.realms, { _id: mintId(), label: 'away', quizzes: [{ ...present(first), _id: mintId() }] }] })
    expect([Hunt.expressionUsage(hunt, 'clueing_full'), Hunt.expressionUsage(hunt, 'answer_reversed')]).to.deep.eq([2, 0])
  })
})

describe('HuntValidators.row', () => {
  const Row = { label: 'quiet_otter', forced_label: null, title: 'Quiet Otter' }

  it('takes a hunt as the database holds it', () => {
    expect(HuntValidators.row(Row)).to.deep.eq(Row)
    expect(HuntValidators.row({ ...Row, forced_label: 'autumn' }).forced_label).to.eq('autumn')
  })

  it('refuses a label that is not one', () => {
    expect(() => HuntValidators.row({ ...Row, label: 'Quiet Otter' })).to.throw(Z.ZodError)
  })
})
