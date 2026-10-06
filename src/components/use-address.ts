'use client'

import { useEffect } from 'react'
import { notFound, usePathname, useRouter } from 'next/navigation'
import * as Addresses from '../lib/addresses'
import * as Routes from '../lib/routes'

/** An address of one kind, as a page reads it: the resource it names, and the mode it opens it in */
export type AddressedT<KK extends Addresses.AddressKind> = {
  address: Extract<Addresses.AddressT, { kind: KK }>
  mode:    Addresses.Mode | null
}

/** Whether `location` names a resource of `kind` itself, not its raw record */
function isOfKind<KK extends Addresses.AddressKind>(location: Addresses.LocationT | null, kind: KK): location is Addresses.LocationT & AddressedT<KK> {
  return location?.address.kind === kind && ! location.raw
}

/**
 * What the page's address names, read whole by `Addresses.locationFrom`, for a page that shows a
 * resource of `kind`. The folders under `src/app/` say which page an address reaches; this says
 * what it names, unescaped, so every page reads its address the same way. An address of another
 * kind, of none (an org with no `~`, a mode the app does not have), or of a raw record (`.json`),
 * which no page serves, is not found.
 *
 * @param kind - The kind of resource the page shows.
 * @returns The resource, and its mode, null when the address names none.
 *
 * @example const { address } = useAddressed('categories')  // address.hunt => 'quiet_otter'
 */
export function useAddressed<KK extends Addresses.AddressKind>(kind: KK): AddressedT<KK> {
  const location = Addresses.locationFrom(usePathname())
  if (! isOfKind(location, kind)) { notFound() }
  return location
}

/**
 * Move the address to the form the screen's resource has now (`canonical`), once it is known,
 * whenever the page stands at another (`current`): an old address, which names no org; one
 * naming another org than the hunt's; a quiz's stale realm, or the label it had before it was
 * relabelled. Replaced rather than pushed, so going back skips the form it moved from; what the
 * query and fragment said of the screen comes along (`Routes.movedPath`).
 *
 * @param current - The address the page stands at, in the form `Routes` writes; null for an old address.
 * @param canonical - The address the resource has now; null until it is known.
 *
 * @example useCanonical(Routes.huntPath({ org, hunt: huntLabel }), hunt && Routes.huntPath({ org: hunt.org, hunt: hunt.label }))
 */
export function useCanonical(current: string | null, canonical: string | null): void {
  const router = useRouter()
  useEffect(() => {
    if (canonical === null || canonical === current) { return }
    router.replace(Routes.movedPath(canonical, location))
  }, [current, canonical, router])
}
