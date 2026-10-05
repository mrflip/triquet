import { describe, expect, it } from 'vitest'
import type { Doc, Id } from '../../convex/_generated/dataModel'
import * as Actor from '../../src/lib/actor'
import type { ShallowHuntT } from '../../src/lib/rows'
import { claimsOf, denialOf, placeIn } from '../../src/state/use-hunt'

/** A quiz's row as a realm lists it */
function quizRow(tail: string, label: string): Doc<'quizzes'> {
  return {
    _id: `j97d0qbj35dar1v8edndzckvsx8f8${tail}` as Id<'quizzes'>, _creationTime: 1, realm_id: 'j97d0qbj35dar1v8edndzckvsx8f8r01' as Id<'realms'>,
    title: '', label, smiths_note: '', version: 'main', locked: false, last_sortkey: null, row_ordering: [],
  }
}

const Hunt: ShallowHuntT = {
  _id: 'j97d0qbj35dar1v8edndzckvsx8f8h01' as Id<'hunts'>, label: 'quiet_otter', title: 'Quiet Otter', members: [], role: 'smith',
  realms: [{
    _id: 'j97d0qbj35dar1v8edndzckvsx8f8r01' as Id<'realms'>, label: 'home', title: 'Home',
    quizzes:    [quizRow('q01', 'quiet_otter'), quizRow('q02', 'kings'), quizRow('q03', 'quiet_otter')],
  }],
}

describe('placeIn', () => {
  it('places the quiz the labels name in its realm', () => {
    const placing = placeIn(Hunt, { realm: 'home', quiz: 'kings' }, null)
    expect([placing.finding, placing.realm?.label, placing.quizRow?.label, placing.movedTo]).to.deep.eq(['placed', 'home', 'kings', null])
  })

  it('takes the earlier made, should two quizzes answer to one label', () => {
    expect(placeIn(Hunt, { realm: 'home', quiz: 'quiet_otter' }, null).quizRow?._id).to.eq(Hunt.realms[0]?.quizzes[0]?._id)
  })

  const Missing: [Parameters<typeof placeIn>[1], string][] = [
    [{ realm: 'home', quiz: 'nobody' },  'by a label no quiz answers to'],
    [{ realm: 'away', quiz: 'kings' },   'in a realm the hunt does not have'],
  ]
  for (const [labels, describes] of Missing) {
    it(`finds nothing ${describes}`, () => {
      expect(placeIn(Hunt, labels, null)).to.deep.eq({ finding: 'missing', realm: null, quizRow: null, movedTo: null })
    })
  }

  it('finds nothing in a hunt there is none of, and is still waiting while the hunt is on its way', () => {
    expect([placeIn(null, { realm: 'home', quiz: 'kings' }, null).finding, placeIn(undefined, { realm: 'home', quiz: 'kings' }, null).finding]).to.deep.eq(['missing', 'waiting'])
  })

  const kings = Hunt.realms[0]?.quizzes[1]?._id ?? null

  it('still places the quiz last shown at an address once it answers to another label, saying which', () => {
    const placing = placeIn(Hunt, { realm: 'home', quiz: 'princes' }, kings)
    expect([placing.finding, placing.quizRow?._id, placing.movedTo]).to.deep.eq(['placed', kings, 'kings'])
  })

  it('prefers a quiz that answers to the address over the one last shown there', () => {
    expect(placeIn(Hunt, { realm: 'home', quiz: 'quiet_otter' }, kings).movedTo).to.be.null
  })

  it('finds nothing when the quiz last shown is gone too', () => {
    expect(placeIn(Hunt, { realm: 'home', quiz: 'princes' }, 'j97d0qbj35dar1v8edndzckvsx8f8q99').finding).to.eq('missing')
  })
})

const Alice = Actor.asIdent('m57a2835q9kp1gefja107b9bfh8fnpvr' as Id<'users'>, { _id: 'j97d0qbj35dar1v8edndzckvsx8f828f' as Id<'idents'>, label: 'alice_smiths' })

describe('claimsOf', () => {
  it("holds who is looking, the hunt, their standing there and the quiz on screen's lock", () => {
    expect(claimsOf(Alice, Hunt, false)).to.deep.eq({ ...Alice, hunt_id: Hunt._id, standing: 'smith', quiz: { locked: false } })
  })

  it('holds no quiz while none is on screen', () => {
    expect(claimsOf(Alice, { ...Hunt, role: 'reviewer' }, null)).to.deep.eq({ ...Alice, hunt_id: Hunt._id, standing: 'reviewer', quiz: null })
  })

  it('is null until both who is looking and the hunt are known', () => {
    expect([claimsOf(null, Hunt, false), claimsOf(Alice, null, false)]).to.deep.eq([null, null])
  })
})

describe('denialOf', () => {
  const quiz_id = Hunt.realms[0]?.quizzes[0]?._id as Id<'quizzes'>
  const smith = { ...Actor.claimsOn(Alice, Hunt._id, { role: 'smith' }), quiz: { locked: false } }
  const lockedSmith = { ...smith, quiz: { locked: true } }
  const reviewer = { ...Actor.claimsOn(Alice, Hunt._id, { role: 'reviewer' }), quiz: { locked: false } }

  const Cases: [Actor.QuizClaimsT, Parameters<typeof denialOf>[1], ReturnType<typeof denialOf>, string][] = [
    // regular usage:
    [smith,       { kind: 'add_question' },                                        null,           'lets a smith revise an unlocked quiz'],
    [lockedSmith, { kind: 'add_question' },                                        'quizLocked',   "refuses a change to a locked quiz, with the lock's own refusal"],
    [lockedSmith, { kind: 'set_lock', quiz_id, locked: false },                    null,           'lets a smith unlock it'],
    [reviewer,    { kind: 'open_review', quiz_id },                                null,           'lets a reviewer open their review'],
    [reviewer,    { kind: 'retitle_quiz', title: 'Kings' },                        'notPermitted', 'refuses a reviewer a change to the quiz'],
    [smith,       { kind: 'remove_hunting', ident_id: Alice.ident_id },            'ownHunting',   "refuses a smith's taking themselves off, as the server would"],
    [lockedSmith, { kind: 'add_widgeting', widgeting: { widget_label: 'dumdum', label: 'dumdum' } }, 'quizLocked', 'judges an action whose defaults a view left out, read as the server will read it'],
    // weird cases:
    [reviewer,    { kind: 'retitle_quiz', title: 'x'.repeat(5000) },               null,           'leaves an action that does not read as one to the server, which says what is wrong with it'],
  ]
  for (const [claims, action, expected, describes] of Cases) {
    it(describes, () => {
      expect(denialOf(claims, action)).to.eq(expected)
    })
  }
})
