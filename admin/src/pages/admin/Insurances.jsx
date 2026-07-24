import { useEffect, useState } from 'react'
import { api } from '../../api'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'

export default function AdminInsurances() {
  const [rows, setRows] = useState([])
  const [err, setErr] = useState('')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)

  async function load() {
    const data = await api('/api/admin/insurances')
    setRows(data)
  }

  useEffect(() => {
    load().catch(e => setErr(e.message))
  }, [])

  async function toggle(row) {
    setBusy(true)
    setErr('')
    try {
      const updated = await api(`/api/admin/insurances/${row.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ enabled: !row.enabled }),
      })
      setRows(list => list.map(r => (r.id === row.id ? updated : r)))
      setMsg(`${updated.name} ${updated.enabled ? 'enabled' : 'disabled'}.`)
    } catch (e) {
      setErr(e.message)
    } finally {
      setBusy(false)
    }
  }

  async function bulk(enabled) {
    setBusy(true)
    setErr('')
    try {
      await api('/api/admin/insurances/bulk', {
        method: 'POST',
        body: JSON.stringify({ enabled }),
      })
      await load()
      setMsg(enabled ? 'All insurance options enabled.' : 'All insurance options disabled.')
    } catch (e) {
      setErr(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="page-stack">
      <header className="page-header">
        <h1 className="page-title">Insurance.</h1>
        <p className="page-sub">Enable or disable USA insurance options shown to providers and in public search.</p>
      </header>

      {err && <p className="error">{err}</p>}
      {msg && <p className="success">{msg}</p>}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Button type="button" disabled={busy} onClick={() => bulk(true)}>Enable all</Button>
        <Button type="button" variant="ghost" disabled={busy} onClick={() => bulk(false)}>Disable all</Button>
      </div>

      <Card className="card-pad-0">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Logo</th>
                <th>Name</th>
                <th>Slug</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map(row => (
                <tr key={row.id}>
                  <td>
                    <img src={row.logo_url} alt="" style={{ height: 36, width: 96, objectFit: 'contain', background: '#fff', borderRadius: 6 }} />
                  </td>
                  <td>{row.name}</td>
                  <td className="muted">{row.slug}</td>
                  <td>
                    <span className={`badge ${row.enabled ? 'badge-ok' : 'badge-warn'}`}>
                      {row.enabled ? 'Enabled' : 'Disabled'}
                    </span>
                  </td>
                  <td>
                    <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => toggle(row)}>
                      {row.enabled ? 'Disable' : 'Enable'}
                    </button>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="muted">No insurance catalog yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
