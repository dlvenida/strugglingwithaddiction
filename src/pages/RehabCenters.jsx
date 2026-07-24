import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { FaMapMarkerAlt, FaPhone, FaGlobe, FaStar, FaSearch } from 'react-icons/fa'
import { fetchApi, apiEnabled } from '../lib/api'
import { centerMatchesService, extractStateFromLocation, normalizeText, specialtyMatchesAnyService } from '../lib/rehabServices'
import { rehabLandingPath } from '../lib/rehabLanding'
import RehabSearch from '../components/RehabSearch'
import './RehabCenters.css'

export const STATIC_CENTERS = [
  {
    id: 1,
    name: 'Hazelden Betty Ford Foundation',
    location: 'Rancho Mirage, California',
    city: 'Rancho Mirage',
    state: 'California',
    address_line: '39000 Bob Hope Drive',
    zip: '92270',
    phone: '1-866-831-5700',
    website: 'https://www.hazeldenbettyford.org',
    image: '/images/rehab/hazelden-betty-ford.webp',
    gallery_urls: ['/images/rehab/hazelden-betty-ford.webp', '/images/rehab/caron-treatment-centers.webp', '/images/rehab/sierra-tucson.webp'],
    specialties: ['Inpatient Residential', 'Medical Detox', 'Dual Diagnosis', 'Telehealth'],
    levels_of_care: ['Detox', 'Residential', 'PHP', 'IOP', 'Outpatient'],
    amenities: ['Private Rooms Available', 'Family Program', 'Yoga & Meditation'],
    insurances: ['Aetna', 'Blue Cross Blue Shield', 'Cigna', 'UnitedHealthcare', 'Anthem', 'Optum'],
    insurance_details: [
      { name: 'Aetna', slug: 'aetna', logo_url: '/images/insurance/aetna.png' },
      { name: 'Blue Cross Blue Shield', slug: 'blue-cross-blue-shield', logo_url: '/images/insurance/blue-cross-blue-shield.png' },
      { name: 'Cigna', slug: 'cigna', logo_url: '/images/insurance/cigna.png' },
      { name: 'UnitedHealthcare', slug: 'unitedhealthcare', logo_url: '/images/insurance/unitedhealthcare.png' },
      { name: 'Anthem', slug: 'anthem', logo_url: '/images/insurance/anthem.png' },
      { name: 'Optum', slug: 'optum', logo_url: '/images/insurance/optum.png' },
    ],
    accreditations: ['Joint Commission', 'CARF'],
    testimonials: [
      { author: 'Former patient', quote: 'The staff treated me with dignity and gave me a clear path forward.', rating: 5 },
      { author: 'Family member', quote: 'We finally felt hope. Communication was clear from day one.', rating: 5 },
      { author: 'Alumni', quote: 'Compassionate care that helped our family rebuild.', rating: 5 },
      { author: 'Parent', quote: 'Aftercare support made the transition home feel possible.', rating: 4 },
    ],
    google_maps_url: 'https://maps.google.com/?q=Hazelden+Betty+Ford+Rancho+Mirage',
    google_reviews_url: 'https://www.google.com/maps/search/?api=1&query=Hazelden+Betty+Ford+Rancho+Mirage',
    description: 'The Betty Ford Center is a world-renowned inpatient addiction treatment facility co-founded in 1982 by former First Lady Betty Ford.',
    rating: 5,
    verified_badge: true,
    featured: true,
    claimed: true,
  },
  {
    id: 2,
    name: 'Caron Treatment Centers',
    location: 'Wernersville, Pennsylvania',
    city: 'Wernersville',
    state: 'Pennsylvania',
    address_line: '243 N Galen Hall Road',
    zip: '19565',
    phone: '1-800-854-6023',
    website: 'https://www.caron.org',
    image: '/images/rehab/caron-treatment-centers.webp',
    gallery_urls: ['/images/rehab/caron-treatment-centers.webp', '/images/rehab/hazelden-betty-ford.webp', '/images/rehab/the-ranch-tennessee.webp'],
    specialties: ['Medical Detox', 'Inpatient', 'Dual Diagnosis', 'Executive Program'],
    levels_of_care: ['Detox', 'Residential', 'Extended Care', 'Outpatient'],
    amenities: ['Executive Track', 'Family Support', 'Fitness Program'],
    insurances: ['Aetna', 'Cigna', 'UnitedHealthcare', 'Tricare'],
    insurance_details: [
      { name: 'Aetna', slug: 'aetna', logo_url: '/images/insurance/aetna.png' },
      { name: 'Cigna', slug: 'cigna', logo_url: '/images/insurance/cigna.png' },
      { name: 'UnitedHealthcare', slug: 'unitedhealthcare', logo_url: '/images/insurance/unitedhealthcare.png' },
      { name: 'Tricare', slug: 'tricare', logo_url: '/images/insurance/tricare.png' },
    ],
    accreditations: ['Joint Commission', 'LegitScript'],
    testimonials: [
      { author: 'Alumni', quote: 'Caron gave me structure, community, and tools I still use every day.', rating: 5 },
      { author: 'Parent', quote: 'The clinical team was honest, skilled, and deeply caring.', rating: 5 },
      { author: 'Alumni', quote: 'A structured program with real medical depth.', rating: 5 },
      { author: 'Spouse', quote: 'The family workshops helped us repair what addiction broke.', rating: 4 },
    ],
    google_maps_url: 'https://maps.google.com/?q=Caron+Treatment+Centers+Wernersville',
    google_reviews_url: 'https://www.google.com/maps/search/?api=1&query=Caron+Treatment+Centers+Wernersville',
    description: 'Caron is a nationally recognized nonprofit provider of comprehensive addiction and behavioral health treatment.',
    rating: 5,
    verified_badge: true,
    claimed: true,
  },
  {
    id: 3,
    name: 'Sierra Tucson',
    location: 'Tucson, Arizona',
    city: 'Tucson',
    state: 'Arizona',
    phone: '(844) 276-1469',
    website: 'https://www.sierratucson.com',
    image: '/images/rehab/sierra-tucson.webp',
    specialties: ['Residential', 'Trauma & PTSD', 'Eating Disorders', 'Equine Therapy'],
    description: 'Ranked #1 in Newsweek\'s Best Addiction Treatment Centers in Arizona for 2025.',
    rating: 5,
  },
  {
    id: 4,
    name: 'The Ranch Tennessee',
    location: 'Nunnelly, Tennessee',
    city: 'Nunnelly',
    state: 'Tennessee',
    phone: '(931) 416-1559',
    website: 'https://www.theranch.com',
    image: '/images/rehab/the-ranch-tennessee.webp',
    specialties: ['Substance Use', 'Mental Health', 'Equine Therapy', 'Extended Care'],
    description: 'Located on peaceful grounds along the Piney River, The Ranch combines traditional and alternative therapies.',
    rating: 4,
  },
  {
    id: 5,
    name: 'McLean Hospital',
    location: 'Belmont, Massachusetts',
    city: 'Belmont',
    state: 'Massachusetts',
    phone: '617-855-2000',
    website: 'https://www.mcleanhospital.org',
    image: '/images/rehab/mclean-hospital.webp',
    specialties: ['Harvard-Affiliated', 'Medical Detox', 'Inpatient & IOP', 'Co-occurring Disorders'],
    description: 'The largest psychiatric teaching hospital of Harvard Medical School.',
    rating: 5,
  },
]

