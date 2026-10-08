'use client'

import { Checkbox, FormControlLabel, Stack, TextField } from '@mui/material'
import type * as Z from 'zod'
import _ from 'es-toolkit/compat'
import { NumberField } from './cells/fields'
import { RegexField } from './RegexField'
import { useDraft } from './use-draft'
import { ParamWords, TextLinesWords, TextPatternWords } from './widget-words'
import * as Reporting from '../lib/vv/reporting'
import type { RegexT } from '../lib/regexes'
import { EntryParamsOf, TextLinesVals, TextPatternVals, type EntryKind } from '../models/widget'
import type { JsonT } from '../models/widgeted'
import styles from './workbench.module.css'

export type EntryParamsFieldsProps = {
  /** The entry's kind, whose family's params are the fields drawn (`EntryParamsOf`) */
  entry_kind: EntryKind
  /** The params said here, by name */
  params:     Readonly<Record<string, JsonT>>
  /** The params beneath them, shown where nothing is said here: a widget's defaults, beneath a widgeting's own; none beneath a widget's */
  inherited:  Readonly<Record<string, unknown>>
  /** What the params are held to, whose sentence each field shows when it refuses (`EntryFormulary.paramsOf`) */
  validator:  Z.ZodType
  disabled:   boolean
  /** Told the params as they now stand, a field emptied leaving its name out */
  onChange:   (params: Record<string, JsonT>) => void
}

/**
 * An entry's params, one field for each its family takes, in the order its validator names them
 * (`EntryParamsOf`): a number's least, most and whether it is whole; a text's most characters,
 * pattern, regular expression and lines; a choice's options. Each field commits as it is left or picked, and says
 * what is wrong with it beside itself, in the validator's own sentence. A field left empty says
 * nothing, and what is beneath it shows through.
 */
export function EntryParamsFields({ entry_kind, params, inherited, validator, disabled, onChange }: Readonly<EntryParamsFieldsProps>) {
  const { shape } = EntryParamsOf[entry_kind]
  const paramnames = Object.keys(shape)
  if (paramnames.length === 0) { return <p className={styles.microcopy}>This kind of entry takes no settings.</p> }
  const checked = validator.safeParse(params, { error: Reporting.customError })
  const issueOf = (paramname: string) => (checked.success ? null : checked.error.issues.find((issue) => issue.path[0] === paramname)?.message ?? null)
  const put = (paramname: string, val: JsonT | undefined) => { onChange(_.omitBy({ ...params, [paramname]: val }, _.isUndefined) as Record<string, JsonT>) }
  return (
    <Stack spacing={1.5} role="group" aria-label="Settings">
      {paramnames.map((paramname) => (
        <ParamField
          key={paramname} paramname={paramname} said={params[paramname]} beneath={inherited[paramname]} help={helpOf(shape, paramname)}
          issue={issueOf(paramname)} disabled={disabled} onPut={(val) => { put(paramname, val) }}
        />
      ))}
    </Stack>
  )
}

/** What a param is, as its validator describes it */
function helpOf(shape: Readonly<Record<string, Z.ZodType | undefined>>, paramname: string): string {
  return shape[paramname]?.description ?? ''
}

type ParamFieldProps = {
  paramname: string
  /** What is said here, or undefined for nothing */
  said:      JsonT | undefined
  /** What shows through when nothing is */
  beneath:   unknown
  /** What the param is, as its validator describes it */
  help:      string
  /** What is wrong with what is said, or null */
  issue:     string | null
  disabled:  boolean
  /** Told the param's new value, or undefined to say nothing */
  onPut:     (val: JsonT | undefined) => void
}

/** One param's field, of the shape its value takes */
function ParamField({ paramname, said, beneath, help, issue, disabled, onPut }: Readonly<ParamFieldProps>) {
  const label = ParamWords[paramname] ?? paramname
  const helperText = issue ?? help
  switch (paramname) {
  case 'min':
  case 'max':
  case 'max_length': {
    const whole = paramname === 'max_length'
    return (
      <NumberField
        label={label} locked={disabled} fractional={! whole} signed={! whole} placeholder={typeof beneath === 'number' ? String(beneath) : ''}
        helperText={helperText} error={issue !== null} committed={typeof said === 'number' ? said : null} onCommit={(num) => { onPut(num ?? undefined) }}
      />
    )
  }
  case 'integer': {
    const ticked = (said ?? beneath) === true
    return (
      <FormControlLabel
        label={label} disabled={disabled}
        control={<Checkbox size="small" checked={ticked} onChange={(event) => { onPut(event.target.checked === beneath ? undefined : event.target.checked) }} />}
      />
    )
  }
  case 'pattern':
  case 'lines': {
    const words: Readonly<Record<string, string>> = paramname === 'pattern' ? TextPatternWords : TextLinesWords
    const vals: readonly string[] = paramname === 'pattern' ? TextPatternVals : TextLinesVals
    const blank = typeof beneath === 'string' ? `As the widget says: ${words[beneath] ?? beneath}` : '—'
    return (
      <TextField
        select label={label} size="small" value={typeof said === 'string' ? said : ''} disabled={disabled} error={issue !== null} helperText={helperText}
        slotProps={{ select: { native: true }, inputLabel: { shrink: true } }} onChange={(event) => { onPut(event.target.value === '' ? undefined : event.target.value) }}
      >
        <option value="">{blank}</option>
        {vals.map((val) => <option key={val} value={val}>{words[val]}</option>)}
      </TextField>
    )
  }
  case 'regex': {
    return (
      <RegexField
        label={label} committed={regexOf(said)} beneath={regexOf(beneath)} helperText={helperText} error={issue !== null} disabled={disabled}
        onCommit={(regex) => { onPut(regex ?? undefined) }}
      />
    )
  }
  case 'options': {
    return <OptionsField label={label} said={said} beneath={beneath} helperText={helperText} issue={issue} disabled={disabled} onPut={onPut} />
  }
  default: {
    return null
  }
  }
}

type OptionsFieldProps = Pick<ParamFieldProps, 'said' | 'beneath' | 'issue' | 'disabled' | 'onPut'> & {
  label:      string
  helperText: string
}

/** A choice's options, one a line, committed as the box is left: blank lines dropped, each trimmed */
function OptionsField({ label, said, beneath, helperText, issue, disabled, onPut }: Readonly<OptionsFieldProps>) {
  const committed = linesOf(said)
  const { draft, onChange, onBlur } = useDraft(committed, (typed) => {
    const options = typed.split('\n').map((line) => line.trim()).filter((line) => line !== '')
    onPut(options.length === 0 ? undefined : options)
  })
  return (
    <TextField
      multiline minRows={3} label={label} size="small" value={draft} disabled={disabled} error={issue !== null} helperText={helperText}
      placeholder={linesOf(beneath)} slotProps={{ inputLabel: { shrink: true } }}
      onChange={(event) => { onChange(event.target.value) }} onBlur={onBlur}
    />
  )
}

/**
 * A regular expression as params hold one, or null for anything else: as typed, whether or not it
 * will do, so the field keeps showing what the form's sentence is said of.
 */
function regexOf(said: unknown): RegexT | null {
  if (! _.isPlainObject(said)) { return null }
  const { source, flags } = said as Record<string, unknown>
  return typeof source === 'string' ? { source, flags: typeof flags === 'string' ? flags : '' } : null
}

/** A list of options as the box shows them, one a line; nothing for anything else */
function linesOf(options: unknown): string {
  return Array.isArray(options) ? options.filter((option) => typeof option === 'string').join('\n') : ''
}
