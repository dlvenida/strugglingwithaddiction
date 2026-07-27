import { useState } from 'react'
import { api } from '../../api'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'

export default function Lifecycle() {
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  async function run() {
    setBusy(true); setError('')
    try { setResult(await api('/api/admin/lifecycle/run', { method: 'POST' })) } catch (e) { setError(e.message) } finally { setBusy(false) }
  }
  return <div className="page-stack">
    <header className="page-header"><h1 className="page-title">Lifecycle.</h1><p className="page-sub">Run and verify automated email lifecycle tasks.</p></header>
    <Card>
      <p className="eyebrow">Daily lifecycle run</p>
      <p className="muted">Sends 24-hour incomplete-claim reminders and upcoming renewal reminders. Configure a daily authenticated job in production.</p>
      <Button type="button" onClick={run} disabled={busy}>{busy ? 'Running…' : 'Run now'}</Button>
      {error && <p className="error">{error}</p>}
      {result && <p className="success">Sent {result.claim_abandon_reminders} claim reminder(s) and {result.renewal_reminders} renewal reminder(s).</p>}
    </Card>
    <Card><p className="eyebrow">Provider settings</p><p className="muted">Email delivery (Resend / Gmail SMTP), templates, and activity logs are managed under Emails. Callback verification still uses TWILIO_* and billing uses STRIPE_* env variables.</p></Card>
  </div>
}
