'use client'

import { useState } from 'react'
import { Accordion, AccordionDetails, AccordionSummary, Box, ButtonBase, Table, TableBody, TableCell, TableHead, TableRow } from '@mui/material'
import CloseFullscreenIcon from '@mui/icons-material/CloseFullscreen'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import OpenInFullIcon from '@mui/icons-material/OpenInFull'
import { Legend, PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, Text, Tooltip, usePlotArea, type DotItemDotProps } from 'recharts'
import { Panel } from './Panel'
import * as SpreadChart from './spread-chart'
import * as Estimates from '../../lib/estimates'
import type { QuizRun } from '../../lib/formulary/runner'
import * as Spread from '../../lib/spread'
import { Category, WheelSlotCount } from '../../models/category'
import styles from '../workbench.module.css'

export type SpreadPanelProps = {
  /** The quiz, run: its category estimates, and the hunt's total order they are read round */
  run: QuizRun
}

/** How the chart is sized: at rest, as tall as its column is wide, with room for the legend; widened to the whole row of panels, a fixed height */
const ChartSizeSx = {
  resting: { aspectRatio: '1 / 1.08', maxHeight: 560 },
  wide:    { height: 680 },
} as const

/** What the panel says it shows */
const Blurb = "How this quiz's questions fall round the hunt's category wheel. Each question counts once, split evenly across the categories its estimates name; the smoothed line gives half of each share to its category and the rest to the two neighbours either side, so a gap between crowded subjects shows."

/** A count of questions, to two places at most */
const CountFormat = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 })

/**
 * The quiz's spread round the category wheel, as a radar: how many questions draw on each
 * category, and the same smoothed over each category's neighbours. The wheel is the chart's own
 * rim, its categories as tiles clockwise from the top in the hunt's total order.
 *
 * Clicking the chart, or pressing Enter on it, widens the panel to the whole row and the chart
 * with it; again narrows it back. Every number the chart draws is also in a table, folded
 * beneath it.
 */
export function SpreadPanel({ run }: Readonly<SpreadPanelProps>) {
  const [wide, setWide] = useState(false)
  const quizEstimates = Estimates.quizEstimatesOf(run)
  if (! quizEstimates) {
    return (
      <Panel title="Category spread" blurb={Blurb}>
        <p className={styles.microcopy}>
          This quiz has no category estimate entry yet. Put one to work from the gear, under
          Widgetings (the library&apos;s <strong>categories</strong> widget is one), and its spread
          round the wheel shows here.
        </p>
      </Panel>
    )
  }
  const spread = Spread.spreadOf(run.frame.order, quizEstimates.estimates.values())

  return (
    <Panel title="Category spread" blurb={Blurb} wide={wide}>
      <p className={styles.microcopy}>
        {questionsWords(spread.placedCount)} placed, from the estimates under <strong>{quizEstimates.widgeting.label}</strong>.
        Click the chart, or press Enter on it, to {wide ? 'narrow it again' : 'widen it to the whole row'}.
      </p>
      <ButtonBase
        component="div"
        disableRipple
        aria-pressed={wide}
        aria-label="Category spread chart, full width"
        onClick={() => { setWide((was) => ! was) }}
        sx={{
          display:      'block',
          position:     'relative',
          width:        '100%',
          ...(wide ? ChartSizeSx.wide : ChartSizeSx.resting),
          cursor:       wide ? 'zoom-out' : 'zoom-in',
          borderRadius: 1,
          '&.Mui-focusVisible': { outline: '2px solid var(--highlight)', outlineOffset: 2 },
          // The whole chart is the one control: a click must not leave a ring round the part of the drawing it landed on
          '& svg *:focus': { outline: 'none' },
        }}
      >
        <SpreadRadar spread={spread} />
        <Box aria-hidden sx={{ position: 'absolute', top: 4, right: 4, color: 'text.secondary', display: 'flex' }}>
          {wide ? <CloseFullscreenIcon fontSize="small" /> : <OpenInFullIcon fontSize="small" />}
        </Box>
      </ButtonBase>
      <p className={styles.microcopy}>
        {unplacedWords(spread.unplacedCount)}
      </p>
      <SpreadTable spread={spread} />
    </Panel>
  )
}

