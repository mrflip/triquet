/**
 * How long an author waits for each kind of edit, and how many bytes each browser downloads for
 * it, measured on a running copy of the app: the cloud, or a local production build.
 *
 * One browser is the author and a second watches the same quiz. The author says who it is, makes
 * a hunt, brings in the sample's largest quiz through the Import box, then makes `--rounds` rounds
 * of edits: a reorder by arrow key, four quick presses, the lock and unlock, a new question, a
 * text commit and a sort. Last, five fresh tabs open the quiz. Every wait is timed inside the
 * page, from the user's own event (the key, the click, the field losing focus) to the first state
 * of the page showing the result, checked on every DOM change and every frame. The watcher's wait
 * is timed from the author's event. Every websocket frame is tapped, for bytes each way, query
 * redeliveries, and each mutation's round trip at the socket.
 *
 * What it cannot see is the server's side: database I/O and function calls. Locally that is
 * `convex logs --jsonl --success`; in the cloud, the Convex dashboard's usage page.
 *
 *   node scripts/measure-latency.ts run http://localhost:3004 --rounds 8
 *   node scripts/measure-latency.ts run https://triquet.vercel.app --remote
 *   node scripts/measure-latency.ts summarize data/measurements/latency-*.json
 *
 * `run` prints a line per edit and a summary, and keeps the run as JSON (`--out`, by default
 * under `data/measurements/`). `summarize` pools any number of kept runs into one summary,
 * medians and p90s per kind of edit, for a table in the notes.
 *
 * A local measurement wants the agents' production build, not a dev server: `pnpm build:agent`,
 * then `pnpm start:agent` (3004, the agents' backend).
 *
 * Every run writes to the database it is pointed at: two `measure_*` idents and a hunt of about
 * thirty questions, which the app has no way to delete. Hence `--remote`, required for any host
 * but this machine's.
 *
 * The sample is `notes/example-quiz.json` (a whole workspace export, untracked), or `--sample`.
 * Its largest quiz is the one brought in; the phase 4 and cloud numbers used its 20 questions,
 * 11 widgets and 21 columns.
 */
import fs from 'node:fs'
import path from 'node:path'
import { parseArgs } from 'node:util'
import { chromium, type Browser, type BrowserContext, type Page } from '@playwright/test'
// What `UU.jsonify` wraps: Node cannot follow the app's extensionless imports to reach it.
import stringify from 'safe-stable-stringify'

/** Bytes, redeliveries and mutations seen at one browser's socket */
export interface Counts {
  down:         number
  up:           number
  queryUpdates: number
  mutations:    number
}

/** One timed edit, or one fresh tab */
export interface Timing {
  kind:       string
  authorMs:   number
  watcherMs?: number
  author:     Counts
  watcher?:   Counts
  nav?:       { ttfb: number, domContentLoaded: number, load: number }
}

/** A mutation's round trip at the socket, from sending it to its response, by the edit that sent it */
export interface RoundTrip {
  kind: string
  ms:   number
}

/** What `run` keeps: enough to summarize it again, alone or pooled with others */
export interface Run {
  baseUrl:   string
  quizUrl:   string
  rows:      number
  startedAt: string
  timings:   Timing[]
  trips:     RoundTrip[]
}

/** A state of the page to wait for, as data, since only data crosses into the page */
type Condition =
  | { kind: 'titlesDiffer', titles: string }
  | { kind: 'titlesAre', titles: string }
  | { kind: 'buttonShown', label: string }
  | { kind: 'rowsPast', count: number }
  | { kind: 'clueingIs', rowIdx: number, text: string }
  | { kind: 'savedAfterWriting' }
  | { kind: 'quizShown', count: number }

/** What `installClocks` leaves in each page */
interface Clocks {
  eventAt: Record<string, number>
  watch:   (condition: Condition) => Promise<number>
  titles:  () => string
  fresh:   Promise<number> | null
}

/** The page's global, as the clocks leave it */
type PageGlobal = typeof globalThis & { tq: Clocks }

const TitleSep = '\u{1}'
const SettleMs = 1500
/** localStorage key telling a page to time its own arrival at a quiz of this many rows */
const FreshKey = 'tq-measure-fresh-rows'

/** One line to stdout */
function say(line: string): void {
  process.stdout.write(`${line}\n`)
}

// == [Statistics] ==

/**
 * Middle value, the mean of the two middle ones for an even count
 *
 * @example median([3, 1, 2]) // => 2
 * @example median([4, 1, 3, 2]) // => 3, rounded from 2.5
 */
