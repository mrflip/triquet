'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button, Divider, Stack, TextField, Typography } from '@mui/material'
import { AppNotices, googleGateNotice } from '../lib/notices'
import * as Routes from '../lib/routes'
import * as PA from '../lib/vv/patterns'
import { User, type LabelFlawT, type UserlabelHolderT } from '../models/user'
import { useShown } from '../state/shown'
import { useUserActions } from '../state/use-user-actions'
import { useMe } from '../state/use-me'
import { useUserlabelHolder } from '../state/use-userlabel-holder'
import { GoogleSignInButton } from './GoogleSignIn'
import { Panel } from './panels/Panel'
import { StandaloneDisclaimer } from './StandaloneAccount'
import { OpeningNotice } from './SyncNotices'
import styles from './workbench.module.css'

/**
 * The front door: sign in to a verified account, or say who you are by your name and a userlabel (a
 * handle, on screen), which this browser's user takes, titled with the name. The name takes
 * anything. The userlabel beside it is made from the name as it is typed (`User.labelFor`), until
 * it is typed in itself; emptied, it follows the name again. From then on the two are apart:
 * retitling a user never relabels it. The userlabel field says at once of a userlabel no typing on
 * would mend, but of one too short only once either field has been left, as it may still be being
 * typed. There is no password: the browser's session is what holds its user, and a user's userlabel
 * is chosen once.
 *
 * Where the deployment offers Google, signing in with Google comes first, for whoever has an
 * account already, and comes back here; then, after an *or*, the fields and *Sign up*, which make a
 * standalone account, held by this browser alone, its limits said in a line beneath
 * (`StandaloneDisclaimer`). Once a userlabel has stood a moment, the front door asks who holds it
 * (`useUserlabelHolder`): for one a verified account holds, a word to sign in with Google if it is
 * yours stands in place of the button; for one held any other way, that it is taken. One taken in
 * the meantime is refused by the server all the same, saying what to do instead.
 *
 * A visitor back from Google whose Google account has no handle yet is asked to add their name:
 * told whom Google signed them in as, and offered a name and a handle made from what Google sent
 * (`users.own`'s `suggested`: the Google name, and the first of its handles that nobody holds, no
 * merge has retired, no hunt is addressed by and no reserved word is), to take or change; the
 * handle follows the offered one until either field is typed in.
 *
 * A visitor who has just taken their handle here lands at their sandbox, made as they took it,
 * unless a link sent them here from a page worth coming back to (`Routes.signedUpPath`). A visitor
 * who had already said is sent on at once: to where the address's `then` points, when a link sent
 * them here, and to their hunts otherwise.
 */
