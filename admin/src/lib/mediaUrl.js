import { getApiBase } from '../api'

/** Resolve image/upload paths for admin preview (legacy /images/* and /uploads/*). */
export function resolveMediaUrl(path) {
  if (!path) return null
  if (path.startsWith('http://') || path.startsWith('https://')) return path
  const base = getApiBase()
  if (path.startsWith('/')) return `${base}${path}`
  return `${base}/uploads/${path}`
}
