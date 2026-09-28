'use client'

import Image from 'next/image'
import { Box, Card, CardActionArea, Chip, Link, Stack, Typography } from '@mui/material'
import DownloadIcon from '@mui/icons-material/Download'
import AboutTriquet from '../content/about.md'
import styles from './workbench.module.css'

/** Which of the brand's grounds a piece is shown on, whatever the page's own theme */
type Groundkind = 'light' | 'dark'

/** One downloadable piece of the brand, and how to show it */
type BrandAsset = {
  /** Where the file is served, and so what a click downloads */
  href:    string
  caption: string
  ground:  Groundkind
  /** What to draw on the tile, when it is not the file itself */
  preview: { src: string, width: number, height: number }
}

const Grounds: Record<Groundkind, string> = {
  light: 'var(--brand-bonjour)',
  dark:  'var(--brand-martinique)',
}

const Marks: readonly BrandAsset[] = [
  { href: '/brand/triquet-mark-light.svg', caption: 'Mark · light', ground: 'light', preview: { src: '/brand/triquet-mark-light.svg', width: 212, height: 200 } },
  { href: '/brand/triquet-mark-dark.svg',  caption: 'Mark · dark',  ground: 'dark',  preview: { src: '/brand/triquet-mark-dark.svg',  width: 212, height: 200 } },
]

const Lockups: readonly BrandAsset[] = [
  { href: '/brand/triquet-lockup-light.svg', caption: 'Lockup · light', ground: 'light', preview: { src: '/brand/triquet-lockup-light.svg', width: 323, height: 96 } },
  { href: '/brand/triquet-lockup-dark.svg',  caption: 'Lockup · dark',  ground: 'dark',  preview: { src: '/brand/triquet-lockup-dark.svg',  width: 323, height: 96 } },
]

const Icons: readonly BrandAsset[] = [
  { href: '/brand/icon-512.png',      caption: 'App icon · light', ground: 'light', preview: { src: '/brand/icon-512.png',      width: 112, height: 112 } },
  { href: '/brand/icon-512-dark.png', caption: 'App icon · dark',  ground: 'dark',  preview: { src: '/brand/icon-512-dark.png', width: 112, height: 112 } },
  { href: '/brand/favicon-32.png',    caption: '32px · light',     ground: 'light', preview: { src: '/brand/favicon-32.png',    width: 32,  height: 32 } },
  { href: '/brand/icon-dark.svg',     caption: '32px · dark',      ground: 'dark',  preview: { src: '/brand/icon-dark.svg',     width: 32,  height: 32 } },
]

/** The rest of the kit, offered by name */
const OtherFiles: readonly string[] = [
  '/brand/triquet-wordmark-light.svg',
  '/brand/triquet-wordmark-dark.svg',
  '/brand/icon.svg',
  '/brand/icon-dark.svg',
  '/brand/icon-192.png',
  '/brand/app-icon.svg',
  '/brand/app-icon-dark.svg',
  '/apple-icon.png',
  '/brand/apple-icon-dark.png',
  '/brand/favicon-tile.svg',
  '/brand/tokens.css',
]

/** What Triquet is, and its brand kit laid out to look at, each piece a click from downloading */
export function About() {
  return (
    <Box component="main" className={styles.page} sx={{ maxWidth: 880, mx: 'auto' }}>
      <Typography variant="h4" component="h1" gutterBottom>About Triquet</Typography>
      <AboutTriquet />
      <Typography variant="h5" component="h2" sx={{ mt: 4, mb: 1 }}>Brand assets</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>Click any piece to download it.</Typography>
      <Stack spacing={2}>
        <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
          {Marks.map((asset) => <AssetTile key={asset.href} asset={asset} minHeight={280} />)}
        </Box>
        {Lockups.map((asset) => <AssetTile key={asset.href} asset={asset} minHeight={160} align="flex-start" />)}
        <Stack direction="row" useFlexGap spacing={2} sx={{ flexWrap: 'wrap', alignItems: 'flex-start' }}>
          {Icons.map((asset) => <AssetTile key={asset.href} asset={asset} minHeight={144} width={144} />)}
          <FaviconTab />
        </Stack>
        <Stack direction="row" useFlexGap spacing={1} sx={{ flexWrap: 'wrap', pt: 1 }}>
          {OtherFiles.map((href) => (
            <Chip
              key={href} component="a" href={href} download={basename(href)} clickable
              variant="outlined" size="small" icon={<DownloadIcon />} label={basename(href)}
            />
          ))}
        </Stack>
      </Stack>
    </Box>
  )
}

/** One piece on its own ground, captioned, which downloads when clicked */
function AssetTile({ asset, minHeight, width, align = 'center' }: Readonly<{ asset: BrandAsset, minHeight: number, width?: number, align?: 'center' | 'flex-start' }>) {
  const filename = basename(asset.href)
  return (
    <Stack spacing={0.75} sx={{ width }}>
      <Card variant="outlined" sx={{ bgcolor: Grounds[asset.ground], borderRadius: 'var(--radius-container)' }}>
        <CardActionArea
          component="a" href={asset.href} download={filename} aria-label={`Download ${asset.caption} (${filename})`}
          sx={{ display: 'flex', alignItems: 'center', justifyContent: align, minHeight, px: 4 }}
        >
          <Image src={asset.preview.src} alt="" width={asset.preview.width} height={asset.preview.height} unoptimized />
        </CardActionArea>
      </Card>
      <Typography variant="body2" color="text.secondary">{asset.caption}</Typography>
    </Stack>
  )
}

/** The favicon as a browser shows it, at 16px in a tab beside the page's title */
function FaviconTab() {
  return (
    <Stack spacing={0.75}>
      <Link
        href="/favicon.ico" download="favicon.ico" underline="none" aria-label="Download 16px favicon (favicon.ico)"
        sx={{
          display: 'flex', alignItems: 'center', gap: 1.5, width: 240, height: 40, px: 2,
          bgcolor: Grounds.light, color: 'var(--brand-martinique)',
          borderRadius: 'var(--radius-container) var(--radius-container) 0 0',
          border: 1, borderBottom: 0, borderColor: 'divider',
        }}
      >
        <Image src="/favicon.ico" alt="" width={16} height={16} unoptimized />
        <Typography variant="body2" component="span">Triquet</Typography>
      </Link>
      <Typography variant="body2" color="text.secondary">16px favicon</Typography>
    </Stack>
  )
}

/** The last segment of a path: `/brand/icon.svg` as `icon.svg` */
function basename(href: string): string {
  return href.slice(href.lastIndexOf('/') + 1)
}
