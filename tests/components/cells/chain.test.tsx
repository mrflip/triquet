import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import * as EST from 'es-toolkit'
import { ChainPicker } from '../../../src/components/cells/chain'
import { Question, type QuestionT } from '../../../src/models/question'

/** A question titled `title`, shown as `viz` says */
function titled(title: string, viz: QuestionT['viz'] = 'normal'): QuestionT {
  return { ...Question.blank(), title, viz }
}

const leon = titled('Leon')
const anna = titled('Anna', 'secondary')
const gone = titled('Gone', 'archived')
const blank = titled('')
const questions = [leon, anna, gone, blank]

/** The words of each option `question`'s picker offers, in order, the blank first */
function offeredBy(question: QuestionT, among: QuestionT[] = questions): string[] {
  const markup = renderToStaticMarkup(<ChainPicker question={question} questions={among} locked={false} onChain={EST.noop} />)
  return markup.matchAll(/<option[^>]*>([^<]*)<\/option>/g).map((match) => match[1] ?? '').toArray()
}

describe("ChainPicker", () => {
  it("offers every other question but the archived, by its title as shown", () => {
    expect(offeredBy(leon)).to.deep.eq(['— pick —', 'Anna (alt)', '(no title yet)'])
    expect(offeredBy(anna)).to.deep.eq(['— pick —', 'Leon', '(no title yet)'])
  })

  it("offers an archived question only to the picker already chained to it, marked as archived", () => {
    expect(offeredBy({ ...leon, chains_to: gone._id })).to.deep.eq(['— pick —', 'Anna (alt)', 'Gone (archived)', '(no title yet)'])
  })

  it("offers each picker of the quiz the questions as they stand, a retitled one by its new title", () => {
    expect(offeredBy(blank)).to.deep.eq(['— pick —', 'Leon', 'Anna (alt)'])
    const retitled = [{ ...leon, title: 'Leon the Great' }, anna, gone, blank]
    expect(offeredBy(blank, retitled)).to.deep.eq(['— pick —', 'Leon the Great', 'Anna (alt)'])
  })
})
