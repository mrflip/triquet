'use client'

import clsx from 'clsx'
import { Footnote } from './Footnote'
import { QuestionTable } from './QuestionTable'
import { QuizHeader } from './QuizHeader'
import { Toolbar } from './Toolbar'
import { useWorkspace } from '../state/use-workspace'
import styles from './workbench.module.css'

/** The whole tool: one round on screen, saved to this browser the moment anything changes */
export function Workbench() {
  const { quiz, dispatch, saveNotice } = useWorkspace()

  if (! quiz) { return <main className={styles.page}><p className={styles.microcopy}>Opening your rounds&hellip;</p></main> }

  return (
    <main className={clsx(styles.page, 'transitions')}>
      <QuizHeader
        title={quiz.title}
        locked={quiz.locked}
        saveNotice={saveNotice}
        onRetitle={(title) => { dispatch({ kind: 'retitle_quiz', title }) }}
      />
      <QuestionTable
        questions={quiz.questions}
        locked={quiz.locked}
        gripShown={quiz.last_sortkey === null || quiz.last_sortkey === 'qnum'}
        onEdit={(question_id, patch) => { dispatch({ kind: 'edit_question', question_id, patch }) }}
      />
      <Toolbar locked={quiz.locked} onAddQuestion={() => { dispatch({ kind: 'add_question' }) }} />
      <Footnote />
    </main>
  )
}
