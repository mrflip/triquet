import { describe, expect, it } from 'vitest'
import * as Clock from '../../src/lib/clock'
import * as Liquidry from '../../src/lib/liquidry'

/** A renderer with one shaping filter and one plain one, a value filling in as its text */
const Renderer = Liquidry.rendererFor({
  fillingOf: (val) => (typeof val === 'string' || typeof val === 'number' ? String(val) : ''),
  shapers:   { shout: (text) => text.toUpperCase() },
  filters:   { twice: (val) => [val, val] },
})

describe('Liquidry.sizeWithin', () => {
  it("counts each character, number, list and object, per the doc examples", () => {
    expect(Liquidry.sizeWithin(['ab', [1, 2]], 100)).to.eq(6)
    expect(Liquidry.sizeWithin('x'.repeat(500), 100)).to.eq(101)
  })

  it("counts what is held twice, twice, and stops counting past its most", () => {
    const long = Array.from({ length: 1000 }, (_unused, idx) => idx)
    expect(Liquidry.sizeWithin({ one: long, other: long }, 10_000)).to.eq(2003)
    expect(Liquidry.sizeWithin(Array.from({ length: 1000 }, () => long), 10_000)).to.eq(10_001)
  })
})

describe('Liquidry.rendererFor', () => {
  it("renders Liquid over its scope with the filters it was given, and Liquid's own", () => {
    expect(Renderer.render('{{ name | shout }} {{ name | twice | join: "+" }} {{ name | size }}', { name: 'ada' })).to.deep.eq({ text: 'ADA ada+ada 3', issue: null, failkind: null })
  })

  it('reads only what its scope itself holds, counting an empty value as false', () => {
    expect(Renderer.render('[{{ constructor }}{{ name.constructor }}][{% if blank %}x{% endif %}]', { name: 'ada', blank: '' }).text).to.eq('[][]')
  })

  it('hands back the template as typed, with why, when it does not read', () => {
    expect(Renderer.render('{{ name | whisper }}', { name: 'ada' })).to.deep.eq({ text: '{{ name | whisper }}', issue: 'undefined filter: whisper, line:1, col:1', failkind: 'syntax' })
    expect(Renderer.issueOf('{% render "other" %}')).to.eq('{% render %} includes another template, and there are none to include, line:1, col:1')
    expect(Renderer.issueOf('{{ name }}')).to.eq(null)
  })

  it('stops a render past its budget, saying why without a place', () => {
    const many = Array.from({ length: 50 }, () => '')
    const nested = '{% for aa in many %}{% for bb in many %}{% for cc in many %}{{ cc }}{% endfor %}{% endfor %}{% endfor %}'
    expect(Renderer.render(nested, { many }).issue).to.eq('This template reads too much: a list inside a list inside a list, perhaps.')
  })

  it('says a budget of its own stopped it, as a limit', () => {
    const many = Array.from({ length: 50 }, () => '')
    const nested = '{% for aa in many %}{% for bb in many %}{% for cc in many %}{{ cc }}{% endfor %}{% endfor %}{% endfor %}'
    expect(Renderer.render(nested, { many }).failkind).to.eq('limit')
  })

  it('stops a loop inside a loop that writes nothing, past its time, on a clock that moves', () => {
    const nothing = '{% for aa in (1..3000) %}{% for bb in (1..3000) %}{% endfor %}{% endfor %}'
    const beg = Clock.clockNow()
    const rendered = Renderer.render(nothing, {}, beg + 30)
    expect(rendered).to.deep.eq({ text: nothing, issue: 'This template takes too long to fill in: a loop inside a loop, perhaps.', failkind: 'limit' })
    // Stopped near its deadline, not at the end of nine million turns; the margin is for a machine under load.
    expect(Clock.clockNow() - beg).to.be.below(1000)
  })

  it('stops at once a render whose deadline has passed', () => {
    expect(Renderer.render('plain text', {}, Clock.clockNow() - 1).failkind).to.eq('limit')
  })

  it('stops a render whose deadline has passed before reading its template, so one that will not read costs no more time', () => {
    expect(Renderer.render('{% if %}', {}, Clock.clockNow() - 1)).to.deep.eq({ text: '{% if %}', issue: 'This template takes too long to fill in: a loop inside a loop, perhaps.', failkind: 'limit' })
  })

  it("holds a render to its own time when its deadline is later", () => {
    expect(Liquidry.RenderMs).to.eq(1000)
    expect(Renderer.render('{{ name }}', { name: 'ada' }, Clock.clockNow() + 60_000)).to.deep.eq({ text: 'ada', issue: null, failkind: null })
  })

  it("says Liquid's own limit on allocation stopped it, as a limit", () => {
    expect(Renderer.render('{% for aa in (1..100000000) %}{% endfor %}', {}).failkind).to.eq('limit')
  })

  it("stops a range of more than it may make at once, as a limit, before any filter works through it", () => {
    const beg = Clock.clockNow()
    // Measured before this limit: 2.4 s, against a deadline of 250 ms.
    const rendered = Renderer.render('{% assign rr = (1..3000000) | where: "xx" %}', {}, beg + 250)
    expect(rendered).to.deep.eq({ text: '{% assign rr = (1..3000000) | where: "xx" %}', issue: 'This template makes too long a list or text at once: a range of more than 100,000, perhaps.', failkind: 'limit' })
    expect(Clock.clockNow() - beg).to.be.below(250)
  })

  it("stops a filter handed more than it may take at once, Liquid's or the app's", () => {
    const long = 'x'.repeat(Liquidry.ItemsMax + 1)
    expect(Renderer.render('{{ long | upcase }}', { long }).failkind).to.eq('limit')
    expect(Renderer.render('{{ long | twice | size }}', { long }).issue).to.eq('This template makes too long a list or text at once: a range of more than 100,000, perhaps.')
    expect(Renderer.render('{{ short | upcase }}', { short: 'x'.repeat(Liquidry.ItemsMax) }).failkind).to.be.null
  })

  it("stops a render making more than it may all told, though each step is small", () => {
    const tenth = 'x'.repeat(Liquidry.ItemsMax / 2)
    const rendered = Renderer.render('{% for aa in (1..100) %}{% assign up = tenth | upcase %}{% endfor %}', { tenth })
    expect(rendered.issue).to.match(/^memory alloc limit exceeded/)
    expect(rendered.failkind).to.eq('limit')
  })

  it("counts a value pushed onto a list for all it holds, so a list cannot hold one long thing many times over", () => {
    const long = 'x'.repeat(50_000)
    const fanned = '{% assign many = "" | split: "," %}{% for aa in (1..1000) %}{% assign many = many | push: long %}{% endfor %}{{ many | size }}'
    expect(Renderer.render(fanned, { long }).failkind).to.eq('limit')
    expect(Renderer.render('{% assign two = "" | split: "," | push: long | push: long %}{{ two | size }}', { long }).text).to.eq('2')
  })

  it("stops a capture making more text than it may at once, though it counts nothing towards the whole", () => {
    const doubling = '{% capture ss %}x{% endcapture %}{% for aa in (1..27) %}{% capture ss %}{{ ss }}{{ ss }}{% endcapture %}{% endfor %}{{ ss | size }}'
    expect(Renderer.render(doubling, {})).to.deep.eq({ text: doubling, issue: 'This template makes too long a list or text at once: a range of more than 100,000, perhaps.', failkind: 'limit' })
    const built = '{% for item in items %}{% capture all %}{{ all }}{{ item }}{% endcapture %}{% endfor %}{{ all | size }}'
    expect(Renderer.render(built, { items: Array.from({ length: 300 }, () => 'x'.repeat(200)) })).to.deep.eq({ text: '60000', issue: null, failkind: null })
  })

  for (const [refused, twin] of Object.entries(Liquidry.RefusedFilters)) {
    it(`refuses ${refused} as the template is read, naming ${twin} to use instead`, () => {
      const template = `{% assign some = list | ${refused}: "item", "item > 1" %}`
      expect(Renderer.render(template, { list: [1, 2] })).to.deep.eq({ text: template, issue: `the filter ${refused} works an expression for every item of a list, which is not offered: use ${twin}, with a property and a value, line:1, col:1`, failkind: 'syntax' })
      expect(Renderer.issueOf(template)).to.match(new RegExp(`^the filter ${refused} works an expression`, 'u'))
    })
  }

  it("refuses at once the 99 characters of where_exp that took 13.7 s against a deadline of 250 ms", () => {
    const template = '{% assign r = (1..3000000) | where_exp: "x", "x > 0 and x > 1 and x > 2 and x > 3" %}'
    const beg = Clock.clockNow()
    expect(Renderer.render(template, {}, beg + 250).failkind).to.eq('syntax')
    expect(Clock.clockNow() - beg).to.be.below(250)
  })

  it("stops a filter working through a list inside its one call, at its deadline, reading each item on a clock that moves", () => {
    // A long path read from each of many items: forty seconds of reading, were the clock read only between pieces.
    const path = ['xx', ...Array.from({ length: 1700 }, () => 'aa')].join('.')
    for (const template of [`{% assign rr = (1..100000) | where: "${path}" %}`, `{% assign rr = list | has: "${path}", 1 %}`, `{% assign rr = list | sort: "${path}" %}`]) {
      const beg = Clock.clockNow()
      const rendered = Renderer.render(template, { list: Array.from({ length: 50_000 }, (_unused, idx) => ({ xx: idx })) }, beg + 30)
      expect(rendered.issue).to.eq('This template takes too long to fill in: a loop inside a loop, perhaps.')
      // Stopped near its deadline, not at the end of the list; the margin is for a machine under load.
      expect(Clock.clockNow() - beg).to.be.below(2000)
    }
  })

  it('says a template that failed as it ran, as no limit', () => {
    expect(Renderer.render('{{ list | sort: 1 }}', { list: [{ a: 1 }, 2] }).failkind).to.be.oneOf(['runtime', null])
  })

  it('counts what its shaping filters are handed', () => {
    const long = 'x'.repeat((Liquidry.ShapedMax / 2) + 1)
    expect(Renderer.render('{{ long | shout | shout }}', { long }).issue).to.eq('This template shapes too much text: the same long text shaped again and again, perhaps.')
  })

  it('names the keys a template reads from its scope, none of its own making', () => {
    expect(Renderer.globalsOf('{{ a }}{{ b.c }}{% for item in list %}{{ item }}{{ d }}{% endfor %}{% assign e = 1 %}{{ e }}')).to.deep.eq(['a', 'b', 'list', 'd'])
    expect(Renderer.globalsOf('{% if %}')).to.deep.eq([])
  })

  it('calls a function it finds in its scope, which is why a scope holds only data', () => {
    expect(Renderer.render('{{ fn }}', { fn: () => 'called' }).text).to.eq('called')
  })
})