/** The radar itself: the count and the smoothed count, round a rim of the wheel's tiles */
function SpreadRadar({ spread }: Readonly<{ spread: Spread.SpreadT }>) {
  const rows = spread.points.map((point) => ({ ...point, title: Category.titleOf(point.category) }))
  const ticks = SpreadChart.radiusTicksOf(spread)
  return (
    <RadarChart responsive data={rows} outerRadius={SpreadChart.SpreadLayout.plotRadius} accessibilityLayer={false} style={{ width: '100%', height: '100%' }}>
      <PolarGrid gridType="circle" stroke="var(--border)" />
      <PolarAngleAxis dataKey="title" tick={(props: TickProps) => <TileTick {...props} />} tickLine={false} axisLine={{ stroke: 'var(--border)' }} />
      {/* Its numbers sit between the first two slots, clear of either tile's spoke */}
      <PolarRadiusAxis angle={90 - (180 / WheelSlotCount)} domain={[0, ticks.at(-1) ?? 1]} ticks={ticks} axisLine={false} tick={{ fill: 'var(--muted)', fontSize: 10 }} tickFormatter={(num: number) => CountFormat.format(num)} />
      <Radar
        name="Smoothed"
        dataKey="smoothed"
        stroke="var(--series-b)"
        strokeWidth={2}
        fill="var(--series-b)"
        fillOpacity={0.1}
        legendType="square"
        isAnimationActive={false}
      />
      <Radar
        name="Questions"
        dataKey="count"
        stroke="var(--series-a)"
        strokeWidth={2}
        fill="none"
        dot={(dotProps: DotItemDotProps) => <CountDot key={dotProps.index} {...dotProps} />}
        legendType="circle"
        isAnimationActive={false}
      />
      <Tooltip
        formatter={(num) => (typeof num === 'number' ? CountFormat.format(num) : num)}
        contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, fontSize: 12 }}
        labelStyle={{ color: 'var(--ink)', fontWeight: 600 }}
        itemStyle={{ color: 'var(--ink)' }}
      />
      <Legend formatter={(legendtext: string) => <span style={{ color: 'var(--ink)', fontSize: 12 }}>{legendtext}</span>} />
    </RadarChart>
  )
}

/** A category's count on the radar, ringed in the surface's colour so it reads where lines cross; none where nothing counts, which would only pile up in the middle */
function CountDot({ cx, cy, value }: Readonly<DotItemDotProps>) {
  if (typeof value !== 'number' || value <= 0) { return null }
  return <circle cx={cx} cy={cy} r={4} fill="var(--series-a)" stroke="var(--surface)" strokeWidth={2} />
}

/** What Recharts hands an angle axis's tick: where it falls, and the category's title with its angle */
type TickProps = { payload: { value: string, coordinate: number } }

/**
 * One category's tile on the chart's rim, drawn as the wheel draws it: a square card round its
 * title, out beyond the plot at the category's angle.
 */
function TileTick({ payload }: Readonly<TickProps>) {
  const plot = usePlotArea()
  if (! plot) { return null }
  const { xx, yy, side, fontSize } = SpreadChart.tileOf(payload.coordinate, plot)
  return (
    <g>
      <rect x={xx - (side / 2)} y={yy - (side / 2)} width={side} height={side} rx={4} fill="var(--surface)" stroke="var(--border)" />
      <Text x={xx} y={yy} width={side - 2} textAnchor="middle" verticalAnchor="middle" fontSize={fontSize} lineHeight="1.1em" fill="var(--ink)">
        {payload.value}
      </Text>
    </g>
  )
}

/** Every number the chart draws, a row for each category in the total order: the table a chart is read from without seeing it */
function SpreadTable({ spread }: Readonly<{ spread: Spread.SpreadT }>) {
  return (
    <Accordion disableGutters slotProps={{ transition: { unmountOnExit: true } }}>
      <AccordionSummary expandIcon={<ExpandMoreIcon />} id="spread-table-summary" aria-controls="spread-table-details">
        As a table
      </AccordionSummary>
      <AccordionDetails id="spread-table-details">
        <Table size="small" aria-label="Category spread" sx={{ '& td, & th': { px: 1 }, '& td:not(:first-of-type)': { fontVariantNumeric: 'tabular-nums' } }}>
          <TableHead>
            <TableRow>
              <TableCell>Category</TableCell>
              <TableCell align="right">Questions</TableCell>
              <TableCell align="right">Smoothed</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {spread.points.map(({ category, count, smoothed }) => (
              <TableRow key={category} data-category={category}>
                <TableCell>{Category.titleOf(category)}</TableCell>
                <TableCell align="right">{CountFormat.format(count)}</TableCell>
                <TableCell align="right">{CountFormat.format(smoothed)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </AccordionDetails>
    </Accordion>
  )
}

/** What is said of the questions that name no category */
function unplacedWords(count: number): string {
  if (count === 0) { return 'Every question names a category.' }
  const [draw, counts] = count === 1 ? ['draws', 'counts'] : ['draw', 'count']
  return `${questionsWords(count)} ${draw} on no category in particular, and ${counts} in neither line.`
}

/** `count` questions, in words: "1 question", "2.5 questions" */
function questionsWords(count: number): string {
  return `${CountFormat.format(count)} ${count === 1 ? 'question' : 'questions'}`
}