export function UserlabelGate() {
  const router = useRouter()
  const params = useSearchParams()
  const then = params.get('then')
  const { user, loaded } = useMe()
  const shown = useShown().user
  const own = shown?.own ?? null
  // Back from Google, holding no handle yet
  const back = own?.google === true
  // Offered both ways in: signing in with Google, or a standalone account
  const google = ! back && shown?.google.offered === true ? shown.google : null
  const { act, busy, notice } = useUserActions()
  // The title as typed into "Your name", or null while it is the one Google sent, if any: what a user signed in with Google is offered
  const [titleDraft, setTitleDraft] = useState<string | null>(null)
  // The userlabel as typed into its own field, or null while it follows the title. Emptied, it is ''
  // until the title changes or the field is left: following again, but blank while being cleared.
  const [labelDraft, setLabelDraft] = useState<string | null>(null)
  // Whether either field has been left once: a userlabel too short is said only after, as it may still be being typed.
  const [left, setLeft] = useState(false)
  // Sends once: the user arriving by sync after its userlabel was typed must not send twice.
  const sent = useRef(false)
  // Whether the visitor has taken their handle here, rather than arriving with one: they land elsewhere.
  const taking = useRef(false)

  const offered = own?.suggested ?? null
  const title = titleDraft ?? offered?.title ?? ''
  const followed = titleDraft === null && offered?.userlabel ? offered.userlabel : User.labelFor(title)
  const label = labelDraft === null || labelDraft === '' ? followed : labelDraft
  const flaw = User.flawIn(label)
  const said = User.flawToSay(label, left)
  const held = heldNotice(useUserlabelHolder(flaw === null ? label : null), google !== null)

  useEffect(() => {
    if (! loaded || ! user || sent.current) { return }
    sent.current = true
    router.replace(taking.current ? Routes.signedUpPath(then, user.userlabel) : Routes.thenFrom(then) ?? Routes.huntsPath())
  }, [loaded, user, then, router])

  if (! loaded || user) {
    return <OpeningNotice notice={null} waiting={AppNotices.opening} />
  }

  const onSubmit = async () => {
    if (flaw !== null || held !== null) { return }
    // Once the user holds it, it arrives by sync, and the effect above sends them on, to where a new user lands.
    taking.current = true
    const outcome = await act({ kind: 'assume_userlabel', userlabel: label, title })
    if (! outcome.kept) { taking.current = false }
  }

  return (
    <main className={styles.page}>
      <Panel title={back ? AppNotices.googleGateTitle : AppNotices.userlabelGateTitle}>
        <Stack spacing={1.5} sx={{ maxWidth: 720, mt: 1 }}>
          {google !== null && (
            <>
              <Stack direction="row" useFlexGap spacing={1.5} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
                <GoogleSignInButton onClick={() => { void google.start() }} />
                <Typography variant="body2">{AppNotices.ifExistingAccount}</Typography>
              </Stack>
              <Divider sx={{ typography: 'body2', color: 'text.secondary' }}>or</Divider>
            </>
          )}
          {back && <Typography variant="body2">{googleGateNotice(own.email)}</Typography>}
          {google === null && <Typography variant="body2">{AppNotices.nameAndHandleAbout}</Typography>}
          <Stack
            component="form" direction={{ xs: 'column', sm: 'row' }} useFlexGap spacing={1.5} sx={{ alignItems: { sm: 'flex-start' } }}
            onSubmit={(event) => { event.preventDefault(); void onSubmit() }}
          >
            <TextField
              size="small" label="Your name" value={title} autoFocus sx={{ flex: 1 }}
              helperText=" "
              slotProps={{ htmlInput: { maxLength: PA.Titleish.max } }}
              onChange={(event) => { setTitleDraft(event.target.value); if (labelDraft === '') { setLabelDraft(null) } }}
              onBlur={() => { setLeft(true) }}
            />
            <TextField
              size="small" label="Handle" value={labelDraft ?? followed} placeholder={followed} required sx={{ flex: 1 }}
              helperText={said ? FlawNotices[said] : ' '}
              error={said !== null}
              slotProps={{ htmlInput: { maxLength: PA.Userlabel.max } }}
              onChange={(event) => { setLabelDraft(event.target.value) }}
              onBlur={() => { setLeft(true); if (labelDraft === '') { setLabelDraft(null) } }}
            />
            {held === null
              ? (
                <Button type="submit" variant="contained" disabled={busy || flaw !== null} sx={{ height: 40, flexShrink: 0 }}>
                  {back ? AppNotices.saveName : AppNotices.signUp}
                </Button>
              )
              : <Typography variant="body2" role="status" sx={{ flex: 1, minHeight: 40, display: 'flex', alignItems: 'center' }}>{held}</Typography>}
          </Stack>
          {notice !== null && <p className={styles.microcopy} role="alert">{notice}</p>}
          {google !== null && <StandaloneDisclaimer />}
        </Stack>
      </Panel>
    </main>
  )
}

/**
 * What stands in place of the button for a userlabel someone holds: a word to sign in with Google,
 * where the front door offers it, for one a verified account holds, which may be the visitor's own;
 * that it is taken, for any other. Null for one that is free, or not yet known to be held.
 */
function heldNotice(holder: UserlabelHolderT | undefined, signingIn: boolean): string | null {
  if (holder === undefined || holder === null) { return null }
  return holder === 'verified' && signingIn ? AppNotices.heldByVerifiedAccount : AppNotices.heldOtherwise
}

/** What the userlabel field says beneath it of each flaw */
const FlawNotices = {
  shape:      AppNotices.userlabelShape,
  unfinished: AppNotices.userlabelUnfinished,
  reserved:   AppNotices.userlabelReserved,
} as const satisfies Record<LabelFlawT, string>
