import * as Z from 'zod'
import { Validator } from '../lib/validator'
import { mintId } from '../lib/ids'
import * as Labelmaker from '../lib/labelmaker'
import { GuessValidators, type GuessT } from './guess'
import { IshValidators, type IshesT } from './ish'

export const QuestionValidators = Validator(({ obj, str, textish, noteish, titleish, ulid, label }) => {
  // Each field is named once here, without its default, because a patch and a whole question
  // need the same meaning but opposite treatment of an absent key. `.partial()` cannot express
  // that: a default still fires through it, so a one-field patch built that way would carry
  // every other field's default along and quietly wipe what the author had.
  const qnum = str.regex(/^(\d+(\.\d+)?)?$/)
    .describe('The author\'s own question number, kept as text on purpose. Blank means unranked and sorts last. Decimals are a feature, not an accident: typing 3.1 means "put this between whatever is 3 and 4 right now" without renumbering anything else. Duplicates and gaps are both legal.')
  const clueing = textish
    .describe('The question as it will be asked. Markdown-ish emphasis, quoted verse, and non-Latin scripts all appear in real quizzes and must survive untouched; the tool never rewrites this text, not even to trim it.')
  const hint = textish
    .describe('This question\'s own "BUT NOT ..." misdirection: a clue for something that is NOT this answer but shares its name. It belongs to the question whose answer it disguises, and is displayed alongside whichever OTHER question chains to this one.')
  const title = titleish
    .describe('A brief name for the question, which can optionally be added to its text. Also what this question is called in other questions\' chain dropdowns, and the key an import matches questions on. Not the answer: that is `full_answer`.')
  const questionLabel = label
    .describe('A freeform-editable local identifier, generated once at creation. Unlike the id, an author can read it, type it, and paste it back after a round-trip through another tool.')
  const forced_label = label.nullable()
    .describe('An author-chosen label overriding the generated one, or null to keep the generated one.')
  const chains_to = ulid.nullable()
    .describe('The question that follows this one in the quiz, or null when unchained. The BUT NOT text presented with THIS question is the chained-to question\'s hint, so solving this one hands the player a pointer to the next answer. Must name a different question in the same quiz; anything dangling or self-referential is cleared rather than kept.')
  const clueing_ishes = IshValidators.ishes
    .describe('Extraction over this question\'s clueing. What the standard Clueing sum columns are worked out from.')
  const hint_ishes = IshValidators.ishes
    .describe('Extraction over this question\'s own hint. What the standard Hint sum columns are worked out from, and borrowed by whichever question chains to this one for its BUT NOT sums and BUT NOT ishes.')
  const alt_text = noteish
    .describe('Freeform notes column, carried through to the spreadsheet export. The tool ascribes no meaning to it.')
  const notes = noteish
    .describe('Second freeform notes column, carried through to the spreadsheet export.')
  const full_answer = noteish
    .describe('The answer, as it will actually be read out.')

  const question = obj({
    id:            ulid,
    qnum:          qnum.default(''),
    clueing:       clueing.default(''),
    hint:          hint.default(''),
    title:         title.default(''),
    label:         questionLabel.default(() => Labelmaker.localBlankLabel(new Set(), mintId())),
    forced_label:  forced_label.default(null),
    chains_to:     chains_to.default(null),
    guess:         GuessValidators.guess.default(null),
    clueing_ishes: clueing_ishes.default(null),
    hint_ishes:    hint_ishes.default(null),
    alt_text:      alt_text.default(''),
    notes:         notes.default(''),
    full_answer:   full_answer.default(''),
  })
    .describe('One question in a quiz. Every field but the id is optional on the way in and defaulted, so a partially-filled question is always a legal question -- the author is drafting, not filling in a form.')

  // label and forced_label are absent: a patch never revises a question's label.
  const questionPatch = obj({
    qnum:          qnum.optional(),
    clueing:       clueing.optional(),
    hint:          hint.optional(),
    title:         title.optional(),
    chains_to:     chains_to.optional(),
    guess:         GuessValidators.guess.optional(),
    clueing_ishes: clueing_ishes.optional(),
    hint_ishes:    hint_ishes.optional(),
    alt_text:      alt_text.optional(),
    notes:         notes.optional(),
    full_answer:   full_answer.optional(),
  })
    .describe('The fields of one question being revised. A key absent from a patch means "leave whatever is already there", so no field here carries a default. The id is not among them: a question keeps the id it was minted with for its whole life.')

  return { qnum, clueing, hint, title, chains_to, alt_text, notes, full_answer, question, questionPatch }
})

export type QuestionDNA   = Z.input<typeof QuestionValidators.question>
export type QuestionT     = Z.output<typeof QuestionValidators.question>
export type QuestionPatch = Z.output<typeof QuestionValidators.questionPatch>

/** One question in a quiz: its clueing, its own BUT NOT hint, and everything hung off them */
export class Question implements QuestionT {
  declare id:            string
  declare qnum:          string
  declare clueing:       string
  declare hint:          string
  declare title:         string
  declare label:         string
  declare forced_label:  string | null
  declare chains_to:     string | null
  declare guess:         GuessT
  declare clueing_ishes: IshesT
  declare hint_ishes:    IshesT
  declare alt_text:      string
  declare notes:         string
  declare full_answer:   string

  /**
   * The fields a question shows the outside world, alphabetically: what an expression may read
   * and what a quiz's git table carries. Everything but the id, the override of the label (the
   * label in force is what is shown), and the players' answers, which belong to the playing
   * widgets that show them.
   */
  static readonly exposed = ['alt_text', 'chains_to', 'clueing', 'full_answer', 'hint', 'label', 'notes', 'qnum', 'title'] as const

  /**
   * Validated question, with every omitted field defaulted. A blank title is populated from the
   * label, titleized, so a fresh question reads as "Quiet Otter" rather than nothing at all.
   *
   * @param dna - At minimum an id; everything else is optional.
   * @returns A complete question.
   *
   * @example Question.fill({ id: mintId(), clueing: 'Who?' })
   */
  static fill(dna: QuestionDNA): QuestionT {
    const question = QuestionValidators.question(dna)
    return question.title === '' ? { ...question, title: Labelmaker.titleize(question.label) } : question
  }

  /**
   * Empty question under a freshly minted id.
   *
   * @returns A question with no text anywhere and nothing asked of the model.
   *
   * @example Question.blank().clueing  // => ''
   */
  static blank(): QuestionT {
    return this.fill({ id: mintId() })
  }
}
