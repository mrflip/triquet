import { describe, expect, it } from 'vitest'
import { CollapsedWidthPx, GutterWidthPx, alignAfter, alignOf, columnsShowing, drawnOf, gridWidthPx, headAlignOf, isDrawnByEditor, isTypedInto, qnumSortkeyOf, readoutOf, resolve, shownOf, specFor, specsFor, templatedTextOf, widgetingRemovalRefusal } from '../../src/lib/columns'
import { Column, type ColumnAlign } from '../../src/models/column'
import { classicLayout } from '../support/layouts'
import { Widgeting } from '../../src/models/widgeting'
import { Widget } from '../../src/models/widget'
import { Question, type QuestionT } from '../../src/models/question'
import { Quiz } from '../../src/models/quiz'
import { Widgeted, type JsonT, type WidgetedHistoryT } from '../../src/models/widgeted'
import { runOf } from '../support/runs'
import { present } from '../support/present'

const layout = classicLayout()
const dumdum = Widgeting.fill({ label: 'dumdum', widget_label: 'dumdum' })
const total = Widgeting.fill({ label: 'grand_total', widget_label: 'clueing_full' })
const widgetings = [dumdum, Widgeting.fill({ label: 'numnum_hint', widget_label: 'numnum_hint' }), total]
const columnOf = (source: string, width_px = 100, label = 'tally') => Column.fill({ label, title: 'Col', source, width_px })

/** A cell whose newest row, and newest `ok` row, both hold `value` */
function answered(value: JsonT): WidgetedHistoryT {
  const row = { status: 'ok' as const, value, message: null, result_meta: {}, _creationTime: 1000 }
  return { newest: row, ok: row }
}

/** The alignment the grid draws a column showing `source` with, set to `align` or never set */
const aligned = (source: string, align?: ColumnAlign) => present(specFor({ ...columnOf(source), ...(align && { align }) }, widgetings)).align

/** The spec of a column showing `source`, worked by `formula` when one is given */
const specOf = (source: string, formula?: string) => present(specFor({ ...columnOf(source), ...(formula !== undefined && { formula }) }, widgetings))

describe('resolve', () => {
  it('finds a question field, a view, a key, and a widgeting by its label, whatever widget it works', () => {
    expect(resolve('clueing', widgetings)).to.deep.eq({ kind: 'field', field: 'clueing' })
    expect(resolve('butnot', widgetings)).to.deep.eq({ kind: 'view', view: 'butnot' })
    expect(resolve('rank', widgetings)).to.deep.eq({ kind: 'key', key: 'rank' })
    expect(resolve('grand_total', widgetings)).to.deep.eq({ kind: 'widgeting', widgeting: widgetings[2] })
    expect(resolve('numnum_hint', widgetings)).to.deep.eq({ kind: 'widgeting', widgeting: widgetings[1] })
  })

  it('finds a word at the bag\'s top level, unless a widgeting for each question shadows it, as one before October 2026 did', () => {
    expect(resolve('categories', widgetings)).to.deep.eq({ kind: 'word', word: 'categories' })
    expect(resolve('qns', widgetings)).to.deep.eq({ kind: 'word', word: 'qns' })
    const old = Widgeting.fill({ label: 'categories', widget_label: 'categories' })
    expect(resolve('categories', [old])).to.deep.eq({ kind: 'widgeting', widgeting: old })
  })

  it('finds a widgeting at the tier its ref names, and nothing at the other', () => {
    const playtesters = Widgeting.fill({ label: 'playtesters', widget_label: 'name_list', tier: 'quiz' })
    expect(resolve('quiz.playtesters', [playtesters])).to.deep.eq({ kind: 'widgeting', widgeting: playtesters })
    expect(resolve('playtesters', [playtesters])).to.be.null
    expect(resolve('quiz.grand_total', widgetings)).to.be.null
  })

  it('reads the grammar before October 2026: a field by its prefix, a part as its widgeting', () => {
    expect(resolve('question.clueing', widgetings)).to.deep.eq({ kind: 'field', field: 'clueing' })
    expect(resolve('grand_total.masie', widgetings)).to.deep.eq({ kind: 'widgeting', widgeting: widgetings[2] })
    expect(resolve('gone.masie', widgetings)).to.be.null
  })

  it('finds a field with no widgetings at all', () => {
    expect(resolve('clueing', [])).to.deep.eq({ kind: 'field', field: 'clueing' })
  })

  it('finds nothing for a widgeting the quiz does not have, nor by the widget it works', () => {
    expect(resolve('nowhere', widgetings)).to.be.null
    expect(resolve('clueing_full', widgetings)).to.be.null
  })
})

