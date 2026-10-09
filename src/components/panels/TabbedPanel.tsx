'use client'

import { useId, useState, type ReactNode } from 'react'
import { Box, Stack, Tab, Tabs } from '@mui/material'
import { InfoTip } from '../InfoTip'
import { Panel } from './Panel'

/** One tab of a tabbed panel: its name on the tab, what it is and does if it needs saying, and what it holds */
export type PanelTab = {
  label:   string
  /** What the tab is and does, behind the (i) at the end of the row of tabs while it shows */
  about?:  ReactNode
  content: ReactNode
}

export type TabbedPanelProps = {
  title: string
  /** What the panel is and does, behind the (i) beside its heading */
  about: ReactNode
  tabs:  readonly PanelTab[]
  /** The label of the tab shown first; the first tab when none is named, or the one named is not there */
  shownFirst?: string
}

/**
 * A titled panel, the whole row wide, whose sections are tabs, one showing at a time. The tabs
 * answer the arrow keys, and each section is a tab panel named by its tab. The (i) at the end of
 * the row of tabs explains the tab showing.
 *
 * A hidden tab stays mounted, so what is typed or prepared in one survives a visit to another.
 */
export function TabbedPanel({ title, about, tabs, shownFirst }: Readonly<TabbedPanelProps>) {
  const [shownIdx, setShownIdx] = useState(() => Math.max(0, tabs.findIndex((tab) => tab.label === shownFirst)))
  const idBase = useId()
  const tabId = (idx: number) => `${idBase}-tab-${String(idx)}`
  const sectionId = (idx: number) => `${idBase}-section-${String(idx)}`
  const shown = tabs[shownIdx]

  return (
    <Panel title={title} about={about} wide>
      <Stack direction="row" sx={{ alignItems: 'center', borderBottom: 1, borderColor: 'divider' }}>
        <Tabs
          value={shownIdx}
          onChange={(_event, idx: number) => { setShownIdx(idx) }}
          variant="scrollable"
          scrollButtons="auto"
          aria-label={title}
          sx={{ flex: '1 1 auto', minWidth: 0 }}
        >
          {tabs.map((tab, ii) => <Tab key={tab.label} label={tab.label} id={tabId(ii)} aria-controls={sectionId(ii)} />)}
        </Tabs>
        {shown?.about === undefined ? null : <InfoTip topic={`the ${shown.label} tab`}>{shown.about}</InfoTip>}
      </Stack>
      {tabs.map((tab, ii) => (
        <Box key={tab.label} role="tabpanel" hidden={ii !== shownIdx} id={sectionId(ii)} aria-labelledby={tabId(ii)} sx={{ pt: 1 }}>
          {tab.content}
        </Box>
      ))}
    </Panel>
  )
}
