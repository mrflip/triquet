'use client'

import { Link, Stack } from '@mui/material'
import NextLink from './NextLink'
import { Panel } from './panels/Panel'
import { notASmithNotice, notOnHuntNotice } from '../lib/notices'
import * as Routes from '../lib/routes'
import type { SmithT } from '../lib/rows'
import type * as Actor from '../lib/actor'
import { Hunting } from '../models/hunting'
import type { IdentT } from '../models/ident'
import styles from './workbench.module.css'

export type NotOnHuntProps = {
  /** What the address asked for */
  labels: Routes.QuizLabels
  /** Who is looking */
  ident:  IdentT
  /** What they hold of themselves on the hunt; null when the server says they are not on it */
  claims: Actor.HuntClaimsT | null
  /** The hunt's smiths, who could put them on it or make them a smith */
  smiths: readonly SmithT[]
}

/**
 * What an address shows someone it is not for, in place of what it names, the address left as it
 * is: a visitor not on its hunt, or a reviewer asking for the smiths' presentation. Names the
 * smiths to ask and what to ask them for, and where the visitor may go instead.
 */
export function NotOnHunt({ labels, ident, claims, smiths }: Readonly<NotOnHuntProps>) {
  // Someone on the hunt who may not work on the quiz may still be able to review it.
  const reviewing = claims !== null && Hunting.mayAct(claims, 'review')
  return (
    <main className={styles.page}>
      <Panel
        title={reviewing ? 'Not a smith here' : 'Not yet on this hunt'}
        blurb={reviewing ? notASmithNotice(smiths, ident.label) : notOnHuntNotice(smiths, ident.label)}
      >
        <Stack direction="row" spacing={2}>
          {reviewing && <Link component={NextLink} href={Routes.quizPath(labels, 'review')}>Review this quiz</Link>}
          <Link component={NextLink} href={Routes.huntsPath()}>Your hunts</Link>
        </Stack>
      </Panel>
    </main>
  )
}
