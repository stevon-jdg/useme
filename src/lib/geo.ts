export type Point = { lat: number; lng: number }

/** Straight-line distance in kilometres (haversine). The database uses the same formula. */
export function distanceKm(a: Point, b: Point): number {
  const R = 6371
  const rad = (d: number) => (d * Math.PI) / 180
  const dLat = rad(b.lat - a.lat)
  const dLng = rad(b.lng - a.lng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

/**
 * Until a routing service is connected, the road distance is estimated from the straight line.
 * The database checks the figure is plausible, and the screen labels it as an estimate.
 */
export function estimateRoadKm(a: Point, b: Point): number {
  const straight = distanceKm(a, b)
  return Math.max(0.1, Math.round(straight * 1.3 * 10) / 10)
}
