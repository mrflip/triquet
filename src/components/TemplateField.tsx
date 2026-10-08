'use client'

import { useState } from 'react'
import { TextField, type SxProps, type Theme } from '@mui/material'
import { useDraft } from './use-draft'
import * as Templating from '../lib/templating'
import * as PA from '../lib/vv/patterns'

export type TemplateFieldProps = {
  /** What the field is called, on screen and to assistive technology */
  label:       string
  /** The template as held now; null for none */
  committed:   string | null
  /** Told the template once the field is left with it changed and sound; null when it was emptied */
  onCommit:    (template: string | null) => void
  locked:      boolean
  /** Shown in the empty box: what having no template means */
  placeholder?: string
  /** Said beneath the box while nothing is wrong: what the template reads */
  helperText?: string
  sx?:         SxProps<Theme>
}

/**
 * What is wrong with `template` as a Liquid template an author typed, in a sentence, or null when
 * nothing is: text the tool will not hold, or Liquid that does not read (`Templating.issueOf`).
 *
 * @example templateIssueOf('Template', '{{ value }}%')     // => null
 * @example templateIssueOf('Template', '{% if value %}')   // => 'Template does not read as Liquid: tag {% if value %} not closed, line:1, col:1'
 */
export function templateIssueOf(label: string, template: string): string | null {
  if (template.length > PA.Textish.max) { return `${label} should be at most ${String(PA.Textish.max)} characters.` }
  if (! PA.Textish.re.test(template)) { return `${label} ${PA.Textish.msg}.` }
  const issue = Templating.issueOf(template)
  return issue === null ? null : `${label} does not read as Liquid: ${issue}`
}

/**
 * A Liquid template, typed in a box that grows with it and committed as the box is left:
 * emptied, it is taken off. A template that will not read is kept in the box with the sentence
 * saying why, and not committed. Any form may use it: what the template reads is the caller's to
 * say, in `helperText`.
 */
export function TemplateField({ label, committed, onCommit, locked, placeholder, helperText, sx }: Readonly<TemplateFieldProps>) {
  const [issue, setIssue] = useState<string | null>(null)
  const draft = useDraft(committed ?? '', (typed) => {
    const found = typed.trim() === '' ? null : templateIssueOf(label, typed)
    setIssue(found)
    if (found === null) { onCommit(typed.trim() === '' ? null : typed) }
  })

  return (
    <TextField
      size="small" multiline minRows={1} maxRows={8} label={label} value={draft.draft} placeholder={placeholder} disabled={locked}
      error={issue !== null} helperText={issue ?? helperText} sx={sx}
      slotProps={{ htmlInput: { style: { fontFamily: 'var(--font-data)', fontSize: 12 } } }}
      onChange={(event) => { draft.onChange(event.target.value) }} onBlur={draft.onBlur}
    />
  )
}
