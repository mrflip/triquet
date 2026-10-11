import { describe, expect, it } from 'vitest'
import { embiggenedFold, isShowing, nextFold, toggledFold, type FoldT } from '../../src/components/use-fold'

describe("nextFold", () => {
  const NextFoldTestCases: [[FoldT, boolean | undefined], FoldT, string][] = [
    // regular usage:
    [["folded", undefined], "open",   'folded opens'],
    [["open",   undefined], "big",    'open grows big'],
    [["big",    undefined], "folded", 'big folds again, closing the cycle'],
    // where nothing is bigger than open:
    [["folded", false],     "open",   'folded opens, where it cannot be big'],
    [["open",   false],     "folded", 'open folds again, skipping big where it cannot be big'],
    [["big",    false],     "folded", 'a big one where big is not offered folds, rather than staying big'],
  ]
  for (const [[fold, bigOffered], expected, description] of NextFoldTestCases) {
    it(description, () => {
      expect(nextFold(fold, bigOffered)).to.eq(expected)
    })
  }
  it("comes back round to where it began in three turns", () => {
    const twice = nextFold(nextFold('folded'))
    expect(nextFold(twice)).to.eq('folded')
  })
})

describe("isShowing", () => {
  it("shows what it holds open or big, and not folded", () => {
    expect(['folded', 'open', 'big'].map((fold) => isShowing(fold as FoldT))).to.deep.equal([false, true, true])
  })
})

describe("toggledFold", () => {
  it("opens a folded one, to its resting size rather than big", () => {
    expect(toggledFold('folded')).to.eq('open')
  })
  it("folds an open one", () => {
    expect(toggledFold('open')).to.eq('folded')
  })
  it("folds a big one outright, rather than shrinking it first", () => {
    expect(toggledFold('big')).to.eq('folded')
  })
})

describe("embiggenedFold", () => {
  it("makes a folded one big outright: there is no big but folded", () => {
    expect(embiggenedFold('folded')).to.eq('big')
  })
  it("makes an open one big", () => {
    expect(embiggenedFold('open')).to.eq('big')
  })
  it("shrinks a big one back to open, not folded", () => {
    expect(embiggenedFold('big')).to.eq('open')
  })
})
