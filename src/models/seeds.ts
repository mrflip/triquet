import { Widget, type WidgetDNA, type WidgetT } from './widget'
import { Widgeting, type WidgetingT } from './widgeting'

/*
 * The library's seeds, and the widgetings a quiz showing them is given: content, read by the
 * seeding mutation (`convex/seeding.ts`), which inserts what is absent. Nothing reads these as
 * the library itself; once seeded, the rows are the library.
 *
 * The prompts are content, not implementation: the author is spending their own model usage on
 * these asks and reading the answers as evidence about their own questions, so they are shown
 * verbatim, placeholders and all. The placeholder is `{{clueing}}`, because that is what the
 * field is called here; the prose still says "question" to the model, which is the word a player
 * would use.
 */

const QuickGuessPrompt = `You are answering a trivia question the way a fast, not-especially-careful player would — a literal, first-instinct read, not a careful expert analysis.

Question: {{clueing}}

Reply with only a JSON object {"guess": string, "explanation": string}: your best short answer, and a brief explanation of it. No other text.`

const IshRules = `Rules:
- A span written in digits ("300", "1990") is kind "numeral".
- A span that reads as a number in words counts too: spelled-out numbers ("one", "twenty-three"), ordinals ("third"), and magnitude phrases ("300 million", "a dozen", "千", "douzaine") — kind "wordish". Give a magnitude phrase as one item with its full numeric value ("300 million" is one item worth 300000000), not split into pieces.
- Do not include the indefinite article "a"/"an" on its own, and do not include Roman numerals ("IV", "LIV").`

const IshesReply = `Reply with only a JSON object {"items": [...]}, each item shaped {"text": string, "value": number, "kind": "numeral" | "wordish"}, no other text.`

const ClueingIshesPrompt = `A trivia question sometimes hides a second, numeric puzzle: adding together every number-like element in its text.

List every text span in the question below that a reasonable person might read as a number, in the order it appears.

Question: {{clueing}}

${IshRules}
- If nothing in the question reads as a number, give an empty list of items.

${IshesReply}`

const HintIshesPrompt = `A puzzle hint can hide a numeric puzzle of its own: adding together every number-like element in its text.

List every text span in the hint below that a reasonable person might read as a number, in the order it appears.

Hint: {{hint}}

${IshRules}
- If nothing in the hint reads as a number, give an empty list of items.

${IshesReply}`

/** The input of a seeded `aibot` widget put one text: that text, trimmed, and nothing for a blank one, which is then not asked about */
const trimmedInput = (textkind: 'clueing' | 'hint'): string => `$trim(question.${textkind}) != '' ? { '${textkind}': $trim(question.${textkind}) }`

const AibotSeedDNAs: readonly WidgetDNA[] = [
  {
    label:         'dumdum',
    title:         'Dumdum',
    description:   'Answers the clueing on first instinct. A guess that differs from the intended title means the question has a second reading.',
    formulary:     'aibot',
    formula:       QuickGuessPrompt,
    input_formula: trimmedInput('clueing'),
    config:        { servicelabel: 'claude', model_tier: 'quick', max_tokens: 256 },
  },
  {
    label:         'numnum_clueing',
    title:         'Numnum: clueing',
    description:   'Lists every span of the clueing a reasonable player might read as a number, so the author can see what a hidden numeric puzzle totals.',
    formulary:     'aibot',
    formula:       ClueingIshesPrompt,
    input_formula: trimmedInput('clueing'),
    config:        { servicelabel: 'claude', model_tier: 'careful', max_tokens: 4000 },
  },
  {
    label:         'numnum_hint',
    title:         'Numnum: hint',
    description:   'Lists every span of the hint a reasonable player might read as a number, so the author can see what a hidden numeric puzzle totals.',
    formulary:     'aibot',
    formula:       HintIshesPrompt,
    input_formula: trimmedInput('hint'),
    config:        { servicelabel: 'claude', model_tier: 'careful', max_tokens: 4000 },
  },
]

