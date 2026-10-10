'use client'

import { useState } from 'react'
import { Button, ToggleButton, ToggleButtonGroup } from '@mui/material'
import { ReadonlyBox, ReadonlyBoxStandIn } from './ReadonlyBox'
import * as Exporting from '../../lib/exporting'
import * as UU from '../../lib/useful'
import { AppNotices } from '../../lib/notices'
import type { QuizRun } from '../../lib/formulary/runner'
import type { ShallowHuntT } from '../../lib/rows'
import type { QuizT } from '../../models/quiz'
import type { WidgetT } from '../../models/widget'
import type { WholeHuntAsk } from '../../state/use-whole-hunt'
import styles from '../workbench.module.css'

/** How many lines the export box shows */
const BoxRows = 10

/** What Raw Export hands out: the whole hunt, or the quiz on screen alone */
const ExportedVals = ['hunt', 'quiz'] as const
type ExportedT = typeof ExportedVals[number]

/** What each choice of export is called on its button */
const ExportedTitles: Readonly<Record<ExportedT, string>> = {
  hunt: 'Whole hunt',
  quiz: 'This quiz',
}

export type RawExportProps = {
  /** The hunt as the screen holds it: its org, its wheel, and who is on it */
  hunt:      Pick<ShallowHuntT, 'org' | 'wheel' | 'members'>
  /** The hunt, read when asked for */
  exporting: WholeHuntAsk
  /** The quiz on screen, for its own export */
  quiz:      QuizT
  /** The quiz, run: what its widgetings came to */
  run:       QuizRun
  /** The library's widgets, which the hunt's quizzes are run over */
  library:   readonly WidgetT[]
}

/**
 * The work as raw JSON, the whole hunt or the quiz on screen alone, chosen by a pair of buttons
 * above the box; the whole hunt first.
 *
 * The whole hunt is one jsonball, every ball of it merged (`Exporting.wholeOf`), read only when
 * asked for. Until it is, and again once a change on screen withdraws it, the box's place is held
 * by an empty outline (`ReadonlyBoxStandIn`), with the Prepare button where Copy will be; once
 * read, the box, with Copy and a button to read it again beside it.
 *
 * The quiz alone is a copy of it (`Exporting.quizCopyOf`), made from what the screen holds, so it
 * is always up to date: everything another quiz needs to become the same, and the widgets it
 * works, but no label, so it pastes into any quiz's Import. Either box can be dragged taller.
 */
export function RawExport({ hunt, exporting, quiz, run, library }: Readonly<RawExportProps>) {
  const [exported, setExported] = useState<ExportedT>('hunt')
  return (
    <>
      <ToggleButtonGroup
        exclusive
        size="small"
        value={exported}
        onChange={(_event, chosen: ExportedT | null) => { if (chosen !== null) { setExported(chosen) } }}
        aria-label="What to export"
      >
        {ExportedVals.map((choice) => <ToggleButton key={choice} value={choice}>{ExportedTitles[choice]}</ToggleButton>)}
      </ToggleButtonGroup>
      {exported === 'quiz'
        ? <ReadonlyBox label="Quiz export" text={UU.jsonify(Exporting.quizCopyOf(quiz, run, library))} rows={BoxRows} dense resizable />
        : <HuntExport hunt={hunt} exporting={exporting} library={library} />}
    </>
  )
}

/** The whole hunt's box, or the outline holding its place and the button that reads it */
function HuntExport({ hunt, exporting, library }: Readonly<Pick<RawExportProps, 'hunt' | 'exporting' | 'library'>>) {
  if (exporting.whole === null) {
    return (
      <ReadonlyBoxStandIn
        rows={BoxRows}
        dense
        actions={(
          <>
            <Button size="small" variant="outlined" disabled={exporting.asking} onClick={exporting.prepare}>Prepare export</Button>
            {exporting.failed ? <span className={styles.microcopy} role="status">{AppNotices.exportUnread}</span> : null}
          </>
        )}
      />
    )
  }
  return (
    <ReadonlyBox
      label="Raw Export"
      text={UU.jsonify(Exporting.wholeOf(Exporting.snapshotOf(hunt, exporting.whole, library)))}
      rows={BoxRows}
      dense
      resizable
      actions={<Button size="small" variant="outlined" disabled={exporting.asking} onClick={exporting.prepare}>Refresh export</Button>}
    />
  )
}
