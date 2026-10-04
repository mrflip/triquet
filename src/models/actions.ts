import type * as Z from 'zod'
import { Validator } from '../lib/validator'
import * as PA from '../lib/vv/patterns'
import { ColumnValidators } from './column'
import { HuntingValidators } from './hunting'
import { IdentValidators } from './ident'
import { ImportValidators } from './import'
import { QuestionValidators } from './question'
import { QuizValidators } from './quiz'
import { ReviewingValidators } from './reviewing'
import { WidgetValidators } from './widget'
import { WidgetedValidators } from './widgeted'
import { WidgetingValidators } from './widgeting'

/** The actions that revise a quiz's widgetings and columns */
export const LayoutActionKindVals = [
  'add_widgeting', 'edit_widgeting', 'delete_widgeting', 'move_widgeting',
  'add_column', 'edit_column', 'delete_column', 'move_column',
] as const

/** The actions that revise the library: the widgets every hunt shares */
export const LibraryActionKindVals = ['add_widget', 'edit_widget', 'delete_widget', 'move_widget', 'import_widgets'] as const

/** The kinds of action about one's own review of a quiz: what a reviewer may do on a hunt */
export const ReviewActionKindVals = ['open_review', 'set_overall', 'set_review_phase', 'set_reviewing', 'peek_answer'] as const

export const ActionValidators = Validator(({ obj, arr, lit, oneof, discrim, bool, uint, label, titleish, str, zid }) => {
  const open = obj({
    hunt_id:  zid('hunts'),
    realm_id: zid('realms'),
    quiz_id:  zid('quizzes'),
  })
    .describe('The quiz an author has on screen, and the realm and hunt it belongs to: where every action lands.')

  const question_ids = arr(zid('questions')).readonly()

  const layoutAction = [
    obj({ kind: lit('add_widgeting'),     widgeting: WidgetingValidators.widgeting }),
    obj({ kind: lit('edit_widgeting'),    label, patch: WidgetingValidators.widgetingPatch }),
    obj({ kind: lit('delete_widgeting'),  label }),
    obj({ kind: lit('move_widgeting'),    label, onto_idx: uint }),
    obj({ kind: lit('add_column'),        column: ColumnValidators.column, onto_idx: uint.optional() }),
    obj({ kind: lit('edit_column'),       label, patch: ColumnValidators.columnPatch }),
    obj({ kind: lit('delete_column'),     label }),
    obj({ kind: lit('move_column'),       label, onto_idx: uint }),
  ] as const

  const libraryAction = [
    obj({ kind: lit('add_widget'),        widget: WidgetValidators.widget }),
    obj({ kind: lit('edit_widget'),       label, patch: WidgetValidators.widgetPatch }),
    obj({ kind: lit('delete_widget'),     label }),
    obj({ kind: lit('move_widget'),       label, onto_idx: uint }),
    obj({ kind: lit('import_widgets'),    widgets: arr(WidgetValidators.widget).max(PA.WidgetsInLibrary.max).readonly() }),
  ] as const

  const huntAction = discrim('kind', [
    ...layoutAction,
    ...libraryAction,
    obj({ kind: lit('retitle_quiz'),        title: titleish }),
    obj({ kind: lit('relabel_quiz'),        label }),
    obj({ kind: lit('reversion_quiz'),      version: label }),
    obj({ kind: lit('set_smiths_note'),     smiths_note: QuizValidators.smiths_note }),
    obj({ kind: lit('edit_question'),       question_id: zid('questions'), patch: QuestionValidators.questionPatch }),
    obj({ kind: lit('add_question') }),
    obj({ kind: lit('delete_questions'),    question_ids }),
    obj({ kind: lit('sort_questions'),      sortkey: QuizValidators.sortkey, descending: bool }),
    obj({ kind: lit('renumber_qnums') }),
    obj({ kind: lit('move_question'),       question_id: zid('questions'), onto_idx: uint }),
    obj({ kind: lit('set_chain'),           question_id: zid('questions'), chains_to: zid('questions').nullable() }),
    obj({ kind: lit('sort_by_chain_order'), descending: bool }),
    obj({ kind: lit('record_widgeted'),     widgeted: WidgetedValidators.record }),
    obj({ kind: lit('enter_widgeted'),      entered: WidgetedValidators.entered }),
    obj({ kind: lit('new_quiz'),            label: label.optional() }),
    obj({ kind: lit('delete_quiz'),         quiz_id: zid('quizzes') }),
    obj({ kind: lit('set_lock'),            quiz_id: zid('quizzes'), locked: bool }),
    obj({ kind: lit('import_questions'),    questions: ImportValidators.importedQuestions }),
    obj({ kind: lit('open_review'),         quiz_id: zid('quizzes') }),
    obj({ kind: lit('set_overall'),         quiz_id: zid('quizzes'), overall: str }),
    obj({ kind: lit('set_review_phase'),    quiz_id: zid('quizzes'), phase: oneof(['draft', 'shared']) }),
    obj({ kind: lit('set_reviewing'),       quiz_id: zid('quizzes'), question_id: zid('questions'), patch: ReviewingValidators.reviewingPatch }),
    obj({ kind: lit('peek_answer'),         quiz_id: zid('quizzes'), question_id: zid('questions') }),
    obj({ kind: lit('add_hunting'),         ident_label: IdentValidators.identLabel, role: HuntingValidators.role }),
    obj({ kind: lit('remove_hunting'),      ident_id: zid('idents') }),
    obj({ kind: lit('retitle_hunt'),        title: titleish }),
    obj({ kind: lit('relabel_hunt'),        label }),
    obj({ kind: lit('delete_hunt') }),
  ])
    .describe('Everything the author can do from inside a quiz: to it, to its realm\'s quizzes, to the library of widgets, and to who is on the hunt.')

  const accountAction = discrim('kind', [
    obj({ kind: lit('assume_ident'),  label: IdentValidators.identLabel, title: str }),
    obj({ kind: lit('retitle_ident'), title: IdentValidators.title }),
    obj({ kind: lit('new_hunt'),      label }),
    obj({ kind: lit('retitle_hunt'),  hunt_id: zid('hunts'), title: titleish }),
    obj({ kind: lit('relabel_hunt'),  hunt_id: zid('hunts'), label }),
  ])
    .describe('What a visitor can do before any quiz is open: become an ident, retitle the one they are, make a hunt, and retitle or relabel one they smith.')

  return { open, huntAction, accountAction }
})

