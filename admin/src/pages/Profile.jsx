import { useEffect, useState } from 'react'
import { api, apiUpload } from '../api'
import ImageCropUpload from '../components/ImageCropUpload'
import ChangePassword from './ChangePassword'

export default function ProfilePage() {
  const [profile, setProfile] = useState(null)
  const [form, setForm] = useState({})
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')

  useEffect(() => {
    api('/api/me/profile').then(p => {
      setProfile(p)
      setForm({
        display_name: p.display_name || '',
        slug: p.slug || '',
        title: p.title || '',
        bio: p.bio || '',
        phone: p.phone || '',
        address_line: p.address_line || '',
        city: p.city || '',
        state: p.state || '',
        country: p.country || '',
        social_links: p.social_links || {},
        notification_preferences: p.notification_preferences || {
          lead_alerts: true,
          billing_alerts: true,
          renewal_reminders: true,
          product_updates: true,
        },
      })
    })
  }, [])

  async function save(e) {
    e.preventDefault()
    setErr('')
    setMsg('')
    try {
      const updated = await api('/api/me/profile', { method: 'PATCH', body: JSON.stringify(form) })
      setProfile(updated)
      setMsg('Saved.')
    } catch (e) {
      setErr(e.message)
    }
  }

  async function onCropped(file) {
    try {
      const updated = await apiUpload('/api/me/profile/photo', file)
      setProfile(updated)
      setMsg('Photo updated.')
    } catch (e) {
      setErr(e.message)
    }
  }

  async function sendConfirmation() {
    setErr('')
    try {
      const res = await api('/api/auth/request-email-confirmation', { method: 'POST' })
      setMsg(res.message)
    } catch (e) {
      setErr(e.message)
    }
  }

  if (!profile) return <p className="muted">Loading</p>

  return (
    <div className="page-stack">
      <header className="page-header">
        <h1 className="page-title">Settings.</h1>
        <p className="page-sub">Your account.</p>
      </header>
      {msg && <p className="success">{msg}</p>}
      {err && <p className="error">{err}</p>}
      <div className="card card-flat">
        {profile.profile_photo_url && (
          <img src={profile.profile_photo_url} alt="" className="avatar-preview" />
        )}
        <p className="eyebrow">Photo</p>
        <ImageCropUpload onCropped={onCropped} />
      </div>
      <div className="card card-flat">
        <p className="eyebrow">Account email</p>
        <p>{profile.email}</p>
        <button type="button" className="btn btn-ghost btn-sm" onClick={sendConfirmation}>Send confirmation email</button>
      </div>
      <form className="card card-flat" onSubmit={save}>
        <div className="form-grid-2">
          <div>
            <label>Name</label>
            <input value={form.display_name} onChange={e => setForm(f => ({ ...f, display_name: e.target.value }))} />
          </div>
          <div>
            <label>Slug</label>
            <input value={form.slug} onChange={e => setForm(f => ({ ...f, slug: e.target.value }))} />
          </div>
        </div>
        <label>Title</label>
        <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
        <label>Bio</label>
        <textarea rows={3} value={form.bio} onChange={e => setForm(f => ({ ...f, bio: e.target.value }))} />
        <label>Phone</label>
        <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
        <p className="eyebrow" style={{ marginTop: 'var(--space-2)' }}>Social</p>
        {['website', 'twitter', 'linkedin'].map(key => (
          <div key={key}>
            <label>{key}</label>
            <input
              value={form.social_links?.[key] || ''}
              onChange={e => setForm(f => ({
                ...f,
                social_links: { ...f.social_links, [key]: e.target.value },
              }))}
            />
          </div>
        ))}
        <p className="eyebrow" style={{ marginTop: 'var(--space-2)' }}>Notifications</p>
        {[
          ['lead_alerts', 'New lead alerts'],
          ['billing_alerts', 'Billing, dunning, and cancellation alerts'],
          ['renewal_reminders', 'Renewal reminders'],
          ['product_updates', 'Directory product updates'],
        ].map(([key, label]) => (
          <label key={key} style={{ display: 'block', marginTop: 8 }}>
            <input
              type="checkbox"
              checked={form.notification_preferences?.[key] !== false}
              onChange={e => setForm(f => ({
                ...f,
                notification_preferences: { ...f.notification_preferences, [key]: e.target.checked },
              }))}
            />{' '}
            {label}
          </label>
        ))}
        <div className="form-actions">
          <button type="submit" className="btn btn-primary">Save</button>
        </div>
      </form>
      <ChangePassword />
    </div>
  )
}
