'use client'

import { Checkbox, FormControlLabel, FormGroup } from '@mui/material'
import * as Templating from '../lib/templating'
import type { HuntActionDNA } from '../models/actions'
import type { QuizT } from '../models/quiz'
import type { WidgetT } from '../models/widget'

export type TemplatedEditorProps = {
  quiz:      QuizT
  /** The library's widgets, which say which of the quiz's widgetings are typed into as text */
  library:   readonly WidgetT[]
  /** Whether the nominations may be changed here: shown as they are when not */
  revisable: boolean
  dispatch:  (action: HuntActionDNA) => void
}

/**
 * Which of the quiz's sources are templated: a checkbox for each of its questions' markdown
 * fields and each text entry (`Templating.templatableSources`). Each tick sends the whole list
 * again, in the order offered.
 */
export function TemplatedEditor({ quiz, library, revisable, dispatch }: Readonly<TemplatedEditorProps>) {
  const offered = Templating.templatableSources(quiz, library)
  const nominate = (source: string, on: boolean) => {
    const templated = offered
      .map((each) => each.source)
      .filter((each) => (each === source ? on : Templating.templates(quiz, each)))
    dispatch({ kind: 'set_templated', templated })
  }
  return (
    <FormGroup row role="group" aria-label="Templated sources">
      {offered.map(({ source, title }) => (
        <FormControlLabel
          key={source}
          label={title}
          disabled={! revisable}
          control={<Checkbox size="small" checked={Templating.templates(quiz, source)} onChange={(event) => { nominate(source, event.target.checked) }} />}
        />
      ))}
    </FormGroup>
  )
}
