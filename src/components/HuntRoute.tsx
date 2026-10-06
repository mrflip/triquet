'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Box, Link, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow } from '@mui/material'
import * as Actor from '../lib/actor'
import * as Approve from '../lib/approve'
import { AppNotices, noSuchHuntNotice } from '../lib/notices'
import * as Routes from '../lib/routes'
import type { ShallowHuntT } from '../lib/rows'
import { HuntRoleTitles } from '../models/hunting'
import { useHuntOpening } from '../state/use-hunt-opening'
import { useIdent } from '../state/use-ident'
import { useShowHunt } from '../state/shown-hunt'
import { FullHistoryDownload } from './FullHistoryDownload'
import { HuntBranch } from './HuntBranch'
import { QuizLinks } from './HuntsList'
import NextLink from './NextLink'
import { NotOnHunt } from './NotOnHunt'
import { Panel } from './panels/Panel'
import { OpeningNotice } from './SyncNotices'
import { useCanonical } from './use-address'
import styles from './workbench.module.css'

export type HuntRouteProps = {
  /** The org the address names; null for an old address, which names none */
  org:       string | null
  /** The hunt the address names */
  huntLabel: string
  /** Which of the hunt's screens: its own page, or the list of its quizzes */
  screen:    'hunt' | 'quizzes'
}

/** Where `screen` of the hunt `labels` names lives */
function pathOf(screen: HuntRouteProps['screen'], labels: Routes.HuntLabels): string {
  return screen === 'hunt' ? Routes.huntPath(labels) : Routes.quizzesPath(labels)
}

/**
 * What an address naming a hunt shows: its quizzes, its branch, its history to download, the way
 * to its categories, and who is on it; or, for its quizzes alone, those.
 *
 * A visitor who has not said who they are is sent to say so, and brought back here. A visitor not
 * on the hunt is told which smiths to ask; an address naming no hunt says so. An address naming
 * another org than the hunt's, or none, moves to the hunt's own (`useCanonical`).
 */
export function HuntRoute({ org, huntLabel, screen }: Readonly<HuntRouteProps>) {
  const router = useRouter()
  const { ident, actor, loaded } = useIdent()
  const { finding, hunt, smiths } = useHuntOpening(org, huntLabel)
  useShowHunt(hunt)
  useCanonical(org === null ? null : pathOf(screen, { org, hunt: huntLabel }), hunt && pathOf(screen, { org: hunt.org, hunt: hunt.label }))

  useEffect(() => {
    if (loaded && ! ident) { router.replace(Routes.rootPath(`${location.pathname}${location.search}`)) }
  }, [loaded, ident, router])

  useEffect(() => {
    document.title = hunt ? `${hunt.title} — Triquet` : 'Triquet'
  }, [hunt])

  if (! loaded || ! ident || finding === 'waiting') { return <OpeningNotice notice={null} waiting={AppNotices.openingHunt} /> }
  if (finding === 'refused') { return <NotOnHunt playtestPath={null} ident={ident} claims={null} smiths={smiths} /> }
  if (! hunt) { return <NoSuchHunt org={org} huntLabel={huntLabel} /> }
  return screen === 'hunt' ? <HuntScreen hunt={hunt} actor={actor} /> : <QuizzesScreen hunt={hunt} />
}

/** What an address naming a hunt says when its org has no hunt by that label, with the way back to the visitor's hunts */
export function NoSuchHunt({ org, huntLabel }: Readonly<Pick<HuntRouteProps, 'org' | 'huntLabel'>>) {
  return (
    <main className={styles.page}>
      <Panel title="No such hunt" blurb={noSuchHuntNotice(org, huntLabel)}>
        <Link component={NextLink} href={Routes.huntsPath()}>Your hunts</Link>
      </Panel>
    </main>
  )
}

/** Every quiz of the hunt, with the way to the hunt's own page */
function QuizzesScreen({ hunt }: Readonly<{ hunt: ShallowHuntT }>) {
  return (
    <main className={styles.page}>
      <Panel title={`Quizzes of ${hunt.title}`} blurb={`Every quiz this hunt holds. You are on it as ${HuntRoleTitles[hunt.role]}: open a quiz to work on it as a smith, or to review it as a reviewer.`}>
        <QuizLinks hunt={hunt} />
        <Box sx={{ mt: 2 }}>
          <Link component={NextLink} href={Routes.huntPath({ org: hunt.org, hunt: hunt.label })}>The hunt&apos;s own page</Link>
        </Box>
      </Panel>
    </main>
  )
}

/** The hunt's own page: its quizzes, its branch, its history to download, the way to its categories, and who is on it in what role */
function HuntScreen({ hunt, actor }: Readonly<{ hunt: ShallowHuntT, actor: Actor.ActorT }>) {
  const rebranchable = Approve.mayOffer('rebranch_hunt', Actor.claimsOn(actor, hunt._id, hunt))
  return (
    <Stack component="main" className={styles.page} spacing={2.5} sx={{ maxWidth: 960 }}>
      <Panel title="Quizzes" blurb={`Every quiz this hunt holds. You are on it as ${HuntRoleTitles[hunt.role]}: open a quiz to work on it as a smith, or to review it as a reviewer.`}>
        <QuizLinks hunt={hunt} />
      </Panel>
      <Panel title="Branch" blurb="The line of work every quiz of this hunt is on, and the git branch each browser keeps their history on.">
        <HuntBranch key={hunt.branch} hunt={hunt} editable={rebranchable} />
      </Panel>
      <Panel title="History" blurb="Every change to this hunt, kept as a git repository in this browser while a smith works on its quizzes here. The download is the history as this browser last recorded it.">
        <FullHistoryDownload hunt={hunt} />
      </Panel>
      <Panel title="Categories" blurb="How the hunt arranges its subject categories round a wheel, so that neighbours are kin and opposites far apart.">
        <Link component={NextLink} href={Routes.categoriesPath({ org: hunt.org, hunt: hunt.label })}>The category wheel</Link>
      </Panel>
      <Panel title="Members" blurb="Who is on this hunt. Smiths work on its quizzes and say who else is on it, from a quiz's Members panel; reviewers playtest them.">
        <TableContainer>
          <Table size="small" aria-label="Members of this hunt" sx={{ '& th, & td': { px: 1 } }}>
            <TableHead>
              <TableRow>
                <TableCell>Who</TableCell>
                <TableCell>Label</TableCell>
                <TableCell>Role</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {hunt.members.map((member) => (
                <TableRow key={member.ident_id}>
                  <TableCell>{member.title}</TableCell>
                  <TableCell>{member.label}</TableCell>
                  <TableCell>{HuntRoleTitles[member.role]}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Panel>
      <Box>
        <Link component={NextLink} href={Routes.huntsPath()}>Your hunts</Link>
      </Box>
    </Stack>
  )
}
