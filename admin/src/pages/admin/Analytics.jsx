import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../api'
import Eyebrow from '../../components/ui/Eyebrow'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import './Analytics.css'

const RANGE_OPTIONS = [
  ['1h', '1 hour'],
  ['12h', '12 hours'],
  ['today', 'Today'],
  ['week', 'Week'],
  ['month', 'Month'],
  ['year', 'Year'],
  ['custom', 'Date range'],
]

function StatCard({ label, value, hint }) {
  return (
    <div className="aa-stat">
      <p className="aa-stat-label">{label}</p>
      <p className="aa-stat-value">{value}</p>
      {hint && <p className="aa-stat-hint">{hint}</p>}
    </div>
  )
}

function RankList({ empty, rows }) {
  if (!rows?.length) return <p className="muted">{empty}</p>
  return (
    <ul className="aa-rank-list">
      {rows.map(row => (
        <li key={row.key}>
          <span className="aa-rank-main">
            <strong className="aa-rank-title">{row.title}</strong>
            {row.sub && <span className="aa-rank-sub">{row.sub}</span>}
          </span>
          <strong className="aa-rank-value">{row.value}</strong>
        </li>
      ))}
    </ul>
  )
}

export default function AdminAnalytics() {
  const [range, setRange] = useState('today')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')

  useEffect(() => {
    const params = new URLSearchParams()
    if (range === 'custom') {
      if (!dateFrom || !dateTo) return
      params.set('date_from', new Date(dateFrom).toISOString())
      params.set('date_to', new Date(`${dateTo}T23:59:59`).toISOString())
    } else {
      params.set('range', range)
    }
    setLoading(true)
    setErr('')
    api(`/api/admin/analytics?${params}`)
      .then(setData)
      .catch(e => setErr(e.message))
      .finally(() => setLoading(false))
  }, [range, dateFrom, dateTo])

  const maxBar = Math.max(1, ...(data?.series || []).map(s => Math.max(s.views, s.leads)))

  return (
    <div className="page-stack aa-page">
      <section className="page-header-block">
        <Eyebrow>Platform</Eyebrow>
        <h1 className="hero-title">Analytics</h1>
        <p className="hero-lead">
          Site visits, top landing pages, top rehab profiles, and lead leaders across the directory.
        </p>
      </section>

      <div className="aa-range-row">
        <div className="tabs-row aa-range-tabs">
          {RANGE_OPTIONS.map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={`tab-btn${range === id ? ' active' : ''}`}
              onClick={() => setRange(id)}
            >
              {label}
            </button>
          ))}
        </div>
        {range === 'custom' && (
          <div className="aa-date-range">
            <label>
              From
              <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
            </label>
            <label>
              To
              <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} />
            </label>
          </div>
        )}
      </div>

      {err && <p className="form-error">{err}</p>}
      {loading && <p className="muted">Loading analytics…</p>}

      {!loading && data && (
        <>
          <div className="aa-stat-grid">
            <StatCard
              label="Site visits"
              value={data.summary.site_visits}
              hint={`${data.summary.unique_sessions} unique sessions`}
            />
            <StatCard
              label="Profile visits"
              value={data.summary.profile_visits}
              hint="Rehab listing pages"
            />
            <StatCard
              label="Leads"
              value={data.summary.leads}
              hint={`${data.summary.unread_leads} unread`}
            />
            <StatCard
              label="Conversion"
              value={`${data.summary.conversion_rate}%`}
              hint="Leads ÷ profile visits"
            />
          </div>

          <div className="aa-grid">
            <Card>
              <p className="eyebrow">Visits & leads over time</p>
              <div className="aa-bars">
                {(data.series || []).length === 0 && <p className="muted">No activity in this range yet.</p>}
                {(data.series || []).map(row => (
                  <div key={row.label} className="aa-bar-row">
                    <span className="aa-bar-label">{row.label}</span>
                    <div className="aa-bar-tracks">
                      <div className="aa-bar aa-bar-views" style={{ width: `${(row.views / maxBar) * 100}%` }} title={`${row.views} visits`} />
                      <div className="aa-bar aa-bar-leads" style={{ width: `${(row.leads / maxBar) * 100}%` }} title={`${row.leads} leads`} />
                    </div>
                    <span className="aa-bar-nums">{row.views} / {row.leads}</span>
                  </div>
                ))}
              </div>
              <p className="muted aa-legend">
                <span className="aa-dot views" /> Site visits
                <span className="aa-dot leads" /> Leads
              </p>
            </Card>

            <Card>
              <p className="eyebrow">Top landing pages</p>
              <RankList
                empty="No landing page visits yet. Browse the public site to start collecting data."
                rows={(data.top_landing_pages || []).map(row => ({
                  key: row.path,
                  title: row.title || row.path,
                  sub: row.title ? row.path : null,
                  value: `${row.views} visits`,
                }))}
              />
            </Card>

            <Card>
              <p className="eyebrow">Top profile visits</p>
              <RankList
                empty="No rehab profile visits in this range."
                rows={(data.top_profiles || []).map(row => ({
                  key: String(row.center_id),
                  title: row.name,
                  sub: [row.city, row.state].filter(Boolean).join(', ') || row.slug,
                  value: `${row.views} visits`,
                }))}
              />
            </Card>

            <Card>
              <p className="eyebrow">Top leads by center</p>
              <RankList
                empty="No leads in this range."
                rows={(data.top_leads || []).map(row => ({
                  key: String(row.center_id),
                  title: row.name,
                  sub: row.unread ? `${row.unread} unread` : null,
                  value: `${row.leads} leads`,
                }))}
              />
              <Button variant="ghost" size="sm" as={Link} to="/admin/leads" style={{ marginTop: 12 }}>
                Open leads
              </Button>
            </Card>

            <Card>
              <p className="eyebrow">Visitor states</p>
              <RankList
                empty="No state data yet."
                rows={(data.by_state || []).map(row => ({
                  key: row.state,
                  title: row.state,
                  value: `${row.views} visits`,
                }))}
              />
            </Card>

            <Card>
              <p className="eyebrow">Devices</p>
              <RankList
                empty="No device data yet."
                rows={(data.by_device || []).map(row => ({
                  key: row.device,
                  title: row.device.charAt(0).toUpperCase() + row.device.slice(1),
                  value: String(row.views),
                }))}
              />
            </Card>

            <Card className="aa-span-2">
              <p className="eyebrow">Recent leads</p>
              <RankList
                empty="No leads in this range."
                rows={(data.recent_leads || []).map(lead => ({
                  key: String(lead.id),
                  title: lead.full_name,
                  sub: lead.center_name || lead.email,
                  value: lead.read_at ? 'Read' : 'New',
                }))}
              />
            </Card>
          </div>
        </>
      )}
    </div>
  )
}
