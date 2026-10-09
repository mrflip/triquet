'use client'

import { useMemo } from 'react'
import { Accordion, AccordionDetails, AccordionSummary, Box, TextField } from '@mui/material'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import { Panel } from './Panel'
import { ReadonlyBox } from './ReadonlyBox'
import { useDraft, type DraftHandle } from '../use-draft'
import { MarkdownFace, veiledIf } from '../cells/markdown'
import { useFace, useTemplateIssueReport } from '../cells/use-face'
import { AppNotices } from '../../lib/notices'
import * as Recap from '../../lib/recap'
import * as Templating from '../../lib/templating'
import type { QuizRun } from '../../lib/formulary/runner'
import type { QuizT } from '../../models/quiz'
import styles from '../workbench.module.css'

/** How many lines the recap's head and tail grow to before they scroll */
export const RecapNoteMaxRows = 10

/** How many lines of the recap note show at once, the rest a scroll away */
export const RecapShownRows = 5

/** How many lines the recap template's box shows at least, and grows to before it scrolls */
export const RecapTemplateRows = { min: 6, max: 24 } as const

export type RecapPanelProps = {
  quiz:            QuizT
  /** The quiz, run: what its templates and its correct-answer column read */
  run:             QuizRun
  /** Whether whoever is looking may rewrite the head, tail and template; read-only when not */
  revisable:       boolean
  onRecapHead:     (recap_head: string) => void
  onRecapTail:     (recap_tail: string) => void
  /** Give the quiz a recap template of its own; null puts it back on the default */
  onRecapTemplate: (recap_template: string | null) => void
}

/**
 * The recap note, for the league's message boards once the quiz has been played: the recap head
 * to write, then the whole note in the boards' BBCode, a few lines high, scrolling, with a Copy
 * button, then the recap tail to write, and, folded below, the recap template the note is made by.
 * The note follows the head, tail and template as they are typed. Each question's own recap is
 * written in the grid's Recap column.
 */
export function RecapPanel({ quiz, run, revisable, onRecapHead, onRecapTail, onRecapTemplate }: Readonly<RecapPanelProps>) {
  const head = useDraft(quiz.recap_head, onRecapHead)
  const tail = useDraft(quiz.recap_tail, onRecapTail)
  const template = useDraft(Recap.templateOf(quiz), (text) => { onRecapTemplate(text === Recap.DefaultTemplate ? null : text) }, tidiedTemplate)
  const bag = useMemo(() => Templating.filledBagOf(quiz, run), [quiz, run])
  const note = useMemo(() => {
    const drafted = { ...quiz, recap_head: head.draft, recap_tail: tail.draft, recap_template: template.draft.trim() === '' ? undefined : template.draft }
    return Recap.noteOf(drafted, run)
  }, [quiz, run, head.draft, tail.draft, template.draft])
  useTemplateIssueReport(note.issue, 'Recap template', bag)
  return (
    <Panel
      title="Recap"
      about="The recap note to post once the quiz has been played, in the message boards' BBCode: the head, each question with its answer behind a spoiler and its recap (the grid's Recap column), then the tail. The head and tail are templates, filled in as a templated field is: {{quiz.title}} and the like. The recap template, folded below, lays the whole note out."
      double
    >
      <RecapNote label="Recap head" draft={head} bag={bag} placeholder={AppNotices.recapHeadBlank} revisable={revisable} />
      <ReadonlyBox label="Recap note" text={note.bbjank} rows={RecapShownRows} dense resizable />
      <RecapNote label="Recap tail" draft={tail} bag={bag} placeholder={AppNotices.recapTailBlank} revisable={revisable} />
      <RecapTemplate draft={template} owned={quiz.recap_template !== undefined} issue={note.issue} revisable={revisable} />
    </Panel>
  )
}

/** A recap template on its way out of the box: trimmed, as the quiz keeps it, and the default when that leaves nothing */
function tidiedTemplate(text: string): string {
  const trimmed = text.trim()
  return trimmed === '' ? Recap.DefaultTemplate : trimmed
}

