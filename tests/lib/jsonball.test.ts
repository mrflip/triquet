import { describe, expect, it } from 'vitest'
import * as Jsonball from '../../src/lib/jsonball'
import { ReservedWidgetingLabels } from '../../src/models/widgeting'

describe('ballAt', () => {
  const BallAtCases = [
    [[['quizzes', 'home', 'legends'], { title: 'Legends' }], { quizzes: { home: { legends: { title: 'Legends' } } } }, 'a key path nests the body under each key in turn'],
    [[['categories'], {}],                                   { categories: {} },                                       'one key, an empty body'],
    [[[], { label: 'spring_hunt' }],                         { label: 'spring_hunt' },                                 'an empty key path puts the body at the root'],
  ] as const

  for (const [[keypath, body], expected, story] of BallAtCases) {
    it(story, () => {
      expect(Jsonball.ballAt(keypath, body)).to.deep.eq(expected)
    })
  }
})

describe('merged', () => {
  it("deep-merges balls into one, each keyed collection gathering every ball's members", () => {
    expect(Jsonball.merged([{ quizzes: { home: { legends: {} } } }, { quizzes: { home: { princes: {} } } }])).to.deep.eq({ quizzes: { home: { legends: {}, princes: {} } } })
  })

  it("is an empty ball for no balls", () => {
    expect(Jsonball.merged([])).to.deep.eq({})
  })

  it("changes none of the balls it merges", () => {
    const first = { quizzes: { home: { legends: { title: 'Legends' } } } }
    const second = { quizzes: { home: { legends: { locked: true } } } }
    const whole = Jsonball.merged([first, second])
    expect(whole).to.deep.eq({ quizzes: { home: { legends: { title: 'Legends', locked: true } } } })
    expect(first).to.deep.eq({ quizzes: { home: { legends: { title: 'Legends' } } } })
    expect(second).to.deep.eq({ quizzes: { home: { legends: { locked: true } } } })
  })

  it("lets the later ball win a leaf two balls hold", () => {
    expect(Jsonball.merged([{ title: 'First' }, { title: 'Second' }])).to.deep.eq({ title: 'Second' })
  })

  it("keeps a list inside one ball as it is", () => {
    expect(Jsonball.merged([{ params: { names: ['a', 'b'] } }, { other: 1 }])).to.deep.eq({ params: { names: ['a', 'b'] }, other: 1 })
  })
})

describe('keyedOf', () => {
  it("keys each member by its label, carrying its place in the list", () => {
    expect(Jsonball.keyedOf([{ label: 'leon' }, { label: 'nantes' }], (qn) => qn.label, () => ({}))).to.deep.eq({ leon: { position: 0 }, nantes: { position: 1 } })
  })

  it("puts what each holds beside its place", () => {
    expect(Jsonball.keyedOf([{ label: 'leon', title: 'Leon' }], (qn) => qn.label, (qn) => ({ title: qn.title }))).to.deep.eq({ leon: { title: 'Leon', position: 0 } })
  })

  it("is an empty collection for an empty list", () => {
    expect(Jsonball.keyedOf([], () => 'never', () => ({}))).to.deep.eq({})
  })
})

describe('listedOf', () => {
  const ListedCases = [
    // regular usage:
    [{ nantes: { position: 1 }, leon: { position: 0 } },     [{ position: 0, label: 'leon' }, { position: 1, label: 'nantes' }],  'a keyed collection, in order of position, each carrying its key as its label'],
    [[{ label: 'leon' }],                                     [{ label: 'leon' }],                                                 'a list, as it stands'],
    // trivial cases:
    [{},                                                      [],                                                                  'an empty collection'],
    [[],                                                      [],                                                                  'an empty list'],
    // hand-edited cases:
    [{ zed: {}, leon: { position: 0 }, abe: {} },            [{ position: 0, label: 'leon' }, { label: 'zed' }, { label: 'abe' }], 'members with no position come last, as they came'],
    [{ leon: { position: '0' }, nantes: { position: 0 } },   [{ position: 0, label: 'nantes' }, { position: '0', label: 'leon' }], 'a position that is not a number counts as none'],
    [{ leon: { label: 'other', position: 0 } },               [{ position: 0, label: 'leon' }],                                    'the key is the label, whatever label the member carries'],
    [{ leon: 'junk', nantes: { position: 0 } },               [{ position: 0, label: 'nantes' }, 'junk'],                          'a member that is not an object is passed on as it is'],
  ] as const

  for (const [collection, expected, story] of ListedCases) {
    it(story, () => {
      expect(Jsonball.listedOf(collection)).to.deep.eq(expected)
    })
  }
})

describe('PositionField', () => {
  it("is a label no widgeting may take, since a question's widgeteds sit beside it", () => {
    expect(ReservedWidgetingLabels).to.include(Jsonball.PositionField)
  })
})

