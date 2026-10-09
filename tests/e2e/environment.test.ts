import { describe, expect, it } from 'vitest'
import * as Environment from '../../e2e/environment'

/** What CI gives the suite, and what `pnpm test:e2e` gives it in the main checkout but for DOPPLER_CONFIG */
const Fit = { PORT: '3002', NEXT_PUBLIC_CONVEX_URL: 'http://127.0.0.1:3402', NEXT_DIST_DIR: '.next-e2e' }
const InCI = { ...Fit, CI: 'true' }
const Local = { ...Fit, DOPPLER_CONFIG: 'dev_e2e' }

describe('Environment.complaintsAbout', () => {
  it('has nothing to say about CI, or about Doppler\'s dev_e2e config', () => {
    expect(Environment.complaintsAbout(InCI)).to.deep.eq([])
    expect(Environment.complaintsAbout(Local)).to.deep.eq([])
  })

  it('has nothing to say about a cloud session\'s container, which has no Doppler', () => {
    expect(Environment.complaintsAbout({ ...Fit, CLAUDE_CODE_REMOTE: 'true' })).to.deep.eq([])
  })

  it('has nothing to say about the e2e-agent role, beside a human\'s own run', () => {
    expect(Environment.complaintsAbout({ ...Local, PORT: '3003', CONVEX_ROLE: 'e2e-agent', NEXT_PUBLIC_CONVEX_URL: 'http://127.0.0.1:3403', NEXT_DIST_DIR: '.next-e2e-agent' })).to.deep.eq([])
  })

  it('has nothing to say about the optimized build on the e2e-built role, as `pnpm test:e2e:built` runs it', () => {
    expect(Environment.complaintsAbout({ ...Local, PORT: '3005', CONVEX_ROLE: 'e2e-built', NEXT_PUBLIC_CONVEX_URL: 'http://127.0.0.1:3405', NEXT_DIST_DIR: '.next-e2e-built', TRIQUET_E2E_SERVER: 'built' })).to.deep.eq([])
  })

  it('has nothing to say about the optimized build on the e2e role, as CI runs it', () => {
    expect(Environment.complaintsAbout({ ...InCI, TRIQUET_E2E_SERVER: 'built' })).to.deep.eq([])
  })

  it('has nothing to say about a worktree\'s run, on its lane\'s port and backend', () => {
    expect(Environment.complaintsAbout({ ...Local, TRIQUET_LANE: '1', PORT: '3012', NEXT_PUBLIC_CONVEX_URL: 'http://127.0.0.1:3412' })).to.deep.eq([])
    expect(Environment.complaintsAbout({ ...Local, TRIQUET_LANE: '3', PORT: '3033', CONVEX_ROLE: 'e2e-agent', NEXT_PUBLIC_CONVEX_URL: 'http://127.0.0.1:3433', NEXT_DIST_DIR: '.next-e2e-agent' })).to.deep.eq([])
  })

  const ComplaintCases: [Record<string, string | undefined>, string, string][] = [
    // where it runs:
    [{ ...Fit },                                    "Run the e2e suite with `pnpm test:e2e`, under Doppler's dev_e2e config", 'outside CI and outside Doppler'],
    [{ ...Fit, DOPPLER_CONFIG: 'dev_claude' },      "Run the e2e suite with `pnpm test:e2e`, under Doppler's dev_e2e config", 'under the agents\' Doppler config'],
    [{ ...Fit, CLAUDE_CODE_REMOTE: 'false' },       "Run the e2e suite with `pnpm test:e2e`, under Doppler's dev_e2e config", 'with the cloud flag set false'],
    // settings left to next.config's defaults, which are a human's:
    [{ ...InCI, PORT: undefined },                  "PORT is not set: `pnpm test:e2e` gives it one, and so does the CI workflow", 'no web port'],
    [{ ...InCI, NEXT_PUBLIC_CONVEX_URL: '' },       "NEXT_PUBLIC_CONVEX_URL is not set: `pnpm test:e2e` gives it one, and so does the CI workflow", 'a blank database'],
    [{ ...InCI, NEXT_DIST_DIR: undefined },         "NEXT_DIST_DIR is not set: `pnpm test:e2e` gives it one, and so does the CI workflow", 'no build directory'],
    // settings another session holds:
    [{ ...InCI, PORT: '3001' },                     'PORT=3001 is not the e2e port in lane 0, 3002',   'the agents\' web port'],
    [{ ...InCI, PORT: '3004' },                     'PORT=3004 is not the e2e port in lane 0, 3002',   'the agents\' built server\'s port'],
    [{ ...InCI, NEXT_PUBLIC_CONVEX_URL: 'http://127.0.0.1:3400' }, 'NEXT_PUBLIC_CONVEX_URL=http://127.0.0.1:3400 is not the e2e backend in lane 0, http://127.0.0.1:3402: the suite empties the database it runs against', 'the human\'s database'],
    [{ ...InCI, NEXT_DIST_DIR: '.next' },           "NEXT_DIST_DIR=.next is already another session's", 'the human\'s build directory'],
    // another lane's:
    [{ ...InCI, TRIQUET_LANE: '1', NEXT_PUBLIC_CONVEX_URL: 'http://127.0.0.1:3412' }, 'PORT=3002 is not the e2e port in lane 1, 3012',   'the main checkout\'s port, from a worktree'],
    [{ ...InCI, TRIQUET_LANE: '1', PORT: '3012' },  'NEXT_PUBLIC_CONVEX_URL=http://127.0.0.1:3402 is not the e2e backend in lane 1, http://127.0.0.1:3412: the suite empties the database it runs against', 'the main checkout\'s database, from a worktree'],
    [{ ...InCI, TRIQUET_LANE: 'ten' },              'TRIQUET_LANE=ten is not a lane: 0 to 9',          'a lane that is not one'],
    // settings that make no sense:
    [{ ...InCI, PORT: 'OOPS_PORT' },                'PORT=OOPS_PORT is not a port',                    'a placeholder left in place of a port'],
    [{ ...InCI, PORT: '3002.5' },                   'PORT=3002.5 is not a port',                       'a port with a fraction'],
    [{ ...InCI, PORT: '80' },                       'PORT=80 is not a port',                           'a port only root may listen on'],
    [{ ...InCI, NEXT_PUBLIC_CONVEX_URL: 'https://quiet-otter-123.convex.cloud' }, "NEXT_PUBLIC_CONVEX_URL=https://quiet-otter-123.convex.cloud is not the e2e backend in lane 0, http://127.0.0.1:3402: the suite empties the database it runs against", 'a real database'],
    [{ ...InCI, NEXT_PUBLIC_CONVEX_URL: 'http://127.0.0.1:3403' }, "NEXT_PUBLIC_CONVEX_URL=http://127.0.0.1:3403 is not the e2e backend in lane 0, http://127.0.0.1:3402: the suite empties the database it runs against", 'another role\'s backend'],
    [{ ...InCI, CONVEX_ROLE: 'agent' },             'CONVEX_ROLE=agent is not one of e2e, e2e-agent, e2e-built', 'a role that is not the suite\'s'],
    [{ ...InCI, TRIQUET_E2E_SERVER: 'prod' },       'TRIQUET_E2E_SERVER=prod is not one of dev, built', 'a server the suite does not know how to start'],
  ]
  for (const [env, complaint, describes] of ComplaintCases) {
    it(`complains of ${describes}`, () => {
      expect(Environment.complaintsAbout(env)).to.deep.eq([complaint])
    })
  }

  it('lists every complaint, not just the first', () => {
    expect(Environment.complaintsAbout({})).to.have.length(4)
  })
})

