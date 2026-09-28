'use client'

import { Link, Stack } from '@mui/material'
import NextLink from './NextLink'
import { Panel } from './panels/Panel'
import * as Routes from '../lib/routes'
import type { HuntRole } from '../models/hunting'
import type { IdentT } from '../models/ident'
import styles from './workbench.module.css'

export type NotOnHuntProps = {
  /** What the address asked for */
  labels: Routes.QuizLabels
  /** Who is looking */
  ident:  IdentT
  /** Their role on the hunt: null when they are not on it, `reviewer` when they asked to work on it as a smith */
  role:   HuntRole | null
}

/**
 * What an address shows someone it is not for: a visitor not on its hunt, or a reviewer asking
 * for the smiths' presentation. Says what to ask a smith for, naming the ident label a smith
 * would add, and where they may go instead.
 */
export function NotOnHunt({ labels, ident, role }: Readonly<NotOnHuntProps>) {
  const reviewing = role === 'reviewer'
  return (
    <main className={styles.page}>
      <Panel
        title={reviewing ? 'Not a smith here' : 'Not on this hunt'}
        blurb={reviewing
          ? `You are a reviewer on this hunt, not a smith. Ask a smith to make “${ident.label}” a smith.`
          : `You are not on this hunt. Ask a smith to add “${ident.label}”.`}
      >
        <Stack direction="row" spacing={2}>
          {reviewing && <Link component={NextLink} href={Routes.quizPath(labels, 'review')}>Review this quiz</Link>}
          <Link component={NextLink} href={Routes.huntsPath()}>Your hunts</Link>
        </Stack>
      </Panel>
    </main>
  )
}
