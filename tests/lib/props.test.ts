import { describe, expect, it } from 'vitest'
import * as PP from '../../src/lib/props'

function decorateTarget() { return 1 }

describe('attaching properties', () => {
  describe('adorn', () => {
    it('returns the value, so the call can stand in for it', () => {
      expect(PP.adorn({}, 'aa', 'val')).to.eq('val')
    })
    it('attaches it where a normal read finds it', () => {
      const obj: Record<string, unknown> = {}
      PP.adorn(obj, 'aa', 'val')
      expect(obj.aa).to.eq('val')
    })
    it('leaves it hidden and frozen', () => {
      const obj = {}
      PP.adorn(obj, 'aa', 'val')
      expect(Object.getOwnPropertyDescriptor(obj, 'aa'))
        .to.include({ enumerable: false, writable: false, configurable: true })
    })
    it('keeps it out of a spread and out of JSON', () => {
      const obj = { visible: 1 }
      PP.adorn(obj, 'hidden', 'val')
      expect(Object.keys(obj)).to.eql(['visible'])
      expect(JSON.stringify(obj)).to.eq('{"visible":1}')
    })
  })

  describe('setNormalProp', () => {
    it('returns the value', () => {
      expect(PP.setNormalProp({}, 'aa', 'val')).to.eq('val')
    })
    it('leaves it visible and writable', () => {
      const obj = {}
      PP.setNormalProp(obj, 'aa', 'val')
      expect(Object.getOwnPropertyDescriptor(obj, 'aa'))
        .to.include({ enumerable: true, writable: true, configurable: true })
      expect(Object.keys(obj)).to.eql(['aa'])
    })
  })

  describe('setNormalProps', () => {
    it('returns the same object it was handed', () => {
      const obj = {}
      expect(PP.setNormalProps(obj, { aa: 1 })).to.eq(obj)
    })
    it('attaches every entry, visible and writable', () => {
      const obj = PP.setNormalProps({}, { aa: 1, bb: 2 })
      expect(obj.aa).to.eq(1)
      expect(obj.bb).to.eq(2)
      expect(Object.getOwnPropertyDescriptor(obj, 'aa'))
        .to.include({ enumerable: true, writable: true, configurable: true })
    })
  })

  describe('setHiddenProps', () => {
    it('attaches every entry hidden but still writable', () => {
      const obj = PP.setHiddenProps({}, { aa: 1, bb: 2 })
      expect(obj.aa).to.eq(1)
      expect(Object.keys(obj)).to.eql([])
      expect(Object.getOwnPropertyDescriptor(obj, 'aa'))
        .to.include({ enumerable: false, writable: true, configurable: true })
    })
  })

  describe('decorate', () => {
    it('returns the same object it was handed', () => {
      const obj = {}
      expect(PP.decorate(obj, { aa: 1 })).to.eq(obj)
    })
    it('attaches every entry hidden and frozen', () => {
      const obj = PP.decorate({}, { aa: 1, bb: 2 })
      expect(obj.aa).to.eq(1)
      expect(obj.bb).to.eq(2)
      expect(Object.keys(obj)).to.eql([])
      expect(Object.getOwnPropertyDescriptor(obj, 'aa'))
        .to.include({ enumerable: false, writable: false, configurable: true })
    })
    it('can hang machinery off a function without it showing', () => {
      const decorated = PP.decorate(decorateTarget, { Checks: { aa: 1 } })
      expect(decorated.Checks).to.eql({ aa: 1 })
      expect(decorated()).to.eq(1)
    })
  })
})

