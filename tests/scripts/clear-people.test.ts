import { describe, expect, it } from 'vitest'
import * as ClearPeople from '../../scripts/clear-people'
import { JanitorStop, type ReachedT } from '../../scripts/janitor'

const Local: ReachedT = { deployment: '127.0.0.1:3431', url: 'http://127.0.0.1:3431' }
const reach = () => Local

/** Where a line goes that no test reads */
const unheard = (_line: string) => null

/** The order the deployment counts its tables in */
const Tablenames = ['reviews', 'idents', 'users'] as const

/**
 * A deployment's people, as `clear_people`'s two functions answer for them: `count` a page of
 * `pageSize` rows of one table a run, `clearBatch` up to `batchSize` rows a run, children first,
 * answering every table alphabetically as Convex does. `arriving` rows of users join after each
 * clear, as visitors would.
 */
function fakeDeployment(rows: Record<typeof Tablenames[number], number>, { pageSize = 2, batchSize = 3, arriving = [] as number[] } = {}) {
  const held = { ...rows }
  const calls: string[] = []
  const run: ClearPeople.RunT = (fnpath, args) => {
    calls.push(fnpath)
    if (fnpath === 'clear_people:count') {
      const at = args.at as { tablename: typeof Tablenames[number], cursor: string | null } | null
      const tablename = at?.tablename ?? Tablenames[0]
      const from = Number(at?.cursor ?? 0)
      const counted = Math.min(pageSize, held[tablename] - from)
      const following = Tablenames[Tablenames.indexOf(tablename) + 1]
      const isDone = from + counted >= held[tablename]
      const onward = following ? { tablename: following, cursor: null } : null
      const next = isDone ? onward : { tablename, cursor: String(from + counted) }
      return { tablename, counted, next }
    }
    let left = batchSize
    const deleted = Object.fromEntries(Tablenames.map((tablename) => {
      const gone = Math.min(left, held[tablename])
      held[tablename] -= gone
      left -= gone
      return [tablename, gone]
    }))
    held.users += arriving.shift() ?? 0
    return Object.fromEntries(Object.entries(deleted).toSorted(([one], [two]) => one.localeCompare(two)))
  }
  return { run, held, calls }
}

/** What the command says, line by line, and whether it reported every row gone */
function said(argv: string[], run: ClearPeople.RunT): { ok: boolean, lines: string[] } {
  const lines: string[] = []
  const ok = ClearPeople.clearPeople(argv, run, (line) => { lines.push(line) }, reach)
  return { ok, lines }
}

describe('countsOf', () => {
  it("adds up each table's pages, in the order the deployment counts them", () => {
    const { run } = fakeDeployment({ reviews: 5, idents: 0, users: 2 })
    const counts = ClearPeople.countsOf(run)
    expect(counts).to.deep.eq({ reviews: 5, idents: 0, users: 2 })
    expect(Object.keys(counts)).to.deep.eq(['reviews', 'idents', 'users'])
  })
})

describe('totalOf', () => {
  it("adds every table's rows", () => {
    expect(ClearPeople.totalOf({ users: 3, idents: 2 })).to.eq(5)
  })
  it("is none for none", () => {
    expect(ClearPeople.totalOf({})).to.eq(0)
  })
})

describe('linesOf', () => {
  it("aligns each table and its count, and ends with the total", () => {
    expect(ClearPeople.linesOf({ users: 3, idents: 2 })).to.deep.eq(['  users   3', '  idents  2', '  in all  5'])
  })
  it("aligns counts of different widths to the right", () => {
    expect(ClearPeople.linesOf({ authRefreshTokens: 51, users: 6 })).to.deep.eq(['  authRefreshTokens  51', '  users               6', '  in all             57'])
  })
})