// NOTE: Backend endpoints used:
// POST /api/rehab/claims/start - start claim with account info
// POST /api/rehab/claims/{ticket}/cert - upload certification file
// GET /api/rehab/claims/{ticket} - check claim status
// POST /api/billing/checkout-claim - checkout when certified (body: { ticket_number, interval })

function ClaimModal({ center, onClose }) {
  const [step, setStep] = useState(1) // 1=account, 2=confirm, 3=cert, 4=status
  const [ticket, setTicket] = useState('')
  const [claimStatus, setClaimStatus] = useState('')
  const [centerName, setCenterName] = useState('')
  const [checkoutReady, setCheckoutReady] = useState(false)
  const [error, setError] = useState('')
  const [uploading, setUploading] = useState(false)
  const [form, setForm] = useState({
    full_name: '',
    work_email: '',
    password: '',
    phone: '',
    job_title: '',
    facility_role: 'other',
    affiliation_text: '',
  })

  const handleAccountSubmit = async e => {
    e.preventDefault()
    setError('')
    setCenterName(center.name)
    setStep(2)
  }

  const handleConfirmFacility = async () => {
    setError('')
    if (apiEnabled()) {
      try {
        const res = await fetchApi('/api/rehab/claims/start', {
          method: 'POST',
          body: JSON.stringify({
            rehab_center_id: center.id,
            full_name: form.full_name,
            work_email: form.work_email,
            password: form.password,
            phone: form.phone,
            job_title: form.job_title,
            facility_role: form.facility_role,
            affiliation_text: form.affiliation_text,
          }),
        })
        setTicket(res.ticket_number)
        setClaimStatus(res.status)
        setCenterName(res.center_name || center.name)
        setCheckoutReady(res.checkout_ready || false)
        setStep(3)
      } catch (err) {
        setError(err.message)
      }
    } else {
      setTicket('DEMO-TICKET')
      setCenterName(center.name)
      setStep(3)
    }
  }

  const handleCertUpload = async e => {
    const file = e.target.files?.[0]
    if (!file) return
    setError('')
    setUploading(true)
    if (apiEnabled()) {
      try {
        const formData = new FormData()
        formData.append('file', file)
        const r = await fetch(`/api/rehab/claims/${ticket}/cert`, { method: 'POST', body: formData })
        const res = await r.json().catch(() => ({}))
        if (!r.ok) throw new Error(res.detail || 'Upload failed')
        setClaimStatus(res.status || 'under_review')
        setCheckoutReady(res.checkout_ready || false)
        setStep(4)
      } catch (err) {
        setError(err.message || 'Upload failed')
      }
    } else {
      setTimeout(() => {
        setClaimStatus('certified')
        setCheckoutReady(true)
        setStep(4)
      }, 800)
    }
    setUploading(false)
  }

  const goToCheckout = async interval => {
    if (apiEnabled()) {
      try {
        const res = await fetchApi('/api/billing/checkout-claim', {
          method: 'POST',
          body: JSON.stringify({ ticket_number: ticket, interval }),
        })
        window.location.href = res.checkout_url
      } catch (err) {
        setError(err.message)
      }
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="Close">×</button>

        {step === 1 && (
          <>
            <div className="modal-header">
              <span className="section-label">Step 1 of 3</span>
              <h3>Create Your Account</h3>
              <p>Set up your credentials to manage <strong>{center.name}</strong>.</p>
            </div>
            {error && <p style={{ color: '#8c1126', marginBottom: '0.5rem' }}>{error}</p>}
            <form className="modal-form" onSubmit={handleAccountSubmit}>
              <label>Full Name<input type="text" required value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} /></label>
              <label>Work Email<input type="email" required value={form.work_email} onChange={e => setForm(f => ({ ...f, work_email: e.target.value }))} /></label>
              <label>Password<input type="password" required minLength="8" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} /></label>
              <label>Phone<input type="tel" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} /></label>
              <button type="submit" className="btn">Continue</button>
            </form>
          </>
        )}

        {step === 2 && (
          <>
            <div className="modal-header">
              <span className="section-label">Step 2 of 3</span>
              <h3>Confirm Your Facility</h3>
              <p>You are claiming:</p>
            </div>
            <div style={{ background: '#f9fafb', padding: '1.25rem', borderRadius: '8px', marginBottom: '1.5rem', border: '1px solid #e5e7eb' }}>
              <h4 style={{ fontSize: '1.1rem', color: '#1a1a2e', margin: '0 0 0.25rem' }}>{centerName}</h4>
              <p style={{ fontSize: '0.88rem', color: '#6b7280', margin: 0 }}>{center.location}</p>
            </div>
            <div className="modal-form">
              {error && <p style={{ color: '#8c1126', marginBottom: '0.5rem' }}>{error}</p>}
              <button type="button" className="btn" onClick={handleConfirmFacility}>Yes, This Is Correct</button>
              <button type="button" className="btn" style={{ background: '#f3f4f6', color: '#374151' }} onClick={() => setStep(1)}>Back</button>
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <div className="modal-header">
              <span className="section-label">Step 3 of 3</span>
              <h3>Upload Certification</h3>
              <p>Provide proof you work at this facility (employment verification, business card, license, etc.)</p>
            </div>
            {error && <p style={{ color: '#8c1126', marginBottom: '0.5rem' }}>{error}</p>}
            <div className="modal-form">
              <label style={{ cursor: 'pointer', border: '2px dashed #98b8c4', borderRadius: '8px', padding: '2rem', textAlign: 'center', background: '#fafaf8', transition: 'background 0.2s' }} onMouseOver={e => e.currentTarget.style.background = '#f0f4f5'} onMouseOut={e => e.currentTarget.style.background = '#fafaf8'}>
                {uploading ? 'Uploading…' : 'Choose File to Upload'}
                <input type="file" accept="image/*,.pdf" onChange={handleCertUpload} style={{ display: 'none' }} disabled={uploading} />
              </label>
              <button type="button" className="btn" style={{ background: '#e5e7eb', color: '#6b7280' }} onClick={() => setStep(2)}>Back</button>
            </div>
          </>
        )}

        {step === 4 && (
          <div className="modal-success">
            <div className="modal-success-icon">✓</div>
            <h3>Claim Submitted!</h3>
            <p style={{ marginBottom: '1rem' }}>Ticket: <strong>{ticket}</strong></p>
            <p style={{ marginBottom: '1.5rem' }}><Link to={`/claim-status/${ticket}`}>Track your claim status →</Link></p>

            {checkoutReady && claimStatus === 'certified' && (
              <div style={{ background: '#f0f9ff', border: '1px solid #98b8c4', borderRadius: '8px', padding: '1.5rem', marginBottom: '1.5rem', textAlign: 'left' }}>
                <h4 style={{ fontSize: '1rem', margin: '0 0 0.5rem', color: '#1a1a2e' }}>🎉 Your certification is approved!</h4>
                <p style={{ fontSize: '0.9rem', color: '#4b5563', marginBottom: '1rem' }}>Subscribe now to publish your listing and start receiving leads.</p>
                <div style={{ display: 'flex', gap: '0.75rem', flexDirection: 'column' }}>
                  <button type="button" className="btn" onClick={() => goToCheckout('year')} style={{ fontSize: '0.9rem' }}>
                    <strong>$99/year</strong> <span style={{ fontSize: '0.8rem', marginLeft: '0.5rem', opacity: 0.85 }}>(Save 2 months!)</span>
                  </button>
                  <button type="button" className="btn" onClick={() => goToCheckout('month')} style={{ background: 'white', color: '#1a1a2e', border: '2px solid #e5e7eb', fontSize: '0.9rem' }}>
                    $9.99/month
                  </button>
                </div>
              </div>
            )}

            <button className="btn" style={{ background: '#e5e7eb', color: '#374151' }} onClick={onClose}>Close</button>
          </div>
        )}
      </div>
    </div>
  )
}

