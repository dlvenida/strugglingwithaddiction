import { useState } from 'react'
import { api, apiUpload, getApiBase } from '../../api'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'

const COLUMN_HELP = [
  { key: 'samhsa_id', tip: 'Stable external id — preferred upsert key' },
  { key: 'name', tip: 'Required' },
  { key: 'address_line / city / state / zip', tip: 'Basic location shown on unclaimed listings' },
  { key: 'phone / website / outreach_email / contact_email', tip: 'Contact + outreach invite target' },
  { key: 'specialties | levels_of_care | insurances | amenities | accreditations', tip: 'Pipe or semicolon separated lists' },
  { key: 'google_maps_url / google_reviews_url / rating', tip: 'Optional enrichment' },
]

export default function AdminImport() {
  const [file, setFile] = useState(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [summary, setSummary] = useState(null)
  const [outreach, setOutreach] = useState(null)

  async function downloadTemplate() {
    setErr('')
    try {
      const token = localStorage.getItem('access_token')
      const base = getApiBase()
      const res = await fetch(`${base}/api/admin/import/template`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      if (!res.ok) throw new Error('Could not download template')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'samhsa-listing-import-template.csv'
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      setErr(e.message)
    }
  }

  async function onSubmit(e) {
    e.preventDefault()
    if (!file) {
      setErr('Choose a CSV file first.')
      return
    }
    setBusy(true)
    setErr('')
    setSummary(null)
    try {
      const data = await apiUpload('/api/admin/import/centers', file)
      setSummary(data)
      setFile(null)
    } catch (ex) {
      setErr(ex.message)
    } finally {
      setBusy(false)
    }
  }

  async function sendOutreach() {
    setBusy(true)
    setErr('')
    setOutreach(null)
    try {
      const data = await api('/api/admin/import/outreach', { method: 'POST' })
      setOutreach(data)
    } catch (ex) {
      setErr(ex.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="page-stack">
      <header className="page-header">
        <h1 className="page-title">Import.</h1>
        <p className="page-sub">Seed the directory from a SAMHSA-style CSV. Listings publish as unclaimed with a claim CTA.</p>
      </header>

      <Card>
        <p className="eyebrow">1. DOWNLOAD TEMPLATE</p>
        <p className="muted" style={{ marginTop: 8, marginBottom: 16 }}>
          Use this exact header row. Keep one facility per line. List fields accept <code>|</code> or <code>;</code> separators.
        </p>
        <Button type="button" onClick={downloadTemplate}>Download CSV template</Button>
        <ul className="muted" style={{ marginTop: 16, paddingLeft: 18, lineHeight: 1.6 }}>
          {COLUMN_HELP.map(c => (
            <li key={c.key}><strong>{c.key}</strong> — {c.tip}</li>
          ))}
        </ul>
      </Card>

      <Card>
        <p className="eyebrow">2. UPLOAD CSV</p>
        <form onSubmit={onSubmit} className="form-stack" style={{ marginTop: 12 }}>
          <label className="field">
            <span className="field-label">CSV file</span>
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={e => setFile(e.target.files?.[0] || null)}
            />
          </label>
          {file && <p className="muted">Selected: {file.name}</p>}
          {err && <p className="form-error">{err}</p>}
          <Button type="submit" disabled={busy || !file}>
            {busy ? 'Importing…' : 'Import listings'}
          </Button>
        </form>
      </Card>

      {summary && (
        <Card>
          <p className="eyebrow">IMPORT RESULT</p>
          <p style={{ marginTop: 8 }}>
            <strong>{summary.created}</strong> created · <strong>{summary.updated}</strong> updated ·{' '}
            <strong>{summary.skipped}</strong> skipped · <strong>{summary.total_rows}</strong> rows read
          </p>
          {summary.errors?.length > 0 && (
            <ul className="muted" style={{ marginTop: 12, paddingLeft: 18 }}>
              {summary.errors.map((line, i) => <li key={i}>{line}</li>)}
            </ul>
          )}
        </Card>
      )}

      <Card>
        <p className="eyebrow">3. OUTREACH INVITES</p>
        <p className="muted" style={{ marginTop: 8, marginBottom: 12 }}>
          Sends “Your center is listed — claim it” to unclaimed centers that have <code>outreach_email</code> in the CSV.
          Requires Resend or SMTP configured; otherwise emails are logged server-side.
        </p>
        <Button type="button" disabled={busy} onClick={sendOutreach}>
          {busy ? 'Sending…' : 'Send outreach emails'}
        </Button>
        {outreach && (
          <p className="muted" style={{ marginTop: 12 }}>
            Sent {outreach.sent} · skipped {outreach.skipped}
            {outreach.errors?.length ? ` · ${outreach.errors.length} errors` : ''}
          </p>
        )}
      </Card>
    </div>
  )
}