export function median(vals: readonly number[]): number {
  const sorted = vals.toSorted((aa, bb) => aa - bb)
  const mid = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 1) { return sorted[mid] ?? NaN }
  return Math.round(((sorted[mid - 1] ?? NaN) + (sorted[mid] ?? NaN)) / 2)
}

/**
 * Value at or just above fraction `frac` of the way up, nearest-rank
 *
 * @example quantile([10, 20, 30, 40, 50, 60, 70, 80, 90, 100], 0.9) // => 100
 */
export function quantile(vals: readonly number[], frac: number): number {
  const sorted = vals.toSorted((aa, bb) => aa - bb)
  return sorted[Math.min(sorted.length - 1, Math.floor(frac * sorted.length))] ?? NaN
}

/** Bytes per item, in KiB to a decimal place */
function kibEach(bytes: number, count: number): string {
  return `${(bytes / count / 1024).toFixed(1)} KiB`
}

/**
 * Summary of one or more runs, pooled: per kind of edit, the author's and watcher's median and
 * p90 waits and each browser's download; per edit overall, bytes and redeliveries; and the
 * mutations' round trips at the socket, per kind.
 *
 * @returns Lines to print.
 */
export function summaryOf(runs: readonly Run[]): string[] {
  const timings = runs.flatMap((run) => run.timings)
  const trips = runs.flatMap((run) => run.trips)
  const kinds = [...new Set(timings.map((timing) => timing.kind))]
  const targets = [...new Set(runs.map((run) => run.baseUrl))]
  const lines = [`${String(runs.length)} run(s): ${targets.join(', ')}`]

  for (const kind of kinds) {
    const mine = timings.filter((timing) => timing.kind === kind)
    const authorMs = mine.map((timing) => timing.authorMs)
    const watcherMs = mine.flatMap((timing) => (timing.watcherMs === undefined ? [] : [timing.watcherMs]))
    const authorDown = mine.reduce((sum, timing) => sum + timing.author.down, 0)
    const watcherDown = mine.reduce((sum, timing) => sum + (timing.watcher?.down ?? 0), 0)
    lines.push([
      `${kind.padEnd(13)} n=${String(mine.length).padStart(3)}`,
      `author med ${String(median(authorMs))} p90 ${String(quantile(authorMs, 0.9))}`,
      watcherMs.length > 0 ? `watcher med ${String(median(watcherMs))}` : '',
      `down/author ${kibEach(authorDown, mine.length)}`,
      watcherMs.length > 0 ? `down/watcher ${kibEach(watcherDown, mine.length)}` : '',
    ].filter(Boolean).join('  '))
  }

  const edits = timings.filter((timing) => timing.watcher !== undefined)
  if (edits.length > 0) {
    const total = (pick: (timing: Timing) => number) => edits.reduce((sum, timing) => sum + pick(timing), 0)
    lines.push(`per edit (${String(edits.length)} edits, ${String(total((timing) => timing.author.mutations))} mutations): `
      + `author ${kibEach(total((timing) => timing.author.down), edits.length)}, `
      + `watcher ${kibEach(total((timing) => timing.watcher?.down ?? 0), edits.length)}, `
      + `query redeliveries per browser ${(total((timing) => timing.author.queryUpdates) / edits.length).toFixed(1)}`)
  }

  const tripMs = trips.map((trip) => trip.ms)
  lines.push(`mutation round trip at the socket: med ${String(median(tripMs))} p90 ${String(quantile(tripMs, 0.9))} (n=${String(tripMs.length)})`)
  const tripKinds = [...new Set(trips.map((trip) => trip.kind))]
  for (const kind of tripKinds) {
    const ms = trips.filter((trip) => trip.kind === kind).map((trip) => trip.ms)
    lines.push(`   ${kind.padEnd(13)} med ${String(median(ms))} p90 ${String(quantile(ms, 0.9))} (n=${String(ms.length)})`)
  }
  return lines
}

// == [In the page] ==

/**
 * The clocks, installed in every page before its own scripts: the time of the last user event of
 * each kind, a watcher resolving to the moment a `Condition` first holds, and the grid's titles
 * top to bottom. A page opened while `FreshKey` is set also times its own arrival at the quiz.
 *
 * Playwright hands this function's source to the page, so it names nothing outside itself.
 */
