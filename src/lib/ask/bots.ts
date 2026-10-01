import * as Credentials from '../credentials'
import { SeededAsks } from '../formulary/aibot'
import { SeedWidgets } from '../../models/seeds'
import type { AskRequestT } from './contract'
import type { AibotWidgetT } from '../../models/widget'
import type { ServiceStatusT } from '../../models/service-status'

/**
 * The seeded `aibot` widget a fixed ask is put as, from the seeds fixture: its prompt, its tier
 * and its room. Temporary, while the ask route takes fixed asks rather than a rendered prompt.
 *
 * @param ask - The ask, by job and the text it is put.
 * @returns The widget whose prompt answers it.
 *
 * @example seededWidgetFor({ job: 'ishes', textkind: 'hint', text: 'Two' }).label  // => 'numnum_hint'
 */
export function seededWidgetFor(ask: AskRequestT): AibotWidgetT {
  const textkind = ask.job === 'guess' ? 'clueing' : ask.textkind
  const label = Object.keys(SeededAsks).find((each) => SeededAsks[each]?.job === ask.job && SeededAsks[each].textkind === textkind)
  const widget = SeedWidgets.find((each): each is AibotWidgetT => each.formulary === 'aibot' && each.label === label)
  if (! widget) { throw new Error(`No seeded widget answers the ${ask.job} job for the ${textkind}`) }
  return widget
}

/**
 * Every outside service, and whether the server can put a prompt to it: only whether a
 * credential exists for it, never what it is.
 *
 * @returns One status per service, in label order.
 *
 * @example serviceStatuses().map((status) => status.credentialed)  // => [true], with a key set
 */
export function serviceStatuses(): ServiceStatusT[] {
  return Credentials.ServicelabelVals.toSorted((aa, bb) => aa.localeCompare(bb)).map((servicelabel) => ({ servicelabel, credentialed: Credentials.has(servicelabel) }))
}
