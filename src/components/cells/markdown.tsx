'use client'

import ReactMarkdown, { type Components } from 'react-markdown'
import clsx from 'clsx'
import * as Markdown from '../../lib/markdown'
import styles from '../workbench.module.css'

/** A link in a field opens beside the quiz rather than in place of it */
const Dressing: Components = {
  a: ({ node: _node, ...props }) => <a {...props} target="_blank" rel="noopener noreferrer" />,
}

/**
 * A field's text, rendered from its markdown, with nothing around it: the caller supplies the
 * box, and `styles.prose` (or a face) spaces what is inside.
 */
export function MarkdownText({ text }: Readonly<{ text: string }>) {
  return <ReactMarkdown {...Markdown.RenderOptions} components={Dressing}>{Markdown.forScreen(text)}</ReactMarkdown>
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

export type MarkdownFaceProps = {
  /** What the box holds, as typed */
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
 * wears `veiledIf(text)`, so its own text is out of sight beneath the face.
 */
export function MarkdownFace({ text, inInput = false, faceRef }: Readonly<MarkdownFaceProps>) {
  if (! faced(text)) { return null }
  return (
    <div ref={faceRef} aria-hidden data-face onClick={focusBox} className={clsx(styles.face, styles.prose, inInput && styles.faceInInput)}>
      <MarkdownText text={text} />
    </div>
  )
}
