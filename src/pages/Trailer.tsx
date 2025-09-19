import { useParams } from 'react-router-dom'

export function Trailer() {
  const { raceId } = useParams()
  return (
    <div>
      <h1>Trailer</h1>
      <p>Race ID: {raceId}</p>
      <p>Coming soon: trailer loads and logistics.</p>
    </div>
  )
}


