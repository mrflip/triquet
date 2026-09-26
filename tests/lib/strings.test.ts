import { describe, expect, it } from 'vitest'
import * as SS from '../../src/lib/strings'

describe('manyAndLast', () => {
  it('reports an empty collection as void', () => {
    expect(SS.manyAndLast([])).to.eql({ iam: 'void' })
  })
  it('reports one entry as solo', () => {
    expect(SS.manyAndLast(['aa'])).to.eql({ iam: 'solo', first: 'aa' })
  })
  it('reports two as a pair', () => {
    expect(SS.manyAndLast(['aa', 'bb'])).to.eql({ iam: 'pair', first: 'aa', last: 'bb' })
  })
  it('reports three or more under the cap as many, holding the last apart', () => {
    expect(SS.manyAndLast(['aa', 'bb', 'cc']))
      .to.eql({ iam: 'many', many: ['aa', 'bb'], last: 'cc' })
  })
  it('reports xnil when nothing was asked for', () => {
    expect(SS.manyAndLast(['aa', 'bb'], { max: 0 })).to.eql({ iam: 'xnil' })
  })
  it('reports xone when one was asked for but there were more', () => {
    expect(SS.manyAndLast(['aa', 'bb', 'cc'], { max: 1 })).to.eql({ iam: 'xone', first: 'aa' })
  })
  it('reports xtwo when two were asked for but there were more', () => {
    expect(SS.manyAndLast(['aa', 'bb', 'cc'], { max: 2 }))
      .to.eql({ iam: 'xtwo', first: 'aa', last: 'cc' })
  })
  it('reports xtra over the cap, keeping the real last entry', () => {
    expect(SS.manyAndLast(['aa', 'bb', 'cc', 'dd', 'ee'], { max: 4, shave: 0 }))
      .to.eql({ iam: 'xtra', many: ['aa', 'bb', 'cc'], last: 'ee' })
  })
  it('keeps fewer still when shaving, to leave room for a marker', () => {
    expect(SS.manyAndLast(['aa', 'bb', 'cc', 'dd', 'ee'], { max: 4, shave: 1 }))
      .to.eql({ iam: 'xtra', many: ['aa', 'bb'], last: 'ee' })
  })
  it('reads a bag as its values', () => {
    expect(SS.manyAndLast({ aa: 1, bb: 2 })).to.eql({ iam: 'pair', first: 1, last: 2 })
  })
  it('does not mutate the collection it was handed', () => {
    const arr = ['aa', 'bb', 'cc']
    SS.manyAndLast(arr)
    expect(arr).to.eql(['aa', 'bb', 'cc'])
  })
})

describe('someManyAndLast', () => {
  it('flattens an uncapped result into one body and no tail', () => {
    const result = SS.someManyAndLast(['aa', 'bb', 'cc'])
    expect(result.some).to.eql(['aa', 'bb', 'cc'])
    expect(result.body).to.eql(['aa', 'bb', 'cc'])
    expect(result.tail).to.eql([])
    expect(result.postsize).to.eq(3)
    expect(result.ellipsize).to.eq(false)
  })
  it('splits off the tail and raises the flag when entries were cut', () => {
    const result = SS.someManyAndLast(['aa', 'bb', 'cc', 'dd'], { max: 3 })
    expect(result.ellipsize).to.eq(true)
    expect(result.tail).to.eql(['dd'])
    expect(result.some).to.eql(['aa', 'bb', 'dd'])
  })
  it('handles an empty collection', () => {
    const result = SS.someManyAndLast([])
    expect(result.some).to.eql([])
    expect(result.postsize).to.eq(0)
    expect(result.ellipsize).to.eq(false)
  })
})

