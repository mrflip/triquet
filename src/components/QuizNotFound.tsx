'use client'

import NextLink from './NextLink'
import { Button, Link, Stack } from '@mui/material'
import * as Routes from '../lib/routes'
import { Hunting } from '../models/hunting'
import { useHuntRepos } from '../state/use-hunt-repos'
import { useHuntsList } from '../state/use-hunts-list'
import { AppNotices } from '../lib/notices'
import { HuntRepoList } from './HuntRepoList'
import { Panel } from './panels/Panel'
import type { ShallowHuntT } from '../lib/rows'
import styles from './workbench.module.css'

export type QuizNotFoundProps = {
  /** What the address asked for */
  labels: Routes.QuizLabels
  /** The hunt the address names, when there is one; null when there is no such hunt */
  hunt:   ShallowHuntT | null
}

/** A quiz of `hunt`, as its realm lists it */
type QuizRow = ShallowHuntT['realms'][number]['quizzes'][number]

/** Where `quiz` of `hunt` lives, opened in the mode the visitor's role works in */
function addressOf(hunt: ShallowHuntT, quiz: QuizRow): string {
  const realm = hunt.realms.find((each) => each.quizzes.includes(quiz)) ?? hunt.realms[0]
  return Routes.quizPath({ org: hunt.org, hunt: hunt.label, realm: realm?.label ?? '', quiz: quiz.label }, Hunting.modeFor(hunt.role))
}

/**
 * What the page says when its address names no quiz: what it asked for, the quizzes of the hunt
 * it named when that hunt is here, the way back to every hunt, and -- separately, since a deleted
 * quiz leaves its files in its hunt's history -- every hunt's history repository this browser holds.
 */
export function QuizNotFound({ labels, hunt }: Readonly<QuizNotFoundProps>) {
  const asked = `${labels.hunt}/${labels.realm}/${labels.quiz}`
  return (
    <main className={styles.page}>
      <Panel title="No such quiz" blurb={hunt ? `The hunt “${hunt.title}” has no quiz at “${asked}”.` : `There is no hunt labelled “${labels.hunt}”.`}>
        <Link component={NextLink} href={Routes.huntsPath()}>Your hunts</Link>
      </Panel>
      {hunt && (
        <Panel title={`Quizzes of ${hunt.title}`} blurb="Every quiz this hunt holds.">
          <Stack spacing={0.5} sx={{ alignItems: 'flex-start' }}>
            {hunt.realms.flatMap((realm) => realm.quizzes).map((quiz) => (
              <Button key={quiz._id} size="small" variant="outlined" component={NextLink} href={addressOf(hunt, quiz)}>
                {quiz.locked ? '🔒 ' : ''}{quiz.title === '' ? AppNotices.untitledQuiz : quiz.title}
              </Button>
            ))}
          </Stack>
        </Panel>
      )}
      <RepoList />
    </main>
  )
}

/**
 * Every hunt's history repository this browser holds, whether or not the visitor is still on the
 * hunt: a hunt they are on links to its page, and a deleted quiz's files are in its hunt's history.
 */
function RepoList() {
  const repos = useHuntRepos()
  const hunts = useHuntsList()
  return (
    <Panel title="History repositories" blurb="Each hunt's history is kept in a git repository in this browser, a deleted quiz's files among it. A hunt you are on links to its page; the rest are of hunts deleted, or that you are not on.">
      {repos === null && <p className={styles.microcopy}>Looking&hellip;</p>}
      {repos?.length === 0 && <p className={styles.microcopy}>{AppNotices.noRepositories}</p>}
      {repos && repos.length > 0 && <HuntRepoList repos={repos} hunts={hunts ?? []} naming="History repositories" />}
    </Panel>
  )
}
