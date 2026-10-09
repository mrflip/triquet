'use client'

import { useId, useState, type ReactNode } from 'react'
import { Box, Tab, Tabs } from '@mui/material'
import { Panel } from './Panel'
import styles from '../workbench.module.css'

/** One tab of a tabbed panel: its name on the tab, the microcopy that opens it if any, and what it holds */
export type PanelTab = {
  label:   string
  blurb?:  string
  content: ReactNode
}

export type TabbedPanelProps = {
  title: string
  blurb: string
  tabs:  readonly PanelTab[]
  /** The label of the tab shown first; the first tab when none is named, or the one named is not there */
  shownFirst?: string
}

/**
 * A titled panel, the whole row wide, whose sections are tabs, one showing at a time. The tabs
 * answer the arrow keys, and each section is a tab panel named by its tab.
 *
 * A tab's section is built the first time it is shown, so a tab never visited costs nothing, and
 * stays mounted while hidden after that, so what is typed or prepared in one survives a visit to
 * another.
 */
export function TabbedPanel({ title, blurb, tabs, shownFirst }: Readonly<TabbedPanelProps>) {
  const [shownIdx, setShownIdx] = useState(() => Math.max(0, tabs.findIndex((tab) => tab.label === shownFirst)))
  // The tabs left since the panel was built, whose sections stay built: by label, so a tab coming or
  // going (one offered only to some) leaves the others as they were. The tab shown is always built.
  const [left, setLeft] = useState<ReadonlySet<string>>(() => new Set())
  const show = (idx: number) => {
    setLeft((was) => new Set([...was, tabs[shownIdx]?.label ?? '']))
    setShownIdx(idx)
  }
  const idBase = useId()
  const tabId = (idx: number) => `${idBase}-tab-${String(idx)}`
  const sectionId = (idx: number) => `${idBase}-section-${String(idx)}`

  return (
    <Panel title={title} blurb={blurb} wide>
      <Tabs
        value={shownIdx}
        onChange={(_event, idx: number) => { show(idx) }}
        variant="scrollable"
        scrollButtons="auto"
        aria-label={title}
        sx={{ borderBottom: 1, borderColor: 'divider' }}
      >
        {tabs.map((tab, ii) => <Tab key={tab.label} label={tab.label} id={tabId(ii)} aria-controls={sectionId(ii)} />)}
      </Tabs>
      {tabs.map((tab, ii) => (
        <Box key={tab.label} role="tabpanel" hidden={ii !== shownIdx} id={sectionId(ii)} aria-labelledby={tabId(ii)} sx={{ pt: 1 }}>
          {(ii === shownIdx || left.has(tab.label)) && (
            <>
              {tab.blurb === undefined ? null : <p className={styles.microcopy}>{tab.blurb}</p>}
              {tab.content}
            </>
          )}
        </Box>
      ))}
    </Panel>
  )
}
