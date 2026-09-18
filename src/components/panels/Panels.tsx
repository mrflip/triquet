'use client'

import { Panel } from './Panel'
import { ReadonlyBox } from './ReadonlyBox'
import { sheetsExport } from '../../lib/sheets'
import type { QuizT } from '../../models/quiz'
import styles from '../workbench.module.css'

/** The titled sections below the grid: ways to get the work back out */
export function Panels({ quiz }: Readonly<{ quiz: QuizT }>) {
  return (
    <div className={styles.panels}>
      <Panel
        title="Copy for Sheets"
        blurb="Tab-separated, one line per question, always in rank order whatever the grid is sorted into. Click the box to select the lot, then paste straight into a spreadsheet."
      >
        <ReadonlyBox label="Copy for Sheets" text={sheetsExport(quiz.questions)} />
      </Panel>
    </div>
  )
}
