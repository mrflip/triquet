'use client'

import { useMutation } from 'convex/react'
import { api } from '../../convex/_generated/api'
import type { UserActionDNA } from '../models/actions'
import { useAwaitedActions, type AwaitedActionsHandle } from './use-awaited-actions'

/**
 * What a visitor can do as themselves -- take a userlabel, retitle themselves -- on `users.perform`,
 * one at a time, the caller waiting on each (`useAwaitedActions`).
 */
export function useUserActions(): AwaitedActionsHandle<UserActionDNA> {
  return useAwaitedActions(useMutation(api.users.perform), 'a user action')
}
