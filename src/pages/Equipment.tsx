import { useParams } from 'react-router-dom'

export function Equipment() {
  const { raceId } = useParams()
  return (
    <div>
      <h1>Equipment</h1>
      <p>Race ID: {raceId}</p>
      <p>Coming soon: boats, oars, allocations.</p>
    </div>
  )
}