/** The sum, rounded halves upward, of the spans a number spotter's widgeted found; `kind` narrows them */
const SumOf = (widgeted: string, kind = ''): string => `$floor($sum($append([0], ${widgeted}.value.items${kind}.value)) + 0.5)`

/** What narrows a number spotter's spans to those written in digits */
const NumeralOnly = "[kind = 'numeral']"

/** The question this one chains to, looked up by its label; nothing when it chains to none (`$lookup` refuses a null label) */
const Chained = '(question.chains_to ? $lookup(questions, question.chains_to))'

/** The number spotter's widgeted for the hint of the question this one chains to */
const ButnotHint = `${Chained}.numnum_hint`

// Each sum reads one number spotter's widgeted and totals its spans. A widgeted that is not `ok`
// comes to nothing, because "nobody has asked yet" and "the answer is nought" are different facts
// about a clue.
const SumSeedDNAs: readonly WidgetDNA[] = [
  {
    label:       'clueing_full',
    description: 'Every number-like span in the clueing, added up.',
    formulary:   'jsonata',
    formula:     `question.numnum_clueing.status = 'ok' ? ${SumOf('question.numnum_clueing')}`,
  },
  {
    label:       'clueing_numeral',
    description: 'The spans in the clueing that are written in digits, added up.',
    formulary:   'jsonata',
    formula:     `question.numnum_clueing.status = 'ok' ? ${SumOf('question.numnum_clueing', NumeralOnly)}`,
  },
  {
    label:       'hint_full',
    description: 'Every number-like span in this question\'s own hint, added up.',
    formulary:   'jsonata',
    formula:     `question.numnum_hint.status = 'ok' ? ${SumOf('question.numnum_hint')}`,
  },
  {
    label:       'hint_numeral',
    description: 'The spans in this question\'s own hint that are written in digits, added up.',
    formulary:   'jsonata',
    formula:     `question.numnum_hint.status = 'ok' ? ${SumOf('question.numnum_hint', NumeralOnly)}`,
  },
  {
    label:       'butnot_full',
    description: 'Every number-like span in the hint of the question this one chains to, added up.',
    formulary:   'jsonata',
    formula:     `(\n  $hint := ${ButnotHint};\n  $hint.status = 'ok' ? ${SumOf('$hint')}\n)`,
  },
  {
    label:       'butnot_numeral',
    description: 'The spans written in digits in the hint of the question this one chains to, added up.',
    formulary:   'jsonata',
    formula:     `(\n  $hint := ${ButnotHint};\n  $hint.status = 'ok' ? ${SumOf('$hint', NumeralOnly)}\n)`,
  },
  {
    label:       'clueing_plus_rank',
    description: 'The clueing sum plus this question\'s rank: its place, counting from 1, once the quiz is put in Q# order.',
    formulary:   'jsonata',
    formula:     `question.numnum_clueing.status = 'ok' and $type(question.rank) = 'number' ? ${SumOf('question.numnum_clueing')} + question.rank`,
  },
  {
    label:       'clueing_plus_butnot_full',
    description: 'The clueing sum plus the sum of the hint of the question this one chains to.',
    formulary:   'jsonata',
    formula:     `(\n  $clueing := question.numnum_clueing;\n  $hint := ${ButnotHint};\n  $clueing.status = 'ok' and $hint.status = 'ok' ? ${SumOf('$clueing')} + ${SumOf('$hint')}\n)`,
  },
]

