'use client'

import { useEffect, useState } from 'react'
import { Button, Stack } from '@mui/material'
import * as Labelmaker from '../lib/labelmaker'
import * as QuizMirror from '../state/quiz-mirror'
import { AppNotices } from '../lib/notices'
import { Panel } from './panels/Panel'
import type { RepoSummary } from '../lib/quizgit'
import type { QuizT } from '../models/quiz'
import type { WorkspaceT } from '../models/workspace'
import styles from './workbench.module.css'

export type QuizNotFoundProps = {
  /** What the address asked for */
  label:     string
  workspace: WorkspaceT
  onOpen:    (quiz: QuizT) => void
  onCreate:  (label: string) => void
}

/**
 * What the page says when its address names a quiz this workspace does not have: the quizzes it
 * does have, an offer to make one under that label, and -- separately, since a deleted quiz
 * leaves its history behind -- every history repository this browser holds.
 */
export function QuizNotFound({ label, workspace, onOpen, onCreate }: Readonly<QuizNotFoundProps>) {
  const offered = Labelmaker.normalize(label)
  const canCreate = offered !== '' && workspace.quizzes.every((quiz) => Labelmaker.effectiveLabelOf(quiz) !== offered)

  return (
    <main className={styles.page}>
      <Panel title="No such quiz" blurb={`Nothing here is labelled “${label}”.`}>
        {canCreate && (
          <Button size="small" variant="contained" onClick={() => { onCreate(offered) }}>
            Make a quiz called &ldquo;{offered}&rdquo;
          </Button>
        )}
      </Panel>
      <Panel title="Your quizzes" blurb="Every quiz this browser holds.">
        <Stack spacing={0.5} sx={{ alignItems: 'flex-start' }}>
          {workspace.quizzes.map((quiz) => (
            <Button key={quiz.id} size="small" variant="outlined" onClick={() => { onOpen(quiz) }}>
              {quiz.locked ? '🔒 ' : ''}{quiz.title === '' ? AppNotices.untitledQuiz : quiz.title}
            </Button>
          ))}
        </Stack>
      </Panel>
      <RepoList workspace={workspace} onOpen={onOpen} />
    </main>
  )
}

/** The history repositories this browser holds, whether or not their quizzes are still here */
function RepoList({ workspace, onOpen }: Readonly<Pick<QuizNotFoundProps, 'workspace' | 'onOpen'>>) {
  const [repos, setRepos] = useState<RepoSummary[] | null>(null)

  useEffect(() => {
    let current = true
    const load = async () => {
      const found = await QuizMirror.listQuizRepos()
      if (current) { setRepos(found) }
    }
    void load()
    return () => { current = false }
  }, [])

  return (
    <Panel title="History repositories" blurb="Each quiz's history is kept in a git repository in this browser. A deleted quiz leaves its repository behind.">
      {repos === null && <p className={styles.microcopy}>Looking&hellip;</p>}
      {repos?.length === 0 && <p className={styles.microcopy}>{AppNotices.noRepositories}</p>}
      <ul className={styles.repoList}>
        {repos?.map((repo) => (
          <RepoRow key={repo.id} repo={repo} keptQuiz={workspace.quizzes.find((quiz) => quiz.id === repo.id)} onOpen={onOpen} />
        ))}
      </ul>
    </Panel>
  )
}

/** One repository: its quiz, what it last recorded, and a way back to the quiz if it is still here */
function RepoRow({ repo, keptQuiz, onOpen }: Readonly<{ repo: RepoSummary, keptQuiz: QuizT | undefined, onOpen: (quiz: QuizT) => void }>) {
  return (
    <li>
      <strong>{repo.label ?? 'no commits yet'}</strong>
      {' '}<span className={styles.microcopy}>{describeRepo(repo)}</span>
      {' '}{keptQuiz
        ? <Button size="small" onClick={() => { onOpen(keptQuiz) }}>Open quiz</Button>
        : <span className={styles.microcopy}>quiz deleted</span>}
    </li>
  )
}

/** A repository's branch and latest commit, on one line */
function describeRepo(repo: RepoSummary): string {
  const branch = repo.branch ?? 'no branch'
  if (repo.committed_at === null) { return branch }
  return `${branch} · ${repo.message ?? ''} · ${new Date(repo.committed_at).toLocaleString()}`
}
