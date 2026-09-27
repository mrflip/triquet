import { describe, expect, it } from 'vitest'
import * as Z from 'zod'
import { HomeRealmLabel, Realm, RealmValidators } from '../../src/models/realm'
import { Quiz } from '../../src/models/quiz'
import { mintId } from '../../src/lib/ids'

describe('Realm.fill', () => {
  it('is home unless it says otherwise, titled after its label', () => {
    const realm = Realm.fill({ id: mintId(), quizzes: [Quiz.blank()] })
    expect([realm.label, realm.title]).to.deep.eq([HomeRealmLabel, 'Home'])
  })

  it('keeps a title it is given', () => {
    expect(Realm.fill({ id: mintId(), label: 'away', title: 'Far Away', quizzes: [Quiz.blank()] }).title).to.eq('Far Away')
  })

  it('refuses a realm holding no quiz', () => {
    expect(() => Realm.fill({ id: mintId(), quizzes: [] })).to.throw(Z.ZodError)
  })
})

describe('Realm.quizFor', () => {
  const realm = Realm.fill({ id: mintId(), quizzes: [Quiz.blank('', 'quiet_otter'), { ...Quiz.blank('', 'princes'), forced_label: 'kings' }] })

  it('finds a quiz by the label in force', () => {
    expect([Realm.quizFor(realm, 'quiet_otter')?.title, Realm.quizFor(realm, 'kings')?.label]).to.deep.eq(['Quiet Otter', 'princes'])
  })

  it('finds nothing by a label an override has replaced, or one nobody has', () => {
    expect([Realm.quizFor(realm, 'princes'), Realm.quizFor(realm, 'nobody')]).to.deep.eq([undefined, undefined])
  })
})

describe('RealmValidators.row', () => {
  const Row = { hunt_id: '01a0dc10-c9be-7cb3-9d3a-25fc68cd12f9', label: 'home', title: 'Home', position: 0 }

  it('takes a realm as the database holds it', () => {
    expect(RealmValidators.row(Row)).to.deep.eq(Row)
  })

  const Refused: [object, string][] = [
    [{ hunt_id: 'home' },   'a hunt that is not a row id'],
    [{ label: 'Home' },     'a label that is not one'],
    [{ position: -1 },      'a place before the first'],
  ]
  for (const [overrides, describes] of Refused) {
    it(`refuses ${describes}`, () => {
      expect(() => RealmValidators.row({ ...Row, ...overrides })).to.throw(Z.ZodError)
    })
  }
})
