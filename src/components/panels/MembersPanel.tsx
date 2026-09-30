'use client'

import { useState } from 'react'
import { Button, MenuItem, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField } from '@mui/material'
import { CopyButton } from '../CopyButton'
import { Panel } from './Panel'
import { AppNotices } from '../../lib/notices'
import * as Routes from '../../lib/routes'
import type { MemberT } from '../../lib/rows'
import { HuntRoleTitles, HuntRoleVals, type HuntRole } from '../../models/hunting'
import { Ident, IdentValidators } from '../../models/ident'
import type { HuntHandle } from '../../state/use-hunt'
import styles from '../workbench.module.css'

export type MembersPanelProps = Pick<HuntHandle, 'carryOut' | 'saveNotice'> & {
  /** Who is on the hunt, in the order they were put on it */
  members: readonly MemberT[]
  /** Who is looking: a smith, who may not take themselves off */
  self_id: string
  /** The quiz on screen, which the reviewer link opens for review */
  labels:  Routes.QuizLabels
}

/**
 * Who is on the hunt and in what role, for a smith: a row to take each off, a row to put someone
 * on by the ident label they chose, and the link that opens this quiz for review.
 */
export function MembersPanel({ members, self_id, labels, carryOut, saveNotice }: Readonly<MembersPanelProps>) {
  return (
    <Panel title="Members" blurb="Who is on this hunt. Smiths work on its quizzes and say who else is on it; reviewers playtest them. Put someone on by the ident label they chose; putting them on again changes their role.">
      <TableContainer>
        <Table size="small" aria-label="Members of this hunt" sx={{ '& th, & td': { px: 1 } }}>
          <TableHead>
            <TableRow>
              <TableCell>Who</TableCell>
              <TableCell>Label</TableCell>
              <TableCell>Role</TableCell>
              <TableCell />
            </TableRow>
          </TableHead>
          <TableBody>
            {members.map((member) => (
              <TableRow key={member.ident_id}>
                <TableCell>{member.title}</TableCell>
                <TableCell>{member.label}</TableCell>
                <TableCell>{HuntRoleTitles[member.role]}</TableCell>
                <TableCell align="right">
                  {member.ident_id === self_id ? <span className={styles.microcopy}>you</span> : (
                    <Button size="small" aria-label={`Remove ${member.label}`} onClick={() => { void carryOut({ kind: 'remove_hunting', ident_id: member.ident_id }) }}>
                      Remove
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      <AddMember carryOut={carryOut} saveNotice={saveNotice} />
      <div className={styles.panelRow}>
        <CopyButton textOf={() => `${location.origin}${Routes.quizPath(labels, 'review')}`}>Copy reviewer link</CopyButton>
      </div>
    </Panel>
  )
}

/**
 * The row that puts someone on the hunt: their ident label, their role, and a button. A label
 * refused, here or by the server, says why beneath it until it is changed.
 */
function AddMember({ carryOut, saveNotice }: Readonly<Pick<HuntHandle, 'carryOut' | 'saveNotice'>>) {
  const [labelDraft, setLabelDraft] = useState('')
  const [role, setRole] = useState<HuntRole>('reviewer')
  const [issue, setIssue] = useState<string | null>(null)
  // Whether the server refused the last add, so its notice belongs beneath the label too.
  const [refused, setRefused] = useState(false)
  const shown = issue ?? (refused ? saveNotice : null)

  const onAdd = async () => {
    const ident_label = Ident.labelFor(labelDraft)
    if (ident_label === '') { setIssue(AppNotices.identLabelNeeded); return }
    if (! IdentValidators.identLabel.safeParse(ident_label).success) { setIssue(AppNotices.identLabelShape); return }
    setIssue(null)
    const kept = await carryOut({ kind: 'add_hunting', ident_label, role }, { quietly: true })
    setRefused(! kept)
    if (kept) { setLabelDraft('') }
  }

  return (
    <Stack
      component="form" direction="row" spacing={1} sx={{ alignItems: 'flex-start', mt: 1 }}
      onSubmit={(event) => { event.preventDefault(); void onAdd() }}
    >
      <TextField
        size="small" label="Ident label" value={labelDraft} sx={{ flex: 1 }}
        helperText={shown ?? ' '} error={shown !== null}
        onChange={(event) => { setLabelDraft(event.target.value); setIssue(null); setRefused(false) }}
      />
      <TextField select size="small" label="Role" value={role}
        onChange={(event) => { setRole(HuntRoleVals.find((each) => each === event.target.value) ?? 'reviewer') }}>
        {HuntRoleVals.map((each) => <MenuItem key={each} value={each}>{HuntRoleTitles[each]}</MenuItem>)}
      </TextField>
      <Button type="submit" variant="outlined" size="small" sx={{ mt: 0.5 }}>Add</Button>
    </Stack>
  )
}
