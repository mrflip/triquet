'use client'

import clsx from 'clsx'
import { Columns, GridWidthPx, type Headkind } from './columns'
import { QuestionRow } from './QuestionRow'
import { useSettledResize } from './use-settled-resize'
import type { QuestionPatch, QuestionT } from '../models/question'
import styles from './workbench.module.css'

export type QuestionTableProps = {
  questions:  QuestionT[]
  locked:     boolean
  /** The grip column only takes up space while the round is in Q# order */
  gripShown:  boolean
  onEdit:     (question_id: string, patch: QuestionPatch) => void
}

/** The grid: one row per question, scrolling sideways inside its own container */
export function QuestionTable({ questions, locked, gripShown, onEdit }: Readonly<QuestionTableProps>) {
  const resizeToken = useSettledResize()

  return (
    <div className={styles.scroller}>
      <table className={styles.grid} style={{ width: `${String(GridWidthPx)}px` }}>
        <thead>
          <tr>
            {Columns.map((column) => (
              <th
                key={column.colkey}
                scope="col"
                className={clsx(styles.head, headClassOf(column.headkind))}
                style={{ width: `${String(column.widthPx)}px` }}
              >
                {column.title}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {questions.map((question) => (
            <QuestionRow
              key={question.id}
              question={question}
              locked={locked}
              gripShown={gripShown}
              resizeToken={resizeToken}
              onEdit={(patch) => { onEdit(question.id, patch) }}
            />
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** Extra class for a header that is rotated, or centred and allowed to wrap */
function headClassOf(headkind: Headkind): string | undefined {
  if (headkind === 'vertical') { return styles.headVertical }
  return headkind === 'centered' ? styles.headCentered : undefined
}
