import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { publishRuntimeAssets } from '../../src/db/publish-runtime-assets'

/** A stand-in for the installed jazz-tools package, holding only what gets published */
function fakePackage(root: string, version: string, worker: string): string {
  const packageDir = path.join(root, 'jazz-tools')
  mkdirSync(path.join(packageDir, 'dist/worker'), { recursive: true })
  writeFileSync(path.join(packageDir, 'package.json'), JSON.stringify({ version }))
  writeFileSync(path.join(packageDir, 'dist/worker/jazz-broker-worker.js'), worker)
  writeFileSync(path.join(packageDir, 'dist/worker/jazz_wasm_bg.wasm'), 'wasm bytes')
  return packageDir
}

describe('publishRuntimeAssets', () => {
  const suite = { root: '', publicDir: '' }

  beforeEach(() => {
    suite.root = mkdtempSync(path.join(tmpdir(), 'triquet-jazz-runtime-'))
    suite.publicDir = path.join(suite.root, 'public')
  })

  afterEach(() => { rmSync(suite.root, { recursive: true, force: true }) })

  it('serves the worker and WASM where Jazz looks under its base, as the package version with a digest', () => {
    const served = publishRuntimeAssets(fakePackage(suite.root, '2.0.0-alpha.56', 'worker v1'), suite.publicDir)
    expect(served).to.match(/^2\.0\.0-alpha\.56-[0-9a-f]{12}$/)
    const base = path.join(suite.publicDir, 'jazz', served)
    expect(readFileSync(path.join(base, 'worker/jazz-broker-worker.js'), 'utf8')).to.eq('worker v1')
    expect(readFileSync(path.join(base, 'jazz_wasm_bg.wasm'), 'utf8')).to.eq('wasm bytes')
  })

  it('serves the same bytes as the same version, every time', () => {
    const packageDir = fakePackage(suite.root, '2.0.0-alpha.56', 'worker v1')
    const first = publishRuntimeAssets(packageDir, suite.publicDir)
    expect(publishRuntimeAssets(packageDir, suite.publicDir)).to.eq(first)
    expect(readdirSync(path.join(suite.publicDir, 'jazz'))).to.deep.eq([first])
  })

  it('serves different bytes under the same package version as a different version, and drops the old copy', () => {
    const before = publishRuntimeAssets(fakePackage(suite.root, '2.0.0-alpha.56', 'worker v1'), suite.publicDir)
    const after = publishRuntimeAssets(fakePackage(suite.root, '2.0.0-alpha.56', 'worker v1, patched'), suite.publicDir)
    expect(after).not.to.eq(before)
    expect(readdirSync(path.join(suite.publicDir, 'jazz'))).to.deep.eq([after])
  })

  it('leaves alone a copy another process is still writing', () => {
    const staging = path.join(suite.publicDir, 'jazz', '.2.0.0-alpha.57-0123456789ab-999')
    mkdirSync(staging, { recursive: true })
    publishRuntimeAssets(fakePackage(suite.root, '2.0.0-alpha.56', 'worker v1'), suite.publicDir)
    expect(existsSync(staging)).to.eq(true)
  })

  it('fails loudly when the package lacks a file', () => {
    const packageDir = fakePackage(suite.root, '2.0.0-alpha.56', 'worker v1')
    rmSync(path.join(packageDir, 'dist/worker/jazz_wasm_bg.wasm'))
    expect(() => publishRuntimeAssets(packageDir, suite.publicDir)).to.throw(/ENOENT/)
  })
})
