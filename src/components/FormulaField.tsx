'use client'

import { useState } from 'react'
import { Autocomplete, Box, TextField, type SxProps, type Theme } from '@mui/material'
import { useDraft } from './use-draft'
import * as Formulas from '../lib/formulas'
import * as PA from '../lib/vv/patterns'
import type { FormulaPreset } from '../lib/column-menu'

export type FormulaFieldProps = {
  /** What the field is called, on screen and to assistive technology */
  label:       string
  /** The formula as held now; null for none */
  committed:   string | null
  /** Told the formula once the field is left with it changed and sound; null when it was emptied */
  onCommit:    (formula: string | null) => void
  /** Formulas to pick from, each with a few words saying what it comes to; none leaves a box to type in */
  presets?:    readonly FormulaPreset[]
  locked:      boolean
  /** Shown in the empty box: what having no formula means */
  placeholder?: string
  /** Said beneath the box while nothing is wrong */
  helperText?: string
  sx?:         SxProps<Theme>
}

/**
 * What is wrong with `formula` as a formula an author typed, in a sentence, or null when nothing
 * is: text the tool will not hold, past a screenful, or JSONata that does not parse.
 *
 * @example formulaIssueOf('Formula', '$.masie')  // => null
 * @example formulaIssueOf('Formula', '$sum(')    // => a sentence naming the problem
 */
export function formulaIssueOf(label: string, formula: string): string | null {
  if (formula.length > PA.Formulaish.max) { return `${label} should be at most ${String(PA.Formulaish.max)} characters.` }
  if (! PA.Formulaish.re.test(formula)) { return `${label} ${PA.Formulaish.msg}.` }
  const issue = Formulas.check(formula)
  return issue === null ? null : `${label} does not read as JSONata: ${issue}`
}

/**
 * A JSONata formula, typed in or picked from presets (each listed with what it comes to), and
 * committed as the field is left: emptied, it is taken off. A formula that will not do is kept in
 * the box with the sentence saying why, and not committed. Any form may use it: it knows nothing
 * of what the formula is for.
 */
export function FormulaField({ label, committed, onCommit, presets = [], locked, placeholder, helperText, sx }: Readonly<FormulaFieldProps>) {
  const [issue, setIssue] = useState<string | null>(null)
  const draft = useDraft(committed ?? '', (typed) => {
    const trimmed = typed.trim()
    const found = trimmed === '' ? null : formulaIssueOf(label, trimmed)
    setIssue(found)
    if (found === null && trimmed !== (committed ?? '')) { onCommit(trimmed === '' ? null : trimmed) }
  })

  return (
    <Autocomplete<FormulaPreset, false, false, true>
      freeSolo
      disabled={locked}
      options={presets}
      value={null}
      inputValue={draft.draft}
      getOptionLabel={(option) => (typeof option === 'string' ? option : option.formula)}
      // Picking a preset only fills the box; leaving the box commits it, as typing does.
      onInputChange={(_event, typed, reason) => { if (reason !== 'reset') { draft.onChange(typed) } }}
      onChange={(_event, picked) => { if (picked !== null) { draft.onChange(typeof picked === 'string' ? picked : picked.formula) } }}
      renderOption={({ key, ...props }, option) => (
        <Box component="li" key={key} {...props}>
          <code>{option.formula}</code>
          <Box component="span" sx={{ color: 'text.secondary', ml: 1 }}>{option.title}</Box>
        </Box>
      )}
      sx={sx}
      renderInput={(params) => (
        <TextField
          {...params}
          size="small" label={label} placeholder={placeholder}
          error={issue !== null} helperText={issue ?? helperText}
          onBlur={draft.onBlur}
          slotProps={{ ...params.slotProps, htmlInput: { ...params.slotProps.htmlInput, style: { fontFamily: 'var(--font-data)', fontSize: 12 } } }}
        />
      )}
    />
  )
}
