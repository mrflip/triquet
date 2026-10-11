'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button, Stack, TextField } from '@mui/material'
import { AppNotices } from '../lib/notices'
import * as Routes from '../lib/routes'
import * as PA from '../lib/vv/patterns'
import { User, type LabelFlawT } from '../models/user'
import { useUserActions } from '../state/use-user-actions'
import { useMe } from '../state/use-me'
import { Panel } from './panels/Panel'
import { OpeningNotice } from './SyncNotices'
import styles from './workbench.module.css'

/**
 * The front door: say who you are by your name and a userlabel (a handle, on screen), which this
 * browser's user takes, titled with the name. The name takes anything. The userlabel beside it is
 * made from the name as it is typed (`User.labelFor`), until it is typed in itself; emptied, it
 * follows the name again. From then on the two are apart: retitling a user never relabels it. The
 * button says which userlabel it will log in as, and stays shut until that is a label. The
 * userlabel field says at once of a userlabel no typing on would mend, but of one too short only
 * once either field has been left, as it may still be being typed. A userlabel that is not free is
 * refused, saying what to do instead, and the visitor may try another at once. There is no
 * password: the browser's session is what holds its user, and a user's userlabel is chosen once.
 *
 * A visitor who has already said is sent on at once: to where the address's `then` points, when
 * a link sent them here, and to their hunts otherwise.
 */
export function UserlabelGate() {
  const router = useRouter()
  const params = useSearchParams()
  const onward = Routes.thenFrom(params.get('then')) ?? Routes.huntsPath()
  const { user, loaded } = useMe()
  const { act, busy, notice } = useUserActions()
  const [nameDraft, setNameDraft] = useState('')
  // The userlabel as typed into its own field, or null while it follows the name. Emptied, it is ''
  // until the name changes or the field is left: following again, but blank while being cleared.
  const [labelDraft, setLabelDraft] = useState<string | null>(null)
  // Whether either field has been left once: a userlabel too short is said only after, as it may still be being typed.
  const [left, setLeft] = useState(false)
  // Sends once: the user arriving by sync after its userlabel was typed must not send twice.
  const sent = useRef(false)

  useEffect(() => {
    if (! loaded || ! user || sent.current) { return }
    sent.current = true
    router.replace(onward)
  }, [loaded, user, onward, router])

  if (! loaded || user) {
    return <OpeningNotice notice={null} waiting={AppNotices.opening} />
  }

  const followed = User.labelFor(nameDraft)
  const label = labelDraft === null || labelDraft === '' ? followed : labelDraft
  const flaw = User.flawIn(label)
  const said = User.flawToSay(label, left)

  const onSubmit = async () => {
    if (flaw !== null) { return }
    // Once the user holds it, it arrives by sync, and the effect above sends them on.
    await act({ kind: 'assume_userlabel', userlabel: label, title: nameDraft })
  }

  return (
    <main className={styles.page}>
      <Panel title={AppNotices.userlabelGateTitle} blurb="Your name is what others see, and you can change it later. Your handle is how you log in and how others add you to a hunt: if nobody goes by it yet, it becomes yours for good, held by this browser. There is no password.">
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
              size="small" label="Handle" value={labelDraft ?? followed} placeholder={followed} required sx={{ flex: 1 }}
              helperText={said ? FlawNotices[said] : ' '}
              error={said !== null}
              slotProps={{ htmlInput: { maxLength: PA.Userlabel.max } }}
              onChange={(event) => { setLabelDraft(event.target.value) }}
              onBlur={() => { setLeft(true); if (labelDraft === '') { setLabelDraft(null) } }}
            />
          </Stack>
          <Stack direction="row" useFlexGap spacing={1} sx={{ flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <Button type="submit" variant="contained" disabled={busy || flaw !== null}>{submitTitle(label, flaw)}</Button>
          </Stack>
          {notice !== null && <p className={styles.microcopy} role="alert">{notice}</p>}
        </Stack>
      </Panel>
    </main>
  )
}

/** What the userlabel field says beneath it of each flaw */
const FlawNotices = {
  shape:      AppNotices.userlabelShape,
  unfinished: AppNotices.userlabelUnfinished,
  reserved:   AppNotices.userlabelReserved,
} as const satisfies Record<LabelFlawT, string>

/** What the primary button says: who it logs in as, once that is a userlabel */
function submitTitle(label: string, flaw: LabelFlawT | null): string {
  return flaw === null ? `Log in as ${label}` : 'Log in'
}
