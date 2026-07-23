import { useEffect, useState } from 'react'
import { api, apiUpload } from '../../api'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'

function listToText(arr) {
  return (arr || []).join('\n')
}

function textToList(text) {
  return String(text || '')
    .split(/\n|,|;|\|/)
    .map(s => s.trim())
    .filter(Boolean)
}

export default function ClientMyCenter() {
  const [center, setCenter] = useState(null)
  const [form, setForm] = useState(null)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')
  const [saving, setSaving] = useState(false)
  const [uploadingGallery, setUploadingGallery] = useState(false)

  useEffect(() => {
    api('/api/client/my-center')
      .then(c => {
        setCenter(c)
        if (c) {
          setForm({
            name: c.name || '',
            description: c.description || '',
            address_line: c.address_line || '',
            city: c.city || '',
            state: c.state || '',
            zip: c.zip || '',
            phone: c.phone || '',
            website: c.website || '',
            contact_email: c.contact_email || '',
            google_maps_url: c.google_maps_url || '',
            google_reviews_url: c.google_reviews_url || '',
            video_url: c.video_url || '',
            specialties: listToText(c.specialties),
            insurances: listToText(c.insurances),
            levels_of_care: listToText(c.levels_of_care),
            amenities: listToText(c.amenities),
            accreditations: listToText(c.accreditations),
            testimonials: (c.testimonials || []).map(t => (typeof t === 'string' ? t : t?.quote || '')).join('\n'),
          })
        }
      })
      .catch(() => setCenter(null))
  }, [])

  const locked = center?.dashboard_locked

  async function save(e) {
    e.preventDefault()
    if (!form || locked) return
    setSaving(true)
    setErr('')
    setMsg('')
    try {
      const body = {
        ...form,
        specialties: textToList(form.specialties),
        insurances: textToList(form.insurances),
        levels_of_care: textToList(form.levels_of_care),
        amenities: textToList(form.amenities),
        accreditations: textToList(form.accreditations),
        testimonials: textToList(form.testimonials).map(quote => ({ quote })),
      }
      const updated = await api('/api/client/my-center', { method: 'PATCH', body: JSON.stringify(body) })
      setCenter(updated)
      setMsg('Saved — changes are live on your public listing.')
    } catch (ex) {
      setErr(ex.message)
    } finally {
      setSaving(false)
    }
  }

  async function uploadGallery(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingGallery(true)
    setErr('')
    try {
      const result = await apiUpload('/api/client/my-center/gallery', file)
      setCenter(c => ({ ...c, gallery_keys: result.gallery_keys, gallery_urls: result.gallery_urls }))
      setMsg('Gallery image uploaded.')
    } catch (ex) {
      setErr(ex.message)
    } finally {
      setUploadingGallery(false)
      e.target.value = ''
    }
  }

  async function deleteGallery(index) {
    try {
      const result = await api(`/api/client/my-center/gallery/${index}`, { method: 'DELETE' })
      setCenter(c => ({ ...c, gallery_keys: result.gallery_keys, gallery_urls: result.gallery_urls }))
    } catch (ex) {
      setErr(ex.message)
    }
  }

  if (center === null) {
    return (
      <div className="page-stack">
        <header className="page-header">
          <h1 className="page-title">Profile.</h1>
        </header>
        <p className="card card-flat muted">No center linked. Claim a listing on the public site, verify certification, then subscribe.</p>
      </div>
    )
  }

  if (!form) return <p className="muted">Loading…</p>

  const pct = center.completeness?.percent ?? 0
  const onboarding = [
    ['Write your description', Boolean(form.description?.trim())],
    ['Add services and levels of care', Boolean(form.specialties?.trim() && form.levels_of_care?.trim())],
    ['Add insurance and accreditation details', Boolean(form.insurances?.trim() && form.accreditations?.trim())],
    ['Add a video or gallery media', Boolean(form.video_url?.trim() || center.gallery_keys?.length)],
  ]

  return (
    <div className="page-stack">
      <header className="page-header">
        <h1 className="page-title">Profile.</h1>
        <p className="page-sub">Edit your listing — saves publish instantly.</p>
      </header>

      {locked && (
        <Card>
          <p><strong>Dashboard locked.</strong> Your subscription is inactive. Only billing and resubscribe remain available.</p>
          <Button type="button" onClick={() => { window.location.href = '/client/billing' }}>Go to billing</Button>
        </Card>
      )}

      <Card>
        <p className="eyebrow">PROFILE COMPLETENESS</p>
        <div style={{ marginTop: 10, height: 10, background: 'var(--border, #e5e7eb)', borderRadius: 999, overflow: 'hidden' }}>
          <div style={{ width: `${pct}%`, height: '100%', background: 'var(--accent, #0d6e6e)' }} />
        </div>
        <p className="muted" style={{ marginTop: 8 }}>{pct}% complete — aim for a publishable profile in your first session.</p>
      </Card>

      <Card>
        <p className="eyebrow">GETTING STARTED</p>
        <ul style={{ margin: '10px 0 0', paddingLeft: 18 }}>
          {onboarding.map(([label, complete]) => (
            <li key={label} className={complete ? 'muted' : ''}>
              {complete ? '✓ ' : '○ '}{label}
            </li>
          ))}
        </ul>
      </Card>

      <form className="card card-flat form-stack" onSubmit={save}>
        {[
          ['name', 'Rehab center name', 'text'],
          ['description', 'Description', 'textarea'],
          ['address_line', 'Address', 'text'],
          ['city', 'City', 'text'],
          ['state', 'State', 'text'],
          ['zip', 'ZIP', 'text'],
          ['phone', 'Phone', 'text'],
          ['website', 'Website', 'text'],
          ['contact_email', 'Contact email', 'email'],
          ['google_maps_url', 'Google Map link', 'text'],
          ['google_reviews_url', 'Google reviews link', 'text'],
          ['video_url', 'Video URL', 'text'],
        ].map(([key, label, type]) => (
          <label key={key} className="field">
            <span className="field-label">{label}</span>
            {type === 'textarea' ? (
              <textarea rows={4} disabled={locked} value={form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} />
            ) : (
              <input type={type} disabled={locked} value={form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} />
            )}
          </label>
        ))}

        {[
          ['specialties', 'Services offered (one per line)'],
          ['levels_of_care', 'Levels of care'],
          ['insurances', 'Insurances accepted'],
          ['amenities', 'Amenities'],
          ['accreditations', 'Accreditations'],
          ['testimonials', 'Testimonials (one per line)'],
        ].map(([key, label]) => (
          <label key={key} className="field">
            <span className="field-label">{label}</span>
            <textarea rows={3} disabled={locked} value={form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} />
          </label>
        ))}

        <div className="field">
          <span className="field-label">Gallery images</span>
          <input type="file" accept="image/*" disabled={locked || uploadingGallery} onChange={uploadGallery} />
          <p className="muted">Upload up to 12 images, 8MB each.</p>
          {(center.gallery_urls || []).length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 8 }}>
              {center.gallery_urls.map((url, index) => (
                <div key={url} style={{ position: 'relative' }}>
                  <img src={url} alt="" style={{ height: 86, width: 120, objectFit: 'cover', borderRadius: 6 }} />
                  {!locked && (
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => deleteGallery(index)}>
                      Remove
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {err && <p className="form-error">{err}</p>}
        {msg && <p className="muted">{msg}</p>}
        <Button type="submit" disabled={saving || locked}>{saving ? 'Saving…' : 'Save & publish'}</Button>
      </form>
    </div>
  )
}
