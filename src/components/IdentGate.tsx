'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button, Stack, TextField } from '@mui/material'
import { AppNotices } from '../lib/notices'
import * as Routes from '../lib/routes'
import { Ident, type IdentT, type LabelFlawT } from '../models/ident'
import { useAccountActions } from '../state/use-account-actions'
import { useIdent } from '../state/use-ident'
import { Panel } from './panels/Panel'
import { OpeningNotice } from './SyncNotices'
import styles from './workbench.module.css'

/**
 * The front door: say who you are by typing an ident's label (a username, on screen), and become
 * that ident -- a new one titled after its label, which its owner can retitle from their hunts, or
 * one this browser already holds. The button says which label it will log in as, as it will be
 * claimed, and stays shut until what is typed is one. The field says at once of a character no
 * label keeps, but of a label too short only once it has been left, as it may still be being typed.
 * A username another browser holds is refused, saying what to do instead, and the visitor may try
 * another at once. There is no password: the browser's session is what holds a username.
 *
 * A visitor who has already said is sent on at once: to where the address's `then` points, when
 * a link sent them here, and to their hunts otherwise. `?switch` keeps them here, to become
 * someone else, or to keep being who they are and go back -- which the button offers in place of
 * logging in when what they type is their own label.
 */
export function IdentGate() {
  const router = useRouter()
  const params = useSearchParams()
  const onward = Routes.thenFrom(params.get('then')) ?? Routes.huntsPath()
  const switching = params.has('switch')
  const { ident, loaded } = useIdent()
  const { act, busy, notice } = useAccountActions()
  const [labelDraft, setLabelDraft] = useState('')
  // Whether the field has been left once: a label too short is said only after, as it may still be being typed.
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

  const label = Ident.labelFor(labelDraft)
  const flaw = Ident.flawIn(labelDraft)
  const said = flaw === 'shape' || (left && labelDraft !== '' && flaw === 'length') ? flaw : null
  // The visitor's own ident, when what they typed is its label: the button then keeps them who they are.
  const own = flaw === null && ident?.label === label ? ident : null

  const onSubmit = async () => {
    if (flaw !== null) { return }
    if (own) { router.replace(onward); return }
    const { kept } = await act({ kind: 'assume_ident', label, title: '' })
    if (kept && switching) { router.replace(onward) }
  }

  return (
    <main className={styles.page}>
      <Panel title={AppNotices.identGateTitle} blurb="If nobody goes by it yet, it becomes yours, held by this browser. There is no password.">
        <Stack
          component="form" spacing={1.5} sx={{ maxWidth: 420, mt: 1 }}
          onSubmit={(event) => { event.preventDefault(); void onSubmit() }}
        >
          <TextField
            size="small" label="Username" value={labelDraft} autoFocus required
            helperText={said ? FlawNotices[said] : ' '}
            error={said !== null}
            onChange={(event) => { setLabelDraft(event.target.value) }}
            onBlur={() => { setLeft(true) }}
          />
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

/** What the field says beneath it of each flaw */
const FlawNotices = {
  shape:  AppNotices.usernameShape,
  length: AppNotices.usernameLength,
} as const satisfies Record<LabelFlawT, string>

/** What the primary button says: who it logs in as, or that it keeps the visitor who they are when they typed their own label */
function submitTitle(label: string, flaw: LabelFlawT | null, own: IdentT | null): string {
  if (own) { return `Keep being ${Ident.byline(own)}` }
  return flaw === null ? `Log in as ${label}` : 'Log in'
}
