import type { ReactNode } from 'react'
import clsx from 'clsx'
import styles from '../workbench.module.css'

/**
 * One titled section with its explanatory microcopy; `wide` spans the whole row of panels, for
 * content too broad for one column of them.
 *
 * Named by its own heading, so it is a landmark someone can jump straight to rather than an
 * anonymous box they have to arrow through the grid to reach.
 */
export function Panel({ title, blurb, wide = false, children }: Readonly<{ title: string, blurb: string, wide?: boolean, children: ReactNode }>) {
  const headingId = `panel-${title.toLowerCase().replaceAll(/[^a-z0-9]+/g, '-')}`
  return (
    <section className={clsx(styles.panel, wide && styles.panelWide)} aria-labelledby={headingId}>
      <h2 className={styles.panelHeading} id={headingId}>{title}</h2>
      <p className={styles.microcopy}>{blurb}</p>
      {children}
    </section>
  )
}