function installClocks(freshKey: string): void {
  const eventAt: Record<string, number> = {}
  for (const eventkind of ['keydown', 'click', 'focusout']) {
    addEventListener(eventkind, () => { eventAt[eventkind] = performance.timeOrigin + performance.now() }, { capture: true })
  }
  // eslint-disable-next-line unicorn/consistent-function-scoping -- the page is handed this function's source alone, so nothing it uses can live outside it
  const titles = () => [...document.querySelectorAll<HTMLInputElement>('tbody [aria-label="Title"]')]
    .map((field) => field.value).join('\u{1}')

  const watch = async (condition: Condition) => await new Promise<number>((resolve) => {
    let wrote = false
    const holds = (): boolean => {
      switch (condition.kind) {
      case 'titlesDiffer': { return titles() !== condition.titles }
      case 'titlesAre': { return titles() === condition.titles }
      case 'buttonShown': { return [...document.querySelectorAll('button')].some((button) => button.textContent.trim() === condition.label) }
      case 'rowsPast': { return document.querySelectorAll('tbody tr').length > condition.count }
      case 'clueingIs': { return document.querySelectorAll<HTMLInputElement>('tbody [aria-label="Clueing"]')[condition.rowIdx]?.value === condition.text }
      case 'quizShown': {
        return document.querySelectorAll('tbody tr').length >= condition.count
            && Boolean(document.querySelector<HTMLInputElement>('tbody [aria-label="Title"]')?.value)
      }
      case 'savedAfterWriting': {
        const unsaved = document.querySelector('main')?.dataset.unsaved
        if (unsaved === 'true') { wrote = true }
        return wrote && unsaved === 'false'
      }
      }
    }
    let done = false
    const check = () => {
      if (done || ! holds()) { return }
      done = true
      observer.disconnect()
      resolve(performance.timeOrigin + performance.now())
    }
    // A DOM change is seen the moment it happens; a field's value, a property rather than an
    // attribute, only at the next frame.
    const observer = new MutationObserver(check)
    observer.observe(document, { subtree: true, childList: true, attributes: true, characterData: true })
    const tick = () => {
      if (done) { return }
      check()
      requestAnimationFrame(tick)
    }
    tick()
  })

  const freshRows = localStorage.getItem(freshKey)
  const clocks: Clocks = {
    eventAt, watch, titles,
    fresh: freshRows === null ? null : watch({ kind: 'quizShown', count: Number(freshRows) }),
  }
  // The page's global is the only place a later `evaluate` can find them.
  Object.assign(globalThis, { tq: clocks })
}

/** Start waiting in `page` for `condition`; resolves to the epoch ms at which it first held */
async function watchFor(page: Page, condition: Condition): Promise<number> {
  return await page.evaluate(async (wanted) => await (globalThis as PageGlobal).tq.watch(wanted), condition)
}

/** The grid's titles in `page`, top to bottom, joined by `TitleSep` */
async function titlesIn(page: Page): Promise<string> {
  return await page.evaluate(() => (globalThis as PageGlobal).tq.titles())
}

// == [At the socket] ==

/** Counts every websocket frame of one page, and times each mutation to its response */
class SocketTally {
  /** The edit under way, which each round trip is filed under */
  kind = 'setup'
  down = 0
  up = 0
  queryUpdates = 0
  mutations = 0
  readonly trips: RoundTrip[] = []
  private readonly sentAt = new Map<number, number>()

  constructor(page: Page) {
    page.on('websocket', (socket) => {
      socket.on('framereceived', ({ payload }) => { this.received(payload) })
      socket.on('framesent', ({ payload }) => { this.sent(payload) })
    })
  }

  /** The counts so far, to subtract from later ones */
  counts(): Counts {
    return { down: this.down, up: this.up, queryUpdates: this.queryUpdates, mutations: this.mutations }
  }

  /** The counts since `before` */
  since(before: Counts): Counts {
    return {
      down:         this.down - before.down,
      up:           this.up - before.up,
      queryUpdates: this.queryUpdates - before.queryUpdates,
      mutations:    this.mutations - before.mutations,
    }
  }

  private received(payload: string | Buffer): void {
    this.down += Buffer.byteLength(payload)
    const msg = messageOf(payload)
    if (msg?.type === 'Transition') {
      this.queryUpdates += (msg.modifications ?? []).filter((mod) => mod.type === 'QueryUpdated').length
    }
    if (msg?.type !== 'MutationResponse' || msg.requestId === undefined) { return }
    const sentAt = this.sentAt.get(msg.requestId)
    if (sentAt === undefined) { return }
    this.trips.push({ kind: this.kind, ms: Math.round(performance.now() - sentAt) })
    this.sentAt.delete(msg.requestId)
  }

