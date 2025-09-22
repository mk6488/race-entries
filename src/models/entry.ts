export type Entry = {
  id: string
  raceId: string
  day: string
  div: string
  event: string
  athleteNames: string
  boat: string
  blades: string
  raceNumber: string
  raceTimes: string[]
  notes: string
  status: 'in_progress' | 'ready' | 'entered' | 'withdrawn' | 'rejected'
  crewChanged: boolean
}

export type NewEntry = Omit<Entry, 'id'>


