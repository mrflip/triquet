import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import * as SessionBranches from '../../scripts/session-branches'

/** A transcript line, as Claude Code writes them: JSON, one a line */
const lineOf = (fields: Record<string, unknown>): string => JSON.stringify(fields)

const Aught = new Date('2026-10-01T00:00:00.000Z')

const termsOf = (...args: string[]) => args.map((arg) => SessionBranches.termOf(arg))

/** What a session's lines come to: a main transcript, and the transcripts of any workers */
const factsFrom = (main: string[], terms: SessionBranches.Term[], workers: string[][] = []) => (
  SessionBranches.factsOf(
    'abc123',
    [{ lines: main, isMain: true }, ...workers.map((lines) => ({ lines, isMain: false }))],
    terms,
    Aught,
  )
)

describe('termOf', () => {
  const TermCases: [string, string | null, number | null, string][] = [
    // regular usage:
    ['userlabel',            'userlabel', null, 'a bare label is a branch'],
    ['20261005-userlabel',   'userlabel', null, 'a branch name loses its datestamp, so either spelling finds the same sessions'],
    ['116',                  null,        116,  'digits are a PR number'],
    ['#116',                 null,        116,  'a PR number may keep its #'],
    // trivial cases:
    ['  userlabel ',         'userlabel', null, 'surrounding space is ignored'],
    // weird cases:
    ['20261005',             null,        20_261_005, 'a bare datestamp is all digits, so it is a (large) PR number, not a branch'],
    ['e2e_practices',        'e2e_practices', null, 'digits and underscores belong to a label'],
  ]
  for (const [arg, label, pr, blurb] of TermCases) {
    it(blurb, () => {
      const term = SessionBranches.termOf(arg)
      expect(term.label).to.equal(label)
      expect(term.pr).to.equal(pr)
    })
  }

  const RefusedCases: [string, string][] = [
    ['',            'an empty argument'],
    ['Bad Label',   'capitals and spaces'],
    ['foo-bar',     'a hyphen, which is no label (a datestamp is the only one a branch may have)'],
    ['9lives',      'a label that starts with a digit'],
  ]
  for (const [arg, blurb] of RefusedCases) {
    it(`refuses ${blurb}`, () => {
      expect(() => SessionBranches.termOf(arg)).to.throw(/neither a branch label/)
    })
  }

  const PatternCases: [string, string, boolean, string][] = [
    // a branch's label finds the branch under either name:
    ['userlabel', 'Branch: 20261005-userlabel.',        true,  'the dated branch name'],
    ['userlabel', 'pnpm worktree userlabel',            true,  'the bare label'],
    ['userlabel', 'git switch userlabel_two',           false, 'a longer label that starts with it'],
    ['userlabel', 'git switch my-userlabel',            false, 'a hyphenated name that ends with it'],
    ['userlabel', 'git switch pre_userlabel',           false, 'a label that ends with it'],
    // a PR number finds a PR and not any digits:
    ['116',       'https://github.com/mrflip/triquet/pull/116', true,  'a pull request URL'],
    ['116',       'PR #116 landed',                     true,  'a # reference'],
    ['116',       'the PR 116',                         true,  'the words PR and a number'],
    ['116',       'opened #1160',                       false, 'a longer number that starts with it'],
    ['116',       'port 3116, 116 seconds',             false, 'the digits with no PR marker'],
  ]
  for (const [arg, text, found, blurb] of PatternCases) {
    it(`${found ? 'finds' : 'ignores'} ${arg} in ${blurb}`, () => {
      expect(SessionBranches.termOf(arg).pattern.test(text)).to.equal(found)
    })
  }
})

