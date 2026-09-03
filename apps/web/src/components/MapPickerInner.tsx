import { useEffect, useRef } from 'react'
import L from 'leaflet'

const PIN_SVG = `
<svg width="28" height="38" viewBox="0 0 28 38" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M14 0C6.268 0 0 6.268 0 14c0 10.5 14 24 14 24S28 24.5 28 14C28 6.268 21.732 0 14 0z" fill="#2563EB"/>
  <circle cx="14" cy="14" r="5.5" fill="white"/>
</svg>`

type Props = {
  center:     [number, number]
  onDragEnd:  (latLng: [number, number]) => void
}

export default function MapPickerInner({ center, onDragEnd }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef       = useRef<L.Map | null>(null)
  const markerRef    = useRef<L.Marker | null>(null)

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    const icon = L.divIcon({ html: PIN_SVG, iconSize: [28, 38], iconAnchor: [14, 38], className: '' })

    const map = L.map(containerRef.current, { zoomControl: true, scrollWheelZoom: false }).setView(center, 15)
    mapRef.current = map

    // CARTO cortó el acceso anónimo a basemaps.cartocdn.com — desde que
    // empezaron a exigir API key, los tiles sin key vienen con marca de agua
    // "API KEY REQUIRED" tapando el mapa entero (bug real, reportado con
    // captura). Tiles de OpenStreetMap directos: siguen siendo gratis y sin
    // key, mismo Leaflet — este mapa (un picker de dirección puntual en el
    // panel) está lejos de pesar lo suficiente como para chocar con su
    // política de uso razonable.
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      subdomains: 'abc',
      maxZoom: 19,
    }).addTo(map)

    const marker = L.marker(center, { draggable: true, icon }).addTo(map)
    markerRef.current = marker

    marker.on('dragend', () => {
      const pos = marker.getLatLng()
      onDragEnd([pos.lat, pos.lng])
    })

    return () => { map.remove(); mapRef.current = null; markerRef.current = null }
  }, [])

  useEffect(() => {
    if (!mapRef.current || !markerRef.current) return
    markerRef.current.setLatLng(center)
    mapRef.current.setView(center, 15)
  }, [center[0], center[1]])

  // isolation + z-index 0: Leaflet apila panes y controles con z-index
  // 400-1000 DENTRO del mapa; sin un stacking context propio se escapan por
  // encima de cualquier capa flotante del panel (el tutorial de primeros
  // pasos, modales, drawers). Aislado, el mapa compite como una sola caja.
  return <div ref={containerRef} style={{ height: 320, position: 'relative', isolation: 'isolate', zIndex: 0 }} />
}
