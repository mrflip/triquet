'use client'

import { Card, Typography } from '@mui/material'
import * as Personas from '../lib/personas'
import { Category, type CategoryLabel } from '../models/category'
import { Persona, PersonaLabelVals, type PersonaLabel } from '../models/persona'
import type { WheelAdornment } from './CategoryWheel'

export type PersonaCardProps = {
  personalabel: PersonaLabel
  /** The hunt's total order, which says what sits beside the persona and opposite them */
  order:        readonly CategoryLabel[]
}

/**
 * A category persona, named, with what they know best (the category in their slot) and least
 * (the one opposite) as the wheel stands: drawn outside the wheel, beside their slot.
 */
export function PersonaCard({ personalabel, order }: Readonly<PersonaCardProps>) {
  const title = Persona.titleOf(personalabel)
  const [, best] = Personas.strongestOf(personalabel, order)
  const [, worst] = Personas.weakestOf(personalabel, order)
  return (
    <Card
      variant="outlined"
      role="group"
      aria-label={title}
      data-persona={personalabel}
      sx={{ width: '17cqi', px: '0.8cqi', py: '0.5cqi', fontSize: 'clamp(8px, 1.4cqi, 12px)', lineHeight: 1.25, textAlign: 'center' }}
    >
      <Typography component="h3" sx={{ fontSize: 'clamp(10px, 1.9cqi, 15px)', fontWeight: 600, lineHeight: 1.3 }}>{title}</Typography>
      {best && <Typography sx={{ font: 'inherit' }}>Best: {Category.titleOf(best)}</Typography>}
      {worst && <Typography sx={{ font: 'inherit', color: 'text.secondary' }}>Worst: {Category.titleOf(worst)}</Typography>}
    </Card>
  )
}

/**
 * The three personas' cards, each beside their slot: what a category wheel draws outside its ring.
 *
 * @param order - The hunt's total order.
 */
export function personaAdornmentsOf(order: readonly CategoryLabel[]): WheelAdornment[] {
  return PersonaLabelVals.map((personalabel) => ({
    slotIdx: Persona.slotIdxOf(personalabel),
    node:    <PersonaCard personalabel={personalabel} order={order} />,
  }))
}
