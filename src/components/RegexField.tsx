'use client'

import { useState } from 'react'
import { InputAdornment, Stack, TextField, ToggleButton, ToggleButtonGroup, Tooltip } from '@mui/material'
import _ from 'es-toolkit/compat'
import { useDraft } from './use-draft'
import * as Regexes from '../lib/regexes'
import type { Flag, RegexT } from '../lib/regexes'

/** What each flag a pattern may carry does, as its toggle's tip says it */
export const FlagWords: Readonly<Record<Flag, string>> = {
  i: 'Ignore case',
  m: '^ and $ match at each line',
  s: '. matches a newline too',
  u: String.raw`Unicode: \p{…} and the like`,
}

export type RegexFieldProps = {
  label:      string
  /** The pattern said here, or null for none */
  committed:  RegexT | null
  /** What shows through while nothing is said here: a widget's default, beneath a widgeting's own */
  beneath?:   RegexT | null
  /** What the field is for, or the form's sentence for what is wrong with it */
  helperText: string
  /** Whether `helperText` says what is wrong */
  error:      boolean
  disabled:   boolean
  /** Told the pattern as it now stands, or null once its source is emptied */
  onCommit:   (regex: RegexT | null) => void
}

/**
 * A regular expression of the author's own: its source typed between the slashes, committed as
 * the box is left, and its flags as toggles beside it, each committed as it is pressed. A form's
 * own check (its length, its flags, whether it compiles) is said in `helperText`. Whether it could
 * take too long to match some text is asked of recheck as each pattern is committed, on a worker
 * and loading recheck only then, and a pattern it refuses is said beside the field in the words
 * the server would refuse it in: a courtesy, since the server asks again and its verdict counts.
 */
export function RegexField({ label, committed, beneath = null, helperText, error, disabled, onCommit }: Readonly<RegexFieldProps>) {
  const courtesy = useCourtesy()
  const commit = (regex: RegexT | null) => {
    onCommit(regex)
    if (regex !== null) { void courtesy.ask(regex) }
  }
  const flags = committed?.flags ?? beneath?.flags ?? ''
  const { draft, onChange, onBlur } = useDraft(committed?.source ?? '', (typed) => { commit(typed === '' ? null : { source: typed, flags }) })
  const refusal = error ? null : courtesy.refusalOf(committed)
  return (
    <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-start' }}>
      <TextField
        label={label} size="small" fullWidth value={draft} disabled={disabled} placeholder={beneath?.source ?? ''}
        error={error || refusal !== null} helperText={refusal ?? helperText}
        sx={{ '& input': { fontFamily: 'var(--font-data)', fontSize: 12 } }}
        slotProps={{
          inputLabel: { shrink: true },
          htmlInput:  { spellCheck: false, autoCapitalize: 'off', autoCorrect: 'off' },
          input:      {
            startAdornment: <InputAdornment position="start">/</InputAdornment>,
            endAdornment:   <InputAdornment position="end">/</InputAdornment>,
          },
        }}
        onChange={(event) => { onChange(event.target.value) }} onBlur={onBlur}
      />
      <ToggleButtonGroup
        size="small" aria-label={`${label}: flags`} value={Regexes.FlagVals.filter((flag) => flags.includes(flag))} disabled={disabled || draft === ''}
        onChange={(_event, picked: Flag[]) => { commit({ source: draft, flags: Regexes.FlagVals.filter((flag) => picked.includes(flag)).join('') }) }}
      >
        {Regexes.FlagVals.map((flag) => (
          <Tooltip key={flag} title={FlagWords[flag]}>
            <ToggleButton value={flag} aria-label={FlagWords[flag]} sx={{ fontFamily: 'var(--font-data)', px: 1.25 }}>{flag}</ToggleButton>
          </Tooltip>
        ))}
      </ToggleButtonGroup>
    </Stack>
  )
}

/** recheck's verdict on one pattern, by how it is shown: null while it is being worked out */
type Verdict = { shownAs: string, refusal: string | null }

/**
 * recheck's verdicts on the patterns a field commits, worked out in the browser: `ask` for a
 * pattern as it is committed, and `refusalOf` the one the field now holds, as a sentence, or null
 * while there is none to say. recheck is loaded the first time a pattern is asked of, and a
 * pattern that will not compile is left to the form's own check. When recheck cannot be loaded
 * the field says nothing, and the server's check is the one the author hears.
 */
function useCourtesy(): { ask: (regex: RegexT) => Promise<void>, refusalOf: (regex: RegexT | null) => string | null } {
  const [verdict, setVerdict] = useState<Verdict | null>(null)
  const ask = async (regex: RegexT) => {
    if (Regexes.compileIssueOf(regex) !== null) { return }
    const shownAs = Regexes.shown(regex)
    setVerdict({ shownAs, refusal: null })
    try {
      const Redos = await import('../lib/redos')
      const refusal = await Redos.courtesyRefusalOf(regex)
      // A pattern committed since is the one the field holds, and its own verdict the one to keep.
      setVerdict((held) => (held?.shownAs === shownAs ? { shownAs, refusal } : held))
    } catch {
      setVerdict(null)
    }
  }
  const refusalOf = (regex: RegexT | null) => {
    if (regex === null || verdict?.refusal == null || verdict.shownAs !== Regexes.shown(regex)) { return null }
    return `${_.upperFirst(verdict.refusal)}.`
  }
  return { ask, refusalOf }
}