describe('hardcapList', () => {
  it('returns the list untouched when nothing needs cutting', () => {
    expect(SS.hardcapList(['aa', 'bb'])).to.eql(['aa', 'bb'])
  })
  it('puts the marker between what it kept and the real last entry', () => {
    const result = SS.hardcapList(['aa', 'bb', 'cc', 'dd', 'ee', 'ff', 'gg', 'hh'], { max: 5, shave: 1 })
    expect(result).to.include('…')
    expect(result[0]).to.eq('aa')
    expect(result.at(-1)).to.eq('hh')
  })
  it('returns nothing when nothing was asked for', () => {
    expect(SS.hardcapList(['aa', 'bb'], { max: 0 })).to.eql([])
  })
  it('takes a marker of your choosing', () => {
    expect(SS.hardcapList(['aa', 'bb', 'cc', 'dd'], { max: 3, shave: 1, yadayada: '--' }))
      .to.eql(['aa', '--', 'dd'])
  })
})

describe('toSentence', () => {
  const Cases: [unknown[], SS.ToSentenceOpts, string, string][] = [
    // regular usage:
    [[],                  {},                   '',                 'an empty list is an empty string'],
    [['aa'],              {},                   'aa',               'one entry stands alone, unquoted'],
    [['aa', 'bb'],        {},                   'aa and bb',        'two are joined by the conjunction, with no comma'],
    [['aa', 'bb', 'cc'],  {},                   'aa, bb, and cc',   'three take the serial comma'],
    // the conjunction and joiners:
    [['aa', 'bb'],        { conj: 'or' },       'aa or bb',         'the conjunction is yours to choose'],
    [['aa', 'bb', 'cc'],  { conj: 'or' },       'aa, bb, or cc',    'and it carries into the longer form'],
    [['aa', 'bb', 'cc'],  { joiner: '; ' },     'aa; bb; and cc',   'the joiner is too'],
    // the empty case:
    [[],                  { empty: 'nothing' }, 'nothing',          'an empty list can say something instead'],
    // rendering:
    [[1, 2],              {},                   '1 and 2',          'numbers render bare'],
    [[null],              {},                   'null',             'null is visible rather than skipped'],
    [[''],                {},                   "''",               'an empty string shows its quotes, or it would vanish'],
  ]

  for (const [clxn, opts, wanted, blurb] of Cases) {
    it(blurb, () => { expect(SS.toSentence(clxn, opts)).to.eq(wanted) })
  }

  it('elides the middle but keeps the real final entry', () => {
    const result = SS.toSentence(['aa', 'bb', 'cc', 'dd'], { max: 3, conj: 'and', yadayada: ', ... and ' })
    expect(result).to.include('...')
    expect(result).to.include('dd')
  })
  it('takes a stringifier for entries it would not know how to phrase', () => {
    expect(SS.toSentence([1, 2], { stringifier: (val) => `n${String(val)}` })).to.eq('n1 and n2')
  })
  it('appends whoa whenever anything was left out', () => {
    expect(SS.toSentence(['aa', 'bb', 'cc'], { max: 0, empty: '', whoa: ' (more)' })).to.eq(' (more)')
  })
  it('reads a bag as its values', () => {
    expect(SS.toSentence({ aa: 'one', bb: 'two' })).to.eq('one and two')
  })
  it('refuses an option it does not recognise, rather than ignoring it', () => {
    // @ts-expect-error the point of the test is the unrecognised key
    expect(() => SS.toSentence(['aa'], { joinerr: ', ' })).to.throw(/Unrecognised options/)
  })
})

describe('snipjoin', () => {
  it('joins a short list with plain commas, no conjunction', () => {
    expect(SS.snipjoin(['aa', 'bb', 'cc'])).to.eq('aa, bb, cc')
  })
  it('snips a long one, keeping the last entry', () => {
    const result = SS.snipjoin(['aa', 'bb', 'cc', 'dd', 'ee', 'ff', 'gg', 'hh', 'ii', 'jj'], { max: 5 })
    expect(result).to.include(', ...')
    expect(result).to.include('jj')
  })
  it('is what briefSentence calls', () => {
    expect(SS.briefSentence(['xx', 'yy'])).to.eq(SS.snipjoin(['xx', 'yy']))
  })
})