describe('factsOf', () => {
  it('titles a session by what /rename set, over what Claude titled it, and over the first', () => {
    const facts = factsFrom([
      lineOf({ type: 'ai-title', aiTitle: 'Form validation styling' }),
      lineOf({ type: 'custom-title', customTitle: '20261005-userlabel' }),
      lineOf({ type: 'ai-title', aiTitle: 'Form validation, again' }),
    ], [])
    expect(facts.title).to.equal('20261005-userlabel')
  })

  it("titles a session by the last of Claude's titles when it was never renamed", () => {
    const facts = factsFrom([
      lineOf({ type: 'ai-title', aiTitle: 'First guess' }),
      lineOf({ type: 'ai-title', aiTitle: 'Better guess' }),
    ], [])
    expect(facts.title).to.equal('Better guess')
  })

  it('calls a session with no title untitled, and takes no title from a worker', () => {
    const facts = factsFrom([lineOf({ type: 'user' })], [], [[lineOf({ type: 'ai-title', aiTitle: 'A worker\'s' })]])
    expect(facts.title).to.equal('(untitled)')
  })

  it('says when a session was last active by its latest line, and by its file when no line says', () => {
    const lines = [
      lineOf({ type: 'user', timestamp: '2026-10-05T10:00:00.000Z' }),
      lineOf({ type: 'user', timestamp: '2026-10-06T08:30:00.000Z' }),
      lineOf({ type: 'user', timestamp: '2026-10-05T23:00:00.000Z' }),
    ]
    expect(factsFrom(lines, []).lastActive).to.equal('2026-10-06T08:30:00.000Z')
    expect(factsFrom([lineOf({ type: 'user' })], []).lastActive).to.equal(Aught.toISOString())
  })

  it("finds a session whose title names the term, whether it was renamed for it or Claude happened to", () => {
    const renamed = factsFrom([lineOf({ type: 'custom-title', customTitle: '20261005-userlabel' })], termsOf('userlabel', '116', 'other'))
    expect(renamed.evidence.map((each) => each.titled)).to.deep.equal([true, false, false])
    const numbered = factsFrom([lineOf({ type: 'custom-title', customTitle: 'Landing #116 by hand' })], termsOf('116'))
    expect(numbered.evidence.map((each) => each.titled)).to.deep.equal([true])
  })

  it('lists the PRs a session linked, once each and in order', () => {
    const facts = factsFrom([
      lineOf({ type: 'pr-link', prNumber: 116 }),
      lineOf({ type: 'pr-link', prNumber: 99 }),
      lineOf({ type: 'pr-link', prNumber: 116 }),
    ], [])
    expect(facts.prs).to.deep.equal([99, 116])
  })

  it('lists the worktrees a session cut or entered, whether by command or by path', () => {
    const facts = factsFrom([
      lineOf({ type: 'user', message: 'pnpm worktree session_branches' }),
      lineOf({ type: 'user', message: 'cd /home/node/worktrees/triquet/landing_flow && git status' }),
      lineOf({ type: 'user', message: 'cd /workspace/triquet/.claude/worktrees/little_fixes && ls' }),
      lineOf({ type: 'user', message: 'pnpm worktree --remove' }),
      lineOf({ type: 'user', message: 'ls /home/node/worktrees/triquet' }),
    ], [])
    expect(facts.worktrees).to.deep.equal(['landing_flow', 'little_fixes', 'session_branches'])
  })

  it('lists worktrees and PRs in the order the session first met them, each once', () => {
    const facts = factsFrom([
      lineOf({ type: 'user', message: 'pnpm worktree userlabel' }),
      lineOf({ type: 'pr-link', prNumber: 116 }),
      lineOf({ type: 'user', message: 'cd /home/node/worktrees/triquet/landing_flow && git status' }),
      lineOf({ type: 'user', message: 'back in worktrees/triquet/userlabel' }),
      lineOf({ type: 'pr-link', prNumber: 99 }),
      lineOf({ type: 'pr-link', prNumber: 116 }),
    ], [], [[lineOf({ type: 'user', message: 'pnpm worktree workers_own' })]])
    expect(facts.seen).to.deep.equal(['userlabel', '#116', 'landing_flow', '#99', 'workers_own'])
  })

  it('finds each kind of evidence for a term, kept apart for each term asked', () => {
    const facts = factsFrom([
      lineOf({ type: 'pr-link', prNumber: 116, prUrl: 'https://github.com/mrflip/triquet/pull/116' }),
      lineOf({ type: 'user', gitBranch: '20261005-userlabel', message: 'pnpm worktree userlabel' }),
      lineOf({ type: 'user', gitBranch: '20261005-userlabel' }),
      lineOf({ type: 'user', gitBranch: 'main', message: 'is 20261005-deploy_migrations done?' }),
    ], termsOf('116', 'userlabel', 'deploy_migrations', 'elsewhere'))
    expect(facts.evidence).to.deep.equal([
      { term: '#116',              titled: false, linked: true,  worktree: false, checkout: 0, mentions: 1 },
      { term: 'userlabel',         titled: false, linked: false, worktree: true,  checkout: 2, mentions: 2 },
      { term: 'deploy_migrations', titled: false, linked: false, worktree: false, checkout: 0, mentions: 1 },
      { term: 'elsewhere',         titled: false, linked: false, worktree: false, checkout: 0, mentions: 0 },
    ])
  })

  it("counts a worker's mentions and worktrees with the session's, and its lines are the session's", () => {
    const facts = factsFrom(
      [lineOf({ type: 'user', message: 'start thread 7' })],
      termsOf('userlabel'),
      [[lineOf({ type: 'user', message: 'Worktree: /home/node/worktrees/triquet/userlabel. Branch: 20261005-userlabel' })]],
    )
    expect(facts.evidence[0]).to.deep.equal({ term: 'userlabel', titled: false, linked: false, worktree: true, checkout: 0, mentions: 1 })
  })

  it('reads on past a line that is not JSON, or has fields of the wrong kind', () => {
    const facts = factsFrom([
      '{"type":"pr-link","prNumber":"not a number"',
      lineOf({ type: 'pr-link', prNumber: 'not a number' }),
      lineOf({ type: 7, timestamp: 12, gitBranch: ['userlabel'], aiTitle: null }),
      '',
      lineOf({ type: 'ai-title', aiTitle: 'Still read' }),
    ], termsOf('userlabel'))
    expect(facts.title).to.equal('Still read')
    expect(facts.prs).to.deep.equal([])
    expect(facts.evidence[0]?.checkout).to.equal(0)
  })
})

