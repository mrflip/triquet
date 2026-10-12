import type * as Z from 'zod'
import { HuntStandingVals } from '../lib/actor'
import { Validator } from '../lib/validator'
import * as PA from '../lib/vv/patterns'
import { CategoryValidators } from './category'
import { ColumnValidators } from './column'
import { HuntValidators } from './hunt'
import { HuntshipValidators } from './huntship'
import { ImportValidators } from './import'
import { QuestionValidators } from './question'
import { QuizValidators } from './quiz'
import { ReviewValidators } from './review'
import { ReviewingValidators } from './reviewing'
import { UserValidators } from './user'
import { WidgetValidators } from './widget'
import { WidgetedValidators } from './widgeted'
import { WidgetingValidators } from './widgeting'

/** The actions that revise a quiz's widgetings and columns, and which of its sources it nominates as templateable */
export const LayoutActionKindVals = [
  'add_widgeting', 'edit_widgeting', 'delete_widgeting', 'move_widgeting',
  'add_column', 'edit_column', 'delete_column', 'move_column',
  'set_templateable',
] as const

/** The actions that revise the quiz on screen and its questions */
export const ContentActionKindVals = [
  'retitle_quiz', 'relabel_quiz', 'set_smiths_note', 'set_q1_preamble', 'set_recap_head', 'set_recap_tail',
  'set_recap_template', 'edit_question', 'add_question', 'delete_questions', 'set_viz', 'sort_questions', 'renumber_qnums', 'move_question',
  'set_chain', 'sort_by_chain_order', 'record_widgeted', 'enter_widgeted', 'enter_quiz_widgeted', 'import_questions',
] as const

/** The actions that revise the quiz on screen: its contents and its layout, which a locked quiz refuses */
export const QuizRevisionKindVals = [...ContentActionKindVals, ...LayoutActionKindVals] as const
export type QuizRevisionKind = typeof QuizRevisionKindVals[number]

