export type AuditTrail = {
  // Stored as Firestore timestamp; not read by UI today.
  createdAt?: unknown
  createdByCoachId?: string | null
  createdByCoachName?: string | null
  createdByUid?: string | null
  // Stored as Firestore timestamp; not read by UI today.
  updatedAt?: unknown
  updatedByCoachId?: string | null
  updatedByCoachName?: string | null
  updatedByUid?: string | null
}

export type Race = AuditTrail & {
  id: string
  name: string
  details: string
  startDate: Date
  endDate?: Date | null
  broeOpens: Date
  broeCloses: Date
  drawReleased?: boolean
  archived?: boolean
}

export type NewRace = Omit<Race, 'id'>

export type Entry = AuditTrail & {
  id: string
  raceId: string
  day: string
  div: string
  event: string
  athleteNames: string
  boat: string
  blades: string
  notes: string
  status: 'in_progress' | 'ready' | 'entered' | 'withdrawn' | 'rejected'
  crewChanged: boolean
  crewNumber?: number | null
  raceTimes?: { round: string; timeMs: number }[]
  result?: 'OK' | 'DNS' | 'DNF' | 'DQ'
  charged?: boolean
  chargedAt?: Date | null
  chargedBy?: string
}

export type NewEntry = Omit<Entry, 'id'>

export type Boat = AuditTrail & {
  id: string
  name: string
  type: string
  active?: boolean
  weight?: number
}

export type Blade = AuditTrail & {
  id: string
  name: string
  active?: boolean
  amount?: number
  lengthCode?: '1' | '2' | '3' | '4' | '5' | 'NA'
  bladeLength?: number | null
  inboard?: number | null
  span?: number | null
}

export type DivisionGroup = AuditTrail & {
  id: string
  raceId: string
  day: string
  group: string
  divisions: string[]
}

export type GearingMatrix = Record<string, Record<string, string>>
export type Gearing = AuditTrail & { id: string; values: GearingMatrix }

export type SilencedClash = AuditTrail & {
  id: string
  raceId: string
  day: string
  group: string
  boat: string
}

export type SilencedBladeClash = AuditTrail & {
  id: string
  raceId: string
  day: string
  group: string
  blade: string
}
