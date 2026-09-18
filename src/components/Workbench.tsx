'use client'

import { useState } from 'react'
import clsx from 'clsx'
import { Footnote } from './Footnote'
import { QuestionTable, type SortMark } from './QuestionTable'
import { QuizHeader } from './QuizHeader'
import { Toolbar } from './Toolbar'
import { useWorkspace } from '../state/use-workspace'
import { useAsking } from '../state/use-asking'
import styles from './workbench.module.css'

/** The whole tool: one round on screen, saved to this browser the moment anything changes */
export function Workbench() {
  const { quiz, dispatch, saveNotice } = useWorkspace()
  const { asking, ask } = useAsking(dispatch)
  // The arrow marks only what was sorted in this session; the round itself remembers the column.
  const [sortMark, setSortMark] = useState<SortMark | null>(null)
  // The chain walk is a toggle rather than a column, so it keeps its own direction.
  const [chainDescending, setChainDescending] = useState(true)

  if (! quiz) { return <main className={styles.page}><p className={styles.microcopy}>Opening your rounds&hellip;</p></main> }

  const onSort = (sortkey: SortMark['sortkey']) => {
    const descending = sortMark?.sortkey === sortkey ? ! sortMark.descending : false
    setSortMark({ sortkey, descending })
    dispatch({ kind: 'sort_questions', sortkey, descending })
  }

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
        onAddQuestion={() => { dispatch({ kind: 'add_question' }) }}
        onRenumber={() => { dispatch({ kind: 'renumber_qnums' }) }}
        onSortByChain={() => {
          const descending = ! chainDescending
          setChainDescending(descending)
          dispatch({ kind: 'sort_by_chain_order', descending })
        }}
      />
      <Footnote />
    </main>
  )
}