describe('clearedWith', () => {
  it("runs until a run deletes nothing, saying each run's deletions in the order given", () => {
    const { run, held } = fakeDeployment({ reviews: 2, idents: 1, users: 2 })
    const lines: string[] = []
    const deleted = ClearPeople.clearedWith(run, (line) => { lines.push(line) }, Tablenames)
    expect(deleted).to.deep.eq({ reviews: 2, idents: 1, users: 2 })
    expect(held).to.deep.eq({ reviews: 0, idents: 0, users: 0 })
    expect(lines).to.deep.eq([
      'Run 1: deleted 3 (reviews 2, idents 1).',
      'Run 2: deleted 2 (users 2).',
      'Run 3: deleted nothing.',
    ])
  })
  it("deletes nothing, in one run, from a deployment with nobody", () => {
    const { run, calls } = fakeDeployment({ reviews: 0, idents: 0, users: 0 })
    expect(ClearPeople.clearedWith(run, unheard, Tablenames)).to.deep.eq({})
    expect(calls).to.deep.eq(['clear_people:clearBatch'])
  })
  it("gives up when people keep arriving as fast as they go", () => {
    const { run } = fakeDeployment({ reviews: 0, idents: 0, users: 1 }, { arriving: Array.from({ length: ClearPeople.RunsMax }, () => 1) })
    expect(() => ClearPeople.clearedWith(run, unheard, Tablenames)).to.throw(JanitorStop, /Still deleting/)
  })
})

describe('clearPeople', () => {
  it("counts and changes nothing without --deployment, ending by naming the deployment to act on", () => {
    const { run, held, calls } = fakeDeployment({ reviews: 2, idents: 1, users: 2 })
    const { ok, lines } = said([], run)
    expect(ok).to.be.true
    expect(held).to.deep.eq({ reviews: 2, idents: 1, users: 2 })
    expect(calls).not.to.include('clear_people:clearBatch')
    expect(lines).to.deep.eq([
      'Aimed at 127.0.0.1:3431 (http://127.0.0.1:3431): a dry run, which changes nothing.',
      'The people\'s rows:',
      '  reviews  2',
      '  idents   1',
      '  users    2',
      '  in all   5',
      'A dry run: nothing was changed. To act on 127.0.0.1:3431, run again with --deployment 127.0.0.1:3431.',
    ])
  })

  it("deletes every row with --deployment naming the deployment reached, and says what it deleted", () => {
    const { run, held } = fakeDeployment({ reviews: 2, idents: 1, users: 2 })
    const { ok, lines } = said(['--deployment', '127.0.0.1:3431'], run)
    expect(ok).to.be.true
    expect(held).to.deep.eq({ reviews: 0, idents: 0, users: 0 })
    expect(lines.slice(6)).to.deep.eq([
      'Run 1: deleted 3 (reviews 2, idents 1).',
      'Run 2: deleted 2 (users 2).',
      'Run 3: deleted nothing.',
      'Deleted, over every run:',
      '  reviews  2',
      '  idents   1',
      '  users    2',
      '  in all   5',
      '127.0.0.1:3431 holds none of the people\'s rows now.',
    ])
  })

  it("deletes nothing on a second run", () => {
    const { run } = fakeDeployment({ reviews: 2, idents: 1, users: 2 })
    said(['--deployment', '127.0.0.1:3431'], run)
    const { ok, lines } = said(['--deployment', '127.0.0.1:3431'], run)
    expect(ok).to.be.true
    expect(lines).to.include('Run 1: deleted nothing.')
    expect(lines).to.include('  in all   0')
  })

  it("stops before counting or deleting anything when --deployment names another deployment", () => {
    const { run, held, calls } = fakeDeployment({ reviews: 2, idents: 1, users: 2 })
    expect(() => said(['--deployment', 'careful-otter-123'], run)).to.throw(JanitorStop, /names careful-otter-123, but this environment reaches 127.0.0.1:3431/)
    expect(calls).to.deep.eq([])
    expect(held).to.deep.eq({ reviews: 2, idents: 1, users: 2 })
  })

  it("stops at a flag it does not know, before doing anything", () => {
    const { run, calls } = fakeDeployment({ reviews: 2, idents: 1, users: 2 })
    expect(() => said(['--everything'], run)).to.throw(JanitorStop, /what is --everything/)
    expect(calls).to.deep.eq([])
  })

  it("says what is left, and fails, when a visitor arrives after the last batch", () => {
    const { run } = fakeDeployment({ reviews: 0, idents: 0, users: 1 }, { arriving: [0, 1] })
    const { ok, lines } = said(['--deployment', '127.0.0.1:3431'], run)
    expect(ok).to.be.false
    expect(lines).to.include('127.0.0.1:3431 still holds 1 of the people\'s rows, written while this ran:')
    expect(lines.at(-1)).to.eq('Run it again: the clear deletes only what it finds.')
  })
})
