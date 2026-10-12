'use client'

import { useState } from 'react'
import { Button, MenuItem, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField } from '@mui/material'
import { ConfirmRemove } from '../ConfirmRemove'
import { CopyButton } from '../CopyButton'
import { GoogleSignInOffer } from '../GoogleSignIn'
import { Panel } from './Panel'
import * as Actor from '../../lib/actor'
import * as Approve from '../../lib/approve'
import { AppNotices, RefusalNotices } from '../../lib/notices'
import * as Routes from '../../lib/routes'
import * as PA from '../../lib/vv/patterns'
import type { MemberT } from '../../lib/rows'
import { HuntRoleTitles, HuntRoleVals, type HuntRole } from '../../models/huntship'
import { User, type LabelFlawT } from '../../models/user'
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
 * (not themselves: another smith does that), a row to put someone on by the handle they chose,
 * and the link that opens this quiz for review.
 */
export function MembersPanel({ members, claims, labels, carryOut, saveNotice }: Readonly<MembersPanelProps>) {
  return (
    <Panel title="Members" about="Who is on this hunt. Smiths work on its quizzes and say who else is on it; reviewers playtest them. Put someone on by the handle they chose; putting them on again changes their role. Only someone signed in with Google can be put on a hunt.">
      <TableContainer>
        <Table size="small" aria-label="Members of this hunt" sx={{ '& th, & td': { px: 1 } }}>
          <TableHead>
            <TableRow>
              <TableCell>Who</TableCell>
              <TableCell>Handle</TableCell>
              <TableCell>Role</TableCell>
              <TableCell />
            </TableRow>
          </TableHead>
          <TableBody>
            {members.map((member) => (
              <TableRow key={member.user_id}>
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
      {! Actor.isSealed(claims) && (
        <div className={styles.panelRow}>
          <CopyButton textOf={() => `${location.origin}${Routes.quizPath(labels, 'playtest')}`}>Copy reviewer link</CopyButton>
        </div>
      )}
    </Panel>
  )
}

/**
 * What a member's row offers whoever is looking: a button to take them off the hunt, which asks
 * first, where the policy allows it; their own row says it is theirs.
 */
function MemberDoor({ member, claims, carryOut }: Readonly<Pick<MembersPanelProps, 'claims' | 'carryOut'> & { member: MemberT }>) {
  const removal = { kind: 'remove_huntship', user_id: member.user_id } as const
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
 * The row that puts someone on the hunt: their handle (userlabel), their role, and a button. The
 * userlabel is checked as the front door checks one (`User.flawToSay`): one no typing on would
 * mend is said at once, one too short once the field is left. One refused, here, by the policy
 * (one's own: `ownHuntship`; any, by an anonymous smith: `sealedMembers`), or by the server (an
 * anonymous user: `sealedJoin`), says why beneath it until it is changed; an anonymous smith is
 * offered signing in with Google beneath that.
 */
function AddMember({ claims, carryOut, saveNotice }: Readonly<Pick<MembersPanelProps, 'claims' | 'carryOut' | 'saveNotice'>>) {
  const [labelDraft, setLabelDraft] = useState('')
  const [role, setRole] = useState<HuntRole>('reviewer')
  const [issue, setIssue] = useState<string | null>(null)
  // Whether the field has been left since it was last emptied: a label too short is said only after, as it may still be being typed.
  const [left, setLeft] = useState(false)
  // Whether the server refused the last add, so its notice belongs beneath the label too.
  const [refused, setRefused] = useState(false)
  const said = User.flawToSay(labelDraft, left)
  const shown = issue ?? (said ? FlawNotices[said] : null) ?? (refused ? saveNotice : null)

  const onAdd = async () => {
    const userlabel = labelDraft
    if (userlabel === '') { setIssue(AppNotices.memberLabelNeeded); return }
    if (User.flawIn(userlabel) !== null) { setLeft(true); return }
    const addition = { kind: 'add_huntship', userlabel, role } as const
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
    <>
      <Stack
        component="form" direction="row" spacing={1} sx={{ alignItems: 'flex-start', mt: 1 }}
        onSubmit={(event) => { event.preventDefault(); void onAdd() }}
      >
        <TextField
          size="small" label="Their handle" value={labelDraft} sx={{ flex: 1 }}
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
      {shown === RefusalNotices.sealedMembers && <GoogleSignInOffer />}
    </>
  )
}

/** What the handle field says beneath it of each flaw */
const FlawNotices = {
  shape:      AppNotices.memberLabelShape,
  unfinished: AppNotices.memberLabelUnfinished,
  reserved:   AppNotices.memberLabelReserved,
} as const satisfies Record<LabelFlawT, string>
