import { useParams } from 'react-router-dom'

export function Race() {
  const { raceId } = useParams()
  return (
    <div>
      <h1>Race Overview</h1>
      <p>Race ID: {raceId}</p>
      <p>Coming soon: details, schedule, etc.</p>
    </div>
  )
}


