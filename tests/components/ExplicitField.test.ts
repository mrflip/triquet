import { describe, expect, it } from 'vitest'
import { explicitShown, type ExplicitShown, type ExplicitTyped } from '../../src/components/ExplicitField'
import * as Labelmaker from '../../src/lib/labelmaker'

describe("explicitShown", () => {
  const ExplicitShownTestCases: [ExplicitTyped | null, string, ExplicitShown, string][] = [
    // regular usage:
    [null,                                                "spring", { draft: "spring", unsaved: false }, 'nothing typed: what is held'],
    [{ typed: "autumn",  base: "spring", sent: false },   "spring", { draft: "autumn", unsaved: true  }, 'typed and not sent: unsaved'],
    [{ typed: "autumn",  base: "spring", sent: true  },   "spring", { draft: "autumn", unsaved: false }, 'sent, waiting on the watch: not marked'],
    [{ typed: "autumn",  base: "spring", sent: true  },   "autumn", { draft: "autumn", unsaved: false }, 'the watch brought back what was sent'],
    [{ typed: "autumn",  base: "spring", sent: false },   "winter", { draft: "winter", unsaved: false }, 'relabelled elsewhere while typing: what is held takes over'],
    // tidying:
    [{ typed: "Spring ", base: "spring", sent: false },   "spring", { draft: "Spring ", unsaved: false }, 'typed to the same label, tidied: nothing waits'],
    [{ typed: "",        base: "spring", sent: false },   "spring", { draft: "",       unsaved: true  }, 'emptied: unsaved, for the button to refuse'],
  ]
  it.each(ExplicitShownTestCases)('%j over %s => %j: %s', (typed, committed, expected) => {
    expect(explicitShown(typed, committed, Labelmaker.normalize)).to.deep.equal(expected)
  })

  it("compares untidied text when told no tidying", () => {
    expect(explicitShown({ typed: 'Spring', base: 'spring', sent: false }, 'spring', String)).to.deep.equal({ draft: 'Spring', unsaved: true })
  })
})
