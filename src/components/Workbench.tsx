'use client'

import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import clsx from 'clsx'
import { ConfirmViz } from './ConfirmViz'
import * as PendingImports from './pending-imports'
import { Footnote } from './Footnote'
import { LibraryModal } from './LibraryModal'
import { workbenchOffers } from './offers'
import { Panels } from './panels/Panels'
import { QuestionTable, type SortMark } from './QuestionTable'
import { QuizHeader } from './QuizHeader'
import { QuizManageModal } from './QuizManageModal'
import { QuizSwitcher } from './QuizSwitcher'
import { ScreenMain } from './ScreenMain'
import { Toolbar } from './Toolbar'
import { useChecklist } from './use-checklist'
import { useFoldSet } from './use-folds'
import * as HuntMirror from '../state/hunt-mirror'
import type * as Actor from '../lib/actor'
import { useAsking, type AskedStep } from '../state/use-asking'
import { useBots } from '../state/use-bots'
import { useLibraryActions } from '../state/use-library-actions'
import { qnumSortkeyOf, specsFor } from '../lib/columns'
import * as Runner from '../lib/formulary/runner'
import * as Labelmaker from '../lib/labelmaker'
import * as Rank from '../lib/rank'
import * as Routes from '../lib/routes'
import * as Sortings from '../lib/sortings'
import type { ShallowHuntT, ShallowRealmT } from '../lib/rows'
import { Question, type QuestionPatch, type QuestionViz } from '../models/question'
import type { QuizT } from '../models/quiz'
import type { EntryValueT, WidgetT } from '../models/widget'
import type { HuntHandle } from '../state/use-hunt'
import styles from './workbench.module.css'

export type WorkbenchProps = Pick<HuntHandle, 'dispatch' | 'carryOut' | 'saveNotice' | 'reviews'> & {
  /** The hunt the address names, as a quiz's screen holds it */
  hunt:  ShallowHuntT
  /** The realm the address names, whose quizzes are the open quiz's siblings */
  realm: ShallowRealmT
  /** The quiz the address names: the one on screen */
  quiz:  QuizT
  /** The library: the widgets its widgetings work */
  library: readonly WidgetT[]
  /** What whoever is working on it holds of themselves on the hunt, with the quiz on screen: who they are, and what decides what the screen offers them */
  claims: Actor.QuizClaimsT
}

/**
 * The whole tool, as a smith works it: one quiz on screen, saved the moment anything changes.
 *
 * The address decides which quiz that is, and nothing decides the address in return. Anything
 * that changes which quiz is open -- the switcher, a new quiz, a deletion, a relabel -- says so
 * by navigating, and every editing action lands on the quiz the address names.
 *
 * What it offers is what the server would accept of whoever is working (`workbenchOffers`): a
 * locked quiz is read, copied and exported, and its questions and layout are left as they are.
 *
 * The grid shows every question but the archived, which the gear lists; batch mode archives
 * questions, or shows them as alternates (secondary) or normal again.
 *
 * A change to one question draws the frame again, and that question's row: what the grid is
 * handed keeps its identity while it holds the same, and whether a change is still being written
 * (`ScreenMain`) and which cells are being asked (`useAsking`) are read only where they are shown.
 */
