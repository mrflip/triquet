'use client'

import Image from 'next/image'
import { Box, type Breakpoint } from '@mui/material'

/** The lockup's own proportions, from its viewBox */
const LockupAspect = 4418 / 1313

/** The mark's own proportions, from its viewBox */
const MarkAspect = 72 / 68

/**
 * The Triquet lockup, the mark beside the wordmark, drawn as curves so it needs no font. It comes
 * in the colouring that suits the theme: smoky on a light ground, bonjour on a dark one. Both are
 * in the page and the theme hides one, keyed off the same `data-theme` the palette follows, so
 * the right one shows from the first paint. It sits in the header, always above the fold and often
 * the page's largest paint, so it loads eagerly rather than waiting to be scrolled to.
 *
 * Given `markBelow`, a window narrower than that breakpoint shows the mark alone, the wordmark
 * giving way to what sits beside it.
 *
 * @param height - How tall to draw it, in CSS pixels; the width follows.
 * @param markBelow - The breakpoint below which only the mark shows; absent, the lockup always does.
 */
export function Logo({ height = 32, markBelow }: Readonly<{ height?: number, markBelow?: Breakpoint }>) {
  const lockup = { width: Math.round(height * LockupAspect), height, light: '/brand/triquet-lockup-light.svg', dark: '/brand/triquet-lockup-dark.svg' }
  if (markBelow === undefined) { return <Themed {...lockup} /> }
  const mark = { width: Math.round(height * MarkAspect), height, light: '/brand/triquet-mark-light.svg', dark: '/brand/triquet-mark-dark.svg' }
  return (
    <>
      <Box component="span" sx={{ display: { xs: 'none', [markBelow]: 'inline-flex' } }}><Themed {...lockup} /></Box>
      <Box component="span" sx={{ display: { xs: 'inline-flex', [markBelow]: 'none' } }}><Themed {...mark} /></Box>
    </>
  )
}

type ThemedProps = {
  width:  number
  height: number
  /** The drawing for a light ground, and for a dark one */
  light:  string
  dark:   string
}

/** One drawing, in the colouring that suits the theme: the other colouring is in the page, hidden */
function Themed({ width, height, light, dark }: Readonly<ThemedProps>) {
  return (
    <>
      <Box component="span" sx={[{ display: 'inline-flex' }, (theme) => theme.applyStyles('dark', { display: 'none' })]}>
        <Image src={light} alt="Triquet" width={width} height={height} loading="eager" />
      </Box>
      <Box component="span" sx={[{ display: 'none' }, (theme) => theme.applyStyles('dark', { display: 'inline-flex' })]}>
        <Image src={dark} alt="Triquet" width={width} height={height} loading="eager" />
      </Box>
    </>
  )
}
