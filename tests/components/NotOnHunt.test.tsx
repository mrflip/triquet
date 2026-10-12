import { describe, expect, it } from 'vitest'
import type { Id } from '../../convex/_generated/dataModel'
import { NotOnHunt } from '../../src/components/NotOnHunt'
import * as Actor from '../../src/lib/actor'
import { AppNotices, notASmithNotice, notOnHuntNotice, sealedNotOnHuntNotice } from '../../src/lib/notices'
import { renderedText } from '../support/rendering'
import { userActor } from '../support/actors'

const user_id = 'm57a2835q9kp1gefja107b9bfh8fnpvr' as Id<'users'>
const hunt_id = 'k17ah9c4r1hm0z5y1ad0bbn7wn7fn9x1' as Id<'hunts'>
const user    = { _id: user_id, userlabel: 'ada_reviews', title: 'Ada' }
const smiths  = [{ label: 'flip_kromer', title: 'Flip' }]
const Ada     = userActor(user_id, user.userlabel)
const AnonAda = userActor(user_id, user.userlabel, { anonymous: true })

/** What the panel says to `actor` holding `claims`, with the entities React writes undone for the apostrophes the notices hold */
const saidBy = (actor: Actor.ActorT, claims: Actor.HuntClaimsT | null) => renderedText(
  <NotOnHunt
    playtestPath="/~flip_kromer/quiet_otter/quizzes/home/quiet_otter/!playtest" editPath="/~flip_kromer/quiet_otter/quizzes/home/quiet_otter/!edit"
    user={user} sealed={Actor.isSealed(actor)} claims={claims} smiths={smiths}
  />,
).replaceAll('&#x27;', "'").replaceAll('&quot;', '"')

describe('NotOnHunt', () => {
  it("tells a visitor signed in with Google and not on the hunt whom to ask, and what to give them", () => {
    const said = saidBy(Ada, null)
    expect(said).to.contain('Not yet on this hunt')
    expect(said).to.contain(notOnHuntNotice(smiths, user.userlabel))
  })

  it("tells an anonymous visitor not on the hunt to sign in with Google first, then whom to ask", () => {
    const said = saidBy(AnonAda, null)
    expect(said).to.contain('Not yet on this hunt')
    expect(said).to.contain(sealedNotOnHuntNotice(smiths, user.userlabel))
    expect(said).not.to.contain(notOnHuntNotice(smiths, user.userlabel))
  })

  it("tells a reviewer asking for the smiths' screen who could make them a smith, and where to review instead", () => {
    const said = saidBy(Ada, Actor.claimsOn(Ada, hunt_id, { role: 'reviewer' }))
    expect(said).to.contain('Not a smith here')
    expect(said).to.contain(notASmithNotice(smiths, user.userlabel))
    expect(said).to.contain('Review this quiz')
  })

  it("tells an anonymous smith at its own sandbox's playtest why it reviews nothing, naming nobody to ask, and sends it back to work", () => {
    const said = saidBy(AnonAda, Actor.claimsOn(AnonAda, hunt_id, { role: 'smith' }))
    expect(said).to.contain(AppNotices.reviewingSealedTitle)
    expect(said).to.contain(AppNotices.reviewingSealed)
    expect(said).to.contain('Work on this quiz')
    expect(said).not.to.contain('Review this quiz')
    expect(said).not.to.contain(smiths[0]!.title)
  })
})
