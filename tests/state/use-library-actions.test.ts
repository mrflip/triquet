import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Id } from '../../convex/_generated/dataModel'
import * as Actor from '../../src/lib/actor'
import { libraryDenialOf } from '../../src/state/use-library-actions'

const user_id = 'm57a2835q9kp1gefja107b9bfh8fnpvr' as Id<'users'>
const Alice = Actor.asIdent(user_id, { _id: 'j97d0qbj35dar1v8edndzckvsx8f828f' as Id<'idents'>, label: 'alice_smiths' }, true)

const Move = { kind: 'move_widget', label: 'dumdum', onto_idx: 0 } as const

describe('libraryDenialOf', () => {
  afterEach(() => { vi.restoreAllMocks() })

  it('allows an admin', () => {
    expect(libraryDenialOf(Alice, Move)).to.eq(null)
  })

  it('refuses one who has asserted no username, as the server would', () => {
    expect(libraryDenialOf(Actor.anonymous, { kind: 'delete_widget', label: 'dumdum' })).to.eq('notIdentified')
  })

  it('refuses everyone once `Actor.isAdmin` says nobody is an admin', () => {
    vi.spyOn(Actor, 'isAdmin').mockReturnValue(false)
    expect(libraryDenialOf(Alice, Move)).to.eq('notPermitted')
  })

  it('leaves an action that does not read as one to the server, which says what is wrong with it', () => {
    expect(libraryDenialOf(Actor.anonymous, { kind: 'move_widget', label: 'Not A Label', onto_idx: 0 })).to.eq(null)
  })
})
