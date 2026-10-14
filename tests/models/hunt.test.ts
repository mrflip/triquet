import { describe, expect, it } from 'vitest'
import * as Z from 'zod'
import { CategoryLabelVals } from '../../src/models/category'
import { Hunt, HuntValidators } from '../../src/models/hunt'
import { defaultLayout } from '../../src/models/layout'
import { Quiz, type QuizDNA } from '../../src/models/quiz'
import { mintId } from '../../src/lib/ids'
import * as PA from '../../src/lib/vv/patterns'
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

  it("refuses a realm other than home, the one realm a hunt has for now", () => {
    const away = { _id: mintId(), label: 'away', quizzes: [Quiz.blank()] }
    expect(() => Hunt.fill(homeHolding([Quiz.blank()], { realms: [away] }))).to.throw(Z.ZodError)
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

describe('HuntValidators.row', () => {
  const Row = { label: 'quiet_otter', orglabel: 'pat_smith', title: 'Quiet Otter', branch: 'main', created_at: 1_759_700_000_000, updated_at: 1_759_700_000_000 }

  it('takes a hunt as the database holds it', () => {
    expect(HuntValidators.row(Row)).to.deep.eq(Row)
  })

  it('refuses a label that is not one', () => {
    expect(() => HuntValidators.row({ ...Row, label: 'Quiet Otter' })).to.throw(Z.ZodError)
  })

  it("refuses an org that is not a userlabel", () => {
    expect(() => HuntValidators.row({ ...Row, orglabel: 'pat' })).to.throw(Z.ZodError)
  })

  it("refuses a label or an org that is a word every label is kept from", () => {
    expect(() => HuntValidators.row({ ...Row, label: 'position' })).to.throw(Z.ZodError)
    expect(() => HuntValidators.row({ ...Row, orglabel: 'constructor' })).to.throw(Z.ZodError)
  })

  it("takes a label kept for the app's own pages since it was made, so the hunt stays writable at its address", () => {
    expect(HuntValidators.row({ ...Row, label: 'pricing' })).to.deep.eq({ ...Row, label: 'pricing' })
  })

  it("refuses an org kept for the app's own pages, as every userlabel is held to the whole list", () => {
    expect(() => HuntValidators.row({ ...Row, orglabel: 'google_fan' })).to.throw(Z.ZodError)
  })

  it("takes a branch kept for the app's own pages", () => {
    expect(HuntValidators.row({ ...Row, branch: 'pricing' }).branch).to.eq('pricing')
  })

  it('refuses a branch that git would not take as one', () => {
    expect(() => HuntValidators.row({ ...Row, branch: 'draft two' })).to.throw(Z.ZodError)
  })

  it("takes a hunt with no wheel, which reads as the default, and one with a wheel of its own", () => {
    const wheel = [null, ...CategoryLabelVals.slice(1)]
    expect(HuntValidators.row(Row)).not.to.have.property('wheel')
    expect(HuntValidators.row({ ...Row, wheel }).wheel).to.deep.eq(wheel)
  })

  it("refuses a wheel that is not one", () => {
    expect(() => HuntValidators.row({ ...Row, wheel: [...CategoryLabelVals, null] })).to.throw(Z.ZodError)
  })
})

describe('HuntValidators.newLabel', () => {
  it("takes a label a hunt may be given", () => {
    expect(HuntValidators.newLabel('quiet_otter')).to.eq('quiet_otter')
  })

  it("takes a userlabel of the fewest characters and of the most, as a sandbox is labelled with its own", () => {
    const shortest = 'x'.repeat(PA.Userlabel.min)
    const longest  = 'x'.repeat(PA.Userlabel.max)
    expect([HuntValidators.newLabel(shortest), HuntValidators.newLabel(longest)]).to.deep.eq([shortest, longest])
  })

  it("refuses a word kept for the app's own pages and people, which only a label already held may be", () => {
    for (const label of ['pricing', 'privacy', 'google', 'handle', 'smith', 'security_desk']) {
      expect(() => HuntValidators.newLabel(label), label).to.throw(Z.ZodError)
    }
  })

  it('refuses what is no label', () => {
    expect(() => HuntValidators.newLabel('Quiet Otter')).to.throw(Z.ZodError)
    expect(() => HuntValidators.newLabel('position')).to.throw(Z.ZodError)
  })
})

describe('Hunt.isSandbox', () => {
  it('is a hunt labelled with its own org, as an anonymous user makes its one hunt', () => {
    expect(Hunt.isSandbox({ label: 'flip_kromer', orglabel: 'flip_kromer' })).to.be.true
  })

  it('is no other hunt', () => {
    expect(Hunt.isSandbox({ label: 'quiet_otter', orglabel: 'flip_kromer' })).to.be.false
  })
})
