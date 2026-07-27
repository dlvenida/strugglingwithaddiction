import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { FaMapMarkerAlt, FaPhone, FaGlobe, FaStar, FaCheckCircle } from 'react-icons/fa'
import { apiEnabled, fetchApi } from '../lib/api'
import { analyticsSessionKey, detectDevice, guessVisitorState } from '../lib/analytics'
import { STATIC_CENTERS } from './RehabCenters'
import { rehabLandingPath } from '../lib/rehabLanding'
import ReviewsCarousel from '../components/ReviewsCarousel'
import './RehabCenterDetail.css'

function Stars({ rating = 5 }) {
  const value = Math.round(Number(rating) || 0)
  return (
    <span className="rpd-stars" aria-label={`${value} out of 5 stars`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <FaStar key={i} className={i < value ? 'is-on' : ''} />
      ))}
    </span>
  )
}

function mapsEmbedUrl(mapsUrl, address) {
  if (mapsUrl && /\/embed/.test(mapsUrl)) return mapsUrl
  const query = address || mapsUrl || ''
  if (!query) return null
  return `https://maps.google.com/maps?q=${encodeURIComponent(query)}&z=14&output=embed`
}

function InquiryForm({ center }) {
  const [submitted, setSubmitted] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({ full_name: '', email: '', phone: '', message: '' })

  async function onSubmit(e) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      if (apiEnabled()) {
        const slug = center.slug || center.id
        await fetchApi(`/api/rehab-centers/${slug}/leads`, {
          method: 'POST',
          body: JSON.stringify({ ...form, source_url: window.location.href }),
        })
      }
      setSubmitted(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  if (submitted) {
    return (
      <div className="rpd-form-success">
        <FaCheckCircle aria-hidden="true" />
        <h3>Inquiry sent</h3>
        <p>Thanks — {center.name} will follow up soon.</p>
      </div>
    )
  }

  return (
    <form className="rpd-form" onSubmit={onSubmit}>
      <p className="rpd-form-eyebrow">Ask about treatment</p>
      <h2>Send a private inquiry</h2>
      <p className="rpd-form-copy">Four quick fields. The center replies privately to this listing.</p>
      {error && <p className="rpd-form-error">{error}</p>}
      <label>
        Full name
        <input required value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} />
      </label>
      <label>
        Email
        <input type="email" required value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
      </label>
      <label>
        Phone
        <input type="tel" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
      </label>
      <label>
        Message
        <textarea rows={4} required value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))} placeholder="What kind of help are you looking for?" />
      </label>
      <button type="submit" className="btn rpd-form-submit" disabled={busy}>
        {busy ? 'Sending…' : 'Send inquiry'}
      </button>
      {center.phone && (
        <a className="rpd-form-call" href={`tel:${center.phone.replace(/\D/g, '')}`}>
          <FaPhone aria-hidden="true" /> Call {center.phone}
        </a>
      )}
    </form>
  )
}

function ChipList({ items }) {
  if (!items?.length) return null
  return (
    <ul className="rpd-chips">
      {items.map(item => <li key={item}>{item}</li>)}
    </ul>
  )
}

function InsuranceList({ details, names }) {
  const items = (details?.length ? details : (names || []).map(name => ({ name, logo_url: null })))
  if (!items.length) return null
  return (
    <ul className="rpd-insurance-logos">
      {items.map(item => (
        <li key={item.slug || item.name}>
          {item.logo_url ? (
            <img src={item.logo_url} alt={item.name} loading="lazy" />
          ) : (
            <span className="rpd-insurance-fallback">{item.name}</span>
          )}
          <span className="rpd-insurance-name">{item.name}</span>
        </li>
      ))}
    </ul>
  )
}

