import { describe, expect, it } from 'vitest'
import { choiceKeyOf } from '../../src/components/ColumnFields'
import * as ColumnMenu from '../../src/lib/column-menu'

describe('choiceKeyOf', () => {
  it("keys a choice by its group and its ref", () => {
    expect(choiceKeyOf({ source: 'categories', group: 'The same in every row' })).to.eq('The same in every row/categories')
  })

  it("keeps a ref listed under two groups as two keys", () => {
    expect(choiceKeyOf({ source: 'categories', group: ColumnMenu.RefGroups.word })).not.to.eq(choiceKeyOf({ source: 'categories', group: ColumnMenu.RefGroups.widgeting }))
  })

  it("gives every choice of a quiz's menu a key of its own", () => {
    const keys = ColumnMenu.refChoicesOf({ widgetings: [] }).map((choice) => choiceKeyOf(choice))
    expect(new Set(keys).size).to.eq(keys.length)
  })
})
