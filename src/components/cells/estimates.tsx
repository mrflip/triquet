'use client'

import { Chip, IconButton, MenuItem, Select, Stack } from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import { ReadonlyCell, WidgetedReadout } from './readouts'
import { choicesFor, addable, usePills } from './use-pills'
import * as Estimates from '../../lib/estimates'
import { Category, CategoryLabelVals, type CategoryLabel } from '../../models/category'
import { DifficultyVals, type Difficulty, type EstimatesT } from '../../models/estimate'
import type { WidgetingPart } from '../../models/column'
import type { WidgetedT } from '../../models/widgeted'
import styles from '../workbench.module.css'

/** What a pill's category list offers to make the pill blank again, before every category */
const BlankChoice = '(blank)'

/** What a pill's category list offers to take the pill away, after every category */
const RemoveChoice = '(remove)'

/** How each difficulty colours its pill: easy calm, hard alarming */
const DifficultyColors = { easy: 'success', medium: 'default', hard: 'error' } as const satisfies Record<Difficulty, string>

/** A pill's two lists: small and borderless, each as wide as what it shows, so the pill's outline is the only box */
const PillSelectSx = { fontSize: '0.75rem', '& .MuiSelect-select': { py: 0, pl: 0.25, minHeight: 0 } } as const

/** A pill's lists' menus, as small as the pill */
const PillMenuProps = { slotProps: { list: { dense: true } } } as const

export type EstimatesCellProps = {
  /** What the cell holds now */
  widgeted: WidgetedT
  /** The hunt's total order of categories, which each pill's list follows */
  order:    readonly CategoryLabel[]
  /** The column's title, which names the cell's lists */
  label:    string
  locked:   boolean
  heightPx: number
  /** Told the estimates the pills now come to, as each change is made */
  onEnter:  (estimates: EstimatesT) => void
}

/**
 * A category-estimate entry's cell: a pill for each category the question draws on, each with a
 * list of the categories (in the hunt's total order, less those other pills hold) and a list of
 * difficulties. A pill can be made blank again, and while there is more than one, its list ends
 * with "(remove)". A "+" adds a blank pill while none is blank. Blank pills come to nothing; a
 * cell whose every pill is blank holds an estimate of no category in particular. Each change is
 * kept as it is made.
 */
export function EstimatesCell({ widgeted, order, label, locked, heightPx, onEnter }: Readonly<EstimatesCellProps>) {
  const { pills, place, pitch, remove, add } = usePills(Estimates.estimatesOf(widgeted), onEnter)
  const removable = pills.length > 1
  return (
    <Stack direction="row" useFlexGap sx={{ flexWrap: 'wrap', gap: 0.5, alignItems: 'center', maxHeight: `${String(heightPx)}px`, overflowY: 'auto', py: 0.25 }}>
      {pills.map((pill, idx) => {
        const nth = `${label}, ${String(idx + 1)}`
        return (
          <Chip
            // A pill has no identity beyond its place: two blank ones are alike.
            key={idx}
            size="small" variant="outlined" color={DifficultyColors[pill.difficulty]}
            data-category={pill.category ?? ''}
            sx={{ height: 'auto', '& .MuiChip-label': { display: 'flex', gap: 0.75, px: 0.75 } }}
            label={(
              <>
                <Select<string>
                  variant="standard" disableUnderline displayEmpty sx={PillSelectSx} MenuProps={PillMenuProps}
                  inputProps={{ 'aria-label': `${nth}: category` }} disabled={locked}
                  value={pill.category ?? ''}
                  renderValue={(chosen) => {
                    const category = categoryOf(chosen)
                    return category === null ? <span className={styles.muted}>{BlankChoice}</span> : Category.titleOf(category)
                  }}
                  onChange={(event) => {
                    const choice = event.target.value
                    if (choice === RemoveChoice) { remove(idx); return }
                    place(idx, categoryOf(choice))
                  }}
                >
                  <MenuItem value="">{BlankChoice}</MenuItem>
                  {choicesFor(pills, idx, order).map((category) => <MenuItem key={category} value={category}>{Category.titleOf(category)}</MenuItem>)}
                  {removable && <MenuItem value={RemoveChoice}>{RemoveChoice}</MenuItem>}
                </Select>
                <Select
                  variant="standard" disableUnderline sx={PillSelectSx} MenuProps={PillMenuProps}
                  inputProps={{ 'aria-label': `${nth}: difficulty` }} disabled={locked}
                  value={pill.difficulty}
                  onChange={(event) => { pitch(idx, event.target.value) }}
                >
                  {DifficultyVals.map((difficulty) => <MenuItem key={difficulty} value={difficulty}>{difficulty}</MenuItem>)}
                </Select>
              </>
            )}
          />
        )
      })}
      {addable(pills) && ! locked && (
        <IconButton size="small" sx={{ p: 0.25 }} aria-label={`${label}: add a category`} onClick={add}>
          <AddIcon fontSize="small" />
        </IconButton>
      )}
    </Stack>
  )
}

/** The category a pill's list was set to, or null for its blank */
function categoryOf(choice: string): CategoryLabel | null {
  return CategoryLabelVals.find((label) => label === choice) ?? null
}

export type EstimatePartReadoutProps = {
  /** Which part of the cell the column shows */
  part:     WidgetingPart
  /** What that part came to for this question */
  widgeted: WidgetedT
  label:    string
  wide:     boolean
  heightPx: number
}

/**
 * One part of what a category-estimate cell came to, read-only: the estimates in words, or a
 * persona's chance (or the three's average) as a percentage. A failure reads as any worked-out
 * cell's does.
 */
export function EstimatePartReadout({ part, widgeted, label, wide, heightPx }: Readonly<EstimatePartReadoutProps>) {
  if (widgeted.status !== 'ok') { return <WidgetedReadout widgeted={widgeted} label={label} wide={wide} heightPx={heightPx} /> }
  const { value } = widgeted
  return (
    <ReadonlyCell heightPx={heightPx}>
      {part === 'estimates'
        ? <div className={styles.expressedText}>{Estimates.textOf(Estimates.estimatesOf(widgeted))}</div>
        : <div className={styles.sum}>{typeof value === 'number' ? Estimates.chanceTextOf(value) : null}</div>}
    </ReadonlyCell>
  )
}
