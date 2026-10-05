'use client'

import { useState } from 'react'
import { Box, Button, Stack, TextField } from '@mui/material'
import * as Labelmaker from '../lib/labelmaker'
import { AppNotices } from '../lib/notices'
import type { HuntListingT } from '../lib/rows'
import { HuntValidators } from '../models/hunt'
import { useAccountActions } from '../state/use-account-actions'

export type HuntBranchProps = {
  hunt:     Pick<HuntListingT, '_id' | 'branch'>
  /** Whether the visitor may switch it (a smith); anyone else reads it */
  editable: boolean
}

/**
 * The hunt's branch: the line of work every quiz of it is on, and the git branch each browser
 * commits their history to. Typed as a label is ("draft two" becomes `draft_two`) and switched
 * with a button, so a half-typed name never starts a branch. A switch the server refuses says why
 * beside the field.
 *
 * Mount it keyed by the hunt's branch, so that a switch made elsewhere replaces what is typed here.
 */
export function HuntBranch({ hunt, editable }: Readonly<HuntBranchProps>) {
  const { act, busy } = useAccountActions()
  const [draft, setDraft] = useState(hunt.branch)
  const [issue, setIssue] = useState<string | null>(null)
  const branch = Labelmaker.normalize(draft)

  const onSwitch = async () => {
    if (! HuntValidators.branch.safeParse(branch).success) { setIssue(AppNotices.branchShape); return }
    const outcome = await act({ kind: 'rebranch_hunt', hunt_id: hunt._id, branch })
    setIssue(outcome.kept ? null : outcome.alarm.notice)
  }

  return (
    <Box component="form" onSubmit={(event: React.SyntheticEvent) => { event.preventDefault(); void onSwitch() }}>
      <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-start' }}>
        <TextField
          label="Branch"
          value={draft}
          size="small"
          disabled={! editable}
          error={issue !== null}
          helperText={issue ?? AppNotices.branchHelp}
          onChange={(event) => { setDraft(event.target.value); setIssue(null) }}
        />
        {editable && <Button type="submit" size="small" variant="outlined" disabled={busy || branch === hunt.branch} sx={{ mt: 0.5, flexShrink: 0, whiteSpace: 'nowrap' }}>Switch branch</Button>}
      </Stack>
    </Box>
  )
}
