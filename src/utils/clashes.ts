import type { Blade, DivisionGroup, Entry, SilencedBladeClash, SilencedClash } from '../models/firestore'

export type BoatClash = { key: string; day: string; group: string; boat: string; count: number; silenced: boolean }
export type BladeClash = { key: string; day: string; group: string; blade: string; used: number; amount: number; silenced: boolean }

export function inferPreciseBoatType(event: string): string | null {
  const e = event.toLowerCase()
  if (e.includes('8x+')) return '8x+'
  if (e.includes('8+')) return '8+'
  if (e.includes('4x+')) return '4x+'
  if (e.includes('4x-')) return '4x-'
  if (e.includes('4x')) return '4x'
  if (e.includes('4+')) return '4+'
  if (e.includes('4-')) return '4-'
  if (e.includes('2x-')) return '2x-'
  if (e.includes('2x')) return '2x'
  if (e.includes('2-')) return '2-'
  if (e.includes('1x-')) return '1x-'
  if (e.includes('1x')) return '1x'
  return null
}

export function bladesRequiredFor(type: string | null): number {
  switch (type) {
    case '1x':
    case '1x-':
      return 2
    case '2-':
      return 2
    case '2x':
    case '2x-':
      return 4
    case '4-':
    case '4+':
      return 4
    case '4x':
    case '4x-':
    case '4x+':
      return 8
    case '8+':
      return 8
    case '8x+':
      return 16
    default:
      return 0
  }
}

export function buildGroupMap(groups: DivisionGroup[]): Map<string, Map<string, Set<string>>> {
  const m = new Map<string, Map<string, Set<string>>>()
  for (const g of groups) {
    if (!m.has(g.day)) m.set(g.day, new Map())
    const gm = m.get(g.day) as Map<string, Set<string>>
    gm.set(g.group, new Set(g.divisions || []))
  }
  return m
}

export function groupEntriesByDayGroup(entries: Entry[], groupMap: Map<string, Map<string, Set<string>>>) {
  const out = new Map<string, Entry[]>()
  for (const r of entries) {
    if (r.status !== 'entered') continue
    const dm = groupMap.get(r.day)
    let key = `${r.day}::__${r.div}` // default solo group
    if (dm) {
      for (const [gname, set] of dm.entries()) {
        if (set.has(r.div)) { key = `${r.day}::${gname}`; break }
      }
    }
    if (!out.has(key)) out.set(key, [])
    ;(out.get(key) as Entry[]).push(r)
  }
  return out
}

export function computeBoatClashes(
  rowsByDayGroup: Map<string, Entry[]>,
  silences: SilencedClash[],
  raceId?: string,
  dayOrder?: string[],
): BoatClash[] {
  const list: BoatClash[] = []
  for (const [key, ers] of rowsByDayGroup.entries()) {
    const [day, group] = key.split('::')
    const byBoat = new Map<string, Entry[]>()
    for (const e of ers) {
      const boat = (e.boat || '').trim()
      if (!boat) continue
      if (!byBoat.has(boat)) byBoat.set(boat, [])
      byBoat.get(boat)!.push(e)
    }
    for (const [boat, es] of byBoat.entries()) {
      if (es.length > 1) {
        const silenced = silences.some((s) => s.raceId === (raceId || s.raceId) && s.day === day && s.group === group && s.boat === boat)
        list.push({ key: `${day}::${group}::${boat}`, day, group, boat, count: es.length, silenced })
      }
    }
  }
  if (!dayOrder) return list
  const dayIdx = new Map<string, number>(dayOrder.map((d, i) => [d, i]))
  return list.sort((a, b) => {
    const ai = dayIdx.get(a.day) ?? 9999
    const bi = dayIdx.get(b.day) ?? 9999
    if (ai !== bi) return ai - bi
    if (a.group !== b.group) return a.group.localeCompare(b.group)
    return a.boat.localeCompare(b.boat)
  })
}

export function computeBladeClashes(
  rowsByDayGroup: Map<string, Entry[]>,
  blades: Blade[],
  bladeSilences: SilencedBladeClash[],
  dayOrder?: string[],
  raceId?: string,
): BladeClash[] {
  const avail = new Map<string, number>()
  for (const b of blades) {
    const name = (b.name || '').trim()
    const amt = typeof (b as any).amount === 'number' ? (b as any).amount : NaN
    if (name) avail.set(name, Number.isFinite(amt) ? amt : Infinity)
  }
  const list: BladeClash[] = []
  for (const [key, ers] of rowsByDayGroup.entries()) {
    const [day, group] = key.split('::')
    const byBlade = new Map<string, number>()
    for (const e of ers) {
      const raw = (e.blades || '').trim()
      if (!raw) continue
      const parts = raw.includes('+') ? raw.split('+').map((s) => s.trim()).filter(Boolean) : [raw]
      const type = inferPreciseBoatType(e.event || '')
      const needed = bladesRequiredFor(type)
      if (needed <= 0) continue
      const n = Math.max(1, parts.length)
      const base = Math.floor(needed / n)
      let rem = needed % n
      for (const p of parts) {
        const inc = base + (rem > 0 ? 1 : 0)
        if (rem > 0) rem -= 1
        byBlade.set(p, (byBlade.get(p) || 0) + inc)
      }
    }
    for (const [blade, used] of byBlade.entries()) {
      const amount = avail.has(blade) ? (avail.get(blade) as number) : Infinity
      if (amount !== Infinity && used > amount) {
        const silenced = bladeSilences.some((s) => s.raceId === (raceId || s.raceId) && s.day === day && s.group === group && s.blade === blade)
        list.push({ key: `${day}::${group}::${blade}`, day, group, blade, used, amount, silenced })
      }
    }
  }
  if (!dayOrder) return list
  const dayIdx = new Map<string, number>(dayOrder.map((d, i) => [d, i]))
  return list.sort((a, b) => {
    const ai = dayIdx.get(a.day) ?? 9999
    const bi = dayIdx.get(b.day) ?? 9999
    if (ai !== bi) return ai - bi
    if (a.group !== b.group) return a.group.localeCompare(b.group)
    return a.blade.localeCompare(b.blade)
  })
}

export function computeRaceClashSummary(input: {
  entries: Entry[]
  divisionGroups: DivisionGroup[]
  silences: SilencedClash[]
  bladeSilences: SilencedBladeClash[]
  blades: Blade[]
  raceId?: string
}): { hasBoatClash: boolean; hasBladeClash: boolean; hasAnyClash: boolean } {
  const groupMap = buildGroupMap(input.divisionGroups)
  const rowsByDayGroup = groupEntriesByDayGroup(input.entries, groupMap)
  if (!rowsByDayGroup.size) return { hasBoatClash: false, hasBladeClash: false, hasAnyClash: false }
  const boat = computeBoatClashes(rowsByDayGroup, input.silences, input.raceId)
  const blade = computeBladeClashes(rowsByDayGroup, input.blades, input.bladeSilences, undefined, input.raceId)
  const hasBoatClash = boat.length > 0
  const hasBladeClash = blade.length > 0
  return { hasBoatClash, hasBladeClash, hasAnyClash: hasBoatClash || hasBladeClash }
}
