import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { answerOf, clipText, shapeIssue, vetReply } from '../../../src/lib/ask/replies'
import type { AskReplyT } from '../../../src/lib/ask/contract'
import type { JsonT } from '../../../src/models/widgeted'

const answered = (value: Record<string, JsonT>): AskReplyT => ({ ok: true, value, truncated: false, model_tier_applied: 'quick', approx_tokens: 84 })
const Unreadable = { ok: false, failurekind: 'unreadable' }

/** `val` wrapped in `levels` single-item lists */
const nested = (levels: number): JsonT => (levels === 0 ? 1 : [nested(levels - 1)])

describe('clipText', () => {
  it('cuts to what a textish field holds', () => {
    expect(clipText('x'.repeat(5000)).length).to.eq(3600)
  })

  it('leaves shorter text exactly as it was, space and all', () => {
    expect(clipText('  Leon\n')).to.eq('  Leon\n')
  })
})

describe('answerOf', () => {
  const Cases: [[string, boolean], unknown, string][] = [
    // regular usage:
    [['{"guess": "Leon"}', false],                          { ok: true, value: { guess: 'Leon' } },           'an object, as asked'],
    [['  \n{"guess": "Leon"}\n ', false],                   { ok: true, value: { guess: 'Leon' } },           'an object with space around it'],
    [['```json\n{"items": []}\n```', false],                { ok: true, value: { items: [] } },               'an object in a code fence, though asked not to'],
    [['```\n{"items": []}```', false],                      { ok: true, value: { items: [] } },               'an object in a bare code fence'],
    // what will not do:
    [['Leon', false],                                       { ok: false, failurekind: 'unreadable' },          'prose'],
    [['Sure! {"guess": "Leon"}', false],                    { ok: false, failurekind: 'unreadable' },          'prose before the object'],
    [['[1, 2]', false],                                     { ok: false, failurekind: 'unreadable' },          'a list'],
    [['"Leon"', false],                                     { ok: false, failurekind: 'unreadable' },          'a bare string'],
    [['null', false],                                       { ok: false, failurekind: 'unreadable' },          'null'],
    [['', false],                                           { ok: false, failurekind: 'emptyAnswer' },         'nothing at all'],
    // cut short:
    [['{"guess": "Le', true],                               { ok: false, failurekind: 'cutShort' },            'an object the room ran out in'],
    [['', true],                                            { ok: false, failurekind: 'cutShort' },            'nothing, the room spent before a word was written'],
    [['{"guess": "Leon"}', true],                           { ok: true, value: { guess: 'Leon' } },           'a whole object, though the room ran out just after it'],
  ]
  for (const [[text, truncated], expected, describes] of Cases) {
    it(describes, () => {
      expect(answerOf(text, truncated)).to.deep.eq(expected)
    })
  }
})

describe('shapeIssue', () => {
  const Cases: [JsonT, string | null, string][] = [
    [{ guess: 'Leon', items: [{ text: 'three', value: 3 }] },  null,                                        'an ordinary answer'],
    [{ note: 'tab\there\r\nand lines' },                        null,                                        'tabs and newlines in a string'],
    [{ guess: 'Le\u{1}on' },                                    'a string has weird characters',             'a control character in a string'],
    [{ $set: 1 },                                               'the key "$set" is not a key the tool can keep', 'a key the database reserves'],
    [{ 'été': 1 },                                              'the key "été" is not a key the tool can keep',  'a key beyond printable ASCII'],
    [{ ['k'.repeat(201)]: 1 },                                  `the key "${'k'.repeat(201)}" is not a key the tool can keep`, 'a key too long'],
    [{ deep: nested(15) },                                      null,                                        'nesting as deep as allowed'],
    [{ deep: nested(16) },                                      'it nests deeper than 16 levels',            'nesting past reason'],
    [{ many: Array.from({ length: 2001 }, () => 0) },           'one level holds more than 2000 items',      'a list longer than the database would keep'],
  ]
  for (const [val, expected, describes] of Cases) {
    it(describes, () => {
      expect(shapeIssue(val, 0)).to.eq(expected)
    })
  }
})

describe('vetReply', () => {
  beforeEach(() => { vi.spyOn(console, 'warn').mockImplementation(() => null) })
  afterEach(() => { vi.restoreAllMocks() })

  it('passes an answer through untrimmed', () => {
    expect(vetReply(answered({ guess: '  Leon, probably?\n' }))).to.deep.eq(answered({ guess: '  Leon, probably?\n' }))
  })

  it('clips every overlong string, however deep, rather than refusing it', () => {
    const vetted = vetReply(answered({ guess: 'x'.repeat(5000), items: [{ text: 'three'.repeat(1000) }] }))
    expect(vetted).to.deep.eq(answered({ guess: 'x'.repeat(3600), items: [{ text: 'three'.repeat(720) }] }))
  })

  it('turns an answer that cannot be kept into an unreadable failure, and says why on the server', () => {
    expect(vetReply(answered({ guess: 'Leon\u{0}' }))).to.deep.eq(Unreadable)
    expect(vi.mocked(console.warn).mock.calls[0]?.[1]).to.eq('a string has weird characters')
  })

  it('refuses an answer too large to keep, even once clipped', () => {
    const items = Array.from({ length: 1000 }, () => 'x'.repeat(50))
    expect(vetReply(answered({ items }))).to.deep.eq(Unreadable)
  })

  it('lets a failure through as it is', () => {
    expect(vetReply({ ok: false, failurekind: 'declined' })).to.deep.eq({ ok: false, failurekind: 'declined' })
  })
})
