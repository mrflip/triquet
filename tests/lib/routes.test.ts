import { describe, expect, it } from 'vitest'
import * as Routes from '../../src/lib/routes'

const Labels = { hunt: 'quiet_otter', realm: 'home', quiz: 'loud_heron' }

describe("Routes.categoriesPath", () => {
  it("puts a hunt's categories at /c/<hunt>/categories", () => {
    expect(Routes.categoriesPath('quiet_otter')).to.eq('/c/quiet_otter/categories')
  })
})

describe('Routes.quizPath', () => {
  it('puts a quiz at /h/<hunt>/<realm>/<quiz>', () => {
    expect(Routes.quizPath(Labels)).to.eq('/h/quiet_otter/home/loud_heron')
  })

  it('names the presentation in the query', () => {
    expect(Routes.quizPath(Labels, 'smith')).to.eq('/h/quiet_otter/home/loud_heron?act=smith')
    expect(Routes.quizPath(Labels, 'review')).to.eq('/h/quiet_otter/home/loud_heron?act=review')
  })
})

describe('Routes.rootPath', () => {
  it('is the bare root with nowhere to go next', () => {
    expect(Routes.rootPath()).to.eq('/')
  })

  it('carries where to go next, encoded', () => {
    expect(Routes.rootPath('/h/quiet_otter/home/loud_heron?act=review')).to.eq('/?then=%2Fh%2Fquiet_otter%2Fhome%2Floud_heron%3Fact%3Dreview')
  })
})

describe('Routes.switchIdentPath', () => {
  it('keeps the login screen open with ?switch', () => {
    expect(Routes.switchIdentPath()).to.eq('/?switch')
  })
})

describe('Routes.huntsPath', () => {
  it('is /my/hunts', () => {
    expect(Routes.huntsPath()).to.eq('/my/hunts')
  })
})

describe('Routes.aboutPath', () => {
  it('is /about', () => {
    expect(Routes.aboutPath()).to.eq('/about')
  })
})

describe('Routes.actFrom', () => {
  it('reads a presentation it knows', () => {
    expect([Routes.actFrom('smith'), Routes.actFrom('review')]).to.deep.eq(['smith', 'review'])
  })

  it('reads anything else as none', () => {
    expect([Routes.actFrom(null), Routes.actFrom(''), Routes.actFrom('admin'), Routes.actFrom('Smith')]).to.deep.eq([null, null, null, null])
  })
})

describe('Routes.thenFrom', () => {
  it('follows a path on this site, query and all', () => {
    expect(Routes.thenFrom('/h/quiet_otter/home/loud_heron?act=review')).to.eq('/h/quiet_otter/home/loud_heron?act=review')
  })

  const Refused = [
    [null,                          'nothing'],
    ['',                            'an empty string'],
    ['https://elsewhere.example/',  'another site'],
    ['//elsewhere.example/',        'another site, without a scheme'],
    [String.raw`/\elsewhere.example/`, 'another site, behind a backslash browsers read as a slash'],
    ['javascript:alert(1)',         'a script'],
    ['my/hunts',                    'a relative path'],
  ] as const
  for (const [raw, story] of Refused) {
    it(`refuses ${story}`, () => {
      expect(Routes.thenFrom(raw)).to.be.null
    })
  }
})
