import type { MetadataRoute } from 'next'
import { LightPalette } from './palette'

/**
 * The web app manifest, served at /manifest.webmanifest: what a browser needs to install
 * Triquet as an app. A manifest has no dark variant, so it wears the light ground and icon.
 *
 * The icons are full-bleed, with the mark inside the central circle a platform may crop to, so
 * each is offered as `maskable` as well as `any`.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id:               '/',
    name:             'Triquet',
    short_name:       'Triquet',
    start_url:        '/',
    display:          'standalone',
    background_color: LightPalette.page,
    theme_color:      LightPalette.page,
    icons: [
      { src: '/brand/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/brand/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/brand/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: '/brand/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
