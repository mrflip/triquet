import { describe, expect, it, vi } from 'vitest'
import { LibraryForm } from '../../../src/components/panels/LibraryForm'
import { AppNotices } from '../../../src/lib/notices'
import { SeedWidgets } from '../../../src/models/seeds'
import { renderedText } from '../../support/rendering'

/** What the library form says, for a reader who may change the library or may not */
const textFor = (changeable: boolean) => renderedText(<LibraryForm library={SeedWidgets} changeable={changeable} dispatch={vi.fn()} />)

describe('LibraryForm', () => {
  it("says who may change the library, in place of the box to paste one back, to a reader who may not", () => {
    expect(textFor(false)).to.include(AppNotices.libraryReadOnly.replaceAll("'", '&#x27;'))
    expect(textFor(false)).to.not.include('Import library')
  })

  it("offers the box to paste one back, and says nothing of who may, to a reader who may change it", () => {
    expect(textFor(true)).to.include('Import library')
    expect(textFor(true)).to.not.include(AppNotices.libraryReadOnly.replaceAll("'", '&#x27;'))
  })
})
