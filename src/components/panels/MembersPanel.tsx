'use client'

import { useState } from 'react'
import { Button, MenuItem, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField } from '@mui/material'
import { ConfirmRemove } from '../ConfirmRemove'
import { CopyButton } from '../CopyButton'
import { Panel } from './Panel'
import * as Actor from '../../lib/actor'
import * as Approve from '../../lib/approve'
import { AppNotices, RefusalNotices } from '../../lib/notices'
import * as Routes from '../../lib/routes'
import * as PA from '../../lib/vv/patterns'
import type { MemberT } from '../../lib/rows'
import { HuntRoleTitles, HuntRoleVals, type HuntRole } from '../../models/hunting'
import { Ident, type LabelFlawT } from '../../models/ident'
import type { HuntHandle } from '../../state/use-hunt'
import styles from '../workbench.module.css'

export type MembersPanelProps = Pick<HuntHandle, 'carryOut' | 'saveNotice'> & {
  /** Who is on the hunt, in the order they were put on it */
  members: readonly MemberT[]
  /** What whoever is looking holds of themselves on the hunt: who may be put on or taken off is asked of the policy (`Approve`) */
  claims:  Actor.HuntClaimsT
  /** The quiz on screen, which the reviewer link opens to playtest */
  labels:  Routes.HuntLabels & Routes.QuizLabels
}

/**
 * Who is on the hunt and in what role, for a smith: a button to take off each the policy lets them
 * (not themselves: another smith does that), a row to put someone on by the ident label they
 * chose, and the link that opens this quiz for review.
 */
export function MembersPanel({ members, claims, labels, carryOut, saveNotice }: Readonly<MembersPanelProps>) {
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
                  <MemberDoor member={member} claims={claims} carryOut={carryOut} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      <AddMember claims={claims} carryOut={carryOut} saveNotice={saveNotice} />
      <div className={styles.panelRow}>
        <CopyButton textOf={() => `${location.origin}${Routes.quizPath(labels, 'playtest')}`}>Copy reviewer link</CopyButton>
      </div>
    </Panel>
  )
}

/**
 * What a member's row offers whoever is looking: a button to take them off the hunt, which asks
 * first, where the policy allows it; their own row says it is theirs.
 */
function MemberDoor({ member, claims, carryOut }: Readonly<Pick<MembersPanelProps, 'claims' | 'carryOut'> & { member: MemberT }>) {
  const removal = { kind: 'remove_hunting', ident_id: member.ident_id } as const
  if (Actor.isOneself(claims, member)) { return <span className={styles.microcopy}>you</span> }
  if (! Approve.may(removal.kind, claims, removal)) { return null }
  return (
    <ConfirmRemove
      form="icon" noun={member.label}
      question={`Take ${member.label} off the hunt? They can be put back on, in any role.`}
      onConfirm={() => { void carryOut(removal) }}
    />
  )
}

/**
 * The row that puts someone on the hunt: their ident label, their role, and a button. The label is
 * checked as the front door checks a username (`Ident.flawToSay`): one no typing on would mend is
 * said at once, one too short once the field is left. A label refused, here, by the policy (one's
 * own: `ownHunting`), or by the server, says why beneath it until it is changed.
 */
function AddMember({ claims, carryOut, saveNotice }: Readonly<Pick<MembersPanelProps, 'claims' | 'carryOut' | 'saveNotice'>>) {
  const [labelDraft, setLabelDraft] = useState('')
  const [role, setRole] = useState<HuntRole>('reviewer')
  const [issue, setIssue] = useState<string | null>(null)
  // Whether the field has been left since it was last emptied: a label too short is said only after, as it may still be being typed.
  const [left, setLeft] = useState(false)
  // Whether the server refused the last add, so its notice belongs beneath the label too.
  const [refused, setRefused] = useState(false)
  const said = Ident.flawToSay(labelDraft, left)
  const shown = issue ?? (said ? FlawNotices[said] : null) ?? (refused ? saveNotice : null)

  const onAdd = async () => {
    const ident_label = labelDraft
    if (ident_label === '') { setIssue(AppNotices.identLabelNeeded); return }
    if (Ident.flawIn(ident_label) !== null) { setLeft(true); return }
    const addition = { kind: 'add_hunting', ident_label, role } as const
    const verdict = Approve.verdictOn(addition.kind, claims, addition)
    if (verdict !== Approve.Allow) { setIssue(RefusalNotices[verdict]); return }
    setIssue(null)
    const kept = await carryOut(addition, { quietly: true })
    setRefused(! kept)
    if (! kept) { return }
    setLabelDraft('')
    setLeft(false)
  }

  return (
    <Stack
      component="form" direction="row" spacing={1} sx={{ alignItems: 'flex-start', mt: 1 }}
      onSubmit={(event) => { event.preventDefault(); void onAdd() }}
    >
      <TextField
        size="small" label="Ident label" value={labelDraft} sx={{ flex: 1 }}
        helperText={shown ?? ' '} error={shown !== null}
        slotProps={{ htmlInput: { maxLength: PA.Userlabel.max } }}
        onChange={(event) => { setLabelDraft(event.target.value); setIssue(null); setRefused(false) }}
        onBlur={() => { setLeft(true) }}
      />
      <TextField select size="small" label="Role" value={role}
        onChange={(event) => { setRole(HuntRoleVals.find((each) => each === event.target.value) ?? 'reviewer') }}>
        {HuntRoleVals.map((each) => <MenuItem key={each} value={each}>{HuntRoleTitles[each]}</MenuItem>)}
      </TextField>
      <Button type="submit" variant="outlined" size="small" sx={{ mt: 0.5 }}>Add</Button>
    </Stack>
  )
}

/** What the label field says beneath it of each flaw */
const FlawNotices = {
  shape:      AppNotices.identLabelShape,
  unfinished: AppNotices.identLabelUnfinished,
  reserved:   AppNotices.identLabelReserved,
} as const satisfies Record<LabelFlawT, string>
