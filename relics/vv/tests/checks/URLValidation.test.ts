import      _                                /**/ from 'lodash'
import      { expect }                            from 'chai'
import      { UF, CK }                            from '@freeword/meta'
import type * as TY                               from '@freeword/meta'
import      * as TH                               from '../TestHelpers.ts'
import      * as URLFixtures                      from './URLFixtures.ts'

const { strToHostPort, urlOrPathToLiveurl, liveurl, urlpath, parsedUrlpath } = CK

type _PortMaybe           = number | TY.StringMaybe
type _HostPortPairMaybe   = readonly [TY.StringMaybe, _PortMaybe?] | string | null | undefined
type _HostPortSketchTuple = readonly [TY.URLStr | TY.Anypath | URL, _HostPortPairMaybe?, TY.StringMaybe?]

const Fixtures = {
  urlstr: {
    urlstr:               ['http://localhost:9999/foo',      'http://localhost:9999/foo'],
    urlPlain:             ['https://localhost/',             'https://localhost/'],
    urlNoSlash:           ['https://localhost',              'https://localhost'],
    urlQ:                 ['https://localhost/bar?qq=1',     'https://localhost/bar?qq=1'],
    urlQempty:            ['https://localhost/bar/?',        'https://localhost/bar/?'],
    urlDotdotPath:        ['https://localhost/foo/../bar',   'https://localhost/bar'],
  },
  urlTuplePairToURL: {
    urlTPR:              [['ftp://something.com:8888/foo?qq=1', ['localhost', 9999], 'http'],  'ftp://something.com:8888/foo?qq=1'],
    urlTNoHPPr:          [['https://localhost/foo',               null,               'ftp'],  'https://localhost/foo'],
    urlTNoHPNoPr:        [['https://localhost/bar'],                                           'https://localhost/bar'],
    urlTDotdotPath:      [['https://localhost/foo/../bar'],                                    'https://localhost/bar'],
  },
  pathStrHPPToURL: {
    pathStrHostPtPrs:    [['/foo',          'localhost:9999',       'http'],  'http://localhost:9999/foo'],
    pathStrHostPtPr2:    [['/foo',          'localhost:9999',         'ws'],  'ws://localhost:9999/foo'],
    pathStrHostPtPrQ:    [['/foo?qq=1',     'localhost:9999',       'http'],  'http://localhost:9999/foo?qq=1'],
    pathStrHostPr:       [['/foo',          'localhost',           'https'],  'https://localhost/foo'],
    pathStrHostPt1:      [['/foo',          'localhost:9999'],                'http://localhost:9999/foo'],
    pathStrHostPt2:      [['/foo/',         'localhost:9999'],                'http://localhost:9999/foo/'],
    pathStrHostPtQ:      [['/foo?qq=1',     'localhost:9999'],                'http://localhost:9999/foo?qq=1'],
    pathStrHostQx:       [['/foo?',         'localhost'],                     'http://localhost/foo?'],
    pathStrHostQ:        [['/foo/../bar/?', 'localhost'],                     'http://localhost/bar/?'],
  },
  pathTupHPPToURL: {
    pathTupHostPtPrs:    [['/foo',          ['localhost', '9999'],  'http'],  'http://localhost:9999/foo'],
    pathTupHostPtPr2:    [['/foo',          ['localhost',  9999],     'ws'],  'ws://localhost:9999/foo'],
    pathTupHostPtPrQ:    [['/foo?qq=1',     ['localhost', '9999'],  'http'],  'http://localhost:9999/foo?qq=1'],
    pathTupHostPr:       [['/foo',          ['localhost'],         'https'],  'https://localhost/foo'],
    pathTupHostPt1:      [['/foo',          ['localhost', 9999]],             'http://localhost:9999/foo'],
    pathTupHostPt2:      [['/foo/',         ['localhost', '9999']],           'http://localhost:9999/foo/'],
    pathTupHostPtQ:      [['/foo?qq=1',     ['localhost', null]],             'http://localhost/foo?qq=1'],
    pathTupHostQx:       [['/foo?',         ['localhost']],                   'http://localhost/foo?'],
    pathTupHostQ:        [['/foo/../bar/?', ['localhost']],                   'http://localhost/bar/?'],
  },
} as const satisfies TY.Bag<TY.Bag<[TY.URLStr | URL | _HostPortSketchTuple, string]>>

