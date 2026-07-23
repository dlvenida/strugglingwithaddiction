import { useEffect, useState } from 'react'
import { api, getApiBase } from '../../api'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'

export default function ClientLeads() {
  const [leads, setLeads] = useState([])
  const [err, setErr] = useState('')
  const [replyingTo, setReplyingTo] = useState(null)
  const [reply, setReply] = useState('')

  const load = () => api('/api/client/leads').then(setLeads).catch(e => setErr(e.message))

  useEffect(() => { load() }, [])

  async function markRead(id) {
    await api(`/api/client/leads/${id}/read`, { method: 'PATCH' })
    load()
  }

  async function sendReply(id) {
    try {
      await api(`/api/client/leads/${id}/reply`, { method: 'POST', body: JSON.stringify({ message: reply }) })
      setReplyingTo(null)
      setReply('')
      load()
    } catch (e) {
      setErr(e.message)
    }
  }

  async function exportLeads() {
    try {
      const token = localStorage.getItem('access_token')
      const res = await fetch(`${getApiBase()}/api/client/leads/export`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      if (!res.ok) throw new Error('Could not export leads')
      const url = URL.createObjectURL(await res.blob())
      const link = document.createElement('a')
      link.href = url
      link.download = 'center-leads.csv'
      link.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      setErr(e.message)
    }
  }

  return (
    <div className="page-stack">
      <header className="page-header">
        <h1 className="page-title">Leads.</h1>
        <p className="page-sub">Private visitor inquiries for your center only.</p>
        <Button type="button" className="btn btn-ghost btn-sm" onClick={exportLeads}>Export CSV</Button>
      </header>
      {err && <p className="form-error">{err}</p>}
      {leads.length === 0 ? (
        <Card><p className="muted">No inquiries yet.</p></Card>
      ) : (
        <div className="card card-pad-0 table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Message</th>
                <th>Received</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {leads.map(l => (
                <>
                  <tr key={l.id} style={{ opacity: l.read_at ? 0.65 : 1 }}>
                    <td><strong>{l.full_name}</strong></td>
                    <td>{l.email}</td>
                    <td>{l.phone || '—'}</td>
                    <td>{l.message || '—'}</td>
                    <td>{l.created_at ? new Date(l.created_at).toLocaleString() : '—'}</td>
                    <td>
                      {!l.read_at && (
                        <Button type="button" className="btn btn-ghost btn-sm" onClick={() => markRead(l.id)}>Mark read</Button>
                      )}
                      <Button type="button" className="btn btn-ghost btn-sm" onClick={() => { setReplyingTo(l.id); setReply('') }}>Reply</Button>
                    </td>
                  </tr>
                  {replyingTo === l.id && (
                    <tr key={`${l.id}-reply`}>
                      <td colSpan={6}>
                        <textarea rows={3} value={reply} onChange={e => setReply(e.target.value)} placeholder={`Reply to ${l.full_name}`} />
                        <div className="form-actions form-actions-tight">
                          <Button type="button" disabled={!reply.trim()} onClick={() => sendReply(l.id)}>Send reply</Button>
                          <Button type="button" variant="ghost" onClick={() => setReplyingTo(null)}>Cancel</Button>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