function filterCenters(centers, { query, state, service, insurance }) {
  const q = normalizeText(query)
  const insuranceNeedle = normalizeText(insurance)
  return centers.filter(center => {
    if (state) {
      const centerState = extractStateFromLocation(center.location)
      if (!centerState || normalizeText(centerState) !== normalizeText(state)) return false
    }
    if (service && !centerMatchesService(center.specialties, service)) return false
    if (insuranceNeedle) {
      const names = [
        ...(center.insurances || []),
        ...((center.insurance_details || []).map(d => d.name)),
      ]
      if (!names.some(name => normalizeText(name).includes(insuranceNeedle) || insuranceNeedle.includes(normalizeText(name)))) {
        return false
      }
    }
    if (q) {
      const blob = normalizeText([
        center.name,
        center.location,
        center.description,
        ...(center.specialties || []),
        ...(center.insurances || []),
      ].join(' '))
      if (!blob.includes(q)) return false
    }
    return true
  })
}

// NOTE: Backend endpoint used for leads:
// POST /api/rehab-centers/{slug}/leads body: { full_name, email, phone?, message, source_url? }

function LeadFormModal({ center, onClose }) {
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    full_name: '',
    email: '',
    phone: '',
    message: '',
  })

  const handleSubmit = async e => {
    e.preventDefault()
    setError('')
    if (apiEnabled()) {
      try {
        const slug = center.slug || center.id
        await fetchApi(`/api/rehab-centers/${slug}/leads`, {
          method: 'POST',
          body: JSON.stringify({
            ...form,
            source_url: window.location.href,
          }),
        })
        setSubmitted(true)
      } catch (err) {
        setError(err.message)
      }
    } else {
      setSubmitted(true)
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="Close">×</button>
        {submitted ? (
          <div className="modal-success">
            <div className="modal-success-icon">✓</div>
            <h3>Inquiry Sent!</h3>
            <p>Thank you for your interest in <strong>{center.name}</strong>. They will reach out to you soon.</p>
            <button className="btn" onClick={onClose}>Close</button>
          </div>
        ) : (
          <>
            <div className="modal-header">
              <span className="section-label">Contact Center</span>
              <h3>{center.name}</h3>
              <p>Fill out the form below and they will respond to your inquiry.</p>
            </div>
            {error && <p style={{ color: '#8c1126', marginBottom: '0.5rem' }}>{error}</p>}
            <form className="modal-form" onSubmit={handleSubmit}>
              <label>Your Name<input type="text" required value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} /></label>
              <label>Email<input type="email" required value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></label>
              <label>Phone<input type="tel" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} /></label>
              <label>Message<textarea rows="4" required value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))} placeholder="Tell us about yourself and what you're looking for..." /></label>
              <button type="submit" className="btn">Send Inquiry</button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}

