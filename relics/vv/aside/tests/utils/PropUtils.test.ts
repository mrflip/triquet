import      _                                /**/ from 'lodash'
import      { expect }                            from 'chai'
import      { nextTick }                          from 'node:process'

(globalThis as any).nextTick = nextTick

describe('UF', () => {

  describe('adorn', () => {
    it('should add a non-enumerable property to an object', () => {
      const obj: any = {}
      const result = UF.adorn(obj, 'testKey', 'testValue')
      expect(result).to.equal('testValue')
      expect(obj.testKey).to.equal('testValue')
      expect(Object.getOwnPropertyDescriptor(obj, 'testKey')).to.deep.include({
        enumerable: false,
        writable: false,
        configurable: true
      })
    })
  })

  describe('setNormalProp', () => {
    it('should add an enumerable property to an object', () => {
      const obj: any = {}
      const result = UF.setNormalProp(obj, 'testKey', 'testValue')

      expect(result).to.equal('testValue')
      expect(obj.testKey).to.equal('testValue')
      expect(Object.getOwnPropertyDescriptor(obj, 'testKey')).to.deep.include({
        enumerable: true,
        writable: true,
        configurable: true
      })
    })
  })

  describe('setNormalProps', () => {
    it('should add multiple enumerable properties to an object', () => {
      const obj: any = {}
      const props = { key1: 'value1', key2: 'value2' }
      const result = UF.setNormalProps(obj, props)

      expect(result).to.equal(obj)
      expect(obj.key1).to.equal('value1')
      expect(obj.key2).to.equal('value2')
      expect(Object.getOwnPropertyDescriptor(obj, 'key1')).to.deep.include({
        enumerable: true,
        writable: true,
        configurable: true
      })
    })
  })

  describe('setHiddenProps', () => {
    it('should add multiple non-enumerable properties to an object', () => {
      const obj: any = {}
      const props = { key1: 'value1', key2: 'value2' }
      const result = UF.setHiddenProps(obj, props)

      expect(result).to.equal(obj)
      expect(obj.key1).to.equal('value1')
      expect(obj.key2).to.equal('value2')
      expect(Object.getOwnPropertyDescriptor(obj, 'key1')).to.deep.include({
        enumerable: false,
        writable: true,
        configurable: true
      })
    })
  })

  describe('decorate', () => {
    it('should add multiple non-enumerable, non-writable properties to an object', () => {
      const obj: any = {}
      const props = { key1: 'value1', key2: 'value2' }
      const result = UF.decorate(obj, props)

      expect(result).to.equal(obj)
      expect(obj.key1).to.equal('value1')
      expect(obj.key2).to.equal('value2')
      expect(Object.getOwnPropertyDescriptor(obj, 'key1')).to.deep.include({
        enumerable: false,
        writable: false,
        configurable: true
      })
    })
  })

  describe('ownProps', () => {
    it('should return own property descriptors', () => {
      const obj = { a: 1, b: 2 }
      const result = UF.ownProps(obj)

      expect(result).to.be.an('object')
      expect(result.a).to.be.an('object')
      expect(result.a?.value).to.equal(1)
      expect(result.b?.value).to.equal(2)
    })

        it('should return empty object for null/undefined', () => {
      expect(UF.ownProps(null as any)).to.deep.equal({})
      expect(UF.ownProps(undefined as any)).to.deep.equal({})
    })
  })

  describe('ownPropnames', () => {
    it('should return own property names', () => {
      const obj = { a: 1, b: 2 }
      const result = UF.ownPropnames(obj)

      expect(result).to.include.members(['a', 'b'])
      expect(result).to.have.length(2)
    })

    it('should return empty array for null/undefined', () => {
      expect(UF.ownPropnames(null as any)).to.deep.equal([])
      expect(UF.ownPropnames(undefined as any)).to.deep.equal([])
    })
  })

  describe('protoPropnames', () => {
    it('should return prototype property names', () => {
      const proto = { protoA: 1, protoB: 2 }
      const obj = Object.create(proto)
      ;(obj as any).ownA = 3

      const result = UF.protoPropnames(obj)

      expect(result).to.include.members(['protoA', 'protoB'])
    })

    it('should return empty array for null/undefined', () => {
      expect(UF.protoPropnames(null as any)).to.deep.equal([])
      expect(UF.protoPropnames(undefined as any)).to.deep.equal([])
    })
  })

  describe('protoProp', () => {
    it('should return property descriptor from prototype', () => {
      const proto = { protoA: 1 }
      const obj = Object.create(proto)

      const result = UF.protoProp(obj, 'protoA')

      expect(result).to.be.an('object')
      expect(result!.value).to.equal(1)
    })

    it('should return undefined for non-existent property', () => {
      const obj = {}
      const result = UF.protoProp(obj, 'nonexistent')

      expect(result).to.be.undefined
    })
  })

  describe('ownProp', () => {
    it('should return own property descriptor', () => {
      const obj = { ownA: 1 }
      const result = UF.ownProp(obj, 'ownA')

      expect(result).to.be.an('object')
      expect(result!.value).to.equal(1)
    })

    it('should return undefined for non-existent property', () => {
      const obj = {}
      const result = UF.ownProp(obj, 'nonexistent')

      expect(result).to.be.undefined
    })
  })

  describe('getProp', () => {
    it('should return property descriptor from own properties', () => {
      const obj = { ownA: 1 }
      const result = UF.getProp(obj, 'ownA')

      expect(result).to.be.an('object')
      expect(result!.value).to.equal(1)
    })

    it('should return property descriptor from prototype', () => {
      const proto = { protoA: 1 }
      const obj = Object.create(proto)

      const result = UF.getProp(obj, 'protoA', 1)

      expect(result).to.be.an('object')
      expect(result!.value).to.equal(1)
    })

    it('should return undefined for non-existent property', () => {
      const obj = {}
      const result = UF.getProp(obj, 'nonexistent')

      expect(result).to.be.undefined
    })

    it('should respect depth parameter', () => {
      const proto2 = { proto2A: 1 }
      const proto1 = Object.create(proto2)
      const obj = Object.create(proto1)

      const result = UF.getProp(obj, 'proto2A', 1)

      expect(result).to.be.undefined
    })
  })

  describe('inspectify', () => {
    it('should format simple values', () => {
      expect(UF.inspectify('test')).to.equal("'test'")
      expect(UF.inspectify(42)).to.equal('42')
      expect(UF.inspectify(true)).to.equal('true')
    })

    it('should format objects', () => {
      const obj = { a: 1, b: 2 }
      const result = UF.inspectify(obj)
      expect(result).to.equal('{ a: 1, b: 2 }')
    })

    it('should format arrays', () => {
      const arr = [1, 2, 3]
      const result = UF.inspectify(arr)
      expect(result).to.equal('[ 1, 2, 3 ]')
    })
  })
})