describe('columnsShowing', () => {
  const quiz = {
    widgetings,
    columns: [
      columnOf('question.title', 100, 'title'),
      columnOf('grand_total', 78, 'grand_total'),
      columnOf('dumdum', 160, 'guess'),
      columnOf('grand_total.masie', 78, 'grand_total_masie'),
      columnOf('gone', 78, 'gone'),
    ],
  }
  const labelsShowing = (label: string) => columnsShowing(quiz, label).map((column) => column.label)

  it("finds every column showing a widgeting, whole or a part of it, in the quiz's order", () => {
    expect(labelsShowing('grand_total')).to.deep.eq(['grand_total', 'grand_total_masie'])
    expect(labelsShowing('dumdum')).to.deep.eq(['guess'])
  })

  it('finds none for a widgeting no column shows, and counts no column showing a field', () => {
    expect(labelsShowing('numnum_hint')).to.deep.eq([])
    expect(labelsShowing('title')).to.deep.eq([])
  })

  it('finds none for a widgeting the quiz does not have, though a column names it', () => {
    expect(labelsShowing('gone')).to.deep.eq([])
  })
})

describe('widgetingRemovalRefusal', () => {
  const quiz = {
    widgetings,
    columns: [
      Column.fill({ label: 'grand_total', title: 'Total', source: 'grand_total', width_px: 78 }),
      Column.fill({ label: 'grand_total_masie', title: '', source: 'grand_total.masie', width_px: 78 }),
      Column.fill({ label: 'guess', title: 'Guess', source: 'dumdum', width_px: 160 }),
    ],
  }

  it('names each column that holds the widgeting back, by its title or, untitled, its label', () => {
    expect(widgetingRemovalRefusal(quiz, 'grand_total')).to.eq('The columns “Total” and “grand_total_masie” still show that widgeting — remove them first.')
    expect(widgetingRemovalRefusal(quiz, 'dumdum')).to.eq('The column “Guess” still shows that widgeting — remove the column first.')
  })

  it('is null for a widgeting no column shows', () => {
    expect(widgetingRemovalRefusal(quiz, 'numnum_hint')).to.be.null
  })
})

