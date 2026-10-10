import { describe, expect, it, vi } from 'vitest'
import type { OptimisticLocalStore } from 'convex/browser'
import { libraryChanged, showLibraryChanged } from '../../src/state/optimistic-library'
import { Widget, type WidgetT } from '../../src/models/widget'
import type { LibraryActionDNA } from '../../src/models/actions'

const Riddle = Widget.fill({ label: 'riddle', formulary: 'aibot', formula: 'Riddle me {{clueing}}.', config: { servicelabel: 'claude', model_tier: 'careful', max_tokens: 1024 } })
const Shout = Widget.fill({ label: 'shout', formulary: 'jsonata', formula: '$uppercase(qn.title)' })
const Points = Widget.fill({ label: 'points', formulary: 'entry', config: { entry_kind: 'number' } })
const Library: readonly WidgetT[] = [Riddle, Shout, Points]

describe("libraryChanged", () => {
  it("revises a widget with its patch merged in, leaving the rest and their order", () => {
    const changed = libraryChanged(Library, { kind: 'edit_widget', label: 'riddle', patch: { input_formula: "{ 'clueing': $uppercase(qn.clueing) }", config: { ...Riddle.config, max_tokens: 300 } } })
    expect(changed.map((widget) => widget.label)).to.deep.eq(['riddle', 'shout', 'points'])
    expect(changed[0]).to.deep.eq({ ...Riddle, input_formula: "{ 'clueing': $uppercase(qn.clueing) }", config: { ...Riddle.config, max_tokens: 300 } })
    expect(changed[1]).to.eq(Shout)
  })

  it("adds a new widget at the end of the list, where the server places it", () => {
    const Whisper = Widget.fill({ label: 'whisper', formulary: 'jsonata', formula: '$lowercase(qn.title)' })
    expect(libraryChanged(Library, { kind: 'add_widget', widget: Whisper })).to.deep.eq([...Library, Whisper])
  })

  const Unshown: [LibraryActionDNA, string][] = [
    [{ kind: 'add_widget', widget: { ...Shout, formula: '1' } },                         'a new widget under a label the library already has, which the server refuses'],
    [{ kind: 'edit_widget', label: 'absent', patch: { formula: '1' } },                  'a revision of a widget the library lacks'],
    [{ kind: 'edit_widget', label: 'riddle', patch: { config: { entry_kind: 'text' } } }, 'a config of another formulary\'s shape'],
    [{ kind: 'edit_widget', label: 'points', patch: { config: { entry_kind: 'text' } } }, 'an entry\'s kind changed, which the server refuses'],
    [{ kind: 'edit_widget', label: 'Not A Label', patch: { formula: '1' } },             'an action that does not read as one'],
    [{ kind: 'delete_widget', label: 'shout' },                                          'a removal, which waits for the server'],
    [{ kind: 'move_widget', label: 'shout', onto_idx: 0 },                               'a move, which waits for the server'],
  ]
  for (const [action, said] of Unshown) {
    it(`leaves the library as it is for ${said}`, () => {
      expect(libraryChanged(Library, action)).to.eq(Library)
    })
  }
})

/** A stand-in for Convex's store, holding the library's one reading, or none yet */
function storeHolding(library: readonly WidgetT[] | undefined) {
  const setQuery = vi.fn()
  const store = { getQuery: () => library, setQuery } as unknown as OptimisticLocalStore
  return { store, setQuery }
}

describe("showLibraryChanged", () => {
  it("sets the library's reading to the library changed", () => {
    const { store, setQuery } = storeHolding(Library)
    showLibraryChanged(store, { action: { kind: 'edit_widget', label: 'shout', patch: { formula: '$uppercase(qn.answer)' } } })
    expect(setQuery).toHaveBeenCalledOnce()
    expect(setQuery.mock.calls[0]?.[2]).to.deep.eq([Riddle, { ...Shout, formula: '$uppercase(qn.answer)' }, Points])
  })

  it("sets nothing when the change is not shown early, or the library is not read yet", () => {
    const held = storeHolding(Library)
    showLibraryChanged(held.store, { action: { kind: 'delete_widget', label: 'shout' } })
    const unread = storeHolding(undefined)
    showLibraryChanged(unread.store, { action: { kind: 'edit_widget', label: 'shout', patch: { formula: '1' } } })
    expect([held.setQuery.mock.calls.length, unread.setQuery.mock.calls.length]).to.deep.eq([0, 0])
  })

  it("reports a throw rather than stopping the write", () => {
    const spoken = vi.spyOn(console, 'error').mockImplementation(() => null)
    const store = { getQuery: () => { throw new Error('store broke') }, setQuery: vi.fn() } as unknown as OptimisticLocalStore
    expect(() => { showLibraryChanged(store, { action: { kind: 'delete_widget', label: 'shout' } }) }).to.not.throw()
    expect(spoken).toHaveBeenCalledOnce()
    spoken.mockRestore()
  })
})
