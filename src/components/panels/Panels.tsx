'use client'

import { ExportImportPanel } from './ExportImportPanel'
import { MembersPanel } from './MembersPanel'
import { ReviewsPanel } from './ReviewsPanel'
import { SpreadPanel } from './SpreadPanel'
import { WidgetsPanel } from './WidgetsPanel'
import * as Labelmaker from '../../lib/labelmaker'
import type { QuizRun } from '../../lib/formulary/runner'
import type { ShallowHuntT, ShallowRealmT } from '../../lib/rows'
import type { HuntActionDNA } from '../../models/actions'
import type { IdentT } from '../../models/ident'
import type { ImportedQuestionT } from '../../models/import'
import type { QuizT } from '../../models/quiz'
import type { WidgetT } from '../../models/widget'
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

/** The titled sections below the grid: what reviewers said, how the questions spread round the category wheel, who is on the hunt, ways to get the work back out, and the widgets the quiz puts to work */
export function Panels({ quiz, hunt, realm, library, ident, reviews, run, carryOut, saveNotice, dispatch, onImport }: Readonly<PanelsProps>) {
  const labels = { hunt: Labelmaker.effectiveLabelOf(hunt), realm: realm.label, quiz: Labelmaker.effectiveLabelOf(quiz) }
  return (
    <div className={styles.panels}>
      <ReviewsPanel reviews={reviews} questions={quiz.questions} />

      <SpreadPanel run={run} />

      <MembersPanel members={hunt.members} self_id={ident._id} labels={labels} carryOut={carryOut} saveNotice={saveNotice} />

      <ExportImportPanel quiz={quiz} hunt={hunt} library={library} run={run} dispatch={dispatch} onImport={onImport} />

      <WidgetsPanel quiz={quiz} run={run} />
    </div>
  )
}
