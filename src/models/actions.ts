import type * as Z from 'zod'
import { Validator } from '../lib/validator'
import { TextkindVals } from '../lib/ask/contract'
import { AskValidators } from './ask'
import { ColumnValidators } from './column'
import { ExpressionValidators } from './expression'
import { GuessValidators } from './guess'
import { IdentValidators } from './ident'
import { IshValidators } from './ish'
import { QuestionValidators } from './question'
import { QuizValidators } from './quiz'
import { ReviewingValidators } from './reviewing'
import { WidgetValidators } from './widget'

/** The actions that revise a quiz's widgets and columns, or the hunt's expressions */
export const LayoutActionKindVals = [
  'add_widget', 'edit_widget', 'delete_widget', 'move_widget',
  'add_column', 'edit_column', 'delete_column', 'move_column',
  'add_expression', 'edit_expression', 'delete_expression',
] as const

export const ActionValidators = Validator(({ obj, arr, lit, oneof, discrim, bool, uint, label, titleish, str, zid }) => {
  const textkind = oneof(TextkindVals)

  const open = obj({
    hunt_id:  zid('hunts'),
    realm_id: zid('realms'),
    quiz_id:  zid('quizzes'),
  })
    .describe('The quiz an author has on screen, and the realm and hunt it belongs to: where every action lands.')

  // A widget's patch is checked against the kind of the widget it revises, which only the rows
  // know; on the way in it may carry the fields of either kind.
  const widgetPatch = obj({ ...WidgetValidators.expressingPatch.shape, ...WidgetValidators.bottingPatch.shape })

  const question_ids = arr(zid('questions')).readonly()

  const bulkLanding = obj({
    question_id: zid('questions'),
    textkind,
    ishes:       IshValidators.ishesDone.nullable(),
    err:         AskValidators.lastErr.nullable(),
  })
    .describe('Where one text\'s answer lands when a combined run comes back: the extraction, or the failure to ride along on whatever the cell holds.')

  const layoutAction = [
    obj({ kind: lit('add_widget'),        widget: WidgetValidators.widget }),
    obj({ kind: lit('edit_widget'),       label, patch: widgetPatch }),
    obj({ kind: lit('delete_widget'),     label }),
    obj({ kind: lit('move_widget'),       label, onto_idx: uint }),
    obj({ kind: lit('add_column'),        column: ColumnValidators.column, onto_idx: uint.optional() }),
    obj({ kind: lit('edit_column'),       label, patch: ColumnValidators.columnPatch }),
    obj({ kind: lit('delete_column'),     label }),
    obj({ kind: lit('move_column'),       label, onto_idx: uint }),
    obj({ kind: lit('add_expression'),    expression: ExpressionValidators.expression }),
    obj({ kind: lit('edit_expression'),   label, patch: ExpressionValidators.expressionPatch }),
    obj({ kind: lit('delete_expression'), label }),
  ] as const

  const huntAction = discrim('kind', [
    ...layoutAction,
    obj({ kind: lit('retitle_quiz'),        title: titleish }),
    obj({ kind: lit('relabel_quiz'),        label }),
    obj({ kind: lit('reversion_quiz'),      version: label }),
    obj({ kind: lit('edit_question'),       question_id: zid('questions'), patch: QuestionValidators.questionPatch }),
    obj({ kind: lit('add_question') }),
    obj({ kind: lit('delete_questions'),    question_ids }),
    obj({ kind: lit('sort_questions'),      sortkey: QuizValidators.sortkey, descending: bool }),
    obj({ kind: lit('renumber_qnums') }),
    obj({ kind: lit('move_question'),       question_id: zid('questions'), onto_idx: uint }),
    obj({ kind: lit('set_chain'),           question_id: zid('questions'), chains_to: zid('questions').nullable() }),
    obj({ kind: lit('sort_by_chain_order'), descending: bool }),
    obj({ kind: lit('set_guess'),           question_id: zid('questions'), guess: GuessValidators.guess }),
    obj({ kind: lit('set_ishes'),           question_id: zid('questions'), textkind, ishes: IshValidators.ishes }),
    obj({ kind: lit('fail_guess'),          question_id: zid('questions'), err: AskValidators.lastErr }),
    obj({ kind: lit('fail_ishes'),          question_id: zid('questions'), textkind, err: AskValidators.lastErr }),
    obj({ kind: lit('apply_bulk_ishes'),    landings: arr(bulkLanding).readonly(), run: QuizValidators.bulkIshesRun }),
    obj({ kind: lit('new_quiz'),            label: label.optional() }),
    obj({ kind: lit('delete_quiz'),         quiz_id: zid('quizzes') }),
    obj({ kind: lit('set_lock'),            quiz_id: zid('quizzes'), locked: bool }),
    obj({ kind: lit('replace_open_quiz'),   quiz: QuizValidators.quiz }),
    obj({ kind: lit('open_review'),         quiz_id: zid('quizzes') }),
    obj({ kind: lit('set_overall'),         quiz_id: zid('quizzes'), overall: str }),
    obj({ kind: lit('set_review_phase'),    quiz_id: zid('quizzes'), phase: oneof(['draft', 'shared']) }),
    obj({ kind: lit('set_reviewing'),       quiz_id: zid('quizzes'), question_id: zid('questions'), patch: ReviewingValidators.reviewingPatch }),
    obj({ kind: lit('peek_answer'),         quiz_id: zid('quizzes'), question_id: zid('questions') }),
  ])
    .describe('Everything the author can do from inside a quiz: to it, to its realm\'s quizzes, and to its hunt\'s expressions.')

  const accountAction = discrim('kind', [
    obj({ kind: lit('assume_ident'), label: IdentValidators.identLabel, title: str }),
    obj({ kind: lit('new_hunt'),     label }),
  ])
    .describe('What a visitor can do before any quiz is open: become an ident, and make a hunt.')

  return { open, huntAction, accountAction }
})

/** The quiz an author has on screen, and the realm and hunt it belongs to, as the server holds them */
export type OpenQuizT     = Z.output<typeof ActionValidators.open>
/** What the author did from inside a quiz, as a view says it */
export type HuntActionDNA = Z.input<typeof ActionValidators.huntAction>
/** What the author did from inside a quiz, validated */
export type HuntActionT   = Z.output<typeof ActionValidators.huntAction>
/** What the author did to a quiz's widgets or columns, or to the hunt's expressions, validated */
export type LayoutActionT = Extract<HuntActionT, { kind: typeof LayoutActionKindVals[number] }>
/** What a visitor did before opening any quiz, as a view says it */
export type AccountActionDNA = Z.input<typeof ActionValidators.accountAction>
/** What a visitor did before opening any quiz, validated */
export type AccountActionT = Z.output<typeof ActionValidators.accountAction>

/** Whether `action` is one that revises a quiz's widgets or columns, or the hunt's expressions */
export function isLayoutAction(action: HuntActionT): action is LayoutActionT {
  return (LayoutActionKindVals as readonly string[]).includes(action.kind)
}