describe('renameOf', () => {
  const RenameCases: [string[], string, string | null, string][] = [
    // regular usage:
    [['e2e_practices', '#93', 'git_attic', '#97', 'landing_flow', 'session_branches', '#149'], 'PR merge and deploy order',
      '/rename #93 #97 #149  e2e_practices git_attic landing_flow session_branches | PR merge and deploy order', 'the PRs first, then the worktrees, each in the order met, then the title'],
    [['userlabel', '#116'], 'Form validation styling', '/rename #116  userlabel | Form validation styling', 'a PR comes before its branch'],
    // the title has been through this before:
    [['userlabel', '#116'], 'userlabel | Form validation styling', '/rename #116  userlabel | Form validation styling', 'what follows an earlier pipe is the title, so renaming twice does not stack'],
    [['userlabel', '#116'], 'a | b | c', '/rename #116  userlabel | b | c', 'only the first pipe divides: what follows it is kept whole'],
    [['userlabel'], 'bare|pipe and a | b', '/rename userlabel | b', 'a pipe with no spaces round it is not the separator'],
    // trivial cases:
    [['#116'], 'Form validation styling', '/rename #116 | Form validation styling', 'a PR alone'],
    [['userlabel'], 'Form validation styling', '/rename userlabel | Form validation styling', 'a worktree alone, no extra space before the pipe'],
    [['userlabel', '#116'], '(untitled)', '/rename #116  userlabel', 'a session with no title is named for its work alone'],
    [[], 'Form validation styling', null, 'a session that touched no worktree or PR has nothing to be named for'],
    // weird cases:
    [['#1', '#2'], 'T', '/rename #1 #2 | T', 'PRs with no worktree are one group, set apart from nothing'],
    [['userlabel'], 'PR merge (and deploy)', '/rename userlabel | PR merge (and deploy)', 'parentheses in a title are its own: nothing is wrapped round it'],
  ]
  for (const [seen, title, expected, blurb] of RenameCases) {
    it(`names ${blurb}`, () => {
      expect(SessionBranches.renameOf({ seen, title })).to.equal(expected)
    })
  }

  it('cuts a name longer than the limit short, ending in an ellipsis, and leaves one at the limit alone', () => {
    const atLimit = SessionBranches.renameOf({ seen: ['userlabel'], title: 'x'.repeat(SessionBranches.MaxNameLength - ' | '.length - 'userlabel'.length) })
    expect(atLimit?.slice('/rename '.length)).to.have.lengthOf(SessionBranches.MaxNameLength)
    expect(atLimit?.endsWith('x')).to.be.true
    const over = SessionBranches.renameOf({ seen: ['userlabel'], title: 'x'.repeat(SessionBranches.MaxNameLength) })
    expect(over?.slice('/rename '.length)).to.have.lengthOf(SessionBranches.MaxNameLength)
    expect(over?.endsWith('x…')).to.be.true
  })

  it('puts no date or time in a name, though the session has them', () => {
    const facts = factsFrom([lineOf({ type: 'pr-link', prNumber: 116, timestamp: '2026-10-06T05:00:00.000Z' })], [])
    expect(SessionBranches.renameOf(facts)).to.equal('/rename #116')
  })
})

