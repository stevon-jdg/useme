import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useEffect, useRef } from 'react'

/**
 * Map tiles come from whatever provider VITE_MAP_TILE_URL points at (MapTiler, Geoapify, a self-hosted server).
 * The fallback is the public OpenStreetMap server, which is fine for development and NOT allowed for production traffic.
 */
const TILE_URL = (import.meta.env.VITE_MAP_TILE_URL as string | undefined) || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
const ATTRIBUTION =
  (import.meta.env.VITE_MAP_ATTRIBUTION as string | undefined) || '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'

export type LatLng = { lat: number; lng: number }

export type MapMarker = {
  id: string
  position: LatLng
  kind: 'pickup' | 'destination' | 'runner'
  label: string
}

const COLORS: Record<MapMarker['kind'], string> = {
  pickup: '#16834a',
  destination: '#d9272e',
  runner: '#171717',
}

function pin(kind: MapMarker['kind']) {
  const color = COLORS[kind]
  const inner = kind === 'runner' ? '<circle cx="14" cy="14" r="5" fill="#ffc928"/>' : '<circle cx="14" cy="13" r="5" fill="#fff"/>'
  return L.divIcon({
    className: '',
    iconSize: [28, 38],
    iconAnchor: [14, 36],
    html: `<svg width="28" height="38" viewBox="0 0 28 38" aria-hidden="true"><path d="M14 0C6.3 0 0 6.2 0 13.8 0 24 14 38 14 38s14-14 14-24.2C28 6.2 21.7 0 14 0z" fill="${color}"/>${inner}</svg>`,
  })
}

type Props = {
  center: LatLng
  zoom?: number
  markers?: MapMarker[]
  /** Called with the map centre when the person stops moving the map. Used for the "drag the map under the pin" picker. */
  onCenterChange?: (center: LatLng) => void
  /** Shows a fixed pin in the middle of the map. */
  centerPin?: MapMarker['kind'] | null
  /** Fit the view to these markers whenever they change. */
  fitToMarkers?: boolean
  className?: string
  label: string
}

/** Leaflet map. All the Leaflet code lives here so the rest of the app never touches it. */
export function MapView({ center, zoom = 14, markers = [], onCenterChange, centerPin = null, fitToMarkers = false, className, label }: Props) {
  const host = useRef<HTMLDivElement>(null)
  const map = useRef<L.Map | null>(null)
  const layer = useRef<L.LayerGroup | null>(null)
  const onChange = useRef(onCenterChange)
  onChange.current = onCenterChange

  useEffect(() => {
    if (!host.current || map.current) return
    const instance = L.map(host.current, { zoomControl: false, attributionControl: true }).setView([center.lat, center.lng], zoom)
    L.tileLayer(TILE_URL, { maxZoom: 19, attribution: ATTRIBUTION }).addTo(instance)
    L.control.zoom({ position: 'topright' }).addTo(instance)
    layer.current = L.layerGroup().addTo(instance)
    instance.on('moveend', () => {
      const c = instance.getCenter()
      onChange.current?.({ lat: c.lat, lng: c.lng })
    })
    map.current = instance
    return () => {
      instance.remove()
      map.current = null
      layer.current = null
    }
    // The map is created once. Later changes are applied by the effects below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const instance = map.current
    if (!instance || fitToMarkers) return
    const current = instance.getCenter()
    if (Math.abs(current.lat - center.lat) > 1e-6 || Math.abs(current.lng - center.lng) > 1e-6) {
      instance.setView([center.lat, center.lng], instance.getZoom())
    }
  }, [center.lat, center.lng, fitToMarkers])

  useEffect(() => {
    const instance = map.current
    const group = layer.current
    if (!instance || !group) return
    group.clearLayers()
    for (const marker of markers) {
      L.marker([marker.position.lat, marker.position.lng], { icon: pin(marker.kind), title: marker.label, keyboard: false }).addTo(group)
    }
    if (fitToMarkers && markers.length > 0) {
      const bounds = L.latLngBounds(markers.map((m) => [m.position.lat, m.position.lng] as [number, number]))
      instance.fitBounds(bounds, { padding: [48, 48], maxZoom: 16 })
    }
  }, [markers, fitToMarkers])

  return (
    <div className={`relative ${className ?? ''}`}>
      <div ref={host} role="application" aria-label={label} className="absolute inset-0 z-0" />
      {centerPin ? (
        <div className="pointer-events-none absolute left-1/2 top-1/2 z-[500] -translate-x-1/2 -translate-y-full" aria-hidden="true">
          <div dangerouslySetInnerHTML={{ __html: pin(centerPin).options.html as string }} />
        </div>
      ) : null}
    </div>
  )
}