export const ActionValidators = Validator(({ obj, arr, lit, oneof, discrim, bool, uint, label, titleish, zid }) => {
  const huntAffirms = obj({
    user_id:  zid('users'),
    hunt_id:  zid('hunts'),
    standing: oneof(HuntStandingVals),
  })
    .describe('What a browser says of itself on a hunt: who it is, which hunt, and its standing there, as the hunt was last read. The server checks every one.')

  const quizAffirms = huntAffirms.extend({ quiz_id: zid('quizzes') })
    .describe('What a browser says of itself on a hunt, and the quiz of that hunt it is reading.')

  const affirms = quizAffirms.extend({ realm_id: zid('realms') })
    .describe('What a browser says of itself on a hunt, and the quiz it has on screen and the realm that quiz belongs to: where every action lands.')

  const question_ids = arr(zid('questions')).max(PA.QuestionsPerQuiz.max).readonly()

  const layoutAction = [
    obj({ kind: lit('add_widgeting'),     widgeting: WidgetingValidators.widgeting }),
    obj({ kind: lit('edit_widgeting'),    label, patch: WidgetingValidators.widgetingPatch }),
    obj({ kind: lit('delete_widgeting'),  label }),
    obj({ kind: lit('move_widgeting'),    label, onto_idx: uint }),
    obj({ kind: lit('add_column'),        column: ColumnValidators.column, onto_idx: uint.optional() }),
    obj({ kind: lit('edit_column'),       label, patch: ColumnValidators.columnPatch }),
    obj({ kind: lit('delete_column'),     label }),
    obj({ kind: lit('move_column'),       label, onto_idx: uint }),
    obj({ kind: lit('set_templateable'),  templateable: QuizValidators.templateable }),
  ] as const

  const huntAction = discrim('kind', [
    ...layoutAction,
    obj({ kind: lit('retitle_quiz'),        title: titleish }),
    obj({ kind: lit('relabel_quiz'),        label }),
    obj({ kind: lit('set_smiths_note'),     smiths_note: QuizValidators.smiths_note }),
    obj({ kind: lit('set_q1_preamble'),     q1_preamble: QuizValidators.q1_preamble }),
    obj({ kind: lit('set_recap_head'),      recap_head: QuizValidators.recap_head }),
    obj({ kind: lit('set_recap_tail'),      recap_tail: QuizValidators.recap_tail }),
    obj({ kind: lit('set_recap_template'),  recap_template: QuizValidators.recap_template.nullable() })
      .describe('Give the quiz a recap template of its own; null puts it back on the default recap template.'),
    obj({ kind: lit('edit_question'),       question_id: zid('questions'), patch: QuestionValidators.questionPatch }),
    obj({ kind: lit('add_question') }),
    obj({ kind: lit('delete_questions'),    question_ids }),
    obj({ kind: lit('set_viz'),             question_ids, viz: QuestionValidators.viz }),
    obj({ kind: lit('sort_questions'),      sortkey: QuizValidators.sortkey, descending: bool, question_ids })
      .describe('Commit the order a sort by `sortkey` came to in the browser, which ran the quiz: every question of the quiz, by id, in its new order. The quiz remembers the sortkey.'),
    obj({ kind: lit('renumber_qnums') }),
    obj({ kind: lit('move_question'),       question_id: zid('questions'), onto_idx: uint }),
    obj({ kind: lit('set_chain'),           question_id: zid('questions'), chains_to: zid('questions').nullable() }),
    obj({ kind: lit('sort_by_chain_order'), descending: bool }),
    obj({ kind: lit('record_widgeted'),     widgeted: WidgetedValidators.record }),
    obj({ kind: lit('enter_widgeted'),      entered: WidgetedValidators.entered }),
    obj({ kind: lit('enter_quiz_widgeted'), entered: WidgetedValidators.quizEntered }),
    obj({ kind: lit('new_quiz'),            label: label.optional() }),
    obj({ kind: lit('delete_quiz'),         quiz_id: zid('quizzes') }),
    obj({ kind: lit('set_lock'),            quiz_id: zid('quizzes'), locked: bool }),
    obj({ kind: lit('import_questions'),    questions: ImportValidators.importedQuestions, last_sortkey: QuizValidators.sortkey.nullable().optional()
      .describe('The sort memory the questions were exported under, kept only by a quiz that held no questions before, whose order is then the order they were pasted in.') }),
    obj({ kind: lit('open_review'),         quiz_id: zid('quizzes') }),
    obj({ kind: lit('set_overall'),         quiz_id: zid('quizzes'), overall: ReviewValidators.overall }),
    obj({ kind: lit('set_review_phase'),    quiz_id: zid('quizzes'), phase: oneof(['draft', 'shared']) }),
    obj({ kind: lit('set_reviewing'),       quiz_id: zid('quizzes'), question_id: zid('questions'), patch: ReviewingValidators.reviewingPatch }),
    obj({ kind: lit('peek_answer'),         quiz_id: zid('quizzes'), question_id: zid('questions') }),
    obj({ kind: lit('add_huntship'),        userlabel: UserValidators.heldUserlabel, role: HuntshipValidators.role }),
    obj({ kind: lit('remove_huntship'),     user_id: zid('users') }),
    obj({ kind: lit('retitle_hunt'),        title: titleish }),
    obj({ kind: lit('relabel_hunt'),        label: HuntValidators.newLabel }),
    obj({ kind: lit('delete_hunt') }),
  ])
    .describe('Everything the author can do from inside a quiz: to it, to its realm\'s quizzes, and to who is on the hunt.')

  const libraryAction = discrim('kind', [
    obj({ kind: lit('add_widget'),        widget: WidgetValidators.widget }),
    obj({ kind: lit('edit_widget'),       label, patch: WidgetValidators.widgetPatch }),
    obj({ kind: lit('delete_widget'),     label }),
    obj({ kind: lit('move_widget'),       label, onto_idx: uint }),
    obj({ kind: lit('import_widgets'),    widgets: arr(WidgetValidators.widget).max(PA.WidgetsInLibrary.max).readonly() }),
  ])
    .describe('What an admin can do to the library of widgets every hunt shares, from anywhere: no hunt or quiz need be open.')

  const userAction = discrim('kind', [
    obj({ kind: lit('assume_userlabel'), userlabel: UserValidators.userlabel, title: titleish }),
    obj({ kind: lit('retitle_user'),     title: UserValidators.title }),
    obj({
      kind:   lit('settle_name_choice'),
      merged: UserValidators.heldUserlabel
        .describe('The handle the merged browser went by, which names the choice: a user merged into this one still holds it.'),
      keep:   UserValidators.heldUserlabel
        .describe('The handle to keep: that one, or the user\'s own.'),
    }),
  ])
    .describe('What a visitor can do as themselves, before any quiz is open: take a userlabel, once, retitle the user they are, or settle the name choice a merge left them.')

  const outerHuntAction = discrim('kind', [
    obj({ kind: lit('new_hunt'),      label: HuntValidators.newLabel }),
    obj({ kind: lit('retitle_hunt'),  hunt_id: zid('hunts'), title: titleish }),
    obj({ kind: lit('relabel_hunt'),  hunt_id: zid('hunts'), label: HuntValidators.newLabel }),
    obj({ kind: lit('arrange_categories'), hunt_id: zid('hunts'), wheel: CategoryValidators.wheel }),
    obj({ kind: lit('rebranch_hunt'), hunt_id: zid('hunts'), branch: HuntValidators.branch }),
  ])
    .describe('What a visitor can do to a hunt from outside any quiz, naming it rather than affirming it: make one, and retitle, relabel, arrange the categories of, or put on another branch one they smith.')

  return { huntAffirms, quizAffirms, affirms, huntAction, outerHuntAction, libraryAction, userAction }
})