describe('shorten', () => {
  it('returns an empty string untouched', () => {
    expect(SS.shorten('')).to.eq('')
  })
  it('returns a string that already fits, trimmed', () => {
    expect(SS.shorten('hello world', 20)).to.eq('hello world')
    expect(SS.shorten('  padded  ', 20)).to.eq('padded')
  })
  it('cuts a long one and marks it', () => {
    const result = SS.shorten('The quick brown fox jumps over the lazy dog', 20)
    expect(result).to.include('...')
    expect(result.length).to.be.lte(23)
  })
  it('takes a marker of your choosing', () => {
    expect(SS.shorten('The quick brown fox jumps over the lazy dog', 25, { tail: '…' })).to.include('…')
  })
  it('does not leave half a word before the marker', () => {
    // The raw slice would have ended mid-'jumps'; the partial word goes, 'fox' stays whole.
    expect(SS.shorten('The quick brown fox jumps over the lazy dog', 25)).to.eq('The quick brown fox...')
  })
  it('stays a plain slice when there is no room for manners', () => {
    expect(SS.shorten('The quick brown fox', 10)).to.eq('The quick')
  })
  it('shortenWithEllipsis uses the single glyph', () => {
    const result = SS.shortenWithEllipsis('A very long string that should be shortened', 25)
    expect(result).to.include('…')
    expect(result.length).to.be.lte(26)
  })
})

describe('smush', () => {
  it('joins the parts with the separator', () => {
    expect(SS.smush('-', 'aa', 'bb', 'cc')).to.eq('aa-bb-cc')
  })
  it('drops nil and empty parts', () => {
    expect(SS.smush(',', 'aa', undefined, 'bb', null, 'cc')).to.eq('aa,bb,cc')
    expect(SS.smush(',', 'aa', '', 'bb')).to.eq('aa,bb')
  })
  it('gives an empty string when everything was empty', () => {
    expect(SS.smush(',', undefined, null, '')).to.eq('')
  })
  it('keeps numbers, including the zero that a truthiness filter would lose', () => {
    expect(SS.smush('', 1, 2, 3)).to.eq('123')
    expect(SS.smush('-', 0, 1)).to.eq('0-1')
  })
})

describe('quoting', () => {
  it('qt wraps in single quotes and escapes any inside', () => {
    expect(SS.qt('hello')).to.eq("'hello'")
    expect(SS.qt("it's")).to.eq(String.raw`'it\'s'`)
  })
  it('dqt wraps in double quotes and escapes any inside', () => {
    expect(SS.dqt('hello')).to.eq('"hello"')
    expect(SS.dqt('say "hi"')).to.eq(String.raw`"say \"hi\""`)
  })
  it('comma appends one', () => {
    expect(SS.comma('foo')).to.eq('foo,')
  })
  it('qtc quotes and then appends one', () => {
    expect(SS.qtc('x')).to.eq("'x',")
  })
})

describe('indent', () => {
  it('pushes every line right by two spaces by default', () => {
    expect(SS.indent('aa\nbb')).to.eq('  aa\n  bb')
  })
  it('takes a count', () => {
    expect(SS.indent('aa\nbb', 4)).to.eq('    aa\n    bb')
  })
  it('takes a string to indent with', () => {
    expect(SS.indent('aa\nbb', '\t')).to.eq('\taa\n\tbb')
  })
  it('trims the whole text before indenting it', () => {
    expect(SS.indent('  aa  \n  bb  ')).to.eq('  aa  \n    bb')
  })
  it('empties a line that would otherwise be only spaces', () => {
    expect(SS.indent('aa\n\nbb')).to.eq('  aa\n\n  bb')
  })
})

describe('dedent', () => {
  it('takes one level off the first line and each line after a newline', () => {
    expect(SS.dedent('  aa\n  bb\n  cc', 2)).to.eq('aa\nbb\ncc')
  })
  it('leaves any indent beyond the level it was asked for', () => {
    expect(SS.dedent('    aa\n   bb\n  cc', 2)).to.eq('  aa\n bb\ncc')
    expect(SS.dedent('  xx\n     yy')).to.eq('xx\n   yy')
  })
  it('defaults to two spaces', () => {
    expect(SS.dedent('  xx\n  yy')).to.eq('xx\nyy')
  })
  it('undoes an indent of the same width', () => {
    expect(SS.dedent(SS.indent('aa\nbb'))).to.eq('aa\nbb')
  })
})
