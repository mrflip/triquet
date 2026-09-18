import type { ReactNode } from 'react'
import styles from '../workbench.module.css'

/**
 * One titled section with its explanatory microcopy.
 *
 * Named by its own heading, so it is a landmark someone can jump straight to rather than an
 * anonymous box they have to arrow through the grid to reach.
 */
export function Panel({ title, blurb, children }: Readonly<{ title: string, blurb: string, children: ReactNode }>) {
  const headingId = `panel-${title.toLowerCase().replaceAll(/[^a-z0-9]+/g, '-')}`
  return (
    <section className={styles.panel} aria-labelledby={headingId}>
      <h2 className={styles.panelHeading} id={headingId}>{title}</h2>
      <p className={styles.microcopy}>{blurb}</p>
      {children}
    </section>
  )
}