/** The quiz an author has on screen, and the realm and hunt it belongs to, as the server holds them */
export type OpenQuizT     = Z.output<typeof ActionValidators.open>
/** What the author did from inside a quiz, as a view says it */
export type HuntActionDNA = Z.input<typeof ActionValidators.huntAction>
/** What the author did from inside a quiz, validated */
export type HuntActionT   = Z.output<typeof ActionValidators.huntAction>
/** What the author did to a quiz's widgetings or columns, validated */
export type LayoutActionT = Extract<HuntActionT, { kind: typeof LayoutActionKindVals[number] }>
/** What the author did to the library, validated */
export type LibraryActionT = Extract<HuntActionT, { kind: typeof LibraryActionKindVals[number] }>
/** What the author did to their own review of a quiz, validated */
export type ReviewActionT = Extract<HuntActionT, { kind: typeof ReviewActionKindVals[number] }>
/** What a visitor did before opening any quiz, as a view says it */
export type AccountActionDNA = Z.input<typeof ActionValidators.accountAction>
/** What a visitor did before opening any quiz, validated */
export type AccountActionT = Z.output<typeof ActionValidators.accountAction>

// eslint-disable-next-line sonarjs/todo-tag
// TODO dbpolicy sprint: make this a dispatch pattern

/** Whether `action` is one that revises a quiz's widgetings or columns */
export function isLayoutAction(action: HuntActionT): action is LayoutActionT {
  return (LayoutActionKindVals as readonly string[]).includes(action.kind)
}

/** Whether `action` is one that revises the library */
export function isLibraryAction(action: HuntActionT): action is LibraryActionT {
  return (LibraryActionKindVals as readonly string[]).includes(action.kind)
}

/** Whether `action` is one about the actor's own review of a quiz, which any role on the hunt may take */
export function isReviewAction(action: HuntActionT): action is ReviewActionT {
  return (ReviewActionKindVals as readonly string[]).includes(action.kind)
}
