export type Entry = {
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
}

export type NewEntry = Omit<Entry, 'id'>