  private sent(payload: string | Buffer): void {
    this.up += Buffer.byteLength(payload)
    const msg = messageOf(payload)
    if (msg?.type !== 'Mutation' || msg.requestId === undefined) { return }
    this.sentAt.set(msg.requestId, performance.now())
    this.mutations += 1
  }
}

/** The fields of a Convex websocket message this script reads */
interface ConvexMessage {
  type?:          string
  requestId?:     number
  modifications?: { type: string }[]
}

/** A frame read as a Convex message, or null for one that is not JSON */
function messageOf(payload: string | Buffer): ConvexMessage | null {
  try {
    return JSON.parse(payload.toString()) as ConvexMessage
  } catch {
    return null
  }
}

// == [The run] ==

/** The part of the sample's quiz this script reads */
interface SampleQuiz {
  title:     string
  questions: unknown[]
}

/** The two browsers of a run, each with its page and its socket's tally, and the timings so far */
interface Stage {
  baseUrl:      string
  authorCtx:    BrowserContext
  author:       Page
  watcher:      Page
  authorTally:  SocketTally
  watcherTally: SocketTally
  timings:      Timing[]
}

async function settle(ms: number): Promise<void> {
  await new Promise((resolve) => { setTimeout(resolve, ms) })
}

/** Say who this browser is at the front door, and wait to be sent on to the hunts */
async function assumeIdent(page: Page, baseUrl: string, label: string): Promise<void> {
  await page.goto(`${baseUrl}/`)
  await page.getByLabel('Ident label').fill(label)
  await page.getByRole('button', { name: 'Continue' }).click()
  await page.waitForURL(/\/my\/hunts$/, { timeout: 30_000 })
}

/** A browser context with the clocks installed, and a page open in it */
async function openBrowser(browser: Browser): Promise<[BrowserContext, Page]> {
  const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } })
  await context.addInitScript(installClocks, FreshKey)
  return [context, await context.newPage()]
}

/**
 * The author's hunt, with the sample's largest quiz brought in, and the watcher on the same quiz.
 *
 * @returns The quiz's address.
 */
async function setUp(stage: Stage, sampleText: string, largest: SampleQuiz, stamp: string): Promise<string> {
  const { author, watcher, baseUrl } = stage
  await assumeIdent(author, baseUrl, `measure_author_${stamp}`)
  await author.getByRole('button', { name: '+ New hunt' }).click()
  await author.waitForURL(/\/h\/[a-z0-9_]+\/home\/[a-z0-9_]+\?act=smith$/, { timeout: 30_000 })
  await author.getByRole('table').waitFor()
  // The Import box takes the quiz of a workspace whose name matches the open one's, so the name
  // has to have landed before the import is run.
  await author.getByLabel('Quiz name').fill(largest.title)
  await author.getByLabel('Quiz name').blur()
  await author.locator('main[data-unsaved="false"]').waitFor({ state: 'attached' })
  await settle(SettleMs)
  await author.getByRole('textbox', { name: 'Import' }).fill(sampleText)
  await author.getByRole('button', { name: 'Import', exact: true }).click()
  say(await author.getByText(/Read as/).first().textContent() ?? 'The Import box said nothing')
  // Each question is a query of its own, so the rows arrive a moment after the import has landed.
  await author.waitForFunction((count) => document.querySelectorAll('tbody tr').length >= count, largest.questions.length, { timeout: 30_000 })
  await settle(2 * SettleMs)

  const quizUrl = author.url()
  await assumeIdent(watcher, baseUrl, `measure_watcher_${stamp}`)
  await watcher.goto(quizUrl)
  await watcher.getByRole('table').waitFor()
  await settle(2 * SettleMs)
  return quizUrl
}

/**
 * Time one edit: start both watchers, act, and record each browser's wait from the author's
 * last event of `eventkind`, and what each socket carried until things settled.
 *
 * @param conditions - What the author's page, then the watcher's, waits for.
 */
async function timed(stage: Stage, kind: string, eventkind: string, conditions: [Condition, Condition], act: () => Promise<void>): Promise<void> {
  const { author, watcher, authorTally, watcherTally } = stage
  authorTally.kind = kind
  const authorBefore = authorTally.counts()
  const watcherBefore = watcherTally.counts()
  const authorDone = watchFor(author, conditions[0])
  const watcherDone = watchFor(watcher, conditions[1])
  await act()
  const [authorAt, watcherAt] = await Promise.all([authorDone, watcherDone])
  const eventAt = await author.evaluate((key) => (globalThis as PageGlobal).tq.eventAt[key] ?? NaN, eventkind)
  await settle(SettleMs)
  const timing: Timing = {
    kind,
    authorMs:  Math.round(authorAt - eventAt),
    watcherMs: Math.round(watcherAt - eventAt),
    author:    authorTally.since(authorBefore),
    watcher:   watcherTally.since(watcherBefore),
  }
  stage.timings.push(timing)
  authorTally.kind = 'untimed'
  say(stringify(timing))
}

