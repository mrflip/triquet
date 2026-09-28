'use client'

import Image from 'next/image'
import { Box } from '@mui/material'

/** The lockup's own proportions, from its viewBox */
const LockupAspect = 4418 / 1313

/**
 * The Triquet lockup, the mark beside the wordmark, drawn as curves so it needs no font. It comes
 * in the colouring that suits the theme: smoky on a light ground, bonjour on a dark one. Both are
 * in the page and the theme hides one, keyed off the same `data-theme` the palette follows, so
 * the right one shows from the first paint. It sits in the header, always above the fold and often
 * the page's largest paint, so it loads eagerly rather than waiting to be scrolled to.
 *
 * @param height - How tall to draw it, in CSS pixels; the width follows.
 */
export function Logo({ height = 32 }: Readonly<{ height?: number }>) {
  const width = Math.round(height * LockupAspect)
  return (
    <>
      <Box component="span" sx={[{ display: 'inline-flex' }, (theme) => theme.applyStyles('dark', { display: 'none' })]}>
        <Image src="/brand/triquet-lockup-light.svg" alt="Triquet" width={width} height={height} loading="eager" />
      </Box>
      <Box component="span" sx={[{ display: 'none' }, (theme) => theme.applyStyles('dark', { display: 'inline-flex' })]}>
        <Image src="/brand/triquet-lockup-dark.svg" alt="Triquet" width={width} height={height} loading="eager" />
      </Box>
    </>
  )
}
