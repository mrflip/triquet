'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import clsx from 'clsx'
import { ConfirmDeleteQuestions } from './ConfirmDeleteQuestions'
import { ExpressionsModal } from './ExpressionsModal'
import { Footnote } from './Footnote'
import { Panels } from './panels/Panels'
import { QuestionTable, type SortMark } from './QuestionTable'
import { QuizHeader } from './QuizHeader'
import { QuizNotFound } from './QuizNotFound'
import { QuizManageModal } from './QuizManageModal'
import { QuizSwitcher } from './QuizSwitcher'
import { Toolbar } from './Toolbar'
import { useChecklist } from './use-checklist'
import * as QuizMirror from '../state/quiz-mirror'
import { useWorkspace } from '../state/use-workspace'
import { useAsking } from '../state/use-asking'
import { usePlayers } from '../state/use-players'
import { qnumSortkeyOf, specsFor } from '../lib/columns'
import * as Expressed from '../lib/expressed'
import * as Labelmaker from '../lib/labelmaker'
import * as Routes from '../lib/routes'
import styles from './workbench.module.css'

export type WorkbenchProps = {
  /** Which quiz the address names; the one thing that decides what is on screen */
  label: string
}

/**
 * The whole tool: one quiz on screen, saved the moment anything changes.
 *
 * The address decides which quiz that is, and nothing decides the address in return. Anything
 * that changes which quiz is open -- the switcher, a new quiz, a deletion, a relabel -- says so
 * by navigating; every editing action lands on the quiz the address names, and the workspace's
 * own `active_quiz_id` follows along behind, for a bare address to go back to next time.
 */
