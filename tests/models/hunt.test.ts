import { describe, expect, it } from 'vitest'
import * as Z from 'zod'
import { Hunt, HuntValidators } from '../../src/models/hunt'
import { defaultLayout } from '../../src/models/layout'
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

  it('holds 99 realms, and refuses a hundredth', () => {
    const realms = Array.from({ length: 100 }, (_unused, idx) => ({ _id: mintId(), label: `realm_${String(idx)}`, quizzes: [Quiz.blank()] }))
    expect(Hunt.fill({ _id: mintId(), label: 'quiet_otter', realms: realms.slice(0, 99) }).realms).to.have.lengthOf(99)
    expect(() => Hunt.fill({ _id: mintId(), label: 'quiet_otter', realms })).to.throw(Z.ZodError)
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

  it('starts its quiz as a new quiz starts: the starter columns, and no widgetings', () => {
    const hunt = Hunt.blank()
    const layout = defaultLayout()
    expect([Hunt.quizzesOf(hunt)[0]?.widgetings, Hunt.quizzesOf(hunt)[0]?.columns]).to.deep.eq([[], layout.columns])
  })

  it('holds no widgets of its own, which are the library\'s', () => {
    expect(Hunt.blank()).not.to.have.property('expressions')
    expect(Hunt.blank()).not.to.have.property('widgets')
  })

  it('mints a label when it is given none', () => {
    expect(Hunt.blank().label).to.match(/^[a-z]+_[a-z]+/)
  })
})

describe('Hunt.fill with widgetings', () => {
  const quiz = { ...Quiz.blank('Quiz one'), widgetings: [{ widget_label: 'answer_letter_count', label: 'lettered' }] }

  it("takes a quiz's widgetings whatever widgets they name, which the library rather than the hunt holds", () => {
    const [filled] = Hunt.quizzesOf(Hunt.fill(homeHolding([quiz])))
    expect(filled?.widgetings.map((widgeting) => widgeting.label)).to.deep.eq(['lettered'])
  })

  it("drops expressions, which a hunt no longer holds", () => {
    expect(Hunt.fill(homeHolding([quiz], { expressions: [{ label: 'answer_letter_count', formula: '1' }] }))).not.to.have.property('expressions')
  })
})

describe('Hunt.exposed', () => {
  it('is its label and its title, and neither its id nor its realms', () => {
    expect(Hunt.exposed).to.deep.eq(['label', 'title'])
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
