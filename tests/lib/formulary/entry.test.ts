import { describe, expect, it } from 'vitest'
import { EntryFormulary } from '../../../src/lib/formulary/entry'
import * as Formularies from '../../../src/lib/formulary/formularies'
import { Widget, WidgetValidators, type EntryKind } from '../../../src/models/widget'

/** An entry widget of `entry_kind`, its config holding `defaults` beside its kind */
const entryOf = (entry_kind: EntryKind, defaults: Record<string, unknown> = {}) => Widget.fill({ label: 'remark', formulary: 'entry', config: { entry_kind, ...defaults } })

/** A widgeting saying `params` of its own */
const saying = (params: Record<string, unknown> = {}) => ({ params: params as Record<string, never> })

describe('EntryFormulary', () => {
  it('reads nothing, is never worked out or asked, and upserts what is typed', () => {
    expect([EntryFormulary.kind, EntryFormulary.defaultInput, EntryFormulary.refresh, EntryFormulary.store]).to.deep.eq(['entry', null, null, 'upsert'])
  })

  it("reports the entry config's validator", () => {
    expect(EntryFormulary.config).to.eq(WidgetValidators.entryConfig)
  })

  it('finds nothing wrong with a widget that has no formula to get wrong', () => {
    expect(EntryFormulary.check()).to.be.null
  })

  it('reads nothing, so there is never anything to run', () => {
    expect(EntryFormulary.input()).to.deep.eq({ status: 'missing' })
  })

  describe('paramsOf', () => {
    it("refuses a widgeting's params that put a least above its widget's most, and any param of another family, per the doc examples", () => {
      expect(EntryFormulary.paramsOf({ config: { entry_kind: 'number', min: 1 } }).safeParse({ max: 0 }).success).to.be.false
      expect(EntryFormulary.paramsOf({ config: { entry_kind: 'boolean' } }).safeParse({ min: 1 }).success).to.be.false
    })

    it("takes its family's params, each alone or none", () => {
      expect(EntryFormulary.paramsOf(entryOf('number')).parse({ min: 0, integer: true })).to.deep.eq({ min: 0, integer: true })
      expect(EntryFormulary.paramsOf(entryOf('text')).parse({ pattern: 'url' })).to.deep.eq({ pattern: 'url' })
      expect(EntryFormulary.paramsOf(entryOf('enum')).parse({ options: ['easy', 'hard'] })).to.deep.eq({ options: ['easy', 'hard'] })
      expect(EntryFormulary.paramsOf(entryOf('boolean')).parse({})).to.deep.eq({})
    })

    it("says what is wrong of the param to change", () => {
      const paramsValidator = EntryFormulary.paramsOf(entryOf('number', { min: 5 }))
      const checked = paramsValidator.safeParse({ max: 1 })
      expect(checked.error?.issues.map((issue) => [issue.path, issue.message])).to.deep.eq([[['max'], 'should be no less than the least, «5»']])
    })

    it("holds a percent's params to its preset bounds beneath the widget's, as they are in force", () => {
      expect(EntryFormulary.paramsOf(entryOf('percent')).safeParse({ min: 120 }).success).to.be.false
      expect(EntryFormulary.paramsOf(entryOf('percent')).safeParse({ min: 120, max: 150 }).success).to.be.true
      expect(EntryFormulary.paramsOf(entryOf('percent', { max: 150 })).safeParse({ min: 120 }).success).to.be.true
    })

    it("is the shape a params editor draws its fields from", () => {
      const { shape } = EntryFormulary.paramsOf(entryOf('number'))
      expect(Object.keys(shape)).to.deep.eq(['min', 'max', 'integer'])
    })
  })

  describe('inForce', () => {
    it("overlays the widget's defaults with the widgeting's own, key by key, per the doc example", () => {
      expect(EntryFormulary.inForce({ config: { entry_kind: 'number', min: 1, max: 10 } }, { params: { max: 5 } })).to.deep.eq({ family: 'number', params: { min: 1, max: 5 } })
    })

    it("puts a preset of text beneath everything, per the doc example", () => {
      expect(EntryFormulary.inForce({ config: { entry_kind: 'labelish' } }, { params: {} })).to.deep.eq({ family: 'text', params: { pattern: 'label', lines: 'one' } })
      expect(EntryFormulary.inForce(entryOf('titleish'), saying())).to.deep.eq({ family: 'text', params: { pattern: 'oneline', lines: 'one', max_length: 82 } })
    })

    it("puts a percent's bounds beneath everything, per the doc example", () => {
      expect(EntryFormulary.inForce({ config: { entry_kind: 'percent' } }, { params: { max: 50 } })).to.deep.eq({ family: 'number', params: { min: 0, max: 50 } })
      expect(EntryFormulary.inForce(entryOf('percent', { min: 10 }), saying())).to.deep.eq({ family: 'number', params: { min: 10, max: 100 } })
    })

    it("reads a widgeting's params written before they were held to its family as saying nothing", () => {
      expect(EntryFormulary.inForce(entryOf('number', { max: 10 }), saying({ strict: true }))).to.deep.eq({ family: 'number', params: { max: 10 } })
    })

    it("is each family's own, with no params for one that takes none", () => {
      expect(EntryFormulary.inForce(entryOf('boolean'), saying())).to.deep.eq({ family: 'boolean', params: {} })
      expect(EntryFormulary.inForce(entryOf('estimates'), saying())).to.deep.eq({ family: 'estimates', params: {} })
    })
  })

  describe('valueOf', () => {
    it("holds a cell to its widget's kind and the params in force, per the doc examples", () => {
      expect(EntryFormulary.valueOf({ config: { entry_kind: 'labelish' } }, { params: {} }).parse('quiet_otter')).to.eq('quiet_otter')
      expect(EntryFormulary.valueOf({ config: { entry_kind: 'number' } }, { params: { max: 10 } }).safeParse(11).success).to.be.false
    })

    const Taken: [EntryKind, Record<string, unknown>, unknown, unknown, string][] = [
      // text:
      ['text',      {},                                  '  *Ask* Flip.\nThen ask again.  ', '*Ask* Flip.\nThen ask again.', 'prose for a text entry, trimmed, markdown and newlines and all'],
      ['text',      { max_length: 5 },                   'Five!',                            'Five!',                        'text as long as it may be'],
      ['text',      { pattern: 'url' },                  'https://example.com',              'https://example.com',          'a web address for one held to the url pattern'],
      ['text',      { pattern: 'label' },                'position',                         'position',                     'a reserved word for one held to the label pattern: a value, not a name in any namespace'],
      ['text',      { regex: { source: '^[A-Z]{3}$', flags: '' } }, 'ABC',                 'ABC',                          'what matches its own regular expression'],
      ['text',      { regex: { source: '^[a-z]{3}$', flags: 'i' } }, 'AbC',                 'AbC',                          'what matches its own regular expression, ignoring case as its flags say'],
      ['text',      { pattern: 'oneline', regex: { source: 'otter', flags: '' } }, 'a quiet otter', 'a quiet otter',      'what matches both a named pattern and its own regular expression'],
      ['labelish',  {},                                  'quiet_otter',                      'quiet_otter',                  'a label for a label entry'],
      ['titleish',  {},                                  ' The Quiet Otter ',                'The Quiet Otter',              'one line for a title entry, trimmed'],
      // number:
      ['number',    {},                                  -2.5,                               -2.5,                           'any finite number for a number entry, below nought and fractions included'],
      ['number',    { min: 1, max: 10, integer: true },  10,                                 10,                             'a whole number at its most'],
      ['number',    { min: 1, max: 10 },                 1,                                  1,                              'a number at its least'],
      ['percent',   {},                                  100,                                100,                            'a hundred for a percent entry: its preset most'],
      ['percent',   {},                                  12.5,                               12.5,                           'a fraction of a percent'],
      ['percent',   { max: 150 },                        150,                                150,                            'past a hundred, for a percent whose params say so'],
      // boolean:
      ['boolean',   {},                                  false,                              false,                          'no for a yes-or-no entry'],
      ['boolean',   {},                                  true,                               true,                           'yes for a yes-or-no entry'],
      // enum:
      ['enum',      { options: ['easy', 'hard'] },       'hard',                             'hard',                         'one of the options for a choice entry'],
      // estimates:
      ['estimates', {},                                  [{ category: 'tv' }],               [{ category: 'tv', difficulty: 'medium' }], "a question's category estimates, each difficulty medium unless said"],
    ]
    for (const [entry_kind, params, val, expected, describes] of Taken) {
      it(`takes ${describes}`, () => {
        expect(EntryFormulary.valueOf(entryOf(entry_kind), saying(params)).parse(val)).to.deep.eq(expected)
      })
    }

    const Refused: [EntryKind, Record<string, unknown>, unknown, string][] = [
      // text:
      ['text',      {},                                  ' '.repeat(3),                  'blank text, which is an emptied cell rather than a value'],
      ['text',      {},                                  'x'.repeat(3601),               'text past 3600 characters'],
      ['text',      {},                                  'a\u{7}b',                      'text with a control character'],
      ['text',      {},                                  3,                              'a number in a text entry'],
      ['text',      { max_length: 5 },                   'Six!!!',                       'text past its most characters'],
      ['text',      { lines: 'one' },                    'two\nlines',                   'two lines where one is asked for'],
      ['text',      { pattern: 'oneline' },              'two\nlines',                   'two lines for one held to a pattern'],
      ['text',      { pattern: 'url' },                  'example.com',                  'an address with no scheme for one held to the url pattern'],
      ['text',      { pattern: 'label' },                'Quiet Otter',                  'what is not a label for one held to the label pattern'],
      ['text',      { regex: { source: '^[A-Z]{3}$', flags: '' } }, 'ABCD',             'what does not match its own regular expression'],
      ['text',      { regex: { source: '^[A-Z]{3}$', flags: '' } }, 'abc',              'what matches its own regular expression only when case is ignored, which its flags do not say'],
      ['text',      { pattern: 'url', regex: { source: 'otter', flags: '' } }, 'a quiet otter', 'what matches its own regular expression but not the named pattern beside it'],
      ['labelish',  {},                                  'Quiet Otter',                  'a label that is not one'],
      ['titleish',  {},                                  'x'.repeat(83),                 'a title past 82 characters'],
      ['titleish',  {},                                  'two\nlines',                   'a title of two lines'],
      ['titleish',  {},                                  '',                             'an empty title, which is an emptied cell'],
      // number:
      ['number',    {},                                  '3',                            'text in a number entry'],
      ['number',    {},                                  Infinity,                       'a number without end'],
      ['number',    { min: 1 },                          0,                              'a number below its least'],
      ['number',    { max: 10 },                         10.5,                           'a number above its most'],
      ['number',    { integer: true },                   2.5,                            'a fraction for a whole-number entry'],
      ['percent',   {},                                  101,                            'past a hundred for a percent entry'],
      ['percent',   {},                                  -1,                             'below nought for a percent entry'],
      // boolean:
      ['boolean',   {},                                  'yes',                          'text for a yes-or-no entry'],
      ['boolean',   {},                                  0,                              'a number for a yes-or-no entry'],
      // enum:
      ['enum',      { options: ['easy', 'hard'] },       'medium',                       'what is none of the options'],
      ['enum',      { options: ['easy', 'hard'] },       'Easy',                         'an option in another case'],
      ['enum',      {},                                  'easy',                         'anything at all for one with no options yet'],
      // estimates:
      ['estimates', {},                                  [],                                                            'no estimates at all, which is an emptied cell'],
      ['estimates', {},                                  [{ category: 'tv' }, { category: 'tv', difficulty: 'hard' }], 'one category estimated twice'],
      ['estimates', {},                                  [{ category: 'cooking' }],                                    'a category there is not'],
      ['estimates', {},                                  'tv',                                                         'text in a category-estimate entry'],
    ]
    for (const [entry_kind, params, val, describes] of Refused) {
      it(`refuses ${describes}`, () => {
        expect(EntryFormulary.valueOf(entryOf(entry_kind), saying(params)).safeParse(val).success).to.be.false
      })
    }

    it("says why it refuses, in a sentence of its own", () => {
      const checked = EntryFormulary.valueOf(entryOf('enum'), saying()).safeParse('easy')
      expect(checked.error?.issues[0]?.message).to.eq('has no options to be one of: give the widgeting some')
    })

    it("holds a cell to the widget's defaults where the widgeting says nothing", () => {
      expect(EntryFormulary.valueOf(entryOf('number', { max: 10 }), saying()).safeParse(11).success).to.be.false
      expect(EntryFormulary.valueOf(entryOf('number', { max: 10 }), saying({ max: 20 })).safeParse(11).success).to.be.true
    })
  })

  it("says what a cell's text should match, its own regular expression shown as one is written", () => {
    const checked = EntryFormulary.valueOf(entryOf('text'), saying({ regex: { source: '^[A-Z]{3}$', flags: 'i' } })).safeParse('ABCD')
    expect(checked.error?.issues.map((issue) => issue.message)).to.deep.eq(['should match «/^[A-Z]{3}$/i»'])
  })

  it("holds a cell to a regular expression its widget gives as a default", () => {
    const coded = entryOf('text', { regex: { source: '^[A-Z]{3}$', flags: '' } })
    expect(EntryFormulary.valueOf(coded, saying()).safeParse('ABC').success).to.be.true
    expect(EntryFormulary.valueOf(coded, saying()).safeParse('ABCD').success).to.be.false
    expect(EntryFormulary.valueOf(coded, saying({ regex: { source: '^[A-Z]{4}$', flags: '' } })).safeParse('ABCD').success).to.be.true
  })

  describe('kindValueOf', () => {
    it("holds a pasted value to its kind and not its params, per the doc examples", () => {
      expect(EntryFormulary.kindValueOf({ config: { entry_kind: 'number', max: 10 } }).safeParse(11).success).to.be.true
      expect(EntryFormulary.kindValueOf({ config: { entry_kind: 'labelish' } }).safeParse('Quiet Otter').success).to.be.false
    })

    it("takes any option for a choice entry, and refuses what no option could be", () => {
      expect(EntryFormulary.kindValueOf(entryOf('enum', { options: ['easy'] })).parse('medium')).to.eq('medium')
      expect(EntryFormulary.kindValueOf(entryOf('enum')).safeParse('two\nlines').success).to.be.false
    })

    it("refuses a value of another kind", () => {
      expect(EntryFormulary.kindValueOf(entryOf('boolean')).safeParse('yes').success).to.be.false
      expect(EntryFormulary.kindValueOf(entryOf('text')).safeParse(3).success).to.be.false
      expect(EntryFormulary.kindValueOf(entryOf('percent')).safeParse('50%').success).to.be.false
    })
  })

  describe('lengthMaxOf', () => {
    it("is what the params say, or what the pattern allows, or prose's, per the doc examples", () => {
      expect(EntryFormulary.lengthMaxOf({ pattern: 'label' })).to.eq(40)
      expect(EntryFormulary.lengthMaxOf({ pattern: 'label', max_length: 12 })).to.eq(12)
      expect(EntryFormulary.lengthMaxOf({})).to.eq(3600)
    })

    it("is never past what the pattern allows, whatever the params say", () => {
      expect(EntryFormulary.lengthMaxOf({ pattern: 'label', max_length: 300 })).to.eq(40)
      expect(EntryFormulary.lengthMaxOf({ pattern: 'url' })).to.eq(2000)
    })
  })

  describe('tidyFor', () => {
    it("makes a label of what was typed for one held to the label pattern, and trims any other, per the doc examples", () => {
      expect(EntryFormulary.tidyFor({ pattern: 'label' })('Quiet Otter!')).to.eq('quiet_otter')
      expect(EntryFormulary.tidyFor({ pattern: 'url' })(' https://a.b ')).to.eq('https://a.b')
      expect(EntryFormulary.tidyFor({ lines: 'one' })('  The Otter ')).to.eq('The Otter')
    })
  })

  describe('isOneLine', () => {
    it("is true where a text entry says one line, or a pattern holds it to one, per the doc examples", () => {
      expect(EntryFormulary.isOneLine({ pattern: 'url' })).to.be.true
      expect(EntryFormulary.isOneLine({})).to.be.false
      expect(EntryFormulary.isOneLine({ lines: 'one' })).to.be.true
      expect(EntryFormulary.isOneLine({ lines: 'many' })).to.be.false
    })
  })

  describe('numberBoxOf', () => {
    it("takes a minus sign unless the least is nought or more, and a fraction unless whole, per the doc examples", () => {
      expect(EntryFormulary.numberBoxOf({ min: 0, integer: true }, 3)).to.deep.eq({ signed: false, fractional: false })
      expect(EntryFormulary.numberBoxOf({}, null)).to.deep.eq({ signed: true, fractional: true })
      expect(EntryFormulary.numberBoxOf({ min: -5 }, null)).to.deep.eq({ signed: true, fractional: true })
    })

    it("takes what the cell already holds as it stands, though its params now refuse it", () => {
      expect(EntryFormulary.numberBoxOf({ min: 0, integer: true }, -2.5)).to.deep.eq({ signed: true, fractional: true })
      expect(EntryFormulary.numberBoxOf({ min: 1 }, -4)).to.deep.eq({ signed: true, fractional: true })
      expect(EntryFormulary.numberBoxOf({ integer: true }, 2.5)).to.deep.eq({ signed: true, fractional: true })
    })
  })
})

describe('Formularies.paramsOf', () => {
  it("is an entry's family's validator, and the open record of a formula's or a prompt's, per the doc examples", () => {
    expect(Formularies.paramsOf(entryOf('number')).safeParse({ min: 'one' }).success).to.be.false
    expect(Formularies.paramsOf(Widget.fill({ label: 'shout', formulary: 'jsonata', formula: '$uppercase(question.title)' })).safeParse({ loud: true }).success).to.be.true
  })
})
