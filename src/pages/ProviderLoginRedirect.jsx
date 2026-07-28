import { Navigate } from 'react-router-dom'

/** Legacy /provider links land on the public rehab provider login. */
export default function ProviderLoginRedirect() {
  return <Navigate to="/portal" replace />
}
