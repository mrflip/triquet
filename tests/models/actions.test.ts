import { describe, expect, it } from 'vitest'
import * as Z from 'zod'
import { zodToConvex } from 'convex-helpers/server/zod4'
import type { Id } from '../../convex/_generated/dataModel'
import { CategoryLabelVals } from '../../src/models/category'
import { ActionValidators, isLayoutAction, LayoutActionKindVals, type HuntActionDNA, type AccountActionT, type LibraryActionDNA } from '../../src/models/actions'

const question_id = 'j97d0qbj35dar1v8edndzckvsx8f828f'
const quiz_id = 'j97d0qbj35dar1v8edndzckvsx8f8299'

/** Dumdum's answer to a question, as a widgeted to record */
const Answered = {
  question_id, widgeting_label: 'dumdum', status: 'ok' as const,
  value: { guess: 'Leon', explanation: 'The name says so.' }, result_meta: { model_tier_applied: 'quick', approx_tokens: 12 },
}

/** A widget of the library */
const Shout = { label: 'shout', formulary: 'jsonata' as const, formula: '$uppercase(qn.title)' }

/** One of each action, as a view would say it */
const Actions: HuntActionDNA[] = [
  { kind: 'add_widgeting', widgeting: { widget_label: 'dumdum', label: 'dumdum' } },
  { kind: 'edit_widgeting', label: 'dumdum', patch: { description: 'The quick one' } },
  { kind: 'delete_widgeting', label: 'dumdum' },
  { kind: 'move_widgeting', label: 'dumdum', onto_idx: 2 },
  { kind: 'add_column', column: { label: 'qnum', title: 'Q#', source: 'qnum', width_px: 60 } },
  { kind: 'add_column', column: { label: 'qnum', title: 'Q#', source: 'qnum', width_px: 60 }, onto_idx: 0 },
  { kind: 'edit_column', label: 'qnum', patch: { width_px: 80 } },
  { kind: 'delete_column', label: 'qnum' },
  { kind: 'move_column', label: 'qnum', onto_idx: 1 },
  { kind: 'set_templateable', templateable: ['clueing', 'recap', 'dumdum'] },
  { kind: 'set_templateable', templateable: [] },
  { kind: 'retitle_quiz', title: 'Princes' },
  { kind: 'relabel_quiz', label: 'princes' },
  { kind: 'set_smiths_note', smiths_note: 'Theme: princes.\n\nMeta: their initials.' },
  { kind: 'set_q1_preamble', q1_preamble: 'Read the note![br]' },
  { kind: 'set_recap_head', recap_head: 'Thanks to {{quiz.playtesters}}!' },
  { kind: 'set_recap_tail', recap_tail: '' },
  { kind: 'set_recap_template', recap_template: '{{recap_head}}\n\n{{#played}}{{number}}. {{title}}\n{{/played}}' },
  { kind: 'set_recap_template', recap_template: null },
  { kind: 'edit_question', question_id, patch: { clueing: 'Who?', chains_to: null } },
  { kind: 'edit_question', question_id, patch: { recap: 'Leon was his pen name.' } },
  { kind: 'add_question' },
  { kind: 'delete_questions', question_ids: [question_id] },
  { kind: 'sort_questions', sortkey: 'column:qnum', descending: false, question_ids: [] },
  { kind: 'renumber_qnums' },
  { kind: 'move_question', question_id, onto_idx: 0 },
  { kind: 'set_chain', question_id, chains_to: null },
  { kind: 'sort_by_chain_order', descending: true },
  { kind: 'record_widgeted', widgeted: Answered },
  { kind: 'record_widgeted', widgeted: { ...Answered, status: 'errored', value: null, message: 'Overloaded', result_meta: { response: { status: 529 } } } },
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

/** One of each action on the library, as a view would say it */
const LibraryActions: LibraryActionDNA[] = [
  { kind: 'add_widget', widget: Shout },
  { kind: 'edit_widget', label: 'shout', patch: { formula: '$lowercase(qn.title)' } },
  { kind: 'delete_widget', label: 'shout' },
  { kind: 'move_widget', label: 'shout', onto_idx: 2 },
  { kind: 'import_widgets', widgets: [Shout, { label: 'ask_it', formulary: 'aibot', formula: '{{clueing}}?', config: { servicelabel: 'claude', model_tier: 'quick', max_tokens: 64 } }] },
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
    [{ kind: 'record_widgeted', widgeted: { ...Answered, message: 'No.' } }, 'an ok widgeted carrying a failure'],
    [{ kind: 'record_widgeted', widgeted: { ...Answered, status: 'missing' } }, 'a missing widgeted, which is never recorded'],
    [{ kind: 'add_widgeting', widgeting: { widget_label: 'notes', label: 'notes' } }, 'a widgeting under a label the questions already use'],
    [{ kind: 'add_widgeting', widgeting: { widget_label: 'recap', label: 'recap' } }, 'a widgeting labelled as the recap a question now has'],
    [{ kind: 'add_widgeting', widgeting: { widget_label: 'dumdum', label: 'dumdum', tier: 'realm' } }, 'a widgeting at a tier that is neither a question nor a quiz'],
    [{ kind: 'set_templateable', templateable: ['qnum'] },              'templating a question field that holds no markdown'],
    [{ kind: 'set_templateable', templateable: ['butnot'] },            'templating a view of a question, which nobody writes'],
    [{ kind: 'set_templateable', templateable: ['dumdum.average'] },             'templating one part of a widgeting'],
    [{ kind: 'set_templateable', templateable: ['question.notes'] },             'templating a question field as the grammar before October 2026 named it'],
    [{ kind: 'set_templateable', templateable: ['dumdum', 'dumdum'] },           'templating one source twice'],
    [{ kind: 'set_recap_head', recap_head: 'x'.repeat(20_001) },           'a recap head past 20,000 characters'],
    [{ kind: 'set_recap_template', recap_template: '  \n' },              'a blank recap template, which null says'],
    [{ kind: 'add_widget', widget: Shout },                                 "an action on the library, which is the library's own"],
    [{ kind: 'set_review_phase', quiz_id, phase: 'empty' },                 'moving a review back to empty'],
    [{ kind: 'set_reviewing', quiz_id, question_id, patch: { get_rate: 101 } }, 'a get rate past certain'],
    [{ kind: 'import_questions', questions: [{ label: 'leon', patch: {} }, { label: 'leon', patch: {} }] }, 'an import naming one label twice'],
  ]
  for (const [dna, describes] of Refused) {
    it(`refuses ${describes}`, () => {
      expect(() => ActionValidators.huntAction(dna as never)).to.throw(Z.ZodError)
    })
  }

  it("defaults a recorded widgeted's message and result_meta", () => {
    const action = ActionValidators.huntAction({ kind: 'record_widgeted', widgeted: { question_id, widgeting_label: 'dumdum', status: 'ok', value: 3 } })
    expect(action).to.deep.include({ widgeted: { question_id, widgeting_label: 'dumdum', status: 'ok', value: 3, message: null, result_meta: {} } })
  })

  it('crosses to Convex as a validator of its own', () => {
    expect(zodToConvex(ActionValidators.huntAction as Z.ZodType).kind).to.eq('union')
  })
})