describe('Environment.serverOf', () => {
  it('serves the app from the dev server unless told otherwise', () => {
    expect(Environment.serverOf(InCI)).to.eq('dev')
  })

  it('serves the optimized build when told to', () => {
    expect(Environment.serverOf({ ...InCI, TRIQUET_E2E_SERVER: 'built' })).to.eq('built')
  })
})

describe('Environment.listing', () => {
  it('shows the suite\'s settings and the variables that bear on it, and nothing else', () => {
    expect(Environment.listing({ ...InCI, TRIQUET_ENV: 'dev', HOME: '/home/runner' })).to.deep.eq({
      CI:                     'true',
      NEXT_DIST_DIR:          '.next-e2e',
      NEXT_PUBLIC_CONVEX_URL: 'http://127.0.0.1:3402',
      PORT:                   '3002',
      TRIQUET_ENV:            'dev',
    })
  })

  it('names a setting that is missing', () => {
    expect(Environment.listing({ CI: 'true' })).to.include({ PORT: '(unset)', NEXT_DIST_DIR: '(unset)' })
  })

  const Hidden = ['CONVEX_SELF_HOSTED_ADMIN_KEY', 'DOPPLER_TOKEN', 'ANTHROPIC_API_KEY', 'CONVEX_DEPLOY_KEY', 'NEXT_PUBLIC_DB_PW', 'TRIQUET_AUTH_HEADER']
  for (const envname of Hidden) {
    it(`says only that ${envname} is set, never what it holds`, () => {
      const listed = Environment.listing({ [envname]: 'hunter2' })
      expect(listed[envname]).to.eq('(set, not shown)')
      expect(JSON.stringify(listed)).not.to.contain('hunter2')
    })
  }
})

describe('Environment.workersFor', () => {
  it('runs a little under half the idle cores', () => {
    expect(Environment.workersFor(16, 0)).to.eq(7)
    expect(Environment.workersFor(4, 0)).to.eq(2)
  })

  it('runs fewer as the load rises, and never fewer than one', () => {
    expect(Environment.workersFor(16, 8)).to.eq(4)
    expect(Environment.workersFor(4, 3)).to.eq(1)
    expect(Environment.workersFor(4, 12)).to.eq(1)
  })
})
