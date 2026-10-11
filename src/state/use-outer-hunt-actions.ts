'use client'

import { useMutation } from 'convex/react'
import { api } from '../../convex/_generated/api'
import type { OuterHuntActionDNA } from '../models/actions'
import { useAwaitedActions, type AwaitedActionsHandle } from './use-awaited-actions'

/**
 * What a visitor can do to a hunt from outside any quiz -- make one, retitle, relabel or rebranch
 * one they smith -- on `hunts.performOuter`, one at a time, the caller waiting on each
 * (`useAwaitedActions`). From inside a quiz, a hunt is changed through `useHunt`'s dispatcher.
 */
export function useOuterHuntActions(): AwaitedActionsHandle<OuterHuntActionDNA> {
  return useAwaitedActions(useMutation(api.hunts.performOuter), 'an outer hunt action')
}
