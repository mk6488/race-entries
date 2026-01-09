import { useMatches } from 'react-router-dom'

export function useRaceId() {
  const matches = useMatches()
  const lastMatch = matches[matches.length - 1]
  const params = lastMatch?.params as { raceId?: string } | undefined

  return params?.raceId
}
