import { execFileSync } from 'node:child_process'
import nodeFs, { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import _ from 'es-toolkit/compat'
import { unzipSync } from 'fflate'
import type * as Huntgit from '../../src/lib/huntgit'

/*
 * A real filesystem in a throwaway directory, for the code that writes git repositories, and the
 * real git CLI to read them back. Using the genuine article rather than a double is the point:
 * what the app writes has to be readable by the git anyone already has installed, and only a real
 * repository proves that.
 */

/** A throwaway directory, and the filesystem rooted at it, so that `/hunts/...` lands inside it */
export type ScratchT = { root: string, fs: Huntgit.GitFs, cleanup: () => void }

/** `node:fs`'s own readFile, rooted under `root`, honouring the encoding isomorphic-git asks for */
function readFileAt(root: string): Huntgit.GitFs['promises']['readFile'] {
  function readFile(filepath: string): Promise<Uint8Array>
  function readFile(filepath: string, opts: { encoding: 'utf8' }): Promise<string>
  async function readFile(filepath: string, opts?: { encoding: 'utf8' }): Promise<Uint8Array | string> {
    const at = path.join(root, filepath)
    return opts === undefined ? await nodeFs.promises.readFile(at) : await nodeFs.promises.readFile(at, opts)
  }
  return readFile
}

/** A filesystem whose `/` is `root` */
export function fsRootedAt(root: string): Huntgit.GitFs {
  const at = (filepath: string) => path.join(root, filepath)
  return {
    promises: {
      readFile:  readFileAt(root),
      writeFile: async (filepath, data, opts) => { await nodeFs.promises.writeFile(at(filepath), data, opts) },
      unlink:    async (filepath) => { await nodeFs.promises.unlink(at(filepath)) },
      readdir:   async (filepath) => await nodeFs.promises.readdir(at(filepath)),
      mkdir:     async (filepath) => { await nodeFs.promises.mkdir(at(filepath)) },
      rmdir:     async (filepath) => { await nodeFs.promises.rmdir(at(filepath)) },
      stat:      async (filepath) => await nodeFs.promises.stat(at(filepath)),
      lstat:     async (filepath) => await nodeFs.promises.lstat(at(filepath)),
      readlink:  async (filepath) => await nodeFs.promises.readlink(at(filepath)),
      symlink:   async (target, filepath) => { await nodeFs.promises.symlink(target, at(filepath)) },
    },
  }
}

/** A fresh throwaway directory and the filesystem rooted at it; `cleanup` takes it away */
export function scratch(): ScratchT {
  const root = mkdtempSync(path.join(tmpdir(), 'triquet-git-'))
  return { root, fs: fsRootedAt(root), cleanup: () => { rmSync(root, { recursive: true, force: true }) } }
}

/**
 * What the real git CLI says in `where`, with only trailing newlines taken off: a line of `git
 * status --porcelain` begins with a space, and a tab-separated table's line may begin with a
 * tab, which a plain trim would eat.
 */
export function gitIn(where: string, args: readonly string[]): string {
  // eslint-disable-next-line sonarjs/no-os-command-from-path -- naming an absolute git would make these tests machine-specific, and proving the real, installed git reads what we wrote is their entire purpose
  const said = execFileSync('git', ['-C', where, ...args], { encoding: 'utf8' })
  return _.trimEnd(said, '\n')
}

/** Unzip `zipped` under `into`, as a person downloading it would */
export function unzipInto(zipped: Uint8Array, into: string): void {
  const entries = Object.entries(unzipSync(zipped))
  for (const [filepath, bytes] of entries) {
    const target = path.join(into, filepath)
    nodeFs.mkdirSync(path.dirname(target), { recursive: true })
    nodeFs.writeFileSync(target, bytes)
  }
}
