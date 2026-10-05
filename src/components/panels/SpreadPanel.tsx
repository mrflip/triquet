'use client'

import { useState } from 'react'
import { Accordion, AccordionDetails, AccordionSummary, Box, ButtonBase, Table, TableBody, TableCell, TableFooter, TableHead, TableRow, TableSortLabel } from '@mui/material'
import CloseFullscreenIcon from '@mui/icons-material/CloseFullscreen'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import OpenInFullIcon from '@mui/icons-material/OpenInFull'
import { Legend, PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, Text, Tooltip, usePlotArea, type DotItemDotProps } from 'recharts'
import { Panel } from './Panel'
import * as SpreadChart from './spread-chart'
import * as SpreadTable from './spread-table'
import * as Estimates from '../../lib/estimates'
import type { QuizRun } from '../../lib/formulary/runner'
import type { PersonaChancesT } from '../../lib/personas'
import * as Spread from '../../lib/spread'
import { Category, WheelSlotCount } from '../../models/category'
import { Persona, PersonaLabelVals } from '../../models/persona'
import styles from '../workbench.module.css'

export type SpreadPanelProps = {
  /** The quiz, run: its category estimates, and the hunt's total order they are read round */
  run: QuizRun
}

/** How the chart is sized: at rest, as tall as its two columns are wide, with room for the legend, up to a height; widened to the whole row of panels, a fixed height */
const ChartSizeSx = {
  resting: { aspectRatio: '1 / 1.08', maxHeight: 680 },
  wide:    { height: 680 },
} as const

/** What the panel says it shows */
const Blurb = "How this quiz's questions fall round the hunt's category wheel. Each question counts once, split evenly across the categories its estimates name; the smoothed line gives half of each share to its category and the rest to the two neighbours either side, so a gap between crowded subjects shows."

/** A count of questions, to two places at most */
const CountFormat = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 })

/**
 * The quiz's spread round the category wheel, as a radar: how many questions draw on each
 * category, and the same smoothed over each category's neighbours. The wheel is the chart's own
 * rim, its categories as tiles clockwise from the top in the hunt's total order. The plot's edge,
 * just inside the tiles, stands for the 75th percentile of the smoothed counts
 * (`SpreadChart.radiusScaleOf`), so the busiest categories reach out among the tiles. The panel
 * takes two columns of the row of panels where there is room for two.
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
  const scale = SpreadChart.radiusScaleOf(spread)

  return (
    <Panel title="Category spread" blurb={Blurb} wide={wide} double>
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
        <SpreadRadar spread={spread} scale={scale} />
        <Box aria-hidden sx={{ position: 'absolute', top: 4, right: 4, color: 'text.secondary', display: 'flex' }}>
          {wide ? <CloseFullscreenIcon fontSize="small" /> : <OpenInFullIcon fontSize="small" />}
        </Box>
      </ButtonBase>
      <p className={styles.microcopy}>
        The plot&apos;s edge, just inside the tiles, stands for {questionsWords(scale.top)}: three
        categories in four have no more than that once smoothed. A hollow dot is a count past the
        tiles, held at their edge; the table has it. {unplacedWords(spread.unplacedCount)}
      </p>
      <SpreadTableFold spread={spread} />
    </Panel>
  )
}

/** One category as the radar draws it: its point, its title, and its two counts as drawn, held at the tiles' edge */
type RadarRow = Spread.SpreadPointT & { title: string, countDrawn: number, smoothedDrawn: number, offScale: boolean }

/** Whether what Recharts hands a tooltip or a dot is one of the radar's rows */
function isRadarRow(row: unknown): row is RadarRow {
  return typeof row === 'object' && row !== null && 'countDrawn' in row
}

/**
 * The radar itself: the count and the smoothed count, round a rim of the wheel's tiles. A value
 * past the tiles' outer edge is drawn there, a count so held as a hollow dot; the tooltip and the
 * table say what it is.
 */
function SpreadRadar({ spread, scale }: Readonly<{ spread: Spread.SpreadT, scale: SpreadChart.RadiusScaleT }>) {
  const rows: RadarRow[] = spread.points.map((point) => ({
    ...point,
    title:         Category.titleOf(point.category),
    countDrawn:    SpreadChart.drawnOf(point.count, scale),
    smoothedDrawn: SpreadChart.drawnOf(point.smoothed, scale),
    offScale:      SpreadChart.isOffScale(point.count, scale),
  }))
  const { top, ticks } = scale
  return (
    <RadarChart responsive data={rows} outerRadius={SpreadChart.SpreadLayout.plotRadius} accessibilityLayer={false} style={{ width: '100%', height: '100%' }}>
      <PolarGrid gridType="circle" stroke="var(--border)" />
      <PolarAngleAxis dataKey="title" tick={(props: TickProps) => <TileTick {...props} />} tickLine={false} axisLine={{ stroke: 'var(--border)' }} />
      {/* Its numbers sit between the first two slots, clear of either tile's spoke */}
      <PolarRadiusAxis angle={90 - (180 / WheelSlotCount)} domain={[0, top]} allowDataOverflow ticks={ticks} axisLine={false} tick={{ fill: 'var(--muted)', fontSize: 10 }} tickFormatter={(num: number) => CountFormat.format(num)} />
      <Radar
        name="Smoothed"
        dataKey="smoothedDrawn"
        stroke="var(--series-b)"
        strokeWidth={2}
        fill="var(--series-b)"
        fillOpacity={0.1}
        legendType="square"
        isAnimationActive={false}
      />
      <Radar
        name="Questions"
        dataKey="countDrawn"
        stroke="var(--series-a)"
        strokeWidth={2}
        fill="none"
        dot={(dotProps: DotItemDotProps) => <CountDot key={dotProps.index} {...dotProps} />}
        legendType="circle"
        isAnimationActive={false}
      />
      <Tooltip
        // What a line truly comes to, not where it is drawn, which past the tiles is held at their edge
        formatter={(num, name, item) => {
          const row: unknown = item.payload
          if (! isRadarRow(row)) { return String(num ?? '') }
          return CountFormat.format(name === 'Smoothed' ? row.smoothed : row.count)
        }}
        contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, fontSize: 12 }}
        labelStyle={{ color: 'var(--ink)', fontWeight: 600 }}
        itemStyle={{ color: 'var(--ink)' }}
      />
      <Legend formatter={(legendtext: string) => <span style={{ color: 'var(--ink)', fontSize: 12 }}>{legendtext}</span>} />
    </RadarChart>
  )
}

