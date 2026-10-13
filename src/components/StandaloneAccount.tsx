'use client'

import { usePathname } from 'next/navigation'
import { Link, Stack, Typography } from '@mui/material'
import { AppNotices, keepHandleNotice } from '../lib/notices'
import * as Routes from '../lib/routes'
import { GoogleSignInOffer } from './GoogleSignIn'
import NextLink from './NextLink'
import { Panel } from './panels/Panel'
import styles from './workbench.module.css'

export type StandaloneDisclaimerProps = {
  /** Say only that there are limits, leaving what a verified account brings to whatever follows */
  brief?: boolean
}

/**
 * What a standalone account (anonymous, `Actor.isSealed`: one browser holds it) is, said in a
 * line: it has limits, linked to the help page's list of them (`Routes.helpPath`), and what a
 * verified account brings. In italics, as an aside to whatever it stands beside.
 *
 * @example <StandaloneDisclaimer />        // Standalone accounts have some limitations. Create a verified account to …
 * @example <StandaloneDisclaimer brief />  // Standalone accounts have some limitations.
 */
export function StandaloneDisclaimer({ brief = false }: Readonly<StandaloneDisclaimerProps>) {
  return (
    <Typography variant="body2" sx={{ fontStyle: 'italic' }}>
      {AppNotices.standaloneHave}{' '}
      <Link component={NextLink} href={Routes.helpPath('account-benefits')}>{AppNotices.standaloneLimits}</Link>.
      {! brief && ` ${AppNotices.verifyAccountBrings}`}
    </Typography>
  )
}

export type StandaloneAccountPanelProps = {
  /** The handle the standalone account holds, which a verified account keeps */
  userlabel: string
}

/**
 * What a visitor with a standalone account is told of it: that it has limits, and, where the
 * deployment offers it, a verified account, under the same handle, which comes back to this page.
 *
 * @example <StandaloneAccountPanel userlabel="mrflip" />
 */
export function StandaloneAccountPanel({ userlabel }: Readonly<StandaloneAccountPanelProps>) {
  return (
    <Panel title={AppNotices.standaloneTitle}>
      <Stack spacing={1.5}>
        <StandaloneDisclaimer brief />
        <GoogleSignInOffer reason={keepHandleNotice(userlabel)} />
      </Stack>
    </Panel>
  )
}

/**
 * A refusal said to a standalone account, as a line of microcopy. One that opens by asking it to
 * verify its account (`AppNotices.verifyAccount`) links those words to verifying it, which brings
 * the visitor back to this page once they have.
 *
 * @example <SealedNotice notice={RefusalNotices.sealedRelabel} />  // "Verify your account" linked to /signin?then=…
 */
export function SealedNotice({ notice }: Readonly<{ notice: string }>) {
  const here = usePathname()
  if (! notice.startsWith(AppNotices.verifyAccount)) { return <p className={styles.microcopy}>{notice}</p> }
  return (
    <p className={styles.microcopy}>
      <Link component={NextLink} href={Routes.signInPath(here)}>{AppNotices.verifyAccount}</Link>
      {notice.slice(AppNotices.verifyAccount.length)}
    </p>
  )
}
