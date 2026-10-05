'use client'

import NextLink from './NextLink'
import { Button, Link, Stack } from '@mui/material'
import * as Alarms from '../lib/alarms'
import * as Routes from '../lib/routes'
import { useRaiseAlarm } from '../state/alarms'
import * as QuizMirror from '../state/quiz-mirror'
import { useQuizRepos } from '../state/use-quiz-repos'
import { AppNotices } from '../lib/notices'
import { describeRepo } from './OrphanedRepos'
import { Panel } from './panels/Panel'
import type { RepoSummary } from '../lib/quizgit'
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

/** Where `quiz` of `hunt` lives, worked on */
function addressOf(hunt: ShallowHuntT, quiz: QuizRow): string {
  const realm = hunt.realms.find((each) => each.quizzes.includes(quiz)) ?? hunt.realms[0]
  return Routes.quizPath({ hunt: hunt.label, realm: realm?.label ?? '', quiz: quiz.label })
}

/**
 * What the page says when its address names no quiz: what it asked for, the quizzes of the hunt
 * it named when that hunt is here, the way back to every hunt, and -- separately, since a deleted
 * quiz leaves its history behind -- every history repository this browser holds.
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
      <RepoList hunt={hunt} />
    </main>
  )
}

/** The history repositories this browser holds, whether or not their quizzes are still here */
function RepoList({ hunt }: Readonly<{ hunt: ShallowHuntT | null }>) {
  const repos = useQuizRepos()
  const kept = (repo: RepoSummary) => hunt?.realms.flatMap((realm) => realm.quizzes).find((quiz) => quiz._id === repo.id)
  return (
    <Panel title="History repositories" blurb="Each quiz's history is kept in a git repository in this browser. A deleted quiz leaves its repository behind.">
      {repos === null && <p className={styles.microcopy}>Looking&hellip;</p>}
      {repos?.length === 0 && <p className={styles.microcopy}>{AppNotices.noRepositories}</p>}
      <ul className={styles.repoList}>
        {repos?.map((repo) => {
          const quiz = kept(repo)
          return <RepoRow key={repo.id} repo={repo} address={hunt && quiz ? addressOf(hunt, quiz) : null} />
        })}
      </ul>
    </Panel>
  )
}

/** One repository: its quiz, what it last recorded, a way back to the quiz if it is here, and a download of it either way */
function RepoRow({ repo, address }: Readonly<{ repo: RepoSummary, address: string | null }>) {
  const raise = useRaiseAlarm()
  const onDownload = async () => {
    try {
      await QuizMirror.downloadRepo(repo)
    } catch (err) {
      raise(Alarms.of(AppNotices.repoNotDownloaded, err))
    }
  }
  return (
    <li>
      <strong>{repo.label ?? 'no commits yet'}</strong>
      {' '}<span className={styles.microcopy}>{describeRepo(repo)}</span>
      {' '}{address
        ? <Button size="small" component={NextLink} href={address}>Open quiz</Button>
        : <span className={styles.microcopy}>not in this hunt</span>}
      {' '}<Button size="small" onClick={() => { void onDownload() }}>Download</Button>
    </li>
  )
}
