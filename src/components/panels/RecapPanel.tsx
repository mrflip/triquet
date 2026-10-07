'use client'

import { useMemo } from 'react'
import { TextField } from '@mui/material'
import { Panel } from './Panel'
import { ReadonlyBox } from './ReadonlyBox'
import { useDraft, type DraftHandle } from '../use-draft'
import { MarkdownFace, faceOf, veiledIf } from '../cells/markdown'
import { AppNotices } from '../../lib/notices'
import * as Recap from '../../lib/recap'
import * as Templating from '../../lib/templating'
import type { QuizRun } from '../../lib/formulary/runner'
import type { QuizT } from '../../models/quiz'

/** How many lines the recap's head and tail grow to before they scroll */
export const RecapNoteMaxRows = 10

/** How many lines of the recap note show at once, the rest a scroll away */
export const RecapShownRows = 5

export type RecapPanelProps = {
  quiz:        QuizT
  /** The quiz, run: what its templates and its correct-answer column read */
  run:         QuizRun
  /** Whether whoever is looking may rewrite the head and tail; read-only when not */
  revisable:   boolean
  onRecapHead: (recap_head: string) => void
  onRecapTail: (recap_tail: string) => void
}

/**
 * The recap note, for the league's message boards once the quiz has been played: the recap head
 * to write, then the whole note in the boards' BBCode, a few lines high, scrolling, with a Copy
 * button, then the recap tail to write. The note follows the head and tail as they are typed.
 * Each question's own recap is written in the grid's Recap column.
 */
export function RecapPanel({ quiz, run, revisable, onRecapHead, onRecapTail }: Readonly<RecapPanelProps>) {
  const head = useDraft(quiz.recap_head, onRecapHead)
  const tail = useDraft(quiz.recap_tail, onRecapTail)
  const bag = useMemo(() => Templating.bagOf(run, null), [run])
  const note = useMemo(() => Recap.bbjankOf({ ...quiz, recap_head: head.draft, recap_tail: tail.draft }, run), [quiz, run, head.draft, tail.draft])
  return (
    <Panel
      title="Recap"
      blurb="The recap note to post once the quiz has been played, in the message boards' BBCode: the head, each question with its answer behind a spoiler and its recap (the grid's Recap column), then the tail. The head and tail are templates, filled in as a templated field is: {{quiz.title}} and the like."
      double
    >
      <RecapNote label="Recap head" draft={head} bag={bag} placeholder={AppNotices.recapHeadBlank} revisable={revisable} />
      <ReadonlyBox label="Recap note" text={note} rows={RecapShownRows} dense />
      <RecapNote label="Recap tail" draft={tail} bag={bag} placeholder={AppNotices.recapTailBlank} revisable={revisable} />
    </Panel>
  )
}

type RecapNoteProps = {
  label:       string
  draft:       DraftHandle
  /** What the note is filled in over: the quiz's bag, with no question */
  bag:         Templating.TemplateBag
  placeholder: string
  revisable:   boolean
}

/**
 * The recap's head or tail, as the smith's note is written: its markdown drawn filled in until it
 * is typed into, saying above it what keeps it from being filled in, if anything does.
 */
function RecapNote({ label, draft, bag, placeholder, revisable }: Readonly<RecapNoteProps>) {
  const face = faceOf(draft.draft, bag)
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
        input:     { readOnly: ! revisable, endAdornment: <MarkdownFace inInput text={face.text} templated={face.templated} issue={face.issue} /> },
        htmlInput: { className: veiledIf(face.text) },
      }}
      sx={{ mt: 1.5 }}
    />
  )
}
