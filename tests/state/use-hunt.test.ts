import { describe, expect, it } from 'vitest'
import type { Doc, Id } from '../../convex/_generated/dataModel'
import type { ShallowHuntT } from '../../src/lib/rows'
import { placeIn } from '../../src/state/use-hunt'

/** A quiz's row as a realm lists it */
function quizRow(tail: string, label: string, forced_label: string | null = null): Doc<'quizzes'> {
  return {
    _id: `j97d0qbj35dar1v8edndzckvsx8f8${tail}` as Id<'quizzes'>, _creationTime: 1, realm_id: 'j97d0qbj35dar1v8edndzckvsx8f8r01' as Id<'realms'>,
    title: '', label, forced_label, version: 'main', locked: false, last_sortkey: null, bulk_ishes_last: null,
  }
}

const Hunt: ShallowHuntT = {
  _id: 'j97d0qbj35dar1v8edndzckvsx8f8h01' as Id<'hunts'>, label: 'quiet_otter', forced_label: null, title: 'Quiet Otter', expressions: [],
  realms: [{
    _id: 'j97d0qbj35dar1v8edndzckvsx8f8r01' as Id<'realms'>, label: 'home', title: 'Home',
    quizzes:    [quizRow('q01', 'quiet_otter'), quizRow('q02', 'princes', 'kings'), quizRow('q03', 'quiet_otter')],
  }],
}

describe('placeIn', () => {
  it('places the quiz the labels name in its realm', () => {
    const placing = placeIn(Hunt, { realm: 'home', quiz: 'kings' }, null)
    expect([placing.finding, placing.realm?.label, placing.quizRow?.label, placing.movedTo]).to.deep.eq(['placed', 'home', 'princes', null])
  })

  it('takes the earlier made, should two quizzes answer to one label', () => {
    expect(placeIn(Hunt, { realm: 'home', quiz: 'quiet_otter' }, null).quizRow?._id).to.eq(Hunt.realms[0]?.quizzes[0]?._id)
  })

  const Missing: [Parameters<typeof placeIn>[1], string][] = [
    [{ realm: 'home', quiz: 'princes' }, 'by a label an override has replaced'],
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
    expect(placeIn(Hunt, { realm: 'home', quiz: 'quiet_otter' }, kings).movedTo).to.eq(null)
  })

  it('finds nothing when the quiz last shown is gone too', () => {
    expect(placeIn(Hunt, { realm: 'home', quiz: 'princes' }, 'j97d0qbj35dar1v8edndzckvsx8f8q99').finding).to.eq('missing')
  })
})
