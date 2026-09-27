'use client'

import { useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Button, Link, Stack, Typography } from '@mui/material'
import * as Labelmaker from '../lib/labelmaker'
import { AppNotices } from '../lib/notices'
import * as Routes from '../lib/routes'
import { HomeRealmLabel } from '../models/realm'
import { huntListingsOf, type HuntListing } from '../state/quiz-rows'
import { useAccountActions } from '../state/use-account-actions'
import { useDirectory } from '../state/use-held-rows'
import { useIdent } from '../state/use-ident'
import NextLink from './NextLink'
import { Panel } from './panels/Panel'
import { OpeningNotice } from './SyncNotices'
import styles from './workbench.module.css'

/**
 * The hunts there are, each with its quizzes to open, and a way to make another. For the trial
 * every hunt is open to everyone, so every hunt is listed.
 *
 * A visitor who has not said who they are is sent to say so first, and brought back.
 */
export function HuntsList() {
  const router = useRouter()
  const { ident, loaded } = useIdent()
  const directory = useDirectory()
  const { act, busy, notice } = useAccountActions()

  useEffect(() => {
    if (loaded && ! ident) { router.replace(Routes.rootPath(Routes.huntsPath())) }
  }, [loaded, ident, router])

  const hunts = useMemo(() => (directory ? huntListingsOf(directory) : null), [directory])

  if (! loaded || ! ident || ! directory || hunts === null) {
    return <OpeningNotice notice={null} waiting={AppNotices.openingHunts} />
  }

  const onNew = async () => {
    // The label is settled here rather than in the action, because the address this is about
    // to go to has to name it.
    const label = Labelmaker.freshLabelFor(directory.hunts)
    const done = await act({ kind: 'new_hunt', label })
    if (done) { router.push(Routes.quizPath({ hunt: label, realm: HomeRealmLabel, quiz: label }, 'smith')) }
  }

  return (
    <main className={styles.page}>
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 1 }}>
        <Typography>You are <b>{ident.title}</b> ({ident.label}).</Typography>
        <Link component={NextLink} href={Routes.switchIdentPath()}>Be someone else</Link>
      </Stack>
      <Panel title="Hunts" blurb="Every hunt there is, and the quizzes in each. Open a quiz to work on it.">
        <Button variant="outlined" size="small" disabled={busy} onClick={() => { void onNew() }}>+ New hunt</Button>
        {notice !== null && <p className={styles.microcopy} role="alert">{notice}</p>}
        {hunts.length === 0 && <p className={styles.microcopy}>{AppNotices.noHunts}</p>}
        <Stack component="ul" spacing={1} sx={{ listStyle: 'none', p: 0, mt: 1 }}>
          {hunts.map((hunt) => <HuntEntry key={hunt.id} hunt={hunt} />)}
        </Stack>
      </Panel>
    </main>
  )
}

/** One hunt: its title and label, and a link to each of its quizzes */
function HuntEntry({ hunt }: Readonly<{ hunt: HuntListing }>) {
  const huntLabel = Labelmaker.effectiveLabelOf(hunt)
  return (
    <li>
      <Typography component="h3" sx={{ fontWeight: 600 }}>
        {hunt.title} <span className={styles.microcopy}>{huntLabel}</span>
      </Typography>
      <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
        {hunt.realms.flatMap((realm) => realm.quizzes.map((quiz) => (
          <Link key={quiz.id} component={NextLink} href={Routes.quizPath({ hunt: huntLabel, realm: realm.label, quiz: Labelmaker.effectiveLabelOf(quiz) })}>
            {quiz.locked ? '🔒 ' : ''}{quiz.title === '' ? AppNotices.untitledQuiz : quiz.title}
          </Link>
        )))}
      </Stack>
    </li>
  )
}
