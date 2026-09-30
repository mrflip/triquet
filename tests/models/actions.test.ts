import { describe, expect, it } from 'vitest'
import * as Z from 'zod'
import { zodToConvex } from 'convex-helpers/server/zod4'
import type { Id } from '../../convex/_generated/dataModel'
import { ActionValidators, isLayoutAction, isReviewAction, LayoutActionKindVals, ReviewActionKindVals, type HuntActionDNA, type AccountActionT } from '../../src/models/actions'

const question_id = 'j97d0qbj35dar1v8edndzckvsx8f828f'
const quiz_id = 'j97d0qbj35dar1v8edndzckvsx8f8299'

/** Dumdum's reply to a question's clueing, as a botting */
const Botted = {
  question_id, bot_label: 'dumdum' as const, textkind: 'clueing' as const, asked_text: 'Who?', status: 'done' as const,
  reply_text: 'Leon', items: [], message: null, response: null, truncated: false, model_tier_applied: 'quick' as const, approx_tokens: 12,
}

/** One of each action, as a view would say it */
const Actions: HuntActionDNA[] = [
  { kind: 'add_widget', widget: { kind: 'botting', label: 'dumdum', bot_label: 'dumdum', textkind: 'clueing' } },
  { kind: 'edit_widget', label: 'dumdum', patch: { description: 'The quick one' } },
  { kind: 'delete_widget', label: 'dumdum' },
  { kind: 'move_widget', label: 'dumdum', onto_idx: 2 },
  { kind: 'add_column', column: { label: 'qnum', title: 'Q#', source: 'question.qnum', width_px: 60 } },
  { kind: 'add_column', column: { label: 'qnum', title: 'Q#', source: 'question.qnum', width_px: 60 }, onto_idx: 0 },
  { kind: 'edit_column', label: 'qnum', patch: { width_px: 80 } },
  { kind: 'delete_column', label: 'qnum' },
  { kind: 'move_column', label: 'qnum', onto_idx: 1 },
  { kind: 'add_expression', expression: { label: 'shout', formula: '$uppercase(qn.title)' } },
  { kind: 'edit_expression', label: 'shout', patch: { formula: '$lowercase(qn.title)' } },
  { kind: 'delete_expression', label: 'shout' },
  { kind: 'retitle_quiz', title: 'Princes' },
  { kind: 'relabel_quiz', label: 'princes' },
  { kind: 'reversion_quiz', version: 'playtest' },
  { kind: 'set_smiths_note', smiths_note: 'Theme: princes.\n\nMeta: their initials.' },
  { kind: 'edit_question', question_id, patch: { clueing: 'Who?', chains_to: null } },
  { kind: 'add_question' },
  { kind: 'delete_questions', question_ids: [question_id] },
  { kind: 'sort_questions', sortkey: 'column:qnum', descending: false },
  { kind: 'renumber_qnums' },
  { kind: 'move_question', question_id, onto_idx: 0 },
  { kind: 'set_chain', question_id, chains_to: null },
  { kind: 'sort_by_chain_order', descending: true },
  { kind: 'record_botting', botting: Botted },
  { kind: 'record_botting', botting: { ...Botted, status: 'error', reply_text: null, message: 'Overloaded', response: { status: 529 }, model_tier_applied: null, approx_tokens: null } },
  { kind: 'apply_bulk_ishes', bottings: [{ ...Botted, bot_label: 'numnum', reply_text: null, items: [{ text: '1994', value: 1994, kind: 'numeral' }] }], run: null },
  { kind: 'new_quiz' },
  { kind: 'new_quiz', label: 'kings' },
  { kind: 'delete_quiz', quiz_id },
  { kind: 'set_lock', quiz_id, locked: true },
  { kind: 'import_questions', questions: [{ label: 'leon', patch: { clueing: 'Who?', chains_to: 'nantes' } }, { label: 'nantes', patch: {} }] },
  { kind: 'open_review', quiz_id },
  { kind: 'set_overall', quiz_id, overall: 'Went well.' },
  { kind: 'set_review_phase', quiz_id, phase: 'shared' },
  { kind: 'set_reviewing', quiz_id, question_id, patch: { get_rate: 40, minutes: 2.5, keep_it: true } },
  { kind: 'peek_answer', quiz_id, question_id },
]

