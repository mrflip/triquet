'use client'

import { ExportImportPanel } from './ExportImportPanel'
import { MembersPanel } from './MembersPanel'
import { ReadonlyBox } from './ReadonlyBox'
import { ReviewsPanel } from './ReviewsPanel'
import { TabbedPanel } from './TabbedPanel'
import * as Labelmaker from '../../lib/labelmaker'
import { PromptTemplates } from '../../lib/ask/prompts'
import type { QuizRun } from '../../lib/formulary/runner'
import type { ShallowHuntT, ShallowRealmT } from '../../lib/rows'
import type { IdentT } from '../../models/ident'
import type { ImportedQuestionT } from '../../models/import'
import type { QuizT } from '../../models/quiz'
import type { HuntHandle } from '../../state/use-hunt'
import styles from '../workbench.module.css'

export type PanelsProps = Pick<HuntHandle, 'reviews' | 'carryOut' | 'saveNotice'> & {
  quiz:      QuizT
  hunt:      ShallowHuntT
  realm:     ShallowRealmT
  /** Who is looking */
  ident:     IdentT
  /** The quiz, run: what its widgetings came to */
  run:       QuizRun
  /** Fold what the Import tab read into the quiz: one entry per label */
  onImport:  (questions: readonly ImportedQuestionT[]) => void
}

/** The titled sections below the grid: what reviewers said, who is on the hunt, ways to get the work back out, and what was asked */
export function Panels({ quiz, hunt, realm, ident, reviews, run, carryOut, saveNotice, onImport }: Readonly<PanelsProps>) {
  const labels = { hunt: Labelmaker.effectiveLabelOf(hunt), realm: realm.label, quiz: Labelmaker.effectiveLabelOf(quiz) }
  return (
    <div className={styles.panels}>
      <ReviewsPanel reviews={reviews} questions={quiz.questions} />

      <MembersPanel members={hunt.members} self_id={ident._id} labels={labels} carryOut={carryOut} saveNotice={saveNotice} />

      <ExportImportPanel quiz={quiz} hunt={hunt} run={run} onImport={onImport} />

      <TabbedPanel
        title="Prompts used"
        blurb="Exactly what is sent when you ask, placeholders and all. You are spending your own model usage on these and reading the answers as evidence about your own questions, so here they are."
        tabs={PromptTemplates.map((template) => ({
          label:   template.title,
          content: <ReadonlyBox label={`Prompt: ${template.title}`} text={template.body} rows={14} />,
        }))}
      />
    </div>
  )
}
