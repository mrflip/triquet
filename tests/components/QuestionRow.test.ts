import { describe, expect, it } from 'vitest'
import * as EST from 'es-toolkit'
import { isSameRowProps, type QuestionRowProps } from '../../src/components/QuestionRow'
import { rowRunOf } from '../../src/components/row-runs'
import { specsFor } from '../../src/lib/columns'
import { NoAsks } from '../../src/state/use-asking'
import { bigQuiz } from '../support/big-quiz'
import { runOf } from '../support/runs'

const quiz = bigQuiz(3)
const specs = specsFor(quiz)
const [question] = quiz.questions
if (! question) { throw new Error('the big quiz has three questions') }

/** A row's props for the first question, in `run` */
const propsIn = (run: ReturnType<typeof runOf>): QuestionRowProps => ({
  question, targetHint: null, locked: false, gripShown: true, checked: null, onCheck: EST.noop, onViz: EST.noop, resizeToken: 0, folded: true,
  onUnfold: EST.noop, idx: 0, count: 3, onMove: EST.noop, onChain: EST.noop, specs, rowRun: rowRunOf(run, question, specs, quiz.templateable, () => null),
  templateable: quiz.templateable, asks: NoAsks, onAsk: EST.noop, onEdit: EST.noop, onEnter: EST.noop,
})

describe('isSameRowProps', () => {
  const props = propsIn(runOf(quiz))

  it('is the same for a row run made again of another run that came to the same, every other prop the very same', () => {
    const again = propsIn(runOf(quiz))
    expect(again.rowRun).to.not.equal(props.rowRun)
    expect(isSameRowProps(props, again)).to.be.true
  })

  it('is not the same once any other prop is another object, however alike', () => {
    expect(isSameRowProps(props, { ...props, question: { ...question } })).to.be.false
    expect(isSameRowProps(props, { ...props, onEdit: () => { /* another function */ } })).to.be.false
  })

  it('is not the same once the grid says something else of the row', () => {
    expect(isSameRowProps(props, { ...props, folded: false })).to.be.false
    expect(isSameRowProps(props, { ...props, idx: 1 })).to.be.false
  })
})
