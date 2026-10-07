import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { CellImageMaxPx, MarkdownFace, MarkdownText, faceOf } from '../../../src/components/cells/markdown'
import type * as Templating from '../../../src/lib/templating'
import { renderedText } from '../../support/rendering'

/** A bag whose question holds `qn`, and nothing else of note */
function bagHolding(qn: Record<string, unknown>): Templating.TemplateBag {
  return { hunt: { label: 'deep_lake', title: 'Deep Lake' }, realm: { label: 'home', title: 'Home' }, categories: [], quiz: { label: 'quiz', title: 'Quiz' }, qns: [qn], qn, qn_label: 'one', quiz_label: 'quiz' }
}

/** The markup a templated field's face draws for `template`, filled in over a question holding `qn` */
function drawn(template: string, qn: Record<string, unknown>): string {
  const face = faceOf(template, bagHolding(qn))
  return renderToStaticMarkup(<MarkdownText text={face.text} />)
}

describe("faceOf", () => {
  it("is the text as typed when the field is not templated", () => {
    expect(faceOf('By {{qn.author}}', null)).to.deep.eq({ text: 'By {{qn.author}}', issue: null })
  })

  it("is the text filled in when it is", () => {
    expect(faceOf('By {{qn.author}}', bagHolding({ author: 'Ada' }))).to.deep.eq({ text: 'By Ada', issue: null })
  })

  it("is the text as typed, with why, when the template does not parse", () => {
    expect(faceOf('By {{qn.author', bagHolding({ author: 'Ada' }))).to.deep.eq({ text: 'By {{qn.author', issue: 'Unclosed tag at 14' })
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
  it("draws an image at an https address too, fetched lazily and telling its host nothing", () => {
    const markup = renderToStaticMarkup(<MarkdownText text="![A cat](https://e.co/cat.png)" />)
    expect(markup).to.match(/<img [^>]*src="https:\/\/e\.co\/cat\.png"/)
    expect(markup).to.match(/loading="lazy"/)
  })

  it("draws no image's address that is not https", () => {
    expect(renderToStaticMarkup(<MarkdownText text="![A cat](/api/ask)" />)).not.to.contain('src=')
  })
})

/** The CSS Emotion wrote for the image in `markup`, by the class it gave the image */
function imageStyleOf(markup: string): string {
  const classname = /<img [^>]*class="([^"]+)"/.exec(markup)?.[1] ?? ''
  const cssclass = classname.split(' ').find((each) => each.startsWith('css-')) ?? 'none'
  return new RegExp(String.raw`\.${cssclass}\{([^}]*)\}`).exec(markup)?.[1] ?? ''
}

describe("MarkdownText, on images", () => {

  it("holds an image in a grid cell to a thumbnail's height", () => {
    const markup = renderToStaticMarkup(<MarkdownText cell text="![A cat](https://e.co/cat.png)" />)
    expect(imageStyleOf(markup)).to.contain(`max-height:${String(CellImageMaxPx)}px`)
  })

  it("holds an image elsewhere only to its box's width", () => {
    const style = imageStyleOf(renderToStaticMarkup(<MarkdownText text="![A cat](https://e.co/cat.png)" />))
    expect(style).to.contain('max-width:100%')
    expect(style).not.to.contain('max-height')
  })
})

describe("MarkdownText, with imagesAsLinks, as a reviewer's words are drawn", () => {
  it("draws an image as a link to it, by its alt text, and fetches nothing", () => {
    const markup = renderToStaticMarkup(<MarkdownText imagesAsLinks text="See ![A cat](https://e.co/cat.png)" />)
    expect(markup).not.to.contain('<img')
    expect(markup).to.eq('<p>See <a href="https://e.co/cat.png" target="_blank" rel="noopener noreferrer">A cat</a></p>')
  })

  it("names the link by the image's address when it has no alt text", () => {
    expect(renderedText(<MarkdownText imagesAsLinks text="![](https://e.co/cat.png)" />)).to.eq('https://e.co/cat.png')
  })

  it("draws an image at an address the allowlist drops as its alt text alone, linking nowhere", () => {
    expect(renderToStaticMarkup(<MarkdownText imagesAsLinks text="![A cat](javascript:alert(1))" />)).to.eq('<p>A cat</p>')
  })

  it("does the same on a face", () => {
    const markup = renderToStaticMarkup(<MarkdownFace inInput imagesAsLinks text="![A cat](https://e.co/cat.png)" />)
    expect(markup).not.to.contain('<img')
    expect(markup).to.contain('<a href="https://e.co/cat.png"')
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