describe('ActionValidators.libraryAction', () => {
  it('takes every action on the library a view can say, each of its own kind', () => {
    expect(LibraryActions.map((action) => ActionValidators.libraryAction(action).kind)).to.deep.eq(LibraryActions.map((action) => action.kind))
  })

  const Refused: [unknown, string][] = [
    [{ kind: 'move_widget', label: 'dumdum', onto_idx: -1 },           'a place before the first'],
    [{ kind: 'add_widget', widget: { ...Shout, formulary: 'entry' } }, 'a widget of a formulary there is not yet'],
    [{ kind: 'add_widgeting', widgeting: { widget_label: 'dumdum', label: 'dumdum' } }, "an action on a quiz, which is the quiz's own"],
  ]
  for (const [dna, describes] of Refused) {
    it(`refuses ${describes}`, () => {
      expect(() => ActionValidators.libraryAction(dna as never)).to.throw(Z.ZodError)
    })
  }

  it("takes either formulary's settings in a widget's patch, for the widget's own formulary to judge", () => {
    const action = ActionValidators.libraryAction({ kind: 'edit_widget', label: 'dumdum', patch: { config: { servicelabel: 'claude', model_tier: 'careful', max_tokens: 500 } } })
    expect(action).to.deep.include({ patch: { config: { servicelabel: 'claude', model_tier: 'careful', max_tokens: 500 } } })
    expect(ActionValidators.libraryAction({ kind: 'edit_widget', label: 'shout', patch: { config: {} } })).to.deep.include({ patch: { config: {} } })
  })

  it('crosses to Convex as a validator of its own', () => {
    expect(zodToConvex(ActionValidators.libraryAction as Z.ZodType).kind).to.eq('union')
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

  it("takes arranging a hunt's categories, holes and all", () => {
    const hunt_id = 'j97d0qbj35dar1v8edndzckvsx8f82aa' as Id<'hunts'>
    const action: AccountActionT = { kind: 'arrange_categories', hunt_id, wheel: [null, ...CategoryLabelVals.slice(1)] }
    expect(ActionValidators.accountAction(action)).to.deep.eq(action)
  })

  it("takes putting a hunt on another branch, and refuses a branch that is not a label", () => {
    const hunt_id = 'j97d0qbj35dar1v8edndzckvsx8f82aa' as Id<'hunts'>
    const action: AccountActionT = { kind: 'rebranch_hunt', hunt_id, branch: 'playtest' }
    expect(ActionValidators.accountAction(action)).to.deep.eq(action)
    expect(() => ActionValidators.accountAction({ ...action, branch: 'Play Test' })).to.throw(Z.ZodError)
  })

  it("refuses arranging a hunt's categories with one category in two slots", () => {
    const wheel = CategoryLabelVals.map((label, idx) => (idx === 3 ? 'tv' : label))
    expect(() => ActionValidators.accountAction({ kind: 'arrange_categories', hunt_id: 'j97d0qbj35dar1v8edndzckvsx8f82aa', wheel })).to.throw(Z.ZodError)
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

  it("takes a blank title on assuming an ident, which then goes by its label, but not one that is not a title", () => {
    expect(ActionValidators.accountAction({ kind: 'assume_ident', label: 'flip_kromer', title: '' })).to.deep.eq({ kind: 'assume_ident', label: 'flip_kromer', title: '' })
    expect(() => ActionValidators.accountAction({ kind: 'assume_ident', label: 'flip_kromer', title: 'Flip\u{0}Kromer' })).to.throw(Z.ZodError)
    expect(() => ActionValidators.accountAction({ kind: 'assume_ident', label: 'flip_kromer', title: 'F'.repeat(83) })).to.throw(Z.ZodError)
  })
})

describe('ActionValidators.huntAction, refusing at the door', () => {
  it("refuses a review's overall that is not prose: a control character, or past a note's length", () => {
    const quiz_id = 'j97d0qbj35dar1v8edndzckvsx8f828f' as Id<'quizzes'>
    expect(() => ActionValidators.huntAction({ kind: 'set_overall', quiz_id, overall: 'Went\u{7} well.' })).to.throw(Z.ZodError)
    expect(() => ActionValidators.huntAction({ kind: 'set_overall', quiz_id, overall: 'x'.repeat(3601) })).to.throw(Z.ZodError)
  })

  it("refuses deleting more questions at once than a quiz may hold", () => {
    const question_ids = Array.from({ length: 1000 }, () => 'j97d0qbj35dar1v8edndzckvsx8f828f' as Id<'questions'>)
    expect(() => ActionValidators.huntAction({ kind: 'delete_questions', question_ids })).to.throw(Z.ZodError)
  })
})

describe('isLayoutAction', () => {
  it("picks out exactly the actions on a quiz's widgetings and columns, and what it templates", () => {
    const layout = Actions.map((action) => ActionValidators.huntAction(action)).filter((action) => isLayoutAction(action)).map((action) => action.kind)
    expect([...new Set(layout)]).to.deep.eq([...LayoutActionKindVals])
  })
})

