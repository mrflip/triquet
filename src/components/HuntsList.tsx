'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button, IconButton, InputBase, Link, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from '@mui/material'
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined'
import * as Actor from '../lib/actor'
import * as Approve from '../lib/approve'
import * as Labelmaker from '../lib/labelmaker'
import { AppNotices } from '../lib/notices'
import * as Routes from '../lib/routes'
import { HomeRealmLabel } from '../models/realm'
import type { ListedHuntT } from '../lib/rows'
import { HuntRoleTitles } from '../models/hunting'
import { Ident, type IdentT } from '../models/ident'
import { useRaiseAlarm } from '../state/alarms'
import { useAccountActions, type AccountActionsHandle } from '../state/use-account-actions'
import { useHuntsList } from '../state/use-hunts-list'
import { useIdent } from '../state/use-ident'
import { HuntEditModal } from './HuntEditModal'
import NextLink from './NextLink'
import { useDraft } from './use-draft'
import { Panel } from './panels/Panel'
import { OpeningNotice } from './SyncNotices'
import styles from './workbench.module.css'

/** How many fresh labels a new hunt tries before giving up, each already taken by a hunt not listed here */
const NewHuntAttemptsMax = 3

/**
 * How wide the table of hunts must be for a hunt's quizzes to sit in a column of their own beside
 * it, rather than on a line of their own beneath it, as MUI's container-query shorthand.
 */
const RoomFor = { quizzesBeside: '@720' } as const

/** `sx` for the column of quizzes beside each hunt, shown only while there is room for it */
const QuizzesBeside = { display: { '@': 'none', [RoomFor.quizzesBeside]: 'table-cell' } } as const

/** `sx` for the line of quizzes beneath each hunt, shown only while there is no room beside it */
const QuizzesBeneath = { display: { '@': 'table-row', [RoomFor.quizzesBeside]: 'none' } } as const

/** `sx` for a hunt's own cells: ruled off beneath while its quizzes sit beside, and not when the line beneath is its quizzes */
const RuledWhileBeside = { borderBottomStyle: { '@': 'none', [RoomFor.quizzesBeside]: 'solid' } } as const

/** The mark beside a quiz's name saying whether it is locked, and what the mark means, for a hover and a screen reader */
const QuizSigils = {
  locked:   { glyph: '🔒', meaning: 'Locked' },
  unlocked: { glyph: '🤔', meaning: 'Still being worked on' },
} as const

/**
 * The hunts this visitor is on, a row of a table each, so that each hunt's title, their role there
 * and its doors line up down the page, with its quizzes to open; and a way to make another, which
 * they are then the smith of. A quiz opens in the presentation their role is shown. A hunt that
 * could not be made raises an alarm.
 *
 * A visitor who has not said who they are is sent to say so first, and brought back.
 */