describe('specFor', () => {
  const Cases: [string, number, string, boolean, string][] = [
    // source                 width  headkind    sortable  blurb
    ['title',        100,   'plain',    true,     'a title is along the row, and orders the quiz'],
    ['clueing',      330,   'plain',    false,    'prose is not ordered'],
    ['qnum',         60,    'plain',    true,     'Q# orders the quiz'],
    ['butnot',       180,   'plain',    false,    'the chained hint is prose'],
    ['numnum_hint',           170,   'plain',    true,     'a number spotter\'s widgeting orders the quiz, its header along the row'],
    ['dumdum',                160,   'plain',    true,     'a guess is a widgeting like any other'],
    ['grand_total',                 78,    'vertical', true,     'a narrow widgeting column turns its header on its side'],
    ['grand_total',                 100,   'vertical', true,     'a widgeting column a hundred wide is still narrow'],
    ['grand_total',                 180,   'plain',    true,     'a wide widgeting column lays it along the row'],
    ['title',        60,    'plain',    true,     'a narrow field column keeps its header along the row'],
  ]
  for (const [source, width, headkind, isSortable, blurb] of Cases) {
    it(blurb, () => {
      const spec = present(specFor(columnOf(source, width), widgetings))
      expect([spec.headkind, spec.sortkey !== undefined, spec.widthPx]).to.deep.eq([headkind, isSortable, width])
    })
  }

  it('carries the formula, and reads a part before October 2026 as the formula picking it', () => {
    expect(specOf('grand_total', '$.value * 2').formula).to.eq('$.value * 2')
    expect(specOf('grand_total.masie')).to.deep.include({ source: { kind: 'widgeting', widgeting: widgetings[2] }, formula: '$.masie' })
    expect(specOf('grand_total').formula).to.be.null
  })

  it('orders the quiz by what a formula works out, but never by a word the same in every row', () => {
    expect(specOf('clueing', '$length($)').sortkey).to.eq('column:tally')
    expect(specOf('qns', '$count($)').sortkey).to.be.undefined
    expect(specOf('rank').sortkey).to.eq('column:tally')
  })

  it('remembers a sortable column by its label', () => {
    const spec = present(specFor(columnOf('title', 100, 'named'), widgetings))
    expect(spec.sortkey).to.eq('column:named')
  })

  it('is nothing for a column showing a widgeting the quiz does not have', () => {
    expect(specFor(columnOf('nowhere'), widgetings)).to.be.null
  })

  it('names the column in an export by its label', () => {
    const spec = present(specFor(columnOf('title', 100, 'named'), widgetings))
    expect(spec.header).to.eq('named')
  })

  it('carries the column\'s alignment, Q# centered when it says none, and none for any other column that says none', () => {
    expect([aligned('title', 'right'), aligned('qnum'), aligned('qnum', 'left'), aligned('title'), aligned('grand_total')])
      .to.deep.eq(['right', 'center', 'left', null, null])
  })
})

describe('alignOf and headAlignOf', () => {
  const Cases: [string, number, ColumnAlign | undefined, ColumnAlign | null, ColumnAlign, string][] = [
    // source             width  align       alignOf    headAlignOf  blurb
    ['qnum',     60,    undefined,  'center',  'center',    'Q# is centered until it says otherwise'],
    ['qnum',     60,    'right',    'right',   'right',     'Q# set right is right'],
    ['title',    160,   undefined,  null,      'left',      'a field says nothing, its header to the left'],
    ['title',    60,    undefined,  null,      'left',      'a narrow field keeps its header along the row, to the left'],
    ['grand_total',             78,    undefined,  null,      'right',     'a narrow widgeting turns its header, to the right over its numbers'],
    ['grand_total',             180,   undefined,  null,      'left',      'a wide widgeting lays its header along the row, to the left'],
    ['grand_total',             78,    'center',   'center',  'center',    'a turned header follows its column'],
    ['clueing',  330,   'left',     'left',    'left',      'a column set left says so, though left is where it sat'],
  ]
  for (const [source, width, align, aligned, headAligned, blurb] of Cases) {
    it(blurb, () => {
      const column = { ...columnOf(source, width), ...(align && { align }) }
      expect([alignOf(column), headAlignOf(column)]).to.deep.eq([aligned, headAligned])
    })
  }
})

describe('alignAfter', () => {
  it('steps left, center, right, and round to left again', () => {
    expect(['left', 'center', 'right'].map((align) => alignAfter(align as ColumnAlign))).to.deep.eq(['center', 'right', 'left'])
  })
})

describe('specsFor and gridWidthPx', () => {
  const specs = specsFor(layout)

  it('has a spec for every column of the standard layout, in order', () => {
    expect(specs.map((spec) => spec.colkey)).to.deep.eq(layout.columns.map((column) => column.label))
  })

  it('leaves out a column that shows nothing, rather than failing', () => {
    const quiz = { widgetings: [], columns: [columnOf('title'), columnOf('nowhere', 100, 'lost')] }
    expect(specsFor(quiz).map((spec) => spec.colkey)).to.deep.eq(['tally'])
  })

  it('adds the widths up with the grip, so the grid can insist on them', () => {
    expect(gridWidthPx(specs)).to.eq(GutterWidthPx + layout.columns.reduce((acc, column) => acc + column.width_px, 0))
  })

  it('is as wide as the grip alone for a quiz with no columns', () => {
    expect(gridWidthPx([])).to.eq(GutterWidthPx)
  })
})

