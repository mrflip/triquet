import { describe, expect, it } from 'vitest'
import * as Liquidry from '../../src/lib/liquidry'

/** A renderer with one shaping filter and one plain one, a value filling in as its text */
const Renderer = Liquidry.rendererFor({
  fillingOf: (val) => (typeof val === 'string' || typeof val === 'number' ? String(val) : ''),
  shapers:   { shout: (text) => text.toUpperCase() },
  filters:   { twice: (val) => [val, val] },
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
    const beg = Liquidry.clockNow()
    const rendered = Renderer.render(nothing, {}, beg + 30)
    expect(rendered).to.deep.eq({ text: nothing, issue: 'This template takes too long to fill in: a loop inside a loop, perhaps.', failkind: 'limit' })
    // Stopped near its deadline, not at the end of nine million turns; the margin is for a machine under load.
    expect(Liquidry.clockNow() - beg).to.be.below(1000)
  })

  it('stops at once a render whose deadline has passed', () => {
    expect(Renderer.render('plain text', {}, Liquidry.clockNow() - 1).failkind).to.eq('limit')
  })

  it('stops a render whose deadline has passed before reading its template, so one that will not read costs no more time', () => {
    expect(Renderer.render('{% if %}', {}, Liquidry.clockNow() - 1)).to.deep.eq({ text: '{% if %}', issue: 'This template takes too long to fill in: a loop inside a loop, perhaps.', failkind: 'limit' })
  })

  it("holds a render to its own time when its deadline is later", () => {
    expect(Liquidry.RenderMs).to.eq(1000)
    expect(Renderer.render('{{ name }}', { name: 'ada' }, Liquidry.clockNow() + 60_000)).to.deep.eq({ text: 'ada', issue: null, failkind: null })
  })

  it("says Liquid's own limit on allocation stopped it, as a limit", () => {
    expect(Renderer.render('{% for aa in (1..100000000) %}{% endfor %}', {}).failkind).to.eq('limit')
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
