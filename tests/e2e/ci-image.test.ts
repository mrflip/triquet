import fs from 'node:fs'
import { describe, expect, it } from 'vitest'
import Playwright from '@playwright/test/package.json' with { type: 'json' }

/** The image the e2e job of .github/workflows/ci.yml runs in, as the workflow names it */
function ciImage(): string | undefined {
  const workflow = fs.readFileSync('.github/workflows/ci.yml', 'utf8')
  return /image: (mcr\.microsoft\.com\/playwright:\S+)/.exec(workflow)?.[1]
}

describe('the e2e job\'s image', () => {
  it('is Playwright\'s own, for the version installed: its browsers are the ones that version drives', () => {
    expect(ciImage()).to.eq(`mcr.microsoft.com/playwright:v${Playwright.version}-noble`)
  })
})