describe('qnumSortkeyOf', () => {
  it('names the column showing Q#, wherever it is and whatever it is called', () => {
    expect(qnumSortkeyOf({ columns: [columnOf('title'), columnOf('qnum', 60, 'q_number')] })).to.eq('column:q_number')
  })

  it('is null for a quiz that shows no Q#, or shows it only through a formula', () => {
    expect(qnumSortkeyOf({ columns: [columnOf('title')] })).to.be.null
    expect(qnumSortkeyOf({ columns: [{ ...columnOf('qnum'), formula: '$number($)' }] })).to.be.null
  })

  it('names a Q# column written before October 2026', () => {
    expect(qnumSortkeyOf({ columns: [columnOf('question.qnum', 60, 'q_number')] })).to.eq('column:q_number')
  })
})

describe('shownOf', () => {
  const placed = { ...Question.blank(), title: 'Leon', qnum: '2', stored: { cats: answered([{ category: 'art', difficulty: 'easy' }]) } }
  const blank = { ...Question.blank(), title: 'Nantes', qnum: '1' }
  const cats = Widgeting.fill({ label: 'cats', widget_label: 'estimating' })
  const playtesters = Widgeting.fill({ label: 'playtesters', widget_label: 'name_list', tier: 'quiz' })
  const shouted = Widgeting.fill({ label: 'shouted', widget_label: 'shout' })
  const remark = Widgeting.fill({ label: 'remark', widget_label: 'name_list' })
  const library = [
    Widget.fill({ label: 'estimating', formulary: 'entry', config: { entry_kind: 'estimates' } }),
    Widget.fill({ label: 'name_list', formulary: 'entry', config: { entry_kind: 'text' } }),
    Widget.fill({ label: 'shout', formulary: 'jsonata', formula: '$error("no")' }),
  ]
  const quiz = { ...Quiz.blank('Shown'), questions: [placed, blank], widgetings: [cats, playtesters, shouted, remark], stored: { playtesters: answered('Ada and Grace') } }
  const run = runOf(quiz, library)
  /** What a column showing `source`, worked by `formula`, shows for `question` */
  const shown = (source: string, formula: string | null, question: QuestionT = placed, templateable: string[] = []) => {
    const spec = present(specFor({ ...columnOf(source), ...(formula !== null && { formula }) }, quiz.widgetings))
    return shownOf(spec, run, templateable, question._id)
  }

  it("is, with no formula, a widgeting's widgeted as the run has it, and anything else as it is, ok", () => {
    expect(shown('cats', null)).to.deep.eq(Widgeted.ok([{ category: 'art', difficulty: 'easy' }]))
    expect(shown('quiz.playtesters', null)).to.deep.eq(Widgeted.ok('Ada and Grace'))
    expect(shown('title', null)).to.deep.eq(Widgeted.ok('Leon'))
    expect(shown('rank', null)).to.deep.eq(Widgeted.ok(2))
    expect(shown('hunt', null).value).to.deep.include({ label: 'deep_lake' })
  })

  it('works a formula over the whole widgeted, its parts beside its status and value', () => {
    expect(Number(shown('cats', '$.artie').value).toFixed(2)).to.eq('0.90')
    expect(shown('cats', '$.status')).to.deep.eq(Widgeted.ok('ok'))
    expect(shown('quiz.playtesters', '$uppercase($.value)')).to.deep.eq(Widgeted.ok('ADA AND GRACE'))
  })

  it('passes a widgeted that is not ok by, the dash and the badge with it', () => {
    expect(shown('remark', '$.value', blank)).to.deep.eq(Widgeted.missing)
    expect(shown('shouted', '$.value', blank).status).to.eq('errored')
  })

  it("works on an empty category-estimate cell, whose parts read it as no category in particular, at medium", () => {
    expect(shown('cats', '$.artie', blank)).to.deep.eq(Widgeted.ok(0.525))
  })

  it('works a formula over a field, a key or a word, which has no status', () => {
    expect(shown('title', '$uppercase($)')).to.deep.eq(Widgeted.ok('LEON'))
    expect(shown('rank', '$ * 10', blank)).to.deep.eq(Widgeted.ok(10))
    expect(shown('qns', '$count($)')).to.deep.eq(Widgeted.ok(2))
  })

  it("reads a formula's outcome as a formula widget's: nothing is missing, a failure errored", () => {
    expect(shown('title', 'nope')).to.deep.eq(Widgeted.missing)
    expect(shown('title', '$error("no")').status).to.eq('errored')
    expect(shown('title', '$sum(').status).to.eq('errored')
  })

  it('stops a formula that will not stop once, every later question reading the same failure', () => {
    const forever = '($loop := function($x) { $loop($x) }; $loop($))'
    const [first, second] = [shown('title', forever), shown('title', forever, blank)]
    expect(first.status).to.eq('errored')
    expect(second).to.eq(first)
  })

  it('reads a templateable source filled in', () => {
    const filled = { ...placed, clueing: 'By {{ qn.title }}' }
    const templated = runOf({ ...quiz, questions: [filled, blank] }, library)
    const spec = { ...present(specFor({ ...columnOf('clueing'), formula: '$' }, quiz.widgetings)) }
    expect(shownOf(spec, templated, ['clueing'], filled._id)).to.deep.eq(Widgeted.ok('By Leon'))
    expect(shownOf(spec, templated, [], filled._id)).to.deep.eq(Widgeted.ok('By {{ qn.title }}'))
  })
})

