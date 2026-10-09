import { describe, expect, it } from 'vitest'
import { isSameRowRun, rowRunOf } from '../../src/components/row-runs'
import { specsFor } from '../../src/lib/columns'
import { Column } from '../../src/models/column'
import { SeedWidgets } from '../../src/models/seeds'
import { Widget } from '../../src/models/widget'
import { Widgeted } from '../../src/models/widgeted'
import { Widgeting } from '../../src/models/widgeting'
import type { QuizT } from '../../src/models/quiz'
import { bigQuiz } from '../support/big-quiz'
import { runOf } from '../support/runs'

const Remark = Widget.fill({ label: 'remark', formulary: 'entry', config: { entry_kind: 'text' } })
const Library = [...SeedWidgets, Remark]

/** `quiz` with a text entry worked as `remark`, and a column showing it */
function withRemark(quiz: QuizT): QuizT {
  const remark = Widgeting.fill({ widget_label: 'remark', label: 'remark' })
  return { ...quiz, widgetings: [...quiz.widgetings, remark], columns: [...quiz.columns, Column.fill({ label: 'remark', title: 'Remark', source: 'remark', width_px: 120 })] }
}

const quiz = withRemark(bigQuiz(4))
const run = runOf(quiz, Library)
const specs = specsFor(quiz)
const [first, second] = quiz.questions
if (! first || ! second) { throw new Error('the big quiz has four questions') }

/** Nothing stops a widgeting being asked */
const Askable = () => null

describe('rowRunOf', () => {
  const { cells, bag, faces } = rowRunOf(run, first, specs, quiz.templateable, Askable)

  it("draws a question's own field in its editor, asking nothing again on a double-click", () => {
    expect(cells.clueing).to.deep.eq({ kind: 'field', field: 'clueing', reask: null })
    expect(cells.title).to.deep.eq({ kind: 'field', field: 'title', reask: null })
  })

  it("draws a bot's cell asked from the cell, with what it holds, whether there is anything to ask, and why it cannot be asked", () => {
    expect(cells.guess).to.deep.include({ kind: 'ask', askable: true, notice: null, reask: null })
    expect(cells.guess).to.have.nested.property('widgeted.value.guess', 'Guess 1')
    const refused = rowRunOf(run, first, specs, quiz.templateable, (label) => (label === 'dumdum' ? 'No key for Claude.' : null))
    expect(refused.cells.guess).to.deep.include({ kind: 'ask', notice: 'No key for Claude.' })
  })

  it("draws an entry's cell in its editor, with the entry, its widgeting and what was typed", () => {
    expect(cells.remark).to.deep.include({ kind: 'entry', widget: Remark, widgeted: Widgeted.missing, reask: null })
    expect(cells.remark).to.have.nested.property('widgeting.label', 'remark')
  })

  it("draws a sum as worked out, a double-click asking again the number spotter it reads, of the question or of the one it chains to", () => {
    expect(cells.clueing_full).to.deep.include({ kind: 'widgeted', reask: { widgeting_label: 'numnum_clueing', ofTarget: false } })
    expect(cells.hint_full).to.deep.include({ reask: { widgeting_label: 'numnum_hint', ofTarget: false } })
    expect(cells.butnot_full).to.deep.include({ reask: { widgeting_label: 'numnum_hint', ofTarget: true } })
    expect(cells.clueing_numeral).to.have.property('reask', null)
  })

  it("draws the BUT NOT as the chained-to question's preview, and a collapsed column as nothing", () => {
    expect(cells.butnot).to.deep.eq({ kind: 'butnot', reask: null })
    const collapsed = specsFor({ ...quiz, columns: quiz.columns.map((column) => (column.label === 'clueing_full' ? { ...column, collapsed: true } : column)) })
    expect(rowRunOf(run, first, collapsed, quiz.templateable, Askable).cells.clueing_full).to.deep.eq({ kind: 'collapsed', reask: null })
  })

  it("draws a column with a template by its readout", () => {
    const templated = specsFor({ ...quiz, columns: quiz.columns.map((column) => (column.label === 'clueing_full' ? { ...column, template: 'Sum: {{ value }}' } : column)) })
    expect(rowRunOf(run, first, templated, quiz.templateable, Askable).cells.clueing_full).to.deep.include({ kind: 'drawn', readout: 'markdown' })
  })

  it("holds the question's template bag, and each templated source filled in over it", () => {
    expect(bag?.question_label).to.eq('question_1')
    expect(faces.clueing?.markdown).to.match(/^\*\*Answer 1\*\* was crowned/)
    expect(faces.notes?.markdown).to.eq('Checked against 4 others; see Princes of the Realm.')
  })

  it('holds no bag, and fills nothing, for a quiz that templates nothing', () => {
    const plain = rowRunOf(run, first, specs, [], Askable)
    expect(plain.bag).to.be.null
    expect(plain.faces).to.deep.eq({})
  })
})

describe('isSameRowRun', () => {
  /** The row runs of `question` in `quiz` run, as the grid works them out */
  const rowRunIn = (changed: QuizT, idx: number) => {
    const question = changed.questions[idx]
    if (! question) { throw new Error(`no question ${String(idx)}`) }
    return rowRunOf(runOf(changed, Library), question, specsFor(changed), changed.templateable, Askable)
  }
  const before = rowRunOf(run, first, specs, quiz.templateable, Askable)

  it('is the same for a question whose cells and templated texts came to the same in another run', () => {
    const again = rowRunIn(quiz, 0)
    expect(again.bag).to.not.equal(before.bag)
    expect(isSameRowRun(before, again)).to.be.true
  })

  it("is the same for one question when another's title changes, which none of its templates read", () => {
    const retitled = { ...quiz, questions: quiz.questions.map((question, ii) => (ii === 2 ? { ...question, title: 'Third, retitled' } : question)) }
    expect(isSameRowRun(before, rowRunIn(retitled, 0))).to.be.true
  })

  it("is not the same for a question whose templated text fills in otherwise, its own title read by its clueing", () => {
    const retitled = { ...quiz, questions: quiz.questions.map((question, ii) => (ii === 0 ? { ...question, title: 'First, retitled' } : question)) }
    expect(isSameRowRun(before, rowRunIn(retitled, 0))).to.be.false
  })

  it("is not the same for any question when the quiz's title, which every question's notes read, changes", () => {
    const retitled = { ...quiz, title: 'Kings of the Realm' }
    expect(isSameRowRun(rowRunOf(run, second, specs, quiz.templateable, Askable), rowRunIn(retitled, 1))).to.be.false
  })

  it("is not the same once a cell comes to something else: the question's guess asked again", () => {
    const asked = { ...quiz, questions: quiz.questions.map((question, ii) => (ii === 0 ? { ...question, stored: { ...question.stored, dumdum: { newest: Answered, ok: Answered } } } : question)) }
    expect(isSameRowRun(before, rowRunIn(asked, 0))).to.be.false
  })
})

/** A guess stored afresh */
const Answered = { status: 'ok' as const, value: { guess: 'Prince One', explanation: 'Asked again.' }, message: null, result_meta: {}, _creationTime: 9.5 }
