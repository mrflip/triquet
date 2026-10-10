'use client'

import { createContext, memo, useContext } from 'react'
import { Box, Typography } from '@mui/material'
import ReactMarkdown, { type Components } from 'react-markdown'
import clsx from 'clsx'
import * as Markdown from '../../lib/markdown'
import * as Templating from '../../lib/templating'
import styles from '../workbench.module.css'

/**
 * How tall an image in one of the grid's cells may be drawn, in pixels: a thumbnail, so a picture
 * in a clueing does not stretch its row. Anywhere else an image is held only to its box's width.
 */
export const CellImageMaxPx = 96

/**
 * How a field's markdown dresses what it makes: a link opens beside the quiz; an image is fetched
 * when it scrolls near, telling its host nothing of the page, never wider than its box, and, in a
 * grid cell, no taller than `CellImageMaxPx`.
 */
function dressingFor(cell: boolean): Components {
  return {
    a:   ({ node: _node, ...props }) => <a {...props} target="_blank" rel="noopener noreferrer" />,
    img: ({ node: _node, src, alt }) => (
      <Box component="img" src={src} alt={alt} loading="lazy" referrerPolicy="no-referrer" sx={{ maxWidth: '100%', ...(cell && { maxHeight: CellImageMaxPx, objectFit: 'contain' }) }} />
    ),
  }
}

const Dressing = dressingFor(false)
const CellDressing = dressingFor(true)

/** Whether what is drawn sits inside a link already, where a link of its own would nest one link inside another */
const InLink = createContext(false)

/**
 * An image as a link to it, which opens beside the quiz: the image's alt text, or else its address,
 * as the link's words. Nothing is fetched until the reader follows it. Inside a link already (a
 * linked image, `[![alt](src)](href)`), the words alone, so that the link around them is the one
 * followed.
 */
function ImageLink({ src, alt = '' }: Readonly<{ src?: string | Blob, alt?: string }>) {
  const inLink = useContext(InLink)
  const href = typeof src === 'string' ? src : undefined
  const words = alt === '' ? (href ?? '') : alt
  return href === undefined || inLink ? <>{words}</> : <a href={href} target="_blank" rel="noopener noreferrer">{words}</a>
}

/** As `Dressing`, but with each image a link to it (`ImageLink`), or within a link its words */
const ImageLinkDressing: Components = {
  a:   ({ node: _node, ...props }) => <InLink value><a {...props} target="_blank" rel="noopener noreferrer" /></InLink>,
  img: ({ node: _node, src, alt }) => <ImageLink src={src} alt={alt} />,
}

/** The dressing for a text drawn in a grid cell or not, its images as links or not */
function dressingOf(cell: boolean, imagesAsLinks: boolean): Components {
  if (imagesAsLinks) { return ImageLinkDressing }
  return cell ? CellDressing : Dressing
}

export type MarkdownTextProps = {
  text:  string
  /** Drawn in one of the grid's cells, where an image is held small (`CellImageMaxPx`) */
  cell?: boolean
  /**
   * Each image drawn as a link to it, fetched only if followed: for a reviewer's words, which
   * every smith reads, so that a reviewer cannot have a smith's browser call on an address of the
   * reviewer's choosing just by opening the reviews.
   */
  imagesAsLinks?: boolean
}

/**
 * A field's text, rendered from its markdown, with nothing around it: the caller supplies the
 * box, and `styles.prose` (or a face) spaces what is inside. Images show, by `https` only
 * (`Markdown.Allowlist`), or with `imagesAsLinks` as links to them. Its markdown is read again
 * only when the text, or how it is drawn, changes.
 */
export const MarkdownText = memo(function MarkdownText({ text, cell = false, imagesAsLinks = false }: Readonly<MarkdownTextProps>) {
  return <ReactMarkdown {...Markdown.RenderOptions} components={dressingOf(cell, imagesAsLinks)}>{Markdown.indentsQuoted(text)}</ReactMarkdown>
})

/** What a text box's face shows: the text as typed, or, for a field the quiz templates, filled in */
export type FaceT = {
  /** The markdown the face draws */
  text:  string
  /** Why the template could not be filled in, its text then shown as typed; null when nothing is wrong */
  issue: string | null
}

/**
 * The face of a box holding `text`: the text itself, or, when `bag` is given (the quiz templates
 * the field), the text filled in over it (`Templating.fill`), before any markdown is read.
 *
 * @example faceOf('By {{question.author}}', null)   // => { text: 'By {{question.author}}', issue: null }
 * @example faceOf('By {{question.author}}', bag)    // => { text: 'By Ada', issue: null }
 */
export function faceOf(text: string, bag: Templating.TemplateBag | null): FaceT {
  if (bag === null) { return { text, issue: null } }
  const filled = Templating.fill(text, bag)
  return { text: filled.markdown, issue: filled.issue }
}

/** Whether `text` gets a face drawn over its box: blank text leaves the box, and its placeholder, alone */
function faced(text: string): boolean {
  return text.trim() !== ''
}

/**
 * The class that hides a box's own text while it is not being typed into, for the box a
 * `MarkdownFace` is drawn over; nothing when there is no face.
 */
export function veiledIf(text: string): string | undefined {
  return faced(text) ? styles.veiled : undefined
}

/**
 * Focuses the box a face is drawn over, the text box beside it in their shared parent (MUI's
 * growing box keeps a hidden twin there for measuring, which is passed over), unless the click
 * followed a link.
 */
function focusBox(event: React.MouseEvent<HTMLDivElement>) {
  if (event.target instanceof Element && event.target.closest('a')) { return }
  event.currentTarget.parentElement?.querySelector<HTMLElement>('textarea:not([aria-hidden]), input')?.focus()
}

export type MarkdownFaceProps = Partial<Omit<FaceT, 'text'>> & {
  /** What the face draws: the box's text as typed, or as a template fills it in (`faceOf`) */
  text:     string
  /** Drawn inside an MUI input, whose padding it takes on, rather than over one of the grid's own boxes */
  inInput?: boolean
  /** The face itself, so the grid can measure how tall it would like to be */
  faceRef?: React.Ref<HTMLDivElement>
  /** Each image drawn as a link to it, as a reviewer's words are (`MarkdownText`) */
  imagesAsLinks?: boolean
}

/**
 * A text box's rendered face: its markdown, drawn over the box while nobody is typing in it,
 * and lifted the moment anything in its positioned parent takes focus, so the author edits the
 * text as typed. It scrolls when it overflows its box; a click on it, other than on a link, is
 * passed to the box. It is hidden from assistive technology, which reads the box. The box itself
 * wears `veiledIf(text)`, so its own text is out of sight beneath the face. A template that could
 * not be filled in says why above its text. Over one of the grid's boxes (not `inInput`), its
 * images are held small; with `imagesAsLinks`, each is a link to it. Drawn again only when what it
 * is handed changes.
 */
export const MarkdownFace = memo(function MarkdownFace({ text, issue = null, inInput = false, faceRef, imagesAsLinks = false }: Readonly<MarkdownFaceProps>) {
  if (! faced(text)) { return null }
  return (
    <div ref={faceRef} aria-hidden data-face onClick={focusBox} className={clsx(styles.face, styles.prose, inInput && styles.faceInInput)}>
      {issue !== null && <Typography variant="caption" color="error" component="p" data-template-issue>{issue}</Typography>}
      <MarkdownText text={text} cell={! inInput} imagesAsLinks={imagesAsLinks} />
    </div>
  )
})
