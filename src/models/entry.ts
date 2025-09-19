export type Entry = {
  id: string
  raceId: string
  day: string
  div: string
  event: string
  athleteNames: string
  boat: string
  blades: string
  ready: boolean
  change: boolean
  notes: string
  entered: boolean
  paid: boolean
  charged: boolean
  withdrawn: boolean
  rejected: boolean
}

export type NewEntry = Omit<Entry, 'id'>


