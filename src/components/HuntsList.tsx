'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button, InputBase, Link, Stack, Typography } from '@mui/material'
import * as Labelmaker from '../lib/labelmaker'
import { AppNotices } from '../lib/notices'
import * as Routes from '../lib/routes'
import { HomeRealmLabel } from '../models/realm'
import type { ListedHuntT } from '../lib/rows'
import { HuntRoleTitles } from '../models/hunting'
import type { IdentT } from '../models/ident'
import { useAccountActions, type AccountActionsHandle } from '../state/use-account-actions'
import { useHuntsList } from '../state/use-hunts-list'
import { useIdent } from '../state/use-ident'
import NextLink from './NextLink'
import { useDraft } from './use-draft'
import { Panel } from './panels/Panel'
import { OpeningNotice } from './SyncNotices'
import styles from './workbench.module.css'

/** How many fresh labels a new hunt tries before giving up, each already taken by a hunt not listed here */
const NewHuntAttemptsMax = 3

/**
 * The hunts this visitor is on, each with their role there and its quizzes to open, and a way to
 * make another, which they are then the smith of. A quiz opens in the presentation their role is
 * shown.
 *
 * A visitor who has not said who they are is sent to say so first, and brought back.
 */
export function HuntsList() {
  const router = useRouter()
  const { ident, loaded } = useIdent()
  const hunts = useHuntsList()
  const { act, busy, notice } = useAccountActions()

  useEffect(() => {
    if (loaded && ! ident) { router.replace(Routes.rootPath(Routes.huntsPath())) }
  }, [loaded, ident, router])

  if (! loaded || ! ident || hunts === null) {
    return <OpeningNotice notice={null} waiting={AppNotices.openingHunts} />
  }

  const onNew = async () => {
    // The label is settled here rather than in the action, because the address this is about
    // to go to has to name it. Only this visitor's own hunts are listed, so a hunt of someone
    // else's may already answer to it: then another is tried.
    for (let attempt = 0; attempt < NewHuntAttemptsMax; attempt += 1) {
      const label = Labelmaker.freshLabelFor(hunts)
      const outcome = await act({ kind: 'new_hunt', label })
      if (outcome.kept) {
        router.push(Routes.quizPath({ hunt: label, realm: HomeRealmLabel, quiz: label }, 'smith'))
        return
      }
      if (outcome.failurekind !== 'labelTaken') { return }
    }
  }

  return (
    <main className={styles.page}>
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 1 }}>
        <Typography>You are</Typography>
        <IdentTitle ident={ident} act={act} />
        <Typography>({ident.label}).</Typography>
        <Link component={NextLink} href={Routes.switchIdentPath()}>Be someone else</Link>
      </Stack>
      <Panel title="Hunts" blurb="The hunts you are on, and the quizzes in each. Open a quiz to work on it as a smith, or to review it as a reviewer. To be put on someone else's hunt, ask one of its smiths to add you by your ident label.">
        <Button variant="outlined" size="small" disabled={busy} onClick={() => { void onNew() }}>+ New hunt</Button>
        {notice !== null && <p className={styles.microcopy} role="alert">{notice}</p>}
        {hunts.length === 0 && <p className={styles.microcopy}>{AppNotices.noHunts}</p>}
        <Stack component="ul" spacing={1} sx={{ listStyle: 'none', p: 0, mt: 1 }}>
          {hunts.map((hunt) => <HuntEntry key={hunt._id} hunt={hunt} />)}
        </Stack>
      </Panel>
    </main>
  )
}

/**
 * What the visitor is called on screen, retitled in place: saved when it loses focus, and put
 * back as it was when left blank.
 */
function IdentTitle({ ident, act }: Readonly<{ ident: IdentT, act: AccountActionsHandle['act'] }>) {
  const { draft, onChange, onBlur } = useDraft(ident.title, (title) => { void act({ kind: 'retitle_ident', title }) }, (typed) => typed.trim() || ident.title)
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

/** One hunt: its title and label, the visitor's role on it, and a link to each of its quizzes */
function HuntEntry({ hunt }: Readonly<{ hunt: ListedHuntT }>) {
  const huntLabel = Labelmaker.effectiveLabelOf(hunt)
  return (
    <li>
      <Typography component="h3" sx={{ fontWeight: 600 }}>
        {hunt.title} <span className={styles.microcopy}>{huntLabel} · {HuntRoleTitles[hunt.role]}</span>
      </Typography>
      <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
        {hunt.realms.flatMap((realm) => realm.quizzes.map((quiz) => (
          <Link key={quiz._id} component={NextLink} href={Routes.quizPath({ hunt: huntLabel, realm: realm.label, quiz: Labelmaker.effectiveLabelOf(quiz) })}>
            {quiz.locked ? '🔒 ' : ''}{quiz.title === '' ? AppNotices.untitledQuiz : quiz.title}
          </Link>
        )))}
      </Stack>
    </li>
  )
}
