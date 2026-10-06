import { describe, expect, it } from 'vitest'
import * as Routes from '../../src/lib/routes'

const InHunt = { org: 'pat_smith', hunt: 'quiet_otter' } as const
const Labels = { ...InHunt, realm: 'home', quiz: 'loud_heron' } as const

describe("Routes.orgPath", () => {
  it("puts an org's hunts at /~<org>", () => {
    expect(Routes.orgPath('pat_smith')).to.eq('/~pat_smith')
  })
})

describe("Routes.huntPath", () => {
  it("puts a hunt at /~<org>/<hunt>", () => {
    expect(Routes.huntPath(InHunt)).to.eq('/~pat_smith/quiet_otter')
  })
})

describe("Routes.quizzesPath", () => {
  it("puts a hunt's quizzes at /~<org>/<hunt>/quizzes", () => {
    expect(Routes.quizzesPath(InHunt)).to.eq('/~pat_smith/quiet_otter/quizzes')
  })
})

describe("Routes.categoriesPath", () => {
  it("puts a hunt's categories at /~<org>/<hunt>/categories", () => {
    expect(Routes.categoriesPath(InHunt)).to.eq('/~pat_smith/quiet_otter/categories')
  })
})

describe("Routes.quizPath", () => {
  it("puts a quiz at /~<org>/<hunt>/quizzes/<realm>/<quiz>", () => {
    expect(Routes.quizPath(Labels)).to.eq('/~pat_smith/quiet_otter/quizzes/home/loud_heron')
  })

  it("names the mode in a last segment", () => {
    expect(Routes.quizPath(Labels, 'edit')).to.eq('/~pat_smith/quiet_otter/quizzes/home/loud_heron/!edit')
    expect(Routes.quizPath(Labels, 'playtest')).to.eq('/~pat_smith/quiet_otter/quizzes/home/loud_heron/!playtest')
  })
})

describe('Routes.rootPath', () => {
  it('is the bare root with nowhere to go next', () => {
    expect(Routes.rootPath()).to.eq('/')
  })

  it('carries where to go next, encoded', () => {
    expect(Routes.rootPath('/~pat_smith/quiet_otter/quizzes/home/loud_heron/!playtest')).to.eq('/?then=%2F%7Epat_smith%2Fquiet_otter%2Fquizzes%2Fhome%2Floud_heron%2F%21playtest')
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

describe("Routes.modeFromAct", () => {
  it("reads the mode an old address's presentation is now", () => {
    expect([Routes.modeFromAct('smith'), Routes.modeFromAct('review')]).to.deep.eq(['edit', 'playtest'])
  })

  it("reads anything else as none", () => {
    expect([Routes.modeFromAct(null), Routes.modeFromAct(''), Routes.modeFromAct('admin'), Routes.modeFromAct('Smith'), Routes.modeFromAct('toString')]).to.deep.eq([null, null, null, null, null])
  })
})

describe("Routes.movedPath", () => {
  const Path = '/~pat_smith/quiet_otter/quizzes/home/loud_heron/!edit'

  it("is the path alone, moved from an address with no query or fragment", () => {
    expect(Routes.movedPath(Path, { search: '', hash: '' })).to.eq(Path)
  })

  it("drops an old address's act, which the path says as its mode", () => {
    expect(Routes.movedPath(Path, { search: '?act=smith', hash: '' })).to.eq(Path)
  })

  it("keeps the rest of the query, and the fragment", () => {
    expect(Routes.movedPath(Path, { search: '?act=smith&shown=all', hash: '#q3' })).to.eq(`${Path}?shown=all#q3`)
  })
})

describe('Routes.thenFrom', () => {
  it('follows a path on this site, query and all', () => {
    expect(Routes.thenFrom('/~pat_smith/quiet_otter/quizzes/home/loud_heron/!playtest?shown=all')).to.eq('/~pat_smith/quiet_otter/quizzes/home/loud_heron/!playtest?shown=all')
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
