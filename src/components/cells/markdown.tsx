'use client'

import { Box, Typography } from '@mui/material'
import ReactMarkdown, { type Components } from 'react-markdown'
import clsx from 'clsx'
import * as Markdown from '../../lib/markdown'
import * as Templating from '../../lib/templating'
import styles from '../workbench.module.css'

/**
 * A link in a field opens beside the quiz rather than in place of it. An image (only a templated
 * field keeps one) is fetched when it scrolls near, telling its host nothing of the page, and is
 * never wider than its box.
 */
const Dressing: Components = {
  a:   ({ node: _node, ...props }) => <a {...props} target="_blank" rel="noopener noreferrer" />,
  img: ({ node: _node, src, alt }) => <Box component="img" src={src} alt={alt} loading="lazy" referrerPolicy="no-referrer" sx={{ maxWidth: '100%' }} />,
}

export type MarkdownTextProps = {
  text:       string
  /** Filled in from a template, so images are kept (`Markdown.TemplatedAllowlist`) */
  templated?: boolean
}

/**
 * A field's text, rendered from its markdown, with nothing around it: the caller supplies the
 * box, and `styles.prose` (or a face) spaces what is inside.
 */
export function MarkdownText({ text, templated = false }: Readonly<MarkdownTextProps>) {
  const options = templated ? Markdown.TemplatedRenderOptions : Markdown.RenderOptions
  return <ReactMarkdown {...options} components={Dressing}>{Markdown.forScreen(text)}</ReactMarkdown>
}

/** What a text box's face shows: the text as typed, or, for a field the quiz templates, filled in */
export type FaceT = {
  /** The markdown the face draws */
  text:      string
  /** Whether it was filled in from a template, which keeps its images */
  templated: boolean
  /** Why the template could not be filled in, its text then shown as typed; null when nothing is wrong */
  issue:     string | null
}

/**
 * The face of a box holding `text`: the text itself, or, when `bag` is given (the quiz templates
 * the field), the text filled in over it (`Templating.fill`), before any markdown is read.
 *
 * @example faceOf('By {{qn.author}}', null)   // => { text: 'By {{qn.author}}', templated: false, issue: null }
 * @example faceOf('By {{qn.author}}', bag)    // => { text: 'By Ada', templated: true, issue: null }
 */
export function faceOf(text: string, bag: Templating.TemplateBag | null): FaceT {
  if (bag === null) { return { text, templated: false, issue: null } }
  const filled = Templating.fill(text, bag)
  return { text: filled.markdown, templated: true, issue: filled.issue }
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
}

/**
 * A text box's rendered face: its markdown, drawn over the box while nobody is typing in it,
 * and lifted the moment anything in its positioned parent takes focus, so the author edits the
 * text as typed. It scrolls when it overflows its box; a click on it, other than on a link, is
 * passed to the box. It is hidden from assistive technology, which reads the box. The box itself
 * wears `veiledIf(text)`, so its own text is out of sight beneath the face. A template that could
 * not be filled in says why above its text.
 */
export function MarkdownFace({ text, templated = false, issue = null, inInput = false, faceRef }: Readonly<MarkdownFaceProps>) {
  if (! faced(text)) { return null }
  return (
    <div ref={faceRef} aria-hidden data-face onClick={focusBox} className={clsx(styles.face, styles.prose, inInput && styles.faceInInput)}>
      {issue !== null && <Typography variant="caption" color="error" component="p" data-template-issue>{issue}</Typography>}
      <MarkdownText text={text} templated={templated} />
    </div>
  )
}