describe('specFor: the later stages', () => {
  it('carries the template, the readout and the collapse, each absent as null or not collapsed', () => {
    const spec = present(specFor({ ...columnOf('grand_total'), template: '{{ value }}%', readout: 'code' }, widgetings))
    expect([spec.template, spec.readout, spec.collapsed]).to.deep.eq(['{{ value }}%', 'code', false])
    expect([specOf('grand_total').template, specOf('grand_total').readout]).to.deep.eq([null, null])
  })

  it('draws a collapsed column narrow, with its turned header, its own width kept on the column', () => {
    const column = { ...columnOf('clueing', 330), collapsed: true }
    const spec = present(specFor(column, widgetings))
    expect([spec.collapsed, spec.widthPx, spec.headkind, column.width_px]).to.deep.eq([true, CollapsedWidthPx, 'vertical', 330])
    expect(gridWidthPx([spec])).to.eq(GutterWidthPx + CollapsedWidthPx)
  })

  it('keeps a collapsed column sortable, as the sort memory is the quiz\'s, not the screen\'s', () => {
    const spec = present(specFor({ ...columnOf('title'), collapsed: true }, widgetings))
    expect(spec.sortkey).to.eq('column:tally')
  })
})

describe('isTypedInto', () => {
  const Cases: [string | null, string | null, boolean, string][] = [
    // formula            template          typed   blurb
    [null,                null,             true,   'with neither a formula nor a template, its cells are typed into'],
    ['$round($.value)',   null,             false,  'a rounded number has no inverse to type into'],
    [null,                '{{ value }}%',   false,  'a value dressed by a template is not typed into either'],
    ['$',                 null,             false,  '`$` is a formula, not identity'],
  ]
  for (const [formula, template, typed, blurb] of Cases) {
    it(blurb, () => {
      expect(isTypedInto({ formula, template })).to.eq(typed)
    })
  }
})

