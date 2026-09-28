'use client'

import { createTheme } from '@mui/material/styles'
import { DarkPalette, LightPalette } from './palette'

// The theme is built with CSS variables, so its type carries them: `vars`, `colorSchemes`. This
// is what MUI's `themeCssVarsAugmentation` declares, written out to suit our lint.
declare module '@mui/material/styles' {
  interface CssThemeVariables {
    enabled: true
  }
}

/**
 * MUI's slice of the design system.
 *
 * Both schemes are first-class and are built from the same palette the CSS tokens come from,
 * so MUI's own components sit in the same ground as the hand-built grid. The scheme is selected
 * by the `data-theme` attribute, which is also what the tokens key off.
 */
export const theme = createTheme({
  cssVariables: { colorSchemeSelector: 'data-theme' },
  colorSchemes: {
    light: {
      palette: {
        contrastThreshold: 4.5,
        primary:    { main: LightPalette.accent, contrastText: LightPalette.surface },
        secondary:  { main: LightPalette.highlight, contrastText: LightPalette.surface },
        success:    { main: LightPalette.good },
        error:      { main: LightPalette.bad },
        background: { default: LightPalette.page, paper: LightPalette.surface },
        text:       { primary: LightPalette.ink, secondary: LightPalette.muted },
        divider:    LightPalette.border,
      },
    },
    dark: {
      palette: {
        contrastThreshold: 4.5,
        primary:    { main: DarkPalette.accent, contrastText: DarkPalette.page },
        secondary:  { main: DarkPalette.highlight, contrastText: DarkPalette.page },
        success:    { main: DarkPalette.good },
        error:      { main: DarkPalette.bad },
        background: { default: DarkPalette.page, paper: DarkPalette.surface },
        text:       { primary: DarkPalette.ink, secondary: DarkPalette.muted },
        divider:    DarkPalette.border,
      },
    },
  },
  shape: { borderRadius: 6 },
  typography: {
    fontFamily: 'var(--font-ui)',
    button:     { textTransform: 'none', fontWeight: 600 },
  },
  components: {
    MuiButton: {
      defaultProps:   { disableElevation: true },
      styleOverrides: { root: { borderRadius: 'var(--radius-pill)' } },
    },
  },
})
