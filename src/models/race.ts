export type Race = {
  id: string
  name: string
  details: string
  startDate: Date
  endDate?: Date | null
  broeOpens: Date
  broeCloses: Date
}

export type NewRace = Omit<Race, 'id'>