type RecapNoteProps = {
  label:       string
  draft:       DraftHandle
  /** What the note is filled in over: the quiz's bag, with no question, its questions' templated texts filled in */
  bag:         Templating.TemplateBag
  placeholder: string
  revisable:   boolean
}

/**
 * The recap's head or tail, as the smith's note is written: its markdown drawn filled in until it
 * is typed into, saying above it what keeps it from being filled in, if anything does.
 */
function RecapNote({ label, draft, bag, placeholder, revisable }: Readonly<RecapNoteProps>) {
  const face = useFace(draft.draft, bag, label)
  return (
    <TextField
      label={label}
      multiline
      minRows={2}
      maxRows={RecapNoteMaxRows}
      fullWidth
      size="small"
      error={face.issue !== null}
      value={draft.draft}
      placeholder={placeholder}
      onChange={(event) => { draft.onChange(event.target.value) }}
      onBlur={draft.onBlur}
      slotProps={{
        input:     { readOnly: ! revisable, endAdornment: <MarkdownFace inInput text={face.text} issue={face.issue} /> },
        htmlInput: { className: veiledIf(face.text) },
      }}
      sx={{ mt: 1.5 }}
    />
  )
}

type RecapTemplateProps = {
  draft:     DraftHandle
  /** Whether the quiz has a recap template of its own, rather than the default */
  owned:     boolean
  /** What keeps the template from filling in, if anything does */
  issue:     string | null
  revisable: boolean
}

/**
 * The recap template, folded until opened: markdown with Liquid, always shown as typed, and
 * outlined in red, saying why, when it will not fill in. Emptied, it goes back to the default.
 */
function RecapTemplate({ draft, owned, issue, revisable }: Readonly<RecapTemplateProps>) {
  return (
    <Accordion disableGutters variant="outlined" sx={{ mt: 1.5 }} slotProps={{ transition: { unmountOnExit: true } }}>
      <AccordionSummary expandIcon={<ExpandMoreIcon />} id="recap-template-summary" aria-controls="recap-template-details">
        <Box component="span">
          Recap template{' '}
          <Box component="span" className={styles.microcopy}>{owned ? "(the quiz's own)" : '(the default)'}</Box>
        </Box>
      </AccordionSummary>
      <AccordionDetails id="recap-template-details">
        <p className={styles.microcopy}>
          Markdown with Liquid, filled in, then written in the boards&apos; BBCode. It reads what a templated field
          reads -- {'questions'}, every question by its label, each with its fields (templated ones filled in) and
          columns by label ({'{{ question.clueing }}'}, {'{{ question.correct_pct }}'}, {'question.secondary'} for an
          alternate and {'question.archived'} for one put away), so a column of your own can stand in for any line --
          and {' {{ recap_head }}'} and {'{{ recap_tail }}'} (filled in). {'{% assign played = questions | in_order %}'} lists
          the questions played in Q# order, each with its {'{{ question.number }}'}; {'questions | values'} lists them all. Three filters shape a field for where
          markdown is fragile: {'| quote'} keeps every line in the quote, {'| oneline'} joins the lines into one,
          {'| apart'} keeps a leading --- from making a heading; Liquid&apos;s own ({'| sort'}, {'| where'}) work too.
          Empty the box to go back to the default.
        </p>
        <TextField
          label="Recap template"
          multiline
          minRows={RecapTemplateRows.min}
          maxRows={RecapTemplateRows.max}
          fullWidth
          size="small"
          error={issue !== null}
          helperText={issue}
          value={draft.draft}
          onChange={(event) => { draft.onChange(event.target.value) }}
          onBlur={draft.onBlur}
          slotProps={{
            input:     { readOnly: ! revisable, sx: { fontFamily: 'monospace', fontSize: 13 } },
            htmlInput: { spellCheck: false },
          }}
        />
      </AccordionDetails>
    </Accordion>
  )
}
