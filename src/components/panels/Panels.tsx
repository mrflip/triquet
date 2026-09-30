'use client'

import { Button } from '@mui/material'
import { FullHistoryDownload } from '../FullHistoryDownload'
import { ImportPanel } from './ImportPanel'
import { MembersPanel } from './MembersPanel'
import { Panel } from './Panel'
import { ReadonlyBox } from './ReadonlyBox'
import { ReviewsPanel } from './ReviewsPanel'
import * as Exporting from '../../lib/exporting'
import * as Labelmaker from '../../lib/labelmaker'
import * as LLExport from '../../lib/ll-export'
import * as Sheets from '../../lib/sheets'
import * as UU from '../../lib/useful'
import { AppNotices } from '../../lib/notices'
import { PromptTemplates } from '../../lib/ask/prompts'
import type { ExpressedForQuiz } from '../../lib/expressed'
import type { ShallowHuntT, ShallowRealmT } from '../../lib/rows'
import type { IdentT } from '../../models/ident'
import type { ImportedQuestionT } from '../../models/import'
import type { QuizT } from '../../models/quiz'
import type { HuntHandle } from '../../state/use-hunt'
import { useWholeHunt } from '../../state/use-whole-hunt'
import styles from '../workbench.module.css'

export type PanelsProps = Pick<HuntHandle, 'reviews' | 'carryOut' | 'saveNotice'> & {
  quiz:      QuizT
  hunt:      ShallowHuntT
  realm:     ShallowRealmT
  /** Who is looking */
  ident:     IdentT
  expressed: ExpressedForQuiz
  /** Fold what the Import panel read into the quiz: one entry per label */
  onImport:  (questions: readonly ImportedQuestionT[]) => void
}

/** The titled sections below the grid: what reviewers said, who is on the hunt, ways to get the work back out, and what was asked */
export function Panels({ quiz, hunt, realm, ident, reviews, expressed, carryOut, saveNotice, onImport }: Readonly<PanelsProps>) {
  const exporting = useWholeHunt(hunt, quiz)
  const labels = { hunt: Labelmaker.effectiveLabelOf(hunt), realm: realm.label, quiz: Labelmaker.effectiveLabelOf(quiz) }
  return (
    <div className={styles.panels}>
      <ReviewsPanel reviews={reviews} questions={quiz.questions} />

      <MembersPanel members={hunt.members} self_id={ident._id} labels={labels} carryOut={carryOut} saveNotice={saveNotice} />

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

      <Panel
        title="LL Export"
        blurb="The league's own import format, on one line. Each question in rank order gets a record: its number, its clueing with the BUT NOT below it, the full answer and the notes, separated by pipes and ending in $$. Bold and italics become [b] and [i], line breaks become [br], and a pipe in the text becomes ¦."
      >
        <ReadonlyBox label="LL Export" text={LLExport.llExport(quiz)} rows={6} dense />
      </Panel>

      <ImportPanel quiz={quiz} locked={quiz.locked} onImport={onImport} />

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
