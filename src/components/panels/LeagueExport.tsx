'use client'

import { useState } from 'react'
import { Box, IconButton, Select, TextField, Tooltip } from '@mui/material'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
import { ReadonlyBox } from './ReadonlyBox'
import { useDraft } from '../use-draft'
import * as LLBBCode from '../../lib/ll-bbcode'
import * as LLSmithExport from '../../lib/ll-smith-export'
import type { QuizT } from '../../models/quiz'
import styles from '../workbench.module.css'

/** What each mode is called in the pulldown */
const ModeTitles: Record<LLSmithExport.ExportMode, string> = {
  plain:       'Plain',
  playtesting: 'Playtesting',
  go_live:     'Go live',
}

/** What the info button says about the modes */
const ModesExplained = (
  <Box component="ul" sx={{ m: 0, pl: 2 }}>
    <li><b>Plain</b> exports the questions without modification.</li>
    <li><b>Playtesting</b> puts the entire smith&apos;s note ahead of the first question: the playtesting form has nowhere to add it.</li>
    <li><b>Go live</b> puts the Q1 preamble ahead of the first question.</li>
    <li>The first question is the one with the lowest-ranked Q#.</li>
  </Box>
)

export type LeagueExportProps = {
  quiz:         QuizT
  /** Whether whoever is looking may rewrite the Q1 preamble; when not, its field is read-only */
  revisable:    boolean
  /** Rewrite the quiz's Q1 preamble */
  onQ1Preamble: (q1_preamble: string) => void
}

/**
 * The quiz in the league's import format, in the mode the pulldown names (going live, unless told
 * otherwise; never kept), and the smith's note in the league's BBCode, line for line. Going live,
 * the quiz's Q1 preamble shows beside the pulldown, to be rewritten there.
 */
export function LeagueExport({ quiz, revisable, onQ1Preamble }: Readonly<LeagueExportProps>) {
  const [mode, setMode] = useState<LLSmithExport.ExportMode>('go_live')
  const preamble = useDraft(quiz.q1_preamble, onQ1Preamble)

  return (
    <>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
        <Select
          native
          size="small"
          value={mode}
          onChange={(event) => { setMode(event.target.value) }}
          inputProps={{ 'aria-label': 'LL Export mode' }}
          sx={{ minWidth: 160, fontSize: 13 }}
        >
          {LLSmithExport.ExportModes.map((each) => <option key={each} value={each}>{ModeTitles[each]}</option>)}
        </Select>
        <Tooltip title={ModesExplained}>
          <IconButton size="small" aria-label="About the LL Export modes">
            <InfoOutlinedIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        {mode === 'go_live'
          ? (
            <TextField
              label="Q1 preamble"
              size="small"
              value={preamble.draft}
              onChange={(event) => { preamble.onChange(event.target.value) }}
              onBlur={preamble.onBlur}
              slotProps={{ input: { readOnly: ! revisable } }}
              sx={{ flex: '1 1 320px', '& input': { fontFamily: 'var(--font-data)', fontSize: 12 } }}
            />
          )
          : null}
      </Box>
      <ReadonlyBox label="LL Export" text={LLSmithExport.recordsOf(quiz, mode)} rows={6} dense />
      <p className={styles.microcopy}>The smith&apos;s note, with its bold and italics written the same way, and a [br] ending each of its lines.</p>
      <ReadonlyBox label="LL Smith's note" text={LLBBCode.translateKeepingLines(quiz.smiths_note)} rows={3} dense />
    </>
  )
}
