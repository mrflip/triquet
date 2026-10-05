import * as Z from 'zod'
import { Validator } from '../lib/validator'
import { mintId } from '../lib/ids'
import * as Labelmaker from '../lib/labelmaker'
import * as CK from '../lib/vv/checks/numbers'
import type { HuntStanding } from '../lib/actor'
import { WidgetedValidators, type WidgetedHistoryT } from './widgeted'

/** What a question carries in a formula's bag beside its exposed fields: its place once the quiz is put in Q# order */
export const RankField = 'rank'

export const QuestionValidators = Validator(({ obj, rec, textish, noteish, titleish, label, zid, treeid }) => {
  // Each field is named once here, without its default, because a patch and a whole question
  // need the same meaning but opposite treatment of an absent key. `.partial()` cannot express
  // that: a default still fires through it, so a one-field patch built that way would carry
  // every other field's default along and quietly wipe what the author had.
  const qnum = CK.unumstrOrBlank
    .describe('The author\'s own question number, kept as text on purpose: one written as a number is kept as the text it reads as. Blank means unranked and sorts last. Decimals are a feature, not an accident: typing 3.1 means "put this between whatever is 3 and 4 right now" without renumbering anything else. Duplicates and gaps are both legal.')
  const clueing = textish
    .describe('The question as it will be asked. Markdown-ish emphasis, quoted verse, and non-Latin scripts all appear in real quizzes and must survive untouched; the tool never rewrites this text, not even to trim it.')
  const hint = textish
    .describe('This question\'s own "BUT NOT ..." misdirection: a clue for something that is NOT this answer but shares its name. It belongs to the question whose answer it disguises, and is displayed alongside whichever OTHER question chains to this one.')
  const title = titleish
    .describe('A brief name for the question, which can optionally be added to its text. Also what this question is called in other questions\' chain dropdowns. Not the answer: that is `full_answer`.')
  const questionLabel = label
    .describe('A freeform-editable local identifier, generated once at creation. Unlike the id, an author can read it, type it, and paste it back after a round-trip through another tool.')
  const chains_to = treeid.nullable()
    .describe('The question that follows this one in the quiz, or null when unchained. The BUT NOT text presented with THIS question is the chained-to question\'s hint, so solving this one hands the player a pointer to the next answer. Must name a different question in the same quiz; anything dangling or self-referential is cleared rather than kept.')
  const alt_text = noteish
    .describe('Freeform notes column, carried through to the spreadsheet export. The tool ascribes no meaning to it.')
  const notes = noteish
    .describe('Second freeform notes column, carried through to the spreadsheet export.')
  const full_answer = noteish
    .describe('The answer, as it will actually be read out.')

  const question = obj({
    _id:           treeid,
    qnum:          qnum.default(''),
    clueing:       clueing.default(''),
    hint:          hint.default(''),
    title:         title.default(''),
    label:         questionLabel.default(() => Labelmaker.localBlankLabel(new Set(), mintId())),
    chains_to:     chains_to.default(null),
    alt_text:      alt_text.default(''),
    notes:         notes.default(''),
    full_answer:   full_answer.default(''),
    stored:        rec(label, WidgetedValidators.history).default({})
      .describe('What each widgeting that stores (an `aibot` one) has recorded for this question, by the widgeting\'s label: its newest row, and its newest `ok` one. A widgeting with nothing recorded here is absent.'),
  })
    .describe('One question in a quiz. Every field but the id is optional on the way in and defaulted, so a partially-filled question is always a legal question -- the author is drafting, not filling in a form.')

  // label is absent: a patch never revises a question's label. So is what
  // its widgetings stored: that is recorded, never revised (`record_widgeted`).
  const questionPatch = obj({
    qnum:          qnum.optional(),
    clueing:       clueing.optional(),
    hint:          hint.optional(),
    title:         title.optional(),
    chains_to:     chains_to.optional(),
    alt_text:      alt_text.optional(),
    notes:         notes.optional(),
    full_answer:   full_answer.optional(),
  })
    .describe('The fields of one question being revised: what the author writes. A key absent from a patch means "leave whatever is already there", so no field here carries a default. The id is not among them: a question keeps the id it was minted with for its whole life. Neither is what its widgetings stored, which is recorded rather than revised.')

  const row = obj({
    hunt_id:      zid('hunts')
      .describe('The hunt its quiz belongs to, which says who may read the question and change it.'),
    quiz_id:      zid('quizzes')
      .describe('The quiz this question belongs to. Its place there is the quiz\'s to say (`row_ordering`).'),
    label:        questionLabel,
    title,
    qnum,
    clueing,
    hint,
    chains_to:    label.nullable()
      .describe('The label of the question that follows this one in the quiz, or null when unchained. Must name a different question in the same quiz.'),
    full_answer,
    alt_text,
    notes,
  })
    .describe('One question as the database holds it: only what the author writes. What its widgetings stored is in rows of their own.')

  return { qnum, clueing, hint, title, chains_to, alt_text, notes, full_answer, question, questionPatch, row }
})

