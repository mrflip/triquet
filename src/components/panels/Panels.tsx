'use client'

import { ExportImportPanel } from './ExportImportPanel'
import { MembersPanel } from './MembersPanel'
import { PanelsRow } from './Panel'
import { QuizEntriesPanel } from './QuizEntriesPanel'
import { RecapPanel } from './RecapPanel'
import { ReviewsPanel } from './ReviewsPanel'
import { SpreadPanel } from './SpreadPanel'
import { WidgetsPanel } from './WidgetsPanel'
import type { WorkbenchOffersT } from '../offers'
import type * as Actor from '../../lib/actor'
import type { QuizRun } from '../../lib/formulary/runner'
import type { ShallowHuntT, ShallowRealmT } from '../../lib/rows'
import type { ElsewhereT } from '../../lib/importing'
import type { HuntActionDNA, LibraryActionDNA } from '../../models/actions'
import type { QuizT } from '../../models/quiz'
import type { EntryValueT, WidgetT } from '../../models/widget'
import type { HuntHandle } from '../../state/use-hunt'

export type PanelsProps = Pick<HuntHandle, 'reviews' | 'carryOut' | 'saveNotice'> & {
  quiz:      QuizT
  hunt:      ShallowHuntT
  realm:     ShallowRealmT
  /** The library's widgets */
  library:   readonly WidgetT[]
  /** What whoever is looking holds of themselves on the hunt: whose place on it they may change is asked of each member */
  claims:    Actor.QuizClaimsT
  /** What the screen offers them */
  offers:    WorkbenchOffersT
  /** The quiz, run: what its widgetings came to */
  run:       QuizRun
  /** Carry out a change to the library, from the Library tab's import (`useLibraryActions`) */
  changeLibrary: (action: LibraryActionDNA) => void
  /** Fold what the Import tab read into the quiz: its own fields, its widgetings, its columns, then its questions, as actions in order */
  onImport:  (actions: readonly HuntActionDNA[]) => void
  /** Send a hunt pasted into the Import tab, none of whose quizzes matches this one, to the quiz it belongs to */
  onImportElsewhere: (elsewhere: ElsewhereT, pasted: string) => void
  /** Rewrite the quiz's Q1 preamble, from the LL Export tab */
  onQ1Preamble: (q1_preamble: string) => void
  /** Rewrite the quiz's recap head, from the Recap panel */
  onRecapHead: (recap_head: string) => void
  /** Rewrite the quiz's recap tail, from the Recap panel */
  onRecapTail: (recap_tail: string) => void
  /** Give the quiz a recap template of its own, or put it back on the default (null), from the Recap panel */
  onRecapTemplate: (recap_template: string | null) => void
  /** Type into one of the quiz's own entries, from the Quiz entries panel: the value, or null for one emptied */
  onEnterQuiz: (widgeting_label: string, value: EntryValueT | null) => void
}

/** The titled sections below the grid: what reviewers said, how the questions spread round the category wheel, who is on the hunt, the quiz's own entries, ways to get the work back out, the widgets the quiz puts to work, and the recap note */
export function Panels({ quiz, hunt, realm, library, claims, offers, reviews, run, carryOut, saveNotice, changeLibrary, onImport, onImportElsewhere, onQ1Preamble, onRecapHead, onRecapTail, onRecapTemplate, onEnterQuiz }: Readonly<PanelsProps>) {
  const labels = { org: hunt.org, hunt: hunt.label, realm: realm.label, quiz: quiz.label }
  return (
    <PanelsRow>
      <ReviewsPanel reviews={reviews} questions={quiz.questions} />

      <SpreadPanel run={run} />

      <MembersPanel members={hunt.members} claims={claims} labels={labels} carryOut={carryOut} saveNotice={saveNotice} />

      <QuizEntriesPanel run={run} locked={! offers.reviseQuestions} onEnter={onEnterQuiz} />

      <ExportImportPanel quiz={quiz} hunt={hunt} library={library} offers={offers} run={run} changeLibrary={changeLibrary} onImport={onImport} onImportElsewhere={onImportElsewhere} onQ1Preamble={onQ1Preamble} />

      <WidgetsPanel quiz={quiz} run={run} />

      <RecapPanel quiz={quiz} run={run} revisable={offers.reviseQuiz} onRecapHead={onRecapHead} onRecapTail={onRecapTail} onRecapTemplate={onRecapTemplate} />
    </PanelsRow>
  )
}
