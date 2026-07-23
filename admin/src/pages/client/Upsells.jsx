import { useEffect, useState } from 'react'
import { api } from '../../api'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'

export default function ClientUpsells() {
  const [products, setProducts] = useState([])
  const [err, setErr] = useState('')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState('')

  useEffect(() => {
    api('/api/client/upsells')
      .then(d => setProducts(d.products || []))
      .catch(e => setErr(e.message))
  }, [])

  async function buy(productType) {
    setBusy(productType)
    setErr('')
    setMsg('')
    try {
      const res = await api('/api/client/upsells/checkout', {
        method: 'POST',
        body: JSON.stringify({ product_type: productType }),
      })
      if (res.checkout_url) {
        window.location.href = res.checkout_url
        return
      }
      setMsg(res.message || 'Request received — a specialist will contact you.')
    } catch (e) {
      setErr(e.message)
    } finally {
      setBusy('')
    }
  }

  return (
    <div className="page-stack">
      <header className="page-header">
        <h1 className="page-title">Upsells.</h1>
        <p className="page-sub">Badge and placement are self-serve. Article packages are closed by a specialist.</p>
      </header>
      {err && <p className="form-error">{err}</p>}
      {msg && <p className="muted">{msg}</p>}
      <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
        {products.map(p => (
          <Card key={p.product_type}>
            <p className="eyebrow">{p.fulfillment === 'human' ? 'HUMAN CLOSE' : 'SELF-SERVE'}</p>
            <h3 style={{ marginTop: 8 }}>{p.label}</h3>
            <p style={{ fontSize: '1.25rem', fontWeight: 700, margin: '8px 0' }}>{p.price_label}</p>
            <p className="muted">{p.description}</p>
            <Button
              type="button"
              style={{ marginTop: 12 }}
              disabled={busy === p.product_type}
              onClick={() => buy(p.product_type)}
            >
              {busy === p.product_type
                ? 'Working…'
                : p.fulfillment === 'human'
                  ? 'Request package'
                  : 'Checkout'}
            </Button>
          </Card>
        ))}
      </div>
    </div>
  )
}
