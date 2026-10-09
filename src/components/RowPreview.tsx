'use client'

import { useMemo } from 'react'
import { Stack } from '@mui/material'
import clsx from 'clsx'
import { PreviewQuestionPicker } from './PreviewPicker'
import { ChainChoices } from './cells/chain'
import { QuestionRow } from './QuestionRow'
import { rowRunOf } from './row-runs'
import { ColumnHead } from './QuestionTable'
import { usePreviewQuestion } from './use-preview-bag'
import { useSettledResize } from './use-settled-resize'
import { GutterWidthPx, gridWidthPx, specsFor } from '../lib/columns'
import type { QuizRun } from '../lib/formulary/runner'
import type { QuizT } from '../models/quiz'
import { NoAsks } from '../state/use-asking'
import styles from './workbench.module.css'

/** What the preview's row is handed for each thing it could otherwise do: nothing */
const Inert = () => { /* the preview changes nothing */ }

/** Why a widgeting cannot be asked, in a preview that asks nothing: no reason, as the grid draws its cells */
const Unasked = () => null

export type RowPreviewProps = {
  /** The quiz, as held: its columns, its questions, and what it nominates as templateable */
  quiz: QuizT
  /** The quiz, run from what is held: what its widgetings came to */
  run:  QuizRun
}

/**
 * One question's row of the grid, previewed beside the columns editor: a select of the quiz's
 * questions in Q# order (the lowest-numbered until another is picked), and beneath it that
 * question across every column, headed as the grid heads them, drawn from the same columns
 * (`specsFor`) and the same run, so a title, a width, an alignment, a formula or a template is
 * seen as it lands. Read-only: no grip, no checkbox, no asking, and nothing typed is kept.
 *
 * It draws what is held, never what a field is still holding: a change shows once it is kept, and
 * an entry's params once the server has taken them.
 */
export function RowPreview({ quiz, run }: Readonly<RowPreviewProps>) {
  const specs = useMemo(() => specsFor(quiz), [quiz])
  const preview = usePreviewQuestion(quiz)
  const resizeToken = useSettledResize()
  const { question } = preview

  return (
    <Stack spacing={1}>
      <PreviewQuestionPicker preview={preview} />
      {question ? (
        <div className={styles.scroller}>
          <table className={styles.grid} aria-label="Preview of one question" style={{ width: `${String(gridWidthPx(specs))}px` }}>
            <thead>
              <tr>
                <th scope="col" className={clsx(styles.head, styles.headCorner)} style={{ width: `${String(GutterWidthPx)}px` }} aria-label="Question" />
                {specs.map((column) => <ColumnHead key={column.colkey} column={column}>{column.title}</ColumnHead>)}
              </tr>
            </thead>
            <tbody>
              <ChainChoices questions={quiz.questions}>
                <QuestionRow
                  question={question}
                  targetHint={quiz.questions.find((other) => other._id === question.chains_to)?.hint ?? null}
                  locked
                  gripShown={false}
                  checked={null}
                  onCheck={Inert}
                  onViz={Inert}
                  resizeToken={resizeToken}
                  folded={false}
                  onUnfold={Inert}
                  idx={0}
                  count={1}
                  onMove={Inert}
                  onChain={Inert}
                  specs={specs}
                  rowRun={rowRunOf(run, question, specs, quiz.templateable, Unasked)}
                  templateable={quiz.templateable}
                  asks={NoAsks}
                  onAsk={Inert}
                  onEdit={Inert}
                  onEnter={Inert}
                />
              </ChainChoices>
            </tbody>
          </table>
        </div>
      ) : <p className={styles.microcopy}>This quiz has no questions on the grid to preview.</p>}
    </Stack>
  )
}
