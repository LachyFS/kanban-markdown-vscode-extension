import type { Feature } from './types'

/** When `epicLane` is undefined, do not filter by epic. `null` means the "no epic" lane. */
export function featureMatchesEpicLane(f: Feature, epicLane: string | null | undefined): boolean {
  if (epicLane === undefined) return true
  const e = f.epic?.trim() || null
  if (epicLane === null) return e === null
  return e === epicLane
}
