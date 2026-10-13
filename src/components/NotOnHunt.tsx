'use client'

import { Link, Stack } from '@mui/material'
import { GoogleSignInOffer } from './GoogleSignIn'
import NextLink from './NextLink'
import { Panel } from './panels/Panel'
import { AppNotices, notASmithNotice, notOnHuntNotice, sealedNotOnHuntNotice } from '../lib/notices'
import * as Routes from '../lib/routes'
import type { SmithT } from '../lib/rows'
import type * as Actor from '../lib/actor'
import { Huntship } from '../models/huntship'
import type { UserT } from '../models/user'
import styles from './workbench.module.css'

export type NotOnHuntProps = {
  /** Where the quiz the address asked for is playtested; null for an address naming the hunt alone, or before the hunt has said its org */
  playtestPath: string | null
  /** Where the quiz the address asked for is worked on; null as for `playtestPath` */
  editPath?:    string | null
  /** Who is looking */
  user:         UserT
  /** Whether who is looking is sealed (anonymous: `Actor.isSealed`), which no smith may put on a hunt and who reviews nothing */
  sealed:       boolean
  /** What they hold of themselves on the hunt; null when the server says they are not on it */
  claims:       Actor.HuntClaimsT | null
  /** The hunt's smiths, who could put them on it or make them a smith */
  smiths:       readonly SmithT[]
}

/**
 * What an address shows someone it is not for, in place of what it names, the address left as it
 * is: a visitor not on its hunt, a reviewer asking for the smiths' mode, or a standalone account's
 * smith asking to review its own sandbox's quiz, which only a verified account may. Names the smiths
 * to ask and what to ask them for, and where the visitor may go instead. A standalone account is
 * told a smith can put it on only once it is a verified account, and offered one.
 */
export function NotOnHunt({ playtestPath, editPath = null, user, sealed, claims, smiths }: Readonly<NotOnHuntProps>) {
  // Someone on the hunt who may not work on the quiz may still be able to review it; a sealed smith, the other way about.
  const reviewing = claims !== null && Huntship.mayOpen(claims, 'playtest')
  const working = claims !== null && sealed && Huntship.mayOpen(claims, 'edit')
  const { title, blurb } = saidTo({ reviewing, working, sealed }, smiths, user.userlabel)
  return (
    <main className={styles.page}>
      <Panel title={title} blurb={blurb}>
        <Stack spacing={2}>
          {sealed && ! reviewing && <GoogleSignInOffer />}
          <Stack direction="row" spacing={2}>
            {reviewing && playtestPath !== null && <Link component={NextLink} href={playtestPath}>Review this quiz</Link>}
            {working && editPath !== null && <Link component={NextLink} href={editPath}>Work on this quiz</Link>}
            <Link component={NextLink} href={Routes.huntsPath()}>Your hunts</Link>
          </Stack>
        </Stack>
      </Panel>
    </main>
  )
}

/** What the page is headed, and what it says, to a visitor who may review here, a sealed smith who may only work here, a sealed stranger, or any other stranger */
function saidTo(may: { reviewing: boolean, working: boolean, sealed: boolean }, smiths: readonly SmithT[], userlabel: string): { title: string, blurb: string } {
  if (may.reviewing) { return { title: 'Not a smith here', blurb: notASmithNotice(smiths, userlabel) } }
  if (may.working) { return { title: AppNotices.reviewingSealedTitle, blurb: AppNotices.reviewingSealed } }
  if (may.sealed) { return { title: 'Not yet on this hunt', blurb: sealedNotOnHuntNotice(smiths, userlabel) } }
  return { title: 'Not yet on this hunt', blurb: notOnHuntNotice(smiths, userlabel) }
}
