import { describe, expect, it } from 'vitest'
import * as Addresses from '../../src/lib/addresses'
import type { AddressKind, AddressT, FiledAddressT, KeyedAddressT } from '../../src/lib/addresses'

const InHunt = { org: 'pat_smith', hunt: 'spring_hunt' } as const
const InQuiz = { ...InHunt, realm: 'home', quiz: 'legends' } as const

/** One address of every kind: a kind left out here fails the typecheck */
const Every: { [KK in AddressKind]: Extract<AddressT, { kind: KK }> } = {
  org:        { kind: 'org', org: 'pat_smith' },
  hunt:       { kind: 'hunt',       ...InHunt },
  quizzes:    { kind: 'quizzes',    ...InHunt },
  categories: { kind: 'categories', ...InHunt },
  members:    { kind: 'members',    ...InHunt },
  quiz:       { kind: 'quiz',       ...InQuiz },
  questions:  { kind: 'questions',  ...InQuiz },
  review:     { kind: 'review',     ...InQuiz, reviewer: 'lee_jones' },
  widget:     { kind: 'widget', scope: 'pub', widget: 'dumdum' },
}

const Keyed: KeyedAddressT[] = Object.values(Every).filter((address) => address.kind !== 'org')
const Filed: FiledAddressT[] = Keyed.filter((address) => address.kind !== 'quizzes')

/** Each kind's address, key path, and two files, side by side */
const Places = [
  [Every.org,        "/~pat_smith",                                                 null,                                                            null,                                     null],
  [Every.hunt,       "/~pat_smith/spring_hunt",                                     [],                                                              "hunt.tqh.json",                          "hunt.tqh.tsv"],
  [Every.quizzes,    "/~pat_smith/spring_hunt/quizzes",                             ["quizzes"],                                                     null,                                     null],
  [Every.categories, "/~pat_smith/spring_hunt/categories",                          ["categories"],                                                  "categories.tqc.json",                    "categories.tqc.tsv"],
  [Every.members,    "/~pat_smith/spring_hunt/members",                             ["members"],                                                     "members.tqm.json",                       "members.tqm.tsv"],
  [Every.quiz,       "/~pat_smith/spring_hunt/quizzes/home/legends",                ["quizzes", "home", "legends"],                                  "quizzes/home/legends.tqq.json",          "quizzes/home/legends.tqq.tsv"],
  [Every.questions,  "/~pat_smith/spring_hunt/quizzes/home/legends/questions",      ["quizzes", "home", "legends", "questions"],                     "quizzes/home/legends/questions.qq.json", "quizzes/home/legends/questions.qq.tsv"],
  [Every.review,     "/~pat_smith/spring_hunt/quizzes/home/legends/reviews/lee_jones", ["quizzes", "home", "legends", "reviews", "lee_jones"],       "quizzes/home/legends/reviews/lee_jones.tqr.json", "quizzes/home/legends/reviews/lee_jones.tqr.tsv"],
  [Every.widget,     "/lib/widgets/pub/dumdum",                                     ["widgets", "pub", "dumdum"],                                    "widgets/pub/dumdum.tqw.json",            "widgets/pub/dumdum.tqw.tsv"],
] as const

describe("Addresses: one address of every kind", () => {
  for (const [address, url, keypath, jsonpath, tsvpath] of Places) {
    describe(`a ${address.kind}`, () => {
      it("has its address", () => {
        expect(Addresses.urlOf(address)).to.eq(url)
      })

      if (address.kind === 'org') { return }
      it("has its key path", () => {
        expect(Addresses.keypathOf(address)).to.deep.eq(keypath)
      })

      if (address.kind === 'quizzes') { return }
      it("has its jsonball and its table, side by side", () => {
        expect([Addresses.filepathOf(address), Addresses.filepathOf(address, 'tsv')]).to.deep.eq([jsonpath, tsvpath])
      })
    })
  }

  it("lists every kind", () => {
    expect(Places.map(([address]) => address.kind)).to.have.members(Object.keys(Every))
  })
})