describe('reading properties', () => {
  describe('ownProps', () => {
    it('gives the descriptors by name', () => {
      const result = PP.ownProps({ aa: 1, bb: 2 })
      expect(result.aa?.value).to.eq(1)
      expect(result.bb?.value).to.eq(2)
    })
    it('includes hidden properties, which Object.keys would miss', () => {
      const obj = {}
      PP.adorn(obj, 'hidden', 'val')
      expect(PP.ownProps(obj)).to.have.property('hidden')
    })
    it('gives an empty bag for nil', () => {
      expect(PP.ownProps(null)).to.eql({})
      expect(PP.ownProps(undefined)).to.eql({})
    })
  })

  describe('ownPropnames', () => {
    it('gives the names', () => {
      expect(PP.ownPropnames({ aa: 1, bb: 2 })).to.eql(['aa', 'bb'])
    })
    it('gives an empty array for nil', () => {
      expect(PP.ownPropnames(null)).to.eql([])
      expect(PP.ownPropnames(undefined)).to.eql([])
    })
    it('does not climb to the prototype', () => {
      const obj = Object.create({ inherited: 1 }) as Record<string, unknown>
      obj.own = 2
      expect(PP.ownPropnames(obj)).to.eql(['own'])
    })
  })

  describe('protoPropnames', () => {
    it('gives the immediate prototype own names', () => {
      const obj = Object.create({ protoA: 1, protoB: 2 }) as object
      expect(PP.protoPropnames(obj)).to.include.members(['protoA', 'protoB'])
    })
    it('climbs exactly one step, not two', () => {
      const grand = { grandA: 1 }
      const parent = Object.create(grand) as object
      PP.setNormalProps(parent, { parentA: 2 })
      const obj = Object.create(parent) as object
      expect(PP.protoPropnames(obj)).to.eql(['parentA'])
    })
    it('gives an empty array for nil', () => {
      expect(PP.protoPropnames(null)).to.eql([])
      expect(PP.protoPropnames(undefined)).to.eql([])
    })
  })

  describe('ownProp', () => {
    it('gives the descriptor of an own property', () => {
      expect(PP.ownProp({ aa: 1 }, 'aa')?.value).to.eq(1)
    })
    it('gives undefined for one it does not have', () => {
      expect(PP.ownProp({}, 'nope')).to.be.undefined
    })
    it('gives undefined for an inherited one', () => {
      expect(PP.ownProp(Object.create({ aa: 1 }) as object, 'aa')).to.be.undefined
    })
  })

  describe('protoProp', () => {
    it('gives the descriptor from the prototype', () => {
      expect(PP.protoProp(Object.create({ protoA: 1 }) as object, 'protoA')?.value).to.eq(1)
    })
    it('gives undefined for one that is not there', () => {
      expect(PP.protoProp({}, 'nope')).to.be.undefined
    })
    it('does not fall over on a prototype-less object', () => {
      expect(PP.protoProp(Object.create(null) as object, 'nope')).to.be.undefined
    })
  })

  describe('getProp', () => {
    it('finds an own property with the default depth', () => {
      expect(PP.getProp({ aa: 1 }, 'aa')?.value).to.eq(1)
    })
    it('will not climb at all with the default depth', () => {
      expect(PP.getProp(Object.create({ aa: 1 }) as object, 'aa')).to.be.undefined
    })
    it('climbs one step when asked', () => {
      expect(PP.getProp(Object.create({ aa: 1 }) as object, 'aa', 1)?.value).to.eq(1)
    })
    it('stops at the depth given, rather than running the chain', () => {
      const grand  = { deep: 1 }
      const parent = Object.create(grand) as object
      const obj    = Object.create(parent) as object
      expect(PP.getProp(obj, 'deep', 1)).to.be.undefined
      expect(PP.getProp(obj, 'deep', 2)?.value).to.eq(1)
    })
    it('gives undefined for a property nothing has', () => {
      expect(PP.getProp({}, 'nope', 9)).to.be.undefined
    })
    it('prefers the own property over an inherited one of the same name', () => {
      const obj = Object.create({ aa: 'inherited' }) as Record<string, unknown>
      obj.aa = 'own'
      expect(PP.getProp(obj, 'aa', 5)?.value).to.eq('own')
    })
  })
})
