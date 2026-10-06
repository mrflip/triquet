'use client'

import { FullHistoryDownload } from '../FullHistoryDownload'
import { ImportForm } from './ImportForm'
import { LeagueExport } from './LeagueExport'
import { LibraryForm } from './LibraryForm'
import { RawExport } from './RawExport'
import { ReadonlyBox } from './ReadonlyBox'
import { TabbedPanel } from './TabbedPanel'
import type { WorkbenchOffersT } from '../offers'
import * as Sheets from '../../lib/sheets'
import type { QuizRun } from '../../lib/formulary/runner'
import type { ShallowHuntT } from '../../lib/rows'
import type { HuntActionDNA, LibraryActionDNA } from '../../models/actions'
import type { ImportedQuestionT } from '../../models/import'
import type { QuizT } from '../../models/quiz'
import type { WidgetT } from '../../models/widget'
import { useWholeHunt } from '../../state/use-whole-hunt'

export type ExportImportPanelProps = {
  quiz:      QuizT
  hunt:      ShallowHuntT
  /** The library's widgets, which the quizzes are run over and the Library tab hands out */
  library:   readonly WidgetT[]
  /** What the screen offers whoever is looking: the whole hunt's export, Import, the library's import and the Q1 preamble's field each only where it is */
  offers:    WorkbenchOffersT
  /** The quiz, run: what the sheet's worked-out columns show */
  run:       QuizRun
  /** Carry out a change to the library, from the Library tab's import (`useLibraryActions`) */
  changeLibrary: (action: LibraryActionDNA) => void
  /** Fold what the Import tab read into the quiz: the widgetings' adds and revisions, then one entry per question label */
  onImport:  (questions: readonly ImportedQuestionT[], widgetingActions: readonly HuntActionDNA[]) => void
  /** Rewrite the quiz's Q1 preamble, from the LL Export tab */
  onQ1Preamble: (q1_preamble: string) => void
}

/**
 * Every way to take the work somewhere else, and the one way to bring it back, as tabs of one
 * panel: a spreadsheet paste, the raw JSON of the whole hunt, Import, the library of widgets on
 * its own, the quiz's full history, and the league's own import format, with the smith's note in
 * the league's BBCode.
 */
export function ExportImportPanel({ quiz, hunt, library, offers, run, changeLibrary, onImport, onQ1Preamble }: Readonly<ExportImportPanelProps>) {
  const exporting = useWholeHunt(hunt, quiz)
  const tabs = [
    {
      label:   'Spreadsheet',
      blurb:   'Tab-separated: a header row, then one line per question, with every column the grid has, always in rank order whatever the grid is sorted into. Click the box to select the lot, then paste straight into a spreadsheet.',
      content: <ReadonlyBox label="Copy for Sheets" text={Sheets.sheetsExport(quiz, run)} />,
    },
    offers.exportHunt && {
      label:   'Raw Export',
      blurb:   'Every quiz of this hunt, not just this one, with its categories, its members and the widgets its quizzes work, read when you ask for it. Copy it somewhere safe to back up your progress, or paste it back through Import to bring a quiz\'s questions back, or through the Library tab to bring its widgets back. Any change on screen takes the box away again, so what it holds is never behind you: prepare it afresh, or refresh it to catch up with the hunt\'s other quizzes.',
      content: <RawExport hunt={hunt} exporting={exporting} library={library} />,
    },
    {
      label:   'Import',
      blurb:   'Paste back anything Raw Export ever gave you, a single quiz or its questions alone, or a bare list of questions. Questions and widgetings are matched by label; a field you leave out is left alone, a field set to null is cleared. Nothing is ever deleted.',
      content: <ImportForm quiz={quiz} library={library} locked={! offers.importQuestions} onImport={onImport} />,
    },
    {
      label:   'Library',
      blurb:   'The widgets every hunt shares, on their own: copy them out, or paste back a library, or a Raw Export for the widgets it holds. Widgets are matched by label; one the library lacks is added, one it holds is revised. Nothing is ever deleted.',
      content: <LibraryForm library={library} changeable={offers.changeLibrary} dispatch={changeLibrary} />,
    },
    {
      label:   'Full History',
      blurb:   'Every version of this quiz this browser has kept, as a git repository: the best way we know to look back over what changed and when, and yours to take with you.',
      content: <FullHistoryDownload quiz={quiz} />,
    },
    {
      label:   'LL Export',
      blurb:   'The league\'s own import format, on one line. Each question in rank order gets a record: its number, its clueing with the BUT NOT below it, the full answer and the notes, separated by pipes and ending in $$. Bold and italics become [b] and [i], line breaks become [br], and a pipe in the text becomes ¦. The mode can put the smith\'s note, or the Q1 preamble, ahead of the first question.',
      content: <LeagueExport quiz={quiz} revisable={offers.reviseQuiz} onQ1Preamble={onQ1Preamble} />,
    },
  ]
  return <TabbedPanel title="Export / Import" blurb="Ways to take the work somewhere else, and to bring it back." tabs={tabs.filter((tab) => tab !== false)} />
}
