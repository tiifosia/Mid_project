import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import { feature } from 'topojson-client'
import countries from 'world-atlas/countries-110m.json'
import { VIDEOS } from './videos.js'
import VideoModal from './VideoModal.jsx'

// 날짜변경선(180°)을 넘는 나라(러시아, 피지)가 화면을 가로지르는 띠로 그려지지 않도록 경도를 이어 붙인다
const unwrapRing = (ring) => {
  let offset = 0
  return ring.map(([x, y], i) => {
    if (i) {
      const d = x - ring[i - 1][0]
      if (d > 180) offset -= 360
      else if (d < -180) offset += 360
    }
    return [x + offset, y]
  })
}

const worldShapes = feature(countries, countries.objects.countries).features
  .filter((f) => f.properties.name !== 'Antarctica')
  .map((f) => {
    const g = f.geometry
    const coordinates =
      g.type === 'Polygon' ? g.coordinates.map(unwrapRing) : g.coordinates.map((poly) => poly.map(unwrapRing))
    return { ...f, geometry: { ...g, coordinates } }
  })

export default function HostView() {
  const mapEl = useRef(null)
  const [selected, setSelected] = useState(null)

  useEffect(() => {
    const map = L.map(mapEl.current, {
      center: [30, 10],
      zoom: 3,
      minZoom: 2,
      zoomControl: false,
      attributionControl: false,
      maxBounds: [[-85, -180], [85, 180]],
      maxBoundsViscosity: 1,
    })
    // 외부 타일 대신 Natural Earth 국가 경계(퍼블릭 도메인)를 직접 그린다: API 키 불필요, 오프라인 동작
    L.geoJSON(worldShapes, {
      interactive: false,
      style: { fillColor: '#333333', fillOpacity: 1, color: '#8d8d8d', weight: 0.5, opacity: 0.35 },
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
        <div ref={mapEl} className="h-full w-full bg-background" />
      </div>
      {/* 모달을 열기 전에 영상을 미리 받아 두어 즉시 재생되게 한다 */}
      <div hidden>
        {VIDEOS.map(({ id }) => (
          <video key={id} src={`${import.meta.env.BASE_URL}videos/${id}.mp4`} preload="auto" muted />
        ))}
      </div>
      {selected && <VideoModal id={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}
