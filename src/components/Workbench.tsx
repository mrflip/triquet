'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import clsx from 'clsx'
import { ConfirmDeleteQuestions } from './ConfirmDeleteQuestions'
import { ExpressionsModal } from './ExpressionsModal'
import { Footnote } from './Footnote'
import { Panels } from './panels/Panels'
import { QuestionTable, type SortMark } from './QuestionTable'
import { QuizHeader } from './QuizHeader'
import { QuizManageModal } from './QuizManageModal'
import { QuizSwitcher } from './QuizSwitcher'
import { Toolbar } from './Toolbar'
import { useChecklist } from './use-checklist'
import * as QuizMirror from '../state/quiz-mirror'
import { useAsking } from '../state/use-asking'
import { useBots } from '../state/use-bots'
import { qnumSortkeyOf, specsFor } from '../lib/columns'
import * as Expressed from '../lib/expressed'
import * as Labelmaker from '../lib/labelmaker'
import * as Routes from '../lib/routes'
import type { ShallowHuntT, ShallowRealmT } from '../lib/rows'
import type { IdentT } from '../models/ident'
import type { QuizT } from '../models/quiz'
import type { HuntHandle } from '../state/use-hunt'
import styles from './workbench.module.css'

export type WorkbenchProps = Pick<HuntHandle, 'dispatch' | 'carryOut' | 'unsaved' | 'saveNotice' | 'reviews'> & {
  /** The hunt the address names, as a quiz's screen holds it */
  hunt:  ShallowHuntT
  /** The realm the address names, whose quizzes are the open quiz's siblings */
  realm: ShallowRealmT
  /** The quiz the address names: the one on screen */
  quiz:  QuizT
  /** Who is working on it */
  ident: IdentT
}

/**
 * The whole tool, as a smith works it: one quiz on screen, saved the moment anything changes.
 *
 * The address decides which quiz that is, and nothing decides the address in return. Anything
 * that changes which quiz is open -- the switcher, a new quiz, a deletion, a relabel -- says so
 * by navigating, and every editing action lands on the quiz the address names.
 */
