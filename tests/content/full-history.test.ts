import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import * as Huntfiles from '../../src/lib/huntfiles'
import * as Huntgit from '../../src/lib/huntgit'

/*
 * The Full History dialog's text is markdown, which cannot import what it quotes, so these keep it
 * in step with the code that writes the repository it describes.
 */

/** The dialog's text, as written */
const Text = readFileSync(path.join(import.meta.dirname, '../../src/content/full-history.md'), 'utf8')

/** Every path the repository's README names in its table of files */
const ReadmePaths = Huntfiles.Readme.split('\n').flatMap((line) => /^\| `([^`]+)` \|/.exec(line)?.[1] ?? [])

describe('full-history.md', () => {
  it("gives the line that merges the hunt's jsonballs exactly as the README does", () => {
    expect(Huntfiles.Readme).to.include(Huntfiles.MergeCommand)
    expect(Text).to.include(Huntfiles.MergeCommand)
  })

  it("names every file the README's table names", () => {
    expect(ReadmePaths).to.have.length.above(5)
    for (const filepath of ReadmePaths) { expect(Text).to.include(`\`${filepath}\``) }
  })

  it("shows a milestone's tag as the history writes one", () => {
    expect(Text).to.include(Huntgit.tagFor('main', 'legends', 'milestone', new Date('2026-10-05T12:00:00Z')))
  })
})
