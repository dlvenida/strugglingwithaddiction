import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { trackSitePageview } from '../lib/analytics'

/** Fires a site analytics pageview on each public route change. */
export default function PageViewTracker() {
  const { pathname } = useLocation()

  useEffect(() => {
    // Wait a tick so document.title reflects the new page when possible.
    const t = window.setTimeout(() => trackSitePageview(pathname), 80)
    return () => window.clearTimeout(t)
  }, [pathname])

  return null
}