describe('quizzesIn', () => {
  it("reads a bare list as the questions of one quiz", () => {
    expect(Jsonball.quizzesIn([{ label: 'leon' }])).to.deep.eq({ shape: 'list', quizzes: [{ label: null, title: null, questions: [{ label: 'leon' }], widgetings: [] }] })
  })

  it("reads the questions alone as one quiz, keyed questions in order, each labelled by its key", () => {
    expect(Jsonball.quizzesIn({ questions: { leon: { position: 0 } } })?.quizzes[0]?.questions).to.deep.eq([{ position: 0, label: 'leon' }])
    expect(Jsonball.quizzesIn({ questions: { leon: { position: 0 } } })?.shape).to.eq('quiz')
  })

  it("reads one quiz unwrapped, with its questions and widgetings in a list or keyed", () => {
    const listed = Jsonball.quizzesIn({ label: 'legends', title: 'Legends', questions: [{ label: 'leon' }], widgetings: [{ label: 'dumdum', widget_label: 'dumdum' }] })
    const keyed = Jsonball.quizzesIn({ title: 'Legends', questions: { leon: { position: 0 } }, widgetings: { dumdum: { position: 0, widget_label: 'dumdum' } } })
    expect(listed).to.deep.eq({ shape: 'quiz', quizzes: [{ label: 'legends', title: 'Legends', questions: [{ label: 'leon' }], widgetings: [{ label: 'dumdum', widget_label: 'dumdum' }] }] })
    expect(keyed?.quizzes[0]?.widgetings).to.deep.eq([{ position: 0, widget_label: 'dumdum', label: 'dumdum' }])
  })

  it("reads quizzes by realm and label, each named by its key", () => {
    expect(Jsonball.quizzesIn({ quizzes: { home: { legends: { title: 'Legends' } } } })?.quizzes[0]?.label).to.eq('legends')
  })

  it("reads every quiz of a merged hunt, across its realms, passing over the rest of it", () => {
    const read = Jsonball.quizzesIn({
      label:      'spring_hunt',
      categories: { tv: { position: 0 } },
      quizzes:    { home: { legends: { questions: { leon: {} } } }, away: { princes: { questions: {} } } },
      widgets:    { pub: { dumdum: {} } },
    })
    expect(read?.shape).to.eq('hunt')
    expect(read?.quizzes.map((quiz) => [quiz.label, quiz.questions.length])).to.deep.eq([['legends', 1], ['princes', 0]])
  })

  it("reads an older hunt's realms and a workspace's quizzes, in lists, each named by the label it answered to", () => {
    const realms = Jsonball.quizzesIn({ realms: [{ quizzes: [{ label: 'minted_once', forced_label: 'legends' }, { label: 'princes' }] }] })
    const workspace = Jsonball.quizzesIn({ quizzes: [{ title: 'Legends', questions: [] }] })
    expect(realms?.quizzes.map((quiz) => quiz.label)).to.deep.eq(['legends', 'princes'])
    expect(workspace).to.deep.eq({ shape: 'hunt', quizzes: [{ label: null, title: 'Legends', questions: [], widgetings: [] }] })
  })

  it("names a chain by its target's label where an older export named its id, and none where the id names nothing here", () => {
    const read = Jsonball.quizzesIn({ quizzes: [{ questions: [
      { id: 'id-1', label: 'leon', chains_to: 'id-2' },
      { id: 'id-2', label: 'minted', forced_label: 'nantes', chains_to: 'id-9' },
      { id: 'id-3', label: 'paris', chains_to: null },
    ] }] })
    expect(read?.quizzes[0]?.questions.map((question) => (question as { chains_to: unknown }).chains_to)).to.deep.eq(['nantes', null, null])
  })

  it("leaves the chains of questions carrying no ids as they are", () => {
    expect(Jsonball.quizzesIn([{ label: 'leon', chains_to: 'nantes' }])?.quizzes[0]?.questions).to.deep.eq([{ label: 'leon', chains_to: 'nantes' }])
  })

  it("reads a quiz's review alone as a quiz holding no questions", () => {
    expect(Jsonball.quizzesIn({ quizzes: { home: { legends: { reviews: { lee_jones: { overall: '' } } } } } })?.quizzes).to.deep.eq([{ label: 'legends', title: null, questions: [], widgetings: [] }])
  })

  it("reads a ball holding no quiz as none", () => {
    for (const ball of [{ categories: {} }, { members: { pat_smith: {} } }, { widgets: { pub: {} } }, { label: 'spring_hunt' }, {}]) {
      expect(Jsonball.quizzesIn(ball), JSON.stringify(ball)).to.deep.eq({ shape: 'none', quizzes: [] })
    }
  })

  it("is null for what is not a ball at all, or a shape whose parts will not read", () => {
    for (const raw of ['legends', 42, null, true, { quizzes: { home: 'legends' } }, { realms: 'home' }, { questions: 'leon' }, { title: 7, questions: [] }]) {
      expect(Jsonball.quizzesIn(raw), JSON.stringify(raw)).to.be.null
    }
  })
})

describe('widgetsIn', () => {
  it("reads widgets keyed by scope and label in library order, each carrying its scope and label", () => {
    expect(Jsonball.widgetsIn({ widgets: { pub: { shout: { position: 0, formulary: 'jsonata', formula: '1' } } } })).to.deep.eq([{ position: 0, formulary: 'jsonata', formula: '1', scope: 'pub', label: 'shout' }])
    expect(Jsonball.widgetsIn({ widgets: { pub: { zebra: { position: 1 }, shout: { position: 0 } } } })?.map((widget) => (widget as { label: string }).label)).to.deep.eq(['shout', 'zebra'])
  })

  it("reads a bare list, and an older library export's list, as they stand", () => {
    expect(Jsonball.widgetsIn([{ label: 'shout' }])).to.deep.eq([{ label: 'shout' }])
    expect(Jsonball.widgetsIn({ widgets: [{ label: 'shout' }] })).to.deep.eq([{ label: 'shout' }])
  })

  it("reads the widgets out of a merged hunt, passing over the rest of it", () => {
    expect(Jsonball.widgetsIn({ label: 'spring_hunt', quizzes: {}, widgets: { pub: { dumdum: { position: 3 } } } })).to.deep.eq([{ position: 3, scope: 'pub', label: 'dumdum' }])
  })

  it("is null for a paste holding no widgets", () => {
    for (const raw of [{ quizzes: {} }, { widgetings: [] }, null, 'shout', { widgets: 'shout' }]) {
      expect(Jsonball.widgetsIn(raw), JSON.stringify(raw)).to.be.null
    }
  })
})