describe("Addresses: the three cannot drift", () => {
  for (const address of Keyed) {
    it(`a ${address.kind}'s address is its root and then its key path`, () => {
      const root = address.kind === 'widget' ? '/lib' : '/~pat_smith/spring_hunt'
      expect(Addresses.urlOf(address)).to.eq([root, ...Addresses.keypathOf(address)].join('/'))
    })
  }

  const Stemmed = Filed.filter((each) => each.kind !== 'hunt')
  for (const address of Stemmed) {
    it(`a ${address.kind}'s file is its key path and then its extensions`, () => {
      const preext = Addresses.PreextForKind[address.kind]
      expect(Addresses.filepathOf(address)).to.eq(`${Addresses.keypathOf(address).join('/')}.${preext}.json`)
    })
  }

  it("names every file differently", () => {
    const paths = Filed.flatMap((address) => [Addresses.filepathOf(address), Addresses.filepathOf(address, 'tsv')])
    expect(new Set(paths).size).to.eq(paths.length)
  })

  it("reads every address back as the resource it was made from", () => {
    for (const address of Object.values(Every)) {
      expect(Addresses.locationFrom(Addresses.urlOf(address))).to.deep.eq({ address, mode: null })
    }
  })

  it("reads every mode back off every address", () => {
    for (const address of Object.values(Every)) {
      for (const mode of Addresses.ModeVals) {
        expect(Addresses.locationFrom(Addresses.urlOf(address, mode))).to.deep.eq({ address, mode })
      }
    }
  })
})

describe("Addresses.urlOf", () => {
  it("puts the mode last, after a !", () => {
    expect(Addresses.urlOf(Every.quiz, 'playtest')).to.eq('/~pat_smith/spring_hunt/quizzes/home/legends/!playtest')
    expect(Addresses.urlOf(Every.quiz, 'edit')).to.eq('/~pat_smith/spring_hunt/quizzes/home/legends/!edit')
  })

  it("leaves the mode off when none is given", () => {
    expect(Addresses.urlOf(Every.hunt)).to.eq('/~pat_smith/spring_hunt')
  })
})

describe("Addresses.filepathOf", () => {
  it("writes the jsonball when no format is given", () => {
    expect(Addresses.filepathOf(Every.quiz)).to.eq('quizzes/home/legends.tqq.json')
  })

  it("keeps the hunt's own file at the root, under a stem of its own", () => {
    expect(Addresses.filepathOf(Every.hunt)).to.eq('hunt.tqh.json')
  })

  it("names every jsonball a merge reads *.tq?.json, and the questions alone outside it", () => {
    const merged = Filed.filter((address) => Addresses.isMerged(address)).map((address) => Addresses.filepathOf(address))
    expect(merged.filter((path) => ! /\.tq.\.json$/.test(path))).to.deep.eq([])
    expect(Addresses.filepathOf(Every.questions)).not.to.match(/\.tq.\.json$/)
  })
})

describe("Addresses.isMerged", () => {
  it("merges every jsonball but the questions alone", () => {
    expect(Filed.filter((address) => ! Addresses.isMerged(address)).map((address) => address.kind)).to.deep.eq(['questions'])
  })
})

