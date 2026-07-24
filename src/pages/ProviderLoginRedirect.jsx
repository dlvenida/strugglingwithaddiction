import { useEffect } from 'react'
import { providerLoginUrl } from '../lib/adminSite'

/** Same-origin hop to the provider platform so footer/directory links always resolve. */
export default function ProviderLoginRedirect() {
  useEffect(() => {
    window.location.replace(providerLoginUrl())
  }, [])

  return (
    <main style={{ minHeight: '50vh', display: 'grid', placeItems: 'center', padding: '2rem', textAlign: 'center' }}>
      <div>
        <h1 style={{ fontFamily: 'PT Serif, serif', marginBottom: '0.75rem' }}>Opening provider platform…</h1>
        <p style={{ color: '#6b7280', marginBottom: '1.25rem' }}>
          If nothing happens, open the login page directly.
        </p>
        <a className="btn" href={providerLoginUrl()}>Continue to login</a>
      </div>
    </main>
  )
}
