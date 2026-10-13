import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import * as EnvViz from '../../src/lib/env-viz'

/** The name of every variable a production build on Vercel was handed, 2026-10-13 */
const VercelBuildEnv = readFileSync(new URL('../../fixtures/vercel-build-env.txt', import.meta.url), 'utf8').trim().split('\n')

describe('EnvViz.snip', () => {
  const SnipCases: [string, string, string][] = [
    ['sk-ant-api03-abcdefghijklmnopqrstuvwxyz-WXYZ', 'sk****...****WXYZ', 'the first two and last four of one longer than eighteen, its length hidden (@example)'],
    ['abcdefghijklmnopqrs', 'ab****...****pqrs',   'the same of one nineteen long'],
    ['abcdefghijklmnopqr',  'ab************opqr',  'the first two and last four of one eighteen long, starred out character for character'],
    ['abcdefghijklmn',      'ab********klmn',      'the first two and last four of one fourteen long (@example)'],
    ['abcdefghijkl',        'ab******ijkl',        'the first two and last four of one twelve long, half of it'],
    ['abcdefghijk',         '*******hijk',         'the last four alone of one eleven long'],
    ['abcd.efgh.ij',        '******ghij',          'the last four of one ten long once its dots are dropped (@example)'],
    ['abcdefgh',            '****efgh',            'the last four of one eight long, half of it'],
    ['abcdefg',             '****efg',             'the last three of one seven long'],
    ['abcdef',              '***def',              'the last three of one six long, half of it (@example)'],
    ['abcde',               '*****',               'nothing of one five long (@example)'],
    ['a',                   '*',                   'nothing of one a character long'],
    ['',                    '',                    'nothing of an empty one, which is still empty'],
    ['line one\nline_two',  'li*********_two',     'one line of letters, digits and underscores, whatever else the value held'],
  ]
  it.each(SnipCases)('snips %j to %j: %s', (val, snipped) => {
    expect(EnvViz.snip(val)).to.eq(snipped)
  })

  it('keeps the length of a value up to eighteen long', () => {
    for (let len = 0; len <= 18; len++) { expect(EnvViz.snip('x'.repeat(len))).to.have.length(len) }
  })

  it('never shows more than half of a value', () => {
    for (let len = 0; len < 40; len++) {
      expect(EnvViz.snip('x'.repeat(len)).replaceAll('*', '').replace('...', '').length).to.be.at.most(len / 2)
    }
  })
})

describe('EnvViz.visualize', () => {
  it('lists every variable, in order of name, with what ENV_VAR_VIZ allows of each (@example)', () => {
    const env = { TRIQUET_ENV: 'dev', AUTH_GOOGLE_SECRET: 'hunter2', HOME: '', TQ_LANE: '1', AUTH_GOOGLE_ID: 'abcdefghij' }
    const shown = EnvViz.visualize(env)
    expect(shown).to.deep.eq({
      AUTH_GOOGLE_ID:     { seen: '******ghij' },
      AUTH_GOOGLE_SECRET: { standin: 'not shown' },
      HOME:               { standin: 'blank' },
      TQ_LANE:            { standin: 'not shown, no def' },
      TRIQUET_ENV:        { seen: 'dev' },
    })
    expect(Object.keys(shown)).to.deep.eq(['AUTH_GOOGLE_ID', 'AUTH_GOOGLE_SECRET', 'HOME', 'TQ_LANE', 'TRIQUET_ENV'])
  })

  it('says a value is null, undefined or blank whatever ENV_VAR_VIZ says of it, since that hides nothing', () => {
    expect(EnvViz.visualize({ AUTH_GOOGLE_SECRET: null, VERCEL_ENV: undefined, TQ_LANE: '  ', CI: '' })).to.deep.eq({
      AUTH_GOOGLE_SECRET: { standin: 'null' },
      CI:                 { standin: 'blank' },
      TQ_LANE:            { standin: 'blank' },
      VERCEL_ENV:         { standin: 'undefined' },
    })
  })

  it('takes a variable named for a property every object has as one it was not told of', () => {
    expect(EnvViz.visualize({ toString: 'shh', constructor: 'shh' })).to.deep.eq({
      constructor: { standin: 'not shown, no def' },
      toString:    { standin: 'not shown, no def' },
    })
  })

  it('takes its own rules where it is given them', () => {
    expect(EnvViz.visualize({ ONE: 'shown', TWO: 'abcdefgh', THREE: 'hidden' }, { ONE: 'show', TWO: 'snip', THREE: 'mask' }))
      .to.deep.eq({ ONE: { seen: 'shown' }, THREE: { standin: 'not shown' }, TWO: { seen: '****efgh' } })
  })
})

