import { describe, expect, it } from 'vitest'
import { schema as JZS } from 'jazz-tools'
import { isJsonText, jsonText } from '../../src/db/json-text'

describe('jsonText', () => {
  const column = jsonText<{ bb: number, aa: number[] }>()

  it('is a nullable text column', () => {
    expect(column._build('held')).to.deep.include({ name: 'held', sqlType: 'TEXT', nullable: true })
  })

  it('writes a value as JSON text, keys in order, and null as null', () => {
    expect(column._transform?.to({ bb: 1, aa: [3, 1] })).to.eq('{"aa":[3,1],"bb":1}')
    expect(column._transform?.to(null)).to.eq(null)
  })

  it('reads the text back as the value, and null as null', () => {
    expect(column._transform?.from('{"aa":[3,1],"bb":1}')).to.deep.eq({ aa: [3, 1], bb: 1 })
    expect(column._transform?.from(null)).to.eq(null)
  })
})

describe('isJsonText', () => {
  it('knows the columns jsonText made', () => {
    expect(isJsonText(jsonText<number[]>())).to.eq(true)
  })

  it('does not mistake a plain text column, or a JSON one, for one', () => {
    expect(isJsonText(JZS.string())).to.eq(false)
    expect(isJsonText(JZS.string().optional())).to.eq(false)
    expect(isJsonText(JZS.json())).to.eq(false)
  })
})