export type QuestionDNA   = Z.input<typeof QuestionValidators.question>
export type QuestionT     = Z.output<typeof QuestionValidators.question>
export type QuestionPatch = Z.output<typeof QuestionValidators.questionPatch>
export type QuestionRowT  = Z.output<typeof QuestionValidators.row>

/** The name of one of a question's fields, apart from its id */
export type QuestionFieldname = Exclude<keyof QuestionT, '_id'>

/** Every field of a question apart from its id, as its validator lists them */
const QuestionFieldnames = Object.keys(QuestionValidators.question.shape).filter((fieldname) => fieldname !== '_id') as QuestionFieldname[]

/** One question in a quiz: its clueing, its own BUT NOT hint, and everything hung off them */
export class Question implements QuestionT {
  declare _id:            string
  declare qnum:          string
  declare clueing:       string
  declare hint:          string
  declare title:         string
  declare label:         string
  declare chains_to:     string | null
  declare alt_text:      string
  declare notes:         string
  declare full_answer:   string
  declare stored:        Record<string, WidgetedHistoryT>

  /**
   * The fields a question shows the outside world, alphabetically: what a formula may read and
   * what a quiz's git table carries. Everything but the id, and what its widgetings stored, which
   * each widgeting exposes for itself.
   */
  static readonly exposed = ['alt_text', 'chains_to', 'clueing', 'full_answer', 'hint', 'label', 'notes', 'qnum', 'title'] as const

  /**
   * The fields of a question each standing on its hunt is sent, beside its id, alphabetically: the
   * one place a change to who is sent what lands (`seenQuestionFor`). A smith works the question,
   * and is sent all of it: its exposed fields, and what its widgetings stored. A reviewer is sent
   * what a review needs: the question as it will be asked, the BUT NOT it chains to, and its
   * answer, which the review screen keeps behind its lock; not the smiths' notes, nor what the
   * widgetings stored. A stranger to the hunt is sent nothing.
   */
  static readonly sentTo = {
    smith:    ['alt_text', 'chains_to', 'clueing', 'full_answer', 'hint', 'label', 'notes', 'qnum', 'stored', 'title'],
    reviewer: ['chains_to', 'clueing', 'full_answer', 'hint', 'label', 'qnum', 'title'],
    stranger: [],
  } as const satisfies Record<HuntStanding, readonly QuestionFieldname[]>

  /**
   * Whether someone of `standing` on a question's hunt is sent its `fieldname` (`sentTo`).
   *
   * @example Question.isSent('stored', 'reviewer')  // => false
   */
  static isSent(fieldname: QuestionFieldname, standing: HuntStanding): boolean {
    const sent: readonly QuestionFieldname[] = this.sentTo[standing]
    return sent.includes(fieldname)
  }

  /**
   * Whether someone of `standing` on a question's hunt is sent every question whole, as a smith
   * is. A record of the quiz (its history) is made only from questions read whole: one missing a
   * field it was not sent would read as though the field had been blanked.
   *
   * @example Question.isSentWhole('reviewer')  // => false
   */
  static isSentWhole(standing: HuntStanding): boolean {
    return QuestionFieldnames.every((fieldname) => this.isSent(fieldname, standing))
  }

  /**
   * Validated question, with every omitted field defaulted. A blank title is populated from the
   * label, titleized, so a fresh question reads as "Quiet Otter" rather than nothing at all.
   *
   * @param dna - At minimum an id; everything else is optional.
   * @returns A complete question.
   *
   * @example Question.fill({ _id: mintId(), clueing: 'Who?' })
   */
  static fill(dna: QuestionDNA): QuestionT {
    const question = QuestionValidators.question(dna)
    return question.title === '' ? { ...question, title: Labelmaker.titleize(question.label) } : question
  }

  /**
   * Empty question under a freshly minted id.
   *
   * @returns A question with no text anywhere and nothing stored for it.
   *
   * @example Question.blank().clueing  // => ''
   */
  static blank(): QuestionT {
    return this.fill({ _id: mintId() })
  }

  /**
   * A blank question's row for the quiz `place` names: nothing written and unchained, under
   * `label` or a fresh one, titled from it.
   *
   * @param place - The quiz it belongs to, and that quiz's hunt.
   * @param label - The label it starts under; one is generated when omitted.
   * @returns The row to insert.
   *
   * @example Question.blankRow({ hunt_id, quiz_id }, 'quiet_otter').title  // => 'Quiet Otter'
   */
  static blankRow({ hunt_id, quiz_id }: Pick<QuestionRowT, 'hunt_id' | 'quiz_id'>, label: string = Labelmaker.localBlankLabel(new Set(), mintId())): QuestionRowT {
    return QuestionValidators.row({
      hunt_id, quiz_id, label, title: Labelmaker.titleize(label), qnum: '', clueing: '', hint: '', chains_to: null, full_answer: '', alt_text: '', notes: '',
    })
  }
}
