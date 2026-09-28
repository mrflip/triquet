import { describe, expect, it } from 'vitest'
import * as Bulk from '../../../src/lib/ask/bulk'
import { AskFailureNotices } from '../../../src/lib/notices'
import { Question, type QuestionT } from '../../../src/models/question'
import type { BulkReplyT } from '../../../src/lib/ask/contract'
import { present } from '../../support/present'

/** A quiz from `clueing, hint` pairs */
function questionsOf(...pairs: [string, string][]): QuestionT[] {
  return pairs.map(([clueing, hint]) => ({ ...Question.blank(), clueing, hint }))
}

/** A reply carrying the groups given */
function replied(groups: BulkReplyT['groups'], truncated = false): BulkReplyT {
  return { ok: true, job: 'bulk_ishes', groups, truncated, model_tier_applied: 'careful', approx_tokens: 4200, text_count: groups.length }
}

const oneSpan = [{ text: '1994', value: 1994, kind: 'numeral' as const }]

describe('bulkTargetsOf', () => {
  it('takes every clueing and every hint that has text', () => {
    const questions = questionsOf(['Which region?', 'BUT NOT the film'], ['A second one', 'BUT NOT the other'])
    expect(Bulk.bulkTargetsOf(questions)).to.have.length(4)
  })

  it('leaves out the texts that are empty, so no usage is spent on nothing', () => {
    const questions = questionsOf(['Which region?', ''], ['', ''])
    const targets = Bulk.bulkTargetsOf(questions)
    expect(targets).to.have.length(1)
    expect(present(targets[0]).textkind).to.eq('clueing')
  })

  it('treats whitespace as empty', () => {
    const questions = questionsOf([' '.repeat(3), '\n\n'])
    expect(Bulk.bulkTargetsOf(questions)).to.deep.eq([])
  })

  it('tags each text so its answer can be found again', () => {
    const questions = questionsOf(['Which region?', 'BUT NOT the film'])
    const target = present(questions[0])
    expect(Bulk.bulkTargetsOf(questions).map((each) => each.key))
      .to.deep.eq([`c:${target._id}`, `h:${target._id}`])
  })

  it('reads an empty quiz as nothing to do', () => {
    expect(Bulk.bulkTargetsOf([])).to.deep.eq([])
  })
})

describe('bulkBottingsFor', () => {
  it('lands each group on the cell its key names, as numnum\'s botting of that text', () => {
    const questions = questionsOf(['Which region?', 'BUT NOT the 1994 film'])
    const question = present(questions[0])
    const targets = Bulk.bulkTargetsOf(questions)
    const bottings = Bulk.bulkBottingsFor(targets, replied([
      { key: Bulk.bulkKeyFor(question._id, 'clueing'), items: [] },
      { key: Bulk.bulkKeyFor(question._id, 'hint'), items: oneSpan },
    ]))
    const hintBotting = present(bottings.find((botting) => botting.textkind === 'hint'))
    expect(hintBotting).to.deep.include({ question_id: question._id, bot_label: 'numnum', asked_text: 'BUT NOT the 1994 film', status: 'done', items: oneSpan })
  })

  it('carries no per-cell token figure, because one shared cost split many ways is invented', () => {
    const questions = questionsOf(['Which region?', ''])
    const question = present(questions[0])
    const bottings = Bulk.bulkBottingsFor(Bulk.bulkTargetsOf(questions), replied([{ key: Bulk.bulkKeyFor(question._id, 'clueing'), items: oneSpan }]))
    expect(present(bottings[0]).approx_tokens).to.eq(null)
  })

  it('gives a text the run left out a failure to carry, and no spans to replace what it had', () => {
    const questions = questionsOf(['Which region?', 'BUT NOT the film'])
    const question = present(questions[0])
    const bottings = Bulk.bulkBottingsFor(Bulk.bulkTargetsOf(questions), replied([{ key: Bulk.bulkKeyFor(question._id, 'clueing'), items: oneSpan }]))
    const hintBotting = present(bottings.find((botting) => botting.textkind === 'hint'))
    expect(hintBotting).to.deep.include({ status: 'error', items: [], message: AskFailureNotices.missingFromRun, response: { ok: false, failurekind: 'missingFromRun' } })
  })

  it('ignores a group for a text that was never asked about', () => {
    const questions = questionsOf(['Which region?', ''])
    const bottings = Bulk.bulkBottingsFor(Bulk.bulkTargetsOf(questions), replied([{ key: 'c:someone-else', items: oneSpan }]))
    expect(bottings).to.have.length(1)
    expect(present(bottings[0])).to.deep.include({ status: 'error', message: AskFailureNotices.missingFromRun })
  })

  it('passes a cut-short run on to every cell it filled', () => {
    const questions = questionsOf(['Which region?', ''])
    const question = present(questions[0])
    const bottings = Bulk.bulkBottingsFor(Bulk.bulkTargetsOf(questions), replied([{ key: Bulk.bulkKeyFor(question._id, 'clueing'), items: [] }], true))
    expect(present(bottings[0])).to.deep.include({ truncated: true, model_tier_applied: 'careful' })
  })
})
