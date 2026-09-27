import * as Z from 'zod'
import { describe, expect, expectTypeOf, it } from 'vitest'
import type { schema as JZS } from 'jazz-tools'
import { app, schema } from '../../src/db/schema'
import { isJsonText } from '../../src/db/json-text'
import { plain } from '../../src/lib/validator'
import { ColumnValidators } from '../../src/models/column'
import { ExpressionValidators } from '../../src/models/expression'
import { BottingValidators } from '../../src/models/botting'
import { QuestionValidators } from '../../src/models/question'
import { QuizValidators } from '../../src/models/quiz'
import { WidgetValidators } from '../../src/models/widget'
import { HuntValidators } from '../../src/models/hunt'
import { IdentValidators } from '../../src/models/ident'
import { IdentingValidators } from '../../src/models/identing'
import { RealmValidators } from '../../src/models/realm'
import { ReviewValidators } from '../../src/models/review'

// Each table is declared twice on purpose: the Jazz table in `db/schema.ts`, and the Zod row
// validator in its model, which says what a column cannot. This walks every table and holds
// the two to the same shape.

/** Every table, and the row validator its writes pass through */
const RowValidators = {
  idents:      IdentValidators.row,
  identings:   IdentingValidators.row,
  hunts:       HuntValidators.row,
  realms:      RealmValidators.row,
  expressions: ExpressionValidators.row,
  quizzes:     QuizValidators.row,
  widgets:     WidgetValidators.row,
  columns:     ColumnValidators.row,
  questions:   QuestionValidators.row,
  bottings:    BottingValidators.row,
  reviews:     ReviewValidators.row,
} as const

type JsonSchemaish = { type?: string | string[], anyOf?: JsonSchemaish[], oneOf?: JsonSchemaish[], enum?: unknown[], const?: unknown, format?: string }

/** For sorting names into a stable order to compare */
const alphabetically = (aa: string, bb: string) => aa.localeCompare(bb)

/** A field's JSON Schema, as Zod writes it for the draft Jazz compiles to */
function jsonSchemaOf(field: Z.ZodType): JsonSchemaish {
  return Z.toJSONSchema(plain(field), { target: 'draft-7', unrepresentable: 'any' })
}

/** Every JSON type a schema allows, through its unions */
function basetypesOf(jsonSchema: JsonSchemaish): Set<string> {
  const branches = [...(jsonSchema.anyOf ?? []), ...(jsonSchema.oneOf ?? [])]
  const own = jsonSchema.type === undefined ? [] : [jsonSchema.type].flat()
  return new Set([...own, ...branches.flatMap((branch) => [...basetypesOf(branch)])])
}

/** Every string format a schema names, through its unions */
function formatsOf(jsonSchema: JsonSchemaish): Set<string> {
  const branches = [...(jsonSchema.anyOf ?? []), ...(jsonSchema.oneOf ?? [])]
  const own = jsonSchema.format === undefined ? [] : [jsonSchema.format]
  return new Set([...own, ...branches.flatMap((branch) => [...formatsOf(branch)])])
}

/** Every value a closed set allows, through its unions */
function variantsOf(jsonSchema: JsonSchemaish): string[] {
  const branches = [...(jsonSchema.anyOf ?? []), ...(jsonSchema.oneOf ?? [])]
  const own = [...(jsonSchema.enum ?? []), ...(jsonSchema.const === undefined ? [] : [jsonSchema.const])]
  return [...own, ...branches.flatMap((branch) => variantsOf(branch))].filter((val): val is string => typeof val === 'string').toSorted(alphabetically)
}

/** What JSON type a Jazz column's values take */
const BasetypeOfColumn: Record<string, string> = { Text: 'string', Uuid: 'string', Enum: 'string', Integer: 'integer', Double: 'number', Boolean: 'boolean' }

