import type * as Z from 'zod'
import { describe, expect, it } from 'vitest'
import { zid, zodOutputToConvexFields, zodToConvexFields } from 'convex-helpers/server/zod4'
import { BottingValidators } from '../../src/models/botting'
import { ColumnValidators } from '../../src/models/column'
import { ExpressionValidators } from '../../src/models/expression'
import { HuntValidators } from '../../src/models/hunt'
import { IdentValidators } from '../../src/models/ident'
import { IdentingValidators } from '../../src/models/identing'
import { QuestionValidators } from '../../src/models/question'
import { QuizValidators } from '../../src/models/quiz'
import { RealmValidators } from '../../src/models/realm'
import { ReviewValidators } from '../../src/models/review'
import { WidgetValidators } from '../../src/models/widget'

const RowValidators: Record<string, Z.ZodObject> = {
  bottings:    BottingValidators.row,
  columns:     ColumnValidators.row,
  expressions: ExpressionValidators.row,
  hunts:       HuntValidators.row,
  idents:      IdentValidators.row,
  identings:   IdentingValidators.row,
  questions:   QuestionValidators.row,
  quizzes:     QuizValidators.row,
  realms:      RealmValidators.row,
  reviews:     ReviewValidators.row,
  widgets:     WidgetValidators.row,
}

type ConvexFieldsT = Record<string, { isOptional: string, kind: string }>

/** The names of the fields in `fields` that Convex would let a document leave out */
function optionalsIn(fields: ConvexFieldsT): string[] {
  return Object.keys(fields).filter((fieldname) => fields[fieldname]?.isOptional === 'optional')
}

describe('the zod4 bridge over every row validator', () => {
  for (const [tablename, row] of Object.entries(RowValidators)) {
    it(`${tablename}: converts every field, and requires every one`, () => {
      const fields = zodOutputToConvexFields(row.shape) as ConvexFieldsT
      expect(Object.keys(fields)).to.deep.equal(Object.keys(row.shape))
      expect(optionalsIn(fields)).to.deep.equal([])
    })
  }

  it('makes a defaulted field optional on the input side, which is why tables take the output side', () => {
    const fields = zodToConvexFields(ReviewValidators.row.shape) as ConvexFieldsT
    expect(optionalsIn(fields)).to.deep.equal(['overall', 'phase'])
  })

  it('turns a rowid into a plain string, and a zid into an id of its table', () => {
    const fields = zodOutputToConvexFields({ plain: QuestionValidators.row.shape.quiz_id, pointer: zid('quizzes') }) as ConvexFieldsT
    expect(fields.plain?.kind).to.eq('string')
    expect(fields.pointer?.kind).to.eq('id')
  })
})