describe('describeEvidence', () => {
  const DescribeCases: [Omit<SessionBranches.Evidence, 'term'>, string, string][] = [
    [{ titled: true,  linked: true,  worktree: true,  checkout: 164, mentions: 203 }, 'titled, PR linked, worktree, checkout 164x, mentioned 203x', 'every kind'],
    [{ titled: false, linked: false, worktree: false, checkout: 0,   mentions: 3 },   'mentioned 3x',                                                  'mentions alone'],
    [{ titled: false, linked: false, worktree: false, checkout: 0,   mentions: 0 },   '',                                                              'nothing'],
  ]
  for (const [evidence, said, blurb] of DescribeCases) {
    it(`words ${blurb}`, () => {
      expect(SessionBranches.describeEvidence({ term: 'x', ...evidence })).to.equal(said)
    })
  }
})

describe('tableOf', () => {
  it('aligns columns two spaces apart, under a header', () => {
    expect(SessionBranches.tableOf([{ id: 'a1', title: 'Hi' }, { id: 'b22', title: 'There' }])).to.equal('id   title\na1   Hi\nb22  There')
  })
  it('drops the trailing space of a short last cell', () => {
    expect(SessionBranches.tableOf([{ id: 'a1', note: '' }])).to.equal('id  note\na1')
  })
  it('is empty with no rows', () => {
    expect(SessionBranches.tableOf([])).to.equal('')
  })
})

describe('defaultProjectsDir', () => {
  it('follows CLAUDE_CONFIG_DIR when it is set', () => {
    expect(SessionBranches.defaultProjectsDir({ CLAUDE_CONFIG_DIR: '/etc/claude' })).to.equal('/etc/claude/projects')
  })
  it('is ~/.claude/projects otherwise', () => {
    expect(SessionBranches.defaultProjectsDir({})).to.equal(path.join(os.homedir(), '.claude', 'projects'))
  })
})

