import * as Z from 'zod'
import { Validator } from '../lib/validator'
import { mintId } from '../lib/ids'
import { GuessValidators, type GuessT } from './guess'
import { IshValidators, type IshesT } from './ish'

export const QuestionValidators = Validator(({ obj, str, text, ulid }) => {
  const question = obj({
    id:            ulid,
    qnum:          str.regex(/^(\d+(\.\d+)?)?$/).default('')
      .describe('The author\'s own question number, kept as text on purpose. Blank means unranked and sorts last. Decimals are a feature, not an accident: typing 3.1 means "put this between whatever is 3 and 4 right now" without renumbering anything else. Duplicates and gaps are both legal.'),
    clueing:       text.default('')
      .describe('The question as it will be asked. Markdown-ish emphasis, quoted verse, and non-Latin scripts all appear in real rounds and must survive untouched; the tool never rewrites this text.'),
    hint:          text.default('')
      .describe('This question\'s own "BUT NOT ..." misdirection: a clue for something that is NOT this answer but shares its name. It belongs to the question whose answer it disguises, and is displayed alongside whichever OTHER question chains to this one.'),
    short_answer:  str.max(200).default('')
      .describe('The intended answer in as few words as possible. Does triple duty: the thing a guess is compared against, the label this question shows under other questions\' chain dropdowns, and the key an import matches questions on.'),
    chains_to:     ulid.nullable().default(null)
      .describe('The question that follows this one in the round, or null when unchained. The BUT NOT text presented with THIS question is the chained-to question\'s hint, so solving this one hands the player a pointer to the next answer. Must name a different question in the same round; anything dangling or self-referential is cleared rather than kept.'),
    guess:         GuessValidators.guess.default(null),
    clueing_ishes: IshValidators.ishes.default(null)
      .describe('Extraction over this question\'s clueing. Feeds Clueing Full Sum, Clueing Numeral Sum, Clueing + Rank, and Clueing+BUT NOT Full.'),
    hint_ishes:    IshValidators.ishes.default(null)
      .describe('Extraction over this question\'s own hint. Feeds this question\'s Hint sums, and is borrowed by whichever question chains to this one for its BUT NOT sums and BUT NOT ishes.'),
    alt_text:      text.default('')
      .describe('Freeform notes column, carried through to the spreadsheet export. The tool ascribes no meaning to it.'),
    notes:         text.default('')
      .describe('Second freeform notes column, carried through to the spreadsheet export.'),
    full_answer:   text.default('')
      .describe('The long-form answer as it will actually be read out, as opposed to the terse short answer used for matching and chaining.'),
  })
    .describe('One question in a round. Every field but the id is optional on the way in and defaulted, so a partially-filled question is always a legal question -- the author is drafting, not filling in a form.')

  const questionPatch = question.partial().omit({ id: true })
    .describe('Fields of one question being revised. The id is not among them: a question keeps the id it was minted with for its whole life.')

  return { question, questionPatch }
})

export type QuestionDNA   = Z.input<typeof QuestionValidators.question>
export type QuestionT     = Z.output<typeof QuestionValidators.question>
export type QuestionPatch = Z.output<typeof QuestionValidators.questionPatch>

/** One question in a round: its clueing, its own BUT NOT hint, and everything hung off them */
export class Question implements QuestionT {
  declare id:            string
  declare qnum:          string
  declare clueing:       string
  declare hint:          string
  declare short_answer:  string
  declare chains_to:     string | null
  declare guess:         GuessT
  declare clueing_ishes: IshesT
  declare hint_ishes:    IshesT
  declare alt_text:      string
  declare notes:         string
  declare full_answer:   string

  /**
   * Validated question, with every omitted field defaulted.
   *
   * @param dna - At minimum an id; everything else is optional.
   * @returns A complete question.
   *
   * @example Question.fill({ id: mintId(), clueing: 'Who?' })
   */
  static fill(dna: QuestionDNA): QuestionT {
    return QuestionValidators.question(dna)
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
