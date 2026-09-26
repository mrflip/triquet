import * as Z from 'zod'
import { Validator } from '../lib/validator'
import * as Labelmaker from '../lib/labelmaker'
import { TextkindVals, type Textkind } from '../lib/ask/contract'
import { PlayerLabelVals, type PlayerLabel } from './player-label'
import { PlaySlots, type PlaySlot } from './playing'
import type { ExpressionT } from './expression'

/** What a widget is: a calculation put to work, or a player put to the quiz */
export const WidgetkindVals = ['expressing', 'playing'] as const
export type Widgetkind = typeof WidgetkindVals[number]

/** Whether the tool puts `player_label` the question's `textkind` text */
function isPlaySlot(player_label: PlayerLabel, textkind: Textkind): boolean {
  return PlaySlots.some((slot) => slot.player_label === player_label && slot.textkind === textkind)
}

/** The widget every quiz has without being told: the questions' own fields. No quiz may label one of its own this. */
export const QuestionWidgetLabel = 'question'

export const WidgetValidators = Validator(({ obj, oneof, lit, label, noteish, discrim, uint, rowid }) => {
  const widgetLabel = label
    .describe('What the widget is called within its quiz, unique there and never `question`, which is the questions\' own widget. Columns name the widgets they show by this label.')
  const description = noteish
    .describe('What this widget is for in this quiz, in the author\'s words.')

  const expressing = obj({
    kind:             lit('expressing'),
    label:            widgetLabel,
    expression_label: label
      .describe('Which of the workspace\'s expressions works out this widget\'s value for every question.'),
    description:      description.default(''),
  })
    .describe('One expression put to work in one quiz: for every question, the value its formula comes to.')

  const playerLabel = oneof(PlayerLabelVals)
    .describe('Which player is put the quiz\'s questions.')
  const textkind = oneof(TextkindVals)
    .describe('Which of a question\'s texts the player is shown.')

  const playing = obj({
    kind:          lit('playing'),
    label:         widgetLabel,
    player_label:  playerLabel,
    textkind,
    description:   description.default(''),
  })
    .check((context) => {
      const { player_label, textkind: kindShown } = context.value
      if (! isPlaySlot(player_label, kindShown)) {
        context.issues.push({ code: 'custom', input: kindShown, path: ['textkind'], message: `${player_label} is not put a ${kindShown} in this tool` })
      }
    })
    .describe('A connection from a quiz to a player: what the player answered for each question, shown for the text given. The answers are kept on the questions, so removing this only stops showing them.')

  const widget = discrim('kind', [expressing, playing])
    .describe('One of a quiz\'s widgets: something that has a value for every question, which a column can show. A quiz keeps them in a list, and the list is their order.')

  const expressingPatch = obj({
    label:            widgetLabel.optional(),
    expression_label: label.optional(),
    description:      description.optional(),
  })
    .describe('The fields of one expressing widget being revised. A key absent means "leave whatever is already there".')

  const playingPatch = obj({
    label:        widgetLabel.optional(),
    player_label: oneof(PlayerLabelVals).optional(),
    textkind:     oneof(TextkindVals).optional(),
    description:  description.optional(),
  })
    .describe('The fields of one playing widget being revised. A key absent means "leave whatever is already there".')

  const row = obj({
    quiz_id:          rowid
      .describe('The quiz this widget belongs to.'),
    label:            widgetLabel,
    kind:             oneof(WidgetkindVals)
      .describe('What the widget is: an expression put to work, or a player put to the quiz.'),
    expression_label: label.nullable()
      .describe('Which of the workspace\'s expressions an expressing widget works; null for a playing widget.'),
    player_label:     playerLabel.nullable(),
    textkind:         textkind.nullable(),
    description,
    position:         uint
      .describe('The widget\'s place among its quiz\'s widgets, counting from zero.'),
  })
    .check((context) => {
      const { kind, expression_label, player_label, textkind: kindShown } = context.value
      const flag = (fieldkey: string, message: string) => { context.issues.push({ code: 'custom', input: context.value, path: [fieldkey], message }) }
      if (kind === 'expressing') {
        if (expression_label === null) { flag('expression_label', 'An expressing widget names the expression it works') }
        if (player_label !== null || kindShown !== null) { flag('player_label', 'An expressing widget puts no player to the quiz') }
        return
      }
      if (expression_label !== null) { flag('expression_label', 'A playing widget works no expression') }
      if (player_label === null || kindShown === null) {
        flag('player_label', 'A playing widget names its player and the text that player is shown')
      } else if (! isPlaySlot(player_label, kindShown)) {
        flag('textkind', `${player_label} is not put a ${kindShown} in this tool`)
      }
    })
    .describe('One widget as the database holds it: the fields of both kinds, with those the other kind uses left null.')

  return { widgetLabel, expressing, playing, widget, expressingPatch, playingPatch, row }
})