/**
 * A category's count on the radar, ringed in the surface's colour so it reads where lines cross;
 * hollow where the count is past the tiles' edge and held there; none where nothing counts,
 * which would only pile up in the middle.
 */
function CountDot({ cx, cy, value, payload }: Readonly<DotItemDotProps>) {
  if (typeof value !== 'number' || value <= 0) { return null }
  const row: unknown = payload
  if (isRadarRow(row) && row.offScale) {
    return <circle cx={cx} cy={cy} r={4.5} fill="var(--surface)" stroke="var(--series-a)" strokeWidth={2} />
  }
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

/** The table's columns: what each heading says, and whether it holds a number, set to the right */
const SpreadColumnHeads = {
  slot:     { title: '#',         numeric: true },
  category: { title: 'Category',  numeric: false },
  count:    { title: 'Questions', numeric: true },
  smoothed: { title: 'Smoothed',  numeric: true },
  masie:    { title: Persona.titleOf('masie'), numeric: true },
  artie:    { title: Persona.titleOf('artie'), numeric: true },
  poppy:    { title: Persona.titleOf('poppy'), numeric: true },
  average:  { title: 'All three', numeric: true },
} as const satisfies Record<SpreadTable.SpreadColumn, { title: string, numeric: boolean }>

/** What a chance shows: a whole percentage, or a dash where no question draws on the category */
function chanceText(chances: PersonaChancesT | null, key: keyof PersonaChancesT): string {
  return chances === null ? '—' : Estimates.chanceTextOf(chances[key])
}

/**
 * Every number the chart draws, a row for each category, with each persona's chance at the
 * questions drawing on it and the three's average: the table a chart is read from without seeing
 * it. It starts in the wheel's order and sorts by any column, a click on its heading turning it
 * the other way. Its foot gives the chances over the whole quiz.
 */
function SpreadTableFold({ spread }: Readonly<{ spread: Spread.SpreadT }>) {
  const [sort, setSort] = useState(SpreadTable.SpreadSortDefault)
  const rows = SpreadTable.sortedRows(spread, sort)
  const direction = sort.descending ? 'desc' : 'asc'
  return (
    <Accordion disableGutters slotProps={{ transition: { unmountOnExit: true } }}>
      <AccordionSummary expandIcon={<ExpandMoreIcon />} id="spread-table-summary" aria-controls="spread-table-details">
        As a table
      </AccordionSummary>
      <AccordionDetails id="spread-table-details" sx={{ overflowX: 'auto' }}>
        <Table size="small" aria-label="Category spread" sx={{ '& td, & th': { px: 0.5 }, '& th': { whiteSpace: 'nowrap' }, '& .MuiTableSortLabel-icon': { mx: 0.125 }, '& td:not(:nth-of-type(2))': { fontVariantNumeric: 'tabular-nums' } }}>
          <TableHead>
            <TableRow>
              {SpreadTable.SpreadColumnVals.map((column) => {
                const { title, numeric } = SpreadColumnHeads[column]
                const active = sort.column === column
                return (
                  <TableCell key={column} align={numeric ? 'right' : 'left'} sortDirection={active ? direction : false}>
                    <TableSortLabel active={active} direction={active ? direction : 'asc'} onClick={() => { setSort((was) => SpreadTable.sortOnClick(was, column)) }}>
                      {title}
                    </TableSortLabel>
                  </TableCell>
                )
              })}
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map(({ point: { category, count, smoothed, chances }, slotIdx }) => (
              <TableRow key={category} data-category={category}>
                <TableCell align="right">{slotIdx + 1}</TableCell>
                <TableCell>{Category.titleOf(category)}</TableCell>
                <TableCell align="right">{CountFormat.format(count)}</TableCell>
                <TableCell align="right">{CountFormat.format(smoothed)}</TableCell>
                {PersonaLabelVals.map((personalabel) => <TableCell key={personalabel} align="right">{chanceText(chances, personalabel)}</TableCell>)}
                <TableCell align="right">{chanceText(chances, 'average')}</TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow data-category="">
              <TableCell />
              <TableCell>Whole quiz</TableCell>
              <TableCell align="right">{CountFormat.format(spread.placedCount)}</TableCell>
              <TableCell />
              {PersonaLabelVals.map((personalabel) => <TableCell key={personalabel} align="right">{chanceText(spread.chances, personalabel)}</TableCell>)}
              <TableCell align="right">{chanceText(spread.chances, 'average')}</TableCell>
            </TableRow>
          </TableFooter>
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
