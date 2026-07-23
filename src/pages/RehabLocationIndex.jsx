import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { apiEnabled, fetchApi } from '../lib/api'

export default function RehabLocationIndex() {
  const { state, city } = useParams()
  const [centers, setCenters] = useState([])
  const place = city ? `${city}, ${state}` : state
  useEffect(() => {
    if (!apiEnabled()) return
    const query = new URLSearchParams({ state, ...(city ? { city } : {}) })
    fetchApi(`/api/rehab-centers?${query}`).then(setCenters).catch(() => setCenters([]))
  }, [state, city])
  return <main className="container" style={{ maxWidth: 960, padding: '3rem 1rem' }}>
    <p><Link to="/rehab-centers">All rehab centers</Link></p>
    <h1>Rehab centers in {place}</h1>
    <p>Explore treatment facilities listed in our directory. Providers can claim their listing to keep information current.</p>
    {centers.length === 0 ? <p>No published centers found for this location.</p> : <ul>
      {centers.map(center => <li key={center.id} style={{ margin: '1rem 0' }}>
        <Link to={`/rehab-centers/${center.slug}`}><strong>{center.name}</strong></Link><br />{center.location}
      </li>)}
    </ul>}
  </main>
}