describe('sessionsIn', () => {
  let projectsdir: string
  beforeEach(() => {
    projectsdir = fs.mkdtempSync(path.join(os.tmpdir(), 'session-branches-test-'))
  })
  afterEach(() => {
    fs.rmSync(projectsdir, { recursive: true, force: true })
  })

  /** Writes a session's transcript under a project directory, and its workers' */
  const writeSession = (project: string, id: string, lines: string[], workers: string[][] = []) => {
    const projectdir = path.join(projectsdir, project)
    fs.mkdirSync(path.join(projectdir, id, 'subagents'), { recursive: true })
    fs.writeFileSync(path.join(projectdir, `${id}.jsonl`), `${lines.join('\n')}\n`)
    for (const [idx, workerlines] of workers.entries()) {
      fs.writeFileSync(path.join(projectdir, id, 'subagents', `agent-${String(idx)}.jsonl`), `${workerlines.join('\n')}\n`)
    }
  }

  const seedThree = () => {
    writeSession('-workspace-triquet', 'old', [
      lineOf({ type: 'ai-title', aiTitle: 'Old chat', timestamp: '2026-10-01T00:00:00.000Z' }),
    ])
    writeSession('-workspace-triquet', 'orchestrator', [
      lineOf({ type: 'ai-title', aiTitle: 'Sprint session', timestamp: '2026-10-05T00:00:00.000Z' }),
      lineOf({ type: 'user', message: 'userlabel is thread 7' }),
    ], [[lineOf({ type: 'user', message: 'pnpm worktree userlabel' })]])
    writeSession('-workspace-triquet', 'linker', [
      lineOf({ type: 'ai-title', aiTitle: 'Opened it', timestamp: '2026-10-04T00:00:00.000Z' }),
      lineOf({ type: 'pr-link', prNumber: 116 }),
    ])
    writeSession('-home-node-elsewhere', 'other-project', [
      lineOf({ type: 'ai-title', aiTitle: 'Another project', timestamp: '2026-10-06T00:00:00.000Z' }),
      lineOf({ type: 'user', message: 'userlabel' }),
    ])
  }

  it('lists every session of a triquet project, newest first, when nothing is asked', () => {
    seedThree()
    const found = SessionBranches.sessionsIn(projectsdir, [], { onlyProjects: 'triquet' })
    expect(found.map((session) => session.id)).to.deep.equal(['orchestrator', 'linker', 'old'])
    expect(found[0]?.worktrees).to.deep.equal(['userlabel'])
    expect(found[1]?.prs).to.deep.equal([116])
  })

  it('lists the other projects too, when told to', () => {
    seedThree()
    const found = SessionBranches.sessionsIn(projectsdir, [], { onlyProjects: null })
    expect(found.map((session) => session.id)).to.deep.equal(['other-project', 'orchestrator', 'linker', 'old'])
  })

  it('finds the sessions with evidence for a term, a link or a worker ahead of a mention', () => {
    seedThree()
    writeSession('-workspace-triquet', 'chatterbox', [lineOf({ type: 'user', message: 'userlabel userlabel userlabel' })])
    const found = SessionBranches.sessionsIn(projectsdir, termsOf('userlabel'), { onlyProjects: 'triquet' })
    expect(found.map((session) => session.id)).to.deep.equal(['orchestrator', 'chatterbox'])
    expect(found[0]?.evidence[0]).to.deep.equal({ term: 'userlabel', titled: false, linked: false, worktree: true, checkout: 0, mentions: 2 })
  })

  it('puts a session titled for the branch ahead of one that linked its PR', () => {
    seedThree()
    writeSession('-workspace-triquet', 'renamed', [lineOf({ type: 'custom-title', customTitle: '20261005-userlabel' })])
    const found = SessionBranches.sessionsIn(projectsdir, termsOf('116', 'userlabel'), { onlyProjects: 'triquet' })
    expect(found.map((session) => session.id)).to.deep.equal(['renamed', 'linker', 'orchestrator'])
  })

  it('puts a linked PR ahead of a worktree, and finds it by number', () => {
    seedThree()
    const found = SessionBranches.sessionsIn(projectsdir, termsOf('116', 'userlabel'), { onlyProjects: 'triquet' })
    expect(found.map((session) => session.id)).to.deep.equal(['linker', 'orchestrator'])
  })

  it('finds no session for a term nobody worked on', () => {
    seedThree()
    expect(SessionBranches.sessionsIn(projectsdir, termsOf('nobody_did'), { onlyProjects: 'triquet' })).to.deep.equal([])
  })

  it('reads a session whose only files are its workers', () => {
    fs.mkdirSync(path.join(projectsdir, '-workspace-triquet', 'headless', 'subagents'), { recursive: true })
    fs.writeFileSync(
      path.join(projectsdir, '-workspace-triquet', 'headless', 'subagents', 'agent-0.jsonl'),
      `${lineOf({ type: 'user', message: 'pnpm worktree userlabel', timestamp: '2026-10-05T00:00:00.000Z' })}\n`,
    )
    const found = SessionBranches.sessionsIn(projectsdir, termsOf('userlabel'), { onlyProjects: 'triquet' })
    expect(found.map((session) => session.id)).to.deep.equal(['headless'])
    expect(found[0]?.title).to.equal('(untitled)')
    expect(found[0]?.lastActive).to.equal('2026-10-05T00:00:00.000Z')
  })
})

