import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import { VIDEOS } from './videos.js'
import VideoModal from './VideoModal.jsx'

export default function HostView() {
  const mapEl = useRef(null)
  const [selected, setSelected] = useState(null)

  useEffect(() => {
    const map = L.map(mapEl.current, {
      center: [30, 10],
      zoom: 3,
      minZoom: 2,
      zoomControl: false,
      worldCopyJump: true,
    })
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OpenStreetMap &copy; CARTO',
    }).addTo(map)
    const icon = L.divIcon({ className: '', html: '<div class="marker-pulse"></div>', iconSize: [20, 20] })
    VIDEOS.forEach(({ id, position }) =>
      L.marker(position, { icon }).addTo(map).on('click', () => setSelected(id)),
    )
    return () => map.remove()
  }, [])

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-background">
      <div className={`h-full w-full transition-all duration-500 ${selected ? 'blur-2xl' : ''}`}>
        <div ref={mapEl} className="h-full w-full bg-surface" />
      </div>
      {selected && <VideoModal id={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}
