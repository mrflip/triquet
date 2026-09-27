'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button, Stack, TextField } from '@mui/material'
import { AppNotices } from '../lib/notices'
import * as Routes from '../lib/routes'
import { Ident, IdentValidators } from '../models/ident'
import { useAccountActions } from '../state/use-account-actions'
import { useIdent } from '../state/use-ident'
import { Panel } from './panels/Panel'
import { OpeningNotice } from './SyncNotices'
import styles from './workbench.module.css'

/**
 * The front door: say who you are by typing an ident's label, and become that ident -- the one
 * there is, or a new one under the title given. There is no password: anyone may be anyone, for
 * now.
 *
 * A visitor who has already said is sent on at once: to where the address's `then` points, when
 * a link sent them here, and to their hunts otherwise. `?switch` keeps them here, to become
 * someone else.
 */
export function IdentGate() {
  const router = useRouter()
  const params = useSearchParams()
  const then = Routes.thenFrom(params.get('then'))
  const switching = params.has('switch')
  const { ident, loaded } = useIdent()
  const { act, busy, notice } = useAccountActions()
  const [labelDraft, setLabelDraft] = useState('')
  const [titleDraft, setTitleDraft] = useState('')
  const [issue, setIssue] = useState<string | null>(null)
  // Sends once: the ident arriving by sync after this one was typed must not send twice.
  const sent = useRef(false)

  useEffect(() => {
    if (! loaded || ! ident || switching || sent.current) { return }
    sent.current = true
    router.replace(then ?? Routes.huntsPath())
  }, [loaded, ident, switching, then, router])

  if (! loaded || (ident && ! switching)) {
    return <OpeningNotice notice={null} waiting={AppNotices.opening} />
  }

  const onSubmit = async () => {
    const label = Ident.labelFor(labelDraft)
    if (label === '') { setIssue(AppNotices.identLabelNeeded); return }
    if (! IdentValidators.identLabel.safeParse(label).success) { setIssue(AppNotices.identLabelShape); return }
    setIssue(null)
    const done = await act({ kind: 'assume_ident', label, title: titleDraft })
    if (done && switching) { router.replace(then ?? Routes.huntsPath()) }
  }

  return (
    <main className={styles.page}>
      <Panel title="Who are you?" blurb="Type the label you go by. If nobody goes by it yet, it becomes yours, under the title you give it; if somebody does, you become them. There is no password.">
        {ident && <p className={styles.microcopy}>You are {ident.title} ({ident.label}) now.</p>}
        <Stack
          component="form" spacing={1.5} sx={{ maxWidth: 420, mt: 1 }}
          onSubmit={(event) => { event.preventDefault(); void onSubmit() }}
        >
          <TextField
            size="small" label="Ident label" value={labelDraft} autoFocus required
            helperText={issue ?? (labelDraft === '' ? ' ' : `You will be “${Ident.labelFor(labelDraft)}”.`)}
            error={issue !== null}
            onChange={(event) => { setLabelDraft(event.target.value); setIssue(null) }}
          />
          <TextField
            size="small" label="Title" value={titleDraft} helperText="What to call a new ident on screen; ignored if the ident exists."
            onChange={(event) => { setTitleDraft(event.target.value) }}
          />
          <Button type="submit" variant="contained" disabled={busy}>Continue</Button>
          {notice !== null && <p className={styles.microcopy} role="alert">{notice}</p>}
        </Stack>
      </Panel>
    </main>
  )
}
