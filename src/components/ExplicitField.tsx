'use client'

import { useState } from 'react'
import { Button, Stack, TextField } from '@mui/material'

export type ExplicitFieldProps = {
  /** What the field is called, on screen and to assistive technology */
  label:       string
  /** The text as held now */
  committed:   string
  /** The button's word: `Relabel`, `Rename` */
  act:         string
  /** The button's name to assistive technology, when its word alone would be ambiguous on the page */
  actLabel?:   string
  /** Said beneath the field while nothing is wrong and nothing is waiting */
  helperText:  string
  disabled:    boolean
  /** How what is typed is tidied before it is compared or kept: a label normalized, a title trimmed */
  tidy?:       (typed: string) => string
  /**
   * Told what was typed, tidied, when the button is pressed with it changed. Hands back what is
   * wrong with it, which the field then says, or null once it has been sent.
   */
  onCommit:    (tidied: string) => string | null
}

/** What has been typed into an explicit field, and what was held when the typing began */
export type ExplicitTyped = {
  typed: string
  /** What the field held when the typing began: once it holds anything else, what was typed is set aside */
  base:  string
  /** Whether it has been sent, so that it waits only on the quiz's watch to come back */
  sent:  boolean
}

/** What an explicit field shows: the text, and whether it is waiting on its button */
export type ExplicitShown = { draft: string, unsaved: boolean }

/**
 * A field whose change has consequences -- a label other things name, a name on every screen --
 * and so waits for its own button, as a hunt's *Rename* and *Relabel* do, rather than being kept
 * as it is left. While what is typed differs from what is held and has not been sent, the field
 * says so, so that closing over it does not lose it unawares. What is held changing elsewhere
 * (another tab, the quiz's watch bringing back what was sent) takes the field over again.
 *
 * @example <ExplicitField label="Label" committed={quiz.label} act="Relabel" tidy={Labelmaker.normalize} onCommit={relabel} ... />
 */
export function ExplicitField({ label, committed, act, actLabel, helperText, disabled, tidy = String, onCommit }: Readonly<ExplicitFieldProps>) {
  const [typed, setTyped] = useState<ExplicitTyped | null>(null)
  const [issue, setIssue] = useState<string | null>(null)
  // Once what is held moves off what the typing began over, what was typed is done with: what is held coming back round to it does not revive it.
  if (typed !== null && typed.base !== committed) { setTyped(null) }
  const { draft, unsaved } = explicitShown(typed, committed, tidy)
  const onAct = () => {
    const problem = onCommit(tidy(draft))
    setIssue(problem)
    if (problem === null) { setTyped({ typed: draft, base: committed, sent: true }) }
  }
  const said = issue ?? (unsaved ? `Not kept yet: ${act} keeps it.` : helperText)
  return (
    <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-start' }}>
      <TextField
        label={label} value={draft} size="small" disabled={disabled} sx={{ flex: 1 }}
        error={issue !== null} helperText={said}
        slotProps={{ formHelperText: { sx: unsaved && issue === null ? { color: 'warning.main' } : undefined } }}
        onChange={(event) => { setTyped({ typed: event.target.value, base: committed, sent: false }); setIssue(null) }}
      />
      <Button variant="outlined" aria-label={actLabel} disabled={disabled || tidy(draft) === committed} onClick={onAct}>{act}</Button>
    </Stack>
  )
}

/**
 * What an explicit field shows, given what was typed into it and what is held: what was typed,
 * while what is held is still what it was when the typing began; else what is held. It is
 * unsaved while what it shows, tidied, is not what is held, and has not been sent.
 *
 * @param typed - What was typed, or null for nothing.
 * @param committed - What is held now.
 * @param tidy - How what is typed is tidied before it is compared.
 * @returns The text to show, and whether it waits on its button.
 *
 * @example explicitShown({ typed: 'Spring', base: 'spring', sent: false }, 'spring', String)  // => { draft: 'Spring', unsaved: true }
 * @example explicitShown({ typed: 'autumn', base: 'spring', sent: false }, 'winter', String)  // => { draft: 'winter', unsaved: false }
 */
export function explicitShown(typed: ExplicitTyped | null, committed: string, tidy: (typed: string) => string): ExplicitShown {
  if (typed?.base !== committed) { return { draft: committed, unsaved: false } }
  return { draft: typed.typed, unsaved: ! typed.sent && tidy(typed.typed) !== committed }
}