describe('every table and its row validator', () => {
  it('cover the same tables', () => {
    expect(Object.keys(app.wasmSchema).toSorted(alphabetically)).to.deep.eq(Object.keys(RowValidators).toSorted(alphabetically))
  })

  for (const [tablename, rowValidator] of Object.entries(RowValidators)) {
    describe(tablename, () => {
      const columns = app.wasmSchema[tablename]?.columns ?? []
      const builders = (schema as unknown as Record<string, { columns: Record<string, object> }>)[tablename]?.columns ?? {}
      const fields = rowValidator.shape as Record<string, Z.ZodType>

      it('name the same columns, apart from Jazz\'s id and provenance', () => {
        expect(columns.map((column) => column.name).toSorted(alphabetically)).to.deep.eq(Object.keys(fields).toSorted(alphabetically))
      })

      for (const column of columns) {
        const field = fields[column.name]
        if (! field) { continue }
        const jsonSchema = jsonSchemaOf(field)
        const basetypes = basetypesOf(jsonSchema)

        it(`agree whether ${column.name} may be null`, () => {
          expect(basetypes.has('null')).to.eq(column.nullable)
        })

        const columnType = column.column_type
        if (columnType.type === 'Json') {
          it(`give ${column.name} the same JSON schema`, () => {
            expect(columnType.schema).to.deep.eq(jsonSchema)
          })
        } else if (isJsonText(builders[column.name] ?? {})) {
          it(`hold ${column.name} as text, and a structured value in the validator`, () => {
            expect(columnType.type).to.eq('Text')
            expect([...basetypes].filter((basetype) => basetype !== 'null')).not.to.deep.eq(['string'])
          })
        } else {
          it(`give ${column.name} the same base type`, () => {
            const expected = BasetypeOfColumn[columnType.type]
            expect([...basetypes].filter((basetype) => basetype !== 'null')).to.deep.eq([expected])
          })
        }

        if (columnType.type === 'Enum') {
          it(`allow ${column.name} the same values`, () => {
            expect(variantsOf(jsonSchema)).to.deep.eq(columnType.variants.toSorted(alphabetically))
          })
        }

        it(`agree whether ${column.name} points at a row`, () => {
          expect(formatsOf(jsonSchema).has('uuid')).to.eq(column.references !== undefined)
        })
      }
    })
  }

  it('give every row the type Jazz reads back, apart from its id', () => {
    type RowOf<TT> = Omit<JZS.RowOf<TT>, 'id'>
    expectTypeOf<Z.output<typeof IdentValidators.row>>().toEqualTypeOf<RowOf<typeof app.idents>>()
    expectTypeOf<Z.output<typeof IdentingValidators.row>>().toEqualTypeOf<RowOf<typeof app.identings>>()
    expectTypeOf<Z.output<typeof HuntValidators.row>>().toEqualTypeOf<RowOf<typeof app.hunts>>()
    expectTypeOf<Z.output<typeof RealmValidators.row>>().toEqualTypeOf<RowOf<typeof app.realms>>()
    expectTypeOf<Z.output<typeof ExpressionValidators.row>>().toEqualTypeOf<RowOf<typeof app.expressions>>()
    expectTypeOf<Z.output<typeof QuizValidators.row>>().toEqualTypeOf<RowOf<typeof app.quizzes>>()
    expectTypeOf<Z.output<typeof WidgetValidators.row>>().toEqualTypeOf<RowOf<typeof app.widgets>>()
    expectTypeOf<Z.output<typeof ColumnValidators.row>>().toEqualTypeOf<RowOf<typeof app.columns>>()
    expectTypeOf<Z.output<typeof QuestionValidators.row>>().toEqualTypeOf<RowOf<typeof app.questions>>()
    expectTypeOf<Z.output<typeof BottingValidators.row>>().toEqualTypeOf<RowOf<typeof app.bottings>>()
    expectTypeOf<Z.output<typeof ReviewValidators.row>>().toEqualTypeOf<RowOf<typeof app.reviews>>()
  })
})
