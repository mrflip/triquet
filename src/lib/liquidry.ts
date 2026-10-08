import { Context, Liquid, LiquidError, Tag, toValueSync, type Emitter, type Liquid as LiquidT, type TagToken, type TopLevelToken } from 'liquidjs'

/**
 * Liquid (LiquidJS), held to the data it is handed: the one template language of the app, for
 * field and recap templates (`Templating`) and prompt templates (`Prompts`), each a renderer made
 * here (`rendererFor`) with the filters it offers and what a value fills in as.
 *
 * Liquid is interpreted, never compiled to code. Every renderer reads only what its scope itself
 * holds at a key (`ownPropertyOnly`), never anything a JavaScript object inherits; counts an empty
 * value as false, as JavaScript does (`jsTruthy`); refuses a filter it does not know; and refuses
 * to include another template, as the template is read. LiquidJS calls a function it finds in its
 * scope, so a scope holds only data. A render is stopped, deterministically, past the pieces and
 * characters it may write and the characters its shaping filters may be handed; Liquid's own limits
 * on time, allocation and length stand behind those.
 */

/** A template rendered: `text` is what it came to, or, when it could not be rendered, the template as typed, with `issue` saying why */
export type RenderedT = {
  text:  string
  issue: string | null
}

/**
 * The most pieces one render may write out: each value a tag fills in, and each run of the
 * template's own text, every time a loop writes it again. Past this, a template nesting a list in
 * a list in a list is stopped rather than left to hang the page. Counted, so a template stops at
 * the same place on any machine.
 */
export const FillBudget = 100_000

/**
 * The longest a render may come to; anything longer is refused. What its tags fill in, and its own
 * text each time a loop writes it out again, are counted as they go, so a tag filling in a whole
 * list's JSON again and again, or a long line of text repeated by a list inside a list, is stopped
 * before it is built.
 */
export const FilledMax = 100_000

/**
 * The most characters one render's shaping filters may be handed, all told: a long text captured
 * and shaped again and again is stopped rather than left to hang the page.
 */
export const ShapedMax = 1_000_000

/**
 * Liquid's own limits, behind the counts above: the longest a template may be, the longest one
 * render may take (milliseconds), and the most it may allocate. Each stops what the counts cannot
 * see: a loop that writes nothing, a range of a hundred million numbers.
 */
const LiquidLimits = { parseLimit: 100_000, renderLimit: 1000, memoryLimit: 10_000_000 } as const

/** Said when a render is stopped for writing more than `FillBudget` pieces */
const OverBudget = 'This template reads too much: a list inside a list inside a list, perhaps.'

/** Said when a render comes to more than `FilledMax` characters */
const OverLong = 'This template comes to far too much text to show.'

/** Said when a render's shaping filters are handed more than `ShapedMax` characters */
const OverShaped = 'This template shapes too much text: the same long text shaped again and again, perhaps.'

/** A render stopped by a budget of ours, which says why in its message alone */
class Stopped extends Error {}

/** What one render has left: pieces it may write out, characters it may write out, and characters its shaping filters may be handed */
type Budget = { left: number, charsLeft: number, shapingLeft: number }

/** A filter that shapes a value's text: handed the value as it would fill in, and counted against the render's budget */
export type ShaperT = (text: string) => string

/** What a renderer offers beyond Liquid's own: what a value fills in as, and its filters */
export type RendererSpecT = {
  /** What one value fills in as, for a tag and for a shaping filter's input */
  fillingOf: (val: unknown) => string
  /** Filters that shape a value's text, by name */
  shapers?:  Readonly<Record<string, ShaperT>>
  /** Any other filters, by name, each handed the value as it is */
  filters?:  Readonly<Record<string, (val: unknown) => unknown>>
}

/** A template language, as `rendererFor` makes it */
export type RendererT = {
  /**
   * `template` rendered over `scope`, or the template as typed with what is wrong with it. Never
   * throws. A key the scope lacks fills in as nothing.
   */
  render:    (template: string, scope: object) => RenderedT
  /** What is wrong with `template`, or null when it reads: what only rendering finds is `render`'s to say */
  issueOf:   (template: string) => string | null
  /** The names `template` reads from its scope at the top level, each once, in the order first read; none when it does not read */
  globalsOf: (template: string) => string[]
}