describe('readoutOf', () => {
  it('is what the column says, or markdown for a template, or null for the cells to choose', () => {
    expect(readoutOf({ readout: 'code', template: '{{ value }}' })).to.eq('code')
    expect(readoutOf({ readout: null, template: '{{ value }}' })).to.eq('markdown')
    expect(readoutOf({ readout: null, template: null })).to.be.null
    expect(readoutOf({ readout: 'plain', template: null })).to.eq('plain')
  })
})

/** A column's stages as `isDrawnByEditor` reads them */
function stagesOf(source: Parameters<typeof isDrawnByEditor>[0]['source'], formula: string | null = null, template: string | null = null) {
  return { source, formula, template }
}

describe('isDrawnByEditor', () => {
  const entry = Widget.fill({ label: 'jottings', formulary: 'entry', config: { entry_kind: 'text' } })
  const formula = Widget.fill({ label: 'clueing_full', formulary: 'jsonata', formula: '1' })
  const bot = Widget.fill({ label: 'guesser', formulary: 'aibot', formula: 'Guess', config: { servicelabel: 'claude', model_tier: 'quick', max_tokens: 500 } })
  const remark = Widgeting.fill({ label: 'remark', widget_label: 'jottings' })
  const quizRemark = Widgeting.fill({ label: 'remark', widget_label: 'jottings', tier: 'quiz' })

  it("draws a question's field, an entry's cell and a bot's asked cell in their editors while typed into", () => {
    expect(isDrawnByEditor(stagesOf({ kind: 'field', field: 'clueing' }), null)).to.be.true
    expect(isDrawnByEditor(stagesOf({ kind: 'widgeting', widgeting: remark }), entry)).to.be.true
    expect(isDrawnByEditor(stagesOf({ kind: 'widgeting', widgeting: dumdum }), bot)).to.be.true
  })

  it('draws them read-only once a formula or a template works on them: the editability rule, pills and new cells alike', () => {
    expect(isDrawnByEditor(stagesOf({ kind: 'field', field: 'clueing' }, '$uppercase($)'), null)).to.be.false
    expect(isDrawnByEditor(stagesOf({ kind: 'widgeting', widgeting: remark }, null, '**{{ value }}**'), entry)).to.be.false
  })

  it("never draws a formula's widgeting, a view, a key, a word, a quiz-wide widgeting or an unknown widget by an editor", () => {
    expect(isDrawnByEditor(stagesOf({ kind: 'widgeting', widgeting: total }), formula)).to.be.false
    expect(isDrawnByEditor(stagesOf({ kind: 'view', view: 'butnot' }), null)).to.be.false
    expect(isDrawnByEditor(stagesOf({ kind: 'key', key: 'rank' }), null)).to.be.false
    expect(isDrawnByEditor(stagesOf({ kind: 'word', word: 'quiz' }), null)).to.be.false
    expect(isDrawnByEditor(stagesOf({ kind: 'widgeting', widgeting: quizRemark }), entry)).to.be.false
    expect(isDrawnByEditor(stagesOf({ kind: 'widgeting', widgeting: remark }), null)).to.be.false
  })
})

