'use client'

import { useState } from 'react'
import { MenuItem, Stack, TextField } from '@mui/material'
import { FormulaField } from './FormulaField'
import { TemplateField } from './TemplateField'
import { BagWordVals, QuestionFieldVals, QuestionKeyVals, QuestionViewVals, widgetingSourceOf } from '../models/column'
import type { LiquidizeParamsT, LiquidizeWidgetT } from '../models/widget'
import type { JsonT } from '../models/widgeted'
import type { WidgetingT } from '../models/widgeting'
import styles from './workbench.module.css'

/** Where a `liquidize` widgeting's template comes from: its widget's, its own, or read from the bag */
export type TemplateSourcekind = 'widget' | 'own' | 'bag'

/** How each place a template may come from reads in its menu */
export const TemplateSourceWords: Readonly<Record<TemplateSourcekind, string>> = {
  widget: "Its widget's template",
  own:    'A template of its own',
  bag:    'Read from the bag, as a bot or a formula before it wrote it',
}

/**
 * Where params say a widgeting's template comes from.
 *
 * @example templateSourceOf({ template: '{{ qn.hint }}' })        // => 'own'
 * @example templateSourceOf({ template_from: { ref: 'dumdum' } })  // => 'bag'
 * @example templateSourceOf({})                                    // => 'widget'
 */
export function templateSourceOf(params: LiquidizeParamsT): TemplateSourcekind {
  if (params.template !== undefined) { return 'own' }
  return params.template_from === undefined ? 'widget' : 'bag'
}

/**
 * The refs a widgeting's template may be read from, in the order offered: the question's own
 * fields, its view and its keys, the quiz's other widgetings (for the whole quiz as
 * `quiz.<label>`), and the words at the bag's top level. A widgeting placed after the one reading
 * it reads as nothing there.
 *
 * @param widgetings - The quiz's widgetings.
 * @param label - The label of the widgeting reading the template, which is not offered itself.
 * @returns The refs.
 *
 * @example templateRefsOf([dumdum, playtesters], 'blurb')  // => ['title', 'clueing', ..., 'dumdum', 'quiz.playtesters', 'quiz', 'hunt', ...]
 */
export function templateRefsOf(widgetings: readonly Pick<WidgetingT, 'label' | 'tier'>[], label: string): string[] {
  const others = widgetings.filter((widgeting) => widgeting.label !== label)
  return [
    ...QuestionFieldVals, ...QuestionViewVals, ...QuestionKeyVals,
    ...others.map((widgeting) => widgetingSourceOf(widgeting.label, widgeting.tier)),
    ...BagWordVals,
  ]
}

export type LiquidizeParamsFieldsProps = {
  widget:   LiquidizeWidgetT
  /** What the widgeting says of its template now (`LiquidizeFormulary.ownOf`) */
  params:   LiquidizeParamsT
  /** The refs it may read a template from (`templateRefsOf`) */
  refs:     readonly string[]
  disabled: boolean
  /** Told the params as they now stand */
  onChange: (params: Record<string, JsonT>) => void
}

/**
 * Where a `liquidize` widgeting's template comes from, and the template: its widget's, a template
 * of its own (`TemplateField`), or one read from the bag, a ref picked and a formula over what it
 * picks (`FormulaField`). Each field commits as it is left or picked, and says in its own sentence
 * what will not do. Picking another place for the template to come from lets go of what the
 * last one said, and says nothing new until the field beside it does.
 */
export function LiquidizeParamsFields({ widget, params, refs, disabled, onChange }: Readonly<LiquidizeParamsFieldsProps>) {
  const [source, setSource] = useState<TemplateSourcekind>(templateSourceOf(params))
  const from = params.template_from
  // A new place to take the template from lets go of what the old one said.
  const pick = (picked: TemplateSourcekind) => {
    if (picked !== source) { onChange({}) }
    setSource(picked)
  }
  const putFrom = (ref: string, formula: string | undefined) => { onChange({ template_from: { ref, ...(formula !== undefined && { formula }) } }) }

  return (
    <Stack spacing={1.5} role="group" aria-label="Template">
      <TextField
        select size="small" label="Its template" value={source} disabled={disabled} sx={{ maxWidth: 420 }}
        onChange={(event) => { pick(event.target.value as TemplateSourcekind) }}
      >
        {(['widget', 'own', 'bag'] as const).map((kind) => <MenuItem key={kind} value={kind}>{TemplateSourceWords[kind]}</MenuItem>)}
      </TextField>
      {source === 'widget' && (
        <div className={styles.microcopy}>Its widget&apos;s template: <code>{widget.formula}</code></div>
      )}
      {source === 'own' && (
        <TemplateField
          label="Template" committed={params.template ?? null} locked={disabled} placeholder={widget.formula}
          helperText="Liquid, filled in for each question over the bag, and shown as markdown. Blank goes back to its widget's."
          onCommit={(template) => { onChange(template === null ? {} : { template }) }}
        />
      )}
      {source === 'bag' && (
        <Stack direction="row" spacing={1.5} sx={{ flexWrap: 'wrap', rowGap: 1.5, alignItems: 'flex-start' }}>
          <TextField
            select size="small" label="Read from" value={from?.ref ?? ''} disabled={disabled} sx={{ minWidth: 200 }}
            helperText={from === undefined ? 'Pick where the template is written.' : undefined}
            onChange={(event) => { putFrom(event.target.value, from?.formula) }}
          >
            {[...new Set([...refs, ...(from ? [from.ref] : [])])].map((ref) => <MenuItem key={ref} value={ref}>{ref}</MenuItem>)}
          </TextField>
          <FormulaField
            label="Formula" committed={from?.formula ?? null} locked={disabled || from === undefined} sx={{ flex: 1, minWidth: 240 }}
            placeholder="The field itself, or the widgeting's value"
            helperText="JSONata over what it reads, coming to the template's text: $.value.template of a bot's reply."
            onCommit={(formula) => { if (from) { putFrom(from.ref, formula ?? undefined) } }}
          />
        </Stack>
      )}
    </Stack>
  )
}
