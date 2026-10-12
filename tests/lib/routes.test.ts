import { existsSync, readdirSync } from 'node:fs'
import path from 'node:path'
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

describe('Routes.privacyPath', () => {
  it('is /privacy', () => {
    expect(Routes.privacyPath()).to.eq('/privacy')
  })
})

describe('Routes.termsPath', () => {
  it('is /terms', () => {
    expect(Routes.termsPath()).to.eq('/terms')
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

/** The directories in `dir`, by name */
function dirsOf(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name)
}

/** What each dynamic folder of the app's pages is filled with, to make an address that reaches it */
const SampleForFolder: Record<string, string> = {
  '[org]':   '~pat_smith',
  '[hunt]':  'quiet_otter',
  '[realm]': 'home',
  '[quiz]':  'loud_heron',
  '[mode]':  '!edit',
}

/** Every folder beneath `dir`, as the path it answers to (`SampleForFolder` filling each dynamic one), and whether it holds a page */
function foldersBeneath(dir: string, segs: readonly string[] = []): { where: string, page: boolean }[] {
  const here = { where: `/${segs.join('/')}`, page: existsSync(path.join(dir, 'page.tsx')) }
  const below = dirsOf(dir).flatMap((dirname) => {
    const seg = dirname.startsWith('[') ? SampleForFolder[dirname] : dirname
    if (seg === undefined) { throw new Error(`No sample for the folder ${dirname}: add one to SampleForFolder`) }
    return foldersBeneath(path.join(dir, dirname), [...segs, seg])
  })
  return [here, ...below]
}

describe("Routes.isSyncedPath", () => {
  const Cases: [string, boolean, string][] = [
    // pages that open the database:
    ["/",                                                           true,  'the front door'],
    ["/?then=%2Fmy%2Fhunts",                                        true,  'the front door, sending on'],
    ["/~pat_smith",                                                 true,  "an org's hunts"],
    ["/~pat_smith/quiet_otter?x=1",                                 true,  'a hunt, under its org'],
    ["/~pat_smith/quiet_otter/quizzes",                             true,  "a hunt's quizzes"],
    ["/~pat_smith/quiet_otter/categories",                          true,  "a hunt's categories"],
    ["/~pat_smith/quiet_otter/quizzes/home/loud_heron",             true,  'a quiz'],
    ["/~pat_smith/quiet_otter/quizzes/home/loud_heron/!edit",       true,  'a quiz, opened in a mode'],
    ["/~pat_smith/quiet_otter/quizzes/home/loud_heron#q3",          true,  'a quiz, with a fragment'],
    ["/my/hunts",                                                   true,  'the hunts'],
    ["/stats",                                                      true,  'the stats'],
    ["/h/quiet_otter",                                              true,  'an old hunt address'],
    ["/h/quiet_otter/home/loud_heron?act=smith",                    true,  'an old quiz address'],
    ["/c/quiet_otter/categories",                                   true,  "an old address of a hunt's categories"],
    // addresses beneath the synced pages that reach no page, and so open no database:
    ["/h/x/y",                                                      false, 'an old address a segment short of a quiz (the review)'],
    ["/~any/hunt/nothing",                                          false, 'an org too short to be one, beneath a hunt (the review)'],
    ["/~pat_smith/quiet_otter/nothing",                             false, 'nothing a hunt has a page for'],
    ["/~pat_smith/quiet_otter/members",                             false, "a hunt's members, which no page shows"],
    ["/~pat_smith/quiet_otter/quizzes/home",                        false, 'a realm, which no page shows'],
    ["/~pat_smith/quiet_otter/quizzes/home/loud_heron/questions",   false, "a quiz's questions alone, which no page shows"],
    ["/~pat_smith/quiet_otter/quizzes/home/loud_heron.json",        false, "a quiz's raw record, which no page serves"],
    ["/~pat_smith/quiet_otter/!edit",                               false, 'a hunt in a mode, which its page takes none of'],
    ["/~pat_smith/quiet_otter/quizzes/home/loud_heron/!admin",      false, 'a quiz in a mode the app has not'],
    ["/pat_smith/quiet_otter",                                      false, 'an org without its ~'],
    ["/%7Epat_smith/quiet_otter",                                   false, 'an org with its ~ escaped, which no browser writes so'],
    ["/~pat_smith/quiet_otter/quizze%73",                           false, "a hunt's quizzes with a letter escaped, which the router finds no page for"],
    ["/~pat_smith/quiet_otter/categorie%73",                        false, "a hunt's categories with a letter escaped, likewise"],
    ["/~pat%5Fsmith/quiet_otter",                                   false, 'an org with a letter of its label escaped, which the app never writes'],
    ["/my",                                                         false, 'a folder of pages, not a page'],
    ["/my/hunts/nothing",                                           false, 'beneath the hunts'],
    ["/h",                                                          false, 'the old addresses, bare'],
    ["/h/Quiet Otter",                                              false, 'an old address whose hunt is no label'],
    ["/c/quiet_otter",                                              false, 'an old categories address, cut short'],
    ["/stats/nothing",                                              false, 'beneath the stats'],
    ["/my/hunts/",                                                  false, 'a page, with a slash after'],
    ["/pub/widgets/dumdum",                                         false, 'a widget, which no page shows'],
    // pages that never open the database, and what is no page of ours:
    ["/privacy",                                                    false, 'the privacy policy, which opens no database'],
    ["/about",                                                      false, 'About'],
    ["/api/ask",                                                    false, 'a route handler'],
    ["/favicon.ico",                                                false, 'a file'],
    ["/h/../privacy",                                               false, 'the privacy policy, by way of a dot segment'],
    ["https://example.com/my/hunts",                                false, 'another site'],
    ["//example.com/my/hunts",                                      false, 'another site, without its scheme'],
    [String.raw`/\example.com`,                                    false, 'a backslash a browser may read as a slash'],
    ["my/hunts",                                                    false, 'a path not from the root'],
    ["",                                                            false, 'nothing'],
  ]
  for (const [where, expected, describes] of Cases) {
    it(`is ${String(expected)} for ${describes}`, () => {
      expect(Routes.isSyncedPath(where)).to.eq(expected)
    })
  }

  const app = path.join(import.meta.dirname, '..', '..', 'src', 'app')

  it("is true for every page under src/app/(synced)/, and false for every folder there that holds none", () => {
    const folders = foldersBeneath(path.join(app, '(synced)'))
    expect(folders.filter(({ where, page }) => Routes.isSyncedPath(where) !== page)).to.deep.eq([])
    expect(folders.filter(({ page }) => page)).to.have.lengthOf(12)
  })

  it("is false for every page outside src/app/(synced)/", () => {
    const outside = dirsOf(app).filter((dirname) => ! dirname.startsWith('('))
    expect(outside.filter((dirname) => Routes.isSyncedPath(`/${dirname}`))).to.deep.eq([])
  })
})
