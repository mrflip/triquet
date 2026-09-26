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
      .to.deep.eq([`c:${target.id}`, `h:${target.id}`])
  })

  it('reads an empty quiz as nothing to do', () => {
    expect(Bulk.bulkTargetsOf([])).to.deep.eq([])
  })
})

describe('bulkLandingsFor', () => {
  it('lands each group on the cell its key names', () => {
    const questions = questionsOf(['Which region?', 'BUT NOT the 1994 film'])
    const question = present(questions[0])
    const targets = Bulk.bulkTargetsOf(questions)
    const landings = Bulk.bulkLandingsFor(targets, replied([
      { key: Bulk.bulkKeyFor(question.id, 'clueing'), items: [] },
      { key: Bulk.bulkKeyFor(question.id, 'hint'), items: oneSpan },
    ]), 1)
    const hintLanding = present(landings.find((landing) => landing.textkind === 'hint'))
    expect(hintLanding.ishes?.status === 'done' && hintLanding.ishes.items).to.deep.eq(oneSpan)
  })

  it('carries no per-cell token figure, because one shared cost split many ways is invented', () => {
    const questions = questionsOf(['Which region?', ''])
    const question = present(questions[0])
    const landings = Bulk.bulkLandingsFor(Bulk.bulkTargetsOf(questions), replied([{ key: Bulk.bulkKeyFor(question.id, 'clueing'), items: oneSpan }]), 1)
    expect(present(landings[0]).ishes).to.not.have.property('approx_tokens')
  })

  it('gives a text the run left out a per-cell failure to carry, and no value to replace what it had', () => {
    const questions = questionsOf(['Which region?', 'BUT NOT the film'])
    const question = present(questions[0])
    const landings = Bulk.bulkLandingsFor(Bulk.bulkTargetsOf(questions), replied([{ key: Bulk.bulkKeyFor(question.id, 'clueing'), items: oneSpan }]), 1)
    const hintLanding = present(landings.find((landing) => landing.textkind === 'hint'))
    expect(hintLanding.ishes).to.eq(null)
    expect(hintLanding.err).to.deep.eq({ message: AskFailureNotices.missingFromRun, response: { ok: false, failurekind: 'missingFromRun' }, at: 1 })
  })

  it('ignores a group for a text that was never asked about', () => {
    const questions = questionsOf(['Which region?', ''])
    const landings = Bulk.bulkLandingsFor(Bulk.bulkTargetsOf(questions), replied([{ key: 'c:someone-else', items: oneSpan }]), 1)
    expect(landings).to.have.length(1)
    expect(present(landings[0]).ishes).to.eq(null)
    expect(present(landings[0]).err?.message).to.eq(AskFailureNotices.missingFromRun)
  })

  it('lands a result unstale, because it was just computed from the text as it stands', () => {
    const questions = questionsOf(['Which region?', ''])
    const question = present(questions[0])
    const landings = Bulk.bulkLandingsFor(Bulk.bulkTargetsOf(questions), replied([{ key: Bulk.bulkKeyFor(question.id, 'clueing'), items: [] }]), 1)
    expect(present(landings[0]).ishes).to.deep.include({ stale: false })
    expect(present(landings[0]).err).to.eq(null)
  })

  it('passes a cut-short run on to every cell it filled', () => {
    const questions = questionsOf(['Which region?', ''])
    const question = present(questions[0])
    const landings = Bulk.bulkLandingsFor(Bulk.bulkTargetsOf(questions), replied([{ key: Bulk.bulkKeyFor(question.id, 'clueing'), items: [] }], true), 1)
    expect(present(landings[0]).ishes).to.deep.include({ truncated: true })
  })
})