export default function RehabCenters() {
  const [claimCenter, setClaimCenter] = useState(null)
  const [leadCenter, setLeadCenter] = useState(null)
  const [centers, setCenters] = useState(STATIC_CENTERS)
  const [loading, setLoading] = useState(apiEnabled())
  const [query, setQuery] = useState('')
  const [stateFilter, setStateFilter] = useState('')
  const [serviceFilter, setServiceFilter] = useState('')
  const [insuranceFilter, setInsuranceFilter] = useState('')
  const [insuranceOptions, setInsuranceOptions] = useState([])

  useEffect(() => {
    if (!apiEnabled()) return
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 2500)
    fetchApi('/api/rehab-centers', { signal: controller.signal })
      .then(data => {
        if (data?.length) setCenters(data)
      })
      .catch(() => {})
      .finally(() => {
        clearTimeout(timeout)
        setLoading(false)
      })
    fetchApi('/api/insurances').then(data => {
      if (Array.isArray(data)) setInsuranceOptions(data)
    }).catch(() => {})
    return () => {
      clearTimeout(timeout)
      controller.abort()
    }
  }, [])

  const hasActiveFilters = Boolean(query || stateFilter || serviceFilter || insuranceFilter)
  const filteredCenters = useMemo(
    () => filterCenters(centers, {
      query,
      state: stateFilter,
      service: serviceFilter,
      insurance: insuranceFilter,
    }),
    [centers, query, stateFilter, serviceFilter, insuranceFilter],
  )

  function clearFilters() {
    setQuery('')
    setStateFilter('')
    setServiceFilter('')
    setInsuranceFilter('')
  }

  return (
    <main className="rehab-page">
      <section className="rehab-hero">
        <div className="rehab-hero-overlay" />
        <div className="container rehab-hero-content">
          <span className="section-label" style={{ color: '#98b8c4' }}>Find Help Near You</span>
          <h1>Trusted Rehab Centers<br />Across the USA</h1>
          <p>Accredited treatment facilities with proven track records of helping people reclaim their lives from addiction.</p>
        </div>
      </section>

      <div className="container">
        <RehabSearch
          query={query}
          onQueryChange={setQuery}
          state={stateFilter}
          onStateChange={setStateFilter}
          service={serviceFilter}
          onServiceChange={setServiceFilter}
          insurance={insuranceFilter}
          onInsuranceChange={setInsuranceFilter}
          insuranceOptions={insuranceOptions}
          resultCount={filteredCenters.length}
          totalCount={centers.length}
          onClear={clearFilters}
          hasActiveFilters={hasActiveFilters}
        />
      </div>

      <div className="rehab-intro-bar">
        <div className="container rehab-intro-inner">
          <p>
            {loading ? (
              <>Loading featured centers…</>
            ) : hasActiveFilters ? (
              <>Refine your search above or browse all <strong>{centers.length} centers</strong>.</>
            ) : (
              <>Are you a treatment provider? <Link to="/provider">Log in to the provider platform</Link> or <strong>claim your listing</strong> below.</>
            )}
          </p>
        </div>
      </div>

      <section className="rehab-list-section">
        <div className="container rehab-list">
          {loading && <p style={{ textAlign: 'center', padding: '2rem', color: '#666' }}>Loading centers…</p>}
          {!loading && filteredCenters.length === 0 && (
            <div className="rehab-empty-state">
              <div className="rehab-empty-state-icon" aria-hidden="true"><FaSearch /></div>
              <h3>No centers match your search</h3>
              <p>Try adjusting your filters or search term — we&apos;re adding new accredited facilities regularly.</p>
              <button type="button" className="btn" onClick={clearFilters}>Clear all filters</button>
            </div>
          )}
          {!loading && filteredCenters.map(center => {
            const landingPath = center.claimed ? rehabLandingPath(center) : null
            return (
            <article className="rehab-card" key={center.id}>
              <div className="rehab-card-img-wrap">
                {center.image && (landingPath
                  ? <Link to={landingPath} aria-label={`View ${center.name} landing page`}><img src={center.image} alt={center.name} loading="lazy" /></Link>
                  : <img src={center.image} alt={center.name} loading="lazy" />
                )}
              </div>
              <div className="rehab-card-body">
                <div className="rehab-card-top">
                  <div>
                    <div className="rehab-name-row">
                      <h2>{landingPath ? <Link to={landingPath}>{center.name}</Link> : center.name}</h2>
                      {center.featured && <span className="rehab-featured-badge">Featured</span>}
                      {center.verified_badge && <span className="rehab-verified-badge">Verified</span>}
                      {center.claimed && <span className="rehab-claimed-badge">✓ Claimed</span>}
                    </div>
                    <div className="rehab-card-meta">
                      <span className="rehab-location"><FaMapMarkerAlt aria-hidden="true" /> {center.location}</span>
                      <span className="rehab-stars" aria-label={`${center.rating} out of 5 stars`}>
                        {Array.from({ length: 5 }).map((_, i) => (
                          <FaStar key={i} style={{ color: i < center.rating ? '#8c1126' : '#e5e7eb' }} />
                        ))}
                      </span>
                    </div>
                  </div>
                  {!center.claimed && (
                    <button className="btn rehab-claim-btn" onClick={() => setClaimCenter(center)}>Claim This Center</button>
                  )}
                </div>
                <div className="rehab-specialties">
                  {(center.specialties || []).map(s => (
                    <span
                      className={`rehab-tag${serviceFilter && specialtyMatchesAnyService(s, [serviceFilter]) ? ' rehab-tag--match' : ''}`}
                      key={s}
                    >
                      {s}
                    </span>
                  ))}
                </div>
                <p className="rehab-description">{center.description}</p>
                <div className="rehab-card-footer">
                  {center.claimed && center.phone ? (
                    <>
                      <div className="rehab-card-contacts">
                        <a href={`tel:${center.phone.replace(/\D/g, '')}`} className="rehab-contact"><FaPhone aria-hidden="true" /> {center.phone}</a>
                        {center.website && (
                          <a href={center.website} target="_blank" rel="noopener noreferrer" className="rehab-contact"><FaGlobe aria-hidden="true" /> Visit Website</a>
                        )}
                      </div>
                      <div className="rehab-card-actions">
                        <button type="button" className="btn rehab-action-btn" onClick={() => setLeadCenter(center)}>Send Inquiry</button>
                        {landingPath && <Link to={landingPath} className="btn rehab-action-btn rehab-action-btn--primary">View</Link>}
                        <a href={`tel:${center.phone.replace(/\D/g, '')}`} className="btn rehab-action-btn">Call Now</a>
                      </div>
                    </>
                  ) : (
                    <p className="rehab-unclaimed-notice"><FaPhone aria-hidden="true" /> Contact info available after claiming this listing.</p>
                  )}
                </div>
              </div>
            </article>
            )
          })}
        </div>
      </section>

      <section className="rehab-cta-section">
        <div className="container rehab-cta-inner">
          <div>
            <h2>Is Your Facility Missing?</h2>
            <p>We list accredited, high-quality treatment centers committed to ethical care.</p>
          </div>
          <div className="rehab-cta-btns">
            <button className="btn btn-white" onClick={() => setClaimCenter(centers[0])}>Submit Your Center</button>
            <Link to="/provider" className="btn btn-white-outline">Provider Login</Link>
            <a href="tel:18005551234" className="btn btn-white-outline">Call Our Team</a>
          </div>
        </div>
      </section>

      {claimCenter && <ClaimModal center={claimCenter} onClose={() => setClaimCenter(null)} />}
      {leadCenter && <LeadFormModal center={leadCenter} onClose={() => setLeadCenter(null)} />}
    </main>
  )
}
