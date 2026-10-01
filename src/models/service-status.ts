import type * as Z from 'zod'
import { Validator } from '../lib/validator'

export const ServiceStatusValidators = Validator(({ obj, arr, str, bool }) => {
  const serviceStatus = obj({
    servicelabel: str.min(1)
      .describe('Which outside service, as an `aibot` widget\'s config names it.'),
    credentialed: bool
      .describe('Whether the server holds credentials for that service, and so whether a widget put to it can be asked at all. Says nothing about the credentials themselves.'),
  })
    .describe('One outside service, and whether it can be asked right now. Deliberately loose about labels: this crosses to the browser, which only compares them.')

  const serviceStatuses = obj({ services: arr(serviceStatus) })
    .describe('What the bots route answers: every service, with whether each can be asked.')

  return { serviceStatus, serviceStatuses }
})

export type ServiceStatusT   = Z.output<typeof ServiceStatusValidators.serviceStatus>
export type ServiceStatusesT = Z.output<typeof ServiceStatusValidators.serviceStatuses>