const UrlOrPathToLiveurlFixtures = { ...Fixtures.urlstr, ...Fixtures.urlTuplePairToURL, ...Fixtures.pathStrHPPToURL, ...Fixtures.pathTupHPPToURL } as const
const LiveurlFixtures            = { ...Fixtures.urlstr } as const
const ValidHostnames              = _.map(URLFixtures.ValidHostnames, ([_tag, url]) => url)

describe('URLValidation', () => {
  describe('urlOrPathLiveurl', () => {
    it.each(_.entries(UrlOrPathToLiveurlFixtures))('validates %s', (_handle, [input, wanted]) => {
      const result = urlOrPathToLiveurl.cast(input)
      expect(result).to.eql(URL.parse(wanted))
    })
    it.each(_.entries(LiveurlFixtures))('validates %s from a URL object', (_handle, [input, wanted]) => {
      const inputObj = new URL(input)
      const result = liveurl.cast(inputObj)
      expect(result).to.eql(URL.parse(wanted))
    })
  })
  describe('liveurl', () => {
    it.each(_.entries(LiveurlFixtures))('validates %s from a string', (_handle, [input, wanted]) => {
      const result = liveurl.cast(input)
      expect(result).to.eql(URL.parse(wanted))
    })
    it.each(_.entries(LiveurlFixtures))('validates %s from a URL object', (_handle, [input, wanted]) => {
      const inputObj = new URL(input)
      const result = liveurl.cast(inputObj)
      expect(result).to.eql(URL.parse(wanted))
    })
  })
  describe('strToHostPort', () => {
    describe('valid hostnames', () => {
      describe('no port', () => {
        it('validates %s with no port', () => {
          _.each(_.take(ValidHostnames, 2000), (hostname) => {
            const input = /:/.test(hostname) ? `[${hostname}]` : hostname
            const result = strToHostPort.cast(input)
            expect(result).to.eql([hostname, null])
          })
        })
      })
      describe('with port', () => {
        it('validates valid hostnames with ports', () => {
          _.each(_.take(ValidHostnames, 2000), (hostname) => {
            const input = /:/.test(hostname) ? `[${hostname}]` : hostname
            const result = strToHostPort.cast(input + ':1234')
            expect(result).to.eql([hostname, 1234])
          })
        })
      })
    })
  })
  describe('urlpath', () => {
    const tamed = _.fromPairs(_.uniqBy(_.entries(URLFixtures.ValidUrlpaths), ([_handle, [_example, wanted]]) => wanted))
    // console.log(tamed)
    it.each(_.entries(tamed))('validates %s', (_handle, [_input, wanted]) => {
      const result = urlpath.cast(wanted!)
      expect(result).to.eql(wanted)
    })
  })
  describe('parsedUrlpath', () => {
    it.each(_.entries(URLFixtures.ValidUrlpaths))('validates %s', (_handle, [input, wanted]) => {
      const result = parsedUrlpath.cast(input)
      if (result !== wanted) { console.warn('oops', input, result, wanted, URL.parse(input, 'http://placeholder'), URL.parse(wanted!, 'http://placeholder')) }
      expect(result).to.eql(wanted)
    })
    it('dumps', () => {
      const valids: Record<string, [string, string, string?]> = {}
      const oopses: Record<string, [string, string?]> = {}
      _.each(URLFixtures.ValidUrlpaths, ([example, note], handle) => {
        const result1 = URL.parse(example, 'http://placeholder')
        if (! result1) { oopses[handle] = _.compact([example, note]) as [string, string?]; return }
        const result  = result1.pathname // ? encodeURI(String(result1.pathname))
        valids[handle] = _.compact([example, result, note]) as [string, string, string?]
      })
      // function dq(str: string) { return TH.wd(`\`${str}\`,`, 60) }
      // const lines = _.map(ValidUrlpaths, ([input, wanted], handle) => `${TH.kfy(handle, 20)} [${dq(input)} ${Lembas.fixup.qt(wanted)}],`.trimEnd())
      // console.info(lines.join('\n'))
      // console.log(_.map(ValidUrlpaths, ([input, wanted], handle) => { try { return [_.padEnd(input, 80) + decodeURIComponent(wanted)] } catch (e) { console.info('oops', wanted); return wanted } }).join('\n'))
      if (! _.isEmpty(oopses)) { console.warn('InvalidUrlpaths', oopses) }
      expect(valids).to.be.ok
    })
  })
})