export function Workbench({ hunt, realm, quiz, library, claims, reviews, dispatch, carryOut, saveNotice }: Readonly<WorkbenchProps>) {
  const router = useRouter()
  const { asks, ask } = useAsking(dispatch)
  const { unavailableNotice } = useBots()
  const librarian = useLibraryActions()
  // The arrow marks only what was sorted in this session; the quiz itself remembers the column.
  const [sortMark, setSortMark] = useState<SortMark | null>(null)
  // The chain walk is a toggle rather than a column, so it keeps its own direction.
  const [chainDescending, setChainDescending] = useState(true)
  const [managing, setManaging] = useState(false)
  // Kept here, outside the manage dialog, so its panels stay as they were left across a reopen;
  // the Widgets panel's widgetings keep theirs here too, beside them.
  const layoutFolds = useFoldSet(quiz._id)
  const [editingLibrary, setEditingLibrary] = useState(false)
  // Worked out afresh from the questions as they stand and stored nowhere, so a computed
  // column is never out of step with what it reads.
  const { columns, widgetings } = quiz
  const specs = useMemo(() => specsFor({ columns, widgetings }), [columns, widgetings])
  const place = useMemo(() => Runner.placeOf(hunt, realm), [hunt, realm])
  const run = useMemo(() => Runner.runQuiz(Runner.sourceOf(quiz, library, place)), [quiz, library, place])
  const shown = useMemo(() => Question.unarchived(quiz.questions), [quiz])
  const questionIds = useMemo(() => shown.map((question) => question._id), [shown])
  const checklist = useChecklist(quiz._id, questionIds)
  const offers = workbenchOffers(claims)
  // The questions the author has asked to show otherwise, and the choices offered, until they choose or keep them as they are.
  const [vizzing, setVizzing] = useState<{ ids: readonly string[], offered: readonly QuestionViz[] } | null>(null)

  /** Where the quiz of this realm labelled `label` is worked on */
  const pathFor = (label: string) => Routes.quizPath({ org: hunt.org, hunt: hunt.label, realm: realm.label, quiz: label }, 'edit')

  /** Go to `target`: with the address deciding what is on screen, that is what opening a quiz is */
  const goTo = (target: Labelmaker.Labelled) => {
    router.push(pathFor(target.label))
  }

  /** Why the widgeting labelled `label` cannot be asked, when it cannot: made again only with the run */
  const unavailableFor = useCallback((label: string): string | null => {
    const step = askedStepOf(run, label)
    return step ? unavailableNotice(step.widget) : null
  }, [run, unavailableNotice])

  // What the grid's handlers read when they run rather than when they were made, so they keep
  // their identity from render to render and no row is drawn again for them.
  const latest = useRef({ quiz, run, unavailableNotice })
  useLayoutEffect(() => { latest.current = { quiz, run, unavailableNotice } })
  const onAsk = useCallback((question_id: string, label: string) => {
    const { run: now, unavailableNotice: noticeOf } = latest.current
    const step = askedStepOf(now, label)
    const bag = step && Runner.bagsAt(now, step.widgeting).get(question_id)
    if (step && bag && noticeOf(step.widget) === null) { ask(question_id, step, bag) }
  }, [ask])
  const onMove = useCallback((question_id: string, onto_idx: number) => {
    dispatch({ kind: 'move_question', question_id, onto_idx: Rank.ontoIdxAmong(latest.current.quiz.questions, question_id, onto_idx) })
  }, [dispatch])
  const onViz = useCallback((question_id: string) => { setVizzing({ ids: [question_id], offered: ['archived', 'secondary', 'normal'] }) }, [])
  const onChain = useCallback((question_id: string, chains_to: string | null) => { dispatch({ kind: 'set_chain', question_id, chains_to }) }, [dispatch])
  const onEdit = useCallback((question_id: string, patch: QuestionPatch) => { dispatch({ kind: 'edit_question', question_id, patch }) }, [dispatch])
  const onEnter = useCallback((question_id: string, widgeting_label: string, value: EntryValueT | null) => {
    dispatch({ kind: 'enter_widgeted', entered: { question_id, widgeting_label, value } })
  }, [dispatch])

  const batching = checklist.checking && offers.reviseQuestions
  const vizzed = shown.filter((question) => vizzing?.ids.includes(question._id))

  /** Show the questions `question_ids` as `viz` says; an archived question leaves the grid, and so the selection ends */
  const setViz = (question_ids: readonly string[], viz: QuestionViz) => {
    dispatch({ kind: 'set_viz', question_ids, viz })
    if (viz === 'archived') { checklist.end() }
  }

  // The grid shows the new order at once, and the arrow with it; a sort refused takes both back.
  const onSort = (sortkey: SortMark['sortkey']) => {
    const descending = sortMark?.sortkey === sortkey ? ! sortMark.descending : false
    const mark = { sortkey, descending }
    setSortMark(mark)
    const sort = async () => {
      const kept = await carryOut({ kind: 'sort_questions', sortkey, descending, question_ids: Sortings.sortedIdsOf(sortkey, quiz, run, descending) })
      if (! kept) { setSortMark((now) => (now === mark ? sortMark : now)) }
    }
    void sort()
  }

  return (
    <ScreenMain className={clsx(styles.page, 'transitions')}>
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
        revisable={offers.reviseQuiz}
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
          library={library}
          offers={offers}
          dispatch={dispatch}
          changeLibrary={librarian.dispatch}
          folds={layoutFolds}
          run={run}
          onOpen={goTo}
          onRetitleHunt={(title) => { dispatch({ kind: 'retitle_hunt', title }) }}
          onRelabelHunt={(label) => {
            // Followed once it has landed, and not at all when it was refused (the label taken):
            // until then no hunt answers to the new address.
            const relabel = async () => {
              if (await carryOut({ kind: 'relabel_hunt', label })) { router.replace(Routes.quizPath({ org: hunt.org, hunt: label, realm: realm.label, quiz: quiz.label }, 'edit')) }
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
            if (neighbour) { router.replace(pathFor(neighbour.label)) }
          }}
          onDeleteHunt={() => {
            void carryOut({ kind: 'delete_hunt' }).then((kept) => { if (kept) { router.replace(Routes.huntsPath()) } })
          }}
          onDeleteQuestion={(question_id) => {
            void HuntMirror.markedChange(hunt, quiz, 'delete', () => { dispatch({ kind: 'delete_questions', question_ids: [question_id] }) })
          }}
        />
      )}
      {editingLibrary && (
        <LibraryModal
          onClose={() => { setEditingLibrary(false) }}
          hunt={hunt}
          library={library}
          quiz={quiz}
          changeable={offers.changeLibrary}
          dispatch={librarian.dispatch}
        />
      )}
      {vizzing && vizzed.length > 0 && (
        <ConfirmViz
          questions={vizzed}
          offered={vizzing.offered}
          onClose={() => { setVizzing(null) }}
          onChoose={(viz) => {
            setViz(vizzed.map((question) => question._id), viz)
            setVizzing(null)
          }}
        />
      )}
      {/* Keyed by the quiz, so another quiz's grid starts afresh, folded; told apart from the
          header's key, which is the quiz's too, because keys among siblings must differ. */}
      <QuestionTable
        key={`grid-${quiz._id}`}
        questions={quiz.questions}
        specs={specs}
        run={run}
        templateable={quiz.templateable}
        locked={! offers.reviseQuestions}
        gripShown={quiz.last_sortkey === null || quiz.last_sortkey === qnumSortkeyOf(quiz)}
        batching={batching}
        onBatch={(on) => { if (on) { checklist.begin() } else { checklist.end() } }}
        isChecked={checklist.isChecked}
        onCheck={checklist.toggle}
        onCheckAll={checklist.checkAll}
        onViz={onViz}
        lastSortkey={quiz.last_sortkey}
        sortMark={sortMark}
        onSort={onSort}
        onCollapse={offers.reviseLayout ? (label, collapsed) => { dispatch({ kind: 'edit_column', label, patch: { collapsed: collapsed || null } }) } : undefined}
        onChain={onChain}
        asks={asks}
        unavailableNotice={unavailableFor}
        onAsk={onAsk}
        onEdit={onEdit}
        onEnter={onEnter}
        onMove={onMove}
      />
      <Toolbar
        locked={! offers.reviseQuestions}
        batching={batching}
        checkedCount={checklist.checked.length}
        onBatch={(on) => { if (on) { checklist.begin() } else { checklist.end() } }}
        onVizChecked={(viz) => {
          // Archiving asks first, saying where the archived questions go; the others are undone as easily as done.
          if (viz === 'archived') { setVizzing({ ids: checklist.checked, offered: ['archived'] }) } else { setViz(checklist.checked, viz) }
        }}
        onAddQuestion={() => { dispatch({ kind: 'add_question' }) }}
        onRenumber={() => { dispatch({ kind: 'renumber_qnums' }) }}
        onEditLibrary={() => { setEditingLibrary(true) }}
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
        claims={claims}
        offers={offers}
        reviews={reviews}
        library={library}
        run={run}
        carryOut={carryOut}
        saveNotice={saveNotice}
        changeLibrary={librarian.dispatch}
        dispatch={dispatch}
        folds={layoutFolds}
        onImport={(actions) => {
          void HuntMirror.markedChange(hunt, quiz, 'import', () => {
            for (const action of actions) { dispatch(action) }
          })
        }}
        onImportElsewhere={({ label, take }, pasted) => {
          // Labels are unique within the hunt's realm, so the paste's quiz is the quiz of its label
          // here: gone to, or made first. Its Import reads the paste once it is on screen.
          const target = label ?? Labelmaker.freshLabelFor(realm.quizzes)
          const key = PendingImports.keyOf(hunt._id, target)
          PendingImports.hold(key, { pasted, take })
          if (realm.quizzes.some((each) => each.label === target)) {
            router.push(pathFor(target))
            return
          }
          const make = async () => {
            if (await carryOut({ kind: 'new_quiz', label: target })) { router.push(pathFor(target)) } else { PendingImports.clear(key) }
          }
          void make()
        }}
        onQ1Preamble={(q1_preamble) => { dispatch({ kind: 'set_q1_preamble', q1_preamble }) }}
        onRecapHead={(recap_head) => { dispatch({ kind: 'set_recap_head', recap_head }) }}
        onRecapTail={(recap_tail) => { dispatch({ kind: 'set_recap_tail', recap_tail }) }}
        onRecapTemplate={(recap_template) => { dispatch({ kind: 'set_recap_template', recap_template }) }}
        onEnterQuiz={(widgeting_label, value) => { dispatch({ kind: 'enter_quiz_widgeted', entered: { widgeting_label, value } }) }}
      />
    </ScreenMain>
  )
}

/** The widgeting labelled `label` in `run` and its widget, when it is asked from the cell */
function askedStepOf(run: Runner.QuizRun, label: string): AskedStep | null {
  const step = Runner.stepOf(run, label)
  return step?.widget?.formulary === 'aibot' ? { widgeting: step.widgeting, widget: step.widget } : null
}
