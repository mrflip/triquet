'use client'

import { createContext, useContext, useId, type ReactNode } from 'react'
import { Box, Collapse, IconButton, Stack } from '@mui/material'
import CloseFullscreenIcon from '@mui/icons-material/CloseFullscreen'
import OpenInFullIcon from '@mui/icons-material/OpenInFull'
import clsx from 'clsx'
import { FoldButton } from '../FoldButton'
import { isShowing, useFold, type FoldT } from '../use-fold'
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
  /** How far it is turned (`FoldT`), for a view whose content grows with it when big; the panel keeps this itself when not given */
  fold?:     FoldT
  /** Called with the fold asked for; given with `fold` */
  onFoldChange?: (fold: FoldT) => void
  children:  ReactNode
}

/**
 * One titled section with its explanatory microcopy; `wide` spans the whole row of panels, for
 * content too broad for one column of them, and `double` two columns of it, where the row has
 * room for two.
 *
 * Every panel is folded to its title bar, open, or -- one in a row of panels (`PanelsRow`) that
 * is not already the whole row wide -- big, widened to the whole row (`FoldT`). The triangle
 * before its heading opens and folds it; the arrows at the end of its title bar make it big
 * from folded or open alike, and shrink it back to open; a double-click on its title turns it
 * folded, open, big, and folded again (folded and open alone, where it cannot be big). One in
 * the row of panels under the quiz starts folded, and one that is a page's own content (the
 * login gate, the hunt page) starts open. What it holds stays mounted while folded, so a draft
 * typed in it survives. A panel keeps its fold itself, unless the view using it holds it
 * (`fold`), to grow its content when big.
 *
 * Named by its own heading, so it is a landmark someone can jump straight to rather than an
 * anonymous box they have to arrow through the grid to reach. Its ids are React's (`useId`),
 * drawn from its place in the tree, so two panels of one title never share one.
 */
export function Panel({ title, blurb, wide = false, double = false, fold: foldHeld, onFoldChange, children }: Readonly<PanelProps>) {
  const inRow = useContext(InPanelsRow)
  const bigOffered = inRow && ! wide
  const held = foldHeld === undefined || onFoldChange === undefined ? undefined : { fold: foldHeld, setFold: onFoldChange }
  const { fold, cycle, toggle, embiggen } = useFold(inRow ? 'folded' : 'open', { bigOffered, held })
  const baseId = useId()
  const bodyId = `${baseId}-body`
  const headingId = `${baseId}-heading`
  const big = fold === 'big'
  const spansRow = wide || big
  const WidenFace = big ? CloseFullscreenIcon : OpenInFullIcon
  return (
    <section className={clsx(styles.panel, spansRow && styles.panelWide, double && ! spansRow && styles.panelDouble)} aria-labelledby={headingId}>
      <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
        <FoldButton open={isShowing(fold)} onOpenChange={toggle} label="Show this panel" controls={bodyId} />
        {/* A double-click turns the fold on; the buttons beside it are the keyboard's way to the same */}
        <Box component="h2" className={styles.panelHeading} id={headingId} onDoubleClick={cycle} sx={{ flex: '1 1 auto', userSelect: 'none' }}>{title}</Box>
        {bigOffered && (
          <IconButton size="small" aria-label="Widen this panel to the whole row" aria-pressed={big} onClick={embiggen} sx={{ p: 0.25, color: 'text.secondary' }}>
            <WidenFace fontSize="small" />
          </IconButton>
        )}
      </Stack>
      <Collapse in={isShowing(fold)} id={bodyId}>
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
