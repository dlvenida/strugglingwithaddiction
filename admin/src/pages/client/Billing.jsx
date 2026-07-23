import { useEffect, useState } from 'react'
import { api } from '../../api'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import ChangePassword from '../ChangePassword'

export default function ClientBilling() {
  const [sub, setSub] = useState(null)
  const [err, setErr] = useState('')

  useEffect(() => {
    api('/api/billing/subscription').then(setSub).catch(e => setErr(e.message))
  }, [])

  async function checkout(plan) {
    setErr('')
    try {
      const { checkout_url } = await api('/api/billing/checkout', {
        method: 'POST',
        body: JSON.stringify({ interval: plan }),
      })
      window.location.href = checkout_url
    } catch (e) {
      setErr(e.message)
    }
  }

  async function portal() {
    const { portal_url } = await api('/api/billing/portal', { method: 'POST' })
    window.location.href = portal_url
  }

  const active = ['active', 'trialing', 'past_due'].includes(sub?.status)

  return (
    <div className="page-stack">
      <header className="page-header">
        <h1 className="page-title">Billing.</h1>
        <p className="page-sub">Status: {sub?.status || 'inactive'}</p>
      </header>

      {!active && (
        <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
          <Card>
            <p className="eyebrow">MONTHLY</p>
            <p style={{ fontSize: '1.75rem', fontWeight: 700, margin: '8px 0' }}>$9.99<span style={{ fontSize: '1rem' }}>/mo</span></p>
            <p className="muted">Flexible, month-to-month billing.</p>
            <Button type="button" style={{ marginTop: 12 }} onClick={() => checkout('month')}>
              Choose monthly
            </Button>
          </Card>
          <Card>
            <p className="eyebrow">ANNUAL — PUSH THIS TIER</p>
            <p style={{ fontSize: '1.75rem', fontWeight: 700, margin: '8px 0' }}>$99<span style={{ fontSize: '1rem' }}>/yr</span></p>
            <p className="muted">= 2 months free. Locks in a year of upsell touchpoints.</p>
            <Button type="button" style={{ marginTop: 12 }} onClick={() => checkout('year')}>
              Choose annual
            </Button>
          </Card>
        </div>
      )}

      {active && (
        <Card>
          <p>Plan: {sub?.plan_name || 'Base listing'} · {sub?.interval || '—'}</p>
          {sub?.status === 'past_due' && (
            <p className="form-error" style={{ marginTop: 8 }}>
              Your latest payment needs attention. Update your card before Stripe’s retries are exhausted.
            </p>
          )}
          {sub?.current_period_end && (
            <p className="muted">Current period ends {new Date(sub.current_period_end).toLocaleDateString()}</p>
          )}
          <p className="muted" style={{ marginTop: 8 }}>Cancel or update card via the Stripe customer portal. Access continues through the paid period.</p>
          <div className="form-actions" style={{ marginTop: 12 }}>
            <Button type="button" onClick={portal}>Manage billing</Button>
          </div>
        </Card>
      )}

      {err && <p className="form-error">{err}</p>}
      <ChangePassword />
    </div>
  )
}
