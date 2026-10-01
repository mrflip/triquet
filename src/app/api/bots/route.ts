import { serviceStatuses } from '../../../lib/ask/bots'
import { ServiceStatusValidators } from '../../../models/service-status'

/**
 * Every outside service an `aibot` widget can be put to, and whether it can be asked right now.
 *
 * The browser cannot know whether the server holds credentials, and must never be told what
 * they are -- only whether they exist, so a cell can say so calmly instead of failing when it
 * is double-clicked.
 */
export function GET(): Response {
  const services = serviceStatuses()
  return Response.json(ServiceStatusValidators.serviceStatuses({ services }))
}
