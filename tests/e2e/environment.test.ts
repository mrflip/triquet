import { describe, expect, it } from 'vitest'
import * as Environment from '../../e2e/environment'

/** What CI gives the suite, and what Doppler's dev_e2e config gives it but for DOPPLER_CONFIG */
const Fit = { PORT: '3002', JAZZ_DEV_PORT: '3202', JAZZ_DEV_DATA_DIR: 'data/jazz-e2e', NEXT_DIST_DIR: '.next-e2e' }
const InCI = { ...Fit, CI: 'true' }
const Local = { ...Fit, DOPPLER_CONFIG: 'dev_e2e' }

describe('Environment.complaintsAbout', () => {
  it('has nothing to say about CI, or about Doppler\'s dev_e2e config', () => {
    expect(Environment.complaintsAbout(InCI)).to.deep.eq([])
    expect(Environment.complaintsAbout(Local)).to.deep.eq([])
  })

  const ComplaintCases: [Record<string, string | undefined>, string, string][] = [
    // where it runs:
    [{ ...Fit },                                    "Run the e2e suite with `pnpm test:e2e`, under Doppler's dev_e2e config", 'outside CI and outside Doppler'],
    [{ ...Fit, DOPPLER_CONFIG: 'dev_claude' },      "Run the e2e suite with `pnpm test:e2e`, under Doppler's dev_e2e config", 'under the agents\' Doppler config'],
    // settings left to next.config's defaults, which are a human's:
    [{ ...InCI, PORT: undefined },                  "PORT is not set: Doppler's dev_e2e config gives it one, and so does the CI workflow", 'no web port'],
    [{ ...InCI, JAZZ_DEV_DATA_DIR: '' },            "JAZZ_DEV_DATA_DIR is not set: Doppler's dev_e2e config gives it one, and so does the CI workflow", 'a blank data directory'],
    [{ ...InCI, NEXT_DIST_DIR: undefined },         "NEXT_DIST_DIR is not set: Doppler's dev_e2e config gives it one, and so does the CI workflow", 'no build directory'],
    // settings another session holds:
    [{ ...InCI, JAZZ_DEV_PORT: '3200' },            "JAZZ_DEV_PORT=3200 is already another session's",  'the human\'s Jazz port'],
    [{ ...InCI, PORT: '3001' },                     "PORT=3001 is already another session's",           'the agents\' web port'],
    [{ ...InCI, JAZZ_DEV_DATA_DIR: 'data/jazz' },   "JAZZ_DEV_DATA_DIR=data/jazz is already another session's", 'the human\'s database'],
    [{ ...InCI, NEXT_DIST_DIR: '.next' },           "NEXT_DIST_DIR=.next is already another session's", 'the human\'s build directory'],
    // settings that make no sense:
    [{ ...InCI, JAZZ_DEV_PORT: 'OOPS_JAZZ_DEV_PORT' }, 'JAZZ_DEV_PORT=OOPS_JAZZ_DEV_PORT is not a port', 'a placeholder left in place of a port'],
    [{ ...InCI, PORT: '3002.5' },                   'PORT=3002.5 is not a port',                       'a port with a fraction'],
    [{ ...InCI, PORT: '80' },                       'PORT=80 is not a port',                           'a port only root may listen on'],
    [{ ...InCI, JAZZ_DEV_PORT: '3002' },            'PORT and JAZZ_DEV_PORT are both 3002',            'one port for both servers'],
    [{ ...InCI, JAZZ_REAL_DB: 'true' },             "JAZZ_REAL_DB=true would send every spec's writes to a real Jazz database", 'a real database'],
  ]
  for (const [env, complaint, describes] of ComplaintCases) {
    it(`complains of ${describes}`, () => {
      expect(Environment.complaintsAbout(env)).to.deep.eq([complaint])
    })
  }

  it('lists every complaint, not just the first', () => {
    expect(Environment.complaintsAbout({})).to.have.length(5)
  })
})

describe('Environment.listing', () => {
  it('shows the suite\'s settings and the variables that bear on it, and nothing else', () => {
    expect(Environment.listing({ ...InCI, TRIQUET_ENV: 'dev', HOME: '/home/runner' })).to.deep.eq({
      CI:                'true',
      JAZZ_DEV_DATA_DIR: 'data/jazz-e2e',
      JAZZ_DEV_PORT:     '3202',
      NEXT_DIST_DIR:     '.next-e2e',
      PORT:              '3002',
      TRIQUET_ENV:       'dev',
    })
  })

  it('names a setting that is missing', () => {
    expect(Environment.listing({ CI: 'true' })).to.include({ PORT: '(unset)', NEXT_DIST_DIR: '(unset)' })
  })

  const Hidden = ['JAZZ_ADMIN_SECRET', 'DOPPLER_TOKEN', 'ANTHROPIC_API_KEY', 'JAZZ_DB_PASSWORD', 'NEXT_PUBLIC_DB_PW', 'TRIQUET_AUTH_HEADER']
  for (const envname of Hidden) {
    it(`says only that ${envname} is set, never what it holds`, () => {
      const listed = Environment.listing({ [envname]: 'hunter2' })
      expect(listed[envname]).to.eq('(set, not shown)')
      expect(JSON.stringify(listed)).not.to.contain('hunter2')
    })
  }
})