export default function RehabCenterDetail() {
  const { state, city, facility } = useParams()
  const [center, setCenter] = useState(null)
  const [error, setError] = useState('')
  const [activeSection, setActiveSection] = useState('about')

  useEffect(() => {
    const path = `/rehabs/united-states/${state}/${city}/${facility}`
    const fromStatic = () => STATIC_CENTERS.find(item => rehabLandingPath(item) === path && item.claimed)
    let cancelled = false

    if (!apiEnabled()) {
      const staticCenter = fromStatic()
      if (staticCenter) setCenter(staticCenter)
      else setError('Listing not found')
      return
    }

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 2500)

    fetchApi(`/api/rehab-centers/landing/${encodeURIComponent(state)}/${encodeURIComponent(city)}/${encodeURIComponent(facility)}`, {
      signal: controller.signal,
    })
      .then(data => {
        if (!cancelled) setCenter(data)
      })
      .catch(e => {
        if (cancelled) return
        const staticCenter = fromStatic()
        if (staticCenter) setCenter(staticCenter)
        else setError(e.name === 'AbortError' ? 'Listing not found' : e.message)
      })
      .finally(() => clearTimeout(timeout))

    return () => {
      cancelled = true
      clearTimeout(timeout)
      controller.abort()
    }
  }, [state, city, facility])

  useEffect(() => {
    if (!center?.slug || !apiEnabled()) return
    const trackedKey = `swa_viewed_${center.slug}`
    if (sessionStorage.getItem(trackedKey)) return
    sessionStorage.setItem(trackedKey, '1')
    fetchApi(`/api/rehab-centers/${encodeURIComponent(center.slug)}/views`, {
      method: 'POST',
      body: JSON.stringify({
        path: window.location.pathname,
        referrer: document.referrer || null,
        visitor_state: guessVisitorState(),
        device_type: detectDevice(),
        session_key: analyticsSessionKey(),
      }),
    }).catch(() => {})
  }, [center?.slug])

  useEffect(() => {
    if (!center) return
    const sections = ['about', 'care', 'insurance', 'accreditations', 'reviews', 'location']
      .map(id => document.getElementById(id))
      .filter(Boolean)
    if (!sections.length) return
    const observer = new IntersectionObserver(
      entries => {
        const visible = entries.filter(entry => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0]
        if (visible?.target?.id) setActiveSection(visible.target.id)
      },
      { rootMargin: '-20% 0px -55% 0px', threshold: [0.15, 0.4] },
    )
    sections.forEach(section => observer.observe(section))
    return () => observer.disconnect()
  }, [center])

  useEffect(() => {
    if (!center) return
    const form = document.getElementById('inquiry')
    const bar = document.querySelector('.rpd-mobile-bar')
    if (!form || !bar) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        bar.classList.toggle('is-hidden', entry.isIntersecting)
      },
      { threshold: 0.15 },
    )
    observer.observe(form)
    return () => observer.disconnect()
  }, [center])

  if (error) {
    return (
      <main className="rpd-page">
        <div className="container rpd-empty">
          <h1>Listing not found</h1>
          <p>This claimed landing page is unavailable or no longer active.</p>
          <Link className="btn" to="/rehab-centers">Browse centers</Link>
        </div>
      </main>
    )
  }

  if (!center) {
    return <main className="rpd-page"><div className="container rpd-empty">Loading listing…</div></main>
  }

  const address = center.address_line
    ? `${center.address_line}, ${center.city || ''}, ${center.state || ''} ${center.zip || ''}`.replace(/\s+/g, ' ').trim()
    : center.location
  const gallery = [center.image, ...(center.gallery_urls || [])].filter(Boolean)
    .filter((url, index, all) => all.indexOf(url) === index)
  const embedUrl = mapsEmbedUrl(center.google_maps_url, address)
  const navItems = [
    ['about', 'About'],
    ['care', 'Care offered'],
    ['insurance', 'Insurance'],
    ['accreditations', 'Accreditations'],
    ['reviews', 'Reviews'],
    ['location', 'Location'],
  ]

  return (
    <main className="rpd-page">
      <div className="rpd-hero">
        <div className="rpd-hero-media" style={center.image ? { backgroundImage: `url(${center.image})` } : undefined} />
        <div className="rpd-hero-shade" />
        <div className="container rpd-hero-inner">
          <nav className="rpd-breadcrumb" aria-label="Breadcrumb">
            <Link to="/">Home</Link>
            <span>/</span>
            <Link to="/rehab-centers">Rehab Centers</Link>
            {center.state && <><span>/</span><span>{center.state}</span></>}
            {center.city && <><span>/</span><span>{center.city}</span></>}
          </nav>
          <div className="rpd-hero-copy">
            <div className="rpd-badge-row">
              {center.featured && <span className="rpd-featured">Featured</span>}
              {center.verified_badge && <span className="rpd-verified"><FaCheckCircle aria-hidden="true" /> Verified</span>}
            </div>
            <div className="rpd-title-row">
              <h1>{center.name}</h1>
            </div>
            <div className="rpd-meta">
              <Stars rating={center.rating} />
              {address && <span className="rpd-address"><FaMapMarkerAlt aria-hidden="true" /> {address}</span>}
            </div>
            <div className="rpd-hero-actions">
              {center.phone && <a className="btn rpd-call-btn" href={`tel:${center.phone.replace(/\D/g, '')}`}><FaPhone aria-hidden="true" /> {center.phone}</a>}
              {center.website && <a className="btn rpd-secondary-btn" href={center.website} target="_blank" rel="noreferrer"><FaGlobe aria-hidden="true" /> Website</a>}
              <a className="btn rpd-secondary-btn" href="#inquiry">Ask a question</a>
            </div>
          </div>
        </div>
      </div>

      {gallery.length > 0 && (
        <div className="container rpd-gallery">
          <div className={`rpd-gallery-grid ${gallery.length === 1 ? 'is-single' : gallery.length === 2 ? 'is-duo' : ''}`}>
            {gallery.slice(0, 3).map((url, index) => (
              <figure key={url} className={index === 0 ? 'is-main' : ''}>
                <img src={url} alt="" />
                {index === 2 && gallery.length > 3 && <span className="rpd-gallery-more">+{gallery.length - 2} photos</span>}
              </figure>
            ))}
            {center.video_url && (
              <a className="rpd-video-chip" href={center.video_url} target="_blank" rel="noreferrer">Watch facility video</a>
            )}
          </div>
        </div>
      )}

      <div className="rpd-nav-wrap">
        <div className="container">
          <nav className="rpd-section-nav" aria-label="Profile sections">
            {navItems.map(([id, label]) => (
              <a key={id} href={`#${id}`} className={activeSection === id ? 'is-active' : ''}>{label}</a>
            ))}
          </nav>
        </div>
      </div>

      <div className="container rpd-layout">
        <div className="rpd-content">
          <section id="about" className="rpd-section">
            <h2>About {center.name}</h2>
            <p>{center.description || 'This claimed center has published its profile on Struggling With Addiction.'}</p>
            <div className="rpd-quick-links">
              {center.phone && <a href={`tel:${center.phone.replace(/\D/g, '')}`}><FaPhone aria-hidden="true" /> {center.phone}</a>}
              {center.website && <a href={center.website} target="_blank" rel="noreferrer"><FaGlobe aria-hidden="true" /> Visit website</a>}
              {center.contact_email && <a href={`mailto:${center.contact_email}`}>{center.contact_email}</a>}
            </div>
          </section>

          <section id="care" className="rpd-section">
            <h2>Care offered</h2>
            <div className="rpd-care-grid">
              <div>
                <h3>Services</h3>
                <ChipList items={center.specialties} />
                {!center.specialties?.length && <p className="rpd-muted">Services will appear here when the center publishes them.</p>}
              </div>
              <div>
                <h3>Levels of care</h3>
                <ChipList items={center.levels_of_care} />
                {!center.levels_of_care?.length && <p className="rpd-muted">Levels of care not listed yet.</p>}
              </div>
              <div>
                <h3>Amenities</h3>
                <ChipList items={center.amenities} />
                {!center.amenities?.length && <p className="rpd-muted">Amenities not listed yet.</p>}
              </div>
            </div>
          </section>

          <section id="insurance" className="rpd-section">
            <h2>Insurance & payment</h2>
            <InsuranceList details={center.insurance_details} names={center.insurances} />
            {!center.insurances?.length && !center.insurance_details?.length && (
              <p className="rpd-muted">Ask the center about accepted plans using the inquiry form.</p>
            )}
            {center.phone && (
              <p className="rpd-help-banner">
                Need help verifying coverage?
                <a href={`tel:${center.phone.replace(/\D/g, '')}`}>Call {center.phone}</a>
              </p>
            )}
          </section>

          <section id="accreditations" className="rpd-section">
            <h2>Accreditations</h2>
            <div className="rpd-accreditation-grid">
              {(center.accreditations || []).map(item => (
                <div key={item} className="rpd-accreditation-card">{item}</div>
              ))}
            </div>
            {!center.accreditations?.length && <p className="rpd-muted">Accreditation details not published yet.</p>}
          </section>

          <ReviewsCarousel center={center} />

          <section id="location" className="rpd-section">
            <h2>Location</h2>
            <p className="rpd-address-line"><FaMapMarkerAlt aria-hidden="true" /> {address}</p>
            {embedUrl ? (
              <div className="rpd-map">
                <iframe title={`${center.name} map`} src={embedUrl} loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
              </div>
            ) : (
              <p className="rpd-muted">Map link not published yet.</p>
            )}
            {center.google_maps_url && (
              <a className="btn rpd-secondary-btn" href={center.google_maps_url} target="_blank" rel="noreferrer">Open in Google Maps</a>
            )}
          </section>

          <section className="rpd-section rpd-contact-band">
            <div>
              <h2>Ready to take the next step?</h2>
              <p>Send a private inquiry or call the admissions team directly.</p>
            </div>
            <div className="rpd-contact-band-actions">
              <a className="btn rpd-call-btn" href="#inquiry">Send inquiry</a>
              {center.phone && <a className="btn rpd-secondary-btn" href={`tel:${center.phone.replace(/\D/g, '')}`}>{center.phone}</a>}
            </div>
          </section>
        </div>

        <aside className="rpd-sidebar" id="inquiry">
          <div className="rpd-sticky">
            <InquiryForm center={center} />
            <div className="rpd-side-card">
              <p className="rpd-form-eyebrow">Need a faster answer?</p>
              {center.phone ? (
                <a className="btn rpd-call-btn rpd-side-call" href={`tel:${center.phone.replace(/\D/g, '')}`}>
                  <FaPhone aria-hidden="true" /> Call now
                </a>
              ) : (
                <p className="rpd-muted">Phone available after you inquire.</p>
              )}
              {center.website && (
                <a className="rpd-side-link" href={center.website} target="_blank" rel="noreferrer">
                  <FaGlobe aria-hidden="true" /> Visit website
                </a>
              )}
            </div>
          </div>
        </aside>
      </div>

      <div className="rpd-mobile-bar" aria-hidden="false">
        {center.phone && (
          <a className="rpd-mobile-call" href={`tel:${center.phone.replace(/\D/g, '')}`}>
            <FaPhone aria-hidden="true" /> Call
          </a>
        )}
        <a className="rpd-mobile-cta" href="#inquiry">Send inquiry</a>
      </div>
    </main>
  )
}
