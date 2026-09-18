import type { ReactNode } from 'react'
import styles from '../workbench.module.css'

/** One titled section with its explanatory microcopy */
export function Panel({ title, blurb, children }: Readonly<{ title: string, blurb: string, children: ReactNode }>) {
  return (
    <section className={styles.panel}>
      <h2 className={styles.panelHeading}>{title}</h2>
      <p className={styles.microcopy}>{blurb}</p>
      {children}
    </section>
  )
}
