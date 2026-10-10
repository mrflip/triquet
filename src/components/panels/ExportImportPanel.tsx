'use client'

import { FullHistoryDownload } from '../FullHistoryDownload'
import { ImportForm } from './ImportForm'
import { LeagueExport } from './LeagueExport'
import { LibraryForm } from './LibraryForm'
import { RawExport } from './RawExport'
import { ReadonlyBox } from './ReadonlyBox'
import { TabbedPanel } from './TabbedPanel'
import * as PendingImports from '../pending-imports'
import type { WorkbenchOffersT } from '../offers'
import * as Sheets from '../../lib/sheets'
import * as Templating from '../../lib/templating'
import type { QuizRun } from '../../lib/formulary/runner'
import type { ShallowHuntT } from '../../lib/rows'
import type { ElsewhereT } from '../../lib/importing'
import type { HuntActionDNA, LibraryActionDNA } from '../../models/actions'
import type { QuizT } from '../../models/quiz'
import type { WidgetT } from '../../models/widget'
import { useWholeHunt } from '../../state/use-whole-hunt'

export type ExportImportPanelProps = {
  quiz:      QuizT
  hunt:      ShallowHuntT
  /** The library's widgets, which the quizzes are run over and the Widgets tab hands out */
  library:   readonly WidgetT[]
  /** What the screen offers whoever is looking: the whole hunt's export, Import, the library's import and the Q1 preamble's field each only where it is */
  offers:    WorkbenchOffersT
  /** The quiz, run: what the sheet's worked-out columns show */
  run:       QuizRun
  /** Carry out a change to the library, from the Widgets tab's import (`useLibraryActions`) */
  changeLibrary: (action: LibraryActionDNA) => void
  /** Fold what the Import tab read into the quiz: its own fields, its widgetings, its columns, then its questions, as actions in order */
  onImport:  (actions: readonly HuntActionDNA[]) => void
  /** Send a hunt pasted into the Import tab, none of whose quizzes matches this one, to the quiz it belongs to */
  onImportElsewhere: (elsewhere: ElsewhereT, pasted: string) => void
  /** Rewrite the quiz's Q1 preamble, from the LL Export tab */
  onQ1Preamble: (q1_preamble: string) => void
}

/**
 * Every way to take the work somewhere else, and the one way to bring it back, as tabs of one
 * panel: a spreadsheet paste, the raw JSON of the whole hunt, Import, the library of widgets on
 * its own (the Widgets tab), the quiz's full history, and the league's own import format, with
 * the smith's note in the league's BBCode. A quiz opened to read a paste sent from another quiz's Import opens on the
 * Import tab, saying what it read.
 */
export function ExportImportPanel({ quiz, hunt, library, offers, run, changeLibrary, onImport, onImportElsewhere, onQ1Preamble }: Readonly<ExportImportPanelProps>) {
  const exporting = useWholeHunt(hunt, quiz)
  const sentHere = PendingImports.peek(PendingImports.keyOf(hunt._id, quiz.label)) !== null
  const tabs = [
    {
      label:   'Spreadsheet',
      blurb:   'Tab-separated: a header row, then one line per question, with every column the grid has, always in rank order whatever the grid is sorted into. Click the box to select the lot, then paste straight into a spreadsheet.',
      content: <ReadonlyBox label="Copy for Sheets" text={Sheets.sheetsExport(quiz, run)} resizable />,
    },
    offers.exportHunt && {
      label:   'Raw Export',
      blurb:   'The whole hunt, every quiz of it and not just this one, with its categories, its members and the widgets its quizzes work, read when you ask for it; or this quiz alone. Copy either somewhere safe to back up your progress, or paste it back through Import to bring a quiz back, or through the Widgets tab to bring its widgets back. This quiz alone names no quiz, so it pastes into any quiz\'s Import: to copy it to another hunt, login or device, make a new quiz there, paste it into the Widgets tab for the widgets it works, then into Import. Any change on screen takes the whole hunt\'s box away again, so what it holds is never behind you: prepare it afresh, or refresh it to catch up with the hunt\'s other quizzes.',
      content: <RawExport hunt={hunt} exporting={exporting} quiz={quiz} run={run} library={library} />,
    },
    {
      label:   'Import',
      blurb:   'Paste back anything Raw Export ever gave you, a single quiz or its questions alone, or a bare list of questions. Questions and widgetings are matched by label; a field you leave out is left alone, a field set to null is cleared, and no question or widgeting is ever deleted. A widgeting whose widget the library lacks is skipped, and what its cells held with it: bring the widgets in first, through the Widgets tab. What was typed into an entry comes along, and what a bot replied fills its cell where the cell holds nothing. A quiz\'s title and notes come along, and its columns become this quiz\'s. A whole hunt whose quizzes match none of this one goes to the quiz of its first quiz\'s label, made for it if need be. Once a question comes in, the untouched blank ones are archived.',
      content: <ImportForm hunt_id={hunt._id} quiz={quiz} library={library} locked={! offers.importQuestions} onImport={onImport} onElsewhere={onImportElsewhere} />,
    },
    {
      label:   'Widgets',
      blurb:   'The library of widgets every hunt shares, on their own: copy them out, or paste back a library, or a Raw Export for the widgets it holds. Widgets are matched by label; one the library lacks is added, one it holds is revised. Nothing is ever deleted.',
      content: <LibraryForm library={library} changeable={offers.changeLibrary} dispatch={changeLibrary} />,
    },
    {
      label:   'Full History',
      blurb:   'Every version of this hunt this browser has kept, each of its quizzes and all, as a git repository: the best way we know to look back over what changed and when, and yours to take with you.',
      content: <FullHistoryDownload hunt={hunt} />,
    },
    {
      label:   'LL Export',
      blurb:   'The league\'s own import format, on one line. Each question in rank order gets a record: its number, its clueing with the BUT NOT below it, the full answer and the notes, separated by pipes and ending in $$. Bold and italics become [b] and [i], line breaks become [br], and a pipe in the text becomes ¦. The mode can put the smith\'s note, or the Q1 preamble, ahead of the first question.',
      content: <LeagueExport quiz={Templating.filledQuiz(quiz, run)} revisable={offers.reviseQuiz} onQ1Preamble={onQ1Preamble} />,
    },
  ]
  return <TabbedPanel title="Export / Import" blurb="Ways to take the work somewhere else, and to bring it back." tabs={tabs.filter((tab) => tab !== false)} shownFirst={sentHere ? 'Import' : undefined} />
}
