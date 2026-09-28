'use client'

import { Button } from '@mui/material'
import { FullHistoryDownload } from '../FullHistoryDownload'
import { ImportPanel } from './ImportPanel'
import { Panel } from './Panel'
import { ReadonlyBox } from './ReadonlyBox'
import { ReviewsPanel } from './ReviewsPanel'
import * as Exporting from '../../lib/exporting'
import * as Sheets from '../../lib/sheets'
import * as UU from '../../lib/useful'
import { AppNotices } from '../../lib/notices'
import { PromptTemplates } from '../../lib/ask/prompts'
import type { ExpressedForQuiz } from '../../lib/expressed'
import type { ReviewedT, ShallowHuntT } from '../../lib/rows'
import type { QuizT } from '../../models/quiz'
import { useWholeHunt } from '../../state/use-whole-hunt'
import styles from '../workbench.module.css'

/** The titled sections below the grid: what reviewers said, ways to get the work back out, and what was asked */
export function Panels({ quiz, hunt, reviews, expressed, onMerged }: Readonly<{ quiz: QuizT, hunt: ShallowHuntT, reviews: readonly ReviewedT[], expressed: ExpressedForQuiz, onMerged: (quiz: QuizT) => void }>) {
  const exporting = useWholeHunt(hunt, quiz)
  return (
    <div className={styles.panels}>
      <ReviewsPanel reviews={reviews} />

      <Panel
        title="Copy for Sheets"
        blurb="Tab-separated: a header row, then one line per question, with every column the grid has, always in rank order whatever the grid is sorted into. Click the box to select the lot, then paste straight into a spreadsheet."
      >
        <ReadonlyBox label="Copy for Sheets" text={Sheets.sheetsExport(quiz, expressed)} />
      </Panel>

      <Panel
        title="Export"
        blurb="Every quiz of this hunt, not just this one, read when you ask for it. Copy it somewhere safe to back up your progress, or paste it back through Import to bring a quiz's questions back. Any change on screen empties the box again, so what it holds is never behind you."
      >
        <div className={styles.panelRow}>
          <Button size="small" variant="outlined" disabled={exporting.asking} onClick={exporting.prepare}>Prepare export</Button>
          {exporting.failed ? <span className={styles.microcopy} role="status">{AppNotices.exportUnread}</span> : null}
        </div>
        <ReadonlyBox label="Export" text={exporting.whole ? UU.jsonify(Exporting.huntExported(exporting.whole)) : ''} rows={10} dense />
        <FullHistoryDownload quiz={quiz} />
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