export function Workbench({ label }: Readonly<WorkbenchProps>) {
  const router = useRouter()
  const { workspace, quiz, loaded, dispatch, unsaved, saveNotice } = useWorkspace(label)
  const { asking, ask, recalculateAll, running, runNotice, runFailure } = useAsking(dispatch)
  const { unavailableNotice } = usePlayers()
  // The arrow marks only what was sorted in this session; the quiz itself remembers the column.
  const [sortMark, setSortMark] = useState<SortMark | null>(null)
  // The chain walk is a toggle rather than a column, so it keeps its own direction.
  const [chainDescending, setChainDescending] = useState(true)
  const [managing, setManaging] = useState(false)
  const [editingExpressions, setEditingExpressions] = useState(false)
  // Worked out afresh from the questions as they stand and stored nowhere, so a computed
  // column is never out of step with what it reads.
  const specs = useMemo(() => (quiz ? specsFor(quiz) : []), [quiz])
  const expressed = useMemo(() => (quiz ? Expressed.forQuiz(quiz, workspace.expressions) : new Map()), [quiz, workspace.expressions])
  const questionIds = useMemo(() => quiz?.questions.map((question) => question.id) ?? [], [quiz])
  const checklist = useChecklist(quiz?.id ?? null, questionIds)
  // The questions the author has asked to delete, until they confirm or keep them.
  const [doomedIds, setDoomedIds] = useState<readonly string[] | null>(null)

  // The workspace remembers which quiz was open last, for a bare address to go back to. Ids
  // rather than objects, so a fresh reading of the workspace does not look like a change of quiz.
  const quizId = quiz?.id ?? null
  useEffect(() => {
    if (quizId !== null && quizId !== workspace.active_quiz_id) { dispatch({ kind: 'open_quiz', quiz_id: quizId }) }
  }, [quizId, workspace.active_quiz_id, dispatch])

  if (! loaded) { return <main className={styles.page}><p className={styles.microcopy}>{saveNotice ?? 'Opening your quizzes…'}</p></main> }

  /** Go to `target`: with the address deciding what is on screen, that is what opening a quiz is */
  const goTo = (target: Labelmaker.Labelled) => {
    router.push(Routes.quizPath(Labelmaker.effectiveLabelOf(target)))
  }

  if (! quiz) {
    return (
      <QuizNotFound
        label={label}
        workspace={workspace}
        onOpen={goTo}
        onCreate={(fresh) => { dispatch({ kind: 'new_quiz', label: fresh }); router.push(Routes.quizPath(fresh)) }}
      />
    )
  }

  const batching = checklist.checking && ! quiz.locked
  const doomed = quiz.questions.filter((question) => doomedIds?.includes(question.id))

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
        onOpen={(quiz_id) => {
          const target = workspace.quizzes.find((each) => each.id === quiz_id)
          if (target) { goTo(target) }
        }}
        onNew={() => {
          // The label is settled here rather than in the action, because the address this is
          // about to go to has to name it.
          const fresh = Labelmaker.freshLabelFor(workspace.quizzes)
          dispatch({ kind: 'new_quiz', label: fresh })
          router.push(Routes.quizPath(fresh))
        }}
        onDelete={(quiz_id) => {
          // Worked out before the deletion, and matching the neighbour the action will settle
          // on: afterwards this address names a quiz that is not there any more.
          const idx = workspace.quizzes.findIndex((each) => each.id === quiz_id)
          const left = workspace.quizzes.filter((each) => each.id !== quiz_id)
          const neighbour = left[Math.min(idx, left.length - 1)]
          dispatch({ kind: 'delete_quiz', quiz_id })
          if (neighbour) { router.replace(Routes.quizPath(Labelmaker.effectiveLabelOf(neighbour))) }
        }}
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
          onRelabelled={(relabelled) => { router.replace(Routes.quizPath(relabelled)) }}
          onOpen={goTo}
          onEditExpressions={() => { setEditingExpressions(true) }}
        />
      )}
      {editingExpressions && (
        <ExpressionsModal
          onClose={() => { setEditingExpressions(false) }}
          workspace={workspace}
          quizId={quiz.id}
          dispatch={dispatch}
        />
      )}
      {doomed.length > 0 && (
        <ConfirmDeleteQuestions
          doomed={doomed}
          onClose={() => { setDoomedIds(null) }}
          onConfirm={() => {
            const question_ids = doomed.map((question) => question.id)
            void QuizMirror.markedChange(quiz, 'delete', () => { dispatch({ kind: 'delete_questions', question_ids }) })
            setDoomedIds(null)
            checklist.end()
          }}
        />
      )}
      <QuestionTable
        questions={quiz.questions}
        specs={specs}
        expressed={expressed}
        locked={quiz.locked}
        gripShown={quiz.last_sortkey === null || quiz.last_sortkey === qnumSortkeyOf(quiz)}
        batching={batching}
        isChecked={checklist.isChecked}
        onCheck={checklist.toggle}
        onCheckAll={checklist.checkAll}
        onDelete={(question_id) => { setDoomedIds([question_id]) }}
        lastSortkey={quiz.last_sortkey}
        sortMark={sortMark}
        onSort={onSort}
        onChain={(question_id, chains_to) => { dispatch({ kind: 'set_chain', question_id, chains_to }) }}
        asking={asking}
        unavailableNotice={unavailableNotice}
        onAsk={(question, askkind) => { if (unavailableNotice(askkind) === null) { ask(question, askkind) } }}
        onEdit={(question_id, patch) => { dispatch({ kind: 'edit_question', question_id, patch }) }}
        onMove={(question_id, onto_idx) => { dispatch({ kind: 'move_question', question_id, onto_idx }) }}
      />
      <Toolbar
        locked={quiz.locked}
        bulkIshesLast={quiz.bulk_ishes_last}
        running={running}
        runNotice={runNotice}
        runFailure={runFailure}
        batching={batching}
        checkedCount={checklist.checked.length}
        onBatch={(on) => { if (on) { checklist.begin() } else { checklist.end() } }}
        onDeleteChecked={() => { setDoomedIds(checklist.checked) }}
        onAddQuestion={() => { dispatch({ kind: 'add_question' }) }}
        onRenumber={() => { dispatch({ kind: 'renumber_qnums' }) }}
        onRecalculate={() => { recalculateAll(quiz.questions) }}
        onEditExpressions={() => { setEditingExpressions(true) }}
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
        expressed={expressed}
        onMerged={(merged) => {
          void QuizMirror.markedChange(quiz, 'import', () => { dispatch({ kind: 'replace_open_quiz', quiz: merged }) })
        }}
      />
    </main>
  )
}