export function Workbench({ hunt, realm, quiz, ident, reviews, dispatch, carryOut, unsaved, saveNotice }: Readonly<WorkbenchProps>) {
  const router = useRouter()
  const { asking, ask, recalculateAll, running, runNotice, runFailure } = useAsking(dispatch)
  const { unavailableNotice } = useBots()
  // The arrow marks only what was sorted in this session; the quiz itself remembers the column.
  const [sortMark, setSortMark] = useState<SortMark | null>(null)
  // The chain walk is a toggle rather than a column, so it keeps its own direction.
  const [chainDescending, setChainDescending] = useState(true)
  const [managing, setManaging] = useState(false)
  const [editingExpressions, setEditingExpressions] = useState(false)
  // Worked out afresh from the questions as they stand and stored nowhere, so a computed
  // column is never out of step with what it reads.
  const specs = useMemo(() => specsFor(quiz), [quiz])
  const place = useMemo(() => Expressed.placeOf(hunt, realm), [hunt, realm])
  const expressed = useMemo(() => Expressed.forQuiz(quiz, hunt.expressions, place), [quiz, hunt.expressions, place])
  const questionIds = useMemo(() => quiz.questions.map((question) => question._id), [quiz])
  const checklist = useChecklist(quiz._id, questionIds)
  // The questions the author has asked to delete, until they confirm or keep them.
  const [doomedIds, setDoomedIds] = useState<readonly string[] | null>(null)

  /** Where the quiz of this realm labelled `label` is worked on */
  const pathFor = (label: string) => Routes.quizPath({ hunt: Labelmaker.effectiveLabelOf(hunt), realm: realm.label, quiz: label }, 'smith')

  /** Go to `target`: with the address deciding what is on screen, that is what opening a quiz is */
  const goTo = (target: Labelmaker.Labelled) => {
    router.push(pathFor(Labelmaker.effectiveLabelOf(target)))
  }

  const batching = checklist.checking && ! quiz.locked
  const doomed = quiz.questions.filter((question) => doomedIds?.includes(question._id))

  const onSort = (sortkey: SortMark['sortkey']) => {
    const descending = sortMark?.sortkey === sortkey ? ! sortMark.descending : false
    setSortMark({ sortkey, descending })
    dispatch({ kind: 'sort_questions', sortkey, descending })
  }

  return (
    <main className={clsx(styles.page, 'transitions')} data-unsaved={unsaved}>
      <QuizSwitcher
        quizzes={realm.quizzes}
        openQuiz={quiz}
        onOpen={(quiz_id) => {
          const target = realm.quizzes.find((each) => each._id === quiz_id)
          if (target) { goTo(target) }
        }}
        onNew={() => {
          // The label is settled here rather than in the action, because the address this is
          // about to go to has to name it.
          // Gone to once it has been made, and not at all when it was refused: until then the
          // address would name no quiz.
          const fresh = Labelmaker.freshLabelFor(realm.quizzes)
          const make = async () => {
            if (await carryOut({ kind: 'new_quiz', label: fresh })) { router.push(pathFor(fresh)) }
          }
          void make()
        }}
        onSetLock={(locked) => { dispatch({ kind: 'set_lock', quiz_id: quiz._id, locked }) }}
      />
      {/* Keyed by the quiz, so another quiz's header starts afresh: its note folded, its drafts its own. */}
      <QuizHeader
        key={quiz._id}
        title={quiz.title}
        smithsNote={quiz.smiths_note}
        locked={quiz.locked}
        onRetitle={(title) => { dispatch({ kind: 'retitle_quiz', title }) }}
        onSmithsNote={(smiths_note) => { dispatch({ kind: 'set_smiths_note', smiths_note }) }}
        onManage={() => { setManaging(true) }}
      />
      {/* Mounted only while open, so each visit reads the quiz as it stands rather than as it
          stood the first time the gear was ever clicked. */}
      {managing && (
        <QuizManageModal
          open
          onClose={() => { setManaging(false) }}
          hunt={hunt}
          realm={realm}
          quiz={quiz}
          dispatch={dispatch}
          onOpen={goTo}
          onEditExpressions={() => { setEditingExpressions(true) }}
          onRetitleHunt={(title) => { dispatch({ kind: 'retitle_hunt', title }) }}
          onRelabelHunt={(label) => {
            // Followed once it has landed, and not at all when it was refused (the label taken):
            // until then no hunt answers to the new address.
            const relabel = async () => {
              if (await carryOut({ kind: 'relabel_hunt', label })) { router.replace(Routes.quizPath({ hunt: label, realm: realm.label, quiz: Labelmaker.effectiveLabelOf(quiz) }, 'smith')) }
            }
            void relabel()
          }}
          onDeleteQuiz={() => {
            // Worked out before the deletion, and matching the neighbour the action will settle
            // on: afterwards this address names a quiz that is not there any more.
            const idx = realm.quizzes.findIndex((each) => each._id === quiz._id)
            const left = realm.quizzes.filter((each) => each._id !== quiz._id)
            const neighbour = left[Math.min(idx, left.length - 1)]
            dispatch({ kind: 'delete_quiz', quiz_id: quiz._id })
            if (neighbour) { router.replace(pathFor(Labelmaker.effectiveLabelOf(neighbour))) }
          }}
          onDeleteHunt={() => {
            void carryOut({ kind: 'delete_hunt' }).then((kept) => { if (kept) { router.replace(Routes.huntsPath()) } })
          }}
        />
      )}
      {editingExpressions && (
        <ExpressionsModal
          onClose={() => { setEditingExpressions(false) }}
          hunt={hunt}
          quiz={quiz}
          dispatch={dispatch}
        />
      )}
      {doomed.length > 0 && (
        <ConfirmDeleteQuestions
          doomed={doomed}
          onClose={() => { setDoomedIds(null) }}
          onConfirm={() => {
            const question_ids = doomed.map((question) => question._id)
            void QuizMirror.markedChange(quiz, 'delete', () => { dispatch({ kind: 'delete_questions', question_ids }) })
            setDoomedIds(null)
            checklist.end()
          }}
        />
      )}
      {/* Keyed by the quiz, so another quiz's grid starts afresh, folded; told apart from the
          header's key, which is the quiz's too, because keys among siblings must differ. */}
      <QuestionTable
        key={`grid-${quiz._id}`}
        questions={quiz.questions}
        specs={specs}
        expressed={expressed}
        locked={quiz.locked}
        gripShown={quiz.last_sortkey === null || quiz.last_sortkey === qnumSortkeyOf(quiz)}
        batching={batching}
        onBatch={(on) => { if (on) { checklist.begin() } else { checklist.end() } }}
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
        hunt={hunt}
        realm={realm}
        ident={ident}
        reviews={reviews}
        expressed={expressed}
        carryOut={carryOut}
        saveNotice={saveNotice}
        onImport={(questions) => {
          void QuizMirror.markedChange(quiz, 'import', () => { dispatch({ kind: 'import_questions', questions }) })
        }}
      />
    </main>
  )
}
