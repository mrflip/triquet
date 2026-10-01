import { describe, expect, it } from 'vitest'
import * as Z from 'zod'
import { ServiceStatusValidators } from '../../src/models/service-status'

const claude = { servicelabel: 'claude', credentialed: true }

describe('ServiceStatusValidators.serviceStatuses', () => {
  it('accepts every service with whether it can be asked', () => {
    const statuses = ServiceStatusValidators.serviceStatuses({ services: [claude, { ...claude, servicelabel: 'other', credentialed: false }] })
    expect(statuses.services.map((status) => status.credentialed)).to.deep.eq([true, false])
  })

  it('accepts no services at all', () => {
    expect(ServiceStatusValidators.serviceStatuses({ services: [] }).services).to.deep.eq([])
  })

  const Refused: [unknown, string][] = [
    [{},                                                      'no services field'],
    [{ services: [{ ...claude, credentialed: 'yes' }] },      'a credentialed that is not a boolean'],
    [{ services: [{ ...claude, credentialed: undefined }] },  'a service with no word on whether it can be asked'],
    [{ services: [{ ...claude, servicelabel: '' }] },         'a service with no label'],
  ]
  for (const [dna, describes] of Refused) {
    it(`refuses ${describes}`, () => {
      expect(() => ServiceStatusValidators.serviceStatuses(dna as never)).to.throw(Z.ZodError)
    })
  }
})
