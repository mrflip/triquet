import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Id } from '../../convex/_generated/dataModel'
import * as Actor from '../../src/lib/actor'
import { workbenchOffers, type WorkbenchOffersT } from '../../src/components/offers'

const user_id = 'm57a2835q9kp1gefja107b9bfh8fnpvr' as Id<'users'>
const hunt_id = 'k17ah9c4r1hm0z5y1ad0bbn7wn7fn9x1' as Id<'hunts'>
const Alice = Actor.asIdent(user_id, { _id: 'j97d0qbj35dar1v8edndzckvsx8f828f' as Id<'idents'>, label: 'alice_smiths' })

/** Alice's claims on the hunt in each standing, an unlocked quiz on screen, and as a smith of a locked one */
const ClaimsAs = {
  smith:        { ...Actor.claimsOn(Alice, hunt_id, { role: 'smith' }), quiz: { locked: false } },
  reviewer:     { ...Actor.claimsOn(Alice, hunt_id, { role: 'reviewer' }), quiz: { locked: false } },
  stranger:     { ...Actor.claimsOn(Alice, hunt_id, null), quiz: { locked: false } },
  anonymous:    { ...Actor.claimsOn(Actor.anonymous, hunt_id, null), quiz: { locked: false } },
  locked_smith: { ...Actor.claimsOn(Alice, hunt_id, { role: 'smith' }), quiz: { locked: true } },
} as const satisfies Record<string, Actor.QuizClaimsT>

const None: WorkbenchOffersT = { reviseQuiz: false, reviseQuestions: false, importQuestions: false, reviseLayout: false, changeLibrary: false, exportHunt: false }

const Cases: [keyof typeof ClaimsAs, WorkbenchOffersT, string][] = [
  ['smith',        { reviseQuiz: true, reviseQuestions: true, importQuestions: true, reviseLayout: true, changeLibrary: true, exportHunt: true }, 'offers a smith everything'],
  ['locked_smith', { ...None, changeLibrary: true, exportHunt: true },                                                                      'leaves a locked quiz as it is, but not the library a quiz does not hold, nor the export'],
  ['reviewer',     { ...None, changeLibrary: true },                                                                                         'offers a reviewer nothing of the smith\'s screen but the library, which is any admin\'s'],
  ['stranger',     { ...None, changeLibrary: true },                                                                                         'offers someone not on the hunt nothing of it but the library, which is any admin\'s'],
  ['anonymous',    None,                                                                                                                     'offers someone who has asserted no username nothing'],
]

describe('workbenchOffers', () => {
  afterEach(() => { vi.restoreAllMocks() })

  for (const [column, expected, describes] of Cases) {
    it(describes, () => {
      expect(workbenchOffers(ClaimsAs[column])).to.deep.eq(expected)
    })
  }

  it('opens no door to the library for anyone, a smith included, once `Actor.isAdmin` says nobody is an admin', () => {
    vi.spyOn(Actor, 'isAdmin').mockReturnValue(false)
    const offered = Object.values(ClaimsAs).map((claims) => workbenchOffers(claims).changeLibrary)
    expect(offered).to.deep.eq([false, false, false, false, false])
  })
})
