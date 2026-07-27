function segment(value) {
  return String(value || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function rehabLandingPath(center) {
  const state = center.state || center.location?.split(',').at(-1)?.trim()
  const city = center.city || center.location?.split(',')[0]?.trim()
  if (!state || !city || !center.name) return null
  return `/rehabs/united-states/${segment(state)}/${segment(city)}/${segment(center.name)}`
}