export type ExpressingDNA   = Z.input<typeof WidgetValidators.expressing>
export type ExpressingT     = Z.output<typeof WidgetValidators.expressing>
export type PlayingWidgetDNA = Z.input<typeof WidgetValidators.playing>
export type PlayingWidgetT  = Z.output<typeof WidgetValidators.playing>
export type WidgetDNA       = Z.input<typeof WidgetValidators.widget>
export type WidgetT         = Z.output<typeof WidgetValidators.widget>
export type ExpressingPatch = Z.output<typeof WidgetValidators.expressingPatch>
export type PlayingPatch    = Z.output<typeof WidgetValidators.playingPatch>

/** One expression put to work in one quiz */
export class Expressing implements ExpressingT {
  declare kind:             'expressing'
  declare label:            string
  declare expression_label: string
  declare description:      string

  /** The fields a widget of this kind shows the outside world: the value it comes to */
  static readonly exposed = ['value'] as const

  /**
   * Validated expressing widget, with the description defaulted.
   *
   * @param dna - A label and the expression it works.
   * @returns A complete widget.
   *
   * @example Expressing.fill({ kind: 'expressing', label: 'letters', expression_label: 'answer_letter_count' })
   */
  static fill(dna: ExpressingDNA): ExpressingT {
    return WidgetValidators.expressing(dna)
  }

  /**
   * A widget working `expression`, labelled after it, under a label no sibling has.
   * A label already taken gains a short random suffix.
   *
   * @param expression - What the widget works out.
   * @param taken - The labels the quiz's other widgets already use.
   * @returns A widget ready to add to the quiz.
   *
   * @example Expressing.forExpression(expression, new Set(['clueing_full']))
   */
  static forExpression(expression: Pick<ExpressionT, 'label'>, taken: ReadonlySet<string>): ExpressingT {
    const label = taken.has(expression.label) ? Labelmaker.appendFallback(expression.label) : expression.label
    return this.fill({ kind: 'expressing', label, expression_label: expression.label })
  }
}

/** A connection from a quiz to a player */
export class PlayingWidget implements PlayingWidgetT {
  declare kind:         'playing'
  declare label:        string
  declare player_label: PlayerLabel
  declare textkind:     Textkind
  declare description:  string

  /**
   * Validated playing widget, with the description defaulted.
   *
   * @param dna - A label, a player, and which text the player is shown.
   * @returns A complete widget.
   * @throws When the tool does not put that player that text.
   *
   * @example PlayingWidget.fill({ kind: 'playing', label: 'dumdum', player_label: 'dumdum', textkind: 'clueing' })
   */
  static fill(dna: PlayingWidgetDNA): PlayingWidgetT {
    return WidgetValidators.playing(dna)
  }

  /**
   * The cell of a question this widget shows: which of its played fields holds the answer.
   *
   * @param widget - A playing widget.
   * @returns The slot: `guess`, `clueing_ishes` or `hint_ishes`.
   *
   * @example PlayingWidget.slotOf({ player_label: 'numnum', textkind: 'hint' }).field  // => 'hint_ishes'
   */
  static slotOf(widget: Pick<PlayingWidgetT, 'player_label' | 'textkind'>): PlaySlot {
    const slot = PlaySlots.find((each) => each.player_label === widget.player_label && each.textkind === widget.textkind)
    if (! slot) { throw new Error(`${widget.player_label} is not put a ${widget.textkind}`) }
    return slot
  }

  /**
   * The fields of a player's answer the outside world sees: the answer itself, and whether it is
   * out of date. Not what it cost, which model made it, when, or how it failed.
   *
   * @param widget - A playing widget.
   * @returns Field names, alphabetical.
   *
   * @example PlayingWidget.exposed({ player_label: 'dumdum', textkind: 'clueing' })  // => ['status', 'text']
   */
  static exposed(widget: Pick<PlayingWidgetT, 'player_label' | 'textkind'>): readonly string[] {
    return this.slotOf(widget).field === 'guess' ? ['status', 'text'] : ['items', 'stale', 'status']
  }
}

/** The widgets of `widgets` that are expressings */
export function expressingsOf(widgets: readonly WidgetT[]): ExpressingT[] {
  return widgets.filter((widget): widget is ExpressingT => widget.kind === 'expressing')
}

/** The widgets of `widgets` that are playings */
export function playingsOf(widgets: readonly WidgetT[]): PlayingWidgetT[] {
  return widgets.filter((widget): widget is PlayingWidgetT => widget.kind === 'playing')
}