describe('drawnOf and templatedTextOf', () => {
  const placed = { ...Question.blank(), title: 'Leon', qnum: '2', clueing: 'By {{ qn.title }}', stored: { cats: answered([{ category: 'art', difficulty: 'easy' }]), remark: answered('![map](https://host/m.png)') } }
  const blank = { ...Question.blank(), title: 'Nantes', qnum: '1' }
  const cats = Widgeting.fill({ label: 'cats', widget_label: 'estimating' })
  const remark = Widgeting.fill({ label: 'remark', widget_label: 'jottings' })
  const pictured = Widgeting.fill({ label: 'pictured', widget_label: 'picture' })
  const library = [
    Widget.fill({ label: 'estimating', formulary: 'entry', config: { entry_kind: 'estimates' } }),
    Widget.fill({ label: 'jottings', formulary: 'entry', config: { entry_kind: 'text' } }),
    Widget.fill({ label: 'picture', formulary: 'jsonata', formula: '"![map](https://host/m.png)"' }),
  ]
  const quiz = { ...Quiz.blank('Drawn'), questions: [placed, blank], widgetings: [cats, remark, pictured] }
  const run = runOf(quiz, library)
  type Stages = { formula?: string, template?: string, readout?: 'plain' | 'markdown' | 'code' | 'label' }
  const specWith = (source: string, stages: Stages) => present(specFor({ ...columnOf(source), ...stages }, quiz.widgetings))
  const drawn = (source: string, stages: Stages, question: QuestionT = placed, templateable: string[] = []) => drawnOf(specWith(source, stages), run, templateable, question._id)

  it("fills the template over the question's bag, what the formula came to as `value`", () => {
    expect(drawn('cats', { formula: '$round($.artie * 100)', template: '{{ value }}% for {{ qn.title }}' }).text).to.eq('90% for Leon')
    expect(drawn('title', { template: '**{{ value }}**' })).to.deep.eq({ widgeted: Widgeted.ok('Leon'), text: '**Leon**', issue: null })
  })

  it("is, with no template, the value's own text", () => {
    expect(drawn('rank', {}).text).to.eq('2')
    expect(drawn('cats', { formula: '$.estimates' }).text).to.eq('[{"category":"art","difficulty":"easy"}]')
  })

  it('passes a value that is not ok by the template, with no text, so the dash and the badge show', () => {
    expect(drawn('remark', { template: 'Said: {{ value }}' }, blank)).to.deep.eq({ widgeted: Widgeted.missing, text: '', issue: null })
    expect(drawn('title', { formula: '$error("no")', template: '{{ value }}' }).widgeted.status).to.eq('errored')
  })

  it('says why a template could not be filled in, its text then the template as typed', () => {
    const { text, issue } = drawn('title', { template: '{% if value %}' })
    expect([text, issue]).to.deep.eq(['{% if value %}', 'tag {% if value %} not closed, line:1, col:1'])
  })

  it('reads the templateable sources filled in, as the finished bag holds them', () => {
    expect(drawn('title', { template: '{{ qn.clueing }}' }, placed, ['clueing']).text).to.eq('By Leon')
    expect(drawn('title', { template: '{{ qn.clueing }}' }, placed, []).text).to.eq('By {{ qn.title }}')
  })

  it("makes the images of a formula's value links when drawn as markdown, and only then", () => {
    expect(drawn('pictured', { readout: 'markdown' }).text).to.eq('&#33;[map](https://host/m.png)')
    expect(drawn('pictured', { template: 'See {{ value }}' }).text).to.eq('See &#33;[map](https://host/m.png)')
    expect(drawn('pictured', { readout: 'code' }).text).to.eq('![map](https://host/m.png)')
  })

  it('leaves the images of typed text as they are', () => {
    expect(drawn('remark', { readout: 'markdown' }).text).to.eq('![map](https://host/m.png)')
  })

  it("carries the template's text into a sheet, its images as typed", () => {
    expect(templatedTextOf(specWith('pictured', { template: 'See {{ value }}' }), run, [], placed._id)).to.eq('See ![map](https://host/m.png)')
    expect(templatedTextOf(specWith('cats', { formula: '$round($.artie * 100)', template: '{{ value }}%' }), run, [], placed._id)).to.eq('90%')
  })

  it('is the same object the second time it is asked, made once per run', () => {
    const spec = specWith('title', { template: '{{ value }}!' })
    expect(drawnOf(spec, run, [], placed._id)).to.eq(drawnOf(spec, run, [], placed._id))
  })

  it('leaves what the column came to, for the sorts, to the formula alone', () => {
    const spec = specWith('cats', { formula: '$round($.artie * 100)', template: '{{ value }}%' })
    expect(shownOf(spec, run, [], placed._id)).to.deep.eq(Widgeted.ok(90))
  })
})