describe('ActionValidators.huntAction', () => {
  it('takes every action a view can say, each of its own kind', () => {
    expect(Actions.map((action) => ActionValidators.huntAction(action).kind)).to.deep.eq(Actions.map((action) => action.kind))
  })

  const Refused: [unknown, string][] = [
    [{ kind: 'burn_it_all' },                                               'an action it does not know'],
    [{ kind: 'retitle_quiz' },                                              'an action missing what it carries'],
    [{ kind: 'relabel_quiz', label: 'Not A Label' },                        'a label that is not one'],
    [{ kind: 'move_question', question_id: 'nobody', onto_idx: 0 },         'a question that is not a row id'],
    [{ kind: 'move_widget', label: 'dumdum', onto_idx: -1 },                'a place before the first'],
    [{ kind: 'record_botting', botting: { ...Botted, textkind: 'hint' } },  'a botting of a bot that is not put that text'],
    [{ kind: 'set_review_phase', quiz_id, phase: 'empty' },                 'moving a review back to empty'],
    [{ kind: 'set_reviewing', quiz_id, question_id, patch: { get_rate: 101 } }, 'a get rate past certain'],
    [{ kind: 'import_questions', questions: [{ label: 'leon', patch: {} }, { label: 'leon', patch: {} }] }, 'an import naming one label twice'],
  ]
  for (const [dna, describes] of Refused) {
    it(`refuses ${describes}`, () => {
      expect(() => ActionValidators.huntAction(dna as never)).to.throw(Z.ZodError)
    })
  }

  it('keeps both kinds\' fields in a widget\'s patch, for the widget\'s own kind to judge', () => {
    const action = ActionValidators.huntAction({ kind: 'edit_widget', label: 'dumdum', patch: { bot_label: 'numnum', expression_label: 'shout' } })
    expect(action).to.deep.include({ patch: { bot_label: 'numnum', expression_label: 'shout' } })
  })

  it('crosses to Convex as a validator of its own', () => {
    expect(zodToConvex(ActionValidators.huntAction as Z.ZodType).kind).to.eq('union')
  })
})

describe('ActionValidators.accountAction', () => {
  it('takes becoming an ident, retitling it, and making a hunt', () => {
    const actions: AccountActionT[] = [{ kind: 'assume_ident', label: 'flip_kromer', title: '' }, { kind: 'retitle_ident', title: 'Flip' }, { kind: 'new_hunt', label: 'quiet_otter' }]
    expect(actions.map((action) => ActionValidators.accountAction(action))).to.deep.eq(actions)
  })

  it('takes retitling and relabelling a hunt, named by its id', () => {
    const hunt_id = 'j97d0qbj35dar1v8edndzckvsx8f82aa' as Id<'hunts'>
    const actions: AccountActionT[] = [{ kind: 'retitle_hunt', hunt_id, title: 'The Autumn Hunt' }, { kind: 'relabel_hunt', hunt_id, label: 'autumn_hunt' }]
    expect(actions.map((action) => ActionValidators.accountAction(action))).to.deep.eq(actions)
  })

  it('refuses relabelling a hunt to something that is not a label', () => {
    expect(() => ActionValidators.accountAction({ kind: 'relabel_hunt', hunt_id: 'j97d0qbj35dar1v8edndzckvsx8f82aa', label: 'Autumn Hunt' })).to.throw(Z.ZodError)
  })

  it('refuses an ident label too short to be one', () => {
    expect(() => ActionValidators.accountAction({ kind: 'assume_ident', label: 'flip', title: '' })).to.throw(Z.ZodError)
  })

  it('refuses retitling an ident to nothing', () => {
    expect(() => ActionValidators.accountAction({ kind: 'retitle_ident', title: '' })).to.throw(Z.ZodError)
  })
})

describe('isLayoutAction', () => {
  it('picks out exactly the actions on widgets, columns and expressions', () => {
    const layout = Actions.map((action) => ActionValidators.huntAction(action)).filter((action) => isLayoutAction(action)).map((action) => action.kind)
    expect([...new Set(layout)]).to.deep.eq([...LayoutActionKindVals])
  })
})

describe("isReviewAction", () => {
  it("picks out exactly the actions on one's own review", () => {
    const reviewing = Actions.map((action) => ActionValidators.huntAction(action)).filter((action) => isReviewAction(action)).map((action) => action.kind)
    expect([...new Set(reviewing)]).to.deep.eq([...ReviewActionKindVals])
  })
})