describe('EnvViz.ENV_VAR_VIZ', () => {
  it('never shows the whole value of a variable named as a secret, key, token or salt', () => {
    const secretish = Object.entries(EnvViz.ENV_VAR_VIZ).filter(([envvar]) => /SECRET|KEY|TOKEN|PASSWORD|SALT/.test(envvar))
    expect(secretish).to.not.be.empty
    for (const [envvar, vizkind] of secretish) { expect(vizkind, envvar).to.be.oneOf(['mask', 'snip']) }
  })

  it('lists every variable a production build on Vercel is handed', () => {
    expect(VercelBuildEnv.length).to.be.above(200)
    expect(VercelBuildEnv.filter((envvar) => ! Object.hasOwn(EnvViz.ENV_VAR_VIZ, envvar))).to.deep.eq([])
  })
})

describe('EnvViz.groupOf', () => {
  const GroupCases: [string, string, string][] = [
    ['VERCEL_GIT_REPO_SLUG',                    'git',          'a variable by its concern (@example)'],
    ['NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA',       'git',          'a variable by its concern, not its prefix'],
    ['VERCEL_GIT_COMMIT_SHA',                   'main',         'one worth reading first in main, though git would have it too'],
    ['VERCEL_OIDC_TOKEN',                       'auth',         'a token by what it proves'],
    ['VERCEL_EDGE_FUNCTIONS_MEMORY_SIZE',       'edge workers', 'an edge function in edge workers, before functions'],
    ['VERCEL_SERVERLESS_SUSPENSE_CACHE',        'caching',      'a cache in caching, before functions'],
    ['npm_package_name',                        'node',         'one named in lower case'],
    ['TRIQUET_SOMETHING_NEW',                   'unknown',      'one not listed, though app matches it (@example)'],
  ]
  it.each(GroupCases)('puts %s in %s: %s', (envvar, grouplabel) => {
    expect(EnvViz.groupOf(envvar)).to.eq(grouplabel)
  })

  it('puts one listed that no group matches in other', () => {
    expect(EnvViz.groupOf('ODD', { ODD: 'show' }, { main: /^MAIN$/ })).to.eq(EnvViz.OtherGroup)
  })

  it('finds a group other than other or unknown for every variable a production build on Vercel is handed', () => {
    const lost = VercelBuildEnv.filter((envvar) => [EnvViz.OtherGroup, EnvViz.UnknownGroup].includes(EnvViz.groupOf(envvar)))
    expect(lost).to.deep.eq([])
  })
})

describe('EnvViz.grouped', () => {
  it('splits the environment into its groups in order, other and unknown last, leaving out an empty one (@example)', () => {
    const env = { HOME: { seen: '/root' }, TQ_LANE: { standin: 'not shown, no def' as const }, TRIQUET_ENV: { seen: 'dev' } }
    expect(EnvViz.grouped(env)).to.deep.eq([
      ['main',    { TRIQUET_ENV: { seen: 'dev' } }],
      ['shell',   { HOME: { seen: '/root' } }],
      ['unknown', { TQ_LANE: { standin: 'not shown, no def' } }],
    ])
  })

  it('keeps the order the environment came in within each group', () => {
    const grouped = EnvViz.grouped({ BB: { seen: 'b' }, AA: { seen: 'a' }, CC: { seen: 'c' } }, { AA: 'show', BB: 'show', CC: 'show' }, { first: /^(AA|BB)$/ })
    expect(grouped).to.deep.eq([['first', { BB: { seen: 'b' }, AA: { seen: 'a' } }], ['other', { CC: { seen: 'c' } }]])
    expect(Object.keys(grouped[0]![1])).to.deep.eq(['BB', 'AA'])
  })
})
