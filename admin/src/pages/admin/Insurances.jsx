import { useEffect, useMemo, useState } from 'react'
import { api } from '../../api'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import './Insurances.css'

function LogoCell({ row }) {
  const [broken, setBroken] = useState(false)
  if (!row.logo_url || broken) {
    return <span className="ins-logo-fallback" aria-hidden>{row.name?.slice(0, 2) || '?'}</span>
  }
  return (
    <img
      className="ins-logo"
      src={row.logo_url}
      alt=""
      onError={() => setBroken(true)}
    />
  )
}

export default function AdminInsurances() {
  const [rows, setRows] = useState([])
  const [err, setErr] = useState('')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('all')

  async function load() {
    const data = await api('/api/admin/insurances')
    setRows(Array.isArray(data) ? data : [])
  }

  useEffect(() => {
    setLoading(true)
    load()
      .catch(e => setErr(e.message))
      .finally(() => setLoading(false))
  }, [])

  const enabledCount = useMemo(() => rows.filter(r => r.enabled).length, [rows])
  const disabledCount = rows.length - enabledCount

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return rows.filter(row => {
      if (filter === 'enabled' && !row.enabled) return false
      if (filter === 'disabled' && row.enabled) return false
      if (!q) return true
      return row.name.toLowerCase().includes(q) || row.slug.toLowerCase().includes(q)
    })
  }, [rows, query, filter])

  async function toggle(row) {
    setBusy(true)
    setErr('')
    setMsg('')
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
    setMsg('')
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

  async function seedCatalog() {
    setBusy(true)
    setErr('')
    setMsg('')
    try {
      const result = await api('/api/admin/insurances/seed', { method: 'POST' })
      await load()
      const created = result?.created ?? 0
      const total = result?.total ?? 0
      setMsg(
        created > 0
          ? `Catalog seeded — ${created} added (${total} total).`
          : `Catalog refreshed — ${total} options ready.`,
      )
    } catch (e) {
      setErr(e.message)
    } finally {
      setBusy(false)
    }
  }

  const emptyCatalog = !loading && rows.length === 0
  const emptyFilter = !loading && rows.length > 0 && visible.length === 0

  return (
    <div className="page-stack">
      <header className="page-header ins-header">
        <div>
          <h1 className="page-title">Insurance.</h1>
          <p className="page-sub">
            Enable or disable USA insurance options shown to providers and in public search.
          </p>
        </div>
        {!loading && rows.length > 0 && (
          <p className="ins-counts muted">
            <strong>{enabledCount}</strong> enabled · <strong>{disabledCount}</strong> disabled
          </p>
        )}
      </header>

      {err && <p className="error">{err}</p>}
      {msg && <p className="success">{msg}</p>}

      <div className="ins-toolbar">
        <div className="ins-toolbar-actions">
          <Button type="button" disabled={busy || loading || emptyCatalog} onClick={() => bulk(true)}>
            Enable all
          </Button>
          <Button type="button" variant="ghost" disabled={busy || loading || emptyCatalog} onClick={() => bulk(false)}>
            Disable all
          </Button>
          <Button type="button" variant="secondary" disabled={busy || loading} onClick={seedCatalog}>
            {emptyCatalog ? 'Seed catalog' : 'Refresh catalog'}
          </Button>
        </div>
        {!emptyCatalog && (
          <label className="ins-search">
            <span className="sr-only">Search insurance</span>
            <input
              type="search"
              placeholder="Search name or slug…"
              value={query}
              onChange={e => setQuery(e.target.value)}
              disabled={loading}
            />
          </label>
        )}
      </div>

      {!emptyCatalog && (
        <div className="tabs-row">
          <button
            type="button"
            className={`tab-btn${filter === 'all' ? ' active' : ''}`}
            onClick={() => setFilter('all')}
          >
            All
            <span className="tab-count">{rows.length}</span>
          </button>
          <button
            type="button"
            className={`tab-btn${filter === 'enabled' ? ' active' : ''}`}
            onClick={() => setFilter('enabled')}
          >
            Enabled
            <span className="tab-count">{enabledCount}</span>
          </button>
          <button
            type="button"
            className={`tab-btn${filter === 'disabled' ? ' active' : ''}`}
            onClick={() => setFilter('disabled')}
          >
            Disabled
            <span className="tab-count">{disabledCount}</span>
          </button>
        </div>
      )}

      <Card className="card-pad-0">
        {loading ? (
          <p className="muted ins-empty">Loading insurance catalog…</p>
        ) : emptyCatalog ? (
          <div className="ins-empty-state">
            <p className="ins-empty-title">No insurance catalog yet</p>
            <p className="muted">
              Seed the standard USA plans (Aetna, Cigna, Medicaid, and more) so providers can select them and they appear in public search.
            </p>
            <Button type="button" disabled={busy} onClick={seedCatalog}>
              {busy ? 'Seeding…' : 'Seed USA catalog'}
            </Button>
          </div>
        ) : (
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
                {visible.map(row => (
                  <tr key={row.id} className={row.enabled ? undefined : 'ins-row-off'}>
                    <td>
                      <LogoCell row={row} />
                    </td>
                    <td><strong>{row.name}</strong></td>
                    <td className="muted">{row.slug}</td>
                    <td>
                      <span className={`badge ${row.enabled ? 'badge-ok' : 'badge-warn'}`}>
                        {row.enabled ? 'Enabled' : 'Disabled'}
                      </span>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        disabled={busy}
                        onClick={() => toggle(row)}
                      >
                        {row.enabled ? 'Disable' : 'Enable'}
                      </button>
                    </td>
                  </tr>
                ))}
                {emptyFilter && (
                  <tr>
                    <td colSpan={5} className="muted" style={{ padding: 24 }}>
                      No plans match this filter.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}
