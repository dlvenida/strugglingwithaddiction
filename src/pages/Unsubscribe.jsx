import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { fetchApi } from '../lib/api'

export default function Unsubscribe() {
  const [params] = useSearchParams()
  const [message, setMessage] = useState('Updating your preferences…')
  useEffect(() => {
    const token = params.get('token')
    if (!token) { setMessage('This unsubscribe link is missing a token.'); return }
    fetchApi(`/api/outreach/unsubscribe?token=${encodeURIComponent(token)}`).then(r => setMessage(r.message)).catch(e => setMessage(e.message))
  }, [params])
  return <main className="container" style={{ padding: '4rem 1rem', textAlign: 'center' }}><h1>Email preferences</h1><p>{message}</p></main>
}
