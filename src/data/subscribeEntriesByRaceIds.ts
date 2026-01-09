import { collection, onSnapshot, query, where } from 'firebase/firestore'
import { db } from '../firebase'
import type { Entry } from '../models/firestore'
import { toEntry } from './entries'
import { logWarn } from '../utils/log'
import { wrapError } from '../utils/wrapError'

export function subscribeEntriesByRaceIds(
  raceIds: string[],
  onUpdate: (entries: Entry[]) => void,
  onError?: (e: unknown) => void,
) {
  if (!raceIds.length) {
    onUpdate([])
    return () => {}
  }

  const chunks: string[][] = []
  for (let i = 0; i < raceIds.length; i += 10) {
    chunks.push(raceIds.slice(i, i + 10))
  }

  const chunkData = new Map<number, Entry[]>()
  const unsubs: Array<() => void> = []

  const emitAll = () => {
    const merged: Entry[] = []
    for (const arr of chunkData.values()) merged.push(...arr)
    onUpdate(merged)
  }

  chunks.forEach((ids, idx) => {
    const q = query(collection(db, 'entries'), where('raceId', 'in', ids))
    const unsub = onSnapshot(
      q,
      (snap) => {
        try {
          const rows = snap.docs
            .map((d) => {
              try {
                return toEntry(d.id, d.data())
              } catch (err) {
                logWarn('subscribeEntriesByRaceIds.toEntry', err)
                return null
              }
            })
            .filter(Boolean) as Entry[]
          chunkData.set(idx, rows)
          emitAll()
        } catch (err) {
          logWarn('subscribeEntriesByRaceIds.chunk', err)
        }
      },
      (err) => {
        logWarn('subscribeEntriesByRaceIds.error', err)
        onError?.(wrapError('subscribeEntriesByRaceIds', err))
      },
    )
    unsubs.push(unsub)
  })

  return () => {
    unsubs.forEach((u) => u())
  }
}