/** Small text calculations, for the columns an author might want beside the sums */
const TextSeedDNAs: readonly WidgetDNA[] = [
  {
    label:       'clueing_word_count',
    description: 'How many words the clueing has.',
    formulary:   'jsonata',
    formula:     String.raw`$count($split($trim(question.clueing), /\s+/)[$ != ''])`,
  },
  {
    label:       'clueing_with_butnot',
    description: 'The clueing with the BUT NOT text of the question this one chains to folded in: the complete unit as a player receives it. The phrase is only supplied when the hint does not already say it.',
    formulary:   'jsonata',
    formula:     `(\n  $hint := $trim(${Chained}.hint);\n  $exists($hint) and $hint != '' ?\n    question.clueing & ($contains($hint, /^but not\\b/i) ? ' ... ' : ' ... BUT NOT ... ') & $hint :\n    question.clueing\n)`,
  },
  {
    label:       'answer_letter_count',
    description: 'How many letters the full answer has, ignoring everything that is not a letter.',
    formulary:   'jsonata',
    formula:     "$length($replace(question.full_answer, /[^a-z]/i, ''))",
  },
  {
    label:       'answer_reversed',
    description: 'The full answer written backward.',
    formulary:   'jsonata',
    formula:     "$join($reverse($split(question.full_answer, '')))",
  },
  {
    label:       'answer_alphabetized',
    description: 'The letters of the full answer in alphabetical order, ignoring case and everything that is not a letter.',
    formulary:   'jsonata',
    formula:     "$join($sort($split($lowercase($replace(question.full_answer, /[^a-z]/i, '')), '')))",
  },
]

/** What the BUT NOT ishes column shows: the chained-to question's hint, as the number spotter read it */
const ButnotIshesDNA: WidgetDNA = {
  label:       'butnot_ishes',
  title:       'BUT NOT ishes',
  description: 'The number-like spans the number spotter found in the hint of the question this one chains to. Ask the hint on that question; this only shows what it found.',
  formulary:   'jsonata',
  formula:     `${ButnotHint}.value`,
}

/** A formula a column is offered beside a ref, reshaping what it picks; as the column menu's presets are shaped */
export type SeedPreset = {
  formula: string
  /** What it works out, in a few words */
  title:   string
  /** The label and header a column taking it is given when the author gives neither */
  names:   { label: string, title: string }
}

/**
 * The sums of a number spotter's spans, as formulas a column showing the spotter works on its
 * widgeted (`$`): what the seeded `<stem>_full` and `<stem>_numeral` widgets work out, without a
 * widgeting of their own, the column named as theirs are. A column's formula works only on an
 * `ok` widgeted, so these need no guard: an unasked or failed spotter shows as itself, not as nought.
 */
function spotterSums(stem: string, heading: string): readonly SeedPreset[] {
  return [
    { formula: SumOf('$'), title: 'Every number-like span, added up', names: { label: `${stem}_full`, title: `${heading} Full Sum` } },
    { formula: SumOf('$', NumeralOnly), title: 'The spans written in digits, added up', names: { label: `${stem}_numeral`, title: `${heading} Numeral Sum` } },
  ]
}

/**
 * The formulas offered to a column showing a widgeting of a seeded widget, by the widget's label:
 * the sums, for both number spotters and for the BUT NOT ishes, which hold a spotter's reply. A
 * sum reading two things, or another question (`butnot_*`, `clueing_plus_*`), stays a widget.
 *
 * @example SeedPresets.get('numnum_hint')?.map(({ formula }) => formula)
 *   // => ["$floor($sum($append([0], $.value.items.value)) + 0.5)", "$floor($sum($append([0], $.value.items[kind = 'numeral'].value)) + 0.5)"]
 * @example SeedPresets.get('numnum_hint')?.[0]?.names  // => { label: 'hint_full', title: 'Hint Full Sum' }
 */
export const SeedPresets: ReadonlyMap<string, readonly SeedPreset[]> = new Map([
  ['numnum_clueing', spotterSums('clueing', 'Clueing')],
  ['numnum_hint', spotterSums('hint', 'Hint')],
  ['butnot_ishes', spotterSums('butnot', 'BUT NOT')],
])

/** The label of the seeded category-estimate entry, and so of the widgeting a quiz first works it under */
export const CategoryDataLabel = 'category_data'

