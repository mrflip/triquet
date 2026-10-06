'use client'

import { createContext, useContext, useId, useState, type ReactNode } from 'react'
import { Box, Collapse, IconButton, Stack } from '@mui/material'
import CloseFullscreenIcon from '@mui/icons-material/CloseFullscreen'
import OpenInFullIcon from '@mui/icons-material/OpenInFull'
import clsx from 'clsx'
import { FoldButton } from '../FoldButton'
import styles from '../workbench.module.css'

/** Whether a panel sits in a row of panels (`PanelsRow`), where widening it to the whole row means something */
const InPanelsRow = createContext(false)

export type PanelProps = {
  title:     string
  blurb:     string
  /** Spans the whole row of panels at rest, for content too broad for one column of them */
  wide?:     boolean
  /** Takes two columns of the row, where the row has room for two */
  double?:   boolean
  /** Whether it is widened to the whole row, for a view whose content grows with it; the panel keeps this itself when not given */
  widened?:  boolean
  /** Called with the width asked for, always `! widened`; given with `widened` */
  onWidenedChange?: (widened: boolean) => void
  children:  ReactNode
}

/**
 * One titled section with its explanatory microcopy; `wide` spans the whole row of panels, for
 * content too broad for one column of them, and `double` two columns of it, where the row has
 * room for two.
 *
 * Every panel folds to its title bar by the triangle before its heading, and opens again by it;
 * what it holds stays mounted while folded, so a draft typed in it survives. One in a row of
 * panels (`PanelsRow`) that is not already the whole row wide also has an arrow at the end of its
 * title bar, widening it to the whole row and narrowing it back. A panel keeps which way each is
 * turned itself, unless the view using it holds the width (`widened`), to grow its content with it.
 *
 * Named by its own heading, so it is a landmark someone can jump straight to rather than an
 * anonymous box they have to arrow through the grid to reach.
 */
export function Panel({ title, blurb, wide = false, double = false, widened: widenedHeld, onWidenedChange, children }: Readonly<PanelProps>) {
  const inRow = useContext(InPanelsRow)
  const [open, setOpen] = useState(true)
  const [widenedOwn, setWidenedOwn] = useState(false)
  const widened = widenedHeld ?? widenedOwn
  const setWidened = onWidenedChange ?? setWidenedOwn
  const bodyId = useId()
  const headingId = `panel-${title.toLowerCase().replaceAll(/[^a-z0-9]+/g, '-')}`
  const spansRow = wide || widened
  const WidenFace = widened ? CloseFullscreenIcon : OpenInFullIcon
  return (
    <section className={clsx(styles.panel, spansRow && styles.panelWide, double && ! spansRow && styles.panelDouble)} aria-labelledby={headingId}>
      <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
        <FoldButton open={open} onOpenChange={setOpen} label="Show this panel" controls={bodyId} />
        <Box component="h2" className={styles.panelHeading} id={headingId} sx={{ flex: '1 1 auto' }}>{title}</Box>
        {inRow && ! wide && (
          <IconButton size="small" aria-label="Widen this panel to the whole row" aria-pressed={widened} onClick={() => { setWidened(! widened) }} sx={{ p: 0.25, color: 'text.secondary' }}>
            <WidenFace fontSize="small" />
          </IconButton>
        )}
      </Stack>
      <Collapse in={open} id={bodyId}>
        <p className={styles.microcopy}>{blurb}</p>
        {children}
      </Collapse>
    </section>
  )
}

/**
 * The row of panels below the grid, as many columns as fit: a panel in it may be widened to the
 * whole row.
 */
export function PanelsRow({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <InPanelsRow value>
      <div className={styles.panels}>{children}</div>
    </InPanelsRow>
  )
}