/** One round of the six kinds of edit */
async function editRound(stage: Stage, round: number): Promise<void> {
  const { author } = stage
  const rows = await author.locator('tbody tr').count()
  const grip = (rowIdx: number) => author.locator('tbody tr').nth(rowIdx).getByRole('button', { name: /^Reorder / })

  const reorderAt = (round * 3) % (rows - 1)
  const beforeReorder: Condition = { kind: 'titlesDiffer', titles: await titlesIn(author) }
  await grip(reorderAt).focus()
  await timed(stage, 'reorder', 'keydown', [beforeReorder, beforeReorder], async () => {
    await author.keyboard.press('ArrowDown')
  })

  // Four presses, timed from the last of them until the fourth move is on screen.
  const pressesAt = (round * 5) % (rows - 5)
  const joined = await titlesIn(author)
  const titles = joined.split(TitleSep)
  const moved: Condition = {
    kind:   'titlesAre',
    titles: titles.toSpliced(pressesAt, 1).toSpliced(pressesAt + 4, 0, titles[pressesAt] ?? '').join(TitleSep),
  }
  await grip(pressesAt).focus()
  await timed(stage, 'four presses', 'keydown', [moved, moved], async () => {
    for (let ii = 0; ii < 4; ii += 1) { await author.keyboard.press('ArrowDown') }
  })

  for (const [from, to] of [['Lock quiz', 'Unlock quiz'], ['Unlock quiz', 'Lock quiz']] as const) {
    const flipped: Condition = { kind: 'buttonShown', label: to }
    await timed(stage, 'lock', 'click', [flipped, flipped], async () => {
      await author.getByRole('button', { name: from, exact: true }).click()
    })
  }

  const added: Condition = { kind: 'rowsPast', count: rows }
  await timed(stage, 'add', 'click', [added, added], async () => {
    await author.getByRole('button', { name: '+ Add question' }).click()
  })

  // The author's text is on screen as they type it; what they wait for is its saving.
  const textAt = round % rows
  const text = `Measured clueing, round ${String(round)}, ${String(Date.now())}`
  await author.locator('tbody').getByRole('textbox', { name: 'Clueing', exact: true }).nth(textAt).fill(text)
  await timed(stage, 'text commit', 'focusout', [{ kind: 'savedAfterWriting' }, { kind: 'clueingIs', rowIdx: textAt, text }], async () => {
    await author.getByLabel('Quiz name').click()
  })

  const beforeSort: Condition = { kind: 'titlesDiffer', titles: await titlesIn(author) }
  await timed(stage, 'sort', 'click', [beforeSort, beforeSort], async () => {
    await author.getByRole('button', { name: 'Title', exact: true }).click()
  })
  // Back to Q# order, untimed: a quiz sorted by anything else hides its grips.
  await author.getByRole('button', { name: 'Q#', exact: true }).click()
  await grip(0).waitFor()
  await settle(SettleMs)
}

/**
 * Five fresh tabs beside the author's, sharing its browser key and its cache, each timed from its
 * navigation until every row and the first title are on screen.
 */
async function freshTabs(stage: Stage, quizUrl: string): Promise<void> {
  const rows = await stage.author.locator('tbody tr').count()
  await stage.author.evaluate(({ key, count }) => { localStorage.setItem(key, count) }, { key: FreshKey, count: String(rows) })
  for (let ii = 0; ii < 5; ii += 1) {
    const page = await stage.authorCtx.newPage()
    const tally = new SocketTally(page)
    await page.goto(quizUrl)
    const shownAt = await page.evaluate(async () => {
      const { fresh } = (globalThis as PageGlobal).tq
      return fresh ? (await fresh) - performance.timeOrigin : NaN
    })
    const nav = await page.evaluate(() => {
      const [entry] = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[]
      return {
        ttfb:             Math.round(entry?.responseStart ?? 0),
        domContentLoaded: Math.round(entry?.domContentLoadedEventEnd ?? 0),
        load:             Math.round(entry?.loadEventEnd ?? 0),
      }
    })
    await settle(SettleMs)
    const timing: Timing = { kind: 'fresh tab', authorMs: Math.round(shownAt), nav, author: tally.counts() }
    stage.timings.push(timing)
    say(stringify(timing))
    await page.close()
  }
  await stage.author.evaluate((key) => { localStorage.removeItem(key) }, FreshKey)
}

