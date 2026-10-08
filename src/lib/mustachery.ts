import Mustache from 'mustache'

/**
 * Mustache, held to the data it is handed. Both of the app's mustache dialects, field templates
 * (`Templating`) and prompt templates (`Prompts`), render in an `OwnKeysContext`, so no template
 * reaches past its bag or input into what JavaScript hangs on every object, and nothing in either
 * is ever called.
 */

/**
 * The context a template renders in when it may read only what its view holds: a key reaches the
 * view's own keys, through its objects and lists, never anything a JavaScript object inherits
 * (`constructor`, `toString`, `__proto__`, a list's `map`) nor a property of a string; and a value
 * that is a function reads as nothing, never called. `.` is the view itself. A key the view does
 * not hold is looked up in the context it was pushed from, as mustache's own does.
 *
 * @example Mustache.render('{{qn.hint}}', new OwnKeysContext({ qn: { hint: 'Not her' } }))  // => 'Not her'
 * @example Mustache.render('[{{constructor}}]', new OwnKeysContext({}))                      // => '[]'
 * @example Mustache.render('[{{fn}}]', new OwnKeysContext({ fn: () => 'called' }))           // => '[]'
 */
export class OwnKeysContext extends Mustache.Context {
  override push(view: unknown): OwnKeysContext {
    return new OwnKeysContext(view, this)
  }

  override lookup(dotkey: string): unknown {
    if (dotkey === '.') { return this.view }
    const found = ownAt(this.view, dotkey.split('.'))
    if (found.held) { return typeof found.val === 'function' ? undefined : found.val }
    return this.parent?.lookup(dotkey)
  }
}

/** What `keypath` reaches in `view`, walking only the own keys of its objects and lists; `held` is false when some step finds nothing of the view's own */
function ownAt(view: unknown, keypath: readonly string[]): { held: boolean, val: unknown } {
  let val = view
  for (const key of keypath) {
    if (typeof val !== 'object' || val === null || ! Object.hasOwn(val, key)) { return { held: false, val: undefined } }
    val = (val as Record<string, unknown>)[key]
  }
  return { held: true, val }
}
