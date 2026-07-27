import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api } from '../api'

export default function PasswordRecovery() {
  const [params] = useSearchParams()
  const token = params.get('token')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  async function submit(e) {
    e.preventDefault()
    setError('')
    try {
      const result = token
        ? await api('/api/auth/reset-password', { method: 'POST', body: JSON.stringify({ token, new_password: password }) })
        : await api('/api/auth/request-password-reset', { method: 'POST', body: JSON.stringify({ email }) })
      setMessage(result.message)
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <main className="auth-page">
      <form className="auth-card" onSubmit={submit}>
        <h1>{token ? 'Set a new password' : 'Reset your password'}</h1>
        {!token && <><label>Account email</label><input type="email" value={email} onChange={e => setEmail(e.target.value)} required /></>}
        {token && <><label>New password</label><input type="password" minLength={8} value={password} onChange={e => setPassword(e.target.value)} required /></>}
        {error && <p className="error">{error}</p>}
        {message && <p className="success">{message}</p>}
        <button className="btn btn-primary" type="submit">{token ? 'Update password' : 'Email reset link'}</button>
        <Link to="/login">Back to login</Link>
      </form>
    </main>
  )
}
