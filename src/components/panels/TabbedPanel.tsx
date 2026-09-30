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
}

/**
 * A titled panel, the whole row wide, whose sections are tabs, one showing at a time. The tabs
 * answer the arrow keys, and each section is a tab panel named by its tab.
 *
 * A hidden tab stays mounted, so what is typed or prepared in one survives a visit to another.
 */
export function TabbedPanel({ title, blurb, tabs }: Readonly<TabbedPanelProps>) {
  const [shownIdx, setShownIdx] = useState(0)
  const idBase = useId()
  const tabId = (idx: number) => `${idBase}-tab-${String(idx)}`
  const sectionId = (idx: number) => `${idBase}-section-${String(idx)}`

  return (
    <Panel title={title} blurb={blurb} wide>
      <Tabs
        value={shownIdx}
        onChange={(_event, idx: number) => { setShownIdx(idx) }}
        variant="scrollable"
        scrollButtons="auto"
        aria-label={title}
        sx={{ borderBottom: 1, borderColor: 'divider' }}
      >
        {tabs.map((tab, ii) => <Tab key={tab.label} label={tab.label} id={tabId(ii)} aria-controls={sectionId(ii)} />)}
      </Tabs>
      {tabs.map((tab, ii) => (
        <Box key={tab.label} role="tabpanel" hidden={ii !== shownIdx} id={sectionId(ii)} aria-labelledby={tabId(ii)} sx={{ pt: 1 }}>
          {tab.blurb === undefined ? null : <p className={styles.microcopy}>{tab.blurb}</p>}
          {tab.content}
        </Box>
      ))}
    </Panel>
  )
}
