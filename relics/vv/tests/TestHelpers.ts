// import * as UU from '.../utils/useful.ts'
//
export * as Examples from './fixtures/ExampleValues.ts'

/** directly log the prettified object */
export function see(objsIn: any, opts = {}) {
  console.warn(prettify(objsIn, opts))
  return objsIn
}

/** pretty print each object in a table-ish structure TODO */
export function prettify(vals: any, opts = {}) {
  // return UU.inspectify(vals, opts)
  return JSON.stringify(vals, null, 2)
}