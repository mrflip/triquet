'use client'

import { Autocomplete, Box, TextField, createFilterOptions } from '@mui/material'
import _ from 'es-toolkit/compat'
import { FormularyWords } from './widget-words'
import { FormularykindVals, Widget, type WidgetT } from '../models/widget'
import styles from './workbench.module.css'

export type WidgetPickerProps = {
  /** The widgets offered */
  library:    readonly WidgetT[]
  /** What the picker is called, on screen and to assistive technology */
  label:      string
  /** Said beneath it: what picking one does */
  helperText: string
  disabled?:  boolean
  /** Told the widget picked */
  onPick:     (widget: WidgetT) => void
}

/** How the picker finds a widget from what is typed: by its label, its title or its description */
const filterWidgets = createFilterOptions<WidgetT>({ stringify: (widget) => `${widget.label} ${Widget.titleOf(widget)} ${widget.description}` })

/**
 * The library as a catalogue to pick a widget from: grouped by formulary, each widget by its
 * title, with its label and what it works out, and found by typing any of them. It opens as it
 * appears, and a pick is told at once: the picker holds no choice of its own.
 */
export function WidgetPicker({ library, label, helperText, disabled = false, onPick }: Readonly<WidgetPickerProps>) {
  const options = _.sortBy([...library], (each) => FormularykindVals.indexOf(each.formulary))
  return (
    <Autocomplete
      options={options}
      value={null}
      disabled={disabled}
      autoHighlight
      openOnFocus
      groupBy={(each) => FormularyWords[each.formulary].group}
      getOptionLabel={(each) => Widget.titleOf(each)}
      isOptionEqualToValue={(each, picked) => each.label === picked.label}
      filterOptions={filterWidgets}
      onChange={(_event, picked) => { if (picked) { onPick(picked) } }}
      renderOption={({ key, ...props }, each) => (
        <Box component="li" key={key} {...props}>
          <Box sx={{ minWidth: 0 }}>
            <div>{Widget.titleOf(each)} <Box component="code" sx={{ color: 'text.secondary', fontSize: 12 }}>{each.label}</Box></div>
            {each.description === '' ? null : <div className={styles.microcopy}>{each.description}</div>}
          </Box>
        </Box>
      )}
      renderInput={(params) => <TextField {...params} autoFocus size="small" label={label} helperText={helperText} />}
      sx={{ flex: 1, minWidth: 220 }}
    />
  )
}