/** The whole run against `baseUrl`, kept as JSON at `outfile` */
async function run(baseUrl: string, rounds: number, samplePath: string, outfile: string): Promise<void> {
  const sampleText = fs.readFileSync(samplePath, 'utf8')
  const sample = JSON.parse(sampleText) as { quizzes?: Partial<SampleQuiz>[] }
  const [largest] = (sample.quizzes ?? []).toSorted((aa, bb) => (bb.questions?.length ?? 0) - (aa.questions?.length ?? 0))
  if (! largest?.title || ! largest.questions) { throw new Error(`${samplePath} is not a workspace export with a titled quiz`) }

  const startedAt = new Date().toISOString()
  const stamp = startedAt.replaceAll(/[-:T]/g, '').slice(0, 12)
  const browser = await chromium.launch()
  try {
    const [authorCtx, author] = await openBrowser(browser)
    const [, watcher] = await openBrowser(browser)
    const stage: Stage = {
      baseUrl, authorCtx, author, watcher, timings: [],
      authorTally: new SocketTally(author), watcherTally: new SocketTally(watcher),
    }
    const quizUrl = await setUp(stage, sampleText, { title: largest.title, questions: largest.questions }, stamp)
    say(`quiz at ${quizUrl}, ${String(await author.locator('tbody tr').count())} rows`)
    for (let round = 0; round < rounds; round += 1) {
      await editRound(stage, round)
    }
    await freshTabs(stage, quizUrl)

    const kept: Run = {
      baseUrl, quizUrl, startedAt,
      rows:    await author.locator('tbody tr').count(),
      timings: stage.timings,
      trips:   stage.authorTally.trips,
    }
    fs.mkdirSync(path.dirname(outfile), { recursive: true })
    fs.writeFileSync(outfile, `${stringify(kept, null, 2)}\n`)
    say(`\nkept at ${outfile}\n${summaryOf([kept]).join('\n')}`)
  } finally {
    await browser.close()
  }
}

// == [Entrypoint] ==

const Usage = `Usage:
  node scripts/measure-latency.ts run <baseURL> [--rounds 8] [--sample notes/example-quiz.json] [--out <file.json>] [--remote]
  node scripts/measure-latency.ts summarize <run.json>...`

/** The command line, checked, and carried out */
async function main(argv: readonly string[]): Promise<void> {
  const { positionals, values: opts } = parseArgs({
    args:             [...argv],
    allowPositionals: true,
    options:          {
      rounds: { type: 'string', default: '8' },
      sample: { type: 'string', default: 'notes/example-quiz.json' },
      out:    { type: 'string' },
      remote: { type: 'boolean', default: false },
    },
  })
  const [command, ...rest] = positionals

  if (command === 'summarize' && rest.length > 0) {
    const runs = rest.map((file) => JSON.parse(fs.readFileSync(file, 'utf8')) as Run)
    say(summaryOf(runs).join('\n'))
    return
  }
  if (command !== 'run' || rest.length !== 1) { throw new Error(Usage) }

  const target = new URL(rest[0] ?? '')
  const rounds = Number(opts.rounds)
  if (! Number.isSafeInteger(rounds) || rounds < 1) { throw new Error(`--rounds must be a whole number of at least 1\n${Usage}`) }
  if (! ['localhost', '127.0.0.1'].includes(target.hostname) && ! opts.remote) {
    throw new Error(`${target.host} is not this machine, and a run leaves a hunt and two idents there that the app cannot delete. Say --remote to go ahead.`)
  }
  if (! fs.existsSync(opts.sample)) { throw new Error(`No sample at ${opts.sample}; name one with --sample.\n${Usage}`) }

  const when = new Date().toISOString().replaceAll(/[-:]/g, '').slice(0, 13)
  const outfile = opts.out ?? path.join('data', 'measurements', `latency-${target.hostname}-${when}.json`)
  await run(target.origin, rounds, opts.sample, outfile)
}

if (import.meta.main) {
  try {
    await main(process.argv.slice(2))
  } catch (err) {
    console.error(err instanceof Error ? err.message : err)
    process.exitCode = 1
  }
}
