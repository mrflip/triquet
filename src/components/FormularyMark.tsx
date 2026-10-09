'use client'

import { Tooltip } from '@mui/material'
import { FormularyIcons, FormularyWords } from './widget-words'
import type { Formularykind } from '../models/widget'

/**
 * The mark of a formulary (`FormularyIcons`), wherever a widget or a widgeting is listed: named by
 * its noun ("formula"), which is what a screen reader says of it, and saying what that is in its
 * tooltip (`FormularyWords`' gist). One small size, level with a line of text.
 *
 * @example <FormularyMark formulary="aibot" />  // a robot, named "prompt"
 */
export function FormularyMark({ formulary }: Readonly<{ formulary: Formularykind }>) {
  const Icon = FormularyIcons[formulary]
  const { noun, gist } = FormularyWords[formulary]
  return (
    <Tooltip title={gist} describeChild>
      <Icon fontSize="small" titleAccess={noun} sx={{ color: 'text.secondary', flexShrink: 0 }} />
    </Tooltip>
  )
}