export function HuntsList() {
  const router = useRouter()
  const { ident, actor, loaded } = useIdent()
  const hunts = useHuntsList()
  const { act, busy } = useAccountActions()
  const raise = useRaiseAlarm()

  useEffect(() => {
    if (loaded && ! ident) { router.replace(Routes.rootPath(Routes.huntsPath())) }
  }, [loaded, ident, router])

  if (! loaded || ! ident || hunts === null) {
    return <OpeningNotice notice={null} waiting={AppNotices.openingHunts} />
  }

  const onNew = async () => {
    // The label is settled here rather than in the action, because the address this is about
    // to go to has to name it. Only this visitor's own hunts are listed, so a hunt of someone
    // else's may already answer to it: then another is tried, and only the last refusal is said.
    for (let attempt = 1; attempt <= NewHuntAttemptsMax; attempt += 1) {
      const label = Labelmaker.freshLabelFor(hunts)
      const outcome = await act({ kind: 'new_hunt', label })
      if (outcome.kept) {
        router.push(Routes.quizPath({ hunt: label, realm: HomeRealmLabel, quiz: label }, 'smith'))
        return
      }
      if (attempt === NewHuntAttemptsMax || outcome.failurekind !== 'labelTaken') {
        raise(outcome.alarm)
        return
      }
    }
  }

  return (
    <main className={styles.page}>
      <Stack direction="row" useFlexGap sx={{ alignItems: 'center', flexWrap: 'wrap', columnGap: 1, mb: 1 }}>
        <Typography>You are</Typography>
        <IdentTitle ident={ident} act={act} />
        <Typography>({Ident.atLabel(ident)}).</Typography>
        <Link component={NextLink} href={Routes.switchIdentPath()}>Be someone else</Link>
      </Stack>
      <Panel title="Hunts" blurb="The hunts you are on, and the quizzes in each. Open a quiz to work on it as a smith, or to review it as a reviewer. To be put on someone else's hunt, ask one of its smiths to add you by your ident label.">
        <Button variant="outlined" size="small" disabled={busy} onClick={() => { void onNew() }}>+ New hunt</Button>
        {hunts.length === 0 && <p className={styles.microcopy}>{AppNotices.noHunts}</p>}
        {hunts.length > 0 && (
          <TableContainer sx={{ mt: 1, containerType: 'inline-size' }}>
            <Table size="small" aria-label="Your hunts" sx={{ '& th, & td': { px: 1, verticalAlign: 'baseline' } }}>
              <TableHead sx={{ '& th': { whiteSpace: 'nowrap' } }}>
                <TableRow>
                  <TableCell>Hunt</TableCell>
                  <TableCell>Your role</TableCell>
                  <TableCell />
                  <TableCell />
                  <TableCell sx={QuizzesBeside}>Quizzes</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {hunts.map((hunt) => <HuntRow key={hunt._id} hunt={hunt} actor={actor} />)}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Panel>
    </main>
  )
}

/**
 * What the visitor is called on screen, retitled in place: saved when it loses focus, and put
 * back as it was when left blank. A retitle not kept raises an alarm.
 */
function IdentTitle({ ident, act }: Readonly<{ ident: IdentT, act: AccountActionsHandle['act'] }>) {
  const raise = useRaiseAlarm()
  const retitle = async (title: string) => {
    const outcome = await act({ kind: 'retitle_ident', title })
    if (! outcome.kept) { raise(outcome.alarm) }
  }
  const { draft, onChange, onBlur } = useDraft(ident.title, (title) => { void retitle(title) }, (typed) => typed.trim() || ident.title)
  return (
    <InputBase
      value={draft}
      inputProps={{ 'aria-label': 'Your name', size: Math.max(draft.length, 4) }}
      onChange={(event) => { onChange(event.target.value) }}
      onBlur={onBlur}
      sx={{
        fontWeight:    700,
        px:            0.5,
        '& input':     { fieldSizing: 'content', minWidth: '4ch' },
        border:        '1px solid transparent',
        borderRadius:  'var(--radius-input)',
        '&:hover':       { borderColor: 'var(--border)' },
        '&.Mui-focused': { borderColor: 'var(--accent)' },
      }}
    />
  )
}

type HuntRowProps = {
  hunt:  ListedHuntT
  /** Who is looking, whose claims on the hunt decide whether they may edit it */
  actor: Actor.ActorT
}

/**
 * One hunt, as a row: its title, the visitor's role on it, a gear to edit it for whoever may (a
 * smith), its categories, and a link to each of its quizzes. The quizzes sit in a column of their
 * own while the table has room for them beside the rest (`RoomFor`), and on a line of their own
 * beneath it, across the whole table, when not; either way they flow on and wrap.
 */
function HuntRow({ hunt, actor }: Readonly<HuntRowProps>) {
  const [editing, setEditing] = useState(false)
  const editable = Approve.mayOffer('retitle_hunt', Actor.claimsOn(actor, hunt._id, hunt))
  return (
    <>
      <TableRow>
        <TableCell component="th" scope="row" sx={{ ...RuledWhileBeside, fontWeight: 600, width: { '@': '100%', [RoomFor.quizzesBeside]: 'auto' }, minWidth: { [RoomFor.quizzesBeside]: '12rem' } }}>{hunt.title}</TableCell>
        <TableCell sx={{ ...RuledWhileBeside, whiteSpace: 'nowrap' }}><span className={styles.microcopy}>{HuntRoleTitles[hunt.role]}</span></TableCell>
        <TableCell sx={RuledWhileBeside} padding="none">
          {editable && (
            <IconButton size="small" aria-label={`Edit hunt ${hunt.title}`} onClick={() => { setEditing(true) }}>
              <SettingsOutlinedIcon fontSize="small" />
            </IconButton>
          )}
          {editing && <HuntEditModal hunt={hunt} onClose={() => { setEditing(false) }} />}
        </TableCell>
        <TableCell sx={{ ...RuledWhileBeside, whiteSpace: 'nowrap' }}>
          <Link component={NextLink} href={Routes.categoriesPath(hunt.label)} aria-label={`Categories of ${hunt.title}`}>Categories</Link>
        </TableCell>
        <TableCell sx={{ ...QuizzesBeside, width: '100%' }}>
          <QuizLinks hunt={hunt} />
        </TableCell>
      </TableRow>
      <TableRow sx={QuizzesBeneath}>
        <TableCell colSpan={4}>
          <QuizLinks hunt={hunt} />
        </TableCell>
      </TableRow>
    </>
  )
}

/** A link to each of a hunt's quizzes, each marked locked or still being worked on, flowing on and wrapping */
function QuizLinks({ hunt }: Readonly<{ hunt: ListedHuntT }>) {
  return (
    <Stack direction="row" useFlexGap sx={{ flexWrap: 'wrap', columnGap: 3, rowGap: 0.5 }}>
      {hunt.realms.flatMap((realm) => realm.quizzes.map((quiz) => (
        <Link key={quiz._id} component={NextLink} href={Routes.quizPath({ hunt: hunt.label, realm: realm.label, quiz: quiz.label })}>
          <QuizSigil locked={quiz.locked} /> {quiz.title === '' ? AppNotices.untitledQuiz : quiz.title}
        </Link>
      )))}
    </Stack>
  )
}

/** The mark beside a quiz's name: locked, or still being worked on, said on hover and to a screen reader */
function QuizSigil({ locked }: Readonly<{ locked: boolean }>) {
  const { glyph, meaning } = QuizSigils[locked ? 'locked' : 'unlocked']
  return <span role="img" aria-label={meaning} title={meaning}>{glyph}</span>
}
