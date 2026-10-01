'use client'

import { ExportImportPanel } from './ExportImportPanel'
import { MembersPanel } from './MembersPanel'
import { ReadonlyBox } from './ReadonlyBox'
import { ReviewsPanel } from './ReviewsPanel'
import { TabbedPanel } from './TabbedPanel'
import * as Labelmaker from '../../lib/labelmaker'
import type { QuizRun } from '../../lib/formulary/runner'
import type { ShallowHuntT, ShallowRealmT } from '../../lib/rows'
import type { HuntActionDNA } from '../../models/actions'
import type { IdentT } from '../../models/ident'
import type { ImportedQuestionT } from '../../models/import'
import type { QuizT } from '../../models/quiz'
import { Widget, type AibotWidgetT, type WidgetT } from '../../models/widget'
import type { HuntHandle } from '../../state/use-hunt'
import styles from '../workbench.module.css'

export type PanelsProps = Pick<HuntHandle, 'reviews' | 'carryOut' | 'saveNotice' | 'dispatch'> & {
  quiz:      QuizT
  hunt:      ShallowHuntT
  realm:     ShallowRealmT
  /** The library's widgets */
  library:   readonly WidgetT[]
  /** Who is looking */
  ident:     IdentT
  /** The quiz, run: what its widgetings came to */
  run:       QuizRun
  /** Fold what the Import tab read into the quiz: the widgetings' adds and revisions, then one entry per question label */
  onImport:  (questions: readonly ImportedQuestionT[], widgetingActions: readonly HuntActionDNA[]) => void
}

/** The titled sections below the grid: what reviewers said, who is on the hunt, ways to get the work back out, and what was asked */
export function Panels({ quiz, hunt, realm, library, ident, reviews, run, carryOut, saveNotice, dispatch, onImport }: Readonly<PanelsProps>) {
  const labels = { hunt: Labelmaker.effectiveLabelOf(hunt), realm: realm.label, quiz: Labelmaker.effectiveLabelOf(quiz) }
  return (
    <div className={styles.panels}>
      <ReviewsPanel reviews={reviews} questions={quiz.questions} />

      <MembersPanel members={hunt.members} self_id={ident._id} labels={labels} carryOut={carryOut} saveNotice={saveNotice} />

      <ExportImportPanel quiz={quiz} hunt={hunt} library={library} run={run} dispatch={dispatch} onImport={onImport} />

      <TabbedPanel
        title="Prompts used"
        blurb="Exactly what is sent when you ask, placeholders and all. You are spending your own model usage on these and reading the answers as evidence about your own questions, so here they are."
        tabs={promptsOf(run).map((widget) => ({
          label:   Widget.titleOf(widget),
          content: <ReadonlyBox label={`Prompt: ${Widget.titleOf(widget)}`} text={widget.formula} rows={14} />,
        }))}
      />
    </div>
  )
}

/** The prompts the quiz's widgetings put to a model, each once, in run order */
function promptsOf(run: QuizRun): AibotWidgetT[] {
  const prompts = run.steps.flatMap(({ widget }) => (widget?.formulary === 'aibot' ? [widget] : []))
  return prompts.filter((widget, idx) => prompts.findIndex((other) => other.label === widget.label) === idx)
}
