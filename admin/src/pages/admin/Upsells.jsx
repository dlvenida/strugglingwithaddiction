import { useEffect, useState } from 'react'
import { api } from '../../api'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'

export default function AdminUpsells() {
  const [orders, setOrders] = useState([])
  const [err, setErr] = useState('')

  const load = () => api('/api/admin/upsell-orders').then(setOrders).catch(e => setErr(e.message))
  useEffect(() => { load() }, [])

  async function markFulfilled(id) {
    try {
      await api(`/api/admin/upsell-orders/${id}?status=fulfilled`, { method: 'PATCH' })
      load()
    } catch (e) {
      setErr(e.message)
    }
  }

  return (
    <div className="page-stack">
      <header className="page-header">
        <h1 className="page-title">Upsells.</h1>
        <p className="page-sub">Self-serve badge/placement orders and human Article / AEO pipeline.</p>
      </header>
      {err && <p className="error">{err}</p>}
      <Card className="card-pad-0">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Center</th>
                <th>Product</th>
                <th>Fulfillment</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Created</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {orders.length === 0 ? (
                <tr><td colSpan={7} className="muted" style={{ padding: 24 }}>No upsell orders yet.</td></tr>
              ) : orders.map(order => (
                <tr key={order.id}>
                  <td>{order.center_name || order.rehab_center_id}</td>
                  <td>{order.product_type}</td>
                  <td>{order.fulfillment}</td>
                  <td>${((order.amount_cents || 0) / 100).toFixed(2)}</td>
                  <td><Badge tone={order.status === 'fulfilled' || order.status === 'paid' ? 'ok' : 'warn'}>{order.status}</Badge></td>
                  <td>{order.created_at ? new Date(order.created_at).toLocaleString() : '—'}</td>
                  <td>
                    {order.fulfillment === 'human' && order.status !== 'fulfilled' && (
                      <Button type="button" className="btn btn-ghost btn-sm" onClick={() => markFulfilled(order.id)}>Mark fulfilled</Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
