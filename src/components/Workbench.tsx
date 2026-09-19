'use client'

import { useState } from 'react'
import clsx from 'clsx'
import { Footnote } from './Footnote'
import { Panels } from './panels/Panels'
import { QuestionTable, type SortMark } from './QuestionTable'
import { QuizHeader } from './QuizHeader'
import { QuizManageModal } from './QuizManageModal'
import { QuizSwitcher } from './QuizSwitcher'
import { Toolbar } from './Toolbar'
import { useWorkspace } from '../state/use-workspace'
import { useAsking } from '../state/use-asking'
import { useQuizHashSync } from '../state/use-quiz-route'
import styles from './workbench.module.css'

/** The whole tool: one quiz on screen, saved the moment anything changes */
export function Workbench() {
  const { workspace, quiz, dispatch, unsaved, saveNotice } = useWorkspace()
  const { asking, ask, recalculateAll, running, runNotice } = useAsking(dispatch)
  // The arrow marks only what was sorted in this session; the quiz itself remembers the column.
  const [sortMark, setSortMark] = useState<SortMark | null>(null)
  // The chain walk is a toggle rather than a column, so it keeps its own direction.
  const [chainDescending, setChainDescending] = useState(true)
  const [managing, setManaging] = useState(false)
  useQuizHashSync(workspace, quiz, dispatch)

  if (! quiz) { return <main className={styles.page}><p className={styles.microcopy}>{saveNotice ?? 'Opening your quizzes…'}</p></main> }

  const onSort = (sortkey: SortMark['sortkey']) => {
    const descending = sortMark?.sortkey === sortkey ? ! sortMark.descending : false
    setSortMark({ sortkey, descending })
    dispatch({ kind: 'sort_questions', sortkey, descending })
  }

  return (
    <main className={clsx(styles.page, 'transitions')} data-unsaved={unsaved}>
      <QuizSwitcher
        quizzes={workspace.quizzes}
        openQuiz={quiz}
        onOpen={(quiz_id) => { dispatch({ kind: 'open_quiz', quiz_id }) }}
        onNew={() => { dispatch({ kind: 'new_quiz' }) }}
        onDelete={(quiz_id) => { dispatch({ kind: 'delete_quiz', quiz_id }) }}
        onSetLock={(locked) => { dispatch({ kind: 'set_lock', quiz_id: quiz.id, locked }) }}
      />
      <QuizHeader
        title={quiz.title}
        locked={quiz.locked}
        saveNotice={saveNotice}
        onRetitle={(title) => { dispatch({ kind: 'retitle_quiz', title }) }}
        onManage={() => { setManaging(true) }}
      />
      {/* Mounted only while open, so each visit reads the quiz as it stands rather than as it
          stood the first time the gear was ever clicked. */}
      {managing && (
        <QuizManageModal
          open
          onClose={() => { setManaging(false) }}
          workspace={workspace}
          quiz={quiz}
          dispatch={dispatch}
        />
      )}
      <QuestionTable
        questions={quiz.questions}
        locked={quiz.locked}
        gripShown={quiz.last_sortkey === null || quiz.last_sortkey === 'qnum'}
        lastSortkey={quiz.last_sortkey}
        sortMark={sortMark}
        onSort={onSort}
        onChain={(question_id, chains_to) => { dispatch({ kind: 'set_chain', question_id, chains_to }) }}
        asking={asking}
        onAsk={ask}
        onEdit={(question_id, patch) => { dispatch({ kind: 'edit_question', question_id, patch }) }}
        onDrag={(question_id, onto_idx) => { dispatch({ kind: 'drag_question', question_id, onto_idx }) }}
      />
      <Toolbar
        locked={quiz.locked}
        bulkIshesLast={quiz.bulk_ishes_last}
        running={running}
        runNotice={runNotice}
        onAddQuestion={() => { dispatch({ kind: 'add_question' }) }}
        onRenumber={() => { dispatch({ kind: 'renumber_qnums' }) }}
        onRecalculate={() => { recalculateAll(quiz.questions) }}
        onSortByChain={() => {
          const descending = ! chainDescending
          setChainDescending(descending)
          dispatch({ kind: 'sort_by_chain_order', descending })
        }}
      />
      <Footnote />
      <Panels
        quiz={quiz}
        workspace={workspace}
        onMerged={(merged) => { dispatch({ kind: 'replace_open_quiz', quiz: merged }) }}
      />
    </main>
  )
}
