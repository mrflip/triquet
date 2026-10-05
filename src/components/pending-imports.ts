import type { ElsewhereT } from '../lib/importing'

/**
 * Pastes on their way to the quiz they belong to: a hunt pasted into a quiz matching none of its
 * quizzes goes to the quiz of its first quiz's label (`Importing.ElsewhereT`), and the Import of
 * that quiz reads it once the quiz is on screen. Held in this tab alone, for the moment of the
 * move: a reload forgets one, which the author can paste again.
 */

/** A paste waiting for its quiz: the text, and which of its quizzes to read there */
export type PendingImportT = { pasted: string, take: ElsewhereT['take'] }

/** The pastes waiting, by where their quiz is (`keyOf`) */
const Waiting = new Map<string, PendingImportT>()

/**
 * Where a paste waits: its hunt, and the quiz's label, which is unique within the hunt's one realm.
 *
 * @example keyOf(hunt._id, 'legends')  // => 'j97…/legends'
 */
export function keyOf(hunt_id: string, quizlabel: string): string {
  return `${hunt_id}/${quizlabel}`
}

/** Hold `pending` for the quiz `key` names, in place of any held for it before */
export function hold(key: string, pending: PendingImportT): void {
  Waiting.set(key, pending)
}

/** The paste waiting for the quiz `key` names, left waiting; null for none */
export function peek(key: string): PendingImportT | null {
  return Waiting.get(key) ?? null
}

/** Let go of the paste waiting for the quiz `key` names, once it is read or will never be */
export function clear(key: string): void {
  Waiting.delete(key)
}
