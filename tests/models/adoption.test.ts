import { describe, expect, it } from 'vitest'
import * as Z from 'zod'
import { AdoptionValidators, type AdoptionDNA } from '../../src/models/adoption'

const UserId = 'm57a2835q9kp1gefja107b9bfh8fnpvr'

describe('AdoptionValidators.request', () => {
  it("takes the Coach's command, a grant for every hunt among its grants", () => {
    const request: AdoptionDNA = { find: { email: 'flip@example.com' }, userlabel: 'mrflip', admin: true, grants: [{ role: 'smith', hunts: 'every' }] }
    expect(AdoptionValidators.request(request)).to.deep.eq(request)
  })

  it('finds a user by its id, its userlabel, or its email, and asks nothing else of it unless told', () => {
    for (const find of [{ user_id: UserId }, { userlabel: 'flippy_kromer' }, { email: 'flip@example.com' }]) {
      expect(AdoptionValidators.request({ find })).to.deep.eq({ find, grants: [] })
    }
  })

  it('takes a grant on one hunt, by its address', () => {
    const grants: AdoptionDNA['grants'] = [{ role: 'reviewer', hunts: { org: 'pat_smith', hunt: 'quiet_otter' } }]
    expect(AdoptionValidators.request({ find: { userlabel: 'flippy_kromer' }, grants }).grants).to.deep.eq(grants)
  })

  const Refused: [unknown, string][] = [
    [{},                                                                   'no way to find the user'],
    [{ find: { userlabel: 'flippy_kromer', email: 'flip@example.com' } },   'two ways to find the user at once'],
    [{ find: { email: 'flip at example' } },                                'an email that is not one'],
    [{ find: { user_id: 'nope' } },                                         'an id that is not a row id'],
    [{ find: { userlabel: 'flippy_kromer' }, admin: 'yes' },                'an admin flag that is not a yes or no'],
    [{ find: { userlabel: 'flippy_kromer' }, userlabel: 'support' },        'a userlabel to give that is a reserved word'],
    [{ find: { userlabel: 'flippy_kromer' }, userlabel: 'Mr Flip' },        'a userlabel to give that is not one'],
    [{ find: { userlabel: 'flippy_kromer' }, title: '' },                   'a blank title'],
    [{ find: { userlabel: 'flippy_kromer' }, grants: [{ role: 'owner', hunts: 'every' }] },   'a role that is not one'],
    [{ find: { userlabel: 'flippy_kromer' }, grants: [{ role: 'smith', hunts: 'all' }] },     'hunts that are neither every one nor an address'],
    [{ find: { userlabel: 'flippy_kromer' }, grants: [{ role: 'smith', hunts: { org: 'pat_smith' } }] }, 'an address with no hunt'],
  ]
  for (const [request, describes] of Refused) {
    it(`refuses ${describes}`, () => {
      expect(() => AdoptionValidators.request.parse(request)).to.throw(Z.ZodError)
    })
  }
})