describe('the command line', () => {
  const Script = path.resolve(import.meta.dirname, '../../scripts/session-branches.ts')
  let projectsdir: string
  beforeEach(() => {
    projectsdir = fs.mkdtempSync(path.join(os.tmpdir(), 'session-branches-cli-'))
    const projectdir = path.join(projectsdir, '-workspace-triquet')
    fs.mkdirSync(projectdir)
    fs.writeFileSync(path.join(projectdir, 'abcdef12-0000.jsonl'), [
      lineOf({ type: 'custom-title', customTitle: '20261005-userlabel' }),
      lineOf({ type: 'pr-link', prNumber: 116, timestamp: '2026-10-06T05:00:00.000Z' }),
    ].join('\n'))
    fs.writeFileSync(path.join(projectdir, 'plain-0000.jsonl'), lineOf({ type: 'ai-title', aiTitle: 'Just talking', timestamp: '2026-10-05T05:00:00.000Z' }))
  })
  afterEach(() => {
    fs.rmSync(projectsdir, { recursive: true, force: true })
  })

  /** Runs the script as the session `own`, or as no session at all (the default): what a person's shell is */
  const runAs = (own: string, ...args: string[]) => execFileSync(
    process.execPath,
    [Script, '--projects', projectsdir, ...args],
    { encoding: 'utf8', stdio: 'pipe', env: { ...process.env, CLAUDE_CODE_SESSION_ID: own } },
  )
  const run = (...args: string[]) => runAs('', ...args)

  it('prints a table of the sessions that worked on a PR', () => {
    expect(run('--table', '#116')).to.equal([
      'session   active            title               #116',
      'abcdef12  2026-10-06 05:00  20261005-userlabel  PR linked',
      '',
    ].join('\n'))
  })

  it('prints every session, with its PRs and worktrees, when nothing is asked', () => {
    expect(run('--table')).to.equal([
      'session   active            title               prs   worktrees',
      'abcdef12  2026-10-06 05:00  20261005-userlabel  #116',
      'plain-00  2026-10-05 05:00  Just talking',
      '',
    ].join('\n'))
  })

  it("prints the /rename for the session it is run in, and only that one, when nothing is asked", () => {
    expect(runAs('abcdef12-0000')).to.equal('/rename #116 | 20261005-userlabel\n')
  })

  it('prints every session it can name, each after a comment saying which, when run outside a session', () => {
    expect(run()).to.equal('# session abcdef12\n/rename #116 | 20261005-userlabel\n')
  })

  it('prints the /rename of each session that worked on a term, whoever is asking', () => {
    expect(runAs('somebody-else', '116')).to.equal('# session abcdef12\n/rename #116 | 20261005-userlabel\n')
    expect(run('--rename', '116')).to.equal('# session abcdef12\n/rename #116 | 20261005-userlabel\n')
  })

  it('says there is nothing to name for a session that has touched no worktree or PR', () => {
    expect(runAs('plain-0000')).to.equal('Nothing to name: no worktree cut and no PR linked.\n')
  })

  it('fails, saying why, when the session it is run in has no transcript', () => {
    expect(() => runAs('not-a-session')).to.throw(/No transcript of this session \(not-a-session\)/)
  })

  it('fails, saying why, when asked for two ways of printing', () => {
    expect(() => run('--table', '--json')).to.throw(/Choose one of --rename/)
    expect(() => run('--rename', '--table')).to.throw(/Choose one of --rename/)
  })

  it('prints JSON for --json', () => {
    const said = JSON.parse(run('--json', '116')) as { terms: string[], sessions: { id: string, prs: number[] }[] }
    expect(said.terms).to.deep.equal(['116'])
    expect(said.sessions.map((session) => [session.id, session.prs])).to.deep.equal([['abcdef12-0000', [116]]])
  })

  it('says so when no session has anything to say', () => {
    expect(run('nobody_did')).to.match(/^No session here mentions nobody_did\. Its transcript may be on another machine\.\n$/)
  })

  it('fails, saying why, when the argument is neither a label nor a number', () => {
    expect(() => run('Bad Label')).to.throw(/neither a branch label/)
  })

  it('fails, saying why, when there are no transcripts', () => {
    expect(() => execFileSync(process.execPath, [Script, '--projects', path.join(projectsdir, 'nowhere')], { encoding: 'utf8', stdio: 'pipe' })).to.throw(/No transcripts at/)
  })
})
