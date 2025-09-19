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
  withdrawn: boolean
  rejected: boolean
}

export type NewEntry = Omit<Entry, 'id'>


