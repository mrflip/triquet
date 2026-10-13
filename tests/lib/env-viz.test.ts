import { describe, expect, it } from 'vitest'
import * as EnvViz from '../../src/lib/env-viz'

describe('EnvViz.snip', () => {
  const SnipCases: [string, string, string][] = [
    ['abcdefghijklmn',  'ab********klmn',  'the first two and last four of one fourteen long (@example)'],
    ['abcdefghijkl',    'ab******ijkl',    'the first two and last four of one twelve long, half of it'],
    ['abcdefghijk',     '*******hijk',     'the last four alone of one eleven long'],
    ['abcdefghij',      '******ghij',      'the last four alone of one ten long (@example)'],
    ['abcdefgh',        '****efgh',        'the last four of one eight long, half of it'],
    ['abcdefg',         '****efg',         'the last three of one seven long'],
    ['abcdef',          '***def',          'the last three of one six long, half of it (@example)'],
    ['abcde',           '*****',           'nothing of one five long (@example)'],
    ['a',               '*',               'nothing of one a character long'],
    ['',                '',                'nothing of an empty one, which is still empty'],
  ]
  it.each(SnipCases)('snips %j to %j: %s', (val, snipped) => {
    expect(EnvViz.snip(val)).to.eq(snipped)
  })

  it('keeps the length of the value, and never shows more than half of it', () => {
    for (let len = 0; len < 40; len++) {
      const val = 'x'.repeat(len)
      const snipped = EnvViz.snip(val)
      expect(snipped).to.have.length(len)
      expect(snipped.replaceAll('*', '').length).to.be.at.most(len / 2)
    }
  })
})

describe('EnvViz.visualize', () => {
  it('lists every variable set, in order of name, with what ENV_VAR_VIZ allows of each (@example)', () => {
    const env = { TRIQUET_ENV: 'dev', AUTH_GOOGLE_SECRET: 'hunter2', HOME: '/root', AUTH_GOOGLE_ID: 'abcdefghij' }
    const shown = EnvViz.visualize(env)
    expect(shown).to.deep.eq({ AUTH_GOOGLE_ID: '******ghij', AUTH_GOOGLE_SECRET: null, HOME: null, TRIQUET_ENV: 'dev' })
    expect(Object.keys(shown)).to.deep.eq(['AUTH_GOOGLE_ID', 'AUTH_GOOGLE_SECRET', 'HOME', 'TRIQUET_ENV'])
  })

  it('masks a variable it was not told of, and leaves out one that is unset', () => {
    expect(EnvViz.visualize({ DOPPLER_TOKEN: 'dp.st.xyz', VERCEL_ENV: undefined })).to.deep.eq({ DOPPLER_TOKEN: null })
  })

  it('takes its own rules where it is given them', () => {
    expect(EnvViz.visualize({ ONE: 'shown', TWO: 'abcdefgh', THREE: 'hidden' }, { ONE: 'show', TWO: 'snip', THREE: 'mask' }))
      .to.deep.eq({ ONE: 'shown', THREE: null, TWO: '****efgh' })
  })

  it('never shows the whole value of a variable named as a secret, key or token', () => {
    const secretish = Object.entries(EnvViz.ENV_VAR_VIZ).filter(([envvar]) => /SECRET|KEY|TOKEN|PASSWORD/.test(envvar))
    expect(secretish).to.not.be.empty
    for (const [envvar, vizkind] of secretish) { expect(vizkind, envvar).to.be.oneOf(['mask', 'snip']) }
  })
})
