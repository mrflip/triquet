import { describe, expect, it } from 'vitest'
import { boxHeightPx } from '../../../src/components/panels/ReadonlyBox'

describe("boxHeightPx", () => {
  it("stands a dense box of ten lines at its lines and padding together", () => {
    expect(boxHeightPx(10, true)).to.eq(152)
  })
  it("stands a plain box taller than a dense one of as many lines, its type being larger", () => {
    expect(boxHeightPx(10, false)).to.be.greaterThan(boxHeightPx(10, true))
  })
  it("grows by one line's height for each line more", () => {
    expect(boxHeightPx(9, false) + 18).to.eq(boxHeightPx(10, false))
  })
})
