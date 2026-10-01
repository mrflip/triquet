'use client'

import { Button } from '@mui/material'
import { FullHistoryDownload } from '../FullHistoryDownload'
import { ImportForm } from './ImportForm'
import { ReadonlyBox } from './ReadonlyBox'
import { TabbedPanel } from './TabbedPanel'
import * as Exporting from '../../lib/exporting'
import * as LLBBCode from '../../lib/ll-bbcode'
import * as LLSmithExport from '../../lib/ll-smith-export'
import * as Sheets from '../../lib/sheets'
import * as UU from '../../lib/useful'
import { AppNotices } from '../../lib/notices'
import type { QuizRun } from '../../lib/formulary/runner'
import type { ShallowHuntT } from '../../lib/rows'
import type { ImportedQuestionT } from '../../models/import'
import type { QuizT } from '../../models/quiz'
import { useWholeHunt } from '../../state/use-whole-hunt'
import styles from '../workbench.module.css'

export type ExportImportPanelProps = {
  quiz:      QuizT
  hunt:      ShallowHuntT
  /** The quiz, run: what the sheet's worked-out columns show */
  run:       QuizRun
  /** Fold what the Import tab read into the quiz: one entry per label */
  onImport:  (questions: readonly ImportedQuestionT[]) => void
}

/**
 * Every way to take the work somewhere else, and the one way to bring it back, as tabs of one
 * panel: a spreadsheet paste, the raw JSON of the whole hunt, Import, the quiz's full history,
 * and the league's own import format, with the smith's note in the league's BBCode.
 */
export function ExportImportPanel({ quiz, hunt, run, onImport }: Readonly<ExportImportPanelProps>) {
  const exporting = useWholeHunt(hunt, quiz)
  const tabs = [
    {
      label:   'Spreadsheet',
      blurb:   'Tab-separated: a header row, then one line per question, with every column the grid has, always in rank order whatever the grid is sorted into. Click the box to select the lot, then paste straight into a spreadsheet.',
      content: <ReadonlyBox label="Copy for Sheets" text={Sheets.sheetsExport(quiz, run)} />,
    },
    {
      label:   'Raw Export',
      blurb:   'Every quiz of this hunt, not just this one, read when you ask for it. Copy it somewhere safe to back up your progress, or paste it back through Import to bring a quiz\'s questions back. Any change on screen empties the box again, so what it holds is never behind you.',
      content: (
        <>
          <div className={styles.panelRow}>
            <Button size="small" variant="outlined" disabled={exporting.asking} onClick={exporting.prepare}>Prepare export</Button>
            {exporting.failed ? <span className={styles.microcopy} role="status">{AppNotices.exportUnread}</span> : null}
          </div>
          <ReadonlyBox label="Raw Export" text={exporting.whole ? UU.jsonify(Exporting.huntExported(exporting.whole)) : ''} rows={10} dense />
          <FullHistoryDownload quiz={quiz} />
        </>
      ),
    },
    {
      label:   'Import',
      blurb:   'Paste back anything Raw Export ever gave you, a single quiz, or a bare list of questions. Questions are matched by label; a field you leave out is left alone, a field set to null is cleared. Nothing is ever deleted.',
      content: <ImportForm quiz={quiz} locked={quiz.locked} onImport={onImport} />,
    },
    {
      label:   'Full History',
      blurb:   'Every version of this quiz this browser has kept, as a git repository: the best way we know to look back over what changed and when, and yours to take with you.',
      content: <FullHistoryDownload quiz={quiz} />,
    },
    {
      label:   'LL Export',
      blurb:   'The league\'s own import format, on one line. Each question in rank order gets a record: its number, its clueing with the BUT NOT below it, the full answer and the notes, separated by pipes and ending in $$. Bold and italics become [b] and [i], line breaks become [br], and a pipe in the text becomes ¦.',
      content: (
        <>
          <ReadonlyBox label="LL Export" text={LLSmithExport.recordsOf(quiz)} rows={6} dense />
          <p className={styles.microcopy}>The smith&apos;s note, with its bold, italics and line breaks written the same way.</p>
          <ReadonlyBox label="LL Smith's note" text={LLBBCode.translate(quiz.smiths_note)} rows={3} dense />
        </>
      ),
    },
  ]
  return <TabbedPanel title="Export / Import" blurb="Ways to take the work somewhere else, and to bring it back." tabs={tabs} />
}