describe("Addresses.locationFrom", () => {
  it("reads a quiz opened in a mode", () => {
    expect(Addresses.locationFrom('/~pat_smith/spring_hunt/quizzes/home/legends/!edit')).to.deep.eq({ address: Every.quiz, mode: 'edit' })
  })

  it("reads a hunt opened in no mode", () => {
    expect(Addresses.locationFrom('/~pat_smith/spring_hunt')).to.deep.eq({ address: Every.hunt, mode: null })
  })

  const Generous = [
    ["/~pat_smith/spring_hunt/quizzes/home/legends?sort=qnum",  'ignores a query string'],
    ["/~pat_smith/spring_hunt/quizzes/home/legends#nantes",     'ignores a fragment'],
    ["/~pat_smith/spring_hunt/quizzes/home/legends/",           'ignores a trailing slash'],
    ["/%7Epat_smith/spring_hunt/quizzes/home/legends",          'reads an escaped ~ as itself'],
  ] as const
  for (const [raw, story] of Generous) {
    it(story, () => {
      expect(Addresses.locationFrom(raw)).to.deep.eq({ address: Every.quiz, mode: null })
    })
  }

  const Refused = [
    // the app's own addresses, and the old ones:
    ["/h/spring_hunt",                                           'an old hunt address'],
    ["/h/spring_hunt/home/legends?act=smith",                    'an old quiz address'],
    ["/my/hunts",                                                'a page of the app'],
    ["/",                                                        'the root'],
    // not an address at all:
    ["",                                                         'an empty string'],
    ["~pat_smith/spring_hunt",                                   'a relative path'],
    ["https://elsewhere.example/~pat_smith/spring_hunt",         'a whole URL'],
    // a slot that is not a label:
    ["/~/spring_hunt",                                           'an org with no label'],
    ["/~Pat_Smith/spring_hunt",                                  'an org in capitals'],
    ["/~pat_smith/Spring_Hunt",                                  'a hunt in capitals'],
    ["/~pat_smith/spring-hunt",                                  'a hunt with a hyphen'],
    ["/~pat_smith/spring_hunt/quizzes/home/legends/reviews/x",   'a reviewer too short to be a label'],
    ["/~pat_smith/spring_hunt/%E0%A4%A",                         'an escape that is not one'],
    ["/~pat_smith/spring_hunt/quizzes/ho%2Fme/legends",          'an escaped slash'],
    // nouns out of place:
    ["/~pat_smith/spring_hunt/bogus",                            'a noun the hunt has none of'],
    ["/~pat_smith/spring_hunt/quizzes/home",                     'a realm alone'],
    ["/~pat_smith/spring_hunt/categories/math_econ",             'a single category, not yet built'],
    ["/~pat_smith/spring_hunt/quizzes/home/legends/reviews",     'reviews with no reviewer'],
    ["/~pat_smith/spring_hunt/quizzes/home/legends/questions/extra", 'something below the questions'],
    ["/~pat_smith/spring_hunt/widgets/pub/dumdum",               'a widget under a hunt'],
    ["/lib/widgets/own/dumdum",                                  'a widget scope there is none of'],
    ["/lib/widgets/pub",                                         'the library with no widget'],
    ["/lib/widgets/pub/dumdum/extra",                            'something below a widget'],
    ["/~pat_smith/spring_hunt//quizzes",                         'an empty segment'],
    // modes:
    ["/~pat_smith/spring_hunt/!admin",                           'a mode it does not know'],
    ["/~pat_smith/spring_hunt/!edit/quizzes",                    'a mode that is not last'],
    ["/!edit",                                                   'a mode with nothing to open'],
    // the futures, not yet built:
    ["/~pat_smith/spring_hunt@go_live/quizzes/home/legends",     'a hunt at a version'],
    ["/~pat_smith/spring_hunt/quizzes/home/legends.json",        'a raw record'],
  ] as const
  for (const [raw, story] of Refused) {
    it(`refuses ${story}`, () => {
      expect(Addresses.locationFrom(raw)).to.be.null
    })
  }
})

describe("Addresses.orgFrom", () => {
  it("reads the label after a ~", () => {
    expect(Addresses.orgFrom('~pat_smith')).to.eq('pat_smith')
  })

  it("reads anything else as none", () => {
    expect([Addresses.orgFrom('pat_smith'), Addresses.orgFrom('~'), Addresses.orgFrom('~Pat'), Addresses.orgFrom(null), Addresses.orgFrom(undefined)]).to.deep.eq([null, null, null, null, null])
  })

  it("reads a label of no ident's length as none", () => {
    expect([Addresses.orgFrom('~pat'), Addresses.orgFrom(`~${'pat_smith'.repeat(3)}`), Addresses.orgFrom('~pat_sm')]).to.deep.eq([null, null, 'pat_sm'])
  })
})

describe("Addresses.modeFrom", () => {
  it("reads a mode it knows after a !", () => {
    expect([Addresses.modeFrom('!edit'), Addresses.modeFrom('!playtest')]).to.deep.eq(['edit', 'playtest'])
  })

  it("reads anything else as none", () => {
    expect([Addresses.modeFrom('!admin'), Addresses.modeFrom('edit'), Addresses.modeFrom('!'), Addresses.modeFrom('!Edit'), Addresses.modeFrom(null), Addresses.modeFrom(undefined)]).to.deep.eq([null, null, null, null, null, null])
  })
})
