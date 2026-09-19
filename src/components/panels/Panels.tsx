'use client'

import { ImportPanel } from './ImportPanel'
import { Panel } from './Panel'
import { ReadonlyBox } from './ReadonlyBox'
import * as Sheets from '../../lib/sheets'
import * as UU from '../../lib/useful'
import { PromptTemplates } from '../../lib/ask/prompts'
import type { QuizT } from '../../models/quiz'
import type { WorkspaceT } from '../../models/workspace'
import styles from '../workbench.module.css'

/** The titled sections below the grid: ways to get the work back out, and what was asked */
export function Panels({ quiz, workspace, onMerged }: Readonly<{ quiz: QuizT, workspace: WorkspaceT, onMerged: (quiz: QuizT) => void }>) {
  return (
    <div className={styles.panels}>
      <Panel
        title="Copy for Sheets"
        blurb="Tab-separated, one line per question, always in rank order whatever the grid is sorted into. Click the box to select the lot, then paste straight into a spreadsheet."
      >
        <ReadonlyBox label="Copy for Sheets" text={Sheets.sheetsExport(quiz.questions)} />
      </Panel>

      <Panel
        title="Export"
        blurb="Every quiz you have here, not just this one. Copy it somewhere safe to back up your progress, or paste part of it back through Import to move a quiz between browsers."
      >
        <ReadonlyBox label="Export" text={UU.jsonify(workspace)} rows={10} dense />
      </Panel>

      <ImportPanel quiz={quiz} locked={quiz.locked} onMerged={onMerged} />

      <Panel
        title="Prompts used"
        blurb="Exactly what is sent when you ask, placeholders and all. You are spending your own model usage on these and reading the answers as evidence about your own questions, so here they are."
      >
        {PromptTemplates.map((template) => (
          <div key={template.title}>
            <p className={styles.microcopy}><b>{template.title}</b></p>
            <ReadonlyBox label={`Prompt: ${template.title}`} text={template.body} rows={7} />
          </div>
        ))}
      </Panel>
    </div>
  )
}
