import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { apiEnabled, fetchApi } from '../lib/api'

export default function RehabCenterDetail() {
  const { slug } = useParams()
  const [center, setCenter] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!apiEnabled()) return
    fetchApi(`/api/rehab-centers/${encodeURIComponent(slug)}`).then(setCenter).catch(e => setError(e.message))
  }, [slug])

  if (error) return <main className="container" style={{ padding: '4rem 1rem' }}><h1>Listing not found</h1><Link to="/rehab-centers">Browse centers</Link></main>
  if (!center) return <main className="container" style={{ padding: '4rem 1rem' }}>Loading listing…</main>
  return (
    <main className="container" style={{ maxWidth: 960, padding: '3rem 1rem' }}>
      <Link to="/rehab-centers">← All rehab centers</Link>
      <h1 style={{ marginTop: 20 }}>{center.name} {center.verified_badge && <small>✓ Verified</small>}</h1>
      <p>{center.location}</p>
      {center.image && <img src={center.image} alt={center.name} style={{ width: '100%', maxHeight: 380, objectFit: 'cover', borderRadius: 10 }} />}
      <p style={{ marginTop: 20 }}>{center.description}</p>
      {center.claimed ? (
        <section>
          <h2>Contact and services</h2>
          {center.phone && <p><a href={`tel:${center.phone}`}>{center.phone}</a></p>}
          {center.website && <p><a href={center.website} target="_blank" rel="noreferrer">Visit website</a></p>}
          {['Specialties', 'Levels of care', 'Insurances', 'Amenities', 'Accreditations'].map((label, i) => {
            const values = [center.specialties, center.levels_of_care, center.insurances, center.amenities, center.accreditations][i]
            return values?.length ? <p key={label}><strong>{label}:</strong> {values.join(', ')}</p> : null
          })}
          {center.gallery_urls?.length > 0 && <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>{center.gallery_urls.map(url => <img key={url} src={url} alt="" style={{ width: 180, height: 120, objectFit: 'cover', borderRadius: 6 }} />)}</div>}
          {center.video_url && <p><a href={center.video_url} target="_blank" rel="noreferrer">Watch facility video</a></p>}
        </section>
      ) : (
        <section style={{ padding: 20, marginTop: 20, background: '#eef8f8', borderRadius: 8 }}>
          <strong>Is this your facility?</strong><p>Claim this listing to confirm your ownership and manage this profile.</p>
          <Link className="btn" to="/rehab-centers">Claim this listing</Link>
        </section>
      )}
    </main>
  )
}
