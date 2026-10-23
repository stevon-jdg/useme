/**
 * Place search by typing. Providers sit behind one function so the rest of the app never cares which is used.
 *   VITE_GEOCODE_PROVIDER=photon    (default) free public Photon server. Fine for development and light use,
 *                                   but it is a shared service with no guarantee, so use a keyed provider at launch.
 *   VITE_GEOCODE_PROVIDER=geoapify  needs VITE_GEOAPIFY_KEY. Has a free tier and clear terms.
 * Results are limited to the Jalingo area and ranked by closeness to its centre.
 */

export type Place = {
  /** What the person sees and what is sent to the runner after assignment. */
  label: string
  /** Neighbourhood or town, used for the area shown on offers before the runner accepts. */
  area: string
  lat: number
  lng: number
}

const CENTER = { lat: 8.8937, lng: 11.3596 }
const BOX = { minLng: CENTER.lng - 0.35, minLat: CENTER.lat - 0.35, maxLng: CENTER.lng + 0.35, maxLat: CENTER.lat + 0.35 }

const provider = (import.meta.env.VITE_GEOCODE_PROVIDER as string | undefined) ?? 'photon'
const geoapifyKey = import.meta.env.VITE_GEOAPIFY_KEY as string | undefined

type PhotonFeature = {
  geometry?: { coordinates?: number[] }
  properties?: Record<string, string | undefined>
}

export function mapPhoton(data: { features?: PhotonFeature[] }): Place[] {
  const out: Place[] = []
  for (const f of data.features ?? []) {
    const c = f.geometry?.coordinates
    const p = f.properties ?? {}
    const lng = c?.[0]
    const lat = c?.[1]
    if (typeof lng !== 'number' || typeof lat !== 'number') continue
    const area = p.district ?? p.suburb ?? p.locality ?? p.city ?? p.county ?? ''
    const street = [p.housenumber, p.street].filter(Boolean).join(' ')
    const parts = [p.name, street && street !== p.name ? street : undefined, area !== p.name ? area : undefined, p.city && p.city !== area ? p.city : undefined]
    const label = parts.filter(Boolean).join(', ')
    if (!label) continue
    out.push({ label, area: area || p.name || label, lat, lng })
  }
  return dedupe(out)
}

type GeoapifyFeature = { properties?: { formatted?: string; name?: string; suburb?: string; district?: string; city?: string; lat?: number; lon?: number } }

export function mapGeoapify(data: { features?: GeoapifyFeature[] }): Place[] {
  const out: Place[] = []
  for (const f of data.features ?? []) {
    const p = f.properties
    if (!p || typeof p.lat !== 'number' || typeof p.lon !== 'number') continue
    const label = p.formatted ?? p.name
    if (!label) continue
    out.push({ label, area: p.suburb ?? p.district ?? p.city ?? p.name ?? label, lat: p.lat, lng: p.lon })
  }
  return dedupe(out)
}

function dedupe(list: Place[]): Place[] {
  const seen = new Set<string>()
  return list.filter((p) => {
    const k = `${p.label}|${p.lat.toFixed(4)}|${p.lng.toFixed(4)}`
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
}

/** Searches for places by name. Returns [] for short queries. Throws on network failure so the screen can say so. */
export async function searchPlaces(query: string, signal?: AbortSignal): Promise<Place[]> {
  const q = query.trim()
  if (q.length < 3) return []

  if (provider === 'geoapify' && geoapifyKey) {
    const url =
      `https://api.geoapify.com/v1/geocode/autocomplete?text=${encodeURIComponent(q)}&limit=6&lang=en` +
      `&bias=proximity:${CENTER.lng},${CENTER.lat}&filter=rect:${BOX.minLng},${BOX.minLat},${BOX.maxLng},${BOX.maxLat}&apiKey=${geoapifyKey}`
    const res = await fetch(url, { signal })
    if (!res.ok) throw new Error('Place search is unavailable right now.')
    return mapGeoapify(await res.json())
  }

  const url =
    `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=6&lang=en&lat=${CENTER.lat}&lon=${CENTER.lng}` +
    `&bbox=${BOX.minLng},${BOX.minLat},${BOX.maxLng},${BOX.maxLat}`
  const res = await fetch(url, { signal })
  if (!res.ok) throw new Error('Place search is unavailable right now.')
  return mapPhoton(await res.json())
}

/** Names a spot on the map from its coordinates, so a runner sees a street or area and not "Pinned location". Returns null on any failure. */
export async function reverseGeocode(lat: number, lng: number, signal?: AbortSignal): Promise<Place | null> {
  try {
    const res = await fetch(`https://photon.komoot.io/reverse?lat=${lat}&lon=${lng}&lang=en`, { signal })
    if (!res.ok) return null
    const found = mapPhoton((await res.json()) as { features?: PhotonFeature[] })[0]
    return found ? { ...found, lat, lng } : null
  } catch {
    return null
  }
}
