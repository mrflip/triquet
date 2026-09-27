import { createHash } from 'node:crypto'
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync } from 'node:fs'
import path from 'node:path'
import { RuntimeAssetFiles, RuntimeAssetsDir } from './runtime-assets'

/**
 * Copies Jazz's browser runtime out of the installed package into the static root, under a
 * directory named for the version it is served as, and removes any other version's copy. Run by
 * `next.config.ts`, so every dev server and build has it; Node only.
 *
 * The version is the package's own, with a digest of the files: a patched package keeps its
 * version number but not its bytes, and two builds of different bytes must never share a URL.
 * A copy already in place is kept; a new one is written aside and moved in whole, so a server
 * started alongside never serves half of one.
 *
 * @param packageDir - The installed jazz-tools package.
 * @param publicDir - The site's static root.
 * @returns The version the runtime is served as.
 *
 * @example publishRuntimeAssets('node_modules/jazz-tools', 'public')  // => '2.0.0-alpha.56-3f9a1c0b2e7d', having written public/jazz/2.0.0-alpha.56-3f9a1c0b2e7d/
 */
export function publishRuntimeAssets(packageDir: string, publicDir: string): string {
  const { version } = JSON.parse(readFileSync(path.join(packageDir, 'package.json'), 'utf8')) as { version: string }
  const digest = createHash('sha256')
  for (const { from } of RuntimeAssetFiles) { digest.update(readFileSync(path.join(packageDir, from))) }
  const served = `${version}-${digest.digest('hex').slice(0, 12)}`

  const root = path.join(publicDir, RuntimeAssetsDir)
  const target = path.join(root, served)
  if (! existsSync(target)) {
    const staging = path.join(root, `.${served}-${String(process.pid)}`)
    for (const { from, to } of RuntimeAssetFiles) {
      mkdirSync(path.dirname(path.join(staging, to)), { recursive: true })
      copyFileSync(path.join(packageDir, from), path.join(staging, to))
    }
    try {
      renameSync(staging, target)
    } catch (err) {
      // Another process moved the same version in first; anything else is a real failure.
      rmSync(staging, { recursive: true, force: true })
      if (! existsSync(target)) { throw err }
    }
  }
  for (const entry of readdirSync(root)) {
    if (entry !== served && ! entry.startsWith('.')) { rmSync(path.join(root, entry), { recursive: true, force: true }) }
  }
  return served
}