/** The category-estimate entry: which subject categories a question draws on, and what that makes of Masie, Artie and Poppy's chances */
const CategoryDataDNA: WidgetDNA = {
  label:       CategoryDataLabel,
  title:       'Categories',
  description: "Which subject categories a question draws on, each at a difficulty: a pill for each. A column can show the list, or by a formula Masie's, Artie's and Poppy's chances at the question and their average, read against the hunt's wheel (`$.masie` and the like); another formula reads them as `question.category_data.masie`.",
  formulary:   'entry',
  config:      { entry_kind: 'estimates' },
}

/**
 * One entry per family the cells offer: what an author picks to type into a column of their own,
 * its constraints said by the widgeting (a number's bounds, a text's pattern, a choice's options).
 * Each label is a word an author might use, and none of the families' own names, which every
 * label is kept from.
 */
const FamilySeedDNAs: readonly WidgetDNA[] = [
  {
    label:       'memo',
    title:       'Text',
    description: 'Text typed into each cell: a note, markdown welcome; or one line, held to a pattern (a label, a web address) if the widgeting says so.',
    formulary:   'entry',
    config:      { entry_kind: 'text' },
  },
  {
    label:       'figure',
    title:       'Number',
    description: 'A number typed into each cell, between bounds and whole if the widgeting says so.',
    formulary:   'entry',
    config:      { entry_kind: 'number' },
  },
  {
    label:       'yes_no',
    title:       'Yes or no',
    description: 'A checkbox in each cell: ticked, unticked, or not yet said.',
    formulary:   'entry',
    config:      { entry_kind: 'boolean' },
  },
  {
    label:       'choice',
    title:       'Choice',
    description: 'One of a list of options, picked in each cell: the widgeting says what the options are.',
    formulary:   'entry',
    config:      { entry_kind: 'enum' },
  },
]

/**
 * A template: a line of markdown made for every question, which a widgeting may make its own (its
 * `template`), or read from what a bot or a formula before it wrote (its `template_from`).
 */
const BlurbDNA: WidgetDNA = {
  label:       'blurb',
  title:       'Template',
  description: 'Markdown filled in from a Liquid template for every question, over what a formula reads: `{{ question.title }}`, `{{ question.dumdum.value.guess }}`. Its widgeting may give a template of its own, or read one from the bag, as a bot wrote it.',
  formulary:   'liquidize',
  formula:     '**{{ question.title }}**{% if question.full_answer %}: {{ question.full_answer | oneline }}{% endif %}',
}

/**
 * The library's seeds: the three prompts, the eight sums, five small text calculations, the
 * BUT NOT ishes, the category-estimate entry, an entry of each other family, and a template.
 * Twenty-three, in the order the library lists them.
 *
 * @example SeedWidgets.find((widget) => widget.label === 'numnum_hint')?.formulary  // => 'aibot'
 */
export const SeedWidgets: readonly WidgetT[] = [...AibotSeedDNAs, ButnotIshesDNA, ...SumSeedDNAs, ...TextSeedDNAs, CategoryDataDNA, ...FamilySeedDNAs, BlurbDNA].map((dna) => Widget.fill(dna))

/**
 * The widgetings a quiz is given when its columns name any of them, in run order, each labelled
 * as its widget: the three prompts first, then what reads them.
 *
 * @example DefaultWidgetings.map((widgeting) => widgeting.label).slice(0, 4)  // => ['dumdum', 'numnum_clueing', 'numnum_hint', 'butnot_ishes']
 */
export const DefaultWidgetings: readonly WidgetingT[] = [
  'dumdum', 'numnum_clueing', 'numnum_hint', 'butnot_ishes',
  'clueing_plus_rank', 'clueing_full', 'clueing_numeral', 'butnot_full', 'butnot_numeral', 'hint_full', 'hint_numeral', 'clueing_plus_butnot_full',
].map((label) => Widgeting.fill({ widget_label: label, label }))
