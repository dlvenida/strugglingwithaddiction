import { useEffect } from 'react'
import { superadminLoginUrl } from '../lib/adminSite'

/** Same-origin hop to the superadmin login on the admin SPA. */
export default function SuperadminLoginRedirect() {
  useEffect(() => {
    window.location.replace(superadminLoginUrl())
  }, [])

  return (
    <main style={{ minHeight: '50vh', display: 'grid', placeItems: 'center', padding: '2rem', textAlign: 'center' }}>
      <div>
        <h1 style={{ fontFamily: 'PT Serif, serif', marginBottom: '0.75rem' }}>Opening admin sign in…</h1>
        <p style={{ color: '#6b7280', marginBottom: '1.25rem' }}>
          If nothing happens, open the login page directly.
        </p>
        <a className="btn" href={superadminLoginUrl()}>Continue to admin login</a>
      </div>
    </main>
  )
}