/** Where a render's budget rides on its Liquid context: a key no template can name */
const BudgetKey = Symbol('budget')

/** The budget of the render `context` belongs to */
function budgetIn(context: Context): Budget {
  return (context.globals as Record<symbol, Budget | undefined>)[BudgetKey]!
}

/**
 * A tag that would include another template (`{% include %}`, `{% render %}`, `{% layout %}`),
 * refused as the template is read: there are none to include.
 */
class RefusedTag extends Tag {
  constructor(token: TagToken, remainTokens: TopLevelToken[], liquid: LiquidT) {
    super(token, remainTokens, liquid)
    throw new Error(`{% ${token.name} %} includes another template, and there are none to include`)
  }

  * render(): Generator<unknown, void> {} // eslint-disable-line @typescript-eslint/no-empty-function -- never reached: the tag refuses itself as it is read
}

/**
 * Where a render writes what it comes to: each piece, a value a tag fills in or a run of the
 * template's own text, as it fills in, counted against the render's budget as it is written, so a
 * runaway template is stopped before its text is built.
 */
class CountingEmitter implements Emitter {
  buffer = ''
  private readonly budget: Budget
  private readonly fillingOf: (val: unknown) => string

  constructor(budget: Budget, fillingOf: (val: unknown) => string) {
    this.budget = budget
    this.fillingOf = fillingOf
  }

  write(piece: unknown): void {
    const text = typeof piece === 'string' ? piece : this.fillingOf(piece)
    this.budget.left -= 1
    if (this.budget.left < 0) { throw new Stopped(OverBudget) }
    this.budget.charsLeft -= text.length
    if (this.budget.charsLeft < 0) { throw new Stopped(OverLong) }
    this.buffer += text
  }
}

/**
 * A template language: Liquid as this module describes it, with the filters `spec` offers.
 *
 * @example const Renderer = rendererFor({ fillingOf: (val) => String(val ?? '') }); Renderer.render('Hi {{ name }}', { name: 'Ada' })  // => { text: 'Hi Ada', issue: null }
 */
export function rendererFor(spec: RendererSpecT): RendererT {
  const engine = new Liquid({ ownPropertyOnly: true, jsTruthy: true, strictFilters: true, ...LiquidLimits })
  const shapers = Object.entries(spec.shapers ?? {})
  const filters = Object.entries(spec.filters ?? {})
  for (const [name, shaper] of shapers) {
    engine.registerFilter(name, function shaping(this: { context: Context }, val: unknown) {
      const budget = budgetIn(this.context)
      const text = spec.fillingOf(val)
      budget.shapingLeft -= text.length
      if (budget.shapingLeft < 0) { throw new Stopped(OverShaped) }
      return shaper(text)
    })
  }
  for (const [name, filter] of filters) { engine.registerFilter(name, filter) }
  for (const name of ['include', 'render', 'layout']) { engine.registerTag(name, RefusedTag) }

  return {
    render(template, scope) {
      const budget: Budget = { left: FillBudget, charsLeft: FilledMax, shapingLeft: ShapedMax }
      try {
        const parsed = engine.parse(template)
        const context = new Context(scope, engine.options, { sync: true, globals: { [BudgetKey]: budget } }, { liquid: engine })
        const emitter = new CountingEmitter(budget, spec.fillingOf)
        toValueSync(engine.renderer.renderTemplates(parsed, context, emitter))
        return { text: emitter.buffer, issue: null }
      } catch (err) {
        return { text: template, issue: issueMessageOf(err) }
      }
    },
    issueOf(template) {
      try {
        engine.parse(template)
        return null
      } catch (err) {
        return issueMessageOf(err)
      }
    },
    globalsOf(template) {
      try {
        return engine.globalVariablesSync(template)
      } catch {
        return []
      }
    },
  }
}

/** What a template's failure says: Liquid's message, with where it stopped reading; or, for a budget of ours, ours alone; never a stack */
function issueMessageOf(err: unknown): string {
  if (err instanceof LiquidError && err.originalError instanceof Stopped) { return err.originalError.message }
  return err instanceof Error ? err.message : 'This does not read as a template'
}
