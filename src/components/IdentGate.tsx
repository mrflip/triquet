'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button, Stack, TextField } from '@mui/material'
import { AppNotices } from '../lib/notices'
import * as Routes from '../lib/routes'
import * as PA from '../lib/vv/patterns'
import { Ident, type IdentT, type LabelFlawT } from '../models/ident'
import { useAccountActions } from '../state/use-account-actions'
import { useIdent } from '../state/use-ident'
import { Panel } from './panels/Panel'
import { OpeningNotice } from './SyncNotices'
import styles from './workbench.module.css'

/**
 * The front door: say who you are by your name and a username (an ident's label), and become that
 * ident -- a new one titled with the name, or one this browser already holds, which keeps the title
 * it has. The name takes anything. The username beside it is made from the name as it is typed,
 * until it is typed in itself; emptied, it follows the name again. From then on the two are apart:
 * retitling an ident never relabels it. The button says which username it will log in as, and stays
 * shut until that is a label. The username field says at once of a username no typing on would
 * mend, but of one too short only once either field has been left, as it may still be being typed.
 * A username another browser holds is refused, saying what to do instead, and the visitor may try
 * another at once. There is no password: the browser's session is what holds a username.
 *
 * A visitor who has already said is sent on at once: to where the address's `then` points, when
 * a link sent them here, and to their hunts otherwise. `?switch` keeps them here, to become
 * someone else, or to keep being who they are and go back -- which the button offers in place of
 * logging in when the username is their own.
 */
export function IdentGate() {
  const router = useRouter()
  const params = useSearchParams()
  const onward = Routes.thenFrom(params.get('then')) ?? Routes.huntsPath()
  const switching = params.has('switch')
  const { ident, loaded } = useIdent()
  const { act, busy, notice } = useAccountActions()
  const [nameDraft, setNameDraft] = useState('')
  // The username as typed into its own field, or null while it follows the name. Emptied, it is ''
  // until the name changes or the field is left: following again, but blank while being cleared.
  const [labelDraft, setLabelDraft] = useState<string | null>(null)
  // Whether either field has been left once: a username too short is said only after, as it may still be being typed.
  const [left, setLeft] = useState(false)
  // Sends once: the ident arriving by sync after this one was typed must not send twice.
  const sent = useRef(false)

  useEffect(() => {
    if (! loaded || ! ident || switching || sent.current) { return }
    sent.current = true
    router.replace(onward)
  }, [loaded, ident, switching, onward, router])

  if (! loaded || (ident && ! switching)) {
    return <OpeningNotice notice={null} waiting={AppNotices.opening} />
  }

  const followed = Ident.labelFor(nameDraft)
  const label = labelDraft === null || labelDraft === '' ? followed : labelDraft
  const flaw = Ident.flawIn(label)
  const said = Ident.flawToSay(label, left)
  // The visitor's own ident, when the username is its label: the button then keeps them who they are.
  const own = flaw === null && ident?.label === label ? ident : null

  const onSubmit = async () => {
    if (flaw !== null) { return }
    if (own) { router.replace(onward); return }
    const { kept } = await act({ kind: 'assume_ident', label, title: nameDraft })
    if (kept && switching) { router.replace(onward) }
  }

  return (
    <main className={styles.page}>
      <Panel title={AppNotices.identGateTitle} blurb="Your name is what others see, and you can change it later. Your username is how you log in and how others add you to a hunt: if nobody goes by it yet, it becomes yours, held by this browser. There is no password.">
        <Stack
          component="form" spacing={1.5} sx={{ maxWidth: 560, mt: 1 }}
          onSubmit={(event) => { event.preventDefault(); void onSubmit() }}
        >
          <Stack direction={{ xs: 'column', sm: 'row' }} useFlexGap spacing={1.5}>
            <TextField
              size="small" label="Your name" value={nameDraft} autoFocus sx={{ flex: 1 }}
              helperText=" "
              slotProps={{ htmlInput: { maxLength: PA.Titleish.max } }}
              onChange={(event) => { setNameDraft(event.target.value); if (labelDraft === '') { setLabelDraft(null) } }}
              onBlur={() => { setLeft(true) }}
            />
            <TextField
              size="small" label="Username" value={labelDraft ?? followed} placeholder={followed} required sx={{ flex: 1 }}
              helperText={said ? FlawNotices[said] : ' '}
              error={said !== null}
              slotProps={{ htmlInput: { maxLength: PA.Identlabel.max } }}
              onChange={(event) => { setLabelDraft(event.target.value) }}
              onBlur={() => { setLeft(true); if (labelDraft === '') { setLabelDraft(null) } }}
            />
          </Stack>
          <Stack direction="row" useFlexGap spacing={1} sx={{ flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            {ident && ! own && <Button disabled={busy} onClick={() => { router.replace(onward) }}>Keep being {Ident.byline(ident)}</Button>}
            <Button type="submit" variant="contained" disabled={busy || flaw !== null}>{submitTitle(label, flaw, own)}</Button>
          </Stack>
          {notice !== null && <p className={styles.microcopy} role="alert">{notice}</p>}
        </Stack>
      </Panel>
    </main>
  )
}

/** What the username field says beneath it of each flaw */
const FlawNotices = {
  shape:      AppNotices.usernameShape,
  unfinished: AppNotices.usernameUnfinished,
} as const satisfies Record<LabelFlawT, string>

/** What the primary button says: who it logs in as, or that it keeps the visitor who they are when the username is their own */
function submitTitle(label: string, flaw: LabelFlawT | null, own: IdentT | null): string {
  if (own) { return `Keep being ${Ident.byline(own)}` }
  return flaw === null ? `Log in as ${label}` : 'Log in'
}