/** What a browser says of itself on a hunt, as it sends it */
export type HuntAffirmsDNA = Z.input<typeof ActionValidators.huntAffirms>
/** What a browser says of itself on a hunt, and the quiz it is reading, as it sends it */
export type QuizAffirmsDNA = Z.input<typeof ActionValidators.quizAffirms>
/** What a browser sends with every action: itself on a hunt, and the quiz on its screen and its realm */
export type AffirmsDNA     = Z.input<typeof ActionValidators.affirms>
/** What a browser says of itself on a hunt: who it is, which hunt, and its standing there */
export type HuntAffirmsT  = Z.output<typeof ActionValidators.huntAffirms>
/** What a browser says of itself on a hunt, and the quiz of it that it is reading */
export type QuizAffirmsT  = Z.output<typeof ActionValidators.quizAffirms>
/** What a browser says of itself on a hunt, and the quiz on its screen and that quiz's realm: what every action is sent with */
export type AffirmsT      = Z.output<typeof ActionValidators.affirms>
/** What the author did from inside a quiz, as a view says it */
export type HuntActionDNA = Z.input<typeof ActionValidators.huntAction>
/** What the author did from inside a quiz, validated */
export type HuntActionT   = Z.output<typeof ActionValidators.huntAction>
/** What the author did to a quiz's widgetings or columns, or to which of its sources it templates, validated */
export type LayoutActionT = Extract<HuntActionT, { kind: typeof LayoutActionKindVals[number] }>
/** What an admin did to the library, as a view says it */
export type LibraryActionDNA = Z.input<typeof ActionValidators.libraryAction>
/** What an admin did to the library, validated */
export type LibraryActionT = Z.output<typeof ActionValidators.libraryAction>
/** What a visitor did to a hunt from outside any quiz, as a view says it */
export type OuterHuntActionDNA = Z.input<typeof ActionValidators.outerHuntAction>
/** What a visitor did to a hunt from outside any quiz, validated */
export type OuterHuntActionT = Z.output<typeof ActionValidators.outerHuntAction>
/** What a visitor did as themselves, as a view says it */
export type UserActionDNA = Z.input<typeof ActionValidators.userAction>
/** What a visitor did as themselves, validated */
export type UserActionT = Z.output<typeof ActionValidators.userAction>

/** Whether `action` is one that revises a quiz's widgetings or columns */
export function isLayoutAction(action: HuntActionT): action is LayoutActionT {
  return (LayoutActionKindVals as readonly string[]).includes(action.kind)
}

