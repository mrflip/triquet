import { expect } from 'chai'
import { UF } from '@freeword/meta'

describe('StringUtils', () => {
  describe('manyAndLast', () => {
    it('returns void for empty array', () => {
      const result = UF.manyAndLast([])
      expect(result).to.deep.equal({ iam: 'void' })
    })

    it('returns solo for single element', () => {
      const result = UF.manyAndLast(['a'])
      expect(result).to.deep.equal({ iam: 'solo', first: 'a' })
    })

    it('returns pair for two elements', () => {
      const result = UF.manyAndLast(['a', 'b'])
      expect(result).to.deep.equal({ iam: 'pair', first: 'a', last: 'b' })
    })

    it('returns many for three+ elements under cap', () => {
      const result = UF.manyAndLast(['a', 'b', 'c']) as { iam: string; many: string[]; last: string }
      expect(result.iam).to.equal('many')
      expect(result.many).to.deep.equal(['a', 'b'])
      expect(result.last).to.equal('c')
    })

    it('returns xnil when max is 0', () => {
      const result = UF.manyAndLast(['a', 'b'], { max: 0 })
      expect(result).to.deep.equal({ iam: 'xnil' })
    })

    it('returns xone when one requested but more present', () => {
      const result = UF.manyAndLast(['a', 'b', 'c'], { max: 1 })
      expect(result).to.deep.equal({ iam: 'xone', first: 'a' })
    })

    it('returns xtwo when two requested but more present', () => {
      const result = UF.manyAndLast(['a', 'b', 'c'], { max: 2 })
      expect(result).to.deep.equal({ iam: 'xtwo', first: 'a', last: 'c' })
    })

    it('returns xtra when cap exceeded with many', () => {
      const result = UF.manyAndLast(['a', 'b', 'c', 'd', 'e'], { max: 4, shave: 0 }) as { iam: string; many: string[]; last: string }
      expect(result.iam).to.equal('xtra')
      expect(result.many).to.deep.equal(['a', 'b', 'c'])
      expect(result.last).to.equal('e')
    })

    it('respects shave when over cap', () => {
      const result = UF.manyAndLast(['a', 'b', 'c', 'd', 'e'], { max: 4, shave: 1 }) as { iam: string; many: string[]; last: string }
      expect(result.iam).to.equal('xtra')
      expect(result.many).to.deep.equal(['a', 'b'])
      expect(result.last).to.equal('e')
    })
  })

  describe('toSentence', () => {
    it('returns empty for empty array', () => {
      expect(UF.toSentence([])).to.equal('')
    })

    it('returns single item for one element', () => {
      expect(UF.toSentence(['apple'])).to.include('apple')
    })

    it('joins two items with conj', () => {
      const s = UF.toSentence(['a', 'b'], { conj: 'and' })
      expect(s).to.match(/a.*and.*b/)
    })

    it('joins many with joiner and lastJoiner', () => {
      const s = UF.toSentence(['a', 'b', 'c'], { joiner: ', ', conj: 'and' })
      expect(s).to.equal('a, b, and c')
    })

    it('truncates with yadayada when over max', () => {
      const s = UF.toSentence(['a', 'b', 'c', 'd'], { max: 3, conj: 'and', yadayada: ', ... and ' })
      expect(s).to.include('...')
      expect(s).to.include('d')
    })

    it('uses stringifier for non-strings', () => {
      const s = UF.toSentence([1, 2], { stringifier: (x) => `n${x}` })
      expect(s).to.include('n1')
      expect(s).to.include('n2')
    })

    it('uses empty and whoa for void and xnil', () => {
      expect(UF.toSentence([], { empty: 'none' })).to.equal('none')
      const s = UF.toSentence(['a', 'b', 'c'], { max: 0, empty: '', whoa: ' (more)' })
      expect(s).to.equal(' (more)')
    })
  })

  describe('snipjoin', () => {
    it('joins short arrays normally', () => {
      expect(UF.snipjoin(['a', 'b', 'c'])).to.equal('a, b, c')
    })

    it('snips long arrays with yadayada', () => {
      const arr = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j']
      const s = UF.snipjoin(arr, { max: 5 })
      expect(s).to.include(', ...')
      expect(s).to.include('j')
    })
  })

  describe('briefSentence', () => {
    it('behaves like toSentence with brief defaults', () => {
      expect(UF.briefSentence(['x', 'y'])).to.include('x')
      expect(UF.briefSentence(['x', 'y'])).to.include('y')
    })
  })

  describe('someManyAndLast', () => {
    it('adds some, body, tail, postsize, ellipsize to manyAndLast result', () => {
      const result = UF.someManyAndLast(['a', 'b', 'c'])
      expect(result).to.include.keys(['some', 'body', 'tail', 'postsize', 'ellipsize'])
      expect(result.some).to.deep.equal(['a', 'b', 'c'])
      expect(result.body).to.deep.equal(['a', 'b', 'c'])
      expect(result.tail).to.deep.equal([])
      expect(result.postsize).to.equal(3)
      expect(result.ellipsize).to.equal(false)
    })

    it('sets ellipsize and tail when over cap', () => {
      const result = UF.someManyAndLast(['a', 'b', 'c', 'd'], { max: 3 })
      expect(result.ellipsize).to.equal(true)
      expect(result.tail).to.deep.equal(['d'])
      expect(result.some).to.deep.equal(['a', 'b', 'd'])
    })
  })

  describe('hardcapList', () => {
    it('returns same array when under cap', () => {
      expect(UF.hardcapList(['a', 'b'])).to.deep.equal(['a', 'b'])
    })

    it('returns array with yadayada when over cap', () => {
      const result = UF.hardcapList(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'], { max: 5, shave: 1, yadayada: '…' })
      expect(result).to.include('…')
      expect(result[0]).to.equal('a')
      expect(result[result.length - 1]).to.equal('h')
    })

    it('returns empty for xnil', () => {
      expect(UF.hardcapList(['a', 'b'], { max: 0 })).to.deep.equal([])
    })
  })

  describe('shorten', () => {
    it('returns empty for empty string', () => {
      expect(UF.shorten('')).to.equal('')
    })

    it('returns string as-is when within maxlen', () => {
      const s = 'hello world'
      expect(UF.shorten(s, 20)).to.equal(s)
    })

    it('truncates with default ellipsis when over maxlen', () => {
      const s = 'The quick brown fox jumps over the lazy dog'
      const out = UF.shorten(s, 20)
      expect(out.length).to.be.lte(23)
      expect(out).to.include('...')
    })

    it('uses custom tail when provided', () => {
      const s = 'The quick brown fox jumps over the lazy dog'
      const out = UF.shorten(s, 25, { tail: '…' })
      expect(out).to.include('…')
    })

    it('trims input', () => {
      expect(UF.shorten('  short  ', 20)).to.equal('short')
    })
  })

  describe('shortenWithEllipsis', () => {
    it('shortens with single-glyph ellipsis', () => {
      const s = 'A very long string that should be shortened'
      const out = UF.shortenWithEllipsis(s, 25)
      expect(out).to.include('…')
      expect(out.length).to.be.lte(26)
    })
  })

  describe('smush', () => {
    it('joins non-void args with separator', () => {
      expect(UF.smush('-', 'a', 'b', 'c')).to.equal('a-b-c')
    })

    it('strips undefined and null', () => {
      expect(UF.smush(',', 'a', undefined, 'b', null, 'c')).to.equal('a,b,c')
    })

    it('returns empty when all void', () => {
      expect(UF.smush(',', undefined, null, '')).to.equal('')
    })

    it('coerces numbers to string', () => {
      expect(UF.smush('', 1, 2, 3)).to.equal('123')
    })
  })

  describe('qt', () => {
    it('wraps in single quotes', () => {
      expect(UF.qt('hello')).to.equal("'hello'")
    })

    it('escapes single quotes inside', () => {
      expect(UF.qt("it's")).to.equal("'it\\'s'")
    })
  })

  describe('dqt', () => {
    it('wraps in double quotes', () => {
      expect(UF.dqt('hello')).to.equal('"hello"')
    })

    it('escapes double quotes inside', () => {
      expect(UF.dqt('say "hi"')).to.equal('"say \\"hi\\""')
    })
  })

  describe('qtc', () => {
    it('returns qt value plus comma', () => {
      expect(UF.qtc('x')).to.equal("'x',")
    })
  })

  describe('comma', () => {
    it('appends comma to string', () => {
      expect(UF.comma('foo')).to.equal('foo,')
    })
  })

  describe('indent', () => {
    it('indents each line by default 2 spaces', () => {
      expect(UF.indent('a\nb')).to.equal('  a\n  b')
    })

    it('accepts custom indent number', () => {
      expect(UF.indent('a\nb', 4)).to.equal('    a\n    b')
    })

    it('accepts custom indent string', () => {
      expect(UF.indent('a\nb', '\t')).to.equal('\ta\n\tb')
    })

    it('trims whole text then indents each line', () => {
      expect(UF.indent('  a  \n  b  ')).to.equal('  a  \n    b')
    })
  })

  describe('dedent', () => {
    it('removes indent after newlines (first line unchanged)', () => {
      const text = '  a\n  b\n  c'
      expect(UF.dedent(text, 2)).to.equal('a\nb\nc')
    })
    it('removes indent after newlines (first line unchanged)', () => {
      const text = '    a\n   b\n  c'
      expect(UF.dedent(text, 2)).to.equal('  a\n b\nc')
    })

    it('uses default 2 spaces for newline+indent pattern', () => {
      expect(UF.dedent('  x\n  y')).to.equal('x\ny')
      expect(UF.dedent('  x\n     y')).to.equal('x\n   y')
    })
  })
})
