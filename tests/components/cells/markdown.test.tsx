import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { MarkdownFace, MarkdownText, faceOf } from '../../../src/components/cells/markdown'
import type * as Templating from '../../../src/lib/templating'
import { renderedText } from '../../support/rendering'

/** A bag whose question holds `qn`, and nothing else of note */
function bagHolding(qn: Record<string, unknown>): Templating.TemplateBag {
  return { hunt: { label: 'deep_lake', title: 'Deep Lake' }, realm: { label: 'home', title: 'Home' }, quiz: { label: 'quiz', title: 'Quiz' }, qns: [qn], qn, qn_label: 'one', quiz_label: 'quiz' }
}

/** The markup a templated field's face draws for `template`, filled in over a question holding `qn` */
function drawn(template: string, qn: Record<string, unknown>): string {
  const face = faceOf(template, bagHolding(qn))
  return renderToStaticMarkup(<MarkdownText text={face.text} templated={face.templated} />)
}

describe("faceOf", () => {
  it("is the text as typed when the field is not templated", () => {
    expect(faceOf('By {{qn.author}}', null)).to.deep.eq({ text: 'By {{qn.author}}', templated: false, issue: null })
  })

  it("is the text filled in when it is", () => {
    expect(faceOf('By {{qn.author}}', bagHolding({ author: 'Ada' }))).to.deep.eq({ text: 'By Ada', templated: true, issue: null })
  })

  it("is the text as typed, with why, when the template does not parse", () => {
    expect(faceOf('By {{qn.author', bagHolding({ author: 'Ada' }))).to.deep.eq({ text: 'By {{qn.author', templated: true, issue: 'Unclosed tag at 14' })
  })
})

// Filling cleans nothing, the markdown parser reads what it came to, and the sanitizer goes last.
describe("a templated field, filled in, then parsed, then sanitized", () => {
  it("renders a value holding markdown as markdown, since it was filled in before the parser read it", () => {
    expect(drawn('Says {{qn.said}}', { said: '**bold** and *it*' })).to.eq('<p>Says <strong>bold</strong> and <em>it</em></p>')
  })

  it("shows a value holding a script as the characters typed, and builds nothing of it", () => {
    const markup = drawn('{{qn.said}}', { said: '<script>alert(1)</script>' })
    expect(markup).not.to.contain('<script')
    expect(markup).to.contain('&lt;script&gt;alert(1)&lt;/script&gt;')
  })

  it("shows a value holding an image tag as the characters typed, its handler never wired up", () => {
    const markup = drawn('{{qn.said}}', { said: '<img src="https://e.co/x.png" onerror="alert(1)">' })
    expect(markup).not.to.contain('<img')
    expect(markup).to.contain('&lt;img')
  })

  it("drops a script address a value holds, from a link the value makes", () => {
    const markup = drawn('{{qn.said}}', { said: '[click](javascript:alert(1))' })
    expect(markup).to.eq('<p><a target="_blank" rel="noopener noreferrer">click</a></p>')
  })

  it("drops a script address a value finishes, from a link the template begins", () => {
    const markup = drawn('[click{{qn.said}}', { said: '](javascript:alert(1))' })
    expect(markup).not.to.contain('javascript')
  })

  it("keeps an image at an https address a value holds, fetched lazily and telling its host nothing", () => {
    const markup = drawn('{{qn.picture}}', { picture: '![A cat](https://e.co/cat.png)' })
    expect(markup).to.match(/<img [^>]*src="https:\/\/e\.co\/cat\.png"/)
    expect(markup).to.match(/alt="A cat"/)
    expect(markup).to.match(/loading="lazy"/)
    expect(markup).to.match(/referrerPolicy="no-referrer"/i)
  })

  it("keeps an image built of a value inside the template's own image", () => {
    expect(drawn('![cat](https://e.co/{{qn.file}})', { file: 'cat.png' })).to.match(/src="https:\/\/e\.co\/cat\.png"/)
  })

  it("draws no image's address that is not https", () => {
    expect(drawn('![cat]({{qn.address}})', { address: 'http://e.co/cat.png' })).not.to.contain('src=') // eslint-disable-line unicorn/prefer-https, sonarjs/no-clear-text-protocols
    expect(drawn('![cat]({{qn.address}})', { address: '//e.co/cat.png' })).not.to.contain('src=')
  })
})

describe("an untemplated field", () => {
  it("draws no image at all", () => {
    const markup = renderToStaticMarkup(<MarkdownText text="![A cat](https://e.co/cat.png)" />)
    expect(markup).not.to.contain('<img')
  })
})

describe("MarkdownFace", () => {
  it("says why a template could not be filled in, above its text as typed", () => {
    const face = faceOf('By {{qn.author', bagHolding({}))
    expect(renderedText(<MarkdownFace {...face} />)).to.eq('Unclosed tag at 14By {{qn.author')
  })

  it("draws nothing for a template that comes to nothing", () => {
    const face = faceOf('{{qn.nothing}}', bagHolding({}))
    expect(renderToStaticMarkup(<MarkdownFace {...face} />)).to.eq('')
  })
})
