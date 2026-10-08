import { describe, expect, it } from 'vitest'
import { anyOpenIn, openedIn, unfoldIn } from '../../src/components/use-folds'

describe("unfoldIn", () => {
  it("opens the item, leaving the rest folded", () => {
    expect([...unfoldIn(new Set(['q1', 'q2']), 'q1')]).to.deep.equal(['q2'])
  })
  it("hands back the very same set when the item was already open, so nothing re-renders", () => {
    const folded = new Set(['q2'])
    expect(unfoldIn(folded, 'q1')).to.equal(folded)
  })
  it("never changes the set it was given", () => {
    const folded = new Set(['q1', 'q2'])
    unfoldIn(folded, 'q1')
    expect([...folded]).to.deep.equal(['q1', 'q2'])
  })
})

describe("anyOpenIn", () => {
  const AnyOpenTestCases: [[string[], string[]], boolean, string][] = [
    // regular usage:
    [[["q1", "q2"],       ["q1", "q2"]], false, 'every item folded: none open'],
    [[["q2"],             ["q1", "q2"]], true,  'one item unfolded: some open'],
    [[[],                 ["q1", "q2"]], true,  'nothing folded: all open'],
    [[["q1"],             ["q1", "q2"]], true,  'an item that arrived after the fold is open'],
    // weird cases:
    [[["q1", "q2", "q9"], ["q1", "q2"]], false, 'an item gone from the list is not asked about'],
    [[["q9"],             ["q1"]],       true,  'a folded item gone from the list holds no other folded'],
    // trivial cases:
    [[[],                 []],           false, 'an empty list has nothing open'],
    [[["q1"],             []],           false, 'an empty list has nothing open, whatever was folded'],
  ]
  it.each(AnyOpenTestCases)('%j => %s: %s', ([folded, itemkeys], expected) => {
    expect(anyOpenIn(new Set(folded), itemkeys)).to.eq(expected)
  })
})

describe("openedIn", () => {
  it("opens an item, beside those open", () => {
    expect([...openedIn(new Set(['notes']), 'hint', true)]).to.deep.equal(['notes', 'hint'])
  })
  it("folds an item, leaving the rest open", () => {
    expect([...openedIn(new Set(['notes', 'hint']), 'notes', false)]).to.deep.equal(['hint'])
  })
  it("hands back the very same set when the item already was as asked, so nothing re-renders", () => {
    const opened = new Set(['notes'])
    expect(openedIn(opened, 'notes', true)).to.equal(opened)
    expect(openedIn(opened, 'hint', false)).to.equal(opened)
  })
  it("never changes the set it was given", () => {
    const opened = new Set(['notes'])
    openedIn(opened, 'hint', true)
    openedIn(opened, 'notes', false)
    expect([...opened]).to.deep.equal(['notes'])
  })
})
